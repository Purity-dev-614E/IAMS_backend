const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');

const googleClient = new OAuth2Client();

const getGoogleClientId = () => process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID;

// Generate JWT access token
const generateToken = (userId, email, role) => {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    { expiresIn: '15m' } // Short-lived access token
  );
};

// Generate refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Store refresh token in database
const storeRefreshToken = async (userId, refreshToken) => {
  // Revoke existing refresh tokens for this user
  await db('refresh_tokens')
    .where({ user_id: userId, is_revoked: false })
    .update({ is_revoked: true });

  // Calculate expiry (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Store new refresh token
  await db('refresh_tokens').insert({
    user_id: userId,
    token: refreshToken,
    expires_at: expiresAt
  });
};

const assertUserCanLogin = (user, res) => {
  if (user.status === 'pending') {
    res.status(401).json({
      success: false,
      message: 'Account pending admin approval'
    });
    return false;
  }

  if (user.status === 'rejected') {
    res.status(401).json({
      success: false,
      message: 'Account registration rejected'
    });
    return false;
  }

  if (user.status === 'inactive') {
    res.status(401).json({
      success: false,
      message: 'Account is inactive'
    });
    return false;
  }

  return true;
};

const sendLoginResponse = async (res, user, message) => {
  const token = generateToken(user.id, user.email, user.role);
  const refreshToken = generateRefreshToken();
  await storeRefreshToken(user.id, refreshToken);

  res.json({
    success: true,
    message,
    token,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    }
  });
};

// Register new user
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'student', staff_id, reg_number, program, year_of_study } = req.body;

  // Check if user already exists
  const existingUser = await db('users').where({ email }).first();
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // For supervisors, check if staff_id already exists
  if (role === 'uni_supervisor' && staff_id) {
    const existingStaffId = await db('users').where({ staff_id }).first();
    if (existingStaffId) {
      return res.status(409).json({
        success: false,
        message: 'Staff ID already exists'
      });
    }
  }

  // For students, check if reg_number already exists
  if (role === 'student' && reg_number) {
    const existingRegNumber = await db('students').where({ reg_number }).first();
    if (existingRegNumber) {
      return res.status(409).json({
        success: false,
        message: 'Registration number already exists'
      });
    }
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const [user] = await db('users').insert({
    name,
    email,
    password_hash: passwordHash,
    role,
    staff_id: role === 'uni_supervisor' ? staff_id : null,
    // For supervisors, set as pending approval
    status: role === 'uni_supervisor' ? 'pending' : 'active'
  }).returning('*');

  // Create student profile if role is student
  let studentProfile = null;
  if (role === 'student' && reg_number && program && year_of_study) {
    try {
      [studentProfile] = await db('students').insert({
        user_id: user.id,
        reg_number,
        program,
        year_of_study
      }).returning('*');
    } catch (error) {
      // Rollback user creation if student profile fails
      await db('users').where({ id: user.id }).del();
      throw error;
    }
  }

  // Generate token only for active users (students) or admins
  let token = null;
  let refreshToken = null;
  let message = '';
  
  if (role === 'student' || role === 'admin') {
    token = generateToken(user.id, user.email, user.role);
    refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);
    message = role === 'student' 
      ? 'Student registered successfully' 
      : 'Admin registered successfully';
  } else if (role === 'uni_supervisor') {
    message = 'Supervisor registration submitted. Awaiting admin approval.';
    // TODO: Send notification to admin
  }

  const response = {
    success: true,
    message,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    }
  };

  if (token) {
    response.token = token;
    response.refreshToken = refreshToken;
  }

  if (studentProfile) {
    response.student = studentProfile;
  }

  const statusCode = role === 'uni_supervisor' ? 201 : 201;
  res.status(statusCode).json(response);
});

// Login user
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user
  const user = await db('users').where({ email }).first();
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  if (!assertUserCanLogin(user, res)) {
    return;
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  await sendLoginResponse(res, user, 'Login successful');
});

// Login with Google ID token
const googleLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  const googleClientId = getGoogleClientId();

  if (!googleClientId) {
    return res.status(500).json({
      success: false,
      message: 'Google sign-in is not configured'
    });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClientId
    });
    payload = ticket.getPayload();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid Google token'
    });
  }

  if (!payload?.email || payload.email_verified !== true) {
    return res.status(401).json({
      success: false,
      message: 'Google account email is not verified'
    });
  }

  const user = await db('users')
    .whereRaw('LOWER(email) = ?', [payload.email.toLowerCase()])
    .first();

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'No IAMS account is linked to this Google email'
    });
  }

  if (!assertUserCanLogin(user, res)) {
    return;
  }

  await sendLoginResponse(res, user, 'Google login successful');
});

// Get current user profile
const getProfile = asyncHandler(async (req, res) => {
  const user = await db('users')
    .where({ id: req.user.id })
    .select('id', 'name', 'email', 'role', 'created_at')
    .first();

  res.json({
    success: true,
    user
  });
});

// Update user profile
const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  
  await db('users')
    .where({ id: req.user.id })
    .update({ name });

  const updatedUser = await db('users')
    .where({ id: req.user.id })
    .select('id', 'name', 'email', 'role', 'updated_at')
    .first();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: updatedUser
  });
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await db('users')
    .where({ id: req.user.id })
    .select('password_hash')
    .first();

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Hash new password
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await db('users')
    .where({ id: req.user.id })
    .update({ 
      password_hash: newPasswordHash,
      updated_at: new Date()
    });

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Refresh access token
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token required'
    });
  }

  // Find refresh token in database
  const tokenRecord = await db('refresh_tokens')
    .where({ token: refreshToken, is_revoked: false })
    .first();

  if (!tokenRecord) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }

  // Check if refresh token has expired
  if (new Date() > new Date(tokenRecord.expires_at)) {
    // Mark as expired
    await db('refresh_tokens')
      .where({ id: tokenRecord.id })
      .update({ is_revoked: true });

    return res.status(401).json({
      success: false,
      message: 'Refresh token expired'
    });
  }

  // Get user details
  const user = await db('users')
    .where({ id: tokenRecord.user_id })
    .first();

  if (!user || user.status === 'pending' || user.status === 'rejected') {
    return res.status(401).json({
      success: false,
      message: 'User account not active'
    });
  }

  // Generate new tokens
  const newAccessToken = generateToken(user.id, user.email, user.role);
  const newRefreshToken = generateRefreshToken();

  // Store new refresh token and revoke old one
  await storeRefreshToken(user.id, newRefreshToken);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    token: newAccessToken,
    refreshToken: newRefreshToken
  });
});

// Logout (invalidate refresh token)
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    // Invalidate the refresh token
    await db('refresh_tokens')
      .where({ token: refreshToken })
      .update({ is_revoked: true });
  }

  res.json({
    success: true,
    message: 'Logout successful'
  });
});

module.exports = {
  register,
  login,
  googleLogin,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  logout
};

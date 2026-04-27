const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');

// Generate JWT token
const generateToken = (userId, email, role) => {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    { expiresIn: '24h' }
  );
};

// Register new user
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'student', reg_number, program, year_of_study } = req.body;

  // Check if user already exists
  const existingUser = await db('users').where({ email }).first();
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'User with this email already exists'
    });
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
  let message = '';
  
  if (role === 'student' || role === 'admin') {
    token = generateToken(user.id, user.email, user.role);
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

  // Check if user is active (for supervisors)
  if (user.status === 'pending') {
    return res.status(401).json({
      success: false,
      message: 'Account pending admin approval'
    });
  }

  if (user.status === 'rejected') {
    return res.status(401).json({
      success: false,
      message: 'Account registration rejected'
    });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Generate token
  const token = generateToken(user.id, user.email, user.role);

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    }
  });
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

// Logout (client-side token invalidation)
const logout = asyncHandler(async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // Optionally, we could implement a token blacklist here
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout
};

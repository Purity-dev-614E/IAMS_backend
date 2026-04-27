const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');

// Get all users (admin only)
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const offset = (page - 1) * limit;

  let query = db('users')
    .select('id', 'name', 'email', 'role', 'created_at', 'updated_at')
    .orderBy('created_at', 'desc');

  // Filter by role
  if (role) {
    query = query.where('role', role);
  }

  // Search by name or email
  if (search) {
    query = query.where(function() {
      this.where('name', 'ilike', `%${search}%`)
          .orWhere('email', 'ilike', `%${search}%`);
    });
  }

  // Get total count
  const totalQuery = query.clone().clearSelect().clearOrder().count('* as total');
  const [{ total }] = await totalQuery;

  // Get paginated results
  const users = await query.limit(limit).offset(offset);

  res.json({
    success: true,
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get user by ID
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await db('users')
    .where({ id })
    .select('id', 'name', 'email', 'role', 'created_at', 'updated_at')
    .first();

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    user
  });
});

// Create user (admin only)
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Check if user already exists
  const existingUser = await db('users').where({ email }).first();
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // Hash password
  const bcrypt = require('bcryptjs');
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const [user] = await db('users').insert({
    name,
    email,
    password_hash: passwordHash,
    role
  }).returning('*');

  // Remove password hash from response
  const { password_hash, ...userResponse } = user;

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    user: userResponse
  });
});

// Update user (admin only)
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;

  // Check if user exists
  const existingUser = await db('users').where({ id }).first();
  if (!existingUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check email uniqueness if email is being changed
  if (email && email !== existingUser.email) {
    const emailCheck = await db('users').where({ email }).whereNot('id', id).first();
    if (emailCheck) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }
  }

  // Update user
  const [updatedUser] = await db('users')
    .where({ id })
    .update({ 
      name: name || existingUser.name,
      email: email || existingUser.email,
      role: role || existingUser.role,
      updated_at: new Date()
    })
    .returning('*');

  const { password_hash, ...userResponse } = updatedUser;

  res.json({
    success: true,
    message: 'User updated successfully',
    user: userResponse
  });
});

// Delete user (admin only)
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user exists
  const user = await db('users').where({ id }).first();
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if user has related records
  const student = await db('students').where('user_id', id).first();
  if (student) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete user with associated student records'
    });
  }

  // Delete user
  await db('users').where({ id }).del();

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
});

// Get users by role
const getUsersByRole = asyncHandler(async (req, res) => {
  const { role } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const users = await db('users')
    .where({ role })
    .select('id', 'name', 'email', 'status', 'created_at')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  const total = await db('users').where({ role }).count('* as total');

  res.json({
    success: true,
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total[0].total),
      pages: Math.ceil(total[0].total / limit)
    }
  });
});

// Get pending supervisors (admin only)
const getPendingSupervisors = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const supervisors = await db('users')
    .where({ role: 'uni_supervisor', status: 'pending' })
    .select('id', 'name', 'email', 'created_at')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  const total = await db('users')
    .where({ role: 'uni_supervisor', status: 'pending' })
    .count('* as total');

  res.json({
    success: true,
    supervisors,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total[0].total),
      pages: Math.ceil(total[0].total / limit)
    }
  });
});

// Approve supervisor (admin only)
const approveSupervisor = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user exists and is a pending supervisor
  const user = await db('users')
    .where({ id, role: 'uni_supervisor', status: 'pending' })
    .first();

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Pending supervisor not found'
    });
  }

  // Update status to active
  await db('users')
    .where({ id })
    .update({ 
      status: 'active',
      updated_at: new Date()
    });

  // TODO: Send approval email to supervisor

  res.json({
    success: true,
    message: 'Supervisor approved successfully'
  });
});

// Reject supervisor (admin only)
const rejectSupervisor = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user exists and is a pending supervisor
  const user = await db('users')
    .where({ id, role: 'uni_supervisor', status: 'pending' })
    .first();

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Pending supervisor not found'
    });
  }

  // Update status to rejected
  await db('users')
    .where({ id })
    .update({ 
      status: 'rejected',
      updated_at: new Date()
    });

  // TODO: Send rejection email to supervisor

  res.json({
    success: true,
    message: 'Supervisor registration rejected'
  });
});

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUsersByRole,
  getPendingSupervisors,
  approveSupervisor,
  rejectSupervisor
};

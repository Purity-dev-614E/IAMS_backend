const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');

// Get all attachments (admin/supervisor)
const getAllAttachments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, status, organization } = req.query;
  const offset = (page - 1) * limit;

  let query = db('attachments')
    .join('students', 'attachments.student_id', 'students.id')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('users as supervisors', 'students.uni_supervisor_id', 'supervisors.id')
    .select(
      'attachments.id',
      'attachments.organization_name',
      'attachments.industry_supervisor_name',
      'attachments.industry_supervisor_email',
      'attachments.start_date',
      'attachments.end_date',
      'attachments.status',
      'attachments.created_at',
      'users.name as student_name',
      'users.email as student_email',
      'students.reg_number',
      'students.program',
      'students.year_of_study',
      'supervisors.name as supervisor_name',
      'supervisors.email as supervisor_email'
    )
    .orderBy('attachments.created_at', 'desc');

  // Apply filters
  if (search) {
    query = query.where(function() {
      this.where('attachments.organization_name', 'ilike', `%${search}%`)
          .orWhere('users.name', 'ilike', `%${search}%`)
          .orWhere('students.reg_number', 'ilike', `%${search}%`);
    });
  }

  if (status) {
    query = query.where('attachments.status', status);
  }

  if (organization) {
    query = query.where('attachments.organization_name', 'ilike', `%${organization}%`);
  }

  // Get total count
  const totalQuery = query.clone().clearSelect().clearOrder().count('* as total');
  const [{ total }] = await totalQuery;

  // Get paginated results
  const attachments = await query.limit(limit).offset(offset);

  res.json({
    success: true,
    attachments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get attachment by ID
const getAttachmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const attachment = await db('attachments')
    .join('students', 'attachments.student_id', 'students.id')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('users as supervisors', 'students.uni_supervisor_id', 'supervisors.id')
    .select(
      'attachments.id',
      'attachments.organization_name',
      'attachments.industry_supervisor_name',
      'attachments.industry_supervisor_email',
      'attachments.start_date',
      'attachments.end_date',
      'attachments.status',
      'attachments.created_at',
      'attachments.updated_at',
      'users.name as student_name',
      'users.email as student_email',
      'students.reg_number',
      'students.program',
      'students.year_of_study',
      'supervisors.name as supervisor_name',
      'supervisors.email as supervisor_email'
    )
    .where('attachments.id', id)
    .first();

  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: 'Attachment not found'
    });
  }

  res.json({
    success: true,
    attachment
  });
});

// Create attachment (student)
const createAttachment = asyncHandler(async (req, res) => {
  const {
    organization_name,
    industry_supervisor_name,
    industry_supervisor_email,
    start_date,
    end_date
  } = req.body;

  // Get student profile
  const student = await db('students').where('user_id', req.user.id).first();
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  // Check if student already has active attachment
  const existingAttachment = await db('attachments')
    .where('student_id', student.id)
    .where('status', 'active')
    .first();

  if (existingAttachment) {
    return res.status(409).json({
      success: false,
      message: 'Student already has an active attachment'
    });
  }

  // Validate dates
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  const today = new Date();

  if (startDate >= endDate) {
    return res.status(400).json({
      success: false,
      message: 'End date must be after start date'
    });
  }

  if (startDate > today) {
    return res.status(400).json({
      success: false,
      message: 'Start date cannot be in the future'
    });
  }

  // Create attachment
  const [attachment] = await db('attachments').insert({
    student_id: student.id,
    organization_name,
    industry_supervisor_name,
    industry_supervisor_email,
    start_date,
    end_date,
    status: 'pending'
  }).returning('*');

  res.status(201).json({
    success: true,
    message: 'Attachment created successfully',
    attachment
  });
});

// Update attachment (admin only)
const updateAttachment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    organization_name,
    industry_supervisor_name,
    industry_supervisor_email,
    start_date,
    end_date,
    status
  } = req.body;

  // Check if attachment exists
  const existingAttachment = await db('attachments').where({ id }).first();
  if (!existingAttachment) {
    return res.status(404).json({
      success: false,
      message: 'Attachment not found'
    });
  }

  // Validate dates if provided
  if (start_date && end_date) {
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }
  }

  // Update attachment
  const [updatedAttachment] = await db('attachments')
    .where({ id })
    .update({
      organization_name: organization_name || existingAttachment.organization_name,
      industry_supervisor_name: industry_supervisor_name || existingAttachment.industry_supervisor_name,
      industry_supervisor_email: industry_supervisor_email || existingAttachment.industry_supervisor_email,
      start_date: start_date || existingAttachment.start_date,
      end_date: end_date || existingAttachment.end_date,
      status: status || existingAttachment.status,
      updated_at: new Date()
    })
    .returning('*');

  res.json({
    success: true,
    message: 'Attachment updated successfully',
    attachment: updatedAttachment
  });
});

// Update attachment status (admin)
const updateAttachmentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'active', 'completed'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Must be pending, active, or completed'
    });
  }

  // Check if attachment exists
  const attachment = await db('attachments').where({ id }).first();
  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: 'Attachment not found'
    });
  }

  // Update status
  await db('attachments')
    .where({ id })
    .update({ 
      status,
      updated_at: new Date()
    });

  res.json({
    success: true,
    message: 'Attachment status updated successfully'
  });
});

// Get student's attachments
const getStudentAttachments = asyncHandler(async (req, res) => {
  const student = await db('students').where('user_id', req.user.id).first();
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  const attachments = await db('attachments')
    .where('student_id', student.id)
    .orderBy('created_at', 'desc')
    .select('*');

  res.json({
    success: true,
    attachments
  });
});

// Delete attachment (admin only)
const deleteAttachment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if attachment exists
  const attachment = await db('attachments').where({ id }).first();
  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: 'Attachment not found'
    });
  }

  // Check for related daily logs
  const dailyLogs = await db('daily_logs').where('attachment_id', id).first();
  if (dailyLogs) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete attachment with associated daily logs'
    });
  }

  // Delete attachment
  await db('attachments').where({ id }).del();

  res.json({
    success: true,
    message: 'Attachment deleted successfully'
  });
});

module.exports = {
  getAllAttachments,
  getAttachmentById,
  createAttachment,
  updateAttachment,
  updateAttachmentStatus,
  getStudentAttachments,
  deleteAttachment
};

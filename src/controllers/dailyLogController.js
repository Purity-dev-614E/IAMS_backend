const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');

// Get daily logs for attachment
const getDailyLogsByAttachment = asyncHandler(async (req, res) => {
  const { attachmentId } = req.params;
  const { page = 1, limit = 20, status, startDate, endDate } = req.query;
  const offset = (page - 1) * limit;

  let query = db('daily_logs')
    .where('attachment_id', attachmentId)
    .orderBy('log_date', 'desc');

  // Apply filters
  if (status) {
    query = query.where('status', status);
  }

  if (startDate) {
    query = query.where('log_date', '>=', startDate);
  }

  if (endDate) {
    query = query.where('log_date', '<=', endDate);
  }

  // Get total count
  const totalQuery = query.clone().clearSelect().clearOrder().count('* as total');
  const [{ total }] = await totalQuery;

  // Get paginated results
  const logs = await query.limit(limit).offset(offset);

  res.json({
    success: true,
    logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get daily log by ID
const getDailyLogById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const log = await db('daily_logs')
    .join('attachments', 'daily_logs.attachment_id', 'attachments.id')
    .join('students', 'attachments.student_id', 'students.id')
    .join('users', 'students.user_id', 'users.id')
    .select(
      'daily_logs.*',
      'attachments.organization_name',
      'users.name as student_name',
      'students.reg_number'
    )
    .where('daily_logs.id', id)
    .first();

  if (!log) {
    return res.status(404).json({
      success: false,
      message: 'Daily log not found'
    });
  }

  // Check authorization: student can only access own logs
  if (req.user.role === 'student' && log.student_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own logs.'
    });
  }

  res.json({
    success: true,
    log
  });
});

// Create daily log
const createDailyLog = asyncHandler(async (req, res) => {
  const {
    attachment_id,
    log_date,
    tasks_performed,
    skills_acquired,
    observations,
    status = 'draft'
  } = req.body;

  // Get student profile
  const student = await db('students').where('user_id', req.user.id).first();
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  // Verify attachment belongs to student
  const attachment = await db('attachments')
    .where({ id: attachment_id, student_id: student.id })
    .first();

  if (!attachment) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Attachment not found or does not belong to you.'
    });
  }

  // Check if log for this date already exists
  const existingLog = await db('daily_logs')
    .where({ 
      attachment_id, 
      log_date 
    })
    .first();

  if (existingLog) {
    return res.status(409).json({
      success: false,
      message: 'Daily log for this date already exists'
    });
  }

  // Validate log date
  const logDate = new Date(log_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (logDate > today) {
    return res.status(400).json({
      success: false,
      message: 'Log date cannot be in the future'
    });
  }

  // Create daily log
  const [log] = await db('daily_logs').insert({
    attachment_id,
    log_date,
    tasks_performed,
    skills_acquired,
    observations,
    status,
    submitted_at: status === 'submitted' ? new Date() : null
  }).returning('*');

  res.status(201).json({
    success: true,
    message: 'Daily log created successfully',
    log
  });
});

// Update daily log
const updateDailyLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    tasks_performed,
    skills_acquired,
    observations,
    status
  } = req.body;

  // Get existing log
  const existingLog = await db('daily_logs').where({ id }).first();
  if (!existingLog) {
    return res.status(404).json({
      success: false,
      message: 'Daily log not found'
    });
  }

  // Get attachment to verify ownership
  const attachment = await db('attachments')
    .where('id', existingLog.attachment_id)
    .first();

  // Check authorization
  if (req.user.role === 'student') {
    const student = await db('students').where('user_id', req.user.id).first();
    if (!student || attachment.student_id !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only edit your own logs.'
      });
    }

    // Students can only edit draft logs
    if (existingLog.status === 'submitted') {
      return res.status(403).json({
        success: false,
        message: 'Cannot edit submitted log'
      });
    }
  }

  // Update log
  const updateData = {
    tasks_performed: tasks_performed || existingLog.tasks_performed,
    skills_acquired: skills_acquired || existingLog.skills_acquired,
    observations: observations || existingLog.observations,
    updated_at: new Date()
  };

  // Update status and submitted_at if provided
  if (status) {
    updateData.status = status;
    if (status === 'submitted' && existingLog.status !== 'submitted') {
      updateData.submitted_at = new Date();
    }
  }

  const [updatedLog] = await db('daily_logs')
    .where({ id })
    .update(updateData)
    .returning('*');

  res.json({
    success: true,
    message: 'Daily log updated successfully',
    log: updatedLog
  });
});

// Submit daily log
const submitDailyLog = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get existing log
  const existingLog = await db('daily_logs').where({ id }).first();
  if (!existingLog) {
    return res.status(404).json({
      success: false,
      message: 'Daily log not found'
    });
  }

  // Check if already submitted
  if (existingLog.status === 'submitted') {
    return res.status(400).json({
      success: false,
      message: 'Log is already submitted'
    });
  }

  // Get attachment to verify ownership
  const attachment = await db('attachments')
    .where('id', existingLog.attachment_id)
    .first();

  // Check authorization
  if (req.user.role === 'student') {
    const student = await db('students').where('user_id', req.user.id).first();
    if (!student || attachment.student_id !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only submit your own logs.'
      });
    }
  }

  // Submit log
  const [submittedLog] = await db('daily_logs')
    .where({ id })
    .update({
      status: 'submitted',
      submitted_at: new Date(),
      updated_at: new Date()
    })
    .returning('*');

  res.json({
    success: true,
    message: 'Daily log submitted successfully',
    log: submittedLog
  });
});

// Delete daily log
const deleteDailyLog = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get existing log
  const existingLog = await db('daily_logs').where({ id }).first();
  if (!existingLog) {
    return res.status(404).json({
      success: false,
      message: 'Daily log not found'
    });
  }

  // Get attachment to verify ownership
  const attachment = await db('attachments')
    .where('id', existingLog.attachment_id)
    .first();

  // Check authorization
  if (req.user.role === 'student') {
    const student = await db('students').where('user_id', req.user.id).first();
    if (!student || attachment.student_id !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own logs.'
      });
    }

    // Students can only delete draft logs
    if (existingLog.status === 'submitted') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete submitted log'
      });
    }
  }

  // Delete log
  await db('daily_logs').where({ id }).del();

  res.json({
    success: true,
    message: 'Daily log deleted successfully'
  });
});

// Get student's daily logs
const getStudentDailyLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, startDate, endDate } = req.query;
  const offset = (page - 1) * limit;

  // Get student profile
  const student = await db('students').where('user_id', req.user.id).first();
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  let query = db('daily_logs')
    .join('attachments', 'daily_logs.attachment_id', 'attachments.id')
    .where('attachments.student_id', student.id)
    .select(
      'daily_logs.*',
      'attachments.organization_name'
    )
    .orderBy('daily_logs.log_date', 'desc');

  // Apply filters
  if (status) {
    query = query.where('daily_logs.status', status);
  }

  if (startDate) {
    query = query.where('daily_logs.log_date', '>=', startDate);
  }

  if (endDate) {
    query = query.where('daily_logs.log_date', '<=', endDate);
  }

  // Get total count
  const totalQuery = query.clone().clearSelect().clearOrder().count('* as total');
  const [{ total }] = await totalQuery;

  // Get paginated results
  const logs = await query.limit(limit).offset(offset);

  res.json({
    success: true,
    logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get daily logs for weekly review
const getDailyLogsForWeeklyReview = asyncHandler(async (req, res) => {
  const { weeklyReviewId } = req.params;

  // Get weekly review details
  const weeklyReview = await db('weekly_reviews')
    .where('id', weeklyReviewId)
    .first();

  if (!weeklyReview) {
    return res.status(404).json({
      success: false,
      message: 'Weekly review not found'
    });
  }

  // Get daily logs for the week
  const logs = await db('daily_logs')
    .join('attachments', 'daily_logs.attachment_id', 'attachments.id')
    .where('daily_logs.attachment_id', weeklyReview.attachment_id)
    .where('daily_logs.log_date', '>=', weeklyReview.week_start_date)
    .where('daily_logs.log_date', '<=', weeklyReview.week_end_date)
    .orderBy('daily_logs.log_date')
    .select('daily_logs.*');

  res.json({
    success: true,
    logs,
    weeklyReview: {
      id: weeklyReview.id,
      week_number: weeklyReview.week_number,
      week_start_date: weeklyReview.week_start_date,
      week_end_date: weeklyReview.week_end_date,
      status: weeklyReview.status
    }
  });
});

module.exports = {
  getDailyLogsByAttachment,
  getDailyLogById,
  createDailyLog,
  updateDailyLog,
  submitDailyLog,
  deleteDailyLog,
  getStudentDailyLogs,
  getDailyLogsForWeeklyReview
};

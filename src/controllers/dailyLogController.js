const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendWeeklyReviewRequest } = require('../services/emailService');
const { getAttachmentWeekNumber, getWeekStartDate, getWeekEndDate } = require('../utils/dateHelpers');

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
      'students.reg_number',
      'students.id as student_id'
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
  if (req.user.role === 'student') {
    const student = await db('students').where('user_id', req.user.id).first();
    if (!student || log.student_id !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own logs.'
      });
    }
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
  /* Commented out for testing purposes - allow multiple logs per date
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
  */

  // Validate log date
  const logDate = new Date(log_date);
  const today = new Date();
  
  // Normalize both dates to UTC midnight for accurate comparison
  const logDateUTC = new Date(logDate);
  logDateUTC.setUTCHours(0, 0, 0, 0);
  const todayUTC = new Date(today);
  todayUTC.setUTCHours(0, 0, 0, 0);

  if (logDateUTC > todayUTC) {
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

  // If log was submitted, check if week is complete
  if (status === 'submitted') {
    checkAndTriggerWeeklyReview(attachment_id, log_date);
  }

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
    log_date,
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
    log_date: log_date || existingLog.log_date,
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

  // If status changed to submitted, check if week is complete
  if (status === 'submitted' && existingLog.status !== 'submitted') {
    checkAndTriggerWeeklyReview(updatedLog.attachment_id, updatedLog.log_date);
  }

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

  // Check if week is complete and trigger review
  checkAndTriggerWeeklyReview(submittedLog.attachment_id, submittedLog.log_date);

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

/**
 * Helper function to check if a week is complete (5 logs) and trigger review email
 */
async function checkAndTriggerWeeklyReview(attachmentId, logDate) {
  try {
    const attachment = await db('attachments').where('id', attachmentId).first();
    if (!attachment) {
      console.error(`[Weekly Review Error] Attachment ${attachmentId} not found`);
      return;
    }

    const date = new Date(logDate);
    const weekNumber = getAttachmentWeekNumber(date, attachment.start_date);
    
    // Calculate relative week boundaries
    const start = new Date(attachment.start_date);
    start.setHours(0, 0, 0, 0);
    const weekStartDate = new Date(start.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEndDate = new Date(weekStartDate.getTime() + 4 * 24 * 60 * 60 * 1000); // Friday
    weekEndDate.setHours(23, 59, 59, 999);

    // Count submitted logs for this week
    const submittedLogsCount = await db('daily_logs')
      .where('attachment_id', attachmentId)
      .where('status', 'submitted')
      .where('log_date', '>=', weekStartDate)
      .where('log_date', '<=', weekEndDate)
      .count('* as count')
      .first();

    const count = parseInt(submittedLogsCount.count);
    console.log(`[Weekly Review Check] Attachment: ${attachmentId}, Log Date: ${logDate}, Week: ${weekNumber}, Submitted Logs: ${count}`);

    // If we have at least 5 logs, trigger the weekly review
    if (count >= 5) {
      console.log(`[Weekly Review Trigger] 5 or more logs detected for week. Proceeding with review trigger...`);
      // Check if a weekly review already exists for this week
      let weeklyReview = await db('weekly_reviews')
        .where({
          attachment_id: attachmentId,
          week_number: weekNumber
        })
        .first();

      if (!weeklyReview) {
        console.log(`[Weekly Review Trigger] Creating new weekly review record for week ${weekNumber}`);
        // Create new weekly review
        const [newReview] = await db('weekly_reviews').insert({
          attachment_id: attachmentId,
          week_number: weekNumber,
          week_start_date: weekStartDate,
          week_end_date: weekEndDate,
          status: 'pending'
        }).returning('*');
        weeklyReview = newReview;
      } else {
        console.log(`[Weekly Review Trigger] Existing weekly review found for week ${weekNumber} with status: ${weeklyReview.status}`);
      }

      // If it's still in pending status, send the email
      if (weeklyReview.status === 'pending') {
        console.log(`[Weekly Review Trigger] Sending review request email for weekly review ID: ${weeklyReview.id}`);
        await sendWeeklyReviewRequest(weeklyReview.id);
      } else {
        console.log(`[Weekly Review Trigger] Review request email skipped as status is ${weeklyReview.status}`);
      }
    } else {
      console.log(`[Weekly Review Check] Not enough logs (${count}/5) to trigger weekly review for week ${weekNumber}`);
    }
  } catch (error) {
    console.error('[Weekly Review Error] Failed to check/trigger weekly review:', error);
  }
}

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

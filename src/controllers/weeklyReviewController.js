const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendWeeklyReviewRequest } = require('../services/emailService');
const { 
  getAttachmentWeekNumber, 
  getWeekStartDate, 
  getWeekEndDate, 
  groupLogsByWeek 
} = require('../utils/dateHelpers');

// Get weekly reviews for attachment
const getWeeklyReviewsByAttachment = asyncHandler(async (req, res) => {
  const { attachmentId } = req.params;
  const { page = 1, limit = 20, status } = req.query;
  const offset = (page - 1) * limit;

  // Check authorization for students
  if (req.user.role === 'student') {
    const attachment = await db('attachments').where('id', attachmentId).first();
    const student = await db('students').where('user_id', req.user.id).first();
    
    if (!attachment || !student || attachment.student_id !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view reviews for your own attachment.'
      });
    }
  }

  let query = db('weekly_reviews')
    .where('attachment_id', attachmentId)
    .orderBy('week_number', 'desc');

  if (status) {
    query = query.where('status', status);
  }

  // Get total count
  const totalQuery = query.clone().clearSelect().clearOrder().count('* as total');
  const [{ total }] = await totalQuery;

  // Get paginated results
  const reviews = await query.limit(limit).offset(offset);

  res.json({
    success: true,
    reviews,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get weekly review by ID
const getWeeklyReviewById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await db('weekly_reviews')
    .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
    .join('students', 'attachments.student_id', 'students.id')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('industry_feedback', 'weekly_reviews.id', 'industry_feedback.weekly_review_id')
    .leftJoin('uni_feedback', 'weekly_reviews.id', 'uni_feedback.weekly_review_id')
    .leftJoin('users as supervisors', 'uni_feedback.uni_supervisor_id', 'supervisors.id')
    .select(
      'weekly_reviews.*',
      'attachments.organization_name',
      'users.name as student_name',
      'users.email as student_email',
      'students.reg_number',
      'students.program',
      'students.id as student_id',
      'industry_feedback.approval as industry_approval',
      'industry_feedback.comments as industry_comments',
      'industry_feedback.improvements as industry_improvements',
      'industry_feedback.submitted_at as industry_feedback_date',
      'uni_feedback.rating as uni_rating',
      'uni_feedback.comments as uni_comments',
      'uni_feedback.improvements as uni_improvements',
      'supervisors.name as uni_supervisor_name'
    )
    .where('weekly_reviews.id', id)
    .first();

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Weekly review not found'
    });
  }

  // Check authorization for students
  if (req.user.role === 'student') {
    const student = await db('students').where('user_id', req.user.id).first();
    if (!student || review.student_id !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own weekly reviews.'
      });
    }
  }

  res.json({
    success: true,
    review
  });
});

// Create weekly review
const createWeeklyReview = asyncHandler(async (req, res) => {
  const {
    attachment_id,
    week_number,
    week_start_date,
    week_end_date
  } = req.body;

  // Verify attachment exists and belongs to student if applicable
  const attachment = await db('attachments').where('id', attachment_id).first();
  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: 'Attachment not found'
    });
  }

  // Check authorization for students
  if (req.user.role === 'student') {
    const student = await db('students').where('user_id', req.user.id).first();
    if (!student || attachment.student_id !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only create reviews for your own attachment.'
      });
    }
  }

  // Check if weekly review already exists for this week
  const existingReview = await db('weekly_reviews')
    .where({ 
      attachment_id, 
      week_number 
    })
    .first();

  if (existingReview) {
    return res.status(409).json({
      success: false,
      message: 'Weekly review for this week already exists'
    });
  }

  // Validate dates
  const startDate = new Date(week_start_date);
  const endDate = new Date(week_end_date);

  if (startDate >= endDate) {
    return res.status(400).json({
      success: false,
      message: 'End date must be after start date'
    });
  }

  // Create weekly review
  const [review] = await db('weekly_reviews').insert({
    attachment_id,
    week_number,
    week_start_date,
    week_end_date,
    status: 'pending'
  }).returning('*');

  // Send industry supervisor email
  try {
    await sendWeeklyReviewRequest(review.id);
  } catch (error) {
    console.error(`Failed to send review request for week ${week_number}:`, error);
  }

  res.status(201).json({
    success: true,
    message: 'Weekly review created successfully',
    review
  });
});

// Automated weekly review creation
const createWeeklyReviewsAutomated = asyncHandler(async (req, res) => {
  const { attachmentId } = req.body;

  // Get attachment details
  const attachment = await db('attachments')
    .where('id', attachmentId)
    .where('status', 'active')
    .first();

  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: 'Active attachment not found'
    });
  }

  // Check authorization for students
  if (req.user.role === 'student') {
    const student = await db('students').where('user_id', req.user.id).first();
    if (!student || attachment.student_id !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only trigger reviews for your own attachment.'
      });
    }
  }

  // Get all daily logs for this attachment
  const dailyLogs = await db('daily_logs')
    .where('attachment_id', attachmentId)
    .where('status', 'submitted')
    .orderBy('log_date')
    .select('*');

  if (dailyLogs.length === 0) {
    return res.json({
      success: true,
      message: 'No submitted daily logs found for weekly review creation',
      reviews: []
    });
  }

  // Group logs by week
  const weeklyGroups = groupLogsByWeek(dailyLogs, attachment.start_date);

  // Create weekly reviews for each week
  const createdReviews = [];
  for (const [weekNumber, weekData] of Object.entries(weeklyGroups)) {
    // Check if weekly review already exists
    const existingReview = await db('weekly_reviews')
      .where({ 
        attachment_id, 
        week_number: parseInt(weekNumber) 
      })
      .first();

    if (!existingReview) {
      const [review] = await db('weekly_reviews').insert({
        attachment_id,
        week_number: parseInt(weekNumber),
        week_start_date: weekData.startDate,
        week_end_date: weekData.endDate,
        status: 'pending'
      }).returning('*');

      createdReviews.push(review);

      // Send industry supervisor email
      try {
        await sendWeeklyReviewRequest(review.id);
      } catch (error) {
        console.error(`Failed to send review request for week ${weekNumber}:`, error);
      }
    }
  }

  res.json({
    success: true,
    message: `Created ${createdReviews.length} weekly reviews`,
    reviews: createdReviews
  });
});

// Update weekly review status
const updateWeeklyReviewStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'industry_reviewed', 'uni_reviewed', 'complete'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status'
    });
  }

  // Check if review exists
  const review = await db('weekly_reviews').where({ id }).first();
  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Weekly review not found'
    });
  }

  // Update status
  const [updatedReview] = await db('weekly_reviews')
    .where({ id })
    .update({ 
      status,
      updated_at: new Date()
    })
    .returning('*');

  res.json({
    success: true,
    message: 'Weekly review status updated successfully',
    review: updatedReview
  });
});

// Get student's weekly reviews
const getStudentWeeklyReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const offset = (page - 1) * limit;

  // Get student profile
  const student = await db('students').where('user_id', req.user.id).first();
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  let query = db('weekly_reviews')
    .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
    .where('attachments.student_id', student.id)
    .orderBy('week_number', 'desc');

  if (status) {
    query = query.where('weekly_reviews.status', status);
  }

  // Get total count
  const totalQuery = query.clone().clearSelect().clearOrder().count('* as total');
  const [{ total }] = await totalQuery;

  // Get paginated results
  const reviews = await query.limit(limit).offset(offset);

  res.json({
    success: true,
    reviews,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      pages: Math.ceil(total / limit)
    }
  });
});

module.exports = {
  getWeeklyReviewsByAttachment,
  getWeeklyReviewById,
  createWeeklyReview,
  createWeeklyReviewsAutomated,
  updateWeeklyReviewStatus,
  getStudentWeeklyReviews
};

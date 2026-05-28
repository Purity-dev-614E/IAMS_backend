const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { evaluateAttachmentEligibility, getColleges } = require('../services/attachmentEligibilityService');
const {
  sendEligibilityReviewNotification,
  sendEligibilityReviewDecisionNotification
} = require('../services/emailService');

const getCurrentStudent = async (userId) => {
  return db('students')
    .join('users', 'students.user_id', 'users.id')
    .where('students.user_id', userId)
    .select(
      'students.*',
      'users.name as student_name',
      'users.email as student_email'
    )
    .first();
};

const getMyEligibility = asyncHandler(async (req, res) => {
  const student = await getCurrentStudent(req.user.id);

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  const eligibility = await evaluateAttachmentEligibility(db, student);

  res.json({
    success: true,
    eligibility
  });
});

const getAttachmentColleges = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    colleges: getColleges()
  });
});

const requestEligibilityReview = asyncHandler(async (req, res) => {
  const { reason_type = 'other', explanation } = req.body;

  if (!explanation || explanation.trim().length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an explanation of at least 10 characters.'
    });
  }

  const allowedReasons = ['deferred', 'repeating', 'transfer', 'readmission', 'special_approval', 'other'];
  if (!allowedReasons.includes(reason_type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid review reason type.'
    });
  }

  const student = await getCurrentStudent(req.user.id);

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  const existingPendingReview = await db('attachment_eligibility_reviews')
    .where({
      student_id: student.id,
      status: 'pending'
    })
    .first();

  if (existingPendingReview) {
    return res.status(409).json({
      success: false,
      message: 'You already have a pending eligibility review request.',
      review: existingPendingReview
    });
  }

  const [review] = await db('attachment_eligibility_reviews').insert({
    student_id: student.id,
    reason_type,
    explanation: explanation.trim()
  }).returning('*');

  try {
    await sendEligibilityReviewNotification({ review, student });
  } catch (error) {
    console.error('Eligibility review email notification failed:', error.message);
  }

  res.status(201).json({
    success: true,
    message: 'Eligibility review request submitted successfully.',
    review
  });
});

const getEligibilityReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status = 'pending', search } = req.query;
  const offset = (page - 1) * limit;

  let query = db('attachment_eligibility_reviews')
    .join('students', 'attachment_eligibility_reviews.student_id', 'students.id')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('users as reviewers', 'attachment_eligibility_reviews.reviewed_by', 'reviewers.id')
    .select(
      'attachment_eligibility_reviews.*',
      'users.name as student_name',
      'users.email as student_email',
      'students.reg_number',
      'students.program',
      'students.school',
      'students.year_of_study',
      'students.admission_year',
      'students.academic_status',
      'reviewers.name as reviewer_name',
      'reviewers.email as reviewer_email'
    )
    .orderBy('attachment_eligibility_reviews.created_at', 'desc');

  if (status) {
    query = query.where('attachment_eligibility_reviews.status', status);
  }

  if (search) {
    query = query.where(function() {
      this.where('users.name', 'ilike', `%${search}%`)
        .orWhere('users.email', 'ilike', `%${search}%`)
        .orWhere('students.reg_number', 'ilike', `%${search}%`);
    });
  }

  const totalQuery = query.clone().clearSelect().clearOrder().count('* as total');
  const [{ total }] = await totalQuery;
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

const updateEligibilityReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, admin_comment, expires_at } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status must be approved or rejected.'
    });
  }

  const review = await db('attachment_eligibility_reviews').where({ id }).first();
  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Eligibility review request not found.'
    });
  }

  if (review.status !== 'pending') {
    return res.status(409).json({
      success: false,
      message: 'Only pending eligibility reviews can be updated.'
    });
  }

  const [updatedReview] = await db('attachment_eligibility_reviews')
    .where({ id })
    .update({
      status,
      admin_comment: admin_comment || null,
      expires_at: status === 'approved' ? (expires_at || null) : null,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      updated_at: new Date()
    })
    .returning('*');

  const student = await db('students')
    .join('users', 'students.user_id', 'users.id')
    .where('students.id', review.student_id)
    .select(
      'students.*',
      'users.name as student_name',
      'users.email as student_email'
    )
    .first();

  try {
    await sendEligibilityReviewDecisionNotification({ review: updatedReview, student });
  } catch (error) {
    console.error('Eligibility review decision email failed:', error.message);
  }

  res.json({
    success: true,
    message: `Eligibility review ${status} successfully.`,
    review: updatedReview
  });
});

module.exports = {
  getAttachmentColleges,
  getMyEligibility,
  requestEligibilityReview,
  getEligibilityReviews,
  updateEligibilityReview
};

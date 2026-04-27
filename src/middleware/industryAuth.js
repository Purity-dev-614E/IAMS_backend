const crypto = require('crypto');
const db = require('../database/connection');

const industryAuth = async (req, res, next) => {
  try {
    const token = req.header('X-Industry-Token') || req.query.token;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. Industry supervisor token required.' 
      });
    }

    // Find the industry feedback record with this token
    const feedback = await db('industry_feedback')
      .join('weekly_reviews', 'industry_feedback.weekly_review_id', 'weekly_reviews.id')
      .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
      .join('students', 'attachments.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .where('industry_feedback.verification_token', token)
      .select(
        'industry_feedback.*',
        'weekly_reviews.week_number',
        'weekly_reviews.week_start_date',
        'weekly_reviews.week_end_date',
        'attachments.organization_name',
        'attachments.industry_supervisor_name',
        'attachments.industry_supervisor_email',
        'users.name as student_name',
        'students.reg_number'
      )
      .first();

    if (!feedback) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token.' 
      });
    }

    // Check if token is still valid (not already submitted)
    if (feedback.submitted_at) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token has already been used.' 
      });
    }

    // Add industry supervisor context to request
    req.industrySupervisor = {
      name: feedback.industry_supervisor_name,
      email: feedback.industry_supervisor_email,
      organization: feedback.organization_name,
      weeklyReviewId: feedback.weekly_review_id,
      weekNumber: feedback.week_number,
      student: {
        name: feedback.student_name,
        regNumber: feedback.reg_number
      }
    };

    req.feedback = feedback;

    next();
  } catch (error) {
    console.error('Industry auth error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error in industry authentication.' 
    });
  }
};

// Generate secure verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Validate token format
const validateToken = (token) => {
  return /^[a-f0-9]{64}$/.test(token); // 64 character hex string
};

module.exports = { 
  industryAuth, 
  generateVerificationToken, 
  validateToken 
};

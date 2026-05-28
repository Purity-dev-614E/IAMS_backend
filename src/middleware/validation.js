const Joi = require('joi');
const { body, param, query, validationResult } = require('express-validator');

// Get email domains from environment
const getStudentEmailDomain = () => process.env.STUDENT_EMAIL_DOMAIN || 'student.university.edu';
const getSupervisorEmailDomain = () => process.env.SUPERVISOR_EMAIL_DOMAIN || 'university.edu';
const requireEmailVerification = () => process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

// Generic validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Common validation schemas
const schemas = {
  // User registration
  registerUser: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('student', 'uni_supervisor', 'admin').default('student'),
    // Supervisor-specific field
    staff_id: Joi.when('role', {
      is: 'uni_supervisor',
      then: Joi.string().required(),
      otherwise: Joi.string().optional()
    }),
    // Student-specific fields
    reg_number: Joi.when('role', {
      is: 'student',
      then: Joi.string().required(),
      otherwise: Joi.string().optional()
    }),
    program: Joi.when('role', {
      is: 'student',
      then: Joi.string().required(),
      otherwise: Joi.string().optional()
    }),
    year_of_study: Joi.when('role', {
      is: 'student',
      then: Joi.number().integer().min(1).max(6).required(),
      otherwise: Joi.number().optional()
    }),
    school: Joi.string().optional(),
    admission_year: Joi.number().integer().min(1990).max(2100).optional(),
    academic_status: Joi.string().valid('active', 'deferred', 'suspended', 'completed', 'graduated', 'inactive').optional()
  }),

  // User login
  loginUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Google login
  googleLogin: Joi.object({
    idToken: Joi.string().required()
  }),

  // Student profile
  studentProfile: Joi.object({
    reg_number: Joi.string().required(),
    program: Joi.string().required(),
    year_of_study: Joi.number().integer().min(1).max(6).required(),
    school: Joi.string().optional(),
    admission_year: Joi.number().integer().min(1990).max(2100).optional(),
    academic_status: Joi.string().valid('active', 'deferred', 'suspended', 'completed', 'graduated', 'inactive').optional(),
    uni_supervisor_id: Joi.string().uuid().optional()
  }),

  // Attachment
  attachment: Joi.object({
    organization_name: Joi.string().min(2).max(200).required(),
    industry_supervisor_name: Joi.string().min(2).max(100).required(),
    industry_supervisor_email: Joi.string().email().required(),
    start_date: Joi.date().iso().required(),
    end_date: Joi.date().iso().greater(Joi.ref('start_date')).required()
  }),

  // Daily log
  dailyLog: Joi.object({
    attachment_id: Joi.string().uuid().required(),
    log_date: Joi.date().iso().required(),
    tasks_performed: Joi.string().min(1).required(), // Reduced from 10 for testing
    skills_acquired: Joi.string().min(1).required(), // Reduced from 10 for testing
    observations: Joi.string().min(1).required() // Reduced from 10 for testing
  }),

  // Weekly review
  weeklyReview: Joi.object({
    attachment_id: Joi.string().uuid().required(),
    week_number: Joi.number().integer().min(1).required(),
    week_start_date: Joi.date().iso().required(),
    week_end_date: Joi.date().iso().greater(Joi.ref('week_start_date')).required()
  }),

  // Industry feedback
  industryFeedback: Joi.object({
    verification_token: Joi.string().required(),
    comments: Joi.string().optional(),
    improvements: Joi.string().optional(),
    approval: Joi.string().valid('approved', 'rejected').required()
  }),

  // University feedback
  uniFeedback: Joi.object({
    weekly_review_id: Joi.string().uuid().required(),
    comments: Joi.string().optional(),
    improvements: Joi.string().optional(),
    rating: Joi.number().integer().min(0).max(100).required()
  }),

  // Refresh token
  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  }),

  // End of attachment report (text)
  endOfAttachmentTextReport: Joi.object({
    attachment_id: Joi.string().uuid().required(),
    text_content: Joi.string().min(100).required()
  }),

  // End of attachment report (PDF)
  endOfAttachmentPDFReport: Joi.object({
    attachment_id: Joi.string().uuid().required()
  }),

  // Review report
  reviewReport: Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
    feedback_comments: Joi.string().optional()
  }),

  // End of attachment report (text)
  endOfAttachmentTextReport: Joi.object({
    attachment_id: Joi.string().uuid().required(),
    text_content: Joi.string().min(100).required()
  }),

  // End of attachment report (PDF)
  endOfAttachmentPDFReport: Joi.object({
    attachment_id: Joi.string().uuid().required()
  }),

  // Review report
  reviewReport: Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
    feedback_comments: Joi.string().optional()
  })
};

// Express-validator chains
const validators = {
  registerUser: [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    // Email domain validation temporarily commented out
    // body('email').custom((value, { req }) => {
    //   const { role } = req.body;
    //   const domain = role === 'student' ? getStudentEmailDomain() : getSupervisorEmailDomain();
    //   
    //   if (!value.endsWith(domain)) {
    //     throw new Error(`Email must end with @${domain}`);
    //   }
    //   
    //   return value;
    // }).normalizeEmail().withMessage('Valid email required'),
    
    // Basic email validation only
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['student', 'uni_supervisor', 'admin']).withMessage('Invalid role'),
    // Supervisor-specific validation
    body('staff_id').if(body('role').equals('uni_supervisor')).trim().notEmpty().withMessage('Staff ID required for university supervisors'),
    // Student-specific validations
    body('reg_number').if(body('role').equals('student')).trim().notEmpty().withMessage('Registration number required for students'),
    body('program').if(body('role').equals('student')).trim().notEmpty().withMessage('Program required for students'),
    body('year_of_study').if(body('role').equals('student')).isInt({ min: 1, max: 6 }).withMessage('Year must be 1-6 for students'),
    body('school').optional().trim(),
    body('admission_year').optional().isInt({ min: 1990, max: 2100 }).withMessage('Admission year must be valid'),
    body('academic_status').optional().isIn(['active', 'deferred', 'suspended', 'completed', 'graduated', 'inactive']).withMessage('Invalid academic status'),
    validate
  ],

  loginUser: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    validate
  ],

  googleLogin: [
    body('idToken').isString().notEmpty().withMessage('Google ID token required'),
    validate
  ],

  studentProfile: [
    body('reg_number').trim().notEmpty().withMessage('Registration number required'),
    body('program').trim().notEmpty().withMessage('Program required'),
    body('year_of_study').isInt({ min: 1, max: 6 }).withMessage('Year must be 1-6'),
    body('school').optional().trim(),
    body('admission_year').optional().isInt({ min: 1990, max: 2100 }).withMessage('Admission year must be valid'),
    body('academic_status').optional().isIn(['active', 'deferred', 'suspended', 'completed', 'graduated', 'inactive']).withMessage('Invalid academic status'),
    body('uni_supervisor_id').optional().isUUID().withMessage('Supervisor ID must be a valid UUID'),
    validate
  ],

  attachment: [
    body('organization_name').trim().isLength({ min: 2, max: 200 }).withMessage('Organization name required'),
    body('industry_supervisor_name').trim().isLength({ min: 2, max: 100 }).withMessage('Supervisor name required'),
    body('industry_supervisor_email').isEmail().normalizeEmail().withMessage('Valid supervisor email required'),
    body('start_date').isISO8601().withMessage('Valid start date required'),
    body('end_date').isISO8601().withMessage('Valid end date required'),
    validate
  ],

  dailyLog: [
    body('attachment_id').isUUID().withMessage('Valid attachment UUID required'),
    body('log_date').isISO8601().withMessage('Valid log date required'),
    body('tasks_performed').trim().isLength({ min: 1 }).withMessage('Tasks required'), // Reduced from 10 for testing
    body('skills_acquired').trim().isLength({ min: 1 }).withMessage('Skills required'), // Reduced from 10 for testing
    body('observations').trim().isLength({ min: 1 }).withMessage('Observations required'), // Reduced from 10 for testing
    validate
  ],

  weeklyReview: [
    body('attachment_id').isUUID().withMessage('Valid attachment UUID required'),
    body('week_number').isInt({ min: 1 }).withMessage('Week number must be a positive integer'),
    body('week_start_date').isISO8601().withMessage('Valid start date required'),
    body('week_end_date').isISO8601().withMessage('Valid end date required'),
    validate
  ],

  refreshToken: [
    body('refreshToken').notEmpty().withMessage('Refresh token required'),
    validate
  ],

  idParam: [
    param('id').isUUID().withMessage('Valid UUID required'),
    validate
  ],

  endOfAttachmentTextReport: [
    body('attachment_id').isUUID().withMessage('Valid attachment UUID required'),
    body('text_content').trim().isLength({ min: 100 }).withMessage('Report content must be at least 100 characters'),
    validate
  ],

  endOfAttachmentPDFReport: [
    body('attachment_id').isUUID().withMessage('Valid attachment UUID required'),
    validate
  ],

  reviewReport: [
    param('id').isUUID().withMessage('Valid report UUID required'),
    body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
    body('feedback_comments').optional().trim(),
    validate
  ],

  endOfAttachmentTextReport: [
    body('attachment_id').isUUID().withMessage('Valid attachment UUID required'),
    body('text_content').trim().isLength({ min: 100 }).withMessage('Report content must be at least 100 characters'),
    validate
  ],

  endOfAttachmentPDFReport: [
    body('attachment_id').isUUID().withMessage('Valid attachment UUID required'),
    validate
  ],

  reviewReport: [
    param('id').isUUID().withMessage('Valid report UUID required'),
    body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
    body('feedback_comments').optional().trim(),
    validate
  ]
};

module.exports = { schemas, validators, validate };

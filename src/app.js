require('dotenv').config();
const express = require('express');
const db = require('./database/connection');

// Import middleware
const { logger, securityLogger } = require('./middleware/logger');
const { cors, helmet, customSecurityHeaders, requestSizeLimiter } = require('./middleware/security');
const { generalLimiter, authLimiter, strictLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const auth = require('./middleware/auth');
const { authorize } = require('./middleware/rbac');
const { industryAuth } = require('./middleware/industryAuth');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/students');
const attachmentRoutes = require('./routes/attachments');
const dailyLogRoutes = require('./routes/dailyLogs');
const weeklyReviewRoutes = require('./routes/weeklyReviews');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');

const app = express();

// Security middleware (first)
app.use(helmet);
app.use(customSecurityHeaders);
app.use(cors);
app.use(requestSizeLimiter);

// Rate limiting
app.use(generalLimiter);

// Logging middleware
app.use(securityLogger);
app.use(logger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Test database connection endpoint (no auth required for testing)
app.get('/test-db', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ 
      success: true, 
      message: 'Database connection successful!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: error.message 
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/daily-logs', dailyLogRoutes);
app.use('/api/weekly-reviews', weeklyReviewRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);

// API routes with authentication and authorization
app.get('/api/profile', auth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Admin only endpoint
app.get('/api/admin/dashboard', auth, authorize.admin(), (req, res) => {
  res.json({
    success: true,
    message: 'Admin dashboard access granted',
    user: req.user
  });
});

// University supervisor endpoint
app.get('/api/supervisor/students', auth, authorize.uniSupervisor(), async (req, res) => {
  try {
    const students = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .where('students.uni_supervisor_id', req.user.id)
      .select(
        'students.id',
        'students.reg_number',
        'students.program',
        'students.year_of_study',
        'users.name',
        'users.email'
      );
    
    res.json({
      success: true,
      students
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: error.message
    });
  }
});

// Student endpoint - own data only
app.get('/api/student/logs', auth, authorize.student(), async (req, res) => {
  try {
    const student = await db('students').where('user_id', req.user.id).first();
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }
    
    const logs = await db('daily_logs')
      .join('attachments', 'daily_logs.attachment_id', 'attachments.id')
      .where('attachments.student_id', student.id)
      .select(
        'daily_logs.*',
        'attachments.organization_name'
      )
      .orderBy('daily_logs.log_date', 'desc');
    
    res.json({
      success: true,
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching logs',
      error: error.message
    });
  }
});

// Industry supervisor endpoints (token-based)
app.get('/api/industry/review/:token', industryAuth, (req, res) => {
  res.json({
    success: true,
    review: {
      weeklyReviewId: req.industrySupervisor.weeklyReviewId,
      weekNumber: req.industrySupervisor.weekNumber,
      weekStart: req.feedback.week_start_date,
      weekEnd: req.feedback.week_end_date,
      student: req.industrySupervisor.student,
      organization: req.industrySupervisor.organization,
      supervisor: {
        name: req.industrySupervisor.name,
        email: req.industrySupervisor.email
      }
    }
  });
});

// Get daily logs for industry review
app.get('/api/industry/review/:token/logs', industryAuth, async (req, res) => {
  try {
    const logs = await db('daily_logs')
      .join('attachments', 'daily_logs.attachment_id', 'attachments.id')
      .where('attachments.id', req.feedback.attachment_id)
      .where('daily_logs.log_date', '>=', req.feedback.week_start_date)
      .where('daily_logs.log_date', '<=', req.feedback.week_end_date)
      .orderBy('daily_logs.log_date')
      .select(
        'daily_logs.id',
        'daily_logs.log_date',
        'daily_logs.tasks_performed',
        'daily_logs.skills_acquired',
        'daily_logs.observations',
        'daily_logs.status'
      );

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching logs',
      error: error.message
    });
  }
});

// Submit industry feedback
app.post('/api/industry/review/:token/feedback', 
  industryAuth, 
  strictLimiter, 
  async (req, res) => {
    try {
      const { approval, comments, improvements } = req.body;

      if (!approval || !['approved', 'rejected'].includes(approval)) {
        return res.status(400).json({
          success: false,
          message: 'Valid approval status (approved/rejected) is required'
        });
      }

      // Update industry feedback
      await db('industry_feedback')
        .where('id', req.feedback.id)
        .update({
          approval,
          comments: comments || null,
          improvements: improvements || null,
          submitted_at: new Date()
        });

      // Update weekly review status
      await db('weekly_reviews')
        .where('id', req.feedback.weekly_review_id)
        .update({ status: 'industry_reviewed' });

      // Send confirmation email
      const { sendFeedbackConfirmation } = require('./services/emailService');
      await sendFeedbackConfirmation(req.feedback.id);

      res.json({
        success: true,
        message: 'Feedback submitted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error submitting feedback',
        error: error.message
      });
    }
  }
);

// Admin endpoint to trigger weekly review requests
app.post('/api/admin/send-weekly-reviews', 
  auth, 
  authorize.admin(), 
  strictLimiter,
  async (req, res) => {
    try {
      const { sendWeeklyReviewRequest } = require('./services/emailService');
      const schedulerService = require('./services/schedulerService');
      
      await schedulerService.processWeeklyReviews();
      
      res.json({
        success: true,
        message: 'Weekly review requests processed'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error processing weekly reviews',
        error: error.message
      });
    }
  }
);

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

module.exports = app;

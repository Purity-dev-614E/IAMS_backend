const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');

// Student Dashboard
const getStudentDashboard = asyncHandler(async (req, res) => {
  // Get student profile
  const student = await db('students')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('users as supervisors', 'students.uni_supervisor_id', 'supervisors.id')
    .leftJoin('attachments', 'students.id', 'attachments.student_id')
    .select(
      'students.id',
      'students.reg_number',
      'students.program',
      'students.year_of_study',
      'users.name as student_name',
      'users.email as student_email',
      'supervisors.name as supervisor_name',
      'supervisors.email as supervisor_email',
      db.raw('COUNT(attachments.id) as attachment_count')
    )
    .where('students.user_id', req.user.id)
    .groupBy('students.id', 'users.id', 'supervisors.id')
    .first();

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  // Get active attachment
  const activeAttachment = await db('attachments')
    .where('student_id', student.id)
    .where('status', 'active')
    .first();

  // Get daily logs statistics
  const dailyLogsStats = await db('daily_logs')
    .join('attachments', 'daily_logs.attachment_id', 'attachments.id')
    .where('attachments.student_id', student.id)
    .select(
      db.raw('COUNT(*) as total_logs'),
      db.raw('COUNT(CASE WHEN daily_logs.status = \'draft\' THEN 1 END) as draft_logs'),
      db.raw('COUNT(CASE WHEN daily_logs.status = \'submitted\' THEN 1 END) as submitted_logs'),
      db.raw('MAX(log_date) as last_log_date')
    )
    .first();

  // Get weekly reviews with feedback
  const weeklyReviews = await db('weekly_reviews')
    .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
    .leftJoin('industry_feedback', 'weekly_reviews.id', 'industry_feedback.weekly_review_id')
    .leftJoin('uni_feedback', 'weekly_reviews.id', 'uni_feedback.weekly_review_id')
    .leftJoin('users as supervisors', 'uni_feedback.uni_supervisor_id', 'supervisors.id')
    .where('attachments.student_id', student.id)
    .select(
      'weekly_reviews.id',
      'weekly_reviews.week_number',
      'weekly_reviews.week_start_date',
      'weekly_reviews.week_end_date',
      'weekly_reviews.status',
      'industry_feedback.approval as industry_approval',
      'industry_feedback.comments as industry_comments',
      'industry_feedback.submitted_at as industry_feedback_date',
      'uni_feedback.rating as uni_rating',
      'uni_feedback.comments as uni_comments',
      'supervisors.name as uni_supervisor_name'
    )
    .orderBy('weekly_reviews.week_number', 'desc')
    .limit(10);

  res.json({
    success: true,
    dashboard: {
      student,
      activeAttachment,
      statistics: {
        dailyLogs: dailyLogsStats,
        weeklyReviews: {
          total: weeklyReviews.length,
          pending: weeklyReviews.filter(r => r.status === 'pending').length,
          industry_reviewed: weeklyReviews.filter(r => r.status === 'industry_reviewed').length,
          uni_reviewed: weeklyReviews.filter(r => r.status === 'uni_reviewed').length,
          complete: weeklyReviews.filter(r => r.status === 'complete').length
        }
      },
      weeklyReviews
    }
  });
});

// University Supervisor Dashboard
const getSupervisorDashboard = asyncHandler(async (req, res) => {
  const supervisorId = req.user.id;

  // Get supervisor's students
  const students = await db('students')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('attachments', 'students.id', 'attachments.student_id')
    .select(
      'students.id',
      'students.reg_number',
      'students.program',
      'students.year_of_study',
      'users.name as student_name',
      'users.email as student_email',
      'attachments.status as attachment_status',
      db.raw('COUNT(attachments.id) as attachment_count')
    )
    .where('students.uni_supervisor_id', supervisorId)
    .groupBy('students.id', 'users.id', 'attachments.id')
    .orderBy('students.created_at', 'desc');

  // Get weekly review statistics
  const weeklyReviewStats = await db('weekly_reviews')
    .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
    .join('students', 'attachments.student_id', 'students.id')
    .where('students.uni_supervisor_id', supervisorId)
    .select(
      db.raw('COUNT(*) as total_reviews'),
      db.raw('COUNT(CASE WHEN weekly_reviews.status = \'pending\' THEN 1 END) as pending_reviews'),
      db.raw('COUNT(CASE WHEN weekly_reviews.status = \'industry_reviewed\' THEN 1 END) as industry_reviewed'),
      db.raw('COUNT(CASE WHEN weekly_reviews.status = \'uni_reviewed\' THEN 1 END) as uni_reviewed'),
      db.raw('COUNT(CASE WHEN weekly_reviews.status = \'complete\' THEN 1 END) as complete_reviews')
    )
    .first();

  // Get pending industry feedback
  const pendingIndustryFeedback = await db('weekly_reviews')
    .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
    .join('students', 'attachments.student_id', 'students.id')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('industry_feedback', 'weekly_reviews.id', 'industry_feedback.weekly_review_id')
    .where('students.uni_supervisor_id', supervisorId)
    .where('weekly_reviews.status', 'industry_reviewed')
    .whereNull('industry_feedback.submitted_at')
    .select(
      'weekly_reviews.id',
      'weekly_reviews.week_number',
      'users.name as student_name',
      'students.reg_number',
      'attachments.organization_name',
      'weekly_reviews.week_start_date',
      'weekly_reviews.week_end_date'
    )
    .orderBy('weekly_reviews.week_end_date', 'asc')
    .limit(20);

  // Get students with overdue logs
  const overdueLogs = await db('students')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('attachments', 'students.id', 'attachments.student_id')
    .leftJoin('daily_logs', 'attachments.id', 'daily_logs.attachment_id')
    .where('students.uni_supervisor_id', supervisorId)
    .where('attachments.status', 'active')
    .where('daily_logs.log_date', '<', db.raw('CURRENT_DATE - INTERVAL \'7 days\''))
    .whereNull('daily_logs.id')
    .select(
      'users.name as student_name',
      'students.reg_number',
      'attachments.organization_name',
      db.raw('MAX(daily_logs.log_date) as last_log_date')
    )
    .groupBy('students.id', 'users.id', 'attachments.id')
    .havingRaw('COUNT(daily_logs.id) < 5') // Less than 5 logs this week
    .orderBy('last_log_date', 'asc')
    .limit(10);

  res.json({
    success: true,
    dashboard: {
      supervisor: {
        totalStudents: students.length,
        activeAttachments: students.filter(s => s.attachment_status === 'active').length,
        pendingAttachments: students.filter(s => s.attachment_status === 'pending').length
      },
      statistics: weeklyReviewStats,
      pendingIndustryFeedback,
      studentsWithOverdueLogs: overdueLogs
    }
  });
});

// Admin Dashboard
const getAdminDashboard = asyncHandler(async (req, res) => {
  // Get overall system statistics via separate, smaller aggregate queries
  const [userStats, attachmentStats, dailyLogStats, weeklyReviewStats] = await Promise.all([
    db('users').select(
      db.raw('COUNT(*) as total_users'),
      db.raw('COUNT(CASE WHEN users.role = \'student\' THEN 1 END) as total_students'),
      db.raw('COUNT(CASE WHEN users.role = \'uni_supervisor\' THEN 1 END) as total_supervisors'),
      db.raw('COUNT(CASE WHEN users.role = \'admin\' THEN 1 END) as total_admins')
    ).first(),
    db('attachments').select(
      db.raw('COUNT(*) as total_attachments'),
      db.raw('COUNT(CASE WHEN attachments.status = \'active\' THEN 1 END) as active_attachments'),
      db.raw('COUNT(CASE WHEN attachments.status = \'pending\' THEN 1 END) as pending_attachments'),
      db.raw('COUNT(CASE WHEN attachments.status = \'completed\' THEN 1 END) as completed_attachments')
    ).first(),
    db('daily_logs').select(
      db.raw('COUNT(*) as total_daily_logs'),
      db.raw('COUNT(CASE WHEN daily_logs.status = \'draft\' THEN 1 END) as draft_daily_logs'),
      db.raw('COUNT(CASE WHEN daily_logs.status = \'submitted\' THEN 1 END) as submitted_daily_logs')
    ).first(),
    db('weekly_reviews').select(
      db.raw('COUNT(*) as total_weekly_reviews'),
      db.raw('COUNT(CASE WHEN weekly_reviews.status = \'pending\' THEN 1 END) as pending_weekly_reviews'),
      db.raw('COUNT(CASE WHEN weekly_reviews.status = \'industry_reviewed\' THEN 1 END) as industry_reviewed_weekly_reviews'),
      db.raw('COUNT(CASE WHEN weekly_reviews.status = \'uni_reviewed\' THEN 1 END) as uni_reviewed_weekly_reviews'),
      db.raw('COUNT(CASE WHEN weekly_reviews.status = \'complete\' THEN 1 END) as complete_weekly_reviews')
    ).first()
  ]);

  const systemStats = {
    total_users: Number(userStats.total_users || 0),
    total_students: Number(userStats.total_students || 0),
    total_supervisors: Number(userStats.total_supervisors || 0),
    total_admins: Number(userStats.total_admins || 0),
    total_attachments: Number(attachmentStats.total_attachments || 0),
    active_attachments: Number(attachmentStats.active_attachments || 0),
    pending_attachments: Number(attachmentStats.pending_attachments || 0),
    completed_attachments: Number(attachmentStats.completed_attachments || 0),
    total_daily_logs: Number(dailyLogStats.total_daily_logs || 0),
    draft_daily_logs: Number(dailyLogStats.draft_daily_logs || 0),
    submitted_daily_logs: Number(dailyLogStats.submitted_daily_logs || 0),
    total_weekly_reviews: Number(weeklyReviewStats.total_weekly_reviews || 0),
    pending_weekly_reviews: Number(weeklyReviewStats.pending_weekly_reviews || 0),
    industry_reviewed_weekly_reviews: Number(weeklyReviewStats.industry_reviewed_weekly_reviews || 0),
    uni_reviewed_weekly_reviews: Number(weeklyReviewStats.uni_reviewed_weekly_reviews || 0),
    complete_weekly_reviews: Number(weeklyReviewStats.complete_weekly_reviews || 0)
  };

  // Get recent activity
  const recentActivity = await db('daily_logs')
    .join('attachments', 'daily_logs.attachment_id', 'attachments.id')
    .join('students', 'attachments.student_id', 'students.id')
    .join('users', 'students.user_id', 'users.id')
    .orderBy('daily_logs.created_at', 'desc')
    .limit(10)
    .select(
      'daily_logs.id',
      'daily_logs.log_date',
      'daily_logs.status',
      'daily_logs.created_at',
      'users.name as student_name',
      'students.reg_number',
      'attachments.organization_name'
    );

  // Get weekly review completion trends (last 12 weeks)
  const weeklyTrends = await db('weekly_reviews')
    .select(
      db.raw('DATE_TRUNC(\'week\', created_at) as week'),
      db.raw('COUNT(*) as created'),
      db.raw('COUNT(CASE WHEN status = \'complete\' THEN 1 END) as completed')
    )
    .where('created_at', '>=', db.raw('CURRENT_DATE - INTERVAL \'12 weeks\''))
    .groupBy(db.raw('DATE_TRUNC(\'week\', created_at)'))
    .orderBy('week', 'asc');

  // Get program distribution
  const programDistribution = await db('students')
    .join('users', 'students.user_id', 'users.id')
    .select(
      'students.program',
      db.raw('COUNT(*) as student_count')
    )
    .groupBy('students.program')
    .orderBy('student_count', 'desc');

  // Get industry feedback statistics
  const industryFeedbackStats = await db('industry_feedback')
    .join('weekly_reviews', 'industry_feedback.weekly_review_id', 'weekly_reviews.id')
    .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
    .join('students', 'attachments.student_id', 'students.id')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('uni_feedback', 'weekly_reviews.id', 'uni_feedback.weekly_review_id')
    .where('industry_feedback.submitted_at', '>=', db.raw('CURRENT_DATE - INTERVAL \'4 weeks\''))
    .select(
      db.raw('COUNT(*) as total_feedback'),
      db.raw('COUNT(CASE WHEN industry_feedback.approval = \'approved\' THEN 1 END) as approved'),
      db.raw('COUNT(CASE WHEN industry_feedback.approval = \'rejected\' THEN 1 END) as rejected'),
      db.raw('AVG(CASE WHEN uni_feedback.rating IS NOT NULL THEN uni_feedback.rating END) as avg_uni_rating'),
      db.raw('COUNT(DISTINCT students.id) as unique_students')
    )
    .first();

  res.json({
    success: true,
    dashboard: {
      systemStats,
      recentActivity,
      weeklyTrends,
      programDistribution,
      industryFeedbackStats,
      metrics: {
        submissionRate: systemStats.submitted_daily_logs / systemStats.total_daily_logs * 100,
        reviewCompletionRate: systemStats.complete_weekly_reviews / systemStats.total_weekly_reviews * 100,
        industryApprovalRate: industryFeedbackStats.approved / industryFeedbackStats.total_feedback * 100
      }
    }
  });
});

// Get dashboard statistics (general)
const getDashboardStats = asyncHandler(async (req, res) => {
  const { role } = req.user;
  let dashboard;

  switch (role) {
    case 'student':
      dashboard = await getStudentDashboardData(req.user.id);
      break;
    case 'uni_supervisor':
      dashboard = await getSupervisorDashboardData(req.user.id);
      break;
    case 'admin':
      dashboard = await getAdminDashboardData();
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid role for dashboard'
      });
  }

  res.json({
    success: true,
    dashboard
  });
});

// Helper functions
async function getStudentDashboardData(userId) {
  // Implementation similar to getStudentDashboard
  return { /* student dashboard data */ };
}

async function getSupervisorDashboardData(supervisorId) {
  // Implementation similar to getSupervisorDashboard
  return { /* supervisor dashboard data */ };
}

async function getAdminDashboardData() {
  // Implementation similar to getAdminDashboard
  return { /* admin dashboard data */ };
}

module.exports = {
  getStudentDashboard,
  getSupervisorDashboard,
  getAdminDashboard,
  getDashboardStats
};

const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');

// Generate student report
const generateStudentReport = asyncHandler(async (req, res) => {
  const { studentId, format = 'json' } = req.body;

  // Get student details
  const student = await db('students')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('users as supervisors', 'students.uni_supervisor_id', 'supervisors.id')
    .where('students.id', studentId)
    .select(
      'students.id',
      'students.reg_number',
      'students.program',
      'students.year_of_study',
      'users.name as student_name',
      'users.email as student_email',
      'supervisors.name as supervisor_name',
      'supervisors.email as supervisor_email'
    )
    .first();

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  // Get all attachments
  const attachments = await db('attachments')
    .where('student_id', studentId)
    .orderBy('created_at', 'desc')
    .select('*');

  // Get all daily logs
  const dailyLogs = await db('daily_logs')
    .join('attachments', 'daily_logs.attachment_id', 'attachments.id')
    .where('attachments.student_id', studentId)
    .orderBy('log_date', 'desc')
    .select(
      'daily_logs.*',
      'attachments.organization_name'
    );

  // Get all weekly reviews with feedback
  const weeklyReviews = await db('weekly_reviews')
    .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
    .leftJoin('industry_feedback', 'weekly_reviews.id', 'industry_feedback.weekly_review_id')
    .leftJoin('uni_feedback', 'weekly_reviews.id', 'uni_feedback.weekly_review_id')
    .leftJoin('users as supervisors', 'uni_feedback.uni_supervisor_id', 'supervisors.id')
    .where('attachments.student_id', studentId)
    .select(
      'weekly_reviews.id',
      'weekly_reviews.week_number',
      'weekly_reviews.week_start_date',
      'weekly_reviews.week_end_date',
      'weekly_reviews.status',
      'weekly_reviews.created_at',
      'industry_feedback.approval as industry_approval',
      'industry_feedback.comments as industry_comments',
      'industry_feedback.improvements as industry_improvements',
      'industry_feedback.submitted_at as industry_feedback_date',
      'uni_feedback.rating as uni_rating',
      'uni_feedback.comments as uni_comments',
      'uni_feedback.improvements as uni_improvements',
      'uni_feedback.created_at as uni_feedback_date',
      'supervisors.name as uni_supervisor_name'
    )
    .orderBy('weekly_reviews.week_number', 'desc');

  const reportData = {
    student,
    attachments,
    dailyLogs,
    weeklyReviews,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAttachments: attachments.length,
      totalDailyLogs: dailyLogs.length,
      totalWeeklyReviews: weeklyReviews.length,
      completedWeeklyReviews: weeklyReviews.filter(r => r.status === 'complete').length,
      averageUniRating: weeklyReviews
        .filter(r => r.uni_rating)
        .reduce((sum, r, i, arr) => sum + r.uni_rating, 0) / 
        weeklyReviews.filter(r => r.uni_rating).length || 1
    }
  };

  // Handle different formats
  switch (format) {
    case 'csv':
      return generateCSVReport(res, reportData, `student_report_${student.reg_number}`);
    case 'pdf':
      return generatePDFReport(res, reportData, `student_report_${student.reg_number}`);
    default:
      return res.json({
        success: true,
        report: reportData
      });
  }
});

// Generate cohort report
const generateCohortReport = asyncHandler(async (req, res) => {
  const { program, year, startDate, endDate, format = 'json' } = req.body;

  let query = db('students')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('attachments', 'students.id', 'attachments.student_id')
    .leftJoin('daily_logs', 'attachments.id', 'daily_logs.attachment_id')
    .leftJoin('weekly_reviews', 'attachments.id', 'weekly_reviews.attachment_id')
    .select(
      'students.id',
      'students.reg_number',
      'students.program',
      'students.year_of_study',
      'users.name as student_name',
      'users.email as student_email',
      db.raw('COUNT(attachments.id) as attachment_count'),
      db.raw('COUNT(daily_logs.id) as daily_log_count'),
      db.raw('COUNT(CASE WHEN daily_logs.status = \'submitted\' THEN 1 END) as submitted_log_count'),
      db.raw('COUNT(weekly_reviews.id) as weekly_review_count'),
      db.raw('COUNT(CASE WHEN weekly_reviews.status = \'complete\' THEN 1 END) as completed_review_count')
    )
    .groupBy('students.id', 'users.id');

  // Apply filters
  if (program) {
    query = query.where('students.program', program);
  }

  if (year) {
    query = query.where('students.year_of_study', year);
  }

  if (startDate) {
    query = query.where('students.created_at', '>=', startDate);
  }

  if (endDate) {
    query = query.where('students.created_at', '<=', endDate);
  }

  const cohortData = await query;

  // Calculate summary statistics
  const summary = {
    totalStudents: cohortData.length,
    totalAttachments: cohortData.reduce((sum, s) => sum + parseInt(s.attachment_count), 0),
    totalDailyLogs: cohortData.reduce((sum, s) => sum + parseInt(s.daily_log_count), 0),
    submittedDailyLogs: cohortData.reduce((sum, s) => sum + parseInt(s.submitted_log_count), 0),
    totalWeeklyReviews: cohortData.reduce((sum, s) => sum + parseInt(s.weekly_review_count), 0),
    completedWeeklyReviews: cohortData.reduce((sum, s) => sum + parseInt(s.completed_review_count), 0),
    averageLogsPerStudent: cohortData.length > 0 ? 
      cohortData.reduce((sum, s) => sum + parseInt(s.daily_log_count), 0) / cohortData.length : 0,
    submissionRate: cohortData.reduce((sum, s) => sum + parseInt(s.daily_log_count), 0) > 0 ?
      (cohortData.reduce((sum, s) => sum + parseInt(s.submitted_log_count), 0) / 
       cohortData.reduce((sum, s) => sum + parseInt(s.daily_log_count), 0)) * 100 : 0
  };

  const reportData = {
    filters: { program, year, startDate, endDate },
    students: cohortData,
    summary,
    generatedAt: new Date().toISOString()
  };

  // Handle different formats
  switch (format) {
    case 'csv':
      return generateCSVReport(res, reportData, 'cohort_report');
    case 'pdf':
      return generatePDFReport(res, reportData, 'cohort_report');
    default:
      return res.json({
        success: true,
        report: reportData
      });
  }
});

// Generate weekly review status report
const generateWeeklyReviewStatusReport = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, format = 'json' } = req.body;

  let query = db('weekly_reviews')
    .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
    .join('students', 'attachments.student_id', 'students.id')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('industry_feedback', 'weekly_reviews.id', 'industry_feedback.weekly_review_id')
    .leftJoin('uni_feedback', 'weekly_reviews.id', 'uni_feedback.weekly_review_id')
    .select(
      'weekly_reviews.id',
      'weekly_reviews.week_number',
      'weekly_reviews.week_start_date',
      'weekly_reviews.week_end_date',
      'weekly_reviews.status',
      'weekly_reviews.created_at',
      'users.name as student_name',
      'students.reg_number',
      'students.program',
      'attachments.organization_name',
      'industry_feedback.approval as industry_approval',
      'industry_feedback.submitted_at as industry_feedback_date',
      'uni_feedback.rating as uni_rating',
      'uni_feedback.created_at as uni_feedback_date'
    )
    .orderBy('weekly_reviews.week_start_date', 'desc');

  // Apply filters
  if (status) {
    query = query.where('weekly_reviews.status', status);
  }

  if (startDate) {
    query = query.where('weekly_reviews.week_start_date', '>=', startDate);
  }

  if (endDate) {
    query = query.where('weekly_reviews.week_end_date', '<=', endDate);
  }

  const reviews = await query;

  const reportData = {
    filters: { status, startDate, endDate },
    reviews,
    summary: {
      totalReviews: reviews.length,
      pending: reviews.filter(r => r.status === 'pending').length,
      industry_reviewed: reviews.filter(r => r.status === 'industry_reviewed').length,
      uni_reviewed: reviews.filter(r => r.status === 'uni_reviewed').length,
      complete: reviews.filter(r => r.status === 'complete').length,
      industryApproved: reviews.filter(r => r.industry_approval === 'approved').length,
      industryRejected: reviews.filter(r => r.industry_approval === 'rejected').length,
      averageUniRating: reviews
        .filter(r => r.uni_rating)
        .reduce((sum, r, i, arr) => sum + r.uni_rating, 0) / 
        reviews.filter(r => r.uni_rating).length || 1
    },
    generatedAt: new Date().toISOString()
  };

  // Handle different formats
  switch (format) {
    case 'csv':
      return generateCSVReport(res, reportData, 'weekly_review_status');
    case 'pdf':
      return generatePDFReport(res, reportData, 'weekly_review_status');
    default:
      return res.json({
        success: true,
        report: reportData
      });
  }
});

// Get report by ID
const getReportById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const report = await db('reports')
    .where('id', id)
    .first();

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found'
    });
  }

  // Check if file exists
  const fs = require('fs');
  const path = require('path');
  
  if (report.file_path && fs.existsSync(report.file_path)) {
    // For download, you might want to stream the file
    res.download(report.file_path, path.basename(report.file_path));
  } else {
    res.json({
      success: true,
      report
    });
  }
});

// Helper function to generate CSV
function generateCSVReport(res, data, filename) {
  const { Parser } = require('json2csv');
  const fs = require('fs');
  const path = require('path');

  try {
    let csvData;
    
    if (data.students) {
      // Cohort report format
      const fields = [
        'reg_number', 'student_name', 'program', 'year_of_study',
        'attachment_count', 'daily_log_count', 'submitted_log_count',
        'weekly_review_count', 'completed_review_count'
      ];
      const parser = new Parser({ fields });
      csvData = parser.parse(data.students);
    } else if (data.reviews) {
      // Weekly review status report format
      const fields = [
        'student_name', 'reg_number', 'program', 'organization_name',
        'week_number', 'week_start_date', 'week_end_date', 'status',
        'industry_approval', 'industry_feedback_date', 'uni_rating', 'uni_feedback_date'
      ];
      const parser = new Parser({ fields });
      csvData = parser.parse(data.reviews);
    } else {
      // Student report format - simplified for CSV
      const fields = ['type', 'date', 'description', 'status'];
      const csvRows = [];
      
      // Add daily logs
      if (data.dailyLogs) {
        data.dailyLogs.forEach(log => {
          csvRows.push({
            type: 'Daily Log',
            date: log.log_date,
            description: log.tasks_performed.substring(0, 100),
            status: log.status
          });
        });
      }
      
      // Add weekly reviews
      if (data.weeklyReviews) {
        data.weeklyReviews.forEach(review => {
          csvRows.push({
            type: 'Weekly Review',
            date: `${review.week_start_date} to ${review.week_end_date}`,
            description: `Week ${review.week_number} - ${review.status}`,
            status: review.status
          });
        });
      }
      
      const parser = new Parser({ fields });
      csvData = parser.parse(csvRows);
    }

    const filePath = path.join(__dirname, '../../reports', `${filename}.csv`);
    fs.writeFileSync(filePath, csvData);

    res.download(filePath, `${filename}.csv`);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating CSV report',
      error: error.message
    });
  }
}

// Helper function to generate PDF (placeholder)
function generatePDFReport(res, data, filename) {
  // This would require a PDF library like puppeteer or jsPDF
  // For now, return JSON with PDF generation indicator
  res.json({
    success: true,
    message: 'PDF generation not implemented yet',
    report: data,
    note: 'Use the JSON data to generate PDF on frontend'
  });
}

module.exports = {
  generateStudentReport,
  generateCohortReport,
  generateWeeklyReviewStatusReport,
  getReportById
};

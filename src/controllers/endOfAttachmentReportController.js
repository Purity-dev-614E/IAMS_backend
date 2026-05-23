const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const path = require('path');

// Submit end-of-attachment report (text)
const submitTextReport = asyncHandler(async (req, res) => {
  const { attachment_id, text_content } = req.body;

  if (!text_content || text_content.trim().length < 100) {
    return res.status(400).json({
      success: false,
      message: 'Report content must be at least 100 characters'
    });
  }

  // Get student profile
  const student = await db('students').where('user_id', req.user.id).first();
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  // Verify attachment belongs to student and is active/completed
  const attachment = await db('attachments')
    .where({ id: attachment_id, student_id: student.id })
    .whereIn('status', ['active', 'completed'])
    .first();

  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: 'Attachment not found or not eligible for report submission'
    });
  }

  // Check if report already exists for this attachment
  const existingReport = await db('end_of_attachment_reports')
    .where({ attachment_id })
    .first();

  if (existingReport) {
    return res.status(409).json({
      success: false,
      message: 'Report already submitted for this attachment'
    });
  }

  // Create text report
  const [report] = await db('end_of_attachment_reports').insert({
    attachment_id,
    student_id: student.id,
    submission_type: 'text',
    text_content: text_content.trim(),
    status: 'submitted'
  }).returning('*');

  res.status(201).json({
    success: true,
    message: 'Text report submitted successfully',
    report
  });
});

// Submit end-of-attachment report (PDF)
const submitPDFReport = asyncHandler(async (req, res) => {
  const { attachment_id } = req.body;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'PDF file is required'
    });
  }

  // Get student profile
  const student = await db('students').where('user_id', req.user.id).first();
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  // Verify attachment belongs to student and is active/completed
  const attachment = await db('attachments')
    .where({ id: attachment_id, student_id: student.id })
    .whereIn('status', ['active', 'completed'])
    .first();

  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: 'Attachment not found or not eligible for report submission'
    });
  }

  // Check if report already exists for this attachment
  const existingReport = await db('end_of_attachment_reports')
    .where({ attachment_id })
    .first();

  if (existingReport) {
    return res.status(409).json({
      success: false,
      message: 'Report already submitted for this attachment'
    });
  }

  // Create PDF report
  const [report] = await db('end_of_attachment_reports').insert({
    attachment_id,
    student_id: student.id,
    submission_type: 'pdf',
    pdf_file_path: req.file.path,
    pdf_filename: req.file.filename,
    status: 'submitted'
  }).returning('*');

  res.status(201).json({
    success: true,
    message: 'PDF report submitted successfully',
    report
  });
});

// Get student's submitted reports
const getStudentReports = asyncHandler(async (req, res) => {
  const student = await db('students').where('user_id', req.user.id).first();
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  const reports = await db('end_of_attachment_reports')
    .join('attachments', 'end_of_attachment_reports.attachment_id', 'attachments.id')
    .leftJoin('users as reviewers', 'end_of_attachment_reports.reviewed_by', 'reviewers.id')
    .select(
      'end_of_attachment_reports.*',
      'attachments.organization_name',
      'attachments.start_date',
      'attachments.end_date',
      'reviewers.name as reviewed_by_name'
    )
    .where('end_of_attachment_reports.student_id', student.id)
    .orderBy('end_of_attachment_reports.created_at', 'desc');

  res.json({
    success: true,
    reports
  });
});

// Get all reports (admin/supervisor)
const getAllReports = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, submission_type, search } = req.query;
  const offset = (page - 1) * limit;

  let query = db('end_of_attachment_reports')
    .join('attachments', 'end_of_attachment_reports.attachment_id', 'attachments.id')
    .join('students', 'end_of_attachment_reports.student_id', 'students.id')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('users as reviewers', 'end_of_attachment_reports.reviewed_by', 'reviewers.id')
    .select(
      'end_of_attachment_reports.id',
      'end_of_attachment_reports.submission_type',
      'end_of_attachment_reports.status',
      'end_of_attachment_reports.submitted_at',
      'end_of_attachment_reports.reviewed_at',
      'attachments.organization_name',
      'attachments.start_date',
      'attachments.end_date',
      'users.name as student_name',
      'users.email as student_email',
      'students.reg_number',
      'students.program',
      'reviewers.name as reviewed_by_name'
    )
    .orderBy('end_of_attachment_reports.submitted_at', 'desc');

  // Apply filters
  if (status) {
    query = query.where('end_of_attachment_reports.status', status);
  }

  if (submission_type) {
    query = query.where('end_of_attachment_reports.submission_type', submission_type);
  }

  if (search) {
    query = query.where(function() {
      this.where('users.name', 'ilike', `%${search}%`)
          .orWhere('students.reg_number', 'ilike', `%${search}%`)
          .orWhere('attachments.organization_name', 'ilike', `%${search}%`);
    });
  }

  // Get total count
  const totalQuery = query.clone().clearSelect().clearOrder().count('* as total');
  const [{ total }] = await totalQuery;

  // Get paginated results
  const reports = await query.limit(limit).offset(offset);

  res.json({
    success: true,
    reports,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get report by ID
const getReportById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const report = await db('end_of_attachment_reports')
    .join('attachments', 'end_of_attachment_reports.attachment_id', 'attachments.id')
    .join('students', 'end_of_attachment_reports.student_id', 'students.id')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('users as reviewers', 'end_of_attachment_reports.reviewed_by', 'reviewers.id')
    .select(
      'end_of_attachment_reports.*',
      'attachments.organization_name',
      'attachments.start_date',
      'attachments.end_date',
      'users.name as student_name',
      'users.email as student_email',
      'students.reg_number',
      'students.program',
      'reviewers.name as reviewed_by_name'
    )
    .where('end_of_attachment_reports.id', id)
    .first();

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found'
    });
  }

  res.json({
    success: true,
    report
  });
});

// Review report (admin/supervisor)
const reviewReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, feedback_comments } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Must be approved or rejected'
    });
  }

  // Check if report exists
  const report = await db('end_of_attachment_reports').where({ id }).first();
  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found'
    });
  }

  if (report.status !== 'submitted' && report.status !== 'under_review') {
    return res.status(400).json({
      success: false,
      message: 'Report cannot be reviewed in current status'
    });
  }

  // Update report
  const [updatedReport] = await db('end_of_attachment_reports')
    .where({ id })
    .update({
      status,
      feedback_comments,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      updated_at: new Date()
    })
    .returning('*');

  res.json({
    success: true,
    message: `Report ${status} successfully`,
    report: updatedReport
  });
});

// Download PDF report
const downloadPDFReport = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const report = await db('end_of_attachment_reports')
    .join('students', 'end_of_attachment_reports.student_id', 'students.id')
    .where('end_of_attachment_reports.id', id)
    .where('end_of_attachment_reports.submission_type', 'pdf')
    .first();

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'PDF report not found'
    });
  }

  // Check if user owns the report or is staff
  const student = await db('students').where('user_id', req.user.id).first();
  const isOwner = student && student.id === report.student_id;
  const isStaff = ['admin', 'uni_supervisor'].includes(req.user.role);

  if (!isOwner && !isStaff) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  if (!report.pdf_file_path) {
    return res.status(404).json({
      success: false,
      message: 'PDF file not found on server'
    });
  }

  res.download(report.pdf_file_path, report.pdf_filename || 'report.pdf');
});

module.exports = {
  submitTextReport,
  submitPDFReport,
  getStudentReports,
  getAllReports,
  getReportById,
  reviewReport,
  downloadPDFReport
};

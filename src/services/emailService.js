const nodemailer = require('nodemailer');
const db = require('../database/connection');
const { generateVerificationToken } = require('../middleware/industryAuth');

// Email configuration
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send weekly review request to industry supervisor
const sendWeeklyReviewRequest = async (weeklyReviewId) => {
  try {
    // Get weekly review details with student and attachment info
    const weeklyReview = await db('weekly_reviews')
      .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
      .join('students', 'attachments.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .where('weekly_reviews.id', weeklyReviewId)
      .select(
        'weekly_reviews.*',
        'attachments.organization_name',
        'attachments.industry_supervisor_name',
        'attachments.industry_supervisor_email',
        'users.name as student_name',
        'students.reg_number'
      )
      .first();

    if (!weeklyReview) {
      throw new Error('Weekly review not found');
    }

    // Check if industry feedback already exists
    const existingFeedback = await db('industry_feedback')
      .where('weekly_review_id', weeklyReviewId)
      .first();

    if (existingFeedback) {
      console.log(`Industry feedback already exists for weekly review ${weeklyReviewId}`);
      return { success: false, message: 'Feedback already requested' };
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();

    // Create industry feedback record
    await db('industry_feedback').insert({
      weekly_review_id: weeklyReviewId,
      verification_token: verificationToken,
      approval: null,
      comments: null,
      improvements: null,
      submitted_at: null
    });

    // Get daily logs for this week
    const dailyLogs = await db('daily_logs')
      .where('attachment_id', weeklyReview.attachment_id)
      .where('log_date', '>=', weeklyReview.week_start_date)
      .where('log_date', '<=', weeklyReview.week_end_date)
      .orderBy('log_date')
      .select('log_date', 'tasks_performed', 'skills_acquired', 'observations');

    // Create review link
    const reviewLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/industry-review/${verificationToken}`;

    // Send email
    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@iams.edu',
      to: weeklyReview.industry_supervisor_email,
      subject: `Weekly Review Request - ${weeklyReview.student_name} - Week ${weeklyReview.week_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Weekly Review Request</h2>
          <p>Dear ${weeklyReview.industry_supervisor_name},</p>
          
          <p>Please review the weekly log for <strong>${weeklyReview.student_name}</strong> (${weeklyReview.reg_number}) 
          for <strong>Week ${weeklyReview.week_number}</strong> (${weeklyReview.week_start_date} to ${weeklyReview.week_end_date}).</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Organization: ${weeklyReview.organization_name}</h3>
            <p><strong>Student:</strong> ${weeklyReview.student_name}</p>
            <p><strong>Registration Number:</strong> ${weeklyReview.reg_number}</p>
            <p><strong>Week:</strong> ${weeklyReview.week_number} (${weeklyReview.week_start_date} to ${weeklyReview.week_end_date})</p>
          </div>
          
          <h3>Daily Logs Summary:</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Tasks Performed</th>
              </tr>
            </thead>
            <tbody>
              ${dailyLogs.map(log => `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 8px;">${log.log_date}</td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${log.tasks_performed.substring(0, 100)}...</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reviewLink}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Review Weekly Log
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            This link will expire after submission. If you have any issues, please contact the university supervisor.
          </p>
          
          <p>Best regards,<br>IAMS System</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`Weekly review request sent to ${weeklyReview.industry_supervisor_email} for ${weeklyReview.student_name}`);
    
    return { 
      success: true, 
      message: 'Review request sent successfully',
      token: verificationToken
    };

  } catch (error) {
    console.error('Error sending weekly review request:', error);
    throw error;
  }
};

// Send confirmation email after industry feedback submission
const sendFeedbackConfirmation = async (feedbackId) => {
  try {
    const feedback = await db('industry_feedback')
      .join('weekly_reviews', 'industry_feedback.weekly_review_id', 'weekly_reviews.id')
      .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
      .join('students', 'attachments.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .where('industry_feedback.id', feedbackId)
      .select(
        'industry_feedback.*',
        'weekly_reviews.week_number',
        'attachments.industry_supervisor_name',
        'attachments.industry_supervisor_email',
        'users.name as student_name',
        'students.reg_number'
      )
      .first();

    if (!feedback) {
      throw new Error('Feedback not found');
    }

    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@iams.edu',
      to: feedback.industry_supervisor_email,
      subject: `Feedback Confirmation - ${feedback.student_name} - Week ${feedback.week_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Feedback Submitted Successfully</h2>
          <p>Dear ${feedback.industry_supervisor_name},</p>
          
          <p>Thank you for reviewing the weekly log for <strong>${feedback.student_name}</strong> 
          (${feedback.reg_number}) for <strong>Week ${feedback.week_number}</strong>.</p>
          
          <div style="background-color: ${feedback.approval === 'approved' ? '#d4edda' : '#f8d7da'}; 
                      padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Your Decision: ${feedback.approval.toUpperCase()}</h3>
            ${feedback.comments ? `<p><strong>Comments:</strong> ${feedback.comments}</p>` : ''}
            ${feedback.improvements ? `<p><strong>Improvements Suggested:</strong> ${feedback.improvements}</p>` : ''}
          </div>
          
          <p>Your feedback has been recorded and will be reviewed by the university supervisor.</p>
          
          <p>Best regards,<br>IAMS System</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`Feedback confirmation sent to ${feedback.industry_supervisor_email}`);
    
    return { success: true, message: 'Confirmation sent successfully' };

  } catch (error) {
    console.error('Error sending feedback confirmation:', error);
    throw error;
  }
};

module.exports = {
  sendWeeklyReviewRequest,
  sendFeedbackConfirmation
};

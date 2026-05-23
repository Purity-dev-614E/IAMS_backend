const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const db = require('../database/connection');
const { generateVerificationToken } = require('../middleware/industryAuth');

// Avoid crashing the whole server at startup if RESEND_API_KEY is missing.
// Emails will fail with a clear message only when sending is attempted.
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

let gmailTransporter = null;

const isGmailConfigured = () => Boolean(process.env.GMAIL_USER && (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS));
const isResendConfigured = () => Boolean(resend);

const getGmailTransporter = () => {
  if (!isGmailConfigured()) return null;

  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS
      }
    });
  }

  return gmailTransporter;
};

const ensureEmailConfigured = () => {
  if (!isGmailConfigured() && !isResendConfigured()) {
    throw new Error('Email is not configured. Add Gmail credentials or RESEND_API_KEY to .env.');
  }
};

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';

const sendWithResend = async (payload) => {
  const result = await resend.emails.send(payload);

  if (result?.error) {
    const message = result.error.message || 'Resend rejected the email request';
    const error = new Error(message);
    error.provider = 'resend';
    error.providerError = result.error;
    throw error;
  }

  const data = result?.data || result;
  return {
    provider: 'resend',
    id: data?.id,
    raw: data
  };
};

const sendWithGmail = async (payload) => {
  const transporter = getGmailTransporter();
  const fromAddress = process.env.GMAIL_FROM_EMAIL || process.env.GMAIL_USER;
  const result = await transporter.sendMail({
    from: fromAddress,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text
  });

  return {
    provider: 'gmail',
    id: result.messageId,
    raw: result
  };
};

const sendEmail = async (payload) => {
  ensureEmailConfigured();

  const preferredProvider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
  const shouldTryGmailFirst = preferredProvider !== 'resend' && isGmailConfigured();
  const firstProvider = shouldTryGmailFirst ? 'gmail' : 'resend';
  const secondProvider = firstProvider === 'gmail' ? 'resend' : 'gmail';

  const tryProvider = async (provider) => {
    if (provider === 'gmail') {
      if (!isGmailConfigured()) throw new Error('Gmail email is not configured.');
      return sendWithGmail(payload);
    }

    if (!isResendConfigured()) throw new Error('RESEND_API_KEY is missing.');
    return sendWithResend(payload);
  };

  try {
    return await tryProvider(firstProvider);
  } catch (firstError) {
    const canFallback =
      (secondProvider === 'gmail' && isGmailConfigured()) ||
      (secondProvider === 'resend' && isResendConfigured());

    if (!canFallback) {
      throw firstError;
    }

    console.warn(`⚠️ ${firstProvider} email failed, trying ${secondProvider}:`, firstError.message);
    return tryProvider(secondProvider);
  }
};

// Send a simple test email from Postman/admin tooling without touching review data.
const sendTestEmail = async ({ to, subject, message }) => {
  try {
    ensureEmailConfigured();

    if (!to) {
      throw new Error('Recipient email is required');
    }

    const emailSubject = subject || 'IAMS test email';
    const emailMessage = message || 'This is a test email from the IAMS backend.';

    const result = await sendEmail({
      from: process.env.FROM_EMAIL || 'IAMS <noreply@iams.edu>',
      to,
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">IAMS Email Test</h2>
          <p>${emailMessage}</p>
          <p style="color: #666; font-size: 12px;">
            Sent at ${new Date().toISOString()} from the IAMS backend.
          </p>
        </div>
      `
    });

    console.log('------------------------------------------------------------');
    console.log('[EMAIL SENT] Test Email');
    console.log(`Recipient: ${to}`);
    console.log(`Subject:   ${emailSubject}`);
    console.log(`Provider:  ${result.provider}`);
    console.log(`Email ID:  ${result.id || 'not returned'}`);
    console.log('------------------------------------------------------------');

    return {
      success: true,
      message: 'Test email sent successfully',
      providerResponse: result
    };
  } catch (error) {
    console.error('Error sending test email:', error);
    throw error;
  }
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatEmailDate = (value) => {
  if (!value) return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const buildEmailShell = ({ preheader, title, eyebrow, body }) => `
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0; padding: 0; background: #eef3f8; font-family: Arial, Helvetica, sans-serif;">
    <tr>
      <td align="center" style="padding: 32px 14px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #dbe5ef; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.10);">
          <tr>
            <td style="padding: 0; background: #0f3d5e;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 28px 30px 26px;">
                    <div style="color: #a7f3d0; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">${escapeHtml(eyebrow)}</div>
                    <h1 style="margin: 10px 0 0; color: #ffffff; font-size: 28px; line-height: 1.2; font-weight: 800;">${escapeHtml(title)}</h1>
                    <div style="margin-top: 18px; width: 72px; height: 4px; background: #22c55e; border-radius: 999px;"></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${body}
          <tr>
            <td style="padding: 22px 30px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.6;">
                This message was sent by IAMS. If anything looks incorrect, please contact the university supervisor or attachment office.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

const buildDetailsPanel = (items) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 22px 0; border-collapse: separate; border-spacing: 0; background: #f8fafc; border: 1px solid #dbe5ef; border-radius: 14px; overflow: hidden;">
    ${items.map((item) => `
      <tr>
        <td style="width: 38%; padding: 13px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(item.label)}</td>
        <td style="padding: 13px 16px; color: #0f172a; font-size: 14px; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${escapeHtml(item.value)}</td>
      </tr>
    `).join('')}
  </table>
`;

const buildWeeklyReviewRequestEmail = ({ weeklyReview, dailyLogs, reviewLink }) => {
  const weekRange = `${formatEmailDate(weeklyReview.week_start_date)} - ${formatEmailDate(weeklyReview.week_end_date)}`;
  const submittedLogs = dailyLogs.length;

  return buildEmailShell({
    eyebrow: 'Weekly review request',
    title: `Week ${weeklyReview.week_number} is ready for review`,
    preheader: `Review ${weeklyReview.student_name}'s Week ${weeklyReview.week_number} attachment log in IAMS.`,
    body: `
      <tr>
        <td style="padding: 30px;">
          <p style="margin: 0 0 14px; color: #0f172a; font-size: 16px; line-height: 1.7;">Dear ${escapeHtml(weeklyReview.industry_supervisor_name || 'Industry Supervisor')},</p>
          <p style="margin: 0; color: #334155; font-size: 15px; line-height: 1.7;">
            Please review the weekly attachment log for <strong style="color: #0f172a;">${escapeHtml(weeklyReview.student_name)}</strong>
            (${escapeHtml(weeklyReview.reg_number)}) for <strong style="color: #0f172a;">Week ${escapeHtml(weeklyReview.week_number)}</strong>.
            The daily logs and feedback form are available through the secure review page.
          </p>

          ${buildDetailsPanel([
            { label: 'Organization', value: weeklyReview.organization_name || 'Not provided' },
            { label: 'Student', value: weeklyReview.student_name || 'Not provided' },
            { label: 'Registration number', value: weeklyReview.reg_number || 'Not provided' },
            { label: 'Review period', value: weekRange },
            { label: 'Submitted logs', value: `${submittedLogs} day${submittedLogs === 1 ? '' : 's'}` }
          ])}

          <div style="text-align: center; margin: 32px 0 22px;">
            <a href="${escapeHtml(reviewLink)}" style="display: inline-block; background: #16a34a; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 999px; font-size: 15px; font-weight: 800;">
              Review Weekly Log
            </a>
          </div>

          <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
            The secure review link can be used once and will close after feedback is submitted.
          </p>
        </td>
      </tr>
    `
  });
};

const buildUniSupervisorNoticeEmail = ({ weeklyReview, dailyLogs }) => {
  const weekRange = `${formatEmailDate(weeklyReview.week_start_date)} - ${formatEmailDate(weeklyReview.week_end_date)}`;
  const submittedLogs = dailyLogs.length;

  return buildEmailShell({
    eyebrow: 'Supervisor notification',
    title: `Week ${weeklyReview.week_number} review triggered`,
    preheader: `The industry supervisor has been asked to review ${weeklyReview.student_name}'s Week ${weeklyReview.week_number} logs.`,
    body: `
      <tr>
        <td style="padding: 30px;">
          <p style="margin: 0 0 14px; color: #0f172a; font-size: 16px; line-height: 1.7;">Dear ${escapeHtml(weeklyReview.uni_supervisor_name || 'University Supervisor')},</p>
          <p style="margin: 0; color: #334155; font-size: 15px; line-height: 1.7;">
            A weekly review has been triggered for <strong style="color: #0f172a;">${escapeHtml(weeklyReview.student_name)}</strong>
            (${escapeHtml(weeklyReview.reg_number)}). The industry supervisor has been notified, and you can follow the review status from your IAMS dashboard.
          </p>

          ${buildDetailsPanel([
            { label: 'Organization', value: weeklyReview.organization_name || 'Not provided' },
            { label: 'Industry supervisor', value: weeklyReview.industry_supervisor_name || 'Not provided' },
            { label: 'Review period', value: weekRange },
            { label: 'Submitted logs', value: `${submittedLogs} day${submittedLogs === 1 ? '' : 's'}` },
            { label: 'Current status', value: weeklyReview.status || 'pending' }
          ])}

          <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">
            Daily log details remain available in IAMS, so they are not repeated in this notification email.
          </p>
        </td>
      </tr>
    `
  });
};

const buildDailyLogReminderEmail = ({ studentName, logLink }) => buildEmailShell({
  eyebrow: 'Daily log reminder',
  title: 'Remember to submit today\'s log',
  preheader: 'Capture today\'s industrial attachment activities in IAMS.',
  body: `
    <tr>
      <td style="padding: 30px;">
        <p style="margin: 0 0 14px; color: #0f172a; font-size: 16px; line-height: 1.7;">Dear ${escapeHtml(studentName || 'Student')},</p>
        <p style="margin: 0; color: #334155; font-size: 15px; line-height: 1.7;">
          This is a friendly reminder to submit your daily attachment log for today.
        </p>

        ${buildDetailsPanel([
          { label: 'What to capture', value: 'Tasks, skills, observations' },
          { label: 'Status', value: 'Not submitted today' }
        ])}

        <div style="text-align: center; margin: 32px 0 22px;">
          <a href="${escapeHtml(logLink)}" style="display: inline-block; background: #16a34a; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 999px; font-size: 15px; font-weight: 800;">
            Submit Daily Log
          </a>
        </div>

        <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
          A short, consistent log makes weekly reviews easier for your supervisors.
        </p>
      </td>
    </tr>
  `
});

const sendDailyLogReminder = async (attachment) => {
  try {
    ensureEmailConfigured();

    if (!attachment?.student_email) {
      throw new Error('Student email is required for daily log reminder');
    }

    const logLink = `${getFrontendUrl()}/logs/new`;
    const result = await sendEmail({
      from: process.env.FROM_EMAIL || 'IAMS <noreply@iams.edu>',
      to: attachment.student_email,
      subject: 'Daily Log Reminder',
      html: buildDailyLogReminderEmail({
        studentName: attachment.student_name,
        logLink
      })
    });

    console.log(`📧 Daily log reminder sent to ${attachment.student_email}`);
    console.log(`Provider: ${result.provider}`);
    console.log(`Email ID: ${result.id || 'not returned'}`);

    return {
      success: true,
      message: 'Daily log reminder sent successfully',
      providerResponse: result
    };
  } catch (error) {
    console.error('❌ Error sending daily log reminder:', error);
    throw error;
  }
};


// Send weekly review request to industry supervisor
const sendWeeklyReviewRequest = async (weeklyReviewId) => {
  try {
    ensureEmailConfigured();

    // Get weekly review details with student and attachment info
    const weeklyReview = await db('weekly_reviews')
      .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
      .join('students', 'attachments.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .leftJoin('users as uni_supervisors', 'students.uni_supervisor_id', 'uni_supervisors.id')
      .where('weekly_reviews.id', weeklyReviewId)
      .select(
        'weekly_reviews.*',
        'attachments.organization_name',
        'attachments.industry_supervisor_name',
        'attachments.industry_supervisor_email',
        'users.name as student_name',
        'students.reg_number',
        'uni_supervisors.name as uni_supervisor_name',
        'uni_supervisors.email as uni_supervisor_email'
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
    const reviewLink = `${getFrontendUrl()}/review/${verificationToken}`;

    // Send email to industry supervisor
    const industryEmail = await sendEmail({
      from: process.env.FROM_EMAIL || 'IAMS <noreply@iams.edu>',
      to: weeklyReview.industry_supervisor_email,
      subject: `Weekly Review Request - ${weeklyReview.student_name} - Week ${weeklyReview.week_number}`,
      html: buildWeeklyReviewRequestEmail({ weeklyReview, dailyLogs, reviewLink })
    });

    let uniSupervisorEmail = null;
    if (weeklyReview.uni_supervisor_email) {
      uniSupervisorEmail = await sendEmail({
        from: process.env.FROM_EMAIL || 'IAMS <noreply@iams.edu>',
        to: weeklyReview.uni_supervisor_email,
        subject: `Weekly Review Triggered - ${weeklyReview.student_name} - Week ${weeklyReview.week_number}`,
        html: buildUniSupervisorNoticeEmail({ weeklyReview, dailyLogs })
      });
    }
    
    console.log('------------------------------------------------------------');
    console.log(`[EMAIL SENT] Weekly Review Request`);
    console.log(`Recipient: ${weeklyReview.industry_supervisor_email}`);
    console.log(`Recipient Provider: ${industryEmail.provider}`);
    console.log(`Recipient Email ID: ${industryEmail.id || 'not returned'}`);
    if (weeklyReview.uni_supervisor_email) {
      console.log(`Uni Sup:   ${weeklyReview.uni_supervisor_email}`);
      console.log(`Uni Sup Provider: ${uniSupervisorEmail?.provider || 'not returned'}`);
      console.log(`Uni Sup Email ID: ${uniSupervisorEmail?.id || 'not returned'}`);
    }
    console.log(`Student:   ${weeklyReview.student_name} (${weeklyReview.reg_number})`);
    console.log(`Week:      ${weeklyReview.week_number}`);
    console.log(`Link:      ${reviewLink}`);
    console.log('------------------------------------------------------------');
    
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
    ensureEmailConfigured();

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

    const result = await sendEmail({
      from: process.env.FROM_EMAIL || 'IAMS <noreply@iams.edu>',
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
    });
    
    console.log(`Feedback confirmation sent to ${feedback.industry_supervisor_email}`);
    console.log(`Provider: ${result.provider}`);
    console.log(`Email ID: ${result.id || 'not returned'}`);
    
    return { success: true, message: 'Confirmation sent successfully' };

  } catch (error) {
    console.error('Error sending feedback confirmation:', error);
    throw error;
  }
};

// Notify a university supervisor that their account has been approved or rejected
const sendSupervisorStatusNotification = async (supervisor, status) => {
  try {
    ensureEmailConfigured();

    if (!['approved', 'rejected'].includes(status)) {
      throw new Error('Invalid supervisor notification status');
    }

    const isApproved = status === 'approved';
    const loginLink = `${getFrontendUrl()}/login`;

    const result = await sendEmail({
      from: process.env.FROM_EMAIL || 'IAMS <noreply@iams.edu>',
      to: supervisor.email,
      subject: isApproved
        ? 'IAMS Supervisor Account Approved'
        : 'IAMS Supervisor Registration Rejected',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Supervisor Account ${isApproved ? 'Approved' : 'Rejected'}</h2>
          <p>Dear ${supervisor.name},</p>

          ${isApproved ? `
            <p>Your university supervisor account has been approved. You can now sign in and access your assigned student attachment records.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginLink}"
                 style="background-color: #007bff; color: white; padding: 12px 30px;
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Sign In
              </a>
            </div>
          ` : `
            <p>Your university supervisor registration has been reviewed and rejected.</p>
            <p>If you believe this was a mistake, please contact the system administrator for clarification.</p>
          `}

          <p>Best regards,<br>IAMS System</p>
        </div>
      `
    });

    console.log(`Supervisor ${status} notification sent to ${supervisor.email}`);
    console.log(`Provider: ${result.provider}`);
    console.log(`Email ID: ${result.id || 'not returned'}`);

    return { success: true, message: `Supervisor ${status} notification sent successfully` };
  } catch (error) {
    console.error(`Error sending supervisor ${status} notification:`, error);
    throw error;
  }
};

module.exports = {
  sendTestEmail,
  sendWeeklyReviewRequest,
  sendDailyLogReminder,
  sendFeedbackConfirmation,
  sendSupervisorStatusNotification
};


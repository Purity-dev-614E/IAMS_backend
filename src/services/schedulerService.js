const cron = require('node-cron');
const db = require('../database/connection');
const { sendWeeklyReviewRequest } = require('./emailService');

class SchedulerService {
  constructor() {
    this.jobs = [];
  }

  // Schedule weekly review requests (every Friday at 5 PM)
  scheduleWeeklyReviews() {
    const job = cron.schedule('0 17 * * 5', async () => {
      console.log('Running weekly review request scheduler...');
      await this.processWeeklyReviews();
    }, {
      scheduled: false,
      timezone: 'Africa/Nairobi'
    });

    this.jobs.push(job);
    return job;
  }

  // Process all pending weekly reviews
  async processWeeklyReviews() {
    try {
      // Get weekly reviews that need industry supervisor review
      const pendingReviews = await db('weekly_reviews')
        .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
        .leftJoin('industry_feedback', 'weekly_reviews.id', 'industry_feedback.weekly_review_id')
        .where('weekly_reviews.status', 'pending')
        .whereNull('industry_feedback.id')
        .where('weekly_reviews.week_end_date', '<=', db.raw('CURRENT_DATE'))
        .select(
          'weekly_reviews.id',
          'weekly_reviews.week_number',
          'weekly_reviews.week_start_date',
          'weekly_reviews.week_end_date',
          'attachments.id as attachment_id'
        );

      console.log(`Found ${pendingReviews.length} pending weekly reviews to process`);

      for (const review of pendingReviews) {
        try {
          await sendWeeklyReviewRequest(review.id);
          
          // Update weekly review status
          await db('weekly_reviews')
            .where('id', review.id)
            .update({ status: 'industry_reviewed' });

          console.log(`Sent review request for week ${review.week_number}`);
        } catch (error) {
          console.error(`Failed to send review request for week ${review.week_number}:`, error);
        }
      }

    } catch (error) {
      console.error('Error in weekly review scheduler:', error);
    }
  }

  // Schedule daily log reminders (every weekday at 9 AM)
  scheduleDailyLogReminders() {
    const job = cron.schedule('0 9 * * 1-5', async () => {
      console.log('Sending daily log reminders...');
      await this.sendDailyLogReminders();
    }, {
      scheduled: false,
      timezone: 'Africa/Nairobi'
    });

    this.jobs.push(job);
    return job;
  }

  // Send daily log reminders to students
  async sendDailyLogReminders() {
    try {
      // Get active attachments
      const activeAttachments = await db('attachments')
        .join('students', 'attachments.student_id', 'students.id')
        .join('users', 'students.user_id', 'users.id')
        .where('attachments.status', 'active')
        .where('attachments.start_date', '<=', db.raw('CURRENT_DATE'))
        .where('attachments.end_date', '>=', db.raw('CURRENT_DATE'))
        .select(
          'attachments.id',
          'users.name as student_name',
          'users.email as student_email'
        );

      for (const attachment of activeAttachments) {
        // Check if student already submitted log for today
        const todayLog = await db('daily_logs')
          .where('attachment_id', attachment.id)
          .where('log_date', db.raw('CURRENT_DATE'))
          .first();

        if (!todayLog) {
          await this.sendDailyLogReminder(attachment);
        }
      }
    } catch (error) {
      console.error('Error sending daily log reminders:', error);
    }
  }

  // Send individual daily log reminder
  async sendDailyLogReminder(attachment) {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@iams.edu',
      to: attachment.student_email,
      subject: 'Daily Log Reminder',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Daily Log Reminder</h2>
          <p>Dear ${attachment.student_name},</p>
          
          <p>This is a friendly reminder to submit your daily log for today.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p>Please take a few minutes to document:</p>
            <ul>
              <li>Tasks performed today</li>
              <li>Skills acquired</li>
              <li>Observations and learning points</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/logs" 
               style="background-color: #007bff; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Submit Daily Log
            </a>
          </div>
          
          <p>Best regards,<br>IAMS System</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Daily log reminder sent to ${attachment.student_email}`);
  }

  // Start all scheduled jobs
  start() {
    console.log('Starting scheduler service...');
    
    this.scheduleWeeklyReviews().start();
    this.scheduleDailyLogReminders().start();
    
    console.log('Scheduler service started');
  }

  // Stop all scheduled jobs
  stop() {
    console.log('Stopping scheduler service...');
    
    this.jobs.forEach(job => {
      job.stop();
    });
    
    this.jobs = [];
    console.log('Scheduler service stopped');
  }

  // Get job status
  getStatus() {
    return {
      running: this.jobs.length > 0,
      jobsCount: this.jobs.length,
      jobs: this.jobs.map((job, index) => ({
        id: index,
        running: job.running || false
      }))
    };
  }
}

module.exports = new SchedulerService();

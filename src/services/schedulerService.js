const cron = require('node-cron');
const db = require('../database/connection');
const { sendWeeklyReviewRequest, sendDailyLogReminder } = require('./emailService');

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

  // Schedule automatic attachment status maintenance (every day at 12:10 AM)
  scheduleAttachmentStatusMaintenance() {
    const job = cron.schedule('10 0 * * *', async () => {
      console.log('Running attachment status maintenance...');
      await this.processAttachmentStatuses();
    }, {
      scheduled: false,
      timezone: 'Africa/Nairobi'
    });

    this.jobs.push(job);
    return job;
  }

  // Complete expired attachments and deactivate active attachments with no logs for 3 weeks
  async processAttachmentStatuses() {
    try {
      const completedCount = await this.completeExpiredAttachments();
      const inactiveCount = await this.deactivateInactiveAttachments();

      console.log(
        `Attachment status maintenance complete. Completed: ${completedCount}, inactive: ${inactiveCount}`
      );

      return {
        completed: completedCount,
        inactive: inactiveCount
      };
    } catch (error) {
      console.error('Error processing attachment statuses:', error);
      throw error;
    }
  }

  async completeExpiredAttachments() {
    const completedAttachments = await db('attachments')
      .whereIn('status', ['pending', 'active'])
      .where('end_date', '<', db.raw('CURRENT_DATE'))
      .update({
        status: 'completed',
        updated_at: new Date()
      })
      .returning('id');

    return completedAttachments.length;
  }

  async deactivateInactiveAttachments() {
    const inactiveAttachments = await db('attachments')
      .where('status', 'active')
      .where('start_date', '<=', db.raw(`CURRENT_DATE - INTERVAL '21 days'`))
      .where('end_date', '>=', db.raw('CURRENT_DATE'))
      .whereNotExists(function() {
        this.select(db.raw('1'))
          .from('daily_logs')
          .whereRaw('daily_logs.attachment_id = attachments.id')
          .where('daily_logs.log_date', '>=', db.raw(`CURRENT_DATE - INTERVAL '21 days'`));
      })
      .update({
        status: 'inactive',
        updated_at: new Date()
      })
      .returning('id');

    return inactiveAttachments.length;
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
    return sendDailyLogReminder(attachment);
  }

  // Start all scheduled jobs
  start() {
    console.log('Starting scheduler service...');
    
    this.scheduleWeeklyReviews().start();
    this.scheduleDailyLogReminders().start();
    this.scheduleAttachmentStatusMaintenance().start();
    
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

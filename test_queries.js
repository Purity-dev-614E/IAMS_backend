const db = require('./src/database/connection');

async function testQueries() {
  try {
    console.log('🔍 Testing Database Queries...\n');

    // Test 1: Get all users with their roles
    console.log('1. All Users:');
    const users = await db('users').select('id', 'name', 'email', 'role');
    console.table(users);

    // Test 2: Get students with their user info and supervisors
    console.log('\n2. Students with User and Supervisor Info:');
    const students = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .leftJoin('users as supervisors', 'students.uni_supervisor_id', 'supervisors.id')
      .select(
        'students.id as student_id',
        'students.reg_number',
        'students.program',
        'users.name as student_name',
        'users.email as student_email',
        'supervisors.name as supervisor_name',
        'supervisors.email as supervisor_email'
      );
    console.table(students);

    // Test 3: Get attachments with student and organization info
    console.log('\n3. Attachments with Student Info:');
    const attachments = await db('attachments')
      .join('students', 'attachments.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .select(
        'attachments.id',
        'attachments.organization_name',
        'attachments.industry_supervisor_name',
        'attachments.status',
        'users.name as student_name',
        'students.reg_number'
      );
    console.table(attachments);

    // Test 4: Get daily logs with attachment and student info
    console.log('\n4. Daily Logs with Student Info:');
    const dailyLogs = await db('daily_logs')
      .join('attachments', 'daily_logs.attachment_id', 'attachments.id')
      .join('students', 'attachments.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .select(
        'daily_logs.id',
        'daily_logs.log_date',
        'daily_logs.status',
        'users.name as student_name',
        'students.reg_number',
        'attachments.organization_name'
      )
      .orderBy('daily_logs.log_date');
    console.table(dailyLogs);

    // Test 5: Get weekly reviews with daily logs count (CRUCIAL TEST)
    console.log('\n5. Weekly Reviews with Daily Logs Count:');
    const weeklyReviews = await db('weekly_reviews')
      .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
      .join('students', 'attachments.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .leftJoin('daily_logs', function() {
        this.on('daily_logs.attachment_id', '=', 'weekly_reviews.attachment_id')
            .andOn('daily_logs.log_date', '>=', 'weekly_reviews.week_start_date')
            .andOn('daily_logs.log_date', '<=', 'weekly_reviews.week_end_date');
      })
      .select(
        'weekly_reviews.id',
        'weekly_reviews.week_number',
        'weekly_reviews.week_start_date',
        'weekly_reviews.week_end_date',
        'weekly_reviews.status',
        'users.name as student_name',
        'students.reg_number',
        db.raw('COUNT(daily_logs.id) as daily_logs_count')
      )
      .groupBy('weekly_reviews.id', 'users.name', 'students.reg_number')
      .orderBy('weekly_reviews.week_start_date');
    console.table(weeklyReviews);

    // Test 6: Get daily logs grouped by weekly reviews (THE KEY RELATIONSHIP)
    console.log('\n6. Daily Logs Grouped by Weekly Reviews:');
    const logsByWeek = await db('daily_logs')
      .join('weekly_reviews', function() {
        this.on('weekly_reviews.attachment_id', '=', 'daily_logs.attachment_id')
            .andOn('daily_logs.log_date', '>=', 'weekly_reviews.week_start_date')
            .andOn('daily_logs.log_date', '<=', 'weekly_reviews.week_end_date');
      })
      .join('attachments', 'daily_logs.attachment_id', 'attachments.id')
      .join('students', 'attachments.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .select(
        'weekly_reviews.id as weekly_review_id',
        'weekly_reviews.week_number',
        'daily_logs.id as daily_log_id',
        'daily_logs.log_date',
        'daily_logs.status as log_status',
        'weekly_reviews.status as review_status',
        'users.name as student_name'
      )
      .orderBy('weekly_reviews.week_number')
      .orderBy('daily_logs.log_date');
    console.table(logsByWeek);

    // Test 7: Get feedback with weekly reviews
    console.log('\n7. Industry and University Feedback:');
    const feedback = await db('weekly_reviews')
      .leftJoin('industry_feedback', 'weekly_reviews.id', 'industry_feedback.weekly_review_id')
      .leftJoin('uni_feedback', 'weekly_reviews.id', 'uni_feedback.weekly_review_id')
      .leftJoin('users as supervisors', 'uni_feedback.uni_supervisor_id', 'supervisors.id')
      .join('attachments', 'weekly_reviews.attachment_id', 'attachments.id')
      .join('students', 'attachments.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .select(
        'weekly_reviews.id',
        'weekly_reviews.week_number',
        'users.name as student_name',
        'industry_feedback.approval as industry_approval',
        'industry_feedback.comments as industry_comments',
        'uni_feedback.rating as uni_rating',
        'uni_feedback.comments as uni_comments',
        'supervisors.name as uni_supervisor'
      );
    console.table(feedback);

    console.log('\n✅ All queries executed successfully!');
    console.log('\n📊 Key Insight: Daily logs are grouped into weekly reviews by date ranges, not direct foreign keys.');
    console.log('This allows flexible weekly bundling while keeping daily logging simple for students.');

  } catch (error) {
    console.error('❌ Query Error:', error);
  } finally {
    await db.destroy();
  }
}

testQueries();

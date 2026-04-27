# Weekly Review Lifecycle Documentation

This document explains the complete weekly review lifecycle in the IAMS system.

## 🔄 Overview

The weekly review system is the core business logic that groups daily logs into weekly bundles for supervisor review. It implements a two-tier logging model where daily logs are atomic records and weekly reviews are time-bounded groupings.

## 📅 Lifecycle Stages

### Stage 1: Daily Log Creation
**Trigger**: Student submits daily logs throughout the week

**Process**:
- Students create daily logs with status 'draft'
- Logs can be edited while in 'draft' status
- Student submits log → status changes to 'submitted'
- Submitted logs cannot be edited

**API Endpoints**:
```http
POST /api/daily-logs           # Create daily log
PUT /api/daily-logs/:id       # Update draft log
PUT /api/daily-logs/:id/submit # Submit log
```

### Stage 2: Weekly Review Creation
**Trigger**: Automated (Friday 5 PM) or Manual (Admin)

**Process**:
1. **Identify Completed Weeks**: Find weeks where all daily logs are submitted
2. **Group by Date Range**: Group logs by Monday-Friday date ranges
3. **Create Weekly Review**: Generate review record for each week
4. **Generate Industry Token**: Create secure token for industry supervisor
5. **Send Email Notification**: Email industry supervisor with review link

**API Endpoints**:
```http
POST /api/weekly-reviews           # Manual creation
POST /api/weekly-reviews/automated # Automated creation
```

**Automation Logic**:
```javascript
// Group daily logs by week
const weeklyGroups = groupLogsByWeek(dailyLogs);

for (const [weekNumber, weekData] of Object.entries(weeklyGroups)) {
  // Check if week review already exists
  const existingReview = await db('weekly_reviews')
    .where({ attachment_id, week_number: parseInt(weekNumber) })
    .first();

  if (!existingReview) {
    // Create weekly review
    const review = await db('weekly_reviews').insert({
      attachment_id,
      week_number: parseInt(weekNumber),
      week_start_date: weekData.startDate,
      week_end_date: weekData.endDate,
      status: 'pending'
    }).returning('*');

    // Send industry supervisor email
    await sendWeeklyReviewRequest(review.id);
  }
}
```

### Stage 3: Industry Supervisor Review
**Trigger**: Industry supervisor clicks email link

**Process**:
1. **Token Validation**: Validate secure token from email
2. **Access Review Data**: View weekly review and daily logs
3. **Submit Feedback**: Provide approval, comments, improvements
4. **Token Expiration**: Mark token as used

**API Endpoints**:
```http
GET /api/industry/review/:token           # Get review details
GET /api/industry/review/:token/logs      # Get daily logs
POST /api/industry/review/:token/feedback # Submit feedback
```

**Security Features**:
- **64-character hex tokens** for secure access
- **One-time use** - tokens expire after submission
- **Time-limited access** - tokens expire after 7 days
- **Rate limiting** - 5 requests per 15 minutes

### Stage 4: University Supervisor Review
**Trigger**: University supervisor reviews industry feedback

**Process**:
1. **Review Industry Feedback**: View industry supervisor's comments
2. **Add University Feedback**: Provide own assessment
3. **Rating System**: Assign numerical rating (0-100)
4. **Complete Review**: Mark weekly review as complete

**API Endpoints**:
```http
POST /api/review/uni/:reviewId/feedback # Submit university feedback
GET /api/review/uni/:reviewId/feedback # Get existing feedback
```

### Stage 5: Review Completion
**Trigger**: Both industry and university feedback submitted

**Process**:
1. **Status Update**: Change weekly review status to 'complete'
2. **Notification**: Notify student of completion
3. **Archive**: Mark review as finalized
4. **Reporting**: Include in student reports

## 📊 Status Flow

```
Daily Logs:     draft → submitted
Weekly Reviews:  pending → industry_reviewed → uni_reviewed → complete
```

## 🧮 Week Calculation Logic

### Week Number Calculation
```javascript
function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const daysDiff = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000));
  return Math.ceil(daysDiff / 7);
}
```

### Week Date Range Calculation
```javascript
function getWeekStartDate(date) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function getWeekEndDate(date) {
  const startDate = getWeekStartDate(date);
  return new Date(startDate.setDate(startDate.getDate() + 6));
}
```

## 📧 Email Templates

### Industry Supervisor Review Request
**Subject**: `Weekly Review Request - Student Name - Week X`

**Content**:
- Student information (name, registration number)
- Organization details
- Week number and date range
- Daily logs summary table
- Secure review link with token

### Feedback Confirmation
**Subject**: `Feedback Confirmation - Student Name - Week X`

**Content**:
- Review of submitted feedback
- Decision (approved/rejected)
- Confirmation of university supervisor notification

## 🔐 Security Considerations

### Token Security
- **Generation**: Cryptographically secure random bytes
- **Storage**: Hashed in database
- **Validation**: Format and existence checks
- **Expiration**: Automatic invalidation after use

### Access Control
- **Industry Supervisors**: Token-based, no user accounts
- **University Supervisors**: Role-based access to assigned students
- **Students**: Access to own daily logs only
- **Admins**: Full system access

### Data Integrity
- **Referential Constraints**: Foreign keys ensure data consistency
- **Status Validation**: Proper state transitions
- **Date Validation**: Prevents future logs and invalid date ranges
- **Duplicate Prevention**: Unique constraints on key fields

## 📈 Analytics & Monitoring

### Key Metrics
- **Daily Log Submission Rate**: % of logs submitted on time
- **Weekly Review Completion Rate**: % of reviews completed
- **Industry Feedback Response Time**: Average time to industry feedback
- **University Feedback Response Time**: Average time to university feedback
- **Student Engagement**: Active students vs total students

### Automated Monitoring
```javascript
// Weekly review creation metrics
const weeklyReviewsCreated = await db('weekly_reviews')
  .where('created_at', '>=', startDate)
  .count('* as count');

// Industry feedback metrics
const industryFeedbackStats = await db('industry_feedback')
  .where('submitted_at', '>=', startDate)
  .select(
    db.raw('COUNT(*) as total'),
    db.raw('COUNT(CASE WHEN approval = "approved" THEN 1 END) as approved'),
    db.raw('COUNT(CASE WHEN approval = "rejected" THEN 1 END) as rejected')
  );
```

## 🚀 Performance Optimizations

### Database Indexes
```sql
-- Daily logs indexes
CREATE INDEX idx_daily_logs_attachment_date ON daily_logs(attachment_id, log_date);
CREATE INDEX idx_daily_logs_status ON daily_logs(status);

-- Weekly reviews indexes
CREATE INDEX idx_weekly_reviews_attachment_week ON weekly_reviews(attachment_id, week_number);
CREATE INDEX idx_weekly_reviews_status ON weekly_reviews(status);

-- Industry feedback indexes
CREATE INDEX idx_industry_feedback_token ON industry_feedback(verification_token);
CREATE INDEX idx_industry_feedback_weekly_review ON industry_feedback(weekly_review_id);
```

### Query Optimization
- Use **JOIN** instead of multiple queries
- Implement **pagination** for large datasets
- Use **indexes** for frequent queries
- Cache **frequently accessed data** (user roles, permissions)

## 🔄 Error Handling

### Common Scenarios
1. **No Daily Logs for Week**: Skip weekly review creation
2. **Industry Supervisor Unresponsive**: Send reminder after 3 days
3. **Missing Industry Feedback**: Escalate to university supervisor
4. **Token Already Used**: Return appropriate error message
5. **Invalid Date Range**: Validate and return error

### Recovery Procedures
1. **Failed Email Sending**: Retry mechanism with exponential backoff
2. **Database Transaction Failure**: Rollback and log error
3. **Token Generation Failure**: Generate new token and retry
4. **Status Update Failure**: Manual intervention required

---

*This weekly review lifecycle ensures proper workflow management while maintaining security and data integrity throughout the process.*

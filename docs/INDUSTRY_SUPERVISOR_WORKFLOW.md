# Industry Supervisor Workflow

This document explains how industry supervisors interact with the IAMS system through email-based verification tokens.

## 📧 Overview

Industry supervisors don't have user accounts in the system. Instead, they receive weekly emails with secure links to review student logs and provide feedback.

## 🔄 Workflow Process

### 1. Weekly Review Request (Automated)

**When**: Every Friday at 5:00 PM (Africa/Nairobi timezone)

**What happens**:
- System identifies completed weekly reviews that need industry feedback
- Generates secure verification tokens
- Sends emails to industry supervisors with review links

**Email Content**:
- Student information (name, registration number)
- Organization details
- Week number and date range
- Summary of daily logs for that week
- Secure review link with token

### 2. Industry Supervisor Access

**Authentication**: Token-based via URL parameter or header

**Access Methods**:
```
GET /api/industry/review/:token
Header: X-Industry-Token: <token>
```

**Security Features**:
- 64-character hex tokens
- One-time use (token expires after submission)
- Automatic expiry after 7 days
- IP-based rate limiting

### 3. Review Process

**Step 1**: Access review details
```bash
GET /api/industry/review/{token}
```

**Response**:
```json
{
  "success": true,
  "review": {
    "weeklyReviewId": 1,
    "weekNumber": 1,
    "weekStart": "2024-01-08",
    "weekEnd": "2024-01-12",
    "student": {
      "name": "Alice Kimani",
      "regNumber": "SCS/2021/001"
    },
    "organization": "Tech Solutions Kenya",
    "supervisor": {
      "name": "James Mwangi",
      "email": "j.mwangi@techsolutions.co.ke"
    }
  }
}
```

**Step 2**: View daily logs for the week
```bash
GET /api/industry/review/{token}/logs
```

**Response**:
```json
{
  "success": true,
  "logs": [
    {
      "id": 1,
      "log_date": "2024-01-08",
      "tasks_performed": "Worked on web application development...",
      "skills_acquired": "Improved JavaScript skills...",
      "observations": "Good progress on project...",
      "status": "submitted"
    }
  ]
}
```

**Step 3**: Submit feedback
```bash
POST /api/industry/review/{token}/feedback
Content-Type: application/json

{
  "approval": "approved",
  "comments": "Excellent progress in web development...",
  "improvements": "Focus on advanced CSS techniques..."
}
```

**Response**:
```json
{
  "success": true,
  "message": "Feedback submitted successfully"
}
```

### 4. Confirmation Email

After feedback submission:
- Confirmation email sent to industry supervisor
- Weekly review status updated to "industry_reviewed"
- University supervisor notified for final review

## 🔐 Security Measures

### Token Security
- **Generation**: Cryptographically secure random 64-character hex strings
- **Storage**: Hashed in database with salt
- **Validation**: Format validation and existence checks
- **Expiry**: Automatic invalidation after submission

### Rate Limiting
- **General**: 100 requests per 15 minutes per IP
- **Strict**: 5 requests per 15 minutes for sensitive operations
- **Auth**: 10 login attempts per 15 minutes per IP

### Access Control
- Token-based authentication (no passwords required)
- Single-use tokens (expire after submission)
- IP-based request tracking
- Request size limitations (10MB max)

## 📅 Scheduling

### Automated Tasks
```javascript
// Weekly review requests - Every Friday 5 PM
cron.schedule('0 17 * * 5', processWeeklyReviews);

// Daily log reminders - Weekdays 9 AM
cron.schedule('0 9 * * 1-5', sendDailyLogReminders);
```

### Manual Trigger
Admin can manually trigger weekly review requests:
```bash
POST /api/admin/send-weekly-reviews
Authorization: Bearer <admin-token>
```

## 🛠️ Implementation Details

### Database Schema
```sql
industry_feedback (
  id SERIAL PRIMARY KEY,
  weekly_review_id INTEGER REFERENCES weekly_reviews(id),
  verification_token VARCHAR(64) UNIQUE NOT NULL,
  comments TEXT,
  improvements TEXT,
  approval VARCHAR(20) CHECK (approval IN ('approved', 'rejected')),
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Token Generation
```javascript
const crypto = require('crypto');
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};
```

### Email Templates
- Professional HTML emails with responsive design
- Include student details and organization information
- Daily logs summary in table format
- Clear call-to-action buttons
- Security warnings and contact information

## 🎯 Benefits

### For Industry Supervisors
- **No account creation required** - reduces friction
- **Email-based workflow** - familiar and accessible
- **Secure token system** - no password management
- **Mobile-friendly** - works on any device

### For Students
- **Regular feedback** - weekly reviews ensure continuous assessment
- **Professional documentation** - industry-validated experience
- **Career development** - structured skill tracking

### For University
- **Automated process** - reduces administrative overhead
- **Quality assurance** - industry-verified assessments
- **Compliance tracking** - complete audit trail

## 🔄 Future Enhancements

1. **SMS Notifications** - Backup communication channel
2. **Bulk Review** - Handle multiple students efficiently
3. **Template System** - Customizable feedback templates
4. **Analytics Dashboard** - Industry supervisor insights
5. **Mobile App** - Native mobile experience

## 📞 Support

For industry supervisors needing assistance:
- Technical support: support@iams.edu
- Process questions: admin@iams.edu
- Emergency contact: +254-XXX-XXXXXXX

---

*This workflow ensures industry supervisors can easily provide valuable feedback while maintaining security and reducing administrative burden.*

# Frontend Column Mapping Standardization

This document provides a standardized mapping of database table columns for frontend integration. Use these consistent naming conventions across your frontend components.

## Table: `users`

| Database Column | Frontend Field Name | Data Type | Description |
|----------------|-------------------|-----------|-------------|
| id | userId | number | Primary key |
| name | userName | string | User's full name |
| email | userEmail | string | User's email address |
| password_hash | - | string | **Backend only** - never expose to frontend |
| role | userRole | enum | 'student', 'uni_supervisor', 'admin' |
| created_at | createdAt | datetime | Record creation timestamp |
| updated_at | updatedAt | datetime | Last update timestamp |

## Table: `students`

| Database Column | Frontend Field Name | Data Type | Description |
|----------------|-------------------|-----------|-------------|
| id | studentId | number | Primary key |
| user_id | userId | number | Foreign key to users table |
| reg_number | registrationNumber | string | Student registration number |
| program | program | string | Academic program name |
| year_of_study | yearOfStudy | number | Current year of study |
| uni_supervisor_id | supervisorId | number | Foreign key to users table (uni supervisor) |
| created_at | createdAt | datetime | Record creation timestamp |
| updated_at | updatedAt | datetime | Last update timestamp |

## Table: `attachments`

| Database Column | Frontend Field Name | Data Type | Description |
|----------------|-------------------|-----------|-------------|
| id | attachmentId | number | Primary key |
| student_id | studentId | number | Foreign key to students table |
| organization_name | organizationName | string | Company/organization name |
| industry_supervisor_name | industrySupervisorName | string | Industry supervisor's name |
| industry_supervisor_email | industrySupervisorEmail | string | Industry supervisor's email |
| start_date | startDate | date | Internship start date |
| end_date | endDate | date | Internship end date |
| status | status | enum | 'pending', 'active', 'completed' |
| created_at | createdAt | datetime | Record creation timestamp |
| updated_at | updatedAt | datetime | Last update timestamp |

## Table: `daily_logs`

| Database Column | Frontend Field Name | Data Type | Description |
|----------------|-------------------|-----------|-------------|
| id | logId | number | Primary key |
| attachment_id | attachmentId | number | Foreign key to attachments table |
| log_date | logDate | date | Date of the log entry |
| tasks_performed | tasksPerformed | text | Tasks completed during the day |
| skills_acquired | skillsAcquired | text | Skills learned/developed |
| observations | observations | text | General observations/notes |
| status | status | enum | 'draft', 'submitted' |
| submitted_at | submittedAt | datetime | Submission timestamp (null until submitted) |
| created_at | createdAt | datetime | Record creation timestamp |
| updated_at | updatedAt | datetime | Last update timestamp |

## Table: `weekly_reviews`

| Database Column | Frontend Field Name | Data Type | Description |
|----------------|-------------------|-----------|-------------|
| id | reviewId | number | Primary key |
| attachment_id | attachmentId | number | Foreign key to attachments table |
| week_number | weekNumber | number | Week number in the internship |
| week_start_date | weekStartDate | date | Start date of the week |
| week_end_date | weekEndDate | date | End date of the week |
| status | status | enum | 'pending', 'industry_reviewed', 'uni_reviewed', 'complete' |
| created_at | createdAt | datetime | Record creation timestamp |
| updated_at | updatedAt | datetime | Last update timestamp |

## Table: `industry_feedback`

| Database Column | Frontend Field Name | Data Type | Description |
|----------------|-------------------|-----------|-------------|
| id | feedbackId | number | Primary key |
| weekly_review_id | weeklyReviewId | number | Foreign key to weekly_reviews table |
| verification_token | verificationToken | string | Token for industry supervisor verification |
| comments | comments | text | Industry supervisor comments |
| improvements | improvements | text | Suggested improvements |
| approval | approval | enum | 'approved', 'rejected' (null until submitted) |
| submitted_at | submittedAt | datetime | Submission timestamp (null until submitted) |
| created_at | createdAt | datetime | Record creation timestamp |
| updated_at | updatedAt | datetime | Last update timestamp |

## Table: `uni_feedback`

| Database Column | Frontend Field Name | Data Type | Description |
|----------------|-------------------|-----------|-------------|
| id | feedbackId | number | Primary key |
| weekly_review_id | weeklyReviewId | number | Foreign key to weekly_reviews table |
| uni_supervisor_id | supervisorId | number | Foreign key to users table |
| comments | comments | text | University supervisor comments |
| improvements | improvements | text | Suggested improvements |
| rating | rating | number | Performance rating (1-5 scale) |
| created_at | createdAt | datetime | Record creation timestamp |
| updated_at | updatedAt | datetime | Last update timestamp |

## Table: `reports`

| Database Column | Frontend Field Name | Data Type | Description |
|----------------|-------------------|-----------|-------------|
| id | reportId | number | Primary key |
| generated_by | generatedBy | number | Foreign key to users table |
| type | reportType | string | Type of report generated |
| parameters | parameters | JSON | Report generation parameters |
| file_path | filePath | string | Path to generated report file |
| created_at | createdAt | datetime | Report generation timestamp |

## Table: `refresh_tokens`

| Database Column | Frontend Field Name | Data Type | Description |
|----------------|-------------------|-----------|-------------|
| id | tokenId | number | Primary key |
| user_id | userId | UUID | Foreign key to users table |
| token | token | string | Refresh token value |
| expires_at | expiresAt | datetime | Token expiration time |
| is_revoked | isRevoked | boolean | Token revocation status |
| created_at | createdAt | datetime | Token creation timestamp |
| updated_at | updatedAt | datetime | Last update timestamp |

## Frontend Naming Conventions

### General Rules
- Use **camelCase** for all frontend field names
- Use descriptive, human-readable names
- Avoid abbreviations unless commonly understood
- Keep names consistent across components

### Foreign Key References
- Foreign keys should use the target table's primary key name (e.g., `userId`, `studentId`, `attachmentId`)
- For display purposes, you may include the related object's name (e.g., `userName`, `studentName`)

### Timestamp Fields
- Use `createdAt` for creation timestamps
- Use `updatedAt` for update timestamps
- Use descriptive names for specific timestamps (e.g., `submittedAt`, `expiresAt`)

### Enum Fields
- Keep the same enum values as the database
- Use lowercase with underscores for consistency with backend

### Text vs String
- Use `text` for longer content fields (tasks, comments, observations)
- Use `string` for shorter fields (names, emails, status)

## API Response Format Recommendations

When returning data to the frontend, use the following structure:

```javascript
{
  success: true,
  data: {
    // Use frontend field names here
    userId: 1,
    userName: "John Doe",
    userEmail: "john@example.com",
    userRole: "student",
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-01T00:00:00Z"
  },
  message: "Operation successful"
}
```

## Example Frontend Component Usage

```javascript
// React component example
const UserProfile = ({ user }) => {
  return (
    <div>
      <h2>{user.userName}</h2>
      <p>Email: {user.userEmail}</p>
      <p>Role: {user.userRole}</p>
      <p>Member since: {new Date(user.createdAt).toLocaleDateString()}</p>
    </div>
  );
};
```

This standardized mapping ensures consistency across your frontend application and makes API integration more predictable and maintainable.

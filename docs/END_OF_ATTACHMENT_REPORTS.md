# End of Attachment Reports Feature

## Overview
This feature allows students to submit their end-of-attachment reports either as PDF files or as written text content directly in the application. The reports can then be reviewed and approved/rejected by administrators and university supervisors.

## Database Schema

### Table: `end_of_attachment_reports`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| attachment_id | UUID | Foreign key to attachments table |
| student_id | UUID | Foreign key to students table |
| submission_type | ENUM | 'pdf' or 'text' |
| text_content | TEXT | Report content (for text submissions) |
| pdf_file_path | STRING | File path (for PDF submissions) |
| pdf_filename | STRING | Original filename (for PDF submissions) |
| status | ENUM | 'submitted', 'under_review', 'approved', 'rejected' |
| feedback_comments | TEXT | Reviewer feedback |
| reviewed_by | UUID | Foreign key to users table (reviewer) |
| reviewed_at | TIMESTAMP | When the report was reviewed |
| submitted_at | TIMESTAMP | When the report was submitted |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

## API Endpoints

### Student Endpoints

#### Submit Text Report
```
POST /api/end-of-attachment-reports/text
Authorization: Student token
Content-Type: application/json

Body:
{
  "attachment_id": "uuid",
  "text_content": "Report content (min 100 characters)"
}
```

#### Submit PDF Report
```
POST /api/end-of-attachment-reports/pdf
Authorization: Student token
Content-Type: multipart/form-data

Body:
- attachment_id: "uuid" (form field)
- pdf_report: file (PDF file, max 10MB)
```

#### Get Student's Reports
```
GET /api/end-of-attachment-reports/my-reports
Authorization: Student token
```

#### Download PDF Report
```
GET /api/end-of-attachment-reports/:id/download
Authorization: Student token
```

### Staff Endpoints (Admin/University Supervisor)

#### Get All Reports
```
GET /api/end-of-attachment-reports?page=1&limit=20&status=submitted&submission_type=pdf&search=student
Authorization: Admin/Uni Supervisor token
```

Query Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: Filter by status ('submitted', 'under_review', 'approved', 'rejected')
- `submission_type`: Filter by type ('pdf', 'text')
- `search`: Search by student name, registration number, or organization

#### Get Report by ID
```
GET /api/end-of-attachment-reports/:id
Authorization: Admin/Uni Supervisor token
```

#### Review Report
```
PUT /api/end-of-attachment-reports/:id/review
Authorization: Admin/Uni Supervisor token
Content-Type: application/json

Body:
{
  "status": "approved" | "rejected",
  "feedback_comments": "Optional feedback"
}
```

#### Download PDF Report
```
GET /api/end-of-attachment-reports/:id/download
Authorization: Admin/Uni Supervisor token
```

## Business Rules

1. **Submission Eligibility**: Students can only submit reports for attachments with status 'active' or 'completed'
2. **One Report Per Attachment**: Each attachment can only have one end-of-attachment report
3. **File Upload**: PDF files only, maximum size 10MB
4. **Text Content**: Minimum 100 characters required for text submissions
5. **Review Process**: Reports can be reviewed by admins and university supervisors
6. **Status Flow**: submitted → under_review → approved/rejected

## File Storage

- PDF files are stored in `/uploads/reports/` directory
- Filenames are generated with timestamp and random suffix to avoid conflicts
- Example filename: `end-of-attachment-1646789123456-123456789.pdf`

## Error Handling

Common error responses:

```json
{
  "success": false,
  "message": "Report already submitted for this attachment"
}
```

```json
{
  "success": false,
  "message": "Attachment not found or not eligible for report submission"
}
```

```json
{
  "success": false,
  "message": "Only PDF files are allowed"
}
```

```json
{
  "success": false,
  "message": "File size too large. Maximum size is 10MB"
}
```

## Security Considerations

1. **Authentication**: All endpoints require valid authentication tokens
2. **Authorization**: Role-based access control (student vs staff)
3. **File Upload**: PDF-only restriction and size limits
4. **Data Validation**: Input validation for all fields
5. **Access Control**: Students can only access their own reports

## Integration Points

1. **Attachment System**: Links to existing attachment records
2. **User Management**: Uses existing user authentication and roles
3. **File Storage**: Integrates with local file system for PDF storage
4. **Notification System**: Can be extended to send email notifications

## Future Enhancements

1. **Email Notifications**: Send notifications when reports are submitted/reviewed
2. **Report Templates**: Provide templates for text submissions
3. **Batch Operations**: Allow bulk review operations for supervisors
4. **Analytics**: Generate reports on submission statistics
5. **Cloud Storage**: Integration with cloud storage services for PDF files

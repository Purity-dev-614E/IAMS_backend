# Email Testing With Postman

Base URL:

```text
http://localhost:3000
```

Required `.env` values:

```env
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=onboarding@resend.dev
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

After changing `.env` or pulling these endpoint changes, restart the backend:

```powershell
npm run dev
```

## 1. Health Check

```http
GET http://localhost:3000/health
```

Expected response:

```json
{
  "status": "OK",
  "message": "Server is running"
}
```

## 2. Login As Admin

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json
```

Body:

```json
{
  "email": "admin@iams.edu",
  "password": "admin123"
}
```

Copy the `token` value from the response.

## 3. Send Standalone Test Email

This endpoint only tests Resend/email configuration. It does not create weekly reviews or industry feedback records.

```http
POST http://localhost:3000/api/admin/test-email
Content-Type: application/json
Authorization: Bearer <admin-token>
```

Body:

```json
{
  "to": "your-email@example.com",
  "subject": "IAMS Postman email test",
  "message": "This email was sent from the IAMS backend via Postman."
}
```

Expected success:

```json
{
  "success": true,
  "message": "Test email sent successfully"
}
```

## 4. Trigger Real Weekly Review Email

This uses the production weekly review flow and writes an `industry_feedback` token record.

```http
POST http://localhost:3000/api/weekly-reviews
Content-Type: application/json
Authorization: Bearer <admin-token>
```

Body example:

```json
{
  "attachment_id": "replace-with-attachment-id",
  "week_number": 99,
  "week_start_date": "2026-05-18",
  "week_end_date": "2026-05-22"
}
```

Use a `week_number` that does not already exist for the attachment, or the API will return a conflict.

## 5. Terminal Logs

After restarting, each request should print logs like:

```text
[REQUEST] 2026-05-22T... - POST /api/admin/test-email - IP: ...
[REQUEST BODY] { ... }
[EMAIL SENT] Test Email
[RESPONSE] 2026-05-22T... - POST /api/admin/test-email - OK 200 - 1234ms
```

If you still do not see logs, check that you are watching the terminal running `npm run dev`. If the server was started from another terminal, VS Code task, or background process, the logs will appear there instead.

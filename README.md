# IAMS Backend

Backend API for the Industrial Attachment Management System (IAMS). It manages users, students, attachments, daily logs, weekly reviews, supervisor feedback, dashboards, reports, and end-of-attachment reports.

## Tech Stack

- Node.js 20+
- Express 5
- PostgreSQL
- Knex.js migrations and seeds
- JWT authentication
- Google sign-in support
- Role-based access control
- Nodemailer/Gmail and Resend email support
- Multer file uploads

## Project Structure

```text
.
+-- index.js                         # Server entry point and scheduler startup
+-- knexfile.js                      # Knex database configuration
+-- src
|   +-- app.js                       # Express app, middleware, and route mounting
|   +-- controllers                  # Request handlers
|   +-- database
|   |   +-- connection.js            # Knex connection
|   |   +-- migrations               # Database schema migrations
|   |   +-- seeds                    # Seed data
|   +-- middleware                   # Auth, RBAC, validation, security, uploads
|   +-- routes                       # API route definitions
|   +-- services                     # Email and scheduler services
|   +-- utils                        # Shared helpers
+-- docs                             # Detailed API and workflow documentation
+-- reports                          # Generated report output
+-- uploads                          # Uploaded report files
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Update the values for your local or hosted environment:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=change-this-to-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Optional email provider settings
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=IAMS <noreply@iams.edu>
```

The email service can use Gmail credentials, Resend, or both. If both are configured, the service can fall back to the second provider when the preferred provider fails.

### 3. Run database migrations

```bash
npm run migrate
```

### 4. Seed test data

```bash
npm run seed
```

### 5. Start the server

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

The server listens on `http://localhost:3000` by default.

## Smoke Checks

After starting the server, verify the app and database:

```http
GET http://localhost:3000/health
GET http://localhost:3000/test-db
```

## Available Scripts

```bash
npm start              # Start the server with Node
npm run dev            # Start the server with Nodemon
npm run migrate        # Run latest database migrations
npm run migrate:rollback
npm run migrate:make   # Create a new migration
npm run seed           # Run database seeds
npm run seed:make      # Create a new seed file
```

## Main API Areas

All application routes are mounted under `/api` unless noted otherwise.

| Area | Base Route | Notes |
| --- | --- | --- |
| Auth | `/api/auth` | Register, login, Google login, refresh token, profile, logout |
| Users | `/api/users` | Admin user management and supervisor approval |
| Students | `/api/students` | Student records, supervisor assignment, student profile |
| Attachments | `/api/attachments` | Attachment placement records and statuses |
| Daily Logs | `/api/daily-logs` | Student daily log creation, submission, and staff review |
| Weekly Reviews | `/api/weekly-reviews` | Weekly review creation, status updates, university feedback |
| Dashboard | `/api/dashboard` | Role-based dashboard data |
| Reports | `/api/reports` and `/api/admin/reports` | Admin, student, cohort, and weekly review reports |
| End-of-Attachment Reports | `/api/end-of-attachment-reports` | Text/PDF final reports and staff review |
| Industry Review | `/api/industry/review/:token` | Token-based industry supervisor review flow |
| Health | `/health` | Public health check |
| Database Test | `/test-db` | Public database connectivity check |

Authenticated routes expect:

```http
Authorization: Bearer <access-token>
```

## Roles

The backend uses role-based access control for:

- `admin`: system administration, user management, reports, approval workflows
- `uni_supervisor`: assigned student oversight, daily logs, weekly reviews, feedback
- `student`: own attachments, daily logs, weekly reviews, final reports
- Industry supervisors: token-based access through review links, without a normal user login

## Email and Scheduler

`index.js` starts the scheduler service when the server starts. Email features are used for:

- Weekly review requests to industry supervisors
- Notifications to university supervisors
- Daily log reminders
- Industry feedback confirmations
- Admin test emails

For Resend-specific setup, see [README_RESEND_SETUP.md](README_RESEND_SETUP.md).

## Documentation

Useful docs live in the `docs/` directory:

- [API documentation](docs/API_DOCUMENTATION.md)
- [Authentication guide](docs/AUTHENTICATION.md)
- [Middleware guide](docs/MIDDLEWARE_GUIDE.md)
- [Data persistence notes](docs/DATA_PERSISTENCE.md)
- [Email testing guide](docs/EMAIL_TESTING_POSTMAN.md)
- [Weekly review lifecycle](docs/WEEKLY_REVIEW_LIFECYCLE.md)
- [Industry supervisor workflow](docs/INDUSTRY_SUPERVISOR_WORKFLOW.md)

## Deployment Notes

- Set `NODE_ENV=production`.
- Use a production PostgreSQL database URL in `DATABASE_URL`.
- Set a strong `JWT_SECRET`.
- Configure `ALLOWED_ORIGINS` with the deployed frontend domains.
- Configure at least one email provider if review emails or reminders are required.
- Run migrations before serving production traffic.

## Test Accounts

Seed data may include test accounts such as:

```text
Admin:      admin@iams.edu / admin123
Supervisor: s.johnson@iams.edu / supervisor123
Student:    alice.kimani@student.iams.edu / student123
```

Use these only for local development or seeded test environments.

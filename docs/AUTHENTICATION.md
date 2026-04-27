# Authentication System Documentation

## Overview

The IAMS (Internship Attendance Management System) supports three user types with different authentication flows:

- **Students**: Self-service registration with immediate access
- **University Supervisors**: Self-service registration with admin approval required
- **Industry Supervisors**: Token-based access (no account required)
- **Admins**: Full system access

## User Registration

### Student Registration

**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john.doe@student.university.edu",
  "password": "securepassword123",
  "role": "student",
  "reg_number": "2023001",
  "program": "Computer Science",
  "year_of_study": 3
}
```

**Email Validation**:
- Must end with configured student email domain
- Default: `@student.university.edu`

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Student registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john.doe@student.university.edu",
    "role": "student",
    "status": "active"
  },
  "student": {
    "id": "uuid",
    "user_id": "uuid",
    "reg_number": "2023001",
    "program": "Computer Science",
    "year_of_study": 3
  }
}
```

### University Supervisor Registration

**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "name": "Dr. Jane Smith",
  "email": "jane.smith@university.edu",
  "password": "securepassword123",
  "role": "uni_supervisor"
}
```

**Email Validation**:
- Must end with configured supervisor email domain
- Default: `@university.edu`

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Supervisor registration submitted. Awaiting admin approval.",
  "user": {
    "id": "uuid",
    "name": "Dr. Jane Smith",
    "email": "jane.smith@university.edu",
    "role": "uni_supervisor",
    "status": "pending"
  }
}
```

**Note**: No token is provided until admin approval.

## User Login

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "email": "user@domain.edu",
  "password": "userpassword"
}
```

**Successful Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john.doe@university.edu",
    "role": "student",
    "status": "active"
  }
}
```

**Error Responses**:
- **401 Unauthorized**: Invalid credentials or account pending/rejected
- **404 Not Found**: User not found

## Supervisor Approval System

### Get Pending Supervisors

**Endpoint**: `GET /api/users/pending-supervisors`
**Authorization**: Admin only

**Response**:
```json
{
  "success": true,
  "supervisors": [
    {
      "id": "uuid",
      "name": "Dr. Jane Smith",
      "email": "jane.smith@university.edu",
      "created_at": "2026-03-31T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

### Approve Supervisor

**Endpoint**: `PUT /api/users/:id/approve`
**Authorization**: Admin only

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Supervisor approved successfully"
}
```

### Reject Supervisor

**Endpoint**: `PUT /api/users/:id/reject`
**Authorization**: Admin only

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Supervisor registration rejected"
}
```

## Industry Supervisor Access

Industry supervisors use a token-based system and don't create accounts:

**Authentication**: `X-Industry-Token` header or `?token=` query parameter

**Endpoints**:
- `GET /api/industry/review/:token` - View weekly review details
- `GET /api/industry/review/:token/logs` - View student daily logs
- `POST /api/industry/review/:token/feedback` - Submit feedback

## Configuration

Add these environment variables to `.env`:

```env
# Email Domain Configuration
STUDENT_EMAIL_DOMAIN=student.university.edu
SUPERVISOR_EMAIL_DOMAIN=university.edu
REQUIRE_EMAIL_VERIFICATION=true
```

## User Status Values

- `active`: User can login and access the system
- `pending`: Supervisor awaiting admin approval
- `rejected`: Supervisor registration rejected
- `inactive`: Account deactivated

## Role-Based Access Control

### Students
- Can view and manage their own daily logs
- Can view their attachments and weekly reviews
- Cannot access other students' data

### University Supervisors
- Can view assigned students' data
- Can provide feedback on weekly reviews
- Can view student progress reports

### Admins
- Full system access
- Can manage all users
- Can approve/reject supervisor registrations
- Can view system statistics

### Industry Supervisors
- Token-based access only
- Can view specific student data for feedback
- Cannot login to main system

## Security Features

1. **JWT Authentication**: 24-hour expiration
2. **Email Domain Validation**: Ensures users have institutional emails
3. **Role-Based Authorization**: Middleware protects routes
4. **Password Hashing**: bcrypt with 12 salt rounds
5. **Status-Based Access**: Pending/rejected users cannot login

## Database Schema

### Users Table
```sql
- id (primary key)
- name (string)
- email (unique)
- password_hash (string)
- role (enum: student, uni_supervisor, admin)
- status (enum: active, pending, rejected, inactive)
- created_at, updated_at
```

### Students Table
```sql
- id (primary key)
- user_id (foreign key to users)
- reg_number (unique)
- program (string)
- year_of_study (integer)
- uni_supervisor_id (foreign key to users, nullable)
- created_at, updated_at
```

## Error Handling

Common error responses:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email must end with @student.university.edu",
      "value": "invalid@email.com"
    }
  ]
}
```

## Migration

Run the database migration to add the status field:

```bash
npx knex migrate:latest
```

This will add the `status` column to the users table with appropriate indexes.

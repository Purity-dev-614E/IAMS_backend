# IAMS Backend API Documentation

## Overview

This document outlines the complete API endpoints for the Industrial Attachment Management System (IAMS) backend.

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this format:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ] // For validation errors
}
```

## Authentication Endpoints

### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "student" // optional: student, uni_supervisor, admin
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "student"
  }
}
```

### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "student"
  }
}
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Update Profile
```http
PUT /api/auth/profile
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Updated Name"
}
```

### Change Password
```http
PUT /api/auth/change-password
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

## User Management Endpoints (Admin Only)

### Get All Users
```http
GET /api/users?page=1&limit=20&role=student&search=john
Authorization: Bearer <admin-token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `role` (optional): Filter by role
- `search` (optional): Search by name or email

### Get User by ID
```http
GET /api/users/123
Authorization: Bearer <admin-token>
```

### Create User
```http
POST /api/users
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123",
  "role": "uni_supervisor"
}
```

### Update User
```http
PUT /api/users/123
Authorization: Bearer <admin-token>
```

### Delete User
```http
DELETE /api/users/123
Authorization: Bearer <admin-token>
```

## Student Management Endpoints

### Get All Students
```http
GET /api/students?page=1&limit=20&search=alice&program=Computer Science&year=3
Authorization: Bearer <staff-token>
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search by name, email, or reg number
- `program` (optional): Filter by program
- `year` (optional): Filter by year of study

### Get Student by ID
```http
GET /api/students/123
Authorization: Bearer <staff-token>
```

### Create Student
```http
POST /api/students
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "user_id": 5,
  "reg_number": "SCS/2021/001",
  "program": "Computer Science",
  "year_of_study": 3,
  "uni_supervisor_id": 2
}
```

### Update Student
```http
PUT /api/students/123
Authorization: Bearer <admin-token>
```

### Assign Supervisor
```http
PUT /api/students/123/assign-supervisor
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "uni_supervisor_id": 2
}
```

### Get Supervisor's Students
```http
GET /api/students/my-students
Authorization: Bearer <supervisor-token>
```

### Get Student Profile
```http
GET /api/students/profile/me
Authorization: Bearer <student-token>
```

## Industry Supervisor Endpoints (Token-Based)

### Get Review Details
```http
GET /api/industry/review/{token}
```
*No authentication required - uses token in URL*

### Get Daily Logs for Review
```http
GET /api/industry/review/{token}/logs
```

### Submit Industry Feedback
```http
POST /api/industry/review/{token}/feedback
```

**Request Body:**
```json
{
  "approval": "approved", // or "rejected"
  "comments": "Excellent progress...",
  "improvements": "Focus on advanced techniques..."
}
```

## Dashboard Endpoints

### Admin Dashboard
```http
GET /api/admin/dashboard
Authorization: Bearer <admin-token>
```

### Supervisor Dashboard
```http
GET /api/supervisor/students
Authorization: Bearer <supervisor-token>
```

### Student Dashboard
```http
GET /api/student/logs
Authorization: Bearer <student-token>
```

## Utility Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### Database Test
```http
GET /test-db
```

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Rate Limiting

- **General**: 100 requests per 15 minutes per IP
- **Authentication**: 10 requests per 15 minutes per IP
- **Strict**: 5 requests per 15 minutes per IP (sensitive operations)

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **RBAC**: Role-based access control
- **Input Validation**: All inputs validated and sanitized
- **Rate Limiting**: Protection against abuse
- **Security Headers**: CORS, CSP, XSS protection
- **Request Size Limits**: Maximum 10MB per request

## Pagination

List endpoints support pagination with these query parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response includes pagination metadata:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

## Search

Search endpoints support text search across multiple fields:
- Users: Search by name and email
- Students: Search by name, email, and registration number

## Environment Variables

Required environment variables:
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
NODE_ENV=development
PORT=3000
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=http://localhost:3000
```

## Testing

Use the provided seed data for testing:

**Admin:**
- Email: admin@iams.edu
- Password: admin123

**Supervisor:**
- Email: s.johnson@iams.edu
- Password: supervisor123

**Student:**
- Email: alice.kimani@student.iams.edu
- Password: student123

---

*This API documentation covers all implemented endpoints as of Phase 2 Week 2.*

# Middleware Guide

This document explains the middleware architecture and usage patterns for the IAMS backend.

## 🛡️ Security Middleware Stack

### 1. Authentication (`auth.js`)
- **Purpose**: JWT-based authentication
- **Usage**: `auth` middleware
- **Features**:
  - Token validation
  - User lookup from database
  - Token expiration handling
  - User context injection (`req.user`)

```javascript
app.get('/api/profile', auth, (req, res) => {
  // req.user contains: id, name, email, role
});
```

### 2. RBAC Authorization (`rbac.js`)
- **Purpose**: Role-based access control
- **Usage**: `authorize` helpers
- **Roles**: `admin`, `uni_supervisor`, `student`

```javascript
// Admin only
app.get('/api/admin/dashboard', auth, authorize.admin(), handler);

// Admin and supervisors
app.get('/api/staff/data', auth, authorize.staff(), handler);

// Self or admin access
app.get('/api/users/:id', auth, authorize.selfOrAdmin()(req => req.params.id), handler);
```

### 3. Input Validation (`validation.js`)
- **Purpose**: Request body and parameter validation
- **Usage**: `validators` middleware
- **Features**:
  - Joi schemas for complex validation
  - Express-validator chains
  - Detailed error messages

```javascript
app.post('/api/users', validators.registerUser, handler);
app.get('/api/users/:id', validators.idParam, handler);
```

### 4. Security Headers (`security.js`)
- **Purpose**: HTTP security headers and CORS
- **Features**:
  - Helmet for security headers
  - CORS configuration
  - Custom security headers
  - Request size limiting

### 5. Rate Limiting (`rateLimit.js`)
- **Purpose**: Prevent abuse and DDoS attacks
- **Types**:
  - `generalLimiter`: 100 requests/15min
  - `authLimiter`: 10 auth attempts/15min
  - `strictLimiter`: 5 requests/15min
  - `uploadLimiter`: 20 uploads/hour

### 6. Logging (`logger.js`)
- **Purpose**: Request/response logging
- **Features**:
  - Request timing
  - User context
  - Security event detection
  - Development mode body logging

### 7. Error Handling (`errorHandler.js`)
- **Purpose**: Centralized error handling
- **Features**:
  - Error classification
  - Development vs production responses
  - Async error wrapper
  - Database error handling

## 🚀 Usage Examples

### Protected Routes
```javascript
// Basic authentication
app.get('/api/profile', auth, profileHandler);

// Role-based access
app.get('/api/admin/users', auth, authorize.admin(), adminHandler);
app.get('/api/supervisor/students', auth, authorize.uniSupervisor(), supervisorHandler);
app.get('/api/student/logs', auth, authorize.student(), studentHandler);
```

### Validation
```javascript
// With validation
app.post('/api/daily-logs', 
  auth, 
  authorize.student(), 
  validators.dailyLog, 
  createLogHandler
);
```

### Error Handling
```javascript
// Async route with error handling
const asyncHandler = require('./middleware/errorHandler').asyncHandler;

app.get('/api/data', 
  auth, 
  asyncHandler(async (req, res) => {
    const data = await db('table').select('*');
    res.json({ success: true, data });
  })
);
```

## 🔒 Security Features

### 1. Authentication Flow
1. User sends credentials to `/api/auth/login`
2. Server validates and returns JWT
3. Client includes token in `Authorization: Bearer <token>` header
4. `auth` middleware validates token on protected routes

### 2. Authorization Levels
- **Admin**: Full system access
- **University Supervisor**: Access to assigned students
- **Student**: Access to own data only

### 3. Security Headers
- Content Security Policy
- XSS Protection
- Clickjacking Protection
- Strict Transport Security
- CORS configuration

### 4. Rate Limiting
- IP-based limiting
- Different limits per endpoint type
- Configurable windows and max requests

## 🛠️ Configuration

### Environment Variables
```bash
JWT_SECRET=your-secret-key
NODE_ENV=development
PORT=3000
```

### Custom Rate Limiting
```javascript
const customLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests'
});
```

### Custom RBAC Rules
```javascript
const customAuth = (allowedRoles) => {
  return (req, res, next) => {
    // Custom logic here
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }
    res.status(403).json({ message: 'Access denied' });
  };
};
```

## 📊 Monitoring

### Request Logging
All requests are logged with:
- Timestamp
- Method and URL
- IP address
- User information (if authenticated)
- Response time
- Status code

### Security Events
Suspicious patterns are logged:
- SQL injection attempts
- XSS attempts
- Directory traversal
- Unusual request patterns

## 🚨 Best Practices

1. **Always use authentication middleware before authorization**
2. **Validate all input data**
3. **Use asyncHandler for async routes**
4. **Implement proper error handling**
5. **Log security events**
6. **Use environment-specific configurations**
7. **Never expose sensitive information in responses**

## 🔄 Middleware Order

```javascript
app.use(helmet);                    // Security headers
app.use(cors);                      // CORS
app.use(requestSizeLimiter);         // Request size limits
app.use(generalLimiter);             // Rate limiting
app.use(securityLogger);             // Security logging
app.use(logger);                     // Request logging
app.use(express.json());             // Body parsing
app.use(auth);                       // Authentication
app.use(authorize.role());           // Authorization
app.use(validators.schema);          // Validation
app.use(errorHandler);                // Error handling (last)
```

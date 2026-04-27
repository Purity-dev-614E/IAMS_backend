const logger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  
  // Add user info if authenticated
  if (req.user) {
    console.log(`👤 User: ${req.user.name} (${req.user.email}) - Role: ${req.user.role}`);
  }
  
  // Log request body for POST/PUT requests (in development)
  if (process.env.NODE_ENV === 'development' && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
  }
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    
    // Color code status codes
    let statusEmoji = '✅';
    if (statusCode >= 400 && statusCode < 500) statusEmoji = '⚠️';
    if (statusCode >= 500) statusEmoji = '❌';
    
    console.log(`📤 ${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${statusEmoji} ${statusCode} - ${duration}ms`);
    
    // Log response body for errors in development
    if (process.env.NODE_ENV === 'development' && statusCode >= 400) {
      try {
        const responseBody = chunk ? JSON.parse(chunk) : {};
        console.log('📤 Response Body:', JSON.stringify(responseBody, null, 2));
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Security event logger
const securityLogger = (req, res, next) => {
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection attempts
    /javascript:/i,  // JavaScript protocol
    /data:/i   // Data protocol
  ];
  
  const checkSuspicious = (input) => {
    if (typeof input !== 'string') return false;
    return suspiciousPatterns.some(pattern => pattern.test(input));
  };
  
  // Check URL, query parameters, and body for suspicious patterns
  const isSuspicious = 
    checkSuspicious(req.originalUrl) ||
    checkSuspicious(JSON.stringify(req.query)) ||
    checkSuspicious(JSON.stringify(req.body));
  
  if (isSuspicious) {
    console.warn(`🚨 SECURITY ALERT - Suspicious request detected:`, {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      body: req.body,
      query: req.query,
      timestamp: new Date().toISOString(),
      user: req.user?.id || 'anonymous'
    });
  }
  
  next();
};

module.exports = { logger, securityLogger };

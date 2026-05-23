const logger = (req, res, next) => {
  const start = Date.now();
  let responseBody = null;

  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);

  if (req.user) {
    console.log(`👤 User: ${req.user.name} (${req.user.email}) - Role: ${req.user.role}`);
  }

  if (process.env.NODE_ENV === 'development' && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
  }

  const originalJson = res.json;
  res.json = function(body) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    let statusEmoji = '✅';
    if (statusCode >= 400 && statusCode < 500) statusEmoji = '⚠️';
    if (statusCode >= 500) statusEmoji = '❌';

    console.log(`📤 ${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${statusEmoji} ${statusCode} - ${duration}ms`);

    if (process.env.NODE_ENV === 'development' && statusCode >= 400 && responseBody) {
      console.log('📤 Response Body:', JSON.stringify(responseBody, null, 2));
    }
  });

  next();
};

const securityLogger = (req, res, next) => {
  const suspiciousPatterns = [
    /\.\./,
    /<script/i,
    /union.*select/i,
    /javascript:/i,
    /data:/i
  ];

  const checkSuspicious = (input) => {
    if (typeof input !== 'string') return false;
    return suspiciousPatterns.some(pattern => pattern.test(input));
  };

  const isSuspicious =
    checkSuspicious(req.originalUrl) ||
    checkSuspicious(JSON.stringify(req.query)) ||
    checkSuspicious(JSON.stringify(req.body));

  if (isSuspicious) {
    console.warn('🚨 SECURITY ALERT - Suspicious request detected:', {
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

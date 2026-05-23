const app = require('./src/app');
const schedulerService = require('./src/services/schedulerService');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔍 Test database connection: http://localhost:${PORT}/test-db`);
  console.log(`❤️ Health check: http://localhost:${PORT}/health`);
  console.log('⏰ Scheduler service: Starting...');
  console.log('Environment check:', {
    nodeEnv: process.env.NODE_ENV || 'not set',
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
    hasFrontendUrl: Boolean(process.env.FRONTEND_URL),
    hasAllowedOrigins: Boolean(process.env.ALLOWED_ORIGINS),
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID),
    hasGoogleClientSecret: Boolean(process.env.CLIENT_SECRET),
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
    hasGmailUser: Boolean(process.env.GMAIL_USER),
    hasGmailAppPassword: Boolean(process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS)
  });

  // Start the scheduler service
  schedulerService.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  schedulerService.stop();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  schedulerService.stop();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

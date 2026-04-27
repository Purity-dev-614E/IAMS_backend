const app = require('./src/app');
const schedulerService = require('./src/services/schedulerService');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test database connection: http://localhost:${PORT}/test-db`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Scheduler service: Starting...`);
  
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

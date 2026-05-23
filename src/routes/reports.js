const express = require('express');
const router = express.Router();

// Import controllers
const {
  getAdminReportsSummary,
  generateAdminReport,
  generateStudentReport,
  generateCohortReport,
  generateWeeklyReviewStatusReport,
  getReportById
} = require('../controllers/reportController');

// Import middleware
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(auth);

// Generate reports (admin and staff)
router.get('/summary', authorize.admin(), getAdminReportsSummary);
router.post('/generate', authorize.admin(), generateAdminReport);
router.post('/generate/student', authorize.staff(), generateStudentReport);
router.post('/generate/cohort', authorize.admin(), generateCohortReport);
router.post('/generate/weekly-review-status', authorize.staff(), generateWeeklyReviewStatusReport);

// Get report by ID (admin only)
router.get('/:id', authorize.admin(), getReportById);

module.exports = router;

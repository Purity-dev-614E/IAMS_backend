const express = require('express');
const router = express.Router();

// Import controllers
const {
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
router.post('/generate/student', authorize.staff(), generateStudentReport);
router.post('/generate/cohort', authorize.admin(), generateCohortReport);
router.post('/generate/weekly-review-status', authorize.staff(), generateWeeklyReviewStatusReport);

// Get report by ID (admin only)
router.get('/:id', authorize.admin(), getReportById);

module.exports = router;

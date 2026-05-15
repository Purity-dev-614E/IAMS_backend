const express = require('express');
const router = express.Router();

// Import controllers
const {
  getWeeklyReviewsByAttachment,
  getWeeklyReviewById,
  createWeeklyReview,
  createWeeklyReviewsAutomated,
  updateWeeklyReviewStatus,
  getStudentWeeklyReviews
} = require('../controllers/weeklyReviewController');

// Import middleware
const auth = require('../middleware/auth');
const { authorize, rbac } = require('../middleware/rbac');
const { validators } = require('../middleware/validation');

// Apply authentication to all routes
router.use(auth);

// Admin and Student routes
router.post('/', rbac(['admin', 'student']), validators.weeklyReview, createWeeklyReview);
router.post('/automated', rbac(['admin', 'student']), createWeeklyReviewsAutomated);
router.put('/:id/status', authorize.admin(), updateWeeklyReviewStatus);

// Student routes (must come before /:id to avoid route conflicts)
router.get('/my-reviews', authorize.student(), getStudentWeeklyReviews);

// Staff and Student routes
router.get('/attachment/:attachmentId', rbac(['admin', 'uni_supervisor', 'student']), getWeeklyReviewsByAttachment);
router.get('/:id', rbac(['admin', 'uni_supervisor', 'student']), getWeeklyReviewById);

module.exports = router;

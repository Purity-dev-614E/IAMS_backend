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
const { authorize } = require('../middleware/rbac');
const { validators } = require('../middleware/validation');

// Apply authentication to all routes
router.use(auth);

// Admin only routes
router.post('/', authorize.admin(), validators.weeklyReview, createWeeklyReview);
router.post('/automated', authorize.admin(), createWeeklyReviewsAutomated);
router.put('/:id/status', authorize.admin(), updateWeeklyReviewStatus);

// Staff routes (admin + uni_supervisor)
router.get('/attachment/:attachmentId', authorize.staff(), getWeeklyReviewsByAttachment);
router.get('/:id', authorize.staff(), getWeeklyReviewById);

// Student routes
router.get('/my-reviews', authorize.student(), getStudentWeeklyReviews);

module.exports = router;

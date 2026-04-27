const express = require('express');
const router = express.Router();

// Import controllers
const {
  getDailyLogsByAttachment,
  getDailyLogById,
  createDailyLog,
  updateDailyLog,
  submitDailyLog,
  deleteDailyLog,
  getStudentDailyLogs,
  getDailyLogsForWeeklyReview
} = require('../controllers/dailyLogController');

// Import middleware
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validators } = require('../middleware/validation');

// Apply authentication to all routes
router.use(auth);

// Student routes
router.post('/', authorize.student(), validators.dailyLog, createDailyLog);
router.get('/my-logs', authorize.student(), getStudentDailyLogs);

// Staff routes (admin + uni_supervisor)
router.get('/attachment/:attachmentId', authorize.staff(), getDailyLogsByAttachment);
router.get('/weekly-review/:weeklyReviewId', authorize.staff(), getDailyLogsForWeeklyReview);

// Individual log operations
router.get('/:id', getDailyLogById);
router.put('/:id', updateDailyLog);
router.put('/:id/submit', authorize.student(), submitDailyLog);
router.delete('/:id', deleteDailyLog);

module.exports = router;

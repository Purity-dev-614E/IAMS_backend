const express = require('express');
const router = express.Router();

// Import controllers
const {
  submitTextReport,
  submitPDFReport,
  getStudentReports,
  getAllReports,
  getReportById,
  reviewReport,
  downloadPDFReport
} = require('../controllers/endOfAttachmentReportController');

// Import middleware
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validators } = require('../middleware/validation');
const { uploadPDFReport, handleUploadError } = require('../middleware/fileUpload');

// Apply authentication to all routes
router.use(auth);

// Student routes
router.post('/text', authorize.student(), validators.endOfAttachmentTextReport, submitTextReport);
router.post('/pdf', authorize.student(), validators.endOfAttachmentPDFReport, uploadPDFReport, handleUploadError, submitPDFReport);
router.get('/my-reports', authorize.student(), getStudentReports);
router.get('/:id/download', authorize.student(), downloadPDFReport);

// Staff routes (admin + uni_supervisor)
router.get('/', authorize.staff(), getAllReports);
router.get('/:id', authorize.staff(), getReportById);
router.put('/:id/review', authorize.staff(), validators.reviewReport, reviewReport);
router.get('/:id/download', authorize.staff(), downloadPDFReport);

module.exports = router;

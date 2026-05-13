const express = require('express');
const router = express.Router();

// Import controllers
const {
  getAllAttachments,
  getAttachmentById,
  createAttachment,
  updateAttachment,
  updateAttachmentStatus,
  getStudentAttachments,
  deleteAttachment
} = require('../controllers/attachmentController');

// Import middleware
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validators } = require('../middleware/validation');

// Apply authentication to all routes
router.use(auth);

// Student routes (specific routes first)
router.post('/', authorize.student(), validators.attachment, createAttachment);
router.get('/my-attachments', authorize.student(), getStudentAttachments);

// Staff routes (admin + uni_supervisor)
router.get('/', authorize.staff(), getAllAttachments);
router.get('/:id', authorize.staff(), getAttachmentById);
router.put('/:id', authorize.admin(), updateAttachment);
router.put('/:id/status', authorize.admin(), updateAttachmentStatus);
router.delete('/:id', authorize.admin(), deleteAttachment);

module.exports = router;

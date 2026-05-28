const express = require('express');
const router = express.Router();

const {
  getAttachmentColleges,
  getMyEligibility,
  requestEligibilityReview,
  getEligibilityReviews,
  updateEligibilityReview
} = require('../controllers/attachmentEligibilityController');

const auth = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/colleges', getAttachmentColleges);

router.use(auth);

router.get('/me', authorize.student(), getMyEligibility);
router.post('/reviews', authorize.student(), requestEligibilityReview);

router.get('/admin/reviews', authorize.admin(), getEligibilityReviews);
router.put('/admin/reviews/:id', authorize.admin(), updateEligibilityReview);

module.exports = router;

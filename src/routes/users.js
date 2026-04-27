const express = require('express');
const router = express.Router();

// Import controllers
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUsersByRole,
  approveSupervisor,
  rejectSupervisor,
  getPendingSupervisors
} = require('../controllers/userController');

// Import middleware
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validators } = require('../middleware/validation');

// Apply authentication to all routes
router.use(auth);

// Admin only routes
router.post('/', authorize.admin(), validators.registerUser, createUser);
router.get('/', authorize.admin(), getAllUsers);
router.get('/role/:role', authorize.admin(), getUsersByRole);
router.get('/pending-supervisors', authorize.admin(), getPendingSupervisors);
router.put('/:id', authorize.admin(), updateUser);
router.put('/:id/approve', authorize.admin(), approveSupervisor);
router.put('/:id/reject', authorize.admin(), rejectSupervisor);
router.delete('/:id', authorize.admin(), deleteUser);

// Public routes (for specific user lookup)
router.get('/:id', getUserById);

module.exports = router;

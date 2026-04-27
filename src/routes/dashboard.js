const express = require('express');
const router = express.Router();

// Import controllers
const {
  getStudentDashboard,
  getSupervisorDashboard,
  getAdminDashboard,
  getDashboardStats
} = require('../controllers/dashboardController');

// Import middleware
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(auth);

// Student dashboard
router.get('/student', authorize.student(), getStudentDashboard);

// University supervisor dashboard
router.get('/supervisor', authorize.uniSupervisor(), getSupervisorDashboard);

// Admin dashboard
router.get('/admin', authorize.admin(), getAdminDashboard);

// General dashboard (role-based)
router.get('/', getDashboardStats);

module.exports = router;

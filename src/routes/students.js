const express = require('express');
const router = express.Router();

// Import controllers
const {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  assignSupervisor,
  getSupervisorStudents,
  getStudentProfile
} = require('../controllers/studentController');

// Import middleware
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validators } = require('../middleware/validation');

// Apply authentication to all routes
router.use(auth);

// Admin only routes
router.post('/', authorize.admin(), createStudent);
router.put('/:id', authorize.admin(), updateStudent);
router.put('/:id/assign-supervisor', authorize.admin(), assignSupervisor);

// Staff routes (admin + uni_supervisor)
router.get('/', authorize.staff(), getAllStudents);
router.get('/:id', authorize.staff(), getStudentById);

// University supervisor specific routes
router.get('/my-students', authorize.uniSupervisor(), getSupervisorStudents);

// Student specific routes
router.get('/profile/me', authorize.student(), getStudentProfile);

module.exports = router;

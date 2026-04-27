const express = require('express');
const router = express.Router();

// Import controllers
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout
} = require('../controllers/authController');

// Import middleware
const auth = require('../middleware/auth');
const { validators } = require('../middleware/validation');

// Public routes
router.post('/register', validators.registerUser, register);
router.post('/login', validators.loginUser, login);

// Protected routes
router.get('/me', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.put('/change-password', auth, changePassword);
router.post('/logout', auth, logout);

module.exports = router;

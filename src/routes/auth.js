const express = require('express');
const router = express.Router();

// Import controllers
const {
  register,
  login,
  googleLogin,
  refreshToken,
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
router.post('/google', validators.googleLogin, googleLogin);
router.post('/refresh-token', validators.refreshToken, refreshToken);

// Protected routes
router.get('/me', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.put('/change-password', auth, changePassword);
router.post('/logout', auth, logout);

module.exports = router;

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { register, login, googleAuth, getMe, resetPasswordDirect, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const registerRules = [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/register', registerRules, register);
router.post('/login',    loginRules,    login);
router.post('/google',                  googleAuth);
router.get('/me',        authenticate,  getMe);
router.post('/reset-password-direct',   resetPasswordDirect);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
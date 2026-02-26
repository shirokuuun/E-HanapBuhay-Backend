const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getMyApplications,
  getEmployerApplications,
  createApplication,
  updateApplicationStatus,
} = require('../controllers/applicationsController');

// Applicant — view own applications
router.get('/', authenticate, getMyApplications);

// Employer — view all applications to their job posts
router.get('/employer/all', authenticate, getEmployerApplications);

// Applicant — submit new application with file uploads
router.post('/', authenticate, upload.fields([
  { name: 'resume',       maxCount: 1 },
  { name: 'cover_letter', maxCount: 1 },
]), createApplication);

// Shared — update application status (used by employer dashboard)
router.patch('/:id/status', authenticate, updateApplicationStatus);

module.exports = router;
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getMyApplications,
  createApplication,
  updateApplicationStatus,
} = require('../controllers/applicationsController');

router.get('/',      authenticate, getMyApplications);
router.post('/',     authenticate, upload.fields([
  { name: 'resume',        maxCount: 1 },
  { name: 'cover_letter',  maxCount: 1 },
]), createApplication);
router.patch('/:id/status', authenticate, updateApplicationStatus);

module.exports = router;

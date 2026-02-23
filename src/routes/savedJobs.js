const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getSavedJobs, saveJob, unsaveJob } = require('../controllers/savedJobsController');

router.get('/',           authenticate, getSavedJobs);
router.post('/',          authenticate, saveJob);
router.delete('/:jobId',  authenticate, unsaveJob);

module.exports = router;

const express = require("express");
const router = express.Router();
const {
  getJobs,
  getJobById,
  createJob,
} = require("../controllers/jobsController");
const { optionalAuth, authenticate } = require("../middleware/auth");

router.get("/", optionalAuth, getJobs);
router.get("/:id", optionalAuth, getJobById);
router.post("/", authenticate, createJob);

module.exports = router;

const express = require("express");
const router = express.Router();

const {
  // Original applicant-facing
  getJobs,
  getJobById,
  createJob,
  // Admin-facing
  adminGetAllJobs,
  adminCreateJob,
  adminUpdateJob,
  adminUpdateJobStatus,
  adminDeleteJob,
  getCategories,
  getBarangays,
} = require("../controllers/jobsController");

const { optionalAuth, authenticate } = require("../middleware/auth");

router.get("/admin/categories", authenticate, getCategories);
router.get("/admin/barangays",  authenticate, getBarangays);
router.get("/admin/all",             authenticate, adminGetAllJobs);
router.post("/admin/create",         authenticate, adminCreateJob);
router.put("/admin/:id",             authenticate, adminUpdateJob);
router.patch("/admin/:id/status",    authenticate, adminUpdateJobStatus);
router.delete("/admin/:id",          authenticate, adminDeleteJob);
router.get("/",    optionalAuth, getJobs);
router.get("/:id", optionalAuth, getJobById);
router.post("/",   authenticate, createJob);

module.exports = router;
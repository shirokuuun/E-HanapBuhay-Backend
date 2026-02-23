const { query } = require("../config/db");
const { sendSuccess, sendError } = require("../middleware/errorHandler");

// GET /api/saved-jobs
const getSavedJobs = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         b.id AS saved_id, b.saved_at,
         j.id AS job_id, j.title, j.salary_min, j.salary_max,
         j.salary_range, j.work_setup AS type, j.description,
         c.name AS company, c.logo_url AS logo
       FROM bookmarks b
       JOIN job_posts j ON j.id = b.job_id
       LEFT JOIN companies c ON c.id = j.company_id
       WHERE b.user_id = $1
       ORDER BY b.saved_at DESC`,
      [req.user.id],
    );

    const savedJobs = result.rows.map((row) => ({
      ...row,
      salary:
        row.salary_range ||
        (row.salary_min && row.salary_max
          ? `₱${Number(row.salary_min).toLocaleString()}-₱${Number(row.salary_max).toLocaleString()}`
          : "Negotiable"),
      savedDate: new Date(row.saved_at).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    }));

    return sendSuccess(res, savedJobs);
  } catch (err) {
    console.error("getSavedJobs error:", err);
    return sendError(res, "Failed to fetch saved jobs");
  }
};

// POST /api/saved-jobs
const saveJob = async (req, res) => {
  try {
    const { job_id } = req.body;

    const jobCheck = await query("SELECT id FROM job_posts WHERE id = $1", [
      job_id,
    ]);
    if (jobCheck.rows.length === 0) {
      return sendError(res, "Job not found", 404);
    }

    const result = await query(
      `INSERT INTO bookmarks (user_id, job_id) VALUES ($1, $2)
       ON CONFLICT (user_id, job_id) DO NOTHING
       RETURNING *`,
      [req.user.id, job_id],
    );

    if (result.rows.length === 0) {
      return sendError(res, "Job already saved", 409);
    }

    return sendSuccess(res, result.rows[0], "Job saved", 201);
  } catch (err) {
    console.error("saveJob error:", err);
    return sendError(res, "Failed to save job");
  }
};

// DELETE /api/saved-jobs/:jobId
const unsaveJob = async (req, res) => {
  try {
    const result = await query(
      "DELETE FROM bookmarks WHERE user_id = $1 AND job_id = $2 RETURNING *",
      [req.user.id, req.params.jobId],
    );

    if (result.rows.length === 0) {
      return sendError(res, "Saved job not found", 404);
    }

    return sendSuccess(res, null, "Job removed from saved");
  } catch (err) {
    console.error("unsaveJob error:", err);
    return sendError(res, "Failed to remove saved job");
  }
};

module.exports = { getSavedJobs, saveJob, unsaveJob };

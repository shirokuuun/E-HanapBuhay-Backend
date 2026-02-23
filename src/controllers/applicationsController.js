const { query, getClient } = require("../config/db");
const { sendSuccess, sendError } = require("../middleware/errorHandler");

// GET /api/applications
const getMyApplications = async (req, res) => {
  try {
    const { status } = req.query;
    const params = [req.user.id];
    let statusFilter = "";

    if (status && status !== "All") {
      params.push(status.toLowerCase());
      statusFilter = `AND a.status = $${params.length}`;
    }

    const result = await query(
      `SELECT
         a.id, a.status, a.applied_at,
         j.id AS job_id, j.title, j.salary_min, j.salary_max,
         j.salary_range, j.description, j.work_setup,
         c.name AS company, c.logo_url AS logo
       FROM applications a
       JOIN job_posts j ON j.id = a.job_id
       LEFT JOIN companies c ON c.id = j.company_id
       WHERE a.applicant_id = $1 ${statusFilter}
       ORDER BY a.applied_at DESC`,
      params,
    );

    const applications = result.rows.map((row) => ({
      ...row,
      salary:
        row.salary_range ||
        (row.salary_min && row.salary_max
          ? `₱${Number(row.salary_min).toLocaleString()}-₱${Number(row.salary_max).toLocaleString()}`
          : "Negotiable"),
      appliedDate: new Date(row.applied_at).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    }));

    return sendSuccess(res, applications);
  } catch (err) {
    console.error("getMyApplications error:", err);
    return sendError(res, "Failed to fetch applications");
  }
};

// POST /api/applications
const createApplication = async (req, res) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const {
      job_id,
      applicant_first_name,
      applicant_last_name,
      applicant_phone,
      applicant_email,
      applicant_location,
      job_title,
      company_name,
      work_from,
      work_to,
      currently_working,
      work_city,
      work_description,
      school_name,
      edu_city,
      degree,
      major,
      edu_from,
      edu_to,
      currently_studying,
    } = req.body;

    const resume_url = req.files?.resume?.[0]
      ? `/uploads/resumes/${req.files.resume[0].filename}`
      : null;
    const cover_letter_url = req.files?.cover_letter?.[0]
      ? `/uploads/cover-letters/${req.files.cover_letter[0].filename}`
      : null;

    // Check job exists
    const jobCheck = await client.query(
      "SELECT id FROM job_posts WHERE id = $1 AND is_active = TRUE",
      [job_id],
    );
    if (jobCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return sendError(res, "Job not found or no longer active", 404);
    }

    // Check for duplicate
    const dupCheck = await client.query(
      "SELECT id FROM applications WHERE applicant_id = $1 AND job_id = $2",
      [req.user.id, job_id],
    );
    if (dupCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return sendError(res, "You have already applied to this job", 409);
    }

    const result = await client.query(
      `INSERT INTO applications (
         applicant_id, job_id,
         applicant_first_name, applicant_last_name,
         applicant_phone, applicant_email, applicant_location,
         resume_url, cover_letter_url,
         job_title, company_name,
         work_from, work_to, currently_working, work_city, work_description,
         school_name, edu_city, degree, major,
         edu_from, edu_to, currently_studying
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
         $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
       ) RETURNING *`,
      [
        req.user.id,
        job_id,
        applicant_first_name,
        applicant_last_name,
        applicant_phone,
        applicant_email,
        applicant_location,
        resume_url,
        cover_letter_url,
        job_title,
        company_name,
        work_from || null,
        work_to || null,
        currently_working || false,
        work_city,
        work_description,
        school_name,
        edu_city,
        degree,
        major,
        edu_from || null,
        edu_to || null,
        currently_studying || false,
      ],
    );

    await client.query("COMMIT");
    return sendSuccess(
      res,
      result.rows[0],
      "Application submitted successfully",
      201,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createApplication error:", err);
    return sendError(res, "Failed to submit application");
  } finally {
    client.release();
  }
};

// PATCH /api/applications/:id/status
const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      "submitted",
      "viewed",
      "shortlisted",
      "hired",
      "rejected",
    ];

    if (!validStatuses.includes(status)) {
      return sendError(
        res,
        `Status must be one of: ${validStatuses.join(", ")}`,
        400,
      );
    }

    const result = await query(
      "UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [status, req.params.id],
    );

    if (result.rows.length === 0) {
      return sendError(res, "Application not found", 404);
    }

    return sendSuccess(res, result.rows[0], "Status updated");
  } catch (err) {
    console.error("updateApplicationStatus error:", err);
    return sendError(res, "Failed to update status");
  }
};

module.exports = {
  getMyApplications,
  createApplication,
  updateApplicationStatus,
};

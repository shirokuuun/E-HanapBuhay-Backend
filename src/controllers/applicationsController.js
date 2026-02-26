const { query, getClient } = require("../config/db");
const { sendSuccess, sendError } = require("../middleware/errorHandler");

// GET /api/applications — applicant views their own applications
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

// GET /api/applications/employer/all — employer views all applications to their job posts
const getEmployerApplications = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         a.id,
         a.status,
         a.applied_at,
         a.resume_url,
         a.cover_letter_url,
         a.applicant_first_name,
         a.applicant_last_name,
         a.applicant_email,
         a.applicant_phone,
         a.applicant_location,
         a.job_title,
         a.company_name,
         a.work_from,
         a.work_to,
         a.currently_working,
         a.work_city,
         a.work_description,
         a.school_name,
         a.edu_city,
         a.degree,
         a.major,
         a.edu_from,
         a.edu_to,
         a.currently_studying,
         j.id           AS job_id,
         j.title        AS job_post_title,
         j.experience_years,
         u.id           AS applicant_user_id,
         u.full_name    AS applicant_full_name,
         u.email        AS applicant_user_email,
         u.phone_number AS applicant_phone_number,
         u.location     AS applicant_user_location
       FROM applications a
       JOIN job_posts j ON j.id = a.job_id
       LEFT JOIN users u ON u.id = a.applicant_id
       WHERE j.employer_id = $1
       ORDER BY a.applied_at DESC`,
      [req.user.id],
    );

    // Normalize each row for the employer frontend
    const applications = result.rows.map((row) => ({
      id:          row.id,
      status:      row.status,
      applied_at:  row.applied_at,
      resume_url:  row.resume_url,
      cover_letter_url: row.cover_letter_url,
      // Resolved display name: prefer submission fields, fallback to user account
      name: `${row.applicant_first_name || ''} ${row.applicant_last_name || ''}`.trim()
            || row.applicant_full_name
            || 'Unknown Applicant',
      email:    row.applicant_email    || row.applicant_user_email    || '',
      phone:    row.applicant_phone    || row.applicant_phone_number  || '',
      location: row.applicant_location || row.applicant_user_location || '',
      // Job context
      job_id:         row.job_id,
      job_title:      row.job_post_title,
      company_name:   row.company_name,
      // Work experience from application form
      work_from:          row.work_from,
      work_to:            row.work_to,
      currently_working:  row.currently_working,
      work_city:          row.work_city,
      work_description:   row.work_description,
      job_title_held:     row.job_title,
      // Education from application form
      school_name:       row.school_name,
      edu_city:          row.edu_city,
      degree:            row.degree,
      major:             row.major,
      edu_from:          row.edu_from,
      edu_to:            row.edu_to,
      currently_studying: row.currently_studying,
      // Years of experience from job post
      experience_years: row.experience_years,
    }));

    return sendSuccess(res, applications);
  } catch (err) {
    console.error("getEmployerApplications error:", err);
    return sendError(res, "Failed to fetch employer applications");
  }
};

// POST /api/applications — applicant submits a new application
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

    const jobCheck = await client.query(
      "SELECT id FROM job_posts WHERE id = $1 AND is_active = TRUE",
      [job_id],
    );
    if (jobCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return sendError(res, "Job not found or no longer active", 404);
    }

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
    return sendSuccess(res, result.rows[0], "Application submitted successfully", 201);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createApplication error:", err);
    return sendError(res, "Failed to submit application");
  } finally {
    client.release();
  }
};

// PATCH /api/applications/:id/status — update application status
const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["submitted", "viewed", "shortlisted", "hired", "rejected"];

    if (!validStatuses.includes(status)) {
      return sendError(res, `Status must be one of: ${validStatuses.join(", ")}`, 400);
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
  getEmployerApplications,
  createApplication,
  updateApplicationStatus,
};
const { query } = require("../config/db");
const { sendSuccess, sendError } = require("../middleware/errorHandler");

const resolveCompanyId = async (companyName) => {
  if (!companyName || !companyName.trim()) return null;

  const name = companyName.trim();

  // Try to find existing company (case-insensitive)
  const existing = await query(
    `SELECT id FROM companies WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name],
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // Not found — create a new company row with just the name
  const created = await query(
    `INSERT INTO companies (name, created_at) VALUES ($1, NOW()) RETURNING id`,
    [name],
  );

  return created.rows[0].id;
};

const getJobs = async (req, res) => {
  try {
    const { work_setup, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = ["j.status = 'active'"];

    if (work_setup) {
      params.push(work_setup);
      conditions.push(`j.work_setup = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(j.title ILIKE $${params.length} OR c.name ILIKE $${params.length})`,
      );
    }

    const whereClause = "WHERE " + conditions.join(" AND ");

    params.push(parseInt(limit));
    params.push(offset);

    const sql = `
      SELECT
        j.id, j.title, j.description, j.salary_min, j.salary_max,
        j.salary_range, j.job_type, j.work_setup, j.experience_years, j.posted_at,
        c.id   AS company_id,
        c.name AS company,
        c.logo_url AS logo,
        c.industry
      FROM job_posts j
      LEFT JOIN companies c ON c.id = j.company_id
      ${whereClause}
      ORDER BY j.posted_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await query(sql, params);

    const countSql = `
      SELECT COUNT(*) FROM job_posts j
      LEFT JOIN companies c ON c.id = j.company_id
      ${whereClause}
    `;
    const countResult = await query(countSql, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    return sendSuccess(res, {
      jobs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("getJobs error:", err);
    return sendError(res, "Failed to fetch jobs");
  }
};

const getJobById = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         j.*, c.name AS company, c.logo_url AS logo,
         c.industry, c.size, c.website, c.headquarters, c.description AS company_description
       FROM job_posts j
       LEFT JOIN companies c ON c.id = j.company_id
       WHERE j.id = $1 AND j.status = 'active'`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return sendError(res, "Job not found", 404);
    }

    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    console.error("getJobById error:", err);
    return sendError(res, "Failed to fetch job");
  }
};

const createJob = async (req, res) => {
  try {
    const {
      company_id,
      title,
      description,
      responsibilities,
      requirements,
      salary_min,
      salary_max,
      salary_range,
      job_type,
      work_setup,
      experience_years,
      category_id,
      barangay_id,
      auto_expiry_date,
    } = req.body;

    const result = await query(
      `INSERT INTO job_posts (
         employer_id, company_id, title, description, responsibilities,
         requirements, salary_min, salary_max, salary_range,
         job_type, work_setup, experience_years,
         category_id, barangay_id, auto_expiry_date
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        req.user.id,
        company_id || null,
        title,
        description || null,
        responsibilities || null,
        requirements || null,
        salary_min || null,
        salary_max || null,
        salary_range || null,
        job_type || "Full-Time",
        work_setup || "Onsite",
        experience_years || 0,
        category_id || null,
        barangay_id || null,
        auto_expiry_date || null,
      ],
    );

    return sendSuccess(res, result.rows[0], "Job created successfully", 201);
  } catch (err) {
    console.error("createJob error:", err);
    return sendError(res, "Failed to create job");
  }
};

const adminGetAllJobs = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        j.id,
        j.title,
        j.description,
        j.responsibilities,
        j.requirements,
        j.job_type,
        j.work_setup,
        j.salary_min,
        j.salary_max,
        j.salary_range,
        j.experience_years,
        j.status,
        j.is_active,
        j.posted_at,
        j.created_at,
        j.updated_at,
        j.auto_expiry_date,
        j.category_id,
        j.barangay_id,
        j.company_id,
        j.employer_id,
        -- Joined display names
        c.name          AS company_name,
        jc.name         AS category_name,
        b.name          AS barangay_name,
        -- Application count
        COALESCE(app_counts.cnt, 0) AS application_count
      FROM job_posts j
      LEFT JOIN companies      c   ON c.id  = j.company_id
      LEFT JOIN job_categories jc  ON jc.id = j.category_id
      LEFT JOIN barangays      b   ON b.id  = j.barangay_id
      LEFT JOIN (
        SELECT job_id, COUNT(*) AS cnt
        FROM applications
        GROUP BY job_id
      ) app_counts ON app_counts.job_id = j.id
      ORDER BY j.posted_at DESC
    `);

    return sendSuccess(res, result.rows);
  } catch (err) {
    console.error("adminGetAllJobs error:", err);
    return sendError(res, "Failed to fetch all job posts");
  }
};

const adminCreateJob = async (req, res) => {
  try {
    const {
      title,
      company_name,     // free-text from the admin form
      description,
      responsibilities,
      requirements,
      salary_min,
      salary_max,
      salary_range,
      job_type,
      work_setup,
      experience_years,
      category_id,
      barangay_id,
      auto_expiry_date,
    } = req.body;

    if (!title || !title.trim()) {
      return sendError(res, "Job title is required", 400);
    }

    // Resolve company: find existing or auto-create
    const resolvedCompanyId = await resolveCompanyId(company_name);

    // Build salary_range if not provided
    const finalSalaryRange =
      salary_range ||
      (salary_min && salary_max
        ? `₱${Number(salary_min).toLocaleString()}-₱${Number(salary_max).toLocaleString()}`
        : null);

    const result = await query(
      `INSERT INTO job_posts (
         employer_id, company_id, title, description, responsibilities,
         requirements, salary_min, salary_max, salary_range,
         job_type, work_setup, experience_years,
         category_id, barangay_id, auto_expiry_date,
         status, is_active, posted_at, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,
         $6,$7,$8,$9,
         $10,$11,$12,
         $13,$14,$15,
         'active', true, NOW(), NOW(), NOW()
       )
       RETURNING *`,
      [
        req.user?.id || null,
        resolvedCompanyId,
        title.trim(),
        description    || null,
        responsibilities || null,
        requirements   || null,
        salary_min     || null,
        salary_max     || null,
        finalSalaryRange,
        job_type       || "Full-Time",
        work_setup     || "Onsite",
        experience_years || 0,
        category_id    || null,
        barangay_id    || null,
        auto_expiry_date || null,
      ],
    );

    return sendSuccess(res, result.rows[0], "Job vacancy created successfully", 201);
  } catch (err) {
    console.error("adminCreateJob error:", err);
    return sendError(res, "Failed to create job vacancy");
  }
};

const adminUpdateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      company_name,     // free-text from the admin form
      description,
      responsibilities,
      requirements,
      category_id,
      barangay_id,
      salary_min,
      salary_max,
      salary_range,
      job_type,
      work_setup,
      experience_years,
    } = req.body;

    if (!title || !title.trim()) {
      return sendError(res, "Job title is required", 400);
    }

    // Resolve company name → company_id
    const resolvedCompanyId = await resolveCompanyId(company_name);

    // Build salary_range if not provided
    const finalSalaryRange =
      salary_range ||
      (salary_min && salary_max
        ? `₱${Number(salary_min).toLocaleString()}-₱${Number(salary_max).toLocaleString()}`
        : null);

    const result = await query(
      `UPDATE job_posts SET
        title            = $1,
        description      = $2,
        responsibilities = $3,
        requirements     = $4,
        category_id      = $5,
        barangay_id      = $6,
        company_id       = $7,
        salary_range     = $8,
        salary_min       = $9,
        salary_max       = $10,
        job_type         = $11,
        work_setup       = $12,
        experience_years = $13,
        updated_at       = NOW()
      WHERE id = $14
      RETURNING *`,
      [
        title.trim(),
        description      || null,
        responsibilities || null,
        requirements     || null,
        category_id      || null,
        barangay_id      || null,
        resolvedCompanyId,
        finalSalaryRange,
        salary_min       || null,
        salary_max       || null,
        job_type         || "Full-Time",
        work_setup       || "Onsite",
        experience_years || 0,
        id,
      ],
    );

    if (result.rows.length === 0) {
      return sendError(res, "Job post not found", 404);
    }

    return sendSuccess(res, result.rows[0], "Job updated successfully");
  } catch (err) {
    console.error("adminUpdateJob error:", err);
    return sendError(res, "Failed to update job post");
  }
};

const adminUpdateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const VALID_STATUSES = ["active", "closed", "filled", "expired"];
    if (!VALID_STATUSES.includes(status)) {
      return sendError(
        res,
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        400,
      );
    }

    // is_active = true only when the job is "active"
    const is_active = status === "active";

    const result = await query(
      `UPDATE job_posts
       SET status     = $1,
           is_active  = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, is_active, id],
    );

    if (result.rows.length === 0) {
      return sendError(res, "Job post not found", 404);
    }

    return sendSuccess(res, result.rows[0], `Job status updated to "${status}"`);
  } catch (err) {
    console.error("adminUpdateJobStatus error:", err);
    return sendError(res, "Failed to update job status");
  }
};

const adminDeleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `DELETE FROM job_posts WHERE id = $1 RETURNING id, title`,
      [id],
    );

    if (result.rows.length === 0) {
      return sendError(res, "Job post not found", 404);
    }

    return sendSuccess(
      res,
      { id: result.rows[0].id },
      `Job "${result.rows[0].title}" deleted successfully`,
    );
  } catch (err) {
    console.error("adminDeleteJob error:", err);
    return sendError(res, "Failed to delete job post");
  }
};

const getCategories = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name FROM job_categories ORDER BY name ASC`,
    );
    return sendSuccess(res, result.rows);
  } catch (err) {
    console.error("getCategories error:", err);
    return sendError(res, "Failed to fetch categories");
  }
};

const getBarangays = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name FROM barangays ORDER BY name ASC`,
    );
    return sendSuccess(res, result.rows);
  } catch (err) {
    console.error("getBarangays error:", err);
    return sendError(res, "Failed to fetch barangays");
  }
};

module.exports = {
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
};
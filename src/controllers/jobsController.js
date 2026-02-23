const { query } = require("../config/db");
const { sendSuccess, sendError } = require("../middleware/errorHandler");

// GET /api/jobs
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

// GET /api/jobs/:id
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

// POST /api/jobs (employer only)
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

module.exports = { getJobs, getJobById, createJob };

const { query } = require("../config/db");
const { sendSuccess, sendError } = require("../middleware/errorHandler");

/**
 * GET /api/user/profile/:id
 * Fetches combined User + Business Profile data.
 *
 * DB columns used:
 *  users             → id, full_name, email, role, location, phone_number, avatar_url
 *  business_profiles → company_name, size, industry, tin_number, permit_url,
 *                      website, headquarters, description, verification_status
 */
const getProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.role,
         u.location,
         u.phone_number,
         u.avatar_url,
         bp.company_name,
         bp.size            AS company_size,
         bp.industry,
         bp.tin_number,
         bp.permit_url,
         bp.website,
         bp.headquarters,
         bp.description,
         bp.verification_status
       FROM users u
       LEFT JOIN business_profiles bp ON u.id = bp.user_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, "User not found", 404);
    }

    const row = result.rows[0];

    const data = {
      full_name:    row.full_name,
      email:        row.email,
      role:         row.role,
      location:     row.location,
      phone_number: row.phone_number,
      avatar_url:   row.avatar_url,
      business: {
        companyName:        row.company_name        || "",
        companySize:        row.company_size        || "",
        industry:           row.industry            || "",
        tinNumber:          row.tin_number          || "",
        permitUrl:          row.permit_url          || "",
        website:            row.website             || "",
        headquarters:       row.headquarters        || "",
        description:        row.description         || "",
        verificationStatus: row.verification_status || "pending",
      },
    };

    return sendSuccess(res, data);
  } catch (err) {
    console.error("getProfile Error:", err);
    return sendError(res, "Failed to fetch profile");
  }
};

/**
 * PUT /api/user/profile/:id
 * Updates user info: full_name, email, phone_number, location.
 * email has a UNIQUE constraint in the DB — if the new email is already taken
 * by another account, Postgres throws error code 23505 and we return a clear
 * message to the frontend instead of a generic 500.
 */
const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone_number, location } = req.body;

    const result = await query(
      `UPDATE users
       SET full_name    = COALESCE($1, full_name),
           email        = COALESCE($2, email),
           phone_number = COALESCE($3, phone_number),
           location     = COALESCE($4, location),
           updated_at   = NOW()
       WHERE id = $5
       RETURNING id, full_name, email, role, location, phone_number, avatar_url`,
      [full_name, email, phone_number, location, id]
    );

    if (result.rows.length === 0) {
      return sendError(res, "User not found", 404);
    }

    return sendSuccess(res, result.rows[0], "Profile updated");
  } catch (err) {
    // Postgres unique-constraint violation (email already taken)
    if (err.code === "23505" && err.constraint === "users_email_key") {
      return sendError(res, "This email address is already in use by another account.", 409);
    }
    // Postgres unique-constraint violation (phone already taken)
    if (err.code === "23505" && err.constraint === "users_phone_number_key") {
      return sendError(res, "This phone number is already in use by another account.", 409);
    }
    console.error("updateProfile error:", err);
    return sendError(res, "Failed to update profile");
  }
};

/**
 * PUT /api/user/business/:id
 * Upserts the business_profiles row for this user.
 * Accepts: companyName, companySize, industry, tinNumber,
 *          website, headquarters, description
 * NOTE: permit_url is handled by POST /api/user/permit/:id (file upload).
 *       verification_status is admin-managed only.
 */
const updateBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      companyName,
      companySize,
      industry,
      tinNumber,
      website,
      headquarters,
      description,
    } = req.body;

    const result = await query(
      `INSERT INTO business_profiles
         (user_id, company_name, size, industry, tin_number, website, headquarters, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         company_name  = EXCLUDED.company_name,
         size          = EXCLUDED.size,
         industry      = EXCLUDED.industry,
         tin_number    = EXCLUDED.tin_number,
         website       = EXCLUDED.website,
         headquarters  = EXCLUDED.headquarters,
         description   = EXCLUDED.description,
         updated_at    = NOW()
       RETURNING
         company_name,
         size          AS company_size,
         industry,
         tin_number,
         permit_url,
         website,
         headquarters,
         description,
         verification_status`,
      [id, companyName, companySize, industry, tinNumber, website, headquarters, description]
    );

    const row = result.rows[0];
    return sendSuccess(res, {
      companyName:        row.company_name,
      companySize:        row.company_size,
      industry:           row.industry,
      tinNumber:          row.tin_number,
      permitUrl:          row.permit_url,
      website:            row.website,
      headquarters:       row.headquarters,
      description:        row.description,
      verificationStatus: row.verification_status,
    }, "Business profile saved");
  } catch (err) {
    console.error("updateBusiness error:", err);
    return sendError(res, "Failed to save business profile");
  }
};

/**
 * POST /api/user/avatar
 * Uploads avatar image and updates users.avatar_url.
 */
const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, "No file uploaded", 400);
    }
    const avatar_url = `/uploads/avatars/${req.file.filename}`;
    const result = await query(
      "UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING avatar_url",
      [avatar_url, req.user.id]
    );
    return sendSuccess(res, result.rows[0], "Avatar updated");
  } catch (err) {
    console.error("updateAvatar error:", err);
    return sendError(res, "Failed to update avatar");
  }
};

/**
 * POST /api/user/permit/:id
 * Uploads a business permit PDF and saves the path to business_profiles.permit_url.
 * The DB has ONE permit_url column (not separate DTI/SEC/Mayor fields).
 */
const updatePermit = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, "No file uploaded", 400);
    }
    const { id } = req.params;
    const permit_url = `/uploads/permits/${req.file.filename}`;

    const result = await query(
      `INSERT INTO business_profiles (user_id, company_name, permit_url)
       VALUES ($1, '', $2)
       ON CONFLICT (user_id) DO UPDATE SET
         permit_url = EXCLUDED.permit_url,
         updated_at = NOW()
       RETURNING permit_url`,
      [id, permit_url]
    );

    return sendSuccess(res, result.rows[0], "Permit uploaded");
  } catch (err) {
    console.error("updatePermit error:", err);
    return sendError(res, "Failed to upload permit");
  }
};

/**
 * GET /api/user/documents
 * Fetches resume and cover letter URLs for the logged-in user.
 */
const getDocuments = async (req, res) => {
  try {
    const result = await query(
      `SELECT resume_url, cover_letter_url FROM applicant_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const row = result.rows[0] ?? {};

    const toDisplayName = (url) => {
      if (!url) return null;
      const filename = url.split("/").pop();
      const parts = filename.split("-");
      const withoutPrefix = parts.slice(6).join("-");
      return withoutPrefix.replace(/_/g, " ");
    };

    return sendSuccess(res, {
      resume_url:       row.resume_url       ?? null,
      cover_letter_url: row.cover_letter_url ?? null,
      resume_name:      toDisplayName(row.resume_url),
      cover_name:       toDisplayName(row.cover_letter_url),
    });
  } catch (err) {
    console.error("getDocuments error:", err);
    return sendError(res, "Failed to fetch documents");
  }
};

/**
 * POST /api/user/documents
 * Uploads resume and/or cover letter PDFs.
 */
const updateDocuments = async (req, res) => {
  try {
    const { document_type } = req.body;
    console.log("files received:", JSON.stringify(Object.keys(req.files || {})));

    if (document_type === "resume" && req.files?.resume) {
      const resume_url    = `/uploads/documents/${req.files.resume[0].filename}`;
      const original_name = req.files.resume[0].originalname;

      await query(
        `INSERT INTO applicant_profiles (id, user_id, resume_url, updated_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET resume_url = EXCLUDED.resume_url,
                       updated_at = NOW()`,
        [req.user.id, resume_url]
      );
      return sendSuccess(res, { resume_url, original_name }, "Resume uploaded");
    }

    if (document_type === "cover" && req.files?.cover_letter) {
      const cover_url     = `/uploads/documents/${req.files.cover_letter[0].filename}`;
      const original_name = req.files.cover_letter[0].originalname;

      await query(
        `INSERT INTO applicant_profiles (id, user_id, cover_letter_url, updated_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET cover_letter_url = EXCLUDED.cover_letter_url,
                       updated_at = NOW()`,
        [req.user.id, cover_url]
      );
      return sendSuccess(res, { cover_url, original_name }, "Cover letter uploaded");
    }

    return sendError(res, "No file received", 400);
  } catch (err) {
    console.error("updateDocuments FULL error:", err.message, err.stack);
    return sendError(res, err.message || "Failed to upload document");
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateBusiness,
  updateAvatar,
  updatePermit,
  updateDocuments,
  getDocuments,
};
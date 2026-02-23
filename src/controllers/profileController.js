const { query } = require("../config/db");
const { sendSuccess, sendError } = require("../middleware/errorHandler");

// GET /api/profile
const getProfile = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, full_name, email, role, location, phone_number, avatar_url, created_at
       FROM users WHERE id = $1`,
      [req.user.id],
    );
    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    return sendError(res, "Failed to fetch profile");
  }
};

// PUT /api/profile
const updateProfile = async (req, res) => {
  try {
    const { full_name, location, phone, phone_number } = req.body;
    const phoneValue = phone_number || phone || null;

    const result = await query(
      `UPDATE users
       SET full_name    = COALESCE($1, full_name),
           location     = COALESCE($2, location),
           phone_number = COALESCE($3, phone_number),
           updated_at   = NOW()
       WHERE id = $4
       RETURNING id, full_name, email, role, location, phone_number, avatar_url`,
      [full_name || null, location || null, phoneValue, req.user.id],
    );

    return sendSuccess(res, result.rows[0], "Profile updated");
  } catch (err) {
    console.error("updateProfile error:", err);
    return sendError(res, "Failed to update profile");
  }
};

// POST /api/profile/avatar
const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, "No file uploaded", 400);
    }
    const avatar_url = `/uploads/avatars/${req.file.filename}`;
    const result = await query(
      "UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING avatar_url",
      [avatar_url, req.user.id],
    );
    return sendSuccess(res, result.rows[0], "Avatar updated");
  } catch (err) {
    return sendError(res, "Failed to update avatar");
  }
};

const getDocuments = async (req, res) => {
  try {
    const result = await query(
      `SELECT resume_url, cover_letter_url FROM applicant_profiles WHERE user_id = $1`,
      [req.user.id],
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
      resume_url: row.resume_url ?? null,
      cover_letter_url: row.cover_letter_url ?? null,
      resume_name: toDisplayName(row.resume_url),
      cover_name: toDisplayName(row.cover_letter_url),
    });
  } catch (err) {
    return sendError(res, "Failed to fetch documents");
  }
};

const updateDocuments = async (req, res) => {
  try {
    const { document_type } = req.body;
    console.log(
      "files received:",
      JSON.stringify(Object.keys(req.files || {})),
    );

    if (document_type === "resume" && req.files?.resume) {
      const resume_url = `/uploads/documents/${req.files.resume[0].filename}`;
      const original_name = req.files.resume[0].originalname; // ← save original name

      await query(
        `INSERT INTO applicant_profiles (id, user_id, resume_url, updated_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET resume_url = EXCLUDED.resume_url,
                       updated_at = NOW()`,
        [req.user.id, resume_url],
      );
      return sendSuccess(res, { resume_url, original_name }, "Resume uploaded");
    }

    if (document_type === "cover" && req.files?.cover_letter) {
      const cover_url = `/uploads/documents/${req.files.cover_letter[0].filename}`;
      const original_name = req.files.cover_letter[0].originalname;

      await query(
        `INSERT INTO applicant_profiles (id, user_id, cover_letter_url, updated_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET cover_letter_url = EXCLUDED.cover_letter_url,
                       updated_at = NOW()`,
        [req.user.id, cover_url],
      );
      return sendSuccess(
        res,
        { cover_url, original_name },
        "Cover letter uploaded",
      );
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
  updateAvatar,
  updateDocuments,
  getDocuments,
};

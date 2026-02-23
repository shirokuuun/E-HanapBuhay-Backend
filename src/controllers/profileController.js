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

module.exports = { getProfile, updateProfile, updateAvatar };

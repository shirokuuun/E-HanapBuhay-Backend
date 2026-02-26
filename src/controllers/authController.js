const bcrypt = require("bcryptjs");
const { query } = require("../config/db");
const { generateToken } = require("../utils/jwt");
const { sendSuccess, sendError } = require("../middleware/errorHandler");

// POST /api/auth/register
// This endpoint is exclusively for the Employer web app.
// role_id and role are HARDCODED server-side — no client can self-assign a different role.
const register = async (req, res) => {
  try {
    const { full_name, email, password, location, phone, phone_number } =
      req.body;
    const phoneValue = phone_number || phone || null;

    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return sendError(res, "Email already registered", 409);
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, location, phone_number, role_id, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, full_name, email, role, role_id, location, phone_number, created_at`,
      [full_name, email, password_hash, location || null, phoneValue, 2, "employer"],
    );

    const user = result.rows[0];
    const token = generateToken(user);

    return sendSuccess(res, { token, user }, "Account created successfully", 201);
  } catch (err) {
    console.error("register error:", err);
    return sendError(res, "Registration failed");
  }
};

// POST /api/auth/login
// Employer web app only — rejects any account that is not role_id = 2 / role = 'employer'.
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await query(
      // avatar_url fetched so frontend can display profile photo in header immediately after login
      "SELECT id, full_name, email, password_hash, role, role_id, is_active, avatar_url FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return sendError(res, "Invalid email or password", 401);
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return sendError(res, "Account is deactivated", 403);
    }
    if (!user.password_hash) {
      return sendError(res, "Please sign in with Google", 400);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return sendError(res, "Invalid email or password", 401);
    }

    // RBAC: this endpoint is for employers only (role_id = 2, role = 'employer')
    if (user.role_id !== 2 || user.role !== "employer") {
      return sendError(res, "Access denied. This login is for employers only.", 403);
    }

    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;
    return sendSuccess(res, { token, user: safeUser }, "Login successful");
  } catch (err) {
    console.error("login error:", err);
    return sendError(res, "Login failed");
  }
};

// POST /api/auth/google
const googleAuth = async (req, res) => {
  try {
    const { google_id, email, full_name, avatar_url } = req.body;
    let result = await query("SELECT * FROM users WHERE google_id = $1 OR email = $2", [google_id, email]);
    let user;

    if (result.rows.length > 0) {
      const update = await query(
        `UPDATE users SET google_id = $1, full_name = $2, avatar_url = $3,
         auth_provider = 'google', updated_at = NOW()
         WHERE id = $4 RETURNING id, full_name, email, role`,
        [google_id, full_name, avatar_url, result.rows[0].id]
      );
      user = update.rows[0];
    } else {
      const insert = await query(
        `INSERT INTO users (full_name, email, google_id, avatar_url, auth_provider)
         VALUES ($1, $2, $3, $4, 'google')
         RETURNING id, full_name, email, role`,
        [full_name, email, google_id, avatar_url]
      );
      user = insert.rows[0];
    }

    const token = generateToken(user);
    return sendSuccess(res, { token, user }, "Google login successful");
  } catch (err) {
    console.error("googleAuth error:", err);
    return sendError(res, "Google authentication failed");
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, full_name, email, role, location, phone_number, avatar_url, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    return sendError(res, "Could not fetch profile");
  }
};

// POST /api/auth/reset-password-direct
// Used by the Forgot Password modal on the Employer login page.
// Only allows resetting passwords for employer accounts (role_id = 2).
const resetPasswordDirect = async (req, res) => {
  const { email, newPassword } = req.body;
  try {
    const user = await query(
      "SELECT id, role_id, role FROM users WHERE email = $1",
      [email]
    );

    if (user.rows.length === 0) {
      // Generic message — don't reveal whether the email exists
      return sendError(res, "No employer account found with that email.", 404);
    }

    // Only employer accounts (role_id = 2) can reset via this endpoint
    if (user.rows[0].role_id !== 2 || user.rows[0].role !== "employer") {
      return sendError(res, "No employer account found with that email.", 403);
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2", [hashed, email]);

    return sendSuccess(res, null, "Password updated successfully. You can now log in.");
  } catch (err) {
    console.error("Reset password error:", err);
    return sendError(res, "Failed to update password");
  }
};

// POST /api/auth/change-password
// Used by the Profile > Security section for authenticated employers changing their own password.
// Requires verifying the current password before allowing the change.
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return sendError(res, "Current password and new password are required.", 400);
  }
  if (newPassword.length < 8) {
    return sendError(res, "New password must be at least 8 characters.", 400);
  }

  try {
    const result = await query(
      "SELECT id, password_hash FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return sendError(res, "User not found.", 404);
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return sendError(res, "Cannot change password for Google-authenticated accounts.", 400);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return sendError(res, "Current password is incorrect.", 401);
    }

    if (currentPassword === newPassword) {
      return sendError(res, "New password must be different from your current password.", 400);
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [hashed, req.user.id]
    );

    return sendSuccess(res, null, "Password changed successfully.");
  } catch (err) {
    console.error("changePassword error:", err);
    return sendError(res, "Failed to change password.");
  }
};

module.exports = { register, login, googleAuth, getMe, resetPasswordDirect, changePassword };
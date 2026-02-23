const bcrypt = require("bcryptjs");
const { query } = require("../config/db");
const { generateToken } = require("../utils/jwt");
const { sendSuccess, sendError } = require("../middleware/errorHandler");

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { full_name, email, password, location, phone, phone_number } =
      req.body;
    const phoneValue = phone_number || phone || null;

    // Check duplicate email
    const existing = await query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0) {
      return sendError(res, "Email already registered", 409);
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, location, phone_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, role, location, phone_number, created_at`,
      [full_name, email, password_hash, location || null, phoneValue],
    );

    const user = result.rows[0];
    const token = generateToken(user);

    return sendSuccess(
      res,
      { token, user },
      "Account created successfully",
      201,
    );
  } catch (err) {
    console.error("register error:", err);
    return sendError(res, "Registration failed");
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      "SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email = $1",
      [email],
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

    let result = await query(
      "SELECT * FROM users WHERE google_id = $1 OR email = $2",
      [google_id, email],
    );
    let user;

    if (result.rows.length > 0) {
      const update = await query(
        `UPDATE users SET google_id = $1, full_name = $2, avatar_url = $3,
         auth_provider = 'google', updated_at = NOW()
         WHERE id = $4 RETURNING id, full_name, email, role`,
        [google_id, full_name, avatar_url, result.rows[0].id],
      );
      user = update.rows[0];
    } else {
      const insert = await query(
        `INSERT INTO users (full_name, email, google_id, avatar_url, auth_provider)
         VALUES ($1, $2, $3, $4, 'google')
         RETURNING id, full_name, email, role`,
        [full_name, email, google_id, avatar_url],
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
      [req.user.id],
    );
    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    return sendError(res, "Could not fetch profile");
  }
};

module.exports = { register, login, googleAuth, getMe };

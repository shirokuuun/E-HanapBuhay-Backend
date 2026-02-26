const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

// Verify JWT and attach user to req
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check user still exists and is active
    const result = await query(
      // avatar_url included so req.user is complete for all authenticated routes
      'SELECT id, full_name, email, role, role_id, is_active, avatar_url FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Optional auth — attach user if token present, but don't block if not
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      'SELECT id, full_name, email, role, role_id FROM users WHERE id = $1',
      [decoded.id]
    );
    if (result.rows.length > 0) req.user = result.rows[0];
  } catch (_) { /* ignore */ }
  next();
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const hasRoleId = allowedRoles.some(r => typeof r === 'number' && req.user.role_id === r);
    const hasRoleName = allowedRoles.some(r => typeof r === 'string' && req.user.role === r);

    if (!hasRoleId && !hasRoleName) {
      return res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

module.exports = { authenticate, optionalAuth, requireRole };
// Standard success response
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

// Standard error response
const sendError = (res, message = 'Something went wrong', statusCode = 500, errors = null) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

// Global error handler middleware (register last in app)
const errorHandler = (err, req, res, next) => {
  console.error('🔥 Unhandled error:', err.stack || err.message);

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return sendError(res, 'A record with this value already exists.', 409);
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return sendError(res, 'Referenced record does not exist.', 400);
  }

  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  return sendError(res, message, status);
};

// 404 handler
const notFound = (req, res) => {
  return sendError(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
};

module.exports = { sendSuccess, sendError, errorHandler, notFound };

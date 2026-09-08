/**
 * Centralized Production-Ready Error Handler Middleware
 * Normalizes Mongoose, JWT, validation, and operational errors without leaking internal stack traces or database structures.
 */

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors || undefined;

  // Handle Mongoose Validation Errors
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    errors = Object.values(err.errors || {}).map((val) => ({
      field: val.path,
      message: val.message,
    }));
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId format)
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Resource not found or invalid identifier format: ${err.path}`;
  }

  // Handle MongoDB Duplicate Key Errors (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicatedField = Object.keys(err.keyValue || {})[0] || "field";
    message = `A record with this ${duplicatedField} already exists.`;
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token. Please log in again.";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication token expired. Please log in again.";
  }

  // Handle malformed JSON body
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    statusCode = 400;
    message = "Malformed JSON payload in request body.";
  }

  // Production vs Development error logging
  if (process.env.NODE_ENV !== "test") {
    if (statusCode >= 500) {
      console.error(`[SERVER ERROR] ${req.method} ${req.originalUrl}:`, err.message);
      if (process.env.NODE_ENV === "development") {
        console.error(err.stack);
      }
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(process.env.NODE_ENV === "development" && statusCode >= 500 ? { stack: err.stack } : {}),
  });
};

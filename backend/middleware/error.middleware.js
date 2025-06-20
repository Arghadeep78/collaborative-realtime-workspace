// Central error handler. Must have exactly 4 parameters so Express recognises
// it as an error-handling middleware (not a regular route handler).
// Failure bodies mirror the success envelope (APIResponse) so the whole API
// emits one predictable shape: { statusCode, message, success, data }.
// eslint-disable-next-line no-unused-vars
export default function errorMiddleware(err, req, res, next) {
  if (err.isOperational) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ statusCode, message: err.message, success: false, data: null });
  }
  // Unexpected error: log the real cause server-side, send a generic message
  // so internals never reach the client.
  console.error('[Unhandled error]', err);
  return res.status(500).json({
    statusCode: 500,
    message: 'Something went wrong. Please try again.',
    success: false,
    data: null,
  });
}

export default function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  const message = err.message || "Internal server error";

  const payload = { message };
  if (process.env.NODE_ENV !== "production") {
    payload.stack = err.stack;
  }

  return res.status(status).json(payload);
}

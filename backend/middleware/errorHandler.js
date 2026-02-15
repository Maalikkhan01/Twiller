import fs from "fs";

export default function errorHandler(err, req, res, next) {
  if (err?.code === "LIMIT_FILE_SIZE") {
    const filePath = req?.file?.path;
    if (filePath) {
      fs.promises.unlink(filePath).catch(() => {});
    }
    return res.status(413).json({ message: "File too large. Max size is 5MB." });
  }

  const status = err.statusCode || err.status || 500;
  const message = err.message || "Internal server error";

  const payload = { message };
  if (process.env.NODE_ENV !== "production") {
    payload.stack = err.stack;
  }

  return res.status(status).json(payload);
}

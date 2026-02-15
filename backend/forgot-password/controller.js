import { requestPasswordReset, resetPasswordWithToken } from "./resetService.js";

export const handleForgotPassword = async (req, res, next) => {
  try {
    const identifier =
      req.body?.identifier ?? req.body?.email ?? req.body?.phone ?? "";

    await requestPasswordReset(identifier);

    return res
      .status(200)
      .json({ message: "If an account exists, a password has been sent." });
  } catch (error) {
    return next(error);
  }
};

export const handlePasswordReset = async (req, res, next) => {
  try {
    const token = String(req.body?.token || "").trim();
    const newPassword = String(
      req.body?.newPassword || req.body?.password || "",
    ).trim();

    await resetPasswordWithToken({ token, newPassword });

    return res.status(200).json({ message: "Password reset successful." });
  } catch (error) {
    return next(error);
  }
};

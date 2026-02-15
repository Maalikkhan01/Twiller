import User from "../../models/user.js";

export const requireCurrentUser = async (req, res, next) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const currentUser = await User.findOne({ email });
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    req.currentUser = currentUser;
    return next();
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};

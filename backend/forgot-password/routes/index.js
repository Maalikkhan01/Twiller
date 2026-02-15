import express from "express";
import { handleForgotPassword, handlePasswordReset } from "../controller.js";

const router = express.Router();

router.post("/", handleForgotPassword);
router.post("/reset", handlePasswordReset);

export default router;

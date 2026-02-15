import express from "express";
import postsRoutes from "./postsRoutes.js";
import engagementRoutes from "./engagementRoutes.js";
import usersRoutes from "./usersRoutes.js";
import messagingRoutes from "./messagingRoutes.js";
import spacesRoutes from "./spacesRoutes.js";
import discoveryRoutes from "./discoveryRoutes.js";
import listsRoutes from "./listsRoutes.js";
import communitiesRoutes from "./communitiesRoutes.js";
import securityRoutes from "./securityRoutes.js";

const router = express.Router();

router.use(postsRoutes);
router.use(engagementRoutes);
router.use(usersRoutes);
router.use(messagingRoutes);
router.use(spacesRoutes);
router.use(discoveryRoutes);
router.use(listsRoutes);
router.use(communitiesRoutes);
router.use(securityRoutes);

export default router;

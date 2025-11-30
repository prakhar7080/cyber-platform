import express from "express";
import { getModuleById } from "../controllers/moduleController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:moduleId", authMiddleware, getModuleById);

export default router;


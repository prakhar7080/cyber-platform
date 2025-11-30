import express from "express";
import { generateCertificate, getCertificates } from "../controllers/certificateController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Generate certificate after course completion
router.post("/:enrollmentId", authMiddleware, generateCertificate);

// Get all certificates of logged-in user
router.get("/", authMiddleware, getCertificates);

export default router;

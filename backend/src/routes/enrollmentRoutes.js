import express from "express";
import {
  enroll,
  updateProgress,
  markCompleted,
  getMyEnrollments,
} from "../controllers/enrollmentController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Enroll user into a course
router.post("/:courseId", authMiddleware, enroll);

// Update module progress
router.patch("/:enrollmentId/progress", authMiddleware, updateProgress);

// Mark course as completed
router.patch("/:enrollmentId/complete", authMiddleware, markCompleted);

// Get all enrollments of logged-in user
router.get("/", authMiddleware, getMyEnrollments);

export default router;

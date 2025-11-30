import express from "express";
import {
  createCourse,
  getCourses,
  getCourseById,
  addSection,
  addModule,
} from "../controllers/courseController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Courses
router.post("/", authMiddleware, createCourse);
router.get("/", getCourses);
router.get("/:courseId", getCourseById);

// Sections
router.post("/:courseId/section", authMiddleware, addSection);

// Modules
router.post("/:courseId/section/:sectionId/module", authMiddleware, addModule);

export default router;

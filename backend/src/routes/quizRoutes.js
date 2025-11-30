// routes/quizRoutes.js
import express from "express";
import {
  addQuiz,
  submitQuiz,
  getQuiz,
  getCourseQuiz,
  submitCourseQuiz,
  addCourseQuiz,
} from "../controllers/quizController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Course-level quiz
router.post("/course/:courseId", authMiddleware, addCourseQuiz);
router.get("/course/:courseId", authMiddleware, getCourseQuiz);
router.post("/course/:courseId/submit", authMiddleware, submitCourseQuiz);

// Module-level quiz (legacy)
router.post("/:moduleId", authMiddleware, addQuiz);
router.get("/:moduleId", authMiddleware, getQuiz);
router.post("/:moduleId/submit", authMiddleware, submitQuiz);

export default router;

import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import Enrollment from "../models/Enrollment.js";
import { ensureCertificateForEnrollment } from "../services/certificateService.js";

const sanitizeQuiz = (quiz) => ({
  ...quiz,
  questions: quiz.questions.map(({ correctAnswer, ...rest }, idx) => ({
    ...rest,
    _id: rest._id || `q-${idx}`,
  })),
});

const normalizeId = (value) => {
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return value;
};

const evaluateQuiz = (quiz, answers) => {
  let score = 0;
  const totalQuestions = quiz.questions.length;

  answers.forEach(({ questionId, selectedOption }, idx) => {
    const question = questionId
      ? quiz.questions.id(questionId) || quiz.questions[idx]
      : quiz.questions[idx];
    if (!question) return;

    if (Number(selectedOption) === Number(question.correctAnswer)) {
      score += 1;
    }
  });

  const percentage = totalQuestions ? Math.round((score / totalQuestions) * 100) : 0;
  const passingScore = quiz.passingScore ?? 60;
  const passed = percentage >= passingScore;

  return { score, totalQuestions, percentage, passed };
};

export const addQuiz = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { questions, passingScore } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Questions are required" });
    }

    const quiz = await Quiz.findOneAndUpdate(
      { module: moduleId },
      {
        module: moduleId,
        questions,
        passingScore: passingScore ?? 50,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: "Quiz saved", quiz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error creating quiz" });
  }
};

export const addCourseQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { questions, passingScore } = req.body;

    if (!courseId || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "CourseId and questions are required" });
    }

    const quiz = await Quiz.findOneAndUpdate(
      { course: normalizeId(courseId) },
      {
        course: normalizeId(courseId),
        questions,
        passingScore: passingScore ?? 60,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: "Course quiz saved", quiz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error creating course quiz" });
  }
};

export const getQuiz = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const quiz = await Quiz.findOne({ module: moduleId }).lean();

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    res.json({ quiz: sanitizeQuiz(quiz) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching quiz" });
  }
};

export const getCourseQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const quiz = await Quiz.findOne({
      course: { $in: [normalizeId(courseId), courseId] },
    }).lean();

    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    res.json({ quiz: sanitizeQuiz(quiz) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching quiz" });
  }
};

export const submitQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { moduleId } = req.params;
    const { answers = [], enrollmentId } = req.body;

    const quiz = await Quiz.findOne({ module: moduleId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "Answers are required" });
    }

    const { score, totalQuestions, percentage, passed } = evaluateQuiz(quiz, answers);

    if (enrollmentId) {
      const enrollment = await Enrollment.findById(enrollmentId);
      if (enrollment && enrollment.user.toString() === userId) {
        const existing = enrollment.completedQuizzes.find(
          (entry) => entry.quiz.toString() === quiz._id.toString()
        );

        if (existing) {
          existing.score = percentage;
          existing.passed = passed;
        } else {
          enrollment.completedQuizzes.push({
            quiz: quiz._id,
            score: percentage,
            passed,
          });
        }

        if (
          passed &&
          !enrollment.completedModules.some((mod) => mod.toString() === moduleId)
        ) {
          enrollment.completedModules.push(moduleId);
        }

        await enrollment.save();
      }
    }

    res.json({
      message: passed ? "Quiz passed" : "Quiz failed",
      score,
      total: totalQuestions,
      percentage,
      passed,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error submitting quiz" });
  }
};

export const submitCourseQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    const { answers = [], enrollmentId } = req.body;

    const quiz = await Quiz.findOne({
      course: { $in: [normalizeId(courseId), courseId] },
    });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "Answers are required" });
    }

    const { score, totalQuestions, percentage, passed } = evaluateQuiz(quiz, answers);

    const enrollment =
      (enrollmentId && (await Enrollment.findById(enrollmentId).populate("course"))) ||
          (await Enrollment.findOne({
            user: userId,
            course: quiz.course || normalizeId(courseId),
          }).populate(
        "course"
      ));

    if (enrollment) {
      enrollment.finalQuizScore = percentage;
      enrollment.finalQuizPassed = passed;

      if (passed && enrollment.progress >= 100) {
        enrollment.isCompleted = true;
        if (!enrollment.completedAt) enrollment.completedAt = new Date();
        await ensureCertificateForEnrollment(enrollment);
      } else if (!passed) {
        enrollment.isCompleted = false;
        enrollment.completedAt = null;
      }

      await enrollment.save();
    }

    res.json({
      message: passed ? "Quiz passed" : "Quiz failed",
      score,
      total: totalQuestions,
      percentage,
      passed,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error submitting quiz" });
  }
};

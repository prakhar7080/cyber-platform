// controllers/enrollmentController.js
import mongoose from "mongoose";
import Enrollment from "../models/Enrollment.js";
import Course from "../models/Course.js";
import Section from "../models/Section.js";
import Module from "../models/Module.js";
import { ensureCertificateForEnrollment } from "../services/certificateService.js";

const CERT_THRESHOLD = 100;

const collectModuleIds = (sections = []) =>
  sections
    .flatMap((section) =>
      (section?.modules || []).map((mod) => {
        if (!mod) return null;
        if (typeof mod === "object" && mod._id) return mod._id.toString();
        return mod.toString();
      })
    )
    .filter(Boolean);

const getCourseModuleIds = async (courseId) => {
  const sections = await Section.find({ course: courseId }).select("_id modules").lean();
  const sectionIds = sections.map((section) => section._id);

  const moduleDocs = await Module.find({ section: { $in: sectionIds } })
    .select("_id")
    .lean();

  let moduleIds = moduleDocs.map((mod) => mod._id.toString());
  moduleIds = Array.from(new Set([...moduleIds, ...collectModuleIds(sections)]));

  if (moduleIds.length === 0) {
    const rawCourse = await Course.collection.findOne({
      _id: new mongoose.Types.ObjectId(courseId),
    });

    if (rawCourse?.sections) {
      moduleIds = collectModuleIds(rawCourse.sections);
    }
  }

  return moduleIds;
};

// ===============================
// ENROLL USER INTO A COURSE
// ===============================
export const enroll = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const existing = await Enrollment.findOne({ user: userId, course: courseId });
    if (existing)
      return res.json({ message: "Already enrolled", enrollment: existing });

    const enrollment = await Enrollment.create({
      user: userId,
      course: courseId,
      completedModules: [],
      isCompleted: false,
    });

    res.status(201).json({ message: "Enrolled successfully", enrollment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error enrolling user" });
  }
};

// ===============================
// UPDATE PROGRESS (MARK MODULE COMPLETED)
// ===============================
export const updateProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { enrollmentId } = req.params;
    const { moduleId } = req.body;

    const enrollment = await Enrollment.findById(enrollmentId).populate("course");
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });

    if (enrollment.user.toString() !== userId)
      return res.status(403).json({ message: "Unauthorized" });

    const moduleIds = await getCourseModuleIds(enrollment.course._id);

    if (!moduleIds.length) {
      return res.status(400).json({ message: "No modules found for this course" });
    }

    const moduleIdStr = moduleId.toString();
    if (!moduleIds.includes(moduleIdStr)) {
      return res.status(400).json({ message: "Module does not belong to this course" });
    }

    if (!enrollment.completedModules.includes(moduleIdStr)) {
      enrollment.completedModules.push(moduleIdStr);
    }

    const totalModules = moduleIds.length;
    const completedSet = new Set(enrollment.completedModules.map((id) => id.toString()));
    const validCompleted = moduleIds.filter((id) => completedSet.has(id)).length;

    const computedProgress =
      totalModules > 0 ? Math.min(100, Math.round((validCompleted / totalModules) * 100)) : 0;

    enrollment.progress = computedProgress;

    const progressMet = totalModules > 0 && computedProgress >= CERT_THRESHOLD;
    const requirementsMet = progressMet && enrollment.finalQuizPassed;

    if (requirementsMet) {
      enrollment.isCompleted = true;
      if (!enrollment.completedAt) {
        enrollment.completedAt = new Date();
      }
    } else {
      enrollment.isCompleted = false;
      enrollment.completedAt = null;
    }

    await enrollment.save();

    if (enrollment.isCompleted) {
      await ensureCertificateForEnrollment(enrollment);
    }

    res.json({ message: "Progress updated", enrollment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating progress" });
  }
};

// ===============================
// MARK COURSE COMPLETED
// ===============================
export const markCompleted = async (req, res) => {
  try {
    const userId = req.user.id;
    const { enrollmentId } = req.params;

    const enrollment = await Enrollment.findById(enrollmentId).populate("course");
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });

    if (enrollment.user.toString() !== userId)
      return res.status(403).json({ message: "Unauthorized" });

    enrollment.finalQuizPassed = true;
    enrollment.finalQuizScore = 100;
    enrollment.isCompleted = true;
    enrollment.completedAt = new Date();
    enrollment.progress = 100;

    await enrollment.save();

    await ensureCertificateForEnrollment(enrollment);

    res.json({ message: "Course marked as completed", enrollment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error marking completion" });
  }
};

// ===============================
// GET ALL USER ENROLLMENTS
// ===============================
export const getMyEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;

    const enrollments = await Enrollment.find({ user: userId })
      .populate("course", "title description thumbnail");

    res.json({ enrollments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching enrollments" });
  }
};

// controllers/courseController.js
import mongoose from "mongoose";
import Course from "../models/Course.js";
import Section from "../models/Section.js";
import Module from "../models/Module.js";

const hydrateEmbeddedSections = async (sections = []) => {
  if (!Array.isArray(sections) || sections.length === 0) return [];

  const moduleIdsToFetch = [];
  sections.forEach((section) => {
    (section?.modules || []).forEach((module) => {
      if (!module) return;

      if (
        typeof module === "string" ||
        module instanceof mongoose.Types.ObjectId ||
        mongoose.isValidObjectId(module)
      ) {
        moduleIdsToFetch.push(module.toString());
      } else if (module._id && !module.title) {
        moduleIdsToFetch.push(module._id.toString());
      }
    });
  });

  let moduleMap = new Map();
  if (moduleIdsToFetch.length) {
    const uniqueIds = [...new Set(moduleIdsToFetch)];
    const moduleDocs = await Module.find({ _id: { $in: uniqueIds } }).lean();
    moduleMap = new Map(moduleDocs.map((doc) => [doc._id.toString(), doc]));
  }

  return sections.map((section) => {
    const normalizedModules = (section.modules || [])
      .map((module) => {
        if (!module) return null;

        if (
          typeof module === "string" ||
          module instanceof mongoose.Types.ObjectId ||
          mongoose.isValidObjectId(module)
        ) {
          return moduleMap.get(module.toString()) || null;
        }

        if (module._id) {
          const cached = moduleMap.get(module._id.toString());
          if (cached) return cached;
        }

        return module;
      })
      .filter(Boolean);

    return {
      ...section,
      modules: normalizedModules,
    };
  });
};

// ===============================
// CREATE COURSE
// ===============================
export const createCourse = async (req, res) => {
  try {
    const { title, description, thumbnail, tags } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description required" });
    }

    const course = await Course.create({
      title,
      description,
      thumbnail: thumbnail || "",
      tags: tags || [],
      instructor: req.user?._id ?? req.user?.id ?? null,
    });

    res.json({ message: "Course created", course });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error creating course" });
  }
};

// ===============================
// GET ALL COURSES
// ===============================
export const getCourses = async (req, res) => {
  try {
    const courses = await Course.find().select("title description thumbnail tags createdAt");
    res.json({ courses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching courses" });
  }
};

// ===============================
// GET COURSE BY ID (with sections)
// ===============================
export const getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId)
      .populate("instructor", "name email")
      .lean();

    if (!course) return res.status(404).json({ message: "Course not found" });

    const rawCourse = await Course.collection.findOne({
      _id: new mongoose.Types.ObjectId(courseId),
    });

    const embeddedSections = rawCourse?.sections;

    const hasEmbeddedSections =
      Array.isArray(embeddedSections) &&
      embeddedSections.some(
        (section) => section && typeof section === "object" && (section.title || section.modules)
      );

    if (hasEmbeddedSections) {
      const hydrated = await hydrateEmbeddedSections(embeddedSections);
      return res.json({ course, sections: hydrated });
    }

    const sections = await Section.find({ course: courseId }).lean();

    const sectionIds = sections.map((section) => section._id);
    const modules = await Module.find({ section: { $in: sectionIds } })
      .select("title content videoUrl createdAt section")
      .lean();

    const modulesBySection = modules.reduce((acc, module) => {
      const key = module.section?.toString();
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(module);
      return acc;
    }, {});

    const normalizedSections = sections.map((section) => {
      const key = section._id.toString();
      const populatedModules = modulesBySection[key];
      return {
        ...section,
        modules: populatedModules?.length
          ? populatedModules
          : section.modules || [],
      };
    });

    res.json({ course, sections: normalizedSections });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching course" });
  }
};

// ===============================
// UPDATE COURSE
// ===============================
export const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const updated = await Course.findByIdAndUpdate(courseId, { $set: req.body }, { new: true });

    if (!updated) return res.status(404).json({ message: "Course not found" });

    res.json({ message: "Course updated", updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error updating course" });
  }
};

// ===============================
// DELETE COURSE
// ===============================
export const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Delete related sections
    await Section.deleteMany({ course: courseId });
    await Course.findByIdAndDelete(courseId);

    res.json({ message: "Course deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error deleting course" });
  }
};

// ===============================
// ADD MODULE TO SECTION
// ===============================
export const addModule = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { title, content, videoUrl } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const section = await Section.findById(sectionId);
    if (!section) return res.status(404).json({ message: "Section not found" });

    const module = await Module.create({
      title,
      content: content ?? "",
      videoUrl: videoUrl ?? "",
      section: sectionId,
    });

    section.modules.push(module._id);
    await section.save();

    res.status(201).json({ message: "Module added", module });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error adding module" });
  }
};
// ===============================
// ADD SECTION TO COURSE
// ===============================
export const addSection = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const section = await Section.create({
      title,
      description: description ?? "",
      course: courseId,
    });

    course.sections.push(section._id);
    await course.save();

    res.status(201).json({ message: "Section added", section });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error adding section" });
  }
};


import mongoose from "mongoose";
import Course from "../models/Course.js";
import Module from "../models/Module.js";

const findEmbeddedModule = (course, moduleId) => {
  if (!course?.sections) return null;

  for (const section of course.sections) {
    if (!section?.modules) continue;

    for (const module of section.modules) {
      if (!module) continue;

      const moduleIdStr = module._id?.toString() || module.id?.toString();
      if (moduleIdStr === moduleId.toString()) {
        return {
          ...module,
          section: {
            _id: section._id,
            title: section.title,
            course: {
              _id: course._id,
              title: course.title,
              thumbnail: course.thumbnail || "",
            },
          },
        };
      }
    }
  }

  return null;
};

export const getModuleById = async (req, res) => {
  try {
    const { moduleId } = req.params;

    const moduleDoc = await Module.findById(moduleId).populate({
      path: "section",
      populate: {
        path: "course",
        select: "title thumbnail",
      },
    });

    if (moduleDoc) {
      return res.json({ module: moduleDoc });
    }

    const course = await Course.collection.findOne({
      "sections.modules._id": new mongoose.Types.ObjectId(moduleId),
    });

    if (!course) {
      return res.status(404).json({ message: "Module not found" });
    }

    const embeddedModule = findEmbeddedModule(course, new mongoose.Types.ObjectId(moduleId));
    if (!embeddedModule) {
      return res.status(404).json({ message: "Module not found" });
    }

    return res.json({ module: embeddedModule });
  } catch (error) {
    console.error("Failed to fetch module:", error);
    res.status(500).json({ message: "Server error fetching module" });
  }
};


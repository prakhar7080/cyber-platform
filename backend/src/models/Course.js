import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true
    },

    category: {
      type: String,
      default: "Cyber Security"
    },

    thumbnail: {
      type: String,
      default: ""
    },

    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false
    },

    sections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Section"
      }
    ]
  },
  { timestamps: true }
);

const Course = mongoose.model("Course", courseSchema);
export default Course;

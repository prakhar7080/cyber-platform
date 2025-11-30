import mongoose from "mongoose";

const moduleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    content: {
      type: String,
      default: ""
    },

    videoUrl: {
      type: String,
      default: ""
    },

    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true
    }
  },
  { timestamps: true }
);

const Module = mongoose.model("Module", moduleSchema);
export default Module;

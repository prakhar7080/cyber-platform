// models/Certificate.js
import mongoose from "mongoose";

const CertificateSchema = new mongoose.Schema(
  {
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    fileUrl: {
      type: String,
      default: "",
    },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CertificateSchema.index({ enrollment: 1 }, { unique: true });
CertificateSchema.index({ user: 1, course: 1 }, { unique: true });

export default mongoose.model("Certificate", CertificateSchema);

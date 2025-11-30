import Certificate from "../models/Certificate.js";
import { generateCertificatePdf } from "../utils/certificateGenerator.js";

const populateFields = [
  { path: "course", select: "title description" },
  { path: "user", select: "name email" },
];

/**
 * Ensure a certificate exists for a given enrollment.
 * If missing, generate PDF, push to GitHub, and save URL.
 * @param {Object} enrollment - MongoDB enrollment document
 * @returns {Promise<Object|null>} - Certificate document with fileUrl
 */
export const ensureCertificateForEnrollment = async (enrollment) => {
  if (!enrollment) return null;

  // 1️⃣ Check if certificate already exists
  let certificate = await Certificate.findOne({ enrollment: enrollment._id }).populate(populateFields);

  // 2️⃣ Create certificate if missing
  if (!certificate) {
    certificate = await Certificate.create({
      user: enrollment.user,
      course: enrollment.course._id || enrollment.course,
      enrollment: enrollment._id,
    });

    certificate = await certificate.populate(populateFields);
  }

  // 3️⃣ Generate & upload PDF if fileUrl is missing
  if (!certificate.fileUrl) {
    try {
      // Generate PDF and upload to GitHub → returns public URL
      const fileUrl = await generateCertificatePdf({
        certificateId: certificate._id.toString(),
        userName: certificate.user?.name || "Learner",
        courseTitle: certificate.course?.title || "Course Certificate",
        issuedAt: certificate.issuedAt,
      });

      // Save public URL to DB
      certificate.fileUrl = fileUrl;
      await certificate.save();
    } catch (err) {
      console.error("Certificate generation/upload failed:", err);
      throw new Error("Failed to generate or upload certificate PDF to GitHub");
    }
  }

  return certificate;
};

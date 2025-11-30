// controllers/certificateController.js
import Certificate from "../models/Certificate.js";
import Enrollment from "../models/Enrollment.js";
import { ensureCertificateForEnrollment } from "../services/certificateService.js";

// ===============================
// GENERATE CERTIFICATE AFTER COURSE COMPLETION
// ===============================
export const generateCertificate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { enrollmentId } = req.params;

    const enrollment = await Enrollment.findById(enrollmentId).populate("course");
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });

    if (!enrollment.isCompleted)
      return res.status(400).json({ message: "Course not completed yet" });

    const certificate = await ensureCertificateForEnrollment(enrollment);

    res.json({ message: "Certificate generated", certificate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error generating certificate" });
  }
};

// ===============================
// GET ALL CERTIFICATES FOR A USER
// ===============================
export const getCertificates = async (req, res) => {
  try {
    const userId = req.user.id;

    const certificates = await Certificate.find({ user: userId })
      .populate("course", "title description")
      .populate("user", "name email")
      .sort({ issuedAt: -1 });

    await Promise.all(
      certificates.map(async (cert) => {
        if (cert.fileUrl) return;
        try {
          const enrollment = await Enrollment.findById(cert.enrollment).populate("course");
          if (enrollment) {
            await ensureCertificateForEnrollment(enrollment);
          }
        } catch (error) {
          console.error("Failed to refresh certificate file:", error);
        }
      })
    );

    const refreshed = await Certificate.find({ user: userId })
      .populate("course", "title description")
      .populate("user", "name email")
      .sort({ issuedAt: -1 });

    const uniqueByCourse = [];
    const seen = new Set();

    refreshed.forEach((cert) => {
      const key = cert.course?._id?.toString() || cert.course?.toString();
      if (key && seen.has(key)) return;
      if (key) seen.add(key);
      uniqueByCourse.push(cert);
    });

    res.json({ certificates: uniqueByCourse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching certificates" });
  }
};

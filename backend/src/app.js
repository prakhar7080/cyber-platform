import express from "express";
import cors from "cors";
import "./config/env.js";

import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import enrollmentRoutes from "./routes/enrollmentRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import moduleRoutes from "./routes/moduleRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";

const app = express();

// CORS configuration
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://cyber-platform-frontend.vercel.app"
];

const envOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS?.split(",") || [])
].filter(Boolean).map((origin) => origin.trim());

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

// Middleware
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/modules", moduleRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/support", supportRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("Cyber Awareness Training API is running...");
});

export default app;
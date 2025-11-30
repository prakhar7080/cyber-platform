import fs from "fs";
import "./config/env.js";
import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5000;

console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Found' : 'Not found');

// Global error handlers
process.on('uncaughtException', (err) => {
  fs.appendFileSync('error.log', `Uncaught Exception: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  fs.appendFileSync('error.log', `Unhandled Rejection at: ${promise} reason: ${reason}\n`);
  process.exit(1);
});

connectDB()
  .then(() => {
    console.log("MongoDB Connected");
    try {
      fs.appendFileSync('server.log', 'MongoDB Connected\n');
    } catch (e) { console.error("Failed to write to log", e); }

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      try {
        fs.appendFileSync('server.log', `Server running on http://localhost:${PORT}\n`);
      } catch (e) { console.error("Failed to write to log", e); }
    });
  })
  .catch((err) => {
    try {
      fs.appendFileSync('error.log', `Database connection failed: ${err.message}\n`);
    } catch (e) { console.error("Failed to write to log", e); }
    console.error("Database connection failed:", err.message);
    process.exit(1);
  });
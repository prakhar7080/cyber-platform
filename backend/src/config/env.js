import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
// Look for .env in the backend root directory (two levels up from config)
dotenv.config({ path: join(__dirname, "../../.env") });

// Validate required environment variables
const requiredEnvVars = [
  "MONGODB_URI",
  "JWT_SECRET",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(
    `⚠️  Warning: Missing required environment variables: ${missingVars.join(", ")}`
  );
  console.warn(
    "Please create a .env file in the backend root directory with these variables."
  );
}

// Export environment variables for easy access (optional)
export default {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
  FRONTEND_URLS: process.env.FRONTEND_URLS,
  OTP_EXPIRY_MINUTES: Number(process.env.OTP_EXPIRY_MINUTES) || 10,
  EXPOSE_DEBUG_OTP: process.env.EXPOSE_DEBUG_OTP,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
};


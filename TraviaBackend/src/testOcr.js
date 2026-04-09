require("dotenv").config();

const path = require("path");
const { extractLicenseWithGemini } = require("./services/geminiOcrService");

async function run() {
  try {
    const imagePath = path.join(__dirname, "../test-license.jpeg");

    console.log("Running Gemini OCR...\n");

    const result = await extractLicenseWithGemini(imagePath);

    console.log("========== GEMINI RESULT ==========\n");
    console.log(result);
    console.log("\n===================================");
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

run();
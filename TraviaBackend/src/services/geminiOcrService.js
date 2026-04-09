const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function buildPrompt({ category, side }) {
  const common = `
Return ONLY valid JSON. No markdown. No extra text.
If a field is not visible, use null.
Add a confidence number between 0 and 1.
Add short quality notes if the image is blurry, cropped, or unreadable.
`;

  if (category === "cnic") {
    return `
You are an OCR system for a Pakistani CNIC ${side} image.

Extract these fields:
{
  "documentCategory": "cnic",
  "side": "${side}",
  "isLegible": true,
  "confidence": 0.95,
  "qualityNotes": [],
  "fields": {
    "cnicNumber": "",
    "name": "",
    "fatherName": "",
    "dateOfBirth": "",
    "issueDate": "",
    "expiryDate": "",
    "address": ""
  }
}

Rules:
- CNIC number must be 13 digits if visible
- Dates should be YYYY-MM-DD when possible
- Keep the JSON compact and strict
${common}
`;
  }

  if (category === "license") {
    return `
You are an OCR system for a Pakistani driving license ${side} image.

Extract these fields:
{
  "documentCategory": "license",
  "side": "${side}",
  "isLegible": true,
  "confidence": 0.95,
  "qualityNotes": [],
  "fields": {
    "licenseNumber": "",
    "cnicNumber": "",
    "name": "",
    "fatherName": "",
    "dateOfBirth": "",
    "issueDate": "",
    "expiryDate": "",
    "categories": [],
    "address": ""
  }
}

Rules:
- CNIC number must be 13 digits if visible
- Dates should be YYYY-MM-DD when possible
- categories should be an array of driving classes when visible
${common}
`;
  }

  return `
You are an OCR system for a Pakistani vehicle registration card ${side} image.

Extract these fields:
{
  "documentCategory": "registration",
  "side": "${side}",
  "isLegible": true,
  "confidence": 0.95,
  "qualityNotes": [],
  "fields": {
    "registrationNumber": "",
    "ownerName": "",
    "vehicleMake": "",
    "vehicleModel": "",
    "vehicleColor": "",
    "chassisNumber": "",
    "engineNumber": "",
    "registrationDate": "",
    "expiryDate": ""
  }
}

Rules:
- Dates should be YYYY-MM-DD when possible
- Keep the JSON strict and compact
${common}
`;
}

async function loadImageBuffer(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await axios.get(source, { responseType: "arraybuffer" });
    return Buffer.from(response.data);
  }

  return fs.readFileSync(path.resolve(source));
}

function cleanJsonResponse(text) {
  return text.replace(/```json|```/g, "").trim();
}

async function extractDocumentWithGemini({ imageSource, category, side }) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const imageBuffer = await loadImageBuffer(imageSource);
  const prompt = buildPrompt({ category, side });

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType: "image/jpeg",
      },
    },
  ]);

  const response = await result.response;
  const text = response.text();
  const cleaned = cleanJsonResponse(text);

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.log("Gemini raw response:", text);
    throw new Error("Failed to parse Gemini response");
  }
}

async function extractLicenseWithGemini(imagePath) {
  return extractDocumentWithGemini({
    imageSource: imagePath,
    category: "license",
    side: "front",
  });
}

module.exports = {
  extractDocumentWithGemini,
  extractLicenseWithGemini,
};

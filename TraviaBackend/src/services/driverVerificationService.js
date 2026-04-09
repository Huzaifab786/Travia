const prisma = require("../config/db");
const supabaseAdmin = require("../config/supabaseAdmin");
const { extractDocumentWithGemini } = require("./geminiOcrService");

const REQUIRED_DOCUMENTS = {
  cnic: ["front", "back"],
  license: ["front", "back"],
  registration: ["front", "back"],
};

const DOCUMENT_ORDER = ["cnic", "license", "registration"];

function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

function normalizeDigits(value) {
  return (value || "").toString().replace(/\D/g, "");
}

function tokenizeName(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z]/g, ""))
    .filter(Boolean);
}

function namesLookCompatible(left, right) {
  const leftTokens = tokenizeName(left);
  const rightTokens = tokenizeName(right);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longer = leftTokens.length > rightTokens.length ? leftTokens : rightTokens;
  const matches = shorter.filter((token) =>
    longer.some((candidate) => candidate === token || candidate.startsWith(token) || token.startsWith(candidate)),
  ).length;

  return matches / shorter.length >= 0.7;
}

function getSingleReason(reasons) {
  return reasons.find(Boolean) || null;
}

function formatIssueList(issues) {
  return issues.map((issue) => issue.reason).join(" ");
}

function findDocumentIssue(issues, category, side) {
  return getSingleReason(
    issues
      .filter((issue) => issue.category === category && issue.side === side)
      .map((issue) => issue.reason),
  );
}

function parseIncomingDocument(doc) {
  const category = (doc.category || doc.type || "")
    .toString()
    .trim()
    .toLowerCase();
  const side = (doc.side || "").toString().trim().toLowerCase();
  const type = (doc.type || `${category}_${side}`).toString().trim();

  if (!REQUIRED_DOCUMENTS[category] || !REQUIRED_DOCUMENTS[category].includes(side)) {
    const err = new Error(
      "Each document must include a valid category and side (cnic/license/registration, front/back)",
    );
    err.statusCode = 400;
    throw err;
  }

  if (!doc.url) {
    const err = new Error("Document URL is required");
    err.statusCode = 400;
    throw err;
  }

  return {
    category,
    side,
    type,
    url: doc.url,
    path: doc.path || null,
  };
}

function groupDocuments(documents) {
  const grouped = {
    cnic: {},
    license: {},
    registration: {},
  };

  for (const document of documents) {
    grouped[document.category][document.side] = document;
  }

  return grouped;
}

function getMissingDocuments(grouped) {
  const missing = [];

  for (const category of DOCUMENT_ORDER) {
    for (const side of REQUIRED_DOCUMENTS[category]) {
      if (!grouped[category][side]) {
        missing.push(`${category} ${side}`);
      }
    }
  }

  return missing;
}

function buildExtractionSummary(document, extracted) {
  return {
    id: document.id,
    category: document.category,
    side: document.side,
    type: document.type,
    url: document.url,
    path: document.path,
    extraction: extracted,
  };
}

function validateVerification(grouped) {
  const cnicFront = grouped.cnic.front?.ocrResult || {};
  const cnicBack = grouped.cnic.back?.ocrResult || {};
  const licenseFront = grouped.license.front?.ocrResult || {};
  const licenseBack = grouped.license.back?.ocrResult || {};
  const registrationFront = grouped.registration.front?.ocrResult || {};
  const registrationBack = grouped.registration.back?.ocrResult || {};

  const issues = [];

  const cnicNumber =
    normalizeDigits(cnicFront?.fields?.cnicNumber) ||
    normalizeDigits(cnicBack?.fields?.cnicNumber) ||
    normalizeDigits(licenseFront?.fields?.cnicNumber);

  const licenseNumber =
    (licenseFront?.fields?.licenseNumber || "").toString().trim() ||
    (licenseBack?.fields?.licenseNumber || "").toString().trim();

  const registrationNumber =
    (registrationFront?.fields?.registrationNumber || "").toString().trim() ||
    (registrationBack?.fields?.registrationNumber || "").toString().trim();

  const normalizedName = normalizeText(cnicFront?.fields?.name || licenseFront?.fields?.name);
  const licenseName = normalizeText(licenseFront?.fields?.name || licenseBack?.fields?.name);

  const qualityScores = [
    grouped.cnic.front?.ocrResult?.confidence,
    grouped.cnic.back?.ocrResult?.confidence,
    grouped.license.front?.ocrResult?.confidence,
    grouped.license.back?.ocrResult?.confidence,
    grouped.registration.front?.ocrResult?.confidence,
    grouped.registration.back?.ocrResult?.confidence,
  ].filter((value) => typeof value === "number");

  const lowConfidence = qualityScores.some((score) => score < 0.55);

  if (lowConfidence) {
    issues.push({
      category: "all",
      side: "all",
      reason: "One or more document images were too blurry or too low quality for reliable OCR.",
    });
  }

  if (!cnicNumber || cnicNumber.length !== 13) {
    issues.push({
      category: "cnic",
      side: "front",
      reason: "CNIC number could not be read clearly from the uploaded CNIC images.",
    });
  }

  if (!licenseNumber) {
    issues.push({
      category: "license",
      side: "front",
      reason: "Driving license number could not be read clearly from the license image.",
    });
  }

  if (!registrationNumber) {
    issues.push({
      category: "registration",
      side: "front",
      reason: "Vehicle registration number could not be read clearly from the registration card.",
    });
  }

  const licenseCnic =
    normalizeDigits(licenseFront?.fields?.cnicNumber) ||
    normalizeDigits(licenseBack?.fields?.cnicNumber);

  if (licenseCnic && licenseCnic !== cnicNumber) {
    issues.push({
      category: "license",
      side: "front",
      reason: "The CNIC number on the driving license does not match the CNIC card.",
    });
  }

  if (normalizedName && licenseName && !namesLookCompatible(normalizedName, licenseName)) {
    issues.push({
      category: "license",
      side: "front",
      reason: "The name on the driving license does not closely match the name on the CNIC.",
    });
  }

  const registrationOwner = normalizeText(
    registrationFront?.fields?.ownerName || registrationBack?.fields?.ownerName,
  );
  if (!registrationOwner) {
    issues.push({
      category: "registration",
      side: "front",
      reason: "The registration card owner name could not be read clearly.",
    });
  }

  const registrationDetailsPresent =
    (registrationFront?.fields?.vehicleMake || registrationBack?.fields?.vehicleMake) &&
    (registrationFront?.fields?.vehicleModel || registrationBack?.fields?.vehicleModel);

  if (!registrationDetailsPresent) {
    issues.push({
      category: "registration",
      side: "back",
      reason: "The registration card does not clearly show the vehicle make and model.",
    });
  }

  if (!cnicFront?.fields?.name && !licenseFront?.fields?.name) {
    issues.push({
      category: "cnic",
      side: "front",
      reason: "The driver name could not be read clearly from the CNIC or license.",
    });
  }

  if (issues.length > 0) {
    return {
      decision: "rejected",
      reason: formatIssueList(issues),
      issues,
    };
  }

  return {
    decision: "approved",
    reason: "All uploaded documents were readable and consistent.",
    issues: [],
  };
}

async function deleteStoredDocuments(documents) {
  const paths = documents.map((doc) => doc.path).filter(Boolean);

  if (paths.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin.storage.from("documents").remove(paths);

  if (error) {
    console.warn("Failed to remove old driver documents:", error.message);
  }
}

async function persistAiResults({ verificationId, documents, analysis, userId }) {
  const grouped = groupDocuments(documents);

  const docUpdates = documents.map((document) => ({
    where: { id: document.id },
    data: {
      ocrResult: document.ocrResult,
      ocrStatus: analysis.decision,
      ocrReason:
        document.ocrReason ||
        findDocumentIssue(analysis.issues || [], document.category, document.side) ||
        analysis.reason,
    },
  }));

  await prisma.$transaction(async (tx) => {
    for (const update of docUpdates) {
      await tx.driverDocument.update(update);
    }

    await tx.driverVerification.update({
      where: { id: verificationId },
      data: {
        autoDecision: analysis.decision,
        autoReason: analysis.reason,
        autoResult: {
          decision: analysis.decision,
          reason: analysis.reason,
          issues: analysis.issues || [],
          documents: DOCUMENT_ORDER.flatMap((category) =>
            REQUIRED_DOCUMENTS[category].map((side) => {
              const document = grouped[category][side];
              return document
                ? buildExtractionSummary(document, document.ocrResult)
                : null;
            }),
          ).filter(Boolean),
        },
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        driverStatus: analysis.decision === "approved" ? "verified" : "rejected",
        driverRejectionReason:
          analysis.decision === "rejected" ? analysis.reason : null,
      },
    });
  });
}

async function generateAiAssessment(documents, userName) {
  const grouped = groupDocuments(documents);
  const missingDocuments = getMissingDocuments(grouped);

  if (missingDocuments.length > 0) {
    return {
      decision: "rejected",
      reason: `Missing required documents: ${missingDocuments.join(", ")}`,
      issues: missingDocuments.map((item) => ({
        category: "all",
        side: "all",
        reason: `Missing required document: ${item}.`,
      })),
    };
  }

  for (const document of documents) {
    if (!document.url) {
      return {
        decision: "rejected",
        reason: "One or more document URLs were missing.",
      };
    }
  }

  const extractedDocuments = [];

  for (const category of DOCUMENT_ORDER) {
    for (const side of REQUIRED_DOCUMENTS[category]) {
      const document = grouped[category][side];
      try {
        const extracted = await extractDocumentWithGemini({
          imageSource: document.url,
          category,
          side,
        });

        document.ocrResult = extracted;
        document.ocrReason = null;
        extractedDocuments.push(document);
      } catch (error) {
        document.ocrResult = {
          documentCategory: category,
          side,
          isLegible: false,
          confidence: 0,
          qualityNotes: [error.message || "OCR failed"],
          fields: {},
        };
        document.ocrReason = `Gemini OCR failed for ${category} ${side}.`;

        return {
          decision: "rejected",
          reason: `Gemini OCR failed for ${category} ${side}.`,
          issues: [
            {
              category,
              side,
              reason: `Gemini OCR failed for the ${category} ${side} image.`,
            },
          ],
          documents: extractedDocuments.concat([document]),
        };
      }
    }
  }

  const analysis = validateVerification(grouped, userName);
  documents.forEach((document) => {
    if (!document.ocrReason) {
      document.ocrReason = findDocumentIssue(
        analysis.issues || [],
        document.category,
        document.side,
      );
    }
  });
  return {
    ...analysis,
    documents,
  };
}

async function submitDriverVerification(userId, incomingDocuments) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  const documents = incomingDocuments.map(parseIncomingDocument);

  const oldVerification = await prisma.driverVerification.findUnique({
    where: { userId },
    include: { documents: true },
  });

  if (oldVerification) {
    await deleteStoredDocuments(oldVerification.documents);
    await prisma.driverVerification.delete({
      where: { userId },
    });
  }

  const verification = await prisma.driverVerification.create({
    data: {
      userId,
      autoDecision: "pending",
      adminDecision: "pending",
    },
  });

  await prisma.driverDocument.createMany({
    data: documents.map((document) => ({
      userId,
      verificationId: verification.id,
      category: document.category,
      side: document.side,
      type: document.type,
      url: document.url,
      path: document.path,
      ocrStatus: "pending",
    })),
  });

  const savedVerification = await prisma.driverVerification.findUnique({
    where: { id: verification.id },
    include: { documents: true },
  });

  const analysis = await generateAiAssessment(savedVerification.documents, user.name);

  await persistAiResults({
    verificationId: verification.id,
    documents: analysis.documents || savedVerification.documents,
    analysis,
    userId,
  });

  const updatedVerification = await prisma.driverVerification.findUnique({
    where: { id: verification.id },
    include: {
      documents: {
        orderBy: [
          { category: "asc" },
          { side: "asc" },
        ],
      },
    },
  });

  return {
    message:
      analysis.decision === "approved"
        ? "Documents verified successfully."
        : "Documents uploaded but failed verification.",
    verification: formatVerification(updatedVerification),
  };
}

function formatVerification(verification) {
  if (!verification) {
    return null;
  }

  return {
    id: verification.id,
    userId: verification.userId,
    autoDecision: verification.autoDecision,
    autoReason: verification.autoReason,
    autoResult: verification.autoResult,
    adminDecision: verification.adminDecision,
    adminReason: verification.adminReason,
    reviewedByAdminId: verification.reviewedByAdminId,
    reviewedAt: verification.reviewedAt,
    createdAt: verification.createdAt,
    updatedAt: verification.updatedAt,
    documents: (verification.documents || []).map((document) => ({
      id: document.id,
      category: document.category,
      side: document.side,
      type: document.type,
      url: document.url,
      path: document.path,
      ocrResult: document.ocrResult,
      ocrStatus: document.ocrStatus,
      ocrReason: document.ocrReason,
      createdAt: document.createdAt,
    })),
  };
}

async function getDriverVerificationStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      driverStatus: true,
      driverRejectionReason: true,
      driverVerification: {
        include: {
          documents: {
            orderBy: [
              { category: "asc" },
              { side: "asc" },
            ],
          },
        },
      },
    },
  });

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  return {
    status: user.driverStatus,
    rejectionReason: user.driverRejectionReason,
    verification: formatVerification(user.driverVerification),
  };
}

async function getDriverVerificationDetail(driverId) {
  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      driverStatus: true,
      driverRejectionReason: true,
      createdAt: true,
      driverVerification: {
        include: {
          documents: {
            orderBy: [
              { category: "asc" },
              { side: "asc" },
            ],
          },
        },
      },
      vehicle: {
        select: { carModel: true, carType: true, engineCC: true },
      },
      _count: { select: { rides: true } },
    },
  });

  if (!driver || driver.role !== "driver") {
    const err = new Error("Driver not found");
    err.statusCode = 404;
    throw err;
  }

  return {
    driver: {
      ...driver,
      driverVerification: formatVerification(driver.driverVerification),
    },
  };
}

async function reviewDriverVerification(adminId, driverId, action, reason) {
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, role: true, name: true },
  });

  if (!admin || admin.role !== "admin") {
    const err = new Error("Admin not found");
    err.statusCode = 404;
    throw err;
  }

  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      name: true,
      role: true,
      driverVerification: {
        include: { documents: true },
      },
    },
  });

  if (!driver || driver.role !== "driver") {
    const err = new Error("Driver not found");
    err.statusCode = 404;
    throw err;
  }

  if (!driver.driverVerification) {
    const err = new Error("Driver verification record not found");
    err.statusCode = 404;
    throw err;
  }

  const adminDecision = action === "approve" ? "approved" : "suspended";

  const updated = await prisma.$transaction(async (tx) => {
    const verification = await tx.driverVerification.update({
      where: { userId: driverId },
      data: {
        adminDecision,
        adminReason: reason || null,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
      },
      include: {
        documents: {
          orderBy: [
            { category: "asc" },
            { side: "asc" },
          ],
        },
      },
    });

    await tx.user.update({
      where: { id: driverId },
      data: {
        driverStatus: action === "approve" ? "verified" : "suspended",
        driverRejectionReason: action === "approve" ? null : reason || null,
      },
    });

    return verification;
  });

  return {
    message:
      action === "approve"
        ? `Driver ${driver.name} approved successfully`
        : `Driver ${driver.name} suspended successfully`,
    driver: {
      id: driver.id,
      name: driver.name,
      driverStatus: action === "approve" ? "verified" : "suspended",
      driverVerification: formatVerification(updated),
    },
  };
}

module.exports = {
  submitDriverVerification,
  getDriverVerificationStatus,
  getDriverVerificationDetail,
  reviewDriverVerification,
  formatVerification,
};

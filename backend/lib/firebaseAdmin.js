import admin from "firebase-admin";
import fs from "fs";

const resolveServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      return null;
    }
  }

  const candidatePaths = [process.env.FIREBASE_SERVICE_ACCOUNT_PATH].filter(
    Boolean,
  );

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        return JSON.parse(fs.readFileSync(candidate, "utf8"));
      } catch {
        return null;
      }
    }
  }

  return null;
};

const ensureFirebaseAdmin = () => {
  if (admin.apps.length) return true;
  const serviceAccount = resolveServiceAccount();
  if (!serviceAccount) return false;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return true;
};

export const getFirebaseAuth = () => {
  if (!ensureFirebaseAdmin()) {
    const error = new Error("Firebase admin is not configured");
    error.statusCode = 500;
    throw error;
  }

  return admin.auth();
};

export const verifyFirebaseToken = async (req, res, next) => {
  if (!ensureFirebaseAdmin()) {
    return res
      .status(500)
      .json({ message: "Firebase admin is not configured" });
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

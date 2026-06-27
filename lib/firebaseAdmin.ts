import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";

/**
 * Cache the Firebase app instance in module scope so serverless cold starts
 * create at most one app per runtime process.
 */
let cachedApp: App | undefined;

/**
 * Build Firebase service-account credentials from environment variables.
 * The private key replacement handles escaped newlines from .env files.
 */
function getFirebaseServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    );
  }

  return { projectId, clientEmail, privateKey };
}

/**
 * Return a singleton Firebase Admin app for Next.js server execution.
 */
export function getFirebaseAdminApp(): App {
  if (cachedApp) {
    return cachedApp;
  }

  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  cachedApp = initializeApp({
    credential: cert(getFirebaseServiceAccount()),
  });

  return cachedApp;
}

/**
 * Return Firestore bound to the singleton Admin app.
 */
export function getFirebaseAdminDb(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

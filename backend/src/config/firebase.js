const admin = require('firebase-admin');
require('dotenv').config();

/**
 * Firebase Admin initialisation.
 *
 * Priority:
 *   1. Environment variables  → used on Render (and locally when .env is present)
 *   2. serviceAccountKey.json → fallback for local dev without .env vars
 *
 * The private key is stored in .env with literal \n sequences (double-escaped)
 * wrapped in double-quotes so dotenv preserves them.  The .replace() below
 * converts those back to real newline characters that the RSA parser expects.
 */

let credential;

if (process.env.FIREBASE_PRIVATE_KEY) {
  // ── Env-var path (Render + local .env) ──────────────────────────────────
  const requiredVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length) {
    throw new Error(
      `Firebase init failed: missing environment variable(s): ${missing.join(', ')}`
    );
  }

  credential = admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // dotenv stores the key with literal \n — convert to real newlines
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });

  console.log('✦ Firebase: initialising with environment variables');
} else {
  // ── JSON-file fallback (local dev without .env) ──────────────────────────
  try {
    const path = require('path');
    const serviceAccount = require(path.join(__dirname, '../../../serviceAccountKey.json'));
    credential = admin.credential.cert(serviceAccount);
    console.log('✦ Firebase: initialising with serviceAccountKey.json');
  } catch (err) {
    throw new Error(
      'Firebase init failed: FIREBASE_PRIVATE_KEY is not set and serviceAccountKey.json was not found.\n' +
      'For local dev: ensure serviceAccountKey.json exists at backend/serviceAccountKey.json\n' +
      'For Render:    set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY env vars'
    );
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

module.exports = { admin, db };
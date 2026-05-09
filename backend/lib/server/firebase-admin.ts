import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type FirebaseServiceAccount = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
};

function decodeServiceAccount(rawValue: string): FirebaseServiceAccount {
  const normalized = rawValue.trim();
  const jsonValue = normalized.startsWith("{")
    ? normalized
    : Buffer.from(normalized, "base64").toString("utf8");

  return JSON.parse(jsonValue) as FirebaseServiceAccount;
}

function getFirebaseCredential() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set.");
  }

  const serviceAccount = decodeServiceAccount(rawServiceAccount);
  const projectId = serviceAccount.project_id ?? serviceAccount.projectId;
  const clientEmail = serviceAccount.client_email ?? serviceAccount.clientEmail;
  const privateKey = serviceAccount.private_key ?? serviceAccount.privateKey;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.");
  }

  return cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  });
}

export function getAdminFirestore() {
  if (getApps().length === 0) {
    initializeApp({
      credential: getFirebaseCredential(),
    });
  }

  return getFirestore();
}

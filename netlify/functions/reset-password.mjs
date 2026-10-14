import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { DEFAULT_PASSWORD } from "../../src/config/defaultPassword.js";

// Required Netlify env vars:
//   FIREBASE_SERVICE_ACCOUNT - the service account JSON (Firebase console →
//                              Project settings → Service accounts → Generate key)
//   ADMIN_PASSWORD           - same value as VITE_ADMIN_PASSWORD
const getAdminApp = () => {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
};

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid request" });
  }
  const { uid, adminKey } = body;

  if (!process.env.ADMIN_PASSWORD || adminKey !== process.env.ADMIN_PASSWORD) {
    return json(401, { error: "Not authorised" });
  }
  if (!uid || typeof uid !== "string") return json(400, { error: "Missing user id" });

  try {
    const app = getAdminApp();
    await getAuth(app).updateUser(uid, { password: DEFAULT_PASSWORD });
    await getFirestore(app).doc(`users/${uid}`).set({ mustChangePassword: true }, { merge: true });
    return json(200, { ok: true });
  } catch (err) {
    if (err.code === "auth/user-not-found") return json(404, { error: "No login account exists for this user" });
    console.error(err);
    return json(500, { error: "Reset failed" });
  }
};

import admin from "firebase-admin";

const serviceAccount = process.env.SERVICE_ACCOUNT
  ? JSON.parse(process.env.SERVICE_ACCOUNT)
  : require("../service-account.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://disiplinkuapp-default-rtdb.firebaseio.com",
  });
}

export const db = admin.database();
export const auth = admin.auth();
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getDatabase, Database } from "firebase/database";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAN6xUidlsNUC4c0S0yKMrLy4T2PP3hoHY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "must-marketplace.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://must-marketplace-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "must-marketplace",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "must-marketplace.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "315868258350",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:315868258350:web:d2b63578051280",
};

let app: FirebaseApp;
let auth: Auth;
let database: Database;
let storage: FirebaseStorage;

if (typeof window !== "undefined") {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  database = getDatabase(app);
  storage = getStorage(app);
}

export { app, auth, database, storage };

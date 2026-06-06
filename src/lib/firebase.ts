import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: "AIzaSyBSIg4O1KVySYIAQ5LNfmfBTXyFsNzlcJw",
  authDomain: "brandie-c2914.firebaseapp.com",
  projectId: "brandie-c2914",
  storageBucket: "brandie-c2914.firebasestorage.app",
  messagingSenderId: "1036344414574",
  appId: "1:1036344414574:web:ec12f872b6d27164b0317f",
  measurementId: "G-76P8501LY4",
};

export const VAPID_PUBLIC_KEY =
  "BBFt6CZr87zsy3VlfyKE6-WtovRm0iHH_vsuEwyulzTOOwDIPB-zGla3Pbsat2t-jFj7wAjap2vGezS3CRyT-oE";

let _app: FirebaseApp | null = null;
let _messaging: Messaging | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps()[0] ?? initializeApp(firebaseConfig);
  return _app;
}

export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (_messaging) return _messaging;
  try {
    const ok = await isSupported();
    if (!ok) return null;
    _messaging = getMessaging(getFirebaseApp());
    return _messaging;
  } catch {
    return null;
  }
}

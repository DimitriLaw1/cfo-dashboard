// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  doc,
  deleteDoc,
  where,
  updateDoc,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAhviJMkISJQf86WommPzBv1rQja1LnAqU",
  authDomain: "cfo-dashboard-64f0c.firebaseapp.com",
  projectId: "cfo-dashboard-64f0c",
  // CHANGED: point config at the firebasestorage.app bucket
  storageBucket: "cfo-dashboard-64f0c.firebasestorage.app",
  messagingSenderId: "879466357800",
  appId: "1:879466357800:web:b1f6a9e836ae640fa7c11d",
};

// Initialize
const app = initializeApp(firebaseConfig);

// SDK instances
const db = getFirestore(app);
// CHANGED: explicitly bind Storage to the gs:// firebasestorage.app bucket
const storage = getStorage(app, "gs://cfo-dashboard-64f0c.firebasestorage.app");
const auth = getAuth(app);

// Re-exports (centralized helpers)
export {
  // Core instances
  db,
  storage,
  auth,

  // Auth helpers
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,

  // Firestore helpers
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  doc,
  deleteDoc,
  where,
  updateDoc,
};

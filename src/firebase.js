// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp, // ✅ add this
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
  storageBucket: "cfo-dashboard-64f0c.appspot.com",
  messagingSenderId: "879466357800",
  appId: "1:879466357800:web:b1f6a9e836ae640fa7c11d",
};

const app = initializeApp(firebaseConfig);

// SDKs
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Exports
export {
  db,
  storage,
  auth,
  // auth helpers
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  // firestore helpers
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp, // ✅ export for createdAt auditing
};

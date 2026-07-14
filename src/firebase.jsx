// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAMxtKOXXjSPhmvtg1ASInLFvC4fSAPnJM",
  authDomain: "cd-locacoes.firebaseapp.com",
  projectId: "cd-locacoes",
  storageBucket: "cd-locacoes.firebasestorage.app",
  messagingSenderId: "112425263073",
  appId: "1:112425263073:web:c594ee595aa2554fe03ca0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

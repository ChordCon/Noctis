import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBowKAlfwEegoziqjWEqJTNpJ1loN4S7CY",
    authDomain: "noctis-sheets.firebaseapp.com",
    projectId: "noctis-sheets",
    storageBucket: "noctis-sheets.firebasestorage.app",
    messagingSenderId: "502698221643",
    appId: "1:502698221643:web:675ff7d464495f65adadce",
    measurementId: "G-LKPJ3W087Y"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
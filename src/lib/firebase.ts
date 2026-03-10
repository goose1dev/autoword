import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCv5EBNFaeIrVbaIgcJDdFRKUwRLMv6_C0",
  authDomain: "autoword-8ca75.firebaseapp.com",
  projectId: "autoword-8ca75",
  storageBucket: "autoword-8ca75.firebasestorage.app",
  messagingSenderId: "1074879459784",
  appId: "1:1074879459784:web:9ed1625db49275e79050fd",
  measurementId: "G-EWE6T64MC8",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

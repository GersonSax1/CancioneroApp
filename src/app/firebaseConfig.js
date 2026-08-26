import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC_xvkj4JSFK77Rnq6PdCiAtGiKG9CKAvg",
  authDomain: "cancioneroapp-4bf0f.firebaseapp.com",
  projectId: "cancioneroapp-4bf0f",
  storageBucket: "cancioneroapp-4bf0f.firebasestorage.app",
  messagingSenderId: "1052449009693",
  appId: "1:1052449009693:web:6d41184bbade1f9aa116f4",
  measurementId: "G-XHXX2MZ9WC"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
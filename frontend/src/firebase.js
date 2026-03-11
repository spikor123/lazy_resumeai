import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDJdkShjKBgAgCkm6BKcWJ9FZdEinD7in8",
  authDomain: "lazyresume-ai.firebaseapp.com",
  projectId: "lazyresume-ai",
  storageBucket: "lazyresume-ai.firebasestorage.app",
  messagingSenderId: "369420101782",
  appId: "1:369420101782:web:c1884f37e8e25ffeed3ab7",
  measurementId: "G-HQSFK8N3ZE"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

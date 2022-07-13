import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore, setDoc, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDpeFI1YoAh9n1ibsczs60jU9MG3LbaIPE",
  authDomain: "recovery-43b10.firebaseapp.com",
  projectId: "recovery-43b10",
  storageBucket: "recovery-43b10.appspot.com",
  messagingSenderId: "844247155656",
  appId: "1:844247155656:web:58ad57358a8a304620f6fd",
  measurementId: "G-5PW6WKYCBF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export interface User {
  name: string | null;
  id: string;
}

export function getCurrentUserOrNull(): User | null {
  const user = auth.currentUser;
  if (user == null) {
    return null;
  }
  return {name: user.email, id: user.uid};
}

export async function loginPopup(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  return {name: user.email, id: user.uid};
}

export async function getPage(id: string): Promise<string> {
  const user = getCurrentUserOrNull();
  if (user == null) {
    return 'NO USER';
  }
  const uid = user.id;
  const data = (await getDoc(doc(db, 'users', uid))).data();
  if (data == null) {
    return 'NEW DOCUMENT';
  }
  const text = data[id];
  if (text == null) {
    return 'NO DATA';
  }
  if (typeof text !== 'string') {
    return `WRONG TYPE ${typeof text}`;
  }
  return text;
}

export async function savePage(id: string, text: string) {
  const user = getCurrentUserOrNull();
  if (user == null) {
    return;
  }
  const uid = user.id;
  await setDoc(doc(db, 'users', uid), {[id]: text}, {merge: true});
}

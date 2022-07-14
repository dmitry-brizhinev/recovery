import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, User } from "firebase/auth";
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

export interface MyUser {
  name: string | null;
  id: string;
}

const firstUser : Promise<User> = new Promise((resolve) => onAuthStateChanged(auth, (user) => user && resolve(user)));

function delay(millis : number) : Promise<null> {
  return new Promise(resolve => setTimeout(() => resolve(null), millis));
}

export async function getSavedUserWithTimeout(millis: number): Promise<MyUser | null> {
  const user = await Promise.race([delay(millis), firstUser]);
  if (user == null) {
    return null;
  }
  return {name: user.email, id: user.uid};
}

function getCurrentUidOrNull(): string | null {
  const user = auth.currentUser;
  if (user == null) {
    return null;
  }
  return user.uid;
}

export async function loginPopup(): Promise<MyUser> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  return {name: user.email, id: user.uid};
}

export async function getPage(id: string): Promise<string> {
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    return 'NO USER';
  }
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
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    return;
  }
  await setDoc(doc(db, 'users', uid), {[id]: text}, {merge: true});
}

import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, User as FUser } from "firebase/auth";
import { getFirestore, setDoc, doc, getDoc, deleteField, FieldValue } from "firebase/firestore";

import { User, UserData, PageId, PageIds, PageData, CalendarId, CalendarPageData, CalendarEventData, checkIdString, Event } from './Data'


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

const firstUser : Promise<FUser> = new Promise((resolve) => onAuthStateChanged(auth, (user) => user && resolve(user)));

function delay(millis : number) : Promise<null> {
  return new Promise(resolve => setTimeout(() => resolve(null), millis));
}

export async function getSavedUserWithTimeout(millis: number): Promise<User | null> {
  const user = await Promise.race([delay(millis), firstUser]);
  if (user == null) {
    return null;
  }
  return {name: user.email, uid: user.uid};
}

function getCurrentUidOrNull(): string | null {
  const user = auth.currentUser;
  if (user == null) {
    return null;
  }
  return user.uid;
}

export async function loginPopup(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  return {name: user.email, uid: user.uid};
}

export async function getData(): Promise<UserData> {
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    throw new Error('No logged-in user');
  }
  const data = (await getDoc(doc(db, 'users', uid))).data();
  const pages: Map<PageId, PageData> = new Map();
  const days: Map<CalendarId, CalendarPageData> = new Map();
  const events: Map<CalendarId, CalendarEventData> = new Map();
  const calendar = {pages: days, events};
  if (data == null) {
    return {pages, calendar};
  }

  for (const id of PageIds) {
    const text = data[id];
    if (text == null) {
      pages.set(id, 'NO DATA');
    }
    else if (typeof text !== 'string') {
      pages.set(id, `WRONG TYPE ${typeof text}`);
    } else {
      pages.set(id, text);
    }
  }

  for (const [key, valuex] of Object.entries(data)) {
    const isEvent = key.startsWith('EC20');
    const cid = checkIdString(isEvent ? key.substring(1) : key);
    if (!cid) {
      continue;
    }
    const value = typeof valuex === 'string' ? valuex : `WRONG TYPE ${typeof valuex}`;
    if (isEvent) {
      events.set(cid, value.split('\n').map(Event.parse).sort(Event.compare));
    } else {
      days.set(cid, value);
    }
  }

  return {pages, calendar};
}

async function save(id: string, data: string | FieldValue) {
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    return;
  }
  await setDoc(doc(db, 'users', uid), {[id]: data}, {merge: true});
}

export async function savePage(id: PageId, data: PageData) {
  await save(id, data);
}

export async function saveCalendarPage(id: CalendarId, data: CalendarPageData) {
  await save(id, data || deleteField());
}

export async function saveCalendarEvent(id: CalendarId, data: CalendarEventData) {
  await save('E' + id, data.map(Event.toString).join('\n') || deleteField());
}

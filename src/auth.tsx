import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, User } from "firebase/auth";
import { getFirestore, setDoc, doc, getDoc, deleteField } from "firebase/firestore";

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

export type CalendarPageData = string;
export type CalendarEventData = string[];
export type CalendarId = string;
export type CalendarPageMap = Map<CalendarId, CalendarPageData>;
export type CalendarEventMap = Map<CalendarId, CalendarEventData>;
export interface CalendarData {
  pages: CalendarPageMap;
  events: CalendarEventMap;
}

export interface MyData {
  pages: Map<PageId, string>;
  calendar: CalendarData;
}

export function dateToId(date: Date): CalendarId {
  return `C${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

export enum PageId {
  todo = 'todo',
  plan = 'plan',
  oneoff = 'oneoff',
  exerc = 'exerc',
  resea = 'resea',
  buy = 'buy',
  think = 'think',
  psych = 'psych',
  eggy = 'eggy',
  other = 'other',
}

export async function getData(): Promise<MyData> {
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    throw new Error('No logged-in user');
  }
  const data = (await getDoc(doc(db, 'users', uid))).data();
  const pages: Map<PageId, string> = new Map();
  const days: Map<CalendarId, CalendarPageData> = new Map();
  const events: Map<CalendarId, CalendarEventData> = new Map();
  const calendar = {pages: days, events: events};
  if (data == null) {
    return {pages: pages, calendar: calendar};
  }

  for (const id of Object.values(PageId)) {
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

  for (const [keyx, valuex] of Object.entries(data)) {
    const isEvent = keyx.startsWith('EC20');
    const key = isEvent ? keyx.substring(1) : keyx;
    if (key.length !== 11 || !key.startsWith('C20') || valuex === '') {
      continue;
    }
    const year = Number.parseInt(key.substring(1, 5));
    const month = Number.parseInt(key.substring(6, 8));
    const day = Number.parseInt(key.substring(9, 11));
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      continue;
    }
    const value = typeof valuex === 'string' ? valuex : `WRONG TYPE ${typeof valuex}`;
    if (isEvent) {
      events.set(key, value.split('\n'));
    } else {
      days.set(key, value);
    }
  }

  return {pages: pages, calendar: calendar};
}

export async function savePage(id: PageId, text: string) {
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    return;
  }
  await setDoc(doc(db, 'users', uid), {[id]: text}, {merge: true});
}

export async function saveCalendarPage(id: CalendarId, data: CalendarPageData) {
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    return;
  }
  const page = data || deleteField();
  await setDoc(doc(db, 'users', uid), {[id]: page}, {merge: true});
}

export async function saveCalendarEvent(id: CalendarId, data: CalendarEventData) {
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    return;
  }
  const page = data.join('\n') || deleteField();
  await setDoc(doc(db, 'users', uid), {['E' + id]: page}, {merge: true});
}

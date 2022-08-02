import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, User as FUser } from "firebase/auth";
import { getFirestore, setDoc, doc, getDoc, deleteField, FieldValue } from "firebase/firestore";

import { User, UserData, PageId, PageIds, PageData, CalendarId, CalendarPageData, CalendarEventData, checkIdString, Event, PageMap, makeUserData, CalendarPageMap, CalendarEventMap } from './Data'

import { Map as IMap } from 'immutable';

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
  const pages: PageMap = IMap<PageId, PageData>().asMutable();
  const calendarPages: CalendarPageMap = IMap<CalendarId, CalendarPageData>().asMutable();
  const events: CalendarEventMap = IMap<CalendarId, CalendarEventData>().asMutable();

  if (data != null) {
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
        events.set(cid, IMap(value.split('\n').map(Event.parseAndGenKey).map(event => [event.magicKey, event])));
      } else {
        calendarPages.set(cid, value);
      }
    }
  }

  return makeUserData({
    pages: pages.asImmutable(),
    calendarPages: calendarPages.asImmutable(),
    calendarEvents: events.asImmutable()});
}

export async function saveAll(
  pages: Map<PageId, PageData | null>,
  calendarPages: Map<CalendarId, CalendarPageData | null>,
  calendarEvents: Map<CalendarId, CalendarEventData | null>) {
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    return;
  }
  const data: {[key: string]: string | FieldValue} = {};
  for (const [key, value] of pages) {
    data[key] = value || deleteField();
  }
  for (const [key, value] of calendarPages) {
    data[key] = value || deleteField();
  }
  for (const [key, value] of calendarEvents) {
    data['E' + key] = value?.map(Event.toString).join('\n') || deleteField();
  }

  await setDoc(doc(db, 'users', uid), data, {merge: true});
}

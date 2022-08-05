import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, User as FUser, signOut } from "firebase/auth";
import { getFirestore, setDoc, doc, getDoc, deleteField, FieldValue } from "firebase/firestore";

import { User, UserData, PageData, CalendarPageData, CalendarEventData, PageMap, makeUserData, CalendarPageMap, CalendarEventMap, DataDiff } from '../data/Data'
import Event from '../data/Event';
import { Map as IMap } from 'immutable';
import { CalendarId, checkIdString } from '../data/CalendarId';
import { checkPageId, PageId } from '../data/PageId';
import { Callback, Func } from '../util/Utils';

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


export function subscribeToUserChanges(callback: Callback<User | null>): Func {
  const x = {sub: true};
  const unsubscribe = onAuthStateChanged(auth, user => x.sub && callback(toUser(user)));
  return () => {x.sub = false; unsubscribe();};
}

export async function logout() {
  await signOut(auth);
}

function toUser(user: FUser | null) : User | null {
  return user && {name: user.email, uid: user.uid};
}

function getCurrentUidOrNull(): string | undefined {
  return auth.currentUser?.uid;
}

export async function loginPopup(): Promise<User | null> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return toUser(result.user);
  } catch (e: any) {
    return null;
  }
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
    for (const [key, valuex] of Object.entries(data)) {
      const isPage = key.startsWith('P');
      if (isPage) {
        const id = checkPageId(key);
        if (typeof valuex !== 'string' || !id) {
          continue;
        } else {
          const split = valuex.indexOf('\n');
          if (split === -1) {
            pages.set(id, [valuex, '']);
          } else {
            const title = valuex.substring(0,split);
            const body = valuex.substring(split+1);
            pages.set(id, [title, body]);
          }
          continue;
        }
      }
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

export async function saveAll(diffs: DataDiff) {
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    return;
  }
  const data: {[key: string]: string | FieldValue} = {};
  for (const [key, value] of diffs.pages) {
    data[key] = value?.join('\n') || deleteField();
  }
  for (const [key, value] of diffs.calendarPages) {
    data[key] = value || deleteField();
  }
  for (const [key, value] of diffs.calendarEvents) {
    data['E' + key] = value?.map(Event.toString).join('\n') || deleteField();
  }

  await setDoc(doc(db, 'users', uid), data, {merge: true});
}
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, User as FUser, signOut } from "firebase/auth";

import { getAuth as getAuthF } from "firebase/auth";
import type { User } from '../data/Data'
import { Callback, Func, makeLazySingleton, throwIfNull } from '../util/Utils';
import { getApp } from './FirebaseCore';

const getAuth = makeLazySingleton(() => getAuthF(getApp()));

export function subscribeToUserChanges(callback: Callback<User | null>): Func {
  const x = {sub: true};
  const unsubscribe = onAuthStateChanged(getAuth(), user => x.sub && callback(toUser(user)));
  return () => {x.sub = false; unsubscribe();};
}

export async function logout() {
  await signOut(getAuth());
}

function toUser(user: FUser | null) : User | null {
  return user && {name: user.email, uid: user.uid};
}

export function getCurrentUidOrAssert(): string {
  return throwIfNull(getAuth().currentUser, 'No logged-in user!').uid;
}

export async function loginPopup(): Promise<User | null> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(getAuth(), provider);
    return toUser(result.user);
  } catch (e: any) {
    return null;
  }
}

import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, User as FUser, signOut } from "firebase/auth";

import type { User } from '../data/Data'
import type { Callback, Func } from '../util/Utils';
import { auth } from './FirebaseCore';


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

export function getCurrentUidOrNull(): string | undefined {
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

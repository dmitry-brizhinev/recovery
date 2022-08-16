import { getFirestore, getDoc, doc, setDoc, FieldValue } from "firebase/firestore/lite";
import { makeLazySingleton } from "../util/Utils";
import { getCurrentUidOrAssert } from "./FirebaseAuth";
import { getApp } from "./FirebaseCore";

const getDb = makeLazySingleton(() => getFirestore(getApp()));

type Collection = 'users' | 'journals' | 'code';

export async function getDocument(collection: Collection) {
  const uid = getCurrentUidOrAssert();
  return (await getDoc(doc(getDb(), collection, uid))).data();
}

export async function writeDocument(collection: Collection, data: {[key: string]: string | FieldValue}) {
    const uid = getCurrentUidOrAssert();
    await setDoc(doc(getDb(), collection, uid), data, {merge: true});
}
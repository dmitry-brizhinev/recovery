import { setDoc, doc, getDoc, deleteField, FieldValue } from "firebase/firestore/lite";

import { Map as IMap } from 'immutable';
import { checkJournalId, Journal, JournalId, JournalData, JournalDiff } from '../data/Journal';
import { assertNonNull } from "../util/Utils";
import { getCurrentUidOrNull } from "./FirebaseAuth";
import { db } from "./FirebaseCore";


export async function getJournals(): Promise<JournalData> {
  const uid = getCurrentUidOrNull();
  assertNonNull(uid, 'No logged-in user');
  const data = (await getDoc(doc(db, 'journals', uid))).data();
  const journals: JournalData = IMap<JournalId, Journal>().asMutable();

  if (data != null) {
    for (const [key, valuex] of Object.entries(data)) {
      const id = checkJournalId(key);
      if (!id) {
        continue;
      }
      const value = typeof valuex === 'string' ? valuex : `WRONG TYPE ${typeof valuex}`;
      journals.set(id, Journal.parse(value));
    }
  }

  return journals.asImmutable();
}

export async function saveJournals(diffs: JournalDiff) {
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    return;
  }

  const data: {[key: string]: string | FieldValue} = {};
  for (const [key, value] of diffs) {
    data[key] = value?.toString() || deleteField();
  }

  await setDoc(doc(db, 'journals', uid), data, {merge: true});
}

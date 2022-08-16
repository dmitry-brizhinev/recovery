import { setDoc, doc, getDoc, deleteField, FieldValue } from "firebase/firestore/lite";

import { Map as IMap } from 'immutable';
import { Code, CodeId, CodeData, CodeDiff, checkCodeId } from '../data/Code';
import { assertNonNull } from "../util/Utils";
import { getCurrentUidOrNull } from "./FirebaseAuth";
import { db } from "./FirebaseStore";


export async function getCode(): Promise<CodeData> {
  const uid = getCurrentUidOrNull();
  assertNonNull(uid, 'No logged-in user');
  const data = (await getDoc(doc(db, 'code', uid))).data();
  const code: CodeData = IMap<CodeId, Code>().asMutable();

  if (data != null) {
    for (const [key, valuex] of Object.entries(data)) {
      const id = checkCodeId(key);
      if (!id) {
        continue;
      }
      const value = typeof valuex === 'string' ? valuex : `WRONG TYPE ${typeof valuex}`;
      code.set(id, value);
    }
  }

  return code.asImmutable();
}

export async function saveCode(diffs: CodeDiff) {
  const uid = getCurrentUidOrNull();
  if (uid == null) {
    return;
  }

  const data: {[key: string]: string | FieldValue} = {};
  for (const [key, value] of diffs) {
    data[key] = value || deleteField();
  }

  await setDoc(doc(db, 'code', uid), data, {merge: true});
}

import { deleteField, FieldValue } from "firebase/firestore/lite";

import { Map as IMap } from 'immutable';
import { Code, CodeId, CodeData, CodeDiff, checkCodeId } from '../data/Code';
import { getDocument, writeDocument } from "./Firestore";


export async function getCode(): Promise<CodeData> {
  const data = await getDocument('code');
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
  const data: {[key: string]: string | FieldValue} = {};
  for (const [key, value] of diffs) {
    data[key] = value || deleteField();
  }
  await writeDocument('code', data);
}

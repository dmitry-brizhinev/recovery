import {deleteField, FieldValue} from "firebase/firestore/lite";

import {Map as IMap} from 'immutable';
import {checkJournalId, Journal, type JournalId, type JournalData, type JournalDiff} from '../data/Journal';
import {getDocument, writeDocument} from "./Firestore";


export async function getJournals(): Promise<JournalData> {
  const data = await getDocument('journals');
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
  const data: {[key: string]: string | FieldValue;} = {};
  for (const [key, value] of diffs) {
    data[key] = value?.toString() || deleteField();
  }
  await writeDocument('journals', data);
}

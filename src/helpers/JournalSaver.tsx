import type {JournalData, JournalDiff, JournalId} from '../data/Journal';
import {makeJournalDiff} from '../data/Journal';
import {saveJournals} from '../firebase/FirestoreJournals';
import type {Callback} from '../util/Utils';
import Saver from './Saver';


export default class JornalSaver {
  private readonly inner: Saver<JournalDiff>;

  constructor(onStatusUpdate: Callback<string>) {
    this.inner = new Saver(onStatusUpdate, makeJournalDiff, saveJournals);
  }

  private update(newData: JournalData, key: JournalId, diffs: JournalDiff): JournalDiff {
    const diff = newData.get(key, null);
    diffs.set(key, diff);
    return diffs;
  }

  logUpdate(newData: JournalData, key: JournalId) {
    this.inner.logUpdate(this.update.bind(this, newData, key));
  }
}

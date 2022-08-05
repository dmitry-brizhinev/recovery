import { JournalData, JournalDiff, JournalId, makeJournalDiff } from '../data/Journal';
import { saveJournals } from '../firebase/FirebaseStoreJournals';
import { Callback } from '../util/Utils';

const enum SaverStatusString {
  Unsaved = ' [Unsaved..] ',
  Saving = ' [Saving...] ',
  Saved = ' [  Saved  ] ',
}

export default class JournalSaver {
  private diffs: JournalDiff = makeJournalDiff();
  private static readonly delay = 2000;
  private timeout?: NodeJS.Timeout;

  constructor(private readonly onStatusUpdate: Callback<SaverStatusString>) {
    onStatusUpdate(SaverStatusString.Saved);

    this.saveNow = this.saveNow.bind(this);
    this.saveDone = this.saveDone.bind(this);
  }

  private saveNow() {
    this.timeout = undefined;
    const diffs = this.diffs;
    this.onStatusUpdate(SaverStatusString.Saving);
    this.diffs = makeJournalDiff();
    saveJournals(diffs).then(this.saveDone);
  }

  private saveDone() {
    if (!this.timeout) {
      this.onStatusUpdate(SaverStatusString.Saved);
    }
  }

  logUpdate(newData: JournalData, key: JournalId) {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    const diff = newData.get(key, null);
    this.diffs.set(key, diff);
  
    this.onStatusUpdate(SaverStatusString.Unsaved);

    this.timeout = setTimeout(this.saveNow, JournalSaver.delay);
  }
}

import { CodeData, CodeDiff, CodeId, makeCodeDiff } from '../data/Code';
import { saveCode } from '../firebase/FirebaseProgram';
import type { Callback } from '../util/Utils';

const enum SaverStatusString {
  Unsaved = ' [Unsaved..] ',
  Saving = ' [Saving...] ',
  Saved = ' [  Saved  ] ',
}

export default class ProgramSaver {
  private diffs: CodeDiff = makeCodeDiff();
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
    this.diffs = makeCodeDiff();
    saveCode(diffs).then(this.saveDone);
  }

  private saveDone() {
    if (!this.timeout) {
      this.onStatusUpdate(SaverStatusString.Saved);
    }
  }

  logUpdate(newData: CodeData, key: CodeId) {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    const diff = newData.get(key, null);
    this.diffs.set(key, diff);
  
    this.onStatusUpdate(SaverStatusString.Unsaved);

    this.timeout = setTimeout(this.saveNow, ProgramSaver.delay);
  }
}

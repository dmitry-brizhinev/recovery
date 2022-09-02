import {type CodeData, type CodeDiff, type CodeId, makeCodeDiff} from '../data/Code';
import {saveCode} from '../firebase/FirestoreProgram';
import type {Callback} from '../util/Utils';
import Saver from './Saver';

export default class ProgramSaver {
  private readonly inner: Saver<CodeDiff>;

  constructor(onStatusUpdate: Callback<string>) {
    this.inner = new Saver(onStatusUpdate, makeCodeDiff, saveCode);
  }

  private update(newData: CodeData, key: CodeId, diffs: CodeDiff): CodeDiff {
    const diff = newData.get(key, null);
    diffs.set(key, diff);
    return diffs;
  }

  logUpdate(newData: CodeData, key: CodeId) {
    this.inner.logUpdate(this.update.bind(this, newData, key));
  }
}

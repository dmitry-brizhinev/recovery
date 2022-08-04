import { CalendarId } from '../data/CalendarId';
import { CalendarEventData, CalendarPageData, DataDiff, DataId, DataTypes, makeDataDiff, PageData, UserData } from '../data/Data';
import { saveAll } from './Firebase';
import { PageId } from '../data/PageId';
import { Callback } from '../util/Utils';

const enum SaverStatusString {
  Unsaved = ' [Unsaved..] ',
  Saving = ' [Saving...] ',
  Saved = ' [  Saved  ] ',
}

export interface Key<K extends DataId> {
  readonly type: K;
  readonly key: DataTypes[K]['id'];
}

export class Saver {
  private diffs: DataDiff = makeDataDiff();
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
    this.diffs = makeDataDiff();
    saveAll(diffs).then(this.saveDone);
  }

  private saveDone() {
    if (!this.timeout) {
      this.onStatusUpdate(SaverStatusString.Saved);
    }
  }

  logUpdate<K extends DataId>(newData: UserData, key: Key<K>) {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    const diff = newData.get(key.type).get(key.key, null);
    this.diffs.get(key.type).set(key.key, diff);
  
    this.onStatusUpdate(SaverStatusString.Unsaved);

    this.timeout = setTimeout(this.saveNow, Saver.delay);
  }
}

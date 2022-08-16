import { DataDiff, DataId, DataTypes, makeDataDiff, UserData } from '../data/Data';
import { saveAll } from '../firebase/FirestoreData';
import type { Callback } from '../util/Utils';
import Saver from './Saver';

interface Key<K extends DataId> {
  readonly type: K;
  readonly key: DataTypes[K]['id'];
}

export default class DataSaver {
  private readonly inner: Saver<DataDiff>;

  constructor(onStatusUpdate: Callback<string>) {
    this.inner = new Saver(onStatusUpdate, makeDataDiff, saveAll);
  }

  private update<K extends DataId>(newData: UserData, key: Key<K>, diffs: DataDiff): DataDiff {
    const diff = newData.get(key.type).get(key.key, null);
    diffs.get(key.type).set(key.key, diff);
    return diffs;
  }

  logUpdate<K extends DataId>(newData: UserData, key: Key<K>) {
    this.inner.logUpdate(this.update.bind(this, newData, key));
  }
}

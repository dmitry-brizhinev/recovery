import * as React from 'react';
import type {UserData, DataId, UserDataKey, UserDataLeaf, CalendarPageData, PageData} from '../data/Data';
import DataSaver from './DataSaver';
import type Event from '../data/Event';
import type {CalendarId} from '../data/CalendarId';
import type {PageId} from '../data/PageId';
import type {Callback} from '../util/Utils';

class DataRoot {
  onPageUpdate(_id: PageId, _data: PageData | null): void {}
  onCalendarPageUpdate(_id: CalendarId, _data: CalendarPageData | null): void {}
  onCalendarEventUpdate(_id: CalendarId, _magicKey: number, _event: Event | null): void {}
}

export class DataRootImpl extends DataRoot {
  private readonly saver: DataSaver;
  constructor(
    private data: UserData,
    private readonly subscriber: Callback<UserData>,
    onSaverUpdate: Callback<string>,
  ) {
    super();
    this.saver = new DataSaver(onSaverUpdate);
  }

  private onUpdate<K extends DataId>(key: UserDataKey[K], value: UserDataLeaf[K] | null) {
    this.data = value ? this.data.setIn(key, value) : this.data.deleteIn(key);
    this.saver.logUpdate(this.data, {type: key[0], key: key[1]});
    this.subscriber(this.data);
  }

  override onPageUpdate(id: PageId, data: PageData | null) {
    const key = ['pages', id] as const;
    this.onUpdate<typeof key[0]>(key, data);
  }

  override onCalendarPageUpdate(id: CalendarId, data: CalendarPageData | null) {
    const key = ['calendarPages', id] as const;
    this.onUpdate<typeof key[0]>(key, data);
  }

  override onCalendarEventUpdate(id: CalendarId, magicKey: number, event: Event | null) {
    const key = ['calendarEvents', id, magicKey] as const;
    this.onUpdate<typeof key[0]>(key, event);
  }
}

export const DataRootContext = React.createContext<DataRoot>(new DataRoot());
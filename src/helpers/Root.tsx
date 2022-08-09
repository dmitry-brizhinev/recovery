import * as React from 'react'
import type { UserData, DataId, UserDataKey, UserDataLeaf, CalendarPageData, PageData } from '../data/Data';
import type Saver from './Saver';
import type Event from '../data/Event';
import type { CalendarId } from '../data/CalendarId';
import type { PageId } from '../data/PageId';
import type { Callback } from '../util/Utils';

export abstract class Root {
  abstract onPageUpdate(id: PageId, data: PageData | null): void;
  abstract onCalendarPageUpdate(id: CalendarId, data: CalendarPageData | null): void;
  abstract onCalendarEventUpdate(id: CalendarId, magicKey: number, event: Event | null): void;
}

export class EmptyRoot extends Root {
  onPageUpdate() {}
  onCalendarPageUpdate() {}
  onCalendarEventUpdate() {}
}

export class DataRoot extends Root {
  constructor(
    private data: UserData,
    private readonly subscriber: Callback<UserData>,
    private readonly saver: Saver) {
    super();
  }

  private onUpdate<K extends DataId>(key: UserDataKey[K], value: UserDataLeaf[K] | null) {
    this.data = value ? this.data.setIn(key, value) : this.data.deleteIn(key);
    this.saver.logUpdate(this.data, {type: key[0], key: key[1]});
    this.subscriber(this.data);
  }

  onPageUpdate(id: PageId, data: PageData | null) {
    const key = ['pages', id] as const;
    this.onUpdate<typeof key[0]>(key, data);
  }

  onCalendarPageUpdate(id: CalendarId, data: CalendarPageData | null) {
    const key = ['calendarPages', id] as const;
    this.onUpdate<typeof key[0]>(key, data);
  }

  onCalendarEventUpdate(id: CalendarId, magicKey: number, event: Event | null) {
    const key = ['calendarEvents', id, magicKey] as const;
    this.onUpdate<typeof key[0]>(key, event);
  }
}

export const RootContext = React.createContext<Root>(new EmptyRoot());
import * as React from 'react'
import { UserData, DataId, UserDataKey, UserDataLeaf } from '../data/Data';
import Saver from './Saver';
import Event from '../data/Event';
import { CalendarId, incrementId } from '../data/CalendarId';
import { PageId } from '../data/PageId';
import { Callback } from '../util/Utils';

export interface EventUpdateOpts {
  reschedule?: boolean;
  delete?: boolean;
}

export abstract class Root {
  abstract onPageUpdate(id: PageId, title: string, event: React.ChangeEvent<HTMLTextAreaElement>): void;
  abstract onCalendarPageUpdate(id: CalendarId, event: React.ChangeEvent<HTMLTextAreaElement>): void;
  abstract onCalendarEventUpdate(id: CalendarId, event: Event, opts?: EventUpdateOpts): void;
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
  }

  private getEvent(key: UserDataKey['calendarEvents']): Event | undefined {
    return this.data.getIn(key) as Event | undefined;
  }

  onPageUpdate(id: PageId, title: string, event: React.ChangeEvent<HTMLTextAreaElement>) {
    const key = ['pages', id] as const;
    const text = event.target.value;
    this.onUpdate<typeof key[0]>(key, [title, text]);
    this.subscriber(this.data);
  }

  onCalendarPageUpdate(id: CalendarId, event: React.ChangeEvent<HTMLTextAreaElement>) {
    const key = ['calendarPages', id] as const;
    const text = event.target.value;
    this.onUpdate<typeof key[0]>(key, text);
    this.subscriber(this.data);
  }

  onCalendarEventUpdate(id: CalendarId, event: Event, opts?: EventUpdateOpts) {
    const key = ['calendarEvents', id, event.magicKey] as const;
  
    if (opts?.reschedule) {
      const oldEvent = this.getEvent(key);
      if (oldEvent && oldEvent.recurDays) {
        const newEvent = oldEvent.withUpdate({regenKey: true});
        const newId = incrementId(id, oldEvent.recurDays);
        const newKey = ['calendarEvents', newId, newEvent.magicKey] as const;
        this.onUpdate<typeof key[0]>(newKey, newEvent);
      }
    }

    if (opts?.delete) {
      this.onUpdate<typeof key[0]>(key, null);
    } else {
      this.onUpdate<typeof key[0]>(key, event);
    }
    this.subscriber(this.data);
  }
}

export const RootContext = React.createContext<Root>(new EmptyRoot());
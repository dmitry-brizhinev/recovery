import * as React from 'react'
import { UserData, PageData, CalendarPageData } from '../data/Data';
import { Saver, Key as SaverKey } from './Saver';
import Event from '../data/Event';
import { CalendarId, incrementId } from '../data/CalendarId';
import { PageId } from '../data/PageId';
import { Callback } from '../util/Utils';

export interface EventUpdateOpts {
  reschedule?: boolean;
  delete?: boolean;
}

export abstract class Root {
  static getBackupString(data: UserData): string {
    return JSON.stringify(data);
  }

  abstract onPageUpdate(id: PageId, event: React.ChangeEvent<HTMLTextAreaElement>): void;
  abstract onCalendarPageUpdate(id: CalendarId, event: React.ChangeEvent<HTMLTextAreaElement>): void;
  abstract onCalendarEventUpdate(id: CalendarId, event: Event, opts?: EventUpdateOpts): void;
}

export class EmptyRoot extends Root {
  onPageUpdate() {}
  onCalendarPageUpdate() {}
  onCalendarEventUpdate() {}
}

type Key = readonly ['pages', PageId] | readonly ['calendarPages', CalendarId] | readonly ['calendarEvents', CalendarId, number];

export class DataRoot extends Root {
  constructor(
    private data: UserData,
    private readonly subscriber: Callback<UserData>,
    private readonly saver: Saver) {
    super();
  }

  private onUpdate(key: readonly ['pages', PageId], value: PageData): void;
  private onUpdate(key: readonly ['calendarPages', CalendarId], value: CalendarPageData): void;
  private onUpdate(key: readonly ['calendarEvents', CalendarId, number], value: Event | null): void;
  private onUpdate(key: Key, value: string | Event | null) {
    this.data = value ? this.data.setIn(key, value) : this.data.deleteIn(key);
    const kk: SaverKey = key[0] === 'pages' ? {type: key[0], key: key[1]} : {type: key[0], key: key[1]};
    this.saver.logUpdate(this.data, kk);
  }

  private getEvent(key: readonly ['calendarEvents', CalendarId, number]): Event | undefined {
    return this.data.getIn(key) as Event | undefined;
  }

  onPageUpdate(id: PageId, event: React.ChangeEvent<HTMLTextAreaElement>) {
    const key = ['pages', id] as const;
    const text = event.target.value;
    this.onUpdate(key, text);
    this.subscriber(this.data);
  }

  onCalendarPageUpdate(id: CalendarId, event: React.ChangeEvent<HTMLTextAreaElement>) {
    const key = ['calendarPages', id] as const;
    const text = event.target.value;
    this.onUpdate(key, text);
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
        this.onUpdate(newKey, newEvent);
      }
    }

    if (opts?.delete) {
      this.onUpdate(key, null);
    } else {
      this.onUpdate(key, event);
    }
    this.subscriber(this.data);
  }
}

export const RootContext = React.createContext<Root>(new EmptyRoot());
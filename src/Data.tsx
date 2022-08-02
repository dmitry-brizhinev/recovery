import { castToTypedef, StrongTypedef } from "./StrongTypedef";

import Immutable from 'immutable';

import { Map as IMap } from 'immutable';

export interface User {
  readonly name: string | null;
  readonly uid: string;
}

export const PageIds = [
  'todo',
  'plan',
  'oneoff',
  'exerc',
  'resea',
  'buy',
  'think',
  'psych',
  'eggy',
  'other',
] as const;

export type PageId = typeof PageIds[number];
type PageTitlesType = {
  [key in PageId]: string;
};

export const PageTitles: PageTitlesType = {
  todo: 'One-offs todo:',
  plan: 'Concrete plans to schedule:',
  oneoff: 'Ideas for one-offs:',
  exerc: 'Ideas for plans/recurring/exercises to try:',
  resea: 'To research:',
  buy: 'To buy:',
  think: 'To think about:',
  psych: 'To discuss with psych:',
  eggy: 'To discuss with Eggy:',
  other: 'Other:',
} as const;

declare const calendarid : unique symbol;

export type PageData = string;
export type PageMap = IMap<PageId, PageData>;
export type CalendarId = StrongTypedef<string, typeof calendarid>;
export type CalendarPageData = string;
export type CalendarPageMap = IMap<CalendarId, CalendarPageData>;
export type CalendarEventData = IMap<number, Event>;
export type CalendarEventMap = IMap<CalendarId, CalendarEventData>;

export const makeUserData: Immutable.Record.Factory<UserDataType> = Immutable.Record<UserDataType>({pages: IMap(), calendarPages: IMap(), calendarEvents: IMap()});
export type UserData = Immutable.RecordOf<UserDataType>;

export type DataId = keyof UserDataType;
interface UserDataType {
  pages: PageMap;
  calendarPages: CalendarPageMap;
  calendarEvents: CalendarEventMap;
}

const CalendarIdRegex = /^C(20\d\d)-([01]\d)-([0123]\d)$/;

interface Day {
  year: number;
  month: number;
  day: number;
}

export function checkIdString(id: string): CalendarId | null {
  if (!CalendarIdRegex.test(id)) return null;
  
  const cid = castToTypedef<CalendarId, typeof calendarid>(id);

  const {month, day} = idToDay(cid);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return cid;
}

export function dateToDay(date: Date): Day {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return {year, month, day};
}

export function dateToId(date: Date): CalendarId {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const id = checkIdString(`C${year}-${month}-${day}`);
  if (!id) throw new Error(`Failed constructing CalendarId with date ${date}`);
  return id;
}

export function incrementId(id: CalendarId, incrementDays: number): CalendarId {
  const {year, month, day} = idToDay(id);
  return dateToId(new Date(year, month-1, day + incrementDays));
}

function idToDay(id: CalendarId): Day {
  const year = Number.parseInt(id.substring(1, 5));
  const month = Number.parseInt(id.substring(6, 8));
  const day = Number.parseInt(id.substring(9, 11));
  return {year, month, day};
}

export function idToNiceString(id: CalendarId): string {
  const d = idToDay(id);
  const idDate = new Date(d.year, d.month-1, d.day);
  const toDate = new Date(); toDate.setHours(0, 0, 0, 0);
  

  const dayDiff = Math.round((toDate.getTime() - idDate.getTime()) / (1000*60*60*24));

  let weekday = new Intl.DateTimeFormat('en-US', {weekday: 'long'}).format(idDate);

  if (dayDiff === 0) weekday = 'Today';
  else if (dayDiff === 1) weekday = 'Yesterday';
  else if (dayDiff === -1) weekday = 'Tomorrow';
  else if (dayDiff >= -7 && dayDiff <= 7) {
    weekday = dayDiff < 0 ? `Next ${weekday}` : `Last ${weekday}`;
  }

  const month = new Intl.DateTimeFormat('en-US', {month: 'short'}).format(idDate);
  const day = pad2(idDate.getDate());

  if (idDate.getFullYear() === toDate.getFullYear()) {
    return `${weekday}, ${month} ${day}`;
  } else {
    const year = idDate.getFullYear();
    return `${weekday}, ${year}-${month}-${day}`;
  }
}

let lastMagicKey = 1;
function getMagicKey(): number {
  return ++lastMagicKey;
}

export const enum EventStatus {
  Invalid = 'invalid',
  Active = 'active',
  Finished = 'finished',
}

declare const validcomment: unique symbol;
export type ValidComment = StrongTypedef<string, typeof validcomment>;

export class Event {
  private constructor(
    readonly timeMinutes: number,
    readonly title: string,
    readonly comment: ValidComment,
    readonly recurDays: number,     // 0 = don't recur
    private readonly finished: boolean,
    readonly magicKey: number,
  ) {}

  status(): EventStatus {
    if (!this.isValid()) {
      return EventStatus.Invalid;
    } else if (this.finished) {
      return EventStatus.Finished;
    } else {
      return EventStatus.Active;
    }
  }

  isActive(): boolean {
    return this.isValid() && !this.finished;
  }

  isValid(): boolean {
    return !!this.title && this.timeMinutes >= 0;
  }

  isFinished(): boolean {
    return this.isValid() && this.finished;
  }

  getScheduledDate(dayId: CalendarId): Date {
    const {year, month, day} = idToDay(dayId);
    return new Date(year, month-1, day, 0, this.isValid() ? this.timeMinutes : 0);
  }

  static makeEmpty(): Event {
    return Event.parseAndGenKey('');
  }

  static parseAndGenKey(value: string): Event {
    const magicKey = getMagicKey();
    return Event.parse(value, magicKey);
  }

  private static parse(value: string, magicKey: number): Event {
    const result = extractNamedGroups(EventRegex, value);
    if (!result) {
      return new Event(-1, value, Event.sanitizeComment(''), 0, false, magicKey);
    }
    const { time, title, comment, recur, marked } = result;
    const timeMinutes = parseTimeInput(time) ?? -1;
    const unescapedComment = Event.sanitizeComment((comment ?? '').replaceAll('\\n', '\n'));
    const recurDays = maybeParse(recur);
    const finished = marked === 'F';
    return new Event(timeMinutes, title ?? '', unescapedComment, recurDays, finished, magicKey);
  }

  toTimeInputString(): string {
    if (!this.isValid()) {
      return '';
    }
    const minute = pad2(this.timeMinutes % 60);
    const hour = pad2(Math.trunc(this.timeMinutes / 60));
    return `${hour}:${minute}`;
  }

  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    if (!this.isValid()) {
      return this.title;
    }
    const time = this.toTimeInputString();
    const title = this.title;
    const comment = this.comment.replaceAll('\n', '\\n');
    const recur = this.recurDays || '';
    const finished = this.finished ? 'F' : '';
    return `${time}||${title}|${comment}|${recur}|${finished}`
  }

  static sanitizeTitle(title?: string): string | undefined {
    return title?.replaceAll('|', '/').replaceAll('\n', '\\n');
  }

  static sanitizeComment(comment: string): ValidComment {
    return castToTypedef<ValidComment, typeof validcomment>(comment.replaceAll('|', '/'));
  }

  static toString(value: Event): string {
    return value.toString();
  }

  static sanitizeRecur(recur?: number): number | undefined {
    return recur != null && Number.isInteger(recur) && recur >= 0 && recur <= 30 ? recur : undefined;
  }

  withUpdate(fields: {comment?: string, finished?: boolean, timeinput?: string, title?: string, recur?: number, regenKey?: boolean}): Event {
    return new Event(
      parseTimeInput(fields.timeinput) ?? this.timeMinutes,
      Event.sanitizeTitle(fields.title) ?? this.title,
      fields.comment != null ? Event.sanitizeComment(fields.comment) : this.comment,
      Event.sanitizeRecur(fields.recur) ?? this.recurDays,
      fields.finished ?? this.finished,
      fields.regenKey ? getMagicKey() : this.magicKey);
  }

  private sortKey(): number {
    return (this.isValid() ? this.timeMinutes * 1000 : 60*24*2000) + this.magicKey;
  }

  static compare(a: Event, b: Event): number {
    return a.sortKey() - b.sortKey();
  }
}

const EventRegex = /^(?<time>\d\d:\d\d)\|\|(?<title>[^|\n]+)\|(?<comment>[^|\n]*)\|(?<recur>\d*)\|(?<marked>F?)$/;

type NamedGroups = {[key: string]: string | undefined};
function extractNamedGroups(regex: RegExp, match: string): NamedGroups | undefined {
  const result = regex.exec(match);
  if (!result) return undefined;
  return result.groups || {};
}

function maybeParse(value: string | undefined, mult?: number): number {
  return Number.parseInt(value || '0') * (mult ?? 1);
}

function parseTimeInput(value?: string): number | undefined {
  if (!value || value.length !== 5 || !/^\d\d:\d\d$/.test(value)) return undefined;
  const hour = Number.parseInt(value.substring(0, 2));
  const minute = Number.parseInt(value.substring(3, 5));
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return undefined;
  return hour * 60 + minute;
}

export function pad2(num: number): string {
  return num.toString().padStart(2, '0');
}

export type Callback<T> = (x: T) => void;
export type Func = () => void;

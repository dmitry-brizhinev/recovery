import { castToTypedef, StrongTypedef } from "./StrongTypedef";

export interface User {
  name: string | null;
  uid: string;
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

declare const calendarid: unique symbol;

export type PageData = string;
export type PageMap = Map<PageId, PageData>;
export type CalendarId = StrongTypedef<string, typeof calendarid>;
export type CalendarPageData = string;
export type CalendarPageMap = Map<CalendarId, CalendarPageData>;
export type CalendarEventData = Event[];
export type CalendarEventMap = Map<CalendarId, CalendarEventData>;
export interface CalendarData {
  pages: CalendarPageMap;
  events: CalendarEventMap;
}

export interface UserData {
  pages: PageMap;
  calendar: CalendarData;
}

export function getBackupString(data: UserData): string {
  return JSON.stringify(Array.from(data.pages.entries())) +
    JSON.stringify(Array.from(data.calendar.pages.entries())) +
    JSON.stringify(Array.from(data.calendar.events.entries()));
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

export function dateToId(date: Date): CalendarId {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const id = checkIdString(`C${year}-${month}-${day}`);
  if (!id) throw new Error(`Failed constructing CalendarId with date ${date}`);
  return id;
}

export function idToDay(id: CalendarId): Day {
  const year = Number.parseInt(id.substring(1, 5));
  const month = Number.parseInt(id.substring(6, 8));
  const day = Number.parseInt(id.substring(9, 11));
  return {year, month, day};
}


export const enum EventStatus {
  Invalid = 'invalid',
  Inactive = 'inactive',
  Active = 'active',
  Finished = 'finished',
}

declare const validcomment: unique symbol;
export type ValidComment = StrongTypedef<string, typeof validcomment>;

export class Event {
  private constructor(
    readonly timeMinutes: number,
    readonly notifyMinutes: number, // 0 = don't notify
    readonly title: string,
    readonly comment: ValidComment,
    readonly recurDays: number,     // 0 = don't recur
    readonly status: EventStatus,
  ) {

  }

  isActive(): boolean {
    return this.status === EventStatus.Active;
  }

  isValid(): boolean {
    return this.status !== EventStatus.Invalid;
  }

  isFinished(): boolean {
    return this.status === EventStatus.Finished;
  }

  getScheduledDate(dayId: CalendarId): Date {
    const {year, month, day} = idToDay(dayId);
    return new Date(year, month-1, day, 0, this.timeMinutes);
  }

  static parse(value: string): Event {
    const result = value.match(EventRegex);
    if (!result) {
      return new Event(0, 0, value, Event.sanitizeComment(''), 0, EventStatus.Invalid);
    }
    const { hour, minute, ap, hours, minutes, title, comment, recur, marked } = result.groups!;
    const timeMinutes = (maybeParse(hour, 60) % (60*12)) + (ap === 'p' ? 60*12 : 0) + maybeParse(minute);
    const notifyMinutes = maybeParse(hours, 60) + maybeParse(minutes);
    const unescapedComment = Event.sanitizeComment((comment || '').replaceAll('\\n', '\n'));
    const recurDays = maybeParse(recur);
    const status = {'X':EventStatus.Active, 'F':EventStatus.Finished}[marked] || EventStatus.Inactive;
    return new Event(timeMinutes, notifyMinutes, title, unescapedComment, recurDays, status);
  }

  toString(): string {
    if (!this.isValid()) {
      return this.title;
    }
    const ap = this.timeMinutes >= 60*12 ? 'p' : 'a';
    const minute = this.timeMinutes % 60 || '';
    const hour = (Math.trunc(this.timeMinutes / 60) % 12);
    // Notify minutes
    const title = this.title;
    const comment = this.comment.replaceAll('\n', '\\n');
    const recur = this.recurDays || '';
    const marked = {active: 'X', finished: 'F', inactive: '', invalid: ''}[this.status];
    return `${hour}${minute && ':'}${minute}${ap}m||${title}|${comment}|${recur}|${marked}`
  }

  static sanitizeComment(comment: string): ValidComment {
    return castToTypedef<ValidComment, typeof validcomment>(comment.replaceAll('|', '/'));
  }

  static toString(value: Event): string {
    return value.toString();
  }

  withUpdate(fields: {comment: string, status?: EventStatus}): Event {
    return new Event(
      this.timeMinutes,
      this.notifyMinutes,
      this.title,
      Event.sanitizeComment(fields.comment),
      this.recurDays,
      fields.status || this.status);
  }

  static compare(a: Event, b: Event): number {
    return a.timeMinutes - b.timeMinutes;
  }
}

const EventRegex = /^(?<hour>\d\d?)(:(?<minute>\d\d))?(?<ap>a|p)m\|((?<hours>\d+)h)?((?<minutes>\d+)m)?\|(?<title>[^|\n]+)\|(?<comment>[^|\n]*)\|(?<recur>\d*)\|(?<marked>X|F)?$/;
// export const CommentRegex = /(?<=^\d\d?(?::\d\d)?[ap]m\|(?:\d+h)?(?:\d+m)?\|[^|\n]+\|)[^|\n]*(?=\|\d*\|[XF]?$)/;

function maybeParse(value: string | undefined, mult?: number): number {
  return Number.parseInt(value || '0') * (mult ?? 1);
}

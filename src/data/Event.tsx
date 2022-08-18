import type {CalendarId} from "./CalendarId";
import {idToDate} from "./DateId";
import {pad2, extractNamedGroups} from "../util/Utils";
import {castToTypedef, StrongTypedef} from "../util/StrongTypedef";

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

export default class Event {
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
    const date = idToDate(dayId);
    date.setMinutes(this.isValid() ? this.timeMinutes : 0);
    return date;
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
    const {time, title, comment, recur, marked} = result;
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
    return castToTypedef<typeof validcomment, string>(comment.replaceAll('|', '/'));
  }

  static toString(value: Event): string {
    return value.toString();
  }

  static sanitizeRecur(recur?: number): number | undefined {
    return recur != null && Number.isInteger(recur) && recur >= 0 && recur <= 30 ? recur : undefined;
  }

  withUpdate(fields: {timeinput?: string, title?: string, comment?: string, recur?: number, finished?: boolean, regenKey?: boolean}): Event {
    const timeMinutes = parseTimeInput(fields.timeinput) ?? this.timeMinutes;
    const title = Event.sanitizeTitle(fields.title) ?? this.title;
    const comment = fields.comment != null ? Event.sanitizeComment(fields.comment) : this.comment;
    const recurDays = Event.sanitizeRecur(fields.recur) ?? this.recurDays;
    const finished = fields.finished ?? this.finished;
    const magicKey = fields.regenKey ? getMagicKey() : this.magicKey;

    if (timeMinutes === this.timeMinutes &&
      title === this.title &&
      comment === this.comment &&
      recurDays === this.recurDays &&
      finished === this.finished &&
      magicKey === this.magicKey) {
      return this;
    }

    return new Event(
      timeMinutes,
      title,
      comment,
      recurDays,
      finished,
      magicKey);
  }

  private sortKey(): number {
    return (this.isValid() ? this.timeMinutes * 1000 : 60 * 24 * 2000) + this.magicKey;
  }

  static compare(a: Event, b: Event): number {
    return a.sortKey() - b.sortKey();
  }
}

const EventRegex = /^(?<time>\d\d:\d\d)\|\|(?<title>[^|\n]+)\|(?<comment>[^|\n]*)\|(?<recur>\d*)\|(?<marked>F?)$/;

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

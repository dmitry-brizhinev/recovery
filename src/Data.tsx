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

export type PageData = string;
export type PageMap = Map<PageId, PageData>;
export type CalendarId = StrongTypedef<string>;
export type CalendarPageData = string;
export type CalendarPageMap = Map<CalendarId, CalendarPageData>;
export type CalendarEventData = string[];
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
  
  const cid = castToTypedef(id);

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


export const enum ScheduleStatus {
  Inactive = 'inactive',
  Active = 'active',
  Finished = 'finished',
}

export interface Schedule {
  timeMinutes: number;
  notifyMinutes: number; // 0 = don't notify
  title: string;
  comment: string;       // May be empty
  recurDays: number;     // 0 = don't recur
  status: ScheduleStatus;
}

export function getScheduledDate(dayId: CalendarId, schedule: Schedule): Date {
  const {year, month, day} = idToDay(dayId);
  return new Date(year, month-1, day, 0, schedule.timeMinutes);
}

export function isActive(schedule: Schedule): boolean {
  return schedule.status === ScheduleStatus.Active;
}

const ScheduleRegex = /^(?<hour>\d\d?)(:(?<minute>\d\d))?(?<ap>a|p)m\|((?<hours>\d+)h)?((?<minutes>\d+)m)?\|(?<title>[^|\n]+)\|(?<comment>[^|\n]*)\|(?<recur>\d*)\|(?<marked>X|F)?$/;
export const CommentRegex = /(?<=^\d\d?(?::\d\d)?[ap]m\|(?:\d+h)?(?:\d+m)?\|[^|\n]+\|)[^|\n]*(?=\|\d*\|[XF]?$)/;

function maybeParse(value: string | undefined, mult?: number): number {
  return Number.parseInt(value || '0') * (mult ?? 1);
}

export function parseSchedule(value: string): Schedule | null {
  const result = value.match(ScheduleRegex);
  if (!result) {
    return null;
  }
  const { hour, minute, ap, hours, minutes, title, comment, recur, marked } = result.groups!;
  const timeMinutes = maybeParse(hour, 60) + (ap === 'p' ? 60*12 : 0) + maybeParse(minute);
  const notifyMinutes = maybeParse(hours, 60) + maybeParse(minutes);
  const recurDays = maybeParse(recur);
  const status = {'X':ScheduleStatus.Active, 'F':ScheduleStatus.Finished}[marked] || ScheduleStatus.Inactive;
  return {timeMinutes, notifyMinutes, title, comment: comment || '', recurDays, status};
}
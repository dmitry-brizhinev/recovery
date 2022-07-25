
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
export type CalendarId = string;
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

export function dateToId(date: Date): CalendarId {
  return `C${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

export function idToDay(id: CalendarId): {year: number, month: number, day: number} {
  const year = Number.parseInt(id.substring(1, 5));
  const month = Number.parseInt(id.substring(6, 8));
  const day = Number.parseInt(id.substring(9, 11));
  return {year, month, day};
}
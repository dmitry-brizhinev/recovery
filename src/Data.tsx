
export interface User {
  name: string | null;
  id: string;
}

export enum PageId {
  todo = 'todo',
  plan = 'plan',
  oneoff = 'oneoff',
  exerc = 'exerc',
  resea = 'resea',
  buy = 'buy',
  think = 'think',
  psych = 'psych',
  eggy = 'eggy',
  other = 'other',
}

export type CalendarPageData = string;
export type CalendarEventData = string[];
export type CalendarId = string;
export type CalendarPageMap = Map<CalendarId, CalendarPageData>;
export type CalendarEventMap = Map<CalendarId, CalendarEventData>;
export interface CalendarData {
  pages: CalendarPageMap;
  events: CalendarEventMap;
}

export interface MyData {
  pages: Map<PageId, string>;
  calendar: CalendarData;
}

export function dateToId(date: Date): CalendarId {
  return `C${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}
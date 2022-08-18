import {checkDateId, DateId, dateToId, incrementId} from "./DateId";

export type CalendarId = DateId<'C'>;

export function checkCalendarId(id: string): CalendarId | null {
  return checkDateId(id, 'C');
}

export function dateToCId(date: Date): CalendarId {
  return dateToId(date, 'C');
}

export function incrementCId(id: CalendarId, incrementDays: number): CalendarId {
  return incrementId<'C'>(id, incrementDays);
}


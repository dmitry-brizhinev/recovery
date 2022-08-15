import { assert, Day, pad2 } from "../util/Utils";
import { castToTypedef, StrongTypedef } from "../util/StrongTypedef";

declare const calendarid : unique symbol;
export type CalendarId = StrongTypedef<string, typeof calendarid>;

const CalendarIdRegex = /^C(20\d\d)-([01]\d)-([0123]\d)$/;

export function checkCalendarId(id: string): CalendarId | null {
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
  const id = checkCalendarId(`C${year}-${month}-${day}`);
  assert(id, `Failed constructing CalendarId with date ${date}`);
  return id;
}

export function incrementId(id: CalendarId, incrementDays: number): CalendarId {
  const date = idToDate(id);
  date.setDate(date.getDate() + incrementDays);
  return dateToId(date);
}

export function idToDay(id: CalendarId): Day {
  const year = Number.parseInt(id.substring(1, 5));
  const month = Number.parseInt(id.substring(6, 8));
  const day = Number.parseInt(id.substring(9, 11));
  return {year, month, day};
}

export function idToDate(id: CalendarId): Date {
  const {year, month, day} = idToDay(id);
  return new Date(year, month-1, day);
}

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {weekday: 'long'});
const monthFormatter = new Intl.DateTimeFormat('en-US', {month: 'short'});

export function idToNiceString(id: CalendarId): string {
  const idDate = idToDate(id);
  const toDate = new Date(); toDate.setHours(0, 0, 0, 0);
  

  const dayDiff = Math.round((toDate.getTime() - idDate.getTime()) / (1000*60*60*24));

  let weekday = weekdayFormatter.format(idDate);

  if (dayDiff === 0) weekday = 'Today';
  else if (dayDiff === 1) weekday = 'Yesterday';
  else if (dayDiff === -1) weekday = 'Tomorrow';
  else if (dayDiff >= -7 && dayDiff <= 7) {
    weekday = dayDiff < 0 ? `Next ${weekday}` : `Last ${weekday}`;
  }

  const month = monthFormatter.format(idDate);
  const day = pad2(idDate.getDate());

  if (idDate.getFullYear() === toDate.getFullYear()) {
    return `${weekday}, ${month} ${day}`;
  } else {
    const year = idDate.getFullYear();
    return `${weekday}, ${year}-${month}-${day}`;
  }
}

import {assert, type Day, pad2} from "../util/Utils";
import {castToTypedef, type StrongTypedef} from "../util/StrongTypedef";

interface DateIdMap {
  'C': DateId<'C'>;
  'E': DateId<'E'>;
  'J': DateId<'J'>;
}

type RawDateId<T extends keyof DateIdMap> = `${T}${string}`;
declare const dateid: unique symbol;
export type DateId<T extends keyof DateIdMap> = StrongTypedef<RawDateId<T>, typeof dateid>;
type AnyDateId = DateIdMap[keyof DateIdMap];

const DateIdRegex = /^[CEJ](20\d\d)-([01]\d)-([0123]\d)$/;

export function checkDateId<T extends keyof DateIdMap>(id: string, cej: T): DateIdMap[T] | null {
  if (!DateIdRegex.test(id)) return null;
  if (!id.startsWith(cej)) return null;

  const did = castToTypedef<typeof dateid, RawDateId<T>>(`${cej}${id.slice(1)}`);

  const {month, day} = idToDay(did);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return did;
}

export function dateToId<T extends keyof DateIdMap>(date: Date, cej: T): DateIdMap[T] {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const id = checkDateId(`${cej}${year}-${month}-${day}`, cej);
  assert(id, `Failed constructing DateId with date ${date}`);
  return id;
}

export function incrementId<T extends keyof DateIdMap>(id: DateId<T>, incrementDays: number): DateIdMap[T] {
  const date = idToDate(id);
  date.setDate(date.getDate() + incrementDays);
  return dateToId<T>(date, id.charAt(0) as T);
}

export function idToDay(id: DateId<any>): Day {
  const year = Number.parseInt(id.substring(1, 5));
  const month = Number.parseInt(id.substring(6, 8));
  const day = Number.parseInt(id.substring(9, 11));
  return {year, month, day};
}

export function idToDate(id: DateId<any>): Date {
  const {year, month, day} = idToDay(id);
  return new Date(year, month - 1, day);
}

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {weekday: 'long'});
const monthFormatter = new Intl.DateTimeFormat('en-US', {month: 'short'});

export function idToNiceString(id: AnyDateId): string {
  const idDate = idToDate(id);
  const toDate = new Date(); toDate.setHours(0, 0, 0, 0);


  const dayDiff = Math.round((toDate.getTime() - idDate.getTime()) / (1000 * 60 * 60 * 24));

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

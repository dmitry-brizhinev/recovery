import { castToTypedef, StrongTypedef } from "../util/StrongTypedef";
import { Day, extractNamedGroups, pad2 } from "../util/Utils";
import { Map as IMap } from 'immutable';

export type JournalData = IMap<JournalId, Journal>;
export type JournalDiff = Map<JournalId, Journal | null>;
export const makeJournalDiff = () => new Map();
// type JournalTypes = {id: JournalId, data: Journal};

declare const journalid : unique symbol;
export type JournalId = StrongTypedef<string, typeof journalid>;

const JournalIdRegex = /^J(20\d\d)-([01]\d)-([0123]\d)$/;

export function checkJournalId(id: string): JournalId | null {
  if (!JournalIdRegex.test(id)) return null;
  
  return castToTypedef<JournalId, typeof journalid>(id);

  //const {month, day} = idToDay(cid);
  //if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  //return cid;
}

export function dateToJId(date: Date): JournalId {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const id = checkJournalId(`J${year}-${month}-${day}`);
  if (!id) throw new Error(`Failed constructing JournalId with date ${date}`);
  return id;
}

export function incrementJId(id: JournalId, incrementDays: number): JournalId {
  const {year, month, day} = jidToDay(id);
  return dateToJId(new Date(year, month-1, day + incrementDays));
}

export function jidToDay(id: JournalId): Day {
  const year = Number.parseInt(id.substring(1, 5));
  const month = Number.parseInt(id.substring(6, 8));
  const day = Number.parseInt(id.substring(9, 11));
  return {year, month, day};
}

const JournalRegex = /^J\((?<main>.+)\)$/s;

export class Journal {
  constructor(
    readonly main: string,
  ) {}

  static parse(value: string): Journal {
    const result = extractNamedGroups(JournalRegex, value);
    if (!result || !result.main) {
      return new Journal(value);
    }
    return new Journal(result.main);
  }

  withUpdate(main: string): Journal | null {
    if (this.main === main) return this;
    if (!main) return null;
    return new Journal(main);
  }

  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    return `J(${this.main})`;
  }

  static toString(value: Journal): string {
    return value.toString();
  }
}
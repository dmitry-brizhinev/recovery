import {extractNamedGroups} from "../util/Utils";
import type {Map as IMap} from 'immutable';
import {checkDateId, DateId, dateToId, incrementId} from "./DateId";

export type JournalData = IMap<JournalId, Journal>;
export type JournalDiff = Map<JournalId, Journal | null>;
export const makeJournalDiff: () => JournalDiff = () => new Map();
// type JournalTypes = {id: JournalId, data: Journal};
;
export type JournalId = DateId<'J'>;

export function checkJournalId(id: string): JournalId | null {
  return checkDateId(id, 'J');
}

export function dateToJId(date: Date): JournalId {
  return dateToId(date, 'J');
}

export function incrementJId(id: JournalId, incrementDays: number): JournalId {
  return incrementId<'J'>(id, incrementDays);
}

export interface JournalUpdate {id: JournalId, data: Journal | null;}

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

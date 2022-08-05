import Immutable from 'immutable';

import { Map as IMap } from 'immutable';
import { CalendarId } from './CalendarId';

import Event from './Event';
import { PageId } from './PageId';

export interface User {
  readonly name: string | null;
  readonly uid: string;
}

export type PageData = PageTypes['data'];
export type PageMap = DMap<PageTypes>;

export type CalendarPageData = CalendarPageTypes['data'];
export type CalendarPageMap = DMap<CalendarPageTypes>;
export type CalendarEventData = CalendarEventTypes['data'];
export type CalendarEventMap = DMap<CalendarEventTypes>;

type DataType = {id: unknown, data: unknown, leaf?: unknown, key?: unknown[]};
type DMap<T extends DataType> = IMap<T['id'], T['data']>;
type MMap<T extends DataType> = Map<T['id'], T['data'] | null>;
type Leaf<T extends DataType> = unknown extends T['leaf'] ? T['data'] : T['leaf'];
type KKey<T extends DataType> = T['key'] extends unknown[] ? T['key'] : [];

type PageTypes = {id: PageId, data: readonly [string, string]};
type CalendarPageTypes = {id: CalendarId, data: string};
type CalendarEventTypes = {id: CalendarId, data: IMap<number, Event>, leaf: Event, key: [number]};

// const headings = ['pages', 'calendarPages', 'calendarEvents'] as const;
export type DataTypes = {pages: PageTypes, calendarPages: CalendarPageTypes, calendarEvents: CalendarEventTypes};
export type DataId = keyof DataTypes;
type UserDataType = {[T in DataId]: DMap<DataTypes[T]>};
type UserDataDiff = {[T in DataId]: MMap<DataTypes[T]>};
export type UserDataLeaf = {[T in DataId]: Leaf<DataTypes[T]>};
export type UserDataKey = {[T in DataId]: readonly [T, DataTypes[T]['id'], ...KKey<DataTypes[T]>]};

export const makeUserData: Immutable.Record.Factory<UserDataType> = Immutable.Record<UserDataType>({pages: IMap(), calendarPages: IMap(), calendarEvents: IMap()});
export type UserData = Immutable.RecordOf<UserDataType>;

const makeDataDiffInner: Immutable.Record.Factory<UserDataDiff> = Immutable.Record(MakeUserDataDiff());
export type DataDiff = Immutable.RecordOf<UserDataDiff>;

/*function MakeIMap<T extends DataType>(): DMap<T> {
  return IMap();
}

function MakeUserDataType(): UserDataType {
  const x = Object.fromEntries(headings.map(x => [x, MakeIMap<DataTypes[typeof x]>()]));
  return x;
}*/

function MakeMap<T extends DataType>(): MMap<T> {
  return new Map();
}

function MakeUserDataDiff(): UserDataDiff {
  return {pages: MakeMap(), calendarPages: MakeMap(), calendarEvents: MakeMap()};
}

export function makeDataDiff(): DataDiff {
  return makeDataDiffInner(MakeUserDataDiff());
}

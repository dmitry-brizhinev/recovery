import Immutable from 'immutable';

import { Map as IMap } from 'immutable';
import { CalendarId } from './CalendarId';

import Event from './Event';
import { PageId } from './PageId';

export interface User {
  readonly name: string | null;
  readonly uid: string;
}

export type PageData = string;
export type PageMap = DMap<PageTypes>;

export type CalendarPageData = string;
export type CalendarPageMap = DMap<CalendarPageTypes>;
export type CalendarEventData = IMap<number, Event>;
export type CalendarEventMap = DMap<CalendarEventTypes>;

type DataType = {id: any, data: any};

type PageTypes = {id: PageId, data: PageData};
type CalendarPageTypes = {id: CalendarId, data: CalendarPageData};
type CalendarEventTypes = {id: CalendarId, data: CalendarEventData};

const magic: unknown = undefined;
const headings = {'pages': magic as PageTypes, 'calendarPages': magic as CalendarPageTypes, 'calendarEvents': magic as CalendarEventTypes} as const;
type Headings = typeof headings;
export type DataTypes = {-readonly [I in keyof Headings]: Headings[I]};
export type DataId = keyof DataTypes;
type UserDataType = {[T in DataId]: DMap<DataTypes[T]>};
type UserDataDiff = {[T in DataId]: MMap<DataTypes[T]>};

type DMap<T extends DataType> = IMap<T['id'], T['data']>;
type MMap<T extends DataType> = Map<T['id'], T['data'] | null>;

export const makeUserData: Immutable.Record.Factory<UserDataType> = Immutable.Record<UserDataType>({pages: IMap(), calendarPages: IMap(), calendarEvents: IMap()});
export type UserData = Immutable.RecordOf<UserDataType>;

export const makeDataDiff: Immutable.Record.Factory<UserDataDiff> = Immutable.Record<UserDataDiff>({pages: new Map(), calendarPages: new Map(), calendarEvents: new Map()});
export type DataDiff = Immutable.RecordOf<UserDataDiff>;

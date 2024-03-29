import {deleteField, FieldValue} from "firebase/firestore/lite";
import type {UserData, PageData, CalendarPageData, CalendarEventData, PageMap, CalendarPageMap, CalendarEventMap, DataDiff} from '../data/Data';
import {makeUserData} from '../data/Data';
import Event from '../data/Event';
import {Map as IMap} from 'immutable';
import {type CalendarId, checkCalendarId} from '../data/CalendarId';
import {checkPageId, type PageId} from '../data/PageId';
import {getDocument, writeDocument} from "./Firestore";

export async function getData(): Promise<UserData> {
  const data = await getDocument('users');
  const pages: PageMap = IMap<PageId, PageData>().asMutable();
  const calendarPages: CalendarPageMap = IMap<CalendarId, CalendarPageData>().asMutable();
  const events: CalendarEventMap = IMap<CalendarId, CalendarEventData>().asMutable();

  if (data != null) {
    for (const [key, valuex] of Object.entries(data)) {
      const isPage = key.startsWith('P');
      if (isPage) {
        const id = checkPageId(key);
        if (typeof valuex !== 'string' || !id) {
          continue;
        } else {
          const split = valuex.indexOf('\n');
          if (split === -1) {
            pages.set(id, [valuex, '']);
          } else {
            const title = valuex.substring(0, split);
            const body = valuex.substring(split + 1);
            pages.set(id, [title, body]);
          }
          continue;
        }
      }
      const isEvent = key.startsWith('EC20');
      const cid = checkCalendarId(isEvent ? key.substring(1) : key);
      if (!cid) {
        continue;
      }
      const value = typeof valuex === 'string' ? valuex : `WRONG TYPE ${typeof valuex}`;
      if (isEvent) {
        events.set(cid, IMap(value.split('\n').map(Event.parseAndGenKey).map(event => [event.magicKey, event])));
      } else {
        calendarPages.set(cid, value);
      }
    }
  }

  return makeUserData({
    pages: pages.asImmutable(),
    calendarPages: calendarPages.asImmutable(),
    calendarEvents: events.asImmutable()
  });
}

export async function saveAll(diffs: DataDiff) {
  const data: {[key: string]: string | FieldValue;} = {};
  for (const [key, value] of diffs.pages) {
    data[key] = value?.join('\n') || deleteField();
  }
  for (const [key, value] of diffs.calendarPages) {
    data[key] = value || deleteField();
  }
  for (const [key, value] of diffs.calendarEvents) {
    data['E' + key] = value?.map(Event.toString).join('\n') || deleteField();
  }
  await writeDocument('users', data);
}

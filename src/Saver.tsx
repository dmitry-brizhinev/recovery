import { CalendarEventData, CalendarId, CalendarPageData, Callback, PageData, PageId, UserData } from './Data';
import { saveAll } from './Firebase';

const enum SaverStatusString {
  Unsaved = ' [Unsaved..] ',
  Saving = ' [Saving...] ',
  Saved = ' [  Saved  ] ',
}

interface PageKey {
  readonly type: 'pages';
  readonly key: PageId;
}

interface CalendarKey {
  readonly type: 'calendarPages' | 'calendarEvents';
  readonly key: CalendarId;
}

export type Key = PageKey | CalendarKey;

export class Saver {
  private pages = new Map<PageId, PageData | null>();
  private calendarPages = new Map<CalendarId, CalendarPageData | null>();
  private calendarEvents = new Map<CalendarId, CalendarEventData | null>();
  private static readonly delay = 2000;
  private timeout?: NodeJS.Timeout;

  constructor(private readonly onStatusUpdate: Callback<string>) {
    onStatusUpdate(SaverStatusString.Saved);

    this.saveNow = this.saveNow.bind(this);
    this.saveDone = this.saveDone.bind(this);
  }

  private saveNow() {
    this.timeout = undefined;
    const [a,b,c] = [this.pages, this.calendarPages, this.calendarEvents];
    this.onStatusUpdate(SaverStatusString.Saving);
    this.pages = new Map();
    this.calendarPages = new Map();
    this.calendarEvents = new Map();
    saveAll(a,b,c).then(this.saveDone);
  }

  private saveDone() {
    if (!this.timeout) {
      this.onStatusUpdate(SaverStatusString.Saved);
    }
  }

  logUpdate(newData: UserData, key: Key) {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    switch (key.type) {
      case 'pages':
        const x = newData.get(key.type).get(key.key, null);
        this.pages.set(key.key, x);
        break;
      case 'calendarPages':
        const y = newData.get(key.type).get(key.key, null);
        this.calendarPages.set(key.key, y);
        break;
      case 'calendarEvents':
        const z = newData.get(key.type).get(key.key, null);
        this.calendarEvents.set(key.key, z);
        break;
    }

    this.onStatusUpdate(SaverStatusString.Unsaved);

    this.timeout = setTimeout(this.saveNow, Saver.delay);
  }
}

import type {DataId, UserDataKey, UserDataLeaf, CalendarPageData, PageData} from '../data/Data';
import type Event from '../data/Event';
import type {CalendarId} from '../data/CalendarId';
import type {PageId} from '../data/PageId';
import type {Journal, JournalId} from '../data/Journal';
import type {Code, CodeId, CodeOrTest} from '../data/Code';

export class Root {
  /*private onUpdateA<K extends DataId>(key: UserDataKey[K], value: UserDataLeaf[K] | null) {
    this.data = value ? this.data.setIn(key, value) : this.data.deleteIn(key);
    this.saver.logUpdate(this.data, {type: key[0], key: key[1]});
    this.subscriber(this.data);
  }

  private onUpdateB(key: JournalId, value: Journal | null) {
    this.data = value ? this.data.set(key, value) : this.data.delete(key);
    this.saver.logUpdate(this.data, key);
    this.subscriber(this.data);
  }

  private onUpdateC(key: CodeOrTest, value: Code | null) {
    this.data = value ? this.data.set(key, value) : this.data.delete(key);
    this.saver.logUpdate(this.data, key);
    this.subscriber(this.data);
  }*/
}

export class PageRoot {
  onPageUpdate(id: PageId, data: PageData | null): void {}
}

export class CalendarRoot {
  onCalendarUpdate(id: CalendarId, data: CalendarPageData | null): void {}
}

export class EventRoot {
  onEventUpdate(id: CalendarId, magicKey: number, event: Event | null): void {}
}

export class JournalRoot {
  onJournalUpdate(id: JournalId, data: Journal | null): void {}
}

export class ProgramRoot {
  onCodeUpdate(id: CodeOrTest, data: Code | null) {}
  onCodeIdUpdate(oldId: CodeId, newId: CodeId) {}
}

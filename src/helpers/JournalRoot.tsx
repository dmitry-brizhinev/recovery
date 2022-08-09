import * as React from 'react'
import type JournalSaver from './JournalSaver';
import type { Callback } from '../util/Utils';
import type { Journal, JournalData, JournalId } from '../data/Journal';

export abstract class JournalRoot {
  abstract onJournalUpdate(id: JournalId, data: Journal | null): void;
}

export class JournalEmptyRoot extends JournalRoot {
  onJournalUpdate() {}
}

export class JournalDataRoot extends JournalRoot {
  constructor(
    private data: JournalData,
    private readonly subscriber: Callback<JournalData>,
    private readonly saver: JournalSaver) {
    super();
  }

  private onUpdate(key: JournalId, value: Journal | null) {
    this.data = value ? this.data.set(key, value) : this.data.delete(key);
    this.saver.logUpdate(this.data, key);
    this.subscriber(this.data);
  }

  onJournalUpdate(id: JournalId, data: Journal | null) {
    this.onUpdate(id, data);
  }
}

export const JournalRootContext = React.createContext<JournalRoot>(new JournalEmptyRoot());
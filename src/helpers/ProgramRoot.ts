import ProgramSaver from './ProgramSaver';
import type { Callback } from '../util/Utils';
import type { CodeData, Code, CodeId } from '../data/Code';


export default class ProgramRoot {
  private readonly saver: ProgramSaver;
  constructor(
    private data: CodeData,
    private readonly subscriber: Callback<CodeData>,
    onSaverUpdate: Callback<string>) {
      this.saver = new ProgramSaver(onSaverUpdate);
  }

  private onUpdate(key: CodeId, value: Code | null) {
    this.data = value ? this.data.set(key, value) : this.data.delete(key);
    this.saver.logUpdate(this.data, key);
    this.subscriber(this.data);
  }

  onCodeUpdate(id: CodeId, data: Code | null) {
    this.onUpdate(id, data);
  }

  onCodeIdUpdate(oldId: CodeId, newId: CodeId) {
    if (oldId === 'tests' || newId === 'tests') return;
    if (newId === oldId) return;
    while (this.data.has(newId)) {
      newId = `${newId.slice(0, -4)}(c).phi`;
    }
    const value = this.data.get(oldId, '');
    this.data = this.data.delete(oldId).set(newId, value);
    this.saver.logUpdate(this.data, oldId);
    this.saver.logUpdate(this.data, newId);
    this.subscriber(this.data);
  }
}

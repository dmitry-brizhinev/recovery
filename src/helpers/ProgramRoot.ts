import type ProgramSaver from './ProgramSaver';
import type { Callback } from '../util/Utils';
import type { CodeData, Code, CodeId } from '../data/Code';


export default class ProgramRoot {
  constructor(
    private data: CodeData,
    private readonly subscriber: Callback<CodeData>,
    private readonly saver: ProgramSaver) {
  }

  private onUpdate(key: CodeId, value: Code | null) {
    this.data = value ? this.data.set(key, value) : this.data.delete(key);
    this.saver.logUpdate(this.data, key);
    this.subscriber(this.data);
  }

  onCodeUpdate(id: CodeId, data: Code | null) {
    this.onUpdate(id, data);
  }
}

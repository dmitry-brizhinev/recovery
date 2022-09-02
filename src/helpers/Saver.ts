import {type Callback, cancellableDelay, type Func} from '../util/Utils';

export const enum SaverStatusString {
  Unsaved = ' [Unsaved..] ',
  Saving = ' [Saving...] ',
  Saved = ' [  Saved  ] ',
}

export default class Saver<T> {
  private diffs: T = this.make();
  private cancel?: Func | undefined;

  constructor(
    private readonly onStatusUpdate: Callback<SaverStatusString>,
    private readonly make: () => T,
    private readonly save: (diff: T) => Promise<void>,
    private readonly delay = 2000
  ) {
    onStatusUpdate(SaverStatusString.Saved);

    this.saveNow = this.saveNow.bind(this);
    this.saveDone = this.saveDone.bind(this);
  }

  private saveNow() {
    this.cancel = undefined;
    const diffs = this.diffs;
    this.onStatusUpdate(SaverStatusString.Saving);
    this.diffs = this.make();
    this.save(diffs).then(this.saveDone);
  }

  private saveDone() {
    if (!this.cancel) {
      this.onStatusUpdate(SaverStatusString.Saved);
    }
  }

  logUpdate(updater: (diff: T) => T) {
    if (this.cancel) {
      this.cancel();
    }
    this.diffs = updater(this.diffs);

    this.onStatusUpdate(SaverStatusString.Unsaved);

    this.cancel = cancellableDelay(this.saveNow, this.delay);
  }
}

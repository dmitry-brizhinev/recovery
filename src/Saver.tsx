import * as React from 'react'

interface SaverProps<SavedData,Id> {
  data: SavedData;
  id: Id;
  saver: (id: Id, data: SavedData) => Promise<void>;
  render: (id: Id, data: SavedData, status: SaverStatusString, onChange: (id: Id, data: SavedData, opts?: {force?: boolean}) => void) => JSX.Element;
  delay: number;
}

export const enum SaverStatusString {
  Unsaved = ' [Unsaved..]',
  Saving = ' [Saving...]',
  Saved = ' [  Saved  ]',
}

const enum SaverStatus {
  Saved,
  Saving,
  Cooling,
}

interface SaverState<SavedData,Id> {
  data: SavedData;
  id: Id;
  status: SaverStatusString;
}

class Alarm {
  trigger: () => void;
  triggered: Promise<void>;

  constructor() {
    this.trigger = () => {};
    this.triggered = new Promise(resolve => this.trigger = resolve);
  }
}

class InnerSaver<SavedData,Id> {
  delay: number;
  force = new Alarm();
  status = SaverStatus.Saved;
  modified: boolean = false;
  id: Id;
  data: SavedData;
  onStatusUpdate: (id: Id, status: SaverStatusString) => void;
  saver: (id: Id, data: SavedData) => Promise<void>;

  constructor(id: Id, data: SavedData, delay: number, saver: (id: Id, data: SavedData) => Promise<void>, onStatusUpdate: (id: Id, status: SaverStatusString) => void) {
    this.delay = delay;
    this.id = id;
    this.data = data;
    this.saver = saver;
    this.onStatusUpdate = onStatusUpdate;
  }

  onChange(data: SavedData, opts?: {force?: boolean}) {
    this.data = data;
    if (opts && opts.force) {
      this.force.trigger();
    }
    this.modified = true;
    this.setStatus();
    if (this.status === SaverStatus.Saved) {
      this.definitelySave();
    }
  }

  async definitelySave() {
    do {
      this.status = SaverStatus.Cooling;
      this.setStatus();
      await Promise.race([delay(this.delay), this.force.triggered]);
      this.status = SaverStatus.Saving;
      this.modified = false;
      this.force = new Alarm();
      this.setStatus();
      await this.saver(this.id, this.data);
    } while (this.modified);
    this.status = SaverStatus.Saved;
    this.setStatus();
  }

  statusText(): SaverStatusString {
    if (this.modified) {
      return SaverStatusString.Unsaved;
    }
    switch (this.status) {
      case SaverStatus.Saving:
        return SaverStatusString.Saving;
      case SaverStatus.Saved:
      case SaverStatus.Cooling:
        return SaverStatusString.Saved;
    }
  }

  setStatus() {
    this.onStatusUpdate(this.id, this.statusText());
  }
}

export class Saver<SavedData,Id> extends React.Component<SaverProps<SavedData,Id>, SaverState<SavedData,Id>> {
  static defaultProps = {
    delay: 5000
  }

  inner: Map<Id, InnerSaver<SavedData,Id>>;
  currentId: Id;

  constructor(props: SaverProps<SavedData,Id>) {
    super(props);
    this.state = {
      data: this.props.data,
      id: this.props.id,
      status: SaverStatusString.Saved,
    };
    this.onChange = this.onChange.bind(this);
    this.onStatusUpdate = this.onStatusUpdate.bind(this);

    this.currentId = this.props.id;
    this.inner = new Map();
    this.inner.set(this.props.id, new InnerSaver(this.props.id, this.props.data, this.props.delay, this.props.saver, this.onStatusUpdate));
  }

  onChange(id: Id, data: SavedData, opts?: {force?: boolean}) {
    this.setState({id: id, data: data});
    this.currentId = id;

    let saver = this.inner.get(id);
    if (!saver) {
      saver = new InnerSaver(id, data, this.props.delay, this.props.saver, this.onStatusUpdate);
      this.inner.set(id, saver);
    }
    saver.onChange(data, opts);
  }

  onStatusUpdate(id: Id, status: SaverStatusString) {
    if (id === this.currentId) {
      this.setState({status: status});
    }
  }

  render() {
    return this.props.render(this.state.id, this.state.data, this.state.status, this.onChange);
  }
}

function delay(millis : number) {
  return new Promise(resolve => setTimeout(resolve, millis));
}
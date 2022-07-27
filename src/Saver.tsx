import * as React from 'react'

interface X {
  Data: any,
  Id: any,
}

type Data<T extends X> = T['Data'];
type Id<T extends X> = T['Id'];

interface SaverProps<T extends X> {
  data: Data<T>;
  id: Id<T>;
  saver: (id: Id<T>, data: Data<T>) => Promise<void>;
  render: (id: Id<T>, data: Data<T>, status: SaverStatusString, onChange: (id: Id<T>, data: Data<T>, opts?: {force?: boolean}) => void) => JSX.Element;
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

interface SaverState<T extends X> {
  data: Data<T>;
  id: Id<T>;
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

export class InnerSaver<T extends X> {
  delay: number;
  force = new Alarm();
  status = SaverStatus.Saved;
  modified: boolean = false;
  id: Id<T>;
  data: Data<T>;
  onStatusUpdate: (id: Id<T>, status: SaverStatusString) => void;
  saver: (id: Id<T>, data: Data<T>) => Promise<void>;

  constructor(id: Id<T>, data: Data<T>, delay: number, saver: (id: Id<T>, data: Data<T>) => Promise<void>, onStatusUpdate: (id: Id<T>, status: SaverStatusString) => void) {
    this.delay = delay;
    this.id = id;
    this.data = data;
    this.saver = saver;
    this.onStatusUpdate = onStatusUpdate;
  }

  onChange(data: Data<T>, opts?: {force?: boolean}) {
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

interface StandaloneSaverProps<T extends X> {
  id: Id<T>;
  data: Data<T>;
  saver: (id: Id<T>, data: Data<T>) => Promise<void>;
  delay: number;
}

interface StandaloneSaverState {
  status: SaverStatusString;
}

export class Saver<T extends X> extends React.Component<StandaloneSaverProps<T>, StandaloneSaverState> {
  static defaultProps = {
    delay: 5000
  }

  inner: Map<Id<T>, InnerSaver<T>>;

  constructor(props: StandaloneSaverProps<T>) {
    super(props);
    this.state = {status: SaverStatusString.Saved};

    this.onStatusUpdate = this.onStatusUpdate.bind(this);

    this.inner = new Map();
    this.inner.set(this.props.id, new InnerSaver(this.props.id, this.props.data, this.props.delay, this.props.saver, this.onStatusUpdate));
  }

  componentDidUpdate(prevProps: StandaloneSaverProps<T>, prevState: StandaloneSaverState) {
    const sameId = prevProps.id === this.props.id;
    const sameData = prevProps.data === this.props.data;
    if (sameId && sameData) {
      return;
    }

    if (!sameId) {
      const s = this.inner.get(prevProps.id)
      if (!s) {
        throw new Error(`Missing saver for ${prevProps.id}`);
      }
      s.onChange(prevProps.data, {force: true});
    }

    let ss = this.inner.get(this.props.id);
    if (!ss) {
      ss = new InnerSaver(this.props.id, this.props.data, this.props.delay, this.props.saver, this.onStatusUpdate);
      this.inner.set(this.props.id, ss);
    }
    ss.onChange(this.props.data, {force: !sameId});
  }

  onStatusUpdate(id: Id<T>, status: SaverStatusString) {
    if (id === this.props.id) {
      this.setState({status});
    }
  }

  render() {
    return this.state.status;
  }
}

export class OverengineeredSaver<T extends X> extends React.Component<SaverProps<T>, SaverState<T>> {
  static defaultProps = {
    delay: 5000
  }

  inner: Map<Id<T>, InnerSaver<T>>;
  currentId: Id<T>;

  constructor(props: SaverProps<T>) {
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

  onChange(id: Id<T>, data: Data<T>, opts?: {force?: boolean}) {
    this.setState({id, data});
    this.currentId = id;

    let saver = this.inner.get(id);
    if (!saver) {
      saver = new InnerSaver(id, data, this.props.delay, this.props.saver, this.onStatusUpdate);
      this.inner.set(id, saver);
    }
    saver.onChange(data, opts);
  }

  onStatusUpdate(id: Id<T>, status: SaverStatusString) {
    if (id === this.currentId) {
      this.setState({status});
    }
  }

  render() {
    return this.props.render(this.state.id, this.state.data, this.state.status, this.onChange);
  }
}

function delay(millis : number) {
  return new Promise(resolve => setTimeout(resolve, millis));
}
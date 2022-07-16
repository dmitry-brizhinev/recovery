import * as React from 'react'

interface SaverProps<SavedData,Id> {
  data: SavedData;
  id: Id;
  saver: (id: Id, data: SavedData) => Promise<void>;
  render: (id: Id, data: SavedData, status: string, onChange: (id: Id, data: SavedData, opts?: {force?: boolean}) => void) => JSX.Element;
  delay: number;
}

const enum SaverStatus {
  Saved,
  Saving,
  Cooling,
}

interface SaverState<SavedData,Id> {
  data: SavedData;
  id: Id;
  status: string;
}

class Alarm {
  trigger: () => void;
  triggered: Promise<void>;

  constructor() {
    this.trigger = () => {};
    this.triggered = new Promise(resolve => this.trigger = resolve);
  }
}

export class Saver<SavedData,Id> extends React.Component<SaverProps<SavedData,Id>, SaverState<SavedData,Id>> {
  static defaultProps = {
    delay: 5000
  }

  force = new Alarm();
  status = SaverStatus.Saved;
  modified: boolean = false;
  recent: {id: Id, data: SavedData};

  constructor(props: SaverProps<SavedData,Id>) {
    super(props);
    this.state = {
      data: this.props.data,
      id: this.props.id,
      status: ' [  Saved  ]',
    };
    this.recent = {id: this.props.id, data: this.props.data};

    this.onChange = this.onChange.bind(this);
  }

  onChange(id: Id, data: SavedData, opts?: {force?: boolean}) {
    this.setState({id: id, data: data});

    this.recent.id = id;
    this.recent.data = data;
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
      await Promise.race([delay(this.props.delay), this.force.triggered]);
      this.status = SaverStatus.Saving;
      this.modified = false;
      this.force = new Alarm();
      this.setStatus();
      await this.props.saver(this.recent.id, this.recent.data);
    } while (this.modified);
    this.status = SaverStatus.Saved;
    this.setStatus();
  }

  statusText(): string {
    if (this.modified) {
      return ' [Unsaved..]';
    }
    switch (this.status) {
      case SaverStatus.Saving:
        return ' [Saving...]';
      case SaverStatus.Saved:
      case SaverStatus.Cooling:
        return ' [  Saved  ]';
    }
  }

  setStatus() {
    this.setState({status: this.statusText()});
  }

  render() {
    return this.props.render(this.state.id, this.state.data, this.state.status, this.onChange);
  }
}

function delay(millis : number) {
  return new Promise(resolve => setTimeout(resolve, millis));
}
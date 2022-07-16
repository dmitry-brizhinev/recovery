import * as React from 'react'

interface SaverProps<SavedData,Id> {
  data: SavedData;
  id: Id;
  saver: (id: Id, data: SavedData) => Promise<void>;
  render: (id: Id, data: SavedData, status: string, onChange: (id: Id, data: SavedData) => void) => JSX.Element;
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
  status: SaverStatus;
  modified: boolean;
}

export class Saver<SavedData,Id> extends React.Component<SaverProps<SavedData,Id>, SaverState<SavedData,Id>> {
  static defaultProps = {
    delay: 5000
  }

  constructor(props: SaverProps<SavedData,Id>) {
    super(props);
    this.state = {data: this.props.data, id: this.props.id, status: SaverStatus.Saved, modified: false};

    this.onChange = this.onChange.bind(this);
  }

  onChange(id: Id, data: SavedData) {
    this.setState({id: id, data: data, modified: true});
    if (this.state.status === SaverStatus.Saved) {
      this.definitelySave(id, data);
    }
  }

  async definitelySave(id: Id, data: SavedData) {
    do {
      this.setState({status: SaverStatus.Saving, modified: false});
      await this.props.saver(id, data);
      this.setState({status: SaverStatus.Cooling});
      await delay(this.props.delay);
      data = this.state.data;
      id = this.state.id;
    } while (this.state.modified);
    this.setState({status: SaverStatus.Saved});
  }

  statusText(): string {
    if (this.state.modified) {
      return ' [Unsaved..]';
    }
    switch (this.state.status) {
      case SaverStatus.Saving:
        return ' [Saving...]';
      case SaverStatus.Saved:
      case SaverStatus.Cooling:
        return ' [  Saved  ]';
    }
  }

  render() {
    return this.props.render(this.state.id, this.state.data, this.statusText(), this.onChange);
  }
}

function delay(millis : number) {
  return new Promise(resolve => setTimeout(resolve, millis));
}
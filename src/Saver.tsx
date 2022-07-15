import * as React from 'react'

interface SaverProps<SavedData> {
  data: SavedData;
  saver: (data: SavedData) => Promise<void>;
  render: (data: SavedData, status: string, onChange: (data: SavedData) => void) => JSX.Element;
  delay: number;
}

const enum SaverStatus {
  Saved,
  Saving,
  Cooling,
}

interface SaverState<SavedData> {
  data: SavedData;
  status: SaverStatus;
  modified: boolean;
}

export class Saver<SavedData> extends React.Component<SaverProps<SavedData>, SaverState<SavedData>> {
  static defaultProps = {
    delay: 5000
  }

  constructor(props: SaverProps<SavedData>) {
    super(props);
    this.state = {data: this.props.data, status: SaverStatus.Saved, modified: false};

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(data: SavedData) {
    this.setState({data: data, modified: true});
    if (this.state.status === SaverStatus.Saved) {
      this.definitelySave(data);
    }
  }

  async definitelySave(data: SavedData) {
    do {
      this.setState({status: SaverStatus.Saving, modified: false});
      await this.props.saver(data);
      this.setState({status: SaverStatus.Cooling});
      await delay(this.props.delay);
      data = this.state.data;
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
    return this.props.render(this.state.data, this.statusText(), this.handleChange);
  }
}

function delay(millis : number) {
  return new Promise(resolve => setTimeout(resolve, millis));
}
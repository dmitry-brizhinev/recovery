import * as React from 'react'
import './App.css'
import { MyUser, MyData, PageId, getSavedUserWithTimeout, loginPopup, getData, savePage } from './auth'

export interface AppState {
  user: MyUser | null;
  awaitingSaved: boolean;
  awaitingLogin: boolean;
}

export default class App extends React.Component<object, AppState> {
  constructor(props: any) {
    super(props);

    this.onClickLogin = this.onClickLogin.bind(this);

    this.state = {user: null, awaitingSaved: true, awaitingLogin: false};
  }

  componentDidMount() {
    getSavedUserWithTimeout(1000).then((user) => {
      this.setState({user: user, awaitingSaved: false});
    });
  }

  async onClickLogin() {
    this.setState({awaitingLogin: true});
    const user = await loginPopup();
        /*}).catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
    });*/
    this.setState({user: user, awaitingLogin: false});
  }

  render() {
    let upper;
    if (this.state.awaitingSaved) {
      upper = 'Loading...';
    } else if (this.state.awaitingLogin) {
      upper = <button disabled={true}>Login</button>;
    } else if (this.state.user == null) {
      upper = <button onClick={this.onClickLogin}>Login</button>;
    } else {
      upper = <></>;
    }
    return <main>
      <h2>Recovery</h2>
      {upper}
      {this.state.user ? <LoggedInApp user={this.state.user}/> : <hr/>}
    </main>;
  }
}

interface LoggedInAppProps {
  user: MyUser;
}

interface LoggedInAppState {
  data: MyData | null;
}

class LoggedInApp extends React.Component<LoggedInAppProps, LoggedInAppState> {
  constructor(props: LoggedInAppProps) {
    super(props);

    this.onClickRefresh = this.onClickRefresh.bind(this);

    this.state = {data: null};
  }

  componentDidMount() {
    getData().then((data) => this.setState({data: data}));
  }

  onClickRefresh() {

  }

  render() {
    return <div>
      {this.props.user.name} --- {new Date().toLocaleString()}
      {this.state.data ? <LoadedApp data={this.state.data}/> : <><hr/>Loading...</>}
    </div>;
  }
}

const PAGE_IDS = {
  'plan': 'To figure out a plan for:',
  'todo': 'To do:',
  'psych': 'To discuss with psych:',
  'eggy': 'To discuss with Eggy:',
  'other': 'Other:',
};

interface LoadedAppProps {
  data: MyData;
}

class LoadedApp extends React.Component<LoadedAppProps, object> {
  backup: string;

  constructor(props: LoadedAppProps) {
    super(props)

    this.backup = JSON.stringify(Array.from(this.props.data.pages.entries()));
  }

  render() {
    return <div><input type="text" readOnly={true} value={this.backup}/><hr/>
      <Page id={PageId.plan} data={this.props.data}/>
      <Page id={PageId.todo} data={this.props.data}/>
      <Page id={PageId.psych} data={this.props.data}/>
      <Page id={PageId.eggy} data={this.props.data}/>
      <Page id={PageId.other} data={this.props.data}/>
    </div>;
  }
}

interface PageProps {
  id: PageId;
  data: MyData;
}

const enum PageStatus {
  Saved,
  Saving,
  Cooling,
}

interface PageState {
  text: string;
  status: PageStatus;
  modified: boolean;
}

class Page extends React.Component<PageProps, PageState> {
  constructor(props: PageProps) {
    super(props);
    this.state = {text: this.props.data.pages.get(this.props.id) || 'MISSING ENTRY', status: PageStatus.Saved, modified: false};

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(event: React.FormEvent<HTMLTextAreaElement>) {

    const text = (event.target as HTMLTextAreaElement).value;

    this.setState({text: text, modified: true});
    if (this.state.status === PageStatus.Saved) {
      this.definitelySave(text);
    }
  }

  async definitelySave(text: string) {
    do {
      this.setState({status: PageStatus.Saving, modified: false});
      await savePage(this.props.id, text);
      this.setState({status: PageStatus.Cooling});
      await delay(5000);
      text = this.state.text;
    } while (this.state.modified);
    this.setState({status: PageStatus.Saved});
  }

  statusText(): string {
    if (this.state.modified) {
      return ' [Unsaved..]';
    }
    switch (this.state.status) {
      case PageStatus.Saving:
        return ' [Saving...]';
      case PageStatus.Saved:
      case PageStatus.Cooling:
        return ' [  Saved  ]';
    }
  }

  render() {
    return (
      <label>
        {PAGE_IDS[this.props.id]}{this.statusText()}<br/>
        <textarea value={this.state.text} onChange={this.handleChange}/>
        <hr/>
      </label>
    );
  }
}

function delay(millis : number) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

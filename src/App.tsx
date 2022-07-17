import * as React from 'react'
import './App.css'
import { MyUser, MyData, PageId, getSavedUserWithTimeout, loginPopup, getData, savePage } from './auth'
import { Calendar } from './Calendar'
import { Saver, SaverStatusString } from './Saver'
import ErrorBoundary from './ErrorBoundary'

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
      <h2>Recovery</h2><ErrorBoundary>
      {upper}
      {this.state.user ? <LoggedInApp user={this.state.user}/> : <hr/>}
      </ErrorBoundary>
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
    return <ErrorBoundary>
      {this.props.user.name} --- {new Date().toLocaleString()}
      {this.state.data ? <LoadedApp data={this.state.data}/> : <><hr/>Loading...</>}
    </ErrorBoundary>;
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

    this.backup = JSON.stringify(Array.from(this.props.data.pages.entries())) + JSON.stringify(Array.from(this.props.data.calendar.entries()));
  }

  render() {
    return <ErrorBoundary><input type="text" readOnly={true} value={this.backup}/><hr/>
      <Calendar data={this.props.data.calendar}/>
      <Page id={PageId.plan} data={this.props.data}/>
      <Page id={PageId.todo} data={this.props.data}/>
      <Page id={PageId.psych} data={this.props.data}/>
      <Page id={PageId.eggy} data={this.props.data}/>
      <Page id={PageId.other} data={this.props.data}/>
    </ErrorBoundary>;
  }
}

interface PageProps {
  id: PageId;
  data: MyData;
}

function Page(props: PageProps) : JSX.Element {
  function renderPage(id: PageId, text: string, status: SaverStatusString, onChange: (id: PageId, text: string) => void) : JSX.Element {
    function onChangeOuter(event: React.FormEvent<HTMLTextAreaElement>) {
      onChange(id, (event.target as HTMLTextAreaElement).value);
    }
    return <label>
      {PAGE_IDS[id]}{status}
      <textarea value={text} onChange={onChangeOuter}/>
      <hr/>
    </label>
  }
  const text = props.data.pages.get(props.id) || 'MISSING ENTRY';
  return <ErrorBoundary><Saver<string,PageId> id={props.id} data={text} saver={savePage} render={renderPage}/></ErrorBoundary>;
}

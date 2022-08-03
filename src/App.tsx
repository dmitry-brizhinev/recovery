import * as React from 'react'
import { User, UserData, PageData, PageId, PageIds, PageTitles, Func } from './Data'
import { subscribeToUserChanges, loginPopup, getData } from './Firebase'
import { Calendar } from './Calendar'
import ErrorBoundary from './ErrorBoundary'
import { RootContext, Root, DataRoot } from './Root'
import { Saver } from './Saver'

export interface AppState {
  user: User | null;
  finishedWaiting: boolean;
}

export default class App extends React.Component<object, AppState> {
  unsubscribe?: Func;
  cancel?: NodeJS.Timeout;

  constructor(props: object) {
    super(props);

    this.state = {user: null, finishedWaiting: false};

    this.onUserUpdate = this.onUserUpdate.bind(this);
  }

  componentDidMount() {
    if (!this.cancel && !this.state.finishedWaiting) {
      this.cancel = setTimeout(() => {this.setState({finishedWaiting: true})}, 2000);
    }

    if (!this.unsubscribe) {
      this.unsubscribe = subscribeToUserChanges(this.onUserUpdate);
    }
  }

  componentWillUnmount() {
    if (this.cancel && !this.state.finishedWaiting) {
      clearTimeout(this.cancel);
      this.cancel = undefined;
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  onUserUpdate(user: User | null) {
    this.setState({user});
  }

  render() {
    let upper;
    if (this.state.user) {
      upper = <LoggedInApp user={this.state.user}/>;
    } else if (!this.state.finishedWaiting) {
      upper = 'Loading...';
    } else {
      upper = <button onClick={loginPopup}>Login</button>;
    }
    return <main>
      <h2>Recovery</h2>
      {/*this.state.user && <button onClick={logout}>Logout</button>*/}
      <ErrorBoundary>{upper}</ErrorBoundary>
      {this.state.user ? null : <hr/>}
    </main>;
  }
}

interface LoggedInAppProps {
  user: User;
}

interface LoggedInAppState {
  root: Root | null;
  data: UserData | null;
  saver: string;
}

class LoggedInApp extends React.Component<LoggedInAppProps, LoggedInAppState> {
  constructor(props: LoggedInAppProps) {
    super(props);

    this.state = {root: null, data: null, saver: ''};

    this.onUpdate = this.onUpdate.bind(this);
    this.onSaverUpdate = this.onSaverUpdate.bind(this);
  }

  componentDidMount() {
    getData().then((data) => {
      const root = new DataRoot(data, this.onUpdate, new Saver(this.onSaverUpdate));
      this.setState({root, data});
    });
  }

  onUpdate(data: UserData) {
    this.setState({data});
  }

  onSaverUpdate(saver: string) {
    this.setState({saver});
  }

  render() {
    return <ErrorBoundary>
      {this.props.user.name} --- {new Date().toLocaleString()}
      {this.state.root && this.state.data ?
        <RootContext.Provider value={this.state.root}>
          <LoadedApp data={this.state.data} saver={this.state.saver}/>
        </RootContext.Provider> :
        <><hr/>Loading...</>
      }
    </ErrorBoundary>;
  }
}

interface LoadedAppProps {
  data: UserData;
  saver: string;
}

class LoadedApp extends React.Component<LoadedAppProps, object> {
  render() {
    return <ErrorBoundary><br/>{this.props.saver}<Backup data={this.props.data}/><hr/>
      <Calendar pages={this.props.data.calendarPages} events={this.props.data.calendarEvents}/>
      {PageIds.map(id => <Page key={id} id={id} text={this.props.data.pages.get(id, '')}/>)}
    </ErrorBoundary>;
  }
}

interface BackupProps {
  data: UserData;
}

function Backup(props: BackupProps): JSX.Element {
  const backup = React.useMemo(() => Root.getBackupString(props.data), [props.data]);
  return <input type="text" readOnly={true} value={backup}/>
}

interface PageProps {
  id: PageId;
  text: PageData;
}

function Page(props: PageProps) : JSX.Element {
  //const [currentText, updateText] = React.useState(props.text);
  const root = React.useContext(RootContext);
  return <label>
    <ErrorBoundary>
      {PageTitles[props.id]}
      <textarea className="page" value={props.text} onChange={event => root.onPageUpdate(props.id, event)}/>
    </ErrorBoundary>
    <hr/>
  </label>;
}

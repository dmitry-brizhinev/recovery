import * as React from 'react'
import { User, UserData } from '../data/Data'
import { subscribeToUserChanges, loginPopup, getData, logout } from '../helpers/Firebase'
import Calendar from './Calendar'
import ErrorBoundary from '../util/ErrorBoundary'
import { RootContext, Root, DataRoot } from '../helpers/Root'
import Saver from '../helpers/Saver'
import Pages from './Pages'
import { Func } from '../util/Utils';

interface AppState {
  user: User | null;
  finishedWaiting: boolean;
}

interface AppProps {
  allowLogout?: boolean;
  loginDelay?: number;
}

export default class App extends React.Component<AppProps, AppState> {
  unsubscribe?: Func;
  cancel?: NodeJS.Timeout;

  constructor(props: AppProps) {
    super(props);

    this.state = {user: null, finishedWaiting: false};

    this.onUserUpdate = this.onUserUpdate.bind(this);
  }

  componentDidMount() {
    if (!this.cancel && !this.state.finishedWaiting) {
      this.cancel = setTimeout(() => {this.setState({finishedWaiting: true})}, this.props.loginDelay ?? 2000);
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
      {this.state.user && this.props.allowLogout && <button onClick={logout}>Logout</button>}
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
  waitingForData = false;
  mounted = false;

  constructor(props: LoggedInAppProps) {
    super(props);

    this.state = {root: null, data: null, saver: ''};

    this.onUpdate = this.onUpdate.bind(this);
    this.onSaverUpdate = this.onSaverUpdate.bind(this);
    this.onDataArrived = this.onDataArrived.bind(this);
  }

  componentDidMount() {
    this.mounted = true;
    if (!this.waitingForData) {
      this.waitingForData = true;
      getData().then(this.onDataArrived, () => this.waitingForData = false);
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  onDataArrived(data: UserData) {
    this.waitingForData = false;
    if (!this.mounted) {
      return;
    }
    const root = new DataRoot(data, this.onUpdate, new Saver(this.onSaverUpdate));
    this.setState({root, data});
  }

  onUpdate(data: UserData) {
    if (this.mounted)
      this.setState({data});
  }

  onSaverUpdate(saver: string) {
    if (this.mounted)
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
      <Pages pages={this.props.data.pages}/>
    </ErrorBoundary>;
  }
}

interface BackupProps {
  data: UserData;
}

function Backup(props: BackupProps): React.ReactElement {
  const backup = React.useMemo(() => Root.getBackupString(props.data), [props.data]);
  return <input type="text" readOnly={true} value={backup}/>
}

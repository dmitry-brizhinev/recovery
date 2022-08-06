import * as React from 'react'
import { PageMap, User, UserData } from '../data/Data'
import { getData } from '../firebase/FirebaseStore'
import { subscribeToUserChanges, loginPopup, logout } from '../firebase/FirebaseAuth'
import Calendar from './Calendar'
import ErrorBoundary from '../util/ErrorBoundary'
import { RootContext, Root, DataRoot } from '../helpers/Root'
import Saver from '../helpers/Saver'
import Pages from './Pages'
import { Func } from '../util/Utils';
import Backup from '../util/Backup'
import Loading from '../util/Loading'
import { LazyTest } from '../util/Lazy'

const JournalsContainer = React.lazy(() => import('./Journals'));
const Assimilation = React.lazy(() => import('../assimilation/Assimilation'));

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
      upper = <Loading/>;
    } else {
      upper = <button onClick={loginPopup}>Login</button>;
    }
    return <main>
      <h2>Recovery</h2>
      {this.state.user && this.props.allowLogout && <button onClick={logout}>Logout</button>}
      <LazyTest/>
      <ErrorBoundary>{upper}</ErrorBoundary>
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
        <ErrorBoundary>
          <br/>{this.state.saver}<Backup data={this.state.data}/>
        <RootContext.Provider value={this.state.root}>
          <LoadedApp data={this.state.data}/>
        </RootContext.Provider>
        </ErrorBoundary>
        : <Assimilation/> // <Loading/>
      }
    </ErrorBoundary>;
  }
}

interface LoadedAppProps {
  data: UserData;
}

class LoadedApp extends React.Component<LoadedAppProps, object> {
  render() {
    return <ErrorBoundary>
      <Calendar pages={this.props.data.calendarPages} events={this.props.data.calendarEvents}/>
      <Switcher pages={this.props.data.pages}/>
    </ErrorBoundary>;
  }
}

interface SwitcherProps {
  pages: PageMap;
}

const enum SwitcherState {
  Notes = 'Notes',
  Journal = 'Journal',
  Game = 'Game',
}

function Switcher(props: SwitcherProps): React.ReactElement {
  const [currentState, setState] = React.useState(SwitcherState.Game);
  const clickNotes = React.useCallback(() => setState(SwitcherState.Notes), []);
  const clickJournal = React.useCallback(() => setState(SwitcherState.Journal), []);
  const clickGame = React.useCallback(() => setState(SwitcherState.Game), []);

  let inner;
  switch (currentState) {
    case SwitcherState.Notes:
      inner = <Pages pages={props.pages}/>;
      break;
    case SwitcherState.Journal:
      inner = <React.Suspense fallback={<Loading/>}><JournalsContainer/></React.Suspense>;
      break;
    case SwitcherState.Game:
      inner = <React.Suspense fallback={<Loading/>}><Assimilation/></React.Suspense>;
      break;
  }

  return <ErrorBoundary>
    <button disabled={currentState === SwitcherState.Notes} onClick={clickNotes}>{SwitcherState.Notes}</button>
    <button disabled={currentState === SwitcherState.Journal} onClick={clickJournal}>{SwitcherState.Journal}</button>
    <button disabled={currentState === SwitcherState.Game} onClick={clickGame}>{SwitcherState.Game}</button>
    <ErrorBoundary>{inner}</ErrorBoundary>
  </ErrorBoundary>;
}
import * as React from 'react'
import type { User, UserData } from '../data/Data'
import { getData } from '../firebase/FirebaseStore'
import { subscribeToUserChanges, loginPopup, logout } from '../firebase/FirebaseAuth'
import ErrorBoundary from '../util/ErrorBoundary'
import { RootContext, Root, DataRoot } from '../helpers/Root'
import Saver from '../helpers/Saver'
import type { Func } from '../util/Utils';
import Backup from '../util/Backup'
import Loading from '../util/Loading'
import { LazyTest } from '../util/Lazy'

import '../css/pages.css';
import '../css/events.css';
import Switcher, { SwitcherData } from '../util/Switcher'

const CalendarAndPages = React.lazy(() => import('./Pages'));
const JournalsContainer = React.lazy(() => import('./Journals'));
const Assimilation = React.lazy(() => import('../assimilation/Assimilation'));
const ImageMaker = React.lazy(() => import('../assimilation/Image'));
const LispMiner = React.lazy(() => import('../lispminer/LispMiner'));

interface HeaderState {
  user: User | null;
  finishedWaiting: boolean;
}

interface HeaderProps {
  allowLogout?: boolean;
  loginDelay?: number;
}

export default class Header extends React.Component<HeaderProps, HeaderState> {
  unsubscribe?: Func;
  cancel?: NodeJS.Timeout;

  constructor(props: HeaderProps) {
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
      // prod: <LoggedInApp user={this.state.user}/>
      // dev:  <MaybeGame user={this.state.user}/>
      upper = <LoggedInApp user={this.state.user}/>;
    } else if (!this.state.finishedWaiting) {
      upper = <Loading/>;
    } else {
      upper = <button onClick={loginPopup}>Login</button>;
    }
    // prod: '';
    // dev: <LazyTest/>;
    const lazyTest = '';//<LazyTest/>;
    return <ErrorBoundary>
      {this.state.user && this.props.allowLogout && <button onClick={logout}>Logout</button>}
      {lazyTest}
      {upper}
    </ErrorBoundary>;
  }
}

function MaybeGame(props: {user: User}): React.ReactElement {
  const [closed, setClosed] = React.useState<object | null>(null);
  return !closed ? <div><button onClick={setClosed}>Close Game</button><LispMiner/></div> : <LoggedInApp user={props.user}/>;
}

interface LoggedInAppProps {
  user: User;
}

interface LoggedInAppState {
  root: Root | null;
  data: UserData | null;
  saver: string;
}

export class LoggedInApp extends React.Component<LoggedInAppProps, LoggedInAppState> {
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
          <br/>{this.state.saver}<Backup data={this.state.data}/><br/>
        <RootContext.Provider value={this.state.root}>
          <LoadedApp data={this.state.data}/>
        </RootContext.Provider>
        </ErrorBoundary>
        : <Loading/>
      }
    </ErrorBoundary>;
  }
}

interface LoadedAppProps {
  data: UserData;
}

function LoadedApp({data}: LoadedAppProps) {
  const switchData = React.useMemo<SwitcherData>(() => [
    ['Notes', () => <CalendarAndPages data={data} />],
    ['Journal', () => <JournalsContainer />],
    ['Game', () => <Assimilation />],
    ['Image', () => <ImageMaker />],
    ['Miner', () => <LispMiner />],
  ], [data]);

  return <Switcher data={switchData}/>;
}

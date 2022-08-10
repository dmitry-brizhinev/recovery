import * as React from 'react'
import type { PageMap, User, UserData } from '../data/Data'
import { getData } from '../firebase/FirebaseStore'
import { subscribeToUserChanges, loginPopup, logout } from '../firebase/FirebaseAuth'
import Calendar from './Calendar'
import ErrorBoundary from '../util/ErrorBoundary'
import { RootContext, Root, DataRoot } from '../helpers/Root'
import Saver from '../helpers/Saver'
import Pages from './Pages'
import type { Callback, Func } from '../util/Utils';
import Backup from '../util/Backup'
import Loading from '../util/Loading'
import { LazyTest } from '../util/Lazy'

import '../css/pages.css';
import 'react-calendar/dist/Calendar.css';
import '../css/events.css';
import '../css/calendar.css';

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
      upper = <MaybeGame user={this.state.user}/>;
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
          <br/>{this.state.saver}<Backup data={this.state.data}/>
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
  Image = 'Image',
  Miner = 'Miner',
}

function Switcher(props: SwitcherProps): React.ReactElement {
  const [state, setState] = React.useState(SwitcherState.Notes);

  let inner;
  switch (state) {
    case SwitcherState.Notes:
      inner = <Pages pages={props.pages}/>;
      break;
    case SwitcherState.Journal:
      inner = <JournalsContainer/>;
      break;
    case SwitcherState.Game:
      inner = <Assimilation/>;
      break;
    case SwitcherState.Image:
      inner = <ImageMaker />;
      break;
    case SwitcherState.Miner:
      inner = <LispMiner />;
      break;
  }

  return <ErrorBoundary>
    <SwitcherButton current={state} onClick={setState}>{SwitcherState.Notes}</SwitcherButton>
    <SwitcherButton current={state} onClick={setState}>{SwitcherState.Journal}</SwitcherButton>
    <SwitcherButton current={state} onClick={setState}>{SwitcherState.Game}</SwitcherButton>
    <SwitcherButton current={state} onClick={setState}>{SwitcherState.Image}</SwitcherButton>
    <SwitcherButton current={state} onClick={setState}>{SwitcherState.Miner}</SwitcherButton>
    <React.Suspense fallback={<Loading/>}><ErrorBoundary>{inner}</ErrorBoundary></React.Suspense>;
  </ErrorBoundary>;
}

function SwitcherButton(props: {children: SwitcherState, current: SwitcherState, onClick: Callback<SwitcherState>}): React.ReactElement {
  const {children, current, onClick} = props;
  const click = React.useCallback(() => onClick(children), [children, onClick]);
  return <button disabled={children === current} onClick={click}>{children}</button>
}
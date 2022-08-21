import * as React from 'react';
import type {User, UserData} from '../data/Data';
import {getData} from '../firebase/FirestoreData';
import {subscribeToUserChanges, loginPopup, logout} from '../firebase/FirebaseAuth';
import ErrorBoundary from '../util/ErrorBoundary';
import {DataRootContext, DataRootImpl} from '../helpers/DataRoot';
import {cancellableDelay, type Func} from '../util/Utils';
import Backup from '../util/Backup';
import Loading from '../util/Loading';

import Switcher, {type SwitcherData} from '../util/Switcher';

const CalendarAndPages = React.lazy(() => import('./Pages'));
const JournalsContainer = React.lazy(() => import('./Journals'));
const Assimilation = React.lazy(() => import('../assimilation/Assimilation'));
const ImageMaker = React.lazy(() => import('../assimilation/Image'));
const LispMiner = React.lazy(() => import('../lispminer/LispMiner'));
const Program = React.lazy(() => import('../program/Program'));
const Messaging = React.lazy(() => import('../service/Messaging'));

interface HeaderState {
  user: User | null;
  finishedWaiting: boolean;
}

interface HeaderProps {
  allowLogout?: boolean;
  loginDelay?: number;
}

export default class Header extends React.Component<HeaderProps, HeaderState> {
  unsubscribe?: Func | undefined;
  cancel?: Func | undefined;

  constructor(props: HeaderProps) {
    super(props);

    this.state = {user: null, finishedWaiting: false};

    this.onUserUpdate = this.onUserUpdate.bind(this);
  }

  override componentDidMount() {
    if (!this.cancel && !this.state.finishedWaiting) {
      this.cancel = cancellableDelay(() => {this.setState({finishedWaiting: true});}, this.props.loginDelay ?? 2000);
    }

    if (!this.unsubscribe) {
      this.unsubscribe = subscribeToUserChanges(this.onUserUpdate);
    }
  }

  override componentWillUnmount() {
    if (this.cancel && !this.state.finishedWaiting) {
      this.cancel();
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

  override render() {
    let upper;
    if (this.state.user) {
      upper = <LoggedInApp user={this.state.user} />;
    } else if (!this.state.finishedWaiting) {
      upper = <Loading />;
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

interface LoggedInAppProps {
  user: User;
}

interface LoggedInAppState {
  root: DataRootImpl | null;
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

  override componentDidMount() {
    this.mounted = true;
    if (!this.waitingForData) {
      this.waitingForData = true;
      getData().then(this.onDataArrived, () => this.waitingForData = false);
    }
  }

  override componentWillUnmount() {
    this.mounted = false;
  }

  onDataArrived(data: UserData) {
    this.waitingForData = false;
    if (!this.mounted) {
      return;
    }
    const root = new DataRootImpl(data, this.onUpdate, this.onSaverUpdate);
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

  override render() {
    return <ErrorBoundary>
      {this.props.user.name} --- {new Date().toLocaleString()}
      {this.state.root && this.state.data ?
        <ErrorBoundary>
          <br />{this.state.saver}<Backup data={this.state.data} /><br />
          <DataRootContext.Provider value={this.state.root}>
            <LoadedApp data={this.state.data} />
          </DataRootContext.Provider>
        </ErrorBoundary>
        : <Loading />
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
    ['Program', () => <Program />],
    ['Messaging', () => <Messaging />],
  ], [data]);

  return <Switcher data={switchData} initial={'Program'} />;
}

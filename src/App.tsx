import * as React from 'react'
import { User, UserData, PageData, PageId, PageIds, PageTitles } from './Data'
import { getSavedUserWithTimeout, loginPopup, getData } from './Firebase'
import { Calendar } from './Calendar'
import ErrorBoundary from './ErrorBoundary'
import { RootContext, Root, DataRoot } from './Root'
import { Saver } from './Saver'

export interface AppState {
  user: User | null;
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
    getSavedUserWithTimeout(2000).then((user) => {
      this.setState({user, awaitingSaved: false});
    });
  }

  async onClickLogin() {
    this.setState({awaitingLogin: true});
    const user = await loginPopup();
        /*}).catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
    });*/
    this.setState({user, awaitingLogin: false});
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

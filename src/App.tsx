import * as React from 'react'
import { User, UserData, PageData, PageId, PageIds, PageTitles, Root, DataRoot } from './Data'
import { getSavedUserWithTimeout, loginPopup, savePage, getData } from './Firebase'
import { Calendar } from './Calendar'
import { Saver } from './Saver'
import ErrorBoundary from './ErrorBoundary'
import { RootContext } from './Root'

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
}

class LoggedInApp extends React.Component<LoggedInAppProps, LoggedInAppState> {
  constructor(props: LoggedInAppProps) {
    super(props);

    this.state = {root: null, data: null};

    this.onUpdate = this.onUpdate.bind(this)
  }

  componentDidMount() {
    getData().then((data) => {
      const root = new DataRoot(data, this.onUpdate);
      this.setState({root, data});
    });
  }

  onUpdate(data: UserData) {
    this.setState({data});
  }

  render() {
    return <ErrorBoundary>
      {this.props.user.name} --- {new Date().toLocaleString()}
      {this.state.root && this.state.data ?
        <RootContext.Provider value={this.state.root}>
          <LoadedApp data={this.state.data}/>
        </RootContext.Provider> :
        <><hr/>Loading...</>
      }
    </ErrorBoundary>;
  }
}

interface LoadedAppProps {
  data: UserData;
}

class LoadedApp extends React.Component<LoadedAppProps, object> {
  render() {
    return <ErrorBoundary><br/><Backup data={this.props.data}/><hr/>
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

type PageSave = { Id: PageId, Data: PageData };

function Page(props: PageProps) : JSX.Element {
  //const [currentText, updateText] = React.useState(props.text);
  const root = React.useContext(RootContext);
  return <label>
    <ErrorBoundary>
      {PageTitles[props.id]}<Saver<PageSave> id={props.id} data={props.text} saver={savePage}/>
      <textarea className="page" value={props.text} onChange={event => root.onPageUpdate(props.id, event)}/>
    </ErrorBoundary>
    <hr/>
  </label>;
}

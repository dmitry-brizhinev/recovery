import * as React from 'react'
import './App.css'
import { User, MyData, PageId } from './Data'
import { getSavedUserWithTimeout, loginPopup, getData, savePage } from './auth'
import { Calendar } from './Calendar'
import { Saver } from './Saver'
import ErrorBoundary from './ErrorBoundary'

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
  user: User;
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
  [PageId.todo]: 'One-offs todo:',
  [PageId.plan]: 'Concrete plans to schedule:',
  [PageId.oneoff]: 'Ideas for one-offs:',
  [PageId.exerc]: 'Ideas for plans/recurring/exercises to try:',
  [PageId.resea]: 'To research:',
  [PageId.buy]: 'To buy:',
  [PageId.think]: 'To think about:',
  [PageId.psych]: 'To discuss with psych:',
  [PageId.eggy]: 'To discuss with Eggy:',
  [PageId.other]: 'Other:',
};

interface LoadedAppProps {
  data: MyData;
}

class LoadedApp extends React.Component<LoadedAppProps, object> {
  backup: string;

  constructor(props: LoadedAppProps) {
    super(props)

    this.backup = JSON.stringify(Array.from(this.props.data.pages.entries())) +
                  JSON.stringify(Array.from(this.props.data.calendar.pages.entries())) +
                  JSON.stringify(Array.from(this.props.data.calendar.events.entries()));
  }

  render() {
    return <ErrorBoundary><input type="text" readOnly={true} value={this.backup}/><hr/>
      <Calendar data={this.props.data.calendar}/>
      {Object.values(PageId).map(id => <Page id={id} key={id} text={this.props.data.pages.get(id) || 'MISSING ENTRY'}/>)}
    </ErrorBoundary>;
  }
}

interface PageProps {
  id: PageId;
  text: string;
}

type PageSave = { Id: PageId, Data: string };

function Page(props: PageProps) : JSX.Element {
  const [currentText, updateText] = React.useState(props.text);
  return <label>
    <ErrorBoundary>
      {PAGE_IDS[props.id]}<Saver<PageSave> id={props.id} data={currentText} saver={savePage}/>
      <textarea value={currentText} onChange={event => updateText(event.target.value)}/>
    </ErrorBoundary>
    <hr/>
  </label>;
}

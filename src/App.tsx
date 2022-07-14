import * as React from 'react'
import './App.css'
import { MyUser, getSavedUserWithTimeout, loginPopup, getPage, savePage } from './auth'

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
      <h2>Recovery</h2>
      {upper}
      {this.state.user ? <LoggedInApp user={this.state.user}/> : <hr/>}
    </main>;
  }
}

interface LoggedInAppProps {
  user: MyUser;
}

class LoggedInApp extends React.Component<LoggedInAppProps, object> {
  constructor(props: any) {
    super(props);

    this.onClickRefresh = this.onClickRefresh.bind(this);

    this.state = {pending: false};
  }

  onClickRefresh() {

  }

  render() {
    return (
      <div>
      User: {this.props.user.name}
      <hr/>
      <LoadedApp />
      </div>
    );
  }
}

interface LoadedAppProps {

}

class LoadedApp extends React.Component<LoadedAppProps, object> {
  render() {
    return <div>
      <Page label="To figure out a plan for:" id="plan"/>
      <Page label="To do:" id="todo"/>
      <Page label="To discuss with psych:" id="psych"/>
      <Page label="To discuss with Eggy:" id="eggy"/>
      <Page label="Other:" id="other"/>
    </div>;
  }
}

interface PageProps {
  label: string;
  id: string;
}

const enum PageStatus {
  Loading,
  Saved,
  Saving,
  Cooling,
}

interface PageState {
  text: string;
  status: PageStatus;
  modified: boolean;
}

class Page extends React.Component<PageProps, PageState> {
  constructor(props: PageProps) {
    super(props);
    this.state = {text: 'Loading...', status: PageStatus.Loading, modified: false};

    this.handleChange = this.handleChange.bind(this);

    getPage(this.props.id).then(
      (data: string) => {
        this.setState({text: data, status: PageStatus.Saved});
      }
    );
  }

  handleChange(event: React.FormEvent<HTMLTextAreaElement>) {
    if (this.state.status === PageStatus.Loading) {
      this.setState({text: 'Loading...'});
      return;
    }
    const text = (event.target as HTMLTextAreaElement).value;

    this.setState({text: text, modified: true});
    if (this.state.status === PageStatus.Saved) {
      this.definitelySave(text);
    }
  }

  async definitelySave(text: string) {
    do {
      this.setState({status: PageStatus.Saving, modified: false});
      await savePage(this.props.id, text);
      this.setState({status: PageStatus.Cooling});
      await delay(5000);
      text = this.state.text;
    } while (this.state.modified);
    this.setState({status: PageStatus.Saved});
  }

  statusText(): string {
    if (this.state.modified) {
      return ' [Unsaved..]';
    }
    switch (this.state.status) {
      case PageStatus.Loading:
        return ' [Loading..]';
      case PageStatus.Saving:
        return ' [Saving...]';
      case PageStatus.Saved:
      case PageStatus.Cooling:
        return ' [  Saved  ]';
    }
  }

  render() {
    return (
      <label>
        {this.props.label}{this.statusText()}<br/>
        <textarea value={this.state.text} onChange={this.handleChange} disabled={this.state.status === PageStatus.Loading}/>
        <hr/>
      </label>
    );
  }
}

function delay(millis : number) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

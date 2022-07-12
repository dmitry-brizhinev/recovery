import * as React from 'react'
import './App.css'
import { User, getCurrentUserOrNull, loginPopup, getPage, savePage } from './auth'

export interface AppState {
  user: User | null;
  pending: boolean;
}

export default class App extends React.Component<object, AppState> {

  constructor(props: any) {
    super(props);

    this.onClickLogin = this.onClickLogin.bind(this);

    this.state = {user: getCurrentUserOrNull(), pending: false};
  }

  async onClickLogin() {
    this.setState({pending: true});
    const user = await loginPopup();
        /*}).catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
    });*/
    this.setState({user: user, pending: false});
  }

  render() {
    if (this.state.user == null) {
      return (
        <main>
        <h2>Recovery</h2>
        <Login pending={this.state.pending} onClick={this.onClickLogin} />
        <hr/>
        </main>
      );
    } else {
      return (
        <main>
        <h2>Recovery</h2>
        User: {this.state.user.name}
        <hr/>
        <Page label="To figure out a plan for:" id="plan"/>
        <Page label="To do:" id="todo"/>
        <Page label="To discuss with psych:" id="psych"/>
        <Page label="To discuss with Eggy:" id="eggy"/>
        <Page label="Other:" id="other"/>
        </main>
      );
    }
  }
}

interface LoginProps {
  onClick: () => void;
  user?: User;
  pending: boolean;
}

class Login extends React.PureComponent<LoginProps, object> {
  render() {
    if (this.props.user != null) {
      return `User: ${this.props.user.name}`;
    } else {
      return <button disabled={this.props.pending} onClick={this.props.onClick}>Login</button>;
    }
  }
}

interface PageProps {
  label: string;
  id: string;
}

interface PageState {
  text: string;
  loading: boolean;
  saving: boolean;
}

class Page extends React.Component<PageProps, PageState> {
  constructor(props: PageProps) {
    super(props);
    this.state = {text: 'Loading...', loading: true, saving: false};

    this.handleChange = this.handleChange.bind(this);

    getPage(this.props.id).then(
      (data: string) => {
        this.setState({text: data, loading: false});
      }
    );
  }

  handleChange(event: React.FormEvent<HTMLTextAreaElement>) {
    if (this.state.loading) {
      this.setState({text: 'Loading...'});
      return;
    }
    const text = (event.target as HTMLTextAreaElement).value;

    if (this.state.saving) {
      this.setState({text: text});
    } else {
      this.setState({text: text, saving: true});
      savePage(this.props.id, text).then(
        () => {
          this.setState({saving: false});
        }
      );
    }
  }

  render() {
    return (
      <label>
        {this.props.label}<br/>
        <textarea value={this.state.text} onChange={this.handleChange} />
        <hr/>
      </label>
    );
  }
}

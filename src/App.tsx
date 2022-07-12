import * as React from 'react'
import './App.css'
import { User, getCurrentUserOrNull, loginPopup } from './auth'

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
        <Page label="thoughts here"/>
        <hr/>
        <Page label="more here"/>
        <hr/>
        <Page label="thoughts"/>
        <hr/>
        <Page label="more"/>
        <hr/>
        </main>
      );
    }
  }
}

export interface ArtProps {
  seed: number;
}

export class Art extends React.Component<ArtProps, object> {
  lastKey:number;

  constructor(props: ArtProps) {
    super(props);

    this.lastKey = 0;
  }

  render() {
    return (
      <Page label="thoughts here"/>
    );
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
}

interface PageState {
  text: string;
}

class Page extends React.Component<PageProps, PageState> {
  constructor(props: PageProps) {
    super(props);
    this.state = {text: 'HELLO D'};

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(event: React.FormEvent<HTMLTextAreaElement>) {
    this.setState({text: (event.target as HTMLTextAreaElement).value});
  }

  render() {
    return (
      <label>
        {this.props.label}<br/>
        <textarea value={this.state.text} onChange={this.handleChange} />
      </label>
    );
  }
}

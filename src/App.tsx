import * as React from 'react'
import './App.css'
import { User, getCurrentUserOrNull, loginPopup } from './auth'

export interface AppState {
  user: User | null;
}

export default class App extends React.Component<object, AppState> {

  constructor(props: any) {
    super(props);

    this.onClickLogin = this.onClickLogin.bind(this);

    this.state = {user: getCurrentUserOrNull()};
  }

  async onClickLogin(event: React.FormEvent<HTMLButtonElement>) {
    const user = await loginPopup();
        /*}).catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
    });*/
    this.setState({user: user});
  }

  render() {
    if (this.state.user == null) {
      return (
        <main>
        <h2>Recovery</h2>
        <button onClick={this.onClickLogin}>
          Login
        </button>
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

const WIDTH = 100;
const HEIGHT = 100;
const SCALE = 4;

export interface ArtProps {
  seed: number;
}

function getX(t: number): number {
  return Math.sin(t * Math.PI);
}

export class Art extends React.Component<ArtProps, object> {
  lastKey:number;

  constructor(props: ArtProps) {
    super(props);

    this.lastKey = 0;
  }

  MakeCircle(x: number, y:number, r:number, w:number): CircleProps {
    this.lastKey += 1;
    return {
        x: x,
        y: y,
        r: r,
        w: w,
        key: this.lastKey,
    };
  }

  render() {
    return (
      <Page label="thoughts here"/>
    );
  }
}

interface CircleProps {
  x: number;
  y: number;
  r: number;
  w: number;
  key: number;
}

class Circle extends React.PureComponent<CircleProps, object> {
  constructor(props: CircleProps) {
    super(props);
  }

  render() {
    return <circle cx={this.props.x} cy={this.props.y} r={this.props.r} strokeWidth={this.props.w} className={'golden'}/>;
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
    this.setState({text: event.target.value});
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

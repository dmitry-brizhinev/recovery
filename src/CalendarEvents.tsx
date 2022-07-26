import * as React from 'react'
import { CalendarId, Event, EventStatus, ValidComment } from './Data';
import ErrorBoundary from './ErrorBoundary';



interface EventInputProps {
  dayId: CalendarId;
  index: number;
  event: Event;
  onChange: (index: number, event: Event | null, reschedule?: boolean) => void
}

interface EventInputState {
  open: boolean;
}

export class EventInput extends React.PureComponent<EventInputProps, EventInputState> {
  constructor(props: EventInputProps) {
    super(props);

    this.state = {open: false};

    this.onClickCountdown = this.onClickCountdown.bind(this);
    this.onClickSave = this.onClickSave.bind(this);
    this.onClickReschedule = this.onClickReschedule.bind(this);
  }

  static getDerivedStateFromProps(props: EventInputProps, state: EventInputState) {
    if (state.open && !props.event.isActive()) {
      return {open: false};
    }
    return null;
  }

  onClickCountdown() { // Also for cancel click
    this.setState(prevState => {return {open: !prevState.open};});
  }

  onClickSave(comment: string) {
    const newValue = this.props.event.withUpdate({comment});
    this.props.onChange(this.props.index, newValue);
  }

  onClickReschedule(comment: string) {
    const newValue = this.props.event.withUpdate({comment, status: EventStatus.Finished});
    this.props.onChange(this.props.index, newValue, true);
  }

  render() {
    const classname = `calendar-event ${this.props.event.status}`;
    const targetUTCmillis = this.props.event.isActive() && this.props.event.getScheduledDate(this.props.dayId).getTime();
    const open = this.state.open && !!targetUTCmillis;

    return <ErrorBoundary>
    <div className="calendar-event">
      <input className={classname} type="text" value={this.props.event.toString()} onChange={(event) => this.props.onChange(this.props.index, event.target.value ? Event.parse(event.target.value) : null)}/>
      {targetUTCmillis && <ErrorBoundary><Countdown open={open} targetUTCmillis={targetUTCmillis} onClick={this.onClickCountdown}/></ErrorBoundary>}
    </div>
      {open && <ErrorBoundary>
        <EventDetail event={this.props.event} onCancel={this.onClickCountdown} onSave={this.onClickSave} onReschedule={this.onClickReschedule}/>
      </ErrorBoundary>}
    </ErrorBoundary>;
  }
}

interface EventDetailProps {
  event: Event;
  onCancel: () => void;
  onSave: (comment: string) => void;
  onReschedule: (comment: string) => void;
}

interface EventDetailState {
  unsavedComment: ValidComment;
}

class EventDetail extends React.PureComponent<EventDetailProps, EventDetailState> {
  constructor(props: EventDetailProps) {
    super(props);

    this.state = {unsavedComment: this.props.event.comment};
    this.onSave = this.onSave.bind(this);
    this.onReschedule = this.onReschedule.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  onSave() {
    this.props.onSave(this.state.unsavedComment);
  }

  onReschedule() {
    this.props.onReschedule(this.state.unsavedComment);
  }

  onChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    this.setState({unsavedComment: Event.sanitizeComment(event.target.value)});
  }

  render() {
    const canReschedule = !!this.props.event.recurDays;
    const rescheduleDays = canReschedule ? ` ${this.props.event.recurDays}d` : '';

    return <div className="event-detail">
      {this.props.event.title}
      <textarea className="event-detail-comment" value={this.state.unsavedComment} onChange={this.onChange}/>
      <div className="event-detail-buttons">
        <button className="event-detail-button" onClick={this.props.onCancel}>Cancel</button>
        <button className="event-detail-button" onClick={this.onSave}>Save</button>
        <button className="event-detail-button" onClick={this.onReschedule} disabled={!canReschedule}>Reschedule{rescheduleDays}</button>
      </div>
    </div>;
  }
}

interface CountdownProps {
  targetUTCmillis: number;
  onClick: () => void;
  open: boolean;
}

interface CountdownState {
  nowUTCmillis: number;
}

export class Countdown extends React.PureComponent<CountdownProps, CountdownState> {
  
  timer?: NodeJS.Timer;

  constructor(props: CountdownProps) {
    super(props);

    this.state = {nowUTCmillis: new Date().getTime()};
    this.tick = this.tick.bind(this);
  }

  componentDidMount() {
    this.timer = setInterval(this.tick, 1000);
  }

  componentWillUnmount() {
    this.timer && clearInterval(this.timer);
  }

  tick() {
    this.setState({nowUTCmillis: new Date().getTime()});
  }

  render() {
    let remainingSecs = Math.round((this.props.targetUTCmillis - this.state.nowUTCmillis) / 1000);
    const negative = remainingSecs < 0 ? '-' : '';
    if (negative) remainingSecs = -remainingSecs;
    const hours = Math.floor(remainingSecs / 3600);
    remainingSecs = remainingSecs % 3600;
    const minutes = Math.floor(remainingSecs / 60);
    remainingSecs = remainingSecs % 60;

    return <button className={`event${this.props.open ? ' open' : ''}`} onClick={this.props.onClick}>{negative}{hours}:{minutes}:{remainingSecs}</button>;
  }
}

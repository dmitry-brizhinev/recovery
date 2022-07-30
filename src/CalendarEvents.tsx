import * as React from 'react'
import { CalendarId, Event, pad2, ValidComment } from './Data';
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
    this.onChange = this.onChange.bind(this);
  }

  onClickCountdown() { // Also for cancel click
    this.setState(prevState => {return {open: !prevState.open};});
  }

  onClickSave(comment: string) {
    const newValue = this.props.event.withUpdate({comment});
    this.onChange(newValue);
  }

  onClickReschedule(comment: string) {
    const newValue = this.props.event.withUpdate({comment, finished: true});
    this.onChange(newValue, true);
  }

  onChange(newValue: Event | null, reschedule?: boolean) {
    this.props.onChange(this.props.index, newValue, reschedule);
  }

  render() {
    const classname = `calendar-event ${this.props.event.status()}`;
    const targetUTCmillis = (this.props.event.isActive() || 0) && this.props.event.getScheduledDate(this.props.dayId).getTime();

    return <ErrorBoundary>
    <div className="calendar-event">
      {this.state.open ?
        <button className="calendar-event-delete" onClick={event => this.onChange(null)}>Delete</button> :
        <input className="calendar-event-time" type="time" value={this.props.event.toTimeInputString()} onChange={event => this.onChange(this.props.event.withUpdate({timeinput: event.target.value}))}/>
      }
      <input className={classname} type="text" value={this.props.event.title} onChange={(event) => this.onChange(this.props.event.withUpdate({title: event.target.value}))}/>
      <input className="calendar-event-recur" type="number" min={0} max={14} step={1} value={this.props.event.recurDays || ''} onChange={(event) => this.onChange(this.props.event.withUpdate({recur: Number.parseInt(event.target.value || '0')}))} />
      <ErrorBoundary><Countdown open={this.state.open} targetUTCmillis={targetUTCmillis} onClick={this.onClickCountdown}/></ErrorBoundary>
    </div>
      {this.state.open && <ErrorBoundary>
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
    let text = 'Inactive';
    if (this.props.targetUTCmillis) {
      let remainingSecs = Math.round((this.props.targetUTCmillis - this.state.nowUTCmillis) / 1000);
      const negative = remainingSecs < 0 ? '-' : '';
      if (negative) remainingSecs = -remainingSecs;
      const hours = Math.floor(remainingSecs / 3600);
      remainingSecs = remainingSecs % 3600;
      const minutes = pad2(Math.floor(remainingSecs / 60));
      const seconds = pad2(remainingSecs % 60);
      text = `${negative}${hours}:${minutes}:${seconds}`;
    }
    return <button className={`event${this.props.open ? ' open' : ''}`} onClick={this.props.onClick}>{text}</button>;
  }
}

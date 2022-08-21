import * as React from 'react';
import {type Callback, type Func, pad2} from '../util/Utils';
import ErrorBoundary from '../util/ErrorBoundary';
import {DataRootContext} from '../helpers/DataRoot';
import {type ValidComment, default as Event} from '../data/Event';
import {type CalendarId, incrementCId} from '../data/CalendarId';
import Textarea from '../util/Textarea';

interface EventInputProps {
  dayId: CalendarId;
  event: Event;
}

interface EventInputState {
  open: boolean;
}

interface EventUpdateOpts {
  reschedule?: boolean;
  delete?: boolean;
}

export default class EventInput extends React.PureComponent<EventInputProps, EventInputState> {
  static override contextType = DataRootContext;
  override context!: React.ContextType<typeof DataRootContext>;
  constructor(props: EventInputProps) {
    super(props);

    this.state = {open: false};

    this.onClickCountdown = this.onClickCountdown.bind(this);
    this.onClickSave = this.onClickSave.bind(this);
    this.onClickReschedule = this.onClickReschedule.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  onClickCountdown() { // Also for cancel and reschedule click
    this.setState(prevState => {return {open: !prevState.open};});
  }

  onClickSave(comment: string) {
    const newValue = this.props.event.withUpdate({comment});
    this.onChange(newValue);
  }

  onClickReschedule(comment: string) {
    const newValue = this.props.event.withUpdate({comment, finished: true});
    this.onChange(newValue, {reschedule: true});
    this.onClickCountdown();
  }

  onChange(newValue: Event, opts?: EventUpdateOpts) {
    if (opts?.reschedule) {
      const oldEvent = this.props.event;
      if (oldEvent.recurDays) {
        const newEvent = oldEvent.withUpdate({regenKey: true});
        const newId = incrementCId(this.props.dayId, oldEvent.recurDays);
        this.context.onCalendarEventUpdate(newId, newEvent.magicKey, newEvent);
      }
    }

    this.context.onCalendarEventUpdate(this.props.dayId, newValue.magicKey, opts?.delete ? null : newValue);
  }

  override render() {
    const classname = `calendar-event ${this.props.event.status()}`;
    const targetUTCmillis = (this.props.event.isActive() || 0) && this.props.event.getScheduledDate(this.props.dayId).getTime();

    return <ErrorBoundary>
      <div className="calendar-event">
        {this.state.open ?
          <button className="calendar-event-delete" onClick={() => this.onChange(this.props.event, {delete: true})}>Delete</button> :
          <input className="calendar-event-time" type="time" value={this.props.event.toTimeInputString()} onChange={event => this.onChange(this.props.event.withUpdate({timeinput: event.target.value}))} />
        }
        <input className={classname} type="text" value={this.props.event.title} onChange={(event) => this.onChange(this.props.event.withUpdate({title: event.target.value}))} />
        <input className="calendar-event-recur" type="number" min={0} max={14} step={1} value={this.props.event.recurDays || ''} onChange={(event) => this.onChange(this.props.event.withUpdate({recur: Number.parseInt(event.target.value || '0')}))} />
        <ErrorBoundary><Countdown open={this.state.open} targetUTCmillis={targetUTCmillis} onClick={this.onClickCountdown} /></ErrorBoundary>
      </div>
      {this.state.open && <ErrorBoundary>
        <EventDetail event={this.props.event} onCancel={this.onClickCountdown} onSave={this.onClickSave} onReschedule={this.onClickReschedule} />
      </ErrorBoundary>}
    </ErrorBoundary>;
  }
}

interface EventDetailProps {
  event: Event;
  onCancel: Func;
  onSave: Callback<string>;
  onReschedule: Callback<string>;
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

  onChange(unsavedComment: string) {
    this.setState({unsavedComment: Event.sanitizeComment(unsavedComment)});
  }

  override render() {
    const canReschedule = !!this.props.event.recurDays;
    const rescheduleDays = canReschedule ? ` ${this.props.event.recurDays}d` : '';

    return <div className="event-detail">
      <Textarea className="event-detail-comment" value={this.state.unsavedComment} onChange={this.onChange} />
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
  onClick: Func;
  open: boolean;
}

interface CountdownState {
  nowUTCmillis: number;
}

class Countdown extends React.PureComponent<CountdownProps, CountdownState> {

  timer?: NodeJS.Timer | undefined;

  constructor(props: CountdownProps) {
    super(props);

    this.state = {nowUTCmillis: new Date().getTime()};
    this.tick = this.tick.bind(this);
  }

  override componentDidMount() {
    this.timer = setInterval(this.tick, 1000);
  }

  override componentWillUnmount() {
    this.timer != null && clearInterval(this.timer);
    this.timer = undefined;
  }

  tick() {
    this.setState({nowUTCmillis: new Date().getTime()});
  }

  override render() {
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

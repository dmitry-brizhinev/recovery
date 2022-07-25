import * as React from 'react'
import { CalendarId, idToDay } from './Data';
import ErrorBoundary from './ErrorBoundary';

const enum ScheduleStatus {
  Inactive = 'inactive',
  Active = 'active',
  Finished = 'finished',
}

interface Schedule {
  timeMinutes: number;
  notifyMinutes: number; // 0 = don't notify
  title: string;
  comment: string;       // May be empty
  recurDays: number;     // 0 = don't recur
  status: ScheduleStatus;
}

function getScheduledDate(dayId: CalendarId, schedule: Schedule): Date {
  const {year, month, day} = idToDay(dayId);
  return new Date(year, month-1, day, 0, schedule.timeMinutes);
}

function isActive(schedule: Schedule): boolean {
  return schedule.status === ScheduleStatus.Active;
}

interface EventInputProps {
  dayId: CalendarId;
  index: number;
  value: string;
  onChange: (index: number, value: string, rescheduledDays?: number) => void
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
    if (state.open && !props.value.endsWith('|X')) {
      return {open: false};
    }
    return null;
  }

  onClickCountdown() { // Also for cancel click
    this.setState(prevState => {return {open: !prevState.open};});
  }

  static replaceComment(oldValue: string, newComment: string): string {
    return oldValue.replace(CommentRegex, newComment);
  }

  onClickSave(comment: string) {
    const newValue = EventInput.replaceComment(this.props.value, comment);
    this.props.onChange(this.props.index, newValue);
  }

  onClickReschedule(comment: string) {
    const newValue = EventInput.replaceComment(this.props.value, comment).replace(/\|X$/, '|F');
    const rescheduledDaysMatch = this.props.value.match(/(?<=\|)\d+(?=\|X$)/);
    if (!rescheduledDaysMatch) {
      this.props.onChange(this.props.index, newValue);
      return;
    }
    const rescheduledDays = Number.parseInt(rescheduledDaysMatch[0]);
    this.props.onChange(this.props.index, newValue, rescheduledDays);
  }

  render() {
    const schedule = parseSchedule(this.props.value);
    const classname = 'calendar-event ' + (schedule?.status ?? 'invalid');
    const targetUTCmillis = schedule && isActive(schedule) && getScheduledDate(this.props.dayId, schedule).getTime();
    const open = this.state.open && !!targetUTCmillis;

    return <ErrorBoundary>
    <div className="calendar-event">
      <input className={classname} type="text" value={this.props.value} onChange={(event) => this.props.onChange(this.props.index, event.target.value)}/>
      {targetUTCmillis && <ErrorBoundary><Countdown open={open} targetUTCmillis={targetUTCmillis} onClick={this.onClickCountdown}/></ErrorBoundary>}
    </div>
      {open && <ErrorBoundary>
        <ScheduleDetail schedule={schedule} onCancel={this.onClickCountdown} onSave={this.onClickSave} onReschedule={this.onClickReschedule}/>
      </ErrorBoundary>}
    </ErrorBoundary>;
  }
}

interface ScheduleDetailProps {
  schedule: Schedule;
  onCancel: () => void;
  onSave: (comment: string) => void;
  onReschedule: (comment: string) => void;
}

interface ScheduleDetailState {
  unsavedComment: string;
}

class ScheduleDetail extends React.PureComponent<ScheduleDetailProps, ScheduleDetailState> {
  constructor(props: ScheduleDetailProps) {
    super(props);

    this.state = {unsavedComment: this.props.schedule.comment.replaceAll('\\n', '\n')};
    this.onSave = this.onSave.bind(this);
    this.onReschedule = this.onReschedule.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  onSave() {
    this.props.onSave(this.state.unsavedComment.replaceAll('\n', '\\n'));
  }

  onReschedule() {
    this.props.onReschedule(this.state.unsavedComment.replaceAll('\n', '\\n'));
  }

  onChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    this.setState({unsavedComment: event.target.value});
  }

  render() {
    const canReschedule = !!this.props.schedule.recurDays;
    const rescheduleDays = canReschedule ? ` ${this.props.schedule.recurDays}d` : '';

    return <div className="schedule-detail">
      {this.props.schedule.title}
      <textarea className="schedule-detail-comment" value={this.state.unsavedComment} onChange={this.onChange}/>
      <div className="schedule-detail-buttons">
        <button className="schedule-detail-button" onClick={this.props.onCancel}>Cancel</button>
        <button className="schedule-detail-button" onClick={this.onSave}>Save</button>
        <button className="schedule-detail-button" onClick={this.onReschedule} disabled={!canReschedule}>Reschedule{rescheduleDays}</button>
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

    return <button className={`schedule${this.props.open ? ' open' : ''}`} onClick={this.props.onClick}>{negative}{hours}:{minutes}:{remainingSecs}</button>;
  }
}

const ScheduleRegex = /^(?<hour>\d\d?)(:(?<minute>\d\d))?(?<ap>a|p)m\|((?<hours>\d+)h)?((?<minutes>\d+)m)?\|(?<title>[^|\n]+)\|(?<comment>[^|\n]*)\|(?<recur>\d*)\|(?<marked>X|F)?$/;
const CommentRegex = /(?<=^\d\d?(?::\d\d)?[ap]m\|(?:\d+h)?(?:\d+m)?\|[^|\n]+\|)[^|\n]*(?=\|\d*\|[XF]?$)/;

function maybeParse(value: string | undefined, mult?: number): number {
  return Number.parseInt(value || '0') * (mult ?? 1);
}

function parseSchedule(value: string): Schedule | null {
  const result = value.match(ScheduleRegex);
  if (!result) {
    return null;
  }
  const { hour, minute, ap, hours, minutes, title, comment, recur, marked } = result.groups!;
  const timeMinutes = maybeParse(hour, 60) + (ap === 'p' ? 60*12 : 0) + maybeParse(minute);
  const notifyMinutes = maybeParse(hours, 60) + maybeParse(minutes);
  const recurDays = maybeParse(recur);
  const status = {'X':ScheduleStatus.Active, 'F':ScheduleStatus.Finished}[marked] || ScheduleStatus.Inactive;
  return {timeMinutes, notifyMinutes, title, comment: comment || '', recurDays, status};
}
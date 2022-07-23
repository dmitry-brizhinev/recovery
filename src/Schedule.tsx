import * as React from 'react'
import { CalendarId, idToDay } from './Data';
import ErrorBoundary from './ErrorBoundary';

interface EventInputProps {
  dayId: CalendarId;
  index: number;
  value: string;
  onChange: (index: number, value: string) => void
}

enum ScheduleStatus {
  Inactive,
  Active,
  Finished,
}

interface Schedule {
  timeMinutes: number;
  notifyMinutes: number; // 0 = don't notify
  title: string;
  comment: string;       // May be empty
  recurDays: number;     // 0 = don't recur
  status: ScheduleStatus;
}

export function EventInput(props: EventInputProps): JSX.Element {
  const parsed = parseSchedule(props.value);
  const classname = 'calendar-event ' + (parsed ? (parsed.status !== ScheduleStatus.Inactive ? (parsed.status === ScheduleStatus.Active ? 'active' : 'finished') : 'valid') : 'invalid');
  const {year, month, day} = idToDay(props.dayId);
  const sched = parsed && new Date(year, month-1, day, 0, parsed.timeMinutes);

  return <ErrorBoundary><div className="calendar-event">
    <input className={classname} type="text" value={props.value} onChange={(event) => props.onChange(props.index, event.target.value)}/>
    {sched && parsed.status === ScheduleStatus.Active && <ErrorBoundary><Countdown targetUTCmillis={sched.getTime()}/></ErrorBoundary>}
  </div></ErrorBoundary>;
}

interface CountdownProps {
  targetUTCmillis: number;
}

export function Countdown(props: CountdownProps): JSX.Element {
  const [nowUTCmillis, setState] = React.useState(new Date().getTime());

  setTimeout(() => {
    setState(new Date().getTime())
  }, 1000);

  let remainingSecs = Math.round((props.targetUTCmillis - nowUTCmillis) / 1000);
  const negative = remainingSecs < 0 ? '-' : '';
  if (negative) remainingSecs = -remainingSecs;
  const hours = Math.floor(remainingSecs / 3600);
  remainingSecs = remainingSecs % 3600;
  const minutes = Math.floor(remainingSecs / 60);
  remainingSecs = remainingSecs % 60;

  return <span>{negative}{hours}:{minutes}:{remainingSecs}</span>;
}

const ScheduleRegex = /^(?<hour>\d\d?)(:(?<minute>\d\d))?(?<ap>a|p)m\|(((?<hours>\d+)h)?((?<minutes>\d+)m)?)\|(?<title>[^|]+)\|(?<comment>[^|]*)\|(?<recur>\d*)\|(?<marked>X|F)?$/;

function maybeParse(value: string | undefined, mult?: number): number {
  return value ? Number.parseInt(value) * (mult ? mult : 1) : 0;
}

function parseSchedule(value: string): Schedule | null {
  const result = value.match(ScheduleRegex);
  if (result == null) {
    return null;
  }
  try {
    const { hour, minute, ap, hours, minutes, title, comment, recur, marked } = result.groups!;
    const timeMinutes = maybeParse(hour, 60) + (ap === 'p' ? 60*12 : 0) + maybeParse(minute);
    const notifyMinutes = maybeParse(hours, 60) + maybeParse(minutes);
    const recurDays = maybeParse(recur);
    const status = marked ? (marked === 'X' ? ScheduleStatus.Active : ScheduleStatus.Finished) : ScheduleStatus.Inactive;
    return {timeMinutes, notifyMinutes, title, comment: comment || '', recurDays, status};
  } catch (e: any) {
    console.log(e);
    return null;
  }
}
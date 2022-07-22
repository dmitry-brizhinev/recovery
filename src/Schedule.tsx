import * as React from 'react'
import ErrorBoundary from './ErrorBoundary';

interface EventInputProps {
  index: number;
  value: string;
  onChange: (index: number, value: string) => void
}

export function EventInput(props: EventInputProps): JSX.Element {
  const parsed = parseSchedule(props.value);
  const classname = parsed ? (parsed.notifyMinutes ? (parsed.active ? 'calendar-event-active' : 'calendar-event-primed') : 'calendar-event-valid') : 'calendar-event-invalid';
  if (parsed) {
    console.log(parsed);
  }
  return <ErrorBoundary>
    <input className={classname} type="text" value={props.value} onChange={(event) => props.onChange(props.index, event.target.value)}/>
  </ErrorBoundary>;
}

interface Schedule {
  timeMinutes: number;
  notifyMinutes: number; // 0 = don't notify
  title: string;
  comment: string;       // May be empty
  recurDays: number;     // 0 = don't recur
  active: boolean;
}

const ScheduleRegex = /^@@(?<hour>\d\d?)(:(?<minute>\d\d))?(?<ap>a|p)m\|(((?<hours>\d+)h)?((?<minutes>\d+)m)?)\|(?<title>[^|@]+)\|(?<comment>[^|@]*)\|(?<recur>\d*)\|(?<marked>X?)@@$/;

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
    return {timeMinutes, notifyMinutes, title, comment: comment || '', recurDays, active: !!marked};
  } catch (e: any) {
    console.log(e);
    return null;
  }
}
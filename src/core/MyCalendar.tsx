import type * as React from 'react'
import type { Callback } from '../util/Utils';

import '../css/calendar.css';
import { CalendarId, dateToId, idToDate } from '../data/CalendarId';

  //const a = <ReactCalendar minDetail="month" onClickDay={props.onClickDay} tileClassName={props.tileClassName} next2Label={null} prev2Label={null}/>;

interface MyCalendarProps {
  id: CalendarId;
  onClickDay: Callback<CalendarId>;
  hasPageOrEvent: (day: CalendarId) => boolean;
}

export default function MyCalendar(props: MyCalendarProps): React.ReactElement {
  const date = idToDate(props.id);
  const prev = dateToId(prevMonth(date));
  const next = dateToId(nextMonth(date));
  return <div className="mycalendar">
    <button className="mycalendarb nav" onClick={() => props.onClickDay(prev)}>&lt;</button>
    <div className="mycalendar-month"><span>{monthDisplay(date)}</span></div>
    <button className="mycalendarb nav" onClick={() => props.onClickDay(next)}>&gt;</button>
    {[...weekdays()]}
    {[...days(date, props.onClickDay, props.hasPageOrEvent)]}
  </div>;
}

function prevMonth(date: Date): Date {
  const prev = new Date(date);
  prev.setDate(0);
  return prev;
}

function nextMonth(date: Date): Date {
  const next = new Date(date);
  next.setDate(32);
  next.setDate(1);
  return next;
}

const monthFormatter = new Intl.DateTimeFormat('en-US', {month: 'long', year: 'numeric'});
const weekdayFormatter = new Intl.DateTimeFormat('en-US', {weekday: 'short'});

function monthDisplay(date: Date): string {
  return monthFormatter.format(date);
}

function* weekdays() {
  const date = new Date();

  date.setDate(date.getDate() - date.getDay() + 1);

  do {
    yield <div key={date.getDay()} className="mycalendar-weekday">{weekdayFormatter.format(date)}</div>;
    date.setDate(date.getDate() + 1);
  } while (date.getDay() !== 1);
  
  return;
}

function* days(selected: Date, onClick: Callback<CalendarId>, hasPageOrEvent: (id: CalendarId) => boolean) {
  const date = new Date(selected);

  const month = date.getMonth();
  
  date.setDate(1);
  date.setDate(2 - (date.getDay() || 7));

  while(date.getMonth() === month || (date.getMonth() + 1) % 12 === month) {
    do {
      yield dayDisplay(selected, date, onClick, hasPageOrEvent);
      date.setDate(date.getDate() + 1);
    } while (date.getDay() !== 1);
  }
  return;
}

function dayDisplay(sel: Date, day: Date, onClick: Callback<CalendarId>, hasPageOrEvent: (id: CalendarId) => boolean) {
  const wd = day.getDay();
  const md = day.getDate();
  const id = dateToId(day);

  const weekend = wd === 0 || wd === 6 ? ' weekend' : '';
  const extra = sel.getMonth() !== day.getMonth() ? ' extra' : '';
  const busy = hasPageOrEvent(id) ? ' busy' : '';
  const selected = id === dateToId(sel) ? ' selected' : '';
  const today = id === dateToId(new Date()) ? ' today' : '';
  const className = `mycalendarb${weekend}${extra}${busy}${today}${selected}`;

  return <button key={`${day.getMonth()} ${md}`} className={className} onClick={() => onClick(id)}>{md}</button>;
}
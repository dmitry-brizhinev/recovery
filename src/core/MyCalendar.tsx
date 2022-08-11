import type * as React from 'react'

import ReactCalendar, { CalendarTileProperties } from "react-calendar";
import type { Callback } from '../util/Utils';

import 'react-calendar/dist/Calendar.css';
import '../css/calendar.css';
import { CalendarId, idToDate } from '../data/CalendarId';

export default function MyCalendar(props: {id: CalendarId, onClickDay: Callback<Date>, tileClassName: (p: CalendarTileProperties) => string}): React.ReactElement {
  const a = <ReactCalendar minDetail="month" onClickDay={props.onClickDay} tileClassName={props.tileClassName} next2Label={null} prev2Label={null}/>;
  const b = <MyBetterCalendar selected={props.id} onSelect={()=>{}} hasPageOrEvent={()=>false}/>;
  return 2+4 === 6 ? b : a;
}

interface MyCalendarProps {
  selected: CalendarId;
  onSelect: Callback<CalendarId>;
  hasPageOrEvent: (day: CalendarId) => boolean;
}

function MyBetterCalendar(props: MyCalendarProps): React.ReactElement {
  const date = idToDate(props.selected);
  return <div className="mycalendar">
    <button className="mycalendar-left">&lt;</button><div className="mycalendar-month">{monthDisplay(date)}</div><button className="mycalendar-right">&gt;</button>
    {[...weekdays()]}
    {[...days(date)]}
  </div>;
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

function* days(selected: Date) {
  const date = new Date(selected);

  const month = date.getMonth();
  
  date.setDate(1);
  date.setDate(2 - (date.getDay() || 7));

  while(date.getMonth() === month || (date.getMonth() + 1) % 12 === month) {
    do {
      yield dayDisplay(month, date);
      date.setDate(date.getDate() + 1);
    } while (date.getDay() !== 1);
  }
  return;
}

function dayDisplay(month: number, day: Date) {
  const wd = day.getDay();
  const md = day.getDate();
  const weekend = wd === 0 || wd === 6;
  const extra = month === day.getMonth();
  return <button key={`${day.getMonth()} ${md}`} className={`mycalendar-day${weekend ? ' weekend' : ''}${extra ? ' extra' : ''}`}>{md}</button>;
}
import * as React from 'react'
import './Calendar.css'
import 'react-calendar/dist/Calendar.css';


import { CalendarId, dateToId, CalendarData, CalendarPageData, CalendarEventData, CalendarPageMap, CalendarEventMap } from './Data'
import { saveCalendarPage, saveCalendarEvent } from './auth'
import { Saver } from './Saver'
import ErrorBoundary from './ErrorBoundary'

import { CalendarTileProperties, default as ReactCalendar } from 'react-calendar';
import { EventInput } from './Schedule';


interface CalendarProps {
  data: CalendarData;
}

interface CalendarState {
  id: CalendarId;
  pages: CalendarPageMap;
  events: CalendarEventMap;
  formatting: boolean;
}

type CalendarPageSave = { Id: CalendarId, Data: CalendarPageData };

export class Calendar extends React.Component<CalendarProps, CalendarState> {
  constructor(props: CalendarProps) {
    super(props);

    this.state = {id: dateToId(new Date()), pages: this.props.data.pages, events: this.props.data.events, formatting: false};

    this.onClickDay = this.onClickDay.bind(this);
    this.onChangePage = this.onChangePage.bind(this);
    this.onChangeEvent = this.onChangeEvent.bind(this);
    this.tileClassName = this.tileClassName.bind(this);
  }

  onClickDay(value: Date) {
    this.setState({id: dateToId(value), formatting: !this.state.formatting});
  }

  onChangePage(page: CalendarPageData) {
    const modified = new Map(this.state.pages);
    modified.set(this.state.id, page);
    this.setState({pages: modified, formatting: !this.state.formatting});
  }

  onChangeEvent(events: CalendarEventData) {
    const modified = new Map(this.state.events);
    modified.set(this.state.id, events);
    this.setState({events: modified, formatting: !this.state.formatting});
  }

  tileClassName(props: CalendarTileProperties) : string {
    const id = dateToId(props.date);
    const isSelected = id === this.state.id;
    const isToday = id === dateToId(new Date());
    const hasPage = !!this.state.pages.get(id);
    const event = this.state.events.get(id);
    const hasEvent = event != null && event.length > 0;

    return `${hasPage || hasEvent ? 'busy' : 'norm'}-${isToday ? 'tod' : 'day'}${isSelected ? '-selected' : ''}`;
  }

  render() {
    const classname = this.state.formatting ? (x: CalendarTileProperties) => this.tileClassName(x) : this.tileClassName;
    const pageData = this.state.pages.get(this.state.id) || '';
    const eventData = this.state.events.get(this.state.id) || [];
    return <ErrorBoundary><div className="calendar-wrapper">
      <ReactCalendar minDetail="month" onClickDay={this.onClickDay} tileClassName={classname} next2Label={null} prev2Label={null}/>
      <CalendarPage id={this.state.id} data={pageData} onChange={this.onChangePage}/>
      <CalendarEvents id={this.state.id} data={eventData} onChange={this.onChangeEvent}/>
    </div><hr/></ErrorBoundary>
  }
}

interface CalendarPageProps {
  id: CalendarId;
  data: CalendarPageData;
  onChange: (data: CalendarPageData) => void;
}

class CalendarPage extends React.Component<CalendarPageProps, object> {
  constructor(props: CalendarPageProps) {
    super(props);

    this.onChange = this.onChange.bind(this);
  }

  onChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    this.props.onChange(event.target.value);
  }

  render() {
    return <ErrorBoundary><div className="calendar-page">
      {this.props.id.substring(1)}: <Saver<CalendarPageSave> id={this.props.id} data={this.props.data} saver={saveCalendarPage}/>
      <textarea className="calendar" value={this.props.data} onChange={this.onChange}/>
    </div></ErrorBoundary>;
  }
}

interface CalendarEventProps {
  id: CalendarId;
  data: CalendarEventData;
  onChange: (data: CalendarEventData) => void;
}

type CalendarEventSave = { Id: CalendarId, Data: CalendarEventData };

class CalendarEvents extends React.Component<CalendarEventProps, object> {
  constructor(props: CalendarEventProps) {
    super(props);

    this.onChange = this.onChange.bind(this);
    this.makeBox = this.makeBox.bind(this);
  }

  onChange(index: number, text: string) {
    const modified = [...this.props.data];
    if (index === modified.length) {
      if (!text) {
        return;
      }
      modified.push(text);
    } else if (text) {
      modified[index] = text;
    } else {
      modified.splice(index, 1);
    }
    this.props.onChange(modified);
  }

  makeBox(index: number): JSX.Element {
    const text = index < this.props.data.length ? this.props.data[index] : '';
    return <EventInput key={index} index={index} value={text} onChange={this.onChange}/>
  }

  render() {
    return <ErrorBoundary><div className="calendar-events">
      <Saver<CalendarEventSave> id={this.props.id} data={this.props.data} saver={saveCalendarEvent}/>
      {[...Array(this.props.data.length + 1).keys()].map(this.makeBox)}
    </div></ErrorBoundary>;
  }
}
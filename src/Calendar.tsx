import * as React from 'react'
import './Calendar.css'
import 'react-calendar/dist/Calendar.css';

import { CalendarId, dateToId, CalendarData, CalendarPageData, saveCalendar, CalendarEventData, CalendarPageMap, CalendarEventMap } from './auth'
import { Saver } from './Saver'
import ErrorBoundary from './ErrorBoundary'

import { CalendarTileProperties, default as ReactCalendar } from 'react-calendar';


interface CalendarProps {
  data: CalendarData;
}

interface CalendarState {
  id: CalendarId;
  pages: CalendarPageMap;
  events: CalendarEventMap;
  formatting: boolean;
}

type CalendarSave = { Id: CalendarId, Data: CalendarPageMap };

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
    const isToday = id === dateToId(new Date());
    const hasPage = this.state.pages.has(id);
    const hasEvent = this.state.events.has(id);
    if (hasPage || hasEvent) {
      return isToday ? 'busy-today' : 'busy-day';
    } else {
      return 'normal-day';
    }
  }

  render() {
    const classname = this.state.formatting ? (x: CalendarTileProperties) => this.tileClassName(x) : this.tileClassName;
    return <ErrorBoundary><div className="calendar-wrapper">
      <ReactCalendar minDetail="month" onClickDay={this.onClickDay} tileClassName={classname} next2Label={null} prev2Label={null}/>
        {this.state.id.substring(1)}: <Saver<CalendarSave> id={this.state.id} data={this.state.pages} saver={saveCalendar}/>
        <CalendarPage data={this.state.pages.get(this.state.id) || ''} onChange={this.onChangePage}/>
    </div><hr/></ErrorBoundary>
  }
}

interface CalendarPageProps {
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
    return <ErrorBoundary>
      <textarea className="calendar" value={this.props.data} onChange={this.onChange}/>
      </ErrorBoundary>;
  }
}

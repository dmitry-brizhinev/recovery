import * as React from 'react'

import { CalendarPageData, CalendarEventData, CalendarPageMap, CalendarEventMap } from './Data'
import ErrorBoundary from './ErrorBoundary'

import { CalendarTileProperties, default as ReactCalendar } from 'react-calendar';
import EventInput from './CalendarEvents';

import { Map as IMap } from 'immutable';
import { RootContext } from './Root'
import Event from './Event';
import { CalendarId, dateToId, incrementId, idToNiceString } from './CalendarId';
import { Func } from './Utils';


interface CalendarProps {
  pages: CalendarPageMap;
  events: CalendarEventMap;
}

interface CalendarState {
  id: CalendarId;
  formatting: boolean;
}

export default class Calendar extends React.Component<CalendarProps, CalendarState> {
  constructor(props: CalendarProps) {
    super(props);

    this.state = {id: dateToId(new Date()), formatting: false};

    this.onClickDay = this.onClickDay.bind(this);
    this.tileClassName = this.tileClassName.bind(this);
    this.onClickPrevDay = this.onClickPrevDay.bind(this);
    this.onClickNextDay = this.onClickNextDay.bind(this);
  }

  changeDay(id: CalendarId) {
    this.setState({id, formatting: !this.state.formatting});
  }

  onClickDay(value: Date) {
    this.changeDay(dateToId(value));
  }

  onClickPrevDay() {
    this.changeDay(incrementId(this.state.id, -1));
  }

  onClickNextDay() {
    this.changeDay(incrementId(this.state.id, 1));
  }

  tileClassName(props: CalendarTileProperties) : string {
    const id = dateToId(props.date);
    const isSelected = id === this.state.id;
    const isToday = id === dateToId(new Date());
    const hasPage = !!this.props.pages.get(id);
    const events = this.props.events.get(id);
    const hasPageOrEvent = hasPage || (!!events && events.size > 0 && events.some(event => !event.isFinished()));

    return `${hasPageOrEvent ? 'busy' : 'norm'}-${isToday ? 'tod' : 'day'}${isSelected ? '-selected' : ''}`;
  }

  render() {
    const classname = this.state.formatting ? (x: CalendarTileProperties) => this.tileClassName(x) : this.tileClassName;
    const pageData = this.props.pages.get(this.state.id) ?? '';
    const eventData = this.props.events.get(this.state.id) ?? IMap<number, Event>();
    return <ErrorBoundary><div className="calendar-wrapper">
      <ReactCalendar minDetail="month" onClickDay={this.onClickDay} tileClassName={classname} next2Label={null} prev2Label={null}/>
      <CalendarPage id={this.state.id} data={pageData}/>
      <CalendarEvents id={this.state.id} data={eventData} onClickPrevDay={this.onClickPrevDay} onClickNextDay={this.onClickNextDay}/>
    </div><hr/></ErrorBoundary>
  }
}

interface CalendarPageProps {
  id: CalendarId;
  data: CalendarPageData;
}

class CalendarPage extends React.Component<CalendarPageProps, object> {
  static contextType = RootContext;
  context!: React.ContextType<typeof RootContext>;
  render() {
    return <ErrorBoundary><div className="calendar-page">
      {this.props.id.substring(1)}
      <textarea className="calendar" value={this.props.data} onChange={event => this.context.onCalendarPageUpdate(this.props.id, event)}/>
    </div></ErrorBoundary>;
  }
}

interface CalendarEventProps {
  id: CalendarId;
  data: CalendarEventData;
  onClickPrevDay: Func;
  onClickNextDay: Func;
}

class CalendarEvents extends React.Component<CalendarEventProps, object> {
  static contextType = RootContext;
  context!: React.ContextType<typeof RootContext>;
  constructor(props: CalendarEventProps) {
    super(props);
    this.makeBox = this.makeBox.bind(this);
    this.onEventCreate = this.onEventCreate.bind(this);
  }

  onEventCreate() {
    this.context.onCalendarEventUpdate(this.props.id, Event.makeEmpty());
  }

  makeBox(event: Event): React.ReactNode {
    return <EventInput key={event.magicKey} dayId={this.props.id} event={event}/>
  }

  render() {
    return <div className="calendar-events"><ErrorBoundary>
      <div className="calendar-events-header">
        <button className="event-prev-day" onClick={this.props.onClickPrevDay}>&lt;</button>
        {idToNiceString(this.props.id)}
        <button className="event-next-day" onClick={this.props.onClickNextDay}>&gt;</button>
      </div>
      {[...this.props.data.values()].sort(Event.compare).map(this.makeBox)}
      <button className="event-create" onClick={this.onEventCreate}>+</button>
    </ErrorBoundary></div>;
  }
}

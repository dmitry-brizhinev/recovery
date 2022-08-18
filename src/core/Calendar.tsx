import * as React from 'react'

import type {CalendarPageData, CalendarEventData, CalendarPageMap, CalendarEventMap} from '../data/Data'
import ErrorBoundary from '../util/ErrorBoundary'

import EventInput from './CalendarEvents';

import {Map as IMap} from 'immutable';
import {DataRootContext} from '../helpers/DataRoot'
import Event from '../data/Event';
import {CalendarId, dateToCId, incrementCId} from '../data/CalendarId';
import type {Func} from '../util/Utils';
import Textarea from '../util/Textarea';
import MyCalendar from './MyCalendar';

import '../css/events.css';
import {idToNiceString} from '../data/DateId';

interface CalendarProps {
  pages: CalendarPageMap;
  events: CalendarEventMap;
}

interface CalendarState {
  id: CalendarId;
}

export default class Calendar extends React.Component<CalendarProps, CalendarState> {
  constructor(props: CalendarProps) {
    super(props);

    this.state = {id: dateToCId(new Date())};

    this.changeDay = this.changeDay.bind(this);
    this.onClickPrevDay = this.onClickPrevDay.bind(this);
    this.onClickNextDay = this.onClickNextDay.bind(this);
  }

  changeDay(id: CalendarId) {
    this.setState({id});
  }

  onClickPrevDay() {
    this.changeDay(incrementCId(this.state.id, -1));
  }

  onClickNextDay() {
    this.changeDay(incrementCId(this.state.id, 1));
  }

  hasPageOrEvent(id: CalendarId): boolean {
    const hasPage = !!this.props.pages.get(id);
    const events = this.props.events.get(id);
    return hasPage || (!!events && events.size > 0 && events.some(event => !event.isFinished()));
  }

  render() {
    const pageData = this.props.pages.get(this.state.id) ?? '';
    const eventData = this.props.events.get(this.state.id) ?? IMap<number, Event>();
    return <div className="calendar-wrapper"><ErrorBoundary>
      <MyCalendar id={this.state.id} onClickDay={this.changeDay} hasPageOrEvent={this.hasPageOrEvent.bind(this)} />
      <CalendarPage id={this.state.id} data={pageData} />
      <CalendarEvents id={this.state.id} data={eventData} onClickPrevDay={this.onClickPrevDay} onClickNextDay={this.onClickNextDay} />
    </ErrorBoundary>
    </div>;
  }
}

interface CalendarPageProps {
  id: CalendarId;
  data: CalendarPageData;
}

function CalendarPage(props: CalendarPageProps): React.ReactElement {
  const root = React.useContext(DataRootContext);
  const onChange = React.useCallback((data: string) => root.onCalendarPageUpdate(props.id, data), [root, props.id]);

  return <ErrorBoundary><div className="calendar-page">
    {props.id.substring(1)}
    <Textarea className="calendar" value={props.data} onChange={onChange} />
  </div></ErrorBoundary>;
}

interface CalendarEventProps {
  id: CalendarId;
  data: CalendarEventData;
  onClickPrevDay: Func;
  onClickNextDay: Func;
}

class CalendarEvents extends React.Component<CalendarEventProps, object> {
  static contextType = DataRootContext;
  context!: React.ContextType<typeof DataRootContext>;
  constructor(props: CalendarEventProps) {
    super(props);
    this.makeBox = this.makeBox.bind(this);
    this.onEventCreate = this.onEventCreate.bind(this);
  }

  onEventCreate() {
    const newEvent = Event.makeEmpty();
    this.context.onCalendarEventUpdate(this.props.id, newEvent.magicKey, newEvent);
  }

  makeBox(event: Event): React.ReactNode {
    return <EventInput key={event.magicKey} dayId={this.props.id} event={event} />
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

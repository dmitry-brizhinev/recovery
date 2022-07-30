import * as React from 'react'

import { CalendarId, dateToId, CalendarData, CalendarPageData, CalendarEventData, CalendarPageMap, CalendarEventMap, incrementId, Event, idToNiceString } from './Data'
import { saveCalendarPage, saveCalendarEvent } from './Firebase'
import { InnerSaver, Saver } from './Saver'
import ErrorBoundary from './ErrorBoundary'

import { CalendarTileProperties, default as ReactCalendar } from 'react-calendar';
import { EventInput } from './CalendarEvents';


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

  onChangePage(page: CalendarPageData) {
    const modified = new Map(this.state.pages);
    modified.set(this.state.id, page);
    this.setState({pages: modified, formatting: !this.state.formatting});
  }

  onChangeEvent(events: CalendarEventData, reschedule?: Event) {
    const modified = new Map(this.state.events);
    modified.set(this.state.id, events);

    if (reschedule && reschedule.recurDays) {
      const newId = incrementId(this.state.id, reschedule.recurDays);
      const newData = [...(modified.get(newId) ?? [])];
      newData.push(reschedule);
      newData.sort(Event.compare);
      modified.set(newId, newData);

      new InnerSaver<CalendarEventSave>(newId, newData, 0, saveCalendarEvent, () => {}).onChange(newData, {force: true});
    }

    this.setState({events: modified, formatting: !this.state.formatting});
  }

  tileClassName(props: CalendarTileProperties) : string {
    const id = dateToId(props.date);
    const isSelected = id === this.state.id;
    const isToday = id === dateToId(new Date());
    const hasPage = !!this.state.pages.get(id);
    const events = this.state.events.get(id);
    const hasPageOrEvent = hasPage || (events != null && events.length > 0 && events.some(event => !event.isFinished()));

    return `${hasPageOrEvent ? 'busy' : 'norm'}-${isToday ? 'tod' : 'day'}${isSelected ? '-selected' : ''}`;
  }

  render() {
    const classname = this.state.formatting ? (x: CalendarTileProperties) => this.tileClassName(x) : this.tileClassName;
    const pageData = this.state.pages.get(this.state.id) || '';
    const eventData = this.state.events.get(this.state.id) || [];
    return <ErrorBoundary><div className="calendar-wrapper">
      <ReactCalendar minDetail="month" onClickDay={this.onClickDay} tileClassName={classname} next2Label={null} prev2Label={null}/>
      <CalendarPage id={this.state.id} data={pageData} onChange={this.onChangePage}/>
      <CalendarEvents id={this.state.id} data={eventData} onChange={this.onChangeEvent} onClickPrevDay={this.onClickPrevDay} onClickNextDay={this.onClickNextDay}/>
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
  onChange: (data: CalendarEventData, reschedule?: Event) => void;
  onClickPrevDay: () => void;
  onClickNextDay: () => void;
}

type CalendarEventSave = { Id: CalendarId, Data: CalendarEventData };

class CalendarEvents extends React.Component<CalendarEventProps, object> {
  constructor(props: CalendarEventProps) {
    super(props);

    this.onChange = this.onChange.bind(this);
    this.makeBox = this.makeBox.bind(this);
    this.onEventCreate = this.onEventCreate.bind(this);
  }

  onChange(index: number, event: Event | null, reschedule?: boolean) {
    const modified = [...this.props.data];
    let rescheduled = undefined;
    if (index === modified.length) {
      if (!event) {
        return;
      }
      modified.push(event);
      modified.sort(Event.compare);
    } else if (event) {
      if (reschedule) {
        rescheduled = modified[index];
      }
      modified[index] = event;
      modified.sort(Event.compare);
    } else {
      modified.splice(index, 1);
      //modified.pop();
    }
    this.props.onChange(modified, rescheduled);
  }

  onEventCreate() {
    this.onChange(this.props.data.length, Event.makeEmpty());
  }

  makeBox(event: Event, index: number): JSX.Element {
    return <EventInput key={`${this.props.id}${event.magicKey}`} dayId={this.props.id} index={index} event={event} onChange={this.onChange}/>
  }

  render() {
    return <div className="calendar-events"><ErrorBoundary>
      <div className="calendar-events-header">
        <button className="event-prev-day" onClick={this.props.onClickPrevDay}>&lt;</button>
        {idToNiceString(this.props.id)}: <Saver<CalendarEventSave> id={this.props.id} data={this.props.data} saver={saveCalendarEvent}/>
        <button className="event-next-day" onClick={this.props.onClickNextDay}>&gt;</button>
      </div>
      {this.props.data.map(this.makeBox)}
      <button className="event-create" onClick={this.onEventCreate}>+</button>
    </ErrorBoundary></div>;
  }
}

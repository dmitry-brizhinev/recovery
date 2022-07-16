import * as React from 'react'
import './Calendar.css'
import 'react-calendar/dist/Calendar.css';

import { CalendarId, dateToId, CalendarData, CalendarPageData, saveCalendar } from './auth'
import { Saver } from './Saver'
import ErrorBoundary from './ErrorBoundary'

import { CalendarTileProperties, default as ReactCalendar } from 'react-calendar';


interface CalendarProps {
  data: CalendarData;
}

interface CalendarInnerProps {
  id: CalendarId;
  data: CalendarData;
  status: string;
  onChange: (id: CalendarId, data: CalendarData, opts?: {force?: boolean}) => void;
}

interface CalendarInnerState {

}

export class Calendar extends React.Component<CalendarProps, object> {
  render() {
    return <ErrorBoundary>
      <Saver<CalendarData,CalendarId> data={this.props.data} id={dateToId(new Date())} saver={saveCalendar} render={(id, data, status, onChange) => {
      return <CalendarInner id={id} data={data} status={status} onChange={onChange}/>;
    }}/>
    </ErrorBoundary>;
  }
}

class CalendarInner extends React.Component<CalendarInnerProps, CalendarInnerState> {
  constructor(props: CalendarInnerProps) {
    super(props);
    this.onClickDay = this.onClickDay.bind(this);
    this.onChange = this.onChange.bind(this);
    this.tileClassName = this.tileClassName.bind(this);
  }

  onClickDay(value: Date) {
    this.props.onChange(dateToId(value), this.props.data, {force: true});
  }

  onChange(data: CalendarPageData) {
    const modified = new Map(this.props.data);
    modified.set(this.props.id, data);
    this.props.onChange(this.props.id, modified);
  }

  tileClassName(props: CalendarTileProperties) : string {
    const id = dateToId(props.date);
    if (this.props.data.get(id)) {
      return id === dateToId(new Date()) ? 'busy-today' : 'busy-day';
    } else {
      return 'normal-day';
    }
  }

  render() {
    return <ErrorBoundary><div className="calendar-wrapper">
      <ReactCalendar minDetail="month" onClickDay={this.onClickDay} tileClassName={this.tileClassName} next2Label={null} prev2Label={null}/>
        {this.props.id.substring(1)}: {this.props.status}
        <CalendarPage data={this.props.data.get(this.props.id) || ''} onChange={this.onChange}/>
    </div><hr/></ErrorBoundary>
  }
}

interface CalendarPageProps {
  data: CalendarPageData;
  onChange: (data: CalendarPageData) => void;
}

class CalendarPage extends React.PureComponent<CalendarPageProps, object> {
  constructor(props: CalendarPageProps) {
    super(props);

    this.onChange = this.onChange.bind(this);
  }

  onChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    this.props.onChange((event.target as HTMLTextAreaElement).value);
  }


  render() {
    return <textarea className="calendar" value={this.props.data} onChange={this.onChange}/>;
  }
}
import * as React from 'react'
import './Calendar.css'
import 'react-calendar/dist/Calendar.css';

import { CalendarId, dateToId, CalendarData, CalendarPageData, saveCalendar } from './auth'
import { Saver, SaverStatusString } from './Saver'
import ErrorBoundary from './ErrorBoundary'
import { Editor } from './Editor'

import { CalendarTileProperties, default as ReactCalendar } from 'react-calendar';


interface CalendarProps {
  data: CalendarData;
}

interface CalendarInnerProps {
  id: CalendarId;
  data: CalendarData;
  status: SaverStatusString;
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
    this.props.onChange(this.props.id, this.props.data, {force: true});
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
    const classname = this.props.status === SaverStatusString.Saving ? (x: CalendarTileProperties) => this.tileClassName(x) : this.tileClassName;
    return <ErrorBoundary><div className="calendar-wrapper">
      <ReactCalendar minDetail="month" onClickDay={this.onClickDay} tileClassName={classname} next2Label={null} prev2Label={null}/>
        {this.props.id.substring(1)}: {this.props.status}
        <CalendarPage data={this.props.data.get(this.props.id) || ''} onChange={this.onChange}/>
    </div><hr/></ErrorBoundary>
  }
}

interface CalendarPageProps {
  data: CalendarPageData;
  onChange: (data: CalendarPageData) => void;
}

class CalendarPage extends React.Component<CalendarPageProps, object> {
  render() {
    //return <textarea className="calendar" value={this.props.data} onChange={this.onChange}/>;
    return <ErrorBoundary><Editor onChange={this.props.onChange} text={this.props.data}/></ErrorBoundary>;
  }
}
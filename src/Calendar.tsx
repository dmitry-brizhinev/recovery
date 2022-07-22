import * as React from 'react'
import './Calendar.css'
import 'react-calendar/dist/Calendar.css';

import { CalendarId, dateToId, CalendarData, CalendarPageData, saveCalendar } from './auth'
import { Saver } from './Saver'
import ErrorBoundary from './ErrorBoundary'
import { Editor } from './Editor'

import { CalendarTileProperties, default as ReactCalendar } from 'react-calendar';


interface CalendarProps {
  initialData: CalendarData;
}

interface CalendarState {
  id: CalendarId;
  data: CalendarData;
  formatting: boolean;
}

type CalendarSave = { Id: CalendarId, Data: CalendarData };

export class Calendar extends React.Component<CalendarProps, CalendarState> {
  constructor(props: CalendarProps) {
    super(props);

    this.state = {id: dateToId(new Date()), data: this.props.initialData, formatting: false};

    this.onClickDay = this.onClickDay.bind(this);
    this.onChange = this.onChange.bind(this);
    this.tileClassName = this.tileClassName.bind(this);
  }

  onClickDay(value: Date) {
    this.setState({id: dateToId(value), formatting: !this.state.formatting});
  }

  onChange(data: CalendarPageData) {
    const modified = new Map(this.state.data);
    modified.set(this.state.id, data);
    this.setState({data: modified, formatting: !this.state.formatting});
  }

  tileClassName(props: CalendarTileProperties) : string {
    const id = dateToId(props.date);
    if (this.state.data.get(id)) {
      return id === dateToId(new Date()) ? 'busy-today' : 'busy-day';
    } else {
      return 'normal-day';
    }
  }

  render() {
    const classname = this.state.formatting ? (x: CalendarTileProperties) => this.tileClassName(x) : this.tileClassName;
    return <ErrorBoundary><div className="calendar-wrapper">
      <ReactCalendar minDetail="month" onClickDay={this.onClickDay} tileClassName={classname} next2Label={null} prev2Label={null}/>
        {this.state.id.substring(1)}: <Saver<CalendarSave> id={this.state.id} data={this.state.data} saver={saveCalendar}/>
        <CalendarPage data={this.state.data.get(this.state.id) || ''} onChange={this.onChange}/>
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
import * as React from 'react'
import './Editor.css'

interface EditorProps {
  text: string;
  onChange: (text: string) => void;
}

interface EditorState {
}

export class Editor extends React.Component<EditorProps, EditorState> {

  constructor(props: EditorProps) {
    super(props);

    this.onChange = this.onChange.bind(this);
  }

  onChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    this.props.onChange((event.target as HTMLTextAreaElement).value);
  }

  render() {
    return <textarea className="calendar" value={this.props.text} onChange={this.onChange}/>;
  }
}
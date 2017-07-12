export function withDataRenderer(WrappedComponent) {
  // TODO: Change back to the non-debounced renderer.
  return withDebouncedRenderer(WrappedComponent);
}

// TODO: Actually debounce this instead of just returning on blur.
export function withDebouncedRenderer(WrappedComponent) {
  class DataRenderer extends React.Component {
    constructor(props) {
      super(props);
      this.state = this.createInitialState(props);
    }

    createInitialState(props) {
      return props.viewType.getFieldAndValue(props.renderData);
    }

    componentWillReceiveProps(newProps) {
      if (newProps.renderData != this.props.renderData) {
        this.setState(this.createInitialState(newProps));
      }
    }

    onKeyDown = (e) => {
      if (e.which == 13) {
        this.onBlur();
      }
    }

    onChange = (value) => {
      this.setState({value});
    }

    onBlur = () => {
      const {viewType, renderData} = this.props;
      const ref = viewType.getRef();
      renderData.options.onChange(ref, this.getParsedInput());
      renderData.options.onBlur(ref);
    }

    getParsedInput = () => {
      const {viewType} = this.props;
      return viewType.parseInput ?
        viewType.parseInput(this.state.value) :
        this.state.field.parseInput ?
          this.state.field.parseInput(this.state.value) :
          this.state.value;
    }

    render() {
      const {viewType, renderData} = this.props;
      const {getError, isDisabled, onButtonClick} = renderData.options;

      const ref = viewType.getRef();
      const disabled = isDisabled(ref) || !viewType.isEditable();
      const error = getError(ref);
      const placeholder = viewType.getPlaceholder();

      return (
        <div
          onKeyDown={this.onKeyDown}
        >
          <WrappedComponent
            viewType={viewType}
            renderData={renderData}
            field={this.state.field}
            value={this.state.value}
            disabled={disabled}
            error={error}
            placeholder={placeholder}
            onChange={this.onChange}
            onBlur={this.onBlur}
            onButtonClick={(...args) => onButtonClick(ref, ...args)}
          />
        </div>
      );
    };
  }

  return DataRenderer;
}

export function withStaticRenderer(WrappedComponent) {
  return ({viewType, renderData}) => {
    const {field, value} = viewType.getFieldAndValue(renderData);

    return <WrappedComponent
      viewType={viewType}
      renderData={renderData}
      field={field}
      value={value}
    />;
  };
}

export function withDisplayRenderer(WrappedComponent) {
  return ({viewType, renderData}) => {
    const {dataType, dataValue} = renderData;

    const ref = viewType.getRef();
    const {field, value: rawValue} = dataType.getFieldAndValue(dataValue, ref);

    const value = viewType.getDisplay(renderData);

    return <WrappedComponent
      viewType={viewType}
      renderData={renderData}
      field={field}
      value={value}
    />;
  };
}


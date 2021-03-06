/**
 * @namespace DataTypes
 * @module
 */

import Immutable, {List, Map} from 'immutable';

import Type from '../type';
import ValidationError from './validationError';

/**
 * A set of standard validation errors that registered types can use.
 *
 * TODO: Add a better way to modify the basic error messages other than just
 * editing the imported object, which is baaaaad.
 */
export const validationErrors = {
  required: 'This field is required',
  undefinedValue: 'This field is in a bad state. Please change the value and try again',
  invalidOption: 'The value selected does not exist',
  integer: 'This field must be an integer',
  finite: 'This field must be a finite number',
  email: 'This field must be an email address',
  url: 'This field must be a URL',
  ssn: 'This field must be a valid SSN',
  tel: 'This field must be a valid US telephone number',
  zipCode: 'This field must be a valid US Zip Code',
  singleline: 'This field must contain just one line of text'
};

/**
 * The base data type. Every registered data type must eventually inherit from this.
 *
 * Allowed options:
 *
 * |Name|Type|Attribute|Description|
 * |----|----|---------|-----------|
 * |required|{@link boolean}| <ul><li>optional</li><li>default: false</li></ul> | Marks if this data type is required to have a value to pass validation. |
 * |unique|{@link boolean}| <ul><li>optional</li><li>default: false</li></ul> | Marks if this data type is required to be unique across all models. |
 * |generated|{@link boolean}| <ul><li>optional</li><li>default: false</li></ul> | Marks if this data type will have a value generated by the server if it is not assigned one by the client. |
 * |excluded|{@link boolean}| <ul><li>optional</li><li>default: false</li></ul> | Marks if this data type will be excluded from the output model. |
 * |defaultValue|any| <ul><li>optional</li></ul> | The default value to use if one is not provided by the user. |
 * |validator|{@link function}(value: any, rootValue: any): {@link boolean}| <ul><li>optional</li></ul> | A custom validation function. |
 * |validationLinks|{@link string}[]| <ul><li>optional</li></ul> | A list of other data types in this model to also validate when this data type is validated. |
 */
export default class DataType extends Type {
  /** The data type name. This must be overridden. */
  static typeName = '';

  static parse(field, parseField) {
    field = Immutable.fromJS(field);
    return new this(
      field.get('name'),
      this.parseOptions(field.get('options'), parseField)
    );
  }

  /**
   * Creates a new instance of a data type.
   * @param {string} name - The unique name of this instance.
   * @param {Object} options - Options to apply to this instance. See the top of this file for allowed options.
   */
  constructor(name, options) {
    super();
    this.name = name;
    this.options = Immutable.fromJS(options || {});
  }

  getName() {
    return this.name;
  }

  getOptions() {
    return this.options();
  }

  isRequired() {
    return this.options.get('required', false);
  }

  isUnique() {
    return this.options.get('unique', false);
  }

  isGenerated() {
    return this.options.get('generated', false);
  }

  isExcluded() {
    return this.options.get('excluded', false);
  }

  getDefaultValue(defaultValue = null) {
    const optionsDefaultValue = this.options.get('defaultValue');
    return typeof optionsDefaultValue == 'undefined' ?
      defaultValue :
      optionsDefaultValue;
  }

  getValidator() {
    return this.options.get('validator', () => undefined);
  }

  getValidationLinks() {
    return this.options.get('validationLinks', List());
  }

  /**
   * Checks if the passed in value is "not empty".
   * @param {object} value - The data value to check.
   * @param {boolean} [checkDefault=true] - Check if the value is the default value or not.
   * @return {boolean} `true` if it is "not empty", otherwise, `false`.
   */
  hasValue(value, checkDefault = true) {
    // TODO: should the types that inherit from DataType check that the value
    // is valid? (eg, a number contains a number type, text contains a string,
    // etc)
    if (typeof value == 'undefined' || value === null || (value === this.getDefaultValue() && checkDefault)) {
      return false;
    }
    return true;
  }

  /**
   * Returns a parsed value. A value of `undefined` implies that the value is
   * missing and should be filled in by a default value, first supplied in the
   * options, and if not, the one supplied by the type.
   * @params {object} value - The data value to parse.
   */
  getValue(value, defaultValue) {
    // TODO: see comment in `hasValue` for typechecking.
    const values = this.isGenerated() ?
      [value] :
      [
        value,
        this.getDefaultValue(defaultValue)
      ];

    return values
      .find(value => typeof value != 'undefined');
  }

  getField(ref) {
    return this;
  }

  getFieldAndValue(value, ref) {
    return {
      field: this,
      value: this.getValue(value)
    };
  }

  /**
   * Returns the value parsed for human consumption.
   * @params {object} value - The data value to parse.
   * @return {string} The parsed value.
   */
  getDisplay(value) {
    value = this.getValue(value);
    return (value && value.toString) ? value.toString() : '';
  }

  /**
   * Validates that the given value follows the rules of the data type.
   * @params {object} value - The value to validate.
   * @return An error if one was found, undefined otherwise.
   */
  validate(value, callback) {
    value = this.getValue(value);

    if (value === this.getDefaultValue() && this.hasValue(value, false)) {
      return;
    }

    if (!this.hasValue(value, false)) {
      if (this.isGenerated()) {
        return;
      } else if (this.isRequired()) {
        return new ValidationError(validationErrors.required, this, value);
      } else {
        return;
      }
    }

    if (callback) {
      return callback();
    }
  }

  exclude(model, deep=true) {
    return this.isExcluded()
      ? undefined
      : model;
  }

  filter(filterValue, rowValue) {
    return filterValue == rowValue;
  }
}

export class ImmutableDataType extends DataType {
  static typeName = '';

  hasValue(value, checkDefault) {
    if (!super.hasValue(value, checkDefault)) {
      return false;
    }
    return value && value.size > 0;
  }

  getValue(value, ref, renderOptions) {
    value = super.getValue(value);
    if (ref) {
      return this.getFieldAndValue(value, ref, renderOptions).value;
    }
    return value;
  }

  getField(ref, renderOptions) {
    throw new Error(`"getField" is not implemented for "${this.getName()}"`);
  }

  getNextField(field, refs, renderOptions) {
    if (refs.size == 0) {
      return field;
    } else {
      if (field && field.getField) {
        return field.getField(refs, renderOptions);
      }
      throw new Error(`Cannot call "getField" "${field.name}" of data type "${field.constructor.name}"`);
    }
  }

  getFieldAndValue(value, ref, renderOptions) {
    throw new Error(`"getFieldAndValue" is not implemented for ${this.getName()}"`);
  }

  getNextFieldAndValue(field, value, refs, renderOptions) {
    if (refs.size == 0) {
      return {field, value};
    } else {
      if (field && field.getFieldAndValue) {
        return field.getFieldAndValue(value, refs, renderOptions);
      }
      throw new Error(`Cannot call "getFieldAndValue" for "${field.name}" of data type "${field.constructor.name}"`);
    }
  }

  setValue(value, ref, newValue) {
    throw new Error(`"setField" is not implemented for "${this.getName()}"`);
  }

  setNextValue(field, oldValue, newValue, refs, renderOptions) {
    if (refs.size == 0) {
      return newValue;
    } else {
      if (field.setValue) {
        return field.setValue(oldValue, refs, newValue, renderOptions);
      }
      throw new Error(`Cannot call "setValue" for "${field.name}" of data type "${field.constructor.name}"`);
    }
  }
}


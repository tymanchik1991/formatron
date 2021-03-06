import Immutable, {List} from 'immutable';

import {valueRenderers} from '~/renderers';
import RenderData from '~/renderers/renderData.js';
import * as Types from '~/types';

export function parseRef(field) {
  if (field instanceof Ref) {
    return field;
  }

  if (field === null || typeof field == 'undefined') {
    return null;
  }

  if (typeof field == 'string') {
    // Quick hack. Remove soon.
    if (field[1] == ':') {
      const refTypeCode = field[0];
      const refValue = field.slice(2);
      switch (refTypeCode) {
        case 'r':
          return new ImmutableRef(refValue);

        case 'q':
          return new ImmutableListFindRef(createTruthyViewType(refValue));

        case 'f':
          return new ImmutableListFilterRef(createTruthyViewType(refValue));

        case 'm':
          return new ImmutableListMapRef(createMappyViewType(refValue));

        case 'v':
          return new ImmutableViewRef(refValue);

        default:
          throw new Error(`Invalid hacky ref type: "${field}"`);
      }
    }

    return new ImmutableRef(field);
  }

  switch (field.get('type')) {
    case 'value':
      return new ImmutableRef(field.get('value'));

    case 'view':
      return new ImmutableViewRef(Types.parseField(
        Types.VIEW,
        field.get('view')
      ));

    case 'list':
      const refValue = field.get('value');
      switch (refValue.get('type')) {
        case 'find': 
          return new ImmutableListFindRef(
            Types.parseField(
              Types.VIEW,
              refValue.get('finder')
            )
          );

        case 'filter':
          return new ImmutableListFilterRef(
            Types.parseField(
              Types.VIEW,
              refValue.get('filter')
            )
          );

        case 'map':
          return new ImmutableListMapRef(
            Types.parseField(
              Types.VIEW,
              refValue.get('mapper')
            )
          );

        default:
          throw new Error(`Unknown list ref type "${refValue.get('type')}"`);
      }

    default:
      throw new Error(`Unknown ref type "${field.get('type')}"`);
  }
}

function createMappyViewType(refValue) {
  return new Types.view.data({
    label: refValue,
    ref: parseRef(refValue)
  });
}

function createTruthyViewType(refValue) {
  const [ref, value] = refValue.split('=');

  return new Types.view.condition({
    label: `${ref}=${value}`,
    op: '=',
    args: [
      createMappyViewType(ref),
      new Types.view.value({value})
    ],
    trueType: new Types.view.value({value: true}),
    falseType: new Types.view.value({value: false})
  });
}

export class Ref {
  getValue() {
    throw new Error('Abstract function');
  }

  getDisplay() {
    throw new Error('go away');
  }

  toString() {
    return this.getDisplay();
  }

  equals() {
    return false;
  }

  hashCode() {
    return 0;
  }
}

export class ImmutableRef extends Ref {
  constructor(ref) {
    super();
    this.ref = ref;
  }

  isListRef() {
    return false;
  }

  isSingleRef() {
    return true;
  }

  isMultiRef() {
    return !this.isSingleRef();
  }

  getValue(dataType, dataValue, renderOptions) {
    if (!dataValue) {
      return null;
    }

    if (!this.ref) {
      return dataValue;
    }

    return dataValue.get(this.ref);
  }

  setValue(dataType, dataValue, childValue, renderOptions) {
    if (!dataValue) {
      throw new Error(`Cannot set value for on a null object: (with ${this.getDisplay})`);
    }

    if (!this.ref) {
      return dataValue;
    }

    return dataValue.set(this.ref, childValue);
  }

  getDisplay() {
    return this.ref;
  }

  equals(other) {
    return this.ref == other.ref;
  }

  hashCode() {
    return Immutable.hash(this.ref);
  }
}

export class ImmutableViewRef extends ImmutableRef {
  constructor(view) {
    super();
    this.view = view;
  }

  getValue(dataType, dataValue, renderOptions) {
    if (!dataValue) {
      return null;
    }

    if (!this.view) {
      return dataValue;
    }

    const renderData = new RenderData(dataType, dataValue, renderOptions);
    return valueRenderers.getValue(this.view, renderData)
  }

  setValue() {
    throw new Error('Not yet implemented');
  }

  getDisplay() {
    return this.view.getLabel();
  }

  equals(other) {
    return this.view.uniqueId == other.view.uniqueId;
  }

  hashCode() {
    return Immutable.hash(this.view.uniqueId);
  }
}

export class ImmutableListRef extends ImmutableRef {
  constructor(view) {
    super();
    this.view = view;
  }

  isListRef() {
    return true;
  }

  isFinder() {
    return false;
  }

  isFilterer() {
    return false;
  }

  isMapper() {
    return false;
  }

  checkValidData(dataType, dataValue) {
    if (!dataType instanceof Types.data.list) {
      throw new Error(`Cannot reference a list with a non-list based data type "${dataType}"`);
    }

    if (!dataValue || !Immutable.isImmutable(dataValue)) {
      throw new Error(`Cannot reference a non-list with a list ref of ${this.view}`);
    }
  }

  getDisplay() {
    return this.view.getLabel();
  }

  applyView(itemType, item, renderOptions) {
    const renderData = new RenderData(itemType, item, renderOptions);
    return valueRenderers.getValue(this.view, renderData);
  }

  getValue(listType, list, renderOptions) {
    this.checkValidData(listType, list);
    
    if (!this.constructor.method) {
      return list;
    }

    const itemType = listType.getItemType();
    return list[this.constructor.method](
      (item, index) => this.applyView(itemType, item, renderOptions)
    );
  }

  setValue(listType, list, newItem, renderOptions) {
    if (List.isList(newItem)) {
      console.warn('Setting each list item to be a list. This may be due to using multiple list refs which is currently unimplemented');
    }

    return list.map(() => newItem);
  }

  equals(other) {
    return this.view.uniqueId == other.view.uniqueId;
  }

  hashCode() {
    return Immutable.hash(this.view.uniqueId);
  }
}

export class ImmutableListFindRef extends ImmutableListRef {
  static method = 'find';

  isFinder() {
    return true;
  }

  setValue(listType, list, newItem, renderOptions) {
    const itemType = listType.getItemType();
    const index = list
      .findIndex(item => {
        const renderData = new RenderData(itemType, item, renderOptions);
        return valueRenderers.getValue(this.view, renderData);
      });

    if (index >= 0) {
      return list.set(index, newItem);
    } else {
      return list.push(newItem);
    }
  }
}

export class ImmutableListFilterRef extends ImmutableListRef {
  static method = 'filter'

  isSingleRef() {
    return false;
  }

  isFilterer() {
    return true;
  }

  setValue(listType, list, newItem, renderOptions) {
    if (List.isList(newItem)) {
      console.warn('Setting each list item to be a list. This may be due to using multiple list refs which is currently unimplemented');
    }

    const itemType = listType.getItemType();

    const indexes = list
      .map((item, index) => [
        index,
        item
      ])
      .filter(([index, item]) => {
        const renderData = new RenderData(itemType, item, renderOptions);
        return valueRenderers.getValue(this.view, renderData);
      })
      .map(([index, item]) => index);

    return list
      .map((item, index) => indexes.includes(index) ?
        newItem :
        index
      );
  }
}

export class ImmutableListMapRef extends ImmutableListRef {
  static method = 'map'

  isSingleRef() {
    return false;
  }

  isMapper() {
    return true;
  }

  setValue(listType, list, newItem) {
    throw new Error('Not yet implemented');
  }
}


/**
Copyright (c) 2015 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
**/

require("../base/guid.js");
require("../base/iteration_helpers.js");
require("../base/utils.js");
require("./diagnostics/diagnostic_map.js");

'use strict';

global.tr.exportTo('tr.v', function() {
  /** @constructor */
  function Value(name, opt_options) {
    if (typeof(name) !== 'string')
      throw new Error('name must be a string');

    this.name_ = name;

    // If this Value is being deserialized, then its guid will be set by
    // fromDict().
    // If this Value is being computed by a metric, then its guid will be
    // allocated the first time the guid is gotten by asDict().
    this.guid_ = undefined;

    this.diagnostics = new tr.v.d.DiagnosticMap();

    var options = opt_options || {};
    this.description = options.description;
    this.important = options.important !== undefined ?
        options.important : false;
  }

  Value.fromDict = function(d) {
    var value = undefined;
    switch (d.type) {
      case 'numeric':
        value = NumericValue.fromDict(d);
        break;

      case 'dict':
        value = DictValue.fromDict(d);
        break;

      case 'failure':
        value = FailureValue.fromDict(d);
        break;

      case 'skip':
        value = SkipValue.fromDict(d);
        break;

      default:
        throw new Error('Not implemented');
    }

    value.guid = d.guid;
    value.diagnostics.addDicts(d.diagnostics);
    return value;
  };

  Value.prototype = {
    get guid() {
      if (this.guid_ === undefined)
        this.guid_ = tr.b.GUID.allocateUUID4();

      return this.guid_;
    },

    set guid(guid) {
      if (this.guid_ !== undefined)
        throw new Error('Cannot reset guid');

      this.guid_ = guid;
    },

    get name() {
      return this.name_;
    },

    asDict: function() {
      return this.asJSON();
    },

    asJSON: function() {
      var d = {
        guid: this.guid,
        name: this.name_,
        description: this.description,
        important: this.important,
        diagnostics: this.diagnostics.asDict()
      };

      this.asDictInto_(d);
      if (d.type === undefined)
        throw new Error('asDictInto_ must set type field');
      return d;
    },

    asDictInto_: function(d) {
      throw new Error('Not implemented');
    }
  };

  /** @constructor */
  function NumericValue(name, numeric, opt_options) {
    if (!(numeric instanceof tr.v.NumericBase))
      throw new Error('Expected numeric to be instance of tr.v.NumericBase');

    Value.call(this, name, opt_options);
    this.numeric = numeric;
  }

  NumericValue.fromDict = function(d) {
    if (d.numeric === undefined)
      throw new Error('Expected numeric to be provided');
    var numeric = tr.v.NumericBase.fromDict(d.numeric);
    var value = new NumericValue(d.name, numeric, d);
    return value;
  };

  NumericValue.prototype = {
    __proto__: Value.prototype,

    merge: function(other) {
      if (!(other instanceof NumericValue))
        throw new Error('Merging non-NumericValues is not supported');

      var numeric = this.numeric.merge(other.numeric);
      var result = new NumericValue(this.name, numeric);
      // TODO(eakuefner): merge diagnostics?
      return result;
    },

    asDictInto_: function(d) {
      d.type = 'numeric';
      d.numeric = this.numeric.asDict();
    }
  };

  /** @constructor */
  function DictValue(name, value, opt_options) {
    Value.call(this, name, opt_options);
    this.value = value;
  }

  DictValue.fromDict = function(d) {
    if (d.units !== undefined)
      throw new Error('Expected units to be undefined');
    if (d.value === undefined)
      throw new Error('Expected value to be provided');
    var value = new DictValue(d.name, d.value, d);
    return value;
  };

  DictValue.prototype = {
    __proto__: Value.prototype,

    asDictInto_: function(d) {
      d.type = 'dict';
      d.value = this.value;
    }
  };

  /** @constructor */
  function FailureValue(name, opt_options) {
    var options = opt_options || {};

    var stack;
    if (options.stack === undefined) {
      if (options.stack_str === undefined) {
        throw new Error('Expected stack_str or stack to be provided');
      } else {
        stack = options.stack_str;
      }
    } else {
      stack = options.stack;
    }

    if (typeof stack !== 'string')
      throw new Error('stack must be provided as a string');

    Value.call(this, name, options);
    this.stack = stack;
  }

  FailureValue.fromError = function(e) {
    var ex = tr.b.normalizeException(e);
    return new FailureValue(ex.typeName, {
      description: ex.message, stack: ex.stack});
  };

  FailureValue.fromDict = function(d) {
    if (d.units !== undefined)
      throw new Error('Expected units to be undefined');
    if (d.stack_str === undefined)
      throw new Error('Expected stack_str to be provided');
    return new FailureValue(d.name, d);
  };

  FailureValue.prototype = {
    __proto__: Value.prototype,

    asDictInto_: function(d) {
      d.type = 'failure';
      d.stack_str = this.stack;
    }
  };

  /** @constructor */
  function SkipValue(name, opt_options) {
    Value.call(this, name, opt_options);
  }

  SkipValue.fromDict = function(d) {
    if (d.units !== undefined)
      throw new Error('Expected units to be undefined');
    return new SkipValue(d.name, d);
  };

  SkipValue.prototype = {
    __proto__: Value.prototype,

    asDictInto_: function(d) {
      d.type = 'skip';
    }
  };


  return {
    Value: Value,
    NumericValue: NumericValue,
    DictValue: DictValue,
    FailureValue: FailureValue,
    SkipValue: SkipValue
  };
});

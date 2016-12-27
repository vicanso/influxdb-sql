'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var internal = require('./internal');
var util = require('util');

function getParam(args, is, defaultValue) {
  var result = void 0;
  args.forEach(function (v) {
    if (!util.isUndefined(result)) {
      return;
    }
    if (is(v)) {
      result = v;
    }
  });
  if (util.isUndefined(result)) {
    result = defaultValue;
  }
  return result;
}

function getTimeCondition(time, type) {
  var timeDesc = '';
  if (time.charAt(0) === '-') {
    timeDesc = 'now() - ' + time.substring(1);
  } else if (/\d{4}-\d{2}-\d{2}/.test(time)) {
    timeDesc = '\'' + time + '\'';
  } else {
    timeDesc = time;
  }
  return 'time ' + type + ' ' + timeDesc;
}

function addToArray(arr, args) {
  /* istanbul ignore else */
  if (args && args.length) {
    /* eslint prefer-spread:0 */
    arr.push.apply(arr, args);
  }
}

function removeFromArray(arr, args) {
  return arr.filter(function (item) {
    return args.indexOf(item) === -1;
  });
}

function convert(field) {
  var f = field.toLowerCase();
  var digitReg = /^[0-9]/;
  var reg = /[^a-z0-9_]/;
  /* istanbul ignore else */
  if (digitReg.test(f) || reg.test(f)) {
    return '"' + field + '"';
  }
  return field;
}

function convertKey(key) {
  if (!util.isString(key)) {
    return key;
  }
  // key + x
  if (key.indexOf('+') !== -1) {
    return key;
  }
  return '"' + key + '"';
}

function isRegExp(value) {
  return value.length > 2 && value.charAt(0) === '/' && value.charAt(value.length - 1) === '/';
}

function convertConditionValue(value) {
  if (util.isString(value) && !isRegExp(value)) {
    return '\'' + value + '\'';
  }
  return value;
}

function convertGroupValue(value) {
  var reg = /time\(\S+\)/;
  if (value === '*' || value.match(reg)) {
    return value;
  }
  return '"' + value + '"';
}

function convertMeasurement(measurement) {
  if (measurement.charAt(0) === ':' || isRegExp(measurement)) {
    return measurement;
  }
  return '"' + measurement + '"';
}

function getRelation(args, defaultValue) {
  var result = '';
  args.forEach(function (arg) {
    if (!util.isString(arg)) {
      return;
    }
    var lowArg = arg.toLowerCase();
    if (lowArg === 'and' || lowArg === 'or') {
      result = lowArg;
    }
  });
  return result || defaultValue || 'and';
}

function getOperator(args, defaultValue) {
  var result = '';
  args.forEach(function (arg) {
    if (!util.isString(arg)) {
      return;
    }
    var lowArg = arg.toLowerCase();
    if (lowArg !== 'and' && lowArg !== 'or') {
      result = lowArg;
    }
  });
  return result || defaultValue || '=';
}

function getConditions(data, operator, relation) {
  if (util.isString(data)) {
    var reg = /\sand\s|\sor\s/i;
    if (reg.test(data)) {
      return '(' + data + ')';
    }
    return data;
  }
  var keys = Object.keys(data);
  var arr = keys.map(function (k) {
    var key = convertKey(k);
    var v = data[k];
    if (util.isArray(v)) {
      var tmpArr = v.map(function (tmp) {
        return key + ' ' + operator + ' ' + convertConditionValue(tmp);
      });
      return '(' + tmpArr.join(' or ') + ')';
    }
    var value = convertConditionValue(v);
    return key + ' ' + operator + ' ' + value;
  });
  if (arr.length > 1) {
    var joinKey = ' ' + relation + ' ';
    return '(' + arr.join(joinKey) + ')';
  }
  return arr.join('');
}

function getFrom(data) {
  var arr = [];
  if (data.db) {
    arr.push('"' + data.db + '"');
    if (data.rp) {
      arr.push('"' + data.rp + '"');
    }
  }
  if (data.measurement) {
    if (!data.rp && data.db) {
      arr.push('');
    }
    arr.push(convertMeasurement(data.measurement));
  }
  return 'from ' + arr.join('.');
}

function getInto(data) {
  var arr = [];
  if (data.intoDB) {
    arr.push('"' + data.intoDB + '"');
    if (data.intoRP) {
      arr.push('"' + data.intoRP + '"');
    } else {
      arr.push('');
    }
  }
  arr.push(convertMeasurement(data.into));
  return 'into ' + arr.join('.');
}

function getQL(data) {
  var arr = [];
  arr.push(getFrom(data));

  var conditions = data.conditions.slice();
  var groups = data.groups;
  if (data.start) {
    conditions.push(getTimeCondition(data.start, '>='));
  }
  if (data.end) {
    conditions.push(getTimeCondition(data.end, '<='));
  }

  if (conditions.length) {
    var joinKey = ' ' + data.relation + ' ';
    arr.push('where ' + conditions.sort().join(joinKey));
  }

  if (groups && groups.length) {
    arr.push('group by ' + groups.sort().map(convertGroupValue).join(','));

    if (!util.isNullOrUndefined(data.fill)) {
      arr.push('fill(' + data.fill + ')');
    }
  }

  if (data.order) {
    arr.push('order by time ' + data.order);
  }

  if (data.limit) {
    arr.push('limit ' + data.limit);
  }

  if (data.slimit) {
    arr.push('slimit ' + data.slimit);
  }

  if (data.offset) {
    arr.push('offset ' + data.offset);
  }

  if (data.soffset) {
    arr.push('soffset ' + data.soffset);
  }

  return arr.join(' ');
}

function showKeys(type, measurement) {
  var ql = 'show ' + type + ' keys';
  if (measurement) {
    ql = ql + ' from "' + measurement + '"';
  }
  return ql;
}

/**
 * Influx QL
 *
 * @example
 * const QL = require('influx-ql');
 * const ql = new QL('mydb');
 * ql.measurement = 'http';
 * ql.RP = 'two-weeks';
 * ql.addField('status', 'spdy', 'fetch time');
 * ql.start = '2016-01-01';
 * ql.end = '-3h';
 * ql.limit = 10;
 * ql.order = 'desc';
 * ql.offset = 10;
 * ql.addGroup('spdy');
 * ql.condition('code', 400);
 * ql.condition('use', 30, '<=');
 * ql.fill = 0;
 * console.info(ql.toSelect());
 */

var QL = function () {
  function QL(db) {
    _classCallCheck(this, QL);

    var data = internal(this);
    data.fields = [];
    data.conditions = [];
    data.functions = [];
    data.groups = [];
    data.rp = '';
    data.intoRP = '';
    data.db = db;
    data.relation = 'and';
  }

  _createClass(QL, [{
    key: 'addField',

    // CQ END

    /**
     * Add the field of the query result
     * @param  {String} field - field's name
     * @return QL
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addField('status', 'spdy', 'fetch time');
     * console.info(ql.toSelect());
     * // => select "fetch time","spdy","status" from "mydb".."http"
     */
    value: function addField() {
      var args = Array.from(arguments);
      addToArray(internal(this).fields, args);
      return this;
    }
    /**
     * Remove the field of the query result
     * @param  {String} field - field's name
     * @return QL
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addField('status', 'spdy', 'fetch time');
     * ql.removeField('status');
     * console.info(ql.toSelect());
     * // => select "fetch time","spdy" from "mydb".."http"
     */

  }, {
    key: 'removeField',
    value: function removeField() {
      var data = internal(this);
      data.fields = removeFromArray(data.fields, Array.from(arguments));
      return this;
    }

    /**
     * Remove all fields of the query result
     * @return QL
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addField('status', 'spdy', 'fetch time');
     * ql.emptyFields();
     * console.info(ql.toSelect());
     * // => select * from "mydb".."http"
     */

  }, {
    key: 'emptyFields',
    value: function emptyFields() {
      var data = internal(this);
      data.fields.length = 0;
      return this;
    }

    /**
     * Add the influx ql where condition
     * @param  {String} key   - the condition key
     * @param  {String} value - the condition value
     * @param  {String} relation - the multi condition relation
     * @param  {String} operator - the conditon operator, default is '='
     * @return {QL}
     * @since 2.0.0
     * @example
     * const ql = new QL();
     * ql.measurement = 'http';
     * ql.condition({
     *   code: 500,
     *   spdy: '1',
     * });
     * console.info(ql.toSelect());
     * // => select * from "http" where ("code" = 500 and "spdy" = '1')
     * @example
     * const ql = new QL();
     * ql.measurement = 'http';
     * ql.condition('spdy', ['1', '2']);
     * console.info(ql.toSelect());
     * // => select * from "mydb".."http" where ("spdy" = '1' or "spdy" = '2')
     * @example
     * const ql = new QL();
     * ql.measurement = 'http';
     * ql.condition({
     *   code: 500,
     *   spdy: '1',
     * }, '!=');
     * console.info(ql.toSelect());
     * // => select * from "http" where ("code" != 500 and "spdy" != '1')
     */

  }, {
    key: 'condition',
    value: function condition(key, value, rlt, op) {
      var data = key;
      var args = [rlt, op];
      if (util.isObject(key)) {
        args = [value, rlt];
      } else if (value) {
        data = {};
        data[key] = value;
      }

      var relation = getRelation(args);
      var operator = getOperator(args);

      var condition = getConditions(data, operator, relation);
      addToArray(internal(this).conditions, [condition]);
      return this;
    }

    /**
     * Empty the influx ql where condition
     * @return {QL}
     * @since 2.0.0
     * @example
     * const ql = new QL();
     * ql.measurement = 'http';
     * ql.condition({
     *   code: 500,
     *   spyd: '1',
     * });
     * console.info(ql.toSelect());
     * // => select * from "http" where ("code" = 500 and "spdy" = '1')
     * ql.emptyConditions();
     * console.info(ql.toSelect());
     * // => select * from "http"
     */

  }, {
    key: 'emptyConditions',
    value: function emptyConditions() {
      internal(this).conditions.length = 0;
      return this;
    }

    /**
     * Add influx ql function
     * @param {String} type  - function name
     * @param {Any} field - function param
     * @param {Any} field - function param
     * @return {QL}
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addFunction('count', 'use');
     * ql.addFunction('mean', 'use');
     * ql.addGroup('spdy');
     * console.info(ql.toSelect());
     * // => select count("use"),mean("use") from "mydb".."http" group by "spdy"
     * @example
     * // version 2.0.1
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addFunction("bottom", 'use', 3);
     * console.info(ql.toSelect());
     * // => select bottom("use",3) from "mydb".."http"
     * * @example
     * // version 2.0.3
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addFunction('count("use")');
     * console.info(ql.toSelect());
     * // => select count("use") from "mydb".."http"
     */

  }, {
    key: 'addFunction',
    value: function addFunction() {
      var args = Array.from(arguments);
      var functions = internal(this).functions;
      if (args.length >= 2) {
        var type = args.shift();
        var arr = args.map(convertKey);
        functions.push(type + '(' + arr.join(',') + ')');
      } else {
        functions.push(args[0]);
      }
      return this;
    }

    /**
     * Remove influx ql function
     * @param {String} type  - function name
     * @param {Any} field - function param
     * @return {QL}
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addFunction('count', 'use');
     * ql.addFunction('mean', 'use');
     * ql.removeFunction('count', 'use');
     * ql.addGroup('spdy');
     * console.info(ql.toSelect());
     * // => select mean("use") from "mydb".."http" group by "spdy"
     */

  }, {
    key: 'removeFunction',
    value: function removeFunction(type, field) {
      if (type && field) {
        var data = internal(this);
        data.functions = removeFromArray(data.functions, type + '(' + convertKey(field) + ')');
      }
      return this;
    }

    /**
     * Remove all influx ql functions
     * @return {QL}
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addFunction('count', 'use');
     * ql.addFunction('mean', 'use');
     * ql.emptyFunctions();
     * ql.addGroup('spdy');
     * console.info(ql.toSelect());
     * // => select * from "mydb".."http" group by "spdy"
     */

  }, {
    key: 'emptyFunctions',
    value: function emptyFunctions() {
      internal(this).functions.length = 0;
      return this;
    }

    /**
     * Add influx ql group by
     * @param {String} tag - tag's name
     * @return {QL}
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addGroup('spdy', 'method');
     * ql.addFunction('count', 'use');
     * console.info(ql.toSelect());
     * // => select count("use") from "mydb".."http" group by "method","spdy"
     */

  }, {
    key: 'addGroup',
    value: function addGroup() {
      var args = Array.from(arguments);
      addToArray(internal(this).groups, args);
      return this;
    }

    /**
     * Remove influx ql group by
     * @param {String} tag - tag's name
     * @return {QL}
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addGroup('spdy', 'method');
     * ql.removeGroup('spdy')
     * ql.addFunction('count', 'use');
     * console.info(ql.toSelect());
     * // => select count("use") from "mydb".."http" group by "method"
     */

  }, {
    key: 'removeGroup',
    value: function removeGroup() {
      var args = Array.from(arguments);
      var data = internal(this);
      data.groups = removeFromArray(data.groups, args);
      return this;
    }

    /**
     * Empty influx ql group by
     * @return {QL}
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addGroup('spdy', 'method');
     * ql.emptyGroups();
     * console.info(ql.toSelect());
     * // => select * from "mydb".."http"
     */

  }, {
    key: 'emptyGroups',
    value: function emptyGroups() {
      var data = internal(this);
      data.groups.length = 0;
      return this;
    }

    /**
     * Get the influx select ql
     * @return {String}
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.RP = 'two-weeks';
     * ql.addField('status', 'spdy', 'fetch time');
     * ql.start = '2016-01-01';
     * ql.end = '-3h';
     * ql.limit = 10;
     * ql.order = 'desc';
     * ql.offset = 10;
     * ql.addGroup('spdy');
     * ql.condition('code', 400);
     * ql.condition('use', 30, '<=');
     * ql.fill = 0;
     * console.info(ql.toSelect());
     */

  }, {
    key: 'toSelect',
    value: function toSelect() {
      var data = internal(this);
      var arr = ['select'];
      var fields = data.fields;
      var functions = data.functions;
      var selectFields = [];
      if (functions && functions.length) {
        functions.sort().forEach(function (item) {
          return selectFields.push(item);
        });
      }
      if (fields && fields.length) {
        fields.sort().map(convertKey).forEach(function (item) {
          return selectFields.push(item);
        });
      }
      if (selectFields.length) {
        arr.push(selectFields.join(','));
      } else {
        arr.push('*');
      }

      if (data.into) {
        arr.push(getInto(data));
      }

      arr.push(getQL(data));

      return arr.join(' ');
    }
  }, {
    key: 'toCQ',
    value: function toCQ() {
      var data = internal(this);
      var arr = ['create continuous query ' + convert(data.cqName) + ' on "' + data.db + '"'];

      if (data.cqEvery || data.cqFor) {
        arr.push('resample');
        if (data.cqEvery) {
          arr.push('every ' + data.cqEvery);
        }
        if (data.cqFor) {
          arr.push('for ' + data.cqFor);
        }
      }

      arr.push('begin ' + this.toSelect() + ' end');

      return arr.join(' ');
    }
  }, {
    key: 'database',
    set: function set(v) {
      internal(this).db = v;
      return this;
    },
    get: function get() {
      return internal(this).db;
    }
  }, {
    key: 'intoDatabase',
    set: function set(v) {
      internal(this).intoDB = v;
      return this;
    },
    get: function get() {
      return internal(this).intoDB;
    }

    /**
     * Set influx ql retention policy
     * @param {String} rp - The reten retention policy
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.RP = 'two-weeks';
     * console.info(ql.toSelect());
     * // => select * from "mydb"."two-weeks"."http"
     */

  }, {
    key: 'RP',
    set: function set(rp) {
      internal(this).rp = rp;
    }
    /**
     * Get influx ql retention policy
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.RP = 'two-weeks';
     * console.info(ql.RP);
     * // => two-weeks
     */
    ,
    get: function get() {
      return internal(this).rp;
    }
  }, {
    key: 'intoRP',
    set: function set(v) {
      internal(this).intoRP = v;
      return this;
    },
    get: function get() {
      return internal(this).intoRP;
    }

    /**
     * Set influx ql measurement
     * @param  {String} measurement - The measurement's name
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * console.info(ql.toSelect());
     * // => select * from "mydb".."http"
     */

  }, {
    key: 'measurement',
    set: function set(measurement) {
      internal(this).measurement = measurement;
    }

    /**
     * Get influx ql measurement
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * console.info(ql.measurement);
     * // => 'http'
     */
    ,
    get: function get() {
      return internal(this).measurement;
    }

    /**
     * Set influx ql start time
     * @param  {String} start - start time
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.start = '-3h';
     * console.info(ql.toSelect());
     * // => select * from "mydb".."http" where time >= now() - 3h
     */

  }, {
    key: 'start',
    set: function set(start) {
      internal(this).start = start;
    }

    /**
     * Get influx ql start time
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.start = '-3h';
     * console.info(ql.start);
     * // => '-3h';
     */
    ,
    get: function get() {
      return internal(this).start;
    }

    /**
     * Set influx ql end time
     * @param  {String} end - end time
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.end = '-1h';
     * console.info(ql.toSelect());
     * // => select * from "mydb".."http" where time <= now() - 1h
     */

  }, {
    key: 'end',
    set: function set(v) {
      internal(this).end = v;
    }

    /**
     * Get influx ql end time
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.end = '-1h';
     * console.info(ql.end);
     * // => '-1h';
     */
    ,
    get: function get() {
      return internal(this).end;
    }

    /**
     * Set influx ql query result point limit
     * @param  {Integer} limit - the result point limit
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.limit = 10;
     * console.info(ql.toSelect());
     * // => select * from "mydb".."http" limit 10
     */

  }, {
    key: 'limit',
    set: function set(limit) {
      internal(this).limit = limit;
    }

    /**
     * Get influx ql query result point limit
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.limit = 10;
     * console.info(ql.limit);
     * // => 10
     */
    ,
    get: function get() {
      return internal(this).limit;
    }

    /**
     * Set influx query result series limit
     * @param  {Integer} slimit - the result series limit
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.slimit = 3;
     * console.info(ql.toSelect());
     * // => select * from "mydb" slimit 3
     */

  }, {
    key: 'slimit',
    set: function set(slimit) {
      internal(this).slimit = slimit;
      return this;
    }

    /**
     * Get influx query result series limit
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.slimit = 3;
     * console.info(ql.slimit);
     * // => 3
     */
    ,
    get: function get() {
      return internal(this).slimit;
    }

    /**
     * Set the influx query result fill value for time intervals that have no data
     * @param  {String | Number} fill - fill value, special value: linear none null previous.
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addGroup('spdy');
     * ql.fill = 0;
     * console.info(ql.toSelect());
     * // => select * from "mydb".."http" group by "spdy" fill(0)
     */

  }, {
    key: 'fill',
    set: function set(fill) {
      internal(this).fill = fill;
    }

    /**
     * Get the influx query result fill value for time intervals that have no data
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addGroup('spdy');
     * ql.fill = 0;
     * console.info(ql.fill);
     * // => 0
     */
    ,
    get: function get() {
      return internal(this).fill;
    }
  }, {
    key: 'into',
    set: function set(v) {
      internal(this).into = v;
      return this;
    },
    get: function get() {
      return internal(this).into;
    }

    /**
     * Set the influx query result order of time
     * @param  {String} order - 'desc' or 'asc'
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addGroup('spdy');
     * ql.order = 'desc';
     * console.info(ql.toSelect());
     * // => select * from "mydb".."http" group by "spdy" order by time desc
     */

  }, {
    key: 'order',
    set: function set(order) {
      internal(this).order = order;
    }

    /**
     * Get the influx query result order of time
     * @param  {String} order - 'desc' or 'asc'
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.addGroup('spdy');
     * console.info(ql.order);
     * // => undefined
     * ql.order = 'desc';
     * // => 'desc'
     */
    ,
    get: function get() {
      return internal(this).order;
    }

    /**
     * Set influx ql query offset of the result
     * @param  {Integer} offset - offset value
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * ql.offset = 10;
     * console.info(ql.toSelect());
     * // => select * from "mydb".."http" offset 10
     */

  }, {
    key: 'offset',
    set: function set(v) {
      internal(this).offset = v;
    }

    /**
     * Get influx ql query offset of the result
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.measurement = 'http';
     * console.info(ql.offset);
     * // => 0
     * ql.offset = 10;
     * console.info(ql.offset);
     * // => 10
     */
    ,
    get: function get() {
      return internal(this).offset || 0;
    }

    /**
     * Set influx ql offset series in the query results
     * @param  {Integer} soffset - soffset value
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * ql.soffset = 10;
     * console.info(ql.toSelect());
     * // => select * from "mydb" soffset 10
     */

  }, {
    key: 'soffset',
    set: function set(soffset) {
      internal(this).soffset = soffset;
    }

    /**
     * Get influx ql offset series in the query results
     * @return {Integer}
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * console.info(ql.soffset);
     * // => 0
     * ql.soffset = 10;
     * console.info(ql.soffset);
     * // => 10
     */
    ,
    get: function get() {
      return internal(this).soffset || 0;
    }

    /**
     * Get influx ql default where relation
     * @return {String}
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * console.info(ql.relation);
     * // => 'and'
     */

  }, {
    key: 'relation',
    get: function get() {
      return internal(this).relation;
    }

    /**
     * Set influx ql default where relation
     * @param  {String} relation - the default relation
     * @since 2.0.0
     * @example
     * const ql = new QL('mydb');
     * console.info(ql.relation);
     * // => and
     * ql.relation = 'or';
     * console.info(ql.relation);
     * // => or
     */
    ,
    set: function set(relation) {
      internal(this).relation = relation;
    }

    // CQ BEGIN

  }, {
    key: 'cqName',
    set: function set(v) {
      internal(this).cqName = v;
      return this;
    },
    get: function get() {
      return internal(this).cqName;
    }
  }, {
    key: 'cqEvery',
    set: function set(v) {
      internal(this).cqEvery = v;
      return this;
    },
    get: function get() {
      return internal(this).cqEvery;
    }
  }, {
    key: 'cqFor',
    set: function set(v) {
      internal(this).cqFor = v;
      return this;
    },
    get: function get() {
      return internal(this).cqFor;
    }
  }], [{
    key: 'createDatabase',
    value: function createDatabase(db) {
      return 'create database ' + convert(db);
    }
  }, {
    key: 'createDatabaseNotExists',
    value: function createDatabaseNotExists(db) {
      return 'create database if not exists ' + convert(db);
    }
  }, {
    key: 'dropDatabase',
    value: function dropDatabase(db) {
      return 'drop database ' + convert(db);
    }
  }, {
    key: 'showDatabases',
    value: function showDatabases() {
      return 'show databases';
    }
  }, {
    key: 'showRetentionPolicies',
    value: function showRetentionPolicies(db) {
      return 'show retention policies on ' + convert(db);
    }
  }, {
    key: 'showMeasurements',
    value: function showMeasurements() {
      return 'show measurements';
    }
  }, {
    key: 'showTagKeys',
    value: function showTagKeys(measurement) {
      return showKeys('tag', measurement);
    }
  }, {
    key: 'showFieldKeys',
    value: function showFieldKeys(measurement) {
      return showKeys('field', measurement);
    }
  }, {
    key: 'showSeries',
    value: function showSeries(measurement) {
      var ql = 'show series';
      if (measurement) {
        ql = ql + ' from "' + measurement + '"';
      }
      return ql;
    }
  }, {
    key: 'createRP',
    value: function createRP(name, database, duration, replication, shardDuration, isDefault) {
      if (!name || !database || !duration) {
        throw new Error('name, database and duration can not be null');
      }
      var args = [replication, shardDuration, isDefault];
      var defaultValue = getParam(args, util.isBoolean);
      var rpl = getParam(args, util.isNumber, 1);
      var shdDuration = getParam(args, util.isString);
      var arr = ['create retention policy "' + name + '" on "' + database + '"'];
      if (duration) {
        arr.push('duration ' + duration);
      }
      if (rpl) {
        arr.push('replication ' + rpl);
      }
      if (shdDuration) {
        arr.push('shard duration ' + shdDuration);
      }
      if (defaultValue) {
        arr.push('default');
      }
      return arr.join(' ');
    }
  }, {
    key: 'dropRP',
    value: function dropRP(name, database) {
      return 'drop retention policy "' + name + '" on "' + database + '"';
    }
  }, {
    key: 'updateRP',
    value: function updateRP(name, database, duration, replication, shardDuration, isDefault) {
      if (!name || !database) {
        throw new Error('name and database can not be null');
      }
      var args = [replication, shardDuration, isDefault];
      var defaultValue = getParam(args, util.isBoolean);
      var rpl = getParam(args, util.isNumber);
      var shdDuration = getParam(args, util.isString);
      var arr = ['alter retention policy "' + name + '" on "' + database + '"'];
      if (duration && duration !== '0') {
        arr.push('duration ' + duration);
      }
      if (rpl) {
        arr.push('replication ' + rpl);
      }
      if (shdDuration) {
        arr.push('shard duration ' + shdDuration);
      }
      if (defaultValue) {
        arr.push('default');
      }
      return arr.join(' ');
    }
  }]);

  return QL;
}();

module.exports = QL;
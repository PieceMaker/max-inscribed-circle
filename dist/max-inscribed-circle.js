(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.maxInscribedCircle = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var distance = require('turf-distance');
var point = require('turf-point');
var linestring = require('turf-linestring');
var bearing = require('turf-bearing');
var destination = require('turf-destination');

/**
 * Takes a Point and a LineString and calculates the closest Point on the LineString
 *
 * @module turf/point-on-line
 *
 * @param {LineString} Line to snap to
 * @param {Point} Point to snap from
 * @return {Point} Closest Point on the Line
 * @example
 * var line = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "LineString",
 *     "coordinates": [
 *       [-77.031669, 38.878605],
 *       [-77.029609, 38.881946],
 *       [-77.020339, 38.884084],
 *       [-77.025661, 38.885821],
 *       [-77.021884, 38.889563],
 *       [-77.019824, 38.892368]
 *     ]
 *   }
 * };
 * var pt = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-77.037076, 38.884017]
 *   }
 * };
 * 
 * var snapped = turf.pointOnLine(line, pt);
 * snapped.properties['marker-color'] = '#00f'
 *
 * var result = {
 *   "type": "FeatureCollection",
 *   "features": [line, pt, snapped]
 * };
 *
 * //=result
 */

module.exports = function (line, pt) {  
  var coords;
  if(line.type === 'Feature') coords = line.geometry.coordinates;
  else if(line.type === 'LineString') coords = line.geometry.coordinates;
  else throw new Error('input must be a LineString Feature or Geometry');

  return pointOnLine(pt, coords);
};

function pointOnLine (pt, coords) {
  var units = 'miles';
  var closestPt = point([Infinity, Infinity], {dist: Infinity});
  for(var i = 0; i < coords.length - 1; i++) {
    var start = point(coords[i]);
    var stop = point(coords[i+1]);
    //start
    start.properties.dist = distance(pt, start, units);
    //stop
    stop.properties.dist = distance(pt, stop, units);
    //perpendicular
    var direction = bearing(start, stop);
    var perpendicularPt = destination(pt, 1000 , direction + 90, units); // 1000 = gross
    var intersect = lineIntersects(
      pt.geometry.coordinates[0],
      pt.geometry.coordinates[1],
      perpendicularPt.geometry.coordinates[0],
      perpendicularPt.geometry.coordinates[1],
      start.geometry.coordinates[0],
      start.geometry.coordinates[1],
      stop.geometry.coordinates[0],
      stop.geometry.coordinates[1]
      );
    if(!intersect) {
      perpendicularPt = destination(pt, 1000 , direction - 90, units); // 1000 = gross
      intersect = lineIntersects(
        pt.geometry.coordinates[0],
        pt.geometry.coordinates[1],
        perpendicularPt.geometry.coordinates[0],
        perpendicularPt.geometry.coordinates[1],
        start.geometry.coordinates[0],
        start.geometry.coordinates[1],
        stop.geometry.coordinates[0],
        stop.geometry.coordinates[1]
        );
    }
    perpendicularPt.properties.dist = Infinity;
    var intersectPt;
    if(intersect) {
      var intersectPt = point(intersect);
      intersectPt.properties.dist = distance(pt, intersectPt, units);
    }
    
    if(start.properties.dist < closestPt.properties.dist) {
      closestPt = start;
      closestPt.properties.index = i;
    }
    if(stop.properties.dist < closestPt.properties.dist) {
     closestPt = stop;
     closestPt.properties.index = i;
    }
    if(intersectPt && intersectPt.properties.dist < closestPt.properties.dist){ 
      closestPt = intersectPt;
      closestPt.properties.index = i;
    }
  }
  
  return closestPt;
}

// modified from http://jsfiddle.net/justin_c_rounds/Gd2S2/light/
function lineIntersects(line1StartX, line1StartY, line1EndX, line1EndY, line2StartX, line2StartY, line2EndX, line2EndY) {
  // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
  var denominator, a, b, numerator1, numerator2, result = {
    x: null,
    y: null,
    onLine1: false,
    onLine2: false
  };
  denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
  if (denominator == 0) {
    if(result.x != null && result.y != null) {
      return result;
    } else {
      return false;
    }
  }
  a = line1StartY - line2StartY;
  b = line1StartX - line2StartX;
  numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
  numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
  a = numerator1 / denominator;
  b = numerator2 / denominator;

  // if we cast these lines infinitely in both directions, they intersect here:
  result.x = line1StartX + (a * (line1EndX - line1StartX));
  result.y = line1StartY + (a * (line1EndY - line1StartY));

  // if line1 is a segment and line2 is infinite, they intersect if:
  if (a >= 0 && a <= 1) {
    result.onLine1 = true;
  }
  // if line2 is a segment and line1 is infinite, they intersect if:
  if (b >= 0 && b <= 1) {
    result.onLine2 = true;
  }
  // if line1 and line2 are segments, they intersect if both of the above are true
  if(result.onLine1 && result.onLine2){
    return [result.x, result.y];
  }
  else {
    return false;
  }
}

},{"turf-bearing":9,"turf-destination":11,"turf-distance":12,"turf-linestring":17,"turf-point":19}],2:[function(require,module,exports){
const Voronoi = require('voronoi');
const voronoi = new Voronoi;
const centroid = require('turf-centroid');
const point = require('turf-point');
const pointOnLine = require('./lib/turf-point-on-line/index.js');
const within = require('turf-within');
const makeError = require('make-error');
const NoPointsInShapeError = makeError('NoPointsInShapeError');
const GeoJSONUtils = require('./utils/geojson-utils.js');

/**
 * Takes a polygon feature and estimates the best position for label placement that is guaranteed to be inside the polygon. This uses voronoi to estimate the medial axis.
 *
 * @module turf/label-position
 * @param {Polygon} polygon a Polygon feature of the underlying polygon geometry in EPSG:4326
 * @param decimalPlaces A power of 10 used to truncate the decimal places of the polygon sites and
 *   bbox. This is a workaround due to the issue referred to here:
 *   https://github.com/gorhill/Javascript-Voronoi/issues/15
 *   If left empty, will default to tuncating at 20th decimal place.
 * @returns {Point} a Point feature at the best estimated label position
 */

module.exports = function(polygon, decimalPlaces) {
    polygon = GeoJSONUtils.fixMultiPoly(polygon);
    const polySites = GeoJSONUtils.sites(polygon, decimalPlaces);
    const diagram = voronoi.compute(polySites.sites, polySites.bbox);
    const vertices = {
        type: "FeatureCollection",
        features: []
    };
    //construct GeoJSON object of voronoi vertices
    for(let i = 0; i < diagram.vertices.length; i++) {
        vertices.features.push({
            type: "Feature",
            properties: {},
            geometry: {
                type: "Point",
                coordinates: [diagram.vertices[i].x, diagram.vertices[i].y]
            }
        })
    }
    vertices.features.push(centroid(polygon));
    //within requires a FeatureCollection for input polygons
    const polygonFeatureCollection = {
        type: "FeatureCollection",
        features: [polygon]
    };
    const ptsWithin = within(vertices, polygonFeatureCollection); //remove any vertices that are not inside the polygon
    if(ptsWithin.features.length === 0) {
        throw new NoPointsInShapeError('Neither the centroid nor any Voronoi vertices intersect the shape.');
    }
    const labelLocation = {
        coordinates: [0,0],
        maxDist: 0
    };
    const polygonBoundaries = {
        type: "FeatureCollection",
        features: []
    };
    let vertexDistance;

    //define borders of polygon and holes as LineStrings
    for(let j = 0; j < polygon.geometry.coordinates.length; j++) {
        polygonBoundaries.features.push({
            type: "Feature",
            properties: {},
            geometry: {
                type: "LineString",
                coordinates: polygon.geometry.coordinates[j]
            }
        })
    }

    for(let k = 0; k < ptsWithin.features.length; k++) {
        for(let l = 0; l < polygonBoundaries.features.length; l++) {
            if(l === 0) {
                vertexDistance = pointOnLine(polygonBoundaries.features[l], ptsWithin.features[k]).properties.dist;
            } else {
                vertexDistance = Math.min(vertexDistance,
                    pointOnLine(polygonBoundaries.features[l], ptsWithin.features[k]).properties.dist);
            }
        }
        if(vertexDistance > labelLocation.maxDist) {
            labelLocation.coordinates = ptsWithin.features[k].geometry.coordinates;
            labelLocation.maxDist = vertexDistance;
        }
    }

    return point(labelLocation.coordinates);
};

module.exports.NoPointsInShapeError = NoPointsInShapeError;
},{"./lib/turf-point-on-line/index.js":1,"./utils/geojson-utils.js":25,"make-error":6,"turf-centroid":10,"turf-point":19,"turf-within":20,"voronoi":23}],3:[function(require,module,exports){
var wgs84 = require('wgs84');

module.exports.geometry = geometry;
module.exports.ring = ringArea;

function geometry(_) {
    var area = 0, i;
    switch (_.type) {
        case 'Polygon':
            return polygonArea(_.coordinates);
        case 'MultiPolygon':
            for (i = 0; i < _.coordinates.length; i++) {
                area += polygonArea(_.coordinates[i]);
            }
            return area;
        case 'Point':
        case 'MultiPoint':
        case 'LineString':
        case 'MultiLineString':
            return 0;
        case 'GeometryCollection':
            for (i = 0; i < _.geometries.length; i++) {
                area += geometry(_.geometries[i]);
            }
            return area;
    }
}

function polygonArea(coords) {
    var area = 0;
    if (coords && coords.length > 0) {
        area += Math.abs(ringArea(coords[0]));
        for (var i = 1; i < coords.length; i++) {
            area -= Math.abs(ringArea(coords[i]));
        }
    }
    return area;
}

/**
 * Calculate the approximate area of the polygon were it projected onto
 *     the earth.  Note that this area will be positive if ring is oriented
 *     clockwise, otherwise it will be negative.
 *
 * Reference:
 * Robert. G. Chamberlain and William H. Duquette, "Some Algorithms for
 *     Polygons on a Sphere", JPL Publication 07-03, Jet Propulsion
 *     Laboratory, Pasadena, CA, June 2007 http://trs-new.jpl.nasa.gov/dspace/handle/2014/40409
 *
 * Returns:
 * {float} The approximate signed geodesic area of the polygon in square
 *     meters.
 */

function ringArea(coords) {
    var p1, p2, p3, lowerIndex, middleIndex, upperIndex,
    area = 0,
    coordsLength = coords.length;

    if (coordsLength > 2) {
        for (i = 0; i < coordsLength; i++) {
            if (i === coordsLength - 2) {// i = N-2
                lowerIndex = coordsLength - 2;
                middleIndex = coordsLength -1;
                upperIndex = 0;
            } else if (i === coordsLength - 1) {// i = N-1
                lowerIndex = coordsLength - 1;
                middleIndex = 0;
                upperIndex = 1;
            } else { // i = 0 to N-3
                lowerIndex = i;
                middleIndex = i+1;
                upperIndex = i+2;
            }
            p1 = coords[lowerIndex];
            p2 = coords[middleIndex];
            p3 = coords[upperIndex];
            area += ( rad(p3[0]) - rad(p1[0]) ) * Math.sin( rad(p2[1]));
        }

        area = area * wgs84.RADIUS * wgs84.RADIUS / 2;
    }

    return area;
}

function rad(_) {
    return _ * Math.PI / 180;
}
},{"wgs84":24}],4:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],5:[function(require,module,exports){
(function (global){
/*!
 * Lo-Dash v0.9.2 <http://lodash.com>
 * (c) 2012 John-David Dalton <http://allyoucanleet.com/>
 * Based on Underscore.js 1.4.2 <http://underscorejs.org>
 * (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
 * Available under MIT license <http://lodash.com/license>
 */
;(function(window, undefined) {

  /** Detect free variable `exports` */
  var freeExports = typeof exports == 'object' && exports;

  /** Detect free variable `global` and use it as `window` */
  var freeGlobal = typeof global == 'object' && global;
  if (freeGlobal.global === freeGlobal) {
    window = freeGlobal;
  }

  /** Used for array and object method references */
  var arrayRef = [],
      // avoid a Closure Compiler bug by creatively creating an object
      objectRef = new function(){};

  /** Used to generate unique IDs */
  var idCounter = 0;

  /** Used internally to indicate various things */
  var indicatorObject = objectRef;

  /** Used by `cachedContains` as the default size when optimizations are enabled for large arrays */
  var largeArraySize = 30;

  /** Used to restore the original `_` reference in `noConflict` */
  var oldDash = window._;

  /** Used to detect template delimiter values that require a with-statement */
  var reComplexDelimiter = /[-?+=!~*%&^<>|{(\/]|\[\D|\b(?:delete|in|instanceof|new|typeof|void)\b/;

  /** Used to match HTML entities */
  var reEscapedHtml = /&(?:amp|lt|gt|quot|#x27);/g;

  /** Used to match empty string literals in compiled template source */
  var reEmptyStringLeading = /\b__p \+= '';/g,
      reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
      reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

  /** Used to match regexp flags from their coerced string values */
  var reFlags = /\w*$/;

  /** Used to insert the data object variable into compiled template source */
  var reInsertVariable = /(?:__e|__t = )\(\s*(?![\d\s"']|this\.)/g;

  /** Used to detect if a method is native */
  var reNative = RegExp('^' +
    (objectRef.valueOf + '')
      .replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&')
      .replace(/valueOf|for [^\]]+/g, '.+?') + '$'
  );

  /**
   * Used to match ES6 template delimiters
   * http://people.mozilla.org/~jorendorff/es6-draft.html#sec-7.8.6
   */
  var reEsTemplate = /\$\{((?:(?=\\?)\\?[\s\S])*?)}/g;

  /** Used to match "interpolate" template delimiters */
  var reInterpolate = /<%=([\s\S]+?)%>/g;

  /** Used to ensure capturing order of template delimiters */
  var reNoMatch = /($^)/;

  /** Used to match HTML characters */
  var reUnescapedHtml = /[&<>"']/g;

  /** Used to match unescaped characters in compiled string literals */
  var reUnescapedString = /['\n\r\t\u2028\u2029\\]/g;

  /** Used to fix the JScript [[DontEnum]] bug */
  var shadowed = [
    'constructor', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
    'toLocaleString', 'toString', 'valueOf'
  ];

  /** Used to make template sourceURLs easier to identify */
  var templateCounter = 0;

  /** Native method shortcuts */
  var ceil = Math.ceil,
      concat = arrayRef.concat,
      floor = Math.floor,
      getPrototypeOf = reNative.test(getPrototypeOf = Object.getPrototypeOf) && getPrototypeOf,
      hasOwnProperty = objectRef.hasOwnProperty,
      push = arrayRef.push,
      propertyIsEnumerable = objectRef.propertyIsEnumerable,
      slice = arrayRef.slice,
      toString = objectRef.toString;

  /* Native method shortcuts for methods with the same name as other `lodash` methods */
  var nativeBind = reNative.test(nativeBind = slice.bind) && nativeBind,
      nativeIsArray = reNative.test(nativeIsArray = Array.isArray) && nativeIsArray,
      nativeIsFinite = window.isFinite,
      nativeIsNaN = window.isNaN,
      nativeKeys = reNative.test(nativeKeys = Object.keys) && nativeKeys,
      nativeMax = Math.max,
      nativeMin = Math.min,
      nativeRandom = Math.random;

  /** `Object#toString` result shortcuts */
  var argsClass = '[object Arguments]',
      arrayClass = '[object Array]',
      boolClass = '[object Boolean]',
      dateClass = '[object Date]',
      funcClass = '[object Function]',
      numberClass = '[object Number]',
      objectClass = '[object Object]',
      regexpClass = '[object RegExp]',
      stringClass = '[object String]';

  /**
   * Detect the JScript [[DontEnum]] bug:
   *
   * In IE < 9 an objects own properties, shadowing non-enumerable ones, are
   * made non-enumerable as well.
   */
  var hasDontEnumBug;

  /** Detect if own properties are iterated after inherited properties (IE < 9) */
  var iteratesOwnLast;

  /**
   * Detect if `Array#shift` and `Array#splice` augment array-like objects
   * incorrectly:
   *
   * Firefox < 10, IE compatibility mode, and IE < 9 have buggy Array `shift()`
   * and `splice()` functions that fail to remove the last element, `value[0]`,
   * of array-like objects even though the `length` property is set to `0`.
   * The `shift()` method is buggy in IE 8 compatibility mode, while `splice()`
   * is buggy regardless of mode in IE < 9 and buggy in compatibility mode in IE 9.
   */
  var hasObjectSpliceBug = (hasObjectSpliceBug = { '0': 1, 'length': 1 },
    arrayRef.splice.call(hasObjectSpliceBug, 0, 1), hasObjectSpliceBug[0]);

  /** Detect if an `arguments` object's indexes are non-enumerable (IE < 9) */
  var noArgsEnum = true;

  (function() {
    var props = [];
    function ctor() { this.x = 1; }
    ctor.prototype = { 'valueOf': 1, 'y': 1 };
    for (var prop in new ctor) { props.push(prop); }
    for (prop in arguments) { noArgsEnum = !prop; }

    hasDontEnumBug = !/valueOf/.test(props);
    iteratesOwnLast = props[0] != 'x';
  }(1));

  /** Detect if an `arguments` object's [[Class]] is unresolvable (Firefox < 4, IE < 9) */
  var noArgsClass = !isArguments(arguments);

  /** Detect if `Array#slice` cannot be used to convert strings to arrays (Opera < 10.52) */
  var noArraySliceOnStrings = slice.call('x')[0] != 'x';

  /**
   * Detect lack of support for accessing string characters by index:
   *
   * IE < 8 can't access characters by index and IE 8 can only access
   * characters by index on string literals.
   */
  var noCharByIndex = ('x'[0] + Object('x')[0]) != 'xx';

  /**
   * Detect if a node's [[Class]] is unresolvable (IE < 9)
   * and that the JS engine won't error when attempting to coerce an object to
   * a string without a `toString` property value of `typeof` "function".
   */
  try {
    var noNodeClass = ({ 'toString': 0 } + '', toString.call(window.document || 0) == objectClass);
  } catch(e) { }

  /* Detect if `Function#bind` exists and is inferred to be fast (all but V8) */
  var isBindFast = nativeBind && /\n|Opera/.test(nativeBind + toString.call(window.opera));

  /* Detect if `Object.keys` exists and is inferred to be fast (IE, Opera, V8) */
  var isKeysFast = nativeKeys && /^.+$|true/.test(nativeKeys + !!window.attachEvent);

  /**
   * Detect if sourceURL syntax is usable without erroring:
   *
   * The JS engine in Adobe products, like InDesign, will throw a syntax error
   * when it encounters a single line comment beginning with the `@` symbol.
   *
   * The JS engine in Narwhal will generate the function `function anonymous(){//}`
   * and throw a syntax error.
   *
   * Avoid comments beginning `@` symbols in IE because they are part of its
   * non-standard conditional compilation support.
   * http://msdn.microsoft.com/en-us/library/121hztk3(v=vs.94).aspx
   */
  try {
    var useSourceURL = (Function('//@')(), !window.attachEvent);
  } catch(e) { }

  /** Used to identify object classifications that `_.clone` supports */
  var cloneableClasses = {};
  cloneableClasses[argsClass] = cloneableClasses[funcClass] = false;
  cloneableClasses[arrayClass] = cloneableClasses[boolClass] = cloneableClasses[dateClass] =
  cloneableClasses[numberClass] = cloneableClasses[objectClass] = cloneableClasses[regexpClass] =
  cloneableClasses[stringClass] = true;

  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };

  /** Used to escape characters for inclusion in compiled string literals */
  var stringEscapes = {
    '\\': '\\',
    "'": "'",
    '\n': 'n',
    '\r': 'r',
    '\t': 't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  /*--------------------------------------------------------------------------*/

  /**
   * The `lodash` function.
   *
   * @name _
   * @constructor
   * @category Chaining
   * @param {Mixed} value The value to wrap in a `lodash` instance.
   * @returns {Object} Returns a `lodash` instance.
   */
  function lodash(value) {
    // exit early if already wrapped
    if (value && value.__wrapped__) {
      return value;
    }
    // allow invoking `lodash` without the `new` operator
    if (!(this instanceof lodash)) {
      return new lodash(value);
    }
    this.__wrapped__ = value;
  }

  /**
   * By default, the template delimiters used by Lo-Dash are similar to those in
   * embedded Ruby (ERB). Change the following template settings to use alternative
   * delimiters.
   *
   * @static
   * @memberOf _
   * @type Object
   */
  lodash.templateSettings = {

    /**
     * Used to detect `data` property values to be HTML-escaped.
     *
     * @static
     * @memberOf _.templateSettings
     * @type RegExp
     */
    'escape': /<%-([\s\S]+?)%>/g,

    /**
     * Used to detect code to be evaluated.
     *
     * @static
     * @memberOf _.templateSettings
     * @type RegExp
     */
    'evaluate': /<%([\s\S]+?)%>/g,

    /**
     * Used to detect `data` property values to inject.
     *
     * @static
     * @memberOf _.templateSettings
     * @type RegExp
     */
    'interpolate': reInterpolate,

    /**
     * Used to reference the data object in the template text.
     *
     * @static
     * @memberOf _.templateSettings
     * @type String
     */
    'variable': ''
  };

  /*--------------------------------------------------------------------------*/

  /**
   * The template used to create iterator functions.
   *
   * @private
   * @param {Obect} data The data object used to populate the text.
   * @returns {String} Returns the interpolated text.
   */
  var iteratorTemplate = template(
    // conditional strict mode
    '<% if (obj.useStrict) { %>\'use strict\';\n<% } %>' +

    // the `iteratee` may be reassigned by the `top` snippet
    'var index, value, iteratee = <%= firstArg %>, ' +
    // assign the `result` variable an initial value
    'result = <%= firstArg %>;\n' +
    // exit early if the first argument is falsey
    'if (!<%= firstArg %>) return result;\n' +
    // add code before the iteration branches
    '<%= top %>;\n' +

    // array-like iteration:
    '<% if (arrayLoop) { %>' +
    'var length = iteratee.length; index = -1;\n' +
    'if (typeof length == \'number\') {' +

    // add support for accessing string characters by index if needed
    '  <% if (noCharByIndex) { %>\n' +
    '  if (isString(iteratee)) {\n' +
    '    iteratee = iteratee.split(\'\')\n' +
    '  }' +
    '  <% } %>\n' +

    // iterate over the array-like value
    '  while (++index < length) {\n' +
    '    value = iteratee[index];\n' +
    '    <%= arrayLoop %>\n' +
    '  }\n' +
    '}\n' +
    'else {' +

    // object iteration:
    // add support for iterating over `arguments` objects if needed
    '  <%  } else if (noArgsEnum) { %>\n' +
    '  var length = iteratee.length; index = -1;\n' +
    '  if (length && isArguments(iteratee)) {\n' +
    '    while (++index < length) {\n' +
    '      value = iteratee[index += \'\'];\n' +
    '      <%= objectLoop %>\n' +
    '    }\n' +
    '  } else {' +
    '  <% } %>' +

    // Firefox < 3.6, Opera > 9.50 - Opera < 11.60, and Safari < 5.1
    // (if the prototype or a property on the prototype has been set)
    // incorrectly sets a function's `prototype` property [[Enumerable]]
    // value to `true`. Because of this Lo-Dash standardizes on skipping
    // the the `prototype` property of functions regardless of its
    // [[Enumerable]] value.
    '  <% if (!hasDontEnumBug) { %>\n' +
    '  var skipProto = typeof iteratee == \'function\' && \n' +
    '    propertyIsEnumerable.call(iteratee, \'prototype\');\n' +
    '  <% } %>' +

    // iterate own properties using `Object.keys` if it's fast
    '  <% if (isKeysFast && useHas) { %>\n' +
    '  var ownIndex = -1,\n' +
    '      ownProps = objectTypes[typeof iteratee] ? nativeKeys(iteratee) : [],\n' +
    '      length = ownProps.length;\n\n' +
    '  while (++ownIndex < length) {\n' +
    '    index = ownProps[ownIndex];\n' +
    '    <% if (!hasDontEnumBug) { %>if (!(skipProto && index == \'prototype\')) {\n  <% } %>' +
    '    value = iteratee[index];\n' +
    '    <%= objectLoop %>\n' +
    '    <% if (!hasDontEnumBug) { %>}\n<% } %>' +
    '  }' +

    // else using a for-in loop
    '  <% } else { %>\n' +
    '  for (index in iteratee) {<%' +
    '    if (!hasDontEnumBug || useHas) { %>\n    if (<%' +
    '      if (!hasDontEnumBug) { %>!(skipProto && index == \'prototype\')<% }' +
    '      if (!hasDontEnumBug && useHas) { %> && <% }' +
    '      if (useHas) { %>hasOwnProperty.call(iteratee, index)<% }' +
    '    %>) {' +
    '    <% } %>\n' +
    '    value = iteratee[index];\n' +
    '    <%= objectLoop %>;' +
    '    <% if (!hasDontEnumBug || useHas) { %>\n    }<% } %>\n' +
    '  }' +
    '  <% } %>' +

    // Because IE < 9 can't set the `[[Enumerable]]` attribute of an
    // existing property and the `constructor` property of a prototype
    // defaults to non-enumerable, Lo-Dash skips the `constructor`
    // property when it infers it's iterating over a `prototype` object.
    '  <% if (hasDontEnumBug) { %>\n\n' +
    '  var ctor = iteratee.constructor;\n' +
    '    <% for (var k = 0; k < 7; k++) { %>\n' +
    '  index = \'<%= shadowed[k] %>\';\n' +
    '  if (<%' +
    '      if (shadowed[k] == \'constructor\') {' +
    '        %>!(ctor && ctor.prototype === iteratee) && <%' +
    '      } %>hasOwnProperty.call(iteratee, index)) {\n' +
    '    value = iteratee[index];\n' +
    '    <%= objectLoop %>\n' +
    '  }' +
    '    <% } %>' +
    '  <% } %>' +
    '  <% if (arrayLoop || noArgsEnum) { %>\n}<% } %>\n' +

    // add code to the bottom of the iteration function
    '<%= bottom %>;\n' +
    // finally, return the `result`
    'return result'
  );

  /**
   * Reusable iterator options shared by `forEach`, `forIn`, and `forOwn`.
   */
  var forEachIteratorOptions = {
    'args': 'collection, callback, thisArg',
    'top': 'callback = createCallback(callback, thisArg)',
    'arrayLoop': 'if (callback(value, index, collection) === false) return result',
    'objectLoop': 'if (callback(value, index, collection) === false) return result'
  };

  /** Reusable iterator options for `defaults`, and `extend` */
  var extendIteratorOptions = {
    'useHas': false,
    'args': 'object',
    'top':
      'for (var argsIndex = 1, argsLength = arguments.length; argsIndex < argsLength; argsIndex++) {\n' +
      '  if (iteratee = arguments[argsIndex]) {',
    'objectLoop': 'result[index] = value',
    'bottom': '  }\n}'
  };

  /** Reusable iterator options for `forIn` and `forOwn` */
  var forOwnIteratorOptions = {
    'arrayLoop': null
  };

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a function optimized to search large arrays for a given `value`,
   * starting at `fromIndex`, using strict equality for comparisons, i.e. `===`.
   *
   * @private
   * @param {Array} array The array to search.
   * @param {Mixed} value The value to search for.
   * @param {Number} [fromIndex=0] The index to search from.
   * @param {Number} [largeSize=30] The length at which an array is considered large.
   * @returns {Boolean} Returns `true` if `value` is found, else `false`.
   */
  function cachedContains(array, fromIndex, largeSize) {
    fromIndex || (fromIndex = 0);

    var length = array.length,
        isLarge = (length - fromIndex) >= (largeSize || largeArraySize);

    if (isLarge) {
      var cache = {},
          index = fromIndex - 1;

      while (++index < length) {
        // manually coerce `value` to a string because `hasOwnProperty`, in some
        // older versions of Firefox, coerces objects incorrectly
        var key = array[index] + '';
        (hasOwnProperty.call(cache, key) ? cache[key] : (cache[key] = [])).push(array[index]);
      }
    }
    return function(value) {
      if (isLarge) {
        var key = value + '';
        return hasOwnProperty.call(cache, key) && indexOf(cache[key], value) > -1;
      }
      return indexOf(array, value, fromIndex) > -1;
    }
  }

  /**
   * Used by `_.max` and `_.min` as the default `callback` when a given
   * `collection` is a string value.
   *
   * @private
   * @param {String} value The character to inspect.
   * @returns {Number} Returns the code unit of given character.
   */
  function charAtCallback(value) {
    return value.charCodeAt(0);
  }

  /**
   * Used by `sortBy` to compare transformed `collection` values, stable sorting
   * them in ascending order.
   *
   * @private
   * @param {Object} a The object to compare to `b`.
   * @param {Object} b The object to compare to `a`.
   * @returns {Number} Returns the sort order indicator of `1` or `-1`.
   */
  function compareAscending(a, b) {
    var ai = a.index,
        bi = b.index;

    a = a.criteria;
    b = b.criteria;

    // ensure a stable sort in V8 and other engines
    // http://code.google.com/p/v8/issues/detail?id=90
    if (a !== b) {
      if (a > b || a === undefined) {
        return 1;
      }
      if (a < b || b === undefined) {
        return -1;
      }
    }
    return ai < bi ? -1 : 1;
  }

  /**
   * Creates a function that, when called, invokes `func` with the `this`
   * binding of `thisArg` and prepends any `partailArgs` to the arguments passed
   * to the bound function.
   *
   * @private
   * @param {Function|String} func The function to bind or the method name.
   * @param {Mixed} [thisArg] The `this` binding of `func`.
   * @param {Array} partialArgs An array of arguments to be partially applied.
   * @returns {Function} Returns the new bound function.
   */
  function createBound(func, thisArg, partialArgs) {
    var isFunc = isFunction(func),
        isPartial = !partialArgs,
        methodName = func;

    // juggle arguments
    if (isPartial) {
      partialArgs = thisArg;
    }

    function bound() {
      // `Function#bind` spec
      // http://es5.github.com/#x15.3.4.5
      var args = arguments,
          thisBinding = isPartial ? this : thisArg;

      if (!isFunc) {
        func = thisArg[methodName];
      }
      if (partialArgs.length) {
        args = args.length
          ? partialArgs.concat(slice.call(args))
          : partialArgs;
      }
      if (this instanceof bound) {
        // get `func` instance if `bound` is invoked in a `new` expression
        noop.prototype = func.prototype;
        thisBinding = new noop;

        // mimic the constructor's `return` behavior
        // http://es5.github.com/#x13.2.2
        var result = func.apply(thisBinding, args);
        return isObject(result)
          ? result
          : thisBinding
      }
      return func.apply(thisBinding, args);
    }
    return bound;
  }

  /**
   * Produces an iteration callback bound to an optional `thisArg`. If `func` is
   * a property name, the callback will return the property value for a given element.
   *
   * @private
   * @param {Function|String} [func=identity|property] The function called per
   * iteration or property name to query.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Function} Returns a callback function.
   */
  function createCallback(func, thisArg) {
    if (!func) {
      return identity;
    }
    if (typeof func != 'function') {
      return function(object) {
        return object[func];
      };
    }
    if (thisArg !== undefined) {
      return function(value, index, object) {
        return func.call(thisArg, value, index, object);
      };
    }
    return func;
  }

  /**
   * Creates compiled iteration functions.
   *
   * @private
   * @param {Object} [options1, options2, ...] The compile options object(s).
   *  useHas - A boolean to specify using `hasOwnProperty` checks in the object loop.
   *  args - A string of comma separated arguments the iteration function will accept.
   *  top - A string of code to execute before the iteration branches.
   *  arrayLoop - A string of code to execute in the array loop.
   *  objectLoop - A string of code to execute in the object loop.
   *  bottom - A string of code to execute after the iteration branches.
   *
   * @returns {Function} Returns the compiled function.
   */
  function createIterator() {
    var data = {
      'arrayLoop': '',
      'bottom': '',
      'hasDontEnumBug': hasDontEnumBug,
      'isKeysFast': isKeysFast,
      'objectLoop': '',
      'noArgsEnum': noArgsEnum,
      'noCharByIndex': noCharByIndex,
      'shadowed': shadowed,
      'top': '',
      'useHas': true
    };

    // merge options into a template data object
    for (var object, index = 0; object = arguments[index]; index++) {
      for (var key in object) {
        data[key] = object[key];
      }
    }
    var args = data.args;
    data.firstArg = /^[^,]+/.exec(args)[0];

    // create the function factory
    var factory = Function(
        'createCallback, hasOwnProperty, isArguments, isString, objectTypes, ' +
        'nativeKeys, propertyIsEnumerable',
      'return function(' + args + ') {\n' + iteratorTemplate(data) + '\n}'
    );
    // return the compiled function
    return factory(
      createCallback, hasOwnProperty, isArguments, isString, objectTypes,
      nativeKeys, propertyIsEnumerable
    );
  }

  /**
   * Used by `template` to escape characters for inclusion in compiled
   * string literals.
   *
   * @private
   * @param {String} match The matched character to escape.
   * @returns {String} Returns the escaped character.
   */
  function escapeStringChar(match) {
    return '\\' + stringEscapes[match];
  }

  /**
   * Used by `escape` to convert characters to HTML entities.
   *
   * @private
   * @param {String} match The matched character to escape.
   * @returns {String} Returns the escaped character.
   */
  function escapeHtmlChar(match) {
    return htmlEscapes[match];
  }

  /**
   * A no-operation function.
   *
   * @private
   */
  function noop() {
    // no operation performed
  }

  /**
   * Used by `unescape` to convert HTML entities to characters.
   *
   * @private
   * @param {String} match The matched character to unescape.
   * @returns {String} Returns the unescaped character.
   */
  function unescapeHtmlChar(match) {
    return htmlUnescapes[match];
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Checks if `value` is an `arguments` object.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is an `arguments` object, else `false`.
   * @example
   *
   * (function() { return _.isArguments(arguments); })(1, 2, 3);
   * // => true
   *
   * _.isArguments([1, 2, 3]);
   * // => false
   */
  function isArguments(value) {
    return toString.call(value) == argsClass;
  }
  // fallback for browsers that can't detect `arguments` objects by [[Class]]
  if (noArgsClass) {
    isArguments = function(value) {
      return value ? hasOwnProperty.call(value, 'callee') : false;
    };
  }

  /**
   * Iterates over `object`'s own and inherited enumerable properties, executing
   * the `callback` for each property. The `callback` is bound to `thisArg` and
   * invoked with three arguments; (value, key, object). Callbacks may exit iteration
   * early by explicitly returning `false`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns `object`.
   * @example
   *
   * function Dog(name) {
   *   this.name = name;
   * }
   *
   * Dog.prototype.bark = function() {
   *   alert('Woof, woof!');
   * };
   *
   * _.forIn(new Dog('Dagny'), function(value, key) {
   *   alert(key);
   * });
   * // => alerts 'name' and 'bark' (order is not guaranteed)
   */
  var forIn = createIterator(forEachIteratorOptions, forOwnIteratorOptions, {
    'useHas': false
  });

  /**
   * Iterates over `object`'s own enumerable properties, executing the `callback`
   * for each property. The `callback` is bound to `thisArg` and invoked with three
   * arguments; (value, key, object). Callbacks may exit iteration early by explicitly
   * returning `false`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns `object`.
   * @example
   *
   * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
   *   alert(key);
   * });
   * // => alerts '0', '1', and 'length' (order is not guaranteed)
   */
  var forOwn = createIterator(forEachIteratorOptions, forOwnIteratorOptions);

  /**
   * A fallback implementation of `isPlainObject` that checks if a given `value`
   * is an object created by the `Object` constructor, assuming objects created
   * by the `Object` constructor have no inherited enumerable properties and that
   * there are no `Object.prototype` extensions.
   *
   * @private
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if `value` is a plain object, else `false`.
   */
  function shimIsPlainObject(value) {
    // avoid non-objects and false positives for `arguments` objects
    var result = false;
    if (!(value && typeof value == 'object') || isArguments(value)) {
      return result;
    }
    // IE < 9 presents DOM nodes as `Object` objects except they have `toString`
    // methods that are `typeof` "string" and still can coerce nodes to strings.
    // Also check that the constructor is `Object` (i.e. `Object instanceof Object`)
    var ctor = value.constructor;
    if ((!noNodeClass || !(typeof value.toString != 'function' && typeof (value + '') == 'string')) &&
        (!isFunction(ctor) || ctor instanceof ctor)) {
      // IE < 9 iterates inherited properties before own properties. If the first
      // iterated property is an object's own property then there are no inherited
      // enumerable properties.
      if (iteratesOwnLast) {
        forIn(value, function(value, key, object) {
          result = !hasOwnProperty.call(object, key);
          return false;
        });
        return result === false;
      }
      // In most environments an object's own properties are iterated before
      // its inherited properties. If the last iterated property is an object's
      // own property then there are no inherited enumerable properties.
      forIn(value, function(value, key) {
        result = key;
      });
      return result === false || hasOwnProperty.call(value, result);
    }
    return result;
  }

  /**
   * A fallback implementation of `Object.keys` that produces an array of the
   * given object's own enumerable property names.
   *
   * @private
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns a new array of property names.
   */
  function shimKeys(object) {
    var result = [];
    forOwn(object, function(value, key) {
      result.push(key);
    });
    return result;
  }

  /**
   * Used to convert characters to HTML entities:
   *
   * Though the `>` character is escaped for symmetry, characters like `>` and `/`
   * don't require escaping in HTML and have no special meaning unless they're part
   * of a tag or an unquoted attribute value.
   * http://mathiasbynens.be/notes/ambiguous-ampersands (under "semi-related fun fact")
   */
  var htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
  };

  /** Used to convert HTML entities to characters */
  var htmlUnescapes = invert(htmlEscapes);

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a clone of `value`. If `deep` is `true`, all nested objects will
   * also be cloned otherwise they will be assigned by reference. Functions, DOM
   * nodes, `arguments` objects, and objects created by constructors other than
   * `Object` are **not** cloned.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to clone.
   * @param {Boolean} deep A flag to indicate a deep clone.
   * @param- {Object} [guard] Internally used to allow this method to work with
   *  others like `_.map` without using their callback `index` argument for `deep`.
   * @param- {Array} [stackA=[]] Internally used to track traversed source objects.
   * @param- {Array} [stackB=[]] Internally used to associate clones with their
   *  source counterparts.
   * @returns {Mixed} Returns the cloned `value`.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 },
   *   { 'name': 'curly', 'age': 60 }
   * ];
   *
   * _.clone({ 'name': 'moe' });
   * // => { 'name': 'moe' }
   *
   * var shallow = _.clone(stooges);
   * shallow[0] === stooges[0];
   * // => true
   *
   * var deep = _.clone(stooges, true);
   * shallow[0] === stooges[0];
   * // => false
   */
  function clone(value, deep, guard, stackA, stackB) {
    if (value == null) {
      return value;
    }
    if (guard) {
      deep = false;
    }
    // inspect [[Class]]
    var isObj = isObject(value);
    if (isObj) {
      // don't clone `arguments` objects, functions, or non-object Objects
      var className = toString.call(value);
      if (!cloneableClasses[className] || (noArgsClass && isArguments(value))) {
        return value;
      }
      var isArr = className == arrayClass;
      isObj = isArr || (className == objectClass ? isPlainObject(value) : isObj);
    }
    // shallow clone
    if (!isObj || !deep) {
      // don't clone functions
      return isObj
        ? (isArr ? slice.call(value) : extend({}, value))
        : value;
    }

    var ctor = value.constructor;
    switch (className) {
      case boolClass:
      case dateClass:
        return new ctor(+value);

      case numberClass:
      case stringClass:
        return new ctor(value);

      case regexpClass:
        return ctor(value.source, reFlags.exec(value));
    }
    // check for circular references and return corresponding clone
    stackA || (stackA = []);
    stackB || (stackB = []);

    var length = stackA.length;
    while (length--) {
      if (stackA[length] == value) {
        return stackB[length];
      }
    }
    // init cloned object
    var result = isArr ? ctor(value.length) : {};

    // add the source value to the stack of traversed objects
    // and associate it with its clone
    stackA.push(value);
    stackB.push(result);

    // recursively populate clone (susceptible to call stack limits)
    (isArr ? forEach : forOwn)(value, function(objValue, key) {
      result[key] = clone(objValue, deep, null, stackA, stackB);
    });

    return result;
  }

  /**
   * Assigns enumerable properties of the default object(s) to the `destination`
   * object for all `destination` properties that resolve to `null`/`undefined`.
   * Once a property is set, additional defaults of the same property will be
   * ignored.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The destination object.
   * @param {Object} [default1, default2, ...] The default objects.
   * @returns {Object} Returns the destination object.
   * @example
   *
   * var iceCream = { 'flavor': 'chocolate' };
   * _.defaults(iceCream, { 'flavor': 'vanilla', 'sprinkles': 'rainbow' });
   * // => { 'flavor': 'chocolate', 'sprinkles': 'rainbow' }
   */
  var defaults = createIterator(extendIteratorOptions, {
    'objectLoop': 'if (result[index] == null) ' + extendIteratorOptions.objectLoop
  });

  /**
   * Assigns enumerable properties of the source object(s) to the `destination`
   * object. Subsequent sources will overwrite propery assignments of previous
   * sources.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The destination object.
   * @param {Object} [source1, source2, ...] The source objects.
   * @returns {Object} Returns the destination object.
   * @example
   *
   * _.extend({ 'name': 'moe' }, { 'age': 40 });
   * // => { 'name': 'moe', 'age': 40 }
   */
  var extend = createIterator(extendIteratorOptions);

  /**
   * Creates a sorted array of all enumerable properties, own and inherited,
   * of `object` that have function values.
   *
   * @static
   * @memberOf _
   * @alias methods
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns a new array of property names that have function values.
   * @example
   *
   * _.functions(_);
   * // => ['all', 'any', 'bind', 'bindAll', 'clone', 'compact', 'compose', ...]
   */
  function functions(object) {
    var result = [];
    forIn(object, function(value, key) {
      if (isFunction(value)) {
        result.push(key);
      }
    });
    return result.sort();
  }

  /**
   * Checks if the specified object `property` exists and is a direct property,
   * instead of an inherited property.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to check.
   * @param {String} property The property to check for.
   * @returns {Boolean} Returns `true` if key is a direct property, else `false`.
   * @example
   *
   * _.has({ 'a': 1, 'b': 2, 'c': 3 }, 'b');
   * // => true
   */
  function has(object, property) {
    return object ? hasOwnProperty.call(object, property) : false;
  }

  /**
   * Creates an object composed of the inverted keys and values of the given `object`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to invert.
   * @returns {Object} Returns the created inverted object.
   * @example
   *
   *  _.invert({ 'first': 'Moe', 'second': 'Larry', 'third': 'Curly' });
   * // => { 'Moe': 'first', 'Larry': 'second', 'Curly': 'third' } (order is not guaranteed)
   */
  function invert(object) {
    var result = {};
    forOwn(object, function(value, key) {
      result[value] = key;
    });
    return result;
  }

  /**
   * Checks if `value` is an array.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is an array, else `false`.
   * @example
   *
   * (function() { return _.isArray(arguments); })();
   * // => false
   *
   * _.isArray([1, 2, 3]);
   * // => true
   */
  var isArray = nativeIsArray || function(value) {
    return toString.call(value) == arrayClass;
  };

  /**
   * Checks if `value` is a boolean (`true` or `false`) value.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a boolean value, else `false`.
   * @example
   *
   * _.isBoolean(null);
   * // => false
   */
  function isBoolean(value) {
    return value === true || value === false || toString.call(value) == boolClass;
  }

  /**
   * Checks if `value` is a date.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a date, else `false`.
   * @example
   *
   * _.isDate(new Date);
   * // => true
   */
  function isDate(value) {
    return toString.call(value) == dateClass;
  }

  /**
   * Checks if `value` is a DOM element.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a DOM element, else `false`.
   * @example
   *
   * _.isElement(document.body);
   * // => true
   */
  function isElement(value) {
    return value ? value.nodeType === 1 : false;
  }

  /**
   * Checks if `value` is empty. Arrays, strings, or `arguments` objects with a
   * length of `0` and objects with no own enumerable properties are considered
   * "empty".
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Array|Object|String} value The value to inspect.
   * @returns {Boolean} Returns `true` if the `value` is empty, else `false`.
   * @example
   *
   * _.isEmpty([1, 2, 3]);
   * // => false
   *
   * _.isEmpty({});
   * // => true
   *
   * _.isEmpty('');
   * // => true
   */
  function isEmpty(value) {
    var result = true;
    if (!value) {
      return result;
    }
    var className = toString.call(value),
        length = value.length;

    if ((className == arrayClass || className == stringClass ||
        className == argsClass || (noArgsClass && isArguments(value))) ||
        (className == objectClass && typeof length == 'number' && isFunction(value.splice))) {
      return !length;
    }
    forOwn(value, function() {
      return (result = false);
    });
    return result;
  }

  /**
   * Performs a deep comparison between two values to determine if they are
   * equivalent to each other.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} a The value to compare.
   * @param {Mixed} b The other value to compare.
   * @param- {Object} [stackA=[]] Internally used track traversed `a` objects.
   * @param- {Object} [stackB=[]] Internally used track traversed `b` objects.
   * @returns {Boolean} Returns `true` if the values are equvalent, else `false`.
   * @example
   *
   * var moe = { 'name': 'moe', 'luckyNumbers': [13, 27, 34] };
   * var clone = { 'name': 'moe', 'luckyNumbers': [13, 27, 34] };
   *
   * moe == clone;
   * // => false
   *
   * _.isEqual(moe, clone);
   * // => true
   */
  function isEqual(a, b, stackA, stackB) {
    // exit early for identical values
    if (a === b) {
      // treat `+0` vs. `-0` as not equal
      return a !== 0 || (1 / a == 1 / b);
    }
    // a strict comparison is necessary because `null == undefined`
    if (a == null || b == null) {
      return a === b;
    }
    // compare [[Class]] names
    var className = toString.call(a);
    if (className != toString.call(b)) {
      return false;
    }
    switch (className) {
      case boolClass:
      case dateClass:
        // coerce dates and booleans to numbers, dates to milliseconds and booleans
        // to `1` or `0`, treating invalid dates coerced to `NaN` as not equal
        return +a == +b;

      case numberClass:
        // treat `NaN` vs. `NaN` as equal
        return a != +a
          ? b != +b
          // but treat `+0` vs. `-0` as not equal
          : (a == 0 ? (1 / a == 1 / b) : a == +b);

      case regexpClass:
      case stringClass:
        // coerce regexes to strings (http://es5.github.com/#x15.10.6.4)
        // treat string primitives and their corresponding object instances as equal
        return a == b + '';
    }
    // exit early, in older browsers, if `a` is array-like but not `b`
    var isArr = className == arrayClass || className == argsClass;
    if (noArgsClass && !isArr && (isArr = isArguments(a)) && !isArguments(b)) {
      return false;
    }
    if (!isArr) {
      // unwrap any `lodash` wrapped values
      if (a.__wrapped__ || b.__wrapped__) {
        return isEqual(a.__wrapped__ || a, b.__wrapped__ || b);
      }
      // exit for functions and DOM nodes
      if (className != objectClass || (noNodeClass && (
          (typeof a.toString != 'function' && typeof (a + '') == 'string') ||
          (typeof b.toString != 'function' && typeof (b + '') == 'string')))) {
        return false;
      }
      var ctorA = a.constructor,
          ctorB = b.constructor;

      // non `Object` object instances with different constructors are not equal
      if (ctorA != ctorB && !(
            isFunction(ctorA) && ctorA instanceof ctorA &&
            isFunction(ctorB) && ctorB instanceof ctorB
          )) {
        return false;
      }
    }
    // assume cyclic structures are equal
    // the algorithm for detecting cyclic structures is adapted from ES 5.1
    // section 15.12.3, abstract operation `JO` (http://es5.github.com/#x15.12.3)
    stackA || (stackA = []);
    stackB || (stackB = []);

    var length = stackA.length;
    while (length--) {
      if (stackA[length] == a) {
        return stackB[length] == b;
      }
    }

    var index = -1,
        result = true,
        size = 0;

    // add `a` and `b` to the stack of traversed objects
    stackA.push(a);
    stackB.push(b);

    // recursively compare objects and arrays (susceptible to call stack limits)
    if (isArr) {
      // compare lengths to determine if a deep comparison is necessary
      size = a.length;
      result = size == b.length;

      if (result) {
        // deep compare the contents, ignoring non-numeric properties
        while (size--) {
          if (!(result = isEqual(a[size], b[size], stackA, stackB))) {
            break;
          }
        }
      }
      return result;
    }
    // deep compare objects
    for (var key in a) {
      if (hasOwnProperty.call(a, key)) {
        // count the number of properties.
        size++;
        // deep compare each property value.
        if (!(hasOwnProperty.call(b, key) && isEqual(a[key], b[key], stackA, stackB))) {
          return false;
        }
      }
    }
    // ensure both objects have the same number of properties
    for (key in b) {
      // The JS engine in Adobe products, like InDesign, has a bug that causes
      // `!size--` to throw an error so it must be wrapped in parentheses.
      // https://github.com/documentcloud/underscore/issues/355
      if (hasOwnProperty.call(b, key) && !(size--)) {
        // `size` will be `-1` if `b` has more properties than `a`
        return false;
      }
    }
    // handle JScript [[DontEnum]] bug
    if (hasDontEnumBug) {
      while (++index < 7) {
        key = shadowed[index];
        if (hasOwnProperty.call(a, key) &&
            !(hasOwnProperty.call(b, key) && isEqual(a[key], b[key], stackA, stackB))) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Checks if `value` is, or can be coerced to, a finite number.
   *
   * Note: This is not the same as native `isFinite`, which will return true for
   * booleans and empty strings. See http://es5.github.com/#x15.1.2.5.
   *
   * @deprecated
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a finite number, else `false`.
   * @example
   *
   * _.isFinite(-101);
   * // => true
   *
   * _.isFinite('10');
   * // => true
   *
   * _.isFinite(true);
   * // => false
   *
   * _.isFinite('');
   * // => false
   *
   * _.isFinite(Infinity);
   * // => false
   */
  function isFinite(value) {
    return nativeIsFinite(value) && !nativeIsNaN(parseFloat(value));
  }

  /**
   * Checks if `value` is a function.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a function, else `false`.
   * @example
   *
   * _.isFunction(_);
   * // => true
   */
  function isFunction(value) {
    return typeof value == 'function';
  }
  // fallback for older versions of Chrome and Safari
  if (isFunction(/x/)) {
    isFunction = function(value) {
      return toString.call(value) == funcClass;
    };
  }

  /**
   * Checks if `value` is the language type of Object.
   * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject([1, 2, 3]);
   * // => true
   *
   * _.isObject(1);
   * // => false
   */
  function isObject(value) {
    // check if the value is the ECMAScript language type of Object
    // http://es5.github.com/#x8
    // and avoid a V8 bug
    // http://code.google.com/p/v8/issues/detail?id=2291
    return value ? objectTypes[typeof value] : false;
  }

  /**
   * Checks if `value` is `NaN`.
   *
   * Note: This is not the same as native `isNaN`, which will return true for
   * `undefined` and other values. See http://es5.github.com/#x15.1.2.4.
   *
   * @deprecated
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is `NaN`, else `false`.
   * @example
   *
   * _.isNaN(NaN);
   * // => true
   *
   * _.isNaN(new Number(NaN));
   * // => true
   *
   * isNaN(undefined);
   * // => true
   *
   * _.isNaN(undefined);
   * // => false
   */
  function isNaN(value) {
    // `NaN` as a primitive is the only value that is not equal to itself
    // (perform the [[Class]] check first to avoid errors with some host objects in IE)
    return toString.call(value) == numberClass && value != +value
  }

  /**
   * Checks if `value` is `null`.
   *
   * @deprecated
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is `null`, else `false`.
   * @example
   *
   * _.isNull(null);
   * // => true
   *
   * _.isNull(undefined);
   * // => false
   */
  function isNull(value) {
    return value === null;
  }

  /**
   * Checks if `value` is a number.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a number, else `false`.
   * @example
   *
   * _.isNumber(8.4 * 5);
   * // => true
   */
  function isNumber(value) {
    return toString.call(value) == numberClass;
  }

  /**
   * Checks if a given `value` is an object created by the `Object` constructor.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if `value` is a plain object, else `false`.
   * @example
   *
   * function Stooge(name, age) {
   *   this.name = name;
   *   this.age = age;
   * }
   *
   * _.isPlainObject(new Stooge('moe', 40));
   * // => false
   *
   * _.isPlainObject([1, 2, 3]);
   * // => false
   *
   * _.isPlainObject({ 'name': 'moe', 'age': 40 });
   * // => true
   */
  var isPlainObject = !getPrototypeOf ? shimIsPlainObject : function(value) {
    if (!(value && typeof value == 'object')) {
      return false;
    }
    var valueOf = value.valueOf,
        objProto = typeof valueOf == 'function' && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);

    return objProto
      ? value == objProto || (getPrototypeOf(value) == objProto && !isArguments(value))
      : shimIsPlainObject(value);
  };

  /**
   * Checks if `value` is a regular expression.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a regular expression, else `false`.
   * @example
   *
   * _.isRegExp(/moe/);
   * // => true
   */
  function isRegExp(value) {
    return toString.call(value) == regexpClass;
  }

  /**
   * Checks if `value` is a string.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a string, else `false`.
   * @example
   *
   * _.isString('moe');
   * // => true
   */
  function isString(value) {
    return toString.call(value) == stringClass;
  }

  /**
   * Checks if `value` is `undefined`.
   *
   * @deprecated
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is `undefined`, else `false`.
   * @example
   *
   * _.isUndefined(void 0);
   * // => true
   */
  function isUndefined(value) {
    return value === undefined;
  }

  /**
   * Creates an array composed of the own enumerable property names of `object`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns a new array of property names.
   * @example
   *
   * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
   * // => ['one', 'two', 'three'] (order is not guaranteed)
   */
  var keys = !nativeKeys ? shimKeys : function(object) {
    // avoid iterating over the `prototype` property
    return typeof object == 'function' && propertyIsEnumerable.call(object, 'prototype')
      ? shimKeys(object)
      : (isObject(object) ? nativeKeys(object) : []);
  };

  /**
   * Merges enumerable properties of the source object(s) into the `destination`
   * object. Subsequent sources will overwrite propery assignments of previous
   * sources.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The destination object.
   * @param {Object} [source1, source2, ...] The source objects.
   * @param- {Object} [indicator] Internally used to indicate that the `stack`
   *  argument is an array of traversed objects instead of another source object.
   * @param- {Array} [stackA=[]] Internally used to track traversed source objects.
   * @param- {Array} [stackB=[]] Internally used to associate values with their
   *  source counterparts.
   * @returns {Object} Returns the destination object.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe' },
   *   { 'name': 'larry' }
   * ];
   *
   * var ages = [
   *   { 'age': 40 },
   *   { 'age': 50 }
   * ];
   *
   * _.merge(stooges, ages);
   * // => [{ 'name': 'moe', 'age': 40 }, { 'name': 'larry', 'age': 50 }]
   */
  function merge(object, source, indicator) {
    var args = arguments,
        index = 0,
        length = 2,
        stackA = args[3],
        stackB = args[4];

    if (indicator !== objectRef) {
      stackA = [];
      stackB = [];
      length = args.length;
    }
    while (++index < length) {
      forOwn(args[index], function(source, key) {
        var found, isArr, value;
        if (source && ((isArr = isArray(source)) || isPlainObject(source))) {
          // avoid merging previously merged cyclic sources
          var stackLength = stackA.length;
          while (stackLength--) {
            found = stackA[stackLength] == source;
            if (found) {
              break;
            }
          }
          if (found) {
            object[key] = stackB[stackLength];
          }
          else {
            // add `source` and associated `value` to the stack of traversed objects
            stackA.push(source);
            stackB.push(value = (value = object[key], isArr)
              ? (isArray(value) ? value : [])
              : (isPlainObject(value) ? value : {})
            );
            // recursively merge objects and arrays (susceptible to call stack limits)
            object[key] = merge(value, source, objectRef, stackA, stackB);
          }
        } else if (source != null) {
          object[key] = source;
        }
      });
    }
    return object;
  }

  /**
   * Creates a shallow clone of `object` excluding the specified properties.
   * Property names may be specified as individual arguments or as arrays of
   * property names. If `callback` is passed, it will be executed for each property
   * in the `object`, omitting the properties `callback` returns truthy for. The
   * `callback` is bound to `thisArg` and invoked with three arguments; (value, key, object).
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The source object.
   * @param {Function|String} callback|[prop1, prop2, ...] The properties to omit
   *  or the function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns an object without the omitted properties.
   * @example
   *
   * _.omit({ 'name': 'moe', 'age': 40, 'userid': 'moe1' }, 'userid');
   * // => { 'name': 'moe', 'age': 40 }
   *
   * _.omit({ 'name': 'moe', '_hint': 'knucklehead', '_seed': '96c4eb' }, function(value, key) {
   *   return key.charAt(0) == '_';
   * });
   * // => { 'name': 'moe' }
   */
  function omit(object, callback, thisArg) {
    var isFunc = typeof callback == 'function',
        result = {};

    if (isFunc) {
      callback = createCallback(callback, thisArg);
    } else {
      var props = concat.apply(arrayRef, arguments);
    }
    forIn(object, function(value, key, object) {
      if (isFunc
            ? !callback(value, key, object)
            : indexOf(props, key, 1) < 0
          ) {
        result[key] = value;
      }
    });
    return result;
  }

  /**
   * Creates a two dimensional array of the given object's key-value pairs,
   * i.e. `[[key1, value1], [key2, value2]]`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns new array of key-value pairs.
   * @example
   *
   * _.pairs({ 'moe': 30, 'larry': 40, 'curly': 50 });
   * // => [['moe', 30], ['larry', 40], ['curly', 50]] (order is not guaranteed)
   */
  function pairs(object) {
    var result = [];
    forOwn(object, function(value, key) {
      result.push([key, value]);
    });
    return result;
  }

  /**
   * Creates a shallow clone of `object` composed of the specified properties.
   * Property names may be specified as individual arguments or as arrays of
   * property names. If `callback` is passed, it will be executed for each property
   * in the `object`, picking the properties `callback` returns truthy for. The
   * `callback` is bound to `thisArg` and invoked with three arguments; (value, key, object).
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The source object.
   * @param {Function|String} callback|[prop1, prop2, ...] The properties to pick
   *  or the function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns an object composed of the picked properties.
   * @example
   *
   * _.pick({ 'name': 'moe', 'age': 40, 'userid': 'moe1' }, 'name', 'age');
   * // => { 'name': 'moe', 'age': 40 }
   *
   * _.pick({ 'name': 'moe', '_hint': 'knucklehead', '_seed': '96c4eb' }, function(value, key) {
   *   return key.charAt(0) != '_';
   * });
   * // => { 'name': 'moe' }
   */
  function pick(object, callback, thisArg) {
    var result = {};
    if (typeof callback != 'function') {
      var index = 0,
          props = concat.apply(arrayRef, arguments),
          length = props.length;

      while (++index < length) {
        var key = props[index];
        if (key in object) {
          result[key] = object[key];
        }
      }
    } else {
      callback = createCallback(callback, thisArg);
      forIn(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result[key] = value;
        }
      });
    }
    return result;
  }

  /**
   * Creates an array composed of the own enumerable property values of `object`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns a new array of property values.
   * @example
   *
   * _.values({ 'one': 1, 'two': 2, 'three': 3 });
   * // => [1, 2, 3]
   */
  function values(object) {
    var result = [];
    forOwn(object, function(value) {
      result.push(value);
    });
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Checks if a given `target` element is present in a `collection` using strict
   * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
   * as the offset from the end of the collection.
   *
   * @static
   * @memberOf _
   * @alias include
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Mixed} target The value to check for.
   * @param {Number} [fromIndex=0] The index to search from.
   * @returns {Boolean} Returns `true` if the `target` element is found, else `false`.
   * @example
   *
   * _.contains([1, 2, 3], 1);
   * // => true
   *
   * _.contains([1, 2, 3], 1, 2);
   * // => false
   *
   * _.contains({ 'name': 'moe', 'age': 40 }, 'moe');
   * // => true
   *
   * _.contains('curly', 'ur');
   * // => true
   */
  function contains(collection, target, fromIndex) {
    var index = -1,
        length = collection ? collection.length : 0;

    fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex) || 0;
    if (typeof length == 'number') {
      return (isString(collection)
        ? collection.indexOf(target, fromIndex)
        : indexOf(collection, target, fromIndex)
      ) > -1;
    }
    return some(collection, function(value) {
      return ++index >= fromIndex && value === target;
    });
  }

  /**
   * Creates an object composed of keys returned from running each element of
   * `collection` through a `callback`. The corresponding value of each key is
   * the number of times the key was returned by `callback`. The `callback` is
   * bound to `thisArg` and invoked with three arguments; (value, index|key, collection).
   * The `callback` argument may also be the name of a property to count by (e.g. 'length').
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|String} callback|property The function called per iteration
   *  or property name to count by.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns the composed aggregate object.
   * @example
   *
   * _.countBy([4.3, 6.1, 6.4], function(num) { return Math.floor(num); });
   * // => { '4': 1, '6': 2 }
   *
   * _.countBy([4.3, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
   * // => { '4': 1, '6': 2 }
   *
   * _.countBy(['one', 'two', 'three'], 'length');
   * // => { '3': 2, '5': 1 }
   */
  function countBy(collection, callback, thisArg) {
    var result = {};
    callback = createCallback(callback, thisArg);
    forEach(collection, function(value, key, collection) {
      key = callback(value, key, collection);
      (hasOwnProperty.call(result, key) ? result[key]++ : result[key] = 1);
    });
    return result;
  }

  /**
   * Checks if the `callback` returns a truthy value for **all** elements of a
   * `collection`. The `callback` is bound to `thisArg` and invoked with three
   * arguments; (value, index|key, collection).
   *
   * @static
   * @memberOf _
   * @alias all
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Boolean} Returns `true` if all elements pass the callback check,
   *  else `false`.
   * @example
   *
   * _.every([true, 1, null, 'yes'], Boolean);
   * // => false
   */
  function every(collection, callback, thisArg) {
    var result = true;
    callback = createCallback(callback, thisArg);

    if (isArray(collection)) {
      var index = -1,
          length = collection.length;

      while (++index < length) {
        if (!(result = !!callback(collection[index], index, collection))) {
          break;
        }
      }
    } else {
      forEach(collection, function(value, index, collection) {
        return (result = !!callback(value, index, collection));
      });
    }
    return result;
  }

  /**
   * Examines each element in a `collection`, returning an array of all elements
   * the `callback` returns truthy for. The `callback` is bound to `thisArg` and
   * invoked with three arguments; (value, index|key, collection).
   *
   * @static
   * @memberOf _
   * @alias select
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of elements that passed the callback check.
   * @example
   *
   * var evens = _.filter([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
   * // => [2, 4, 6]
   */
  function filter(collection, callback, thisArg) {
    var result = [];
    callback = createCallback(callback, thisArg);
    forEach(collection, function(value, index, collection) {
      if (callback(value, index, collection)) {
        result.push(value);
      }
    });
    return result;
  }

  /**
   * Examines each element in a `collection`, returning the first one the `callback`
   * returns truthy for. The function returns as soon as it finds an acceptable
   * element, and does not iterate over the entire `collection`. The `callback` is
   * bound to `thisArg` and invoked with three arguments; (value, index|key, collection).
   *
   * @static
   * @memberOf _
   * @alias detect
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the element that passed the callback check,
   *  else `undefined`.
   * @example
   *
   * var even = _.find([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
   * // => 2
   */
  function find(collection, callback, thisArg) {
    var result;
    callback = createCallback(callback, thisArg);
    forEach(collection, function(value, index, collection) {
      if (callback(value, index, collection)) {
        result = value;
        return false;
      }
    });
    return result;
  }

  /**
   * Iterates over a `collection`, executing the `callback` for each element in
   * the `collection`. The `callback` is bound to `thisArg` and invoked with three
   * arguments; (value, index|key, collection). Callbacks may exit iteration early
   * by explicitly returning `false`.
   *
   * @static
   * @memberOf _
   * @alias each
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array|Object|String} Returns `collection`.
   * @example
   *
   * _([1, 2, 3]).forEach(alert).join(',');
   * // => alerts each number and returns '1,2,3'
   *
   * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, alert);
   * // => alerts each number (order is not guaranteed)
   */
  var forEach = createIterator(forEachIteratorOptions);

  /**
   * Creates an object composed of keys returned from running each element of
   * `collection` through a `callback`. The corresponding value of each key is an
   * array of elements passed to `callback` that returned the key. The `callback`
   * is bound to `thisArg` and invoked with three arguments; (value, index|key, collection).
   * The `callback` argument may also be the name of a property to group by (e.g. 'length').
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|String} callback|property The function called per iteration
   *  or property name to group by.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns the composed aggregate object.
   * @example
   *
   * _.groupBy([4.2, 6.1, 6.4], function(num) { return Math.floor(num); });
   * // => { '4': [4.2], '6': [6.1, 6.4] }
   *
   * _.groupBy([4.2, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
   * // => { '4': [4.2], '6': [6.1, 6.4] }
   *
   * _.groupBy(['one', 'two', 'three'], 'length');
   * // => { '3': ['one', 'two'], '5': ['three'] }
   */
  function groupBy(collection, callback, thisArg) {
    var result = {};
    callback = createCallback(callback, thisArg);
    forEach(collection, function(value, key, collection) {
      key = callback(value, key, collection);
      (hasOwnProperty.call(result, key) ? result[key] : result[key] = []).push(value);
    });
    return result;
  }

  /**
   * Invokes the method named by `methodName` on each element in the `collection`,
   * returning an array of the results of each invoked method. Additional arguments
   * will be passed to each invoked method. If `methodName` is a function it will
   * be invoked for, and `this` bound to, each element in the `collection`.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|String} methodName The name of the method to invoke or
   *  the function invoked per iteration.
   * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the method with.
   * @returns {Array} Returns a new array of the results of each invoked method.
   * @example
   *
   * _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
   * // => [[1, 5, 7], [1, 2, 3]]
   *
   * _.invoke([123, 456], String.prototype.split, '');
   * // => [['1', '2', '3'], ['4', '5', '6']]
   */
  function invoke(collection, methodName) {
    var args = slice.call(arguments, 2),
        isFunc = typeof methodName == 'function',
        result = [];

    forEach(collection, function(value) {
      result.push((isFunc ? methodName : value[methodName]).apply(value, args));
    });
    return result;
  }

  /**
   * Creates an array of values by running each element in the `collection`
   * through a `callback`. The `callback` is bound to `thisArg` and invoked with
   * three arguments; (value, index|key, collection).
   *
   * @static
   * @memberOf _
   * @alias collect
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of the results of each `callback` execution.
   * @example
   *
   * _.map([1, 2, 3], function(num) { return num * 3; });
   * // => [3, 6, 9]
   *
   * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
   * // => [3, 6, 9] (order is not guaranteed)
   */
  function map(collection, callback, thisArg) {
    var index = -1,
        length = collection ? collection.length : 0,
        result = Array(typeof length == 'number' ? length : 0);

    callback = createCallback(callback, thisArg);
    if (isArray(collection)) {
      while (++index < length) {
        result[index] = callback(collection[index], index, collection);
      }
    } else {
      forEach(collection, function(value, key, collection) {
        result[++index] = callback(value, key, collection);
      });
    }
    return result;
  }

  /**
   * Retrieves the maximum value of an `array`. If `callback` is passed,
   * it will be executed for each value in the `array` to generate the
   * criterion by which the value is ranked. The `callback` is bound to
   * `thisArg` and invoked with three arguments; (value, index, collection).
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} [callback] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the maximum value.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 },
   *   { 'name': 'curly', 'age': 60 }
   * ];
   *
   * _.max(stooges, function(stooge) { return stooge.age; });
   * // => { 'name': 'curly', 'age': 60 };
   */
  function max(collection, callback, thisArg) {
    var computed = -Infinity,
        index = -1,
        length = collection ? collection.length : 0,
        result = computed;

    if (callback || !isArray(collection)) {
      callback = !callback && isString(collection)
        ? charAtCallback
        : createCallback(callback, thisArg);

      forEach(collection, function(value, index, collection) {
        var current = callback(value, index, collection);
        if (current > computed) {
          computed = current;
          result = value;
        }
      });
    } else {
      while (++index < length) {
        if (collection[index] > result) {
          result = collection[index];
        }
      }
    }
    return result;
  }

  /**
   * Retrieves the minimum value of an `array`. If `callback` is passed,
   * it will be executed for each value in the `array` to generate the
   * criterion by which the value is ranked. The `callback` is bound to `thisArg`
   * and invoked with three arguments; (value, index, collection).
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} [callback] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the minimum value.
   * @example
   *
   * _.min([10, 5, 100, 2, 1000]);
   * // => 2
   */
  function min(collection, callback, thisArg) {
    var computed = Infinity,
        index = -1,
        length = collection ? collection.length : 0,
        result = computed;

    if (callback || !isArray(collection)) {
      callback = !callback && isString(collection)
        ? charAtCallback
        : createCallback(callback, thisArg);

      forEach(collection, function(value, index, collection) {
        var current = callback(value, index, collection);
        if (current < computed) {
          computed = current;
          result = value;
        }
      });
    } else {
      while (++index < length) {
        if (collection[index] < result) {
          result = collection[index];
        }
      }
    }
    return result;
  }

  /**
   * Retrieves the value of a specified property from all elements in
   * the `collection`.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {String} property The property to pluck.
   * @returns {Array} Returns a new array of property values.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 },
   *   { 'name': 'curly', 'age': 60 }
   * ];
   *
   * _.pluck(stooges, 'name');
   * // => ['moe', 'larry', 'curly']
   */
  function pluck(collection, property) {
    var result = [];
    forEach(collection, function(value) {
      result.push(value[property]);
    });
    return result;
  }

  /**
   * Boils down a `collection` to a single value. The initial state of the
   * reduction is `accumulator` and each successive step of it should be returned
   * by the `callback`. The `callback` is bound to `thisArg` and invoked with 4
   * arguments; for arrays they are (accumulator, value, index|key, collection).
   *
   * @static
   * @memberOf _
   * @alias foldl, inject
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [accumulator] Initial value of the accumulator.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the accumulated value.
   * @example
   *
   * var sum = _.reduce([1, 2, 3], function(memo, num) { return memo + num; });
   * // => 6
   */
  function reduce(collection, callback, accumulator, thisArg) {
    var noaccum = arguments.length < 3;
    callback = createCallback(callback, thisArg);
    forEach(collection, function(value, index, collection) {
      accumulator = noaccum
        ? (noaccum = false, value)
        : callback(accumulator, value, index, collection)
    });
    return accumulator;
  }

  /**
   * The right-associative version of `_.reduce`.
   *
   * @static
   * @memberOf _
   * @alias foldr
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [accumulator] Initial value of the accumulator.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the accumulated value.
   * @example
   *
   * var list = [[0, 1], [2, 3], [4, 5]];
   * var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
   * // => [4, 5, 2, 3, 0, 1]
   */
  function reduceRight(collection, callback, accumulator, thisArg) {
    var iteratee = collection,
        length = collection ? collection.length : 0,
        noaccum = arguments.length < 3;

    if (typeof length != 'number') {
      var props = keys(collection);
      length = props.length;
    } else if (noCharByIndex && isString(collection)) {
      iteratee = collection.split('');
    }
    forEach(collection, function(value, index, collection) {
      index = props ? props[--length] : --length;
      accumulator = noaccum
        ? (noaccum = false, iteratee[index])
        : callback.call(thisArg, accumulator, iteratee[index], index, collection);
    });
    return accumulator;
  }

  /**
   * The opposite of `_.filter`, this method returns the values of a
   * `collection` that `callback` does **not** return truthy for.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of elements that did **not** pass the
   *  callback check.
   * @example
   *
   * var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
   * // => [1, 3, 5]
   */
  function reject(collection, callback, thisArg) {
    callback = createCallback(callback, thisArg);
    return filter(collection, function(value, index, collection) {
      return !callback(value, index, collection);
    });
  }

  /**
   * Creates an array of shuffled `array` values, using a version of the
   * Fisher-Yates shuffle. See http://en.wikipedia.org/wiki/Fisher-Yates_shuffle.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to shuffle.
   * @returns {Array} Returns a new shuffled collection.
   * @example
   *
   * _.shuffle([1, 2, 3, 4, 5, 6]);
   * // => [4, 1, 6, 3, 5, 2]
   */
  function shuffle(collection) {
    var index = -1,
        result = Array(collection ? collection.length : 0);

    forEach(collection, function(value) {
      var rand = floor(nativeRandom() * (++index + 1));
      result[index] = result[rand];
      result[rand] = value;
    });
    return result;
  }

  /**
   * Gets the size of the `collection` by returning `collection.length` for arrays
   * and array-like objects or the number of own enumerable properties for objects.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to inspect.
   * @returns {Number} Returns `collection.length` or number of own enumerable properties.
   * @example
   *
   * _.size([1, 2]);
   * // => 2
   *
   * _.size({ 'one': 1, 'two': 2, 'three': 3 });
   * // => 3
   *
   * _.size('curly');
   * // => 5
   */
  function size(collection) {
    var length = collection ? collection.length : 0;
    return typeof length == 'number' ? length : keys(collection).length;
  }

  /**
   * Checks if the `callback` returns a truthy value for **any** element of a
   * `collection`. The function returns as soon as it finds passing value, and
   * does not iterate over the entire `collection`. The `callback` is bound to
   * `thisArg` and invoked with three arguments; (value, index|key, collection).
   *
   * @static
   * @memberOf _
   * @alias any
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Boolean} Returns `true` if any element passes the callback check,
   *  else `false`.
   * @example
   *
   * _.some([null, 0, 'yes', false]);
   * // => true
   */
  function some(collection, callback, thisArg) {
    var result;
    callback = createCallback(callback, thisArg);

    if (isArray(collection)) {
      var index = -1,
          length = collection.length;

      while (++index < length) {
        if (result = callback(collection[index], index, collection)) {
          break;
        }
      }
    } else {
      forEach(collection, function(value, index, collection) {
        return !(result = callback(value, index, collection));
      });
    }
    return !!result;
  }

  /**
   * Creates an array, stable sorted in ascending order by the results of
   * running each element of `collection` through a `callback`. The `callback`
   * is bound to `thisArg` and invoked with three arguments; (value, index|key, collection).
   * The `callback` argument may also be the name of a property to sort by (e.g. 'length').
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|String} callback|property The function called per iteration
   *  or property name to sort by.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of sorted elements.
   * @example
   *
   * _.sortBy([1, 2, 3], function(num) { return Math.sin(num); });
   * // => [3, 1, 2]
   *
   * _.sortBy([1, 2, 3], function(num) { return this.sin(num); }, Math);
   * // => [3, 1, 2]
   *
   * _.sortBy(['larry', 'brendan', 'moe'], 'length');
   * // => ['moe', 'larry', 'brendan']
   */
  function sortBy(collection, callback, thisArg) {
    var result = [];
    callback = createCallback(callback, thisArg);
    forEach(collection, function(value, index, collection) {
      result.push({
        'criteria': callback(value, index, collection),
        'index': index,
        'value': value
      });
    });

    var length = result.length;
    result.sort(compareAscending);
    while (length--) {
      result[length] = result[length].value;
    }
    return result;
  }

  /**
   * Converts the `collection`, to an array.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to convert.
   * @returns {Array} Returns the new converted array.
   * @example
   *
   * (function() { return _.toArray(arguments).slice(1); })(1, 2, 3, 4);
   * // => [2, 3, 4]
   */
  function toArray(collection) {
    if (collection && typeof collection.length == 'number') {
      return (noArraySliceOnStrings ? isString(collection) : typeof collection == 'string')
        ? collection.split('')
        : slice.call(collection);
    }
    return values(collection);
  }

  /**
   * Examines each element in a `collection`, returning an array of all elements
   * that contain the given `properties`.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Object} properties The object of property values to filter by.
   * @returns {Array} Returns a new array of elements that contain the given `properties`.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 },
   *   { 'name': 'curly', 'age': 60 }
   * ];
   *
   * _.where(stooges, { 'age': 40 });
   * // => [{ 'name': 'moe', 'age': 40 }]
   */
  function where(collection, properties) {
    var props = [];
    forIn(properties, function(value, prop) {
      props.push(prop);
    });
    return filter(collection, function(object) {
      var length = props.length;
      while (length--) {
        var result = object[props[length]] === properties[props[length]];
        if (!result) {
          break;
        }
      }
      return !!result;
    });
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Creates an array with all falsey values of `array` removed. The values
   * `false`, `null`, `0`, `""`, `undefined` and `NaN` are all falsey.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to compact.
   * @returns {Array} Returns a new filtered array.
   * @example
   *
   * _.compact([0, 1, false, 2, '', 3]);
   * // => [1, 2, 3]
   */
  function compact(array) {
    var index = -1,
        length = array ? array.length : 0,
        result = [];

    while (++index < length) {
      var value = array[index];
      if (value) {
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Creates an array of `array` elements not present in the other arrays
   * using strict equality for comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to process.
   * @param {Array} [array1, array2, ...] Arrays to check.
   * @returns {Array} Returns a new array of `array` elements not present in the
   *  other arrays.
   * @example
   *
   * _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
   * // => [1, 3, 4]
   */
  function difference(array) {
    var index = -1,
        length = array ? array.length : 0,
        flattened = concat.apply(arrayRef, arguments),
        contains = cachedContains(flattened, length),
        result = [];

    while (++index < length) {
      var value = array[index];
      if (!contains(value)) {
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Gets the first element of the `array`. Pass `n` to return the first `n`
   * elements of the `array`.
   *
   * @static
   * @memberOf _
   * @alias head, take
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Number} [n] The number of elements to return.
   * @param- {Object} [guard] Internally used to allow this method to work with
   *  others like `_.map` without using their callback `index` argument for `n`.
   * @returns {Mixed} Returns the first element or an array of the first `n`
   *  elements of `array`.
   * @example
   *
   * _.first([5, 4, 3, 2, 1]);
   * // => 5
   */
  function first(array, n, guard) {
    if (array) {
      return (n == null || guard) ? array[0] : slice.call(array, 0, n);
    }
  }

  /**
   * Flattens a nested array (the nesting can be to any depth). If `shallow` is
   * truthy, `array` will only be flattened a single level.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to compact.
   * @param {Boolean} shallow A flag to indicate only flattening a single level.
   * @returns {Array} Returns a new flattened array.
   * @example
   *
   * _.flatten([1, [2], [3, [[4]]]]);
   * // => [1, 2, 3, 4];
   *
   * _.flatten([1, [2], [3, [[4]]]], true);
   * // => [1, 2, 3, [[4]]];
   */
  function flatten(array, shallow) {
    var index = -1,
        length = array ? array.length : 0,
        result = [];

    while (++index < length) {
      var value = array[index];

      // recursively flatten arrays (susceptible to call stack limits)
      if (isArray(value)) {
        push.apply(result, shallow ? value : flatten(value));
      } else {
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Gets the index at which the first occurrence of `value` is found using
   * strict equality for comparisons, i.e. `===`. If the `array` is already
   * sorted, passing `true` for `fromIndex` will run a faster binary search.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to search.
   * @param {Mixed} value The value to search for.
   * @param {Boolean|Number} [fromIndex=0] The index to search from or `true` to
   *  perform a binary search on a sorted `array`.
   * @returns {Number} Returns the index of the matched value or `-1`.
   * @example
   *
   * _.indexOf([1, 2, 3, 1, 2, 3], 2);
   * // => 1
   *
   * _.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
   * // => 4
   *
   * _.indexOf([1, 1, 2, 2, 3, 3], 2, true);
   * // => 2
   */
  function indexOf(array, value, fromIndex) {
    var index = -1,
        length = array ? array.length : 0;

    if (typeof fromIndex == 'number') {
      index = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex || 0) - 1;
    } else if (fromIndex) {
      index = sortedIndex(array, value);
      return array[index] === value ? index : -1;
    }
    while (++index < length) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * Gets all but the last element of `array`. Pass `n` to exclude the last `n`
   * elements from the result.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Number} [n=1] The number of elements to exclude.
   * @param- {Object} [guard] Internally used to allow this method to work with
   *  others like `_.map` without using their callback `index` argument for `n`.
   * @returns {Array} Returns all but the last element or `n` elements of `array`.
   * @example
   *
   * _.initial([3, 2, 1]);
   * // => [3, 2]
   */
  function initial(array, n, guard) {
    return array
      ? slice.call(array, 0, -((n == null || guard) ? 1 : n))
      : [];
  }

  /**
   * Computes the intersection of all the passed-in arrays using strict equality
   * for comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} [array1, array2, ...] Arrays to process.
   * @returns {Array} Returns a new array of unique elements, in order, that are
   *  present in **all** of the arrays.
   * @example
   *
   * _.intersection([1, 2, 3], [101, 2, 1, 10], [2, 1]);
   * // => [1, 2]
   */
  function intersection(array) {
    var args = arguments,
        argsLength = args.length,
        cache = {},
        result = [];

    forEach(array, function(value) {
      if (indexOf(result, value) < 0) {
        var length = argsLength;
        while (--length) {
          if (!(cache[length] || (cache[length] = cachedContains(args[length])))(value)) {
            return;
          }
        }
        result.push(value);
      }
    });
    return result;
  }

  /**
   * Gets the last element of the `array`. Pass `n` to return the last `n`
   * elements of the `array`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Number} [n] The number of elements to return.
   * @param- {Object} [guard] Internally used to allow this method to work with
   *  others like `_.map` without using their callback `index` argument for `n`.
   * @returns {Mixed} Returns the last element or an array of the last `n`
   *  elements of `array`.
   * @example
   *
   * _.last([3, 2, 1]);
   * // => 1
   */
  function last(array, n, guard) {
    if (array) {
      var length = array.length;
      return (n == null || guard) ? array[length - 1] : slice.call(array, -n || length);
    }
  }

  /**
   * Gets the index at which the last occurrence of `value` is found using strict
   * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
   * as the offset from the end of the collection.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to search.
   * @param {Mixed} value The value to search for.
   * @param {Number} [fromIndex=array.length-1] The index to search from.
   * @returns {Number} Returns the index of the matched value or `-1`.
   * @example
   *
   * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
   * // => 4
   *
   * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2, 3);
   * // => 1
   */
  function lastIndexOf(array, value, fromIndex) {
    var index = array ? array.length : 0;
    if (typeof fromIndex == 'number') {
      index = (fromIndex < 0 ? nativeMax(0, index + fromIndex) : nativeMin(fromIndex, index - 1)) + 1;
    }
    while (index--) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * Creates an object composed from arrays of `keys` and `values`. Pass either
   * a single two dimensional array, i.e. `[[key1, value1], [key2, value2]]`, or
   * two arrays, one of `keys` and one of corresponding `values`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} keys The array of keys.
   * @param {Array} [values=[]] The array of values.
   * @returns {Object} Returns an object composed of the given keys and
   *  corresponding values.
   * @example
   *
   * _.object(['moe', 'larry', 'curly'], [30, 40, 50]);
   * // => { 'moe': 30, 'larry': 40, 'curly': 50 }
   */
  function object(keys, values) {
    var index = -1,
        length = keys ? keys.length : 0,
        result = {};

    while (++index < length) {
      var key = keys[index];
      if (values) {
        result[key] = values[index];
      } else {
        result[key[0]] = key[1];
      }
    }
    return result;
  }

  /**
   * Creates an array of numbers (positive and/or negative) progressing from
   * `start` up to but not including `stop`. This method is a port of Python's
   * `range()` function. See http://docs.python.org/library/functions.html#range.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Number} [start=0] The start of the range.
   * @param {Number} end The end of the range.
   * @param {Number} [step=1] The value to increment or descrement by.
   * @returns {Array} Returns a new range array.
   * @example
   *
   * _.range(10);
   * // => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
   *
   * _.range(1, 11);
   * // => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
   *
   * _.range(0, 30, 5);
   * // => [0, 5, 10, 15, 20, 25]
   *
   * _.range(0, -10, -1);
   * // => [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]
   *
   * _.range(0);
   * // => []
   */
  function range(start, end, step) {
    start = +start || 0;
    step = +step || 1;

    if (end == null) {
      end = start;
      start = 0;
    }
    // use `Array(length)` so V8 will avoid the slower "dictionary" mode
    // http://www.youtube.com/watch?v=XAqIpGU8ZZk#t=16m27s
    var index = -1,
        length = nativeMax(0, ceil((end - start) / step)),
        result = Array(length);

    while (++index < length) {
      result[index] = start;
      start += step;
    }
    return result;
  }

  /**
   * The opposite of `_.initial`, this method gets all but the first value of
   * `array`. Pass `n` to exclude the first `n` values from the result.
   *
   * @static
   * @memberOf _
   * @alias drop, tail
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Number} [n=1] The number of elements to exclude.
   * @param- {Object} [guard] Internally used to allow this method to work with
   *  others like `_.map` without using their callback `index` argument for `n`.
   * @returns {Array} Returns all but the first value or `n` values of `array`.
   * @example
   *
   * _.rest([3, 2, 1]);
   * // => [2, 1]
   */
  function rest(array, n, guard) {
    return array
      ? slice.call(array, (n == null || guard) ? 1 : n)
      : [];
  }

  /**
   * Uses a binary search to determine the smallest index at which the `value`
   * should be inserted into `array` in order to maintain the sort order of the
   * sorted `array`. If `callback` is passed, it will be executed for `value` and
   * each element in `array` to compute their sort ranking. The `callback` is
   * bound to `thisArg` and invoked with one argument; (value). The `callback`
   * argument may also be the name of a property to order by.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to iterate over.
   * @param {Mixed} value The value to evaluate.
   * @param {Function|String} [callback=identity|property] The function called
   *  per iteration or property name to order by.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Number} Returns the index at which the value should be inserted
   *  into `array`.
   * @example
   *
   * _.sortedIndex([20, 30, 50], 40);
   * // => 2
   *
   * _.sortedIndex([{ 'x': 20 }, { 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
   * // => 2
   *
   * var dict = {
   *   'wordToNumber': { 'twenty': 20, 'thirty': 30, 'fourty': 40, 'fifty': 50 }
   * };
   *
   * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
   *   return dict.wordToNumber[word];
   * });
   * // => 2
   *
   * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
   *   return this.wordToNumber[word];
   * }, dict);
   * // => 2
   */
  function sortedIndex(array, value, callback, thisArg) {
    var low = 0,
        high = array ? array.length : low;

    // explicitly reference `identity` for better engine inlining
    callback = callback ? createCallback(callback, thisArg) : identity;
    value = callback(value);
    while (low < high) {
      var mid = (low + high) >>> 1;
      callback(array[mid]) < value
        ? low = mid + 1
        : high = mid;
    }
    return low;
  }

  /**
   * Computes the union of the passed-in arrays using strict equality for
   * comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} [array1, array2, ...] Arrays to process.
   * @returns {Array} Returns a new array of unique values, in order, that are
   *  present in one or more of the arrays.
   * @example
   *
   * _.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
   * // => [1, 2, 3, 101, 10]
   */
  function union() {
    return uniq(concat.apply(arrayRef, arguments));
  }

  /**
   * Creates a duplicate-value-free version of the `array` using strict equality
   * for comparisons, i.e. `===`. If the `array` is already sorted, passing `true`
   * for `isSorted` will run a faster algorithm. If `callback` is passed, each
   * element of `array` is passed through a callback` before uniqueness is computed.
   * The `callback` is bound to `thisArg` and invoked with three arguments; (value, index, array).
   *
   * @static
   * @memberOf _
   * @alias unique
   * @category Arrays
   * @param {Array} array The array to process.
   * @param {Boolean} [isSorted=false] A flag to indicate that the `array` is already sorted.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a duplicate-value-free array.
   * @example
   *
   * _.uniq([1, 2, 1, 3, 1]);
   * // => [1, 2, 3]
   *
   * _.uniq([1, 1, 2, 2, 3], true);
   * // => [1, 2, 3]
   *
   * _.uniq([1, 2, 1.5, 3, 2.5], function(num) { return Math.floor(num); });
   * // => [1, 2, 3]
   *
   * _.uniq([1, 2, 1.5, 3, 2.5], function(num) { return this.floor(num); }, Math);
   * // => [1, 2, 3]
   */
  function uniq(array, isSorted, callback, thisArg) {
    var index = -1,
        length = array ? array.length : 0,
        result = [],
        seen = result;

    // juggle arguments
    if (typeof isSorted == 'function') {
      thisArg = callback;
      callback = isSorted;
      isSorted = false;
    }
    // init value cache for large arrays
    var isLarge = !isSorted && length > 74;
    if (isLarge) {
      var cache = {};
    }
    if (callback) {
      seen = [];
      callback = createCallback(callback, thisArg);
    }
    while (++index < length) {
      var value = array[index],
          computed = callback ? callback(value, index, array) : value;

      if (isLarge) {
        // manually coerce `computed` to a string because `hasOwnProperty`, in
        // some older versions of Firefox, coerces objects incorrectly
        seen = hasOwnProperty.call(cache, computed + '') ? cache[computed] : (cache[computed] = []);
      }
      if (isSorted
            ? !index || seen[seen.length - 1] !== computed
            : indexOf(seen, computed) < 0
          ) {
        if (callback || isLarge) {
          seen.push(computed);
        }
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Creates an array with all occurrences of the passed values removed using
   * strict equality for comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to filter.
   * @param {Mixed} [value1, value2, ...] Values to remove.
   * @returns {Array} Returns a new filtered array.
   * @example
   *
   * _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
   * // => [2, 3, 4]
   */
  function without(array) {
    var index = -1,
        length = array ? array.length : 0,
        contains = cachedContains(arguments, 1, 20),
        result = [];

    while (++index < length) {
      var value = array[index];
      if (!contains(value)) {
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Groups the elements of each array at their corresponding indexes. Useful for
   * separate data sources that are coordinated through matching array indexes.
   * For a matrix of nested arrays, `_.zip.apply(...)` can transpose the matrix
   * in a similar fashion.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} [array1, array2, ...] Arrays to process.
   * @returns {Array} Returns a new array of grouped elements.
   * @example
   *
   * _.zip(['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]);
   * // => [['moe', 30, true], ['larry', 40, false], ['curly', 50, false]]
   */
  function zip(array) {
    var index = -1,
        length = array ? max(pluck(arguments, 'length')) : 0,
        result = Array(length);

    while (++index < length) {
      result[index] = pluck(arguments, index);
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a function that is restricted to executing `func` only after it is
   * called `n` times. The `func` is executed with the `this` binding of the
   * created function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Number} n The number of times the function must be called before
   * it is executed.
   * @param {Function} func The function to restrict.
   * @returns {Function} Returns the new restricted function.
   * @example
   *
   * var renderNotes = _.after(notes.length, render);
   * _.forEach(notes, function(note) {
   *   note.asyncSave({ 'success': renderNotes });
   * });
   * // `renderNotes` is run once, after all notes have saved
   */
  function after(n, func) {
    if (n < 1) {
      return func();
    }
    return function() {
      if (--n < 1) {
        return func.apply(this, arguments);
      }
    };
  }

  /**
   * Creates a function that, when called, invokes `func` with the `this`
   * binding of `thisArg` and prepends any additional `bind` arguments to those
   * passed to the bound function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to bind.
   * @param {Mixed} [thisArg] The `this` binding of `func`.
   * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
   * @returns {Function} Returns the new bound function.
   * @example
   *
   * var func = function(greeting) {
   *   return greeting + ' ' + this.name;
   * };
   *
   * func = _.bind(func, { 'name': 'moe' }, 'hi');
   * func();
   * // => 'hi moe'
   */
  function bind(func, thisArg) {
    // use `Function#bind` if it exists and is fast
    // (in V8 `Function#bind` is slower except when partially applied)
    return isBindFast || (nativeBind && arguments.length > 2)
      ? nativeBind.call.apply(nativeBind, arguments)
      : createBound(func, thisArg, slice.call(arguments, 2));
  }

  /**
   * Binds methods on `object` to `object`, overwriting the existing method.
   * If no method names are provided, all the function properties of `object`
   * will be bound.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Object} object The object to bind and assign the bound methods to.
   * @param {String} [methodName1, methodName2, ...] Method names on the object to bind.
   * @returns {Object} Returns `object`.
   * @example
   *
   * var buttonView = {
   *  'label': 'lodash',
   *  'onClick': function() { alert('clicked: ' + this.label); }
   * };
   *
   * _.bindAll(buttonView);
   * jQuery('#lodash_button').on('click', buttonView.onClick);
   * // => When the button is clicked, `this.label` will have the correct value
   */
  function bindAll(object) {
    var funcs = arguments,
        index = funcs.length > 1 ? 0 : (funcs = functions(object), -1),
        length = funcs.length;

    while (++index < length) {
      var key = funcs[index];
      object[key] = bind(object[key], object);
    }
    return object;
  }

  /**
   * Creates a function that is the composition of the passed functions,
   * where each function consumes the return value of the function that follows.
   * In math terms, composing the functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
   * Each function is executed with the `this` binding of the composed function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} [func1, func2, ...] Functions to compose.
   * @returns {Function} Returns the new composed function.
   * @example
   *
   * var greet = function(name) { return 'hi: ' + name; };
   * var exclaim = function(statement) { return statement + '!'; };
   * var welcome = _.compose(exclaim, greet);
   * welcome('moe');
   * // => 'hi: moe!'
   */
  function compose() {
    var funcs = arguments;
    return function() {
      var args = arguments,
          length = funcs.length;

      while (length--) {
        args = [funcs[length].apply(this, args)];
      }
      return args[0];
    };
  }

  /**
   * Creates a function that will delay the execution of `func` until after
   * `wait` milliseconds have elapsed since the last time it was invoked. Pass
   * `true` for `immediate` to cause debounce to invoke `func` on the leading,
   * instead of the trailing, edge of the `wait` timeout. Subsequent calls to
   * the debounced function will return the result of the last `func` call.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to debounce.
   * @param {Number} wait The number of milliseconds to delay.
   * @param {Boolean} immediate A flag to indicate execution is on the leading
   *  edge of the timeout.
   * @returns {Function} Returns the new debounced function.
   * @example
   *
   * var lazyLayout = _.debounce(calculateLayout, 300);
   * jQuery(window).on('resize', lazyLayout);
   */
  function debounce(func, wait, immediate) {
    var args,
        result,
        thisArg,
        timeoutId;

    function delayed() {
      timeoutId = null;
      if (!immediate) {
        result = func.apply(thisArg, args);
      }
    }
    return function() {
      var isImmediate = immediate && !timeoutId;
      args = arguments;
      thisArg = this;

      clearTimeout(timeoutId);
      timeoutId = setTimeout(delayed, wait);

      if (isImmediate) {
        result = func.apply(thisArg, args);
      }
      return result;
    };
  }

  /**
   * Executes the `func` function after `wait` milliseconds. Additional arguments
   * will be passed to `func` when it is invoked.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to delay.
   * @param {Number} wait The number of milliseconds to delay execution.
   * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the function with.
   * @returns {Number} Returns the `setTimeout` timeout id.
   * @example
   *
   * var log = _.bind(console.log, console);
   * _.delay(log, 1000, 'logged later');
   * // => 'logged later' (Appears after one second.)
   */
  function delay(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function() { func.apply(undefined, args); }, wait);
  }

  /**
   * Defers executing the `func` function until the current call stack has cleared.
   * Additional arguments will be passed to `func` when it is invoked.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to defer.
   * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the function with.
   * @returns {Number} Returns the `setTimeout` timeout id.
   * @example
   *
   * _.defer(function() { alert('deferred'); });
   * // returns from the function before `alert` is called
   */
  function defer(func) {
    var args = slice.call(arguments, 1);
    return setTimeout(function() { func.apply(undefined, args); }, 1);
  }

  /**
   * Creates a function that, when called, invokes `object[methodName]` and
   * prepends any additional `lateBind` arguments to those passed to the bound
   * function. This method differs from `_.bind` by allowing bound functions to
   * reference methods that will be redefined or don't yet exist.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Object} object The object the method belongs to.
   * @param {String} methodName The method name.
   * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
   * @returns {Function} Returns the new bound function.
   * @example
   *
   * var object = {
   *   'name': 'moe',
   *   'greet': function(greeting) {
   *     return greeting + ' ' + this.name;
   *   }
   * };
   *
   * var func = _.lateBind(object, 'greet', 'hi');
   * func();
   * // => 'hi moe'
   *
   * object.greet = function(greeting) {
   *   return greeting + ', ' + this.name + '!';
   * };
   *
   * func();
   * // => 'hi, moe!'
   */
  function lateBind(object, methodName) {
    return createBound(methodName, object, slice.call(arguments, 2));
  }

  /**
   * Creates a function that memoizes the result of `func`. If `resolver` is
   * passed, it will be used to determine the cache key for storing the result
   * based on the arguments passed to the memoized function. By default, the first
   * argument passed to the memoized function is used as the cache key. The `func`
   * is executed with the `this` binding of the memoized function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to have its output memoized.
   * @param {Function} [resolver] A function used to resolve the cache key.
   * @returns {Function} Returns the new memoizing function.
   * @example
   *
   * var fibonacci = _.memoize(function(n) {
   *   return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
   * });
   */
  function memoize(func, resolver) {
    var cache = {};
    return function() {
      var key = resolver ? resolver.apply(this, arguments) : arguments[0];
      return hasOwnProperty.call(cache, key)
        ? cache[key]
        : (cache[key] = func.apply(this, arguments));
    };
  }

  /**
   * Creates a function that is restricted to execute `func` once. Repeat calls to
   * the function will return the value of the first call. The `func` is executed
   * with the `this` binding of the created function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to restrict.
   * @returns {Function} Returns the new restricted function.
   * @example
   *
   * var initialize = _.once(createApplication);
   * initialize();
   * initialize();
   * // Application is only created once.
   */
  function once(func) {
    var result,
        ran = false;

    return function() {
      if (ran) {
        return result;
      }
      ran = true;
      result = func.apply(this, arguments);

      // clear the `func` variable so the function may be garbage collected
      func = null;
      return result;
    };
  }

  /**
   * Creates a function that, when called, invokes `func` with any additional
   * `partial` arguments prepended to those passed to the new function. This
   * method is similar to `bind`, except it does **not** alter the `this` binding.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to partially apply arguments to.
   * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
   * @returns {Function} Returns the new partially applied function.
   * @example
   *
   * var greet = function(greeting, name) { return greeting + ': ' + name; };
   * var hi = _.partial(greet, 'hi');
   * hi('moe');
   * // => 'hi: moe'
   */
  function partial(func) {
    return createBound(func, slice.call(arguments, 1));
  }

  /**
   * Creates a function that, when executed, will only call the `func`
   * function at most once per every `wait` milliseconds. If the throttled
   * function is invoked more than once during the `wait` timeout, `func` will
   * also be called on the trailing edge of the timeout. Subsequent calls to the
   * throttled function will return the result of the last `func` call.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to throttle.
   * @param {Number} wait The number of milliseconds to throttle executions to.
   * @returns {Function} Returns the new throttled function.
   * @example
   *
   * var throttled = _.throttle(updatePosition, 100);
   * jQuery(window).on('scroll', throttled);
   */
  function throttle(func, wait) {
    var args,
        result,
        thisArg,
        timeoutId,
        lastCalled = 0;

    function trailingCall() {
      lastCalled = new Date;
      timeoutId = null;
      result = func.apply(thisArg, args);
    }
    return function() {
      var now = new Date,
          remaining = wait - (now - lastCalled);

      args = arguments;
      thisArg = this;

      if (remaining <= 0) {
        clearTimeout(timeoutId);
        lastCalled = now;
        result = func.apply(thisArg, args);
      }
      else if (!timeoutId) {
        timeoutId = setTimeout(trailingCall, remaining);
      }
      return result;
    };
  }

  /**
   * Creates a function that passes `value` to the `wrapper` function as its
   * first argument. Additional arguments passed to the function are appended
   * to those passed to the `wrapper` function. The `wrapper` is executed with
   * the `this` binding of the created function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Mixed} value The value to wrap.
   * @param {Function} wrapper The wrapper function.
   * @returns {Function} Returns the new function.
   * @example
   *
   * var hello = function(name) { return 'hello ' + name; };
   * hello = _.wrap(hello, function(func) {
   *   return 'before, ' + func('moe') + ', after';
   * });
   * hello();
   * // => 'before, hello moe, after'
   */
  function wrap(value, wrapper) {
    return function() {
      var args = [value];
      push.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Converts the characters `&`, `<`, `>`, `"`, and `'` in `string` to their
   * corresponding HTML entities.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {String} string The string to escape.
   * @returns {String} Returns the escaped string.
   * @example
   *
   * _.escape('Moe, Larry & Curly');
   * // => "Moe, Larry &amp; Curly"
   */
  function escape(string) {
    return string == null ? '' : (string + '').replace(reUnescapedHtml, escapeHtmlChar);
  }

  /**
   * This function returns the first argument passed to it.
   *
   * Note: It is used throughout Lo-Dash as a default callback.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Mixed} value Any value.
   * @returns {Mixed} Returns `value`.
   * @example
   *
   * var moe = { 'name': 'moe' };
   * moe === _.identity(moe);
   * // => true
   */
  function identity(value) {
    return value;
  }

  /**
   * Adds functions properties of `object` to the `lodash` function and chainable
   * wrapper.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} object The object of function properties to add to `lodash`.
   * @example
   *
   * _.mixin({
   *   'capitalize': function(string) {
   *     return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
   *   }
   * });
   *
   * _.capitalize('larry');
   * // => 'Larry'
   *
   * _('curly').capitalize();
   * // => 'Curly'
   */
  function mixin(object) {
    forEach(functions(object), function(methodName) {
      var func = lodash[methodName] = object[methodName];

      lodash.prototype[methodName] = function() {
        var args = [this.__wrapped__];
        push.apply(args, arguments);

        var result = func.apply(lodash, args);
        if (this.__chain__) {
          result = new lodash(result);
          result.__chain__ = true;
        }
        return result;
      };
    });
  }

  /**
   * Reverts the '_' variable to its previous value and returns a reference to
   * the `lodash` function.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @returns {Function} Returns the `lodash` function.
   * @example
   *
   * var lodash = _.noConflict();
   */
  function noConflict() {
    window._ = oldDash;
    return this;
  }

  /**
   * Produces a random number between `min` and `max` (inclusive). If only one
   * argument is passed, a number between `0` and the given number will be returned.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Number} [min=0] The minimum possible value.
   * @param {Number} [max=1] The maximum possible value.
   * @returns {Number} Returns a random number.
   * @example
   *
   * _.random(0, 5);
   * // => a number between 1 and 5
   *
   * _.random(5);
   * // => also a number between 1 and 5
   */
  function random(min, max) {
    if (min == null && max == null) {
      max = 1;
    }
    min = +min || 0;
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + floor(nativeRandom() * ((+max || 0) - min + 1));
  }

  /**
   * Resolves the value of `property` on `object`. If `property` is a function
   * it will be invoked and its result returned, else the property value is
   * returned. If `object` is falsey, then `null` is returned.
   *
   * @deprecated
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} object The object to inspect.
   * @param {String} property The property to get the value of.
   * @returns {Mixed} Returns the resolved value.
   * @example
   *
   * var object = {
   *   'cheese': 'crumpets',
   *   'stuff': function() {
   *     return 'nonsense';
   *   }
   * };
   *
   * _.result(object, 'cheese');
   * // => 'crumpets'
   *
   * _.result(object, 'stuff');
   * // => 'nonsense'
   */
  function result(object, property) {
    // based on Backbone's private `getValue` function
    // https://github.com/documentcloud/backbone/blob/0.9.2/backbone.js#L1419-1424
    var value = object ? object[property] : null;
    return isFunction(value) ? object[property]() : value;
  }

  /**
   * A micro-templating method that handles arbitrary delimiters, preserves
   * whitespace, and correctly escapes quotes within interpolated code.
   *
   * Note: In the development build `_.template` utilizes sourceURLs for easier
   * debugging. See http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
   *
   * Note: Lo-Dash may be used in Chrome extensions by either creating a `lodash csp`
   * build and avoiding `_.template` use, or loading Lo-Dash in a sandboxed page.
   * See http://developer.chrome.com/trunk/extensions/sandboxingEval.html
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {String} text The template text.
   * @param {Obect} data The data object used to populate the text.
   * @param {Object} options The options object.
   *  escape - The "escape" delimiter regexp.
   *  evaluate - The "evaluate" delimiter regexp.
   *  interpolate - The "interpolate" delimiter regexp.
   *  sourceURL - The sourceURL of the template's compiled source.
   *  variable - The data object variable name.
   *
   * @returns {Function|String} Returns a compiled function when no `data` object
   *  is given, else it returns the interpolated text.
   * @example
   *
   * // using a compiled template
   * var compiled = _.template('hello <%= name %>');
   * compiled({ 'name': 'moe' });
   * // => 'hello moe'
   *
   * var list = '<% _.forEach(people, function(name) { %><li><%= name %></li><% }); %>';
   * _.template(list, { 'people': ['moe', 'larry', 'curly'] });
   * // => '<li>moe</li><li>larry</li><li>curly</li>'
   *
   * // using the "escape" delimiter to escape HTML in data property values
   * _.template('<b><%- value %></b>', { 'value': '<script>' });
   * // => '<b>&lt;script&gt;</b>'
   *
   * // using the ES6 delimiter as an alternative to the default "interpolate" delimiter
   * _.template('hello ${ name }', { 'name': 'curly' });
   * // => 'hello curly'
   *
   * // using the internal `print` function in "evaluate" delimiters
   * _.template('<% print("hello " + epithet); %>!', { 'epithet': 'stooge' });
   * // => 'hello stooge!'
   *
   * // using custom template delimiters
   * _.templateSettings = {
   *   'interpolate': /{{([\s\S]+?)}}/g
   * };
   *
   * _.template('hello {{ name }}!', { 'name': 'mustache' });
   * // => 'hello mustache!'
   *
   * // using the `sourceURL` option to specify a custom sourceURL for the template
   * var compiled = _.template('hello <%= name %>', null, { 'sourceURL': '/basic/greeting.jst' });
   * compiled(data);
   * // => find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector
   *
   * // using the `variable` option to ensure a with-statement isn't used in the compiled template
   * var compiled = _.template('hello <%= data.name %>!', null, { 'variable': 'data' });
   * compiled.source;
   * // => function(data) {
   *   var __t, __p = '', __e = _.escape;
   *   __p += 'hello ' + ((__t = ( data.name )) == null ? '' : __t) + '!';
   *   return __p;
   * }
   *
   * // using the `source` property to inline compiled templates for meaningful
   * // line numbers in error messages and a stack trace
   * fs.writeFileSync(path.join(cwd, 'jst.js'), '\
   *   var JST = {\
   *     "main": ' + _.template(mainText).source + '\
   *   };\
   * ');
   */
  function template(text, data, options) {
    // based on John Resig's `tmpl` implementation
    // http://ejohn.org/blog/javascript-micro-templating/
    // and Laura Doktorova's doT.js
    // https://github.com/olado/doT
    text || (text = '');
    options || (options = {});

    var isEvaluating,
        result,
        settings = lodash.templateSettings,
        index = 0,
        interpolate = options.interpolate || settings.interpolate || reNoMatch,
        source = "__p += '",
        variable = options.variable || settings.variable,
        hasVariable = variable;

    // compile regexp to match each delimiter
    var reDelimiters = RegExp(
      (options.escape || settings.escape || reNoMatch).source + '|' +
      interpolate.source + '|' +
      (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + '|' +
      (options.evaluate || settings.evaluate || reNoMatch).source + '|$'
    , 'g');

    text.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
      interpolateValue || (interpolateValue = esTemplateValue);

      // escape characters that cannot be included in string literals
      source += text.slice(index, offset).replace(reUnescapedString, escapeStringChar);

      // replace delimiters with snippets
      source +=
        escapeValue ? "' +\n__e(" + escapeValue + ") +\n'" :
        evaluateValue ? "';\n" + evaluateValue + ";\n__p += '" :
        interpolateValue ? "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'" : '';

      isEvaluating || (isEvaluating = evaluateValue || reComplexDelimiter.test(escapeValue || interpolateValue));
      index = offset + match.length;
    });

    source += "';\n";

    // if `variable` is not specified and the template contains "evaluate"
    // delimiters, wrap a with-statement around the generated code to add the
    // data object to the top of the scope chain
    if (!hasVariable) {
      variable = 'obj';
      if (isEvaluating) {
        source = 'with (' + variable + ') {\n' + source + '\n}\n';
      }
      else {
        // avoid a with-statement by prepending data object references to property names
        var reDoubleVariable = RegExp('(\\(\\s*)' + variable + '\\.' + variable + '\\b', 'g');
        source = source
          .replace(reInsertVariable, '$&' + variable + '.')
          .replace(reDoubleVariable, '$1__d');
      }
    }

    // cleanup code by stripping empty strings
    source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source)
      .replace(reEmptyStringMiddle, '$1')
      .replace(reEmptyStringTrailing, '$1;');

    // frame code as the function body
    source = 'function(' + variable + ') {\n' +
      (hasVariable ? '' : variable + ' || (' + variable + ' = {});\n') +
      'var __t, __p = \'\', __e = _.escape' +
      (isEvaluating
        ? ', __j = Array.prototype.join;\n' +
          'function print() { __p += __j.call(arguments, \'\') }\n'
        : (hasVariable ? '' : ', __d = ' + variable + '.' + variable + ' || ' + variable) + ';\n'
      ) +
      source +
      'return __p\n}';

    // use a sourceURL for easier debugging
    // http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
    var sourceURL = useSourceURL
      ? '\n//@ sourceURL=' + (options.sourceURL || '/lodash/template/source[' + (templateCounter++) + ']')
      : '';

    try {
      result = Function('_', 'return ' + source + sourceURL)(lodash);
    } catch(e) {
      e.source = source;
      throw e;
    }

    if (data) {
      return result(data);
    }
    // provide the compiled function's source via its `toString` method, in
    // supported environments, or the `source` property as a convenience for
    // inlining compiled templates during the build process
    result.source = source;
    return result;
  }

  /**
   * Executes the `callback` function `n` times, returning an array of the results
   * of each `callback` execution. The `callback` is bound to `thisArg` and invoked
   * with one argument; (index).
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Number} n The number of times to execute the callback.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of the results of each `callback` execution.
   * @example
   *
   * var diceRolls = _.times(3, _.partial(_.random, 1, 6));
   * // => [3, 6, 4]
   *
   * _.times(3, function(n) { mage.castSpell(n); });
   * // => calls `mage.castSpell(n)` three times, passing `n` of `0`, `1`, and `2` respectively
   *
   * _.times(3, function(n) { this.cast(n); }, mage);
   * // => also calls `mage.castSpell(n)` three times
   */
  function times(n, callback, thisArg) {
    n = +n || 0;
    var index = -1,
        result = Array(n);

    while (++index < n) {
      result[index] = callback.call(thisArg, index);
    }
    return result;
  }

  /**
   * The opposite of `_.escape`, this method converts the HTML entities
   * `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#x27;` in `string` to their
   * corresponding characters.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {String} string The string to unescape.
   * @returns {String} Returns the unescaped string.
   * @example
   *
   * _.unescape('Moe, Larry &amp; Curly');
   * // => "Moe, Larry & Curly"
   */
  function unescape(string) {
    return string == null ? '' : (string + '').replace(reEscapedHtml, unescapeHtmlChar);
  }

  /**
   * Generates a unique id. If `prefix` is passed, the id will be appended to it.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {String} [prefix] The value to prefix the id with.
   * @returns {Number|String} Returns a numeric id if no prefix is passed, else
   *  a string id may be returned.
   * @example
   *
   * _.uniqueId('contact_');
   * // => 'contact_104'
   */
  function uniqueId(prefix) {
    var id = idCounter++;
    return prefix ? prefix + id : id;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Wraps the value in a `lodash` wrapper object.
   *
   * @static
   * @memberOf _
   * @category Chaining
   * @param {Mixed} value The value to wrap.
   * @returns {Object} Returns the wrapper object.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 },
   *   { 'name': 'curly', 'age': 60 }
   * ];
   *
   * var youngest = _.chain(stooges)
   *     .sortBy(function(stooge) { return stooge.age; })
   *     .map(function(stooge) { return stooge.name + ' is ' + stooge.age; })
   *     .first()
   *     .value();
   * // => 'moe is 40'
   */
  function chain(value) {
    value = new lodash(value);
    value.__chain__ = true;
    return value;
  }

  /**
   * Invokes `interceptor` with the `value` as the first argument, and then
   * returns `value`. The purpose of this method is to "tap into" a method chain,
   * in order to perform operations on intermediate results within the chain.
   *
   * @static
   * @memberOf _
   * @category Chaining
   * @param {Mixed} value The value to pass to `interceptor`.
   * @param {Function} interceptor The function to invoke.
   * @returns {Mixed} Returns `value`.
   * @example
   *
   * _.chain([1, 2, 3, 200])
   *  .filter(function(num) { return num % 2 == 0; })
   *  .tap(alert)
   *  .map(function(num) { return num * num })
   *  .value();
   * // => // [2, 200] (alerted)
   * // => [4, 40000]
   */
  function tap(value, interceptor) {
    interceptor(value);
    return value;
  }

  /**
   * Enables method chaining on the wrapper object.
   *
   * @name chain
   * @deprecated
   * @memberOf _
   * @category Chaining
   * @returns {Mixed} Returns the wrapper object.
   * @example
   *
   * _([1, 2, 3]).value();
   * // => [1, 2, 3]
   */
  function wrapperChain() {
    this.__chain__ = true;
    return this;
  }

  /**
   * Extracts the wrapped value.
   *
   * @name value
   * @memberOf _
   * @category Chaining
   * @returns {Mixed} Returns the wrapped value.
   * @example
   *
   * _([1, 2, 3]).value();
   * // => [1, 2, 3]
   */
  function wrapperValue() {
    return this.__wrapped__;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * The semantic version number.
   *
   * @static
   * @memberOf _
   * @type String
   */
  lodash.VERSION = '0.9.2';

  // assign static methods
  lodash.after = after;
  lodash.bind = bind;
  lodash.bindAll = bindAll;
  lodash.chain = chain;
  lodash.clone = clone;
  lodash.compact = compact;
  lodash.compose = compose;
  lodash.contains = contains;
  lodash.countBy = countBy;
  lodash.debounce = debounce;
  lodash.defaults = defaults;
  lodash.defer = defer;
  lodash.delay = delay;
  lodash.difference = difference;
  lodash.escape = escape;
  lodash.every = every;
  lodash.extend = extend;
  lodash.filter = filter;
  lodash.find = find;
  lodash.first = first;
  lodash.flatten = flatten;
  lodash.forEach = forEach;
  lodash.forIn = forIn;
  lodash.forOwn = forOwn;
  lodash.functions = functions;
  lodash.groupBy = groupBy;
  lodash.has = has;
  lodash.identity = identity;
  lodash.indexOf = indexOf;
  lodash.initial = initial;
  lodash.intersection = intersection;
  lodash.invert = invert;
  lodash.invoke = invoke;
  lodash.isArguments = isArguments;
  lodash.isArray = isArray;
  lodash.isBoolean = isBoolean;
  lodash.isDate = isDate;
  lodash.isElement = isElement;
  lodash.isEmpty = isEmpty;
  lodash.isEqual = isEqual;
  lodash.isFinite = isFinite;
  lodash.isFunction = isFunction;
  lodash.isNaN = isNaN;
  lodash.isNull = isNull;
  lodash.isNumber = isNumber;
  lodash.isObject = isObject;
  lodash.isPlainObject = isPlainObject;
  lodash.isRegExp = isRegExp;
  lodash.isString = isString;
  lodash.isUndefined = isUndefined;
  lodash.keys = keys;
  lodash.last = last;
  lodash.lastIndexOf = lastIndexOf;
  lodash.lateBind = lateBind;
  lodash.map = map;
  lodash.max = max;
  lodash.memoize = memoize;
  lodash.merge = merge;
  lodash.min = min;
  lodash.mixin = mixin;
  lodash.noConflict = noConflict;
  lodash.object = object;
  lodash.omit = omit;
  lodash.once = once;
  lodash.pairs = pairs;
  lodash.partial = partial;
  lodash.pick = pick;
  lodash.pluck = pluck;
  lodash.random = random;
  lodash.range = range;
  lodash.reduce = reduce;
  lodash.reduceRight = reduceRight;
  lodash.reject = reject;
  lodash.rest = rest;
  lodash.result = result;
  lodash.shuffle = shuffle;
  lodash.size = size;
  lodash.some = some;
  lodash.sortBy = sortBy;
  lodash.sortedIndex = sortedIndex;
  lodash.tap = tap;
  lodash.template = template;
  lodash.throttle = throttle;
  lodash.times = times;
  lodash.toArray = toArray;
  lodash.unescape = unescape;
  lodash.union = union;
  lodash.uniq = uniq;
  lodash.uniqueId = uniqueId;
  lodash.values = values;
  lodash.where = where;
  lodash.without = without;
  lodash.wrap = wrap;
  lodash.zip = zip;

  // assign aliases
  lodash.all = every;
  lodash.any = some;
  lodash.collect = map;
  lodash.detect = find;
  lodash.drop = rest;
  lodash.each = forEach;
  lodash.foldl = reduce;
  lodash.foldr = reduceRight;
  lodash.head = first;
  lodash.include = contains;
  lodash.inject = reduce;
  lodash.methods = functions;
  lodash.select = filter;
  lodash.tail = rest;
  lodash.take = first;
  lodash.unique = uniq;

  // add pseudo private property to be used and removed during the build process
  lodash._iteratorTemplate = iteratorTemplate;

  /*--------------------------------------------------------------------------*/

  // add all static functions to `lodash.prototype`
  mixin(lodash);

  // add `lodash.prototype.chain` after calling `mixin()` to avoid overwriting
  // it with the wrapped `lodash.chain`
  lodash.prototype.chain = wrapperChain;
  lodash.prototype.value = wrapperValue;

  // add all mutator Array functions to the wrapper.
  forEach(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(methodName) {
    var func = arrayRef[methodName];

    lodash.prototype[methodName] = function() {
      var value = this.__wrapped__;
      func.apply(value, arguments);

      // avoid array-like object bugs with `Array#shift` and `Array#splice` in
      // Firefox < 10 and IE < 9
      if (hasObjectSpliceBug && value.length === 0) {
        delete value[0];
      }
      if (this.__chain__) {
        value = new lodash(value);
        value.__chain__ = true;
      }
      return value;
    };
  });

  // add all accessor Array functions to the wrapper.
  forEach(['concat', 'join', 'slice'], function(methodName) {
    var func = arrayRef[methodName];

    lodash.prototype[methodName] = function() {
      var value = this.__wrapped__,
          result = func.apply(value, arguments);

      if (this.__chain__) {
        result = new lodash(result);
        result.__chain__ = true;
      }
      return result;
    };
  });

  /*--------------------------------------------------------------------------*/

  // expose Lo-Dash
  // some AMD build optimizers, like r.js, check for specific condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // Expose Lo-Dash to the global object even when an AMD loader is present in
    // case Lo-Dash was injected by a third-party script and not intended to be
    // loaded as a module. The global assignment can be reverted in the Lo-Dash
    // module via its `noConflict()` method.
    window._ = lodash;

    // define as an anonymous module so, through path mapping, it can be
    // referenced as the "underscore" module
    define(function() {
      return lodash;
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports) {
    // in Node.js or RingoJS v0.8.0+
    if (typeof module == 'object' && module && module.exports == freeExports) {
      (module.exports = lodash)._ = lodash;
    }
    // in Narwhal or RingoJS v0.7.0-
    else {
      freeExports._ = lodash;
    }
  }
  else {
    // in a browser or Rhino
    window._ = lodash;
  }
}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],6:[function(require,module,exports){
// ISC @ Julien Fontanet

'use strict'

// ===================================================================

var construct = typeof Reflect !== 'undefined' ? Reflect.construct : undefined
var defineProperty = Object.defineProperty

// -------------------------------------------------------------------

var captureStackTrace = Error.captureStackTrace
if (captureStackTrace === undefined) {
  captureStackTrace = function captureStackTrace (error) {
    var container = new Error()

    defineProperty(error, 'stack', {
      configurable: true,
      get: function getStack () {
        var stack = container.stack

        // Replace property with value for faster future accesses.
        defineProperty(this, 'stack', {
          configurable: true,
          value: stack,
          writable: true
        })

        return stack
      },
      set: function setStack (stack) {
        defineProperty(error, 'stack', {
          configurable: true,
          value: stack,
          writable: true
        })
      }
    })
  }
}

// -------------------------------------------------------------------

function BaseError (message) {
  if (message !== undefined) {
    defineProperty(this, 'message', {
      configurable: true,
      value: message,
      writable: true
    })
  }

  var cname = this.constructor.name
  if (
    cname !== undefined &&
    cname !== this.name
  ) {
    defineProperty(this, 'name', {
      configurable: true,
      value: cname,
      writable: true
    })
  }

  captureStackTrace(this, this.constructor)
}

BaseError.prototype = Object.create(Error.prototype, {
  // See: https://github.com/JsCommunity/make-error/issues/4
  constructor: {
    configurable: true,
    value: BaseError,
    writable: true
  }
})

// -------------------------------------------------------------------

// Sets the name of a function if possible (depends of the JS engine).
var setFunctionName = (function () {
  function setFunctionName (fn, name) {
    return defineProperty(fn, 'name', {
      configurable: true,
      value: name
    })
  }
  try {
    var f = function () {}
    setFunctionName(f, 'foo')
    if (f.name === 'foo') {
      return setFunctionName
    }
  } catch (_) {}
})()

// -------------------------------------------------------------------

function makeError (constructor, super_) {
  if (super_ == null || super_ === Error) {
    super_ = BaseError
  } else if (typeof super_ !== 'function') {
    throw new TypeError('super_ should be a function')
  }

  var name
  if (typeof constructor === 'string') {
    name = constructor
    constructor = construct !== undefined
      ? function () { return construct(super_, arguments, this.constructor) }
      : function () { super_.apply(this, arguments) }

    // If the name can be set, do it once and for all.
    if (setFunctionName !== undefined) {
      setFunctionName(constructor, name)
      name = undefined
    }
  } else if (typeof constructor !== 'function') {
    throw new TypeError('constructor should be either a string or a function')
  }

  // Also register the super constructor also as `constructor.super_` just
  // like Node's `util.inherits()`.
  constructor.super_ = constructor['super'] = super_

  var properties = {
    constructor: {
      configurable: true,
      value: constructor,
      writable: true
    }
  }

  // If the name could not be set on the constructor, set it on the
  // prototype.
  if (name !== undefined) {
    properties.name = {
      configurable: true,
      value: name,
      writable: true
    }
  }
  constructor.prototype = Object.create(super_.prototype, properties)

  return constructor
}
exports = module.exports = makeError
exports.BaseError = BaseError

},{}],7:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],8:[function(require,module,exports){
var geometryArea = require('geojson-area').geometry;

/**
 * Takes a {@link GeoJSON} feature or {@link FeatureCollection} of any type and returns the area of that feature
 * in square meters.
 *
 * @module turf/area
 * @category measurement
 * @param {GeoJSON} input a {@link Feature} or {@link FeatureCollection} of any type
 * @return {Number} area in square meters
 * @example
 * var polygons = {
 *   "type": "FeatureCollection",
 *   "features": [
 *     {
 *       "type": "Feature",
 *       "properties": {},
 *       "geometry": {
 *         "type": "Polygon",
 *         "coordinates": [[
 *           [-67.031021, 10.458102],
 *           [-67.031021, 10.53372],
 *           [-66.929397, 10.53372],
 *           [-66.929397, 10.458102],
 *           [-67.031021, 10.458102]
 *         ]]
 *       }
 *     }, {
 *       "type": "Feature",
 *       "properties": {},
 *       "geometry": {
 *         "type": "Polygon",
 *         "coordinates": [[
 *           [-66.919784, 10.397325],
 *           [-66.919784, 10.513467],
 *           [-66.805114, 10.513467],
 *           [-66.805114, 10.397325],
 *           [-66.919784, 10.397325]
 *         ]]
 *       }
 *     }
 *   ]
 * };
 *
 * var area = turf.area(polygons);
 *
 * //=area
 */
module.exports = function(_) {
    if (_.type === 'FeatureCollection') {
        for (var i = 0, sum = 0; i < _.features.length; i++) {
            if (_.features[i].geometry) {
                sum += geometryArea(_.features[i].geometry);
            }
        }
        return sum;
    } else if (_.type === 'Feature') {
        return geometryArea(_.geometry);
    } else {
        return geometryArea(_);
    }
};

},{"geojson-area":3}],9:[function(require,module,exports){
//http://en.wikipedia.org/wiki/Haversine_formula
//http://www.movable-type.co.uk/scripts/latlong.html

/**
 * Takes two {@link Point|points} and finds the geographic bearing between them.
 *
 * @module turf/bearing
 * @category measurement
 * @param {Feature<Point>} start starting Point
 * @param {Feature<Point>} end ending Point
 * @category measurement
 * @returns {Number} bearing in decimal degrees
 * @example
 * var point1 = {
 *   "type": "Feature",
 *   "properties": {
 *     "marker-color": '#f00'
 *   },
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-75.343, 39.984]
 *   }
 * };
 * var point2 = {
 *   "type": "Feature",
 *   "properties": {
 *     "marker-color": '#0f0'
 *   },
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-75.534, 39.123]
 *   }
 * };
 *
 * var points = {
 *   "type": "FeatureCollection",
 *   "features": [point1, point2]
 * };
 *
 * //=points
 *
 * var bearing = turf.bearing(point1, point2);
 *
 * //=bearing
 */
module.exports = function (point1, point2) {
    var coordinates1 = point1.geometry.coordinates;
    var coordinates2 = point2.geometry.coordinates;

    var lon1 = toRad(coordinates1[0]);
    var lon2 = toRad(coordinates2[0]);
    var lat1 = toRad(coordinates1[1]);
    var lat2 = toRad(coordinates2[1]);
    var a = Math.sin(lon2 - lon1) * Math.cos(lat2);
    var b = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

    var bearing = toDeg(Math.atan2(a, b));

    return bearing;
};

function toRad(degree) {
    return degree * Math.PI / 180;
}

function toDeg(radian) {
    return radian * 180 / Math.PI;
}

},{}],10:[function(require,module,exports){
var each = require('turf-meta').coordEach;
var point = require('turf-helpers').point;

/**
 * Takes one or more features and calculates the centroid using
 * the mean of all vertices.
 * This lessens the effect of small islands and artifacts when calculating
 * the centroid of a set of polygons.
 *
 * @name centroid
 * @param {(Feature|FeatureCollection)} features input features
 * @return {Feature<Point>} the centroid of the input features
 * @example
 * var poly = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Polygon",
 *     "coordinates": [[
 *       [105.818939,21.004714],
 *       [105.818939,21.061754],
 *       [105.890007,21.061754],
 *       [105.890007,21.004714],
 *       [105.818939,21.004714]
 *     ]]
 *   }
 * };
 *
 * var centroidPt = turf.centroid(poly);
 *
 * var result = {
 *   "type": "FeatureCollection",
 *   "features": [poly, centroidPt]
 * };
 *
 * //=result
 */
module.exports = function (features) {
    var xSum = 0, ySum = 0, len = 0;
    each(features, function (coord) {
        xSum += coord[0];
        ySum += coord[1];
        len++;
    }, true);
    return point([xSum / len, ySum / len]);
};

},{"turf-helpers":14,"turf-meta":18}],11:[function(require,module,exports){
//http://en.wikipedia.org/wiki/Haversine_formula
//http://www.movable-type.co.uk/scripts/latlong.html
var point = require('turf-point');

/**
 * Takes a {@link Point} feature and calculates the location of a destination point given a distance in degrees, radians, miles, or kilometers; and bearing in degrees. This uses the [Haversine formula](http://en.wikipedia.org/wiki/Haversine_formula) to account for global curvature.
 *
 * @module turf/destination
 * @category measurement
 * @param {Point} start a Point feature at the starting point
 * @param {Number} distance distance from the starting point
 * @param {Number} bearing ranging from -180 to 180
 * @param {String} units miles, kilometers, degrees, or radians
 * @returns {Point} a Point feature at the destination
 * @example
 * var point = {
 *   "type": "Feature",
 *   "properties": {
 *     "marker-color": "#0f0"
 *   },
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-75.343, 39.984]
 *   }
 * };
 * var distance = 50;
 * var bearing = 90;
 * var units = 'miles';
 *
 * var destination = turf.destination(point, distance, bearing, units);
 * destination.properties['marker-color'] = '#f00';
 *
 * var result = {
 *   "type": "FeatureCollection",
 *   "features": [point, destination]
 * };
 *
 * //=result
 */
module.exports = function (point1, distance, bearing, units) {
    var coordinates1 = point1.geometry.coordinates;
    var longitude1 = toRad(coordinates1[0]);
    var latitude1 = toRad(coordinates1[1]);
    var bearing_rad = toRad(bearing);

    var R = 0;
    switch (units) {
    case 'miles':
        R = 3960;
        break
    case 'kilometers':
        R = 6373;
        break
    case 'degrees':
        R = 57.2957795;
        break
    case 'radians':
        R = 1;
        break
    }

    var latitude2 = Math.asin(Math.sin(latitude1) * Math.cos(distance / R) +
        Math.cos(latitude1) * Math.sin(distance / R) * Math.cos(bearing_rad));
    var longitude2 = longitude1 + Math.atan2(Math.sin(bearing_rad) * Math.sin(distance / R) * Math.cos(latitude1),
        Math.cos(distance / R) - Math.sin(latitude1) * Math.sin(latitude2));

    return point([toDeg(longitude2), toDeg(latitude2)]);
};

function toRad(degree) {
    return degree * Math.PI / 180;
}

function toDeg(rad) {
    return rad * 180 / Math.PI;
}

},{"turf-point":19}],12:[function(require,module,exports){
var invariant = require('turf-invariant');
//http://en.wikipedia.org/wiki/Haversine_formula
//http://www.movable-type.co.uk/scripts/latlong.html

/**
 * Calculates the distance between two {@link Point|points} in degress, radians,
 * miles, or kilometers. This uses the
 * [Haversine formula](http://en.wikipedia.org/wiki/Haversine_formula)
 * to account for global curvature.
 *
 * @module turf/distance
 * @category measurement
 * @param {Feature<Point>} from origin point
 * @param {Feature<Point>} to destination point
 * @param {String} [units=kilometers] can be degrees, radians, miles, or kilometers
 * @return {Number} distance between the two points
 * @example
 * var point1 = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-75.343, 39.984]
 *   }
 * };
 * var point2 = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-75.534, 39.123]
 *   }
 * };
 * var units = "miles";
 *
 * var points = {
 *   "type": "FeatureCollection",
 *   "features": [point1, point2]
 * };
 *
 * //=points
 *
 * var distance = turf.distance(point1, point2, units);
 *
 * //=distance
 */
module.exports = function(point1, point2, units) {
  invariant.featureOf(point1, 'Point', 'distance');
  invariant.featureOf(point2, 'Point', 'distance');
  var coordinates1 = point1.geometry.coordinates;
  var coordinates2 = point2.geometry.coordinates;

  var dLat = toRad(coordinates2[1] - coordinates1[1]);
  var dLon = toRad(coordinates2[0] - coordinates1[0]);
  var lat1 = toRad(coordinates1[1]);
  var lat2 = toRad(coordinates2[1]);

  var a = Math.pow(Math.sin(dLat/2), 2) +
          Math.pow(Math.sin(dLon/2), 2) * Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  var R;
  switch(units) {
    case 'miles':
      R = 3960;
      break;
    case 'kilometers':
    case 'kilometres':
      R = 6373;
      break;
    case 'degrees':
      R = 57.2957795;
      break;
    case 'radians':
      R = 1;
      break;
    case undefined:
      R = 6373;
      break;
    default:
      throw new Error('unknown option given to "units"');
  }

  var distance = R * c;
  return distance;
};

function toRad(degree) {
  return degree * Math.PI / 180;
}

},{"turf-invariant":16}],13:[function(require,module,exports){
/**
 * Takes one or more {@link Feature|Features} and creates a {@link FeatureCollection}
 *
 * @module turf/featurecollection
 * @category helper
 * @param {Feature} features input Features
 * @returns {FeatureCollection} a FeatureCollection of input features
 * @example
 * var features = [
 *  turf.point([-75.343, 39.984], {name: 'Location A'}),
 *  turf.point([-75.833, 39.284], {name: 'Location B'}),
 *  turf.point([-75.534, 39.123], {name: 'Location C'})
 * ];
 *
 * var fc = turf.featurecollection(features);
 *
 * //=fc
 */
module.exports = function(features){
  return {
    type: "FeatureCollection",
    features: features
  };
};

},{}],14:[function(require,module,exports){
/**
 * Wraps a GeoJSON {@link Geometry} in a GeoJSON {@link Feature}.
 *
 * @name feature
 * @param {Geometry} geometry input geometry
 * @param {Object} properties properties
 * @returns {FeatureCollection} a FeatureCollection of input features
 * @example
 * var geometry = {
 *      "type": "Point",
 *      "coordinates": [
 *        67.5,
 *        32.84267363195431
 *      ]
 *    }
 *
 * var feature = turf.feature(geometry);
 *
 * //=feature
 */
function feature(geometry, properties) {
    return {
        type: 'Feature',
        properties: properties || {},
        geometry: geometry
    };
}

module.exports.feature = feature;

/**
 * Takes coordinates and properties (optional) and returns a new {@link Point} feature.
 *
 * @name point
 * @param {number[]} coordinates longitude, latitude position (each in decimal degrees)
 * @param {Object=} properties an Object that is used as the {@link Feature}'s
 * properties
 * @returns {Feature<Point>} a Point feature
 * @example
 * var pt1 = turf.point([-75.343, 39.984]);
 *
 * //=pt1
 */
module.exports.point = function (coordinates, properties) {
    if (!Array.isArray(coordinates)) throw new Error('Coordinates must be an array');
    if (coordinates.length < 2) throw new Error('Coordinates must be at least 2 numbers long');
    return feature({
        type: 'Point',
        coordinates: coordinates.slice()
    }, properties);
};

/**
 * Takes an array of LinearRings and optionally an {@link Object} with properties and returns a {@link Polygon} feature.
 *
 * @name polygon
 * @param {Array<Array<Array<number>>>} coordinates an array of LinearRings
 * @param {Object=} properties a properties object
 * @returns {Feature<Polygon>} a Polygon feature
 * @throws {Error} throw an error if a LinearRing of the polygon has too few positions
 * or if a LinearRing of the Polygon does not have matching Positions at the
 * beginning & end.
 * @example
 * var polygon = turf.polygon([[
 *  [-2.275543, 53.464547],
 *  [-2.275543, 53.489271],
 *  [-2.215118, 53.489271],
 *  [-2.215118, 53.464547],
 *  [-2.275543, 53.464547]
 * ]], { name: 'poly1', population: 400});
 *
 * //=polygon
 */
module.exports.polygon = function (coordinates, properties) {

    if (!coordinates) throw new Error('No coordinates passed');

    for (var i = 0; i < coordinates.length; i++) {
        var ring = coordinates[i];
        if (ring.length < 4) {
            throw new Error('Each LinearRing of a Polygon must have 4 or more Positions.');
        }
        for (var j = 0; j < ring[ring.length - 1].length; j++) {
            if (ring[ring.length - 1][j] !== ring[0][j]) {
                throw new Error('First and last Position are not equivalent.');
            }
        }
    }

    return feature({
        type: 'Polygon',
        coordinates: coordinates
    }, properties);
};

/**
 * Creates a {@link LineString} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name lineString
 * @param {Array<Array<number>>} coordinates an array of Positions
 * @param {Object=} properties an Object of key-value pairs to add as properties
 * @returns {Feature<LineString>} a LineString feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var linestring1 = turf.lineString([
 *	[-21.964416, 64.148203],
 *	[-21.956176, 64.141316],
 *	[-21.93901, 64.135924],
 *	[-21.927337, 64.136673]
 * ]);
 * var linestring2 = turf.lineString([
 *	[-21.929054, 64.127985],
 *	[-21.912918, 64.134726],
 *	[-21.916007, 64.141016],
 * 	[-21.930084, 64.14446]
 * ], {name: 'line 1', distance: 145});
 *
 * //=linestring1
 *
 * //=linestring2
 */
module.exports.lineString = function (coordinates, properties) {
    if (!coordinates) {
        throw new Error('No coordinates passed');
    }
    return feature({
        type: 'LineString',
        coordinates: coordinates
    }, properties);
};

/**
 * Takes one or more {@link Feature|Features} and creates a {@link FeatureCollection}.
 *
 * @name featureCollection
 * @param {Feature[]} features input features
 * @returns {FeatureCollection} a FeatureCollection of input features
 * @example
 * var features = [
 *  turf.point([-75.343, 39.984], {name: 'Location A'}),
 *  turf.point([-75.833, 39.284], {name: 'Location B'}),
 *  turf.point([-75.534, 39.123], {name: 'Location C'})
 * ];
 *
 * var fc = turf.featureCollection(features);
 *
 * //=fc
 */
module.exports.featureCollection = function (features) {
    return {
        type: 'FeatureCollection',
        features: features
    };
};

/**
 * Creates a {@link Feature<MultiLineString>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiLineString
 * @param {Array<Array<Array<number>>>} coordinates an array of LineStrings
 * @param {Object=} properties an Object of key-value pairs to add as properties
 * @returns {Feature<MultiLineString>} a MultiLineString feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiLine = turf.multiLineString([[[0,0],[10,10]]]);
 *
 * //=multiLine
 *
 */
module.exports.multiLineString = function (coordinates, properties) {
    if (!coordinates) {
        throw new Error('No coordinates passed');
    }
    return feature({
        type: 'MultiLineString',
        coordinates: coordinates
    }, properties);
};

/**
 * Creates a {@link Feature<MultiPoint>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiPoint
 * @param {Array<Array<number>>} coordinates an array of Positions
 * @param {Object=} properties an Object of key-value pairs to add as properties
 * @returns {Feature<MultiPoint>} a MultiPoint feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiPt = turf.multiPoint([[0,0],[10,10]]);
 *
 * //=multiPt
 *
 */
module.exports.multiPoint = function (coordinates, properties) {
    if (!coordinates) {
        throw new Error('No coordinates passed');
    }
    return feature({
        type: 'MultiPoint',
        coordinates: coordinates
    }, properties);
};


/**
 * Creates a {@link Feature<MultiPolygon>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiPolygon
 * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygons
 * @param {Object=} properties an Object of key-value pairs to add as properties
 * @returns {Feature<MultiPolygon>} a multipolygon feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiPoly = turf.multiPolygon([[[[0,0],[0,10],[10,10],[10,0],[0,0]]]);
 *
 * //=multiPoly
 *
 */
module.exports.multiPolygon = function (coordinates, properties) {
    if (!coordinates) {
        throw new Error('No coordinates passed');
    }
    return feature({
        type: 'MultiPolygon',
        coordinates: coordinates
    }, properties);
};

/**
 * Creates a {@link Feature<GeometryCollection>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name geometryCollection
 * @param {Array<{Geometry}>} geometries an array of GeoJSON Geometries
 * @param {Object=} properties an Object of key-value pairs to add as properties
 * @returns {Feature<GeometryCollection>} a geometrycollection feature
 * @example
 * var pt = {
 *     "type": "Point",
 *       "coordinates": [100, 0]
 *     };
 * var line = {
 *     "type": "LineString",
 *     "coordinates": [ [101, 0], [102, 1] ]
 *   };
 * var collection = turf.geometrycollection([[0,0],[10,10]]);
 *
 * //=collection
 */
module.exports.geometryCollection = function (geometries, properties) {
    return feature({
        type: 'GeometryCollection',
        geometries: geometries
    }, properties);
};

var factors = {
    miles: 3960,
    nauticalmiles: 3441.145,
    degrees: 57.2957795,
    radians: 1,
    inches: 250905600,
    yards: 6969600,
    meters: 6373000,
    metres: 6373000,
    kilometers: 6373,
    kilometres: 6373
};

/*
 * Convert a distance measurement from radians to a more friendly unit.
 *
 * @name radiansToDistance
 * @param {number} distance in radians across the sphere
 * @param {string=kilometers} units: one of miles, nauticalmiles, degrees, radians,
 * inches, yards, metres, meters, kilometres, kilometers.
 * @returns {number} distance
 */
module.exports.radiansToDistance = function (radians, units) {
    var factor = factors[units || 'kilometers'];
    if (factor === undefined) {
        throw new Error('Invalid unit');
    }
    return radians * factor;
};

/*
 * Convert a distance measurement from a real-world unit into radians
 *
 * @name distanceToRadians
 * @param {number} distance in real units
 * @param {string=kilometers} units: one of miles, nauticalmiles, degrees, radians,
 * inches, yards, metres, meters, kilometres, kilometers.
 * @returns {number} radians
 */
module.exports.distanceToRadians = function (distance, units) {
    var factor = factors[units || 'kilometers'];
    if (factor === undefined) {
        throw new Error('Invalid unit');
    }
    return distance / factor;
};

/*
 * Convert a distance measurement from a real-world unit into degrees
 *
 * @name distanceToRadians
 * @param {number} distance in real units
 * @param {string=kilometers} units: one of miles, nauticalmiles, degrees, radians,
 * inches, yards, metres, meters, kilometres, kilometers.
 * @returns {number} degrees
 */
module.exports.distanceToDegrees = function (distance, units) {
    var factor = factors[units || 'kilometers'];
    if (factor === undefined) {
        throw new Error('Invalid unit');
    }
    return (distance / factor) * 57.2958;
};

},{}],15:[function(require,module,exports){
// http://en.wikipedia.org/wiki/Even%E2%80%93odd_rule
// modified from: https://github.com/substack/point-in-polygon/blob/master/index.js
// which was modified from http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

/**
 * Takes a {@link Point} feature and a {@link Polygon} feature and determines if the Point resides inside the Polygon. The Polygon can
 * be convex or concave. The function accepts any valid Polygon or {@link MultiPolygon}
 * and accounts for holes.
 *
 * @module turf/inside
 * @category joins
 * @param {Point} point a Point feature
 * @param {Polygon} polygon a Polygon feature
 * @return {Boolean} `true` if the Point is inside the Polygon; `false` if the Point is not inside the Polygon
 * @example
 * var pt1 = {
 *   "type": "Feature",
 *   "properties": {
 *     "marker-color": "#f00"
 *   },
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-111.467285, 40.75766]
 *   }
 * };
 * var pt2 = {
 *   "type": "Feature",
 *   "properties": {
 *     "marker-color": "#0f0"
 *   },
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-111.873779, 40.647303]
 *   }
 * };
 * var poly = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Polygon",
 *     "coordinates": [[
 *       [-112.074279, 40.52215],
 *       [-112.074279, 40.853293],
 *       [-111.610107, 40.853293],
 *       [-111.610107, 40.52215],
 *       [-112.074279, 40.52215]
 *     ]]
 *   }
 * };
 *
 * var features = {
 *   "type": "FeatureCollection",
 *   "features": [pt1, pt2, poly]
 * };
 *
 * //=features
 *
 * var isInside1 = turf.inside(pt1, poly);
 * //=isInside1
 *
 * var isInside2 = turf.inside(pt2, poly);
 * //=isInside2
 */
module.exports = function(point, polygon) {
  var polys = polygon.geometry.coordinates;
  var pt = [point.geometry.coordinates[0], point.geometry.coordinates[1]];
  // normalize to multipolygon
  if(polygon.geometry.type === 'Polygon') polys = [polys];

  var insidePoly = false;
  var i = 0;
  while (i < polys.length && !insidePoly) {
    // check if it is in the outer ring first
    if(inRing(pt, polys[i][0])) {
      var inHole = false;
      var k = 1;
      // check for the point in any of the holes
      while(k < polys[i].length && !inHole) {
        if(inRing(pt, polys[i][k])) {
          inHole = true;
        }
        k++;
      }
      if(!inHole) insidePoly = true;
    }
    i++;
  }
  return insidePoly;
}

// pt is [x,y] and ring is [[x,y], [x,y],..]
function inRing (pt, ring) {
  var isInside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var xi = ring[i][0], yi = ring[i][1];
    var xj = ring[j][0], yj = ring[j][1];
    
    var intersect = ((yi > pt[1]) != (yj > pt[1]))
        && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}


},{}],16:[function(require,module,exports){
module.exports.geojsonType = geojsonType;
module.exports.collectionOf = collectionOf;
module.exports.featureOf = featureOf;

/**
 * Enforce expectations about types of GeoJSON objects for Turf.
 *
 * @alias geojsonType
 * @param {GeoJSON} value any GeoJSON object
 * @param {string} type expected GeoJSON type
 * @param {String} name name of calling function
 * @throws Error if value is not the expected type.
 */
function geojsonType(value, type, name) {
    if (!type || !name) throw new Error('type and name required');

    if (!value || value.type !== type) {
        throw new Error('Invalid input to ' + name + ': must be a ' + type + ', given ' + value.type);
    }
}

/**
 * Enforce expectations about types of {@link Feature} inputs for Turf.
 * Internally this uses {@link geojsonType} to judge geometry types.
 *
 * @alias featureOf
 * @param {Feature} feature a feature with an expected geometry type
 * @param {string} type expected GeoJSON type
 * @param {String} name name of calling function
 * @throws Error if value is not the expected type.
 */
function featureOf(value, type, name) {
    if (!name) throw new Error('.featureOf() requires a name');
    if (!value || value.type !== 'Feature' || !value.geometry) {
        throw new Error('Invalid input to ' + name + ', Feature with geometry required');
    }
    if (!value.geometry || value.geometry.type !== type) {
        throw new Error('Invalid input to ' + name + ': must be a ' + type + ', given ' + value.geometry.type);
    }
}

/**
 * Enforce expectations about types of {@link FeatureCollection} inputs for Turf.
 * Internally this uses {@link geojsonType} to judge geometry types.
 *
 * @alias collectionOf
 * @param {FeatureCollection} featurecollection a featurecollection for which features will be judged
 * @param {string} type expected GeoJSON type
 * @param {String} name name of calling function
 * @throws Error if value is not the expected type.
 */
function collectionOf(value, type, name) {
    if (!name) throw new Error('.collectionOf() requires a name');
    if (!value || value.type !== 'FeatureCollection') {
        throw new Error('Invalid input to ' + name + ', FeatureCollection required');
    }
    for (var i = 0; i < value.features.length; i++) {
        var feature = value.features[i];
        if (!feature || feature.type !== 'Feature' || !feature.geometry) {
            throw new Error('Invalid input to ' + name + ', Feature with geometry required');
        }
        if (!feature.geometry || feature.geometry.type !== type) {
            throw new Error('Invalid input to ' + name + ': must be a ' + type + ', given ' + feature.geometry.type);
        }
    }
}

},{}],17:[function(require,module,exports){
/**
 * Creates a {@link LineString} {@link Feature} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @module turf/linestring
 * @category helper
 * @param {Array<Array<Number>>} coordinates an array of Positions
 * @param {Object} properties an Object of key-value pairs to add as properties
 * @return {LineString} a LineString feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var linestring1 = turf.linestring([
 *	[-21.964416, 64.148203],
 *	[-21.956176, 64.141316],
 *	[-21.93901, 64.135924],
 *	[-21.927337, 64.136673]
 * ]);
 * var linestring2 = turf.linestring([
 *	[-21.929054, 64.127985],
 *	[-21.912918, 64.134726],
 *	[-21.916007, 64.141016],
 * 	[-21.930084, 64.14446]
 * ], {name: 'line 1', distance: 145});
 *
 * //=linestring1
 *
 * //=linestring2
 */
module.exports = function(coordinates, properties){
  if (!coordinates) {
      throw new Error('No coordinates passed');
  }
  return {
    "type": "Feature",
    "geometry": {
      "type": "LineString",
      "coordinates": coordinates
    },
    "properties": properties || {}
  };
};

},{}],18:[function(require,module,exports){
/**
 * Iterate over coordinates in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (value)
 * @param {boolean=} excludeWrapCoord whether or not to include
 * the final coordinate of LinearRings that wraps the ring in its iteration.
 * @example
 * var point = { type: 'Point', coordinates: [0, 0] };
 * coordEach(point, function(coords) {
 *   // coords is equal to [0, 0]
 * });
 */
function coordEach(layer, callback, excludeWrapCoord) {
    var i, j, k, g, l, geometry, stopG, coords,
        geometryMaybeCollection,
        wrapShrink = 0,
        isGeometryCollection,
        isFeatureCollection = layer.type === 'FeatureCollection',
        isFeature = layer.type === 'Feature',
        stop = isFeatureCollection ? layer.features.length : 1;

  // This logic may look a little weird. The reason why it is that way
  // is because it's trying to be fast. GeoJSON supports multiple kinds
  // of objects at its root: FeatureCollection, Features, Geometries.
  // This function has the responsibility of handling all of them, and that
  // means that some of the `for` loops you see below actually just don't apply
  // to certain inputs. For instance, if you give this just a
  // Point geometry, then both loops are short-circuited and all we do
  // is gradually rename the input until it's called 'geometry'.
  //
  // This also aims to allocate as few resources as possible: just a
  // few numbers and booleans, rather than any temporary arrays as would
  // be required with the normalization approach.
    for (i = 0; i < stop; i++) {

        geometryMaybeCollection = (isFeatureCollection ? layer.features[i].geometry :
        (isFeature ? layer.geometry : layer));
        isGeometryCollection = geometryMaybeCollection.type === 'GeometryCollection';
        stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;

        for (g = 0; g < stopG; g++) {
            geometry = isGeometryCollection ?
            geometryMaybeCollection.geometries[g] : geometryMaybeCollection;
            coords = geometry.coordinates;

            wrapShrink = (excludeWrapCoord &&
                (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) ?
                1 : 0;

            if (geometry.type === 'Point') {
                callback(coords);
            } else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
                for (j = 0; j < coords.length; j++) callback(coords[j]);
            } else if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') {
                for (j = 0; j < coords.length; j++)
                    for (k = 0; k < coords[j].length - wrapShrink; k++)
                        callback(coords[j][k]);
            } else if (geometry.type === 'MultiPolygon') {
                for (j = 0; j < coords.length; j++)
                    for (k = 0; k < coords[j].length; k++)
                        for (l = 0; l < coords[j][k].length - wrapShrink; l++)
                            callback(coords[j][k][l]);
            } else {
                throw new Error('Unknown Geometry Type');
            }
        }
    }
}
module.exports.coordEach = coordEach;

/**
 * Reduce coordinates in any GeoJSON object into a single value,
 * similar to how Array.reduce works. However, in this case we lazily run
 * the reduction, so an array of all coordinates is unnecessary.
 *
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (memo, value) and returns
 * a new memo
 * @param {*} memo the starting value of memo: can be any type.
 * @param {boolean=} excludeWrapCoord whether or not to include
 * the final coordinate of LinearRings that wraps the ring in its iteration.
 * @return {*} combined value
 */
function coordReduce(layer, callback, memo, excludeWrapCoord) {
    coordEach(layer, function (coord) {
        memo = callback(memo, coord);
    }, excludeWrapCoord);
    return memo;
}
module.exports.coordReduce = coordReduce;

/**
 * Iterate over property objects in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (value)
 * @example
 * var point = { type: 'Feature', geometry: null, properties: { foo: 1 } };
 * propEach(point, function(props) {
 *   // props is equal to { foo: 1}
 * });
 */
function propEach(layer, callback) {
    var i;
    switch (layer.type) {
    case 'FeatureCollection':
        for (i = 0; i < layer.features.length; i++) {
            callback(layer.features[i].properties);
        }
        break;
    case 'Feature':
        callback(layer.properties);
        break;
    }
}
module.exports.propEach = propEach;

/**
 * Reduce properties in any GeoJSON object into a single value,
 * similar to how Array.reduce works. However, in this case we lazily run
 * the reduction, so an array of all properties is unnecessary.
 *
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (memo, coord) and returns
 * a new memo
 * @param {*} memo the starting value of memo: can be any type.
 * @return {*} combined value
 */
function propReduce(layer, callback, memo) {
    propEach(layer, function (prop) {
        memo = callback(memo, prop);
    });
    return memo;
}
module.exports.propReduce = propReduce;

/**
 * Iterate over features in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (value)
 * @example
 * var feature = { type: 'Feature', geometry: null, properties: {} };
 * featureEach(feature, function(feature) {
 *   // feature == feature
 * });
 */
function featureEach(layer, callback) {
    if (layer.type === 'Feature') {
        callback(layer);
    } else if (layer.type === 'FeatureCollection') {
        for (var i = 0; i < layer.features.length; i++) {
            callback(layer.features[i]);
        }
    }
}
module.exports.featureEach = featureEach;

/**
 * Get all coordinates from any GeoJSON object, returning an array of coordinate
 * arrays.
 * @param {Object} layer any GeoJSON object
 * @return {Array<Array<Number>>} coordinate position array
 */
function coordAll(layer) {
    var coords = [];
    coordEach(layer, function (coord) {
        coords.push(coord);
    });
    return coords;
}
module.exports.coordAll = coordAll;

},{}],19:[function(require,module,exports){
/**
 * Takes coordinates and properties (optional) and returns a new {@link Point} feature.
 *
 * @module turf/point
 * @category helper
 * @param {number} longitude position west to east in decimal degrees
 * @param {number} latitude position south to north in decimal degrees
 * @param {Object} properties an Object that is used as the {@link Feature}'s
 * properties
 * @return {Point} a Point feature
 * @example
 * var pt1 = turf.point([-75.343, 39.984]);
 *
 * //=pt1
 */
var isArray = Array.isArray || function(arg) {
  return Object.prototype.toString.call(arg) === '[object Array]';
};
module.exports = function(coordinates, properties) {
  if (!isArray(coordinates)) throw new Error('Coordinates must be an array');
  if (coordinates.length < 2) throw new Error('Coordinates must be at least 2 numbers long');
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: coordinates
    },
    properties: properties || {}
  };
};

},{}],20:[function(require,module,exports){
var inside = require('turf-inside');
var featureCollection = require('turf-featurecollection');

/**
 * Takes a {@link FeatureCollection} of {@link Point} features and a FeatureCollection of {@link Polygon} features and returns a FeatureCollection of Point features representing all points that fall within a collection of polygons.
 *
 * @module turf/within
 * @category joins
 * @param {FeatureCollection} points a FeatureCollection of {@link Point} features
 * @param {FeatureCollection} polygons a FeatureCollection of {@link Polygon} features
 * @return {FeatureCollection} a collection of all points that land
 * within at least one polygon
 * @example
 * var searchWithin = {
 *   "type": "FeatureCollection",
 *   "features": [
 *     {
 *       "type": "Feature",
 *       "properties": {},
 *       "geometry": {
 *         "type": "Polygon",
 *         "coordinates": [[
 *           [-46.653,-23.543],
 *           [-46.634,-23.5346],
 *           [-46.613,-23.543],
 *           [-46.614,-23.559],
 *           [-46.631,-23.567],
 *           [-46.653,-23.560],
 *           [-46.653,-23.543]
 *         ]]
 *       }
 *     }
 *   ]
 * };
 * var points = {
 *   "type": "FeatureCollection",
 *   "features": [
 *     {
 *       "type": "Feature",
 *       "properties": {},
 *       "geometry": {
 *         "type": "Point",
 *         "coordinates": [-46.6318, -23.5523]
 *       }
 *     }, {
 *       "type": "Feature",
 *       "properties": {},
 *       "geometry": {
 *         "type": "Point",
 *         "coordinates": [-46.6246, -23.5325]
 *       }
 *     }, {
 *       "type": "Feature",
 *       "properties": {},
 *       "geometry": {
 *         "type": "Point",
 *         "coordinates": [-46.6062, -23.5513]
 *       }
 *     }, {
 *       "type": "Feature",
 *       "properties": {},
 *       "geometry": {
 *         "type": "Point",
 *         "coordinates": [-46.663, -23.554]
 *       }
 *     }, {
 *       "type": "Feature",
 *       "properties": {},
 *       "geometry": {
 *         "type": "Point",
 *         "coordinates": [-46.643, -23.557]
 *       }
 *     }
 *   ]
 * };
 *
 * var ptsWithin = turf.within(points, searchWithin);
 *
 * //=points
 *
 * //=searchWithin
 *
 * //=ptsWithin
 */
module.exports = function(ptFC, polyFC){
  var pointsWithin = featureCollection([]);
  for (var i = 0; i < polyFC.features.length; i++) {
    for (var j = 0; j < ptFC.features.length; j++) {
      var isInside = inside(ptFC.features[j], polyFC.features[i]);
      if(isInside){
        pointsWithin.features.push(ptFC.features[j]);
      }
    }
  }
  return pointsWithin;
};

},{"turf-featurecollection":13,"turf-inside":15}],21:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],22:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./support/isBuffer":21,"_process":7,"inherits":4}],23:[function(require,module,exports){
/*!
Copyright (C) 2010-2013 Raymond Hill: https://github.com/gorhill/Javascript-Voronoi
MIT License: See https://github.com/gorhill/Javascript-Voronoi/LICENSE.md
*/
/*
Author: Raymond Hill (rhill@raymondhill.net)
Contributor: Jesse Morgan (morgajel@gmail.com)
File: rhill-voronoi-core.js
Version: 0.98
Date: January 21, 2013
Description: This is my personal Javascript implementation of
Steven Fortune's algorithm to compute Voronoi diagrams.

License: See https://github.com/gorhill/Javascript-Voronoi/LICENSE.md
Credits: See https://github.com/gorhill/Javascript-Voronoi/CREDITS.md
History: See https://github.com/gorhill/Javascript-Voronoi/CHANGELOG.md

## Usage:

  var sites = [{x:300,y:300}, {x:100,y:100}, {x:200,y:500}, {x:250,y:450}, {x:600,y:150}];
  // xl, xr means x left, x right
  // yt, yb means y top, y bottom
  var bbox = {xl:0, xr:800, yt:0, yb:600};
  var voronoi = new Voronoi();
  // pass an object which exhibits xl, xr, yt, yb properties. The bounding
  // box will be used to connect unbound edges, and to close open cells
  result = voronoi.compute(sites, bbox);
  // render, further analyze, etc.

Return value:
  An object with the following properties:

  result.vertices = an array of unordered, unique Voronoi.Vertex objects making
    up the Voronoi diagram.
  result.edges = an array of unordered, unique Voronoi.Edge objects making up
    the Voronoi diagram.
  result.cells = an array of Voronoi.Cell object making up the Voronoi diagram.
    A Cell object might have an empty array of halfedges, meaning no Voronoi
    cell could be computed for a particular cell.
  result.execTime = the time it took to compute the Voronoi diagram, in
    milliseconds.

Voronoi.Vertex object:
  x: The x position of the vertex.
  y: The y position of the vertex.

Voronoi.Edge object:
  lSite: the Voronoi site object at the left of this Voronoi.Edge object.
  rSite: the Voronoi site object at the right of this Voronoi.Edge object (can
    be null).
  va: an object with an 'x' and a 'y' property defining the start point
    (relative to the Voronoi site on the left) of this Voronoi.Edge object.
  vb: an object with an 'x' and a 'y' property defining the end point
    (relative to Voronoi site on the left) of this Voronoi.Edge object.

  For edges which are used to close open cells (using the supplied bounding
  box), the rSite property will be null.

Voronoi.Cell object:
  site: the Voronoi site object associated with the Voronoi cell.
  halfedges: an array of Voronoi.Halfedge objects, ordered counterclockwise,
    defining the polygon for this Voronoi cell.

Voronoi.Halfedge object:
  site: the Voronoi site object owning this Voronoi.Halfedge object.
  edge: a reference to the unique Voronoi.Edge object underlying this
    Voronoi.Halfedge object.
  getStartpoint(): a method returning an object with an 'x' and a 'y' property
    for the start point of this halfedge. Keep in mind halfedges are always
    countercockwise.
  getEndpoint(): a method returning an object with an 'x' and a 'y' property
    for the end point of this halfedge. Keep in mind halfedges are always
    countercockwise.

TODO: Identify opportunities for performance improvement.

TODO: Let the user close the Voronoi cells, do not do it automatically. Not only let
      him close the cells, but also allow him to close more than once using a different
      bounding box for the same Voronoi diagram.
*/

/*global Math */

// ---------------------------------------------------------------------------

function Voronoi() {
    this.vertices = null;
    this.edges = null;
    this.cells = null;
    this.toRecycle = null;
    this.beachsectionJunkyard = [];
    this.circleEventJunkyard = [];
    this.vertexJunkyard = [];
    this.edgeJunkyard = [];
    this.cellJunkyard = [];
    }

// ---------------------------------------------------------------------------

Voronoi.prototype.reset = function() {
    if (!this.beachline) {
        this.beachline = new this.RBTree();
        }
    // Move leftover beachsections to the beachsection junkyard.
    if (this.beachline.root) {
        var beachsection = this.beachline.getFirst(this.beachline.root);
        while (beachsection) {
            this.beachsectionJunkyard.push(beachsection); // mark for reuse
            beachsection = beachsection.rbNext;
            }
        }
    this.beachline.root = null;
    if (!this.circleEvents) {
        this.circleEvents = new this.RBTree();
        }
    this.circleEvents.root = this.firstCircleEvent = null;
    this.vertices = [];
    this.edges = [];
    this.cells = [];
    };

Voronoi.prototype.sqrt = Math.sqrt;
Voronoi.prototype.abs = Math.abs;
Voronoi.prototype.ε = Voronoi.ε = 1e-9;
Voronoi.prototype.invε = Voronoi.invε = 1.0 / Voronoi.ε;
Voronoi.prototype.equalWithEpsilon = function(a,b){return this.abs(a-b)<1e-9;};
Voronoi.prototype.greaterThanWithEpsilon = function(a,b){return a-b>1e-9;};
Voronoi.prototype.greaterThanOrEqualWithEpsilon = function(a,b){return b-a<1e-9;};
Voronoi.prototype.lessThanWithEpsilon = function(a,b){return b-a>1e-9;};
Voronoi.prototype.lessThanOrEqualWithEpsilon = function(a,b){return a-b<1e-9;};

// ---------------------------------------------------------------------------
// Red-Black tree code (based on C version of "rbtree" by Franck Bui-Huu
// https://github.com/fbuihuu/libtree/blob/master/rb.c

Voronoi.prototype.RBTree = function() {
    this.root = null;
    };

Voronoi.prototype.RBTree.prototype.rbInsertSuccessor = function(node, successor) {
    var parent;
    if (node) {
        // >>> rhill 2011-05-27: Performance: cache previous/next nodes
        successor.rbPrevious = node;
        successor.rbNext = node.rbNext;
        if (node.rbNext) {
            node.rbNext.rbPrevious = successor;
            }
        node.rbNext = successor;
        // <<<
        if (node.rbRight) {
            // in-place expansion of node.rbRight.getFirst();
            node = node.rbRight;
            while (node.rbLeft) {node = node.rbLeft;}
            node.rbLeft = successor;
            }
        else {
            node.rbRight = successor;
            }
        parent = node;
        }
    // rhill 2011-06-07: if node is null, successor must be inserted
    // to the left-most part of the tree
    else if (this.root) {
        node = this.getFirst(this.root);
        // >>> Performance: cache previous/next nodes
        successor.rbPrevious = null;
        successor.rbNext = node;
        node.rbPrevious = successor;
        // <<<
        node.rbLeft = successor;
        parent = node;
        }
    else {
        // >>> Performance: cache previous/next nodes
        successor.rbPrevious = successor.rbNext = null;
        // <<<
        this.root = successor;
        parent = null;
        }
    successor.rbLeft = successor.rbRight = null;
    successor.rbParent = parent;
    successor.rbRed = true;
    // Fixup the modified tree by recoloring nodes and performing
    // rotations (2 at most) hence the red-black tree properties are
    // preserved.
    var grandpa, uncle;
    node = successor;
    while (parent && parent.rbRed) {
        grandpa = parent.rbParent;
        if (parent === grandpa.rbLeft) {
            uncle = grandpa.rbRight;
            if (uncle && uncle.rbRed) {
                parent.rbRed = uncle.rbRed = false;
                grandpa.rbRed = true;
                node = grandpa;
                }
            else {
                if (node === parent.rbRight) {
                    this.rbRotateLeft(parent);
                    node = parent;
                    parent = node.rbParent;
                    }
                parent.rbRed = false;
                grandpa.rbRed = true;
                this.rbRotateRight(grandpa);
                }
            }
        else {
            uncle = grandpa.rbLeft;
            if (uncle && uncle.rbRed) {
                parent.rbRed = uncle.rbRed = false;
                grandpa.rbRed = true;
                node = grandpa;
                }
            else {
                if (node === parent.rbLeft) {
                    this.rbRotateRight(parent);
                    node = parent;
                    parent = node.rbParent;
                    }
                parent.rbRed = false;
                grandpa.rbRed = true;
                this.rbRotateLeft(grandpa);
                }
            }
        parent = node.rbParent;
        }
    this.root.rbRed = false;
    };

Voronoi.prototype.RBTree.prototype.rbRemoveNode = function(node) {
    // >>> rhill 2011-05-27: Performance: cache previous/next nodes
    if (node.rbNext) {
        node.rbNext.rbPrevious = node.rbPrevious;
        }
    if (node.rbPrevious) {
        node.rbPrevious.rbNext = node.rbNext;
        }
    node.rbNext = node.rbPrevious = null;
    // <<<
    var parent = node.rbParent,
        left = node.rbLeft,
        right = node.rbRight,
        next;
    if (!left) {
        next = right;
        }
    else if (!right) {
        next = left;
        }
    else {
        next = this.getFirst(right);
        }
    if (parent) {
        if (parent.rbLeft === node) {
            parent.rbLeft = next;
            }
        else {
            parent.rbRight = next;
            }
        }
    else {
        this.root = next;
        }
    // enforce red-black rules
    var isRed;
    if (left && right) {
        isRed = next.rbRed;
        next.rbRed = node.rbRed;
        next.rbLeft = left;
        left.rbParent = next;
        if (next !== right) {
            parent = next.rbParent;
            next.rbParent = node.rbParent;
            node = next.rbRight;
            parent.rbLeft = node;
            next.rbRight = right;
            right.rbParent = next;
            }
        else {
            next.rbParent = parent;
            parent = next;
            node = next.rbRight;
            }
        }
    else {
        isRed = node.rbRed;
        node = next;
        }
    // 'node' is now the sole successor's child and 'parent' its
    // new parent (since the successor can have been moved)
    if (node) {
        node.rbParent = parent;
        }
    // the 'easy' cases
    if (isRed) {return;}
    if (node && node.rbRed) {
        node.rbRed = false;
        return;
        }
    // the other cases
    var sibling;
    do {
        if (node === this.root) {
            break;
            }
        if (node === parent.rbLeft) {
            sibling = parent.rbRight;
            if (sibling.rbRed) {
                sibling.rbRed = false;
                parent.rbRed = true;
                this.rbRotateLeft(parent);
                sibling = parent.rbRight;
                }
            if ((sibling.rbLeft && sibling.rbLeft.rbRed) || (sibling.rbRight && sibling.rbRight.rbRed)) {
                if (!sibling.rbRight || !sibling.rbRight.rbRed) {
                    sibling.rbLeft.rbRed = false;
                    sibling.rbRed = true;
                    this.rbRotateRight(sibling);
                    sibling = parent.rbRight;
                    }
                sibling.rbRed = parent.rbRed;
                parent.rbRed = sibling.rbRight.rbRed = false;
                this.rbRotateLeft(parent);
                node = this.root;
                break;
                }
            }
        else {
            sibling = parent.rbLeft;
            if (sibling.rbRed) {
                sibling.rbRed = false;
                parent.rbRed = true;
                this.rbRotateRight(parent);
                sibling = parent.rbLeft;
                }
            if ((sibling.rbLeft && sibling.rbLeft.rbRed) || (sibling.rbRight && sibling.rbRight.rbRed)) {
                if (!sibling.rbLeft || !sibling.rbLeft.rbRed) {
                    sibling.rbRight.rbRed = false;
                    sibling.rbRed = true;
                    this.rbRotateLeft(sibling);
                    sibling = parent.rbLeft;
                    }
                sibling.rbRed = parent.rbRed;
                parent.rbRed = sibling.rbLeft.rbRed = false;
                this.rbRotateRight(parent);
                node = this.root;
                break;
                }
            }
        sibling.rbRed = true;
        node = parent;
        parent = parent.rbParent;
    } while (!node.rbRed);
    if (node) {node.rbRed = false;}
    };

Voronoi.prototype.RBTree.prototype.rbRotateLeft = function(node) {
    var p = node,
        q = node.rbRight, // can't be null
        parent = p.rbParent;
    if (parent) {
        if (parent.rbLeft === p) {
            parent.rbLeft = q;
            }
        else {
            parent.rbRight = q;
            }
        }
    else {
        this.root = q;
        }
    q.rbParent = parent;
    p.rbParent = q;
    p.rbRight = q.rbLeft;
    if (p.rbRight) {
        p.rbRight.rbParent = p;
        }
    q.rbLeft = p;
    };

Voronoi.prototype.RBTree.prototype.rbRotateRight = function(node) {
    var p = node,
        q = node.rbLeft, // can't be null
        parent = p.rbParent;
    if (parent) {
        if (parent.rbLeft === p) {
            parent.rbLeft = q;
            }
        else {
            parent.rbRight = q;
            }
        }
    else {
        this.root = q;
        }
    q.rbParent = parent;
    p.rbParent = q;
    p.rbLeft = q.rbRight;
    if (p.rbLeft) {
        p.rbLeft.rbParent = p;
        }
    q.rbRight = p;
    };

Voronoi.prototype.RBTree.prototype.getFirst = function(node) {
    while (node.rbLeft) {
        node = node.rbLeft;
        }
    return node;
    };

Voronoi.prototype.RBTree.prototype.getLast = function(node) {
    while (node.rbRight) {
        node = node.rbRight;
        }
    return node;
    };

// ---------------------------------------------------------------------------
// Diagram methods

Voronoi.prototype.Diagram = function(site) {
    this.site = site;
    };

// ---------------------------------------------------------------------------
// Cell methods

Voronoi.prototype.Cell = function(site) {
    this.site = site;
    this.halfedges = [];
    this.closeMe = false;
    };

Voronoi.prototype.Cell.prototype.init = function(site) {
    this.site = site;
    this.halfedges = [];
    this.closeMe = false;
    return this;
    };

Voronoi.prototype.createCell = function(site) {
    var cell = this.cellJunkyard.pop();
    if ( cell ) {
        return cell.init(site);
        }
    return new this.Cell(site);
    };

Voronoi.prototype.Cell.prototype.prepareHalfedges = function() {
    var halfedges = this.halfedges,
        iHalfedge = halfedges.length,
        edge;
    // get rid of unused halfedges
    // rhill 2011-05-27: Keep it simple, no point here in trying
    // to be fancy: dangling edges are a typically a minority.
    while (iHalfedge--) {
        edge = halfedges[iHalfedge].edge;
        if (!edge.vb || !edge.va) {
            halfedges.splice(iHalfedge,1);
            }
        }

    // rhill 2011-05-26: I tried to use a binary search at insertion
    // time to keep the array sorted on-the-fly (in Cell.addHalfedge()).
    // There was no real benefits in doing so, performance on
    // Firefox 3.6 was improved marginally, while performance on
    // Opera 11 was penalized marginally.
    halfedges.sort(function(a,b){return b.angle-a.angle;});
    return halfedges.length;
    };

// Return a list of the neighbor Ids
Voronoi.prototype.Cell.prototype.getNeighborIds = function() {
    var neighbors = [],
        iHalfedge = this.halfedges.length,
        edge;
    while (iHalfedge--){
        edge = this.halfedges[iHalfedge].edge;
        if (edge.lSite !== null && edge.lSite.voronoiId != this.site.voronoiId) {
            neighbors.push(edge.lSite.voronoiId);
            }
        else if (edge.rSite !== null && edge.rSite.voronoiId != this.site.voronoiId){
            neighbors.push(edge.rSite.voronoiId);
            }
        }
    return neighbors;
    };

// Compute bounding box
//
Voronoi.prototype.Cell.prototype.getBbox = function() {
    var halfedges = this.halfedges,
        iHalfedge = halfedges.length,
        xmin = Infinity,
        ymin = Infinity,
        xmax = -Infinity,
        ymax = -Infinity,
        v, vx, vy;
    while (iHalfedge--) {
        v = halfedges[iHalfedge].getStartpoint();
        vx = v.x;
        vy = v.y;
        if (vx < xmin) {xmin = vx;}
        if (vy < ymin) {ymin = vy;}
        if (vx > xmax) {xmax = vx;}
        if (vy > ymax) {ymax = vy;}
        // we dont need to take into account end point,
        // since each end point matches a start point
        }
    return {
        x: xmin,
        y: ymin,
        width: xmax-xmin,
        height: ymax-ymin
        };
    };

// Return whether a point is inside, on, or outside the cell:
//   -1: point is outside the perimeter of the cell
//    0: point is on the perimeter of the cell
//    1: point is inside the perimeter of the cell
//
Voronoi.prototype.Cell.prototype.pointIntersection = function(x, y) {
    // Check if point in polygon. Since all polygons of a Voronoi
    // diagram are convex, then:
    // http://paulbourke.net/geometry/polygonmesh/
    // Solution 3 (2D):
    //   "If the polygon is convex then one can consider the polygon
    //   "as a 'path' from the first vertex. A point is on the interior
    //   "of this polygons if it is always on the same side of all the
    //   "line segments making up the path. ...
    //   "(y - y0) (x1 - x0) - (x - x0) (y1 - y0)
    //   "if it is less than 0 then P is to the right of the line segment,
    //   "if greater than 0 it is to the left, if equal to 0 then it lies
    //   "on the line segment"
    var halfedges = this.halfedges,
        iHalfedge = halfedges.length,
        halfedge,
        p0, p1, r;
    while (iHalfedge--) {
        halfedge = halfedges[iHalfedge];
        p0 = halfedge.getStartpoint();
        p1 = halfedge.getEndpoint();
        r = (y-p0.y)*(p1.x-p0.x)-(x-p0.x)*(p1.y-p0.y);
        if (!r) {
            return 0;
            }
        if (r > 0) {
            return -1;
            }
        }
    return 1;
    };

// ---------------------------------------------------------------------------
// Edge methods
//

Voronoi.prototype.Vertex = function(x, y) {
    this.x = x;
    this.y = y;
    };

Voronoi.prototype.Edge = function(lSite, rSite) {
    this.lSite = lSite;
    this.rSite = rSite;
    this.va = this.vb = null;
    };

Voronoi.prototype.Halfedge = function(edge, lSite, rSite) {
    this.site = lSite;
    this.edge = edge;
    // 'angle' is a value to be used for properly sorting the
    // halfsegments counterclockwise. By convention, we will
    // use the angle of the line defined by the 'site to the left'
    // to the 'site to the right'.
    // However, border edges have no 'site to the right': thus we
    // use the angle of line perpendicular to the halfsegment (the
    // edge should have both end points defined in such case.)
    if (rSite) {
        this.angle = Math.atan2(rSite.y-lSite.y, rSite.x-lSite.x);
        }
    else {
        var va = edge.va,
            vb = edge.vb;
        // rhill 2011-05-31: used to call getStartpoint()/getEndpoint(),
        // but for performance purpose, these are expanded in place here.
        this.angle = edge.lSite === lSite ?
            Math.atan2(vb.x-va.x, va.y-vb.y) :
            Math.atan2(va.x-vb.x, vb.y-va.y);
        }
    };

Voronoi.prototype.createHalfedge = function(edge, lSite, rSite) {
    return new this.Halfedge(edge, lSite, rSite);
    };

Voronoi.prototype.Halfedge.prototype.getStartpoint = function() {
    return this.edge.lSite === this.site ? this.edge.va : this.edge.vb;
    };

Voronoi.prototype.Halfedge.prototype.getEndpoint = function() {
    return this.edge.lSite === this.site ? this.edge.vb : this.edge.va;
    };



// this create and add a vertex to the internal collection

Voronoi.prototype.createVertex = function(x, y) {
    var v = this.vertexJunkyard.pop();
    if ( !v ) {
        v = new this.Vertex(x, y);
        }
    else {
        v.x = x;
        v.y = y;
        }
    this.vertices.push(v);
    return v;
    };

// this create and add an edge to internal collection, and also create
// two halfedges which are added to each site's counterclockwise array
// of halfedges.

Voronoi.prototype.createEdge = function(lSite, rSite, va, vb) {
    var edge = this.edgeJunkyard.pop();
    if ( !edge ) {
        edge = new this.Edge(lSite, rSite);
        }
    else {
        edge.lSite = lSite;
        edge.rSite = rSite;
        edge.va = edge.vb = null;
        }

    this.edges.push(edge);
    if (va) {
        this.setEdgeStartpoint(edge, lSite, rSite, va);
        }
    if (vb) {
        this.setEdgeEndpoint(edge, lSite, rSite, vb);
        }
    this.cells[lSite.voronoiId].halfedges.push(this.createHalfedge(edge, lSite, rSite));
    this.cells[rSite.voronoiId].halfedges.push(this.createHalfedge(edge, rSite, lSite));
    return edge;
    };

Voronoi.prototype.createBorderEdge = function(lSite, va, vb) {
    var edge = this.edgeJunkyard.pop();
    if ( !edge ) {
        edge = new this.Edge(lSite, null);
        }
    else {
        edge.lSite = lSite;
        edge.rSite = null;
        }
    edge.va = va;
    edge.vb = vb;
    this.edges.push(edge);
    return edge;
    };

Voronoi.prototype.setEdgeStartpoint = function(edge, lSite, rSite, vertex) {
    if (!edge.va && !edge.vb) {
        edge.va = vertex;
        edge.lSite = lSite;
        edge.rSite = rSite;
        }
    else if (edge.lSite === rSite) {
        edge.vb = vertex;
        }
    else {
        edge.va = vertex;
        }
    };

Voronoi.prototype.setEdgeEndpoint = function(edge, lSite, rSite, vertex) {
    this.setEdgeStartpoint(edge, rSite, lSite, vertex);
    };

// ---------------------------------------------------------------------------
// Beachline methods

// rhill 2011-06-07: For some reasons, performance suffers significantly
// when instanciating a literal object instead of an empty ctor
Voronoi.prototype.Beachsection = function() {
    };

// rhill 2011-06-02: A lot of Beachsection instanciations
// occur during the computation of the Voronoi diagram,
// somewhere between the number of sites and twice the
// number of sites, while the number of Beachsections on the
// beachline at any given time is comparatively low. For this
// reason, we reuse already created Beachsections, in order
// to avoid new memory allocation. This resulted in a measurable
// performance gain.

Voronoi.prototype.createBeachsection = function(site) {
    var beachsection = this.beachsectionJunkyard.pop();
    if (!beachsection) {
        beachsection = new this.Beachsection();
        }
    beachsection.site = site;
    return beachsection;
    };

// calculate the left break point of a particular beach section,
// given a particular sweep line
Voronoi.prototype.leftBreakPoint = function(arc, directrix) {
    // http://en.wikipedia.org/wiki/Parabola
    // http://en.wikipedia.org/wiki/Quadratic_equation
    // h1 = x1,
    // k1 = (y1+directrix)/2,
    // h2 = x2,
    // k2 = (y2+directrix)/2,
    // p1 = k1-directrix,
    // a1 = 1/(4*p1),
    // b1 = -h1/(2*p1),
    // c1 = h1*h1/(4*p1)+k1,
    // p2 = k2-directrix,
    // a2 = 1/(4*p2),
    // b2 = -h2/(2*p2),
    // c2 = h2*h2/(4*p2)+k2,
    // x = (-(b2-b1) + Math.sqrt((b2-b1)*(b2-b1) - 4*(a2-a1)*(c2-c1))) / (2*(a2-a1))
    // When x1 become the x-origin:
    // h1 = 0,
    // k1 = (y1+directrix)/2,
    // h2 = x2-x1,
    // k2 = (y2+directrix)/2,
    // p1 = k1-directrix,
    // a1 = 1/(4*p1),
    // b1 = 0,
    // c1 = k1,
    // p2 = k2-directrix,
    // a2 = 1/(4*p2),
    // b2 = -h2/(2*p2),
    // c2 = h2*h2/(4*p2)+k2,
    // x = (-b2 + Math.sqrt(b2*b2 - 4*(a2-a1)*(c2-k1))) / (2*(a2-a1)) + x1

    // change code below at your own risk: care has been taken to
    // reduce errors due to computers' finite arithmetic precision.
    // Maybe can still be improved, will see if any more of this
    // kind of errors pop up again.
    var site = arc.site,
        rfocx = site.x,
        rfocy = site.y,
        pby2 = rfocy-directrix;
    // parabola in degenerate case where focus is on directrix
    if (!pby2) {
        return rfocx;
        }
    var lArc = arc.rbPrevious;
    if (!lArc) {
        return -Infinity;
        }
    site = lArc.site;
    var lfocx = site.x,
        lfocy = site.y,
        plby2 = lfocy-directrix;
    // parabola in degenerate case where focus is on directrix
    if (!plby2) {
        return lfocx;
        }
    var hl = lfocx-rfocx,
        aby2 = 1/pby2-1/plby2,
        b = hl/plby2;
    if (aby2) {
        return (-b+this.sqrt(b*b-2*aby2*(hl*hl/(-2*plby2)-lfocy+plby2/2+rfocy-pby2/2)))/aby2+rfocx;
        }
    // both parabolas have same distance to directrix, thus break point is midway
    return (rfocx+lfocx)/2;
    };

// calculate the right break point of a particular beach section,
// given a particular directrix
Voronoi.prototype.rightBreakPoint = function(arc, directrix) {
    var rArc = arc.rbNext;
    if (rArc) {
        return this.leftBreakPoint(rArc, directrix);
        }
    var site = arc.site;
    return site.y === directrix ? site.x : Infinity;
    };

Voronoi.prototype.detachBeachsection = function(beachsection) {
    this.detachCircleEvent(beachsection); // detach potentially attached circle event
    this.beachline.rbRemoveNode(beachsection); // remove from RB-tree
    this.beachsectionJunkyard.push(beachsection); // mark for reuse
    };

Voronoi.prototype.removeBeachsection = function(beachsection) {
    var circle = beachsection.circleEvent,
        x = circle.x,
        y = circle.ycenter,
        vertex = this.createVertex(x, y),
        previous = beachsection.rbPrevious,
        next = beachsection.rbNext,
        disappearingTransitions = [beachsection],
        abs_fn = Math.abs;

    // remove collapsed beachsection from beachline
    this.detachBeachsection(beachsection);

    // there could be more than one empty arc at the deletion point, this
    // happens when more than two edges are linked by the same vertex,
    // so we will collect all those edges by looking up both sides of
    // the deletion point.
    // by the way, there is *always* a predecessor/successor to any collapsed
    // beach section, it's just impossible to have a collapsing first/last
    // beach sections on the beachline, since they obviously are unconstrained
    // on their left/right side.

    // look left
    var lArc = previous;
    while (lArc.circleEvent && abs_fn(x-lArc.circleEvent.x)<1e-9 && abs_fn(y-lArc.circleEvent.ycenter)<1e-9) {
        previous = lArc.rbPrevious;
        disappearingTransitions.unshift(lArc);
        this.detachBeachsection(lArc); // mark for reuse
        lArc = previous;
        }
    // even though it is not disappearing, I will also add the beach section
    // immediately to the left of the left-most collapsed beach section, for
    // convenience, since we need to refer to it later as this beach section
    // is the 'left' site of an edge for which a start point is set.
    disappearingTransitions.unshift(lArc);
    this.detachCircleEvent(lArc);

    // look right
    var rArc = next;
    while (rArc.circleEvent && abs_fn(x-rArc.circleEvent.x)<1e-9 && abs_fn(y-rArc.circleEvent.ycenter)<1e-9) {
        next = rArc.rbNext;
        disappearingTransitions.push(rArc);
        this.detachBeachsection(rArc); // mark for reuse
        rArc = next;
        }
    // we also have to add the beach section immediately to the right of the
    // right-most collapsed beach section, since there is also a disappearing
    // transition representing an edge's start point on its left.
    disappearingTransitions.push(rArc);
    this.detachCircleEvent(rArc);

    // walk through all the disappearing transitions between beach sections and
    // set the start point of their (implied) edge.
    var nArcs = disappearingTransitions.length,
        iArc;
    for (iArc=1; iArc<nArcs; iArc++) {
        rArc = disappearingTransitions[iArc];
        lArc = disappearingTransitions[iArc-1];
        this.setEdgeStartpoint(rArc.edge, lArc.site, rArc.site, vertex);
        }

    // create a new edge as we have now a new transition between
    // two beach sections which were previously not adjacent.
    // since this edge appears as a new vertex is defined, the vertex
    // actually define an end point of the edge (relative to the site
    // on the left)
    lArc = disappearingTransitions[0];
    rArc = disappearingTransitions[nArcs-1];
    rArc.edge = this.createEdge(lArc.site, rArc.site, undefined, vertex);

    // create circle events if any for beach sections left in the beachline
    // adjacent to collapsed sections
    this.attachCircleEvent(lArc);
    this.attachCircleEvent(rArc);
    };

Voronoi.prototype.addBeachsection = function(site) {
    var x = site.x,
        directrix = site.y;

    // find the left and right beach sections which will surround the newly
    // created beach section.
    // rhill 2011-06-01: This loop is one of the most often executed,
    // hence we expand in-place the comparison-against-epsilon calls.
    var lArc, rArc,
        dxl, dxr,
        node = this.beachline.root;

    while (node) {
        dxl = this.leftBreakPoint(node,directrix)-x;
        // x lessThanWithEpsilon xl => falls somewhere before the left edge of the beachsection
        if (dxl > 1e-9) {
            // this case should never happen
            // if (!node.rbLeft) {
            //    rArc = node.rbLeft;
            //    break;
            //    }
            node = node.rbLeft;
            }
        else {
            dxr = x-this.rightBreakPoint(node,directrix);
            // x greaterThanWithEpsilon xr => falls somewhere after the right edge of the beachsection
            if (dxr > 1e-9) {
                if (!node.rbRight) {
                    lArc = node;
                    break;
                    }
                node = node.rbRight;
                }
            else {
                // x equalWithEpsilon xl => falls exactly on the left edge of the beachsection
                if (dxl > -1e-9) {
                    lArc = node.rbPrevious;
                    rArc = node;
                    }
                // x equalWithEpsilon xr => falls exactly on the right edge of the beachsection
                else if (dxr > -1e-9) {
                    lArc = node;
                    rArc = node.rbNext;
                    }
                // falls exactly somewhere in the middle of the beachsection
                else {
                    lArc = rArc = node;
                    }
                break;
                }
            }
        }
    // at this point, keep in mind that lArc and/or rArc could be
    // undefined or null.

    // create a new beach section object for the site and add it to RB-tree
    var newArc = this.createBeachsection(site);
    this.beachline.rbInsertSuccessor(lArc, newArc);

    // cases:
    //

    // [null,null]
    // least likely case: new beach section is the first beach section on the
    // beachline.
    // This case means:
    //   no new transition appears
    //   no collapsing beach section
    //   new beachsection become root of the RB-tree
    if (!lArc && !rArc) {
        return;
        }

    // [lArc,rArc] where lArc == rArc
    // most likely case: new beach section split an existing beach
    // section.
    // This case means:
    //   one new transition appears
    //   the left and right beach section might be collapsing as a result
    //   two new nodes added to the RB-tree
    if (lArc === rArc) {
        // invalidate circle event of split beach section
        this.detachCircleEvent(lArc);

        // split the beach section into two separate beach sections
        rArc = this.createBeachsection(lArc.site);
        this.beachline.rbInsertSuccessor(newArc, rArc);

        // since we have a new transition between two beach sections,
        // a new edge is born
        newArc.edge = rArc.edge = this.createEdge(lArc.site, newArc.site);

        // check whether the left and right beach sections are collapsing
        // and if so create circle events, to be notified when the point of
        // collapse is reached.
        this.attachCircleEvent(lArc);
        this.attachCircleEvent(rArc);
        return;
        }

    // [lArc,null]
    // even less likely case: new beach section is the *last* beach section
    // on the beachline -- this can happen *only* if *all* the previous beach
    // sections currently on the beachline share the same y value as
    // the new beach section.
    // This case means:
    //   one new transition appears
    //   no collapsing beach section as a result
    //   new beach section become right-most node of the RB-tree
    if (lArc && !rArc) {
        newArc.edge = this.createEdge(lArc.site,newArc.site);
        return;
        }

    // [null,rArc]
    // impossible case: because sites are strictly processed from top to bottom,
    // and left to right, which guarantees that there will always be a beach section
    // on the left -- except of course when there are no beach section at all on
    // the beach line, which case was handled above.
    // rhill 2011-06-02: No point testing in non-debug version
    //if (!lArc && rArc) {
    //    throw "Voronoi.addBeachsection(): What is this I don't even";
    //    }

    // [lArc,rArc] where lArc != rArc
    // somewhat less likely case: new beach section falls *exactly* in between two
    // existing beach sections
    // This case means:
    //   one transition disappears
    //   two new transitions appear
    //   the left and right beach section might be collapsing as a result
    //   only one new node added to the RB-tree
    if (lArc !== rArc) {
        // invalidate circle events of left and right sites
        this.detachCircleEvent(lArc);
        this.detachCircleEvent(rArc);

        // an existing transition disappears, meaning a vertex is defined at
        // the disappearance point.
        // since the disappearance is caused by the new beachsection, the
        // vertex is at the center of the circumscribed circle of the left,
        // new and right beachsections.
        // http://mathforum.org/library/drmath/view/55002.html
        // Except that I bring the origin at A to simplify
        // calculation
        var lSite = lArc.site,
            ax = lSite.x,
            ay = lSite.y,
            bx=site.x-ax,
            by=site.y-ay,
            rSite = rArc.site,
            cx=rSite.x-ax,
            cy=rSite.y-ay,
            d=2*(bx*cy-by*cx),
            hb=bx*bx+by*by,
            hc=cx*cx+cy*cy,
            vertex = this.createVertex((cy*hb-by*hc)/d+ax, (bx*hc-cx*hb)/d+ay);

        // one transition disappear
        this.setEdgeStartpoint(rArc.edge, lSite, rSite, vertex);

        // two new transitions appear at the new vertex location
        newArc.edge = this.createEdge(lSite, site, undefined, vertex);
        rArc.edge = this.createEdge(site, rSite, undefined, vertex);

        // check whether the left and right beach sections are collapsing
        // and if so create circle events, to handle the point of collapse.
        this.attachCircleEvent(lArc);
        this.attachCircleEvent(rArc);
        return;
        }
    };

// ---------------------------------------------------------------------------
// Circle event methods

// rhill 2011-06-07: For some reasons, performance suffers significantly
// when instanciating a literal object instead of an empty ctor
Voronoi.prototype.CircleEvent = function() {
    // rhill 2013-10-12: it helps to state exactly what we are at ctor time.
    this.arc = null;
    this.rbLeft = null;
    this.rbNext = null;
    this.rbParent = null;
    this.rbPrevious = null;
    this.rbRed = false;
    this.rbRight = null;
    this.site = null;
    this.x = this.y = this.ycenter = 0;
    };

Voronoi.prototype.attachCircleEvent = function(arc) {
    var lArc = arc.rbPrevious,
        rArc = arc.rbNext;
    if (!lArc || !rArc) {return;} // does that ever happen?
    var lSite = lArc.site,
        cSite = arc.site,
        rSite = rArc.site;

    // If site of left beachsection is same as site of
    // right beachsection, there can't be convergence
    if (lSite===rSite) {return;}

    // Find the circumscribed circle for the three sites associated
    // with the beachsection triplet.
    // rhill 2011-05-26: It is more efficient to calculate in-place
    // rather than getting the resulting circumscribed circle from an
    // object returned by calling Voronoi.circumcircle()
    // http://mathforum.org/library/drmath/view/55002.html
    // Except that I bring the origin at cSite to simplify calculations.
    // The bottom-most part of the circumcircle is our Fortune 'circle
    // event', and its center is a vertex potentially part of the final
    // Voronoi diagram.
    var bx = cSite.x,
        by = cSite.y,
        ax = lSite.x-bx,
        ay = lSite.y-by,
        cx = rSite.x-bx,
        cy = rSite.y-by;

    // If points l->c->r are clockwise, then center beach section does not
    // collapse, hence it can't end up as a vertex (we reuse 'd' here, which
    // sign is reverse of the orientation, hence we reverse the test.
    // http://en.wikipedia.org/wiki/Curve_orientation#Orientation_of_a_simple_polygon
    // rhill 2011-05-21: Nasty finite precision error which caused circumcircle() to
    // return infinites: 1e-12 seems to fix the problem.
    var d = 2*(ax*cy-ay*cx);
    if (d >= -2e-12){return;}

    var ha = ax*ax+ay*ay,
        hc = cx*cx+cy*cy,
        x = (cy*ha-ay*hc)/d,
        y = (ax*hc-cx*ha)/d,
        ycenter = y+by;

    // Important: ybottom should always be under or at sweep, so no need
    // to waste CPU cycles by checking

    // recycle circle event object if possible
    var circleEvent = this.circleEventJunkyard.pop();
    if (!circleEvent) {
        circleEvent = new this.CircleEvent();
        }
    circleEvent.arc = arc;
    circleEvent.site = cSite;
    circleEvent.x = x+bx;
    circleEvent.y = ycenter+this.sqrt(x*x+y*y); // y bottom
    circleEvent.ycenter = ycenter;
    arc.circleEvent = circleEvent;

    // find insertion point in RB-tree: circle events are ordered from
    // smallest to largest
    var predecessor = null,
        node = this.circleEvents.root;
    while (node) {
        if (circleEvent.y < node.y || (circleEvent.y === node.y && circleEvent.x <= node.x)) {
            if (node.rbLeft) {
                node = node.rbLeft;
                }
            else {
                predecessor = node.rbPrevious;
                break;
                }
            }
        else {
            if (node.rbRight) {
                node = node.rbRight;
                }
            else {
                predecessor = node;
                break;
                }
            }
        }
    this.circleEvents.rbInsertSuccessor(predecessor, circleEvent);
    if (!predecessor) {
        this.firstCircleEvent = circleEvent;
        }
    };

Voronoi.prototype.detachCircleEvent = function(arc) {
    var circleEvent = arc.circleEvent;
    if (circleEvent) {
        if (!circleEvent.rbPrevious) {
            this.firstCircleEvent = circleEvent.rbNext;
            }
        this.circleEvents.rbRemoveNode(circleEvent); // remove from RB-tree
        this.circleEventJunkyard.push(circleEvent);
        arc.circleEvent = null;
        }
    };

// ---------------------------------------------------------------------------
// Diagram completion methods

// connect dangling edges (not if a cursory test tells us
// it is not going to be visible.
// return value:
//   false: the dangling endpoint couldn't be connected
//   true: the dangling endpoint could be connected
Voronoi.prototype.connectEdge = function(edge, bbox) {
    // skip if end point already connected
    var vb = edge.vb;
    if (!!vb) {return true;}

    // make local copy for performance purpose
    var va = edge.va,
        xl = bbox.xl,
        xr = bbox.xr,
        yt = bbox.yt,
        yb = bbox.yb,
        lSite = edge.lSite,
        rSite = edge.rSite,
        lx = lSite.x,
        ly = lSite.y,
        rx = rSite.x,
        ry = rSite.y,
        fx = (lx+rx)/2,
        fy = (ly+ry)/2,
        fm, fb;

    // if we reach here, this means cells which use this edge will need
    // to be closed, whether because the edge was removed, or because it
    // was connected to the bounding box.
    this.cells[lSite.voronoiId].closeMe = true;
    this.cells[rSite.voronoiId].closeMe = true;

    // get the line equation of the bisector if line is not vertical
    if (ry !== ly) {
        fm = (lx-rx)/(ry-ly);
        fb = fy-fm*fx;
        }

    // remember, direction of line (relative to left site):
    // upward: left.x < right.x
    // downward: left.x > right.x
    // horizontal: left.x == right.x
    // upward: left.x < right.x
    // rightward: left.y < right.y
    // leftward: left.y > right.y
    // vertical: left.y == right.y

    // depending on the direction, find the best side of the
    // bounding box to use to determine a reasonable start point

    // rhill 2013-12-02:
    // While at it, since we have the values which define the line,
    // clip the end of va if it is outside the bbox.
    // https://github.com/gorhill/Javascript-Voronoi/issues/15
    // TODO: Do all the clipping here rather than rely on Liang-Barsky
    // which does not do well sometimes due to loss of arithmetic
    // precision. The code here doesn't degrade if one of the vertex is
    // at a huge distance.

    // special case: vertical line
    if (fm === undefined) {
        // doesn't intersect with viewport
        if (fx < xl || fx >= xr) {return false;}
        // downward
        if (lx > rx) {
            if (!va || va.y < yt) {
                va = this.createVertex(fx, yt);
                }
            else if (va.y >= yb) {
                return false;
                }
            vb = this.createVertex(fx, yb);
            }
        // upward
        else {
            if (!va || va.y > yb) {
                va = this.createVertex(fx, yb);
                }
            else if (va.y < yt) {
                return false;
                }
            vb = this.createVertex(fx, yt);
            }
        }
    // closer to vertical than horizontal, connect start point to the
    // top or bottom side of the bounding box
    else if (fm < -1 || fm > 1) {
        // downward
        if (lx > rx) {
            if (!va || va.y < yt) {
                va = this.createVertex((yt-fb)/fm, yt);
                }
            else if (va.y >= yb) {
                return false;
                }
            vb = this.createVertex((yb-fb)/fm, yb);
            }
        // upward
        else {
            if (!va || va.y > yb) {
                va = this.createVertex((yb-fb)/fm, yb);
                }
            else if (va.y < yt) {
                return false;
                }
            vb = this.createVertex((yt-fb)/fm, yt);
            }
        }
    // closer to horizontal than vertical, connect start point to the
    // left or right side of the bounding box
    else {
        // rightward
        if (ly < ry) {
            if (!va || va.x < xl) {
                va = this.createVertex(xl, fm*xl+fb);
                }
            else if (va.x >= xr) {
                return false;
                }
            vb = this.createVertex(xr, fm*xr+fb);
            }
        // leftward
        else {
            if (!va || va.x > xr) {
                va = this.createVertex(xr, fm*xr+fb);
                }
            else if (va.x < xl) {
                return false;
                }
            vb = this.createVertex(xl, fm*xl+fb);
            }
        }
    edge.va = va;
    edge.vb = vb;

    return true;
    };

// line-clipping code taken from:
//   Liang-Barsky function by Daniel White
//   http://www.skytopia.com/project/articles/compsci/clipping.html
// Thanks!
// A bit modified to minimize code paths
Voronoi.prototype.clipEdge = function(edge, bbox) {
    var ax = edge.va.x,
        ay = edge.va.y,
        bx = edge.vb.x,
        by = edge.vb.y,
        t0 = 0,
        t1 = 1,
        dx = bx-ax,
        dy = by-ay;
    // left
    var q = ax-bbox.xl;
    if (dx===0 && q<0) {return false;}
    var r = -q/dx;
    if (dx<0) {
        if (r<t0) {return false;}
        if (r<t1) {t1=r;}
        }
    else if (dx>0) {
        if (r>t1) {return false;}
        if (r>t0) {t0=r;}
        }
    // right
    q = bbox.xr-ax;
    if (dx===0 && q<0) {return false;}
    r = q/dx;
    if (dx<0) {
        if (r>t1) {return false;}
        if (r>t0) {t0=r;}
        }
    else if (dx>0) {
        if (r<t0) {return false;}
        if (r<t1) {t1=r;}
        }
    // top
    q = ay-bbox.yt;
    if (dy===0 && q<0) {return false;}
    r = -q/dy;
    if (dy<0) {
        if (r<t0) {return false;}
        if (r<t1) {t1=r;}
        }
    else if (dy>0) {
        if (r>t1) {return false;}
        if (r>t0) {t0=r;}
        }
    // bottom        
    q = bbox.yb-ay;
    if (dy===0 && q<0) {return false;}
    r = q/dy;
    if (dy<0) {
        if (r>t1) {return false;}
        if (r>t0) {t0=r;}
        }
    else if (dy>0) {
        if (r<t0) {return false;}
        if (r<t1) {t1=r;}
        }

    // if we reach this point, Voronoi edge is within bbox

    // if t0 > 0, va needs to change
    // rhill 2011-06-03: we need to create a new vertex rather
    // than modifying the existing one, since the existing
    // one is likely shared with at least another edge
    if (t0 > 0) {
        edge.va = this.createVertex(ax+t0*dx, ay+t0*dy);
        }

    // if t1 < 1, vb needs to change
    // rhill 2011-06-03: we need to create a new vertex rather
    // than modifying the existing one, since the existing
    // one is likely shared with at least another edge
    if (t1 < 1) {
        edge.vb = this.createVertex(ax+t1*dx, ay+t1*dy);
        }

    // va and/or vb were clipped, thus we will need to close
    // cells which use this edge.
    if ( t0 > 0 || t1 < 1 ) {
        this.cells[edge.lSite.voronoiId].closeMe = true;
        this.cells[edge.rSite.voronoiId].closeMe = true;
    }

    return true;
    };

// Connect/cut edges at bounding box
Voronoi.prototype.clipEdges = function(bbox) {
    // connect all dangling edges to bounding box
    // or get rid of them if it can't be done
    var edges = this.edges,
        iEdge = edges.length,
        edge,
        abs_fn = Math.abs;

    // iterate backward so we can splice safely
    while (iEdge--) {
        edge = edges[iEdge];
        // edge is removed if:
        //   it is wholly outside the bounding box
        //   it is looking more like a point than a line
        if (!this.connectEdge(edge, bbox) ||
            !this.clipEdge(edge, bbox) ||
            (abs_fn(edge.va.x-edge.vb.x)<1e-9 && abs_fn(edge.va.y-edge.vb.y)<1e-9)) {
            edge.va = edge.vb = null;
            edges.splice(iEdge,1);
            }
        }
    };

// Close the cells.
// The cells are bound by the supplied bounding box.
// Each cell refers to its associated site, and a list
// of halfedges ordered counterclockwise.
Voronoi.prototype.closeCells = function(bbox) {
    var xl = bbox.xl,
        xr = bbox.xr,
        yt = bbox.yt,
        yb = bbox.yb,
        cells = this.cells,
        iCell = cells.length,
        cell,
        iLeft,
        halfedges, nHalfedges,
        edge,
        va, vb, vz,
        lastBorderSegment,
        abs_fn = Math.abs;

    while (iCell--) {
        cell = cells[iCell];
        // prune, order halfedges counterclockwise, then add missing ones
        // required to close cells
        if (!cell.prepareHalfedges()) {
            continue;
            }
        if (!cell.closeMe) {
            continue;
            }
        // find first 'unclosed' point.
        // an 'unclosed' point will be the end point of a halfedge which
        // does not match the start point of the following halfedge
        halfedges = cell.halfedges;
        nHalfedges = halfedges.length;
        // special case: only one site, in which case, the viewport is the cell
        // ...

        // all other cases
        iLeft = 0;
        while (iLeft < nHalfedges) {
            va = halfedges[iLeft].getEndpoint();
            vz = halfedges[(iLeft+1) % nHalfedges].getStartpoint();
            // if end point is not equal to start point, we need to add the missing
            // halfedge(s) up to vz
            if (abs_fn(va.x-vz.x)>=1e-9 || abs_fn(va.y-vz.y)>=1e-9) {

                // rhill 2013-12-02:
                // "Holes" in the halfedges are not necessarily always adjacent.
                // https://github.com/gorhill/Javascript-Voronoi/issues/16

                // find entry point:
                switch (true) {

                    // walk downward along left side
                    case this.equalWithEpsilon(va.x,xl) && this.lessThanWithEpsilon(va.y,yb):
                        lastBorderSegment = this.equalWithEpsilon(vz.x,xl);
                        vb = this.createVertex(xl, lastBorderSegment ? vz.y : yb);
                        edge = this.createBorderEdge(cell.site, va, vb);
                        iLeft++;
                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                        nHalfedges++;
                        if ( lastBorderSegment ) { break; }
                        va = vb;
                        // fall through

                    // walk rightward along bottom side
                    case this.equalWithEpsilon(va.y,yb) && this.lessThanWithEpsilon(va.x,xr):
                        lastBorderSegment = this.equalWithEpsilon(vz.y,yb);
                        vb = this.createVertex(lastBorderSegment ? vz.x : xr, yb);
                        edge = this.createBorderEdge(cell.site, va, vb);
                        iLeft++;
                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                        nHalfedges++;
                        if ( lastBorderSegment ) { break; }
                        va = vb;
                        // fall through

                    // walk upward along right side
                    case this.equalWithEpsilon(va.x,xr) && this.greaterThanWithEpsilon(va.y,yt):
                        lastBorderSegment = this.equalWithEpsilon(vz.x,xr);
                        vb = this.createVertex(xr, lastBorderSegment ? vz.y : yt);
                        edge = this.createBorderEdge(cell.site, va, vb);
                        iLeft++;
                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                        nHalfedges++;
                        if ( lastBorderSegment ) { break; }
                        va = vb;
                        // fall through

                    // walk leftward along top side
                    case this.equalWithEpsilon(va.y,yt) && this.greaterThanWithEpsilon(va.x,xl):
                        lastBorderSegment = this.equalWithEpsilon(vz.y,yt);
                        vb = this.createVertex(lastBorderSegment ? vz.x : xl, yt);
                        edge = this.createBorderEdge(cell.site, va, vb);
                        iLeft++;
                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                        nHalfedges++;
                        if ( lastBorderSegment ) { break; }
                        va = vb;
                        // fall through

                        // walk downward along left side
                        lastBorderSegment = this.equalWithEpsilon(vz.x,xl);
                        vb = this.createVertex(xl, lastBorderSegment ? vz.y : yb);
                        edge = this.createBorderEdge(cell.site, va, vb);
                        iLeft++;
                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                        nHalfedges++;
                        if ( lastBorderSegment ) { break; }
                        va = vb;
                        // fall through

                        // walk rightward along bottom side
                        lastBorderSegment = this.equalWithEpsilon(vz.y,yb);
                        vb = this.createVertex(lastBorderSegment ? vz.x : xr, yb);
                        edge = this.createBorderEdge(cell.site, va, vb);
                        iLeft++;
                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                        nHalfedges++;
                        if ( lastBorderSegment ) { break; }
                        va = vb;
                        // fall through

                        // walk upward along right side
                        lastBorderSegment = this.equalWithEpsilon(vz.x,xr);
                        vb = this.createVertex(xr, lastBorderSegment ? vz.y : yt);
                        edge = this.createBorderEdge(cell.site, va, vb);
                        iLeft++;
                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                        nHalfedges++;
                        if ( lastBorderSegment ) { break; }
                        // fall through

                    default:
                        throw "Voronoi.closeCells() > this makes no sense!";
                    }
                }
            iLeft++;
            }
        cell.closeMe = false;
        }
    };

// ---------------------------------------------------------------------------
// Debugging helper
/*
Voronoi.prototype.dumpBeachline = function(y) {
    console.log('Voronoi.dumpBeachline(%f) > Beachsections, from left to right:', y);
    if ( !this.beachline ) {
        console.log('  None');
        }
    else {
        var bs = this.beachline.getFirst(this.beachline.root);
        while ( bs ) {
            console.log('  site %d: xl: %f, xr: %f', bs.site.voronoiId, this.leftBreakPoint(bs, y), this.rightBreakPoint(bs, y));
            bs = bs.rbNext;
            }
        }
    };
*/

// ---------------------------------------------------------------------------
// Helper: Quantize sites

// rhill 2013-10-12:
// This is to solve https://github.com/gorhill/Javascript-Voronoi/issues/15
// Since not all users will end up using the kind of coord values which would
// cause the issue to arise, I chose to let the user decide whether or not
// he should sanitize his coord values through this helper. This way, for
// those users who uses coord values which are known to be fine, no overhead is
// added.

Voronoi.prototype.quantizeSites = function(sites) {
    var ε = this.ε,
        n = sites.length,
        site;
    while ( n-- ) {
        site = sites[n];
        site.x = Math.floor(site.x / ε) * ε;
        site.y = Math.floor(site.y / ε) * ε;
        }
    };

// ---------------------------------------------------------------------------
// Helper: Recycle diagram: all vertex, edge and cell objects are
// "surrendered" to the Voronoi object for reuse.
// TODO: rhill-voronoi-core v2: more performance to be gained
// when I change the semantic of what is returned.

Voronoi.prototype.recycle = function(diagram) {
    if ( diagram ) {
        if ( diagram instanceof this.Diagram ) {
            this.toRecycle = diagram;
            }
        else {
            throw 'Voronoi.recycleDiagram() > Need a Diagram object.';
            }
        }
    };

// ---------------------------------------------------------------------------
// Top-level Fortune loop

// rhill 2011-05-19:
//   Voronoi sites are kept client-side now, to allow
//   user to freely modify content. At compute time,
//   *references* to sites are copied locally.

Voronoi.prototype.compute = function(sites, bbox) {
    // to measure execution time
    var startTime = new Date();

    // init internal state
    this.reset();

    // any diagram data available for recycling?
    // I do that here so that this is included in execution time
    if ( this.toRecycle ) {
        this.vertexJunkyard = this.vertexJunkyard.concat(this.toRecycle.vertices);
        this.edgeJunkyard = this.edgeJunkyard.concat(this.toRecycle.edges);
        this.cellJunkyard = this.cellJunkyard.concat(this.toRecycle.cells);
        this.toRecycle = null;
        }

    // Initialize site event queue
    var siteEvents = sites.slice(0);
    siteEvents.sort(function(a,b){
        var r = b.y - a.y;
        if (r) {return r;}
        return b.x - a.x;
        });

    // process queue
    var site = siteEvents.pop(),
        siteid = 0,
        xsitex, // to avoid duplicate sites
        xsitey,
        cells = this.cells,
        circle;

    // main loop
    for (;;) {
        // we need to figure whether we handle a site or circle event
        // for this we find out if there is a site event and it is
        // 'earlier' than the circle event
        circle = this.firstCircleEvent;

        // add beach section
        if (site && (!circle || site.y < circle.y || (site.y === circle.y && site.x < circle.x))) {
            // only if site is not a duplicate
            if (site.x !== xsitex || site.y !== xsitey) {
                // first create cell for new site
                cells[siteid] = this.createCell(site);
                site.voronoiId = siteid++;
                // then create a beachsection for that site
                this.addBeachsection(site);
                // remember last site coords to detect duplicate
                xsitey = site.y;
                xsitex = site.x;
                }
            site = siteEvents.pop();
            }

        // remove beach section
        else if (circle) {
            this.removeBeachsection(circle.arc);
            }

        // all done, quit
        else {
            break;
            }
        }

    // wrapping-up:
    //   connect dangling edges to bounding box
    //   cut edges as per bounding box
    //   discard edges completely outside bounding box
    //   discard edges which are point-like
    this.clipEdges(bbox);

    //   add missing edges in order to close opened cells
    this.closeCells(bbox);

    // to measure execution time
    var stopTime = new Date();

    // prepare return values
    var diagram = new this.Diagram();
    diagram.cells = this.cells;
    diagram.edges = this.edges;
    diagram.vertices = this.vertices;
    diagram.execTime = stopTime.getTime()-startTime.getTime();

    // clean up
    this.reset();

    return diagram;
    };

if(typeof module !== 'undefined') module.exports = Voronoi;

},{}],24:[function(require,module,exports){
module.exports.RADIUS = 6378137;
module.exports.FLATTENING = 1/298.257223563;
module.exports.POLAR_RADIUS = 6356752.3142;

},{}],25:[function(require,module,exports){
// ---------------------------------------------------------------------------------------------------------------------
// GeoJSONUtils
//
// @module
// ---------------------------------------------------------------------------------------------------------------------

var area = require('turf-area');
var _ = require('lodash');

var util = require('util');
function inspect(obj, depth) {
    return util.inspect(obj, {depth: depth || null});
}

// ---------------------------------------------------------------------------------------------------------------------

function GeoJSONUtils() {
}

/**
 * Checks to see if the feature is a Polygon formatted as a MultiPolygon.
 *
 * @param polygon
 * @returns {Polygon}
 */
GeoJSONUtils.prototype.fixMultiPoly = function(polygon) {
    var self = this;

    if(polygon.geometry.type == 'MultiPolygon' && polygon.geometry.coordinates[0].length == 1) {
        // Handle a Polygon in the form of a MultiPolygon
        polygon.geometry.type = 'Polygon';
        polygon.geometry.coordinates = polygon.geometry.coordinates[0];

        return polygon;
    } else if(polygon.geometry.type == 'MultiPolygon' && polygon.geometry.coordinates[0].length > 1) {
        // Handle a true MultiPolygon by returning the Polygon of largest area
        var polygons = _.map(polygon.geometry.coordinates[0], function(coordinates) {
            return self._toGeoJSONFeature(
                self._toGeoJSONPolygon(coordinates)
            );
        });
        var collectionArea = _.map(polygons, area);
        var largestAreaIndex = _.indexOf(collectionArea, _.max(collectionArea));

        return polygons[largestAreaIndex];
    } else {
        return polygon;
    }
};

/**
 * Takes a polygon and generates the sites needed to generate Voronoi
 *
 * @param polygon
 * @param decimalPlaces A power of 10 used to truncate the decimal places of the polygon sites and
 *   bbox. This is a workaround due to the issue referred to here:
 *   https://github.com/gorhill/Javascript-Voronoi/issues/15
 *   Defaults to 1e-20.
 * @returns {{sites: Array, bbox: {xl: *, xr: *, yt: *, yb: *}}}
 */
GeoJSONUtils.prototype.sites = function(polygon, decimalPlaces) {
    if(decimalPlaces === undefined) {
        decimalPlaces = 1e-20;
    }
    var polygonSites = [];
    var xmin,xmax,ymin,ymax;
    for(var i = 0; i < polygon.geometry.coordinates.length; i++) {
        var polyRing = polygon.geometry.coordinates[i].slice();
        for(var j = 0; j < polyRing.length-1; j++) {
            //Push original point
            polygonSites.push({
                x: Math.floor(polyRing[j][0] / decimalPlaces) * decimalPlaces,
                y: Math.floor(polyRing[j][1] / decimalPlaces) * decimalPlaces
            });
            //Push midpoints of segments
            polygonSites.push({
                x: Math.floor(((polyRing[j][0]+polyRing[j+1][0]) / 2) / decimalPlaces) * decimalPlaces,
                y: Math.floor(((polyRing[j][1]+polyRing[j+1][1]) / 2) / decimalPlaces) * decimalPlaces
            });
            //initialize bounding box
            if((i == 0) && (j == 0)) {
                xmin = Math.floor(polyRing[j][0] / decimalPlaces) * decimalPlaces;
                xmax = xmin;
                ymin = Math.floor(polyRing[j][1] / decimalPlaces) * decimalPlaces;
                ymax = ymin;
            } else {
                if(polyRing[j][0] < xmin) {
                    xmin = Math.floor(polyRing[j][0] / decimalPlaces) * decimalPlaces;
                }
                if(polyRing[j][0] > xmax) {
                    xmax = Math.floor(polyRing[j][0] / decimalPlaces) * decimalPlaces;
                }
                if(polyRing[j][1] < ymin) {
                    ymin = Math.floor(polyRing[j][1] / decimalPlaces) * decimalPlaces;
                }
                if(polyRing[j][1] > ymax) {
                    ymax = Math.floor(polyRing[j][1] / decimalPlaces) * decimalPlaces;
                }
            }
        }
    }
    return {
        sites: polygonSites,
        bbox: {
            xl: xmin,
            xr: xmax,
            yt: ymin,
            yb: ymax
        }
    };
};

/**
 *
 * @param geom
 * @returns {{type: string, geometry: *}}
 * @private
 */
GeoJSONUtils.prototype._toGeoJSONFeature = function(geom) {
    return {
        "type": "Feature",
        "geometry": geom
    };
};

/**
 *
 * @param coordinates
 * @returns {{type: string, coordinates: *}}
 * @private
 */
GeoJSONUtils.prototype._toGeoJSONPolygon = function(coordinates) {
    var geom = {
        "type": "Polygon",
        "coordinates": [coordinates]
    };
    return(geom);
};

// ---------------------------------------------------------------------------------------------------------------------

module.exports = new GeoJSONUtils();

// ---------------------------------------------------------------------------------------------------------------------
},{"lodash":5,"turf-area":8,"util":22}]},{},[2])(2)
});

//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvdHVyZi1wb2ludC1vbi1saW5lL2luZGV4LmpzIiwibWF4LWluc2NyaWJlZC1jaXJjbGUuanMiLCJub2RlX21vZHVsZXMvZ2VvanNvbi1hcmVhL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2luaGVyaXRzL2luaGVyaXRzX2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2xvZGFzaC5qcyIsIm5vZGVfbW9kdWxlcy9tYWtlLWVycm9yL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLWFyZWEvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdHVyZi1iZWFyaW5nL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3R1cmYtY2VudHJvaWQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdHVyZi1kZXN0aW5hdGlvbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLWRpc3RhbmNlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3R1cmYtZmVhdHVyZWNvbGxlY3Rpb24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvdHVyZi1oZWxwZXJzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3R1cmYtaW5zaWRlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3R1cmYtaW52YXJpYW50L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3R1cmYtbGluZXN0cmluZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLW1ldGEvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdHVyZi1wb2ludC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLXdpdGhpbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy91dGlsL3N1cHBvcnQvaXNCdWZmZXJCcm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy92b3Jvbm9pL3JoaWxsLXZvcm9ub2ktY29yZS5qcyIsIm5vZGVfbW9kdWxlcy93Z3M4NC9pbmRleC5qcyIsInV0aWxzL2dlb2pzb24tdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25LQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbHFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDblVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzFrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4ckRBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgZGlzdGFuY2UgPSByZXF1aXJlKCd0dXJmLWRpc3RhbmNlJyk7XG52YXIgcG9pbnQgPSByZXF1aXJlKCd0dXJmLXBvaW50Jyk7XG52YXIgbGluZXN0cmluZyA9IHJlcXVpcmUoJ3R1cmYtbGluZXN0cmluZycpO1xudmFyIGJlYXJpbmcgPSByZXF1aXJlKCd0dXJmLWJlYXJpbmcnKTtcbnZhciBkZXN0aW5hdGlvbiA9IHJlcXVpcmUoJ3R1cmYtZGVzdGluYXRpb24nKTtcblxuLyoqXG4gKiBUYWtlcyBhIFBvaW50IGFuZCBhIExpbmVTdHJpbmcgYW5kIGNhbGN1bGF0ZXMgdGhlIGNsb3Nlc3QgUG9pbnQgb24gdGhlIExpbmVTdHJpbmdcbiAqXG4gKiBAbW9kdWxlIHR1cmYvcG9pbnQtb24tbGluZVxuICpcbiAqIEBwYXJhbSB7TGluZVN0cmluZ30gTGluZSB0byBzbmFwIHRvXG4gKiBAcGFyYW0ge1BvaW50fSBQb2ludCB0byBzbmFwIGZyb21cbiAqIEByZXR1cm4ge1BvaW50fSBDbG9zZXN0IFBvaW50IG9uIHRoZSBMaW5lXG4gKiBAZXhhbXBsZVxuICogdmFyIGxpbmUgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJMaW5lU3RyaW5nXCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbXG4gKiAgICAgICBbLTc3LjAzMTY2OSwgMzguODc4NjA1XSxcbiAqICAgICAgIFstNzcuMDI5NjA5LCAzOC44ODE5NDZdLFxuICogICAgICAgWy03Ny4wMjAzMzksIDM4Ljg4NDA4NF0sXG4gKiAgICAgICBbLTc3LjAyNTY2MSwgMzguODg1ODIxXSxcbiAqICAgICAgIFstNzcuMDIxODg0LCAzOC44ODk1NjNdLFxuICogICAgICAgWy03Ny4wMTk4MjQsIDM4Ljg5MjM2OF1cbiAqICAgICBdXG4gKiAgIH1cbiAqIH07XG4gKiB2YXIgcHQgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWy03Ny4wMzcwNzYsIDM4Ljg4NDAxN11cbiAqICAgfVxuICogfTtcbiAqIFxuICogdmFyIHNuYXBwZWQgPSB0dXJmLnBvaW50T25MaW5lKGxpbmUsIHB0KTtcbiAqIHNuYXBwZWQucHJvcGVydGllc1snbWFya2VyLWNvbG9yJ10gPSAnIzAwZidcbiAqXG4gKiB2YXIgcmVzdWx0ID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICogICBcImZlYXR1cmVzXCI6IFtsaW5lLCBwdCwgc25hcHBlZF1cbiAqIH07XG4gKlxuICogLy89cmVzdWx0XG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAobGluZSwgcHQpIHsgIFxuICB2YXIgY29vcmRzO1xuICBpZihsaW5lLnR5cGUgPT09ICdGZWF0dXJlJykgY29vcmRzID0gbGluZS5nZW9tZXRyeS5jb29yZGluYXRlcztcbiAgZWxzZSBpZihsaW5lLnR5cGUgPT09ICdMaW5lU3RyaW5nJykgY29vcmRzID0gbGluZS5nZW9tZXRyeS5jb29yZGluYXRlcztcbiAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ2lucHV0IG11c3QgYmUgYSBMaW5lU3RyaW5nIEZlYXR1cmUgb3IgR2VvbWV0cnknKTtcblxuICByZXR1cm4gcG9pbnRPbkxpbmUocHQsIGNvb3Jkcyk7XG59O1xuXG5mdW5jdGlvbiBwb2ludE9uTGluZSAocHQsIGNvb3Jkcykge1xuICB2YXIgdW5pdHMgPSAnbWlsZXMnO1xuICB2YXIgY2xvc2VzdFB0ID0gcG9pbnQoW0luZmluaXR5LCBJbmZpbml0eV0sIHtkaXN0OiBJbmZpbml0eX0pO1xuICBmb3IodmFyIGkgPSAwOyBpIDwgY29vcmRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgIHZhciBzdGFydCA9IHBvaW50KGNvb3Jkc1tpXSk7XG4gICAgdmFyIHN0b3AgPSBwb2ludChjb29yZHNbaSsxXSk7XG4gICAgLy9zdGFydFxuICAgIHN0YXJ0LnByb3BlcnRpZXMuZGlzdCA9IGRpc3RhbmNlKHB0LCBzdGFydCwgdW5pdHMpO1xuICAgIC8vc3RvcFxuICAgIHN0b3AucHJvcGVydGllcy5kaXN0ID0gZGlzdGFuY2UocHQsIHN0b3AsIHVuaXRzKTtcbiAgICAvL3BlcnBlbmRpY3VsYXJcbiAgICB2YXIgZGlyZWN0aW9uID0gYmVhcmluZyhzdGFydCwgc3RvcCk7XG4gICAgdmFyIHBlcnBlbmRpY3VsYXJQdCA9IGRlc3RpbmF0aW9uKHB0LCAxMDAwICwgZGlyZWN0aW9uICsgOTAsIHVuaXRzKTsgLy8gMTAwMCA9IGdyb3NzXG4gICAgdmFyIGludGVyc2VjdCA9IGxpbmVJbnRlcnNlY3RzKFxuICAgICAgcHQuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0sXG4gICAgICBwdC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXSxcbiAgICAgIHBlcnBlbmRpY3VsYXJQdC5nZW9tZXRyeS5jb29yZGluYXRlc1swXSxcbiAgICAgIHBlcnBlbmRpY3VsYXJQdC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXSxcbiAgICAgIHN0YXJ0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLFxuICAgICAgc3RhcnQuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV0sXG4gICAgICBzdG9wLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLFxuICAgICAgc3RvcC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXVxuICAgICAgKTtcbiAgICBpZighaW50ZXJzZWN0KSB7XG4gICAgICBwZXJwZW5kaWN1bGFyUHQgPSBkZXN0aW5hdGlvbihwdCwgMTAwMCAsIGRpcmVjdGlvbiAtIDkwLCB1bml0cyk7IC8vIDEwMDAgPSBncm9zc1xuICAgICAgaW50ZXJzZWN0ID0gbGluZUludGVyc2VjdHMoXG4gICAgICAgIHB0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLFxuICAgICAgICBwdC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXSxcbiAgICAgICAgcGVycGVuZGljdWxhclB0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLFxuICAgICAgICBwZXJwZW5kaWN1bGFyUHQuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV0sXG4gICAgICAgIHN0YXJ0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLFxuICAgICAgICBzdGFydC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXSxcbiAgICAgICAgc3RvcC5nZW9tZXRyeS5jb29yZGluYXRlc1swXSxcbiAgICAgICAgc3RvcC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXVxuICAgICAgICApO1xuICAgIH1cbiAgICBwZXJwZW5kaWN1bGFyUHQucHJvcGVydGllcy5kaXN0ID0gSW5maW5pdHk7XG4gICAgdmFyIGludGVyc2VjdFB0O1xuICAgIGlmKGludGVyc2VjdCkge1xuICAgICAgdmFyIGludGVyc2VjdFB0ID0gcG9pbnQoaW50ZXJzZWN0KTtcbiAgICAgIGludGVyc2VjdFB0LnByb3BlcnRpZXMuZGlzdCA9IGRpc3RhbmNlKHB0LCBpbnRlcnNlY3RQdCwgdW5pdHMpO1xuICAgIH1cbiAgICBcbiAgICBpZihzdGFydC5wcm9wZXJ0aWVzLmRpc3QgPCBjbG9zZXN0UHQucHJvcGVydGllcy5kaXN0KSB7XG4gICAgICBjbG9zZXN0UHQgPSBzdGFydDtcbiAgICAgIGNsb3Nlc3RQdC5wcm9wZXJ0aWVzLmluZGV4ID0gaTtcbiAgICB9XG4gICAgaWYoc3RvcC5wcm9wZXJ0aWVzLmRpc3QgPCBjbG9zZXN0UHQucHJvcGVydGllcy5kaXN0KSB7XG4gICAgIGNsb3Nlc3RQdCA9IHN0b3A7XG4gICAgIGNsb3Nlc3RQdC5wcm9wZXJ0aWVzLmluZGV4ID0gaTtcbiAgICB9XG4gICAgaWYoaW50ZXJzZWN0UHQgJiYgaW50ZXJzZWN0UHQucHJvcGVydGllcy5kaXN0IDwgY2xvc2VzdFB0LnByb3BlcnRpZXMuZGlzdCl7IFxuICAgICAgY2xvc2VzdFB0ID0gaW50ZXJzZWN0UHQ7XG4gICAgICBjbG9zZXN0UHQucHJvcGVydGllcy5pbmRleCA9IGk7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4gY2xvc2VzdFB0O1xufVxuXG4vLyBtb2RpZmllZCBmcm9tIGh0dHA6Ly9qc2ZpZGRsZS5uZXQvanVzdGluX2Nfcm91bmRzL0dkMlMyL2xpZ2h0L1xuZnVuY3Rpb24gbGluZUludGVyc2VjdHMobGluZTFTdGFydFgsIGxpbmUxU3RhcnRZLCBsaW5lMUVuZFgsIGxpbmUxRW5kWSwgbGluZTJTdGFydFgsIGxpbmUyU3RhcnRZLCBsaW5lMkVuZFgsIGxpbmUyRW5kWSkge1xuICAvLyBpZiB0aGUgbGluZXMgaW50ZXJzZWN0LCB0aGUgcmVzdWx0IGNvbnRhaW5zIHRoZSB4IGFuZCB5IG9mIHRoZSBpbnRlcnNlY3Rpb24gKHRyZWF0aW5nIHRoZSBsaW5lcyBhcyBpbmZpbml0ZSkgYW5kIGJvb2xlYW5zIGZvciB3aGV0aGVyIGxpbmUgc2VnbWVudCAxIG9yIGxpbmUgc2VnbWVudCAyIGNvbnRhaW4gdGhlIHBvaW50XG4gIHZhciBkZW5vbWluYXRvciwgYSwgYiwgbnVtZXJhdG9yMSwgbnVtZXJhdG9yMiwgcmVzdWx0ID0ge1xuICAgIHg6IG51bGwsXG4gICAgeTogbnVsbCxcbiAgICBvbkxpbmUxOiBmYWxzZSxcbiAgICBvbkxpbmUyOiBmYWxzZVxuICB9O1xuICBkZW5vbWluYXRvciA9ICgobGluZTJFbmRZIC0gbGluZTJTdGFydFkpICogKGxpbmUxRW5kWCAtIGxpbmUxU3RhcnRYKSkgLSAoKGxpbmUyRW5kWCAtIGxpbmUyU3RhcnRYKSAqIChsaW5lMUVuZFkgLSBsaW5lMVN0YXJ0WSkpO1xuICBpZiAoZGVub21pbmF0b3IgPT0gMCkge1xuICAgIGlmKHJlc3VsdC54ICE9IG51bGwgJiYgcmVzdWx0LnkgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBhID0gbGluZTFTdGFydFkgLSBsaW5lMlN0YXJ0WTtcbiAgYiA9IGxpbmUxU3RhcnRYIC0gbGluZTJTdGFydFg7XG4gIG51bWVyYXRvcjEgPSAoKGxpbmUyRW5kWCAtIGxpbmUyU3RhcnRYKSAqIGEpIC0gKChsaW5lMkVuZFkgLSBsaW5lMlN0YXJ0WSkgKiBiKTtcbiAgbnVtZXJhdG9yMiA9ICgobGluZTFFbmRYIC0gbGluZTFTdGFydFgpICogYSkgLSAoKGxpbmUxRW5kWSAtIGxpbmUxU3RhcnRZKSAqIGIpO1xuICBhID0gbnVtZXJhdG9yMSAvIGRlbm9taW5hdG9yO1xuICBiID0gbnVtZXJhdG9yMiAvIGRlbm9taW5hdG9yO1xuXG4gIC8vIGlmIHdlIGNhc3QgdGhlc2UgbGluZXMgaW5maW5pdGVseSBpbiBib3RoIGRpcmVjdGlvbnMsIHRoZXkgaW50ZXJzZWN0IGhlcmU6XG4gIHJlc3VsdC54ID0gbGluZTFTdGFydFggKyAoYSAqIChsaW5lMUVuZFggLSBsaW5lMVN0YXJ0WCkpO1xuICByZXN1bHQueSA9IGxpbmUxU3RhcnRZICsgKGEgKiAobGluZTFFbmRZIC0gbGluZTFTdGFydFkpKTtcblxuICAvLyBpZiBsaW5lMSBpcyBhIHNlZ21lbnQgYW5kIGxpbmUyIGlzIGluZmluaXRlLCB0aGV5IGludGVyc2VjdCBpZjpcbiAgaWYgKGEgPj0gMCAmJiBhIDw9IDEpIHtcbiAgICByZXN1bHQub25MaW5lMSA9IHRydWU7XG4gIH1cbiAgLy8gaWYgbGluZTIgaXMgYSBzZWdtZW50IGFuZCBsaW5lMSBpcyBpbmZpbml0ZSwgdGhleSBpbnRlcnNlY3QgaWY6XG4gIGlmIChiID49IDAgJiYgYiA8PSAxKSB7XG4gICAgcmVzdWx0Lm9uTGluZTIgPSB0cnVlO1xuICB9XG4gIC8vIGlmIGxpbmUxIGFuZCBsaW5lMiBhcmUgc2VnbWVudHMsIHRoZXkgaW50ZXJzZWN0IGlmIGJvdGggb2YgdGhlIGFib3ZlIGFyZSB0cnVlXG4gIGlmKHJlc3VsdC5vbkxpbmUxICYmIHJlc3VsdC5vbkxpbmUyKXtcbiAgICByZXR1cm4gW3Jlc3VsdC54LCByZXN1bHQueV07XG4gIH1cbiAgZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iLCJjb25zdCBWb3Jvbm9pID0gcmVxdWlyZSgndm9yb25vaScpO1xuY29uc3Qgdm9yb25vaSA9IG5ldyBWb3Jvbm9pO1xuY29uc3QgY2VudHJvaWQgPSByZXF1aXJlKCd0dXJmLWNlbnRyb2lkJyk7XG5jb25zdCBwb2ludCA9IHJlcXVpcmUoJ3R1cmYtcG9pbnQnKTtcbmNvbnN0IHBvaW50T25MaW5lID0gcmVxdWlyZSgnLi9saWIvdHVyZi1wb2ludC1vbi1saW5lL2luZGV4LmpzJyk7XG5jb25zdCB3aXRoaW4gPSByZXF1aXJlKCd0dXJmLXdpdGhpbicpO1xuY29uc3QgbWFrZUVycm9yID0gcmVxdWlyZSgnbWFrZS1lcnJvcicpO1xuY29uc3QgTm9Qb2ludHNJblNoYXBlRXJyb3IgPSBtYWtlRXJyb3IoJ05vUG9pbnRzSW5TaGFwZUVycm9yJyk7XG5jb25zdCBHZW9KU09OVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzL2dlb2pzb24tdXRpbHMuanMnKTtcblxuLyoqXG4gKiBUYWtlcyBhIHBvbHlnb24gZmVhdHVyZSBhbmQgZXN0aW1hdGVzIHRoZSBiZXN0IHBvc2l0aW9uIGZvciBsYWJlbCBwbGFjZW1lbnQgdGhhdCBpcyBndWFyYW50ZWVkIHRvIGJlIGluc2lkZSB0aGUgcG9seWdvbi4gVGhpcyB1c2VzIHZvcm9ub2kgdG8gZXN0aW1hdGUgdGhlIG1lZGlhbCBheGlzLlxuICpcbiAqIEBtb2R1bGUgdHVyZi9sYWJlbC1wb3NpdGlvblxuICogQHBhcmFtIHtQb2x5Z29ufSBwb2x5Z29uIGEgUG9seWdvbiBmZWF0dXJlIG9mIHRoZSB1bmRlcmx5aW5nIHBvbHlnb24gZ2VvbWV0cnkgaW4gRVBTRzo0MzI2XG4gKiBAcGFyYW0gZGVjaW1hbFBsYWNlcyBBIHBvd2VyIG9mIDEwIHVzZWQgdG8gdHJ1bmNhdGUgdGhlIGRlY2ltYWwgcGxhY2VzIG9mIHRoZSBwb2x5Z29uIHNpdGVzIGFuZFxuICogICBiYm94LiBUaGlzIGlzIGEgd29ya2Fyb3VuZCBkdWUgdG8gdGhlIGlzc3VlIHJlZmVycmVkIHRvIGhlcmU6XG4gKiAgIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9pc3N1ZXMvMTVcbiAqICAgSWYgbGVmdCBlbXB0eSwgd2lsbCBkZWZhdWx0IHRvIHR1bmNhdGluZyBhdCAyMHRoIGRlY2ltYWwgcGxhY2UuXG4gKiBAcmV0dXJucyB7UG9pbnR9IGEgUG9pbnQgZmVhdHVyZSBhdCB0aGUgYmVzdCBlc3RpbWF0ZWQgbGFiZWwgcG9zaXRpb25cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBvbHlnb24sIGRlY2ltYWxQbGFjZXMpIHtcbiAgICBwb2x5Z29uID0gR2VvSlNPTlV0aWxzLmZpeE11bHRpUG9seShwb2x5Z29uKTtcbiAgICBjb25zdCBwb2x5U2l0ZXMgPSBHZW9KU09OVXRpbHMuc2l0ZXMocG9seWdvbiwgZGVjaW1hbFBsYWNlcyk7XG4gICAgY29uc3QgZGlhZ3JhbSA9IHZvcm9ub2kuY29tcHV0ZShwb2x5U2l0ZXMuc2l0ZXMsIHBvbHlTaXRlcy5iYm94KTtcbiAgICBjb25zdCB2ZXJ0aWNlcyA9IHtcbiAgICAgICAgdHlwZTogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICAgICAgICBmZWF0dXJlczogW11cbiAgICB9O1xuICAgIC8vY29uc3RydWN0IEdlb0pTT04gb2JqZWN0IG9mIHZvcm9ub2kgdmVydGljZXNcbiAgICBmb3IobGV0IGkgPSAwOyBpIDwgZGlhZ3JhbS52ZXJ0aWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2ZXJ0aWNlcy5mZWF0dXJlcy5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6IFwiRmVhdHVyZVwiLFxuICAgICAgICAgICAgcHJvcGVydGllczoge30sXG4gICAgICAgICAgICBnZW9tZXRyeToge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiUG9pbnRcIixcbiAgICAgICAgICAgICAgICBjb29yZGluYXRlczogW2RpYWdyYW0udmVydGljZXNbaV0ueCwgZGlhZ3JhbS52ZXJ0aWNlc1tpXS55XVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cbiAgICB2ZXJ0aWNlcy5mZWF0dXJlcy5wdXNoKGNlbnRyb2lkKHBvbHlnb24pKTtcbiAgICAvL3dpdGhpbiByZXF1aXJlcyBhIEZlYXR1cmVDb2xsZWN0aW9uIGZvciBpbnB1dCBwb2x5Z29uc1xuICAgIGNvbnN0IHBvbHlnb25GZWF0dXJlQ29sbGVjdGlvbiA9IHtcbiAgICAgICAgdHlwZTogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICAgICAgICBmZWF0dXJlczogW3BvbHlnb25dXG4gICAgfTtcbiAgICBjb25zdCBwdHNXaXRoaW4gPSB3aXRoaW4odmVydGljZXMsIHBvbHlnb25GZWF0dXJlQ29sbGVjdGlvbik7IC8vcmVtb3ZlIGFueSB2ZXJ0aWNlcyB0aGF0IGFyZSBub3QgaW5zaWRlIHRoZSBwb2x5Z29uXG4gICAgaWYocHRzV2l0aGluLmZlYXR1cmVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgTm9Qb2ludHNJblNoYXBlRXJyb3IoJ05laXRoZXIgdGhlIGNlbnRyb2lkIG5vciBhbnkgVm9yb25vaSB2ZXJ0aWNlcyBpbnRlcnNlY3QgdGhlIHNoYXBlLicpO1xuICAgIH1cbiAgICBjb25zdCBsYWJlbExvY2F0aW9uID0ge1xuICAgICAgICBjb29yZGluYXRlczogWzAsMF0sXG4gICAgICAgIG1heERpc3Q6IDBcbiAgICB9O1xuICAgIGNvbnN0IHBvbHlnb25Cb3VuZGFyaWVzID0ge1xuICAgICAgICB0eXBlOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gICAgICAgIGZlYXR1cmVzOiBbXVxuICAgIH07XG4gICAgbGV0IHZlcnRleERpc3RhbmNlO1xuXG4gICAgLy9kZWZpbmUgYm9yZGVycyBvZiBwb2x5Z29uIGFuZCBob2xlcyBhcyBMaW5lU3RyaW5nc1xuICAgIGZvcihsZXQgaiA9IDA7IGogPCBwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIHBvbHlnb25Cb3VuZGFyaWVzLmZlYXR1cmVzLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogXCJGZWF0dXJlXCIsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fSxcbiAgICAgICAgICAgIGdlb21ldHJ5OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJMaW5lU3RyaW5nXCIsXG4gICAgICAgICAgICAgICAgY29vcmRpbmF0ZXM6IHBvbHlnb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbal1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBmb3IobGV0IGsgPSAwOyBrIDwgcHRzV2l0aGluLmZlYXR1cmVzLmxlbmd0aDsgaysrKSB7XG4gICAgICAgIGZvcihsZXQgbCA9IDA7IGwgPCBwb2x5Z29uQm91bmRhcmllcy5mZWF0dXJlcy5sZW5ndGg7IGwrKykge1xuICAgICAgICAgICAgaWYobCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHZlcnRleERpc3RhbmNlID0gcG9pbnRPbkxpbmUocG9seWdvbkJvdW5kYXJpZXMuZmVhdHVyZXNbbF0sIHB0c1dpdGhpbi5mZWF0dXJlc1trXSkucHJvcGVydGllcy5kaXN0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2ZXJ0ZXhEaXN0YW5jZSA9IE1hdGgubWluKHZlcnRleERpc3RhbmNlLFxuICAgICAgICAgICAgICAgICAgICBwb2ludE9uTGluZShwb2x5Z29uQm91bmRhcmllcy5mZWF0dXJlc1tsXSwgcHRzV2l0aGluLmZlYXR1cmVzW2tdKS5wcm9wZXJ0aWVzLmRpc3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmKHZlcnRleERpc3RhbmNlID4gbGFiZWxMb2NhdGlvbi5tYXhEaXN0KSB7XG4gICAgICAgICAgICBsYWJlbExvY2F0aW9uLmNvb3JkaW5hdGVzID0gcHRzV2l0aGluLmZlYXR1cmVzW2tdLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgICAgICAgICAgbGFiZWxMb2NhdGlvbi5tYXhEaXN0ID0gdmVydGV4RGlzdGFuY2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcG9pbnQobGFiZWxMb2NhdGlvbi5jb29yZGluYXRlcyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5Ob1BvaW50c0luU2hhcGVFcnJvciA9IE5vUG9pbnRzSW5TaGFwZUVycm9yOyIsInZhciB3Z3M4NCA9IHJlcXVpcmUoJ3dnczg0Jyk7XG5cbm1vZHVsZS5leHBvcnRzLmdlb21ldHJ5ID0gZ2VvbWV0cnk7XG5tb2R1bGUuZXhwb3J0cy5yaW5nID0gcmluZ0FyZWE7XG5cbmZ1bmN0aW9uIGdlb21ldHJ5KF8pIHtcbiAgICB2YXIgYXJlYSA9IDAsIGk7XG4gICAgc3dpdGNoIChfLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnUG9seWdvbic6XG4gICAgICAgICAgICByZXR1cm4gcG9seWdvbkFyZWEoXy5jb29yZGluYXRlcyk7XG4gICAgICAgIGNhc2UgJ011bHRpUG9seWdvbic6XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgXy5jb29yZGluYXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGFyZWEgKz0gcG9seWdvbkFyZWEoXy5jb29yZGluYXRlc1tpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gYXJlYTtcbiAgICAgICAgY2FzZSAnUG9pbnQnOlxuICAgICAgICBjYXNlICdNdWx0aVBvaW50JzpcbiAgICAgICAgY2FzZSAnTGluZVN0cmluZyc6XG4gICAgICAgIGNhc2UgJ011bHRpTGluZVN0cmluZyc6XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgY2FzZSAnR2VvbWV0cnlDb2xsZWN0aW9uJzpcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBfLmdlb21ldHJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBhcmVhICs9IGdlb21ldHJ5KF8uZ2VvbWV0cmllc1tpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gYXJlYTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHBvbHlnb25BcmVhKGNvb3Jkcykge1xuICAgIHZhciBhcmVhID0gMDtcbiAgICBpZiAoY29vcmRzICYmIGNvb3Jkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGFyZWEgKz0gTWF0aC5hYnMocmluZ0FyZWEoY29vcmRzWzBdKSk7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgY29vcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmVhIC09IE1hdGguYWJzKHJpbmdBcmVhKGNvb3Jkc1tpXSkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhcmVhO1xufVxuXG4vKipcbiAqIENhbGN1bGF0ZSB0aGUgYXBwcm94aW1hdGUgYXJlYSBvZiB0aGUgcG9seWdvbiB3ZXJlIGl0IHByb2plY3RlZCBvbnRvXG4gKiAgICAgdGhlIGVhcnRoLiAgTm90ZSB0aGF0IHRoaXMgYXJlYSB3aWxsIGJlIHBvc2l0aXZlIGlmIHJpbmcgaXMgb3JpZW50ZWRcbiAqICAgICBjbG9ja3dpc2UsIG90aGVyd2lzZSBpdCB3aWxsIGJlIG5lZ2F0aXZlLlxuICpcbiAqIFJlZmVyZW5jZTpcbiAqIFJvYmVydC4gRy4gQ2hhbWJlcmxhaW4gYW5kIFdpbGxpYW0gSC4gRHVxdWV0dGUsIFwiU29tZSBBbGdvcml0aG1zIGZvclxuICogICAgIFBvbHlnb25zIG9uIGEgU3BoZXJlXCIsIEpQTCBQdWJsaWNhdGlvbiAwNy0wMywgSmV0IFByb3B1bHNpb25cbiAqICAgICBMYWJvcmF0b3J5LCBQYXNhZGVuYSwgQ0EsIEp1bmUgMjAwNyBodHRwOi8vdHJzLW5ldy5qcGwubmFzYS5nb3YvZHNwYWNlL2hhbmRsZS8yMDE0LzQwNDA5XG4gKlxuICogUmV0dXJuczpcbiAqIHtmbG9hdH0gVGhlIGFwcHJveGltYXRlIHNpZ25lZCBnZW9kZXNpYyBhcmVhIG9mIHRoZSBwb2x5Z29uIGluIHNxdWFyZVxuICogICAgIG1ldGVycy5cbiAqL1xuXG5mdW5jdGlvbiByaW5nQXJlYShjb29yZHMpIHtcbiAgICB2YXIgcDEsIHAyLCBwMywgbG93ZXJJbmRleCwgbWlkZGxlSW5kZXgsIHVwcGVySW5kZXgsXG4gICAgYXJlYSA9IDAsXG4gICAgY29vcmRzTGVuZ3RoID0gY29vcmRzLmxlbmd0aDtcblxuICAgIGlmIChjb29yZHNMZW5ndGggPiAyKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBjb29yZHNMZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGkgPT09IGNvb3Jkc0xlbmd0aCAtIDIpIHsvLyBpID0gTi0yXG4gICAgICAgICAgICAgICAgbG93ZXJJbmRleCA9IGNvb3Jkc0xlbmd0aCAtIDI7XG4gICAgICAgICAgICAgICAgbWlkZGxlSW5kZXggPSBjb29yZHNMZW5ndGggLTE7XG4gICAgICAgICAgICAgICAgdXBwZXJJbmRleCA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGkgPT09IGNvb3Jkc0xlbmd0aCAtIDEpIHsvLyBpID0gTi0xXG4gICAgICAgICAgICAgICAgbG93ZXJJbmRleCA9IGNvb3Jkc0xlbmd0aCAtIDE7XG4gICAgICAgICAgICAgICAgbWlkZGxlSW5kZXggPSAwO1xuICAgICAgICAgICAgICAgIHVwcGVySW5kZXggPSAxO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gaSA9IDAgdG8gTi0zXG4gICAgICAgICAgICAgICAgbG93ZXJJbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgbWlkZGxlSW5kZXggPSBpKzE7XG4gICAgICAgICAgICAgICAgdXBwZXJJbmRleCA9IGkrMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHAxID0gY29vcmRzW2xvd2VySW5kZXhdO1xuICAgICAgICAgICAgcDIgPSBjb29yZHNbbWlkZGxlSW5kZXhdO1xuICAgICAgICAgICAgcDMgPSBjb29yZHNbdXBwZXJJbmRleF07XG4gICAgICAgICAgICBhcmVhICs9ICggcmFkKHAzWzBdKSAtIHJhZChwMVswXSkgKSAqIE1hdGguc2luKCByYWQocDJbMV0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFyZWEgPSBhcmVhICogd2dzODQuUkFESVVTICogd2dzODQuUkFESVVTIC8gMjtcbiAgICB9XG5cbiAgICByZXR1cm4gYXJlYTtcbn1cblxuZnVuY3Rpb24gcmFkKF8pIHtcbiAgICByZXR1cm4gXyAqIE1hdGguUEkgLyAxODA7XG59IiwiaWYgKHR5cGVvZiBPYmplY3QuY3JlYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gIC8vIGltcGxlbWVudGF0aW9uIGZyb20gc3RhbmRhcmQgbm9kZS5qcyAndXRpbCcgbW9kdWxlXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICBjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDdG9yLnByb3RvdHlwZSwge1xuICAgICAgY29uc3RydWN0b3I6IHtcbiAgICAgICAgdmFsdWU6IGN0b3IsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG4gIH07XG59IGVsc2Uge1xuICAvLyBvbGQgc2Nob29sIHNoaW0gZm9yIG9sZCBicm93c2Vyc1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgdmFyIFRlbXBDdG9yID0gZnVuY3Rpb24gKCkge31cbiAgICBUZW1wQ3Rvci5wcm90b3R5cGUgPSBzdXBlckN0b3IucHJvdG90eXBlXG4gICAgY3Rvci5wcm90b3R5cGUgPSBuZXcgVGVtcEN0b3IoKVxuICAgIGN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY3RvclxuICB9XG59XG4iLCIvKiFcbiAqIExvLURhc2ggdjAuOS4yIDxodHRwOi8vbG9kYXNoLmNvbT5cbiAqIChjKSAyMDEyIEpvaG4tRGF2aWQgRGFsdG9uIDxodHRwOi8vYWxseW91Y2FubGVldC5jb20vPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjQuMiA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmc+XG4gKiAoYykgMjAwOS0yMDEyIEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBJbmMuXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHA6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbjsoZnVuY3Rpb24od2luZG93LCB1bmRlZmluZWQpIHtcblxuICAvKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGV4cG9ydHNgICovXG4gIHZhciBmcmVlRXhwb3J0cyA9IHR5cGVvZiBleHBvcnRzID09ICdvYmplY3QnICYmIGV4cG9ydHM7XG5cbiAgLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGFuZCB1c2UgaXQgYXMgYHdpbmRvd2AgKi9cbiAgdmFyIGZyZWVHbG9iYWwgPSB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbDtcbiAgaWYgKGZyZWVHbG9iYWwuZ2xvYmFsID09PSBmcmVlR2xvYmFsKSB7XG4gICAgd2luZG93ID0gZnJlZUdsb2JhbDtcbiAgfVxuXG4gIC8qKiBVc2VkIGZvciBhcnJheSBhbmQgb2JqZWN0IG1ldGhvZCByZWZlcmVuY2VzICovXG4gIHZhciBhcnJheVJlZiA9IFtdLFxuICAgICAgLy8gYXZvaWQgYSBDbG9zdXJlIENvbXBpbGVyIGJ1ZyBieSBjcmVhdGl2ZWx5IGNyZWF0aW5nIGFuIG9iamVjdFxuICAgICAgb2JqZWN0UmVmID0gbmV3IGZ1bmN0aW9uKCl7fTtcblxuICAvKiogVXNlZCB0byBnZW5lcmF0ZSB1bmlxdWUgSURzICovXG4gIHZhciBpZENvdW50ZXIgPSAwO1xuXG4gIC8qKiBVc2VkIGludGVybmFsbHkgdG8gaW5kaWNhdGUgdmFyaW91cyB0aGluZ3MgKi9cbiAgdmFyIGluZGljYXRvck9iamVjdCA9IG9iamVjdFJlZjtcblxuICAvKiogVXNlZCBieSBgY2FjaGVkQ29udGFpbnNgIGFzIHRoZSBkZWZhdWx0IHNpemUgd2hlbiBvcHRpbWl6YXRpb25zIGFyZSBlbmFibGVkIGZvciBsYXJnZSBhcnJheXMgKi9cbiAgdmFyIGxhcmdlQXJyYXlTaXplID0gMzA7XG5cbiAgLyoqIFVzZWQgdG8gcmVzdG9yZSB0aGUgb3JpZ2luYWwgYF9gIHJlZmVyZW5jZSBpbiBgbm9Db25mbGljdGAgKi9cbiAgdmFyIG9sZERhc2ggPSB3aW5kb3cuXztcblxuICAvKiogVXNlZCB0byBkZXRlY3QgdGVtcGxhdGUgZGVsaW1pdGVyIHZhbHVlcyB0aGF0IHJlcXVpcmUgYSB3aXRoLXN0YXRlbWVudCAqL1xuICB2YXIgcmVDb21wbGV4RGVsaW1pdGVyID0gL1stPys9IX4qJSZePD58eyhcXC9dfFxcW1xcRHxcXGIoPzpkZWxldGV8aW58aW5zdGFuY2VvZnxuZXd8dHlwZW9mfHZvaWQpXFxiLztcblxuICAvKiogVXNlZCB0byBtYXRjaCBIVE1MIGVudGl0aWVzICovXG4gIHZhciByZUVzY2FwZWRIdG1sID0gLyYoPzphbXB8bHR8Z3R8cXVvdHwjeDI3KTsvZztcblxuICAvKiogVXNlZCB0byBtYXRjaCBlbXB0eSBzdHJpbmcgbGl0ZXJhbHMgaW4gY29tcGlsZWQgdGVtcGxhdGUgc291cmNlICovXG4gIHZhciByZUVtcHR5U3RyaW5nTGVhZGluZyA9IC9cXGJfX3AgXFwrPSAnJzsvZyxcbiAgICAgIHJlRW1wdHlTdHJpbmdNaWRkbGUgPSAvXFxiKF9fcCBcXCs9KSAnJyBcXCsvZyxcbiAgICAgIHJlRW1wdHlTdHJpbmdUcmFpbGluZyA9IC8oX19lXFwoLio/XFwpfFxcYl9fdFxcKSkgXFwrXFxuJyc7L2c7XG5cbiAgLyoqIFVzZWQgdG8gbWF0Y2ggcmVnZXhwIGZsYWdzIGZyb20gdGhlaXIgY29lcmNlZCBzdHJpbmcgdmFsdWVzICovXG4gIHZhciByZUZsYWdzID0gL1xcdyokLztcblxuICAvKiogVXNlZCB0byBpbnNlcnQgdGhlIGRhdGEgb2JqZWN0IHZhcmlhYmxlIGludG8gY29tcGlsZWQgdGVtcGxhdGUgc291cmNlICovXG4gIHZhciByZUluc2VydFZhcmlhYmxlID0gLyg/Ol9fZXxfX3QgPSApXFwoXFxzKig/IVtcXGRcXHNcIiddfHRoaXNcXC4pL2c7XG5cbiAgLyoqIFVzZWQgdG8gZGV0ZWN0IGlmIGEgbWV0aG9kIGlzIG5hdGl2ZSAqL1xuICB2YXIgcmVOYXRpdmUgPSBSZWdFeHAoJ14nICtcbiAgICAob2JqZWN0UmVmLnZhbHVlT2YgKyAnJylcbiAgICAgIC5yZXBsYWNlKC9bLiorP149IToke30oKXxbXFxdXFwvXFxcXF0vZywgJ1xcXFwkJicpXG4gICAgICAucmVwbGFjZSgvdmFsdWVPZnxmb3IgW15cXF1dKy9nLCAnLis/JykgKyAnJCdcbiAgKTtcblxuICAvKipcbiAgICogVXNlZCB0byBtYXRjaCBFUzYgdGVtcGxhdGUgZGVsaW1pdGVyc1xuICAgKiBodHRwOi8vcGVvcGxlLm1vemlsbGEub3JnL35qb3JlbmRvcmZmL2VzNi1kcmFmdC5odG1sI3NlYy03LjguNlxuICAgKi9cbiAgdmFyIHJlRXNUZW1wbGF0ZSA9IC9cXCRcXHsoKD86KD89XFxcXD8pXFxcXD9bXFxzXFxTXSkqPyl9L2c7XG5cbiAgLyoqIFVzZWQgdG8gbWF0Y2ggXCJpbnRlcnBvbGF0ZVwiIHRlbXBsYXRlIGRlbGltaXRlcnMgKi9cbiAgdmFyIHJlSW50ZXJwb2xhdGUgPSAvPCU9KFtcXHNcXFNdKz8pJT4vZztcblxuICAvKiogVXNlZCB0byBlbnN1cmUgY2FwdHVyaW5nIG9yZGVyIG9mIHRlbXBsYXRlIGRlbGltaXRlcnMgKi9cbiAgdmFyIHJlTm9NYXRjaCA9IC8oJF4pLztcblxuICAvKiogVXNlZCB0byBtYXRjaCBIVE1MIGNoYXJhY3RlcnMgKi9cbiAgdmFyIHJlVW5lc2NhcGVkSHRtbCA9IC9bJjw+XCInXS9nO1xuXG4gIC8qKiBVc2VkIHRvIG1hdGNoIHVuZXNjYXBlZCBjaGFyYWN0ZXJzIGluIGNvbXBpbGVkIHN0cmluZyBsaXRlcmFscyAqL1xuICB2YXIgcmVVbmVzY2FwZWRTdHJpbmcgPSAvWydcXG5cXHJcXHRcXHUyMDI4XFx1MjAyOVxcXFxdL2c7XG5cbiAgLyoqIFVzZWQgdG8gZml4IHRoZSBKU2NyaXB0IFtbRG9udEVudW1dXSBidWcgKi9cbiAgdmFyIHNoYWRvd2VkID0gW1xuICAgICdjb25zdHJ1Y3RvcicsICdoYXNPd25Qcm9wZXJ0eScsICdpc1Byb3RvdHlwZU9mJywgJ3Byb3BlcnR5SXNFbnVtZXJhYmxlJyxcbiAgICAndG9Mb2NhbGVTdHJpbmcnLCAndG9TdHJpbmcnLCAndmFsdWVPZidcbiAgXTtcblxuICAvKiogVXNlZCB0byBtYWtlIHRlbXBsYXRlIHNvdXJjZVVSTHMgZWFzaWVyIHRvIGlkZW50aWZ5ICovXG4gIHZhciB0ZW1wbGF0ZUNvdW50ZXIgPSAwO1xuXG4gIC8qKiBOYXRpdmUgbWV0aG9kIHNob3J0Y3V0cyAqL1xuICB2YXIgY2VpbCA9IE1hdGguY2VpbCxcbiAgICAgIGNvbmNhdCA9IGFycmF5UmVmLmNvbmNhdCxcbiAgICAgIGZsb29yID0gTWF0aC5mbG9vcixcbiAgICAgIGdldFByb3RvdHlwZU9mID0gcmVOYXRpdmUudGVzdChnZXRQcm90b3R5cGVPZiA9IE9iamVjdC5nZXRQcm90b3R5cGVPZikgJiYgZ2V0UHJvdG90eXBlT2YsXG4gICAgICBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFJlZi5oYXNPd25Qcm9wZXJ0eSxcbiAgICAgIHB1c2ggPSBhcnJheVJlZi5wdXNoLFxuICAgICAgcHJvcGVydHlJc0VudW1lcmFibGUgPSBvYmplY3RSZWYucHJvcGVydHlJc0VudW1lcmFibGUsXG4gICAgICBzbGljZSA9IGFycmF5UmVmLnNsaWNlLFxuICAgICAgdG9TdHJpbmcgPSBvYmplY3RSZWYudG9TdHJpbmc7XG5cbiAgLyogTmF0aXZlIG1ldGhvZCBzaG9ydGN1dHMgZm9yIG1ldGhvZHMgd2l0aCB0aGUgc2FtZSBuYW1lIGFzIG90aGVyIGBsb2Rhc2hgIG1ldGhvZHMgKi9cbiAgdmFyIG5hdGl2ZUJpbmQgPSByZU5hdGl2ZS50ZXN0KG5hdGl2ZUJpbmQgPSBzbGljZS5iaW5kKSAmJiBuYXRpdmVCaW5kLFxuICAgICAgbmF0aXZlSXNBcnJheSA9IHJlTmF0aXZlLnRlc3QobmF0aXZlSXNBcnJheSA9IEFycmF5LmlzQXJyYXkpICYmIG5hdGl2ZUlzQXJyYXksXG4gICAgICBuYXRpdmVJc0Zpbml0ZSA9IHdpbmRvdy5pc0Zpbml0ZSxcbiAgICAgIG5hdGl2ZUlzTmFOID0gd2luZG93LmlzTmFOLFxuICAgICAgbmF0aXZlS2V5cyA9IHJlTmF0aXZlLnRlc3QobmF0aXZlS2V5cyA9IE9iamVjdC5rZXlzKSAmJiBuYXRpdmVLZXlzLFxuICAgICAgbmF0aXZlTWF4ID0gTWF0aC5tYXgsXG4gICAgICBuYXRpdmVNaW4gPSBNYXRoLm1pbixcbiAgICAgIG5hdGl2ZVJhbmRvbSA9IE1hdGgucmFuZG9tO1xuXG4gIC8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgc2hvcnRjdXRzICovXG4gIHZhciBhcmdzQ2xhc3MgPSAnW29iamVjdCBBcmd1bWVudHNdJyxcbiAgICAgIGFycmF5Q2xhc3MgPSAnW29iamVjdCBBcnJheV0nLFxuICAgICAgYm9vbENsYXNzID0gJ1tvYmplY3QgQm9vbGVhbl0nLFxuICAgICAgZGF0ZUNsYXNzID0gJ1tvYmplY3QgRGF0ZV0nLFxuICAgICAgZnVuY0NsYXNzID0gJ1tvYmplY3QgRnVuY3Rpb25dJyxcbiAgICAgIG51bWJlckNsYXNzID0gJ1tvYmplY3QgTnVtYmVyXScsXG4gICAgICBvYmplY3RDbGFzcyA9ICdbb2JqZWN0IE9iamVjdF0nLFxuICAgICAgcmVnZXhwQ2xhc3MgPSAnW29iamVjdCBSZWdFeHBdJyxcbiAgICAgIHN0cmluZ0NsYXNzID0gJ1tvYmplY3QgU3RyaW5nXSc7XG5cbiAgLyoqXG4gICAqIERldGVjdCB0aGUgSlNjcmlwdCBbW0RvbnRFbnVtXV0gYnVnOlxuICAgKlxuICAgKiBJbiBJRSA8IDkgYW4gb2JqZWN0cyBvd24gcHJvcGVydGllcywgc2hhZG93aW5nIG5vbi1lbnVtZXJhYmxlIG9uZXMsIGFyZVxuICAgKiBtYWRlIG5vbi1lbnVtZXJhYmxlIGFzIHdlbGwuXG4gICAqL1xuICB2YXIgaGFzRG9udEVudW1CdWc7XG5cbiAgLyoqIERldGVjdCBpZiBvd24gcHJvcGVydGllcyBhcmUgaXRlcmF0ZWQgYWZ0ZXIgaW5oZXJpdGVkIHByb3BlcnRpZXMgKElFIDwgOSkgKi9cbiAgdmFyIGl0ZXJhdGVzT3duTGFzdDtcblxuICAvKipcbiAgICogRGV0ZWN0IGlmIGBBcnJheSNzaGlmdGAgYW5kIGBBcnJheSNzcGxpY2VgIGF1Z21lbnQgYXJyYXktbGlrZSBvYmplY3RzXG4gICAqIGluY29ycmVjdGx5OlxuICAgKlxuICAgKiBGaXJlZm94IDwgMTAsIElFIGNvbXBhdGliaWxpdHkgbW9kZSwgYW5kIElFIDwgOSBoYXZlIGJ1Z2d5IEFycmF5IGBzaGlmdCgpYFxuICAgKiBhbmQgYHNwbGljZSgpYCBmdW5jdGlvbnMgdGhhdCBmYWlsIHRvIHJlbW92ZSB0aGUgbGFzdCBlbGVtZW50LCBgdmFsdWVbMF1gLFxuICAgKiBvZiBhcnJheS1saWtlIG9iamVjdHMgZXZlbiB0aG91Z2ggdGhlIGBsZW5ndGhgIHByb3BlcnR5IGlzIHNldCB0byBgMGAuXG4gICAqIFRoZSBgc2hpZnQoKWAgbWV0aG9kIGlzIGJ1Z2d5IGluIElFIDggY29tcGF0aWJpbGl0eSBtb2RlLCB3aGlsZSBgc3BsaWNlKClgXG4gICAqIGlzIGJ1Z2d5IHJlZ2FyZGxlc3Mgb2YgbW9kZSBpbiBJRSA8IDkgYW5kIGJ1Z2d5IGluIGNvbXBhdGliaWxpdHkgbW9kZSBpbiBJRSA5LlxuICAgKi9cbiAgdmFyIGhhc09iamVjdFNwbGljZUJ1ZyA9IChoYXNPYmplY3RTcGxpY2VCdWcgPSB7ICcwJzogMSwgJ2xlbmd0aCc6IDEgfSxcbiAgICBhcnJheVJlZi5zcGxpY2UuY2FsbChoYXNPYmplY3RTcGxpY2VCdWcsIDAsIDEpLCBoYXNPYmplY3RTcGxpY2VCdWdbMF0pO1xuXG4gIC8qKiBEZXRlY3QgaWYgYW4gYGFyZ3VtZW50c2Agb2JqZWN0J3MgaW5kZXhlcyBhcmUgbm9uLWVudW1lcmFibGUgKElFIDwgOSkgKi9cbiAgdmFyIG5vQXJnc0VudW0gPSB0cnVlO1xuXG4gIChmdW5jdGlvbigpIHtcbiAgICB2YXIgcHJvcHMgPSBbXTtcbiAgICBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLnggPSAxOyB9XG4gICAgY3Rvci5wcm90b3R5cGUgPSB7ICd2YWx1ZU9mJzogMSwgJ3knOiAxIH07XG4gICAgZm9yICh2YXIgcHJvcCBpbiBuZXcgY3RvcikgeyBwcm9wcy5wdXNoKHByb3ApOyB9XG4gICAgZm9yIChwcm9wIGluIGFyZ3VtZW50cykgeyBub0FyZ3NFbnVtID0gIXByb3A7IH1cblxuICAgIGhhc0RvbnRFbnVtQnVnID0gIS92YWx1ZU9mLy50ZXN0KHByb3BzKTtcbiAgICBpdGVyYXRlc093bkxhc3QgPSBwcm9wc1swXSAhPSAneCc7XG4gIH0oMSkpO1xuXG4gIC8qKiBEZXRlY3QgaWYgYW4gYGFyZ3VtZW50c2Agb2JqZWN0J3MgW1tDbGFzc11dIGlzIHVucmVzb2x2YWJsZSAoRmlyZWZveCA8IDQsIElFIDwgOSkgKi9cbiAgdmFyIG5vQXJnc0NsYXNzID0gIWlzQXJndW1lbnRzKGFyZ3VtZW50cyk7XG5cbiAgLyoqIERldGVjdCBpZiBgQXJyYXkjc2xpY2VgIGNhbm5vdCBiZSB1c2VkIHRvIGNvbnZlcnQgc3RyaW5ncyB0byBhcnJheXMgKE9wZXJhIDwgMTAuNTIpICovXG4gIHZhciBub0FycmF5U2xpY2VPblN0cmluZ3MgPSBzbGljZS5jYWxsKCd4JylbMF0gIT0gJ3gnO1xuXG4gIC8qKlxuICAgKiBEZXRlY3QgbGFjayBvZiBzdXBwb3J0IGZvciBhY2Nlc3Npbmcgc3RyaW5nIGNoYXJhY3RlcnMgYnkgaW5kZXg6XG4gICAqXG4gICAqIElFIDwgOCBjYW4ndCBhY2Nlc3MgY2hhcmFjdGVycyBieSBpbmRleCBhbmQgSUUgOCBjYW4gb25seSBhY2Nlc3NcbiAgICogY2hhcmFjdGVycyBieSBpbmRleCBvbiBzdHJpbmcgbGl0ZXJhbHMuXG4gICAqL1xuICB2YXIgbm9DaGFyQnlJbmRleCA9ICgneCdbMF0gKyBPYmplY3QoJ3gnKVswXSkgIT0gJ3h4JztcblxuICAvKipcbiAgICogRGV0ZWN0IGlmIGEgbm9kZSdzIFtbQ2xhc3NdXSBpcyB1bnJlc29sdmFibGUgKElFIDwgOSlcbiAgICogYW5kIHRoYXQgdGhlIEpTIGVuZ2luZSB3b24ndCBlcnJvciB3aGVuIGF0dGVtcHRpbmcgdG8gY29lcmNlIGFuIG9iamVjdCB0b1xuICAgKiBhIHN0cmluZyB3aXRob3V0IGEgYHRvU3RyaW5nYCBwcm9wZXJ0eSB2YWx1ZSBvZiBgdHlwZW9mYCBcImZ1bmN0aW9uXCIuXG4gICAqL1xuICB0cnkge1xuICAgIHZhciBub05vZGVDbGFzcyA9ICh7ICd0b1N0cmluZyc6IDAgfSArICcnLCB0b1N0cmluZy5jYWxsKHdpbmRvdy5kb2N1bWVudCB8fCAwKSA9PSBvYmplY3RDbGFzcyk7XG4gIH0gY2F0Y2goZSkgeyB9XG5cbiAgLyogRGV0ZWN0IGlmIGBGdW5jdGlvbiNiaW5kYCBleGlzdHMgYW5kIGlzIGluZmVycmVkIHRvIGJlIGZhc3QgKGFsbCBidXQgVjgpICovXG4gIHZhciBpc0JpbmRGYXN0ID0gbmF0aXZlQmluZCAmJiAvXFxufE9wZXJhLy50ZXN0KG5hdGl2ZUJpbmQgKyB0b1N0cmluZy5jYWxsKHdpbmRvdy5vcGVyYSkpO1xuXG4gIC8qIERldGVjdCBpZiBgT2JqZWN0LmtleXNgIGV4aXN0cyBhbmQgaXMgaW5mZXJyZWQgdG8gYmUgZmFzdCAoSUUsIE9wZXJhLCBWOCkgKi9cbiAgdmFyIGlzS2V5c0Zhc3QgPSBuYXRpdmVLZXlzICYmIC9eLiskfHRydWUvLnRlc3QobmF0aXZlS2V5cyArICEhd2luZG93LmF0dGFjaEV2ZW50KTtcblxuICAvKipcbiAgICogRGV0ZWN0IGlmIHNvdXJjZVVSTCBzeW50YXggaXMgdXNhYmxlIHdpdGhvdXQgZXJyb3Jpbmc6XG4gICAqXG4gICAqIFRoZSBKUyBlbmdpbmUgaW4gQWRvYmUgcHJvZHVjdHMsIGxpa2UgSW5EZXNpZ24sIHdpbGwgdGhyb3cgYSBzeW50YXggZXJyb3JcbiAgICogd2hlbiBpdCBlbmNvdW50ZXJzIGEgc2luZ2xlIGxpbmUgY29tbWVudCBiZWdpbm5pbmcgd2l0aCB0aGUgYEBgIHN5bWJvbC5cbiAgICpcbiAgICogVGhlIEpTIGVuZ2luZSBpbiBOYXJ3aGFsIHdpbGwgZ2VuZXJhdGUgdGhlIGZ1bmN0aW9uIGBmdW5jdGlvbiBhbm9ueW1vdXMoKXsvL31gXG4gICAqIGFuZCB0aHJvdyBhIHN5bnRheCBlcnJvci5cbiAgICpcbiAgICogQXZvaWQgY29tbWVudHMgYmVnaW5uaW5nIGBAYCBzeW1ib2xzIGluIElFIGJlY2F1c2UgdGhleSBhcmUgcGFydCBvZiBpdHNcbiAgICogbm9uLXN0YW5kYXJkIGNvbmRpdGlvbmFsIGNvbXBpbGF0aW9uIHN1cHBvcnQuXG4gICAqIGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS8xMjFoenRrMyh2PXZzLjk0KS5hc3B4XG4gICAqL1xuICB0cnkge1xuICAgIHZhciB1c2VTb3VyY2VVUkwgPSAoRnVuY3Rpb24oJy8vQCcpKCksICF3aW5kb3cuYXR0YWNoRXZlbnQpO1xuICB9IGNhdGNoKGUpIHsgfVxuXG4gIC8qKiBVc2VkIHRvIGlkZW50aWZ5IG9iamVjdCBjbGFzc2lmaWNhdGlvbnMgdGhhdCBgXy5jbG9uZWAgc3VwcG9ydHMgKi9cbiAgdmFyIGNsb25lYWJsZUNsYXNzZXMgPSB7fTtcbiAgY2xvbmVhYmxlQ2xhc3Nlc1thcmdzQ2xhc3NdID0gY2xvbmVhYmxlQ2xhc3Nlc1tmdW5jQ2xhc3NdID0gZmFsc2U7XG4gIGNsb25lYWJsZUNsYXNzZXNbYXJyYXlDbGFzc10gPSBjbG9uZWFibGVDbGFzc2VzW2Jvb2xDbGFzc10gPSBjbG9uZWFibGVDbGFzc2VzW2RhdGVDbGFzc10gPVxuICBjbG9uZWFibGVDbGFzc2VzW251bWJlckNsYXNzXSA9IGNsb25lYWJsZUNsYXNzZXNbb2JqZWN0Q2xhc3NdID0gY2xvbmVhYmxlQ2xhc3Nlc1tyZWdleHBDbGFzc10gPVxuICBjbG9uZWFibGVDbGFzc2VzW3N0cmluZ0NsYXNzXSA9IHRydWU7XG5cbiAgLyoqIFVzZWQgdG8gZGV0ZXJtaW5lIGlmIHZhbHVlcyBhcmUgb2YgdGhlIGxhbmd1YWdlIHR5cGUgT2JqZWN0ICovXG4gIHZhciBvYmplY3RUeXBlcyA9IHtcbiAgICAnYm9vbGVhbic6IGZhbHNlLFxuICAgICdmdW5jdGlvbic6IHRydWUsXG4gICAgJ29iamVjdCc6IHRydWUsXG4gICAgJ251bWJlcic6IGZhbHNlLFxuICAgICdzdHJpbmcnOiBmYWxzZSxcbiAgICAndW5kZWZpbmVkJzogZmFsc2VcbiAgfTtcblxuICAvKiogVXNlZCB0byBlc2NhcGUgY2hhcmFjdGVycyBmb3IgaW5jbHVzaW9uIGluIGNvbXBpbGVkIHN0cmluZyBsaXRlcmFscyAqL1xuICB2YXIgc3RyaW5nRXNjYXBlcyA9IHtcbiAgICAnXFxcXCc6ICdcXFxcJyxcbiAgICBcIidcIjogXCInXCIsXG4gICAgJ1xcbic6ICduJyxcbiAgICAnXFxyJzogJ3InLFxuICAgICdcXHQnOiAndCcsXG4gICAgJ1xcdTIwMjgnOiAndTIwMjgnLFxuICAgICdcXHUyMDI5JzogJ3UyMDI5J1xuICB9O1xuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBUaGUgYGxvZGFzaGAgZnVuY3Rpb24uXG4gICAqXG4gICAqIEBuYW1lIF9cbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBjYXRlZ29yeSBDaGFpbmluZ1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gd3JhcCBpbiBhIGBsb2Rhc2hgIGluc3RhbmNlLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGEgYGxvZGFzaGAgaW5zdGFuY2UuXG4gICAqL1xuICBmdW5jdGlvbiBsb2Rhc2godmFsdWUpIHtcbiAgICAvLyBleGl0IGVhcmx5IGlmIGFscmVhZHkgd3JhcHBlZFxuICAgIGlmICh2YWx1ZSAmJiB2YWx1ZS5fX3dyYXBwZWRfXykge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICAvLyBhbGxvdyBpbnZva2luZyBgbG9kYXNoYCB3aXRob3V0IHRoZSBgbmV3YCBvcGVyYXRvclxuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBsb2Rhc2gpKSB7XG4gICAgICByZXR1cm4gbmV3IGxvZGFzaCh2YWx1ZSk7XG4gICAgfVxuICAgIHRoaXMuX193cmFwcGVkX18gPSB2YWx1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCeSBkZWZhdWx0LCB0aGUgdGVtcGxhdGUgZGVsaW1pdGVycyB1c2VkIGJ5IExvLURhc2ggYXJlIHNpbWlsYXIgdG8gdGhvc2UgaW5cbiAgICogZW1iZWRkZWQgUnVieSAoRVJCKS4gQ2hhbmdlIHRoZSBmb2xsb3dpbmcgdGVtcGxhdGUgc2V0dGluZ3MgdG8gdXNlIGFsdGVybmF0aXZlXG4gICAqIGRlbGltaXRlcnMuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQHR5cGUgT2JqZWN0XG4gICAqL1xuICBsb2Rhc2gudGVtcGxhdGVTZXR0aW5ncyA9IHtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gZGV0ZWN0IGBkYXRhYCBwcm9wZXJ0eSB2YWx1ZXMgdG8gYmUgSFRNTC1lc2NhcGVkLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfLnRlbXBsYXRlU2V0dGluZ3NcbiAgICAgKiBAdHlwZSBSZWdFeHBcbiAgICAgKi9cbiAgICAnZXNjYXBlJzogLzwlLShbXFxzXFxTXSs/KSU+L2csXG5cbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIGRldGVjdCBjb2RlIHRvIGJlIGV2YWx1YXRlZC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgXy50ZW1wbGF0ZVNldHRpbmdzXG4gICAgICogQHR5cGUgUmVnRXhwXG4gICAgICovXG4gICAgJ2V2YWx1YXRlJzogLzwlKFtcXHNcXFNdKz8pJT4vZyxcblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gZGV0ZWN0IGBkYXRhYCBwcm9wZXJ0eSB2YWx1ZXMgdG8gaW5qZWN0LlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfLnRlbXBsYXRlU2V0dGluZ3NcbiAgICAgKiBAdHlwZSBSZWdFeHBcbiAgICAgKi9cbiAgICAnaW50ZXJwb2xhdGUnOiByZUludGVycG9sYXRlLFxuXG4gICAgLyoqXG4gICAgICogVXNlZCB0byByZWZlcmVuY2UgdGhlIGRhdGEgb2JqZWN0IGluIHRoZSB0ZW1wbGF0ZSB0ZXh0LlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfLnRlbXBsYXRlU2V0dGluZ3NcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cbiAgICAndmFyaWFibGUnOiAnJ1xuICB9O1xuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBUaGUgdGVtcGxhdGUgdXNlZCB0byBjcmVhdGUgaXRlcmF0b3IgZnVuY3Rpb25zLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iZWN0fSBkYXRhIFRoZSBkYXRhIG9iamVjdCB1c2VkIHRvIHBvcHVsYXRlIHRoZSB0ZXh0LlxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBSZXR1cm5zIHRoZSBpbnRlcnBvbGF0ZWQgdGV4dC5cbiAgICovXG4gIHZhciBpdGVyYXRvclRlbXBsYXRlID0gdGVtcGxhdGUoXG4gICAgLy8gY29uZGl0aW9uYWwgc3RyaWN0IG1vZGVcbiAgICAnPCUgaWYgKG9iai51c2VTdHJpY3QpIHsgJT5cXCd1c2Ugc3RyaWN0XFwnO1xcbjwlIH0gJT4nICtcblxuICAgIC8vIHRoZSBgaXRlcmF0ZWVgIG1heSBiZSByZWFzc2lnbmVkIGJ5IHRoZSBgdG9wYCBzbmlwcGV0XG4gICAgJ3ZhciBpbmRleCwgdmFsdWUsIGl0ZXJhdGVlID0gPCU9IGZpcnN0QXJnICU+LCAnICtcbiAgICAvLyBhc3NpZ24gdGhlIGByZXN1bHRgIHZhcmlhYmxlIGFuIGluaXRpYWwgdmFsdWVcbiAgICAncmVzdWx0ID0gPCU9IGZpcnN0QXJnICU+O1xcbicgK1xuICAgIC8vIGV4aXQgZWFybHkgaWYgdGhlIGZpcnN0IGFyZ3VtZW50IGlzIGZhbHNleVxuICAgICdpZiAoITwlPSBmaXJzdEFyZyAlPikgcmV0dXJuIHJlc3VsdDtcXG4nICtcbiAgICAvLyBhZGQgY29kZSBiZWZvcmUgdGhlIGl0ZXJhdGlvbiBicmFuY2hlc1xuICAgICc8JT0gdG9wICU+O1xcbicgK1xuXG4gICAgLy8gYXJyYXktbGlrZSBpdGVyYXRpb246XG4gICAgJzwlIGlmIChhcnJheUxvb3ApIHsgJT4nICtcbiAgICAndmFyIGxlbmd0aCA9IGl0ZXJhdGVlLmxlbmd0aDsgaW5kZXggPSAtMTtcXG4nICtcbiAgICAnaWYgKHR5cGVvZiBsZW5ndGggPT0gXFwnbnVtYmVyXFwnKSB7JyArXG5cbiAgICAvLyBhZGQgc3VwcG9ydCBmb3IgYWNjZXNzaW5nIHN0cmluZyBjaGFyYWN0ZXJzIGJ5IGluZGV4IGlmIG5lZWRlZFxuICAgICcgIDwlIGlmIChub0NoYXJCeUluZGV4KSB7ICU+XFxuJyArXG4gICAgJyAgaWYgKGlzU3RyaW5nKGl0ZXJhdGVlKSkge1xcbicgK1xuICAgICcgICAgaXRlcmF0ZWUgPSBpdGVyYXRlZS5zcGxpdChcXCdcXCcpXFxuJyArXG4gICAgJyAgfScgK1xuICAgICcgIDwlIH0gJT5cXG4nICtcblxuICAgIC8vIGl0ZXJhdGUgb3ZlciB0aGUgYXJyYXktbGlrZSB2YWx1ZVxuICAgICcgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XFxuJyArXG4gICAgJyAgICB2YWx1ZSA9IGl0ZXJhdGVlW2luZGV4XTtcXG4nICtcbiAgICAnICAgIDwlPSBhcnJheUxvb3AgJT5cXG4nICtcbiAgICAnICB9XFxuJyArXG4gICAgJ31cXG4nICtcbiAgICAnZWxzZSB7JyArXG5cbiAgICAvLyBvYmplY3QgaXRlcmF0aW9uOlxuICAgIC8vIGFkZCBzdXBwb3J0IGZvciBpdGVyYXRpbmcgb3ZlciBgYXJndW1lbnRzYCBvYmplY3RzIGlmIG5lZWRlZFxuICAgICcgIDwlICB9IGVsc2UgaWYgKG5vQXJnc0VudW0pIHsgJT5cXG4nICtcbiAgICAnICB2YXIgbGVuZ3RoID0gaXRlcmF0ZWUubGVuZ3RoOyBpbmRleCA9IC0xO1xcbicgK1xuICAgICcgIGlmIChsZW5ndGggJiYgaXNBcmd1bWVudHMoaXRlcmF0ZWUpKSB7XFxuJyArXG4gICAgJyAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xcbicgK1xuICAgICcgICAgICB2YWx1ZSA9IGl0ZXJhdGVlW2luZGV4ICs9IFxcJ1xcJ107XFxuJyArXG4gICAgJyAgICAgIDwlPSBvYmplY3RMb29wICU+XFxuJyArXG4gICAgJyAgICB9XFxuJyArXG4gICAgJyAgfSBlbHNlIHsnICtcbiAgICAnICA8JSB9ICU+JyArXG5cbiAgICAvLyBGaXJlZm94IDwgMy42LCBPcGVyYSA+IDkuNTAgLSBPcGVyYSA8IDExLjYwLCBhbmQgU2FmYXJpIDwgNS4xXG4gICAgLy8gKGlmIHRoZSBwcm90b3R5cGUgb3IgYSBwcm9wZXJ0eSBvbiB0aGUgcHJvdG90eXBlIGhhcyBiZWVuIHNldClcbiAgICAvLyBpbmNvcnJlY3RseSBzZXRzIGEgZnVuY3Rpb24ncyBgcHJvdG90eXBlYCBwcm9wZXJ0eSBbW0VudW1lcmFibGVdXVxuICAgIC8vIHZhbHVlIHRvIGB0cnVlYC4gQmVjYXVzZSBvZiB0aGlzIExvLURhc2ggc3RhbmRhcmRpemVzIG9uIHNraXBwaW5nXG4gICAgLy8gdGhlIHRoZSBgcHJvdG90eXBlYCBwcm9wZXJ0eSBvZiBmdW5jdGlvbnMgcmVnYXJkbGVzcyBvZiBpdHNcbiAgICAvLyBbW0VudW1lcmFibGVdXSB2YWx1ZS5cbiAgICAnICA8JSBpZiAoIWhhc0RvbnRFbnVtQnVnKSB7ICU+XFxuJyArXG4gICAgJyAgdmFyIHNraXBQcm90byA9IHR5cGVvZiBpdGVyYXRlZSA9PSBcXCdmdW5jdGlvblxcJyAmJiBcXG4nICtcbiAgICAnICAgIHByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwoaXRlcmF0ZWUsIFxcJ3Byb3RvdHlwZVxcJyk7XFxuJyArXG4gICAgJyAgPCUgfSAlPicgK1xuXG4gICAgLy8gaXRlcmF0ZSBvd24gcHJvcGVydGllcyB1c2luZyBgT2JqZWN0LmtleXNgIGlmIGl0J3MgZmFzdFxuICAgICcgIDwlIGlmIChpc0tleXNGYXN0ICYmIHVzZUhhcykgeyAlPlxcbicgK1xuICAgICcgIHZhciBvd25JbmRleCA9IC0xLFxcbicgK1xuICAgICcgICAgICBvd25Qcm9wcyA9IG9iamVjdFR5cGVzW3R5cGVvZiBpdGVyYXRlZV0gPyBuYXRpdmVLZXlzKGl0ZXJhdGVlKSA6IFtdLFxcbicgK1xuICAgICcgICAgICBsZW5ndGggPSBvd25Qcm9wcy5sZW5ndGg7XFxuXFxuJyArXG4gICAgJyAgd2hpbGUgKCsrb3duSW5kZXggPCBsZW5ndGgpIHtcXG4nICtcbiAgICAnICAgIGluZGV4ID0gb3duUHJvcHNbb3duSW5kZXhdO1xcbicgK1xuICAgICcgICAgPCUgaWYgKCFoYXNEb250RW51bUJ1ZykgeyAlPmlmICghKHNraXBQcm90byAmJiBpbmRleCA9PSBcXCdwcm90b3R5cGVcXCcpKSB7XFxuICA8JSB9ICU+JyArXG4gICAgJyAgICB2YWx1ZSA9IGl0ZXJhdGVlW2luZGV4XTtcXG4nICtcbiAgICAnICAgIDwlPSBvYmplY3RMb29wICU+XFxuJyArXG4gICAgJyAgICA8JSBpZiAoIWhhc0RvbnRFbnVtQnVnKSB7ICU+fVxcbjwlIH0gJT4nICtcbiAgICAnICB9JyArXG5cbiAgICAvLyBlbHNlIHVzaW5nIGEgZm9yLWluIGxvb3BcbiAgICAnICA8JSB9IGVsc2UgeyAlPlxcbicgK1xuICAgICcgIGZvciAoaW5kZXggaW4gaXRlcmF0ZWUpIHs8JScgK1xuICAgICcgICAgaWYgKCFoYXNEb250RW51bUJ1ZyB8fCB1c2VIYXMpIHsgJT5cXG4gICAgaWYgKDwlJyArXG4gICAgJyAgICAgIGlmICghaGFzRG9udEVudW1CdWcpIHsgJT4hKHNraXBQcm90byAmJiBpbmRleCA9PSBcXCdwcm90b3R5cGVcXCcpPCUgfScgK1xuICAgICcgICAgICBpZiAoIWhhc0RvbnRFbnVtQnVnICYmIHVzZUhhcykgeyAlPiAmJiA8JSB9JyArXG4gICAgJyAgICAgIGlmICh1c2VIYXMpIHsgJT5oYXNPd25Qcm9wZXJ0eS5jYWxsKGl0ZXJhdGVlLCBpbmRleCk8JSB9JyArXG4gICAgJyAgICAlPikgeycgK1xuICAgICcgICAgPCUgfSAlPlxcbicgK1xuICAgICcgICAgdmFsdWUgPSBpdGVyYXRlZVtpbmRleF07XFxuJyArXG4gICAgJyAgICA8JT0gb2JqZWN0TG9vcCAlPjsnICtcbiAgICAnICAgIDwlIGlmICghaGFzRG9udEVudW1CdWcgfHwgdXNlSGFzKSB7ICU+XFxuICAgIH08JSB9ICU+XFxuJyArXG4gICAgJyAgfScgK1xuICAgICcgIDwlIH0gJT4nICtcblxuICAgIC8vIEJlY2F1c2UgSUUgPCA5IGNhbid0IHNldCB0aGUgYFtbRW51bWVyYWJsZV1dYCBhdHRyaWJ1dGUgb2YgYW5cbiAgICAvLyBleGlzdGluZyBwcm9wZXJ0eSBhbmQgdGhlIGBjb25zdHJ1Y3RvcmAgcHJvcGVydHkgb2YgYSBwcm90b3R5cGVcbiAgICAvLyBkZWZhdWx0cyB0byBub24tZW51bWVyYWJsZSwgTG8tRGFzaCBza2lwcyB0aGUgYGNvbnN0cnVjdG9yYFxuICAgIC8vIHByb3BlcnR5IHdoZW4gaXQgaW5mZXJzIGl0J3MgaXRlcmF0aW5nIG92ZXIgYSBgcHJvdG90eXBlYCBvYmplY3QuXG4gICAgJyAgPCUgaWYgKGhhc0RvbnRFbnVtQnVnKSB7ICU+XFxuXFxuJyArXG4gICAgJyAgdmFyIGN0b3IgPSBpdGVyYXRlZS5jb25zdHJ1Y3RvcjtcXG4nICtcbiAgICAnICAgIDwlIGZvciAodmFyIGsgPSAwOyBrIDwgNzsgaysrKSB7ICU+XFxuJyArXG4gICAgJyAgaW5kZXggPSBcXCc8JT0gc2hhZG93ZWRba10gJT5cXCc7XFxuJyArXG4gICAgJyAgaWYgKDwlJyArXG4gICAgJyAgICAgIGlmIChzaGFkb3dlZFtrXSA9PSBcXCdjb25zdHJ1Y3RvclxcJykgeycgK1xuICAgICcgICAgICAgICU+IShjdG9yICYmIGN0b3IucHJvdG90eXBlID09PSBpdGVyYXRlZSkgJiYgPCUnICtcbiAgICAnICAgICAgfSAlPmhhc093blByb3BlcnR5LmNhbGwoaXRlcmF0ZWUsIGluZGV4KSkge1xcbicgK1xuICAgICcgICAgdmFsdWUgPSBpdGVyYXRlZVtpbmRleF07XFxuJyArXG4gICAgJyAgICA8JT0gb2JqZWN0TG9vcCAlPlxcbicgK1xuICAgICcgIH0nICtcbiAgICAnICAgIDwlIH0gJT4nICtcbiAgICAnICA8JSB9ICU+JyArXG4gICAgJyAgPCUgaWYgKGFycmF5TG9vcCB8fCBub0FyZ3NFbnVtKSB7ICU+XFxufTwlIH0gJT5cXG4nICtcblxuICAgIC8vIGFkZCBjb2RlIHRvIHRoZSBib3R0b20gb2YgdGhlIGl0ZXJhdGlvbiBmdW5jdGlvblxuICAgICc8JT0gYm90dG9tICU+O1xcbicgK1xuICAgIC8vIGZpbmFsbHksIHJldHVybiB0aGUgYHJlc3VsdGBcbiAgICAncmV0dXJuIHJlc3VsdCdcbiAgKTtcblxuICAvKipcbiAgICogUmV1c2FibGUgaXRlcmF0b3Igb3B0aW9ucyBzaGFyZWQgYnkgYGZvckVhY2hgLCBgZm9ySW5gLCBhbmQgYGZvck93bmAuXG4gICAqL1xuICB2YXIgZm9yRWFjaEl0ZXJhdG9yT3B0aW9ucyA9IHtcbiAgICAnYXJncyc6ICdjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZycsXG4gICAgJ3RvcCc6ICdjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKScsXG4gICAgJ2FycmF5TG9vcCc6ICdpZiAoY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSA9PT0gZmFsc2UpIHJldHVybiByZXN1bHQnLFxuICAgICdvYmplY3RMb29wJzogJ2lmIChjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pID09PSBmYWxzZSkgcmV0dXJuIHJlc3VsdCdcbiAgfTtcblxuICAvKiogUmV1c2FibGUgaXRlcmF0b3Igb3B0aW9ucyBmb3IgYGRlZmF1bHRzYCwgYW5kIGBleHRlbmRgICovXG4gIHZhciBleHRlbmRJdGVyYXRvck9wdGlvbnMgPSB7XG4gICAgJ3VzZUhhcyc6IGZhbHNlLFxuICAgICdhcmdzJzogJ29iamVjdCcsXG4gICAgJ3RvcCc6XG4gICAgICAnZm9yICh2YXIgYXJnc0luZGV4ID0gMSwgYXJnc0xlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7IGFyZ3NJbmRleCA8IGFyZ3NMZW5ndGg7IGFyZ3NJbmRleCsrKSB7XFxuJyArXG4gICAgICAnICBpZiAoaXRlcmF0ZWUgPSBhcmd1bWVudHNbYXJnc0luZGV4XSkgeycsXG4gICAgJ29iamVjdExvb3AnOiAncmVzdWx0W2luZGV4XSA9IHZhbHVlJyxcbiAgICAnYm90dG9tJzogJyAgfVxcbn0nXG4gIH07XG5cbiAgLyoqIFJldXNhYmxlIGl0ZXJhdG9yIG9wdGlvbnMgZm9yIGBmb3JJbmAgYW5kIGBmb3JPd25gICovXG4gIHZhciBmb3JPd25JdGVyYXRvck9wdGlvbnMgPSB7XG4gICAgJ2FycmF5TG9vcCc6IG51bGxcbiAgfTtcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIG9wdGltaXplZCB0byBzZWFyY2ggbGFyZ2UgYXJyYXlzIGZvciBhIGdpdmVuIGB2YWx1ZWAsXG4gICAqIHN0YXJ0aW5nIGF0IGBmcm9tSW5kZXhgLCB1c2luZyBzdHJpY3QgZXF1YWxpdHkgZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gc2VhcmNoLlxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2VhcmNoIGZvci5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IFtmcm9tSW5kZXg9MF0gVGhlIGluZGV4IHRvIHNlYXJjaCBmcm9tLlxuICAgKiBAcGFyYW0ge051bWJlcn0gW2xhcmdlU2l6ZT0zMF0gVGhlIGxlbmd0aCBhdCB3aGljaCBhbiBhcnJheSBpcyBjb25zaWRlcmVkIGxhcmdlLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBmb3VuZCwgZWxzZSBgZmFsc2VgLlxuICAgKi9cbiAgZnVuY3Rpb24gY2FjaGVkQ29udGFpbnMoYXJyYXksIGZyb21JbmRleCwgbGFyZ2VTaXplKSB7XG4gICAgZnJvbUluZGV4IHx8IChmcm9tSW5kZXggPSAwKTtcblxuICAgIHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGgsXG4gICAgICAgIGlzTGFyZ2UgPSAobGVuZ3RoIC0gZnJvbUluZGV4KSA+PSAobGFyZ2VTaXplIHx8IGxhcmdlQXJyYXlTaXplKTtcblxuICAgIGlmIChpc0xhcmdlKSB7XG4gICAgICB2YXIgY2FjaGUgPSB7fSxcbiAgICAgICAgICBpbmRleCA9IGZyb21JbmRleCAtIDE7XG5cbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIC8vIG1hbnVhbGx5IGNvZXJjZSBgdmFsdWVgIHRvIGEgc3RyaW5nIGJlY2F1c2UgYGhhc093blByb3BlcnR5YCwgaW4gc29tZVxuICAgICAgICAvLyBvbGRlciB2ZXJzaW9ucyBvZiBGaXJlZm94LCBjb2VyY2VzIG9iamVjdHMgaW5jb3JyZWN0bHlcbiAgICAgICAgdmFyIGtleSA9IGFycmF5W2luZGV4XSArICcnO1xuICAgICAgICAoaGFzT3duUHJvcGVydHkuY2FsbChjYWNoZSwga2V5KSA/IGNhY2hlW2tleV0gOiAoY2FjaGVba2V5XSA9IFtdKSkucHVzaChhcnJheVtpbmRleF0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGlmIChpc0xhcmdlKSB7XG4gICAgICAgIHZhciBrZXkgPSB2YWx1ZSArICcnO1xuICAgICAgICByZXR1cm4gaGFzT3duUHJvcGVydHkuY2FsbChjYWNoZSwga2V5KSAmJiBpbmRleE9mKGNhY2hlW2tleV0sIHZhbHVlKSA+IC0xO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluZGV4T2YoYXJyYXksIHZhbHVlLCBmcm9tSW5kZXgpID4gLTE7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVzZWQgYnkgYF8ubWF4YCBhbmQgYF8ubWluYCBhcyB0aGUgZGVmYXVsdCBgY2FsbGJhY2tgIHdoZW4gYSBnaXZlblxuICAgKiBgY29sbGVjdGlvbmAgaXMgYSBzdHJpbmcgdmFsdWUuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBUaGUgY2hhcmFjdGVyIHRvIGluc3BlY3QuXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IFJldHVybnMgdGhlIGNvZGUgdW5pdCBvZiBnaXZlbiBjaGFyYWN0ZXIuXG4gICAqL1xuICBmdW5jdGlvbiBjaGFyQXRDYWxsYmFjayh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZS5jaGFyQ29kZUF0KDApO1xuICB9XG5cbiAgLyoqXG4gICAqIFVzZWQgYnkgYHNvcnRCeWAgdG8gY29tcGFyZSB0cmFuc2Zvcm1lZCBgY29sbGVjdGlvbmAgdmFsdWVzLCBzdGFibGUgc29ydGluZ1xuICAgKiB0aGVtIGluIGFzY2VuZGluZyBvcmRlci5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IGEgVGhlIG9iamVjdCB0byBjb21wYXJlIHRvIGBiYC5cbiAgICogQHBhcmFtIHtPYmplY3R9IGIgVGhlIG9iamVjdCB0byBjb21wYXJlIHRvIGBhYC5cbiAgICogQHJldHVybnMge051bWJlcn0gUmV0dXJucyB0aGUgc29ydCBvcmRlciBpbmRpY2F0b3Igb2YgYDFgIG9yIGAtMWAuXG4gICAqL1xuICBmdW5jdGlvbiBjb21wYXJlQXNjZW5kaW5nKGEsIGIpIHtcbiAgICB2YXIgYWkgPSBhLmluZGV4LFxuICAgICAgICBiaSA9IGIuaW5kZXg7XG5cbiAgICBhID0gYS5jcml0ZXJpYTtcbiAgICBiID0gYi5jcml0ZXJpYTtcblxuICAgIC8vIGVuc3VyZSBhIHN0YWJsZSBzb3J0IGluIFY4IGFuZCBvdGhlciBlbmdpbmVzXG4gICAgLy8gaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9OTBcbiAgICBpZiAoYSAhPT0gYikge1xuICAgICAgaWYgKGEgPiBiIHx8IGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gMTtcbiAgICAgIH1cbiAgICAgIGlmIChhIDwgYiB8fCBiID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYWkgPCBiaSA/IC0xIDogMTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCwgd2hlbiBjYWxsZWQsIGludm9rZXMgYGZ1bmNgIHdpdGggdGhlIGB0aGlzYFxuICAgKiBiaW5kaW5nIG9mIGB0aGlzQXJnYCBhbmQgcHJlcGVuZHMgYW55IGBwYXJ0YWlsQXJnc2AgdG8gdGhlIGFyZ3VtZW50cyBwYXNzZWRcbiAgICogdG8gdGhlIGJvdW5kIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufFN0cmluZ30gZnVuYyBUaGUgZnVuY3Rpb24gdG8gYmluZCBvciB0aGUgbWV0aG9kIG5hbWUuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICAgKiBAcGFyYW0ge0FycmF5fSBwYXJ0aWFsQXJncyBBbiBhcnJheSBvZiBhcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGJvdW5kIGZ1bmN0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gY3JlYXRlQm91bmQoZnVuYywgdGhpc0FyZywgcGFydGlhbEFyZ3MpIHtcbiAgICB2YXIgaXNGdW5jID0gaXNGdW5jdGlvbihmdW5jKSxcbiAgICAgICAgaXNQYXJ0aWFsID0gIXBhcnRpYWxBcmdzLFxuICAgICAgICBtZXRob2ROYW1lID0gZnVuYztcblxuICAgIC8vIGp1Z2dsZSBhcmd1bWVudHNcbiAgICBpZiAoaXNQYXJ0aWFsKSB7XG4gICAgICBwYXJ0aWFsQXJncyA9IHRoaXNBcmc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYm91bmQoKSB7XG4gICAgICAvLyBgRnVuY3Rpb24jYmluZGAgc3BlY1xuICAgICAgLy8gaHR0cDovL2VzNS5naXRodWIuY29tLyN4MTUuMy40LjVcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxuICAgICAgICAgIHRoaXNCaW5kaW5nID0gaXNQYXJ0aWFsID8gdGhpcyA6IHRoaXNBcmc7XG5cbiAgICAgIGlmICghaXNGdW5jKSB7XG4gICAgICAgIGZ1bmMgPSB0aGlzQXJnW21ldGhvZE5hbWVdO1xuICAgICAgfVxuICAgICAgaWYgKHBhcnRpYWxBcmdzLmxlbmd0aCkge1xuICAgICAgICBhcmdzID0gYXJncy5sZW5ndGhcbiAgICAgICAgICA/IHBhcnRpYWxBcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3MpKVxuICAgICAgICAgIDogcGFydGlhbEFyZ3M7XG4gICAgICB9XG4gICAgICBpZiAodGhpcyBpbnN0YW5jZW9mIGJvdW5kKSB7XG4gICAgICAgIC8vIGdldCBgZnVuY2AgaW5zdGFuY2UgaWYgYGJvdW5kYCBpcyBpbnZva2VkIGluIGEgYG5ld2AgZXhwcmVzc2lvblxuICAgICAgICBub29wLnByb3RvdHlwZSA9IGZ1bmMucHJvdG90eXBlO1xuICAgICAgICB0aGlzQmluZGluZyA9IG5ldyBub29wO1xuXG4gICAgICAgIC8vIG1pbWljIHRoZSBjb25zdHJ1Y3RvcidzIGByZXR1cm5gIGJlaGF2aW9yXG4gICAgICAgIC8vIGh0dHA6Ly9lczUuZ2l0aHViLmNvbS8jeDEzLjIuMlxuICAgICAgICB2YXIgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQmluZGluZywgYXJncyk7XG4gICAgICAgIHJldHVybiBpc09iamVjdChyZXN1bHQpXG4gICAgICAgICAgPyByZXN1bHRcbiAgICAgICAgICA6IHRoaXNCaW5kaW5nXG4gICAgICB9XG4gICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzQmluZGluZywgYXJncyk7XG4gICAgfVxuICAgIHJldHVybiBib3VuZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9kdWNlcyBhbiBpdGVyYXRpb24gY2FsbGJhY2sgYm91bmQgdG8gYW4gb3B0aW9uYWwgYHRoaXNBcmdgLiBJZiBgZnVuY2AgaXNcbiAgICogYSBwcm9wZXJ0eSBuYW1lLCB0aGUgY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIGZvciBhIGdpdmVuIGVsZW1lbnQuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258U3RyaW5nfSBbZnVuYz1pZGVudGl0eXxwcm9wZXJ0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXJcbiAgICogaXRlcmF0aW9uIG9yIHByb3BlcnR5IG5hbWUgdG8gcXVlcnkuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIGEgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAqL1xuICBmdW5jdGlvbiBjcmVhdGVDYWxsYmFjayhmdW5jLCB0aGlzQXJnKSB7XG4gICAgaWYgKCFmdW5jKSB7XG4gICAgICByZXR1cm4gaWRlbnRpdHk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgZnVuYyAhPSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgICAgIHJldHVybiBvYmplY3RbZnVuY107XG4gICAgICB9O1xuICAgIH1cbiAgICBpZiAodGhpc0FyZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGluZGV4LCBvYmplY3QpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCB2YWx1ZSwgaW5kZXgsIG9iamVjdCk7XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gZnVuYztcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGNvbXBpbGVkIGl0ZXJhdGlvbiBmdW5jdGlvbnMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uczEsIG9wdGlvbnMyLCAuLi5dIFRoZSBjb21waWxlIG9wdGlvbnMgb2JqZWN0KHMpLlxuICAgKiAgdXNlSGFzIC0gQSBib29sZWFuIHRvIHNwZWNpZnkgdXNpbmcgYGhhc093blByb3BlcnR5YCBjaGVja3MgaW4gdGhlIG9iamVjdCBsb29wLlxuICAgKiAgYXJncyAtIEEgc3RyaW5nIG9mIGNvbW1hIHNlcGFyYXRlZCBhcmd1bWVudHMgdGhlIGl0ZXJhdGlvbiBmdW5jdGlvbiB3aWxsIGFjY2VwdC5cbiAgICogIHRvcCAtIEEgc3RyaW5nIG9mIGNvZGUgdG8gZXhlY3V0ZSBiZWZvcmUgdGhlIGl0ZXJhdGlvbiBicmFuY2hlcy5cbiAgICogIGFycmF5TG9vcCAtIEEgc3RyaW5nIG9mIGNvZGUgdG8gZXhlY3V0ZSBpbiB0aGUgYXJyYXkgbG9vcC5cbiAgICogIG9iamVjdExvb3AgLSBBIHN0cmluZyBvZiBjb2RlIHRvIGV4ZWN1dGUgaW4gdGhlIG9iamVjdCBsb29wLlxuICAgKiAgYm90dG9tIC0gQSBzdHJpbmcgb2YgY29kZSB0byBleGVjdXRlIGFmdGVyIHRoZSBpdGVyYXRpb24gYnJhbmNoZXMuXG4gICAqXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgY29tcGlsZWQgZnVuY3Rpb24uXG4gICAqL1xuICBmdW5jdGlvbiBjcmVhdGVJdGVyYXRvcigpIHtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgICdhcnJheUxvb3AnOiAnJyxcbiAgICAgICdib3R0b20nOiAnJyxcbiAgICAgICdoYXNEb250RW51bUJ1Zyc6IGhhc0RvbnRFbnVtQnVnLFxuICAgICAgJ2lzS2V5c0Zhc3QnOiBpc0tleXNGYXN0LFxuICAgICAgJ29iamVjdExvb3AnOiAnJyxcbiAgICAgICdub0FyZ3NFbnVtJzogbm9BcmdzRW51bSxcbiAgICAgICdub0NoYXJCeUluZGV4Jzogbm9DaGFyQnlJbmRleCxcbiAgICAgICdzaGFkb3dlZCc6IHNoYWRvd2VkLFxuICAgICAgJ3RvcCc6ICcnLFxuICAgICAgJ3VzZUhhcyc6IHRydWVcbiAgICB9O1xuXG4gICAgLy8gbWVyZ2Ugb3B0aW9ucyBpbnRvIGEgdGVtcGxhdGUgZGF0YSBvYmplY3RcbiAgICBmb3IgKHZhciBvYmplY3QsIGluZGV4ID0gMDsgb2JqZWN0ID0gYXJndW1lbnRzW2luZGV4XTsgaW5kZXgrKykge1xuICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICBkYXRhW2tleV0gPSBvYmplY3Rba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGFyZ3MgPSBkYXRhLmFyZ3M7XG4gICAgZGF0YS5maXJzdEFyZyA9IC9eW14sXSsvLmV4ZWMoYXJncylbMF07XG5cbiAgICAvLyBjcmVhdGUgdGhlIGZ1bmN0aW9uIGZhY3RvcnlcbiAgICB2YXIgZmFjdG9yeSA9IEZ1bmN0aW9uKFxuICAgICAgICAnY3JlYXRlQ2FsbGJhY2ssIGhhc093blByb3BlcnR5LCBpc0FyZ3VtZW50cywgaXNTdHJpbmcsIG9iamVjdFR5cGVzLCAnICtcbiAgICAgICAgJ25hdGl2ZUtleXMsIHByb3BlcnR5SXNFbnVtZXJhYmxlJyxcbiAgICAgICdyZXR1cm4gZnVuY3Rpb24oJyArIGFyZ3MgKyAnKSB7XFxuJyArIGl0ZXJhdG9yVGVtcGxhdGUoZGF0YSkgKyAnXFxufSdcbiAgICApO1xuICAgIC8vIHJldHVybiB0aGUgY29tcGlsZWQgZnVuY3Rpb25cbiAgICByZXR1cm4gZmFjdG9yeShcbiAgICAgIGNyZWF0ZUNhbGxiYWNrLCBoYXNPd25Qcm9wZXJ0eSwgaXNBcmd1bWVudHMsIGlzU3RyaW5nLCBvYmplY3RUeXBlcyxcbiAgICAgIG5hdGl2ZUtleXMsIHByb3BlcnR5SXNFbnVtZXJhYmxlXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVc2VkIGJ5IGB0ZW1wbGF0ZWAgdG8gZXNjYXBlIGNoYXJhY3RlcnMgZm9yIGluY2x1c2lvbiBpbiBjb21waWxlZFxuICAgKiBzdHJpbmcgbGl0ZXJhbHMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtYXRjaCBUaGUgbWF0Y2hlZCBjaGFyYWN0ZXIgdG8gZXNjYXBlLlxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBSZXR1cm5zIHRoZSBlc2NhcGVkIGNoYXJhY3Rlci5cbiAgICovXG4gIGZ1bmN0aW9uIGVzY2FwZVN0cmluZ0NoYXIobWF0Y2gpIHtcbiAgICByZXR1cm4gJ1xcXFwnICsgc3RyaW5nRXNjYXBlc1ttYXRjaF07XG4gIH1cblxuICAvKipcbiAgICogVXNlZCBieSBgZXNjYXBlYCB0byBjb252ZXJ0IGNoYXJhY3RlcnMgdG8gSFRNTCBlbnRpdGllcy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1hdGNoIFRoZSBtYXRjaGVkIGNoYXJhY3RlciB0byBlc2NhcGUuXG4gICAqIEByZXR1cm5zIHtTdHJpbmd9IFJldHVybnMgdGhlIGVzY2FwZWQgY2hhcmFjdGVyLlxuICAgKi9cbiAgZnVuY3Rpb24gZXNjYXBlSHRtbENoYXIobWF0Y2gpIHtcbiAgICByZXR1cm4gaHRtbEVzY2FwZXNbbWF0Y2hdO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgbm8tb3BlcmF0aW9uIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZnVuY3Rpb24gbm9vcCgpIHtcbiAgICAvLyBubyBvcGVyYXRpb24gcGVyZm9ybWVkXG4gIH1cblxuICAvKipcbiAgICogVXNlZCBieSBgdW5lc2NhcGVgIHRvIGNvbnZlcnQgSFRNTCBlbnRpdGllcyB0byBjaGFyYWN0ZXJzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWF0Y2ggVGhlIG1hdGNoZWQgY2hhcmFjdGVyIHRvIHVuZXNjYXBlLlxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBSZXR1cm5zIHRoZSB1bmVzY2FwZWQgY2hhcmFjdGVyLlxuICAgKi9cbiAgZnVuY3Rpb24gdW5lc2NhcGVIdG1sQ2hhcihtYXRjaCkge1xuICAgIHJldHVybiBodG1sVW5lc2NhcGVzW21hdGNoXTtcbiAgfVxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhbiBgYXJndW1lbnRzYCBvYmplY3QuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYW4gYGFyZ3VtZW50c2Agb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIChmdW5jdGlvbigpIHsgcmV0dXJuIF8uaXNBcmd1bWVudHMoYXJndW1lbnRzKTsgfSkoMSwgMiwgMyk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogXy5pc0FyZ3VtZW50cyhbMSwgMiwgM10pO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKi9cbiAgZnVuY3Rpb24gaXNBcmd1bWVudHModmFsdWUpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gYXJnc0NsYXNzO1xuICB9XG4gIC8vIGZhbGxiYWNrIGZvciBicm93c2VycyB0aGF0IGNhbid0IGRldGVjdCBgYXJndW1lbnRzYCBvYmplY3RzIGJ5IFtbQ2xhc3NdXVxuICBpZiAobm9BcmdzQ2xhc3MpIHtcbiAgICBpc0FyZ3VtZW50cyA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdmFsdWUgPyBoYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCAnY2FsbGVlJykgOiBmYWxzZTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEl0ZXJhdGVzIG92ZXIgYG9iamVjdGAncyBvd24gYW5kIGluaGVyaXRlZCBlbnVtZXJhYmxlIHByb3BlcnRpZXMsIGV4ZWN1dGluZ1xuICAgKiB0aGUgYGNhbGxiYWNrYCBmb3IgZWFjaCBwcm9wZXJ0eS4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZFxuICAgKiBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGtleSwgb2JqZWN0KS4gQ2FsbGJhY2tzIG1heSBleGl0IGl0ZXJhdGlvblxuICAgKiBlYXJseSBieSBleHBsaWNpdGx5IHJldHVybmluZyBgZmFsc2VgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBmdW5jdGlvbiBEb2cobmFtZSkge1xuICAgKiAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAqIH1cbiAgICpcbiAgICogRG9nLnByb3RvdHlwZS5iYXJrID0gZnVuY3Rpb24oKSB7XG4gICAqICAgYWxlcnQoJ1dvb2YsIHdvb2YhJyk7XG4gICAqIH07XG4gICAqXG4gICAqIF8uZm9ySW4obmV3IERvZygnRGFnbnknKSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgKiAgIGFsZXJ0KGtleSk7XG4gICAqIH0pO1xuICAgKiAvLyA9PiBhbGVydHMgJ25hbWUnIGFuZCAnYmFyaycgKG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICAgKi9cbiAgdmFyIGZvckluID0gY3JlYXRlSXRlcmF0b3IoZm9yRWFjaEl0ZXJhdG9yT3B0aW9ucywgZm9yT3duSXRlcmF0b3JPcHRpb25zLCB7XG4gICAgJ3VzZUhhcyc6IGZhbHNlXG4gIH0pO1xuXG4gIC8qKlxuICAgKiBJdGVyYXRlcyBvdmVyIGBvYmplY3RgJ3Mgb3duIGVudW1lcmFibGUgcHJvcGVydGllcywgZXhlY3V0aW5nIHRoZSBgY2FsbGJhY2tgXG4gICAqIGZvciBlYWNoIHByb3BlcnR5LiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZVxuICAgKiBhcmd1bWVudHM7ICh2YWx1ZSwga2V5LCBvYmplY3QpLiBDYWxsYmFja3MgbWF5IGV4aXQgaXRlcmF0aW9uIGVhcmx5IGJ5IGV4cGxpY2l0bHlcbiAgICogcmV0dXJuaW5nIGBmYWxzZWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uZm9yT3duKHsgJzAnOiAnemVybycsICcxJzogJ29uZScsICdsZW5ndGgnOiAyIH0sIGZ1bmN0aW9uKG51bSwga2V5KSB7XG4gICAqICAgYWxlcnQoa2V5KTtcbiAgICogfSk7XG4gICAqIC8vID0+IGFsZXJ0cyAnMCcsICcxJywgYW5kICdsZW5ndGgnIChvcmRlciBpcyBub3QgZ3VhcmFudGVlZClcbiAgICovXG4gIHZhciBmb3JPd24gPSBjcmVhdGVJdGVyYXRvcihmb3JFYWNoSXRlcmF0b3JPcHRpb25zLCBmb3JPd25JdGVyYXRvck9wdGlvbnMpO1xuXG4gIC8qKlxuICAgKiBBIGZhbGxiYWNrIGltcGxlbWVudGF0aW9uIG9mIGBpc1BsYWluT2JqZWN0YCB0aGF0IGNoZWNrcyBpZiBhIGdpdmVuIGB2YWx1ZWBcbiAgICogaXMgYW4gb2JqZWN0IGNyZWF0ZWQgYnkgdGhlIGBPYmplY3RgIGNvbnN0cnVjdG9yLCBhc3N1bWluZyBvYmplY3RzIGNyZWF0ZWRcbiAgICogYnkgdGhlIGBPYmplY3RgIGNvbnN0cnVjdG9yIGhhdmUgbm8gaW5oZXJpdGVkIGVudW1lcmFibGUgcHJvcGVydGllcyBhbmQgdGhhdFxuICAgKiB0aGVyZSBhcmUgbm8gYE9iamVjdC5wcm90b3R5cGVgIGV4dGVuc2lvbnMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBwbGFpbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAgICovXG4gIGZ1bmN0aW9uIHNoaW1Jc1BsYWluT2JqZWN0KHZhbHVlKSB7XG4gICAgLy8gYXZvaWQgbm9uLW9iamVjdHMgYW5kIGZhbHNlIHBvc2l0aXZlcyBmb3IgYGFyZ3VtZW50c2Agb2JqZWN0c1xuICAgIHZhciByZXN1bHQgPSBmYWxzZTtcbiAgICBpZiAoISh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcpIHx8IGlzQXJndW1lbnRzKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgLy8gSUUgPCA5IHByZXNlbnRzIERPTSBub2RlcyBhcyBgT2JqZWN0YCBvYmplY3RzIGV4Y2VwdCB0aGV5IGhhdmUgYHRvU3RyaW5nYFxuICAgIC8vIG1ldGhvZHMgdGhhdCBhcmUgYHR5cGVvZmAgXCJzdHJpbmdcIiBhbmQgc3RpbGwgY2FuIGNvZXJjZSBub2RlcyB0byBzdHJpbmdzLlxuICAgIC8vIEFsc28gY2hlY2sgdGhhdCB0aGUgY29uc3RydWN0b3IgaXMgYE9iamVjdGAgKGkuZS4gYE9iamVjdCBpbnN0YW5jZW9mIE9iamVjdGApXG4gICAgdmFyIGN0b3IgPSB2YWx1ZS5jb25zdHJ1Y3RvcjtcbiAgICBpZiAoKCFub05vZGVDbGFzcyB8fCAhKHR5cGVvZiB2YWx1ZS50b1N0cmluZyAhPSAnZnVuY3Rpb24nICYmIHR5cGVvZiAodmFsdWUgKyAnJykgPT0gJ3N0cmluZycpKSAmJlxuICAgICAgICAoIWlzRnVuY3Rpb24oY3RvcikgfHwgY3RvciBpbnN0YW5jZW9mIGN0b3IpKSB7XG4gICAgICAvLyBJRSA8IDkgaXRlcmF0ZXMgaW5oZXJpdGVkIHByb3BlcnRpZXMgYmVmb3JlIG93biBwcm9wZXJ0aWVzLiBJZiB0aGUgZmlyc3RcbiAgICAgIC8vIGl0ZXJhdGVkIHByb3BlcnR5IGlzIGFuIG9iamVjdCdzIG93biBwcm9wZXJ0eSB0aGVuIHRoZXJlIGFyZSBubyBpbmhlcml0ZWRcbiAgICAgIC8vIGVudW1lcmFibGUgcHJvcGVydGllcy5cbiAgICAgIGlmIChpdGVyYXRlc093bkxhc3QpIHtcbiAgICAgICAgZm9ySW4odmFsdWUsIGZ1bmN0aW9uKHZhbHVlLCBrZXksIG9iamVjdCkge1xuICAgICAgICAgIHJlc3VsdCA9ICFoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwga2V5KTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0ID09PSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIC8vIEluIG1vc3QgZW52aXJvbm1lbnRzIGFuIG9iamVjdCdzIG93biBwcm9wZXJ0aWVzIGFyZSBpdGVyYXRlZCBiZWZvcmVcbiAgICAgIC8vIGl0cyBpbmhlcml0ZWQgcHJvcGVydGllcy4gSWYgdGhlIGxhc3QgaXRlcmF0ZWQgcHJvcGVydHkgaXMgYW4gb2JqZWN0J3NcbiAgICAgIC8vIG93biBwcm9wZXJ0eSB0aGVuIHRoZXJlIGFyZSBubyBpbmhlcml0ZWQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzLlxuICAgICAgZm9ySW4odmFsdWUsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgcmVzdWx0ID0ga2V5O1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0ID09PSBmYWxzZSB8fCBoYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCByZXN1bHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEEgZmFsbGJhY2sgaW1wbGVtZW50YXRpb24gb2YgYE9iamVjdC5rZXlzYCB0aGF0IHByb2R1Y2VzIGFuIGFycmF5IG9mIHRoZVxuICAgKiBnaXZlbiBvYmplY3QncyBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGluc3BlY3QuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAgICovXG4gIGZ1bmN0aW9uIHNoaW1LZXlzKG9iamVjdCkge1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICBmb3JPd24ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogVXNlZCB0byBjb252ZXJ0IGNoYXJhY3RlcnMgdG8gSFRNTCBlbnRpdGllczpcbiAgICpcbiAgICogVGhvdWdoIHRoZSBgPmAgY2hhcmFjdGVyIGlzIGVzY2FwZWQgZm9yIHN5bW1ldHJ5LCBjaGFyYWN0ZXJzIGxpa2UgYD5gIGFuZCBgL2BcbiAgICogZG9uJ3QgcmVxdWlyZSBlc2NhcGluZyBpbiBIVE1MIGFuZCBoYXZlIG5vIHNwZWNpYWwgbWVhbmluZyB1bmxlc3MgdGhleSdyZSBwYXJ0XG4gICAqIG9mIGEgdGFnIG9yIGFuIHVucXVvdGVkIGF0dHJpYnV0ZSB2YWx1ZS5cbiAgICogaHR0cDovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvYW1iaWd1b3VzLWFtcGVyc2FuZHMgKHVuZGVyIFwic2VtaS1yZWxhdGVkIGZ1biBmYWN0XCIpXG4gICAqL1xuICB2YXIgaHRtbEVzY2FwZXMgPSB7XG4gICAgJyYnOiAnJmFtcDsnLFxuICAgICc8JzogJyZsdDsnLFxuICAgICc+JzogJyZndDsnLFxuICAgICdcIic6ICcmcXVvdDsnLFxuICAgIFwiJ1wiOiAnJiN4Mjc7J1xuICB9O1xuXG4gIC8qKiBVc2VkIHRvIGNvbnZlcnQgSFRNTCBlbnRpdGllcyB0byBjaGFyYWN0ZXJzICovXG4gIHZhciBodG1sVW5lc2NhcGVzID0gaW52ZXJ0KGh0bWxFc2NhcGVzKTtcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGNsb25lIG9mIGB2YWx1ZWAuIElmIGBkZWVwYCBpcyBgdHJ1ZWAsIGFsbCBuZXN0ZWQgb2JqZWN0cyB3aWxsXG4gICAqIGFsc28gYmUgY2xvbmVkIG90aGVyd2lzZSB0aGV5IHdpbGwgYmUgYXNzaWduZWQgYnkgcmVmZXJlbmNlLiBGdW5jdGlvbnMsIERPTVxuICAgKiBub2RlcywgYGFyZ3VtZW50c2Agb2JqZWN0cywgYW5kIG9iamVjdHMgY3JlYXRlZCBieSBjb25zdHJ1Y3RvcnMgb3RoZXIgdGhhblxuICAgKiBgT2JqZWN0YCBhcmUgKipub3QqKiBjbG9uZWQuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNsb25lLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGRlZXAgQSBmbGFnIHRvIGluZGljYXRlIGEgZGVlcCBjbG9uZS5cbiAgICogQHBhcmFtLSB7T2JqZWN0fSBbZ3VhcmRdIEludGVybmFsbHkgdXNlZCB0byBhbGxvdyB0aGlzIG1ldGhvZCB0byB3b3JrIHdpdGhcbiAgICogIG90aGVycyBsaWtlIGBfLm1hcGAgd2l0aG91dCB1c2luZyB0aGVpciBjYWxsYmFjayBgaW5kZXhgIGFyZ3VtZW50IGZvciBgZGVlcGAuXG4gICAqIEBwYXJhbS0ge0FycmF5fSBbc3RhY2tBPVtdXSBJbnRlcm5hbGx5IHVzZWQgdG8gdHJhY2sgdHJhdmVyc2VkIHNvdXJjZSBvYmplY3RzLlxuICAgKiBAcGFyYW0tIHtBcnJheX0gW3N0YWNrQj1bXV0gSW50ZXJuYWxseSB1c2VkIHRvIGFzc29jaWF0ZSBjbG9uZXMgd2l0aCB0aGVpclxuICAgKiAgc291cmNlIGNvdW50ZXJwYXJ0cy5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSBjbG9uZWQgYHZhbHVlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIHN0b29nZXMgPSBbXG4gICAqICAgeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfSxcbiAgICogICB7ICduYW1lJzogJ2xhcnJ5JywgJ2FnZSc6IDUwIH0sXG4gICAqICAgeyAnbmFtZSc6ICdjdXJseScsICdhZ2UnOiA2MCB9XG4gICAqIF07XG4gICAqXG4gICAqIF8uY2xvbmUoeyAnbmFtZSc6ICdtb2UnIH0pO1xuICAgKiAvLyA9PiB7ICduYW1lJzogJ21vZScgfVxuICAgKlxuICAgKiB2YXIgc2hhbGxvdyA9IF8uY2xvbmUoc3Rvb2dlcyk7XG4gICAqIHNoYWxsb3dbMF0gPT09IHN0b29nZXNbMF07XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogdmFyIGRlZXAgPSBfLmNsb25lKHN0b29nZXMsIHRydWUpO1xuICAgKiBzaGFsbG93WzBdID09PSBzdG9vZ2VzWzBdO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKi9cbiAgZnVuY3Rpb24gY2xvbmUodmFsdWUsIGRlZXAsIGd1YXJkLCBzdGFja0EsIHN0YWNrQikge1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGlmIChndWFyZCkge1xuICAgICAgZGVlcCA9IGZhbHNlO1xuICAgIH1cbiAgICAvLyBpbnNwZWN0IFtbQ2xhc3NdXVxuICAgIHZhciBpc09iaiA9IGlzT2JqZWN0KHZhbHVlKTtcbiAgICBpZiAoaXNPYmopIHtcbiAgICAgIC8vIGRvbid0IGNsb25lIGBhcmd1bWVudHNgIG9iamVjdHMsIGZ1bmN0aW9ucywgb3Igbm9uLW9iamVjdCBPYmplY3RzXG4gICAgICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbCh2YWx1ZSk7XG4gICAgICBpZiAoIWNsb25lYWJsZUNsYXNzZXNbY2xhc3NOYW1lXSB8fCAobm9BcmdzQ2xhc3MgJiYgaXNBcmd1bWVudHModmFsdWUpKSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9XG4gICAgICB2YXIgaXNBcnIgPSBjbGFzc05hbWUgPT0gYXJyYXlDbGFzcztcbiAgICAgIGlzT2JqID0gaXNBcnIgfHwgKGNsYXNzTmFtZSA9PSBvYmplY3RDbGFzcyA/IGlzUGxhaW5PYmplY3QodmFsdWUpIDogaXNPYmopO1xuICAgIH1cbiAgICAvLyBzaGFsbG93IGNsb25lXG4gICAgaWYgKCFpc09iaiB8fCAhZGVlcCkge1xuICAgICAgLy8gZG9uJ3QgY2xvbmUgZnVuY3Rpb25zXG4gICAgICByZXR1cm4gaXNPYmpcbiAgICAgICAgPyAoaXNBcnIgPyBzbGljZS5jYWxsKHZhbHVlKSA6IGV4dGVuZCh7fSwgdmFsdWUpKVxuICAgICAgICA6IHZhbHVlO1xuICAgIH1cblxuICAgIHZhciBjdG9yID0gdmFsdWUuY29uc3RydWN0b3I7XG4gICAgc3dpdGNoIChjbGFzc05hbWUpIHtcbiAgICAgIGNhc2UgYm9vbENsYXNzOlxuICAgICAgY2FzZSBkYXRlQ2xhc3M6XG4gICAgICAgIHJldHVybiBuZXcgY3RvcigrdmFsdWUpO1xuXG4gICAgICBjYXNlIG51bWJlckNsYXNzOlxuICAgICAgY2FzZSBzdHJpbmdDbGFzczpcbiAgICAgICAgcmV0dXJuIG5ldyBjdG9yKHZhbHVlKTtcblxuICAgICAgY2FzZSByZWdleHBDbGFzczpcbiAgICAgICAgcmV0dXJuIGN0b3IodmFsdWUuc291cmNlLCByZUZsYWdzLmV4ZWModmFsdWUpKTtcbiAgICB9XG4gICAgLy8gY2hlY2sgZm9yIGNpcmN1bGFyIHJlZmVyZW5jZXMgYW5kIHJldHVybiBjb3JyZXNwb25kaW5nIGNsb25lXG4gICAgc3RhY2tBIHx8IChzdGFja0EgPSBbXSk7XG4gICAgc3RhY2tCIHx8IChzdGFja0IgPSBbXSk7XG5cbiAgICB2YXIgbGVuZ3RoID0gc3RhY2tBLmxlbmd0aDtcbiAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgIGlmIChzdGFja0FbbGVuZ3RoXSA9PSB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gc3RhY2tCW2xlbmd0aF07XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGluaXQgY2xvbmVkIG9iamVjdFxuICAgIHZhciByZXN1bHQgPSBpc0FyciA/IGN0b3IodmFsdWUubGVuZ3RoKSA6IHt9O1xuXG4gICAgLy8gYWRkIHRoZSBzb3VyY2UgdmFsdWUgdG8gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzXG4gICAgLy8gYW5kIGFzc29jaWF0ZSBpdCB3aXRoIGl0cyBjbG9uZVxuICAgIHN0YWNrQS5wdXNoKHZhbHVlKTtcbiAgICBzdGFja0IucHVzaChyZXN1bHQpO1xuXG4gICAgLy8gcmVjdXJzaXZlbHkgcG9wdWxhdGUgY2xvbmUgKHN1c2NlcHRpYmxlIHRvIGNhbGwgc3RhY2sgbGltaXRzKVxuICAgIChpc0FyciA/IGZvckVhY2ggOiBmb3JPd24pKHZhbHVlLCBmdW5jdGlvbihvYmpWYWx1ZSwga2V5KSB7XG4gICAgICByZXN1bHRba2V5XSA9IGNsb25lKG9ialZhbHVlLCBkZWVwLCBudWxsLCBzdGFja0EsIHN0YWNrQik7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEFzc2lnbnMgZW51bWVyYWJsZSBwcm9wZXJ0aWVzIG9mIHRoZSBkZWZhdWx0IG9iamVjdChzKSB0byB0aGUgYGRlc3RpbmF0aW9uYFxuICAgKiBvYmplY3QgZm9yIGFsbCBgZGVzdGluYXRpb25gIHByb3BlcnRpZXMgdGhhdCByZXNvbHZlIHRvIGBudWxsYC9gdW5kZWZpbmVkYC5cbiAgICogT25jZSBhIHByb3BlcnR5IGlzIHNldCwgYWRkaXRpb25hbCBkZWZhdWx0cyBvZiB0aGUgc2FtZSBwcm9wZXJ0eSB3aWxsIGJlXG4gICAqIGlnbm9yZWQuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgKiBAcGFyYW0ge09iamVjdH0gW2RlZmF1bHQxLCBkZWZhdWx0MiwgLi4uXSBUaGUgZGVmYXVsdCBvYmplY3RzLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBpY2VDcmVhbSA9IHsgJ2ZsYXZvcic6ICdjaG9jb2xhdGUnIH07XG4gICAqIF8uZGVmYXVsdHMoaWNlQ3JlYW0sIHsgJ2ZsYXZvcic6ICd2YW5pbGxhJywgJ3Nwcmlua2xlcyc6ICdyYWluYm93JyB9KTtcbiAgICogLy8gPT4geyAnZmxhdm9yJzogJ2Nob2NvbGF0ZScsICdzcHJpbmtsZXMnOiAncmFpbmJvdycgfVxuICAgKi9cbiAgdmFyIGRlZmF1bHRzID0gY3JlYXRlSXRlcmF0b3IoZXh0ZW5kSXRlcmF0b3JPcHRpb25zLCB7XG4gICAgJ29iamVjdExvb3AnOiAnaWYgKHJlc3VsdFtpbmRleF0gPT0gbnVsbCkgJyArIGV4dGVuZEl0ZXJhdG9yT3B0aW9ucy5vYmplY3RMb29wXG4gIH0pO1xuXG4gIC8qKlxuICAgKiBBc3NpZ25zIGVudW1lcmFibGUgcHJvcGVydGllcyBvZiB0aGUgc291cmNlIG9iamVjdChzKSB0byB0aGUgYGRlc3RpbmF0aW9uYFxuICAgKiBvYmplY3QuIFN1YnNlcXVlbnQgc291cmNlcyB3aWxsIG92ZXJ3cml0ZSBwcm9wZXJ5IGFzc2lnbm1lbnRzIG9mIHByZXZpb3VzXG4gICAqIHNvdXJjZXMuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgKiBAcGFyYW0ge09iamVjdH0gW3NvdXJjZTEsIHNvdXJjZTIsIC4uLl0gVGhlIHNvdXJjZSBvYmplY3RzLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uZXh0ZW5kKHsgJ25hbWUnOiAnbW9lJyB9LCB7ICdhZ2UnOiA0MCB9KTtcbiAgICogLy8gPT4geyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfVxuICAgKi9cbiAgdmFyIGV4dGVuZCA9IGNyZWF0ZUl0ZXJhdG9yKGV4dGVuZEl0ZXJhdG9yT3B0aW9ucyk7XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBzb3J0ZWQgYXJyYXkgb2YgYWxsIGVudW1lcmFibGUgcHJvcGVydGllcywgb3duIGFuZCBpbmhlcml0ZWQsXG4gICAqIG9mIGBvYmplY3RgIHRoYXQgaGF2ZSBmdW5jdGlvbiB2YWx1ZXMuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIG1ldGhvZHNcbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGluc3BlY3QuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcyB0aGF0IGhhdmUgZnVuY3Rpb24gdmFsdWVzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmZ1bmN0aW9ucyhfKTtcbiAgICogLy8gPT4gWydhbGwnLCAnYW55JywgJ2JpbmQnLCAnYmluZEFsbCcsICdjbG9uZScsICdjb21wYWN0JywgJ2NvbXBvc2UnLCAuLi5dXG4gICAqL1xuICBmdW5jdGlvbiBmdW5jdGlvbnMob2JqZWN0KSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIGZvckluKG9iamVjdCwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdC5zb3J0KCk7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSBzcGVjaWZpZWQgb2JqZWN0IGBwcm9wZXJ0eWAgZXhpc3RzIGFuZCBpcyBhIGRpcmVjdCBwcm9wZXJ0eSxcbiAgICogaW5zdGVhZCBvZiBhbiBpbmhlcml0ZWQgcHJvcGVydHkuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGNoZWNrLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHkgVGhlIHByb3BlcnR5IHRvIGNoZWNrIGZvci5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGtleSBpcyBhIGRpcmVjdCBwcm9wZXJ0eSwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmhhcyh7ICdhJzogMSwgJ2InOiAyLCAnYyc6IDMgfSwgJ2InKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKi9cbiAgZnVuY3Rpb24gaGFzKG9iamVjdCwgcHJvcGVydHkpIHtcbiAgICByZXR1cm4gb2JqZWN0ID8gaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIHByb3BlcnR5KSA6IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gb2JqZWN0IGNvbXBvc2VkIG9mIHRoZSBpbnZlcnRlZCBrZXlzIGFuZCB2YWx1ZXMgb2YgdGhlIGdpdmVuIGBvYmplY3RgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnZlcnQuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGNyZWF0ZWQgaW52ZXJ0ZWQgb2JqZWN0LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiAgXy5pbnZlcnQoeyAnZmlyc3QnOiAnTW9lJywgJ3NlY29uZCc6ICdMYXJyeScsICd0aGlyZCc6ICdDdXJseScgfSk7XG4gICAqIC8vID0+IHsgJ01vZSc6ICdmaXJzdCcsICdMYXJyeSc6ICdzZWNvbmQnLCAnQ3VybHknOiAndGhpcmQnIH0gKG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICAgKi9cbiAgZnVuY3Rpb24gaW52ZXJ0KG9iamVjdCkge1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICBmb3JPd24ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICByZXN1bHRbdmFsdWVdID0ga2V5O1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYW4gYXJyYXkuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYW4gYXJyYXksIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogKGZ1bmN0aW9uKCkgeyByZXR1cm4gXy5pc0FycmF5KGFyZ3VtZW50cyk7IH0pKCk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqXG4gICAqIF8uaXNBcnJheShbMSwgMiwgM10pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICB2YXIgaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gYXJyYXlDbGFzcztcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBib29sZWFuIChgdHJ1ZWAgb3IgYGZhbHNlYCkgdmFsdWUuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYSBib29sZWFuIHZhbHVlLCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNCb29sZWFuKG51bGwpO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKi9cbiAgZnVuY3Rpb24gaXNCb29sZWFuKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSB0cnVlIHx8IHZhbHVlID09PSBmYWxzZSB8fCB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBib29sQ2xhc3M7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBkYXRlLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGEgZGF0ZSwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmlzRGF0ZShuZXcgRGF0ZSk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGlzRGF0ZSh2YWx1ZSkge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBkYXRlQ2xhc3M7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBET00gZWxlbWVudC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhIERPTSBlbGVtZW50LCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNFbGVtZW50KGRvY3VtZW50LmJvZHkpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc0VsZW1lbnQodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPyB2YWx1ZS5ub2RlVHlwZSA9PT0gMSA6IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGVtcHR5LiBBcnJheXMsIHN0cmluZ3MsIG9yIGBhcmd1bWVudHNgIG9iamVjdHMgd2l0aCBhXG4gICAqIGxlbmd0aCBvZiBgMGAgYW5kIG9iamVjdHMgd2l0aCBubyBvd24gZW51bWVyYWJsZSBwcm9wZXJ0aWVzIGFyZSBjb25zaWRlcmVkXG4gICAqIFwiZW1wdHlcIi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IHZhbHVlIFRoZSB2YWx1ZSB0byBpbnNwZWN0LlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgZW1wdHksIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc0VtcHR5KFsxLCAyLCAzXSk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqXG4gICAqIF8uaXNFbXB0eSh7fSk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogXy5pc0VtcHR5KCcnKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKi9cbiAgZnVuY3Rpb24gaXNFbXB0eSh2YWx1ZSkge1xuICAgIHZhciByZXN1bHQgPSB0cnVlO1xuICAgIGlmICghdmFsdWUpIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIHZhciBjbGFzc05hbWUgPSB0b1N0cmluZy5jYWxsKHZhbHVlKSxcbiAgICAgICAgbGVuZ3RoID0gdmFsdWUubGVuZ3RoO1xuXG4gICAgaWYgKChjbGFzc05hbWUgPT0gYXJyYXlDbGFzcyB8fCBjbGFzc05hbWUgPT0gc3RyaW5nQ2xhc3MgfHxcbiAgICAgICAgY2xhc3NOYW1lID09IGFyZ3NDbGFzcyB8fCAobm9BcmdzQ2xhc3MgJiYgaXNBcmd1bWVudHModmFsdWUpKSkgfHxcbiAgICAgICAgKGNsYXNzTmFtZSA9PSBvYmplY3RDbGFzcyAmJiB0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInICYmIGlzRnVuY3Rpb24odmFsdWUuc3BsaWNlKSkpIHtcbiAgICAgIHJldHVybiAhbGVuZ3RoO1xuICAgIH1cbiAgICBmb3JPd24odmFsdWUsIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIChyZXN1bHQgPSBmYWxzZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBhIGRlZXAgY29tcGFyaXNvbiBiZXR3ZWVuIHR3byB2YWx1ZXMgdG8gZGV0ZXJtaW5lIGlmIHRoZXkgYXJlXG4gICAqIGVxdWl2YWxlbnQgdG8gZWFjaCBvdGhlci5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSBhIFRoZSB2YWx1ZSB0byBjb21wYXJlLlxuICAgKiBAcGFyYW0ge01peGVkfSBiIFRoZSBvdGhlciB2YWx1ZSB0byBjb21wYXJlLlxuICAgKiBAcGFyYW0tIHtPYmplY3R9IFtzdGFja0E9W11dIEludGVybmFsbHkgdXNlZCB0cmFjayB0cmF2ZXJzZWQgYGFgIG9iamVjdHMuXG4gICAqIEBwYXJhbS0ge09iamVjdH0gW3N0YWNrQj1bXV0gSW50ZXJuYWxseSB1c2VkIHRyYWNrIHRyYXZlcnNlZCBgYmAgb2JqZWN0cy5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZXMgYXJlIGVxdXZhbGVudCwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgbW9lID0geyAnbmFtZSc6ICdtb2UnLCAnbHVja3lOdW1iZXJzJzogWzEzLCAyNywgMzRdIH07XG4gICAqIHZhciBjbG9uZSA9IHsgJ25hbWUnOiAnbW9lJywgJ2x1Y2t5TnVtYmVycyc6IFsxMywgMjcsIDM0XSB9O1xuICAgKlxuICAgKiBtb2UgPT0gY2xvbmU7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqXG4gICAqIF8uaXNFcXVhbChtb2UsIGNsb25lKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKi9cbiAgZnVuY3Rpb24gaXNFcXVhbChhLCBiLCBzdGFja0EsIHN0YWNrQikge1xuICAgIC8vIGV4aXQgZWFybHkgZm9yIGlkZW50aWNhbCB2YWx1ZXNcbiAgICBpZiAoYSA9PT0gYikge1xuICAgICAgLy8gdHJlYXQgYCswYCB2cy4gYC0wYCBhcyBub3QgZXF1YWxcbiAgICAgIHJldHVybiBhICE9PSAwIHx8ICgxIC8gYSA9PSAxIC8gYik7XG4gICAgfVxuICAgIC8vIGEgc3RyaWN0IGNvbXBhcmlzb24gaXMgbmVjZXNzYXJ5IGJlY2F1c2UgYG51bGwgPT0gdW5kZWZpbmVkYFxuICAgIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gYSA9PT0gYjtcbiAgICB9XG4gICAgLy8gY29tcGFyZSBbW0NsYXNzXV0gbmFtZXNcbiAgICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbChhKTtcbiAgICBpZiAoY2xhc3NOYW1lICE9IHRvU3RyaW5nLmNhbGwoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgc3dpdGNoIChjbGFzc05hbWUpIHtcbiAgICAgIGNhc2UgYm9vbENsYXNzOlxuICAgICAgY2FzZSBkYXRlQ2xhc3M6XG4gICAgICAgIC8vIGNvZXJjZSBkYXRlcyBhbmQgYm9vbGVhbnMgdG8gbnVtYmVycywgZGF0ZXMgdG8gbWlsbGlzZWNvbmRzIGFuZCBib29sZWFuc1xuICAgICAgICAvLyB0byBgMWAgb3IgYDBgLCB0cmVhdGluZyBpbnZhbGlkIGRhdGVzIGNvZXJjZWQgdG8gYE5hTmAgYXMgbm90IGVxdWFsXG4gICAgICAgIHJldHVybiArYSA9PSArYjtcblxuICAgICAgY2FzZSBudW1iZXJDbGFzczpcbiAgICAgICAgLy8gdHJlYXQgYE5hTmAgdnMuIGBOYU5gIGFzIGVxdWFsXG4gICAgICAgIHJldHVybiBhICE9ICthXG4gICAgICAgICAgPyBiICE9ICtiXG4gICAgICAgICAgLy8gYnV0IHRyZWF0IGArMGAgdnMuIGAtMGAgYXMgbm90IGVxdWFsXG4gICAgICAgICAgOiAoYSA9PSAwID8gKDEgLyBhID09IDEgLyBiKSA6IGEgPT0gK2IpO1xuXG4gICAgICBjYXNlIHJlZ2V4cENsYXNzOlxuICAgICAgY2FzZSBzdHJpbmdDbGFzczpcbiAgICAgICAgLy8gY29lcmNlIHJlZ2V4ZXMgdG8gc3RyaW5ncyAoaHR0cDovL2VzNS5naXRodWIuY29tLyN4MTUuMTAuNi40KVxuICAgICAgICAvLyB0cmVhdCBzdHJpbmcgcHJpbWl0aXZlcyBhbmQgdGhlaXIgY29ycmVzcG9uZGluZyBvYmplY3QgaW5zdGFuY2VzIGFzIGVxdWFsXG4gICAgICAgIHJldHVybiBhID09IGIgKyAnJztcbiAgICB9XG4gICAgLy8gZXhpdCBlYXJseSwgaW4gb2xkZXIgYnJvd3NlcnMsIGlmIGBhYCBpcyBhcnJheS1saWtlIGJ1dCBub3QgYGJgXG4gICAgdmFyIGlzQXJyID0gY2xhc3NOYW1lID09IGFycmF5Q2xhc3MgfHwgY2xhc3NOYW1lID09IGFyZ3NDbGFzcztcbiAgICBpZiAobm9BcmdzQ2xhc3MgJiYgIWlzQXJyICYmIChpc0FyciA9IGlzQXJndW1lbnRzKGEpKSAmJiAhaXNBcmd1bWVudHMoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKCFpc0Fycikge1xuICAgICAgLy8gdW53cmFwIGFueSBgbG9kYXNoYCB3cmFwcGVkIHZhbHVlc1xuICAgICAgaWYgKGEuX193cmFwcGVkX18gfHwgYi5fX3dyYXBwZWRfXykge1xuICAgICAgICByZXR1cm4gaXNFcXVhbChhLl9fd3JhcHBlZF9fIHx8IGEsIGIuX193cmFwcGVkX18gfHwgYik7XG4gICAgICB9XG4gICAgICAvLyBleGl0IGZvciBmdW5jdGlvbnMgYW5kIERPTSBub2Rlc1xuICAgICAgaWYgKGNsYXNzTmFtZSAhPSBvYmplY3RDbGFzcyB8fCAobm9Ob2RlQ2xhc3MgJiYgKFxuICAgICAgICAgICh0eXBlb2YgYS50b1N0cmluZyAhPSAnZnVuY3Rpb24nICYmIHR5cGVvZiAoYSArICcnKSA9PSAnc3RyaW5nJykgfHxcbiAgICAgICAgICAodHlwZW9mIGIudG9TdHJpbmcgIT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgKGIgKyAnJykgPT0gJ3N0cmluZycpKSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgdmFyIGN0b3JBID0gYS5jb25zdHJ1Y3RvcixcbiAgICAgICAgICBjdG9yQiA9IGIuY29uc3RydWN0b3I7XG5cbiAgICAgIC8vIG5vbiBgT2JqZWN0YCBvYmplY3QgaW5zdGFuY2VzIHdpdGggZGlmZmVyZW50IGNvbnN0cnVjdG9ycyBhcmUgbm90IGVxdWFsXG4gICAgICBpZiAoY3RvckEgIT0gY3RvckIgJiYgIShcbiAgICAgICAgICAgIGlzRnVuY3Rpb24oY3RvckEpICYmIGN0b3JBIGluc3RhbmNlb2YgY3RvckEgJiZcbiAgICAgICAgICAgIGlzRnVuY3Rpb24oY3RvckIpICYmIGN0b3JCIGluc3RhbmNlb2YgY3RvckJcbiAgICAgICAgICApKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gYXNzdW1lIGN5Y2xpYyBzdHJ1Y3R1cmVzIGFyZSBlcXVhbFxuICAgIC8vIHRoZSBhbGdvcml0aG0gZm9yIGRldGVjdGluZyBjeWNsaWMgc3RydWN0dXJlcyBpcyBhZGFwdGVkIGZyb20gRVMgNS4xXG4gICAgLy8gc2VjdGlvbiAxNS4xMi4zLCBhYnN0cmFjdCBvcGVyYXRpb24gYEpPYCAoaHR0cDovL2VzNS5naXRodWIuY29tLyN4MTUuMTIuMylcbiAgICBzdGFja0EgfHwgKHN0YWNrQSA9IFtdKTtcbiAgICBzdGFja0IgfHwgKHN0YWNrQiA9IFtdKTtcblxuICAgIHZhciBsZW5ndGggPSBzdGFja0EubGVuZ3RoO1xuICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgaWYgKHN0YWNrQVtsZW5ndGhdID09IGEpIHtcbiAgICAgICAgcmV0dXJuIHN0YWNrQltsZW5ndGhdID09IGI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIHJlc3VsdCA9IHRydWUsXG4gICAgICAgIHNpemUgPSAwO1xuXG4gICAgLy8gYWRkIGBhYCBhbmQgYGJgIHRvIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0c1xuICAgIHN0YWNrQS5wdXNoKGEpO1xuICAgIHN0YWNrQi5wdXNoKGIpO1xuXG4gICAgLy8gcmVjdXJzaXZlbHkgY29tcGFyZSBvYmplY3RzIGFuZCBhcnJheXMgKHN1c2NlcHRpYmxlIHRvIGNhbGwgc3RhY2sgbGltaXRzKVxuICAgIGlmIChpc0Fycikge1xuICAgICAgLy8gY29tcGFyZSBsZW5ndGhzIHRvIGRldGVybWluZSBpZiBhIGRlZXAgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnlcbiAgICAgIHNpemUgPSBhLmxlbmd0aDtcbiAgICAgIHJlc3VsdCA9IHNpemUgPT0gYi5sZW5ndGg7XG5cbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgLy8gZGVlcCBjb21wYXJlIHRoZSBjb250ZW50cywgaWdub3Jpbmcgbm9uLW51bWVyaWMgcHJvcGVydGllc1xuICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgaWYgKCEocmVzdWx0ID0gaXNFcXVhbChhW3NpemVdLCBiW3NpemVdLCBzdGFja0EsIHN0YWNrQikpKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIC8vIGRlZXAgY29tcGFyZSBvYmplY3RzXG4gICAgZm9yICh2YXIga2V5IGluIGEpIHtcbiAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGEsIGtleSkpIHtcbiAgICAgICAgLy8gY291bnQgdGhlIG51bWJlciBvZiBwcm9wZXJ0aWVzLlxuICAgICAgICBzaXplKys7XG4gICAgICAgIC8vIGRlZXAgY29tcGFyZSBlYWNoIHByb3BlcnR5IHZhbHVlLlxuICAgICAgICBpZiAoIShoYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIGtleSkgJiYgaXNFcXVhbChhW2tleV0sIGJba2V5XSwgc3RhY2tBLCBzdGFja0IpKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBlbnN1cmUgYm90aCBvYmplY3RzIGhhdmUgdGhlIHNhbWUgbnVtYmVyIG9mIHByb3BlcnRpZXNcbiAgICBmb3IgKGtleSBpbiBiKSB7XG4gICAgICAvLyBUaGUgSlMgZW5naW5lIGluIEFkb2JlIHByb2R1Y3RzLCBsaWtlIEluRGVzaWduLCBoYXMgYSBidWcgdGhhdCBjYXVzZXNcbiAgICAgIC8vIGAhc2l6ZS0tYCB0byB0aHJvdyBhbiBlcnJvciBzbyBpdCBtdXN0IGJlIHdyYXBwZWQgaW4gcGFyZW50aGVzZXMuXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZG9jdW1lbnRjbG91ZC91bmRlcnNjb3JlL2lzc3Vlcy8zNTVcbiAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIGtleSkgJiYgIShzaXplLS0pKSB7XG4gICAgICAgIC8vIGBzaXplYCB3aWxsIGJlIGAtMWAgaWYgYGJgIGhhcyBtb3JlIHByb3BlcnRpZXMgdGhhbiBgYWBcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBoYW5kbGUgSlNjcmlwdCBbW0RvbnRFbnVtXV0gYnVnXG4gICAgaWYgKGhhc0RvbnRFbnVtQnVnKSB7XG4gICAgICB3aGlsZSAoKytpbmRleCA8IDcpIHtcbiAgICAgICAga2V5ID0gc2hhZG93ZWRbaW5kZXhdO1xuICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChhLCBrZXkpICYmXG4gICAgICAgICAgICAhKGhhc093blByb3BlcnR5LmNhbGwoYiwga2V5KSAmJiBpc0VxdWFsKGFba2V5XSwgYltrZXldLCBzdGFja0EsIHN0YWNrQikpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzLCBvciBjYW4gYmUgY29lcmNlZCB0bywgYSBmaW5pdGUgbnVtYmVyLlxuICAgKlxuICAgKiBOb3RlOiBUaGlzIGlzIG5vdCB0aGUgc2FtZSBhcyBuYXRpdmUgYGlzRmluaXRlYCwgd2hpY2ggd2lsbCByZXR1cm4gdHJ1ZSBmb3JcbiAgICogYm9vbGVhbnMgYW5kIGVtcHR5IHN0cmluZ3MuIFNlZSBodHRwOi8vZXM1LmdpdGh1Yi5jb20vI3gxNS4xLjIuNS5cbiAgICpcbiAgICogQGRlcHJlY2F0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhIGZpbml0ZSBudW1iZXIsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc0Zpbml0ZSgtMTAxKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmlzRmluaXRlKCcxMCcpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uaXNGaW5pdGUodHJ1ZSk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqXG4gICAqIF8uaXNGaW5pdGUoJycpO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiBfLmlzRmluaXRlKEluZmluaXR5KTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICovXG4gIGZ1bmN0aW9uIGlzRmluaXRlKHZhbHVlKSB7XG4gICAgcmV0dXJuIG5hdGl2ZUlzRmluaXRlKHZhbHVlKSAmJiAhbmF0aXZlSXNOYU4ocGFyc2VGbG9hdCh2YWx1ZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgZnVuY3Rpb24uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYSBmdW5jdGlvbiwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmlzRnVuY3Rpb24oXyk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdmdW5jdGlvbic7XG4gIH1cbiAgLy8gZmFsbGJhY2sgZm9yIG9sZGVyIHZlcnNpb25zIG9mIENocm9tZSBhbmQgU2FmYXJpXG4gIGlmIChpc0Z1bmN0aW9uKC94LykpIHtcbiAgICBpc0Z1bmN0aW9uID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBmdW5jQ2xhc3M7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgbGFuZ3VhZ2UgdHlwZSBvZiBPYmplY3QuXG4gICAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmlzT2JqZWN0KHt9KTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogXy5pc09iamVjdCgxKTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICovXG4gIGZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gICAgLy8gY2hlY2sgaWYgdGhlIHZhbHVlIGlzIHRoZSBFQ01BU2NyaXB0IGxhbmd1YWdlIHR5cGUgb2YgT2JqZWN0XG4gICAgLy8gaHR0cDovL2VzNS5naXRodWIuY29tLyN4OFxuICAgIC8vIGFuZCBhdm9pZCBhIFY4IGJ1Z1xuICAgIC8vIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTIyOTFcbiAgICByZXR1cm4gdmFsdWUgPyBvYmplY3RUeXBlc1t0eXBlb2YgdmFsdWVdIDogZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYE5hTmAuXG4gICAqXG4gICAqIE5vdGU6IFRoaXMgaXMgbm90IHRoZSBzYW1lIGFzIG5hdGl2ZSBgaXNOYU5gLCB3aGljaCB3aWxsIHJldHVybiB0cnVlIGZvclxuICAgKiBgdW5kZWZpbmVkYCBhbmQgb3RoZXIgdmFsdWVzLiBTZWUgaHR0cDovL2VzNS5naXRodWIuY29tLyN4MTUuMS4yLjQuXG4gICAqXG4gICAqIEBkZXByZWNhdGVkXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYE5hTmAsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc05hTihOYU4pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uaXNOYU4obmV3IE51bWJlcihOYU4pKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBpc05hTih1bmRlZmluZWQpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uaXNOYU4odW5kZWZpbmVkKTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICovXG4gIGZ1bmN0aW9uIGlzTmFOKHZhbHVlKSB7XG4gICAgLy8gYE5hTmAgYXMgYSBwcmltaXRpdmUgaXMgdGhlIG9ubHkgdmFsdWUgdGhhdCBpcyBub3QgZXF1YWwgdG8gaXRzZWxmXG4gICAgLy8gKHBlcmZvcm0gdGhlIFtbQ2xhc3NdXSBjaGVjayBmaXJzdCB0byBhdm9pZCBlcnJvcnMgd2l0aCBzb21lIGhvc3Qgb2JqZWN0cyBpbiBJRSlcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gbnVtYmVyQ2xhc3MgJiYgdmFsdWUgIT0gK3ZhbHVlXG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYG51bGxgLlxuICAgKlxuICAgKiBAZGVwcmVjYXRlZFxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGBudWxsYCwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmlzTnVsbChudWxsKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmlzTnVsbCh1bmRlZmluZWQpO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKi9cbiAgZnVuY3Rpb24gaXNOdWxsKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgbnVtYmVyLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGEgbnVtYmVyLCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNOdW1iZXIoOC40ICogNSk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGlzTnVtYmVyKHZhbHVlKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsdWUpID09IG51bWJlckNsYXNzO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBhIGdpdmVuIGB2YWx1ZWAgaXMgYW4gb2JqZWN0IGNyZWF0ZWQgYnkgdGhlIGBPYmplY3RgIGNvbnN0cnVjdG9yLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBwbGFpbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogZnVuY3Rpb24gU3Rvb2dlKG5hbWUsIGFnZSkge1xuICAgKiAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAqICAgdGhpcy5hZ2UgPSBhZ2U7XG4gICAqIH1cbiAgICpcbiAgICogXy5pc1BsYWluT2JqZWN0KG5ldyBTdG9vZ2UoJ21vZScsIDQwKSk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqXG4gICAqIF8uaXNQbGFpbk9iamVjdChbMSwgMiwgM10pO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiBfLmlzUGxhaW5PYmplY3QoeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfSk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIHZhciBpc1BsYWluT2JqZWN0ID0gIWdldFByb3RvdHlwZU9mID8gc2hpbUlzUGxhaW5PYmplY3QgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIGlmICghKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JykpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdmFyIHZhbHVlT2YgPSB2YWx1ZS52YWx1ZU9mLFxuICAgICAgICBvYmpQcm90byA9IHR5cGVvZiB2YWx1ZU9mID09ICdmdW5jdGlvbicgJiYgKG9ialByb3RvID0gZ2V0UHJvdG90eXBlT2YodmFsdWVPZikpICYmIGdldFByb3RvdHlwZU9mKG9ialByb3RvKTtcblxuICAgIHJldHVybiBvYmpQcm90b1xuICAgICAgPyB2YWx1ZSA9PSBvYmpQcm90byB8fCAoZ2V0UHJvdG90eXBlT2YodmFsdWUpID09IG9ialByb3RvICYmICFpc0FyZ3VtZW50cyh2YWx1ZSkpXG4gICAgICA6IHNoaW1Jc1BsYWluT2JqZWN0KHZhbHVlKTtcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSByZWd1bGFyIGV4cHJlc3Npb24uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYSByZWd1bGFyIGV4cHJlc3Npb24sIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc1JlZ0V4cCgvbW9lLyk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGlzUmVnRXhwKHZhbHVlKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsdWUpID09IHJlZ2V4cENsYXNzO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgc3RyaW5nLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGEgc3RyaW5nLCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNTdHJpbmcoJ21vZScpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc1N0cmluZyh2YWx1ZSkge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBzdHJpbmdDbGFzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBgdW5kZWZpbmVkYC5cbiAgICpcbiAgICogQGRlcHJlY2F0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBgdW5kZWZpbmVkYCwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmlzVW5kZWZpbmVkKHZvaWQgMCk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGlzVW5kZWZpbmVkKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSB1bmRlZmluZWQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhcnJheSBjb21wb3NlZCBvZiB0aGUgb3duIGVudW1lcmFibGUgcHJvcGVydHkgbmFtZXMgb2YgYG9iamVjdGAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGluc3BlY3QuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5rZXlzKHsgJ29uZSc6IDEsICd0d28nOiAyLCAndGhyZWUnOiAzIH0pO1xuICAgKiAvLyA9PiBbJ29uZScsICd0d28nLCAndGhyZWUnXSAob3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gICAqL1xuICB2YXIga2V5cyA9ICFuYXRpdmVLZXlzID8gc2hpbUtleXMgOiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAvLyBhdm9pZCBpdGVyYXRpbmcgb3ZlciB0aGUgYHByb3RvdHlwZWAgcHJvcGVydHlcbiAgICByZXR1cm4gdHlwZW9mIG9iamVjdCA9PSAnZnVuY3Rpb24nICYmIHByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwob2JqZWN0LCAncHJvdG90eXBlJylcbiAgICAgID8gc2hpbUtleXMob2JqZWN0KVxuICAgICAgOiAoaXNPYmplY3Qob2JqZWN0KSA/IG5hdGl2ZUtleXMob2JqZWN0KSA6IFtdKTtcbiAgfTtcblxuICAvKipcbiAgICogTWVyZ2VzIGVudW1lcmFibGUgcHJvcGVydGllcyBvZiB0aGUgc291cmNlIG9iamVjdChzKSBpbnRvIHRoZSBgZGVzdGluYXRpb25gXG4gICAqIG9iamVjdC4gU3Vic2VxdWVudCBzb3VyY2VzIHdpbGwgb3ZlcndyaXRlIHByb3BlcnkgYXNzaWdubWVudHMgb2YgcHJldmlvdXNcbiAgICogc291cmNlcy5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbc291cmNlMSwgc291cmNlMiwgLi4uXSBUaGUgc291cmNlIG9iamVjdHMuXG4gICAqIEBwYXJhbS0ge09iamVjdH0gW2luZGljYXRvcl0gSW50ZXJuYWxseSB1c2VkIHRvIGluZGljYXRlIHRoYXQgdGhlIGBzdGFja2BcbiAgICogIGFyZ3VtZW50IGlzIGFuIGFycmF5IG9mIHRyYXZlcnNlZCBvYmplY3RzIGluc3RlYWQgb2YgYW5vdGhlciBzb3VyY2Ugb2JqZWN0LlxuICAgKiBAcGFyYW0tIHtBcnJheX0gW3N0YWNrQT1bXV0gSW50ZXJuYWxseSB1c2VkIHRvIHRyYWNrIHRyYXZlcnNlZCBzb3VyY2Ugb2JqZWN0cy5cbiAgICogQHBhcmFtLSB7QXJyYXl9IFtzdGFja0I9W11dIEludGVybmFsbHkgdXNlZCB0byBhc3NvY2lhdGUgdmFsdWVzIHdpdGggdGhlaXJcbiAgICogIHNvdXJjZSBjb3VudGVycGFydHMuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIHN0b29nZXMgPSBbXG4gICAqICAgeyAnbmFtZSc6ICdtb2UnIH0sXG4gICAqICAgeyAnbmFtZSc6ICdsYXJyeScgfVxuICAgKiBdO1xuICAgKlxuICAgKiB2YXIgYWdlcyA9IFtcbiAgICogICB7ICdhZ2UnOiA0MCB9LFxuICAgKiAgIHsgJ2FnZSc6IDUwIH1cbiAgICogXTtcbiAgICpcbiAgICogXy5tZXJnZShzdG9vZ2VzLCBhZ2VzKTtcbiAgICogLy8gPT4gW3sgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH0sIHsgJ25hbWUnOiAnbGFycnknLCAnYWdlJzogNTAgfV1cbiAgICovXG4gIGZ1bmN0aW9uIG1lcmdlKG9iamVjdCwgc291cmNlLCBpbmRpY2F0b3IpIHtcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgaW5kZXggPSAwLFxuICAgICAgICBsZW5ndGggPSAyLFxuICAgICAgICBzdGFja0EgPSBhcmdzWzNdLFxuICAgICAgICBzdGFja0IgPSBhcmdzWzRdO1xuXG4gICAgaWYgKGluZGljYXRvciAhPT0gb2JqZWN0UmVmKSB7XG4gICAgICBzdGFja0EgPSBbXTtcbiAgICAgIHN0YWNrQiA9IFtdO1xuICAgICAgbGVuZ3RoID0gYXJncy5sZW5ndGg7XG4gICAgfVxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICBmb3JPd24oYXJnc1tpbmRleF0sIGZ1bmN0aW9uKHNvdXJjZSwga2V5KSB7XG4gICAgICAgIHZhciBmb3VuZCwgaXNBcnIsIHZhbHVlO1xuICAgICAgICBpZiAoc291cmNlICYmICgoaXNBcnIgPSBpc0FycmF5KHNvdXJjZSkpIHx8IGlzUGxhaW5PYmplY3Qoc291cmNlKSkpIHtcbiAgICAgICAgICAvLyBhdm9pZCBtZXJnaW5nIHByZXZpb3VzbHkgbWVyZ2VkIGN5Y2xpYyBzb3VyY2VzXG4gICAgICAgICAgdmFyIHN0YWNrTGVuZ3RoID0gc3RhY2tBLmxlbmd0aDtcbiAgICAgICAgICB3aGlsZSAoc3RhY2tMZW5ndGgtLSkge1xuICAgICAgICAgICAgZm91bmQgPSBzdGFja0Fbc3RhY2tMZW5ndGhdID09IHNvdXJjZTtcbiAgICAgICAgICAgIGlmIChmb3VuZCkge1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGZvdW5kKSB7XG4gICAgICAgICAgICBvYmplY3Rba2V5XSA9IHN0YWNrQltzdGFja0xlbmd0aF07XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gYWRkIGBzb3VyY2VgIGFuZCBhc3NvY2lhdGVkIGB2YWx1ZWAgdG8gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzXG4gICAgICAgICAgICBzdGFja0EucHVzaChzb3VyY2UpO1xuICAgICAgICAgICAgc3RhY2tCLnB1c2godmFsdWUgPSAodmFsdWUgPSBvYmplY3Rba2V5XSwgaXNBcnIpXG4gICAgICAgICAgICAgID8gKGlzQXJyYXkodmFsdWUpID8gdmFsdWUgOiBbXSlcbiAgICAgICAgICAgICAgOiAoaXNQbGFpbk9iamVjdCh2YWx1ZSkgPyB2YWx1ZSA6IHt9KVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIC8vIHJlY3Vyc2l2ZWx5IG1lcmdlIG9iamVjdHMgYW5kIGFycmF5cyAoc3VzY2VwdGlibGUgdG8gY2FsbCBzdGFjayBsaW1pdHMpXG4gICAgICAgICAgICBvYmplY3Rba2V5XSA9IG1lcmdlKHZhbHVlLCBzb3VyY2UsIG9iamVjdFJlZiwgc3RhY2tBLCBzdGFja0IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2UgIT0gbnVsbCkge1xuICAgICAgICAgIG9iamVjdFtrZXldID0gc291cmNlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgc2hhbGxvdyBjbG9uZSBvZiBgb2JqZWN0YCBleGNsdWRpbmcgdGhlIHNwZWNpZmllZCBwcm9wZXJ0aWVzLlxuICAgKiBQcm9wZXJ0eSBuYW1lcyBtYXkgYmUgc3BlY2lmaWVkIGFzIGluZGl2aWR1YWwgYXJndW1lbnRzIG9yIGFzIGFycmF5cyBvZlxuICAgKiBwcm9wZXJ0eSBuYW1lcy4gSWYgYGNhbGxiYWNrYCBpcyBwYXNzZWQsIGl0IHdpbGwgYmUgZXhlY3V0ZWQgZm9yIGVhY2ggcHJvcGVydHlcbiAgICogaW4gdGhlIGBvYmplY3RgLCBvbWl0dGluZyB0aGUgcHJvcGVydGllcyBgY2FsbGJhY2tgIHJldHVybnMgdHJ1dGh5IGZvci4gVGhlXG4gICAqIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGtleSwgb2JqZWN0KS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBzb3VyY2Ugb2JqZWN0LlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufFN0cmluZ30gY2FsbGJhY2t8W3Byb3AxLCBwcm9wMiwgLi4uXSBUaGUgcHJvcGVydGllcyB0byBvbWl0XG4gICAqICBvciB0aGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBvYmplY3Qgd2l0aG91dCB0aGUgb21pdHRlZCBwcm9wZXJ0aWVzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLm9taXQoeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAsICd1c2VyaWQnOiAnbW9lMScgfSwgJ3VzZXJpZCcpO1xuICAgKiAvLyA9PiB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9XG4gICAqXG4gICAqIF8ub21pdCh7ICduYW1lJzogJ21vZScsICdfaGludCc6ICdrbnVja2xlaGVhZCcsICdfc2VlZCc6ICc5NmM0ZWInIH0sIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICogICByZXR1cm4ga2V5LmNoYXJBdCgwKSA9PSAnXyc7XG4gICAqIH0pO1xuICAgKiAvLyA9PiB7ICduYW1lJzogJ21vZScgfVxuICAgKi9cbiAgZnVuY3Rpb24gb21pdChvYmplY3QsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIGlzRnVuYyA9IHR5cGVvZiBjYWxsYmFjayA9PSAnZnVuY3Rpb24nLFxuICAgICAgICByZXN1bHQgPSB7fTtcblxuICAgIGlmIChpc0Z1bmMpIHtcbiAgICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcHJvcHMgPSBjb25jYXQuYXBwbHkoYXJyYXlSZWYsIGFyZ3VtZW50cyk7XG4gICAgfVxuICAgIGZvckluKG9iamVjdCwgZnVuY3Rpb24odmFsdWUsIGtleSwgb2JqZWN0KSB7XG4gICAgICBpZiAoaXNGdW5jXG4gICAgICAgICAgICA/ICFjYWxsYmFjayh2YWx1ZSwga2V5LCBvYmplY3QpXG4gICAgICAgICAgICA6IGluZGV4T2YocHJvcHMsIGtleSwgMSkgPCAwXG4gICAgICAgICAgKSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgdHdvIGRpbWVuc2lvbmFsIGFycmF5IG9mIHRoZSBnaXZlbiBvYmplY3QncyBrZXktdmFsdWUgcGFpcnMsXG4gICAqIGkuZS4gYFtba2V5MSwgdmFsdWUxXSwgW2tleTIsIHZhbHVlMl1dYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW5zcGVjdC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIG5ldyBhcnJheSBvZiBrZXktdmFsdWUgcGFpcnMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ucGFpcnMoeyAnbW9lJzogMzAsICdsYXJyeSc6IDQwLCAnY3VybHknOiA1MCB9KTtcbiAgICogLy8gPT4gW1snbW9lJywgMzBdLCBbJ2xhcnJ5JywgNDBdLCBbJ2N1cmx5JywgNTBdXSAob3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gICAqL1xuICBmdW5jdGlvbiBwYWlycyhvYmplY3QpIHtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgZm9yT3duKG9iamVjdCwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgcmVzdWx0LnB1c2goW2tleSwgdmFsdWVdKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBzaGFsbG93IGNsb25lIG9mIGBvYmplY3RgIGNvbXBvc2VkIG9mIHRoZSBzcGVjaWZpZWQgcHJvcGVydGllcy5cbiAgICogUHJvcGVydHkgbmFtZXMgbWF5IGJlIHNwZWNpZmllZCBhcyBpbmRpdmlkdWFsIGFyZ3VtZW50cyBvciBhcyBhcnJheXMgb2ZcbiAgICogcHJvcGVydHkgbmFtZXMuIElmIGBjYWxsYmFja2AgaXMgcGFzc2VkLCBpdCB3aWxsIGJlIGV4ZWN1dGVkIGZvciBlYWNoIHByb3BlcnR5XG4gICAqIGluIHRoZSBgb2JqZWN0YCwgcGlja2luZyB0aGUgcHJvcGVydGllcyBgY2FsbGJhY2tgIHJldHVybnMgdHJ1dGh5IGZvci4gVGhlXG4gICAqIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGtleSwgb2JqZWN0KS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBzb3VyY2Ugb2JqZWN0LlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufFN0cmluZ30gY2FsbGJhY2t8W3Byb3AxLCBwcm9wMiwgLi4uXSBUaGUgcHJvcGVydGllcyB0byBwaWNrXG4gICAqICBvciB0aGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBvYmplY3QgY29tcG9zZWQgb2YgdGhlIHBpY2tlZCBwcm9wZXJ0aWVzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnBpY2soeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAsICd1c2VyaWQnOiAnbW9lMScgfSwgJ25hbWUnLCAnYWdlJyk7XG4gICAqIC8vID0+IHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH1cbiAgICpcbiAgICogXy5waWNrKHsgJ25hbWUnOiAnbW9lJywgJ19oaW50JzogJ2tudWNrbGVoZWFkJywgJ19zZWVkJzogJzk2YzRlYicgfSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgKiAgIHJldHVybiBrZXkuY2hhckF0KDApICE9ICdfJztcbiAgICogfSk7XG4gICAqIC8vID0+IHsgJ25hbWUnOiAnbW9lJyB9XG4gICAqL1xuICBmdW5jdGlvbiBwaWNrKG9iamVjdCwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKSB7XG4gICAgICB2YXIgaW5kZXggPSAwLFxuICAgICAgICAgIHByb3BzID0gY29uY2F0LmFwcGx5KGFycmF5UmVmLCBhcmd1bWVudHMpLFxuICAgICAgICAgIGxlbmd0aCA9IHByb3BzLmxlbmd0aDtcblxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgdmFyIGtleSA9IHByb3BzW2luZGV4XTtcbiAgICAgICAgaWYgKGtleSBpbiBvYmplY3QpIHtcbiAgICAgICAgICByZXN1bHRba2V5XSA9IG9iamVjdFtrZXldO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgICAgZm9ySW4ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5LCBvYmplY3QpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBrZXksIG9iamVjdCkpIHtcbiAgICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFycmF5IGNvbXBvc2VkIG9mIHRoZSBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSB2YWx1ZXMgb2YgYG9iamVjdGAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGluc3BlY3QuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBwcm9wZXJ0eSB2YWx1ZXMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8udmFsdWVzKHsgJ29uZSc6IDEsICd0d28nOiAyLCAndGhyZWUnOiAzIH0pO1xuICAgKiAvLyA9PiBbMSwgMiwgM11cbiAgICovXG4gIGZ1bmN0aW9uIHZhbHVlcyhvYmplY3QpIHtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgZm9yT3duKG9iamVjdCwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBhIGdpdmVuIGB0YXJnZXRgIGVsZW1lbnQgaXMgcHJlc2VudCBpbiBhIGBjb2xsZWN0aW9uYCB1c2luZyBzdHJpY3RcbiAgICogZXF1YWxpdHkgZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLiBJZiBgZnJvbUluZGV4YCBpcyBuZWdhdGl2ZSwgaXQgaXMgdXNlZFxuICAgKiBhcyB0aGUgb2Zmc2V0IGZyb20gdGhlIGVuZCBvZiB0aGUgY29sbGVjdGlvbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgaW5jbHVkZVxuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtNaXhlZH0gdGFyZ2V0IFRoZSB2YWx1ZSB0byBjaGVjayBmb3IuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbZnJvbUluZGV4PTBdIFRoZSBpbmRleCB0byBzZWFyY2ggZnJvbS5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdGFyZ2V0YCBlbGVtZW50IGlzIGZvdW5kLCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uY29udGFpbnMoWzEsIDIsIDNdLCAxKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmNvbnRhaW5zKFsxLCAyLCAzXSwgMSwgMik7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqXG4gICAqIF8uY29udGFpbnMoeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfSwgJ21vZScpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uY29udGFpbnMoJ2N1cmx5JywgJ3VyJyk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGNvbnRhaW5zKGNvbGxlY3Rpb24sIHRhcmdldCwgZnJvbUluZGV4KSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDA7XG5cbiAgICBmcm9tSW5kZXggPSAoZnJvbUluZGV4IDwgMCA/IG5hdGl2ZU1heCgwLCBsZW5ndGggKyBmcm9tSW5kZXgpIDogZnJvbUluZGV4KSB8fCAwO1xuICAgIGlmICh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gKGlzU3RyaW5nKGNvbGxlY3Rpb24pXG4gICAgICAgID8gY29sbGVjdGlvbi5pbmRleE9mKHRhcmdldCwgZnJvbUluZGV4KVxuICAgICAgICA6IGluZGV4T2YoY29sbGVjdGlvbiwgdGFyZ2V0LCBmcm9tSW5kZXgpXG4gICAgICApID4gLTE7XG4gICAgfVxuICAgIHJldHVybiBzb21lKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gKytpbmRleCA+PSBmcm9tSW5kZXggJiYgdmFsdWUgPT09IHRhcmdldDtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIG9iamVjdCBjb21wb3NlZCBvZiBrZXlzIHJldHVybmVkIGZyb20gcnVubmluZyBlYWNoIGVsZW1lbnQgb2ZcbiAgICogYGNvbGxlY3Rpb25gIHRocm91Z2ggYSBgY2FsbGJhY2tgLiBUaGUgY29ycmVzcG9uZGluZyB2YWx1ZSBvZiBlYWNoIGtleSBpc1xuICAgKiB0aGUgbnVtYmVyIG9mIHRpbWVzIHRoZSBrZXkgd2FzIHJldHVybmVkIGJ5IGBjYWxsYmFja2AuIFRoZSBgY2FsbGJhY2tgIGlzXG4gICAqIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLlxuICAgKiBUaGUgYGNhbGxiYWNrYCBhcmd1bWVudCBtYXkgYWxzbyBiZSB0aGUgbmFtZSBvZiBhIHByb3BlcnR5IHRvIGNvdW50IGJ5IChlLmcuICdsZW5ndGgnKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxTdHJpbmd9IGNhbGxiYWNrfHByb3BlcnR5IFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvblxuICAgKiAgb3IgcHJvcGVydHkgbmFtZSB0byBjb3VudCBieS5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBjb21wb3NlZCBhZ2dyZWdhdGUgb2JqZWN0LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmNvdW50QnkoWzQuMywgNi4xLCA2LjRdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIE1hdGguZmxvb3IobnVtKTsgfSk7XG4gICAqIC8vID0+IHsgJzQnOiAxLCAnNic6IDIgfVxuICAgKlxuICAgKiBfLmNvdW50QnkoWzQuMywgNi4xLCA2LjRdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIHRoaXMuZmxvb3IobnVtKTsgfSwgTWF0aCk7XG4gICAqIC8vID0+IHsgJzQnOiAxLCAnNic6IDIgfVxuICAgKlxuICAgKiBfLmNvdW50QnkoWydvbmUnLCAndHdvJywgJ3RocmVlJ10sICdsZW5ndGgnKTtcbiAgICogLy8gPT4geyAnMyc6IDIsICc1JzogMSB9XG4gICAqL1xuICBmdW5jdGlvbiBjb3VudEJ5KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGtleSwgY29sbGVjdGlvbikge1xuICAgICAga2V5ID0gY2FsbGJhY2sodmFsdWUsIGtleSwgY29sbGVjdGlvbik7XG4gICAgICAoaGFzT3duUHJvcGVydHkuY2FsbChyZXN1bHQsIGtleSkgPyByZXN1bHRba2V5XSsrIDogcmVzdWx0W2tleV0gPSAxKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGUgYGNhbGxiYWNrYCByZXR1cm5zIGEgdHJ1dGh5IHZhbHVlIGZvciAqKmFsbCoqIGVsZW1lbnRzIG9mIGFcbiAgICogYGNvbGxlY3Rpb25gLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZVxuICAgKiBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgYWxsXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYWxsIGVsZW1lbnRzIHBhc3MgdGhlIGNhbGxiYWNrIGNoZWNrLFxuICAgKiAgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmV2ZXJ5KFt0cnVlLCAxLCBudWxsLCAneWVzJ10sIEJvb2xlYW4pO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKi9cbiAgZnVuY3Rpb24gZXZlcnkoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcbiAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcblxuICAgIGlmIChpc0FycmF5KGNvbGxlY3Rpb24pKSB7XG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uLmxlbmd0aDtcblxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgaWYgKCEocmVzdWx0ID0gISFjYWxsYmFjayhjb2xsZWN0aW9uW2luZGV4XSwgaW5kZXgsIGNvbGxlY3Rpb24pKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgIHJldHVybiAocmVzdWx0ID0gISFjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4YW1pbmVzIGVhY2ggZWxlbWVudCBpbiBhIGBjb2xsZWN0aW9uYCwgcmV0dXJuaW5nIGFuIGFycmF5IG9mIGFsbCBlbGVtZW50c1xuICAgKiB0aGUgYGNhbGxiYWNrYCByZXR1cm5zIHRydXRoeSBmb3IuIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmRcbiAgICogaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBhbGlhcyBzZWxlY3RcbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBlbGVtZW50cyB0aGF0IHBhc3NlZCB0aGUgY2FsbGJhY2sgY2hlY2suXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBldmVucyA9IF8uZmlsdGVyKFsxLCAyLCAzLCA0LCA1LCA2XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gJSAyID09IDA7IH0pO1xuICAgKiAvLyA9PiBbMiwgNCwgNl1cbiAgICovXG4gIGZ1bmN0aW9uIGZpbHRlcihjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpIHtcbiAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogRXhhbWluZXMgZWFjaCBlbGVtZW50IGluIGEgYGNvbGxlY3Rpb25gLCByZXR1cm5pbmcgdGhlIGZpcnN0IG9uZSB0aGUgYGNhbGxiYWNrYFxuICAgKiByZXR1cm5zIHRydXRoeSBmb3IuIFRoZSBmdW5jdGlvbiByZXR1cm5zIGFzIHNvb24gYXMgaXQgZmluZHMgYW4gYWNjZXB0YWJsZVxuICAgKiBlbGVtZW50LCBhbmQgZG9lcyBub3QgaXRlcmF0ZSBvdmVyIHRoZSBlbnRpcmUgYGNvbGxlY3Rpb25gLiBUaGUgYGNhbGxiYWNrYCBpc1xuICAgKiBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgZGV0ZWN0XG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSBlbGVtZW50IHRoYXQgcGFzc2VkIHRoZSBjYWxsYmFjayBjaGVjayxcbiAgICogIGVsc2UgYHVuZGVmaW5lZGAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBldmVuID0gXy5maW5kKFsxLCAyLCAzLCA0LCA1LCA2XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gJSAyID09IDA7IH0pO1xuICAgKiAvLyA9PiAyXG4gICAqL1xuICBmdW5jdGlvbiBmaW5kKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpIHtcbiAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEl0ZXJhdGVzIG92ZXIgYSBgY29sbGVjdGlvbmAsIGV4ZWN1dGluZyB0aGUgYGNhbGxiYWNrYCBmb3IgZWFjaCBlbGVtZW50IGluXG4gICAqIHRoZSBgY29sbGVjdGlvbmAuIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlXG4gICAqIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLiBDYWxsYmFja3MgbWF5IGV4aXQgaXRlcmF0aW9uIGVhcmx5XG4gICAqIGJ5IGV4cGxpY2l0bHkgcmV0dXJuaW5nIGBmYWxzZWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIGVhY2hcbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7QXJyYXl8T2JqZWN0fFN0cmluZ30gUmV0dXJucyBgY29sbGVjdGlvbmAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8oWzEsIDIsIDNdKS5mb3JFYWNoKGFsZXJ0KS5qb2luKCcsJyk7XG4gICAqIC8vID0+IGFsZXJ0cyBlYWNoIG51bWJlciBhbmQgcmV0dXJucyAnMSwyLDMnXG4gICAqXG4gICAqIF8uZm9yRWFjaCh7ICdvbmUnOiAxLCAndHdvJzogMiwgJ3RocmVlJzogMyB9LCBhbGVydCk7XG4gICAqIC8vID0+IGFsZXJ0cyBlYWNoIG51bWJlciAob3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gICAqL1xuICB2YXIgZm9yRWFjaCA9IGNyZWF0ZUl0ZXJhdG9yKGZvckVhY2hJdGVyYXRvck9wdGlvbnMpO1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIG9iamVjdCBjb21wb3NlZCBvZiBrZXlzIHJldHVybmVkIGZyb20gcnVubmluZyBlYWNoIGVsZW1lbnQgb2ZcbiAgICogYGNvbGxlY3Rpb25gIHRocm91Z2ggYSBgY2FsbGJhY2tgLiBUaGUgY29ycmVzcG9uZGluZyB2YWx1ZSBvZiBlYWNoIGtleSBpcyBhblxuICAgKiBhcnJheSBvZiBlbGVtZW50cyBwYXNzZWQgdG8gYGNhbGxiYWNrYCB0aGF0IHJldHVybmVkIHRoZSBrZXkuIFRoZSBgY2FsbGJhY2tgXG4gICAqIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLlxuICAgKiBUaGUgYGNhbGxiYWNrYCBhcmd1bWVudCBtYXkgYWxzbyBiZSB0aGUgbmFtZSBvZiBhIHByb3BlcnR5IHRvIGdyb3VwIGJ5IChlLmcuICdsZW5ndGgnKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxTdHJpbmd9IGNhbGxiYWNrfHByb3BlcnR5IFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvblxuICAgKiAgb3IgcHJvcGVydHkgbmFtZSB0byBncm91cCBieS5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBjb21wb3NlZCBhZ2dyZWdhdGUgb2JqZWN0LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmdyb3VwQnkoWzQuMiwgNi4xLCA2LjRdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIE1hdGguZmxvb3IobnVtKTsgfSk7XG4gICAqIC8vID0+IHsgJzQnOiBbNC4yXSwgJzYnOiBbNi4xLCA2LjRdIH1cbiAgICpcbiAgICogXy5ncm91cEJ5KFs0LjIsIDYuMSwgNi40XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiB0aGlzLmZsb29yKG51bSk7IH0sIE1hdGgpO1xuICAgKiAvLyA9PiB7ICc0JzogWzQuMl0sICc2JzogWzYuMSwgNi40XSB9XG4gICAqXG4gICAqIF8uZ3JvdXBCeShbJ29uZScsICd0d28nLCAndGhyZWUnXSwgJ2xlbmd0aCcpO1xuICAgKiAvLyA9PiB7ICczJzogWydvbmUnLCAndHdvJ10sICc1JzogWyd0aHJlZSddIH1cbiAgICovXG4gIGZ1bmN0aW9uIGdyb3VwQnkoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKSB7XG4gICAgICBrZXkgPSBjYWxsYmFjayh2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKTtcbiAgICAgIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHJlc3VsdCwga2V5KSA/IHJlc3VsdFtrZXldIDogcmVzdWx0W2tleV0gPSBbXSkucHVzaCh2YWx1ZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBtZXRob2QgbmFtZWQgYnkgYG1ldGhvZE5hbWVgIG9uIGVhY2ggZWxlbWVudCBpbiB0aGUgYGNvbGxlY3Rpb25gLFxuICAgKiByZXR1cm5pbmcgYW4gYXJyYXkgb2YgdGhlIHJlc3VsdHMgb2YgZWFjaCBpbnZva2VkIG1ldGhvZC4gQWRkaXRpb25hbCBhcmd1bWVudHNcbiAgICogd2lsbCBiZSBwYXNzZWQgdG8gZWFjaCBpbnZva2VkIG1ldGhvZC4gSWYgYG1ldGhvZE5hbWVgIGlzIGEgZnVuY3Rpb24gaXQgd2lsbFxuICAgKiBiZSBpbnZva2VkIGZvciwgYW5kIGB0aGlzYCBib3VuZCB0bywgZWFjaCBlbGVtZW50IGluIHRoZSBgY29sbGVjdGlvbmAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258U3RyaW5nfSBtZXRob2ROYW1lIFRoZSBuYW1lIG9mIHRoZSBtZXRob2QgdG8gaW52b2tlIG9yXG4gICAqICB0aGUgZnVuY3Rpb24gaW52b2tlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbYXJnMSwgYXJnMiwgLi4uXSBBcmd1bWVudHMgdG8gaW52b2tlIHRoZSBtZXRob2Qgd2l0aC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHRoZSByZXN1bHRzIG9mIGVhY2ggaW52b2tlZCBtZXRob2QuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaW52b2tlKFtbNSwgMSwgN10sIFszLCAyLCAxXV0sICdzb3J0Jyk7XG4gICAqIC8vID0+IFtbMSwgNSwgN10sIFsxLCAyLCAzXV1cbiAgICpcbiAgICogXy5pbnZva2UoWzEyMywgNDU2XSwgU3RyaW5nLnByb3RvdHlwZS5zcGxpdCwgJycpO1xuICAgKiAvLyA9PiBbWycxJywgJzInLCAnMyddLCBbJzQnLCAnNScsICc2J11dXG4gICAqL1xuICBmdW5jdGlvbiBpbnZva2UoY29sbGVjdGlvbiwgbWV0aG9kTmFtZSkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpLFxuICAgICAgICBpc0Z1bmMgPSB0eXBlb2YgbWV0aG9kTmFtZSA9PSAnZnVuY3Rpb24nLFxuICAgICAgICByZXN1bHQgPSBbXTtcblxuICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJlc3VsdC5wdXNoKChpc0Z1bmMgPyBtZXRob2ROYW1lIDogdmFsdWVbbWV0aG9kTmFtZV0pLmFwcGx5KHZhbHVlLCBhcmdzKSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFycmF5IG9mIHZhbHVlcyBieSBydW5uaW5nIGVhY2ggZWxlbWVudCBpbiB0aGUgYGNvbGxlY3Rpb25gXG4gICAqIHRocm91Z2ggYSBgY2FsbGJhY2tgLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aFxuICAgKiB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgY29sbGVjdFxuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHRoZSByZXN1bHRzIG9mIGVhY2ggYGNhbGxiYWNrYCBleGVjdXRpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ubWFwKFsxLCAyLCAzXSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gKiAzOyB9KTtcbiAgICogLy8gPT4gWzMsIDYsIDldXG4gICAqXG4gICAqIF8ubWFwKHsgJ29uZSc6IDEsICd0d28nOiAyLCAndGhyZWUnOiAzIH0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gbnVtICogMzsgfSk7XG4gICAqIC8vID0+IFszLCA2LCA5XSAob3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gICAqL1xuICBmdW5jdGlvbiBtYXAoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMCxcbiAgICAgICAgcmVzdWx0ID0gQXJyYXkodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJyA/IGxlbmd0aCA6IDApO1xuXG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgaWYgKGlzQXJyYXkoY29sbGVjdGlvbikpIHtcbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSBjYWxsYmFjayhjb2xsZWN0aW9uW2luZGV4XSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBrZXksIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmVzdWx0WysraW5kZXhdID0gY2FsbGJhY2sodmFsdWUsIGtleSwgY29sbGVjdGlvbik7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIG1heGltdW0gdmFsdWUgb2YgYW4gYGFycmF5YC4gSWYgYGNhbGxiYWNrYCBpcyBwYXNzZWQsXG4gICAqIGl0IHdpbGwgYmUgZXhlY3V0ZWQgZm9yIGVhY2ggdmFsdWUgaW4gdGhlIGBhcnJheWAgdG8gZ2VuZXJhdGUgdGhlXG4gICAqIGNyaXRlcmlvbiBieSB3aGljaCB0aGUgdmFsdWUgaXMgcmFua2VkLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0b1xuICAgKiBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgdGhlIG1heGltdW0gdmFsdWUuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBzdG9vZ2VzID0gW1xuICAgKiAgIHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH0sXG4gICAqICAgeyAnbmFtZSc6ICdsYXJyeScsICdhZ2UnOiA1MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnY3VybHknLCAnYWdlJzogNjAgfVxuICAgKiBdO1xuICAgKlxuICAgKiBfLm1heChzdG9vZ2VzLCBmdW5jdGlvbihzdG9vZ2UpIHsgcmV0dXJuIHN0b29nZS5hZ2U7IH0pO1xuICAgKiAvLyA9PiB7ICduYW1lJzogJ2N1cmx5JywgJ2FnZSc6IDYwIH07XG4gICAqL1xuICBmdW5jdGlvbiBtYXgoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgY29tcHV0ZWQgPSAtSW5maW5pdHksXG4gICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDAsXG4gICAgICAgIHJlc3VsdCA9IGNvbXB1dGVkO1xuXG4gICAgaWYgKGNhbGxiYWNrIHx8ICFpc0FycmF5KGNvbGxlY3Rpb24pKSB7XG4gICAgICBjYWxsYmFjayA9ICFjYWxsYmFjayAmJiBpc1N0cmluZyhjb2xsZWN0aW9uKVxuICAgICAgICA/IGNoYXJBdENhbGxiYWNrXG4gICAgICAgIDogY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuXG4gICAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICB2YXIgY3VycmVudCA9IGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICAgIGlmIChjdXJyZW50ID4gY29tcHV0ZWQpIHtcbiAgICAgICAgICBjb21wdXRlZCA9IGN1cnJlbnQ7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICBpZiAoY29sbGVjdGlvbltpbmRleF0gPiByZXN1bHQpIHtcbiAgICAgICAgICByZXN1bHQgPSBjb2xsZWN0aW9uW2luZGV4XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgbWluaW11bSB2YWx1ZSBvZiBhbiBgYXJyYXlgLiBJZiBgY2FsbGJhY2tgIGlzIHBhc3NlZCxcbiAgICogaXQgd2lsbCBiZSBleGVjdXRlZCBmb3IgZWFjaCB2YWx1ZSBpbiB0aGUgYGFycmF5YCB0byBnZW5lcmF0ZSB0aGVcbiAgICogY3JpdGVyaW9uIGJ5IHdoaWNoIHRoZSB2YWx1ZSBpcyByYW5rZWQuIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYFxuICAgKiBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgbWluaW11bSB2YWx1ZS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5taW4oWzEwLCA1LCAxMDAsIDIsIDEwMDBdKTtcbiAgICogLy8gPT4gMlxuICAgKi9cbiAgZnVuY3Rpb24gbWluKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIGNvbXB1dGVkID0gSW5maW5pdHksXG4gICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDAsXG4gICAgICAgIHJlc3VsdCA9IGNvbXB1dGVkO1xuXG4gICAgaWYgKGNhbGxiYWNrIHx8ICFpc0FycmF5KGNvbGxlY3Rpb24pKSB7XG4gICAgICBjYWxsYmFjayA9ICFjYWxsYmFjayAmJiBpc1N0cmluZyhjb2xsZWN0aW9uKVxuICAgICAgICA/IGNoYXJBdENhbGxiYWNrXG4gICAgICAgIDogY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuXG4gICAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICB2YXIgY3VycmVudCA9IGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICAgIGlmIChjdXJyZW50IDwgY29tcHV0ZWQpIHtcbiAgICAgICAgICBjb21wdXRlZCA9IGN1cnJlbnQ7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICBpZiAoY29sbGVjdGlvbltpbmRleF0gPCByZXN1bHQpIHtcbiAgICAgICAgICByZXN1bHQgPSBjb2xsZWN0aW9uW2luZGV4XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgdmFsdWUgb2YgYSBzcGVjaWZpZWQgcHJvcGVydHkgZnJvbSBhbGwgZWxlbWVudHMgaW5cbiAgICogdGhlIGBjb2xsZWN0aW9uYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5IFRoZSBwcm9wZXJ0eSB0byBwbHVjay5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHByb3BlcnR5IHZhbHVlcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIHN0b29nZXMgPSBbXG4gICAqICAgeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfSxcbiAgICogICB7ICduYW1lJzogJ2xhcnJ5JywgJ2FnZSc6IDUwIH0sXG4gICAqICAgeyAnbmFtZSc6ICdjdXJseScsICdhZ2UnOiA2MCB9XG4gICAqIF07XG4gICAqXG4gICAqIF8ucGx1Y2soc3Rvb2dlcywgJ25hbWUnKTtcbiAgICogLy8gPT4gWydtb2UnLCAnbGFycnknLCAnY3VybHknXVxuICAgKi9cbiAgZnVuY3Rpb24gcGx1Y2soY29sbGVjdGlvbiwgcHJvcGVydHkpIHtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmVzdWx0LnB1c2godmFsdWVbcHJvcGVydHldKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEJvaWxzIGRvd24gYSBgY29sbGVjdGlvbmAgdG8gYSBzaW5nbGUgdmFsdWUuIFRoZSBpbml0aWFsIHN0YXRlIG9mIHRoZVxuICAgKiByZWR1Y3Rpb24gaXMgYGFjY3VtdWxhdG9yYCBhbmQgZWFjaCBzdWNjZXNzaXZlIHN0ZXAgb2YgaXQgc2hvdWxkIGJlIHJldHVybmVkXG4gICAqIGJ5IHRoZSBgY2FsbGJhY2tgLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCA0XG4gICAqIGFyZ3VtZW50czsgZm9yIGFycmF5cyB0aGV5IGFyZSAoYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBhbGlhcyBmb2xkbCwgaW5qZWN0XG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFthY2N1bXVsYXRvcl0gSW5pdGlhbCB2YWx1ZSBvZiB0aGUgYWNjdW11bGF0b3IuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSBhY2N1bXVsYXRlZCB2YWx1ZS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIHN1bSA9IF8ucmVkdWNlKFsxLCAyLCAzXSwgZnVuY3Rpb24obWVtbywgbnVtKSB7IHJldHVybiBtZW1vICsgbnVtOyB9KTtcbiAgICogLy8gPT4gNlxuICAgKi9cbiAgZnVuY3Rpb24gcmVkdWNlKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCBhY2N1bXVsYXRvciwgdGhpc0FyZykge1xuICAgIHZhciBub2FjY3VtID0gYXJndW1lbnRzLmxlbmd0aCA8IDM7XG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIGFjY3VtdWxhdG9yID0gbm9hY2N1bVxuICAgICAgICA/IChub2FjY3VtID0gZmFsc2UsIHZhbHVlKVxuICAgICAgICA6IGNhbGxiYWNrKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pXG4gICAgfSk7XG4gICAgcmV0dXJuIGFjY3VtdWxhdG9yO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSByaWdodC1hc3NvY2lhdGl2ZSB2ZXJzaW9uIG9mIGBfLnJlZHVjZWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIGZvbGRyXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFthY2N1bXVsYXRvcl0gSW5pdGlhbCB2YWx1ZSBvZiB0aGUgYWNjdW11bGF0b3IuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSBhY2N1bXVsYXRlZCB2YWx1ZS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIGxpc3QgPSBbWzAsIDFdLCBbMiwgM10sIFs0LCA1XV07XG4gICAqIHZhciBmbGF0ID0gXy5yZWR1Y2VSaWdodChsaXN0LCBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBhLmNvbmNhdChiKTsgfSwgW10pO1xuICAgKiAvLyA9PiBbNCwgNSwgMiwgMywgMCwgMV1cbiAgICovXG4gIGZ1bmN0aW9uIHJlZHVjZVJpZ2h0KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCBhY2N1bXVsYXRvciwgdGhpc0FyZykge1xuICAgIHZhciBpdGVyYXRlZSA9IGNvbGxlY3Rpb24sXG4gICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDAsXG4gICAgICAgIG5vYWNjdW0gPSBhcmd1bWVudHMubGVuZ3RoIDwgMztcblxuICAgIGlmICh0eXBlb2YgbGVuZ3RoICE9ICdudW1iZXInKSB7XG4gICAgICB2YXIgcHJvcHMgPSBrZXlzKGNvbGxlY3Rpb24pO1xuICAgICAgbGVuZ3RoID0gcHJvcHMubGVuZ3RoO1xuICAgIH0gZWxzZSBpZiAobm9DaGFyQnlJbmRleCAmJiBpc1N0cmluZyhjb2xsZWN0aW9uKSkge1xuICAgICAgaXRlcmF0ZWUgPSBjb2xsZWN0aW9uLnNwbGl0KCcnKTtcbiAgICB9XG4gICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIGluZGV4ID0gcHJvcHMgPyBwcm9wc1stLWxlbmd0aF0gOiAtLWxlbmd0aDtcbiAgICAgIGFjY3VtdWxhdG9yID0gbm9hY2N1bVxuICAgICAgICA/IChub2FjY3VtID0gZmFsc2UsIGl0ZXJhdGVlW2luZGV4XSlcbiAgICAgICAgOiBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGFjY3VtdWxhdG9yLCBpdGVyYXRlZVtpbmRleF0sIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICB9KTtcbiAgICByZXR1cm4gYWNjdW11bGF0b3I7XG4gIH1cblxuICAvKipcbiAgICogVGhlIG9wcG9zaXRlIG9mIGBfLmZpbHRlcmAsIHRoaXMgbWV0aG9kIHJldHVybnMgdGhlIHZhbHVlcyBvZiBhXG4gICAqIGBjb2xsZWN0aW9uYCB0aGF0IGBjYWxsYmFja2AgZG9lcyAqKm5vdCoqIHJldHVybiB0cnV0aHkgZm9yLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZWxlbWVudHMgdGhhdCBkaWQgKipub3QqKiBwYXNzIHRoZVxuICAgKiAgY2FsbGJhY2sgY2hlY2suXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBvZGRzID0gXy5yZWplY3QoWzEsIDIsIDMsIDQsIDUsIDZdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIG51bSAlIDIgPT0gMDsgfSk7XG4gICAqIC8vID0+IFsxLCAzLCA1XVxuICAgKi9cbiAgZnVuY3Rpb24gcmVqZWN0KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgcmV0dXJuIGZpbHRlcihjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIHJldHVybiAhY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFycmF5IG9mIHNodWZmbGVkIGBhcnJheWAgdmFsdWVzLCB1c2luZyBhIHZlcnNpb24gb2YgdGhlXG4gICAqIEZpc2hlci1ZYXRlcyBzaHVmZmxlLiBTZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9GaXNoZXItWWF0ZXNfc2h1ZmZsZS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIHNodWZmbGUuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBzaHVmZmxlZCBjb2xsZWN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnNodWZmbGUoWzEsIDIsIDMsIDQsIDUsIDZdKTtcbiAgICogLy8gPT4gWzQsIDEsIDYsIDMsIDUsIDJdXG4gICAqL1xuICBmdW5jdGlvbiBzaHVmZmxlKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgcmVzdWx0ID0gQXJyYXkoY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMCk7XG5cbiAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICB2YXIgcmFuZCA9IGZsb29yKG5hdGl2ZVJhbmRvbSgpICogKCsraW5kZXggKyAxKSk7XG4gICAgICByZXN1bHRbaW5kZXhdID0gcmVzdWx0W3JhbmRdO1xuICAgICAgcmVzdWx0W3JhbmRdID0gdmFsdWU7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBzaXplIG9mIHRoZSBgY29sbGVjdGlvbmAgYnkgcmV0dXJuaW5nIGBjb2xsZWN0aW9uLmxlbmd0aGAgZm9yIGFycmF5c1xuICAgKiBhbmQgYXJyYXktbGlrZSBvYmplY3RzIG9yIHRoZSBudW1iZXIgb2Ygb3duIGVudW1lcmFibGUgcHJvcGVydGllcyBmb3Igb2JqZWN0cy5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGluc3BlY3QuXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IFJldHVybnMgYGNvbGxlY3Rpb24ubGVuZ3RoYCBvciBudW1iZXIgb2Ygb3duIGVudW1lcmFibGUgcHJvcGVydGllcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5zaXplKFsxLCAyXSk7XG4gICAqIC8vID0+IDJcbiAgICpcbiAgICogXy5zaXplKHsgJ29uZSc6IDEsICd0d28nOiAyLCAndGhyZWUnOiAzIH0pO1xuICAgKiAvLyA9PiAzXG4gICAqXG4gICAqIF8uc2l6ZSgnY3VybHknKTtcbiAgICogLy8gPT4gNVxuICAgKi9cbiAgZnVuY3Rpb24gc2l6ZShjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDA7XG4gICAgcmV0dXJuIHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgPyBsZW5ndGggOiBrZXlzKGNvbGxlY3Rpb24pLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIGBjYWxsYmFja2AgcmV0dXJucyBhIHRydXRoeSB2YWx1ZSBmb3IgKiphbnkqKiBlbGVtZW50IG9mIGFcbiAgICogYGNvbGxlY3Rpb25gLiBUaGUgZnVuY3Rpb24gcmV0dXJucyBhcyBzb29uIGFzIGl0IGZpbmRzIHBhc3NpbmcgdmFsdWUsIGFuZFxuICAgKiBkb2VzIG5vdCBpdGVyYXRlIG92ZXIgdGhlIGVudGlyZSBgY29sbGVjdGlvbmAuIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvXG4gICAqIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBhbGlhcyBhbnlcbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBhbnkgZWxlbWVudCBwYXNzZXMgdGhlIGNhbGxiYWNrIGNoZWNrLFxuICAgKiAgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnNvbWUoW251bGwsIDAsICd5ZXMnLCBmYWxzZV0pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBzb21lKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcblxuICAgIGlmIChpc0FycmF5KGNvbGxlY3Rpb24pKSB7XG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uLmxlbmd0aDtcblxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgaWYgKHJlc3VsdCA9IGNhbGxiYWNrKGNvbGxlY3Rpb25baW5kZXhdLCBpbmRleCwgY29sbGVjdGlvbikpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gIShyZXN1bHQgPSBjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gISFyZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhcnJheSwgc3RhYmxlIHNvcnRlZCBpbiBhc2NlbmRpbmcgb3JkZXIgYnkgdGhlIHJlc3VsdHMgb2ZcbiAgICogcnVubmluZyBlYWNoIGVsZW1lbnQgb2YgYGNvbGxlY3Rpb25gIHRocm91Z2ggYSBgY2FsbGJhY2tgLiBUaGUgYGNhbGxiYWNrYFxuICAgKiBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICogVGhlIGBjYWxsYmFja2AgYXJndW1lbnQgbWF5IGFsc28gYmUgdGhlIG5hbWUgb2YgYSBwcm9wZXJ0eSB0byBzb3J0IGJ5IChlLmcuICdsZW5ndGgnKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxTdHJpbmd9IGNhbGxiYWNrfHByb3BlcnR5IFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvblxuICAgKiAgb3IgcHJvcGVydHkgbmFtZSB0byBzb3J0IGJ5LlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBzb3J0ZWQgZWxlbWVudHMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uc29ydEJ5KFsxLCAyLCAzXSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBNYXRoLnNpbihudW0pOyB9KTtcbiAgICogLy8gPT4gWzMsIDEsIDJdXG4gICAqXG4gICAqIF8uc29ydEJ5KFsxLCAyLCAzXSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiB0aGlzLnNpbihudW0pOyB9LCBNYXRoKTtcbiAgICogLy8gPT4gWzMsIDEsIDJdXG4gICAqXG4gICAqIF8uc29ydEJ5KFsnbGFycnknLCAnYnJlbmRhbicsICdtb2UnXSwgJ2xlbmd0aCcpO1xuICAgKiAvLyA9PiBbJ21vZScsICdsYXJyeScsICdicmVuZGFuJ11cbiAgICovXG4gIGZ1bmN0aW9uIHNvcnRCeShjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgcmVzdWx0LnB1c2goe1xuICAgICAgICAnY3JpdGVyaWEnOiBjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pLFxuICAgICAgICAnaW5kZXgnOiBpbmRleCxcbiAgICAgICAgJ3ZhbHVlJzogdmFsdWVcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdmFyIGxlbmd0aCA9IHJlc3VsdC5sZW5ndGg7XG4gICAgcmVzdWx0LnNvcnQoY29tcGFyZUFzY2VuZGluZyk7XG4gICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICByZXN1bHRbbGVuZ3RoXSA9IHJlc3VsdFtsZW5ndGhdLnZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIHRoZSBgY29sbGVjdGlvbmAsIHRvIGFuIGFycmF5LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gY29udmVydC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBuZXcgY29udmVydGVkIGFycmF5LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiAoZnVuY3Rpb24oKSB7IHJldHVybiBfLnRvQXJyYXkoYXJndW1lbnRzKS5zbGljZSgxKTsgfSkoMSwgMiwgMywgNCk7XG4gICAqIC8vID0+IFsyLCAzLCA0XVxuICAgKi9cbiAgZnVuY3Rpb24gdG9BcnJheShjb2xsZWN0aW9uKSB7XG4gICAgaWYgKGNvbGxlY3Rpb24gJiYgdHlwZW9mIGNvbGxlY3Rpb24ubGVuZ3RoID09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gKG5vQXJyYXlTbGljZU9uU3RyaW5ncyA/IGlzU3RyaW5nKGNvbGxlY3Rpb24pIDogdHlwZW9mIGNvbGxlY3Rpb24gPT0gJ3N0cmluZycpXG4gICAgICAgID8gY29sbGVjdGlvbi5zcGxpdCgnJylcbiAgICAgICAgOiBzbGljZS5jYWxsKGNvbGxlY3Rpb24pO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzKGNvbGxlY3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4YW1pbmVzIGVhY2ggZWxlbWVudCBpbiBhIGBjb2xsZWN0aW9uYCwgcmV0dXJuaW5nIGFuIGFycmF5IG9mIGFsbCBlbGVtZW50c1xuICAgKiB0aGF0IGNvbnRhaW4gdGhlIGdpdmVuIGBwcm9wZXJ0aWVzYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtPYmplY3R9IHByb3BlcnRpZXMgVGhlIG9iamVjdCBvZiBwcm9wZXJ0eSB2YWx1ZXMgdG8gZmlsdGVyIGJ5LlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZWxlbWVudHMgdGhhdCBjb250YWluIHRoZSBnaXZlbiBgcHJvcGVydGllc2AuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBzdG9vZ2VzID0gW1xuICAgKiAgIHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH0sXG4gICAqICAgeyAnbmFtZSc6ICdsYXJyeScsICdhZ2UnOiA1MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnY3VybHknLCAnYWdlJzogNjAgfVxuICAgKiBdO1xuICAgKlxuICAgKiBfLndoZXJlKHN0b29nZXMsIHsgJ2FnZSc6IDQwIH0pO1xuICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfV1cbiAgICovXG4gIGZ1bmN0aW9uIHdoZXJlKGNvbGxlY3Rpb24sIHByb3BlcnRpZXMpIHtcbiAgICB2YXIgcHJvcHMgPSBbXTtcbiAgICBmb3JJbihwcm9wZXJ0aWVzLCBmdW5jdGlvbih2YWx1ZSwgcHJvcCkge1xuICAgICAgcHJvcHMucHVzaChwcm9wKTtcbiAgICB9KTtcbiAgICByZXR1cm4gZmlsdGVyKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgICAgdmFyIGxlbmd0aCA9IHByb3BzLmxlbmd0aDtcbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gb2JqZWN0W3Byb3BzW2xlbmd0aF1dID09PSBwcm9wZXJ0aWVzW3Byb3BzW2xlbmd0aF1dO1xuICAgICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gISFyZXN1bHQ7XG4gICAgfSk7XG4gIH1cblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhcnJheSB3aXRoIGFsbCBmYWxzZXkgdmFsdWVzIG9mIGBhcnJheWAgcmVtb3ZlZC4gVGhlIHZhbHVlc1xuICAgKiBgZmFsc2VgLCBgbnVsbGAsIGAwYCwgYFwiXCJgLCBgdW5kZWZpbmVkYCBhbmQgYE5hTmAgYXJlIGFsbCBmYWxzZXkuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gY29tcGFjdC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGZpbHRlcmVkIGFycmF5LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmNvbXBhY3QoWzAsIDEsIGZhbHNlLCAyLCAnJywgM10pO1xuICAgKiAvLyA9PiBbMSwgMiwgM11cbiAgICovXG4gIGZ1bmN0aW9uIGNvbXBhY3QoYXJyYXkpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwLFxuICAgICAgICByZXN1bHQgPSBbXTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF07XG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgYGFycmF5YCBlbGVtZW50cyBub3QgcHJlc2VudCBpbiB0aGUgb3RoZXIgYXJyYXlzXG4gICAqIHVzaW5nIHN0cmljdCBlcXVhbGl0eSBmb3IgY29tcGFyaXNvbnMsIGkuZS4gYD09PWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcHJvY2Vzcy5cbiAgICogQHBhcmFtIHtBcnJheX0gW2FycmF5MSwgYXJyYXkyLCAuLi5dIEFycmF5cyB0byBjaGVjay5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGBhcnJheWAgZWxlbWVudHMgbm90IHByZXNlbnQgaW4gdGhlXG4gICAqICBvdGhlciBhcnJheXMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uZGlmZmVyZW5jZShbMSwgMiwgMywgNCwgNV0sIFs1LCAyLCAxMF0pO1xuICAgKiAvLyA9PiBbMSwgMywgNF1cbiAgICovXG4gIGZ1bmN0aW9uIGRpZmZlcmVuY2UoYXJyYXkpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwLFxuICAgICAgICBmbGF0dGVuZWQgPSBjb25jYXQuYXBwbHkoYXJyYXlSZWYsIGFyZ3VtZW50cyksXG4gICAgICAgIGNvbnRhaW5zID0gY2FjaGVkQ29udGFpbnMoZmxhdHRlbmVkLCBsZW5ndGgpLFxuICAgICAgICByZXN1bHQgPSBbXTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF07XG4gICAgICBpZiAoIWNvbnRhaW5zKHZhbHVlKSkge1xuICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgZmlyc3QgZWxlbWVudCBvZiB0aGUgYGFycmF5YC4gUGFzcyBgbmAgdG8gcmV0dXJuIHRoZSBmaXJzdCBgbmBcbiAgICogZWxlbWVudHMgb2YgdGhlIGBhcnJheWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIGhlYWQsIHRha2VcbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcXVlcnkuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbbl0gVGhlIG51bWJlciBvZiBlbGVtZW50cyB0byByZXR1cm4uXG4gICAqIEBwYXJhbS0ge09iamVjdH0gW2d1YXJkXSBJbnRlcm5hbGx5IHVzZWQgdG8gYWxsb3cgdGhpcyBtZXRob2QgdG8gd29yayB3aXRoXG4gICAqICBvdGhlcnMgbGlrZSBgXy5tYXBgIHdpdGhvdXQgdXNpbmcgdGhlaXIgY2FsbGJhY2sgYGluZGV4YCBhcmd1bWVudCBmb3IgYG5gLlxuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgdGhlIGZpcnN0IGVsZW1lbnQgb3IgYW4gYXJyYXkgb2YgdGhlIGZpcnN0IGBuYFxuICAgKiAgZWxlbWVudHMgb2YgYGFycmF5YC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5maXJzdChbNSwgNCwgMywgMiwgMV0pO1xuICAgKiAvLyA9PiA1XG4gICAqL1xuICBmdW5jdGlvbiBmaXJzdChhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJyYXkpIHtcbiAgICAgIHJldHVybiAobiA9PSBudWxsIHx8IGd1YXJkKSA/IGFycmF5WzBdIDogc2xpY2UuY2FsbChhcnJheSwgMCwgbik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZsYXR0ZW5zIGEgbmVzdGVkIGFycmF5ICh0aGUgbmVzdGluZyBjYW4gYmUgdG8gYW55IGRlcHRoKS4gSWYgYHNoYWxsb3dgIGlzXG4gICAqIHRydXRoeSwgYGFycmF5YCB3aWxsIG9ubHkgYmUgZmxhdHRlbmVkIGEgc2luZ2xlIGxldmVsLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGNvbXBhY3QuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gc2hhbGxvdyBBIGZsYWcgdG8gaW5kaWNhdGUgb25seSBmbGF0dGVuaW5nIGEgc2luZ2xlIGxldmVsLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgZmxhdHRlbmVkIGFycmF5LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmZsYXR0ZW4oWzEsIFsyXSwgWzMsIFtbNF1dXV0pO1xuICAgKiAvLyA9PiBbMSwgMiwgMywgNF07XG4gICAqXG4gICAqIF8uZmxhdHRlbihbMSwgWzJdLCBbMywgW1s0XV1dXSwgdHJ1ZSk7XG4gICAqIC8vID0+IFsxLCAyLCAzLCBbWzRdXV07XG4gICAqL1xuICBmdW5jdGlvbiBmbGF0dGVuKGFycmF5LCBzaGFsbG93KSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMCxcbiAgICAgICAgcmVzdWx0ID0gW107XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgdmFyIHZhbHVlID0gYXJyYXlbaW5kZXhdO1xuXG4gICAgICAvLyByZWN1cnNpdmVseSBmbGF0dGVuIGFycmF5cyAoc3VzY2VwdGlibGUgdG8gY2FsbCBzdGFjayBsaW1pdHMpXG4gICAgICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgcHVzaC5hcHBseShyZXN1bHQsIHNoYWxsb3cgPyB2YWx1ZSA6IGZsYXR0ZW4odmFsdWUpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBpbmRleCBhdCB3aGljaCB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZiBgdmFsdWVgIGlzIGZvdW5kIHVzaW5nXG4gICAqIHN0cmljdCBlcXVhbGl0eSBmb3IgY29tcGFyaXNvbnMsIGkuZS4gYD09PWAuIElmIHRoZSBgYXJyYXlgIGlzIGFscmVhZHlcbiAgICogc29ydGVkLCBwYXNzaW5nIGB0cnVlYCBmb3IgYGZyb21JbmRleGAgd2lsbCBydW4gYSBmYXN0ZXIgYmluYXJ5IHNlYXJjaC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBzZWFyY2guXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBzZWFyY2ggZm9yLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW58TnVtYmVyfSBbZnJvbUluZGV4PTBdIFRoZSBpbmRleCB0byBzZWFyY2ggZnJvbSBvciBgdHJ1ZWAgdG9cbiAgICogIHBlcmZvcm0gYSBiaW5hcnkgc2VhcmNoIG9uIGEgc29ydGVkIGBhcnJheWAuXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IFJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBtYXRjaGVkIHZhbHVlIG9yIGAtMWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaW5kZXhPZihbMSwgMiwgMywgMSwgMiwgM10sIDIpO1xuICAgKiAvLyA9PiAxXG4gICAqXG4gICAqIF8uaW5kZXhPZihbMSwgMiwgMywgMSwgMiwgM10sIDIsIDMpO1xuICAgKiAvLyA9PiA0XG4gICAqXG4gICAqIF8uaW5kZXhPZihbMSwgMSwgMiwgMiwgMywgM10sIDIsIHRydWUpO1xuICAgKiAvLyA9PiAyXG4gICAqL1xuICBmdW5jdGlvbiBpbmRleE9mKGFycmF5LCB2YWx1ZSwgZnJvbUluZGV4KSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMDtcblxuICAgIGlmICh0eXBlb2YgZnJvbUluZGV4ID09ICdudW1iZXInKSB7XG4gICAgICBpbmRleCA9IChmcm9tSW5kZXggPCAwID8gbmF0aXZlTWF4KDAsIGxlbmd0aCArIGZyb21JbmRleCkgOiBmcm9tSW5kZXggfHwgMCkgLSAxO1xuICAgIH0gZWxzZSBpZiAoZnJvbUluZGV4KSB7XG4gICAgICBpbmRleCA9IHNvcnRlZEluZGV4KGFycmF5LCB2YWx1ZSk7XG4gICAgICByZXR1cm4gYXJyYXlbaW5kZXhdID09PSB2YWx1ZSA/IGluZGV4IDogLTE7XG4gICAgfVxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICBpZiAoYXJyYXlbaW5kZXhdID09PSB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gaW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGFsbCBidXQgdGhlIGxhc3QgZWxlbWVudCBvZiBgYXJyYXlgLiBQYXNzIGBuYCB0byBleGNsdWRlIHRoZSBsYXN0IGBuYFxuICAgKiBlbGVtZW50cyBmcm9tIHRoZSByZXN1bHQuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcXVlcnkuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbbj0xXSBUaGUgbnVtYmVyIG9mIGVsZW1lbnRzIHRvIGV4Y2x1ZGUuXG4gICAqIEBwYXJhbS0ge09iamVjdH0gW2d1YXJkXSBJbnRlcm5hbGx5IHVzZWQgdG8gYWxsb3cgdGhpcyBtZXRob2QgdG8gd29yayB3aXRoXG4gICAqICBvdGhlcnMgbGlrZSBgXy5tYXBgIHdpdGhvdXQgdXNpbmcgdGhlaXIgY2FsbGJhY2sgYGluZGV4YCBhcmd1bWVudCBmb3IgYG5gLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYWxsIGJ1dCB0aGUgbGFzdCBlbGVtZW50IG9yIGBuYCBlbGVtZW50cyBvZiBgYXJyYXlgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmluaXRpYWwoWzMsIDIsIDFdKTtcbiAgICogLy8gPT4gWzMsIDJdXG4gICAqL1xuICBmdW5jdGlvbiBpbml0aWFsKGFycmF5LCBuLCBndWFyZCkge1xuICAgIHJldHVybiBhcnJheVxuICAgICAgPyBzbGljZS5jYWxsKGFycmF5LCAwLCAtKChuID09IG51bGwgfHwgZ3VhcmQpID8gMSA6IG4pKVxuICAgICAgOiBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wdXRlcyB0aGUgaW50ZXJzZWN0aW9uIG9mIGFsbCB0aGUgcGFzc2VkLWluIGFycmF5cyB1c2luZyBzdHJpY3QgZXF1YWxpdHlcbiAgICogZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gW2FycmF5MSwgYXJyYXkyLCAuLi5dIEFycmF5cyB0byBwcm9jZXNzLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgdW5pcXVlIGVsZW1lbnRzLCBpbiBvcmRlciwgdGhhdCBhcmVcbiAgICogIHByZXNlbnQgaW4gKiphbGwqKiBvZiB0aGUgYXJyYXlzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmludGVyc2VjdGlvbihbMSwgMiwgM10sIFsxMDEsIDIsIDEsIDEwXSwgWzIsIDFdKTtcbiAgICogLy8gPT4gWzEsIDJdXG4gICAqL1xuICBmdW5jdGlvbiBpbnRlcnNlY3Rpb24oYXJyYXkpIHtcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgYXJnc0xlbmd0aCA9IGFyZ3MubGVuZ3RoLFxuICAgICAgICBjYWNoZSA9IHt9LFxuICAgICAgICByZXN1bHQgPSBbXTtcblxuICAgIGZvckVhY2goYXJyYXksIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBpZiAoaW5kZXhPZihyZXN1bHQsIHZhbHVlKSA8IDApIHtcbiAgICAgICAgdmFyIGxlbmd0aCA9IGFyZ3NMZW5ndGg7XG4gICAgICAgIHdoaWxlICgtLWxlbmd0aCkge1xuICAgICAgICAgIGlmICghKGNhY2hlW2xlbmd0aF0gfHwgKGNhY2hlW2xlbmd0aF0gPSBjYWNoZWRDb250YWlucyhhcmdzW2xlbmd0aF0pKSkodmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIGxhc3QgZWxlbWVudCBvZiB0aGUgYGFycmF5YC4gUGFzcyBgbmAgdG8gcmV0dXJuIHRoZSBsYXN0IGBuYFxuICAgKiBlbGVtZW50cyBvZiB0aGUgYGFycmF5YC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBxdWVyeS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IFtuXSBUaGUgbnVtYmVyIG9mIGVsZW1lbnRzIHRvIHJldHVybi5cbiAgICogQHBhcmFtLSB7T2JqZWN0fSBbZ3VhcmRdIEludGVybmFsbHkgdXNlZCB0byBhbGxvdyB0aGlzIG1ldGhvZCB0byB3b3JrIHdpdGhcbiAgICogIG90aGVycyBsaWtlIGBfLm1hcGAgd2l0aG91dCB1c2luZyB0aGVpciBjYWxsYmFjayBgaW5kZXhgIGFyZ3VtZW50IGZvciBgbmAuXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgbGFzdCBlbGVtZW50IG9yIGFuIGFycmF5IG9mIHRoZSBsYXN0IGBuYFxuICAgKiAgZWxlbWVudHMgb2YgYGFycmF5YC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5sYXN0KFszLCAyLCAxXSk7XG4gICAqIC8vID0+IDFcbiAgICovXG4gIGZ1bmN0aW9uIGxhc3QoYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgaWYgKGFycmF5KSB7XG4gICAgICB2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuICAgICAgcmV0dXJuIChuID09IG51bGwgfHwgZ3VhcmQpID8gYXJyYXlbbGVuZ3RoIC0gMV0gOiBzbGljZS5jYWxsKGFycmF5LCAtbiB8fCBsZW5ndGgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBpbmRleCBhdCB3aGljaCB0aGUgbGFzdCBvY2N1cnJlbmNlIG9mIGB2YWx1ZWAgaXMgZm91bmQgdXNpbmcgc3RyaWN0XG4gICAqIGVxdWFsaXR5IGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC4gSWYgYGZyb21JbmRleGAgaXMgbmVnYXRpdmUsIGl0IGlzIHVzZWRcbiAgICogYXMgdGhlIG9mZnNldCBmcm9tIHRoZSBlbmQgb2YgdGhlIGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gc2VhcmNoLlxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2VhcmNoIGZvci5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IFtmcm9tSW5kZXg9YXJyYXkubGVuZ3RoLTFdIFRoZSBpbmRleCB0byBzZWFyY2ggZnJvbS5cbiAgICogQHJldHVybnMge051bWJlcn0gUmV0dXJucyB0aGUgaW5kZXggb2YgdGhlIG1hdGNoZWQgdmFsdWUgb3IgYC0xYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5sYXN0SW5kZXhPZihbMSwgMiwgMywgMSwgMiwgM10sIDIpO1xuICAgKiAvLyA9PiA0XG4gICAqXG4gICAqIF8ubGFzdEluZGV4T2YoWzEsIDIsIDMsIDEsIDIsIDNdLCAyLCAzKTtcbiAgICogLy8gPT4gMVxuICAgKi9cbiAgZnVuY3Rpb24gbGFzdEluZGV4T2YoYXJyYXksIHZhbHVlLCBmcm9tSW5kZXgpIHtcbiAgICB2YXIgaW5kZXggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XG4gICAgaWYgKHR5cGVvZiBmcm9tSW5kZXggPT0gJ251bWJlcicpIHtcbiAgICAgIGluZGV4ID0gKGZyb21JbmRleCA8IDAgPyBuYXRpdmVNYXgoMCwgaW5kZXggKyBmcm9tSW5kZXgpIDogbmF0aXZlTWluKGZyb21JbmRleCwgaW5kZXggLSAxKSkgKyAxO1xuICAgIH1cbiAgICB3aGlsZSAoaW5kZXgtLSkge1xuICAgICAgaWYgKGFycmF5W2luZGV4XSA9PT0gdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBvYmplY3QgY29tcG9zZWQgZnJvbSBhcnJheXMgb2YgYGtleXNgIGFuZCBgdmFsdWVzYC4gUGFzcyBlaXRoZXJcbiAgICogYSBzaW5nbGUgdHdvIGRpbWVuc2lvbmFsIGFycmF5LCBpLmUuIGBbW2tleTEsIHZhbHVlMV0sIFtrZXkyLCB2YWx1ZTJdXWAsIG9yXG4gICAqIHR3byBhcnJheXMsIG9uZSBvZiBga2V5c2AgYW5kIG9uZSBvZiBjb3JyZXNwb25kaW5nIGB2YWx1ZXNgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0ga2V5cyBUaGUgYXJyYXkgb2Yga2V5cy5cbiAgICogQHBhcmFtIHtBcnJheX0gW3ZhbHVlcz1bXV0gVGhlIGFycmF5IG9mIHZhbHVlcy5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBvYmplY3QgY29tcG9zZWQgb2YgdGhlIGdpdmVuIGtleXMgYW5kXG4gICAqICBjb3JyZXNwb25kaW5nIHZhbHVlcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5vYmplY3QoWydtb2UnLCAnbGFycnknLCAnY3VybHknXSwgWzMwLCA0MCwgNTBdKTtcbiAgICogLy8gPT4geyAnbW9lJzogMzAsICdsYXJyeSc6IDQwLCAnY3VybHknOiA1MCB9XG4gICAqL1xuICBmdW5jdGlvbiBvYmplY3Qoa2V5cywgdmFsdWVzKSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGtleXMgPyBrZXlzLmxlbmd0aCA6IDAsXG4gICAgICAgIHJlc3VsdCA9IHt9O1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHZhciBrZXkgPSBrZXlzW2luZGV4XTtcbiAgICAgIGlmICh2YWx1ZXMpIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZXNbaW5kZXhdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0W2tleVswXV0gPSBrZXlbMV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhcnJheSBvZiBudW1iZXJzIChwb3NpdGl2ZSBhbmQvb3IgbmVnYXRpdmUpIHByb2dyZXNzaW5nIGZyb21cbiAgICogYHN0YXJ0YCB1cCB0byBidXQgbm90IGluY2x1ZGluZyBgc3RvcGAuIFRoaXMgbWV0aG9kIGlzIGEgcG9ydCBvZiBQeXRob24nc1xuICAgKiBgcmFuZ2UoKWAgZnVuY3Rpb24uIFNlZSBodHRwOi8vZG9jcy5weXRob24ub3JnL2xpYnJhcnkvZnVuY3Rpb25zLmh0bWwjcmFuZ2UuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge051bWJlcn0gW3N0YXJ0PTBdIFRoZSBzdGFydCBvZiB0aGUgcmFuZ2UuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBlbmQgVGhlIGVuZCBvZiB0aGUgcmFuZ2UuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbc3RlcD0xXSBUaGUgdmFsdWUgdG8gaW5jcmVtZW50IG9yIGRlc2NyZW1lbnQgYnkuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyByYW5nZSBhcnJheS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5yYW5nZSgxMCk7XG4gICAqIC8vID0+IFswLCAxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5XVxuICAgKlxuICAgKiBfLnJhbmdlKDEsIDExKTtcbiAgICogLy8gPT4gWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwXVxuICAgKlxuICAgKiBfLnJhbmdlKDAsIDMwLCA1KTtcbiAgICogLy8gPT4gWzAsIDUsIDEwLCAxNSwgMjAsIDI1XVxuICAgKlxuICAgKiBfLnJhbmdlKDAsIC0xMCwgLTEpO1xuICAgKiAvLyA9PiBbMCwgLTEsIC0yLCAtMywgLTQsIC01LCAtNiwgLTcsIC04LCAtOV1cbiAgICpcbiAgICogXy5yYW5nZSgwKTtcbiAgICogLy8gPT4gW11cbiAgICovXG4gIGZ1bmN0aW9uIHJhbmdlKHN0YXJ0LCBlbmQsIHN0ZXApIHtcbiAgICBzdGFydCA9ICtzdGFydCB8fCAwO1xuICAgIHN0ZXAgPSArc3RlcCB8fCAxO1xuXG4gICAgaWYgKGVuZCA9PSBudWxsKSB7XG4gICAgICBlbmQgPSBzdGFydDtcbiAgICAgIHN0YXJ0ID0gMDtcbiAgICB9XG4gICAgLy8gdXNlIGBBcnJheShsZW5ndGgpYCBzbyBWOCB3aWxsIGF2b2lkIHRoZSBzbG93ZXIgXCJkaWN0aW9uYXJ5XCIgbW9kZVxuICAgIC8vIGh0dHA6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj1YQXFJcEdVOFpaayN0PTE2bTI3c1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBuYXRpdmVNYXgoMCwgY2VpbCgoZW5kIC0gc3RhcnQpIC8gc3RlcCkpLFxuICAgICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBzdGFydDtcbiAgICAgIHN0YXJ0ICs9IHN0ZXA7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogVGhlIG9wcG9zaXRlIG9mIGBfLmluaXRpYWxgLCB0aGlzIG1ldGhvZCBnZXRzIGFsbCBidXQgdGhlIGZpcnN0IHZhbHVlIG9mXG4gICAqIGBhcnJheWAuIFBhc3MgYG5gIHRvIGV4Y2x1ZGUgdGhlIGZpcnN0IGBuYCB2YWx1ZXMgZnJvbSB0aGUgcmVzdWx0LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBhbGlhcyBkcm9wLCB0YWlsXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHF1ZXJ5LlxuICAgKiBAcGFyYW0ge051bWJlcn0gW249MV0gVGhlIG51bWJlciBvZiBlbGVtZW50cyB0byBleGNsdWRlLlxuICAgKiBAcGFyYW0tIHtPYmplY3R9IFtndWFyZF0gSW50ZXJuYWxseSB1c2VkIHRvIGFsbG93IHRoaXMgbWV0aG9kIHRvIHdvcmsgd2l0aFxuICAgKiAgb3RoZXJzIGxpa2UgYF8ubWFwYCB3aXRob3V0IHVzaW5nIHRoZWlyIGNhbGxiYWNrIGBpbmRleGAgYXJndW1lbnQgZm9yIGBuYC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGFsbCBidXQgdGhlIGZpcnN0IHZhbHVlIG9yIGBuYCB2YWx1ZXMgb2YgYGFycmF5YC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5yZXN0KFszLCAyLCAxXSk7XG4gICAqIC8vID0+IFsyLCAxXVxuICAgKi9cbiAgZnVuY3Rpb24gcmVzdChhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICByZXR1cm4gYXJyYXlcbiAgICAgID8gc2xpY2UuY2FsbChhcnJheSwgKG4gPT0gbnVsbCB8fCBndWFyZCkgPyAxIDogbilcbiAgICAgIDogW107XG4gIH1cblxuICAvKipcbiAgICogVXNlcyBhIGJpbmFyeSBzZWFyY2ggdG8gZGV0ZXJtaW5lIHRoZSBzbWFsbGVzdCBpbmRleCBhdCB3aGljaCB0aGUgYHZhbHVlYFxuICAgKiBzaG91bGQgYmUgaW5zZXJ0ZWQgaW50byBgYXJyYXlgIGluIG9yZGVyIHRvIG1haW50YWluIHRoZSBzb3J0IG9yZGVyIG9mIHRoZVxuICAgKiBzb3J0ZWQgYGFycmF5YC4gSWYgYGNhbGxiYWNrYCBpcyBwYXNzZWQsIGl0IHdpbGwgYmUgZXhlY3V0ZWQgZm9yIGB2YWx1ZWAgYW5kXG4gICAqIGVhY2ggZWxlbWVudCBpbiBgYXJyYXlgIHRvIGNvbXB1dGUgdGhlaXIgc29ydCByYW5raW5nLiBUaGUgYGNhbGxiYWNrYCBpc1xuICAgKiBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCBvbmUgYXJndW1lbnQ7ICh2YWx1ZSkuIFRoZSBgY2FsbGJhY2tgXG4gICAqIGFyZ3VtZW50IG1heSBhbHNvIGJlIHRoZSBuYW1lIG9mIGEgcHJvcGVydHkgdG8gb3JkZXIgYnkuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gZXZhbHVhdGUuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258U3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHl8cHJvcGVydHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICogIHBlciBpdGVyYXRpb24gb3IgcHJvcGVydHkgbmFtZSB0byBvcmRlciBieS5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSBSZXR1cm5zIHRoZSBpbmRleCBhdCB3aGljaCB0aGUgdmFsdWUgc2hvdWxkIGJlIGluc2VydGVkXG4gICAqICBpbnRvIGBhcnJheWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uc29ydGVkSW5kZXgoWzIwLCAzMCwgNTBdLCA0MCk7XG4gICAqIC8vID0+IDJcbiAgICpcbiAgICogXy5zb3J0ZWRJbmRleChbeyAneCc6IDIwIH0sIHsgJ3gnOiAzMCB9LCB7ICd4JzogNTAgfV0sIHsgJ3gnOiA0MCB9LCAneCcpO1xuICAgKiAvLyA9PiAyXG4gICAqXG4gICAqIHZhciBkaWN0ID0ge1xuICAgKiAgICd3b3JkVG9OdW1iZXInOiB7ICd0d2VudHknOiAyMCwgJ3RoaXJ0eSc6IDMwLCAnZm91cnR5JzogNDAsICdmaWZ0eSc6IDUwIH1cbiAgICogfTtcbiAgICpcbiAgICogXy5zb3J0ZWRJbmRleChbJ3R3ZW50eScsICd0aGlydHknLCAnZmlmdHknXSwgJ2ZvdXJ0eScsIGZ1bmN0aW9uKHdvcmQpIHtcbiAgICogICByZXR1cm4gZGljdC53b3JkVG9OdW1iZXJbd29yZF07XG4gICAqIH0pO1xuICAgKiAvLyA9PiAyXG4gICAqXG4gICAqIF8uc29ydGVkSW5kZXgoWyd0d2VudHknLCAndGhpcnR5JywgJ2ZpZnR5J10sICdmb3VydHknLCBmdW5jdGlvbih3b3JkKSB7XG4gICAqICAgcmV0dXJuIHRoaXMud29yZFRvTnVtYmVyW3dvcmRdO1xuICAgKiB9LCBkaWN0KTtcbiAgICogLy8gPT4gMlxuICAgKi9cbiAgZnVuY3Rpb24gc29ydGVkSW5kZXgoYXJyYXksIHZhbHVlLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciBsb3cgPSAwLFxuICAgICAgICBoaWdoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiBsb3c7XG5cbiAgICAvLyBleHBsaWNpdGx5IHJlZmVyZW5jZSBgaWRlbnRpdHlgIGZvciBiZXR0ZXIgZW5naW5lIGlubGluaW5nXG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayA/IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKSA6IGlkZW50aXR5O1xuICAgIHZhbHVlID0gY2FsbGJhY2sodmFsdWUpO1xuICAgIHdoaWxlIChsb3cgPCBoaWdoKSB7XG4gICAgICB2YXIgbWlkID0gKGxvdyArIGhpZ2gpID4+PiAxO1xuICAgICAgY2FsbGJhY2soYXJyYXlbbWlkXSkgPCB2YWx1ZVxuICAgICAgICA/IGxvdyA9IG1pZCArIDFcbiAgICAgICAgOiBoaWdoID0gbWlkO1xuICAgIH1cbiAgICByZXR1cm4gbG93O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbXB1dGVzIHRoZSB1bmlvbiBvZiB0aGUgcGFzc2VkLWluIGFycmF5cyB1c2luZyBzdHJpY3QgZXF1YWxpdHkgZm9yXG4gICAqIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gW2FycmF5MSwgYXJyYXkyLCAuLi5dIEFycmF5cyB0byBwcm9jZXNzLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgdW5pcXVlIHZhbHVlcywgaW4gb3JkZXIsIHRoYXQgYXJlXG4gICAqICBwcmVzZW50IGluIG9uZSBvciBtb3JlIG9mIHRoZSBhcnJheXMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8udW5pb24oWzEsIDIsIDNdLCBbMTAxLCAyLCAxLCAxMF0sIFsyLCAxXSk7XG4gICAqIC8vID0+IFsxLCAyLCAzLCAxMDEsIDEwXVxuICAgKi9cbiAgZnVuY3Rpb24gdW5pb24oKSB7XG4gICAgcmV0dXJuIHVuaXEoY29uY2F0LmFwcGx5KGFycmF5UmVmLCBhcmd1bWVudHMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZHVwbGljYXRlLXZhbHVlLWZyZWUgdmVyc2lvbiBvZiB0aGUgYGFycmF5YCB1c2luZyBzdHJpY3QgZXF1YWxpdHlcbiAgICogZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLiBJZiB0aGUgYGFycmF5YCBpcyBhbHJlYWR5IHNvcnRlZCwgcGFzc2luZyBgdHJ1ZWBcbiAgICogZm9yIGBpc1NvcnRlZGAgd2lsbCBydW4gYSBmYXN0ZXIgYWxnb3JpdGhtLiBJZiBgY2FsbGJhY2tgIGlzIHBhc3NlZCwgZWFjaFxuICAgKiBlbGVtZW50IG9mIGBhcnJheWAgaXMgcGFzc2VkIHRocm91Z2ggYSBjYWxsYmFja2AgYmVmb3JlIHVuaXF1ZW5lc3MgaXMgY29tcHV0ZWQuXG4gICAqIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleCwgYXJyYXkpLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBhbGlhcyB1bmlxdWVcbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcHJvY2Vzcy5cbiAgICogQHBhcmFtIHtCb29sZWFufSBbaXNTb3J0ZWQ9ZmFsc2VdIEEgZmxhZyB0byBpbmRpY2F0ZSB0aGF0IHRoZSBgYXJyYXlgIGlzIGFscmVhZHkgc29ydGVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBkdXBsaWNhdGUtdmFsdWUtZnJlZSBhcnJheS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy51bmlxKFsxLCAyLCAxLCAzLCAxXSk7XG4gICAqIC8vID0+IFsxLCAyLCAzXVxuICAgKlxuICAgKiBfLnVuaXEoWzEsIDEsIDIsIDIsIDNdLCB0cnVlKTtcbiAgICogLy8gPT4gWzEsIDIsIDNdXG4gICAqXG4gICAqIF8udW5pcShbMSwgMiwgMS41LCAzLCAyLjVdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIE1hdGguZmxvb3IobnVtKTsgfSk7XG4gICAqIC8vID0+IFsxLCAyLCAzXVxuICAgKlxuICAgKiBfLnVuaXEoWzEsIDIsIDEuNSwgMywgMi41XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiB0aGlzLmZsb29yKG51bSk7IH0sIE1hdGgpO1xuICAgKiAvLyA9PiBbMSwgMiwgM11cbiAgICovXG4gIGZ1bmN0aW9uIHVuaXEoYXJyYXksIGlzU29ydGVkLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDAsXG4gICAgICAgIHJlc3VsdCA9IFtdLFxuICAgICAgICBzZWVuID0gcmVzdWx0O1xuXG4gICAgLy8ganVnZ2xlIGFyZ3VtZW50c1xuICAgIGlmICh0eXBlb2YgaXNTb3J0ZWQgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpc0FyZyA9IGNhbGxiYWNrO1xuICAgICAgY2FsbGJhY2sgPSBpc1NvcnRlZDtcbiAgICAgIGlzU29ydGVkID0gZmFsc2U7XG4gICAgfVxuICAgIC8vIGluaXQgdmFsdWUgY2FjaGUgZm9yIGxhcmdlIGFycmF5c1xuICAgIHZhciBpc0xhcmdlID0gIWlzU29ydGVkICYmIGxlbmd0aCA+IDc0O1xuICAgIGlmIChpc0xhcmdlKSB7XG4gICAgICB2YXIgY2FjaGUgPSB7fTtcbiAgICB9XG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBzZWVuID0gW107XG4gICAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgICB9XG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2luZGV4XSxcbiAgICAgICAgICBjb21wdXRlZCA9IGNhbGxiYWNrID8gY2FsbGJhY2sodmFsdWUsIGluZGV4LCBhcnJheSkgOiB2YWx1ZTtcblxuICAgICAgaWYgKGlzTGFyZ2UpIHtcbiAgICAgICAgLy8gbWFudWFsbHkgY29lcmNlIGBjb21wdXRlZGAgdG8gYSBzdHJpbmcgYmVjYXVzZSBgaGFzT3duUHJvcGVydHlgLCBpblxuICAgICAgICAvLyBzb21lIG9sZGVyIHZlcnNpb25zIG9mIEZpcmVmb3gsIGNvZXJjZXMgb2JqZWN0cyBpbmNvcnJlY3RseVxuICAgICAgICBzZWVuID0gaGFzT3duUHJvcGVydHkuY2FsbChjYWNoZSwgY29tcHV0ZWQgKyAnJykgPyBjYWNoZVtjb21wdXRlZF0gOiAoY2FjaGVbY29tcHV0ZWRdID0gW10pO1xuICAgICAgfVxuICAgICAgaWYgKGlzU29ydGVkXG4gICAgICAgICAgICA/ICFpbmRleCB8fCBzZWVuW3NlZW4ubGVuZ3RoIC0gMV0gIT09IGNvbXB1dGVkXG4gICAgICAgICAgICA6IGluZGV4T2Yoc2VlbiwgY29tcHV0ZWQpIDwgMFxuICAgICAgICAgICkge1xuICAgICAgICBpZiAoY2FsbGJhY2sgfHwgaXNMYXJnZSkge1xuICAgICAgICAgIHNlZW4ucHVzaChjb21wdXRlZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYXJyYXkgd2l0aCBhbGwgb2NjdXJyZW5jZXMgb2YgdGhlIHBhc3NlZCB2YWx1ZXMgcmVtb3ZlZCB1c2luZ1xuICAgKiBzdHJpY3QgZXF1YWxpdHkgZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGZpbHRlci5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3ZhbHVlMSwgdmFsdWUyLCAuLi5dIFZhbHVlcyB0byByZW1vdmUuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBmaWx0ZXJlZCBhcnJheS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy53aXRob3V0KFsxLCAyLCAxLCAwLCAzLCAxLCA0XSwgMCwgMSk7XG4gICAqIC8vID0+IFsyLCAzLCA0XVxuICAgKi9cbiAgZnVuY3Rpb24gd2l0aG91dChhcnJheSkge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDAsXG4gICAgICAgIGNvbnRhaW5zID0gY2FjaGVkQ29udGFpbnMoYXJndW1lbnRzLCAxLCAyMCksXG4gICAgICAgIHJlc3VsdCA9IFtdO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2luZGV4XTtcbiAgICAgIGlmICghY29udGFpbnModmFsdWUpKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHcm91cHMgdGhlIGVsZW1lbnRzIG9mIGVhY2ggYXJyYXkgYXQgdGhlaXIgY29ycmVzcG9uZGluZyBpbmRleGVzLiBVc2VmdWwgZm9yXG4gICAqIHNlcGFyYXRlIGRhdGEgc291cmNlcyB0aGF0IGFyZSBjb29yZGluYXRlZCB0aHJvdWdoIG1hdGNoaW5nIGFycmF5IGluZGV4ZXMuXG4gICAqIEZvciBhIG1hdHJpeCBvZiBuZXN0ZWQgYXJyYXlzLCBgXy56aXAuYXBwbHkoLi4uKWAgY2FuIHRyYW5zcG9zZSB0aGUgbWF0cml4XG4gICAqIGluIGEgc2ltaWxhciBmYXNoaW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gW2FycmF5MSwgYXJyYXkyLCAuLi5dIEFycmF5cyB0byBwcm9jZXNzLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZ3JvdXBlZCBlbGVtZW50cy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy56aXAoWydtb2UnLCAnbGFycnknLCAnY3VybHknXSwgWzMwLCA0MCwgNTBdLCBbdHJ1ZSwgZmFsc2UsIGZhbHNlXSk7XG4gICAqIC8vID0+IFtbJ21vZScsIDMwLCB0cnVlXSwgWydsYXJyeScsIDQwLCBmYWxzZV0sIFsnY3VybHknLCA1MCwgZmFsc2VdXVxuICAgKi9cbiAgZnVuY3Rpb24gemlwKGFycmF5KSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGFycmF5ID8gbWF4KHBsdWNrKGFyZ3VtZW50cywgJ2xlbmd0aCcpKSA6IDAsXG4gICAgICAgIHJlc3VsdCA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgcmVzdWx0W2luZGV4XSA9IHBsdWNrKGFyZ3VtZW50cywgaW5kZXgpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGlzIHJlc3RyaWN0ZWQgdG8gZXhlY3V0aW5nIGBmdW5jYCBvbmx5IGFmdGVyIGl0IGlzXG4gICAqIGNhbGxlZCBgbmAgdGltZXMuIFRoZSBgZnVuY2AgaXMgZXhlY3V0ZWQgd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlXG4gICAqIGNyZWF0ZWQgZnVuY3Rpb24uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgKiBAcGFyYW0ge051bWJlcn0gbiBUaGUgbnVtYmVyIG9mIHRpbWVzIHRoZSBmdW5jdGlvbiBtdXN0IGJlIGNhbGxlZCBiZWZvcmVcbiAgICogaXQgaXMgZXhlY3V0ZWQuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHJlc3RyaWN0LlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyByZXN0cmljdGVkIGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgcmVuZGVyTm90ZXMgPSBfLmFmdGVyKG5vdGVzLmxlbmd0aCwgcmVuZGVyKTtcbiAgICogXy5mb3JFYWNoKG5vdGVzLCBmdW5jdGlvbihub3RlKSB7XG4gICAqICAgbm90ZS5hc3luY1NhdmUoeyAnc3VjY2Vzcyc6IHJlbmRlck5vdGVzIH0pO1xuICAgKiB9KTtcbiAgICogLy8gYHJlbmRlck5vdGVzYCBpcyBydW4gb25jZSwgYWZ0ZXIgYWxsIG5vdGVzIGhhdmUgc2F2ZWRcbiAgICovXG4gIGZ1bmN0aW9uIGFmdGVyKG4sIGZ1bmMpIHtcbiAgICBpZiAobiA8IDEpIHtcbiAgICAgIHJldHVybiBmdW5jKCk7XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgtLW4gPCAxKSB7XG4gICAgICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCwgd2hlbiBjYWxsZWQsIGludm9rZXMgYGZ1bmNgIHdpdGggdGhlIGB0aGlzYFxuICAgKiBiaW5kaW5nIG9mIGB0aGlzQXJnYCBhbmQgcHJlcGVuZHMgYW55IGFkZGl0aW9uYWwgYGJpbmRgIGFyZ3VtZW50cyB0byB0aG9zZVxuICAgKiBwYXNzZWQgdG8gdGhlIGJvdW5kIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gYmluZC5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFthcmcxLCBhcmcyLCAuLi5dIEFyZ3VtZW50cyB0byBiZSBwYXJ0aWFsbHkgYXBwbGllZC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgYm91bmQgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBmdW5jID0gZnVuY3Rpb24oZ3JlZXRpbmcpIHtcbiAgICogICByZXR1cm4gZ3JlZXRpbmcgKyAnICcgKyB0aGlzLm5hbWU7XG4gICAqIH07XG4gICAqXG4gICAqIGZ1bmMgPSBfLmJpbmQoZnVuYywgeyAnbmFtZSc6ICdtb2UnIH0sICdoaScpO1xuICAgKiBmdW5jKCk7XG4gICAqIC8vID0+ICdoaSBtb2UnXG4gICAqL1xuICBmdW5jdGlvbiBiaW5kKGZ1bmMsIHRoaXNBcmcpIHtcbiAgICAvLyB1c2UgYEZ1bmN0aW9uI2JpbmRgIGlmIGl0IGV4aXN0cyBhbmQgaXMgZmFzdFxuICAgIC8vIChpbiBWOCBgRnVuY3Rpb24jYmluZGAgaXMgc2xvd2VyIGV4Y2VwdCB3aGVuIHBhcnRpYWxseSBhcHBsaWVkKVxuICAgIHJldHVybiBpc0JpbmRGYXN0IHx8IChuYXRpdmVCaW5kICYmIGFyZ3VtZW50cy5sZW5ndGggPiAyKVxuICAgICAgPyBuYXRpdmVCaW5kLmNhbGwuYXBwbHkobmF0aXZlQmluZCwgYXJndW1lbnRzKVxuICAgICAgOiBjcmVhdGVCb3VuZChmdW5jLCB0aGlzQXJnLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMikpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJpbmRzIG1ldGhvZHMgb24gYG9iamVjdGAgdG8gYG9iamVjdGAsIG92ZXJ3cml0aW5nIHRoZSBleGlzdGluZyBtZXRob2QuXG4gICAqIElmIG5vIG1ldGhvZCBuYW1lcyBhcmUgcHJvdmlkZWQsIGFsbCB0aGUgZnVuY3Rpb24gcHJvcGVydGllcyBvZiBgb2JqZWN0YFxuICAgKiB3aWxsIGJlIGJvdW5kLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGJpbmQgYW5kIGFzc2lnbiB0aGUgYm91bmQgbWV0aG9kcyB0by5cbiAgICogQHBhcmFtIHtTdHJpbmd9IFttZXRob2ROYW1lMSwgbWV0aG9kTmFtZTIsIC4uLl0gTWV0aG9kIG5hbWVzIG9uIHRoZSBvYmplY3QgdG8gYmluZC5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIGJ1dHRvblZpZXcgPSB7XG4gICAqICAnbGFiZWwnOiAnbG9kYXNoJyxcbiAgICogICdvbkNsaWNrJzogZnVuY3Rpb24oKSB7IGFsZXJ0KCdjbGlja2VkOiAnICsgdGhpcy5sYWJlbCk7IH1cbiAgICogfTtcbiAgICpcbiAgICogXy5iaW5kQWxsKGJ1dHRvblZpZXcpO1xuICAgKiBqUXVlcnkoJyNsb2Rhc2hfYnV0dG9uJykub24oJ2NsaWNrJywgYnV0dG9uVmlldy5vbkNsaWNrKTtcbiAgICogLy8gPT4gV2hlbiB0aGUgYnV0dG9uIGlzIGNsaWNrZWQsIGB0aGlzLmxhYmVsYCB3aWxsIGhhdmUgdGhlIGNvcnJlY3QgdmFsdWVcbiAgICovXG4gIGZ1bmN0aW9uIGJpbmRBbGwob2JqZWN0KSB7XG4gICAgdmFyIGZ1bmNzID0gYXJndW1lbnRzLFxuICAgICAgICBpbmRleCA9IGZ1bmNzLmxlbmd0aCA+IDEgPyAwIDogKGZ1bmNzID0gZnVuY3Rpb25zKG9iamVjdCksIC0xKSxcbiAgICAgICAgbGVuZ3RoID0gZnVuY3MubGVuZ3RoO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHZhciBrZXkgPSBmdW5jc1tpbmRleF07XG4gICAgICBvYmplY3Rba2V5XSA9IGJpbmQob2JqZWN0W2tleV0sIG9iamVjdCk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3Q7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaXMgdGhlIGNvbXBvc2l0aW9uIG9mIHRoZSBwYXNzZWQgZnVuY3Rpb25zLFxuICAgKiB3aGVyZSBlYWNoIGZ1bmN0aW9uIGNvbnN1bWVzIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgZm9sbG93cy5cbiAgICogSW4gbWF0aCB0ZXJtcywgY29tcG9zaW5nIHRoZSBmdW5jdGlvbnMgYGYoKWAsIGBnKClgLCBhbmQgYGgoKWAgcHJvZHVjZXMgYGYoZyhoKCkpKWAuXG4gICAqIEVhY2ggZnVuY3Rpb24gaXMgZXhlY3V0ZWQgd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlIGNvbXBvc2VkIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2Z1bmMxLCBmdW5jMiwgLi4uXSBGdW5jdGlvbnMgdG8gY29tcG9zZS5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgY29tcG9zZWQgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBncmVldCA9IGZ1bmN0aW9uKG5hbWUpIHsgcmV0dXJuICdoaTogJyArIG5hbWU7IH07XG4gICAqIHZhciBleGNsYWltID0gZnVuY3Rpb24oc3RhdGVtZW50KSB7IHJldHVybiBzdGF0ZW1lbnQgKyAnISc7IH07XG4gICAqIHZhciB3ZWxjb21lID0gXy5jb21wb3NlKGV4Y2xhaW0sIGdyZWV0KTtcbiAgICogd2VsY29tZSgnbW9lJyk7XG4gICAqIC8vID0+ICdoaTogbW9lISdcbiAgICovXG4gIGZ1bmN0aW9uIGNvbXBvc2UoKSB7XG4gICAgdmFyIGZ1bmNzID0gYXJndW1lbnRzO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxuICAgICAgICAgIGxlbmd0aCA9IGZ1bmNzLmxlbmd0aDtcblxuICAgICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICAgIGFyZ3MgPSBbZnVuY3NbbGVuZ3RoXS5hcHBseSh0aGlzLCBhcmdzKV07XG4gICAgICB9XG4gICAgICByZXR1cm4gYXJnc1swXTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgZGVsYXkgdGhlIGV4ZWN1dGlvbiBvZiBgZnVuY2AgdW50aWwgYWZ0ZXJcbiAgICogYHdhaXRgIG1pbGxpc2Vjb25kcyBoYXZlIGVsYXBzZWQgc2luY2UgdGhlIGxhc3QgdGltZSBpdCB3YXMgaW52b2tlZC4gUGFzc1xuICAgKiBgdHJ1ZWAgZm9yIGBpbW1lZGlhdGVgIHRvIGNhdXNlIGRlYm91bmNlIHRvIGludm9rZSBgZnVuY2Agb24gdGhlIGxlYWRpbmcsXG4gICAqIGluc3RlYWQgb2YgdGhlIHRyYWlsaW5nLCBlZGdlIG9mIHRoZSBgd2FpdGAgdGltZW91dC4gU3Vic2VxdWVudCBjYWxscyB0b1xuICAgKiB0aGUgZGVib3VuY2VkIGZ1bmN0aW9uIHdpbGwgcmV0dXJuIHRoZSByZXN1bHQgb2YgdGhlIGxhc3QgYGZ1bmNgIGNhbGwuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBkZWJvdW5jZS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHdhaXQgVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdG8gZGVsYXkuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gaW1tZWRpYXRlIEEgZmxhZyB0byBpbmRpY2F0ZSBleGVjdXRpb24gaXMgb24gdGhlIGxlYWRpbmdcbiAgICogIGVkZ2Ugb2YgdGhlIHRpbWVvdXQuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGRlYm91bmNlZCBmdW5jdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIGxhenlMYXlvdXQgPSBfLmRlYm91bmNlKGNhbGN1bGF0ZUxheW91dCwgMzAwKTtcbiAgICogalF1ZXJ5KHdpbmRvdykub24oJ3Jlc2l6ZScsIGxhenlMYXlvdXQpO1xuICAgKi9cbiAgZnVuY3Rpb24gZGVib3VuY2UoZnVuYywgd2FpdCwgaW1tZWRpYXRlKSB7XG4gICAgdmFyIGFyZ3MsXG4gICAgICAgIHJlc3VsdCxcbiAgICAgICAgdGhpc0FyZyxcbiAgICAgICAgdGltZW91dElkO1xuXG4gICAgZnVuY3Rpb24gZGVsYXllZCgpIHtcbiAgICAgIHRpbWVvdXRJZCA9IG51bGw7XG4gICAgICBpZiAoIWltbWVkaWF0ZSkge1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3MpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaXNJbW1lZGlhdGUgPSBpbW1lZGlhdGUgJiYgIXRpbWVvdXRJZDtcbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICB0aGlzQXJnID0gdGhpcztcblxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KGRlbGF5ZWQsIHdhaXQpO1xuXG4gICAgICBpZiAoaXNJbW1lZGlhdGUpIHtcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyB0aGUgYGZ1bmNgIGZ1bmN0aW9uIGFmdGVyIGB3YWl0YCBtaWxsaXNlY29uZHMuIEFkZGl0aW9uYWwgYXJndW1lbnRzXG4gICAqIHdpbGwgYmUgcGFzc2VkIHRvIGBmdW5jYCB3aGVuIGl0IGlzIGludm9rZWQuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBkZWxheS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHdhaXQgVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdG8gZGVsYXkgZXhlY3V0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbYXJnMSwgYXJnMiwgLi4uXSBBcmd1bWVudHMgdG8gaW52b2tlIHRoZSBmdW5jdGlvbiB3aXRoLlxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSBSZXR1cm5zIHRoZSBgc2V0VGltZW91dGAgdGltZW91dCBpZC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIGxvZyA9IF8uYmluZChjb25zb2xlLmxvZywgY29uc29sZSk7XG4gICAqIF8uZGVsYXkobG9nLCAxMDAwLCAnbG9nZ2VkIGxhdGVyJyk7XG4gICAqIC8vID0+ICdsb2dnZWQgbGF0ZXInIChBcHBlYXJzIGFmdGVyIG9uZSBzZWNvbmQuKVxuICAgKi9cbiAgZnVuY3Rpb24gZGVsYXkoZnVuYywgd2FpdCkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBmdW5jLmFwcGx5KHVuZGVmaW5lZCwgYXJncyk7IH0sIHdhaXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlZmVycyBleGVjdXRpbmcgdGhlIGBmdW5jYCBmdW5jdGlvbiB1bnRpbCB0aGUgY3VycmVudCBjYWxsIHN0YWNrIGhhcyBjbGVhcmVkLlxuICAgKiBBZGRpdGlvbmFsIGFyZ3VtZW50cyB3aWxsIGJlIHBhc3NlZCB0byBgZnVuY2Agd2hlbiBpdCBpcyBpbnZva2VkLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gZGVmZXIuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFthcmcxLCBhcmcyLCAuLi5dIEFyZ3VtZW50cyB0byBpbnZva2UgdGhlIGZ1bmN0aW9uIHdpdGguXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IFJldHVybnMgdGhlIGBzZXRUaW1lb3V0YCB0aW1lb3V0IGlkLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmRlZmVyKGZ1bmN0aW9uKCkgeyBhbGVydCgnZGVmZXJyZWQnKTsgfSk7XG4gICAqIC8vIHJldHVybnMgZnJvbSB0aGUgZnVuY3Rpb24gYmVmb3JlIGBhbGVydGAgaXMgY2FsbGVkXG4gICAqL1xuICBmdW5jdGlvbiBkZWZlcihmdW5jKSB7XG4gICAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IGZ1bmMuYXBwbHkodW5kZWZpbmVkLCBhcmdzKTsgfSwgMSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gY2FsbGVkLCBpbnZva2VzIGBvYmplY3RbbWV0aG9kTmFtZV1gIGFuZFxuICAgKiBwcmVwZW5kcyBhbnkgYWRkaXRpb25hbCBgbGF0ZUJpbmRgIGFyZ3VtZW50cyB0byB0aG9zZSBwYXNzZWQgdG8gdGhlIGJvdW5kXG4gICAqIGZ1bmN0aW9uLiBUaGlzIG1ldGhvZCBkaWZmZXJzIGZyb20gYF8uYmluZGAgYnkgYWxsb3dpbmcgYm91bmQgZnVuY3Rpb25zIHRvXG4gICAqIHJlZmVyZW5jZSBtZXRob2RzIHRoYXQgd2lsbCBiZSByZWRlZmluZWQgb3IgZG9uJ3QgeWV0IGV4aXN0LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRoZSBtZXRob2QgYmVsb25ncyB0by5cbiAgICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZE5hbWUgVGhlIG1ldGhvZCBuYW1lLlxuICAgKiBAcGFyYW0ge01peGVkfSBbYXJnMSwgYXJnMiwgLi4uXSBBcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGJvdW5kIGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgb2JqZWN0ID0ge1xuICAgKiAgICduYW1lJzogJ21vZScsXG4gICAqICAgJ2dyZWV0JzogZnVuY3Rpb24oZ3JlZXRpbmcpIHtcbiAgICogICAgIHJldHVybiBncmVldGluZyArICcgJyArIHRoaXMubmFtZTtcbiAgICogICB9XG4gICAqIH07XG4gICAqXG4gICAqIHZhciBmdW5jID0gXy5sYXRlQmluZChvYmplY3QsICdncmVldCcsICdoaScpO1xuICAgKiBmdW5jKCk7XG4gICAqIC8vID0+ICdoaSBtb2UnXG4gICAqXG4gICAqIG9iamVjdC5ncmVldCA9IGZ1bmN0aW9uKGdyZWV0aW5nKSB7XG4gICAqICAgcmV0dXJuIGdyZWV0aW5nICsgJywgJyArIHRoaXMubmFtZSArICchJztcbiAgICogfTtcbiAgICpcbiAgICogZnVuYygpO1xuICAgKiAvLyA9PiAnaGksIG1vZSEnXG4gICAqL1xuICBmdW5jdGlvbiBsYXRlQmluZChvYmplY3QsIG1ldGhvZE5hbWUpIHtcbiAgICByZXR1cm4gY3JlYXRlQm91bmQobWV0aG9kTmFtZSwgb2JqZWN0LCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMikpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IG1lbW9pemVzIHRoZSByZXN1bHQgb2YgYGZ1bmNgLiBJZiBgcmVzb2x2ZXJgIGlzXG4gICAqIHBhc3NlZCwgaXQgd2lsbCBiZSB1c2VkIHRvIGRldGVybWluZSB0aGUgY2FjaGUga2V5IGZvciBzdG9yaW5nIHRoZSByZXN1bHRcbiAgICogYmFzZWQgb24gdGhlIGFyZ3VtZW50cyBwYXNzZWQgdG8gdGhlIG1lbW9pemVkIGZ1bmN0aW9uLiBCeSBkZWZhdWx0LCB0aGUgZmlyc3RcbiAgICogYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBtZW1vaXplZCBmdW5jdGlvbiBpcyB1c2VkIGFzIHRoZSBjYWNoZSBrZXkuIFRoZSBgZnVuY2BcbiAgICogaXMgZXhlY3V0ZWQgd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlIG1lbW9pemVkIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gaGF2ZSBpdHMgb3V0cHV0IG1lbW9pemVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbcmVzb2x2ZXJdIEEgZnVuY3Rpb24gdXNlZCB0byByZXNvbHZlIHRoZSBjYWNoZSBrZXkuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IG1lbW9pemluZyBmdW5jdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIGZpYm9uYWNjaSA9IF8ubWVtb2l6ZShmdW5jdGlvbihuKSB7XG4gICAqICAgcmV0dXJuIG4gPCAyID8gbiA6IGZpYm9uYWNjaShuIC0gMSkgKyBmaWJvbmFjY2kobiAtIDIpO1xuICAgKiB9KTtcbiAgICovXG4gIGZ1bmN0aW9uIG1lbW9pemUoZnVuYywgcmVzb2x2ZXIpIHtcbiAgICB2YXIgY2FjaGUgPSB7fTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIga2V5ID0gcmVzb2x2ZXIgPyByZXNvbHZlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpIDogYXJndW1lbnRzWzBdO1xuICAgICAgcmV0dXJuIGhhc093blByb3BlcnR5LmNhbGwoY2FjaGUsIGtleSlcbiAgICAgICAgPyBjYWNoZVtrZXldXG4gICAgICAgIDogKGNhY2hlW2tleV0gPSBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykpO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaXMgcmVzdHJpY3RlZCB0byBleGVjdXRlIGBmdW5jYCBvbmNlLiBSZXBlYXQgY2FsbHMgdG9cbiAgICogdGhlIGZ1bmN0aW9uIHdpbGwgcmV0dXJuIHRoZSB2YWx1ZSBvZiB0aGUgZmlyc3QgY2FsbC4gVGhlIGBmdW5jYCBpcyBleGVjdXRlZFxuICAgKiB3aXRoIHRoZSBgdGhpc2AgYmluZGluZyBvZiB0aGUgY3JlYXRlZCBmdW5jdGlvbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHJlc3RyaWN0LlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyByZXN0cmljdGVkIGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgaW5pdGlhbGl6ZSA9IF8ub25jZShjcmVhdGVBcHBsaWNhdGlvbik7XG4gICAqIGluaXRpYWxpemUoKTtcbiAgICogaW5pdGlhbGl6ZSgpO1xuICAgKiAvLyBBcHBsaWNhdGlvbiBpcyBvbmx5IGNyZWF0ZWQgb25jZS5cbiAgICovXG4gIGZ1bmN0aW9uIG9uY2UoZnVuYykge1xuICAgIHZhciByZXN1bHQsXG4gICAgICAgIHJhbiA9IGZhbHNlO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHJhbikge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgICAgcmFuID0gdHJ1ZTtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgICAgLy8gY2xlYXIgdGhlIGBmdW5jYCB2YXJpYWJsZSBzbyB0aGUgZnVuY3Rpb24gbWF5IGJlIGdhcmJhZ2UgY29sbGVjdGVkXG4gICAgICBmdW5jID0gbnVsbDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCwgd2hlbiBjYWxsZWQsIGludm9rZXMgYGZ1bmNgIHdpdGggYW55IGFkZGl0aW9uYWxcbiAgICogYHBhcnRpYWxgIGFyZ3VtZW50cyBwcmVwZW5kZWQgdG8gdGhvc2UgcGFzc2VkIHRvIHRoZSBuZXcgZnVuY3Rpb24uIFRoaXNcbiAgICogbWV0aG9kIGlzIHNpbWlsYXIgdG8gYGJpbmRgLCBleGNlcHQgaXQgZG9lcyAqKm5vdCoqIGFsdGVyIHRoZSBgdGhpc2AgYmluZGluZy5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHBhcnRpYWxseSBhcHBseSBhcmd1bWVudHMgdG8uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFthcmcxLCBhcmcyLCAuLi5dIEFyZ3VtZW50cyB0byBiZSBwYXJ0aWFsbHkgYXBwbGllZC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcGFydGlhbGx5IGFwcGxpZWQgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBncmVldCA9IGZ1bmN0aW9uKGdyZWV0aW5nLCBuYW1lKSB7IHJldHVybiBncmVldGluZyArICc6ICcgKyBuYW1lOyB9O1xuICAgKiB2YXIgaGkgPSBfLnBhcnRpYWwoZ3JlZXQsICdoaScpO1xuICAgKiBoaSgnbW9lJyk7XG4gICAqIC8vID0+ICdoaTogbW9lJ1xuICAgKi9cbiAgZnVuY3Rpb24gcGFydGlhbChmdW5jKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJvdW5kKGZ1bmMsIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gZXhlY3V0ZWQsIHdpbGwgb25seSBjYWxsIHRoZSBgZnVuY2BcbiAgICogZnVuY3Rpb24gYXQgbW9zdCBvbmNlIHBlciBldmVyeSBgd2FpdGAgbWlsbGlzZWNvbmRzLiBJZiB0aGUgdGhyb3R0bGVkXG4gICAqIGZ1bmN0aW9uIGlzIGludm9rZWQgbW9yZSB0aGFuIG9uY2UgZHVyaW5nIHRoZSBgd2FpdGAgdGltZW91dCwgYGZ1bmNgIHdpbGxcbiAgICogYWxzbyBiZSBjYWxsZWQgb24gdGhlIHRyYWlsaW5nIGVkZ2Ugb2YgdGhlIHRpbWVvdXQuIFN1YnNlcXVlbnQgY2FsbHMgdG8gdGhlXG4gICAqIHRocm90dGxlZCBmdW5jdGlvbiB3aWxsIHJldHVybiB0aGUgcmVzdWx0IG9mIHRoZSBsYXN0IGBmdW5jYCBjYWxsLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gdGhyb3R0bGUuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB3YWl0IFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIHRocm90dGxlIGV4ZWN1dGlvbnMgdG8uXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHRocm90dGxlZCBmdW5jdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIHRocm90dGxlZCA9IF8udGhyb3R0bGUodXBkYXRlUG9zaXRpb24sIDEwMCk7XG4gICAqIGpRdWVyeSh3aW5kb3cpLm9uKCdzY3JvbGwnLCB0aHJvdHRsZWQpO1xuICAgKi9cbiAgZnVuY3Rpb24gdGhyb3R0bGUoZnVuYywgd2FpdCkge1xuICAgIHZhciBhcmdzLFxuICAgICAgICByZXN1bHQsXG4gICAgICAgIHRoaXNBcmcsXG4gICAgICAgIHRpbWVvdXRJZCxcbiAgICAgICAgbGFzdENhbGxlZCA9IDA7XG5cbiAgICBmdW5jdGlvbiB0cmFpbGluZ0NhbGwoKSB7XG4gICAgICBsYXN0Q2FsbGVkID0gbmV3IERhdGU7XG4gICAgICB0aW1lb3V0SWQgPSBudWxsO1xuICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG5vdyA9IG5ldyBEYXRlLFxuICAgICAgICAgIHJlbWFpbmluZyA9IHdhaXQgLSAobm93IC0gbGFzdENhbGxlZCk7XG5cbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICB0aGlzQXJnID0gdGhpcztcblxuICAgICAgaWYgKHJlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICBsYXN0Q2FsbGVkID0gbm93O1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3MpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoIXRpbWVvdXRJZCkge1xuICAgICAgICB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KHRyYWlsaW5nQ2FsbCwgcmVtYWluaW5nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBwYXNzZXMgYHZhbHVlYCB0byB0aGUgYHdyYXBwZXJgIGZ1bmN0aW9uIGFzIGl0c1xuICAgKiBmaXJzdCBhcmd1bWVudC4gQWRkaXRpb25hbCBhcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBmdW5jdGlvbiBhcmUgYXBwZW5kZWRcbiAgICogdG8gdGhvc2UgcGFzc2VkIHRvIHRoZSBgd3JhcHBlcmAgZnVuY3Rpb24uIFRoZSBgd3JhcHBlcmAgaXMgZXhlY3V0ZWQgd2l0aFxuICAgKiB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlIGNyZWF0ZWQgZnVuY3Rpb24uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gd3JhcC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gd3JhcHBlciBUaGUgd3JhcHBlciBmdW5jdGlvbi5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBoZWxsbyA9IGZ1bmN0aW9uKG5hbWUpIHsgcmV0dXJuICdoZWxsbyAnICsgbmFtZTsgfTtcbiAgICogaGVsbG8gPSBfLndyYXAoaGVsbG8sIGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICogICByZXR1cm4gJ2JlZm9yZSwgJyArIGZ1bmMoJ21vZScpICsgJywgYWZ0ZXInO1xuICAgKiB9KTtcbiAgICogaGVsbG8oKTtcbiAgICogLy8gPT4gJ2JlZm9yZSwgaGVsbG8gbW9lLCBhZnRlcidcbiAgICovXG4gIGZ1bmN0aW9uIHdyYXAodmFsdWUsIHdyYXBwZXIpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IFt2YWx1ZV07XG4gICAgICBwdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICByZXR1cm4gd3JhcHBlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9O1xuICB9XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIHRoZSBjaGFyYWN0ZXJzIGAmYCwgYDxgLCBgPmAsIGBcImAsIGFuZCBgJ2AgaW4gYHN0cmluZ2AgdG8gdGhlaXJcbiAgICogY29ycmVzcG9uZGluZyBIVE1MIGVudGl0aWVzLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZyBUaGUgc3RyaW5nIHRvIGVzY2FwZS5cbiAgICogQHJldHVybnMge1N0cmluZ30gUmV0dXJucyB0aGUgZXNjYXBlZCBzdHJpbmcuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uZXNjYXBlKCdNb2UsIExhcnJ5ICYgQ3VybHknKTtcbiAgICogLy8gPT4gXCJNb2UsIExhcnJ5ICZhbXA7IEN1cmx5XCJcbiAgICovXG4gIGZ1bmN0aW9uIGVzY2FwZShzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nID09IG51bGwgPyAnJyA6IChzdHJpbmcgKyAnJykucmVwbGFjZShyZVVuZXNjYXBlZEh0bWwsIGVzY2FwZUh0bWxDaGFyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIGZ1bmN0aW9uIHJldHVybnMgdGhlIGZpcnN0IGFyZ3VtZW50IHBhc3NlZCB0byBpdC5cbiAgICpcbiAgICogTm90ZTogSXQgaXMgdXNlZCB0aHJvdWdob3V0IExvLURhc2ggYXMgYSBkZWZhdWx0IGNhbGxiYWNrLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgQW55IHZhbHVlLlxuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgYHZhbHVlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIG1vZSA9IHsgJ25hbWUnOiAnbW9lJyB9O1xuICAgKiBtb2UgPT09IF8uaWRlbnRpdHkobW9lKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKi9cbiAgZnVuY3Rpb24gaWRlbnRpdHkodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBmdW5jdGlvbnMgcHJvcGVydGllcyBvZiBgb2JqZWN0YCB0byB0aGUgYGxvZGFzaGAgZnVuY3Rpb24gYW5kIGNoYWluYWJsZVxuICAgKiB3cmFwcGVyLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IG9mIGZ1bmN0aW9uIHByb3BlcnRpZXMgdG8gYWRkIHRvIGBsb2Rhc2hgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLm1peGluKHtcbiAgICogICAnY2FwaXRhbGl6ZSc6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgKiAgICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKS50b0xvd2VyQ2FzZSgpO1xuICAgKiAgIH1cbiAgICogfSk7XG4gICAqXG4gICAqIF8uY2FwaXRhbGl6ZSgnbGFycnknKTtcbiAgICogLy8gPT4gJ0xhcnJ5J1xuICAgKlxuICAgKiBfKCdjdXJseScpLmNhcGl0YWxpemUoKTtcbiAgICogLy8gPT4gJ0N1cmx5J1xuICAgKi9cbiAgZnVuY3Rpb24gbWl4aW4ob2JqZWN0KSB7XG4gICAgZm9yRWFjaChmdW5jdGlvbnMob2JqZWN0KSwgZnVuY3Rpb24obWV0aG9kTmFtZSkge1xuICAgICAgdmFyIGZ1bmMgPSBsb2Rhc2hbbWV0aG9kTmFtZV0gPSBvYmplY3RbbWV0aG9kTmFtZV07XG5cbiAgICAgIGxvZGFzaC5wcm90b3R5cGVbbWV0aG9kTmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbdGhpcy5fX3dyYXBwZWRfX107XG4gICAgICAgIHB1c2guYXBwbHkoYXJncywgYXJndW1lbnRzKTtcblxuICAgICAgICB2YXIgcmVzdWx0ID0gZnVuYy5hcHBseShsb2Rhc2gsIGFyZ3MpO1xuICAgICAgICBpZiAodGhpcy5fX2NoYWluX18pIHtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgbG9kYXNoKHJlc3VsdCk7XG4gICAgICAgICAgcmVzdWx0Ll9fY2hhaW5fXyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV2ZXJ0cyB0aGUgJ18nIHZhcmlhYmxlIHRvIGl0cyBwcmV2aW91cyB2YWx1ZSBhbmQgcmV0dXJucyBhIHJlZmVyZW5jZSB0b1xuICAgKiB0aGUgYGxvZGFzaGAgZnVuY3Rpb24uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIGBsb2Rhc2hgIGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgbG9kYXNoID0gXy5ub0NvbmZsaWN0KCk7XG4gICAqL1xuICBmdW5jdGlvbiBub0NvbmZsaWN0KCkge1xuICAgIHdpbmRvdy5fID0gb2xkRGFzaDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9kdWNlcyBhIHJhbmRvbSBudW1iZXIgYmV0d2VlbiBgbWluYCBhbmQgYG1heGAgKGluY2x1c2l2ZSkuIElmIG9ubHkgb25lXG4gICAqIGFyZ3VtZW50IGlzIHBhc3NlZCwgYSBudW1iZXIgYmV0d2VlbiBgMGAgYW5kIHRoZSBnaXZlbiBudW1iZXIgd2lsbCBiZSByZXR1cm5lZC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbbWluPTBdIFRoZSBtaW5pbXVtIHBvc3NpYmxlIHZhbHVlLlxuICAgKiBAcGFyYW0ge051bWJlcn0gW21heD0xXSBUaGUgbWF4aW11bSBwb3NzaWJsZSB2YWx1ZS5cbiAgICogQHJldHVybnMge051bWJlcn0gUmV0dXJucyBhIHJhbmRvbSBudW1iZXIuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ucmFuZG9tKDAsIDUpO1xuICAgKiAvLyA9PiBhIG51bWJlciBiZXR3ZWVuIDEgYW5kIDVcbiAgICpcbiAgICogXy5yYW5kb20oNSk7XG4gICAqIC8vID0+IGFsc28gYSBudW1iZXIgYmV0d2VlbiAxIGFuZCA1XG4gICAqL1xuICBmdW5jdGlvbiByYW5kb20obWluLCBtYXgpIHtcbiAgICBpZiAobWluID09IG51bGwgJiYgbWF4ID09IG51bGwpIHtcbiAgICAgIG1heCA9IDE7XG4gICAgfVxuICAgIG1pbiA9ICttaW4gfHwgMDtcbiAgICBpZiAobWF4ID09IG51bGwpIHtcbiAgICAgIG1heCA9IG1pbjtcbiAgICAgIG1pbiA9IDA7XG4gICAgfVxuICAgIHJldHVybiBtaW4gKyBmbG9vcihuYXRpdmVSYW5kb20oKSAqICgoK21heCB8fCAwKSAtIG1pbiArIDEpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNvbHZlcyB0aGUgdmFsdWUgb2YgYHByb3BlcnR5YCBvbiBgb2JqZWN0YC4gSWYgYHByb3BlcnR5YCBpcyBhIGZ1bmN0aW9uXG4gICAqIGl0IHdpbGwgYmUgaW52b2tlZCBhbmQgaXRzIHJlc3VsdCByZXR1cm5lZCwgZWxzZSB0aGUgcHJvcGVydHkgdmFsdWUgaXNcbiAgICogcmV0dXJuZWQuIElmIGBvYmplY3RgIGlzIGZhbHNleSwgdGhlbiBgbnVsbGAgaXMgcmV0dXJuZWQuXG4gICAqXG4gICAqIEBkZXByZWNhdGVkXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW5zcGVjdC5cbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5IFRoZSBwcm9wZXJ0eSB0byBnZXQgdGhlIHZhbHVlIG9mLlxuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgdGhlIHJlc29sdmVkIHZhbHVlLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgb2JqZWN0ID0ge1xuICAgKiAgICdjaGVlc2UnOiAnY3J1bXBldHMnLFxuICAgKiAgICdzdHVmZic6IGZ1bmN0aW9uKCkge1xuICAgKiAgICAgcmV0dXJuICdub25zZW5zZSc7XG4gICAqICAgfVxuICAgKiB9O1xuICAgKlxuICAgKiBfLnJlc3VsdChvYmplY3QsICdjaGVlc2UnKTtcbiAgICogLy8gPT4gJ2NydW1wZXRzJ1xuICAgKlxuICAgKiBfLnJlc3VsdChvYmplY3QsICdzdHVmZicpO1xuICAgKiAvLyA9PiAnbm9uc2Vuc2UnXG4gICAqL1xuICBmdW5jdGlvbiByZXN1bHQob2JqZWN0LCBwcm9wZXJ0eSkge1xuICAgIC8vIGJhc2VkIG9uIEJhY2tib25lJ3MgcHJpdmF0ZSBgZ2V0VmFsdWVgIGZ1bmN0aW9uXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2RvY3VtZW50Y2xvdWQvYmFja2JvbmUvYmxvYi8wLjkuMi9iYWNrYm9uZS5qcyNMMTQxOS0xNDI0XG4gICAgdmFyIHZhbHVlID0gb2JqZWN0ID8gb2JqZWN0W3Byb3BlcnR5XSA6IG51bGw7XG4gICAgcmV0dXJuIGlzRnVuY3Rpb24odmFsdWUpID8gb2JqZWN0W3Byb3BlcnR5XSgpIDogdmFsdWU7XG4gIH1cblxuICAvKipcbiAgICogQSBtaWNyby10ZW1wbGF0aW5nIG1ldGhvZCB0aGF0IGhhbmRsZXMgYXJiaXRyYXJ5IGRlbGltaXRlcnMsIHByZXNlcnZlc1xuICAgKiB3aGl0ZXNwYWNlLCBhbmQgY29ycmVjdGx5IGVzY2FwZXMgcXVvdGVzIHdpdGhpbiBpbnRlcnBvbGF0ZWQgY29kZS5cbiAgICpcbiAgICogTm90ZTogSW4gdGhlIGRldmVsb3BtZW50IGJ1aWxkIGBfLnRlbXBsYXRlYCB1dGlsaXplcyBzb3VyY2VVUkxzIGZvciBlYXNpZXJcbiAgICogZGVidWdnaW5nLiBTZWUgaHR0cDovL3d3dy5odG1sNXJvY2tzLmNvbS9lbi90dXRvcmlhbHMvZGV2ZWxvcGVydG9vbHMvc291cmNlbWFwcy8jdG9jLXNvdXJjZXVybFxuICAgKlxuICAgKiBOb3RlOiBMby1EYXNoIG1heSBiZSB1c2VkIGluIENocm9tZSBleHRlbnNpb25zIGJ5IGVpdGhlciBjcmVhdGluZyBhIGBsb2Rhc2ggY3NwYFxuICAgKiBidWlsZCBhbmQgYXZvaWRpbmcgYF8udGVtcGxhdGVgIHVzZSwgb3IgbG9hZGluZyBMby1EYXNoIGluIGEgc2FuZGJveGVkIHBhZ2UuXG4gICAqIFNlZSBodHRwOi8vZGV2ZWxvcGVyLmNocm9tZS5jb20vdHJ1bmsvZXh0ZW5zaW9ucy9zYW5kYm94aW5nRXZhbC5odG1sXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dCBUaGUgdGVtcGxhdGUgdGV4dC5cbiAgICogQHBhcmFtIHtPYmVjdH0gZGF0YSBUaGUgZGF0YSBvYmplY3QgdXNlZCB0byBwb3B1bGF0ZSB0aGUgdGV4dC5cbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiAgZXNjYXBlIC0gVGhlIFwiZXNjYXBlXCIgZGVsaW1pdGVyIHJlZ2V4cC5cbiAgICogIGV2YWx1YXRlIC0gVGhlIFwiZXZhbHVhdGVcIiBkZWxpbWl0ZXIgcmVnZXhwLlxuICAgKiAgaW50ZXJwb2xhdGUgLSBUaGUgXCJpbnRlcnBvbGF0ZVwiIGRlbGltaXRlciByZWdleHAuXG4gICAqICBzb3VyY2VVUkwgLSBUaGUgc291cmNlVVJMIG9mIHRoZSB0ZW1wbGF0ZSdzIGNvbXBpbGVkIHNvdXJjZS5cbiAgICogIHZhcmlhYmxlIC0gVGhlIGRhdGEgb2JqZWN0IHZhcmlhYmxlIG5hbWUuXG4gICAqXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbnxTdHJpbmd9IFJldHVybnMgYSBjb21waWxlZCBmdW5jdGlvbiB3aGVuIG5vIGBkYXRhYCBvYmplY3RcbiAgICogIGlzIGdpdmVuLCBlbHNlIGl0IHJldHVybnMgdGhlIGludGVycG9sYXRlZCB0ZXh0LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiAvLyB1c2luZyBhIGNvbXBpbGVkIHRlbXBsYXRlXG4gICAqIHZhciBjb21waWxlZCA9IF8udGVtcGxhdGUoJ2hlbGxvIDwlPSBuYW1lICU+Jyk7XG4gICAqIGNvbXBpbGVkKHsgJ25hbWUnOiAnbW9lJyB9KTtcbiAgICogLy8gPT4gJ2hlbGxvIG1vZSdcbiAgICpcbiAgICogdmFyIGxpc3QgPSAnPCUgXy5mb3JFYWNoKHBlb3BsZSwgZnVuY3Rpb24obmFtZSkgeyAlPjxsaT48JT0gbmFtZSAlPjwvbGk+PCUgfSk7ICU+JztcbiAgICogXy50ZW1wbGF0ZShsaXN0LCB7ICdwZW9wbGUnOiBbJ21vZScsICdsYXJyeScsICdjdXJseSddIH0pO1xuICAgKiAvLyA9PiAnPGxpPm1vZTwvbGk+PGxpPmxhcnJ5PC9saT48bGk+Y3VybHk8L2xpPidcbiAgICpcbiAgICogLy8gdXNpbmcgdGhlIFwiZXNjYXBlXCIgZGVsaW1pdGVyIHRvIGVzY2FwZSBIVE1MIGluIGRhdGEgcHJvcGVydHkgdmFsdWVzXG4gICAqIF8udGVtcGxhdGUoJzxiPjwlLSB2YWx1ZSAlPjwvYj4nLCB7ICd2YWx1ZSc6ICc8c2NyaXB0PicgfSk7XG4gICAqIC8vID0+ICc8Yj4mbHQ7c2NyaXB0Jmd0OzwvYj4nXG4gICAqXG4gICAqIC8vIHVzaW5nIHRoZSBFUzYgZGVsaW1pdGVyIGFzIGFuIGFsdGVybmF0aXZlIHRvIHRoZSBkZWZhdWx0IFwiaW50ZXJwb2xhdGVcIiBkZWxpbWl0ZXJcbiAgICogXy50ZW1wbGF0ZSgnaGVsbG8gJHsgbmFtZSB9JywgeyAnbmFtZSc6ICdjdXJseScgfSk7XG4gICAqIC8vID0+ICdoZWxsbyBjdXJseSdcbiAgICpcbiAgICogLy8gdXNpbmcgdGhlIGludGVybmFsIGBwcmludGAgZnVuY3Rpb24gaW4gXCJldmFsdWF0ZVwiIGRlbGltaXRlcnNcbiAgICogXy50ZW1wbGF0ZSgnPCUgcHJpbnQoXCJoZWxsbyBcIiArIGVwaXRoZXQpOyAlPiEnLCB7ICdlcGl0aGV0JzogJ3N0b29nZScgfSk7XG4gICAqIC8vID0+ICdoZWxsbyBzdG9vZ2UhJ1xuICAgKlxuICAgKiAvLyB1c2luZyBjdXN0b20gdGVtcGxhdGUgZGVsaW1pdGVyc1xuICAgKiBfLnRlbXBsYXRlU2V0dGluZ3MgPSB7XG4gICAqICAgJ2ludGVycG9sYXRlJzogL3t7KFtcXHNcXFNdKz8pfX0vZ1xuICAgKiB9O1xuICAgKlxuICAgKiBfLnRlbXBsYXRlKCdoZWxsbyB7eyBuYW1lIH19IScsIHsgJ25hbWUnOiAnbXVzdGFjaGUnIH0pO1xuICAgKiAvLyA9PiAnaGVsbG8gbXVzdGFjaGUhJ1xuICAgKlxuICAgKiAvLyB1c2luZyB0aGUgYHNvdXJjZVVSTGAgb3B0aW9uIHRvIHNwZWNpZnkgYSBjdXN0b20gc291cmNlVVJMIGZvciB0aGUgdGVtcGxhdGVcbiAgICogdmFyIGNvbXBpbGVkID0gXy50ZW1wbGF0ZSgnaGVsbG8gPCU9IG5hbWUgJT4nLCBudWxsLCB7ICdzb3VyY2VVUkwnOiAnL2Jhc2ljL2dyZWV0aW5nLmpzdCcgfSk7XG4gICAqIGNvbXBpbGVkKGRhdGEpO1xuICAgKiAvLyA9PiBmaW5kIHRoZSBzb3VyY2Ugb2YgXCJncmVldGluZy5qc3RcIiB1bmRlciB0aGUgU291cmNlcyB0YWIgb3IgUmVzb3VyY2VzIHBhbmVsIG9mIHRoZSB3ZWIgaW5zcGVjdG9yXG4gICAqXG4gICAqIC8vIHVzaW5nIHRoZSBgdmFyaWFibGVgIG9wdGlvbiB0byBlbnN1cmUgYSB3aXRoLXN0YXRlbWVudCBpc24ndCB1c2VkIGluIHRoZSBjb21waWxlZCB0ZW1wbGF0ZVxuICAgKiB2YXIgY29tcGlsZWQgPSBfLnRlbXBsYXRlKCdoZWxsbyA8JT0gZGF0YS5uYW1lICU+IScsIG51bGwsIHsgJ3ZhcmlhYmxlJzogJ2RhdGEnIH0pO1xuICAgKiBjb21waWxlZC5zb3VyY2U7XG4gICAqIC8vID0+IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICogICB2YXIgX190LCBfX3AgPSAnJywgX19lID0gXy5lc2NhcGU7XG4gICAqICAgX19wICs9ICdoZWxsbyAnICsgKChfX3QgPSAoIGRhdGEubmFtZSApKSA9PSBudWxsID8gJycgOiBfX3QpICsgJyEnO1xuICAgKiAgIHJldHVybiBfX3A7XG4gICAqIH1cbiAgICpcbiAgICogLy8gdXNpbmcgdGhlIGBzb3VyY2VgIHByb3BlcnR5IHRvIGlubGluZSBjb21waWxlZCB0ZW1wbGF0ZXMgZm9yIG1lYW5pbmdmdWxcbiAgICogLy8gbGluZSBudW1iZXJzIGluIGVycm9yIG1lc3NhZ2VzIGFuZCBhIHN0YWNrIHRyYWNlXG4gICAqIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKGN3ZCwgJ2pzdC5qcycpLCAnXFxcbiAgICogICB2YXIgSlNUID0ge1xcXG4gICAqICAgICBcIm1haW5cIjogJyArIF8udGVtcGxhdGUobWFpblRleHQpLnNvdXJjZSArICdcXFxuICAgKiAgIH07XFxcbiAgICogJyk7XG4gICAqL1xuICBmdW5jdGlvbiB0ZW1wbGF0ZSh0ZXh0LCBkYXRhLCBvcHRpb25zKSB7XG4gICAgLy8gYmFzZWQgb24gSm9obiBSZXNpZydzIGB0bXBsYCBpbXBsZW1lbnRhdGlvblxuICAgIC8vIGh0dHA6Ly9lam9obi5vcmcvYmxvZy9qYXZhc2NyaXB0LW1pY3JvLXRlbXBsYXRpbmcvXG4gICAgLy8gYW5kIExhdXJhIERva3Rvcm92YSdzIGRvVC5qc1xuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9vbGFkby9kb1RcbiAgICB0ZXh0IHx8ICh0ZXh0ID0gJycpO1xuICAgIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG5cbiAgICB2YXIgaXNFdmFsdWF0aW5nLFxuICAgICAgICByZXN1bHQsXG4gICAgICAgIHNldHRpbmdzID0gbG9kYXNoLnRlbXBsYXRlU2V0dGluZ3MsXG4gICAgICAgIGluZGV4ID0gMCxcbiAgICAgICAgaW50ZXJwb2xhdGUgPSBvcHRpb25zLmludGVycG9sYXRlIHx8IHNldHRpbmdzLmludGVycG9sYXRlIHx8IHJlTm9NYXRjaCxcbiAgICAgICAgc291cmNlID0gXCJfX3AgKz0gJ1wiLFxuICAgICAgICB2YXJpYWJsZSA9IG9wdGlvbnMudmFyaWFibGUgfHwgc2V0dGluZ3MudmFyaWFibGUsXG4gICAgICAgIGhhc1ZhcmlhYmxlID0gdmFyaWFibGU7XG5cbiAgICAvLyBjb21waWxlIHJlZ2V4cCB0byBtYXRjaCBlYWNoIGRlbGltaXRlclxuICAgIHZhciByZURlbGltaXRlcnMgPSBSZWdFeHAoXG4gICAgICAob3B0aW9ucy5lc2NhcGUgfHwgc2V0dGluZ3MuZXNjYXBlIHx8IHJlTm9NYXRjaCkuc291cmNlICsgJ3wnICtcbiAgICAgIGludGVycG9sYXRlLnNvdXJjZSArICd8JyArXG4gICAgICAoaW50ZXJwb2xhdGUgPT09IHJlSW50ZXJwb2xhdGUgPyByZUVzVGVtcGxhdGUgOiByZU5vTWF0Y2gpLnNvdXJjZSArICd8JyArXG4gICAgICAob3B0aW9ucy5ldmFsdWF0ZSB8fCBzZXR0aW5ncy5ldmFsdWF0ZSB8fCByZU5vTWF0Y2gpLnNvdXJjZSArICd8JCdcbiAgICAsICdnJyk7XG5cbiAgICB0ZXh0LnJlcGxhY2UocmVEZWxpbWl0ZXJzLCBmdW5jdGlvbihtYXRjaCwgZXNjYXBlVmFsdWUsIGludGVycG9sYXRlVmFsdWUsIGVzVGVtcGxhdGVWYWx1ZSwgZXZhbHVhdGVWYWx1ZSwgb2Zmc2V0KSB7XG4gICAgICBpbnRlcnBvbGF0ZVZhbHVlIHx8IChpbnRlcnBvbGF0ZVZhbHVlID0gZXNUZW1wbGF0ZVZhbHVlKTtcblxuICAgICAgLy8gZXNjYXBlIGNoYXJhY3RlcnMgdGhhdCBjYW5ub3QgYmUgaW5jbHVkZWQgaW4gc3RyaW5nIGxpdGVyYWxzXG4gICAgICBzb3VyY2UgKz0gdGV4dC5zbGljZShpbmRleCwgb2Zmc2V0KS5yZXBsYWNlKHJlVW5lc2NhcGVkU3RyaW5nLCBlc2NhcGVTdHJpbmdDaGFyKTtcblxuICAgICAgLy8gcmVwbGFjZSBkZWxpbWl0ZXJzIHdpdGggc25pcHBldHNcbiAgICAgIHNvdXJjZSArPVxuICAgICAgICBlc2NhcGVWYWx1ZSA/IFwiJyArXFxuX19lKFwiICsgZXNjYXBlVmFsdWUgKyBcIikgK1xcbidcIiA6XG4gICAgICAgIGV2YWx1YXRlVmFsdWUgPyBcIic7XFxuXCIgKyBldmFsdWF0ZVZhbHVlICsgXCI7XFxuX19wICs9ICdcIiA6XG4gICAgICAgIGludGVycG9sYXRlVmFsdWUgPyBcIicgK1xcbigoX190ID0gKFwiICsgaW50ZXJwb2xhdGVWYWx1ZSArIFwiKSkgPT0gbnVsbCA/ICcnIDogX190KSArXFxuJ1wiIDogJyc7XG5cbiAgICAgIGlzRXZhbHVhdGluZyB8fCAoaXNFdmFsdWF0aW5nID0gZXZhbHVhdGVWYWx1ZSB8fCByZUNvbXBsZXhEZWxpbWl0ZXIudGVzdChlc2NhcGVWYWx1ZSB8fCBpbnRlcnBvbGF0ZVZhbHVlKSk7XG4gICAgICBpbmRleCA9IG9mZnNldCArIG1hdGNoLmxlbmd0aDtcbiAgICB9KTtcblxuICAgIHNvdXJjZSArPSBcIic7XFxuXCI7XG5cbiAgICAvLyBpZiBgdmFyaWFibGVgIGlzIG5vdCBzcGVjaWZpZWQgYW5kIHRoZSB0ZW1wbGF0ZSBjb250YWlucyBcImV2YWx1YXRlXCJcbiAgICAvLyBkZWxpbWl0ZXJzLCB3cmFwIGEgd2l0aC1zdGF0ZW1lbnQgYXJvdW5kIHRoZSBnZW5lcmF0ZWQgY29kZSB0byBhZGQgdGhlXG4gICAgLy8gZGF0YSBvYmplY3QgdG8gdGhlIHRvcCBvZiB0aGUgc2NvcGUgY2hhaW5cbiAgICBpZiAoIWhhc1ZhcmlhYmxlKSB7XG4gICAgICB2YXJpYWJsZSA9ICdvYmonO1xuICAgICAgaWYgKGlzRXZhbHVhdGluZykge1xuICAgICAgICBzb3VyY2UgPSAnd2l0aCAoJyArIHZhcmlhYmxlICsgJykge1xcbicgKyBzb3VyY2UgKyAnXFxufVxcbic7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgLy8gYXZvaWQgYSB3aXRoLXN0YXRlbWVudCBieSBwcmVwZW5kaW5nIGRhdGEgb2JqZWN0IHJlZmVyZW5jZXMgdG8gcHJvcGVydHkgbmFtZXNcbiAgICAgICAgdmFyIHJlRG91YmxlVmFyaWFibGUgPSBSZWdFeHAoJyhcXFxcKFxcXFxzKiknICsgdmFyaWFibGUgKyAnXFxcXC4nICsgdmFyaWFibGUgKyAnXFxcXGInLCAnZycpO1xuICAgICAgICBzb3VyY2UgPSBzb3VyY2VcbiAgICAgICAgICAucmVwbGFjZShyZUluc2VydFZhcmlhYmxlLCAnJCYnICsgdmFyaWFibGUgKyAnLicpXG4gICAgICAgICAgLnJlcGxhY2UocmVEb3VibGVWYXJpYWJsZSwgJyQxX19kJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gY2xlYW51cCBjb2RlIGJ5IHN0cmlwcGluZyBlbXB0eSBzdHJpbmdzXG4gICAgc291cmNlID0gKGlzRXZhbHVhdGluZyA/IHNvdXJjZS5yZXBsYWNlKHJlRW1wdHlTdHJpbmdMZWFkaW5nLCAnJykgOiBzb3VyY2UpXG4gICAgICAucmVwbGFjZShyZUVtcHR5U3RyaW5nTWlkZGxlLCAnJDEnKVxuICAgICAgLnJlcGxhY2UocmVFbXB0eVN0cmluZ1RyYWlsaW5nLCAnJDE7Jyk7XG5cbiAgICAvLyBmcmFtZSBjb2RlIGFzIHRoZSBmdW5jdGlvbiBib2R5XG4gICAgc291cmNlID0gJ2Z1bmN0aW9uKCcgKyB2YXJpYWJsZSArICcpIHtcXG4nICtcbiAgICAgIChoYXNWYXJpYWJsZSA/ICcnIDogdmFyaWFibGUgKyAnIHx8ICgnICsgdmFyaWFibGUgKyAnID0ge30pO1xcbicpICtcbiAgICAgICd2YXIgX190LCBfX3AgPSBcXCdcXCcsIF9fZSA9IF8uZXNjYXBlJyArXG4gICAgICAoaXNFdmFsdWF0aW5nXG4gICAgICAgID8gJywgX19qID0gQXJyYXkucHJvdG90eXBlLmpvaW47XFxuJyArXG4gICAgICAgICAgJ2Z1bmN0aW9uIHByaW50KCkgeyBfX3AgKz0gX19qLmNhbGwoYXJndW1lbnRzLCBcXCdcXCcpIH1cXG4nXG4gICAgICAgIDogKGhhc1ZhcmlhYmxlID8gJycgOiAnLCBfX2QgPSAnICsgdmFyaWFibGUgKyAnLicgKyB2YXJpYWJsZSArICcgfHwgJyArIHZhcmlhYmxlKSArICc7XFxuJ1xuICAgICAgKSArXG4gICAgICBzb3VyY2UgK1xuICAgICAgJ3JldHVybiBfX3BcXG59JztcblxuICAgIC8vIHVzZSBhIHNvdXJjZVVSTCBmb3IgZWFzaWVyIGRlYnVnZ2luZ1xuICAgIC8vIGh0dHA6Ly93d3cuaHRtbDVyb2Nrcy5jb20vZW4vdHV0b3JpYWxzL2RldmVsb3BlcnRvb2xzL3NvdXJjZW1hcHMvI3RvYy1zb3VyY2V1cmxcbiAgICB2YXIgc291cmNlVVJMID0gdXNlU291cmNlVVJMXG4gICAgICA/ICdcXG4vL0Agc291cmNlVVJMPScgKyAob3B0aW9ucy5zb3VyY2VVUkwgfHwgJy9sb2Rhc2gvdGVtcGxhdGUvc291cmNlWycgKyAodGVtcGxhdGVDb3VudGVyKyspICsgJ10nKVxuICAgICAgOiAnJztcblxuICAgIHRyeSB7XG4gICAgICByZXN1bHQgPSBGdW5jdGlvbignXycsICdyZXR1cm4gJyArIHNvdXJjZSArIHNvdXJjZVVSTCkobG9kYXNoKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgIGUuc291cmNlID0gc291cmNlO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YSkge1xuICAgICAgcmV0dXJuIHJlc3VsdChkYXRhKTtcbiAgICB9XG4gICAgLy8gcHJvdmlkZSB0aGUgY29tcGlsZWQgZnVuY3Rpb24ncyBzb3VyY2UgdmlhIGl0cyBgdG9TdHJpbmdgIG1ldGhvZCwgaW5cbiAgICAvLyBzdXBwb3J0ZWQgZW52aXJvbm1lbnRzLCBvciB0aGUgYHNvdXJjZWAgcHJvcGVydHkgYXMgYSBjb252ZW5pZW5jZSBmb3JcbiAgICAvLyBpbmxpbmluZyBjb21waWxlZCB0ZW1wbGF0ZXMgZHVyaW5nIHRoZSBidWlsZCBwcm9jZXNzXG4gICAgcmVzdWx0LnNvdXJjZSA9IHNvdXJjZTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIHRoZSBgY2FsbGJhY2tgIGZ1bmN0aW9uIGBuYCB0aW1lcywgcmV0dXJuaW5nIGFuIGFycmF5IG9mIHRoZSByZXN1bHRzXG4gICAqIG9mIGVhY2ggYGNhbGxiYWNrYCBleGVjdXRpb24uIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZFxuICAgKiB3aXRoIG9uZSBhcmd1bWVudDsgKGluZGV4KS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBuIFRoZSBudW1iZXIgb2YgdGltZXMgdG8gZXhlY3V0ZSB0aGUgY2FsbGJhY2suXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgdGhlIHJlc3VsdHMgb2YgZWFjaCBgY2FsbGJhY2tgIGV4ZWN1dGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIGRpY2VSb2xscyA9IF8udGltZXMoMywgXy5wYXJ0aWFsKF8ucmFuZG9tLCAxLCA2KSk7XG4gICAqIC8vID0+IFszLCA2LCA0XVxuICAgKlxuICAgKiBfLnRpbWVzKDMsIGZ1bmN0aW9uKG4pIHsgbWFnZS5jYXN0U3BlbGwobik7IH0pO1xuICAgKiAvLyA9PiBjYWxscyBgbWFnZS5jYXN0U3BlbGwobilgIHRocmVlIHRpbWVzLCBwYXNzaW5nIGBuYCBvZiBgMGAsIGAxYCwgYW5kIGAyYCByZXNwZWN0aXZlbHlcbiAgICpcbiAgICogXy50aW1lcygzLCBmdW5jdGlvbihuKSB7IHRoaXMuY2FzdChuKTsgfSwgbWFnZSk7XG4gICAqIC8vID0+IGFsc28gY2FsbHMgYG1hZ2UuY2FzdFNwZWxsKG4pYCB0aHJlZSB0aW1lc1xuICAgKi9cbiAgZnVuY3Rpb24gdGltZXMobiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICBuID0gK24gfHwgMDtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgcmVzdWx0ID0gQXJyYXkobik7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IG4pIHtcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGluZGV4KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgb3Bwb3NpdGUgb2YgYF8uZXNjYXBlYCwgdGhpcyBtZXRob2QgY29udmVydHMgdGhlIEhUTUwgZW50aXRpZXNcbiAgICogYCZhbXA7YCwgYCZsdDtgLCBgJmd0O2AsIGAmcXVvdDtgLCBhbmQgYCYjeDI3O2AgaW4gYHN0cmluZ2AgdG8gdGhlaXJcbiAgICogY29ycmVzcG9uZGluZyBjaGFyYWN0ZXJzLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZyBUaGUgc3RyaW5nIHRvIHVuZXNjYXBlLlxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBSZXR1cm5zIHRoZSB1bmVzY2FwZWQgc3RyaW5nLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnVuZXNjYXBlKCdNb2UsIExhcnJ5ICZhbXA7IEN1cmx5Jyk7XG4gICAqIC8vID0+IFwiTW9lLCBMYXJyeSAmIEN1cmx5XCJcbiAgICovXG4gIGZ1bmN0aW9uIHVuZXNjYXBlKHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcgPT0gbnVsbCA/ICcnIDogKHN0cmluZyArICcnKS5yZXBsYWNlKHJlRXNjYXBlZEh0bWwsIHVuZXNjYXBlSHRtbENoYXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlcyBhIHVuaXF1ZSBpZC4gSWYgYHByZWZpeGAgaXMgcGFzc2VkLCB0aGUgaWQgd2lsbCBiZSBhcHBlbmRlZCB0byBpdC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbcHJlZml4XSBUaGUgdmFsdWUgdG8gcHJlZml4IHRoZSBpZCB3aXRoLlxuICAgKiBAcmV0dXJucyB7TnVtYmVyfFN0cmluZ30gUmV0dXJucyBhIG51bWVyaWMgaWQgaWYgbm8gcHJlZml4IGlzIHBhc3NlZCwgZWxzZVxuICAgKiAgYSBzdHJpbmcgaWQgbWF5IGJlIHJldHVybmVkLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnVuaXF1ZUlkKCdjb250YWN0XycpO1xuICAgKiAvLyA9PiAnY29udGFjdF8xMDQnXG4gICAqL1xuICBmdW5jdGlvbiB1bmlxdWVJZChwcmVmaXgpIHtcbiAgICB2YXIgaWQgPSBpZENvdW50ZXIrKztcbiAgICByZXR1cm4gcHJlZml4ID8gcHJlZml4ICsgaWQgOiBpZDtcbiAgfVxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBXcmFwcyB0aGUgdmFsdWUgaW4gYSBgbG9kYXNoYCB3cmFwcGVyIG9iamVjdC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ2hhaW5pbmdcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIHdyYXAuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIHdyYXBwZXIgb2JqZWN0LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgc3Rvb2dlcyA9IFtcbiAgICogICB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnbGFycnknLCAnYWdlJzogNTAgfSxcbiAgICogICB7ICduYW1lJzogJ2N1cmx5JywgJ2FnZSc6IDYwIH1cbiAgICogXTtcbiAgICpcbiAgICogdmFyIHlvdW5nZXN0ID0gXy5jaGFpbihzdG9vZ2VzKVxuICAgKiAgICAgLnNvcnRCeShmdW5jdGlvbihzdG9vZ2UpIHsgcmV0dXJuIHN0b29nZS5hZ2U7IH0pXG4gICAqICAgICAubWFwKGZ1bmN0aW9uKHN0b29nZSkgeyByZXR1cm4gc3Rvb2dlLm5hbWUgKyAnIGlzICcgKyBzdG9vZ2UuYWdlOyB9KVxuICAgKiAgICAgLmZpcnN0KClcbiAgICogICAgIC52YWx1ZSgpO1xuICAgKiAvLyA9PiAnbW9lIGlzIDQwJ1xuICAgKi9cbiAgZnVuY3Rpb24gY2hhaW4odmFsdWUpIHtcbiAgICB2YWx1ZSA9IG5ldyBsb2Rhc2godmFsdWUpO1xuICAgIHZhbHVlLl9fY2hhaW5fXyA9IHRydWU7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgYGludGVyY2VwdG9yYCB3aXRoIHRoZSBgdmFsdWVgIGFzIHRoZSBmaXJzdCBhcmd1bWVudCwgYW5kIHRoZW5cbiAgICogcmV0dXJucyBgdmFsdWVgLiBUaGUgcHVycG9zZSBvZiB0aGlzIG1ldGhvZCBpcyB0byBcInRhcCBpbnRvXCIgYSBtZXRob2QgY2hhaW4sXG4gICAqIGluIG9yZGVyIHRvIHBlcmZvcm0gb3BlcmF0aW9ucyBvbiBpbnRlcm1lZGlhdGUgcmVzdWx0cyB3aXRoaW4gdGhlIGNoYWluLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDaGFpbmluZ1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcGFzcyB0byBgaW50ZXJjZXB0b3JgLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBpbnRlcmNlcHRvciBUaGUgZnVuY3Rpb24gdG8gaW52b2tlLlxuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgYHZhbHVlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5jaGFpbihbMSwgMiwgMywgMjAwXSlcbiAgICogIC5maWx0ZXIoZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gJSAyID09IDA7IH0pXG4gICAqICAudGFwKGFsZXJ0KVxuICAgKiAgLm1hcChmdW5jdGlvbihudW0pIHsgcmV0dXJuIG51bSAqIG51bSB9KVxuICAgKiAgLnZhbHVlKCk7XG4gICAqIC8vID0+IC8vIFsyLCAyMDBdIChhbGVydGVkKVxuICAgKiAvLyA9PiBbNCwgNDAwMDBdXG4gICAqL1xuICBmdW5jdGlvbiB0YXAodmFsdWUsIGludGVyY2VwdG9yKSB7XG4gICAgaW50ZXJjZXB0b3IodmFsdWUpO1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbmFibGVzIG1ldGhvZCBjaGFpbmluZyBvbiB0aGUgd3JhcHBlciBvYmplY3QuXG4gICAqXG4gICAqIEBuYW1lIGNoYWluXG4gICAqIEBkZXByZWNhdGVkXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDaGFpbmluZ1xuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgdGhlIHdyYXBwZXIgb2JqZWN0LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfKFsxLCAyLCAzXSkudmFsdWUoKTtcbiAgICogLy8gPT4gWzEsIDIsIDNdXG4gICAqL1xuICBmdW5jdGlvbiB3cmFwcGVyQ2hhaW4oKSB7XG4gICAgdGhpcy5fX2NoYWluX18gPSB0cnVlO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4dHJhY3RzIHRoZSB3cmFwcGVkIHZhbHVlLlxuICAgKlxuICAgKiBAbmFtZSB2YWx1ZVxuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ2hhaW5pbmdcbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSB3cmFwcGVkIHZhbHVlLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfKFsxLCAyLCAzXSkudmFsdWUoKTtcbiAgICogLy8gPT4gWzEsIDIsIDNdXG4gICAqL1xuICBmdW5jdGlvbiB3cmFwcGVyVmFsdWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuX193cmFwcGVkX187XG4gIH1cblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvKipcbiAgICogVGhlIHNlbWFudGljIHZlcnNpb24gbnVtYmVyLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEB0eXBlIFN0cmluZ1xuICAgKi9cbiAgbG9kYXNoLlZFUlNJT04gPSAnMC45LjInO1xuXG4gIC8vIGFzc2lnbiBzdGF0aWMgbWV0aG9kc1xuICBsb2Rhc2guYWZ0ZXIgPSBhZnRlcjtcbiAgbG9kYXNoLmJpbmQgPSBiaW5kO1xuICBsb2Rhc2guYmluZEFsbCA9IGJpbmRBbGw7XG4gIGxvZGFzaC5jaGFpbiA9IGNoYWluO1xuICBsb2Rhc2guY2xvbmUgPSBjbG9uZTtcbiAgbG9kYXNoLmNvbXBhY3QgPSBjb21wYWN0O1xuICBsb2Rhc2guY29tcG9zZSA9IGNvbXBvc2U7XG4gIGxvZGFzaC5jb250YWlucyA9IGNvbnRhaW5zO1xuICBsb2Rhc2guY291bnRCeSA9IGNvdW50Qnk7XG4gIGxvZGFzaC5kZWJvdW5jZSA9IGRlYm91bmNlO1xuICBsb2Rhc2guZGVmYXVsdHMgPSBkZWZhdWx0cztcbiAgbG9kYXNoLmRlZmVyID0gZGVmZXI7XG4gIGxvZGFzaC5kZWxheSA9IGRlbGF5O1xuICBsb2Rhc2guZGlmZmVyZW5jZSA9IGRpZmZlcmVuY2U7XG4gIGxvZGFzaC5lc2NhcGUgPSBlc2NhcGU7XG4gIGxvZGFzaC5ldmVyeSA9IGV2ZXJ5O1xuICBsb2Rhc2guZXh0ZW5kID0gZXh0ZW5kO1xuICBsb2Rhc2guZmlsdGVyID0gZmlsdGVyO1xuICBsb2Rhc2guZmluZCA9IGZpbmQ7XG4gIGxvZGFzaC5maXJzdCA9IGZpcnN0O1xuICBsb2Rhc2guZmxhdHRlbiA9IGZsYXR0ZW47XG4gIGxvZGFzaC5mb3JFYWNoID0gZm9yRWFjaDtcbiAgbG9kYXNoLmZvckluID0gZm9ySW47XG4gIGxvZGFzaC5mb3JPd24gPSBmb3JPd247XG4gIGxvZGFzaC5mdW5jdGlvbnMgPSBmdW5jdGlvbnM7XG4gIGxvZGFzaC5ncm91cEJ5ID0gZ3JvdXBCeTtcbiAgbG9kYXNoLmhhcyA9IGhhcztcbiAgbG9kYXNoLmlkZW50aXR5ID0gaWRlbnRpdHk7XG4gIGxvZGFzaC5pbmRleE9mID0gaW5kZXhPZjtcbiAgbG9kYXNoLmluaXRpYWwgPSBpbml0aWFsO1xuICBsb2Rhc2guaW50ZXJzZWN0aW9uID0gaW50ZXJzZWN0aW9uO1xuICBsb2Rhc2guaW52ZXJ0ID0gaW52ZXJ0O1xuICBsb2Rhc2guaW52b2tlID0gaW52b2tlO1xuICBsb2Rhc2guaXNBcmd1bWVudHMgPSBpc0FyZ3VtZW50cztcbiAgbG9kYXNoLmlzQXJyYXkgPSBpc0FycmF5O1xuICBsb2Rhc2guaXNCb29sZWFuID0gaXNCb29sZWFuO1xuICBsb2Rhc2guaXNEYXRlID0gaXNEYXRlO1xuICBsb2Rhc2guaXNFbGVtZW50ID0gaXNFbGVtZW50O1xuICBsb2Rhc2guaXNFbXB0eSA9IGlzRW1wdHk7XG4gIGxvZGFzaC5pc0VxdWFsID0gaXNFcXVhbDtcbiAgbG9kYXNoLmlzRmluaXRlID0gaXNGaW5pdGU7XG4gIGxvZGFzaC5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcbiAgbG9kYXNoLmlzTmFOID0gaXNOYU47XG4gIGxvZGFzaC5pc051bGwgPSBpc051bGw7XG4gIGxvZGFzaC5pc051bWJlciA9IGlzTnVtYmVyO1xuICBsb2Rhc2guaXNPYmplY3QgPSBpc09iamVjdDtcbiAgbG9kYXNoLmlzUGxhaW5PYmplY3QgPSBpc1BsYWluT2JqZWN0O1xuICBsb2Rhc2guaXNSZWdFeHAgPSBpc1JlZ0V4cDtcbiAgbG9kYXNoLmlzU3RyaW5nID0gaXNTdHJpbmc7XG4gIGxvZGFzaC5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xuICBsb2Rhc2gua2V5cyA9IGtleXM7XG4gIGxvZGFzaC5sYXN0ID0gbGFzdDtcbiAgbG9kYXNoLmxhc3RJbmRleE9mID0gbGFzdEluZGV4T2Y7XG4gIGxvZGFzaC5sYXRlQmluZCA9IGxhdGVCaW5kO1xuICBsb2Rhc2gubWFwID0gbWFwO1xuICBsb2Rhc2gubWF4ID0gbWF4O1xuICBsb2Rhc2gubWVtb2l6ZSA9IG1lbW9pemU7XG4gIGxvZGFzaC5tZXJnZSA9IG1lcmdlO1xuICBsb2Rhc2gubWluID0gbWluO1xuICBsb2Rhc2gubWl4aW4gPSBtaXhpbjtcbiAgbG9kYXNoLm5vQ29uZmxpY3QgPSBub0NvbmZsaWN0O1xuICBsb2Rhc2gub2JqZWN0ID0gb2JqZWN0O1xuICBsb2Rhc2gub21pdCA9IG9taXQ7XG4gIGxvZGFzaC5vbmNlID0gb25jZTtcbiAgbG9kYXNoLnBhaXJzID0gcGFpcnM7XG4gIGxvZGFzaC5wYXJ0aWFsID0gcGFydGlhbDtcbiAgbG9kYXNoLnBpY2sgPSBwaWNrO1xuICBsb2Rhc2gucGx1Y2sgPSBwbHVjaztcbiAgbG9kYXNoLnJhbmRvbSA9IHJhbmRvbTtcbiAgbG9kYXNoLnJhbmdlID0gcmFuZ2U7XG4gIGxvZGFzaC5yZWR1Y2UgPSByZWR1Y2U7XG4gIGxvZGFzaC5yZWR1Y2VSaWdodCA9IHJlZHVjZVJpZ2h0O1xuICBsb2Rhc2gucmVqZWN0ID0gcmVqZWN0O1xuICBsb2Rhc2gucmVzdCA9IHJlc3Q7XG4gIGxvZGFzaC5yZXN1bHQgPSByZXN1bHQ7XG4gIGxvZGFzaC5zaHVmZmxlID0gc2h1ZmZsZTtcbiAgbG9kYXNoLnNpemUgPSBzaXplO1xuICBsb2Rhc2guc29tZSA9IHNvbWU7XG4gIGxvZGFzaC5zb3J0QnkgPSBzb3J0Qnk7XG4gIGxvZGFzaC5zb3J0ZWRJbmRleCA9IHNvcnRlZEluZGV4O1xuICBsb2Rhc2gudGFwID0gdGFwO1xuICBsb2Rhc2gudGVtcGxhdGUgPSB0ZW1wbGF0ZTtcbiAgbG9kYXNoLnRocm90dGxlID0gdGhyb3R0bGU7XG4gIGxvZGFzaC50aW1lcyA9IHRpbWVzO1xuICBsb2Rhc2gudG9BcnJheSA9IHRvQXJyYXk7XG4gIGxvZGFzaC51bmVzY2FwZSA9IHVuZXNjYXBlO1xuICBsb2Rhc2gudW5pb24gPSB1bmlvbjtcbiAgbG9kYXNoLnVuaXEgPSB1bmlxO1xuICBsb2Rhc2gudW5pcXVlSWQgPSB1bmlxdWVJZDtcbiAgbG9kYXNoLnZhbHVlcyA9IHZhbHVlcztcbiAgbG9kYXNoLndoZXJlID0gd2hlcmU7XG4gIGxvZGFzaC53aXRob3V0ID0gd2l0aG91dDtcbiAgbG9kYXNoLndyYXAgPSB3cmFwO1xuICBsb2Rhc2guemlwID0gemlwO1xuXG4gIC8vIGFzc2lnbiBhbGlhc2VzXG4gIGxvZGFzaC5hbGwgPSBldmVyeTtcbiAgbG9kYXNoLmFueSA9IHNvbWU7XG4gIGxvZGFzaC5jb2xsZWN0ID0gbWFwO1xuICBsb2Rhc2guZGV0ZWN0ID0gZmluZDtcbiAgbG9kYXNoLmRyb3AgPSByZXN0O1xuICBsb2Rhc2guZWFjaCA9IGZvckVhY2g7XG4gIGxvZGFzaC5mb2xkbCA9IHJlZHVjZTtcbiAgbG9kYXNoLmZvbGRyID0gcmVkdWNlUmlnaHQ7XG4gIGxvZGFzaC5oZWFkID0gZmlyc3Q7XG4gIGxvZGFzaC5pbmNsdWRlID0gY29udGFpbnM7XG4gIGxvZGFzaC5pbmplY3QgPSByZWR1Y2U7XG4gIGxvZGFzaC5tZXRob2RzID0gZnVuY3Rpb25zO1xuICBsb2Rhc2guc2VsZWN0ID0gZmlsdGVyO1xuICBsb2Rhc2gudGFpbCA9IHJlc3Q7XG4gIGxvZGFzaC50YWtlID0gZmlyc3Q7XG4gIGxvZGFzaC51bmlxdWUgPSB1bmlxO1xuXG4gIC8vIGFkZCBwc2V1ZG8gcHJpdmF0ZSBwcm9wZXJ0eSB0byBiZSB1c2VkIGFuZCByZW1vdmVkIGR1cmluZyB0aGUgYnVpbGQgcHJvY2Vzc1xuICBsb2Rhc2guX2l0ZXJhdG9yVGVtcGxhdGUgPSBpdGVyYXRvclRlbXBsYXRlO1xuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8vIGFkZCBhbGwgc3RhdGljIGZ1bmN0aW9ucyB0byBgbG9kYXNoLnByb3RvdHlwZWBcbiAgbWl4aW4obG9kYXNoKTtcblxuICAvLyBhZGQgYGxvZGFzaC5wcm90b3R5cGUuY2hhaW5gIGFmdGVyIGNhbGxpbmcgYG1peGluKClgIHRvIGF2b2lkIG92ZXJ3cml0aW5nXG4gIC8vIGl0IHdpdGggdGhlIHdyYXBwZWQgYGxvZGFzaC5jaGFpbmBcbiAgbG9kYXNoLnByb3RvdHlwZS5jaGFpbiA9IHdyYXBwZXJDaGFpbjtcbiAgbG9kYXNoLnByb3RvdHlwZS52YWx1ZSA9IHdyYXBwZXJWYWx1ZTtcblxuICAvLyBhZGQgYWxsIG11dGF0b3IgQXJyYXkgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBmb3JFYWNoKFsncG9wJywgJ3B1c2gnLCAncmV2ZXJzZScsICdzaGlmdCcsICdzb3J0JywgJ3NwbGljZScsICd1bnNoaWZ0J10sIGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICB2YXIgZnVuYyA9IGFycmF5UmVmW21ldGhvZE5hbWVdO1xuXG4gICAgbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHZhbHVlID0gdGhpcy5fX3dyYXBwZWRfXztcbiAgICAgIGZ1bmMuYXBwbHkodmFsdWUsIGFyZ3VtZW50cyk7XG5cbiAgICAgIC8vIGF2b2lkIGFycmF5LWxpa2Ugb2JqZWN0IGJ1Z3Mgd2l0aCBgQXJyYXkjc2hpZnRgIGFuZCBgQXJyYXkjc3BsaWNlYCBpblxuICAgICAgLy8gRmlyZWZveCA8IDEwIGFuZCBJRSA8IDlcbiAgICAgIGlmIChoYXNPYmplY3RTcGxpY2VCdWcgJiYgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGRlbGV0ZSB2YWx1ZVswXTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9fY2hhaW5fXykge1xuICAgICAgICB2YWx1ZSA9IG5ldyBsb2Rhc2godmFsdWUpO1xuICAgICAgICB2YWx1ZS5fX2NoYWluX18gPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIGFkZCBhbGwgYWNjZXNzb3IgQXJyYXkgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBmb3JFYWNoKFsnY29uY2F0JywgJ2pvaW4nLCAnc2xpY2UnXSwgZnVuY3Rpb24obWV0aG9kTmFtZSkge1xuICAgIHZhciBmdW5jID0gYXJyYXlSZWZbbWV0aG9kTmFtZV07XG5cbiAgICBsb2Rhc2gucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgdmFsdWUgPSB0aGlzLl9fd3JhcHBlZF9fLFxuICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodmFsdWUsIGFyZ3VtZW50cyk7XG5cbiAgICAgIGlmICh0aGlzLl9fY2hhaW5fXykge1xuICAgICAgICByZXN1bHQgPSBuZXcgbG9kYXNoKHJlc3VsdCk7XG4gICAgICAgIHJlc3VsdC5fX2NoYWluX18gPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9KTtcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvLyBleHBvc2UgTG8tRGFzaFxuICAvLyBzb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzLCBsaWtlIHIuanMsIGNoZWNrIGZvciBzcGVjaWZpYyBjb25kaXRpb24gcGF0dGVybnMgbGlrZSB0aGUgZm9sbG93aW5nOlxuICBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmIGRlZmluZS5hbWQpIHtcbiAgICAvLyBFeHBvc2UgTG8tRGFzaCB0byB0aGUgZ2xvYmFsIG9iamVjdCBldmVuIHdoZW4gYW4gQU1EIGxvYWRlciBpcyBwcmVzZW50IGluXG4gICAgLy8gY2FzZSBMby1EYXNoIHdhcyBpbmplY3RlZCBieSBhIHRoaXJkLXBhcnR5IHNjcmlwdCBhbmQgbm90IGludGVuZGVkIHRvIGJlXG4gICAgLy8gbG9hZGVkIGFzIGEgbW9kdWxlLiBUaGUgZ2xvYmFsIGFzc2lnbm1lbnQgY2FuIGJlIHJldmVydGVkIGluIHRoZSBMby1EYXNoXG4gICAgLy8gbW9kdWxlIHZpYSBpdHMgYG5vQ29uZmxpY3QoKWAgbWV0aG9kLlxuICAgIHdpbmRvdy5fID0gbG9kYXNoO1xuXG4gICAgLy8gZGVmaW5lIGFzIGFuIGFub255bW91cyBtb2R1bGUgc28sIHRocm91Z2ggcGF0aCBtYXBwaW5nLCBpdCBjYW4gYmVcbiAgICAvLyByZWZlcmVuY2VkIGFzIHRoZSBcInVuZGVyc2NvcmVcIiBtb2R1bGVcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbG9kYXNoO1xuICAgIH0pO1xuICB9XG4gIC8vIGNoZWNrIGZvciBgZXhwb3J0c2AgYWZ0ZXIgYGRlZmluZWAgaW4gY2FzZSBhIGJ1aWxkIG9wdGltaXplciBhZGRzIGFuIGBleHBvcnRzYCBvYmplY3RcbiAgZWxzZSBpZiAoZnJlZUV4cG9ydHMpIHtcbiAgICAvLyBpbiBOb2RlLmpzIG9yIFJpbmdvSlMgdjAuOC4wK1xuICAgIGlmICh0eXBlb2YgbW9kdWxlID09ICdvYmplY3QnICYmIG1vZHVsZSAmJiBtb2R1bGUuZXhwb3J0cyA9PSBmcmVlRXhwb3J0cykge1xuICAgICAgKG1vZHVsZS5leHBvcnRzID0gbG9kYXNoKS5fID0gbG9kYXNoO1xuICAgIH1cbiAgICAvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuICAgIGVsc2Uge1xuICAgICAgZnJlZUV4cG9ydHMuXyA9IGxvZGFzaDtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgLy8gaW4gYSBicm93c2VyIG9yIFJoaW5vXG4gICAgd2luZG93Ll8gPSBsb2Rhc2g7XG4gIH1cbn0odGhpcykpO1xuIiwiLy8gSVNDIEAgSnVsaWVuIEZvbnRhbmV0XG5cbid1c2Ugc3RyaWN0J1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbnZhciBjb25zdHJ1Y3QgPSB0eXBlb2YgUmVmbGVjdCAhPT0gJ3VuZGVmaW5lZCcgPyBSZWZsZWN0LmNvbnN0cnVjdCA6IHVuZGVmaW5lZFxudmFyIGRlZmluZVByb3BlcnR5ID0gT2JqZWN0LmRlZmluZVByb3BlcnR5XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxudmFyIGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2VcbmlmIChjYXB0dXJlU3RhY2tUcmFjZSA9PT0gdW5kZWZpbmVkKSB7XG4gIGNhcHR1cmVTdGFja1RyYWNlID0gZnVuY3Rpb24gY2FwdHVyZVN0YWNrVHJhY2UgKGVycm9yKSB7XG4gICAgdmFyIGNvbnRhaW5lciA9IG5ldyBFcnJvcigpXG5cbiAgICBkZWZpbmVQcm9wZXJ0eShlcnJvciwgJ3N0YWNrJywge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXRTdGFjayAoKSB7XG4gICAgICAgIHZhciBzdGFjayA9IGNvbnRhaW5lci5zdGFja1xuXG4gICAgICAgIC8vIFJlcGxhY2UgcHJvcGVydHkgd2l0aCB2YWx1ZSBmb3IgZmFzdGVyIGZ1dHVyZSBhY2Nlc3Nlcy5cbiAgICAgICAgZGVmaW5lUHJvcGVydHkodGhpcywgJ3N0YWNrJywge1xuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICB2YWx1ZTogc3RhY2ssXG4gICAgICAgICAgd3JpdGFibGU6IHRydWVcbiAgICAgICAgfSlcblxuICAgICAgICByZXR1cm4gc3RhY2tcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uIHNldFN0YWNrIChzdGFjaykge1xuICAgICAgICBkZWZpbmVQcm9wZXJ0eShlcnJvciwgJ3N0YWNrJywge1xuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICB2YWx1ZTogc3RhY2ssXG4gICAgICAgICAgd3JpdGFibGU6IHRydWVcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gQmFzZUVycm9yIChtZXNzYWdlKSB7XG4gIGlmIChtZXNzYWdlICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbWVzc2FnZScsIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHZhbHVlOiBtZXNzYWdlLFxuICAgICAgd3JpdGFibGU6IHRydWVcbiAgICB9KVxuICB9XG5cbiAgdmFyIGNuYW1lID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gIGlmIChcbiAgICBjbmFtZSAhPT0gdW5kZWZpbmVkICYmXG4gICAgY25hbWUgIT09IHRoaXMubmFtZVxuICApIHtcbiAgICBkZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbmFtZScsIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHZhbHVlOiBjbmFtZSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgfSlcbiAgfVxuXG4gIGNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHRoaXMuY29uc3RydWN0b3IpXG59XG5cbkJhc2VFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSwge1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9Kc0NvbW11bml0eS9tYWtlLWVycm9yL2lzc3Vlcy80XG4gIGNvbnN0cnVjdG9yOiB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiBCYXNlRXJyb3IsXG4gICAgd3JpdGFibGU6IHRydWVcbiAgfVxufSlcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vLyBTZXRzIHRoZSBuYW1lIG9mIGEgZnVuY3Rpb24gaWYgcG9zc2libGUgKGRlcGVuZHMgb2YgdGhlIEpTIGVuZ2luZSkuXG52YXIgc2V0RnVuY3Rpb25OYW1lID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gc2V0RnVuY3Rpb25OYW1lIChmbiwgbmFtZSkge1xuICAgIHJldHVybiBkZWZpbmVQcm9wZXJ0eShmbiwgJ25hbWUnLCB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB2YWx1ZTogbmFtZVxuICAgIH0pXG4gIH1cbiAgdHJ5IHtcbiAgICB2YXIgZiA9IGZ1bmN0aW9uICgpIHt9XG4gICAgc2V0RnVuY3Rpb25OYW1lKGYsICdmb28nKVxuICAgIGlmIChmLm5hbWUgPT09ICdmb28nKSB7XG4gICAgICByZXR1cm4gc2V0RnVuY3Rpb25OYW1lXG4gICAgfVxuICB9IGNhdGNoIChfKSB7fVxufSkoKVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmZ1bmN0aW9uIG1ha2VFcnJvciAoY29uc3RydWN0b3IsIHN1cGVyXykge1xuICBpZiAoc3VwZXJfID09IG51bGwgfHwgc3VwZXJfID09PSBFcnJvcikge1xuICAgIHN1cGVyXyA9IEJhc2VFcnJvclxuICB9IGVsc2UgaWYgKHR5cGVvZiBzdXBlcl8gIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzdXBlcl8gc2hvdWxkIGJlIGEgZnVuY3Rpb24nKVxuICB9XG5cbiAgdmFyIG5hbWVcbiAgaWYgKHR5cGVvZiBjb25zdHJ1Y3RvciA9PT0gJ3N0cmluZycpIHtcbiAgICBuYW1lID0gY29uc3RydWN0b3JcbiAgICBjb25zdHJ1Y3RvciA9IGNvbnN0cnVjdCAhPT0gdW5kZWZpbmVkXG4gICAgICA/IGZ1bmN0aW9uICgpIHsgcmV0dXJuIGNvbnN0cnVjdChzdXBlcl8sIGFyZ3VtZW50cywgdGhpcy5jb25zdHJ1Y3RvcikgfVxuICAgICAgOiBmdW5jdGlvbiAoKSB7IHN1cGVyXy5hcHBseSh0aGlzLCBhcmd1bWVudHMpIH1cblxuICAgIC8vIElmIHRoZSBuYW1lIGNhbiBiZSBzZXQsIGRvIGl0IG9uY2UgYW5kIGZvciBhbGwuXG4gICAgaWYgKHNldEZ1bmN0aW9uTmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBzZXRGdW5jdGlvbk5hbWUoY29uc3RydWN0b3IsIG5hbWUpXG4gICAgICBuYW1lID0gdW5kZWZpbmVkXG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiBjb25zdHJ1Y3RvciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NvbnN0cnVjdG9yIHNob3VsZCBiZSBlaXRoZXIgYSBzdHJpbmcgb3IgYSBmdW5jdGlvbicpXG4gIH1cblxuICAvLyBBbHNvIHJlZ2lzdGVyIHRoZSBzdXBlciBjb25zdHJ1Y3RvciBhbHNvIGFzIGBjb25zdHJ1Y3Rvci5zdXBlcl9gIGp1c3RcbiAgLy8gbGlrZSBOb2RlJ3MgYHV0aWwuaW5oZXJpdHMoKWAuXG4gIGNvbnN0cnVjdG9yLnN1cGVyXyA9IGNvbnN0cnVjdG9yWydzdXBlciddID0gc3VwZXJfXG5cbiAgdmFyIHByb3BlcnRpZXMgPSB7XG4gICAgY29uc3RydWN0b3I6IHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHZhbHVlOiBjb25zdHJ1Y3RvcixcbiAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgfVxuICB9XG5cbiAgLy8gSWYgdGhlIG5hbWUgY291bGQgbm90IGJlIHNldCBvbiB0aGUgY29uc3RydWN0b3IsIHNldCBpdCBvbiB0aGVcbiAgLy8gcHJvdG90eXBlLlxuICBpZiAobmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcHJvcGVydGllcy5uYW1lID0ge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgdmFsdWU6IG5hbWUsXG4gICAgICB3cml0YWJsZTogdHJ1ZVxuICAgIH1cbiAgfVxuICBjb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyXy5wcm90b3R5cGUsIHByb3BlcnRpZXMpXG5cbiAgcmV0dXJuIGNvbnN0cnVjdG9yXG59XG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBtYWtlRXJyb3JcbmV4cG9ydHMuQmFzZUVycm9yID0gQmFzZUVycm9yXG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwidmFyIGdlb21ldHJ5QXJlYSA9IHJlcXVpcmUoJ2dlb2pzb24tYXJlYScpLmdlb21ldHJ5O1xuXG4vKipcbiAqIFRha2VzIGEge0BsaW5rIEdlb0pTT059IGZlYXR1cmUgb3Ige0BsaW5rIEZlYXR1cmVDb2xsZWN0aW9ufSBvZiBhbnkgdHlwZSBhbmQgcmV0dXJucyB0aGUgYXJlYSBvZiB0aGF0IGZlYXR1cmVcbiAqIGluIHNxdWFyZSBtZXRlcnMuXG4gKlxuICogQG1vZHVsZSB0dXJmL2FyZWFcbiAqIEBjYXRlZ29yeSBtZWFzdXJlbWVudFxuICogQHBhcmFtIHtHZW9KU09OfSBpbnB1dCBhIHtAbGluayBGZWF0dXJlfSBvciB7QGxpbmsgRmVhdHVyZUNvbGxlY3Rpb259IG9mIGFueSB0eXBlXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IGFyZWEgaW4gc3F1YXJlIG1ldGVyc1xuICogQGV4YW1wbGVcbiAqIHZhciBwb2x5Z29ucyA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAqICAgXCJmZWF0dXJlc1wiOiBbXG4gKiAgICAge1xuICogICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICAgICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICAgICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgICAgIFwidHlwZVwiOiBcIlBvbHlnb25cIixcbiAqICAgICAgICAgXCJjb29yZGluYXRlc1wiOiBbW1xuICogICAgICAgICAgIFstNjcuMDMxMDIxLCAxMC40NTgxMDJdLFxuICogICAgICAgICAgIFstNjcuMDMxMDIxLCAxMC41MzM3Ml0sXG4gKiAgICAgICAgICAgWy02Ni45MjkzOTcsIDEwLjUzMzcyXSxcbiAqICAgICAgICAgICBbLTY2LjkyOTM5NywgMTAuNDU4MTAyXSxcbiAqICAgICAgICAgICBbLTY3LjAzMTAyMSwgMTAuNDU4MTAyXVxuICogICAgICAgICBdXVxuICogICAgICAgfVxuICogICAgIH0sIHtcbiAqICAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgICAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgICAgICBcInR5cGVcIjogXCJQb2x5Z29uXCIsXG4gKiAgICAgICAgIFwiY29vcmRpbmF0ZXNcIjogW1tcbiAqICAgICAgICAgICBbLTY2LjkxOTc4NCwgMTAuMzk3MzI1XSxcbiAqICAgICAgICAgICBbLTY2LjkxOTc4NCwgMTAuNTEzNDY3XSxcbiAqICAgICAgICAgICBbLTY2LjgwNTExNCwgMTAuNTEzNDY3XSxcbiAqICAgICAgICAgICBbLTY2LjgwNTExNCwgMTAuMzk3MzI1XSxcbiAqICAgICAgICAgICBbLTY2LjkxOTc4NCwgMTAuMzk3MzI1XVxuICogICAgICAgICBdXVxuICogICAgICAgfVxuICogICAgIH1cbiAqICAgXVxuICogfTtcbiAqXG4gKiB2YXIgYXJlYSA9IHR1cmYuYXJlYShwb2x5Z29ucyk7XG4gKlxuICogLy89YXJlYVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKF8pIHtcbiAgICBpZiAoXy50eXBlID09PSAnRmVhdHVyZUNvbGxlY3Rpb24nKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBzdW0gPSAwOyBpIDwgXy5mZWF0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKF8uZmVhdHVyZXNbaV0uZ2VvbWV0cnkpIHtcbiAgICAgICAgICAgICAgICBzdW0gKz0gZ2VvbWV0cnlBcmVhKF8uZmVhdHVyZXNbaV0uZ2VvbWV0cnkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdW07XG4gICAgfSBlbHNlIGlmIChfLnR5cGUgPT09ICdGZWF0dXJlJykge1xuICAgICAgICByZXR1cm4gZ2VvbWV0cnlBcmVhKF8uZ2VvbWV0cnkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBnZW9tZXRyeUFyZWEoXyk7XG4gICAgfVxufTtcbiIsIi8vaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9IYXZlcnNpbmVfZm9ybXVsYVxuLy9odHRwOi8vd3d3Lm1vdmFibGUtdHlwZS5jby51ay9zY3JpcHRzL2xhdGxvbmcuaHRtbFxuXG4vKipcbiAqIFRha2VzIHR3byB7QGxpbmsgUG9pbnR8cG9pbnRzfSBhbmQgZmluZHMgdGhlIGdlb2dyYXBoaWMgYmVhcmluZyBiZXR3ZWVuIHRoZW0uXG4gKlxuICogQG1vZHVsZSB0dXJmL2JlYXJpbmdcbiAqIEBjYXRlZ29yeSBtZWFzdXJlbWVudFxuICogQHBhcmFtIHtGZWF0dXJlPFBvaW50Pn0gc3RhcnQgc3RhcnRpbmcgUG9pbnRcbiAqIEBwYXJhbSB7RmVhdHVyZTxQb2ludD59IGVuZCBlbmRpbmcgUG9pbnRcbiAqIEBjYXRlZ29yeSBtZWFzdXJlbWVudFxuICogQHJldHVybnMge051bWJlcn0gYmVhcmluZyBpbiBkZWNpbWFsIGRlZ3JlZXNcbiAqIEBleGFtcGxlXG4gKiB2YXIgcG9pbnQxID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgIFwicHJvcGVydGllc1wiOiB7XG4gKiAgICAgXCJtYXJrZXItY29sb3JcIjogJyNmMDAnXG4gKiAgIH0sXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbLTc1LjM0MywgMzkuOTg0XVxuICogICB9XG4gKiB9O1xuICogdmFyIHBvaW50MiA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge1xuICogICAgIFwibWFya2VyLWNvbG9yXCI6ICcjMGYwJ1xuICogICB9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWy03NS41MzQsIDM5LjEyM11cbiAqICAgfVxuICogfTtcbiAqXG4gKiB2YXIgcG9pbnRzID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICogICBcImZlYXR1cmVzXCI6IFtwb2ludDEsIHBvaW50Ml1cbiAqIH07XG4gKlxuICogLy89cG9pbnRzXG4gKlxuICogdmFyIGJlYXJpbmcgPSB0dXJmLmJlYXJpbmcocG9pbnQxLCBwb2ludDIpO1xuICpcbiAqIC8vPWJlYXJpbmdcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAocG9pbnQxLCBwb2ludDIpIHtcbiAgICB2YXIgY29vcmRpbmF0ZXMxID0gcG9pbnQxLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgIHZhciBjb29yZGluYXRlczIgPSBwb2ludDIuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG5cbiAgICB2YXIgbG9uMSA9IHRvUmFkKGNvb3JkaW5hdGVzMVswXSk7XG4gICAgdmFyIGxvbjIgPSB0b1JhZChjb29yZGluYXRlczJbMF0pO1xuICAgIHZhciBsYXQxID0gdG9SYWQoY29vcmRpbmF0ZXMxWzFdKTtcbiAgICB2YXIgbGF0MiA9IHRvUmFkKGNvb3JkaW5hdGVzMlsxXSk7XG4gICAgdmFyIGEgPSBNYXRoLnNpbihsb24yIC0gbG9uMSkgKiBNYXRoLmNvcyhsYXQyKTtcbiAgICB2YXIgYiA9IE1hdGguY29zKGxhdDEpICogTWF0aC5zaW4obGF0MikgLVxuICAgICAgICBNYXRoLnNpbihsYXQxKSAqIE1hdGguY29zKGxhdDIpICogTWF0aC5jb3MobG9uMiAtIGxvbjEpO1xuXG4gICAgdmFyIGJlYXJpbmcgPSB0b0RlZyhNYXRoLmF0YW4yKGEsIGIpKTtcblxuICAgIHJldHVybiBiZWFyaW5nO1xufTtcblxuZnVuY3Rpb24gdG9SYWQoZGVncmVlKSB7XG4gICAgcmV0dXJuIGRlZ3JlZSAqIE1hdGguUEkgLyAxODA7XG59XG5cbmZ1bmN0aW9uIHRvRGVnKHJhZGlhbikge1xuICAgIHJldHVybiByYWRpYW4gKiAxODAgLyBNYXRoLlBJO1xufVxuIiwidmFyIGVhY2ggPSByZXF1aXJlKCd0dXJmLW1ldGEnKS5jb29yZEVhY2g7XG52YXIgcG9pbnQgPSByZXF1aXJlKCd0dXJmLWhlbHBlcnMnKS5wb2ludDtcblxuLyoqXG4gKiBUYWtlcyBvbmUgb3IgbW9yZSBmZWF0dXJlcyBhbmQgY2FsY3VsYXRlcyB0aGUgY2VudHJvaWQgdXNpbmdcbiAqIHRoZSBtZWFuIG9mIGFsbCB2ZXJ0aWNlcy5cbiAqIFRoaXMgbGVzc2VucyB0aGUgZWZmZWN0IG9mIHNtYWxsIGlzbGFuZHMgYW5kIGFydGlmYWN0cyB3aGVuIGNhbGN1bGF0aW5nXG4gKiB0aGUgY2VudHJvaWQgb2YgYSBzZXQgb2YgcG9seWdvbnMuXG4gKlxuICogQG5hbWUgY2VudHJvaWRcbiAqIEBwYXJhbSB7KEZlYXR1cmV8RmVhdHVyZUNvbGxlY3Rpb24pfSBmZWF0dXJlcyBpbnB1dCBmZWF0dXJlc1xuICogQHJldHVybiB7RmVhdHVyZTxQb2ludD59IHRoZSBjZW50cm9pZCBvZiB0aGUgaW5wdXQgZmVhdHVyZXNcbiAqIEBleGFtcGxlXG4gKiB2YXIgcG9seSA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgIFwidHlwZVwiOiBcIlBvbHlnb25cIixcbiAqICAgICBcImNvb3JkaW5hdGVzXCI6IFtbXG4gKiAgICAgICBbMTA1LjgxODkzOSwyMS4wMDQ3MTRdLFxuICogICAgICAgWzEwNS44MTg5MzksMjEuMDYxNzU0XSxcbiAqICAgICAgIFsxMDUuODkwMDA3LDIxLjA2MTc1NF0sXG4gKiAgICAgICBbMTA1Ljg5MDAwNywyMS4wMDQ3MTRdLFxuICogICAgICAgWzEwNS44MTg5MzksMjEuMDA0NzE0XVxuICogICAgIF1dXG4gKiAgIH1cbiAqIH07XG4gKlxuICogdmFyIGNlbnRyb2lkUHQgPSB0dXJmLmNlbnRyb2lkKHBvbHkpO1xuICpcbiAqIHZhciByZXN1bHQgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gKiAgIFwiZmVhdHVyZXNcIjogW3BvbHksIGNlbnRyb2lkUHRdXG4gKiB9O1xuICpcbiAqIC8vPXJlc3VsdFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmZWF0dXJlcykge1xuICAgIHZhciB4U3VtID0gMCwgeVN1bSA9IDAsIGxlbiA9IDA7XG4gICAgZWFjaChmZWF0dXJlcywgZnVuY3Rpb24gKGNvb3JkKSB7XG4gICAgICAgIHhTdW0gKz0gY29vcmRbMF07XG4gICAgICAgIHlTdW0gKz0gY29vcmRbMV07XG4gICAgICAgIGxlbisrO1xuICAgIH0sIHRydWUpO1xuICAgIHJldHVybiBwb2ludChbeFN1bSAvIGxlbiwgeVN1bSAvIGxlbl0pO1xufTtcbiIsIi8vaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9IYXZlcnNpbmVfZm9ybXVsYVxuLy9odHRwOi8vd3d3Lm1vdmFibGUtdHlwZS5jby51ay9zY3JpcHRzL2xhdGxvbmcuaHRtbFxudmFyIHBvaW50ID0gcmVxdWlyZSgndHVyZi1wb2ludCcpO1xuXG4vKipcbiAqIFRha2VzIGEge0BsaW5rIFBvaW50fSBmZWF0dXJlIGFuZCBjYWxjdWxhdGVzIHRoZSBsb2NhdGlvbiBvZiBhIGRlc3RpbmF0aW9uIHBvaW50IGdpdmVuIGEgZGlzdGFuY2UgaW4gZGVncmVlcywgcmFkaWFucywgbWlsZXMsIG9yIGtpbG9tZXRlcnM7IGFuZCBiZWFyaW5nIGluIGRlZ3JlZXMuIFRoaXMgdXNlcyB0aGUgW0hhdmVyc2luZSBmb3JtdWxhXShodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0hhdmVyc2luZV9mb3JtdWxhKSB0byBhY2NvdW50IGZvciBnbG9iYWwgY3VydmF0dXJlLlxuICpcbiAqIEBtb2R1bGUgdHVyZi9kZXN0aW5hdGlvblxuICogQGNhdGVnb3J5IG1lYXN1cmVtZW50XG4gKiBAcGFyYW0ge1BvaW50fSBzdGFydCBhIFBvaW50IGZlYXR1cmUgYXQgdGhlIHN0YXJ0aW5nIHBvaW50XG4gKiBAcGFyYW0ge051bWJlcn0gZGlzdGFuY2UgZGlzdGFuY2UgZnJvbSB0aGUgc3RhcnRpbmcgcG9pbnRcbiAqIEBwYXJhbSB7TnVtYmVyfSBiZWFyaW5nIHJhbmdpbmcgZnJvbSAtMTgwIHRvIDE4MFxuICogQHBhcmFtIHtTdHJpbmd9IHVuaXRzIG1pbGVzLCBraWxvbWV0ZXJzLCBkZWdyZWVzLCBvciByYWRpYW5zXG4gKiBAcmV0dXJucyB7UG9pbnR9IGEgUG9pbnQgZmVhdHVyZSBhdCB0aGUgZGVzdGluYXRpb25cbiAqIEBleGFtcGxlXG4gKiB2YXIgcG9pbnQgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAqICAgICBcIm1hcmtlci1jb2xvclwiOiBcIiMwZjBcIlxuICogICB9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWy03NS4zNDMsIDM5Ljk4NF1cbiAqICAgfVxuICogfTtcbiAqIHZhciBkaXN0YW5jZSA9IDUwO1xuICogdmFyIGJlYXJpbmcgPSA5MDtcbiAqIHZhciB1bml0cyA9ICdtaWxlcyc7XG4gKlxuICogdmFyIGRlc3RpbmF0aW9uID0gdHVyZi5kZXN0aW5hdGlvbihwb2ludCwgZGlzdGFuY2UsIGJlYXJpbmcsIHVuaXRzKTtcbiAqIGRlc3RpbmF0aW9uLnByb3BlcnRpZXNbJ21hcmtlci1jb2xvciddID0gJyNmMDAnO1xuICpcbiAqIHZhciByZXN1bHQgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gKiAgIFwiZmVhdHVyZXNcIjogW3BvaW50LCBkZXN0aW5hdGlvbl1cbiAqIH07XG4gKlxuICogLy89cmVzdWx0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHBvaW50MSwgZGlzdGFuY2UsIGJlYXJpbmcsIHVuaXRzKSB7XG4gICAgdmFyIGNvb3JkaW5hdGVzMSA9IHBvaW50MS5nZW9tZXRyeS5jb29yZGluYXRlcztcbiAgICB2YXIgbG9uZ2l0dWRlMSA9IHRvUmFkKGNvb3JkaW5hdGVzMVswXSk7XG4gICAgdmFyIGxhdGl0dWRlMSA9IHRvUmFkKGNvb3JkaW5hdGVzMVsxXSk7XG4gICAgdmFyIGJlYXJpbmdfcmFkID0gdG9SYWQoYmVhcmluZyk7XG5cbiAgICB2YXIgUiA9IDA7XG4gICAgc3dpdGNoICh1bml0cykge1xuICAgIGNhc2UgJ21pbGVzJzpcbiAgICAgICAgUiA9IDM5NjA7XG4gICAgICAgIGJyZWFrXG4gICAgY2FzZSAna2lsb21ldGVycyc6XG4gICAgICAgIFIgPSA2MzczO1xuICAgICAgICBicmVha1xuICAgIGNhc2UgJ2RlZ3JlZXMnOlxuICAgICAgICBSID0gNTcuMjk1Nzc5NTtcbiAgICAgICAgYnJlYWtcbiAgICBjYXNlICdyYWRpYW5zJzpcbiAgICAgICAgUiA9IDE7XG4gICAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgdmFyIGxhdGl0dWRlMiA9IE1hdGguYXNpbihNYXRoLnNpbihsYXRpdHVkZTEpICogTWF0aC5jb3MoZGlzdGFuY2UgLyBSKSArXG4gICAgICAgIE1hdGguY29zKGxhdGl0dWRlMSkgKiBNYXRoLnNpbihkaXN0YW5jZSAvIFIpICogTWF0aC5jb3MoYmVhcmluZ19yYWQpKTtcbiAgICB2YXIgbG9uZ2l0dWRlMiA9IGxvbmdpdHVkZTEgKyBNYXRoLmF0YW4yKE1hdGguc2luKGJlYXJpbmdfcmFkKSAqIE1hdGguc2luKGRpc3RhbmNlIC8gUikgKiBNYXRoLmNvcyhsYXRpdHVkZTEpLFxuICAgICAgICBNYXRoLmNvcyhkaXN0YW5jZSAvIFIpIC0gTWF0aC5zaW4obGF0aXR1ZGUxKSAqIE1hdGguc2luKGxhdGl0dWRlMikpO1xuXG4gICAgcmV0dXJuIHBvaW50KFt0b0RlZyhsb25naXR1ZGUyKSwgdG9EZWcobGF0aXR1ZGUyKV0pO1xufTtcblxuZnVuY3Rpb24gdG9SYWQoZGVncmVlKSB7XG4gICAgcmV0dXJuIGRlZ3JlZSAqIE1hdGguUEkgLyAxODA7XG59XG5cbmZ1bmN0aW9uIHRvRGVnKHJhZCkge1xuICAgIHJldHVybiByYWQgKiAxODAgLyBNYXRoLlBJO1xufVxuIiwidmFyIGludmFyaWFudCA9IHJlcXVpcmUoJ3R1cmYtaW52YXJpYW50Jyk7XG4vL2h0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGF2ZXJzaW5lX2Zvcm11bGFcbi8vaHR0cDovL3d3dy5tb3ZhYmxlLXR5cGUuY28udWsvc2NyaXB0cy9sYXRsb25nLmh0bWxcblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSBkaXN0YW5jZSBiZXR3ZWVuIHR3byB7QGxpbmsgUG9pbnR8cG9pbnRzfSBpbiBkZWdyZXNzLCByYWRpYW5zLFxuICogbWlsZXMsIG9yIGtpbG9tZXRlcnMuIFRoaXMgdXNlcyB0aGVcbiAqIFtIYXZlcnNpbmUgZm9ybXVsYV0oaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9IYXZlcnNpbmVfZm9ybXVsYSlcbiAqIHRvIGFjY291bnQgZm9yIGdsb2JhbCBjdXJ2YXR1cmUuXG4gKlxuICogQG1vZHVsZSB0dXJmL2Rpc3RhbmNlXG4gKiBAY2F0ZWdvcnkgbWVhc3VyZW1lbnRcbiAqIEBwYXJhbSB7RmVhdHVyZTxQb2ludD59IGZyb20gb3JpZ2luIHBvaW50XG4gKiBAcGFyYW0ge0ZlYXR1cmU8UG9pbnQ+fSB0byBkZXN0aW5hdGlvbiBwb2ludFxuICogQHBhcmFtIHtTdHJpbmd9IFt1bml0cz1raWxvbWV0ZXJzXSBjYW4gYmUgZGVncmVlcywgcmFkaWFucywgbWlsZXMsIG9yIGtpbG9tZXRlcnNcbiAqIEByZXR1cm4ge051bWJlcn0gZGlzdGFuY2UgYmV0d2VlbiB0aGUgdHdvIHBvaW50c1xuICogQGV4YW1wbGVcbiAqIHZhciBwb2ludDEgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWy03NS4zNDMsIDM5Ljk4NF1cbiAqICAgfVxuICogfTtcbiAqIHZhciBwb2ludDIgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWy03NS41MzQsIDM5LjEyM11cbiAqICAgfVxuICogfTtcbiAqIHZhciB1bml0cyA9IFwibWlsZXNcIjtcbiAqXG4gKiB2YXIgcG9pbnRzID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICogICBcImZlYXR1cmVzXCI6IFtwb2ludDEsIHBvaW50Ml1cbiAqIH07XG4gKlxuICogLy89cG9pbnRzXG4gKlxuICogdmFyIGRpc3RhbmNlID0gdHVyZi5kaXN0YW5jZShwb2ludDEsIHBvaW50MiwgdW5pdHMpO1xuICpcbiAqIC8vPWRpc3RhbmNlXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocG9pbnQxLCBwb2ludDIsIHVuaXRzKSB7XG4gIGludmFyaWFudC5mZWF0dXJlT2YocG9pbnQxLCAnUG9pbnQnLCAnZGlzdGFuY2UnKTtcbiAgaW52YXJpYW50LmZlYXR1cmVPZihwb2ludDIsICdQb2ludCcsICdkaXN0YW5jZScpO1xuICB2YXIgY29vcmRpbmF0ZXMxID0gcG9pbnQxLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICB2YXIgY29vcmRpbmF0ZXMyID0gcG9pbnQyLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuXG4gIHZhciBkTGF0ID0gdG9SYWQoY29vcmRpbmF0ZXMyWzFdIC0gY29vcmRpbmF0ZXMxWzFdKTtcbiAgdmFyIGRMb24gPSB0b1JhZChjb29yZGluYXRlczJbMF0gLSBjb29yZGluYXRlczFbMF0pO1xuICB2YXIgbGF0MSA9IHRvUmFkKGNvb3JkaW5hdGVzMVsxXSk7XG4gIHZhciBsYXQyID0gdG9SYWQoY29vcmRpbmF0ZXMyWzFdKTtcblxuICB2YXIgYSA9IE1hdGgucG93KE1hdGguc2luKGRMYXQvMiksIDIpICtcbiAgICAgICAgICBNYXRoLnBvdyhNYXRoLnNpbihkTG9uLzIpLCAyKSAqIE1hdGguY29zKGxhdDEpICogTWF0aC5jb3MobGF0Mik7XG4gIHZhciBjID0gMiAqIE1hdGguYXRhbjIoTWF0aC5zcXJ0KGEpLCBNYXRoLnNxcnQoMS1hKSk7XG5cbiAgdmFyIFI7XG4gIHN3aXRjaCh1bml0cykge1xuICAgIGNhc2UgJ21pbGVzJzpcbiAgICAgIFIgPSAzOTYwO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAna2lsb21ldGVycyc6XG4gICAgY2FzZSAna2lsb21ldHJlcyc6XG4gICAgICBSID0gNjM3MztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2RlZ3JlZXMnOlxuICAgICAgUiA9IDU3LjI5NTc3OTU7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdyYWRpYW5zJzpcbiAgICAgIFIgPSAxO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICBSID0gNjM3MztcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vua25vd24gb3B0aW9uIGdpdmVuIHRvIFwidW5pdHNcIicpO1xuICB9XG5cbiAgdmFyIGRpc3RhbmNlID0gUiAqIGM7XG4gIHJldHVybiBkaXN0YW5jZTtcbn07XG5cbmZ1bmN0aW9uIHRvUmFkKGRlZ3JlZSkge1xuICByZXR1cm4gZGVncmVlICogTWF0aC5QSSAvIDE4MDtcbn1cbiIsIi8qKlxuICogVGFrZXMgb25lIG9yIG1vcmUge0BsaW5rIEZlYXR1cmV8RmVhdHVyZXN9IGFuZCBjcmVhdGVzIGEge0BsaW5rIEZlYXR1cmVDb2xsZWN0aW9ufVxuICpcbiAqIEBtb2R1bGUgdHVyZi9mZWF0dXJlY29sbGVjdGlvblxuICogQGNhdGVnb3J5IGhlbHBlclxuICogQHBhcmFtIHtGZWF0dXJlfSBmZWF0dXJlcyBpbnB1dCBGZWF0dXJlc1xuICogQHJldHVybnMge0ZlYXR1cmVDb2xsZWN0aW9ufSBhIEZlYXR1cmVDb2xsZWN0aW9uIG9mIGlucHV0IGZlYXR1cmVzXG4gKiBAZXhhbXBsZVxuICogdmFyIGZlYXR1cmVzID0gW1xuICogIHR1cmYucG9pbnQoWy03NS4zNDMsIDM5Ljk4NF0sIHtuYW1lOiAnTG9jYXRpb24gQSd9KSxcbiAqICB0dXJmLnBvaW50KFstNzUuODMzLCAzOS4yODRdLCB7bmFtZTogJ0xvY2F0aW9uIEInfSksXG4gKiAgdHVyZi5wb2ludChbLTc1LjUzNCwgMzkuMTIzXSwge25hbWU6ICdMb2NhdGlvbiBDJ30pXG4gKiBdO1xuICpcbiAqIHZhciBmYyA9IHR1cmYuZmVhdHVyZWNvbGxlY3Rpb24oZmVhdHVyZXMpO1xuICpcbiAqIC8vPWZjXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZmVhdHVyZXMpe1xuICByZXR1cm4ge1xuICAgIHR5cGU6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAgICBmZWF0dXJlczogZmVhdHVyZXNcbiAgfTtcbn07XG4iLCIvKipcbiAqIFdyYXBzIGEgR2VvSlNPTiB7QGxpbmsgR2VvbWV0cnl9IGluIGEgR2VvSlNPTiB7QGxpbmsgRmVhdHVyZX0uXG4gKlxuICogQG5hbWUgZmVhdHVyZVxuICogQHBhcmFtIHtHZW9tZXRyeX0gZ2VvbWV0cnkgaW5wdXQgZ2VvbWV0cnlcbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wZXJ0aWVzIHByb3BlcnRpZXNcbiAqIEByZXR1cm5zIHtGZWF0dXJlQ29sbGVjdGlvbn0gYSBGZWF0dXJlQ29sbGVjdGlvbiBvZiBpbnB1dCBmZWF0dXJlc1xuICogQGV4YW1wbGVcbiAqIHZhciBnZW9tZXRyeSA9IHtcbiAqICAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICAgXCJjb29yZGluYXRlc1wiOiBbXG4gKiAgICAgICAgNjcuNSxcbiAqICAgICAgICAzMi44NDI2NzM2MzE5NTQzMVxuICogICAgICBdXG4gKiAgICB9XG4gKlxuICogdmFyIGZlYXR1cmUgPSB0dXJmLmZlYXR1cmUoZ2VvbWV0cnkpO1xuICpcbiAqIC8vPWZlYXR1cmVcbiAqL1xuZnVuY3Rpb24gZmVhdHVyZShnZW9tZXRyeSwgcHJvcGVydGllcykge1xuICAgIHJldHVybiB7XG4gICAgICAgIHR5cGU6ICdGZWF0dXJlJyxcbiAgICAgICAgcHJvcGVydGllczogcHJvcGVydGllcyB8fCB7fSxcbiAgICAgICAgZ2VvbWV0cnk6IGdlb21ldHJ5XG4gICAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMuZmVhdHVyZSA9IGZlYXR1cmU7XG5cbi8qKlxuICogVGFrZXMgY29vcmRpbmF0ZXMgYW5kIHByb3BlcnRpZXMgKG9wdGlvbmFsKSBhbmQgcmV0dXJucyBhIG5ldyB7QGxpbmsgUG9pbnR9IGZlYXR1cmUuXG4gKlxuICogQG5hbWUgcG9pbnRcbiAqIEBwYXJhbSB7bnVtYmVyW119IGNvb3JkaW5hdGVzIGxvbmdpdHVkZSwgbGF0aXR1ZGUgcG9zaXRpb24gKGVhY2ggaW4gZGVjaW1hbCBkZWdyZWVzKVxuICogQHBhcmFtIHtPYmplY3Q9fSBwcm9wZXJ0aWVzIGFuIE9iamVjdCB0aGF0IGlzIHVzZWQgYXMgdGhlIHtAbGluayBGZWF0dXJlfSdzXG4gKiBwcm9wZXJ0aWVzXG4gKiBAcmV0dXJucyB7RmVhdHVyZTxQb2ludD59IGEgUG9pbnQgZmVhdHVyZVxuICogQGV4YW1wbGVcbiAqIHZhciBwdDEgPSB0dXJmLnBvaW50KFstNzUuMzQzLCAzOS45ODRdKTtcbiAqXG4gKiAvLz1wdDFcbiAqL1xubW9kdWxlLmV4cG9ydHMucG9pbnQgPSBmdW5jdGlvbiAoY29vcmRpbmF0ZXMsIHByb3BlcnRpZXMpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoY29vcmRpbmF0ZXMpKSB0aHJvdyBuZXcgRXJyb3IoJ0Nvb3JkaW5hdGVzIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICBpZiAoY29vcmRpbmF0ZXMubGVuZ3RoIDwgMikgdGhyb3cgbmV3IEVycm9yKCdDb29yZGluYXRlcyBtdXN0IGJlIGF0IGxlYXN0IDIgbnVtYmVycyBsb25nJyk7XG4gICAgcmV0dXJuIGZlYXR1cmUoe1xuICAgICAgICB0eXBlOiAnUG9pbnQnLFxuICAgICAgICBjb29yZGluYXRlczogY29vcmRpbmF0ZXMuc2xpY2UoKVxuICAgIH0sIHByb3BlcnRpZXMpO1xufTtcblxuLyoqXG4gKiBUYWtlcyBhbiBhcnJheSBvZiBMaW5lYXJSaW5ncyBhbmQgb3B0aW9uYWxseSBhbiB7QGxpbmsgT2JqZWN0fSB3aXRoIHByb3BlcnRpZXMgYW5kIHJldHVybnMgYSB7QGxpbmsgUG9seWdvbn0gZmVhdHVyZS5cbiAqXG4gKiBAbmFtZSBwb2x5Z29uXG4gKiBAcGFyYW0ge0FycmF5PEFycmF5PEFycmF5PG51bWJlcj4+Pn0gY29vcmRpbmF0ZXMgYW4gYXJyYXkgb2YgTGluZWFyUmluZ3NcbiAqIEBwYXJhbSB7T2JqZWN0PX0gcHJvcGVydGllcyBhIHByb3BlcnRpZXMgb2JqZWN0XG4gKiBAcmV0dXJucyB7RmVhdHVyZTxQb2x5Z29uPn0gYSBQb2x5Z29uIGZlYXR1cmVcbiAqIEB0aHJvd3Mge0Vycm9yfSB0aHJvdyBhbiBlcnJvciBpZiBhIExpbmVhclJpbmcgb2YgdGhlIHBvbHlnb24gaGFzIHRvbyBmZXcgcG9zaXRpb25zXG4gKiBvciBpZiBhIExpbmVhclJpbmcgb2YgdGhlIFBvbHlnb24gZG9lcyBub3QgaGF2ZSBtYXRjaGluZyBQb3NpdGlvbnMgYXQgdGhlXG4gKiBiZWdpbm5pbmcgJiBlbmQuXG4gKiBAZXhhbXBsZVxuICogdmFyIHBvbHlnb24gPSB0dXJmLnBvbHlnb24oW1tcbiAqICBbLTIuMjc1NTQzLCA1My40NjQ1NDddLFxuICogIFstMi4yNzU1NDMsIDUzLjQ4OTI3MV0sXG4gKiAgWy0yLjIxNTExOCwgNTMuNDg5MjcxXSxcbiAqICBbLTIuMjE1MTE4LCA1My40NjQ1NDddLFxuICogIFstMi4yNzU1NDMsIDUzLjQ2NDU0N11cbiAqIF1dLCB7IG5hbWU6ICdwb2x5MScsIHBvcHVsYXRpb246IDQwMH0pO1xuICpcbiAqIC8vPXBvbHlnb25cbiAqL1xubW9kdWxlLmV4cG9ydHMucG9seWdvbiA9IGZ1bmN0aW9uIChjb29yZGluYXRlcywgcHJvcGVydGllcykge1xuXG4gICAgaWYgKCFjb29yZGluYXRlcykgdGhyb3cgbmV3IEVycm9yKCdObyBjb29yZGluYXRlcyBwYXNzZWQnKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29vcmRpbmF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJpbmcgPSBjb29yZGluYXRlc1tpXTtcbiAgICAgICAgaWYgKHJpbmcubGVuZ3RoIDwgNCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFYWNoIExpbmVhclJpbmcgb2YgYSBQb2x5Z29uIG11c3QgaGF2ZSA0IG9yIG1vcmUgUG9zaXRpb25zLicpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgcmluZ1tyaW5nLmxlbmd0aCAtIDFdLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBpZiAocmluZ1tyaW5nLmxlbmd0aCAtIDFdW2pdICE9PSByaW5nWzBdW2pdKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGaXJzdCBhbmQgbGFzdCBQb3NpdGlvbiBhcmUgbm90IGVxdWl2YWxlbnQuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmVhdHVyZSh7XG4gICAgICAgIHR5cGU6ICdQb2x5Z29uJyxcbiAgICAgICAgY29vcmRpbmF0ZXM6IGNvb3JkaW5hdGVzXG4gICAgfSwgcHJvcGVydGllcyk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSB7QGxpbmsgTGluZVN0cmluZ30gYmFzZWQgb24gYVxuICogY29vcmRpbmF0ZSBhcnJheS4gUHJvcGVydGllcyBjYW4gYmUgYWRkZWQgb3B0aW9uYWxseS5cbiAqXG4gKiBAbmFtZSBsaW5lU3RyaW5nXG4gKiBAcGFyYW0ge0FycmF5PEFycmF5PG51bWJlcj4+fSBjb29yZGluYXRlcyBhbiBhcnJheSBvZiBQb3NpdGlvbnNcbiAqIEBwYXJhbSB7T2JqZWN0PX0gcHJvcGVydGllcyBhbiBPYmplY3Qgb2Yga2V5LXZhbHVlIHBhaXJzIHRvIGFkZCBhcyBwcm9wZXJ0aWVzXG4gKiBAcmV0dXJucyB7RmVhdHVyZTxMaW5lU3RyaW5nPn0gYSBMaW5lU3RyaW5nIGZlYXR1cmVcbiAqIEB0aHJvd3Mge0Vycm9yfSBpZiBubyBjb29yZGluYXRlcyBhcmUgcGFzc2VkXG4gKiBAZXhhbXBsZVxuICogdmFyIGxpbmVzdHJpbmcxID0gdHVyZi5saW5lU3RyaW5nKFtcbiAqXHRbLTIxLjk2NDQxNiwgNjQuMTQ4MjAzXSxcbiAqXHRbLTIxLjk1NjE3NiwgNjQuMTQxMzE2XSxcbiAqXHRbLTIxLjkzOTAxLCA2NC4xMzU5MjRdLFxuICpcdFstMjEuOTI3MzM3LCA2NC4xMzY2NzNdXG4gKiBdKTtcbiAqIHZhciBsaW5lc3RyaW5nMiA9IHR1cmYubGluZVN0cmluZyhbXG4gKlx0Wy0yMS45MjkwNTQsIDY0LjEyNzk4NV0sXG4gKlx0Wy0yMS45MTI5MTgsIDY0LjEzNDcyNl0sXG4gKlx0Wy0yMS45MTYwMDcsIDY0LjE0MTAxNl0sXG4gKiBcdFstMjEuOTMwMDg0LCA2NC4xNDQ0Nl1cbiAqIF0sIHtuYW1lOiAnbGluZSAxJywgZGlzdGFuY2U6IDE0NX0pO1xuICpcbiAqIC8vPWxpbmVzdHJpbmcxXG4gKlxuICogLy89bGluZXN0cmluZzJcbiAqL1xubW9kdWxlLmV4cG9ydHMubGluZVN0cmluZyA9IGZ1bmN0aW9uIChjb29yZGluYXRlcywgcHJvcGVydGllcykge1xuICAgIGlmICghY29vcmRpbmF0ZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBjb29yZGluYXRlcyBwYXNzZWQnKTtcbiAgICB9XG4gICAgcmV0dXJuIGZlYXR1cmUoe1xuICAgICAgICB0eXBlOiAnTGluZVN0cmluZycsXG4gICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlc1xuICAgIH0sIHByb3BlcnRpZXMpO1xufTtcblxuLyoqXG4gKiBUYWtlcyBvbmUgb3IgbW9yZSB7QGxpbmsgRmVhdHVyZXxGZWF0dXJlc30gYW5kIGNyZWF0ZXMgYSB7QGxpbmsgRmVhdHVyZUNvbGxlY3Rpb259LlxuICpcbiAqIEBuYW1lIGZlYXR1cmVDb2xsZWN0aW9uXG4gKiBAcGFyYW0ge0ZlYXR1cmVbXX0gZmVhdHVyZXMgaW5wdXQgZmVhdHVyZXNcbiAqIEByZXR1cm5zIHtGZWF0dXJlQ29sbGVjdGlvbn0gYSBGZWF0dXJlQ29sbGVjdGlvbiBvZiBpbnB1dCBmZWF0dXJlc1xuICogQGV4YW1wbGVcbiAqIHZhciBmZWF0dXJlcyA9IFtcbiAqICB0dXJmLnBvaW50KFstNzUuMzQzLCAzOS45ODRdLCB7bmFtZTogJ0xvY2F0aW9uIEEnfSksXG4gKiAgdHVyZi5wb2ludChbLTc1LjgzMywgMzkuMjg0XSwge25hbWU6ICdMb2NhdGlvbiBCJ30pLFxuICogIHR1cmYucG9pbnQoWy03NS41MzQsIDM5LjEyM10sIHtuYW1lOiAnTG9jYXRpb24gQyd9KVxuICogXTtcbiAqXG4gKiB2YXIgZmMgPSB0dXJmLmZlYXR1cmVDb2xsZWN0aW9uKGZlYXR1cmVzKTtcbiAqXG4gKiAvLz1mY1xuICovXG5tb2R1bGUuZXhwb3J0cy5mZWF0dXJlQ29sbGVjdGlvbiA9IGZ1bmN0aW9uIChmZWF0dXJlcykge1xuICAgIHJldHVybiB7XG4gICAgICAgIHR5cGU6ICdGZWF0dXJlQ29sbGVjdGlvbicsXG4gICAgICAgIGZlYXR1cmVzOiBmZWF0dXJlc1xuICAgIH07XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSB7QGxpbmsgRmVhdHVyZTxNdWx0aUxpbmVTdHJpbmc+fSBiYXNlZCBvbiBhXG4gKiBjb29yZGluYXRlIGFycmF5LiBQcm9wZXJ0aWVzIGNhbiBiZSBhZGRlZCBvcHRpb25hbGx5LlxuICpcbiAqIEBuYW1lIG11bHRpTGluZVN0cmluZ1xuICogQHBhcmFtIHtBcnJheTxBcnJheTxBcnJheTxudW1iZXI+Pj59IGNvb3JkaW5hdGVzIGFuIGFycmF5IG9mIExpbmVTdHJpbmdzXG4gKiBAcGFyYW0ge09iamVjdD19IHByb3BlcnRpZXMgYW4gT2JqZWN0IG9mIGtleS12YWx1ZSBwYWlycyB0byBhZGQgYXMgcHJvcGVydGllc1xuICogQHJldHVybnMge0ZlYXR1cmU8TXVsdGlMaW5lU3RyaW5nPn0gYSBNdWx0aUxpbmVTdHJpbmcgZmVhdHVyZVxuICogQHRocm93cyB7RXJyb3J9IGlmIG5vIGNvb3JkaW5hdGVzIGFyZSBwYXNzZWRcbiAqIEBleGFtcGxlXG4gKiB2YXIgbXVsdGlMaW5lID0gdHVyZi5tdWx0aUxpbmVTdHJpbmcoW1tbMCwwXSxbMTAsMTBdXV0pO1xuICpcbiAqIC8vPW11bHRpTGluZVxuICpcbiAqL1xubW9kdWxlLmV4cG9ydHMubXVsdGlMaW5lU3RyaW5nID0gZnVuY3Rpb24gKGNvb3JkaW5hdGVzLCBwcm9wZXJ0aWVzKSB7XG4gICAgaWYgKCFjb29yZGluYXRlcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGNvb3JkaW5hdGVzIHBhc3NlZCcpO1xuICAgIH1cbiAgICByZXR1cm4gZmVhdHVyZSh7XG4gICAgICAgIHR5cGU6ICdNdWx0aUxpbmVTdHJpbmcnLFxuICAgICAgICBjb29yZGluYXRlczogY29vcmRpbmF0ZXNcbiAgICB9LCBwcm9wZXJ0aWVzKTtcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhIHtAbGluayBGZWF0dXJlPE11bHRpUG9pbnQ+fSBiYXNlZCBvbiBhXG4gKiBjb29yZGluYXRlIGFycmF5LiBQcm9wZXJ0aWVzIGNhbiBiZSBhZGRlZCBvcHRpb25hbGx5LlxuICpcbiAqIEBuYW1lIG11bHRpUG9pbnRcbiAqIEBwYXJhbSB7QXJyYXk8QXJyYXk8bnVtYmVyPj59IGNvb3JkaW5hdGVzIGFuIGFycmF5IG9mIFBvc2l0aW9uc1xuICogQHBhcmFtIHtPYmplY3Q9fSBwcm9wZXJ0aWVzIGFuIE9iamVjdCBvZiBrZXktdmFsdWUgcGFpcnMgdG8gYWRkIGFzIHByb3BlcnRpZXNcbiAqIEByZXR1cm5zIHtGZWF0dXJlPE11bHRpUG9pbnQ+fSBhIE11bHRpUG9pbnQgZmVhdHVyZVxuICogQHRocm93cyB7RXJyb3J9IGlmIG5vIGNvb3JkaW5hdGVzIGFyZSBwYXNzZWRcbiAqIEBleGFtcGxlXG4gKiB2YXIgbXVsdGlQdCA9IHR1cmYubXVsdGlQb2ludChbWzAsMF0sWzEwLDEwXV0pO1xuICpcbiAqIC8vPW11bHRpUHRcbiAqXG4gKi9cbm1vZHVsZS5leHBvcnRzLm11bHRpUG9pbnQgPSBmdW5jdGlvbiAoY29vcmRpbmF0ZXMsIHByb3BlcnRpZXMpIHtcbiAgICBpZiAoIWNvb3JkaW5hdGVzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gY29vcmRpbmF0ZXMgcGFzc2VkJyk7XG4gICAgfVxuICAgIHJldHVybiBmZWF0dXJlKHtcbiAgICAgICAgdHlwZTogJ011bHRpUG9pbnQnLFxuICAgICAgICBjb29yZGluYXRlczogY29vcmRpbmF0ZXNcbiAgICB9LCBwcm9wZXJ0aWVzKTtcbn07XG5cblxuLyoqXG4gKiBDcmVhdGVzIGEge0BsaW5rIEZlYXR1cmU8TXVsdGlQb2x5Z29uPn0gYmFzZWQgb24gYVxuICogY29vcmRpbmF0ZSBhcnJheS4gUHJvcGVydGllcyBjYW4gYmUgYWRkZWQgb3B0aW9uYWxseS5cbiAqXG4gKiBAbmFtZSBtdWx0aVBvbHlnb25cbiAqIEBwYXJhbSB7QXJyYXk8QXJyYXk8QXJyYXk8QXJyYXk8bnVtYmVyPj4+Pn0gY29vcmRpbmF0ZXMgYW4gYXJyYXkgb2YgUG9seWdvbnNcbiAqIEBwYXJhbSB7T2JqZWN0PX0gcHJvcGVydGllcyBhbiBPYmplY3Qgb2Yga2V5LXZhbHVlIHBhaXJzIHRvIGFkZCBhcyBwcm9wZXJ0aWVzXG4gKiBAcmV0dXJucyB7RmVhdHVyZTxNdWx0aVBvbHlnb24+fSBhIG11bHRpcG9seWdvbiBmZWF0dXJlXG4gKiBAdGhyb3dzIHtFcnJvcn0gaWYgbm8gY29vcmRpbmF0ZXMgYXJlIHBhc3NlZFxuICogQGV4YW1wbGVcbiAqIHZhciBtdWx0aVBvbHkgPSB0dXJmLm11bHRpUG9seWdvbihbW1tbMCwwXSxbMCwxMF0sWzEwLDEwXSxbMTAsMF0sWzAsMF1dXSk7XG4gKlxuICogLy89bXVsdGlQb2x5XG4gKlxuICovXG5tb2R1bGUuZXhwb3J0cy5tdWx0aVBvbHlnb24gPSBmdW5jdGlvbiAoY29vcmRpbmF0ZXMsIHByb3BlcnRpZXMpIHtcbiAgICBpZiAoIWNvb3JkaW5hdGVzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gY29vcmRpbmF0ZXMgcGFzc2VkJyk7XG4gICAgfVxuICAgIHJldHVybiBmZWF0dXJlKHtcbiAgICAgICAgdHlwZTogJ011bHRpUG9seWdvbicsXG4gICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlc1xuICAgIH0sIHByb3BlcnRpZXMpO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGEge0BsaW5rIEZlYXR1cmU8R2VvbWV0cnlDb2xsZWN0aW9uPn0gYmFzZWQgb24gYVxuICogY29vcmRpbmF0ZSBhcnJheS4gUHJvcGVydGllcyBjYW4gYmUgYWRkZWQgb3B0aW9uYWxseS5cbiAqXG4gKiBAbmFtZSBnZW9tZXRyeUNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7QXJyYXk8e0dlb21ldHJ5fT59IGdlb21ldHJpZXMgYW4gYXJyYXkgb2YgR2VvSlNPTiBHZW9tZXRyaWVzXG4gKiBAcGFyYW0ge09iamVjdD19IHByb3BlcnRpZXMgYW4gT2JqZWN0IG9mIGtleS12YWx1ZSBwYWlycyB0byBhZGQgYXMgcHJvcGVydGllc1xuICogQHJldHVybnMge0ZlYXR1cmU8R2VvbWV0cnlDb2xsZWN0aW9uPn0gYSBnZW9tZXRyeWNvbGxlY3Rpb24gZmVhdHVyZVxuICogQGV4YW1wbGVcbiAqIHZhciBwdCA9IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgICAgXCJjb29yZGluYXRlc1wiOiBbMTAwLCAwXVxuICogICAgIH07XG4gKiB2YXIgbGluZSA9IHtcbiAqICAgICBcInR5cGVcIjogXCJMaW5lU3RyaW5nXCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbIFsxMDEsIDBdLCBbMTAyLCAxXSBdXG4gKiAgIH07XG4gKiB2YXIgY29sbGVjdGlvbiA9IHR1cmYuZ2VvbWV0cnljb2xsZWN0aW9uKFtbMCwwXSxbMTAsMTBdXSk7XG4gKlxuICogLy89Y29sbGVjdGlvblxuICovXG5tb2R1bGUuZXhwb3J0cy5nZW9tZXRyeUNvbGxlY3Rpb24gPSBmdW5jdGlvbiAoZ2VvbWV0cmllcywgcHJvcGVydGllcykge1xuICAgIHJldHVybiBmZWF0dXJlKHtcbiAgICAgICAgdHlwZTogJ0dlb21ldHJ5Q29sbGVjdGlvbicsXG4gICAgICAgIGdlb21ldHJpZXM6IGdlb21ldHJpZXNcbiAgICB9LCBwcm9wZXJ0aWVzKTtcbn07XG5cbnZhciBmYWN0b3JzID0ge1xuICAgIG1pbGVzOiAzOTYwLFxuICAgIG5hdXRpY2FsbWlsZXM6IDM0NDEuMTQ1LFxuICAgIGRlZ3JlZXM6IDU3LjI5NTc3OTUsXG4gICAgcmFkaWFuczogMSxcbiAgICBpbmNoZXM6IDI1MDkwNTYwMCxcbiAgICB5YXJkczogNjk2OTYwMCxcbiAgICBtZXRlcnM6IDYzNzMwMDAsXG4gICAgbWV0cmVzOiA2MzczMDAwLFxuICAgIGtpbG9tZXRlcnM6IDYzNzMsXG4gICAga2lsb21ldHJlczogNjM3M1xufTtcblxuLypcbiAqIENvbnZlcnQgYSBkaXN0YW5jZSBtZWFzdXJlbWVudCBmcm9tIHJhZGlhbnMgdG8gYSBtb3JlIGZyaWVuZGx5IHVuaXQuXG4gKlxuICogQG5hbWUgcmFkaWFuc1RvRGlzdGFuY2VcbiAqIEBwYXJhbSB7bnVtYmVyfSBkaXN0YW5jZSBpbiByYWRpYW5zIGFjcm9zcyB0aGUgc3BoZXJlXG4gKiBAcGFyYW0ge3N0cmluZz1raWxvbWV0ZXJzfSB1bml0czogb25lIG9mIG1pbGVzLCBuYXV0aWNhbG1pbGVzLCBkZWdyZWVzLCByYWRpYW5zLFxuICogaW5jaGVzLCB5YXJkcywgbWV0cmVzLCBtZXRlcnMsIGtpbG9tZXRyZXMsIGtpbG9tZXRlcnMuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBkaXN0YW5jZVxuICovXG5tb2R1bGUuZXhwb3J0cy5yYWRpYW5zVG9EaXN0YW5jZSA9IGZ1bmN0aW9uIChyYWRpYW5zLCB1bml0cykge1xuICAgIHZhciBmYWN0b3IgPSBmYWN0b3JzW3VuaXRzIHx8ICdraWxvbWV0ZXJzJ107XG4gICAgaWYgKGZhY3RvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB1bml0Jyk7XG4gICAgfVxuICAgIHJldHVybiByYWRpYW5zICogZmFjdG9yO1xufTtcblxuLypcbiAqIENvbnZlcnQgYSBkaXN0YW5jZSBtZWFzdXJlbWVudCBmcm9tIGEgcmVhbC13b3JsZCB1bml0IGludG8gcmFkaWFuc1xuICpcbiAqIEBuYW1lIGRpc3RhbmNlVG9SYWRpYW5zXG4gKiBAcGFyYW0ge251bWJlcn0gZGlzdGFuY2UgaW4gcmVhbCB1bml0c1xuICogQHBhcmFtIHtzdHJpbmc9a2lsb21ldGVyc30gdW5pdHM6IG9uZSBvZiBtaWxlcywgbmF1dGljYWxtaWxlcywgZGVncmVlcywgcmFkaWFucyxcbiAqIGluY2hlcywgeWFyZHMsIG1ldHJlcywgbWV0ZXJzLCBraWxvbWV0cmVzLCBraWxvbWV0ZXJzLlxuICogQHJldHVybnMge251bWJlcn0gcmFkaWFuc1xuICovXG5tb2R1bGUuZXhwb3J0cy5kaXN0YW5jZVRvUmFkaWFucyA9IGZ1bmN0aW9uIChkaXN0YW5jZSwgdW5pdHMpIHtcbiAgICB2YXIgZmFjdG9yID0gZmFjdG9yc1t1bml0cyB8fCAna2lsb21ldGVycyddO1xuICAgIGlmIChmYWN0b3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdW5pdCcpO1xuICAgIH1cbiAgICByZXR1cm4gZGlzdGFuY2UgLyBmYWN0b3I7XG59O1xuXG4vKlxuICogQ29udmVydCBhIGRpc3RhbmNlIG1lYXN1cmVtZW50IGZyb20gYSByZWFsLXdvcmxkIHVuaXQgaW50byBkZWdyZWVzXG4gKlxuICogQG5hbWUgZGlzdGFuY2VUb1JhZGlhbnNcbiAqIEBwYXJhbSB7bnVtYmVyfSBkaXN0YW5jZSBpbiByZWFsIHVuaXRzXG4gKiBAcGFyYW0ge3N0cmluZz1raWxvbWV0ZXJzfSB1bml0czogb25lIG9mIG1pbGVzLCBuYXV0aWNhbG1pbGVzLCBkZWdyZWVzLCByYWRpYW5zLFxuICogaW5jaGVzLCB5YXJkcywgbWV0cmVzLCBtZXRlcnMsIGtpbG9tZXRyZXMsIGtpbG9tZXRlcnMuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBkZWdyZWVzXG4gKi9cbm1vZHVsZS5leHBvcnRzLmRpc3RhbmNlVG9EZWdyZWVzID0gZnVuY3Rpb24gKGRpc3RhbmNlLCB1bml0cykge1xuICAgIHZhciBmYWN0b3IgPSBmYWN0b3JzW3VuaXRzIHx8ICdraWxvbWV0ZXJzJ107XG4gICAgaWYgKGZhY3RvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB1bml0Jyk7XG4gICAgfVxuICAgIHJldHVybiAoZGlzdGFuY2UgLyBmYWN0b3IpICogNTcuMjk1ODtcbn07XG4iLCIvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0V2ZW4lRTIlODAlOTNvZGRfcnVsZVxuLy8gbW9kaWZpZWQgZnJvbTogaHR0cHM6Ly9naXRodWIuY29tL3N1YnN0YWNrL3BvaW50LWluLXBvbHlnb24vYmxvYi9tYXN0ZXIvaW5kZXguanNcbi8vIHdoaWNoIHdhcyBtb2RpZmllZCBmcm9tIGh0dHA6Ly93d3cuZWNzZS5ycGkuZWR1L0hvbWVwYWdlcy93cmYvUmVzZWFyY2gvU2hvcnRfTm90ZXMvcG5wb2x5Lmh0bWxcblxuLyoqXG4gKiBUYWtlcyBhIHtAbGluayBQb2ludH0gZmVhdHVyZSBhbmQgYSB7QGxpbmsgUG9seWdvbn0gZmVhdHVyZSBhbmQgZGV0ZXJtaW5lcyBpZiB0aGUgUG9pbnQgcmVzaWRlcyBpbnNpZGUgdGhlIFBvbHlnb24uIFRoZSBQb2x5Z29uIGNhblxuICogYmUgY29udmV4IG9yIGNvbmNhdmUuIFRoZSBmdW5jdGlvbiBhY2NlcHRzIGFueSB2YWxpZCBQb2x5Z29uIG9yIHtAbGluayBNdWx0aVBvbHlnb259XG4gKiBhbmQgYWNjb3VudHMgZm9yIGhvbGVzLlxuICpcbiAqIEBtb2R1bGUgdHVyZi9pbnNpZGVcbiAqIEBjYXRlZ29yeSBqb2luc1xuICogQHBhcmFtIHtQb2ludH0gcG9pbnQgYSBQb2ludCBmZWF0dXJlXG4gKiBAcGFyYW0ge1BvbHlnb259IHBvbHlnb24gYSBQb2x5Z29uIGZlYXR1cmVcbiAqIEByZXR1cm4ge0Jvb2xlYW59IGB0cnVlYCBpZiB0aGUgUG9pbnQgaXMgaW5zaWRlIHRoZSBQb2x5Z29uOyBgZmFsc2VgIGlmIHRoZSBQb2ludCBpcyBub3QgaW5zaWRlIHRoZSBQb2x5Z29uXG4gKiBAZXhhbXBsZVxuICogdmFyIHB0MSA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge1xuICogICAgIFwibWFya2VyLWNvbG9yXCI6IFwiI2YwMFwiXG4gKiAgIH0sXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbLTExMS40NjcyODUsIDQwLjc1NzY2XVxuICogICB9XG4gKiB9O1xuICogdmFyIHB0MiA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge1xuICogICAgIFwibWFya2VyLWNvbG9yXCI6IFwiIzBmMFwiXG4gKiAgIH0sXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbLTExMS44NzM3NzksIDQwLjY0NzMwM11cbiAqICAgfVxuICogfTtcbiAqIHZhciBwb2x5ID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9seWdvblwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogW1tcbiAqICAgICAgIFstMTEyLjA3NDI3OSwgNDAuNTIyMTVdLFxuICogICAgICAgWy0xMTIuMDc0Mjc5LCA0MC44NTMyOTNdLFxuICogICAgICAgWy0xMTEuNjEwMTA3LCA0MC44NTMyOTNdLFxuICogICAgICAgWy0xMTEuNjEwMTA3LCA0MC41MjIxNV0sXG4gKiAgICAgICBbLTExMi4wNzQyNzksIDQwLjUyMjE1XVxuICogICAgIF1dXG4gKiAgIH1cbiAqIH07XG4gKlxuICogdmFyIGZlYXR1cmVzID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICogICBcImZlYXR1cmVzXCI6IFtwdDEsIHB0MiwgcG9seV1cbiAqIH07XG4gKlxuICogLy89ZmVhdHVyZXNcbiAqXG4gKiB2YXIgaXNJbnNpZGUxID0gdHVyZi5pbnNpZGUocHQxLCBwb2x5KTtcbiAqIC8vPWlzSW5zaWRlMVxuICpcbiAqIHZhciBpc0luc2lkZTIgPSB0dXJmLmluc2lkZShwdDIsIHBvbHkpO1xuICogLy89aXNJbnNpZGUyXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocG9pbnQsIHBvbHlnb24pIHtcbiAgdmFyIHBvbHlzID0gcG9seWdvbi5nZW9tZXRyeS5jb29yZGluYXRlcztcbiAgdmFyIHB0ID0gW3BvaW50Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLCBwb2ludC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXV07XG4gIC8vIG5vcm1hbGl6ZSB0byBtdWx0aXBvbHlnb25cbiAgaWYocG9seWdvbi5nZW9tZXRyeS50eXBlID09PSAnUG9seWdvbicpIHBvbHlzID0gW3BvbHlzXTtcblxuICB2YXIgaW5zaWRlUG9seSA9IGZhbHNlO1xuICB2YXIgaSA9IDA7XG4gIHdoaWxlIChpIDwgcG9seXMubGVuZ3RoICYmICFpbnNpZGVQb2x5KSB7XG4gICAgLy8gY2hlY2sgaWYgaXQgaXMgaW4gdGhlIG91dGVyIHJpbmcgZmlyc3RcbiAgICBpZihpblJpbmcocHQsIHBvbHlzW2ldWzBdKSkge1xuICAgICAgdmFyIGluSG9sZSA9IGZhbHNlO1xuICAgICAgdmFyIGsgPSAxO1xuICAgICAgLy8gY2hlY2sgZm9yIHRoZSBwb2ludCBpbiBhbnkgb2YgdGhlIGhvbGVzXG4gICAgICB3aGlsZShrIDwgcG9seXNbaV0ubGVuZ3RoICYmICFpbkhvbGUpIHtcbiAgICAgICAgaWYoaW5SaW5nKHB0LCBwb2x5c1tpXVtrXSkpIHtcbiAgICAgICAgICBpbkhvbGUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGsrKztcbiAgICAgIH1cbiAgICAgIGlmKCFpbkhvbGUpIGluc2lkZVBvbHkgPSB0cnVlO1xuICAgIH1cbiAgICBpKys7XG4gIH1cbiAgcmV0dXJuIGluc2lkZVBvbHk7XG59XG5cbi8vIHB0IGlzIFt4LHldIGFuZCByaW5nIGlzIFtbeCx5XSwgW3gseV0sLi5dXG5mdW5jdGlvbiBpblJpbmcgKHB0LCByaW5nKSB7XG4gIHZhciBpc0luc2lkZSA9IGZhbHNlO1xuICBmb3IgKHZhciBpID0gMCwgaiA9IHJpbmcubGVuZ3RoIC0gMTsgaSA8IHJpbmcubGVuZ3RoOyBqID0gaSsrKSB7XG4gICAgdmFyIHhpID0gcmluZ1tpXVswXSwgeWkgPSByaW5nW2ldWzFdO1xuICAgIHZhciB4aiA9IHJpbmdbal1bMF0sIHlqID0gcmluZ1tqXVsxXTtcbiAgICBcbiAgICB2YXIgaW50ZXJzZWN0ID0gKCh5aSA+IHB0WzFdKSAhPSAoeWogPiBwdFsxXSkpXG4gICAgICAgICYmIChwdFswXSA8ICh4aiAtIHhpKSAqIChwdFsxXSAtIHlpKSAvICh5aiAtIHlpKSArIHhpKTtcbiAgICBpZiAoaW50ZXJzZWN0KSBpc0luc2lkZSA9ICFpc0luc2lkZTtcbiAgfVxuICByZXR1cm4gaXNJbnNpZGU7XG59XG5cbiIsIm1vZHVsZS5leHBvcnRzLmdlb2pzb25UeXBlID0gZ2VvanNvblR5cGU7XG5tb2R1bGUuZXhwb3J0cy5jb2xsZWN0aW9uT2YgPSBjb2xsZWN0aW9uT2Y7XG5tb2R1bGUuZXhwb3J0cy5mZWF0dXJlT2YgPSBmZWF0dXJlT2Y7XG5cbi8qKlxuICogRW5mb3JjZSBleHBlY3RhdGlvbnMgYWJvdXQgdHlwZXMgb2YgR2VvSlNPTiBvYmplY3RzIGZvciBUdXJmLlxuICpcbiAqIEBhbGlhcyBnZW9qc29uVHlwZVxuICogQHBhcmFtIHtHZW9KU09OfSB2YWx1ZSBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIGV4cGVjdGVkIEdlb0pTT04gdHlwZVxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgbmFtZSBvZiBjYWxsaW5nIGZ1bmN0aW9uXG4gKiBAdGhyb3dzIEVycm9yIGlmIHZhbHVlIGlzIG5vdCB0aGUgZXhwZWN0ZWQgdHlwZS5cbiAqL1xuZnVuY3Rpb24gZ2VvanNvblR5cGUodmFsdWUsIHR5cGUsIG5hbWUpIHtcbiAgICBpZiAoIXR5cGUgfHwgIW5hbWUpIHRocm93IG5ldyBFcnJvcigndHlwZSBhbmQgbmFtZSByZXF1aXJlZCcpO1xuXG4gICAgaWYgKCF2YWx1ZSB8fCB2YWx1ZS50eXBlICE9PSB0eXBlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBpbnB1dCB0byAnICsgbmFtZSArICc6IG11c3QgYmUgYSAnICsgdHlwZSArICcsIGdpdmVuICcgKyB2YWx1ZS50eXBlKTtcbiAgICB9XG59XG5cbi8qKlxuICogRW5mb3JjZSBleHBlY3RhdGlvbnMgYWJvdXQgdHlwZXMgb2Yge0BsaW5rIEZlYXR1cmV9IGlucHV0cyBmb3IgVHVyZi5cbiAqIEludGVybmFsbHkgdGhpcyB1c2VzIHtAbGluayBnZW9qc29uVHlwZX0gdG8ganVkZ2UgZ2VvbWV0cnkgdHlwZXMuXG4gKlxuICogQGFsaWFzIGZlYXR1cmVPZlxuICogQHBhcmFtIHtGZWF0dXJlfSBmZWF0dXJlIGEgZmVhdHVyZSB3aXRoIGFuIGV4cGVjdGVkIGdlb21ldHJ5IHR5cGVcbiAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIGV4cGVjdGVkIEdlb0pTT04gdHlwZVxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgbmFtZSBvZiBjYWxsaW5nIGZ1bmN0aW9uXG4gKiBAdGhyb3dzIEVycm9yIGlmIHZhbHVlIGlzIG5vdCB0aGUgZXhwZWN0ZWQgdHlwZS5cbiAqL1xuZnVuY3Rpb24gZmVhdHVyZU9mKHZhbHVlLCB0eXBlLCBuYW1lKSB7XG4gICAgaWYgKCFuYW1lKSB0aHJvdyBuZXcgRXJyb3IoJy5mZWF0dXJlT2YoKSByZXF1aXJlcyBhIG5hbWUnKTtcbiAgICBpZiAoIXZhbHVlIHx8IHZhbHVlLnR5cGUgIT09ICdGZWF0dXJlJyB8fCAhdmFsdWUuZ2VvbWV0cnkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGlucHV0IHRvICcgKyBuYW1lICsgJywgRmVhdHVyZSB3aXRoIGdlb21ldHJ5IHJlcXVpcmVkJyk7XG4gICAgfVxuICAgIGlmICghdmFsdWUuZ2VvbWV0cnkgfHwgdmFsdWUuZ2VvbWV0cnkudHlwZSAhPT0gdHlwZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW5wdXQgdG8gJyArIG5hbWUgKyAnOiBtdXN0IGJlIGEgJyArIHR5cGUgKyAnLCBnaXZlbiAnICsgdmFsdWUuZ2VvbWV0cnkudHlwZSk7XG4gICAgfVxufVxuXG4vKipcbiAqIEVuZm9yY2UgZXhwZWN0YXRpb25zIGFib3V0IHR5cGVzIG9mIHtAbGluayBGZWF0dXJlQ29sbGVjdGlvbn0gaW5wdXRzIGZvciBUdXJmLlxuICogSW50ZXJuYWxseSB0aGlzIHVzZXMge0BsaW5rIGdlb2pzb25UeXBlfSB0byBqdWRnZSBnZW9tZXRyeSB0eXBlcy5cbiAqXG4gKiBAYWxpYXMgY29sbGVjdGlvbk9mXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufSBmZWF0dXJlY29sbGVjdGlvbiBhIGZlYXR1cmVjb2xsZWN0aW9uIGZvciB3aGljaCBmZWF0dXJlcyB3aWxsIGJlIGp1ZGdlZFxuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgZXhwZWN0ZWQgR2VvSlNPTiB0eXBlXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBuYW1lIG9mIGNhbGxpbmcgZnVuY3Rpb25cbiAqIEB0aHJvd3MgRXJyb3IgaWYgdmFsdWUgaXMgbm90IHRoZSBleHBlY3RlZCB0eXBlLlxuICovXG5mdW5jdGlvbiBjb2xsZWN0aW9uT2YodmFsdWUsIHR5cGUsIG5hbWUpIHtcbiAgICBpZiAoIW5hbWUpIHRocm93IG5ldyBFcnJvcignLmNvbGxlY3Rpb25PZigpIHJlcXVpcmVzIGEgbmFtZScpO1xuICAgIGlmICghdmFsdWUgfHwgdmFsdWUudHlwZSAhPT0gJ0ZlYXR1cmVDb2xsZWN0aW9uJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW5wdXQgdG8gJyArIG5hbWUgKyAnLCBGZWF0dXJlQ29sbGVjdGlvbiByZXF1aXJlZCcpO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZhbHVlLmZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBmZWF0dXJlID0gdmFsdWUuZmVhdHVyZXNbaV07XG4gICAgICAgIGlmICghZmVhdHVyZSB8fCBmZWF0dXJlLnR5cGUgIT09ICdGZWF0dXJlJyB8fCAhZmVhdHVyZS5nZW9tZXRyeSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGlucHV0IHRvICcgKyBuYW1lICsgJywgRmVhdHVyZSB3aXRoIGdlb21ldHJ5IHJlcXVpcmVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFmZWF0dXJlLmdlb21ldHJ5IHx8IGZlYXR1cmUuZ2VvbWV0cnkudHlwZSAhPT0gdHlwZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGlucHV0IHRvICcgKyBuYW1lICsgJzogbXVzdCBiZSBhICcgKyB0eXBlICsgJywgZ2l2ZW4gJyArIGZlYXR1cmUuZ2VvbWV0cnkudHlwZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCIvKipcbiAqIENyZWF0ZXMgYSB7QGxpbmsgTGluZVN0cmluZ30ge0BsaW5rIEZlYXR1cmV9IGJhc2VkIG9uIGFcbiAqIGNvb3JkaW5hdGUgYXJyYXkuIFByb3BlcnRpZXMgY2FuIGJlIGFkZGVkIG9wdGlvbmFsbHkuXG4gKlxuICogQG1vZHVsZSB0dXJmL2xpbmVzdHJpbmdcbiAqIEBjYXRlZ29yeSBoZWxwZXJcbiAqIEBwYXJhbSB7QXJyYXk8QXJyYXk8TnVtYmVyPj59IGNvb3JkaW5hdGVzIGFuIGFycmF5IG9mIFBvc2l0aW9uc1xuICogQHBhcmFtIHtPYmplY3R9IHByb3BlcnRpZXMgYW4gT2JqZWN0IG9mIGtleS12YWx1ZSBwYWlycyB0byBhZGQgYXMgcHJvcGVydGllc1xuICogQHJldHVybiB7TGluZVN0cmluZ30gYSBMaW5lU3RyaW5nIGZlYXR1cmVcbiAqIEB0aHJvd3Mge0Vycm9yfSBpZiBubyBjb29yZGluYXRlcyBhcmUgcGFzc2VkXG4gKiBAZXhhbXBsZVxuICogdmFyIGxpbmVzdHJpbmcxID0gdHVyZi5saW5lc3RyaW5nKFtcbiAqXHRbLTIxLjk2NDQxNiwgNjQuMTQ4MjAzXSxcbiAqXHRbLTIxLjk1NjE3NiwgNjQuMTQxMzE2XSxcbiAqXHRbLTIxLjkzOTAxLCA2NC4xMzU5MjRdLFxuICpcdFstMjEuOTI3MzM3LCA2NC4xMzY2NzNdXG4gKiBdKTtcbiAqIHZhciBsaW5lc3RyaW5nMiA9IHR1cmYubGluZXN0cmluZyhbXG4gKlx0Wy0yMS45MjkwNTQsIDY0LjEyNzk4NV0sXG4gKlx0Wy0yMS45MTI5MTgsIDY0LjEzNDcyNl0sXG4gKlx0Wy0yMS45MTYwMDcsIDY0LjE0MTAxNl0sXG4gKiBcdFstMjEuOTMwMDg0LCA2NC4xNDQ0Nl1cbiAqIF0sIHtuYW1lOiAnbGluZSAxJywgZGlzdGFuY2U6IDE0NX0pO1xuICpcbiAqIC8vPWxpbmVzdHJpbmcxXG4gKlxuICogLy89bGluZXN0cmluZzJcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjb29yZGluYXRlcywgcHJvcGVydGllcyl7XG4gIGlmICghY29vcmRpbmF0ZXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gY29vcmRpbmF0ZXMgcGFzc2VkJyk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gICAgXCJnZW9tZXRyeVwiOiB7XG4gICAgICBcInR5cGVcIjogXCJMaW5lU3RyaW5nXCIsXG4gICAgICBcImNvb3JkaW5hdGVzXCI6IGNvb3JkaW5hdGVzXG4gICAgfSxcbiAgICBcInByb3BlcnRpZXNcIjogcHJvcGVydGllcyB8fCB7fVxuICB9O1xufTtcbiIsIi8qKlxuICogSXRlcmF0ZSBvdmVyIGNvb3JkaW5hdGVzIGluIGFueSBHZW9KU09OIG9iamVjdCwgc2ltaWxhciB0b1xuICogQXJyYXkuZm9yRWFjaC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gbGF5ZXIgYW55IEdlb0pTT04gb2JqZWN0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBhIG1ldGhvZCB0aGF0IHRha2VzICh2YWx1ZSlcbiAqIEBwYXJhbSB7Ym9vbGVhbj19IGV4Y2x1ZGVXcmFwQ29vcmQgd2hldGhlciBvciBub3QgdG8gaW5jbHVkZVxuICogdGhlIGZpbmFsIGNvb3JkaW5hdGUgb2YgTGluZWFyUmluZ3MgdGhhdCB3cmFwcyB0aGUgcmluZyBpbiBpdHMgaXRlcmF0aW9uLlxuICogQGV4YW1wbGVcbiAqIHZhciBwb2ludCA9IHsgdHlwZTogJ1BvaW50JywgY29vcmRpbmF0ZXM6IFswLCAwXSB9O1xuICogY29vcmRFYWNoKHBvaW50LCBmdW5jdGlvbihjb29yZHMpIHtcbiAqICAgLy8gY29vcmRzIGlzIGVxdWFsIHRvIFswLCAwXVxuICogfSk7XG4gKi9cbmZ1bmN0aW9uIGNvb3JkRWFjaChsYXllciwgY2FsbGJhY2ssIGV4Y2x1ZGVXcmFwQ29vcmQpIHtcbiAgICB2YXIgaSwgaiwgaywgZywgbCwgZ2VvbWV0cnksIHN0b3BHLCBjb29yZHMsXG4gICAgICAgIGdlb21ldHJ5TWF5YmVDb2xsZWN0aW9uLFxuICAgICAgICB3cmFwU2hyaW5rID0gMCxcbiAgICAgICAgaXNHZW9tZXRyeUNvbGxlY3Rpb24sXG4gICAgICAgIGlzRmVhdHVyZUNvbGxlY3Rpb24gPSBsYXllci50eXBlID09PSAnRmVhdHVyZUNvbGxlY3Rpb24nLFxuICAgICAgICBpc0ZlYXR1cmUgPSBsYXllci50eXBlID09PSAnRmVhdHVyZScsXG4gICAgICAgIHN0b3AgPSBpc0ZlYXR1cmVDb2xsZWN0aW9uID8gbGF5ZXIuZmVhdHVyZXMubGVuZ3RoIDogMTtcblxuICAvLyBUaGlzIGxvZ2ljIG1heSBsb29rIGEgbGl0dGxlIHdlaXJkLiBUaGUgcmVhc29uIHdoeSBpdCBpcyB0aGF0IHdheVxuICAvLyBpcyBiZWNhdXNlIGl0J3MgdHJ5aW5nIHRvIGJlIGZhc3QuIEdlb0pTT04gc3VwcG9ydHMgbXVsdGlwbGUga2luZHNcbiAgLy8gb2Ygb2JqZWN0cyBhdCBpdHMgcm9vdDogRmVhdHVyZUNvbGxlY3Rpb24sIEZlYXR1cmVzLCBHZW9tZXRyaWVzLlxuICAvLyBUaGlzIGZ1bmN0aW9uIGhhcyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgaGFuZGxpbmcgYWxsIG9mIHRoZW0sIGFuZCB0aGF0XG4gIC8vIG1lYW5zIHRoYXQgc29tZSBvZiB0aGUgYGZvcmAgbG9vcHMgeW91IHNlZSBiZWxvdyBhY3R1YWxseSBqdXN0IGRvbid0IGFwcGx5XG4gIC8vIHRvIGNlcnRhaW4gaW5wdXRzLiBGb3IgaW5zdGFuY2UsIGlmIHlvdSBnaXZlIHRoaXMganVzdCBhXG4gIC8vIFBvaW50IGdlb21ldHJ5LCB0aGVuIGJvdGggbG9vcHMgYXJlIHNob3J0LWNpcmN1aXRlZCBhbmQgYWxsIHdlIGRvXG4gIC8vIGlzIGdyYWR1YWxseSByZW5hbWUgdGhlIGlucHV0IHVudGlsIGl0J3MgY2FsbGVkICdnZW9tZXRyeScuXG4gIC8vXG4gIC8vIFRoaXMgYWxzbyBhaW1zIHRvIGFsbG9jYXRlIGFzIGZldyByZXNvdXJjZXMgYXMgcG9zc2libGU6IGp1c3QgYVxuICAvLyBmZXcgbnVtYmVycyBhbmQgYm9vbGVhbnMsIHJhdGhlciB0aGFuIGFueSB0ZW1wb3JhcnkgYXJyYXlzIGFzIHdvdWxkXG4gIC8vIGJlIHJlcXVpcmVkIHdpdGggdGhlIG5vcm1hbGl6YXRpb24gYXBwcm9hY2guXG4gICAgZm9yIChpID0gMDsgaSA8IHN0b3A7IGkrKykge1xuXG4gICAgICAgIGdlb21ldHJ5TWF5YmVDb2xsZWN0aW9uID0gKGlzRmVhdHVyZUNvbGxlY3Rpb24gPyBsYXllci5mZWF0dXJlc1tpXS5nZW9tZXRyeSA6XG4gICAgICAgIChpc0ZlYXR1cmUgPyBsYXllci5nZW9tZXRyeSA6IGxheWVyKSk7XG4gICAgICAgIGlzR2VvbWV0cnlDb2xsZWN0aW9uID0gZ2VvbWV0cnlNYXliZUNvbGxlY3Rpb24udHlwZSA9PT0gJ0dlb21ldHJ5Q29sbGVjdGlvbic7XG4gICAgICAgIHN0b3BHID0gaXNHZW9tZXRyeUNvbGxlY3Rpb24gPyBnZW9tZXRyeU1heWJlQ29sbGVjdGlvbi5nZW9tZXRyaWVzLmxlbmd0aCA6IDE7XG5cbiAgICAgICAgZm9yIChnID0gMDsgZyA8IHN0b3BHOyBnKyspIHtcbiAgICAgICAgICAgIGdlb21ldHJ5ID0gaXNHZW9tZXRyeUNvbGxlY3Rpb24gP1xuICAgICAgICAgICAgZ2VvbWV0cnlNYXliZUNvbGxlY3Rpb24uZ2VvbWV0cmllc1tnXSA6IGdlb21ldHJ5TWF5YmVDb2xsZWN0aW9uO1xuICAgICAgICAgICAgY29vcmRzID0gZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG5cbiAgICAgICAgICAgIHdyYXBTaHJpbmsgPSAoZXhjbHVkZVdyYXBDb29yZCAmJlxuICAgICAgICAgICAgICAgIChnZW9tZXRyeS50eXBlID09PSAnUG9seWdvbicgfHwgZ2VvbWV0cnkudHlwZSA9PT0gJ011bHRpUG9seWdvbicpKSA/XG4gICAgICAgICAgICAgICAgMSA6IDA7XG5cbiAgICAgICAgICAgIGlmIChnZW9tZXRyeS50eXBlID09PSAnUG9pbnQnKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soY29vcmRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZ2VvbWV0cnkudHlwZSA9PT0gJ0xpbmVTdHJpbmcnIHx8IGdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aVBvaW50Jykge1xuICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBjb29yZHMubGVuZ3RoOyBqKyspIGNhbGxiYWNrKGNvb3Jkc1tqXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGdlb21ldHJ5LnR5cGUgPT09ICdQb2x5Z29uJyB8fCBnZW9tZXRyeS50eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBjb29yZHMubGVuZ3RoOyBqKyspXG4gICAgICAgICAgICAgICAgICAgIGZvciAoayA9IDA7IGsgPCBjb29yZHNbal0ubGVuZ3RoIC0gd3JhcFNocmluazsgaysrKVxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soY29vcmRzW2pdW2tdKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZ2VvbWV0cnkudHlwZSA9PT0gJ011bHRpUG9seWdvbicpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgY29vcmRzLmxlbmd0aDsgaisrKVxuICAgICAgICAgICAgICAgICAgICBmb3IgKGsgPSAwOyBrIDwgY29vcmRzW2pdLmxlbmd0aDsgaysrKVxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsID0gMDsgbCA8IGNvb3Jkc1tqXVtrXS5sZW5ndGggLSB3cmFwU2hyaW5rOyBsKyspXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soY29vcmRzW2pdW2tdW2xdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIEdlb21ldHJ5IFR5cGUnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbm1vZHVsZS5leHBvcnRzLmNvb3JkRWFjaCA9IGNvb3JkRWFjaDtcblxuLyoqXG4gKiBSZWR1Y2UgY29vcmRpbmF0ZXMgaW4gYW55IEdlb0pTT04gb2JqZWN0IGludG8gYSBzaW5nbGUgdmFsdWUsXG4gKiBzaW1pbGFyIHRvIGhvdyBBcnJheS5yZWR1Y2Ugd29ya3MuIEhvd2V2ZXIsIGluIHRoaXMgY2FzZSB3ZSBsYXppbHkgcnVuXG4gKiB0aGUgcmVkdWN0aW9uLCBzbyBhbiBhcnJheSBvZiBhbGwgY29vcmRpbmF0ZXMgaXMgdW5uZWNlc3NhcnkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGxheWVyIGFueSBHZW9KU09OIG9iamVjdFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgYSBtZXRob2QgdGhhdCB0YWtlcyAobWVtbywgdmFsdWUpIGFuZCByZXR1cm5zXG4gKiBhIG5ldyBtZW1vXG4gKiBAcGFyYW0geyp9IG1lbW8gdGhlIHN0YXJ0aW5nIHZhbHVlIG9mIG1lbW86IGNhbiBiZSBhbnkgdHlwZS5cbiAqIEBwYXJhbSB7Ym9vbGVhbj19IGV4Y2x1ZGVXcmFwQ29vcmQgd2hldGhlciBvciBub3QgdG8gaW5jbHVkZVxuICogdGhlIGZpbmFsIGNvb3JkaW5hdGUgb2YgTGluZWFyUmluZ3MgdGhhdCB3cmFwcyB0aGUgcmluZyBpbiBpdHMgaXRlcmF0aW9uLlxuICogQHJldHVybiB7Kn0gY29tYmluZWQgdmFsdWVcbiAqL1xuZnVuY3Rpb24gY29vcmRSZWR1Y2UobGF5ZXIsIGNhbGxiYWNrLCBtZW1vLCBleGNsdWRlV3JhcENvb3JkKSB7XG4gICAgY29vcmRFYWNoKGxheWVyLCBmdW5jdGlvbiAoY29vcmQpIHtcbiAgICAgICAgbWVtbyA9IGNhbGxiYWNrKG1lbW8sIGNvb3JkKTtcbiAgICB9LCBleGNsdWRlV3JhcENvb3JkKTtcbiAgICByZXR1cm4gbWVtbztcbn1cbm1vZHVsZS5leHBvcnRzLmNvb3JkUmVkdWNlID0gY29vcmRSZWR1Y2U7XG5cbi8qKlxuICogSXRlcmF0ZSBvdmVyIHByb3BlcnR5IG9iamVjdHMgaW4gYW55IEdlb0pTT04gb2JqZWN0LCBzaW1pbGFyIHRvXG4gKiBBcnJheS5mb3JFYWNoLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBsYXllciBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGEgbWV0aG9kIHRoYXQgdGFrZXMgKHZhbHVlKVxuICogQGV4YW1wbGVcbiAqIHZhciBwb2ludCA9IHsgdHlwZTogJ0ZlYXR1cmUnLCBnZW9tZXRyeTogbnVsbCwgcHJvcGVydGllczogeyBmb286IDEgfSB9O1xuICogcHJvcEVhY2gocG9pbnQsIGZ1bmN0aW9uKHByb3BzKSB7XG4gKiAgIC8vIHByb3BzIGlzIGVxdWFsIHRvIHsgZm9vOiAxfVxuICogfSk7XG4gKi9cbmZ1bmN0aW9uIHByb3BFYWNoKGxheWVyLCBjYWxsYmFjaykge1xuICAgIHZhciBpO1xuICAgIHN3aXRjaCAobGF5ZXIudHlwZSkge1xuICAgIGNhc2UgJ0ZlYXR1cmVDb2xsZWN0aW9uJzpcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGxheWVyLmZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhsYXllci5mZWF0dXJlc1tpXS5wcm9wZXJ0aWVzKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICBjYXNlICdGZWF0dXJlJzpcbiAgICAgICAgY2FsbGJhY2sobGF5ZXIucHJvcGVydGllcyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbn1cbm1vZHVsZS5leHBvcnRzLnByb3BFYWNoID0gcHJvcEVhY2g7XG5cbi8qKlxuICogUmVkdWNlIHByb3BlcnRpZXMgaW4gYW55IEdlb0pTT04gb2JqZWN0IGludG8gYSBzaW5nbGUgdmFsdWUsXG4gKiBzaW1pbGFyIHRvIGhvdyBBcnJheS5yZWR1Y2Ugd29ya3MuIEhvd2V2ZXIsIGluIHRoaXMgY2FzZSB3ZSBsYXppbHkgcnVuXG4gKiB0aGUgcmVkdWN0aW9uLCBzbyBhbiBhcnJheSBvZiBhbGwgcHJvcGVydGllcyBpcyB1bm5lY2Vzc2FyeS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gbGF5ZXIgYW55IEdlb0pTT04gb2JqZWN0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBhIG1ldGhvZCB0aGF0IHRha2VzIChtZW1vLCBjb29yZCkgYW5kIHJldHVybnNcbiAqIGEgbmV3IG1lbW9cbiAqIEBwYXJhbSB7Kn0gbWVtbyB0aGUgc3RhcnRpbmcgdmFsdWUgb2YgbWVtbzogY2FuIGJlIGFueSB0eXBlLlxuICogQHJldHVybiB7Kn0gY29tYmluZWQgdmFsdWVcbiAqL1xuZnVuY3Rpb24gcHJvcFJlZHVjZShsYXllciwgY2FsbGJhY2ssIG1lbW8pIHtcbiAgICBwcm9wRWFjaChsYXllciwgZnVuY3Rpb24gKHByb3ApIHtcbiAgICAgICAgbWVtbyA9IGNhbGxiYWNrKG1lbW8sIHByb3ApO1xuICAgIH0pO1xuICAgIHJldHVybiBtZW1vO1xufVxubW9kdWxlLmV4cG9ydHMucHJvcFJlZHVjZSA9IHByb3BSZWR1Y2U7XG5cbi8qKlxuICogSXRlcmF0ZSBvdmVyIGZlYXR1cmVzIGluIGFueSBHZW9KU09OIG9iamVjdCwgc2ltaWxhciB0b1xuICogQXJyYXkuZm9yRWFjaC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gbGF5ZXIgYW55IEdlb0pTT04gb2JqZWN0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBhIG1ldGhvZCB0aGF0IHRha2VzICh2YWx1ZSlcbiAqIEBleGFtcGxlXG4gKiB2YXIgZmVhdHVyZSA9IHsgdHlwZTogJ0ZlYXR1cmUnLCBnZW9tZXRyeTogbnVsbCwgcHJvcGVydGllczoge30gfTtcbiAqIGZlYXR1cmVFYWNoKGZlYXR1cmUsIGZ1bmN0aW9uKGZlYXR1cmUpIHtcbiAqICAgLy8gZmVhdHVyZSA9PSBmZWF0dXJlXG4gKiB9KTtcbiAqL1xuZnVuY3Rpb24gZmVhdHVyZUVhY2gobGF5ZXIsIGNhbGxiYWNrKSB7XG4gICAgaWYgKGxheWVyLnR5cGUgPT09ICdGZWF0dXJlJykge1xuICAgICAgICBjYWxsYmFjayhsYXllcik7XG4gICAgfSBlbHNlIGlmIChsYXllci50eXBlID09PSAnRmVhdHVyZUNvbGxlY3Rpb24nKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGF5ZXIuZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGxheWVyLmZlYXR1cmVzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbm1vZHVsZS5leHBvcnRzLmZlYXR1cmVFYWNoID0gZmVhdHVyZUVhY2g7XG5cbi8qKlxuICogR2V0IGFsbCBjb29yZGluYXRlcyBmcm9tIGFueSBHZW9KU09OIG9iamVjdCwgcmV0dXJuaW5nIGFuIGFycmF5IG9mIGNvb3JkaW5hdGVcbiAqIGFycmF5cy5cbiAqIEBwYXJhbSB7T2JqZWN0fSBsYXllciBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEByZXR1cm4ge0FycmF5PEFycmF5PE51bWJlcj4+fSBjb29yZGluYXRlIHBvc2l0aW9uIGFycmF5XG4gKi9cbmZ1bmN0aW9uIGNvb3JkQWxsKGxheWVyKSB7XG4gICAgdmFyIGNvb3JkcyA9IFtdO1xuICAgIGNvb3JkRWFjaChsYXllciwgZnVuY3Rpb24gKGNvb3JkKSB7XG4gICAgICAgIGNvb3Jkcy5wdXNoKGNvb3JkKTtcbiAgICB9KTtcbiAgICByZXR1cm4gY29vcmRzO1xufVxubW9kdWxlLmV4cG9ydHMuY29vcmRBbGwgPSBjb29yZEFsbDtcbiIsIi8qKlxuICogVGFrZXMgY29vcmRpbmF0ZXMgYW5kIHByb3BlcnRpZXMgKG9wdGlvbmFsKSBhbmQgcmV0dXJucyBhIG5ldyB7QGxpbmsgUG9pbnR9IGZlYXR1cmUuXG4gKlxuICogQG1vZHVsZSB0dXJmL3BvaW50XG4gKiBAY2F0ZWdvcnkgaGVscGVyXG4gKiBAcGFyYW0ge251bWJlcn0gbG9uZ2l0dWRlIHBvc2l0aW9uIHdlc3QgdG8gZWFzdCBpbiBkZWNpbWFsIGRlZ3JlZXNcbiAqIEBwYXJhbSB7bnVtYmVyfSBsYXRpdHVkZSBwb3NpdGlvbiBzb3V0aCB0byBub3J0aCBpbiBkZWNpbWFsIGRlZ3JlZXNcbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wZXJ0aWVzIGFuIE9iamVjdCB0aGF0IGlzIHVzZWQgYXMgdGhlIHtAbGluayBGZWF0dXJlfSdzXG4gKiBwcm9wZXJ0aWVzXG4gKiBAcmV0dXJuIHtQb2ludH0gYSBQb2ludCBmZWF0dXJlXG4gKiBAZXhhbXBsZVxuICogdmFyIHB0MSA9IHR1cmYucG9pbnQoWy03NS4zNDMsIDM5Ljk4NF0pO1xuICpcbiAqIC8vPXB0MVxuICovXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJnKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGNvb3JkaW5hdGVzLCBwcm9wZXJ0aWVzKSB7XG4gIGlmICghaXNBcnJheShjb29yZGluYXRlcykpIHRocm93IG5ldyBFcnJvcignQ29vcmRpbmF0ZXMgbXVzdCBiZSBhbiBhcnJheScpO1xuICBpZiAoY29vcmRpbmF0ZXMubGVuZ3RoIDwgMikgdGhyb3cgbmV3IEVycm9yKCdDb29yZGluYXRlcyBtdXN0IGJlIGF0IGxlYXN0IDIgbnVtYmVycyBsb25nJyk7XG4gIHJldHVybiB7XG4gICAgdHlwZTogXCJGZWF0dXJlXCIsXG4gICAgZ2VvbWV0cnk6IHtcbiAgICAgIHR5cGU6IFwiUG9pbnRcIixcbiAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlc1xuICAgIH0sXG4gICAgcHJvcGVydGllczogcHJvcGVydGllcyB8fCB7fVxuICB9O1xufTtcbiIsInZhciBpbnNpZGUgPSByZXF1aXJlKCd0dXJmLWluc2lkZScpO1xudmFyIGZlYXR1cmVDb2xsZWN0aW9uID0gcmVxdWlyZSgndHVyZi1mZWF0dXJlY29sbGVjdGlvbicpO1xuXG4vKipcbiAqIFRha2VzIGEge0BsaW5rIEZlYXR1cmVDb2xsZWN0aW9ufSBvZiB7QGxpbmsgUG9pbnR9IGZlYXR1cmVzIGFuZCBhIEZlYXR1cmVDb2xsZWN0aW9uIG9mIHtAbGluayBQb2x5Z29ufSBmZWF0dXJlcyBhbmQgcmV0dXJucyBhIEZlYXR1cmVDb2xsZWN0aW9uIG9mIFBvaW50IGZlYXR1cmVzIHJlcHJlc2VudGluZyBhbGwgcG9pbnRzIHRoYXQgZmFsbCB3aXRoaW4gYSBjb2xsZWN0aW9uIG9mIHBvbHlnb25zLlxuICpcbiAqIEBtb2R1bGUgdHVyZi93aXRoaW5cbiAqIEBjYXRlZ29yeSBqb2luc1xuICogQHBhcmFtIHtGZWF0dXJlQ29sbGVjdGlvbn0gcG9pbnRzIGEgRmVhdHVyZUNvbGxlY3Rpb24gb2Yge0BsaW5rIFBvaW50fSBmZWF0dXJlc1xuICogQHBhcmFtIHtGZWF0dXJlQ29sbGVjdGlvbn0gcG9seWdvbnMgYSBGZWF0dXJlQ29sbGVjdGlvbiBvZiB7QGxpbmsgUG9seWdvbn0gZmVhdHVyZXNcbiAqIEByZXR1cm4ge0ZlYXR1cmVDb2xsZWN0aW9ufSBhIGNvbGxlY3Rpb24gb2YgYWxsIHBvaW50cyB0aGF0IGxhbmRcbiAqIHdpdGhpbiBhdCBsZWFzdCBvbmUgcG9seWdvblxuICogQGV4YW1wbGVcbiAqIHZhciBzZWFyY2hXaXRoaW4gPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gKiAgIFwiZmVhdHVyZXNcIjogW1xuICogICAgIHtcbiAqICAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgICAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgICAgICBcInR5cGVcIjogXCJQb2x5Z29uXCIsXG4gKiAgICAgICAgIFwiY29vcmRpbmF0ZXNcIjogW1tcbiAqICAgICAgICAgICBbLTQ2LjY1MywtMjMuNTQzXSxcbiAqICAgICAgICAgICBbLTQ2LjYzNCwtMjMuNTM0Nl0sXG4gKiAgICAgICAgICAgWy00Ni42MTMsLTIzLjU0M10sXG4gKiAgICAgICAgICAgWy00Ni42MTQsLTIzLjU1OV0sXG4gKiAgICAgICAgICAgWy00Ni42MzEsLTIzLjU2N10sXG4gKiAgICAgICAgICAgWy00Ni42NTMsLTIzLjU2MF0sXG4gKiAgICAgICAgICAgWy00Ni42NTMsLTIzLjU0M11cbiAqICAgICAgICAgXV1cbiAqICAgICAgIH1cbiAqICAgICB9XG4gKiAgIF1cbiAqIH07XG4gKiB2YXIgcG9pbnRzID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICogICBcImZlYXR1cmVzXCI6IFtcbiAqICAgICB7XG4gKiAgICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgICAgICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgICAgICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICAgICAgXCJjb29yZGluYXRlc1wiOiBbLTQ2LjYzMTgsIC0yMy41NTIzXVxuICogICAgICAgfVxuICogICAgIH0sIHtcbiAqICAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgICAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFstNDYuNjI0NiwgLTIzLjUzMjVdXG4gKiAgICAgICB9XG4gKiAgICAgfSwge1xuICogICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICAgICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICAgICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgICAgIFwiY29vcmRpbmF0ZXNcIjogWy00Ni42MDYyLCAtMjMuNTUxM11cbiAqICAgICAgIH1cbiAqICAgICB9LCB7XG4gKiAgICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgICAgICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgICAgICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICAgICAgXCJjb29yZGluYXRlc1wiOiBbLTQ2LjY2MywgLTIzLjU1NF1cbiAqICAgICAgIH1cbiAqICAgICB9LCB7XG4gKiAgICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgICAgICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgICAgICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICAgICAgXCJjb29yZGluYXRlc1wiOiBbLTQ2LjY0MywgLTIzLjU1N11cbiAqICAgICAgIH1cbiAqICAgICB9XG4gKiAgIF1cbiAqIH07XG4gKlxuICogdmFyIHB0c1dpdGhpbiA9IHR1cmYud2l0aGluKHBvaW50cywgc2VhcmNoV2l0aGluKTtcbiAqXG4gKiAvLz1wb2ludHNcbiAqXG4gKiAvLz1zZWFyY2hXaXRoaW5cbiAqXG4gKiAvLz1wdHNXaXRoaW5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwdEZDLCBwb2x5RkMpe1xuICB2YXIgcG9pbnRzV2l0aGluID0gZmVhdHVyZUNvbGxlY3Rpb24oW10pO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHBvbHlGQy5mZWF0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgcHRGQy5mZWF0dXJlcy5sZW5ndGg7IGorKykge1xuICAgICAgdmFyIGlzSW5zaWRlID0gaW5zaWRlKHB0RkMuZmVhdHVyZXNbal0sIHBvbHlGQy5mZWF0dXJlc1tpXSk7XG4gICAgICBpZihpc0luc2lkZSl7XG4gICAgICAgIHBvaW50c1dpdGhpbi5mZWF0dXJlcy5wdXNoKHB0RkMuZmVhdHVyZXNbal0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcG9pbnRzV2l0aGluO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNCdWZmZXIoYXJnKSB7XG4gIHJldHVybiBhcmcgJiYgdHlwZW9mIGFyZyA9PT0gJ29iamVjdCdcbiAgICAmJiB0eXBlb2YgYXJnLmNvcHkgPT09ICdmdW5jdGlvbidcbiAgICAmJiB0eXBlb2YgYXJnLmZpbGwgPT09ICdmdW5jdGlvbidcbiAgICAmJiB0eXBlb2YgYXJnLnJlYWRVSW50OCA9PT0gJ2Z1bmN0aW9uJztcbn0iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxudmFyIGZvcm1hdFJlZ0V4cCA9IC8lW3NkaiVdL2c7XG5leHBvcnRzLmZvcm1hdCA9IGZ1bmN0aW9uKGYpIHtcbiAgaWYgKCFpc1N0cmluZyhmKSkge1xuICAgIHZhciBvYmplY3RzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIG9iamVjdHMucHVzaChpbnNwZWN0KGFyZ3VtZW50c1tpXSkpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0cy5qb2luKCcgJyk7XG4gIH1cblxuICB2YXIgaSA9IDE7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICB2YXIgbGVuID0gYXJncy5sZW5ndGg7XG4gIHZhciBzdHIgPSBTdHJpbmcoZikucmVwbGFjZShmb3JtYXRSZWdFeHAsIGZ1bmN0aW9uKHgpIHtcbiAgICBpZiAoeCA9PT0gJyUlJykgcmV0dXJuICclJztcbiAgICBpZiAoaSA+PSBsZW4pIHJldHVybiB4O1xuICAgIHN3aXRjaCAoeCkge1xuICAgICAgY2FzZSAnJXMnOiByZXR1cm4gU3RyaW5nKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclZCc6IHJldHVybiBOdW1iZXIoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVqJzpcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoYXJnc1tpKytdKTtcbiAgICAgICAgfSBjYXRjaCAoXykge1xuICAgICAgICAgIHJldHVybiAnW0NpcmN1bGFyXSc7XG4gICAgICAgIH1cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB4O1xuICAgIH1cbiAgfSk7XG4gIGZvciAodmFyIHggPSBhcmdzW2ldOyBpIDwgbGVuOyB4ID0gYXJnc1srK2ldKSB7XG4gICAgaWYgKGlzTnVsbCh4KSB8fCAhaXNPYmplY3QoeCkpIHtcbiAgICAgIHN0ciArPSAnICcgKyB4O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgKz0gJyAnICsgaW5zcGVjdCh4KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn07XG5cblxuLy8gTWFyayB0aGF0IGEgbWV0aG9kIHNob3VsZCBub3QgYmUgdXNlZC5cbi8vIFJldHVybnMgYSBtb2RpZmllZCBmdW5jdGlvbiB3aGljaCB3YXJucyBvbmNlIGJ5IGRlZmF1bHQuXG4vLyBJZiAtLW5vLWRlcHJlY2F0aW9uIGlzIHNldCwgdGhlbiBpdCBpcyBhIG5vLW9wLlxuZXhwb3J0cy5kZXByZWNhdGUgPSBmdW5jdGlvbihmbiwgbXNnKSB7XG4gIC8vIEFsbG93IGZvciBkZXByZWNhdGluZyB0aGluZ3MgaW4gdGhlIHByb2Nlc3Mgb2Ygc3RhcnRpbmcgdXAuXG4gIGlmIChpc1VuZGVmaW5lZChnbG9iYWwucHJvY2VzcykpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZXhwb3J0cy5kZXByZWNhdGUoZm4sIG1zZykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG5cbiAgaWYgKHByb2Nlc3Mubm9EZXByZWNhdGlvbiA9PT0gdHJ1ZSkge1xuICAgIHJldHVybiBmbjtcbiAgfVxuXG4gIHZhciB3YXJuZWQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gZGVwcmVjYXRlZCgpIHtcbiAgICBpZiAoIXdhcm5lZCkge1xuICAgICAgaWYgKHByb2Nlc3MudGhyb3dEZXByZWNhdGlvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICAgIH0gZWxzZSBpZiAocHJvY2Vzcy50cmFjZURlcHJlY2F0aW9uKSB7XG4gICAgICAgIGNvbnNvbGUudHJhY2UobXNnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IobXNnKTtcbiAgICAgIH1cbiAgICAgIHdhcm5lZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbiAgcmV0dXJuIGRlcHJlY2F0ZWQ7XG59O1xuXG5cbnZhciBkZWJ1Z3MgPSB7fTtcbnZhciBkZWJ1Z0Vudmlyb247XG5leHBvcnRzLmRlYnVnbG9nID0gZnVuY3Rpb24oc2V0KSB7XG4gIGlmIChpc1VuZGVmaW5lZChkZWJ1Z0Vudmlyb24pKVxuICAgIGRlYnVnRW52aXJvbiA9IHByb2Nlc3MuZW52Lk5PREVfREVCVUcgfHwgJyc7XG4gIHNldCA9IHNldC50b1VwcGVyQ2FzZSgpO1xuICBpZiAoIWRlYnVnc1tzZXRdKSB7XG4gICAgaWYgKG5ldyBSZWdFeHAoJ1xcXFxiJyArIHNldCArICdcXFxcYicsICdpJykudGVzdChkZWJ1Z0Vudmlyb24pKSB7XG4gICAgICB2YXIgcGlkID0gcHJvY2Vzcy5waWQ7XG4gICAgICBkZWJ1Z3Nbc2V0XSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbXNnID0gZXhwb3J0cy5mb3JtYXQuYXBwbHkoZXhwb3J0cywgYXJndW1lbnRzKTtcbiAgICAgICAgY29uc29sZS5lcnJvcignJXMgJWQ6ICVzJywgc2V0LCBwaWQsIG1zZyk7XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWJ1Z3Nbc2V0XSA9IGZ1bmN0aW9uKCkge307XG4gICAgfVxuICB9XG4gIHJldHVybiBkZWJ1Z3Nbc2V0XTtcbn07XG5cblxuLyoqXG4gKiBFY2hvcyB0aGUgdmFsdWUgb2YgYSB2YWx1ZS4gVHJ5cyB0byBwcmludCB0aGUgdmFsdWUgb3V0XG4gKiBpbiB0aGUgYmVzdCB3YXkgcG9zc2libGUgZ2l2ZW4gdGhlIGRpZmZlcmVudCB0eXBlcy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIFRoZSBvYmplY3QgdG8gcHJpbnQgb3V0LlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHMgT3B0aW9uYWwgb3B0aW9ucyBvYmplY3QgdGhhdCBhbHRlcnMgdGhlIG91dHB1dC5cbiAqL1xuLyogbGVnYWN5OiBvYmosIHNob3dIaWRkZW4sIGRlcHRoLCBjb2xvcnMqL1xuZnVuY3Rpb24gaW5zcGVjdChvYmosIG9wdHMpIHtcbiAgLy8gZGVmYXVsdCBvcHRpb25zXG4gIHZhciBjdHggPSB7XG4gICAgc2VlbjogW10sXG4gICAgc3R5bGl6ZTogc3R5bGl6ZU5vQ29sb3JcbiAgfTtcbiAgLy8gbGVnYWN5Li4uXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDMpIGN0eC5kZXB0aCA9IGFyZ3VtZW50c1syXTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gNCkgY3R4LmNvbG9ycyA9IGFyZ3VtZW50c1szXTtcbiAgaWYgKGlzQm9vbGVhbihvcHRzKSkge1xuICAgIC8vIGxlZ2FjeS4uLlxuICAgIGN0eC5zaG93SGlkZGVuID0gb3B0cztcbiAgfSBlbHNlIGlmIChvcHRzKSB7XG4gICAgLy8gZ290IGFuIFwib3B0aW9uc1wiIG9iamVjdFxuICAgIGV4cG9ydHMuX2V4dGVuZChjdHgsIG9wdHMpO1xuICB9XG4gIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5zaG93SGlkZGVuKSkgY3R4LnNob3dIaWRkZW4gPSBmYWxzZTtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5kZXB0aCkpIGN0eC5kZXB0aCA9IDI7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY29sb3JzKSkgY3R4LmNvbG9ycyA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmN1c3RvbUluc3BlY3QpKSBjdHguY3VzdG9tSW5zcGVjdCA9IHRydWU7XG4gIGlmIChjdHguY29sb3JzKSBjdHguc3R5bGl6ZSA9IHN0eWxpemVXaXRoQ29sb3I7XG4gIHJldHVybiBmb3JtYXRWYWx1ZShjdHgsIG9iaiwgY3R4LmRlcHRoKTtcbn1cbmV4cG9ydHMuaW5zcGVjdCA9IGluc3BlY3Q7XG5cblxuLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9BTlNJX2VzY2FwZV9jb2RlI2dyYXBoaWNzXG5pbnNwZWN0LmNvbG9ycyA9IHtcbiAgJ2JvbGQnIDogWzEsIDIyXSxcbiAgJ2l0YWxpYycgOiBbMywgMjNdLFxuICAndW5kZXJsaW5lJyA6IFs0LCAyNF0sXG4gICdpbnZlcnNlJyA6IFs3LCAyN10sXG4gICd3aGl0ZScgOiBbMzcsIDM5XSxcbiAgJ2dyZXknIDogWzkwLCAzOV0sXG4gICdibGFjaycgOiBbMzAsIDM5XSxcbiAgJ2JsdWUnIDogWzM0LCAzOV0sXG4gICdjeWFuJyA6IFszNiwgMzldLFxuICAnZ3JlZW4nIDogWzMyLCAzOV0sXG4gICdtYWdlbnRhJyA6IFszNSwgMzldLFxuICAncmVkJyA6IFszMSwgMzldLFxuICAneWVsbG93JyA6IFszMywgMzldXG59O1xuXG4vLyBEb24ndCB1c2UgJ2JsdWUnIG5vdCB2aXNpYmxlIG9uIGNtZC5leGVcbmluc3BlY3Quc3R5bGVzID0ge1xuICAnc3BlY2lhbCc6ICdjeWFuJyxcbiAgJ251bWJlcic6ICd5ZWxsb3cnLFxuICAnYm9vbGVhbic6ICd5ZWxsb3cnLFxuICAndW5kZWZpbmVkJzogJ2dyZXknLFxuICAnbnVsbCc6ICdib2xkJyxcbiAgJ3N0cmluZyc6ICdncmVlbicsXG4gICdkYXRlJzogJ21hZ2VudGEnLFxuICAvLyBcIm5hbWVcIjogaW50ZW50aW9uYWxseSBub3Qgc3R5bGluZ1xuICAncmVnZXhwJzogJ3JlZCdcbn07XG5cblxuZnVuY3Rpb24gc3R5bGl6ZVdpdGhDb2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICB2YXIgc3R5bGUgPSBpbnNwZWN0LnN0eWxlc1tzdHlsZVR5cGVdO1xuXG4gIGlmIChzdHlsZSkge1xuICAgIHJldHVybiAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzBdICsgJ20nICsgc3RyICtcbiAgICAgICAgICAgJ1xcdTAwMWJbJyArIGluc3BlY3QuY29sb3JzW3N0eWxlXVsxXSArICdtJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3RyO1xuICB9XG59XG5cblxuZnVuY3Rpb24gc3R5bGl6ZU5vQ29sb3Ioc3RyLCBzdHlsZVR5cGUpIHtcbiAgcmV0dXJuIHN0cjtcbn1cblxuXG5mdW5jdGlvbiBhcnJheVRvSGFzaChhcnJheSkge1xuICB2YXIgaGFzaCA9IHt9O1xuXG4gIGFycmF5LmZvckVhY2goZnVuY3Rpb24odmFsLCBpZHgpIHtcbiAgICBoYXNoW3ZhbF0gPSB0cnVlO1xuICB9KTtcblxuICByZXR1cm4gaGFzaDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRWYWx1ZShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMpIHtcbiAgLy8gUHJvdmlkZSBhIGhvb2sgZm9yIHVzZXItc3BlY2lmaWVkIGluc3BlY3QgZnVuY3Rpb25zLlxuICAvLyBDaGVjayB0aGF0IHZhbHVlIGlzIGFuIG9iamVjdCB3aXRoIGFuIGluc3BlY3QgZnVuY3Rpb24gb24gaXRcbiAgaWYgKGN0eC5jdXN0b21JbnNwZWN0ICYmXG4gICAgICB2YWx1ZSAmJlxuICAgICAgaXNGdW5jdGlvbih2YWx1ZS5pbnNwZWN0KSAmJlxuICAgICAgLy8gRmlsdGVyIG91dCB0aGUgdXRpbCBtb2R1bGUsIGl0J3MgaW5zcGVjdCBmdW5jdGlvbiBpcyBzcGVjaWFsXG4gICAgICB2YWx1ZS5pbnNwZWN0ICE9PSBleHBvcnRzLmluc3BlY3QgJiZcbiAgICAgIC8vIEFsc28gZmlsdGVyIG91dCBhbnkgcHJvdG90eXBlIG9iamVjdHMgdXNpbmcgdGhlIGNpcmN1bGFyIGNoZWNrLlxuICAgICAgISh2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgPT09IHZhbHVlKSkge1xuICAgIHZhciByZXQgPSB2YWx1ZS5pbnNwZWN0KHJlY3Vyc2VUaW1lcywgY3R4KTtcbiAgICBpZiAoIWlzU3RyaW5nKHJldCkpIHtcbiAgICAgIHJldCA9IGZvcm1hdFZhbHVlKGN0eCwgcmV0LCByZWN1cnNlVGltZXMpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgLy8gUHJpbWl0aXZlIHR5cGVzIGNhbm5vdCBoYXZlIHByb3BlcnRpZXNcbiAgdmFyIHByaW1pdGl2ZSA9IGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKTtcbiAgaWYgKHByaW1pdGl2ZSkge1xuICAgIHJldHVybiBwcmltaXRpdmU7XG4gIH1cblxuICAvLyBMb29rIHVwIHRoZSBrZXlzIG9mIHRoZSBvYmplY3QuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICB2YXIgdmlzaWJsZUtleXMgPSBhcnJheVRvSGFzaChrZXlzKTtcblxuICBpZiAoY3R4LnNob3dIaWRkZW4pIHtcbiAgICBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModmFsdWUpO1xuICB9XG5cbiAgLy8gSUUgZG9lc24ndCBtYWtlIGVycm9yIGZpZWxkcyBub24tZW51bWVyYWJsZVxuICAvLyBodHRwOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvaWUvZHd3NTJzYnQodj12cy45NCkuYXNweFxuICBpZiAoaXNFcnJvcih2YWx1ZSlcbiAgICAgICYmIChrZXlzLmluZGV4T2YoJ21lc3NhZ2UnKSA+PSAwIHx8IGtleXMuaW5kZXhPZignZGVzY3JpcHRpb24nKSA+PSAwKSkge1xuICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICAvLyBTb21lIHR5cGUgb2Ygb2JqZWN0IHdpdGhvdXQgcHJvcGVydGllcyBjYW4gYmUgc2hvcnRjdXR0ZWQuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgdmFyIG5hbWUgPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW0Z1bmN0aW9uJyArIG5hbWUgKyAnXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfVxuICAgIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoRGF0ZS5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdkYXRlJyk7XG4gICAgfVxuICAgIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICB2YXIgYmFzZSA9ICcnLCBhcnJheSA9IGZhbHNlLCBicmFjZXMgPSBbJ3snLCAnfSddO1xuXG4gIC8vIE1ha2UgQXJyYXkgc2F5IHRoYXQgdGhleSBhcmUgQXJyYXlcbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgYXJyYXkgPSB0cnVlO1xuICAgIGJyYWNlcyA9IFsnWycsICddJ107XG4gIH1cblxuICAvLyBNYWtlIGZ1bmN0aW9ucyBzYXkgdGhhdCB0aGV5IGFyZSBmdW5jdGlvbnNcbiAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgdmFyIG4gPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICBiYXNlID0gJyBbRnVuY3Rpb24nICsgbiArICddJztcbiAgfVxuXG4gIC8vIE1ha2UgUmVnRXhwcyBzYXkgdGhhdCB0aGV5IGFyZSBSZWdFeHBzXG4gIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZGF0ZXMgd2l0aCBwcm9wZXJ0aWVzIGZpcnN0IHNheSB0aGUgZGF0ZVxuICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBEYXRlLnByb3RvdHlwZS50b1VUQ1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZXJyb3Igd2l0aCBtZXNzYWdlIGZpcnN0IHNheSB0aGUgZXJyb3JcbiAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCAmJiAoIWFycmF5IHx8IHZhbHVlLmxlbmd0aCA9PSAwKSkge1xuICAgIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgYnJhY2VzWzFdO1xuICB9XG5cbiAgaWYgKHJlY3Vyc2VUaW1lcyA8IDApIHtcbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tPYmplY3RdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cblxuICBjdHguc2Vlbi5wdXNoKHZhbHVlKTtcblxuICB2YXIgb3V0cHV0O1xuICBpZiAoYXJyYXkpIHtcbiAgICBvdXRwdXQgPSBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKTtcbiAgfSBlbHNlIHtcbiAgICBvdXRwdXQgPSBrZXlzLm1hcChmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KTtcbiAgICB9KTtcbiAgfVxuXG4gIGN0eC5zZWVuLnBvcCgpO1xuXG4gIHJldHVybiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ3VuZGVmaW5lZCcsICd1bmRlZmluZWQnKTtcbiAgaWYgKGlzU3RyaW5nKHZhbHVlKSkge1xuICAgIHZhciBzaW1wbGUgPSAnXFwnJyArIEpTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC9eXCJ8XCIkL2csICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKSArICdcXCcnO1xuICAgIHJldHVybiBjdHguc3R5bGl6ZShzaW1wbGUsICdzdHJpbmcnKTtcbiAgfVxuICBpZiAoaXNOdW1iZXIodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnbnVtYmVyJyk7XG4gIGlmIChpc0Jvb2xlYW4odmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnYm9vbGVhbicpO1xuICAvLyBGb3Igc29tZSByZWFzb24gdHlwZW9mIG51bGwgaXMgXCJvYmplY3RcIiwgc28gc3BlY2lhbCBjYXNlIGhlcmUuXG4gIGlmIChpc051bGwodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnbnVsbCcsICdudWxsJyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0RXJyb3IodmFsdWUpIHtcbiAgcmV0dXJuICdbJyArIEVycm9yLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSArICddJztcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKSB7XG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICBpZiAoaGFzT3duUHJvcGVydHkodmFsdWUsIFN0cmluZyhpKSkpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAgU3RyaW5nKGkpLCB0cnVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC5wdXNoKCcnKTtcbiAgICB9XG4gIH1cbiAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgIGlmICgha2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBrZXksIHRydWUpKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpIHtcbiAgdmFyIG5hbWUsIHN0ciwgZGVzYztcbiAgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodmFsdWUsIGtleSkgfHwgeyB2YWx1ZTogdmFsdWVba2V5XSB9O1xuICBpZiAoZGVzYy5nZXQpIHtcbiAgICBpZiAoZGVzYy5zZXQpIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyL1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoZGVzYy5zZXQpIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmICghaGFzT3duUHJvcGVydHkodmlzaWJsZUtleXMsIGtleSkpIHtcbiAgICBuYW1lID0gJ1snICsga2V5ICsgJ10nO1xuICB9XG4gIGlmICghc3RyKSB7XG4gICAgaWYgKGN0eC5zZWVuLmluZGV4T2YoZGVzYy52YWx1ZSkgPCAwKSB7XG4gICAgICBpZiAoaXNOdWxsKHJlY3Vyc2VUaW1lcykpIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCBudWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgZGVzYy52YWx1ZSwgcmVjdXJzZVRpbWVzIC0gMSk7XG4gICAgICB9XG4gICAgICBpZiAoc3RyLmluZGV4T2YoJ1xcbicpID4gLTEpIHtcbiAgICAgICAgaWYgKGFycmF5KSB7XG4gICAgICAgICAgc3RyID0gc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpLnN1YnN0cigyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdHIgPSAnXFxuJyArIHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tDaXJjdWxhcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAoaXNVbmRlZmluZWQobmFtZSkpIHtcbiAgICBpZiAoYXJyYXkgJiYga2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgbmFtZSA9IEpTT04uc3RyaW5naWZ5KCcnICsga2V5KTtcbiAgICBpZiAobmFtZS5tYXRjaCgvXlwiKFthLXpBLVpfXVthLXpBLVpfMC05XSopXCIkLykpIHtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cigxLCBuYW1lLmxlbmd0aCAtIDIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICduYW1lJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oXlwifFwiJCkvZywgXCInXCIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICdzdHJpbmcnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmFtZSArICc6ICcgKyBzdHI7XG59XG5cblxuZnVuY3Rpb24gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpIHtcbiAgdmFyIG51bUxpbmVzRXN0ID0gMDtcbiAgdmFyIGxlbmd0aCA9IG91dHB1dC5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VyKSB7XG4gICAgbnVtTGluZXNFc3QrKztcbiAgICBpZiAoY3VyLmluZGV4T2YoJ1xcbicpID49IDApIG51bUxpbmVzRXN0Kys7XG4gICAgcmV0dXJuIHByZXYgKyBjdXIucmVwbGFjZSgvXFx1MDAxYlxcW1xcZFxcZD9tL2csICcnKS5sZW5ndGggKyAxO1xuICB9LCAwKTtcblxuICBpZiAobGVuZ3RoID4gNjApIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICtcbiAgICAgICAgICAgKGJhc2UgPT09ICcnID8gJycgOiBiYXNlICsgJ1xcbiAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIG91dHB1dC5qb2luKCcsXFxuICAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIGJyYWNlc1sxXTtcbiAgfVxuXG4gIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgJyAnICsgb3V0cHV0LmpvaW4oJywgJykgKyAnICcgKyBicmFjZXNbMV07XG59XG5cblxuLy8gTk9URTogVGhlc2UgdHlwZSBjaGVja2luZyBmdW5jdGlvbnMgaW50ZW50aW9uYWxseSBkb24ndCB1c2UgYGluc3RhbmNlb2ZgXG4vLyBiZWNhdXNlIGl0IGlzIGZyYWdpbGUgYW5kIGNhbiBiZSBlYXNpbHkgZmFrZWQgd2l0aCBgT2JqZWN0LmNyZWF0ZSgpYC5cbmZ1bmN0aW9uIGlzQXJyYXkoYXIpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYXIpO1xufVxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gaXNCb29sZWFuKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nO1xufVxuZXhwb3J0cy5pc0Jvb2xlYW4gPSBpc0Jvb2xlYW47XG5cbmZ1bmN0aW9uIGlzTnVsbChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsID0gaXNOdWxsO1xuXG5mdW5jdGlvbiBpc051bGxPclVuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGxPclVuZGVmaW5lZCA9IGlzTnVsbE9yVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5pc051bWJlciA9IGlzTnVtYmVyO1xuXG5mdW5jdGlvbiBpc1N0cmluZyhhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnO1xufVxuZXhwb3J0cy5pc1N0cmluZyA9IGlzU3RyaW5nO1xuXG5mdW5jdGlvbiBpc1N5bWJvbChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnO1xufVxuZXhwb3J0cy5pc1N5bWJvbCA9IGlzU3ltYm9sO1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuZXhwb3J0cy5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gaXNPYmplY3QocmUpICYmIG9iamVjdFRvU3RyaW5nKHJlKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59XG5leHBvcnRzLmlzUmVnRXhwID0gaXNSZWdFeHA7XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuZXhwb3J0cy5pc09iamVjdCA9IGlzT2JqZWN0O1xuXG5mdW5jdGlvbiBpc0RhdGUoZCkge1xuICByZXR1cm4gaXNPYmplY3QoZCkgJiYgb2JqZWN0VG9TdHJpbmcoZCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn1cbmV4cG9ydHMuaXNEYXRlID0gaXNEYXRlO1xuXG5mdW5jdGlvbiBpc0Vycm9yKGUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGUpICYmXG4gICAgICAob2JqZWN0VG9TdHJpbmcoZSkgPT09ICdbb2JqZWN0IEVycm9yXScgfHwgZSBpbnN0YW5jZW9mIEVycm9yKTtcbn1cbmV4cG9ydHMuaXNFcnJvciA9IGlzRXJyb3I7XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcblxuZnVuY3Rpb24gaXNQcmltaXRpdmUoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGwgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ251bWJlcicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3ltYm9sJyB8fCAgLy8gRVM2IHN5bWJvbFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3VuZGVmaW5lZCc7XG59XG5leHBvcnRzLmlzUHJpbWl0aXZlID0gaXNQcmltaXRpdmU7XG5cbmV4cG9ydHMuaXNCdWZmZXIgPSByZXF1aXJlKCcuL3N1cHBvcnQvaXNCdWZmZXInKTtcblxuZnVuY3Rpb24gb2JqZWN0VG9TdHJpbmcobykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pO1xufVxuXG5cbmZ1bmN0aW9uIHBhZChuKSB7XG4gIHJldHVybiBuIDwgMTAgPyAnMCcgKyBuLnRvU3RyaW5nKDEwKSA6IG4udG9TdHJpbmcoMTApO1xufVxuXG5cbnZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJyxcbiAgICAgICAgICAgICAgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbi8vIDI2IEZlYiAxNjoxOTozNFxuZnVuY3Rpb24gdGltZXN0YW1wKCkge1xuICB2YXIgZCA9IG5ldyBEYXRlKCk7XG4gIHZhciB0aW1lID0gW3BhZChkLmdldEhvdXJzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRNaW51dGVzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRTZWNvbmRzKCkpXS5qb2luKCc6Jyk7XG4gIHJldHVybiBbZC5nZXREYXRlKCksIG1vbnRoc1tkLmdldE1vbnRoKCldLCB0aW1lXS5qb2luKCcgJyk7XG59XG5cblxuLy8gbG9nIGlzIGp1c3QgYSB0aGluIHdyYXBwZXIgdG8gY29uc29sZS5sb2cgdGhhdCBwcmVwZW5kcyBhIHRpbWVzdGFtcFxuZXhwb3J0cy5sb2cgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJyVzIC0gJXMnLCB0aW1lc3RhbXAoKSwgZXhwb3J0cy5mb3JtYXQuYXBwbHkoZXhwb3J0cywgYXJndW1lbnRzKSk7XG59O1xuXG5cbi8qKlxuICogSW5oZXJpdCB0aGUgcHJvdG90eXBlIG1ldGhvZHMgZnJvbSBvbmUgY29uc3RydWN0b3IgaW50byBhbm90aGVyLlxuICpcbiAqIFRoZSBGdW5jdGlvbi5wcm90b3R5cGUuaW5oZXJpdHMgZnJvbSBsYW5nLmpzIHJld3JpdHRlbiBhcyBhIHN0YW5kYWxvbmVcbiAqIGZ1bmN0aW9uIChub3Qgb24gRnVuY3Rpb24ucHJvdG90eXBlKS4gTk9URTogSWYgdGhpcyBmaWxlIGlzIHRvIGJlIGxvYWRlZFxuICogZHVyaW5nIGJvb3RzdHJhcHBpbmcgdGhpcyBmdW5jdGlvbiBuZWVkcyB0byBiZSByZXdyaXR0ZW4gdXNpbmcgc29tZSBuYXRpdmVcbiAqIGZ1bmN0aW9ucyBhcyBwcm90b3R5cGUgc2V0dXAgdXNpbmcgbm9ybWFsIEphdmFTY3JpcHQgZG9lcyBub3Qgd29yayBhc1xuICogZXhwZWN0ZWQgZHVyaW5nIGJvb3RzdHJhcHBpbmcgKHNlZSBtaXJyb3IuanMgaW4gcjExNDkwMykuXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbn0gY3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB3aGljaCBuZWVkcyB0byBpbmhlcml0IHRoZVxuICogICAgIHByb3RvdHlwZS5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IHN1cGVyQ3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB0byBpbmhlcml0IHByb3RvdHlwZSBmcm9tLlxuICovXG5leHBvcnRzLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcblxuZXhwb3J0cy5fZXh0ZW5kID0gZnVuY3Rpb24ob3JpZ2luLCBhZGQpIHtcbiAgLy8gRG9uJ3QgZG8gYW55dGhpbmcgaWYgYWRkIGlzbid0IGFuIG9iamVjdFxuICBpZiAoIWFkZCB8fCAhaXNPYmplY3QoYWRkKSkgcmV0dXJuIG9yaWdpbjtcblxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGFkZCk7XG4gIHZhciBpID0ga2V5cy5sZW5ndGg7XG4gIHdoaWxlIChpLS0pIHtcbiAgICBvcmlnaW5ba2V5c1tpXV0gPSBhZGRba2V5c1tpXV07XG4gIH1cbiAgcmV0dXJuIG9yaWdpbjtcbn07XG5cbmZ1bmN0aW9uIGhhc093blByb3BlcnR5KG9iaiwgcHJvcCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XG59XG4iLCIvKiFcbkNvcHlyaWdodCAoQykgMjAxMC0yMDEzIFJheW1vbmQgSGlsbDogaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pXG5NSVQgTGljZW5zZTogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9MSUNFTlNFLm1kXG4qL1xuLypcbkF1dGhvcjogUmF5bW9uZCBIaWxsIChyaGlsbEByYXltb25kaGlsbC5uZXQpXG5Db250cmlidXRvcjogSmVzc2UgTW9yZ2FuIChtb3JnYWplbEBnbWFpbC5jb20pXG5GaWxlOiByaGlsbC12b3Jvbm9pLWNvcmUuanNcblZlcnNpb246IDAuOThcbkRhdGU6IEphbnVhcnkgMjEsIDIwMTNcbkRlc2NyaXB0aW9uOiBUaGlzIGlzIG15IHBlcnNvbmFsIEphdmFzY3JpcHQgaW1wbGVtZW50YXRpb24gb2ZcblN0ZXZlbiBGb3J0dW5lJ3MgYWxnb3JpdGhtIHRvIGNvbXB1dGUgVm9yb25vaSBkaWFncmFtcy5cblxuTGljZW5zZTogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9MSUNFTlNFLm1kXG5DcmVkaXRzOiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pL0NSRURJVFMubWRcbkhpc3Rvcnk6IFNlZSBodHRwczovL2dpdGh1Yi5jb20vZ29yaGlsbC9KYXZhc2NyaXB0LVZvcm9ub2kvQ0hBTkdFTE9HLm1kXG5cbiMjIFVzYWdlOlxuXG4gIHZhciBzaXRlcyA9IFt7eDozMDAseTozMDB9LCB7eDoxMDAseToxMDB9LCB7eDoyMDAseTo1MDB9LCB7eDoyNTAseTo0NTB9LCB7eDo2MDAseToxNTB9XTtcbiAgLy8geGwsIHhyIG1lYW5zIHggbGVmdCwgeCByaWdodFxuICAvLyB5dCwgeWIgbWVhbnMgeSB0b3AsIHkgYm90dG9tXG4gIHZhciBiYm94ID0ge3hsOjAsIHhyOjgwMCwgeXQ6MCwgeWI6NjAwfTtcbiAgdmFyIHZvcm9ub2kgPSBuZXcgVm9yb25vaSgpO1xuICAvLyBwYXNzIGFuIG9iamVjdCB3aGljaCBleGhpYml0cyB4bCwgeHIsIHl0LCB5YiBwcm9wZXJ0aWVzLiBUaGUgYm91bmRpbmdcbiAgLy8gYm94IHdpbGwgYmUgdXNlZCB0byBjb25uZWN0IHVuYm91bmQgZWRnZXMsIGFuZCB0byBjbG9zZSBvcGVuIGNlbGxzXG4gIHJlc3VsdCA9IHZvcm9ub2kuY29tcHV0ZShzaXRlcywgYmJveCk7XG4gIC8vIHJlbmRlciwgZnVydGhlciBhbmFseXplLCBldGMuXG5cblJldHVybiB2YWx1ZTpcbiAgQW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuXG4gIHJlc3VsdC52ZXJ0aWNlcyA9IGFuIGFycmF5IG9mIHVub3JkZXJlZCwgdW5pcXVlIFZvcm9ub2kuVmVydGV4IG9iamVjdHMgbWFraW5nXG4gICAgdXAgdGhlIFZvcm9ub2kgZGlhZ3JhbS5cbiAgcmVzdWx0LmVkZ2VzID0gYW4gYXJyYXkgb2YgdW5vcmRlcmVkLCB1bmlxdWUgVm9yb25vaS5FZGdlIG9iamVjdHMgbWFraW5nIHVwXG4gICAgdGhlIFZvcm9ub2kgZGlhZ3JhbS5cbiAgcmVzdWx0LmNlbGxzID0gYW4gYXJyYXkgb2YgVm9yb25vaS5DZWxsIG9iamVjdCBtYWtpbmcgdXAgdGhlIFZvcm9ub2kgZGlhZ3JhbS5cbiAgICBBIENlbGwgb2JqZWN0IG1pZ2h0IGhhdmUgYW4gZW1wdHkgYXJyYXkgb2YgaGFsZmVkZ2VzLCBtZWFuaW5nIG5vIFZvcm9ub2lcbiAgICBjZWxsIGNvdWxkIGJlIGNvbXB1dGVkIGZvciBhIHBhcnRpY3VsYXIgY2VsbC5cbiAgcmVzdWx0LmV4ZWNUaW1lID0gdGhlIHRpbWUgaXQgdG9vayB0byBjb21wdXRlIHRoZSBWb3Jvbm9pIGRpYWdyYW0sIGluXG4gICAgbWlsbGlzZWNvbmRzLlxuXG5Wb3Jvbm9pLlZlcnRleCBvYmplY3Q6XG4gIHg6IFRoZSB4IHBvc2l0aW9uIG9mIHRoZSB2ZXJ0ZXguXG4gIHk6IFRoZSB5IHBvc2l0aW9uIG9mIHRoZSB2ZXJ0ZXguXG5cblZvcm9ub2kuRWRnZSBvYmplY3Q6XG4gIGxTaXRlOiB0aGUgVm9yb25vaSBzaXRlIG9iamVjdCBhdCB0aGUgbGVmdCBvZiB0aGlzIFZvcm9ub2kuRWRnZSBvYmplY3QuXG4gIHJTaXRlOiB0aGUgVm9yb25vaSBzaXRlIG9iamVjdCBhdCB0aGUgcmlnaHQgb2YgdGhpcyBWb3Jvbm9pLkVkZ2Ugb2JqZWN0IChjYW5cbiAgICBiZSBudWxsKS5cbiAgdmE6IGFuIG9iamVjdCB3aXRoIGFuICd4JyBhbmQgYSAneScgcHJvcGVydHkgZGVmaW5pbmcgdGhlIHN0YXJ0IHBvaW50XG4gICAgKHJlbGF0aXZlIHRvIHRoZSBWb3Jvbm9pIHNpdGUgb24gdGhlIGxlZnQpIG9mIHRoaXMgVm9yb25vaS5FZGdlIG9iamVjdC5cbiAgdmI6IGFuIG9iamVjdCB3aXRoIGFuICd4JyBhbmQgYSAneScgcHJvcGVydHkgZGVmaW5pbmcgdGhlIGVuZCBwb2ludFxuICAgIChyZWxhdGl2ZSB0byBWb3Jvbm9pIHNpdGUgb24gdGhlIGxlZnQpIG9mIHRoaXMgVm9yb25vaS5FZGdlIG9iamVjdC5cblxuICBGb3IgZWRnZXMgd2hpY2ggYXJlIHVzZWQgdG8gY2xvc2Ugb3BlbiBjZWxscyAodXNpbmcgdGhlIHN1cHBsaWVkIGJvdW5kaW5nXG4gIGJveCksIHRoZSByU2l0ZSBwcm9wZXJ0eSB3aWxsIGJlIG51bGwuXG5cblZvcm9ub2kuQ2VsbCBvYmplY3Q6XG4gIHNpdGU6IHRoZSBWb3Jvbm9pIHNpdGUgb2JqZWN0IGFzc29jaWF0ZWQgd2l0aCB0aGUgVm9yb25vaSBjZWxsLlxuICBoYWxmZWRnZXM6IGFuIGFycmF5IG9mIFZvcm9ub2kuSGFsZmVkZ2Ugb2JqZWN0cywgb3JkZXJlZCBjb3VudGVyY2xvY2t3aXNlLFxuICAgIGRlZmluaW5nIHRoZSBwb2x5Z29uIGZvciB0aGlzIFZvcm9ub2kgY2VsbC5cblxuVm9yb25vaS5IYWxmZWRnZSBvYmplY3Q6XG4gIHNpdGU6IHRoZSBWb3Jvbm9pIHNpdGUgb2JqZWN0IG93bmluZyB0aGlzIFZvcm9ub2kuSGFsZmVkZ2Ugb2JqZWN0LlxuICBlZGdlOiBhIHJlZmVyZW5jZSB0byB0aGUgdW5pcXVlIFZvcm9ub2kuRWRnZSBvYmplY3QgdW5kZXJseWluZyB0aGlzXG4gICAgVm9yb25vaS5IYWxmZWRnZSBvYmplY3QuXG4gIGdldFN0YXJ0cG9pbnQoKTogYSBtZXRob2QgcmV0dXJuaW5nIGFuIG9iamVjdCB3aXRoIGFuICd4JyBhbmQgYSAneScgcHJvcGVydHlcbiAgICBmb3IgdGhlIHN0YXJ0IHBvaW50IG9mIHRoaXMgaGFsZmVkZ2UuIEtlZXAgaW4gbWluZCBoYWxmZWRnZXMgYXJlIGFsd2F5c1xuICAgIGNvdW50ZXJjb2Nrd2lzZS5cbiAgZ2V0RW5kcG9pbnQoKTogYSBtZXRob2QgcmV0dXJuaW5nIGFuIG9iamVjdCB3aXRoIGFuICd4JyBhbmQgYSAneScgcHJvcGVydHlcbiAgICBmb3IgdGhlIGVuZCBwb2ludCBvZiB0aGlzIGhhbGZlZGdlLiBLZWVwIGluIG1pbmQgaGFsZmVkZ2VzIGFyZSBhbHdheXNcbiAgICBjb3VudGVyY29ja3dpc2UuXG5cblRPRE86IElkZW50aWZ5IG9wcG9ydHVuaXRpZXMgZm9yIHBlcmZvcm1hbmNlIGltcHJvdmVtZW50LlxuXG5UT0RPOiBMZXQgdGhlIHVzZXIgY2xvc2UgdGhlIFZvcm9ub2kgY2VsbHMsIGRvIG5vdCBkbyBpdCBhdXRvbWF0aWNhbGx5LiBOb3Qgb25seSBsZXRcbiAgICAgIGhpbSBjbG9zZSB0aGUgY2VsbHMsIGJ1dCBhbHNvIGFsbG93IGhpbSB0byBjbG9zZSBtb3JlIHRoYW4gb25jZSB1c2luZyBhIGRpZmZlcmVudFxuICAgICAgYm91bmRpbmcgYm94IGZvciB0aGUgc2FtZSBWb3Jvbm9pIGRpYWdyYW0uXG4qL1xuXG4vKmdsb2JhbCBNYXRoICovXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5mdW5jdGlvbiBWb3Jvbm9pKCkge1xuICAgIHRoaXMudmVydGljZXMgPSBudWxsO1xuICAgIHRoaXMuZWRnZXMgPSBudWxsO1xuICAgIHRoaXMuY2VsbHMgPSBudWxsO1xuICAgIHRoaXMudG9SZWN5Y2xlID0gbnVsbDtcbiAgICB0aGlzLmJlYWNoc2VjdGlvbkp1bmt5YXJkID0gW107XG4gICAgdGhpcy5jaXJjbGVFdmVudEp1bmt5YXJkID0gW107XG4gICAgdGhpcy52ZXJ0ZXhKdW5reWFyZCA9IFtdO1xuICAgIHRoaXMuZWRnZUp1bmt5YXJkID0gW107XG4gICAgdGhpcy5jZWxsSnVua3lhcmQgPSBbXTtcbiAgICB9XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5iZWFjaGxpbmUpIHtcbiAgICAgICAgdGhpcy5iZWFjaGxpbmUgPSBuZXcgdGhpcy5SQlRyZWUoKTtcbiAgICAgICAgfVxuICAgIC8vIE1vdmUgbGVmdG92ZXIgYmVhY2hzZWN0aW9ucyB0byB0aGUgYmVhY2hzZWN0aW9uIGp1bmt5YXJkLlxuICAgIGlmICh0aGlzLmJlYWNobGluZS5yb290KSB7XG4gICAgICAgIHZhciBiZWFjaHNlY3Rpb24gPSB0aGlzLmJlYWNobGluZS5nZXRGaXJzdCh0aGlzLmJlYWNobGluZS5yb290KTtcbiAgICAgICAgd2hpbGUgKGJlYWNoc2VjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5iZWFjaHNlY3Rpb25KdW5reWFyZC5wdXNoKGJlYWNoc2VjdGlvbik7IC8vIG1hcmsgZm9yIHJldXNlXG4gICAgICAgICAgICBiZWFjaHNlY3Rpb24gPSBiZWFjaHNlY3Rpb24ucmJOZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgdGhpcy5iZWFjaGxpbmUucm9vdCA9IG51bGw7XG4gICAgaWYgKCF0aGlzLmNpcmNsZUV2ZW50cykge1xuICAgICAgICB0aGlzLmNpcmNsZUV2ZW50cyA9IG5ldyB0aGlzLlJCVHJlZSgpO1xuICAgICAgICB9XG4gICAgdGhpcy5jaXJjbGVFdmVudHMucm9vdCA9IHRoaXMuZmlyc3RDaXJjbGVFdmVudCA9IG51bGw7XG4gICAgdGhpcy52ZXJ0aWNlcyA9IFtdO1xuICAgIHRoaXMuZWRnZXMgPSBbXTtcbiAgICB0aGlzLmNlbGxzID0gW107XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuc3FydCA9IE1hdGguc3FydDtcblZvcm9ub2kucHJvdG90eXBlLmFicyA9IE1hdGguYWJzO1xuVm9yb25vaS5wcm90b3R5cGUuzrUgPSBWb3Jvbm9pLs61ID0gMWUtOTtcblZvcm9ub2kucHJvdG90eXBlLmluds61ID0gVm9yb25vaS5pbnbOtSA9IDEuMCAvIFZvcm9ub2kuzrU7XG5Wb3Jvbm9pLnByb3RvdHlwZS5lcXVhbFdpdGhFcHNpbG9uID0gZnVuY3Rpb24oYSxiKXtyZXR1cm4gdGhpcy5hYnMoYS1iKTwxZS05O307XG5Wb3Jvbm9pLnByb3RvdHlwZS5ncmVhdGVyVGhhbldpdGhFcHNpbG9uID0gZnVuY3Rpb24oYSxiKXtyZXR1cm4gYS1iPjFlLTk7fTtcblZvcm9ub2kucHJvdG90eXBlLmdyZWF0ZXJUaGFuT3JFcXVhbFdpdGhFcHNpbG9uID0gZnVuY3Rpb24oYSxiKXtyZXR1cm4gYi1hPDFlLTk7fTtcblZvcm9ub2kucHJvdG90eXBlLmxlc3NUaGFuV2l0aEVwc2lsb24gPSBmdW5jdGlvbihhLGIpe3JldHVybiBiLWE+MWUtOTt9O1xuVm9yb25vaS5wcm90b3R5cGUubGVzc1RoYW5PckVxdWFsV2l0aEVwc2lsb24gPSBmdW5jdGlvbihhLGIpe3JldHVybiBhLWI8MWUtOTt9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFJlZC1CbGFjayB0cmVlIGNvZGUgKGJhc2VkIG9uIEMgdmVyc2lvbiBvZiBcInJidHJlZVwiIGJ5IEZyYW5jayBCdWktSHV1XG4vLyBodHRwczovL2dpdGh1Yi5jb20vZmJ1aWh1dS9saWJ0cmVlL2Jsb2IvbWFzdGVyL3JiLmNcblxuVm9yb25vaS5wcm90b3R5cGUuUkJUcmVlID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yb290ID0gbnVsbDtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLnJiSW5zZXJ0U3VjY2Vzc29yID0gZnVuY3Rpb24obm9kZSwgc3VjY2Vzc29yKSB7XG4gICAgdmFyIHBhcmVudDtcbiAgICBpZiAobm9kZSkge1xuICAgICAgICAvLyA+Pj4gcmhpbGwgMjAxMS0wNS0yNzogUGVyZm9ybWFuY2U6IGNhY2hlIHByZXZpb3VzL25leHQgbm9kZXNcbiAgICAgICAgc3VjY2Vzc29yLnJiUHJldmlvdXMgPSBub2RlO1xuICAgICAgICBzdWNjZXNzb3IucmJOZXh0ID0gbm9kZS5yYk5leHQ7XG4gICAgICAgIGlmIChub2RlLnJiTmV4dCkge1xuICAgICAgICAgICAgbm9kZS5yYk5leHQucmJQcmV2aW91cyA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgbm9kZS5yYk5leHQgPSBzdWNjZXNzb3I7XG4gICAgICAgIC8vIDw8PFxuICAgICAgICBpZiAobm9kZS5yYlJpZ2h0KSB7XG4gICAgICAgICAgICAvLyBpbi1wbGFjZSBleHBhbnNpb24gb2Ygbm9kZS5yYlJpZ2h0LmdldEZpcnN0KCk7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5yYlJpZ2h0O1xuICAgICAgICAgICAgd2hpbGUgKG5vZGUucmJMZWZ0KSB7bm9kZSA9IG5vZGUucmJMZWZ0O31cbiAgICAgICAgICAgIG5vZGUucmJMZWZ0ID0gc3VjY2Vzc29yO1xuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG5vZGUucmJSaWdodCA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgcGFyZW50ID0gbm9kZTtcbiAgICAgICAgfVxuICAgIC8vIHJoaWxsIDIwMTEtMDYtMDc6IGlmIG5vZGUgaXMgbnVsbCwgc3VjY2Vzc29yIG11c3QgYmUgaW5zZXJ0ZWRcbiAgICAvLyB0byB0aGUgbGVmdC1tb3N0IHBhcnQgb2YgdGhlIHRyZWVcbiAgICBlbHNlIGlmICh0aGlzLnJvb3QpIHtcbiAgICAgICAgbm9kZSA9IHRoaXMuZ2V0Rmlyc3QodGhpcy5yb290KTtcbiAgICAgICAgLy8gPj4+IFBlcmZvcm1hbmNlOiBjYWNoZSBwcmV2aW91cy9uZXh0IG5vZGVzXG4gICAgICAgIHN1Y2Nlc3Nvci5yYlByZXZpb3VzID0gbnVsbDtcbiAgICAgICAgc3VjY2Vzc29yLnJiTmV4dCA9IG5vZGU7XG4gICAgICAgIG5vZGUucmJQcmV2aW91cyA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgLy8gPDw8XG4gICAgICAgIG5vZGUucmJMZWZ0ID0gc3VjY2Vzc29yO1xuICAgICAgICBwYXJlbnQgPSBub2RlO1xuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIC8vID4+PiBQZXJmb3JtYW5jZTogY2FjaGUgcHJldmlvdXMvbmV4dCBub2Rlc1xuICAgICAgICBzdWNjZXNzb3IucmJQcmV2aW91cyA9IHN1Y2Nlc3Nvci5yYk5leHQgPSBudWxsO1xuICAgICAgICAvLyA8PDxcbiAgICAgICAgdGhpcy5yb290ID0gc3VjY2Vzc29yO1xuICAgICAgICBwYXJlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgc3VjY2Vzc29yLnJiTGVmdCA9IHN1Y2Nlc3Nvci5yYlJpZ2h0ID0gbnVsbDtcbiAgICBzdWNjZXNzb3IucmJQYXJlbnQgPSBwYXJlbnQ7XG4gICAgc3VjY2Vzc29yLnJiUmVkID0gdHJ1ZTtcbiAgICAvLyBGaXh1cCB0aGUgbW9kaWZpZWQgdHJlZSBieSByZWNvbG9yaW5nIG5vZGVzIGFuZCBwZXJmb3JtaW5nXG4gICAgLy8gcm90YXRpb25zICgyIGF0IG1vc3QpIGhlbmNlIHRoZSByZWQtYmxhY2sgdHJlZSBwcm9wZXJ0aWVzIGFyZVxuICAgIC8vIHByZXNlcnZlZC5cbiAgICB2YXIgZ3JhbmRwYSwgdW5jbGU7XG4gICAgbm9kZSA9IHN1Y2Nlc3NvcjtcbiAgICB3aGlsZSAocGFyZW50ICYmIHBhcmVudC5yYlJlZCkge1xuICAgICAgICBncmFuZHBhID0gcGFyZW50LnJiUGFyZW50O1xuICAgICAgICBpZiAocGFyZW50ID09PSBncmFuZHBhLnJiTGVmdCkge1xuICAgICAgICAgICAgdW5jbGUgPSBncmFuZHBhLnJiUmlnaHQ7XG4gICAgICAgICAgICBpZiAodW5jbGUgJiYgdW5jbGUucmJSZWQpIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQucmJSZWQgPSB1bmNsZS5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGdyYW5kcGEucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIG5vZGUgPSBncmFuZHBhO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChub2RlID09PSBwYXJlbnQucmJSaWdodCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlTGVmdChwYXJlbnQpO1xuICAgICAgICAgICAgICAgICAgICBub2RlID0gcGFyZW50O1xuICAgICAgICAgICAgICAgICAgICBwYXJlbnQgPSBub2RlLnJiUGFyZW50O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcGFyZW50LnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgZ3JhbmRwYS5yYlJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZVJpZ2h0KGdyYW5kcGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB1bmNsZSA9IGdyYW5kcGEucmJMZWZ0O1xuICAgICAgICAgICAgaWYgKHVuY2xlICYmIHVuY2xlLnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJiUmVkID0gdW5jbGUucmJSZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBncmFuZHBhLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBub2RlID0gZ3JhbmRwYTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobm9kZSA9PT0gcGFyZW50LnJiTGVmdCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlUmlnaHQocGFyZW50KTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZSA9IHBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50ID0gbm9kZS5yYlBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGdyYW5kcGEucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMucmJSb3RhdGVMZWZ0KGdyYW5kcGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgcGFyZW50ID0gbm9kZS5yYlBhcmVudDtcbiAgICAgICAgfVxuICAgIHRoaXMucm9vdC5yYlJlZCA9IGZhbHNlO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLlJCVHJlZS5wcm90b3R5cGUucmJSZW1vdmVOb2RlID0gZnVuY3Rpb24obm9kZSkge1xuICAgIC8vID4+PiByaGlsbCAyMDExLTA1LTI3OiBQZXJmb3JtYW5jZTogY2FjaGUgcHJldmlvdXMvbmV4dCBub2Rlc1xuICAgIGlmIChub2RlLnJiTmV4dCkge1xuICAgICAgICBub2RlLnJiTmV4dC5yYlByZXZpb3VzID0gbm9kZS5yYlByZXZpb3VzO1xuICAgICAgICB9XG4gICAgaWYgKG5vZGUucmJQcmV2aW91cykge1xuICAgICAgICBub2RlLnJiUHJldmlvdXMucmJOZXh0ID0gbm9kZS5yYk5leHQ7XG4gICAgICAgIH1cbiAgICBub2RlLnJiTmV4dCA9IG5vZGUucmJQcmV2aW91cyA9IG51bGw7XG4gICAgLy8gPDw8XG4gICAgdmFyIHBhcmVudCA9IG5vZGUucmJQYXJlbnQsXG4gICAgICAgIGxlZnQgPSBub2RlLnJiTGVmdCxcbiAgICAgICAgcmlnaHQgPSBub2RlLnJiUmlnaHQsXG4gICAgICAgIG5leHQ7XG4gICAgaWYgKCFsZWZ0KSB7XG4gICAgICAgIG5leHQgPSByaWdodDtcbiAgICAgICAgfVxuICAgIGVsc2UgaWYgKCFyaWdodCkge1xuICAgICAgICBuZXh0ID0gbGVmdDtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBuZXh0ID0gdGhpcy5nZXRGaXJzdChyaWdodCk7XG4gICAgICAgIH1cbiAgICBpZiAocGFyZW50KSB7XG4gICAgICAgIGlmIChwYXJlbnQucmJMZWZ0ID09PSBub2RlKSB7XG4gICAgICAgICAgICBwYXJlbnQucmJMZWZ0ID0gbmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBwYXJlbnQucmJSaWdodCA9IG5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5yb290ID0gbmV4dDtcbiAgICAgICAgfVxuICAgIC8vIGVuZm9yY2UgcmVkLWJsYWNrIHJ1bGVzXG4gICAgdmFyIGlzUmVkO1xuICAgIGlmIChsZWZ0ICYmIHJpZ2h0KSB7XG4gICAgICAgIGlzUmVkID0gbmV4dC5yYlJlZDtcbiAgICAgICAgbmV4dC5yYlJlZCA9IG5vZGUucmJSZWQ7XG4gICAgICAgIG5leHQucmJMZWZ0ID0gbGVmdDtcbiAgICAgICAgbGVmdC5yYlBhcmVudCA9IG5leHQ7XG4gICAgICAgIGlmIChuZXh0ICE9PSByaWdodCkge1xuICAgICAgICAgICAgcGFyZW50ID0gbmV4dC5yYlBhcmVudDtcbiAgICAgICAgICAgIG5leHQucmJQYXJlbnQgPSBub2RlLnJiUGFyZW50O1xuICAgICAgICAgICAgbm9kZSA9IG5leHQucmJSaWdodDtcbiAgICAgICAgICAgIHBhcmVudC5yYkxlZnQgPSBub2RlO1xuICAgICAgICAgICAgbmV4dC5yYlJpZ2h0ID0gcmlnaHQ7XG4gICAgICAgICAgICByaWdodC5yYlBhcmVudCA9IG5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbmV4dC5yYlBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgICAgIHBhcmVudCA9IG5leHQ7XG4gICAgICAgICAgICBub2RlID0gbmV4dC5yYlJpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlzUmVkID0gbm9kZS5yYlJlZDtcbiAgICAgICAgbm9kZSA9IG5leHQ7XG4gICAgICAgIH1cbiAgICAvLyAnbm9kZScgaXMgbm93IHRoZSBzb2xlIHN1Y2Nlc3NvcidzIGNoaWxkIGFuZCAncGFyZW50JyBpdHNcbiAgICAvLyBuZXcgcGFyZW50IChzaW5jZSB0aGUgc3VjY2Vzc29yIGNhbiBoYXZlIGJlZW4gbW92ZWQpXG4gICAgaWYgKG5vZGUpIHtcbiAgICAgICAgbm9kZS5yYlBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgfVxuICAgIC8vIHRoZSAnZWFzeScgY2FzZXNcbiAgICBpZiAoaXNSZWQpIHtyZXR1cm47fVxuICAgIGlmIChub2RlICYmIG5vZGUucmJSZWQpIHtcbiAgICAgICAgbm9kZS5yYlJlZCA9IGZhbHNlO1xuICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAvLyB0aGUgb3RoZXIgY2FzZXNcbiAgICB2YXIgc2libGluZztcbiAgICBkbyB7XG4gICAgICAgIGlmIChub2RlID09PSB0aGlzLnJvb3QpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICBpZiAobm9kZSA9PT0gcGFyZW50LnJiTGVmdCkge1xuICAgICAgICAgICAgc2libGluZyA9IHBhcmVudC5yYlJpZ2h0O1xuICAgICAgICAgICAgaWYgKHNpYmxpbmcucmJSZWQpIHtcbiAgICAgICAgICAgICAgICBzaWJsaW5nLnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlTGVmdChwYXJlbnQpO1xuICAgICAgICAgICAgICAgIHNpYmxpbmcgPSBwYXJlbnQucmJSaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoKHNpYmxpbmcucmJMZWZ0ICYmIHNpYmxpbmcucmJMZWZ0LnJiUmVkKSB8fCAoc2libGluZy5yYlJpZ2h0ICYmIHNpYmxpbmcucmJSaWdodC5yYlJlZCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXNpYmxpbmcucmJSaWdodCB8fCAhc2libGluZy5yYlJpZ2h0LnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcucmJMZWZ0LnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlUmlnaHQoc2libGluZyk7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcgPSBwYXJlbnQucmJSaWdodDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNpYmxpbmcucmJSZWQgPSBwYXJlbnQucmJSZWQ7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJiUmVkID0gc2libGluZy5yYlJpZ2h0LnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZUxlZnQocGFyZW50KTtcbiAgICAgICAgICAgICAgICBub2RlID0gdGhpcy5yb290O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBzaWJsaW5nID0gcGFyZW50LnJiTGVmdDtcbiAgICAgICAgICAgIGlmIChzaWJsaW5nLnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgc2libGluZy5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZVJpZ2h0KHBhcmVudCk7XG4gICAgICAgICAgICAgICAgc2libGluZyA9IHBhcmVudC5yYkxlZnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKChzaWJsaW5nLnJiTGVmdCAmJiBzaWJsaW5nLnJiTGVmdC5yYlJlZCkgfHwgKHNpYmxpbmcucmJSaWdodCAmJiBzaWJsaW5nLnJiUmlnaHQucmJSZWQpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzaWJsaW5nLnJiTGVmdCB8fCAhc2libGluZy5yYkxlZnQucmJSZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2libGluZy5yYlJpZ2h0LnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlTGVmdChzaWJsaW5nKTtcbiAgICAgICAgICAgICAgICAgICAgc2libGluZyA9IHBhcmVudC5yYkxlZnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzaWJsaW5nLnJiUmVkID0gcGFyZW50LnJiUmVkO1xuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IHNpYmxpbmcucmJMZWZ0LnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZVJpZ2h0KHBhcmVudCk7XG4gICAgICAgICAgICAgICAgbm9kZSA9IHRoaXMucm9vdDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIHNpYmxpbmcucmJSZWQgPSB0cnVlO1xuICAgICAgICBub2RlID0gcGFyZW50O1xuICAgICAgICBwYXJlbnQgPSBwYXJlbnQucmJQYXJlbnQ7XG4gICAgfSB3aGlsZSAoIW5vZGUucmJSZWQpO1xuICAgIGlmIChub2RlKSB7bm9kZS5yYlJlZCA9IGZhbHNlO31cbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLnJiUm90YXRlTGVmdCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgcCA9IG5vZGUsXG4gICAgICAgIHEgPSBub2RlLnJiUmlnaHQsIC8vIGNhbid0IGJlIG51bGxcbiAgICAgICAgcGFyZW50ID0gcC5yYlBhcmVudDtcbiAgICBpZiAocGFyZW50KSB7XG4gICAgICAgIGlmIChwYXJlbnQucmJMZWZ0ID09PSBwKSB7XG4gICAgICAgICAgICBwYXJlbnQucmJMZWZ0ID0gcTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBwYXJlbnQucmJSaWdodCA9IHE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5yb290ID0gcTtcbiAgICAgICAgfVxuICAgIHEucmJQYXJlbnQgPSBwYXJlbnQ7XG4gICAgcC5yYlBhcmVudCA9IHE7XG4gICAgcC5yYlJpZ2h0ID0gcS5yYkxlZnQ7XG4gICAgaWYgKHAucmJSaWdodCkge1xuICAgICAgICBwLnJiUmlnaHQucmJQYXJlbnQgPSBwO1xuICAgICAgICB9XG4gICAgcS5yYkxlZnQgPSBwO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLlJCVHJlZS5wcm90b3R5cGUucmJSb3RhdGVSaWdodCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgcCA9IG5vZGUsXG4gICAgICAgIHEgPSBub2RlLnJiTGVmdCwgLy8gY2FuJ3QgYmUgbnVsbFxuICAgICAgICBwYXJlbnQgPSBwLnJiUGFyZW50O1xuICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgaWYgKHBhcmVudC5yYkxlZnQgPT09IHApIHtcbiAgICAgICAgICAgIHBhcmVudC5yYkxlZnQgPSBxO1xuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHBhcmVudC5yYlJpZ2h0ID0gcTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aGlzLnJvb3QgPSBxO1xuICAgICAgICB9XG4gICAgcS5yYlBhcmVudCA9IHBhcmVudDtcbiAgICBwLnJiUGFyZW50ID0gcTtcbiAgICBwLnJiTGVmdCA9IHEucmJSaWdodDtcbiAgICBpZiAocC5yYkxlZnQpIHtcbiAgICAgICAgcC5yYkxlZnQucmJQYXJlbnQgPSBwO1xuICAgICAgICB9XG4gICAgcS5yYlJpZ2h0ID0gcDtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLmdldEZpcnN0ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHdoaWxlIChub2RlLnJiTGVmdCkge1xuICAgICAgICBub2RlID0gbm9kZS5yYkxlZnQ7XG4gICAgICAgIH1cbiAgICByZXR1cm4gbm9kZTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLmdldExhc3QgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgd2hpbGUgKG5vZGUucmJSaWdodCkge1xuICAgICAgICBub2RlID0gbm9kZS5yYlJpZ2h0O1xuICAgICAgICB9XG4gICAgcmV0dXJuIG5vZGU7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBEaWFncmFtIG1ldGhvZHNcblxuVm9yb25vaS5wcm90b3R5cGUuRGlhZ3JhbSA9IGZ1bmN0aW9uKHNpdGUpIHtcbiAgICB0aGlzLnNpdGUgPSBzaXRlO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gQ2VsbCBtZXRob2RzXG5cblZvcm9ub2kucHJvdG90eXBlLkNlbGwgPSBmdW5jdGlvbihzaXRlKSB7XG4gICAgdGhpcy5zaXRlID0gc2l0ZTtcbiAgICB0aGlzLmhhbGZlZGdlcyA9IFtdO1xuICAgIHRoaXMuY2xvc2VNZSA9IGZhbHNlO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLkNlbGwucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbihzaXRlKSB7XG4gICAgdGhpcy5zaXRlID0gc2l0ZTtcbiAgICB0aGlzLmhhbGZlZGdlcyA9IFtdO1xuICAgIHRoaXMuY2xvc2VNZSA9IGZhbHNlO1xuICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmNyZWF0ZUNlbGwgPSBmdW5jdGlvbihzaXRlKSB7XG4gICAgdmFyIGNlbGwgPSB0aGlzLmNlbGxKdW5reWFyZC5wb3AoKTtcbiAgICBpZiAoIGNlbGwgKSB7XG4gICAgICAgIHJldHVybiBjZWxsLmluaXQoc2l0ZSk7XG4gICAgICAgIH1cbiAgICByZXR1cm4gbmV3IHRoaXMuQ2VsbChzaXRlKTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsLnByb3RvdHlwZS5wcmVwYXJlSGFsZmVkZ2VzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGhhbGZlZGdlcyA9IHRoaXMuaGFsZmVkZ2VzLFxuICAgICAgICBpSGFsZmVkZ2UgPSBoYWxmZWRnZXMubGVuZ3RoLFxuICAgICAgICBlZGdlO1xuICAgIC8vIGdldCByaWQgb2YgdW51c2VkIGhhbGZlZGdlc1xuICAgIC8vIHJoaWxsIDIwMTEtMDUtMjc6IEtlZXAgaXQgc2ltcGxlLCBubyBwb2ludCBoZXJlIGluIHRyeWluZ1xuICAgIC8vIHRvIGJlIGZhbmN5OiBkYW5nbGluZyBlZGdlcyBhcmUgYSB0eXBpY2FsbHkgYSBtaW5vcml0eS5cbiAgICB3aGlsZSAoaUhhbGZlZGdlLS0pIHtcbiAgICAgICAgZWRnZSA9IGhhbGZlZGdlc1tpSGFsZmVkZ2VdLmVkZ2U7XG4gICAgICAgIGlmICghZWRnZS52YiB8fCAhZWRnZS52YSkge1xuICAgICAgICAgICAgaGFsZmVkZ2VzLnNwbGljZShpSGFsZmVkZ2UsMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIC8vIHJoaWxsIDIwMTEtMDUtMjY6IEkgdHJpZWQgdG8gdXNlIGEgYmluYXJ5IHNlYXJjaCBhdCBpbnNlcnRpb25cbiAgICAvLyB0aW1lIHRvIGtlZXAgdGhlIGFycmF5IHNvcnRlZCBvbi10aGUtZmx5IChpbiBDZWxsLmFkZEhhbGZlZGdlKCkpLlxuICAgIC8vIFRoZXJlIHdhcyBubyByZWFsIGJlbmVmaXRzIGluIGRvaW5nIHNvLCBwZXJmb3JtYW5jZSBvblxuICAgIC8vIEZpcmVmb3ggMy42IHdhcyBpbXByb3ZlZCBtYXJnaW5hbGx5LCB3aGlsZSBwZXJmb3JtYW5jZSBvblxuICAgIC8vIE9wZXJhIDExIHdhcyBwZW5hbGl6ZWQgbWFyZ2luYWxseS5cbiAgICBoYWxmZWRnZXMuc29ydChmdW5jdGlvbihhLGIpe3JldHVybiBiLmFuZ2xlLWEuYW5nbGU7fSk7XG4gICAgcmV0dXJuIGhhbGZlZGdlcy5sZW5ndGg7XG4gICAgfTtcblxuLy8gUmV0dXJuIGEgbGlzdCBvZiB0aGUgbmVpZ2hib3IgSWRzXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsLnByb3RvdHlwZS5nZXROZWlnaGJvcklkcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBuZWlnaGJvcnMgPSBbXSxcbiAgICAgICAgaUhhbGZlZGdlID0gdGhpcy5oYWxmZWRnZXMubGVuZ3RoLFxuICAgICAgICBlZGdlO1xuICAgIHdoaWxlIChpSGFsZmVkZ2UtLSl7XG4gICAgICAgIGVkZ2UgPSB0aGlzLmhhbGZlZGdlc1tpSGFsZmVkZ2VdLmVkZ2U7XG4gICAgICAgIGlmIChlZGdlLmxTaXRlICE9PSBudWxsICYmIGVkZ2UubFNpdGUudm9yb25vaUlkICE9IHRoaXMuc2l0ZS52b3Jvbm9pSWQpIHtcbiAgICAgICAgICAgIG5laWdoYm9ycy5wdXNoKGVkZ2UubFNpdGUudm9yb25vaUlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZWRnZS5yU2l0ZSAhPT0gbnVsbCAmJiBlZGdlLnJTaXRlLnZvcm9ub2lJZCAhPSB0aGlzLnNpdGUudm9yb25vaUlkKXtcbiAgICAgICAgICAgIG5laWdoYm9ycy5wdXNoKGVkZ2UuclNpdGUudm9yb25vaUlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIHJldHVybiBuZWlnaGJvcnM7XG4gICAgfTtcblxuLy8gQ29tcHV0ZSBib3VuZGluZyBib3hcbi8vXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsLnByb3RvdHlwZS5nZXRCYm94ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGhhbGZlZGdlcyA9IHRoaXMuaGFsZmVkZ2VzLFxuICAgICAgICBpSGFsZmVkZ2UgPSBoYWxmZWRnZXMubGVuZ3RoLFxuICAgICAgICB4bWluID0gSW5maW5pdHksXG4gICAgICAgIHltaW4gPSBJbmZpbml0eSxcbiAgICAgICAgeG1heCA9IC1JbmZpbml0eSxcbiAgICAgICAgeW1heCA9IC1JbmZpbml0eSxcbiAgICAgICAgdiwgdngsIHZ5O1xuICAgIHdoaWxlIChpSGFsZmVkZ2UtLSkge1xuICAgICAgICB2ID0gaGFsZmVkZ2VzW2lIYWxmZWRnZV0uZ2V0U3RhcnRwb2ludCgpO1xuICAgICAgICB2eCA9IHYueDtcbiAgICAgICAgdnkgPSB2Lnk7XG4gICAgICAgIGlmICh2eCA8IHhtaW4pIHt4bWluID0gdng7fVxuICAgICAgICBpZiAodnkgPCB5bWluKSB7eW1pbiA9IHZ5O31cbiAgICAgICAgaWYgKHZ4ID4geG1heCkge3htYXggPSB2eDt9XG4gICAgICAgIGlmICh2eSA+IHltYXgpIHt5bWF4ID0gdnk7fVxuICAgICAgICAvLyB3ZSBkb250IG5lZWQgdG8gdGFrZSBpbnRvIGFjY291bnQgZW5kIHBvaW50LFxuICAgICAgICAvLyBzaW5jZSBlYWNoIGVuZCBwb2ludCBtYXRjaGVzIGEgc3RhcnQgcG9pbnRcbiAgICAgICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIHg6IHhtaW4sXG4gICAgICAgIHk6IHltaW4sXG4gICAgICAgIHdpZHRoOiB4bWF4LXhtaW4sXG4gICAgICAgIGhlaWdodDogeW1heC15bWluXG4gICAgICAgIH07XG4gICAgfTtcblxuLy8gUmV0dXJuIHdoZXRoZXIgYSBwb2ludCBpcyBpbnNpZGUsIG9uLCBvciBvdXRzaWRlIHRoZSBjZWxsOlxuLy8gICAtMTogcG9pbnQgaXMgb3V0c2lkZSB0aGUgcGVyaW1ldGVyIG9mIHRoZSBjZWxsXG4vLyAgICAwOiBwb2ludCBpcyBvbiB0aGUgcGVyaW1ldGVyIG9mIHRoZSBjZWxsXG4vLyAgICAxOiBwb2ludCBpcyBpbnNpZGUgdGhlIHBlcmltZXRlciBvZiB0aGUgY2VsbFxuLy9cblZvcm9ub2kucHJvdG90eXBlLkNlbGwucHJvdG90eXBlLnBvaW50SW50ZXJzZWN0aW9uID0gZnVuY3Rpb24oeCwgeSkge1xuICAgIC8vIENoZWNrIGlmIHBvaW50IGluIHBvbHlnb24uIFNpbmNlIGFsbCBwb2x5Z29ucyBvZiBhIFZvcm9ub2lcbiAgICAvLyBkaWFncmFtIGFyZSBjb252ZXgsIHRoZW46XG4gICAgLy8gaHR0cDovL3BhdWxib3Vya2UubmV0L2dlb21ldHJ5L3BvbHlnb25tZXNoL1xuICAgIC8vIFNvbHV0aW9uIDMgKDJEKTpcbiAgICAvLyAgIFwiSWYgdGhlIHBvbHlnb24gaXMgY29udmV4IHRoZW4gb25lIGNhbiBjb25zaWRlciB0aGUgcG9seWdvblxuICAgIC8vICAgXCJhcyBhICdwYXRoJyBmcm9tIHRoZSBmaXJzdCB2ZXJ0ZXguIEEgcG9pbnQgaXMgb24gdGhlIGludGVyaW9yXG4gICAgLy8gICBcIm9mIHRoaXMgcG9seWdvbnMgaWYgaXQgaXMgYWx3YXlzIG9uIHRoZSBzYW1lIHNpZGUgb2YgYWxsIHRoZVxuICAgIC8vICAgXCJsaW5lIHNlZ21lbnRzIG1ha2luZyB1cCB0aGUgcGF0aC4gLi4uXG4gICAgLy8gICBcIih5IC0geTApICh4MSAtIHgwKSAtICh4IC0geDApICh5MSAtIHkwKVxuICAgIC8vICAgXCJpZiBpdCBpcyBsZXNzIHRoYW4gMCB0aGVuIFAgaXMgdG8gdGhlIHJpZ2h0IG9mIHRoZSBsaW5lIHNlZ21lbnQsXG4gICAgLy8gICBcImlmIGdyZWF0ZXIgdGhhbiAwIGl0IGlzIHRvIHRoZSBsZWZ0LCBpZiBlcXVhbCB0byAwIHRoZW4gaXQgbGllc1xuICAgIC8vICAgXCJvbiB0aGUgbGluZSBzZWdtZW50XCJcbiAgICB2YXIgaGFsZmVkZ2VzID0gdGhpcy5oYWxmZWRnZXMsXG4gICAgICAgIGlIYWxmZWRnZSA9IGhhbGZlZGdlcy5sZW5ndGgsXG4gICAgICAgIGhhbGZlZGdlLFxuICAgICAgICBwMCwgcDEsIHI7XG4gICAgd2hpbGUgKGlIYWxmZWRnZS0tKSB7XG4gICAgICAgIGhhbGZlZGdlID0gaGFsZmVkZ2VzW2lIYWxmZWRnZV07XG4gICAgICAgIHAwID0gaGFsZmVkZ2UuZ2V0U3RhcnRwb2ludCgpO1xuICAgICAgICBwMSA9IGhhbGZlZGdlLmdldEVuZHBvaW50KCk7XG4gICAgICAgIHIgPSAoeS1wMC55KSoocDEueC1wMC54KS0oeC1wMC54KSoocDEueS1wMC55KTtcbiAgICAgICAgaWYgKCFyKSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgaWYgKHIgPiAwKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICByZXR1cm4gMTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEVkZ2UgbWV0aG9kc1xuLy9cblxuVm9yb25vaS5wcm90b3R5cGUuVmVydGV4ID0gZnVuY3Rpb24oeCwgeSkge1xuICAgIHRoaXMueCA9IHg7XG4gICAgdGhpcy55ID0geTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5FZGdlID0gZnVuY3Rpb24obFNpdGUsIHJTaXRlKSB7XG4gICAgdGhpcy5sU2l0ZSA9IGxTaXRlO1xuICAgIHRoaXMuclNpdGUgPSByU2l0ZTtcbiAgICB0aGlzLnZhID0gdGhpcy52YiA9IG51bGw7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuSGFsZmVkZ2UgPSBmdW5jdGlvbihlZGdlLCBsU2l0ZSwgclNpdGUpIHtcbiAgICB0aGlzLnNpdGUgPSBsU2l0ZTtcbiAgICB0aGlzLmVkZ2UgPSBlZGdlO1xuICAgIC8vICdhbmdsZScgaXMgYSB2YWx1ZSB0byBiZSB1c2VkIGZvciBwcm9wZXJseSBzb3J0aW5nIHRoZVxuICAgIC8vIGhhbGZzZWdtZW50cyBjb3VudGVyY2xvY2t3aXNlLiBCeSBjb252ZW50aW9uLCB3ZSB3aWxsXG4gICAgLy8gdXNlIHRoZSBhbmdsZSBvZiB0aGUgbGluZSBkZWZpbmVkIGJ5IHRoZSAnc2l0ZSB0byB0aGUgbGVmdCdcbiAgICAvLyB0byB0aGUgJ3NpdGUgdG8gdGhlIHJpZ2h0Jy5cbiAgICAvLyBIb3dldmVyLCBib3JkZXIgZWRnZXMgaGF2ZSBubyAnc2l0ZSB0byB0aGUgcmlnaHQnOiB0aHVzIHdlXG4gICAgLy8gdXNlIHRoZSBhbmdsZSBvZiBsaW5lIHBlcnBlbmRpY3VsYXIgdG8gdGhlIGhhbGZzZWdtZW50ICh0aGVcbiAgICAvLyBlZGdlIHNob3VsZCBoYXZlIGJvdGggZW5kIHBvaW50cyBkZWZpbmVkIGluIHN1Y2ggY2FzZS4pXG4gICAgaWYgKHJTaXRlKSB7XG4gICAgICAgIHRoaXMuYW5nbGUgPSBNYXRoLmF0YW4yKHJTaXRlLnktbFNpdGUueSwgclNpdGUueC1sU2l0ZS54KTtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB2YXIgdmEgPSBlZGdlLnZhLFxuICAgICAgICAgICAgdmIgPSBlZGdlLnZiO1xuICAgICAgICAvLyByaGlsbCAyMDExLTA1LTMxOiB1c2VkIHRvIGNhbGwgZ2V0U3RhcnRwb2ludCgpL2dldEVuZHBvaW50KCksXG4gICAgICAgIC8vIGJ1dCBmb3IgcGVyZm9ybWFuY2UgcHVycG9zZSwgdGhlc2UgYXJlIGV4cGFuZGVkIGluIHBsYWNlIGhlcmUuXG4gICAgICAgIHRoaXMuYW5nbGUgPSBlZGdlLmxTaXRlID09PSBsU2l0ZSA/XG4gICAgICAgICAgICBNYXRoLmF0YW4yKHZiLngtdmEueCwgdmEueS12Yi55KSA6XG4gICAgICAgICAgICBNYXRoLmF0YW4yKHZhLngtdmIueCwgdmIueS12YS55KTtcbiAgICAgICAgfVxuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmNyZWF0ZUhhbGZlZGdlID0gZnVuY3Rpb24oZWRnZSwgbFNpdGUsIHJTaXRlKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLkhhbGZlZGdlKGVkZ2UsIGxTaXRlLCByU2l0ZSk7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuSGFsZmVkZ2UucHJvdG90eXBlLmdldFN0YXJ0cG9pbnQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5lZGdlLmxTaXRlID09PSB0aGlzLnNpdGUgPyB0aGlzLmVkZ2UudmEgOiB0aGlzLmVkZ2UudmI7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuSGFsZmVkZ2UucHJvdG90eXBlLmdldEVuZHBvaW50ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZWRnZS5sU2l0ZSA9PT0gdGhpcy5zaXRlID8gdGhpcy5lZGdlLnZiIDogdGhpcy5lZGdlLnZhO1xuICAgIH07XG5cblxuXG4vLyB0aGlzIGNyZWF0ZSBhbmQgYWRkIGEgdmVydGV4IHRvIHRoZSBpbnRlcm5hbCBjb2xsZWN0aW9uXG5cblZvcm9ub2kucHJvdG90eXBlLmNyZWF0ZVZlcnRleCA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICB2YXIgdiA9IHRoaXMudmVydGV4SnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCAhdiApIHtcbiAgICAgICAgdiA9IG5ldyB0aGlzLlZlcnRleCh4LCB5KTtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB2LnggPSB4O1xuICAgICAgICB2LnkgPSB5O1xuICAgICAgICB9XG4gICAgdGhpcy52ZXJ0aWNlcy5wdXNoKHYpO1xuICAgIHJldHVybiB2O1xuICAgIH07XG5cbi8vIHRoaXMgY3JlYXRlIGFuZCBhZGQgYW4gZWRnZSB0byBpbnRlcm5hbCBjb2xsZWN0aW9uLCBhbmQgYWxzbyBjcmVhdGVcbi8vIHR3byBoYWxmZWRnZXMgd2hpY2ggYXJlIGFkZGVkIHRvIGVhY2ggc2l0ZSdzIGNvdW50ZXJjbG9ja3dpc2UgYXJyYXlcbi8vIG9mIGhhbGZlZGdlcy5cblxuVm9yb25vaS5wcm90b3R5cGUuY3JlYXRlRWRnZSA9IGZ1bmN0aW9uKGxTaXRlLCByU2l0ZSwgdmEsIHZiKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLmVkZ2VKdW5reWFyZC5wb3AoKTtcbiAgICBpZiAoICFlZGdlICkge1xuICAgICAgICBlZGdlID0gbmV3IHRoaXMuRWRnZShsU2l0ZSwgclNpdGUpO1xuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGVkZ2UubFNpdGUgPSBsU2l0ZTtcbiAgICAgICAgZWRnZS5yU2l0ZSA9IHJTaXRlO1xuICAgICAgICBlZGdlLnZhID0gZWRnZS52YiA9IG51bGw7XG4gICAgICAgIH1cblxuICAgIHRoaXMuZWRnZXMucHVzaChlZGdlKTtcbiAgICBpZiAodmEpIHtcbiAgICAgICAgdGhpcy5zZXRFZGdlU3RhcnRwb2ludChlZGdlLCBsU2l0ZSwgclNpdGUsIHZhKTtcbiAgICAgICAgfVxuICAgIGlmICh2Yikge1xuICAgICAgICB0aGlzLnNldEVkZ2VFbmRwb2ludChlZGdlLCBsU2l0ZSwgclNpdGUsIHZiKTtcbiAgICAgICAgfVxuICAgIHRoaXMuY2VsbHNbbFNpdGUudm9yb25vaUlkXS5oYWxmZWRnZXMucHVzaCh0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGxTaXRlLCByU2l0ZSkpO1xuICAgIHRoaXMuY2VsbHNbclNpdGUudm9yb25vaUlkXS5oYWxmZWRnZXMucHVzaCh0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIHJTaXRlLCBsU2l0ZSkpO1xuICAgIHJldHVybiBlZGdlO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmNyZWF0ZUJvcmRlckVkZ2UgPSBmdW5jdGlvbihsU2l0ZSwgdmEsIHZiKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLmVkZ2VKdW5reWFyZC5wb3AoKTtcbiAgICBpZiAoICFlZGdlICkge1xuICAgICAgICBlZGdlID0gbmV3IHRoaXMuRWRnZShsU2l0ZSwgbnVsbCk7XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZWRnZS5sU2l0ZSA9IGxTaXRlO1xuICAgICAgICBlZGdlLnJTaXRlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIGVkZ2UudmEgPSB2YTtcbiAgICBlZGdlLnZiID0gdmI7XG4gICAgdGhpcy5lZGdlcy5wdXNoKGVkZ2UpO1xuICAgIHJldHVybiBlZGdlO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLnNldEVkZ2VTdGFydHBvaW50ID0gZnVuY3Rpb24oZWRnZSwgbFNpdGUsIHJTaXRlLCB2ZXJ0ZXgpIHtcbiAgICBpZiAoIWVkZ2UudmEgJiYgIWVkZ2UudmIpIHtcbiAgICAgICAgZWRnZS52YSA9IHZlcnRleDtcbiAgICAgICAgZWRnZS5sU2l0ZSA9IGxTaXRlO1xuICAgICAgICBlZGdlLnJTaXRlID0gclNpdGU7XG4gICAgICAgIH1cbiAgICBlbHNlIGlmIChlZGdlLmxTaXRlID09PSByU2l0ZSkge1xuICAgICAgICBlZGdlLnZiID0gdmVydGV4O1xuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGVkZ2UudmEgPSB2ZXJ0ZXg7XG4gICAgICAgIH1cbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5zZXRFZGdlRW5kcG9pbnQgPSBmdW5jdGlvbihlZGdlLCBsU2l0ZSwgclNpdGUsIHZlcnRleCkge1xuICAgIHRoaXMuc2V0RWRnZVN0YXJ0cG9pbnQoZWRnZSwgclNpdGUsIGxTaXRlLCB2ZXJ0ZXgpO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gQmVhY2hsaW5lIG1ldGhvZHNcblxuLy8gcmhpbGwgMjAxMS0wNi0wNzogRm9yIHNvbWUgcmVhc29ucywgcGVyZm9ybWFuY2Ugc3VmZmVycyBzaWduaWZpY2FudGx5XG4vLyB3aGVuIGluc3RhbmNpYXRpbmcgYSBsaXRlcmFsIG9iamVjdCBpbnN0ZWFkIG9mIGFuIGVtcHR5IGN0b3JcblZvcm9ub2kucHJvdG90eXBlLkJlYWNoc2VjdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIH07XG5cbi8vIHJoaWxsIDIwMTEtMDYtMDI6IEEgbG90IG9mIEJlYWNoc2VjdGlvbiBpbnN0YW5jaWF0aW9uc1xuLy8gb2NjdXIgZHVyaW5nIHRoZSBjb21wdXRhdGlvbiBvZiB0aGUgVm9yb25vaSBkaWFncmFtLFxuLy8gc29tZXdoZXJlIGJldHdlZW4gdGhlIG51bWJlciBvZiBzaXRlcyBhbmQgdHdpY2UgdGhlXG4vLyBudW1iZXIgb2Ygc2l0ZXMsIHdoaWxlIHRoZSBudW1iZXIgb2YgQmVhY2hzZWN0aW9ucyBvbiB0aGVcbi8vIGJlYWNobGluZSBhdCBhbnkgZ2l2ZW4gdGltZSBpcyBjb21wYXJhdGl2ZWx5IGxvdy4gRm9yIHRoaXNcbi8vIHJlYXNvbiwgd2UgcmV1c2UgYWxyZWFkeSBjcmVhdGVkIEJlYWNoc2VjdGlvbnMsIGluIG9yZGVyXG4vLyB0byBhdm9pZCBuZXcgbWVtb3J5IGFsbG9jYXRpb24uIFRoaXMgcmVzdWx0ZWQgaW4gYSBtZWFzdXJhYmxlXG4vLyBwZXJmb3JtYW5jZSBnYWluLlxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jcmVhdGVCZWFjaHNlY3Rpb24gPSBmdW5jdGlvbihzaXRlKSB7XG4gICAgdmFyIGJlYWNoc2VjdGlvbiA9IHRoaXMuYmVhY2hzZWN0aW9uSnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCFiZWFjaHNlY3Rpb24pIHtcbiAgICAgICAgYmVhY2hzZWN0aW9uID0gbmV3IHRoaXMuQmVhY2hzZWN0aW9uKCk7XG4gICAgICAgIH1cbiAgICBiZWFjaHNlY3Rpb24uc2l0ZSA9IHNpdGU7XG4gICAgcmV0dXJuIGJlYWNoc2VjdGlvbjtcbiAgICB9O1xuXG4vLyBjYWxjdWxhdGUgdGhlIGxlZnQgYnJlYWsgcG9pbnQgb2YgYSBwYXJ0aWN1bGFyIGJlYWNoIHNlY3Rpb24sXG4vLyBnaXZlbiBhIHBhcnRpY3VsYXIgc3dlZXAgbGluZVxuVm9yb25vaS5wcm90b3R5cGUubGVmdEJyZWFrUG9pbnQgPSBmdW5jdGlvbihhcmMsIGRpcmVjdHJpeCkge1xuICAgIC8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUGFyYWJvbGFcbiAgICAvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1F1YWRyYXRpY19lcXVhdGlvblxuICAgIC8vIGgxID0geDEsXG4gICAgLy8gazEgPSAoeTErZGlyZWN0cml4KS8yLFxuICAgIC8vIGgyID0geDIsXG4gICAgLy8gazIgPSAoeTIrZGlyZWN0cml4KS8yLFxuICAgIC8vIHAxID0gazEtZGlyZWN0cml4LFxuICAgIC8vIGExID0gMS8oNCpwMSksXG4gICAgLy8gYjEgPSAtaDEvKDIqcDEpLFxuICAgIC8vIGMxID0gaDEqaDEvKDQqcDEpK2sxLFxuICAgIC8vIHAyID0gazItZGlyZWN0cml4LFxuICAgIC8vIGEyID0gMS8oNCpwMiksXG4gICAgLy8gYjIgPSAtaDIvKDIqcDIpLFxuICAgIC8vIGMyID0gaDIqaDIvKDQqcDIpK2syLFxuICAgIC8vIHggPSAoLShiMi1iMSkgKyBNYXRoLnNxcnQoKGIyLWIxKSooYjItYjEpIC0gNCooYTItYTEpKihjMi1jMSkpKSAvICgyKihhMi1hMSkpXG4gICAgLy8gV2hlbiB4MSBiZWNvbWUgdGhlIHgtb3JpZ2luOlxuICAgIC8vIGgxID0gMCxcbiAgICAvLyBrMSA9ICh5MStkaXJlY3RyaXgpLzIsXG4gICAgLy8gaDIgPSB4Mi14MSxcbiAgICAvLyBrMiA9ICh5MitkaXJlY3RyaXgpLzIsXG4gICAgLy8gcDEgPSBrMS1kaXJlY3RyaXgsXG4gICAgLy8gYTEgPSAxLyg0KnAxKSxcbiAgICAvLyBiMSA9IDAsXG4gICAgLy8gYzEgPSBrMSxcbiAgICAvLyBwMiA9IGsyLWRpcmVjdHJpeCxcbiAgICAvLyBhMiA9IDEvKDQqcDIpLFxuICAgIC8vIGIyID0gLWgyLygyKnAyKSxcbiAgICAvLyBjMiA9IGgyKmgyLyg0KnAyKStrMixcbiAgICAvLyB4ID0gKC1iMiArIE1hdGguc3FydChiMipiMiAtIDQqKGEyLWExKSooYzItazEpKSkgLyAoMiooYTItYTEpKSArIHgxXG5cbiAgICAvLyBjaGFuZ2UgY29kZSBiZWxvdyBhdCB5b3VyIG93biByaXNrOiBjYXJlIGhhcyBiZWVuIHRha2VuIHRvXG4gICAgLy8gcmVkdWNlIGVycm9ycyBkdWUgdG8gY29tcHV0ZXJzJyBmaW5pdGUgYXJpdGhtZXRpYyBwcmVjaXNpb24uXG4gICAgLy8gTWF5YmUgY2FuIHN0aWxsIGJlIGltcHJvdmVkLCB3aWxsIHNlZSBpZiBhbnkgbW9yZSBvZiB0aGlzXG4gICAgLy8ga2luZCBvZiBlcnJvcnMgcG9wIHVwIGFnYWluLlxuICAgIHZhciBzaXRlID0gYXJjLnNpdGUsXG4gICAgICAgIHJmb2N4ID0gc2l0ZS54LFxuICAgICAgICByZm9jeSA9IHNpdGUueSxcbiAgICAgICAgcGJ5MiA9IHJmb2N5LWRpcmVjdHJpeDtcbiAgICAvLyBwYXJhYm9sYSBpbiBkZWdlbmVyYXRlIGNhc2Ugd2hlcmUgZm9jdXMgaXMgb24gZGlyZWN0cml4XG4gICAgaWYgKCFwYnkyKSB7XG4gICAgICAgIHJldHVybiByZm9jeDtcbiAgICAgICAgfVxuICAgIHZhciBsQXJjID0gYXJjLnJiUHJldmlvdXM7XG4gICAgaWYgKCFsQXJjKSB7XG4gICAgICAgIHJldHVybiAtSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICBzaXRlID0gbEFyYy5zaXRlO1xuICAgIHZhciBsZm9jeCA9IHNpdGUueCxcbiAgICAgICAgbGZvY3kgPSBzaXRlLnksXG4gICAgICAgIHBsYnkyID0gbGZvY3ktZGlyZWN0cml4O1xuICAgIC8vIHBhcmFib2xhIGluIGRlZ2VuZXJhdGUgY2FzZSB3aGVyZSBmb2N1cyBpcyBvbiBkaXJlY3RyaXhcbiAgICBpZiAoIXBsYnkyKSB7XG4gICAgICAgIHJldHVybiBsZm9jeDtcbiAgICAgICAgfVxuICAgIHZhciBobCA9IGxmb2N4LXJmb2N4LFxuICAgICAgICBhYnkyID0gMS9wYnkyLTEvcGxieTIsXG4gICAgICAgIGIgPSBobC9wbGJ5MjtcbiAgICBpZiAoYWJ5Mikge1xuICAgICAgICByZXR1cm4gKC1iK3RoaXMuc3FydChiKmItMiphYnkyKihobCpobC8oLTIqcGxieTIpLWxmb2N5K3BsYnkyLzIrcmZvY3ktcGJ5Mi8yKSkpL2FieTIrcmZvY3g7XG4gICAgICAgIH1cbiAgICAvLyBib3RoIHBhcmFib2xhcyBoYXZlIHNhbWUgZGlzdGFuY2UgdG8gZGlyZWN0cml4LCB0aHVzIGJyZWFrIHBvaW50IGlzIG1pZHdheVxuICAgIHJldHVybiAocmZvY3grbGZvY3gpLzI7XG4gICAgfTtcblxuLy8gY2FsY3VsYXRlIHRoZSByaWdodCBicmVhayBwb2ludCBvZiBhIHBhcnRpY3VsYXIgYmVhY2ggc2VjdGlvbixcbi8vIGdpdmVuIGEgcGFydGljdWxhciBkaXJlY3RyaXhcblZvcm9ub2kucHJvdG90eXBlLnJpZ2h0QnJlYWtQb2ludCA9IGZ1bmN0aW9uKGFyYywgZGlyZWN0cml4KSB7XG4gICAgdmFyIHJBcmMgPSBhcmMucmJOZXh0O1xuICAgIGlmIChyQXJjKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxlZnRCcmVha1BvaW50KHJBcmMsIGRpcmVjdHJpeCk7XG4gICAgICAgIH1cbiAgICB2YXIgc2l0ZSA9IGFyYy5zaXRlO1xuICAgIHJldHVybiBzaXRlLnkgPT09IGRpcmVjdHJpeCA/IHNpdGUueCA6IEluZmluaXR5O1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmRldGFjaEJlYWNoc2VjdGlvbiA9IGZ1bmN0aW9uKGJlYWNoc2VjdGlvbikge1xuICAgIHRoaXMuZGV0YWNoQ2lyY2xlRXZlbnQoYmVhY2hzZWN0aW9uKTsgLy8gZGV0YWNoIHBvdGVudGlhbGx5IGF0dGFjaGVkIGNpcmNsZSBldmVudFxuICAgIHRoaXMuYmVhY2hsaW5lLnJiUmVtb3ZlTm9kZShiZWFjaHNlY3Rpb24pOyAvLyByZW1vdmUgZnJvbSBSQi10cmVlXG4gICAgdGhpcy5iZWFjaHNlY3Rpb25KdW5reWFyZC5wdXNoKGJlYWNoc2VjdGlvbik7IC8vIG1hcmsgZm9yIHJldXNlXG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUucmVtb3ZlQmVhY2hzZWN0aW9uID0gZnVuY3Rpb24oYmVhY2hzZWN0aW9uKSB7XG4gICAgdmFyIGNpcmNsZSA9IGJlYWNoc2VjdGlvbi5jaXJjbGVFdmVudCxcbiAgICAgICAgeCA9IGNpcmNsZS54LFxuICAgICAgICB5ID0gY2lyY2xlLnljZW50ZXIsXG4gICAgICAgIHZlcnRleCA9IHRoaXMuY3JlYXRlVmVydGV4KHgsIHkpLFxuICAgICAgICBwcmV2aW91cyA9IGJlYWNoc2VjdGlvbi5yYlByZXZpb3VzLFxuICAgICAgICBuZXh0ID0gYmVhY2hzZWN0aW9uLnJiTmV4dCxcbiAgICAgICAgZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnMgPSBbYmVhY2hzZWN0aW9uXSxcbiAgICAgICAgYWJzX2ZuID0gTWF0aC5hYnM7XG5cbiAgICAvLyByZW1vdmUgY29sbGFwc2VkIGJlYWNoc2VjdGlvbiBmcm9tIGJlYWNobGluZVxuICAgIHRoaXMuZGV0YWNoQmVhY2hzZWN0aW9uKGJlYWNoc2VjdGlvbik7XG5cbiAgICAvLyB0aGVyZSBjb3VsZCBiZSBtb3JlIHRoYW4gb25lIGVtcHR5IGFyYyBhdCB0aGUgZGVsZXRpb24gcG9pbnQsIHRoaXNcbiAgICAvLyBoYXBwZW5zIHdoZW4gbW9yZSB0aGFuIHR3byBlZGdlcyBhcmUgbGlua2VkIGJ5IHRoZSBzYW1lIHZlcnRleCxcbiAgICAvLyBzbyB3ZSB3aWxsIGNvbGxlY3QgYWxsIHRob3NlIGVkZ2VzIGJ5IGxvb2tpbmcgdXAgYm90aCBzaWRlcyBvZlxuICAgIC8vIHRoZSBkZWxldGlvbiBwb2ludC5cbiAgICAvLyBieSB0aGUgd2F5LCB0aGVyZSBpcyAqYWx3YXlzKiBhIHByZWRlY2Vzc29yL3N1Y2Nlc3NvciB0byBhbnkgY29sbGFwc2VkXG4gICAgLy8gYmVhY2ggc2VjdGlvbiwgaXQncyBqdXN0IGltcG9zc2libGUgdG8gaGF2ZSBhIGNvbGxhcHNpbmcgZmlyc3QvbGFzdFxuICAgIC8vIGJlYWNoIHNlY3Rpb25zIG9uIHRoZSBiZWFjaGxpbmUsIHNpbmNlIHRoZXkgb2J2aW91c2x5IGFyZSB1bmNvbnN0cmFpbmVkXG4gICAgLy8gb24gdGhlaXIgbGVmdC9yaWdodCBzaWRlLlxuXG4gICAgLy8gbG9vayBsZWZ0XG4gICAgdmFyIGxBcmMgPSBwcmV2aW91cztcbiAgICB3aGlsZSAobEFyYy5jaXJjbGVFdmVudCAmJiBhYnNfZm4oeC1sQXJjLmNpcmNsZUV2ZW50LngpPDFlLTkgJiYgYWJzX2ZuKHktbEFyYy5jaXJjbGVFdmVudC55Y2VudGVyKTwxZS05KSB7XG4gICAgICAgIHByZXZpb3VzID0gbEFyYy5yYlByZXZpb3VzO1xuICAgICAgICBkaXNhcHBlYXJpbmdUcmFuc2l0aW9ucy51bnNoaWZ0KGxBcmMpO1xuICAgICAgICB0aGlzLmRldGFjaEJlYWNoc2VjdGlvbihsQXJjKTsgLy8gbWFyayBmb3IgcmV1c2VcbiAgICAgICAgbEFyYyA9IHByZXZpb3VzO1xuICAgICAgICB9XG4gICAgLy8gZXZlbiB0aG91Z2ggaXQgaXMgbm90IGRpc2FwcGVhcmluZywgSSB3aWxsIGFsc28gYWRkIHRoZSBiZWFjaCBzZWN0aW9uXG4gICAgLy8gaW1tZWRpYXRlbHkgdG8gdGhlIGxlZnQgb2YgdGhlIGxlZnQtbW9zdCBjb2xsYXBzZWQgYmVhY2ggc2VjdGlvbiwgZm9yXG4gICAgLy8gY29udmVuaWVuY2UsIHNpbmNlIHdlIG5lZWQgdG8gcmVmZXIgdG8gaXQgbGF0ZXIgYXMgdGhpcyBiZWFjaCBzZWN0aW9uXG4gICAgLy8gaXMgdGhlICdsZWZ0JyBzaXRlIG9mIGFuIGVkZ2UgZm9yIHdoaWNoIGEgc3RhcnQgcG9pbnQgaXMgc2V0LlxuICAgIGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zLnVuc2hpZnQobEFyYyk7XG4gICAgdGhpcy5kZXRhY2hDaXJjbGVFdmVudChsQXJjKTtcblxuICAgIC8vIGxvb2sgcmlnaHRcbiAgICB2YXIgckFyYyA9IG5leHQ7XG4gICAgd2hpbGUgKHJBcmMuY2lyY2xlRXZlbnQgJiYgYWJzX2ZuKHgtckFyYy5jaXJjbGVFdmVudC54KTwxZS05ICYmIGFic19mbih5LXJBcmMuY2lyY2xlRXZlbnQueWNlbnRlcik8MWUtOSkge1xuICAgICAgICBuZXh0ID0gckFyYy5yYk5leHQ7XG4gICAgICAgIGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zLnB1c2gockFyYyk7XG4gICAgICAgIHRoaXMuZGV0YWNoQmVhY2hzZWN0aW9uKHJBcmMpOyAvLyBtYXJrIGZvciByZXVzZVxuICAgICAgICByQXJjID0gbmV4dDtcbiAgICAgICAgfVxuICAgIC8vIHdlIGFsc28gaGF2ZSB0byBhZGQgdGhlIGJlYWNoIHNlY3Rpb24gaW1tZWRpYXRlbHkgdG8gdGhlIHJpZ2h0IG9mIHRoZVxuICAgIC8vIHJpZ2h0LW1vc3QgY29sbGFwc2VkIGJlYWNoIHNlY3Rpb24sIHNpbmNlIHRoZXJlIGlzIGFsc28gYSBkaXNhcHBlYXJpbmdcbiAgICAvLyB0cmFuc2l0aW9uIHJlcHJlc2VudGluZyBhbiBlZGdlJ3Mgc3RhcnQgcG9pbnQgb24gaXRzIGxlZnQuXG4gICAgZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnMucHVzaChyQXJjKTtcbiAgICB0aGlzLmRldGFjaENpcmNsZUV2ZW50KHJBcmMpO1xuXG4gICAgLy8gd2FsayB0aHJvdWdoIGFsbCB0aGUgZGlzYXBwZWFyaW5nIHRyYW5zaXRpb25zIGJldHdlZW4gYmVhY2ggc2VjdGlvbnMgYW5kXG4gICAgLy8gc2V0IHRoZSBzdGFydCBwb2ludCBvZiB0aGVpciAoaW1wbGllZCkgZWRnZS5cbiAgICB2YXIgbkFyY3MgPSBkaXNhcHBlYXJpbmdUcmFuc2l0aW9ucy5sZW5ndGgsXG4gICAgICAgIGlBcmM7XG4gICAgZm9yIChpQXJjPTE7IGlBcmM8bkFyY3M7IGlBcmMrKykge1xuICAgICAgICByQXJjID0gZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnNbaUFyY107XG4gICAgICAgIGxBcmMgPSBkaXNhcHBlYXJpbmdUcmFuc2l0aW9uc1tpQXJjLTFdO1xuICAgICAgICB0aGlzLnNldEVkZ2VTdGFydHBvaW50KHJBcmMuZWRnZSwgbEFyYy5zaXRlLCByQXJjLnNpdGUsIHZlcnRleCk7XG4gICAgICAgIH1cblxuICAgIC8vIGNyZWF0ZSBhIG5ldyBlZGdlIGFzIHdlIGhhdmUgbm93IGEgbmV3IHRyYW5zaXRpb24gYmV0d2VlblxuICAgIC8vIHR3byBiZWFjaCBzZWN0aW9ucyB3aGljaCB3ZXJlIHByZXZpb3VzbHkgbm90IGFkamFjZW50LlxuICAgIC8vIHNpbmNlIHRoaXMgZWRnZSBhcHBlYXJzIGFzIGEgbmV3IHZlcnRleCBpcyBkZWZpbmVkLCB0aGUgdmVydGV4XG4gICAgLy8gYWN0dWFsbHkgZGVmaW5lIGFuIGVuZCBwb2ludCBvZiB0aGUgZWRnZSAocmVsYXRpdmUgdG8gdGhlIHNpdGVcbiAgICAvLyBvbiB0aGUgbGVmdClcbiAgICBsQXJjID0gZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnNbMF07XG4gICAgckFyYyA9IGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zW25BcmNzLTFdO1xuICAgIHJBcmMuZWRnZSA9IHRoaXMuY3JlYXRlRWRnZShsQXJjLnNpdGUsIHJBcmMuc2l0ZSwgdW5kZWZpbmVkLCB2ZXJ0ZXgpO1xuXG4gICAgLy8gY3JlYXRlIGNpcmNsZSBldmVudHMgaWYgYW55IGZvciBiZWFjaCBzZWN0aW9ucyBsZWZ0IGluIHRoZSBiZWFjaGxpbmVcbiAgICAvLyBhZGphY2VudCB0byBjb2xsYXBzZWQgc2VjdGlvbnNcbiAgICB0aGlzLmF0dGFjaENpcmNsZUV2ZW50KGxBcmMpO1xuICAgIHRoaXMuYXR0YWNoQ2lyY2xlRXZlbnQockFyYyk7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuYWRkQmVhY2hzZWN0aW9uID0gZnVuY3Rpb24oc2l0ZSkge1xuICAgIHZhciB4ID0gc2l0ZS54LFxuICAgICAgICBkaXJlY3RyaXggPSBzaXRlLnk7XG5cbiAgICAvLyBmaW5kIHRoZSBsZWZ0IGFuZCByaWdodCBiZWFjaCBzZWN0aW9ucyB3aGljaCB3aWxsIHN1cnJvdW5kIHRoZSBuZXdseVxuICAgIC8vIGNyZWF0ZWQgYmVhY2ggc2VjdGlvbi5cbiAgICAvLyByaGlsbCAyMDExLTA2LTAxOiBUaGlzIGxvb3AgaXMgb25lIG9mIHRoZSBtb3N0IG9mdGVuIGV4ZWN1dGVkLFxuICAgIC8vIGhlbmNlIHdlIGV4cGFuZCBpbi1wbGFjZSB0aGUgY29tcGFyaXNvbi1hZ2FpbnN0LWVwc2lsb24gY2FsbHMuXG4gICAgdmFyIGxBcmMsIHJBcmMsXG4gICAgICAgIGR4bCwgZHhyLFxuICAgICAgICBub2RlID0gdGhpcy5iZWFjaGxpbmUucm9vdDtcblxuICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgIGR4bCA9IHRoaXMubGVmdEJyZWFrUG9pbnQobm9kZSxkaXJlY3RyaXgpLXg7XG4gICAgICAgIC8vIHggbGVzc1RoYW5XaXRoRXBzaWxvbiB4bCA9PiBmYWxscyBzb21ld2hlcmUgYmVmb3JlIHRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIGJlYWNoc2VjdGlvblxuICAgICAgICBpZiAoZHhsID4gMWUtOSkge1xuICAgICAgICAgICAgLy8gdGhpcyBjYXNlIHNob3VsZCBuZXZlciBoYXBwZW5cbiAgICAgICAgICAgIC8vIGlmICghbm9kZS5yYkxlZnQpIHtcbiAgICAgICAgICAgIC8vICAgIHJBcmMgPSBub2RlLnJiTGVmdDtcbiAgICAgICAgICAgIC8vICAgIGJyZWFrO1xuICAgICAgICAgICAgLy8gICAgfVxuICAgICAgICAgICAgbm9kZSA9IG5vZGUucmJMZWZ0O1xuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGR4ciA9IHgtdGhpcy5yaWdodEJyZWFrUG9pbnQobm9kZSxkaXJlY3RyaXgpO1xuICAgICAgICAgICAgLy8geCBncmVhdGVyVGhhbldpdGhFcHNpbG9uIHhyID0+IGZhbGxzIHNvbWV3aGVyZSBhZnRlciB0aGUgcmlnaHQgZWRnZSBvZiB0aGUgYmVhY2hzZWN0aW9uXG4gICAgICAgICAgICBpZiAoZHhyID4gMWUtOSkge1xuICAgICAgICAgICAgICAgIGlmICghbm9kZS5yYlJpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgIGxBcmMgPSBub2RlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLnJiUmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8geCBlcXVhbFdpdGhFcHNpbG9uIHhsID0+IGZhbGxzIGV4YWN0bHkgb24gdGhlIGxlZnQgZWRnZSBvZiB0aGUgYmVhY2hzZWN0aW9uXG4gICAgICAgICAgICAgICAgaWYgKGR4bCA+IC0xZS05KSB7XG4gICAgICAgICAgICAgICAgICAgIGxBcmMgPSBub2RlLnJiUHJldmlvdXM7XG4gICAgICAgICAgICAgICAgICAgIHJBcmMgPSBub2RlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8geCBlcXVhbFdpdGhFcHNpbG9uIHhyID0+IGZhbGxzIGV4YWN0bHkgb24gdGhlIHJpZ2h0IGVkZ2Ugb2YgdGhlIGJlYWNoc2VjdGlvblxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGR4ciA+IC0xZS05KSB7XG4gICAgICAgICAgICAgICAgICAgIGxBcmMgPSBub2RlO1xuICAgICAgICAgICAgICAgICAgICByQXJjID0gbm9kZS5yYk5leHQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBmYWxscyBleGFjdGx5IHNvbWV3aGVyZSBpbiB0aGUgbWlkZGxlIG9mIHRoZSBiZWFjaHNlY3Rpb25cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbEFyYyA9IHJBcmMgPSBub2RlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgLy8gYXQgdGhpcyBwb2ludCwga2VlcCBpbiBtaW5kIHRoYXQgbEFyYyBhbmQvb3IgckFyYyBjb3VsZCBiZVxuICAgIC8vIHVuZGVmaW5lZCBvciBudWxsLlxuXG4gICAgLy8gY3JlYXRlIGEgbmV3IGJlYWNoIHNlY3Rpb24gb2JqZWN0IGZvciB0aGUgc2l0ZSBhbmQgYWRkIGl0IHRvIFJCLXRyZWVcbiAgICB2YXIgbmV3QXJjID0gdGhpcy5jcmVhdGVCZWFjaHNlY3Rpb24oc2l0ZSk7XG4gICAgdGhpcy5iZWFjaGxpbmUucmJJbnNlcnRTdWNjZXNzb3IobEFyYywgbmV3QXJjKTtcblxuICAgIC8vIGNhc2VzOlxuICAgIC8vXG5cbiAgICAvLyBbbnVsbCxudWxsXVxuICAgIC8vIGxlYXN0IGxpa2VseSBjYXNlOiBuZXcgYmVhY2ggc2VjdGlvbiBpcyB0aGUgZmlyc3QgYmVhY2ggc2VjdGlvbiBvbiB0aGVcbiAgICAvLyBiZWFjaGxpbmUuXG4gICAgLy8gVGhpcyBjYXNlIG1lYW5zOlxuICAgIC8vICAgbm8gbmV3IHRyYW5zaXRpb24gYXBwZWFyc1xuICAgIC8vICAgbm8gY29sbGFwc2luZyBiZWFjaCBzZWN0aW9uXG4gICAgLy8gICBuZXcgYmVhY2hzZWN0aW9uIGJlY29tZSByb290IG9mIHRoZSBSQi10cmVlXG4gICAgaWYgKCFsQXJjICYmICFyQXJjKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgLy8gW2xBcmMsckFyY10gd2hlcmUgbEFyYyA9PSByQXJjXG4gICAgLy8gbW9zdCBsaWtlbHkgY2FzZTogbmV3IGJlYWNoIHNlY3Rpb24gc3BsaXQgYW4gZXhpc3RpbmcgYmVhY2hcbiAgICAvLyBzZWN0aW9uLlxuICAgIC8vIFRoaXMgY2FzZSBtZWFuczpcbiAgICAvLyAgIG9uZSBuZXcgdHJhbnNpdGlvbiBhcHBlYXJzXG4gICAgLy8gICB0aGUgbGVmdCBhbmQgcmlnaHQgYmVhY2ggc2VjdGlvbiBtaWdodCBiZSBjb2xsYXBzaW5nIGFzIGEgcmVzdWx0XG4gICAgLy8gICB0d28gbmV3IG5vZGVzIGFkZGVkIHRvIHRoZSBSQi10cmVlXG4gICAgaWYgKGxBcmMgPT09IHJBcmMpIHtcbiAgICAgICAgLy8gaW52YWxpZGF0ZSBjaXJjbGUgZXZlbnQgb2Ygc3BsaXQgYmVhY2ggc2VjdGlvblxuICAgICAgICB0aGlzLmRldGFjaENpcmNsZUV2ZW50KGxBcmMpO1xuXG4gICAgICAgIC8vIHNwbGl0IHRoZSBiZWFjaCBzZWN0aW9uIGludG8gdHdvIHNlcGFyYXRlIGJlYWNoIHNlY3Rpb25zXG4gICAgICAgIHJBcmMgPSB0aGlzLmNyZWF0ZUJlYWNoc2VjdGlvbihsQXJjLnNpdGUpO1xuICAgICAgICB0aGlzLmJlYWNobGluZS5yYkluc2VydFN1Y2Nlc3NvcihuZXdBcmMsIHJBcmMpO1xuXG4gICAgICAgIC8vIHNpbmNlIHdlIGhhdmUgYSBuZXcgdHJhbnNpdGlvbiBiZXR3ZWVuIHR3byBiZWFjaCBzZWN0aW9ucyxcbiAgICAgICAgLy8gYSBuZXcgZWRnZSBpcyBib3JuXG4gICAgICAgIG5ld0FyYy5lZGdlID0gckFyYy5lZGdlID0gdGhpcy5jcmVhdGVFZGdlKGxBcmMuc2l0ZSwgbmV3QXJjLnNpdGUpO1xuXG4gICAgICAgIC8vIGNoZWNrIHdoZXRoZXIgdGhlIGxlZnQgYW5kIHJpZ2h0IGJlYWNoIHNlY3Rpb25zIGFyZSBjb2xsYXBzaW5nXG4gICAgICAgIC8vIGFuZCBpZiBzbyBjcmVhdGUgY2lyY2xlIGV2ZW50cywgdG8gYmUgbm90aWZpZWQgd2hlbiB0aGUgcG9pbnQgb2ZcbiAgICAgICAgLy8gY29sbGFwc2UgaXMgcmVhY2hlZC5cbiAgICAgICAgdGhpcy5hdHRhY2hDaXJjbGVFdmVudChsQXJjKTtcbiAgICAgICAgdGhpcy5hdHRhY2hDaXJjbGVFdmVudChyQXJjKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAvLyBbbEFyYyxudWxsXVxuICAgIC8vIGV2ZW4gbGVzcyBsaWtlbHkgY2FzZTogbmV3IGJlYWNoIHNlY3Rpb24gaXMgdGhlICpsYXN0KiBiZWFjaCBzZWN0aW9uXG4gICAgLy8gb24gdGhlIGJlYWNobGluZSAtLSB0aGlzIGNhbiBoYXBwZW4gKm9ubHkqIGlmICphbGwqIHRoZSBwcmV2aW91cyBiZWFjaFxuICAgIC8vIHNlY3Rpb25zIGN1cnJlbnRseSBvbiB0aGUgYmVhY2hsaW5lIHNoYXJlIHRoZSBzYW1lIHkgdmFsdWUgYXNcbiAgICAvLyB0aGUgbmV3IGJlYWNoIHNlY3Rpb24uXG4gICAgLy8gVGhpcyBjYXNlIG1lYW5zOlxuICAgIC8vICAgb25lIG5ldyB0cmFuc2l0aW9uIGFwcGVhcnNcbiAgICAvLyAgIG5vIGNvbGxhcHNpbmcgYmVhY2ggc2VjdGlvbiBhcyBhIHJlc3VsdFxuICAgIC8vICAgbmV3IGJlYWNoIHNlY3Rpb24gYmVjb21lIHJpZ2h0LW1vc3Qgbm9kZSBvZiB0aGUgUkItdHJlZVxuICAgIGlmIChsQXJjICYmICFyQXJjKSB7XG4gICAgICAgIG5ld0FyYy5lZGdlID0gdGhpcy5jcmVhdGVFZGdlKGxBcmMuc2l0ZSxuZXdBcmMuc2l0ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgLy8gW251bGwsckFyY11cbiAgICAvLyBpbXBvc3NpYmxlIGNhc2U6IGJlY2F1c2Ugc2l0ZXMgYXJlIHN0cmljdGx5IHByb2Nlc3NlZCBmcm9tIHRvcCB0byBib3R0b20sXG4gICAgLy8gYW5kIGxlZnQgdG8gcmlnaHQsIHdoaWNoIGd1YXJhbnRlZXMgdGhhdCB0aGVyZSB3aWxsIGFsd2F5cyBiZSBhIGJlYWNoIHNlY3Rpb25cbiAgICAvLyBvbiB0aGUgbGVmdCAtLSBleGNlcHQgb2YgY291cnNlIHdoZW4gdGhlcmUgYXJlIG5vIGJlYWNoIHNlY3Rpb24gYXQgYWxsIG9uXG4gICAgLy8gdGhlIGJlYWNoIGxpbmUsIHdoaWNoIGNhc2Ugd2FzIGhhbmRsZWQgYWJvdmUuXG4gICAgLy8gcmhpbGwgMjAxMS0wNi0wMjogTm8gcG9pbnQgdGVzdGluZyBpbiBub24tZGVidWcgdmVyc2lvblxuICAgIC8vaWYgKCFsQXJjICYmIHJBcmMpIHtcbiAgICAvLyAgICB0aHJvdyBcIlZvcm9ub2kuYWRkQmVhY2hzZWN0aW9uKCk6IFdoYXQgaXMgdGhpcyBJIGRvbid0IGV2ZW5cIjtcbiAgICAvLyAgICB9XG5cbiAgICAvLyBbbEFyYyxyQXJjXSB3aGVyZSBsQXJjICE9IHJBcmNcbiAgICAvLyBzb21ld2hhdCBsZXNzIGxpa2VseSBjYXNlOiBuZXcgYmVhY2ggc2VjdGlvbiBmYWxscyAqZXhhY3RseSogaW4gYmV0d2VlbiB0d29cbiAgICAvLyBleGlzdGluZyBiZWFjaCBzZWN0aW9uc1xuICAgIC8vIFRoaXMgY2FzZSBtZWFuczpcbiAgICAvLyAgIG9uZSB0cmFuc2l0aW9uIGRpc2FwcGVhcnNcbiAgICAvLyAgIHR3byBuZXcgdHJhbnNpdGlvbnMgYXBwZWFyXG4gICAgLy8gICB0aGUgbGVmdCBhbmQgcmlnaHQgYmVhY2ggc2VjdGlvbiBtaWdodCBiZSBjb2xsYXBzaW5nIGFzIGEgcmVzdWx0XG4gICAgLy8gICBvbmx5IG9uZSBuZXcgbm9kZSBhZGRlZCB0byB0aGUgUkItdHJlZVxuICAgIGlmIChsQXJjICE9PSByQXJjKSB7XG4gICAgICAgIC8vIGludmFsaWRhdGUgY2lyY2xlIGV2ZW50cyBvZiBsZWZ0IGFuZCByaWdodCBzaXRlc1xuICAgICAgICB0aGlzLmRldGFjaENpcmNsZUV2ZW50KGxBcmMpO1xuICAgICAgICB0aGlzLmRldGFjaENpcmNsZUV2ZW50KHJBcmMpO1xuXG4gICAgICAgIC8vIGFuIGV4aXN0aW5nIHRyYW5zaXRpb24gZGlzYXBwZWFycywgbWVhbmluZyBhIHZlcnRleCBpcyBkZWZpbmVkIGF0XG4gICAgICAgIC8vIHRoZSBkaXNhcHBlYXJhbmNlIHBvaW50LlxuICAgICAgICAvLyBzaW5jZSB0aGUgZGlzYXBwZWFyYW5jZSBpcyBjYXVzZWQgYnkgdGhlIG5ldyBiZWFjaHNlY3Rpb24sIHRoZVxuICAgICAgICAvLyB2ZXJ0ZXggaXMgYXQgdGhlIGNlbnRlciBvZiB0aGUgY2lyY3Vtc2NyaWJlZCBjaXJjbGUgb2YgdGhlIGxlZnQsXG4gICAgICAgIC8vIG5ldyBhbmQgcmlnaHQgYmVhY2hzZWN0aW9ucy5cbiAgICAgICAgLy8gaHR0cDovL21hdGhmb3J1bS5vcmcvbGlicmFyeS9kcm1hdGgvdmlldy81NTAwMi5odG1sXG4gICAgICAgIC8vIEV4Y2VwdCB0aGF0IEkgYnJpbmcgdGhlIG9yaWdpbiBhdCBBIHRvIHNpbXBsaWZ5XG4gICAgICAgIC8vIGNhbGN1bGF0aW9uXG4gICAgICAgIHZhciBsU2l0ZSA9IGxBcmMuc2l0ZSxcbiAgICAgICAgICAgIGF4ID0gbFNpdGUueCxcbiAgICAgICAgICAgIGF5ID0gbFNpdGUueSxcbiAgICAgICAgICAgIGJ4PXNpdGUueC1heCxcbiAgICAgICAgICAgIGJ5PXNpdGUueS1heSxcbiAgICAgICAgICAgIHJTaXRlID0gckFyYy5zaXRlLFxuICAgICAgICAgICAgY3g9clNpdGUueC1heCxcbiAgICAgICAgICAgIGN5PXJTaXRlLnktYXksXG4gICAgICAgICAgICBkPTIqKGJ4KmN5LWJ5KmN4KSxcbiAgICAgICAgICAgIGhiPWJ4KmJ4K2J5KmJ5LFxuICAgICAgICAgICAgaGM9Y3gqY3grY3kqY3ksXG4gICAgICAgICAgICB2ZXJ0ZXggPSB0aGlzLmNyZWF0ZVZlcnRleCgoY3kqaGItYnkqaGMpL2QrYXgsIChieCpoYy1jeCpoYikvZCtheSk7XG5cbiAgICAgICAgLy8gb25lIHRyYW5zaXRpb24gZGlzYXBwZWFyXG4gICAgICAgIHRoaXMuc2V0RWRnZVN0YXJ0cG9pbnQockFyYy5lZGdlLCBsU2l0ZSwgclNpdGUsIHZlcnRleCk7XG5cbiAgICAgICAgLy8gdHdvIG5ldyB0cmFuc2l0aW9ucyBhcHBlYXIgYXQgdGhlIG5ldyB2ZXJ0ZXggbG9jYXRpb25cbiAgICAgICAgbmV3QXJjLmVkZ2UgPSB0aGlzLmNyZWF0ZUVkZ2UobFNpdGUsIHNpdGUsIHVuZGVmaW5lZCwgdmVydGV4KTtcbiAgICAgICAgckFyYy5lZGdlID0gdGhpcy5jcmVhdGVFZGdlKHNpdGUsIHJTaXRlLCB1bmRlZmluZWQsIHZlcnRleCk7XG5cbiAgICAgICAgLy8gY2hlY2sgd2hldGhlciB0aGUgbGVmdCBhbmQgcmlnaHQgYmVhY2ggc2VjdGlvbnMgYXJlIGNvbGxhcHNpbmdcbiAgICAgICAgLy8gYW5kIGlmIHNvIGNyZWF0ZSBjaXJjbGUgZXZlbnRzLCB0byBoYW5kbGUgdGhlIHBvaW50IG9mIGNvbGxhcHNlLlxuICAgICAgICB0aGlzLmF0dGFjaENpcmNsZUV2ZW50KGxBcmMpO1xuICAgICAgICB0aGlzLmF0dGFjaENpcmNsZUV2ZW50KHJBcmMpO1xuICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIENpcmNsZSBldmVudCBtZXRob2RzXG5cbi8vIHJoaWxsIDIwMTEtMDYtMDc6IEZvciBzb21lIHJlYXNvbnMsIHBlcmZvcm1hbmNlIHN1ZmZlcnMgc2lnbmlmaWNhbnRseVxuLy8gd2hlbiBpbnN0YW5jaWF0aW5nIGEgbGl0ZXJhbCBvYmplY3QgaW5zdGVhZCBvZiBhbiBlbXB0eSBjdG9yXG5Wb3Jvbm9pLnByb3RvdHlwZS5DaXJjbGVFdmVudCA9IGZ1bmN0aW9uKCkge1xuICAgIC8vIHJoaWxsIDIwMTMtMTAtMTI6IGl0IGhlbHBzIHRvIHN0YXRlIGV4YWN0bHkgd2hhdCB3ZSBhcmUgYXQgY3RvciB0aW1lLlxuICAgIHRoaXMuYXJjID0gbnVsbDtcbiAgICB0aGlzLnJiTGVmdCA9IG51bGw7XG4gICAgdGhpcy5yYk5leHQgPSBudWxsO1xuICAgIHRoaXMucmJQYXJlbnQgPSBudWxsO1xuICAgIHRoaXMucmJQcmV2aW91cyA9IG51bGw7XG4gICAgdGhpcy5yYlJlZCA9IGZhbHNlO1xuICAgIHRoaXMucmJSaWdodCA9IG51bGw7XG4gICAgdGhpcy5zaXRlID0gbnVsbDtcbiAgICB0aGlzLnggPSB0aGlzLnkgPSB0aGlzLnljZW50ZXIgPSAwO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmF0dGFjaENpcmNsZUV2ZW50ID0gZnVuY3Rpb24oYXJjKSB7XG4gICAgdmFyIGxBcmMgPSBhcmMucmJQcmV2aW91cyxcbiAgICAgICAgckFyYyA9IGFyYy5yYk5leHQ7XG4gICAgaWYgKCFsQXJjIHx8ICFyQXJjKSB7cmV0dXJuO30gLy8gZG9lcyB0aGF0IGV2ZXIgaGFwcGVuP1xuICAgIHZhciBsU2l0ZSA9IGxBcmMuc2l0ZSxcbiAgICAgICAgY1NpdGUgPSBhcmMuc2l0ZSxcbiAgICAgICAgclNpdGUgPSByQXJjLnNpdGU7XG5cbiAgICAvLyBJZiBzaXRlIG9mIGxlZnQgYmVhY2hzZWN0aW9uIGlzIHNhbWUgYXMgc2l0ZSBvZlxuICAgIC8vIHJpZ2h0IGJlYWNoc2VjdGlvbiwgdGhlcmUgY2FuJ3QgYmUgY29udmVyZ2VuY2VcbiAgICBpZiAobFNpdGU9PT1yU2l0ZSkge3JldHVybjt9XG5cbiAgICAvLyBGaW5kIHRoZSBjaXJjdW1zY3JpYmVkIGNpcmNsZSBmb3IgdGhlIHRocmVlIHNpdGVzIGFzc29jaWF0ZWRcbiAgICAvLyB3aXRoIHRoZSBiZWFjaHNlY3Rpb24gdHJpcGxldC5cbiAgICAvLyByaGlsbCAyMDExLTA1LTI2OiBJdCBpcyBtb3JlIGVmZmljaWVudCB0byBjYWxjdWxhdGUgaW4tcGxhY2VcbiAgICAvLyByYXRoZXIgdGhhbiBnZXR0aW5nIHRoZSByZXN1bHRpbmcgY2lyY3Vtc2NyaWJlZCBjaXJjbGUgZnJvbSBhblxuICAgIC8vIG9iamVjdCByZXR1cm5lZCBieSBjYWxsaW5nIFZvcm9ub2kuY2lyY3VtY2lyY2xlKClcbiAgICAvLyBodHRwOi8vbWF0aGZvcnVtLm9yZy9saWJyYXJ5L2RybWF0aC92aWV3LzU1MDAyLmh0bWxcbiAgICAvLyBFeGNlcHQgdGhhdCBJIGJyaW5nIHRoZSBvcmlnaW4gYXQgY1NpdGUgdG8gc2ltcGxpZnkgY2FsY3VsYXRpb25zLlxuICAgIC8vIFRoZSBib3R0b20tbW9zdCBwYXJ0IG9mIHRoZSBjaXJjdW1jaXJjbGUgaXMgb3VyIEZvcnR1bmUgJ2NpcmNsZVxuICAgIC8vIGV2ZW50JywgYW5kIGl0cyBjZW50ZXIgaXMgYSB2ZXJ0ZXggcG90ZW50aWFsbHkgcGFydCBvZiB0aGUgZmluYWxcbiAgICAvLyBWb3Jvbm9pIGRpYWdyYW0uXG4gICAgdmFyIGJ4ID0gY1NpdGUueCxcbiAgICAgICAgYnkgPSBjU2l0ZS55LFxuICAgICAgICBheCA9IGxTaXRlLngtYngsXG4gICAgICAgIGF5ID0gbFNpdGUueS1ieSxcbiAgICAgICAgY3ggPSByU2l0ZS54LWJ4LFxuICAgICAgICBjeSA9IHJTaXRlLnktYnk7XG5cbiAgICAvLyBJZiBwb2ludHMgbC0+Yy0+ciBhcmUgY2xvY2t3aXNlLCB0aGVuIGNlbnRlciBiZWFjaCBzZWN0aW9uIGRvZXMgbm90XG4gICAgLy8gY29sbGFwc2UsIGhlbmNlIGl0IGNhbid0IGVuZCB1cCBhcyBhIHZlcnRleCAod2UgcmV1c2UgJ2QnIGhlcmUsIHdoaWNoXG4gICAgLy8gc2lnbiBpcyByZXZlcnNlIG9mIHRoZSBvcmllbnRhdGlvbiwgaGVuY2Ugd2UgcmV2ZXJzZSB0aGUgdGVzdC5cbiAgICAvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0N1cnZlX29yaWVudGF0aW9uI09yaWVudGF0aW9uX29mX2Ffc2ltcGxlX3BvbHlnb25cbiAgICAvLyByaGlsbCAyMDExLTA1LTIxOiBOYXN0eSBmaW5pdGUgcHJlY2lzaW9uIGVycm9yIHdoaWNoIGNhdXNlZCBjaXJjdW1jaXJjbGUoKSB0b1xuICAgIC8vIHJldHVybiBpbmZpbml0ZXM6IDFlLTEyIHNlZW1zIHRvIGZpeCB0aGUgcHJvYmxlbS5cbiAgICB2YXIgZCA9IDIqKGF4KmN5LWF5KmN4KTtcbiAgICBpZiAoZCA+PSAtMmUtMTIpe3JldHVybjt9XG5cbiAgICB2YXIgaGEgPSBheCpheCtheSpheSxcbiAgICAgICAgaGMgPSBjeCpjeCtjeSpjeSxcbiAgICAgICAgeCA9IChjeSpoYS1heSpoYykvZCxcbiAgICAgICAgeSA9IChheCpoYy1jeCpoYSkvZCxcbiAgICAgICAgeWNlbnRlciA9IHkrYnk7XG5cbiAgICAvLyBJbXBvcnRhbnQ6IHlib3R0b20gc2hvdWxkIGFsd2F5cyBiZSB1bmRlciBvciBhdCBzd2VlcCwgc28gbm8gbmVlZFxuICAgIC8vIHRvIHdhc3RlIENQVSBjeWNsZXMgYnkgY2hlY2tpbmdcblxuICAgIC8vIHJlY3ljbGUgY2lyY2xlIGV2ZW50IG9iamVjdCBpZiBwb3NzaWJsZVxuICAgIHZhciBjaXJjbGVFdmVudCA9IHRoaXMuY2lyY2xlRXZlbnRKdW5reWFyZC5wb3AoKTtcbiAgICBpZiAoIWNpcmNsZUV2ZW50KSB7XG4gICAgICAgIGNpcmNsZUV2ZW50ID0gbmV3IHRoaXMuQ2lyY2xlRXZlbnQoKTtcbiAgICAgICAgfVxuICAgIGNpcmNsZUV2ZW50LmFyYyA9IGFyYztcbiAgICBjaXJjbGVFdmVudC5zaXRlID0gY1NpdGU7XG4gICAgY2lyY2xlRXZlbnQueCA9IHgrYng7XG4gICAgY2lyY2xlRXZlbnQueSA9IHljZW50ZXIrdGhpcy5zcXJ0KHgqeCt5KnkpOyAvLyB5IGJvdHRvbVxuICAgIGNpcmNsZUV2ZW50LnljZW50ZXIgPSB5Y2VudGVyO1xuICAgIGFyYy5jaXJjbGVFdmVudCA9IGNpcmNsZUV2ZW50O1xuXG4gICAgLy8gZmluZCBpbnNlcnRpb24gcG9pbnQgaW4gUkItdHJlZTogY2lyY2xlIGV2ZW50cyBhcmUgb3JkZXJlZCBmcm9tXG4gICAgLy8gc21hbGxlc3QgdG8gbGFyZ2VzdFxuICAgIHZhciBwcmVkZWNlc3NvciA9IG51bGwsXG4gICAgICAgIG5vZGUgPSB0aGlzLmNpcmNsZUV2ZW50cy5yb290O1xuICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgIGlmIChjaXJjbGVFdmVudC55IDwgbm9kZS55IHx8IChjaXJjbGVFdmVudC55ID09PSBub2RlLnkgJiYgY2lyY2xlRXZlbnQueCA8PSBub2RlLngpKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5yYkxlZnQpIHtcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5yYkxlZnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcHJlZGVjZXNzb3IgPSBub2RlLnJiUHJldmlvdXM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChub2RlLnJiUmlnaHQpIHtcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5yYlJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHByZWRlY2Vzc29yID0gbm9kZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB0aGlzLmNpcmNsZUV2ZW50cy5yYkluc2VydFN1Y2Nlc3NvcihwcmVkZWNlc3NvciwgY2lyY2xlRXZlbnQpO1xuICAgIGlmICghcHJlZGVjZXNzb3IpIHtcbiAgICAgICAgdGhpcy5maXJzdENpcmNsZUV2ZW50ID0gY2lyY2xlRXZlbnQ7XG4gICAgICAgIH1cbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5kZXRhY2hDaXJjbGVFdmVudCA9IGZ1bmN0aW9uKGFyYykge1xuICAgIHZhciBjaXJjbGVFdmVudCA9IGFyYy5jaXJjbGVFdmVudDtcbiAgICBpZiAoY2lyY2xlRXZlbnQpIHtcbiAgICAgICAgaWYgKCFjaXJjbGVFdmVudC5yYlByZXZpb3VzKSB7XG4gICAgICAgICAgICB0aGlzLmZpcnN0Q2lyY2xlRXZlbnQgPSBjaXJjbGVFdmVudC5yYk5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIHRoaXMuY2lyY2xlRXZlbnRzLnJiUmVtb3ZlTm9kZShjaXJjbGVFdmVudCk7IC8vIHJlbW92ZSBmcm9tIFJCLXRyZWVcbiAgICAgICAgdGhpcy5jaXJjbGVFdmVudEp1bmt5YXJkLnB1c2goY2lyY2xlRXZlbnQpO1xuICAgICAgICBhcmMuY2lyY2xlRXZlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBEaWFncmFtIGNvbXBsZXRpb24gbWV0aG9kc1xuXG4vLyBjb25uZWN0IGRhbmdsaW5nIGVkZ2VzIChub3QgaWYgYSBjdXJzb3J5IHRlc3QgdGVsbHMgdXNcbi8vIGl0IGlzIG5vdCBnb2luZyB0byBiZSB2aXNpYmxlLlxuLy8gcmV0dXJuIHZhbHVlOlxuLy8gICBmYWxzZTogdGhlIGRhbmdsaW5nIGVuZHBvaW50IGNvdWxkbid0IGJlIGNvbm5lY3RlZFxuLy8gICB0cnVlOiB0aGUgZGFuZ2xpbmcgZW5kcG9pbnQgY291bGQgYmUgY29ubmVjdGVkXG5Wb3Jvbm9pLnByb3RvdHlwZS5jb25uZWN0RWRnZSA9IGZ1bmN0aW9uKGVkZ2UsIGJib3gpIHtcbiAgICAvLyBza2lwIGlmIGVuZCBwb2ludCBhbHJlYWR5IGNvbm5lY3RlZFxuICAgIHZhciB2YiA9IGVkZ2UudmI7XG4gICAgaWYgKCEhdmIpIHtyZXR1cm4gdHJ1ZTt9XG5cbiAgICAvLyBtYWtlIGxvY2FsIGNvcHkgZm9yIHBlcmZvcm1hbmNlIHB1cnBvc2VcbiAgICB2YXIgdmEgPSBlZGdlLnZhLFxuICAgICAgICB4bCA9IGJib3gueGwsXG4gICAgICAgIHhyID0gYmJveC54cixcbiAgICAgICAgeXQgPSBiYm94Lnl0LFxuICAgICAgICB5YiA9IGJib3gueWIsXG4gICAgICAgIGxTaXRlID0gZWRnZS5sU2l0ZSxcbiAgICAgICAgclNpdGUgPSBlZGdlLnJTaXRlLFxuICAgICAgICBseCA9IGxTaXRlLngsXG4gICAgICAgIGx5ID0gbFNpdGUueSxcbiAgICAgICAgcnggPSByU2l0ZS54LFxuICAgICAgICByeSA9IHJTaXRlLnksXG4gICAgICAgIGZ4ID0gKGx4K3J4KS8yLFxuICAgICAgICBmeSA9IChseStyeSkvMixcbiAgICAgICAgZm0sIGZiO1xuXG4gICAgLy8gaWYgd2UgcmVhY2ggaGVyZSwgdGhpcyBtZWFucyBjZWxscyB3aGljaCB1c2UgdGhpcyBlZGdlIHdpbGwgbmVlZFxuICAgIC8vIHRvIGJlIGNsb3NlZCwgd2hldGhlciBiZWNhdXNlIHRoZSBlZGdlIHdhcyByZW1vdmVkLCBvciBiZWNhdXNlIGl0XG4gICAgLy8gd2FzIGNvbm5lY3RlZCB0byB0aGUgYm91bmRpbmcgYm94LlxuICAgIHRoaXMuY2VsbHNbbFNpdGUudm9yb25vaUlkXS5jbG9zZU1lID0gdHJ1ZTtcbiAgICB0aGlzLmNlbGxzW3JTaXRlLnZvcm9ub2lJZF0uY2xvc2VNZSA9IHRydWU7XG5cbiAgICAvLyBnZXQgdGhlIGxpbmUgZXF1YXRpb24gb2YgdGhlIGJpc2VjdG9yIGlmIGxpbmUgaXMgbm90IHZlcnRpY2FsXG4gICAgaWYgKHJ5ICE9PSBseSkge1xuICAgICAgICBmbSA9IChseC1yeCkvKHJ5LWx5KTtcbiAgICAgICAgZmIgPSBmeS1mbSpmeDtcbiAgICAgICAgfVxuXG4gICAgLy8gcmVtZW1iZXIsIGRpcmVjdGlvbiBvZiBsaW5lIChyZWxhdGl2ZSB0byBsZWZ0IHNpdGUpOlxuICAgIC8vIHVwd2FyZDogbGVmdC54IDwgcmlnaHQueFxuICAgIC8vIGRvd253YXJkOiBsZWZ0LnggPiByaWdodC54XG4gICAgLy8gaG9yaXpvbnRhbDogbGVmdC54ID09IHJpZ2h0LnhcbiAgICAvLyB1cHdhcmQ6IGxlZnQueCA8IHJpZ2h0LnhcbiAgICAvLyByaWdodHdhcmQ6IGxlZnQueSA8IHJpZ2h0LnlcbiAgICAvLyBsZWZ0d2FyZDogbGVmdC55ID4gcmlnaHQueVxuICAgIC8vIHZlcnRpY2FsOiBsZWZ0LnkgPT0gcmlnaHQueVxuXG4gICAgLy8gZGVwZW5kaW5nIG9uIHRoZSBkaXJlY3Rpb24sIGZpbmQgdGhlIGJlc3Qgc2lkZSBvZiB0aGVcbiAgICAvLyBib3VuZGluZyBib3ggdG8gdXNlIHRvIGRldGVybWluZSBhIHJlYXNvbmFibGUgc3RhcnQgcG9pbnRcblxuICAgIC8vIHJoaWxsIDIwMTMtMTItMDI6XG4gICAgLy8gV2hpbGUgYXQgaXQsIHNpbmNlIHdlIGhhdmUgdGhlIHZhbHVlcyB3aGljaCBkZWZpbmUgdGhlIGxpbmUsXG4gICAgLy8gY2xpcCB0aGUgZW5kIG9mIHZhIGlmIGl0IGlzIG91dHNpZGUgdGhlIGJib3guXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pL2lzc3Vlcy8xNVxuICAgIC8vIFRPRE86IERvIGFsbCB0aGUgY2xpcHBpbmcgaGVyZSByYXRoZXIgdGhhbiByZWx5IG9uIExpYW5nLUJhcnNreVxuICAgIC8vIHdoaWNoIGRvZXMgbm90IGRvIHdlbGwgc29tZXRpbWVzIGR1ZSB0byBsb3NzIG9mIGFyaXRobWV0aWNcbiAgICAvLyBwcmVjaXNpb24uIFRoZSBjb2RlIGhlcmUgZG9lc24ndCBkZWdyYWRlIGlmIG9uZSBvZiB0aGUgdmVydGV4IGlzXG4gICAgLy8gYXQgYSBodWdlIGRpc3RhbmNlLlxuXG4gICAgLy8gc3BlY2lhbCBjYXNlOiB2ZXJ0aWNhbCBsaW5lXG4gICAgaWYgKGZtID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gZG9lc24ndCBpbnRlcnNlY3Qgd2l0aCB2aWV3cG9ydFxuICAgICAgICBpZiAoZnggPCB4bCB8fCBmeCA+PSB4cikge3JldHVybiBmYWxzZTt9XG4gICAgICAgIC8vIGRvd253YXJkXG4gICAgICAgIGlmIChseCA+IHJ4KSB7XG4gICAgICAgICAgICBpZiAoIXZhIHx8IHZhLnkgPCB5dCkge1xuICAgICAgICAgICAgICAgIHZhID0gdGhpcy5jcmVhdGVWZXJ0ZXgoZngsIHl0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh2YS55ID49IHliKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoZngsIHliKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgLy8gdXB3YXJkXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS55ID4geWIpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KGZ4LCB5Yik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmEueSA8IHl0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoZngsIHl0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIC8vIGNsb3NlciB0byB2ZXJ0aWNhbCB0aGFuIGhvcml6b250YWwsIGNvbm5lY3Qgc3RhcnQgcG9pbnQgdG8gdGhlXG4gICAgLy8gdG9wIG9yIGJvdHRvbSBzaWRlIG9mIHRoZSBib3VuZGluZyBib3hcbiAgICBlbHNlIGlmIChmbSA8IC0xIHx8IGZtID4gMSkge1xuICAgICAgICAvLyBkb3dud2FyZFxuICAgICAgICBpZiAobHggPiByeCkge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS55IDwgeXQpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KCh5dC1mYikvZm0sIHl0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh2YS55ID49IHliKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoKHliLWZiKS9mbSwgeWIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAvLyB1cHdhcmRcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoIXZhIHx8IHZhLnkgPiB5Yikge1xuICAgICAgICAgICAgICAgIHZhID0gdGhpcy5jcmVhdGVWZXJ0ZXgoKHliLWZiKS9mbSwgeWIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHZhLnkgPCB5dCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KCh5dC1mYikvZm0sIHl0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIC8vIGNsb3NlciB0byBob3Jpem9udGFsIHRoYW4gdmVydGljYWwsIGNvbm5lY3Qgc3RhcnQgcG9pbnQgdG8gdGhlXG4gICAgLy8gbGVmdCBvciByaWdodCBzaWRlIG9mIHRoZSBib3VuZGluZyBib3hcbiAgICBlbHNlIHtcbiAgICAgICAgLy8gcmlnaHR3YXJkXG4gICAgICAgIGlmIChseSA8IHJ5KSB7XG4gICAgICAgICAgICBpZiAoIXZhIHx8IHZhLnggPCB4bCkge1xuICAgICAgICAgICAgICAgIHZhID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeGwsIGZtKnhsK2ZiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh2YS54ID49IHhyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeHIsIGZtKnhyK2ZiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgLy8gbGVmdHdhcmRcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoIXZhIHx8IHZhLnggPiB4cikge1xuICAgICAgICAgICAgICAgIHZhID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeHIsIGZtKnhyK2ZiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh2YS54IDwgeGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmIgPSB0aGlzLmNyZWF0ZVZlcnRleCh4bCwgZm0qeGwrZmIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgZWRnZS52YSA9IHZhO1xuICAgIGVkZ2UudmIgPSB2YjtcblxuICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbi8vIGxpbmUtY2xpcHBpbmcgY29kZSB0YWtlbiBmcm9tOlxuLy8gICBMaWFuZy1CYXJza3kgZnVuY3Rpb24gYnkgRGFuaWVsIFdoaXRlXG4vLyAgIGh0dHA6Ly93d3cuc2t5dG9waWEuY29tL3Byb2plY3QvYXJ0aWNsZXMvY29tcHNjaS9jbGlwcGluZy5odG1sXG4vLyBUaGFua3MhXG4vLyBBIGJpdCBtb2RpZmllZCB0byBtaW5pbWl6ZSBjb2RlIHBhdGhzXG5Wb3Jvbm9pLnByb3RvdHlwZS5jbGlwRWRnZSA9IGZ1bmN0aW9uKGVkZ2UsIGJib3gpIHtcbiAgICB2YXIgYXggPSBlZGdlLnZhLngsXG4gICAgICAgIGF5ID0gZWRnZS52YS55LFxuICAgICAgICBieCA9IGVkZ2UudmIueCxcbiAgICAgICAgYnkgPSBlZGdlLnZiLnksXG4gICAgICAgIHQwID0gMCxcbiAgICAgICAgdDEgPSAxLFxuICAgICAgICBkeCA9IGJ4LWF4LFxuICAgICAgICBkeSA9IGJ5LWF5O1xuICAgIC8vIGxlZnRcbiAgICB2YXIgcSA9IGF4LWJib3gueGw7XG4gICAgaWYgKGR4PT09MCAmJiBxPDApIHtyZXR1cm4gZmFsc2U7fVxuICAgIHZhciByID0gLXEvZHg7XG4gICAgaWYgKGR4PDApIHtcbiAgICAgICAgaWYgKHI8dDApIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocjx0MSkge3QxPXI7fVxuICAgICAgICB9XG4gICAgZWxzZSBpZiAoZHg+MCkge1xuICAgICAgICBpZiAocj50MSkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPnQwKSB7dDA9cjt9XG4gICAgICAgIH1cbiAgICAvLyByaWdodFxuICAgIHEgPSBiYm94LnhyLWF4O1xuICAgIGlmIChkeD09PTAgJiYgcTwwKSB7cmV0dXJuIGZhbHNlO31cbiAgICByID0gcS9keDtcbiAgICBpZiAoZHg8MCkge1xuICAgICAgICBpZiAocj50MSkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPnQwKSB7dDA9cjt9XG4gICAgICAgIH1cbiAgICBlbHNlIGlmIChkeD4wKSB7XG4gICAgICAgIGlmIChyPHQwKSB7cmV0dXJuIGZhbHNlO31cbiAgICAgICAgaWYgKHI8dDEpIHt0MT1yO31cbiAgICAgICAgfVxuICAgIC8vIHRvcFxuICAgIHEgPSBheS1iYm94Lnl0O1xuICAgIGlmIChkeT09PTAgJiYgcTwwKSB7cmV0dXJuIGZhbHNlO31cbiAgICByID0gLXEvZHk7XG4gICAgaWYgKGR5PDApIHtcbiAgICAgICAgaWYgKHI8dDApIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocjx0MSkge3QxPXI7fVxuICAgICAgICB9XG4gICAgZWxzZSBpZiAoZHk+MCkge1xuICAgICAgICBpZiAocj50MSkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPnQwKSB7dDA9cjt9XG4gICAgICAgIH1cbiAgICAvLyBib3R0b20gICAgICAgIFxuICAgIHEgPSBiYm94LnliLWF5O1xuICAgIGlmIChkeT09PTAgJiYgcTwwKSB7cmV0dXJuIGZhbHNlO31cbiAgICByID0gcS9keTtcbiAgICBpZiAoZHk8MCkge1xuICAgICAgICBpZiAocj50MSkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPnQwKSB7dDA9cjt9XG4gICAgICAgIH1cbiAgICBlbHNlIGlmIChkeT4wKSB7XG4gICAgICAgIGlmIChyPHQwKSB7cmV0dXJuIGZhbHNlO31cbiAgICAgICAgaWYgKHI8dDEpIHt0MT1yO31cbiAgICAgICAgfVxuXG4gICAgLy8gaWYgd2UgcmVhY2ggdGhpcyBwb2ludCwgVm9yb25vaSBlZGdlIGlzIHdpdGhpbiBiYm94XG5cbiAgICAvLyBpZiB0MCA+IDAsIHZhIG5lZWRzIHRvIGNoYW5nZVxuICAgIC8vIHJoaWxsIDIwMTEtMDYtMDM6IHdlIG5lZWQgdG8gY3JlYXRlIGEgbmV3IHZlcnRleCByYXRoZXJcbiAgICAvLyB0aGFuIG1vZGlmeWluZyB0aGUgZXhpc3Rpbmcgb25lLCBzaW5jZSB0aGUgZXhpc3RpbmdcbiAgICAvLyBvbmUgaXMgbGlrZWx5IHNoYXJlZCB3aXRoIGF0IGxlYXN0IGFub3RoZXIgZWRnZVxuICAgIGlmICh0MCA+IDApIHtcbiAgICAgICAgZWRnZS52YSA9IHRoaXMuY3JlYXRlVmVydGV4KGF4K3QwKmR4LCBheSt0MCpkeSk7XG4gICAgICAgIH1cblxuICAgIC8vIGlmIHQxIDwgMSwgdmIgbmVlZHMgdG8gY2hhbmdlXG4gICAgLy8gcmhpbGwgMjAxMS0wNi0wMzogd2UgbmVlZCB0byBjcmVhdGUgYSBuZXcgdmVydGV4IHJhdGhlclxuICAgIC8vIHRoYW4gbW9kaWZ5aW5nIHRoZSBleGlzdGluZyBvbmUsIHNpbmNlIHRoZSBleGlzdGluZ1xuICAgIC8vIG9uZSBpcyBsaWtlbHkgc2hhcmVkIHdpdGggYXQgbGVhc3QgYW5vdGhlciBlZGdlXG4gICAgaWYgKHQxIDwgMSkge1xuICAgICAgICBlZGdlLnZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoYXgrdDEqZHgsIGF5K3QxKmR5KTtcbiAgICAgICAgfVxuXG4gICAgLy8gdmEgYW5kL29yIHZiIHdlcmUgY2xpcHBlZCwgdGh1cyB3ZSB3aWxsIG5lZWQgdG8gY2xvc2VcbiAgICAvLyBjZWxscyB3aGljaCB1c2UgdGhpcyBlZGdlLlxuICAgIGlmICggdDAgPiAwIHx8IHQxIDwgMSApIHtcbiAgICAgICAgdGhpcy5jZWxsc1tlZGdlLmxTaXRlLnZvcm9ub2lJZF0uY2xvc2VNZSA9IHRydWU7XG4gICAgICAgIHRoaXMuY2VsbHNbZWRnZS5yU2l0ZS52b3Jvbm9pSWRdLmNsb3NlTWUgPSB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbi8vIENvbm5lY3QvY3V0IGVkZ2VzIGF0IGJvdW5kaW5nIGJveFxuVm9yb25vaS5wcm90b3R5cGUuY2xpcEVkZ2VzID0gZnVuY3Rpb24oYmJveCkge1xuICAgIC8vIGNvbm5lY3QgYWxsIGRhbmdsaW5nIGVkZ2VzIHRvIGJvdW5kaW5nIGJveFxuICAgIC8vIG9yIGdldCByaWQgb2YgdGhlbSBpZiBpdCBjYW4ndCBiZSBkb25lXG4gICAgdmFyIGVkZ2VzID0gdGhpcy5lZGdlcyxcbiAgICAgICAgaUVkZ2UgPSBlZGdlcy5sZW5ndGgsXG4gICAgICAgIGVkZ2UsXG4gICAgICAgIGFic19mbiA9IE1hdGguYWJzO1xuXG4gICAgLy8gaXRlcmF0ZSBiYWNrd2FyZCBzbyB3ZSBjYW4gc3BsaWNlIHNhZmVseVxuICAgIHdoaWxlIChpRWRnZS0tKSB7XG4gICAgICAgIGVkZ2UgPSBlZGdlc1tpRWRnZV07XG4gICAgICAgIC8vIGVkZ2UgaXMgcmVtb3ZlZCBpZjpcbiAgICAgICAgLy8gICBpdCBpcyB3aG9sbHkgb3V0c2lkZSB0aGUgYm91bmRpbmcgYm94XG4gICAgICAgIC8vICAgaXQgaXMgbG9va2luZyBtb3JlIGxpa2UgYSBwb2ludCB0aGFuIGEgbGluZVxuICAgICAgICBpZiAoIXRoaXMuY29ubmVjdEVkZ2UoZWRnZSwgYmJveCkgfHxcbiAgICAgICAgICAgICF0aGlzLmNsaXBFZGdlKGVkZ2UsIGJib3gpIHx8XG4gICAgICAgICAgICAoYWJzX2ZuKGVkZ2UudmEueC1lZGdlLnZiLngpPDFlLTkgJiYgYWJzX2ZuKGVkZ2UudmEueS1lZGdlLnZiLnkpPDFlLTkpKSB7XG4gICAgICAgICAgICBlZGdlLnZhID0gZWRnZS52YiA9IG51bGw7XG4gICAgICAgICAgICBlZGdlcy5zcGxpY2UoaUVkZ2UsMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyBDbG9zZSB0aGUgY2VsbHMuXG4vLyBUaGUgY2VsbHMgYXJlIGJvdW5kIGJ5IHRoZSBzdXBwbGllZCBib3VuZGluZyBib3guXG4vLyBFYWNoIGNlbGwgcmVmZXJzIHRvIGl0cyBhc3NvY2lhdGVkIHNpdGUsIGFuZCBhIGxpc3Rcbi8vIG9mIGhhbGZlZGdlcyBvcmRlcmVkIGNvdW50ZXJjbG9ja3dpc2UuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jbG9zZUNlbGxzID0gZnVuY3Rpb24oYmJveCkge1xuICAgIHZhciB4bCA9IGJib3gueGwsXG4gICAgICAgIHhyID0gYmJveC54cixcbiAgICAgICAgeXQgPSBiYm94Lnl0LFxuICAgICAgICB5YiA9IGJib3gueWIsXG4gICAgICAgIGNlbGxzID0gdGhpcy5jZWxscyxcbiAgICAgICAgaUNlbGwgPSBjZWxscy5sZW5ndGgsXG4gICAgICAgIGNlbGwsXG4gICAgICAgIGlMZWZ0LFxuICAgICAgICBoYWxmZWRnZXMsIG5IYWxmZWRnZXMsXG4gICAgICAgIGVkZ2UsXG4gICAgICAgIHZhLCB2YiwgdnosXG4gICAgICAgIGxhc3RCb3JkZXJTZWdtZW50LFxuICAgICAgICBhYnNfZm4gPSBNYXRoLmFicztcblxuICAgIHdoaWxlIChpQ2VsbC0tKSB7XG4gICAgICAgIGNlbGwgPSBjZWxsc1tpQ2VsbF07XG4gICAgICAgIC8vIHBydW5lLCBvcmRlciBoYWxmZWRnZXMgY291bnRlcmNsb2Nrd2lzZSwgdGhlbiBhZGQgbWlzc2luZyBvbmVzXG4gICAgICAgIC8vIHJlcXVpcmVkIHRvIGNsb3NlIGNlbGxzXG4gICAgICAgIGlmICghY2VsbC5wcmVwYXJlSGFsZmVkZ2VzKCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICBpZiAoIWNlbGwuY2xvc2VNZSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIC8vIGZpbmQgZmlyc3QgJ3VuY2xvc2VkJyBwb2ludC5cbiAgICAgICAgLy8gYW4gJ3VuY2xvc2VkJyBwb2ludCB3aWxsIGJlIHRoZSBlbmQgcG9pbnQgb2YgYSBoYWxmZWRnZSB3aGljaFxuICAgICAgICAvLyBkb2VzIG5vdCBtYXRjaCB0aGUgc3RhcnQgcG9pbnQgb2YgdGhlIGZvbGxvd2luZyBoYWxmZWRnZVxuICAgICAgICBoYWxmZWRnZXMgPSBjZWxsLmhhbGZlZGdlcztcbiAgICAgICAgbkhhbGZlZGdlcyA9IGhhbGZlZGdlcy5sZW5ndGg7XG4gICAgICAgIC8vIHNwZWNpYWwgY2FzZTogb25seSBvbmUgc2l0ZSwgaW4gd2hpY2ggY2FzZSwgdGhlIHZpZXdwb3J0IGlzIHRoZSBjZWxsXG4gICAgICAgIC8vIC4uLlxuXG4gICAgICAgIC8vIGFsbCBvdGhlciBjYXNlc1xuICAgICAgICBpTGVmdCA9IDA7XG4gICAgICAgIHdoaWxlIChpTGVmdCA8IG5IYWxmZWRnZXMpIHtcbiAgICAgICAgICAgIHZhID0gaGFsZmVkZ2VzW2lMZWZ0XS5nZXRFbmRwb2ludCgpO1xuICAgICAgICAgICAgdnogPSBoYWxmZWRnZXNbKGlMZWZ0KzEpICUgbkhhbGZlZGdlc10uZ2V0U3RhcnRwb2ludCgpO1xuICAgICAgICAgICAgLy8gaWYgZW5kIHBvaW50IGlzIG5vdCBlcXVhbCB0byBzdGFydCBwb2ludCwgd2UgbmVlZCB0byBhZGQgdGhlIG1pc3NpbmdcbiAgICAgICAgICAgIC8vIGhhbGZlZGdlKHMpIHVwIHRvIHZ6XG4gICAgICAgICAgICBpZiAoYWJzX2ZuKHZhLngtdnoueCk+PTFlLTkgfHwgYWJzX2ZuKHZhLnktdnoueSk+PTFlLTkpIHtcblxuICAgICAgICAgICAgICAgIC8vIHJoaWxsIDIwMTMtMTItMDI6XG4gICAgICAgICAgICAgICAgLy8gXCJIb2xlc1wiIGluIHRoZSBoYWxmZWRnZXMgYXJlIG5vdCBuZWNlc3NhcmlseSBhbHdheXMgYWRqYWNlbnQuXG4gICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pL2lzc3Vlcy8xNlxuXG4gICAgICAgICAgICAgICAgLy8gZmluZCBlbnRyeSBwb2ludDpcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRydWUpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyB3YWxrIGRvd253YXJkIGFsb25nIGxlZnQgc2lkZVxuICAgICAgICAgICAgICAgICAgICBjYXNlIHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2YS54LHhsKSAmJiB0aGlzLmxlc3NUaGFuV2l0aEVwc2lsb24odmEueSx5Yik6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei54LHhsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeGwsIGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueSA6IHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmEgPSB2YjtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHdhbGsgcmlnaHR3YXJkIGFsb25nIGJvdHRvbSBzaWRlXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgdGhpcy5lcXVhbFdpdGhFcHNpbG9uKHZhLnkseWIpICYmIHRoaXMubGVzc1RoYW5XaXRoRXBzaWxvbih2YS54LHhyKTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RCb3JkZXJTZWdtZW50ID0gdGhpcy5lcXVhbFdpdGhFcHNpbG9uKHZ6LnkseWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmIgPSB0aGlzLmNyZWF0ZVZlcnRleChsYXN0Qm9yZGVyU2VnbWVudCA/IHZ6LnggOiB4ciwgeWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZSA9IHRoaXMuY3JlYXRlQm9yZGVyRWRnZShjZWxsLnNpdGUsIHZhLCB2Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpTGVmdCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFsZmVkZ2VzLnNwbGljZShpTGVmdCwgMCwgdGhpcy5jcmVhdGVIYWxmZWRnZShlZGdlLCBjZWxsLnNpdGUsIG51bGwpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5IYWxmZWRnZXMrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggbGFzdEJvcmRlclNlZ21lbnQgKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YSA9IHZiO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gd2FsayB1cHdhcmQgYWxvbmcgcmlnaHQgc2lkZVxuICAgICAgICAgICAgICAgICAgICBjYXNlIHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2YS54LHhyKSAmJiB0aGlzLmdyZWF0ZXJUaGFuV2l0aEVwc2lsb24odmEueSx5dCk6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei54LHhyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeHIsIGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueSA6IHl0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmEgPSB2YjtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHdhbGsgbGVmdHdhcmQgYWxvbmcgdG9wIHNpZGVcbiAgICAgICAgICAgICAgICAgICAgY2FzZSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odmEueSx5dCkgJiYgdGhpcy5ncmVhdGVyVGhhbldpdGhFcHNpbG9uKHZhLngseGwpOlxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEJvcmRlclNlZ21lbnQgPSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odnoueSx5dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueCA6IHhsLCB5dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlID0gdGhpcy5jcmVhdGVCb3JkZXJFZGdlKGNlbGwuc2l0ZSwgdmEsIHZiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYWxmZWRnZXMuc3BsaWNlKGlMZWZ0LCAwLCB0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGNlbGwuc2l0ZSwgbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbkhhbGZlZGdlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBsYXN0Qm9yZGVyU2VnbWVudCApIHsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhID0gdmI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsIHRocm91Z2hcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2FsayBkb3dud2FyZCBhbG9uZyBsZWZ0IHNpZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RCb3JkZXJTZWdtZW50ID0gdGhpcy5lcXVhbFdpdGhFcHNpbG9uKHZ6LngseGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmIgPSB0aGlzLmNyZWF0ZVZlcnRleCh4bCwgbGFzdEJvcmRlclNlZ21lbnQgPyB2ei55IDogeWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZSA9IHRoaXMuY3JlYXRlQm9yZGVyRWRnZShjZWxsLnNpdGUsIHZhLCB2Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpTGVmdCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFsZmVkZ2VzLnNwbGljZShpTGVmdCwgMCwgdGhpcy5jcmVhdGVIYWxmZWRnZShlZGdlLCBjZWxsLnNpdGUsIG51bGwpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5IYWxmZWRnZXMrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggbGFzdEJvcmRlclNlZ21lbnQgKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YSA9IHZiO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdhbGsgcmlnaHR3YXJkIGFsb25nIGJvdHRvbSBzaWRlXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei55LHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgobGFzdEJvcmRlclNlZ21lbnQgPyB2ei54IDogeHIsIHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmEgPSB2YjtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB3YWxrIHVwd2FyZCBhbG9uZyByaWdodCBzaWRlXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei54LHhyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeHIsIGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueSA6IHl0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoXG5cbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IFwiVm9yb25vaS5jbG9zZUNlbGxzKCkgPiB0aGlzIG1ha2VzIG5vIHNlbnNlIVwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgY2VsbC5jbG9zZU1lID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIERlYnVnZ2luZyBoZWxwZXJcbi8qXG5Wb3Jvbm9pLnByb3RvdHlwZS5kdW1wQmVhY2hsaW5lID0gZnVuY3Rpb24oeSkge1xuICAgIGNvbnNvbGUubG9nKCdWb3Jvbm9pLmR1bXBCZWFjaGxpbmUoJWYpID4gQmVhY2hzZWN0aW9ucywgZnJvbSBsZWZ0IHRvIHJpZ2h0OicsIHkpO1xuICAgIGlmICggIXRoaXMuYmVhY2hsaW5lICkge1xuICAgICAgICBjb25zb2xlLmxvZygnICBOb25lJyk7XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIGJzID0gdGhpcy5iZWFjaGxpbmUuZ2V0Rmlyc3QodGhpcy5iZWFjaGxpbmUucm9vdCk7XG4gICAgICAgIHdoaWxlICggYnMgKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnICBzaXRlICVkOiB4bDogJWYsIHhyOiAlZicsIGJzLnNpdGUudm9yb25vaUlkLCB0aGlzLmxlZnRCcmVha1BvaW50KGJzLCB5KSwgdGhpcy5yaWdodEJyZWFrUG9pbnQoYnMsIHkpKTtcbiAgICAgICAgICAgIGJzID0gYnMucmJOZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbiovXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gSGVscGVyOiBRdWFudGl6ZSBzaXRlc1xuXG4vLyByaGlsbCAyMDEzLTEwLTEyOlxuLy8gVGhpcyBpcyB0byBzb2x2ZSBodHRwczovL2dpdGh1Yi5jb20vZ29yaGlsbC9KYXZhc2NyaXB0LVZvcm9ub2kvaXNzdWVzLzE1XG4vLyBTaW5jZSBub3QgYWxsIHVzZXJzIHdpbGwgZW5kIHVwIHVzaW5nIHRoZSBraW5kIG9mIGNvb3JkIHZhbHVlcyB3aGljaCB3b3VsZFxuLy8gY2F1c2UgdGhlIGlzc3VlIHRvIGFyaXNlLCBJIGNob3NlIHRvIGxldCB0aGUgdXNlciBkZWNpZGUgd2hldGhlciBvciBub3Rcbi8vIGhlIHNob3VsZCBzYW5pdGl6ZSBoaXMgY29vcmQgdmFsdWVzIHRocm91Z2ggdGhpcyBoZWxwZXIuIFRoaXMgd2F5LCBmb3Jcbi8vIHRob3NlIHVzZXJzIHdobyB1c2VzIGNvb3JkIHZhbHVlcyB3aGljaCBhcmUga25vd24gdG8gYmUgZmluZSwgbm8gb3ZlcmhlYWQgaXNcbi8vIGFkZGVkLlxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5xdWFudGl6ZVNpdGVzID0gZnVuY3Rpb24oc2l0ZXMpIHtcbiAgICB2YXIgzrUgPSB0aGlzLs61LFxuICAgICAgICBuID0gc2l0ZXMubGVuZ3RoLFxuICAgICAgICBzaXRlO1xuICAgIHdoaWxlICggbi0tICkge1xuICAgICAgICBzaXRlID0gc2l0ZXNbbl07XG4gICAgICAgIHNpdGUueCA9IE1hdGguZmxvb3Ioc2l0ZS54IC8gzrUpICogzrU7XG4gICAgICAgIHNpdGUueSA9IE1hdGguZmxvb3Ioc2l0ZS55IC8gzrUpICogzrU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEhlbHBlcjogUmVjeWNsZSBkaWFncmFtOiBhbGwgdmVydGV4LCBlZGdlIGFuZCBjZWxsIG9iamVjdHMgYXJlXG4vLyBcInN1cnJlbmRlcmVkXCIgdG8gdGhlIFZvcm9ub2kgb2JqZWN0IGZvciByZXVzZS5cbi8vIFRPRE86IHJoaWxsLXZvcm9ub2ktY29yZSB2MjogbW9yZSBwZXJmb3JtYW5jZSB0byBiZSBnYWluZWRcbi8vIHdoZW4gSSBjaGFuZ2UgdGhlIHNlbWFudGljIG9mIHdoYXQgaXMgcmV0dXJuZWQuXG5cblZvcm9ub2kucHJvdG90eXBlLnJlY3ljbGUgPSBmdW5jdGlvbihkaWFncmFtKSB7XG4gICAgaWYgKCBkaWFncmFtICkge1xuICAgICAgICBpZiAoIGRpYWdyYW0gaW5zdGFuY2VvZiB0aGlzLkRpYWdyYW0gKSB7XG4gICAgICAgICAgICB0aGlzLnRvUmVjeWNsZSA9IGRpYWdyYW07XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgJ1Zvcm9ub2kucmVjeWNsZURpYWdyYW0oKSA+IE5lZWQgYSBEaWFncmFtIG9iamVjdC4nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBUb3AtbGV2ZWwgRm9ydHVuZSBsb29wXG5cbi8vIHJoaWxsIDIwMTEtMDUtMTk6XG4vLyAgIFZvcm9ub2kgc2l0ZXMgYXJlIGtlcHQgY2xpZW50LXNpZGUgbm93LCB0byBhbGxvd1xuLy8gICB1c2VyIHRvIGZyZWVseSBtb2RpZnkgY29udGVudC4gQXQgY29tcHV0ZSB0aW1lLFxuLy8gICAqcmVmZXJlbmNlcyogdG8gc2l0ZXMgYXJlIGNvcGllZCBsb2NhbGx5LlxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jb21wdXRlID0gZnVuY3Rpb24oc2l0ZXMsIGJib3gpIHtcbiAgICAvLyB0byBtZWFzdXJlIGV4ZWN1dGlvbiB0aW1lXG4gICAgdmFyIHN0YXJ0VGltZSA9IG5ldyBEYXRlKCk7XG5cbiAgICAvLyBpbml0IGludGVybmFsIHN0YXRlXG4gICAgdGhpcy5yZXNldCgpO1xuXG4gICAgLy8gYW55IGRpYWdyYW0gZGF0YSBhdmFpbGFibGUgZm9yIHJlY3ljbGluZz9cbiAgICAvLyBJIGRvIHRoYXQgaGVyZSBzbyB0aGF0IHRoaXMgaXMgaW5jbHVkZWQgaW4gZXhlY3V0aW9uIHRpbWVcbiAgICBpZiAoIHRoaXMudG9SZWN5Y2xlICkge1xuICAgICAgICB0aGlzLnZlcnRleEp1bmt5YXJkID0gdGhpcy52ZXJ0ZXhKdW5reWFyZC5jb25jYXQodGhpcy50b1JlY3ljbGUudmVydGljZXMpO1xuICAgICAgICB0aGlzLmVkZ2VKdW5reWFyZCA9IHRoaXMuZWRnZUp1bmt5YXJkLmNvbmNhdCh0aGlzLnRvUmVjeWNsZS5lZGdlcyk7XG4gICAgICAgIHRoaXMuY2VsbEp1bmt5YXJkID0gdGhpcy5jZWxsSnVua3lhcmQuY29uY2F0KHRoaXMudG9SZWN5Y2xlLmNlbGxzKTtcbiAgICAgICAgdGhpcy50b1JlY3ljbGUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAvLyBJbml0aWFsaXplIHNpdGUgZXZlbnQgcXVldWVcbiAgICB2YXIgc2l0ZUV2ZW50cyA9IHNpdGVzLnNsaWNlKDApO1xuICAgIHNpdGVFdmVudHMuc29ydChmdW5jdGlvbihhLGIpe1xuICAgICAgICB2YXIgciA9IGIueSAtIGEueTtcbiAgICAgICAgaWYgKHIpIHtyZXR1cm4gcjt9XG4gICAgICAgIHJldHVybiBiLnggLSBhLng7XG4gICAgICAgIH0pO1xuXG4gICAgLy8gcHJvY2VzcyBxdWV1ZVxuICAgIHZhciBzaXRlID0gc2l0ZUV2ZW50cy5wb3AoKSxcbiAgICAgICAgc2l0ZWlkID0gMCxcbiAgICAgICAgeHNpdGV4LCAvLyB0byBhdm9pZCBkdXBsaWNhdGUgc2l0ZXNcbiAgICAgICAgeHNpdGV5LFxuICAgICAgICBjZWxscyA9IHRoaXMuY2VsbHMsXG4gICAgICAgIGNpcmNsZTtcblxuICAgIC8vIG1haW4gbG9vcFxuICAgIGZvciAoOzspIHtcbiAgICAgICAgLy8gd2UgbmVlZCB0byBmaWd1cmUgd2hldGhlciB3ZSBoYW5kbGUgYSBzaXRlIG9yIGNpcmNsZSBldmVudFxuICAgICAgICAvLyBmb3IgdGhpcyB3ZSBmaW5kIG91dCBpZiB0aGVyZSBpcyBhIHNpdGUgZXZlbnQgYW5kIGl0IGlzXG4gICAgICAgIC8vICdlYXJsaWVyJyB0aGFuIHRoZSBjaXJjbGUgZXZlbnRcbiAgICAgICAgY2lyY2xlID0gdGhpcy5maXJzdENpcmNsZUV2ZW50O1xuXG4gICAgICAgIC8vIGFkZCBiZWFjaCBzZWN0aW9uXG4gICAgICAgIGlmIChzaXRlICYmICghY2lyY2xlIHx8IHNpdGUueSA8IGNpcmNsZS55IHx8IChzaXRlLnkgPT09IGNpcmNsZS55ICYmIHNpdGUueCA8IGNpcmNsZS54KSkpIHtcbiAgICAgICAgICAgIC8vIG9ubHkgaWYgc2l0ZSBpcyBub3QgYSBkdXBsaWNhdGVcbiAgICAgICAgICAgIGlmIChzaXRlLnggIT09IHhzaXRleCB8fCBzaXRlLnkgIT09IHhzaXRleSkge1xuICAgICAgICAgICAgICAgIC8vIGZpcnN0IGNyZWF0ZSBjZWxsIGZvciBuZXcgc2l0ZVxuICAgICAgICAgICAgICAgIGNlbGxzW3NpdGVpZF0gPSB0aGlzLmNyZWF0ZUNlbGwoc2l0ZSk7XG4gICAgICAgICAgICAgICAgc2l0ZS52b3Jvbm9pSWQgPSBzaXRlaWQrKztcbiAgICAgICAgICAgICAgICAvLyB0aGVuIGNyZWF0ZSBhIGJlYWNoc2VjdGlvbiBmb3IgdGhhdCBzaXRlXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRCZWFjaHNlY3Rpb24oc2l0ZSk7XG4gICAgICAgICAgICAgICAgLy8gcmVtZW1iZXIgbGFzdCBzaXRlIGNvb3JkcyB0byBkZXRlY3QgZHVwbGljYXRlXG4gICAgICAgICAgICAgICAgeHNpdGV5ID0gc2l0ZS55O1xuICAgICAgICAgICAgICAgIHhzaXRleCA9IHNpdGUueDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBzaXRlID0gc2l0ZUV2ZW50cy5wb3AoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgYmVhY2ggc2VjdGlvblxuICAgICAgICBlbHNlIGlmIChjaXJjbGUpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlQmVhY2hzZWN0aW9uKGNpcmNsZS5hcmMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIC8vIGFsbCBkb25lLCBxdWl0XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIC8vIHdyYXBwaW5nLXVwOlxuICAgIC8vICAgY29ubmVjdCBkYW5nbGluZyBlZGdlcyB0byBib3VuZGluZyBib3hcbiAgICAvLyAgIGN1dCBlZGdlcyBhcyBwZXIgYm91bmRpbmcgYm94XG4gICAgLy8gICBkaXNjYXJkIGVkZ2VzIGNvbXBsZXRlbHkgb3V0c2lkZSBib3VuZGluZyBib3hcbiAgICAvLyAgIGRpc2NhcmQgZWRnZXMgd2hpY2ggYXJlIHBvaW50LWxpa2VcbiAgICB0aGlzLmNsaXBFZGdlcyhiYm94KTtcblxuICAgIC8vICAgYWRkIG1pc3NpbmcgZWRnZXMgaW4gb3JkZXIgdG8gY2xvc2Ugb3BlbmVkIGNlbGxzXG4gICAgdGhpcy5jbG9zZUNlbGxzKGJib3gpO1xuXG4gICAgLy8gdG8gbWVhc3VyZSBleGVjdXRpb24gdGltZVxuICAgIHZhciBzdG9wVGltZSA9IG5ldyBEYXRlKCk7XG5cbiAgICAvLyBwcmVwYXJlIHJldHVybiB2YWx1ZXNcbiAgICB2YXIgZGlhZ3JhbSA9IG5ldyB0aGlzLkRpYWdyYW0oKTtcbiAgICBkaWFncmFtLmNlbGxzID0gdGhpcy5jZWxscztcbiAgICBkaWFncmFtLmVkZ2VzID0gdGhpcy5lZGdlcztcbiAgICBkaWFncmFtLnZlcnRpY2VzID0gdGhpcy52ZXJ0aWNlcztcbiAgICBkaWFncmFtLmV4ZWNUaW1lID0gc3RvcFRpbWUuZ2V0VGltZSgpLXN0YXJ0VGltZS5nZXRUaW1lKCk7XG5cbiAgICAvLyBjbGVhbiB1cFxuICAgIHRoaXMucmVzZXQoKTtcblxuICAgIHJldHVybiBkaWFncmFtO1xuICAgIH07XG5cbmlmKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSBtb2R1bGUuZXhwb3J0cyA9IFZvcm9ub2k7XG4iLCJtb2R1bGUuZXhwb3J0cy5SQURJVVMgPSA2Mzc4MTM3O1xubW9kdWxlLmV4cG9ydHMuRkxBVFRFTklORyA9IDEvMjk4LjI1NzIyMzU2Mztcbm1vZHVsZS5leHBvcnRzLlBPTEFSX1JBRElVUyA9IDYzNTY3NTIuMzE0MjtcbiIsIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gR2VvSlNPTlV0aWxzXG4vL1xuLy8gQG1vZHVsZVxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbnZhciBhcmVhID0gcmVxdWlyZSgndHVyZi1hcmVhJyk7XG52YXIgXyA9IHJlcXVpcmUoJ2xvZGFzaCcpO1xuXG52YXIgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKTtcbmZ1bmN0aW9uIGluc3BlY3Qob2JqLCBkZXB0aCkge1xuICAgIHJldHVybiB1dGlsLmluc3BlY3Qob2JqLCB7ZGVwdGg6IGRlcHRoIHx8IG51bGx9KTtcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmZ1bmN0aW9uIEdlb0pTT05VdGlscygpIHtcbn1cblxuLyoqXG4gKiBDaGVja3MgdG8gc2VlIGlmIHRoZSBmZWF0dXJlIGlzIGEgUG9seWdvbiBmb3JtYXR0ZWQgYXMgYSBNdWx0aVBvbHlnb24uXG4gKlxuICogQHBhcmFtIHBvbHlnb25cbiAqIEByZXR1cm5zIHtQb2x5Z29ufVxuICovXG5HZW9KU09OVXRpbHMucHJvdG90eXBlLmZpeE11bHRpUG9seSA9IGZ1bmN0aW9uKHBvbHlnb24pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZihwb2x5Z29uLmdlb21ldHJ5LnR5cGUgPT0gJ011bHRpUG9seWdvbicgJiYgcG9seWdvbi5nZW9tZXRyeS5jb29yZGluYXRlc1swXS5sZW5ndGggPT0gMSkge1xuICAgICAgICAvLyBIYW5kbGUgYSBQb2x5Z29uIGluIHRoZSBmb3JtIG9mIGEgTXVsdGlQb2x5Z29uXG4gICAgICAgIHBvbHlnb24uZ2VvbWV0cnkudHlwZSA9ICdQb2x5Z29uJztcbiAgICAgICAgcG9seWdvbi5nZW9tZXRyeS5jb29yZGluYXRlcyA9IHBvbHlnb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF07XG5cbiAgICAgICAgcmV0dXJuIHBvbHlnb247XG4gICAgfSBlbHNlIGlmKHBvbHlnb24uZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2x5Z29uJyAmJiBwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgLy8gSGFuZGxlIGEgdHJ1ZSBNdWx0aVBvbHlnb24gYnkgcmV0dXJuaW5nIHRoZSBQb2x5Z29uIG9mIGxhcmdlc3QgYXJlYVxuICAgICAgICB2YXIgcG9seWdvbnMgPSBfLm1hcChwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLCBmdW5jdGlvbihjb29yZGluYXRlcykge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGYuX3RvR2VvSlNPTkZlYXR1cmUoXG4gICAgICAgICAgICAgICAgc2VsZi5fdG9HZW9KU09OUG9seWdvbihjb29yZGluYXRlcylcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuICAgICAgICB2YXIgY29sbGVjdGlvbkFyZWEgPSBfLm1hcChwb2x5Z29ucywgYXJlYSk7XG4gICAgICAgIHZhciBsYXJnZXN0QXJlYUluZGV4ID0gXy5pbmRleE9mKGNvbGxlY3Rpb25BcmVhLCBfLm1heChjb2xsZWN0aW9uQXJlYSkpO1xuXG4gICAgICAgIHJldHVybiBwb2x5Z29uc1tsYXJnZXN0QXJlYUluZGV4XTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcG9seWdvbjtcbiAgICB9XG59O1xuXG4vKipcbiAqIFRha2VzIGEgcG9seWdvbiBhbmQgZ2VuZXJhdGVzIHRoZSBzaXRlcyBuZWVkZWQgdG8gZ2VuZXJhdGUgVm9yb25vaVxuICpcbiAqIEBwYXJhbSBwb2x5Z29uXG4gKiBAcGFyYW0gZGVjaW1hbFBsYWNlcyBBIHBvd2VyIG9mIDEwIHVzZWQgdG8gdHJ1bmNhdGUgdGhlIGRlY2ltYWwgcGxhY2VzIG9mIHRoZSBwb2x5Z29uIHNpdGVzIGFuZFxuICogICBiYm94LiBUaGlzIGlzIGEgd29ya2Fyb3VuZCBkdWUgdG8gdGhlIGlzc3VlIHJlZmVycmVkIHRvIGhlcmU6XG4gKiAgIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9pc3N1ZXMvMTVcbiAqICAgRGVmYXVsdHMgdG8gMWUtMjAuXG4gKiBAcmV0dXJucyB7e3NpdGVzOiBBcnJheSwgYmJveDoge3hsOiAqLCB4cjogKiwgeXQ6ICosIHliOiAqfX19XG4gKi9cbkdlb0pTT05VdGlscy5wcm90b3R5cGUuc2l0ZXMgPSBmdW5jdGlvbihwb2x5Z29uLCBkZWNpbWFsUGxhY2VzKSB7XG4gICAgaWYoZGVjaW1hbFBsYWNlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGRlY2ltYWxQbGFjZXMgPSAxZS0yMDtcbiAgICB9XG4gICAgdmFyIHBvbHlnb25TaXRlcyA9IFtdO1xuICAgIHZhciB4bWluLHhtYXgseW1pbix5bWF4O1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBwb2x5UmluZyA9IHBvbHlnb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbaV0uc2xpY2UoKTtcbiAgICAgICAgZm9yKHZhciBqID0gMDsgaiA8IHBvbHlSaW5nLmxlbmd0aC0xOyBqKyspIHtcbiAgICAgICAgICAgIC8vUHVzaCBvcmlnaW5hbCBwb2ludFxuICAgICAgICAgICAgcG9seWdvblNpdGVzLnB1c2goe1xuICAgICAgICAgICAgICAgIHg6IE1hdGguZmxvb3IocG9seVJpbmdbal1bMF0gLyBkZWNpbWFsUGxhY2VzKSAqIGRlY2ltYWxQbGFjZXMsXG4gICAgICAgICAgICAgICAgeTogTWF0aC5mbG9vcihwb2x5UmluZ1tqXVsxXSAvIGRlY2ltYWxQbGFjZXMpICogZGVjaW1hbFBsYWNlc1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvL1B1c2ggbWlkcG9pbnRzIG9mIHNlZ21lbnRzXG4gICAgICAgICAgICBwb2x5Z29uU2l0ZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgeDogTWF0aC5mbG9vcigoKHBvbHlSaW5nW2pdWzBdK3BvbHlSaW5nW2orMV1bMF0pIC8gMikgLyBkZWNpbWFsUGxhY2VzKSAqIGRlY2ltYWxQbGFjZXMsXG4gICAgICAgICAgICAgICAgeTogTWF0aC5mbG9vcigoKHBvbHlSaW5nW2pdWzFdK3BvbHlSaW5nW2orMV1bMV0pIC8gMikgLyBkZWNpbWFsUGxhY2VzKSAqIGRlY2ltYWxQbGFjZXNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy9pbml0aWFsaXplIGJvdW5kaW5nIGJveFxuICAgICAgICAgICAgaWYoKGkgPT0gMCkgJiYgKGogPT0gMCkpIHtcbiAgICAgICAgICAgICAgICB4bWluID0gTWF0aC5mbG9vcihwb2x5UmluZ1tqXVswXSAvIGRlY2ltYWxQbGFjZXMpICogZGVjaW1hbFBsYWNlcztcbiAgICAgICAgICAgICAgICB4bWF4ID0geG1pbjtcbiAgICAgICAgICAgICAgICB5bWluID0gTWF0aC5mbG9vcihwb2x5UmluZ1tqXVsxXSAvIGRlY2ltYWxQbGFjZXMpICogZGVjaW1hbFBsYWNlcztcbiAgICAgICAgICAgICAgICB5bWF4ID0geW1pbjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYocG9seVJpbmdbal1bMF0gPCB4bWluKSB7XG4gICAgICAgICAgICAgICAgICAgIHhtaW4gPSBNYXRoLmZsb29yKHBvbHlSaW5nW2pdWzBdIC8gZGVjaW1hbFBsYWNlcykgKiBkZWNpbWFsUGxhY2VzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZihwb2x5UmluZ1tqXVswXSA+IHhtYXgpIHtcbiAgICAgICAgICAgICAgICAgICAgeG1heCA9IE1hdGguZmxvb3IocG9seVJpbmdbal1bMF0gLyBkZWNpbWFsUGxhY2VzKSAqIGRlY2ltYWxQbGFjZXM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmKHBvbHlSaW5nW2pdWzFdIDwgeW1pbikge1xuICAgICAgICAgICAgICAgICAgICB5bWluID0gTWF0aC5mbG9vcihwb2x5UmluZ1tqXVsxXSAvIGRlY2ltYWxQbGFjZXMpICogZGVjaW1hbFBsYWNlcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYocG9seVJpbmdbal1bMV0gPiB5bWF4KSB7XG4gICAgICAgICAgICAgICAgICAgIHltYXggPSBNYXRoLmZsb29yKHBvbHlSaW5nW2pdWzFdIC8gZGVjaW1hbFBsYWNlcykgKiBkZWNpbWFsUGxhY2VzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBzaXRlczogcG9seWdvblNpdGVzLFxuICAgICAgICBiYm94OiB7XG4gICAgICAgICAgICB4bDogeG1pbixcbiAgICAgICAgICAgIHhyOiB4bWF4LFxuICAgICAgICAgICAgeXQ6IHltaW4sXG4gICAgICAgICAgICB5YjogeW1heFxuICAgICAgICB9XG4gICAgfTtcbn07XG5cbi8qKlxuICpcbiAqIEBwYXJhbSBnZW9tXG4gKiBAcmV0dXJucyB7e3R5cGU6IHN0cmluZywgZ2VvbWV0cnk6ICp9fVxuICogQHByaXZhdGVcbiAqL1xuR2VvSlNPTlV0aWxzLnByb3RvdHlwZS5fdG9HZW9KU09ORmVhdHVyZSA9IGZ1bmN0aW9uKGdlb20pIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gICAgICAgIFwiZ2VvbWV0cnlcIjogZ2VvbVxuICAgIH07XG59O1xuXG4vKipcbiAqXG4gKiBAcGFyYW0gY29vcmRpbmF0ZXNcbiAqIEByZXR1cm5zIHt7dHlwZTogc3RyaW5nLCBjb29yZGluYXRlczogKn19XG4gKiBAcHJpdmF0ZVxuICovXG5HZW9KU09OVXRpbHMucHJvdG90eXBlLl90b0dlb0pTT05Qb2x5Z29uID0gZnVuY3Rpb24oY29vcmRpbmF0ZXMpIHtcbiAgICB2YXIgZ2VvbSA9IHtcbiAgICAgICAgXCJ0eXBlXCI6IFwiUG9seWdvblwiLFxuICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFtjb29yZGluYXRlc11cbiAgICB9O1xuICAgIHJldHVybihnZW9tKTtcbn07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBHZW9KU09OVXRpbHMoKTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIl19

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.maxInscribedCircle = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Voronoi = require('voronoi');
var voronoi = new Voronoi;
var point = require('turf/node_modules/turf-point');
var pointOnLine = require('turf/node_modules/turf-point-on-line');
var within = require('turf/node_modules/turf-within');

/**
 * Takes a polygon feature and estimates the best position for label placement that is guaranteed to be inside the polygon. This uses voronoi to estimate the medial axis.
 *
 * @module turf/label-position
 * @param {Polygon} polygon a Polygon feature of the underlying polygon geometry in EPSG:4326
 * @returns {Point} a Point feature at the best estimated label position
 */

module.exports = function(polygon) {
    var polySites = sites(polygon);
    var diagram = voronoi.compute(polySites.sites, polySites.bbox);
    var vertices = {
        type: "FeatureCollection",
        features: []
    };
    //construct GeoJSON object of voronoi vertices
    for(var i = 0; i < diagram.vertices.length; i++) {
        vertices.features.push({
            type: "Feature",
            properties: {},
            geometry: {
                type: "Point",
                coordinates: [diagram.vertices[i].x, diagram.vertices[i].y]
            }
        })
    }
    //within requires a FeatureCollection for input polygons
    var polygonFeatureCollection = {
        type: "FeatureCollection",
        features: [polygon]
    };
    var ptsWithin = within(vertices, polygonFeatureCollection); //remove any vertices that are not inside the polygon
    var labelLocation = {
        coordinates: [0,0],
        maxDist: 0
    };
    var polygonBoundaries = {
        type: "FeatureCollection",
        features: []
    };
    var vertexDistance;

    //define borders of polygon and holes as LineStrings
    for(var j = 0; j < polygon.geometry.coordinates.length; j++) {
        polygonBoundaries.features.push({
            type: "Feature",
            properties: {},
            geometry: {
                type: "LineString",
                coordinates: polygon.geometry.coordinates[j]
            }
        })
    }

    for(var k = 0; k < ptsWithin.features.length; k++) {
        for(var l = 0; l < polygonBoundaries.features.length; l++) {
            if(l == 0) {
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

function sites(polygon) {
    var polygonSites = [];
    var xmin,xmax,ymin,ymax;
    for(var i = 0; i < polygon.geometry.coordinates.length; i++) {
        var polyRing = polygon.geometry.coordinates[i].slice();
        for(var j = 0; j < polyRing.length-1; j++) {
            //Push original point
            polygonSites.push({
                x: polyRing[j][0],
                y: polyRing[j][1]
            });
            //Push midpoints of segments
            polygonSites.push({
                x: (polyRing[j][0]+polyRing[j+1][0])/2,
                y: (polyRing[j][1]+polyRing[j+1][1])/2
            });
            //initialize bounding box
            if((i == 0) && (j == 0)) {
                xmin = polyRing[j][0];
                xmax = xmin;
                ymin = polyRing[j][1];
                ymax = ymin;
            } else {
                if(polyRing[j][0] < xmin) {
                    xmin = polyRing[j][0];
                }
                if(polyRing[j][0] > xmax) {
                    xmax = polyRing[j][0];
                }
                if(polyRing[j][0] < ymin) {
                    ymin = polyRing[j][1];
                }
                if(polyRing[j][0] > ymax) {
                    ymax = polyRing[j][1];
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
}
},{"turf/node_modules/turf-point":10,"turf/node_modules/turf-point-on-line":9,"turf/node_modules/turf-within":11,"voronoi":12}],2:[function(require,module,exports){
//http://en.wikipedia.org/wiki/Haversine_formula
//http://www.movable-type.co.uk/scripts/latlong.html

/**
 * Takes two {@link Point} features and finds the bearing between them.
 *
 * @module turf/bearing
 * @category measurement
 * @param {Point} start starting Point
 * @param {Point} end ending Point
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

},{}],3:[function(require,module,exports){
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

},{"turf-point":10}],4:[function(require,module,exports){
var invariant = require('turf-invariant');
//http://en.wikipedia.org/wiki/Haversine_formula
//http://www.movable-type.co.uk/scripts/latlong.html

/**
 * Takes two {@link Point} features and calculates
 * the distance between them in degress, radians,
 * miles, or kilometers. This uses the
 * [Haversine formula](http://en.wikipedia.org/wiki/Haversine_formula)
 * to account for global curvature.
 *
 * @module turf/distance
 * @category measurement
 * @param {Feature} from origin point
 * @param {Feature} to destination point
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
module.exports = function(point1, point2, units){
  invariant.featureOf(point1, 'Point', 'distance');
  invariant.featureOf(point2, 'Point', 'distance');
  var coordinates1 = point1.geometry.coordinates;
  var coordinates2 = point2.geometry.coordinates;

  var dLat = toRad(coordinates2[1] - coordinates1[1]);
  var dLon = toRad(coordinates2[0] - coordinates1[0]);
  var lat1 = toRad(coordinates1[1]);
  var lat2 = toRad(coordinates2[1]);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  var R;
  switch(units){
    case 'miles':
      R = 3960;
      break;
    case 'kilometers':
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

},{"turf-invariant":5}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
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


},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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
}

function pointOnLine (pt, coords) {
  var units = 'miles'
  var closestPt = point([Infinity, Infinity], {dist: Infinity});
  for(var i = 0; i < coords.length - 1; i++) {
    var start = point(coords[i])
    var stop = point(coords[i+1])
    //start
    start.properties.dist = distance(pt, start, units);
    //stop
    stop.properties.dist = distance(pt, stop, units);
    //perpendicular
    var direction = bearing(start, stop)
    var perpendicularPt = destination(pt, 1000 , direction + 90, units) // 1000 = gross
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
      perpendicularPt = destination(pt, 1000 , direction - 90, units) // 1000 = gross
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
  if (a > 0 && a < 1) {
    result.onLine1 = true;
  }
  // if line2 is a segment and line1 is infinite, they intersect if:
  if (b > 0 && b < 1) {
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

},{"turf-bearing":2,"turf-destination":3,"turf-distance":4,"turf-linestring":8,"turf-point":10}],10:[function(require,module,exports){
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

},{}],11:[function(require,module,exports){
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

},{"turf-featurecollection":6,"turf-inside":7}],12:[function(require,module,exports){
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

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJtYXhJbnNjcmliZWRDaXJjbGUuanMiLCJub2RlX21vZHVsZXMvdHVyZi9ub2RlX21vZHVsZXMvdHVyZi1iZWFyaW5nL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3R1cmYvbm9kZV9tb2R1bGVzL3R1cmYtZGVzdGluYXRpb24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvdHVyZi9ub2RlX21vZHVsZXMvdHVyZi1kaXN0YW5jZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmL25vZGVfbW9kdWxlcy90dXJmLWRpc3RhbmNlL25vZGVfbW9kdWxlcy90dXJmLWludmFyaWFudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmL25vZGVfbW9kdWxlcy90dXJmLWZlYXR1cmVjb2xsZWN0aW9uL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3R1cmYvbm9kZV9tb2R1bGVzL3R1cmYtaW5zaWRlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3R1cmYvbm9kZV9tb2R1bGVzL3R1cmYtbGluZXN0cmluZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmL25vZGVfbW9kdWxlcy90dXJmLXBvaW50LW9uLWxpbmUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdHVyZi9ub2RlX21vZHVsZXMvdHVyZi1wb2ludC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmL25vZGVfbW9kdWxlcy90dXJmLXdpdGhpbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy92b3Jvbm9pL3JoaWxsLXZvcm9ub2ktY29yZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBWb3Jvbm9pID0gcmVxdWlyZSgndm9yb25vaScpO1xudmFyIHZvcm9ub2kgPSBuZXcgVm9yb25vaTtcbnZhciBwb2ludCA9IHJlcXVpcmUoJ3R1cmYvbm9kZV9tb2R1bGVzL3R1cmYtcG9pbnQnKTtcbnZhciBwb2ludE9uTGluZSA9IHJlcXVpcmUoJ3R1cmYvbm9kZV9tb2R1bGVzL3R1cmYtcG9pbnQtb24tbGluZScpO1xudmFyIHdpdGhpbiA9IHJlcXVpcmUoJ3R1cmYvbm9kZV9tb2R1bGVzL3R1cmYtd2l0aGluJyk7XG5cbi8qKlxuICogVGFrZXMgYSBwb2x5Z29uIGZlYXR1cmUgYW5kIGVzdGltYXRlcyB0aGUgYmVzdCBwb3NpdGlvbiBmb3IgbGFiZWwgcGxhY2VtZW50IHRoYXQgaXMgZ3VhcmFudGVlZCB0byBiZSBpbnNpZGUgdGhlIHBvbHlnb24uIFRoaXMgdXNlcyB2b3Jvbm9pIHRvIGVzdGltYXRlIHRoZSBtZWRpYWwgYXhpcy5cbiAqXG4gKiBAbW9kdWxlIHR1cmYvbGFiZWwtcG9zaXRpb25cbiAqIEBwYXJhbSB7UG9seWdvbn0gcG9seWdvbiBhIFBvbHlnb24gZmVhdHVyZSBvZiB0aGUgdW5kZXJseWluZyBwb2x5Z29uIGdlb21ldHJ5IGluIEVQU0c6NDMyNlxuICogQHJldHVybnMge1BvaW50fSBhIFBvaW50IGZlYXR1cmUgYXQgdGhlIGJlc3QgZXN0aW1hdGVkIGxhYmVsIHBvc2l0aW9uXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwb2x5Z29uKSB7XG4gICAgdmFyIHBvbHlTaXRlcyA9IHNpdGVzKHBvbHlnb24pO1xuICAgIHZhciBkaWFncmFtID0gdm9yb25vaS5jb21wdXRlKHBvbHlTaXRlcy5zaXRlcywgcG9seVNpdGVzLmJib3gpO1xuICAgIHZhciB2ZXJ0aWNlcyA9IHtcbiAgICAgICAgdHlwZTogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICAgICAgICBmZWF0dXJlczogW11cbiAgICB9O1xuICAgIC8vY29uc3RydWN0IEdlb0pTT04gb2JqZWN0IG9mIHZvcm9ub2kgdmVydGljZXNcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgZGlhZ3JhbS52ZXJ0aWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2ZXJ0aWNlcy5mZWF0dXJlcy5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6IFwiRmVhdHVyZVwiLFxuICAgICAgICAgICAgcHJvcGVydGllczoge30sXG4gICAgICAgICAgICBnZW9tZXRyeToge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiUG9pbnRcIixcbiAgICAgICAgICAgICAgICBjb29yZGluYXRlczogW2RpYWdyYW0udmVydGljZXNbaV0ueCwgZGlhZ3JhbS52ZXJ0aWNlc1tpXS55XVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cbiAgICAvL3dpdGhpbiByZXF1aXJlcyBhIEZlYXR1cmVDb2xsZWN0aW9uIGZvciBpbnB1dCBwb2x5Z29uc1xuICAgIHZhciBwb2x5Z29uRmVhdHVyZUNvbGxlY3Rpb24gPSB7XG4gICAgICAgIHR5cGU6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAgICAgICAgZmVhdHVyZXM6IFtwb2x5Z29uXVxuICAgIH07XG4gICAgdmFyIHB0c1dpdGhpbiA9IHdpdGhpbih2ZXJ0aWNlcywgcG9seWdvbkZlYXR1cmVDb2xsZWN0aW9uKTsgLy9yZW1vdmUgYW55IHZlcnRpY2VzIHRoYXQgYXJlIG5vdCBpbnNpZGUgdGhlIHBvbHlnb25cbiAgICB2YXIgbGFiZWxMb2NhdGlvbiA9IHtcbiAgICAgICAgY29vcmRpbmF0ZXM6IFswLDBdLFxuICAgICAgICBtYXhEaXN0OiAwXG4gICAgfTtcbiAgICB2YXIgcG9seWdvbkJvdW5kYXJpZXMgPSB7XG4gICAgICAgIHR5cGU6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAgICAgICAgZmVhdHVyZXM6IFtdXG4gICAgfTtcbiAgICB2YXIgdmVydGV4RGlzdGFuY2U7XG5cbiAgICAvL2RlZmluZSBib3JkZXJzIG9mIHBvbHlnb24gYW5kIGhvbGVzIGFzIExpbmVTdHJpbmdzXG4gICAgZm9yKHZhciBqID0gMDsgaiA8IHBvbHlnb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgcG9seWdvbkJvdW5kYXJpZXMuZmVhdHVyZXMucHVzaCh7XG4gICAgICAgICAgICB0eXBlOiBcIkZlYXR1cmVcIixcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgICAgICAgZ2VvbWV0cnk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIkxpbmVTdHJpbmdcIixcbiAgICAgICAgICAgICAgICBjb29yZGluYXRlczogcG9seWdvbi5nZW9tZXRyeS5jb29yZGluYXRlc1tqXVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGZvcih2YXIgayA9IDA7IGsgPCBwdHNXaXRoaW4uZmVhdHVyZXMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgZm9yKHZhciBsID0gMDsgbCA8IHBvbHlnb25Cb3VuZGFyaWVzLmZlYXR1cmVzLmxlbmd0aDsgbCsrKSB7XG4gICAgICAgICAgICBpZihsID09IDApIHtcbiAgICAgICAgICAgICAgICB2ZXJ0ZXhEaXN0YW5jZSA9IHBvaW50T25MaW5lKHBvbHlnb25Cb3VuZGFyaWVzLmZlYXR1cmVzW2xdLCBwdHNXaXRoaW4uZmVhdHVyZXNba10pLnByb3BlcnRpZXMuZGlzdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmVydGV4RGlzdGFuY2UgPSBNYXRoLm1pbih2ZXJ0ZXhEaXN0YW5jZSxcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRPbkxpbmUocG9seWdvbkJvdW5kYXJpZXMuZmVhdHVyZXNbbF0sIHB0c1dpdGhpbi5mZWF0dXJlc1trXSkucHJvcGVydGllcy5kaXN0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZih2ZXJ0ZXhEaXN0YW5jZSA+IGxhYmVsTG9jYXRpb24ubWF4RGlzdCkge1xuICAgICAgICAgICAgbGFiZWxMb2NhdGlvbi5jb29yZGluYXRlcyA9IHB0c1dpdGhpbi5mZWF0dXJlc1trXS5nZW9tZXRyeS5jb29yZGluYXRlcztcbiAgICAgICAgICAgIGxhYmVsTG9jYXRpb24ubWF4RGlzdCA9IHZlcnRleERpc3RhbmNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHBvaW50KGxhYmVsTG9jYXRpb24uY29vcmRpbmF0ZXMpO1xufTtcblxuZnVuY3Rpb24gc2l0ZXMocG9seWdvbikge1xuICAgIHZhciBwb2x5Z29uU2l0ZXMgPSBbXTtcbiAgICB2YXIgeG1pbix4bWF4LHltaW4seW1heDtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgcG9seWdvbi5nZW9tZXRyeS5jb29yZGluYXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcG9seVJpbmcgPSBwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzW2ldLnNsaWNlKCk7XG4gICAgICAgIGZvcih2YXIgaiA9IDA7IGogPCBwb2x5UmluZy5sZW5ndGgtMTsgaisrKSB7XG4gICAgICAgICAgICAvL1B1c2ggb3JpZ2luYWwgcG9pbnRcbiAgICAgICAgICAgIHBvbHlnb25TaXRlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICB4OiBwb2x5UmluZ1tqXVswXSxcbiAgICAgICAgICAgICAgICB5OiBwb2x5UmluZ1tqXVsxXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvL1B1c2ggbWlkcG9pbnRzIG9mIHNlZ21lbnRzXG4gICAgICAgICAgICBwb2x5Z29uU2l0ZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgeDogKHBvbHlSaW5nW2pdWzBdK3BvbHlSaW5nW2orMV1bMF0pLzIsXG4gICAgICAgICAgICAgICAgeTogKHBvbHlSaW5nW2pdWzFdK3BvbHlSaW5nW2orMV1bMV0pLzJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy9pbml0aWFsaXplIGJvdW5kaW5nIGJveFxuICAgICAgICAgICAgaWYoKGkgPT0gMCkgJiYgKGogPT0gMCkpIHtcbiAgICAgICAgICAgICAgICB4bWluID0gcG9seVJpbmdbal1bMF07XG4gICAgICAgICAgICAgICAgeG1heCA9IHhtaW47XG4gICAgICAgICAgICAgICAgeW1pbiA9IHBvbHlSaW5nW2pdWzFdO1xuICAgICAgICAgICAgICAgIHltYXggPSB5bWluO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZihwb2x5UmluZ1tqXVswXSA8IHhtaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgeG1pbiA9IHBvbHlSaW5nW2pdWzBdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZihwb2x5UmluZ1tqXVswXSA+IHhtYXgpIHtcbiAgICAgICAgICAgICAgICAgICAgeG1heCA9IHBvbHlSaW5nW2pdWzBdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZihwb2x5UmluZ1tqXVswXSA8IHltaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgeW1pbiA9IHBvbHlSaW5nW2pdWzFdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZihwb2x5UmluZ1tqXVswXSA+IHltYXgpIHtcbiAgICAgICAgICAgICAgICAgICAgeW1heCA9IHBvbHlSaW5nW2pdWzFdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBzaXRlczogcG9seWdvblNpdGVzLFxuICAgICAgICBiYm94OiB7XG4gICAgICAgICAgICB4bDogeG1pbixcbiAgICAgICAgICAgIHhyOiB4bWF4LFxuICAgICAgICAgICAgeXQ6IHltaW4sXG4gICAgICAgICAgICB5YjogeW1heFxuICAgICAgICB9XG4gICAgfTtcbn0iLCIvL2h0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGF2ZXJzaW5lX2Zvcm11bGFcbi8vaHR0cDovL3d3dy5tb3ZhYmxlLXR5cGUuY28udWsvc2NyaXB0cy9sYXRsb25nLmh0bWxcblxuLyoqXG4gKiBUYWtlcyB0d28ge0BsaW5rIFBvaW50fSBmZWF0dXJlcyBhbmQgZmluZHMgdGhlIGJlYXJpbmcgYmV0d2VlbiB0aGVtLlxuICpcbiAqIEBtb2R1bGUgdHVyZi9iZWFyaW5nXG4gKiBAY2F0ZWdvcnkgbWVhc3VyZW1lbnRcbiAqIEBwYXJhbSB7UG9pbnR9IHN0YXJ0IHN0YXJ0aW5nIFBvaW50XG4gKiBAcGFyYW0ge1BvaW50fSBlbmQgZW5kaW5nIFBvaW50XG4gKiBAY2F0ZWdvcnkgbWVhc3VyZW1lbnRcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IGJlYXJpbmcgaW4gZGVjaW1hbCBkZWdyZWVzXG4gKiBAZXhhbXBsZVxuICogdmFyIHBvaW50MSA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge1xuICogICAgIFwibWFya2VyLWNvbG9yXCI6ICcjZjAwJ1xuICogICB9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWy03NS4zNDMsIDM5Ljk4NF1cbiAqICAgfVxuICogfTtcbiAqIHZhciBwb2ludDIgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAqICAgICBcIm1hcmtlci1jb2xvclwiOiAnIzBmMCdcbiAqICAgfSxcbiAqICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICBcImNvb3JkaW5hdGVzXCI6IFstNzUuNTM0LCAzOS4xMjNdXG4gKiAgIH1cbiAqIH07XG4gKlxuICogdmFyIHBvaW50cyA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAqICAgXCJmZWF0dXJlc1wiOiBbcG9pbnQxLCBwb2ludDJdXG4gKiB9O1xuICpcbiAqIC8vPXBvaW50c1xuICpcbiAqIHZhciBiZWFyaW5nID0gdHVyZi5iZWFyaW5nKHBvaW50MSwgcG9pbnQyKTtcbiAqXG4gKiAvLz1iZWFyaW5nXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHBvaW50MSwgcG9pbnQyKSB7XG4gICAgdmFyIGNvb3JkaW5hdGVzMSA9IHBvaW50MS5nZW9tZXRyeS5jb29yZGluYXRlcztcbiAgICB2YXIgY29vcmRpbmF0ZXMyID0gcG9pbnQyLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuXG4gICAgdmFyIGxvbjEgPSB0b1JhZChjb29yZGluYXRlczFbMF0pO1xuICAgIHZhciBsb24yID0gdG9SYWQoY29vcmRpbmF0ZXMyWzBdKTtcbiAgICB2YXIgbGF0MSA9IHRvUmFkKGNvb3JkaW5hdGVzMVsxXSk7XG4gICAgdmFyIGxhdDIgPSB0b1JhZChjb29yZGluYXRlczJbMV0pO1xuICAgIHZhciBhID0gTWF0aC5zaW4obG9uMiAtIGxvbjEpICogTWF0aC5jb3MobGF0Mik7XG4gICAgdmFyIGIgPSBNYXRoLmNvcyhsYXQxKSAqIE1hdGguc2luKGxhdDIpIC1cbiAgICAgICAgTWF0aC5zaW4obGF0MSkgKiBNYXRoLmNvcyhsYXQyKSAqIE1hdGguY29zKGxvbjIgLSBsb24xKTtcblxuICAgIHZhciBiZWFyaW5nID0gdG9EZWcoTWF0aC5hdGFuMihhLCBiKSk7XG5cbiAgICByZXR1cm4gYmVhcmluZztcbn07XG5cbmZ1bmN0aW9uIHRvUmFkKGRlZ3JlZSkge1xuICAgIHJldHVybiBkZWdyZWUgKiBNYXRoLlBJIC8gMTgwO1xufVxuXG5mdW5jdGlvbiB0b0RlZyhyYWRpYW4pIHtcbiAgICByZXR1cm4gcmFkaWFuICogMTgwIC8gTWF0aC5QSTtcbn1cbiIsIi8vaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9IYXZlcnNpbmVfZm9ybXVsYVxuLy9odHRwOi8vd3d3Lm1vdmFibGUtdHlwZS5jby51ay9zY3JpcHRzL2xhdGxvbmcuaHRtbFxudmFyIHBvaW50ID0gcmVxdWlyZSgndHVyZi1wb2ludCcpO1xuXG4vKipcbiAqIFRha2VzIGEge0BsaW5rIFBvaW50fSBmZWF0dXJlIGFuZCBjYWxjdWxhdGVzIHRoZSBsb2NhdGlvbiBvZiBhIGRlc3RpbmF0aW9uIHBvaW50IGdpdmVuIGEgZGlzdGFuY2UgaW4gZGVncmVlcywgcmFkaWFucywgbWlsZXMsIG9yIGtpbG9tZXRlcnM7IGFuZCBiZWFyaW5nIGluIGRlZ3JlZXMuIFRoaXMgdXNlcyB0aGUgW0hhdmVyc2luZSBmb3JtdWxhXShodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0hhdmVyc2luZV9mb3JtdWxhKSB0byBhY2NvdW50IGZvciBnbG9iYWwgY3VydmF0dXJlLlxuICpcbiAqIEBtb2R1bGUgdHVyZi9kZXN0aW5hdGlvblxuICogQGNhdGVnb3J5IG1lYXN1cmVtZW50XG4gKiBAcGFyYW0ge1BvaW50fSBzdGFydCBhIFBvaW50IGZlYXR1cmUgYXQgdGhlIHN0YXJ0aW5nIHBvaW50XG4gKiBAcGFyYW0ge051bWJlcn0gZGlzdGFuY2UgZGlzdGFuY2UgZnJvbSB0aGUgc3RhcnRpbmcgcG9pbnRcbiAqIEBwYXJhbSB7TnVtYmVyfSBiZWFyaW5nIHJhbmdpbmcgZnJvbSAtMTgwIHRvIDE4MFxuICogQHBhcmFtIHtTdHJpbmd9IHVuaXRzIG1pbGVzLCBraWxvbWV0ZXJzLCBkZWdyZWVzLCBvciByYWRpYW5zXG4gKiBAcmV0dXJucyB7UG9pbnR9IGEgUG9pbnQgZmVhdHVyZSBhdCB0aGUgZGVzdGluYXRpb25cbiAqIEBleGFtcGxlXG4gKiB2YXIgcG9pbnQgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAqICAgICBcIm1hcmtlci1jb2xvclwiOiBcIiMwZjBcIlxuICogICB9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWy03NS4zNDMsIDM5Ljk4NF1cbiAqICAgfVxuICogfTtcbiAqIHZhciBkaXN0YW5jZSA9IDUwO1xuICogdmFyIGJlYXJpbmcgPSA5MDtcbiAqIHZhciB1bml0cyA9ICdtaWxlcyc7XG4gKlxuICogdmFyIGRlc3RpbmF0aW9uID0gdHVyZi5kZXN0aW5hdGlvbihwb2ludCwgZGlzdGFuY2UsIGJlYXJpbmcsIHVuaXRzKTtcbiAqIGRlc3RpbmF0aW9uLnByb3BlcnRpZXNbJ21hcmtlci1jb2xvciddID0gJyNmMDAnO1xuICpcbiAqIHZhciByZXN1bHQgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gKiAgIFwiZmVhdHVyZXNcIjogW3BvaW50LCBkZXN0aW5hdGlvbl1cbiAqIH07XG4gKlxuICogLy89cmVzdWx0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHBvaW50MSwgZGlzdGFuY2UsIGJlYXJpbmcsIHVuaXRzKSB7XG4gICAgdmFyIGNvb3JkaW5hdGVzMSA9IHBvaW50MS5nZW9tZXRyeS5jb29yZGluYXRlcztcbiAgICB2YXIgbG9uZ2l0dWRlMSA9IHRvUmFkKGNvb3JkaW5hdGVzMVswXSk7XG4gICAgdmFyIGxhdGl0dWRlMSA9IHRvUmFkKGNvb3JkaW5hdGVzMVsxXSk7XG4gICAgdmFyIGJlYXJpbmdfcmFkID0gdG9SYWQoYmVhcmluZyk7XG5cbiAgICB2YXIgUiA9IDA7XG4gICAgc3dpdGNoICh1bml0cykge1xuICAgIGNhc2UgJ21pbGVzJzpcbiAgICAgICAgUiA9IDM5NjA7XG4gICAgICAgIGJyZWFrXG4gICAgY2FzZSAna2lsb21ldGVycyc6XG4gICAgICAgIFIgPSA2MzczO1xuICAgICAgICBicmVha1xuICAgIGNhc2UgJ2RlZ3JlZXMnOlxuICAgICAgICBSID0gNTcuMjk1Nzc5NTtcbiAgICAgICAgYnJlYWtcbiAgICBjYXNlICdyYWRpYW5zJzpcbiAgICAgICAgUiA9IDE7XG4gICAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgdmFyIGxhdGl0dWRlMiA9IE1hdGguYXNpbihNYXRoLnNpbihsYXRpdHVkZTEpICogTWF0aC5jb3MoZGlzdGFuY2UgLyBSKSArXG4gICAgICAgIE1hdGguY29zKGxhdGl0dWRlMSkgKiBNYXRoLnNpbihkaXN0YW5jZSAvIFIpICogTWF0aC5jb3MoYmVhcmluZ19yYWQpKTtcbiAgICB2YXIgbG9uZ2l0dWRlMiA9IGxvbmdpdHVkZTEgKyBNYXRoLmF0YW4yKE1hdGguc2luKGJlYXJpbmdfcmFkKSAqIE1hdGguc2luKGRpc3RhbmNlIC8gUikgKiBNYXRoLmNvcyhsYXRpdHVkZTEpLFxuICAgICAgICBNYXRoLmNvcyhkaXN0YW5jZSAvIFIpIC0gTWF0aC5zaW4obGF0aXR1ZGUxKSAqIE1hdGguc2luKGxhdGl0dWRlMikpO1xuXG4gICAgcmV0dXJuIHBvaW50KFt0b0RlZyhsb25naXR1ZGUyKSwgdG9EZWcobGF0aXR1ZGUyKV0pO1xufTtcblxuZnVuY3Rpb24gdG9SYWQoZGVncmVlKSB7XG4gICAgcmV0dXJuIGRlZ3JlZSAqIE1hdGguUEkgLyAxODA7XG59XG5cbmZ1bmN0aW9uIHRvRGVnKHJhZCkge1xuICAgIHJldHVybiByYWQgKiAxODAgLyBNYXRoLlBJO1xufVxuIiwidmFyIGludmFyaWFudCA9IHJlcXVpcmUoJ3R1cmYtaW52YXJpYW50Jyk7XG4vL2h0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGF2ZXJzaW5lX2Zvcm11bGFcbi8vaHR0cDovL3d3dy5tb3ZhYmxlLXR5cGUuY28udWsvc2NyaXB0cy9sYXRsb25nLmh0bWxcblxuLyoqXG4gKiBUYWtlcyB0d28ge0BsaW5rIFBvaW50fSBmZWF0dXJlcyBhbmQgY2FsY3VsYXRlc1xuICogdGhlIGRpc3RhbmNlIGJldHdlZW4gdGhlbSBpbiBkZWdyZXNzLCByYWRpYW5zLFxuICogbWlsZXMsIG9yIGtpbG9tZXRlcnMuIFRoaXMgdXNlcyB0aGVcbiAqIFtIYXZlcnNpbmUgZm9ybXVsYV0oaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9IYXZlcnNpbmVfZm9ybXVsYSlcbiAqIHRvIGFjY291bnQgZm9yIGdsb2JhbCBjdXJ2YXR1cmUuXG4gKlxuICogQG1vZHVsZSB0dXJmL2Rpc3RhbmNlXG4gKiBAY2F0ZWdvcnkgbWVhc3VyZW1lbnRcbiAqIEBwYXJhbSB7RmVhdHVyZX0gZnJvbSBvcmlnaW4gcG9pbnRcbiAqIEBwYXJhbSB7RmVhdHVyZX0gdG8gZGVzdGluYXRpb24gcG9pbnRcbiAqIEBwYXJhbSB7U3RyaW5nfSBbdW5pdHM9a2lsb21ldGVyc10gY2FuIGJlIGRlZ3JlZXMsIHJhZGlhbnMsIG1pbGVzLCBvciBraWxvbWV0ZXJzXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IGRpc3RhbmNlIGJldHdlZW4gdGhlIHR3byBwb2ludHNcbiAqIEBleGFtcGxlXG4gKiB2YXIgcG9pbnQxID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICBcImNvb3JkaW5hdGVzXCI6IFstNzUuMzQzLCAzOS45ODRdXG4gKiAgIH1cbiAqIH07XG4gKiB2YXIgcG9pbnQyID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICBcImNvb3JkaW5hdGVzXCI6IFstNzUuNTM0LCAzOS4xMjNdXG4gKiAgIH1cbiAqIH07XG4gKiB2YXIgdW5pdHMgPSBcIm1pbGVzXCI7XG4gKlxuICogdmFyIHBvaW50cyA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAqICAgXCJmZWF0dXJlc1wiOiBbcG9pbnQxLCBwb2ludDJdXG4gKiB9O1xuICpcbiAqIC8vPXBvaW50c1xuICpcbiAqIHZhciBkaXN0YW5jZSA9IHR1cmYuZGlzdGFuY2UocG9pbnQxLCBwb2ludDIsIHVuaXRzKTtcbiAqXG4gKiAvLz1kaXN0YW5jZVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBvaW50MSwgcG9pbnQyLCB1bml0cyl7XG4gIGludmFyaWFudC5mZWF0dXJlT2YocG9pbnQxLCAnUG9pbnQnLCAnZGlzdGFuY2UnKTtcbiAgaW52YXJpYW50LmZlYXR1cmVPZihwb2ludDIsICdQb2ludCcsICdkaXN0YW5jZScpO1xuICB2YXIgY29vcmRpbmF0ZXMxID0gcG9pbnQxLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICB2YXIgY29vcmRpbmF0ZXMyID0gcG9pbnQyLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuXG4gIHZhciBkTGF0ID0gdG9SYWQoY29vcmRpbmF0ZXMyWzFdIC0gY29vcmRpbmF0ZXMxWzFdKTtcbiAgdmFyIGRMb24gPSB0b1JhZChjb29yZGluYXRlczJbMF0gLSBjb29yZGluYXRlczFbMF0pO1xuICB2YXIgbGF0MSA9IHRvUmFkKGNvb3JkaW5hdGVzMVsxXSk7XG4gIHZhciBsYXQyID0gdG9SYWQoY29vcmRpbmF0ZXMyWzFdKTtcbiAgdmFyIGEgPSBNYXRoLnNpbihkTGF0LzIpICogTWF0aC5zaW4oZExhdC8yKSArXG4gICAgICAgICAgTWF0aC5zaW4oZExvbi8yKSAqIE1hdGguc2luKGRMb24vMikgKiBNYXRoLmNvcyhsYXQxKSAqIE1hdGguY29zKGxhdDIpO1xuICB2YXIgYyA9IDIgKiBNYXRoLmF0YW4yKE1hdGguc3FydChhKSwgTWF0aC5zcXJ0KDEtYSkpO1xuXG4gIHZhciBSO1xuICBzd2l0Y2godW5pdHMpe1xuICAgIGNhc2UgJ21pbGVzJzpcbiAgICAgIFIgPSAzOTYwO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAna2lsb21ldGVycyc6XG4gICAgICBSID0gNjM3MztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2RlZ3JlZXMnOlxuICAgICAgUiA9IDU3LjI5NTc3OTU7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdyYWRpYW5zJzpcbiAgICAgIFIgPSAxO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICBSID0gNjM3MztcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vua25vd24gb3B0aW9uIGdpdmVuIHRvIFwidW5pdHNcIicpO1xuICB9XG5cbiAgdmFyIGRpc3RhbmNlID0gUiAqIGM7XG4gIHJldHVybiBkaXN0YW5jZTtcbn07XG5cbmZ1bmN0aW9uIHRvUmFkKGRlZ3JlZSkge1xuICByZXR1cm4gZGVncmVlICogTWF0aC5QSSAvIDE4MDtcbn1cbiIsIm1vZHVsZS5leHBvcnRzLmdlb2pzb25UeXBlID0gZ2VvanNvblR5cGU7XG5tb2R1bGUuZXhwb3J0cy5jb2xsZWN0aW9uT2YgPSBjb2xsZWN0aW9uT2Y7XG5tb2R1bGUuZXhwb3J0cy5mZWF0dXJlT2YgPSBmZWF0dXJlT2Y7XG5cbi8qKlxuICogRW5mb3JjZSBleHBlY3RhdGlvbnMgYWJvdXQgdHlwZXMgb2YgR2VvSlNPTiBvYmplY3RzIGZvciBUdXJmLlxuICpcbiAqIEBhbGlhcyBnZW9qc29uVHlwZVxuICogQHBhcmFtIHtHZW9KU09OfSB2YWx1ZSBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIGV4cGVjdGVkIEdlb0pTT04gdHlwZVxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgbmFtZSBvZiBjYWxsaW5nIGZ1bmN0aW9uXG4gKiBAdGhyb3dzIEVycm9yIGlmIHZhbHVlIGlzIG5vdCB0aGUgZXhwZWN0ZWQgdHlwZS5cbiAqL1xuZnVuY3Rpb24gZ2VvanNvblR5cGUodmFsdWUsIHR5cGUsIG5hbWUpIHtcbiAgICBpZiAoIXR5cGUgfHwgIW5hbWUpIHRocm93IG5ldyBFcnJvcigndHlwZSBhbmQgbmFtZSByZXF1aXJlZCcpO1xuXG4gICAgaWYgKCF2YWx1ZSB8fCB2YWx1ZS50eXBlICE9PSB0eXBlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBpbnB1dCB0byAnICsgbmFtZSArICc6IG11c3QgYmUgYSAnICsgdHlwZSArICcsIGdpdmVuICcgKyB2YWx1ZS50eXBlKTtcbiAgICB9XG59XG5cbi8qKlxuICogRW5mb3JjZSBleHBlY3RhdGlvbnMgYWJvdXQgdHlwZXMgb2Yge0BsaW5rIEZlYXR1cmV9IGlucHV0cyBmb3IgVHVyZi5cbiAqIEludGVybmFsbHkgdGhpcyB1c2VzIHtAbGluayBnZW9qc29uVHlwZX0gdG8ganVkZ2UgZ2VvbWV0cnkgdHlwZXMuXG4gKlxuICogQGFsaWFzIGZlYXR1cmVPZlxuICogQHBhcmFtIHtGZWF0dXJlfSBmZWF0dXJlIGEgZmVhdHVyZSB3aXRoIGFuIGV4cGVjdGVkIGdlb21ldHJ5IHR5cGVcbiAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIGV4cGVjdGVkIEdlb0pTT04gdHlwZVxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgbmFtZSBvZiBjYWxsaW5nIGZ1bmN0aW9uXG4gKiBAdGhyb3dzIEVycm9yIGlmIHZhbHVlIGlzIG5vdCB0aGUgZXhwZWN0ZWQgdHlwZS5cbiAqL1xuZnVuY3Rpb24gZmVhdHVyZU9mKHZhbHVlLCB0eXBlLCBuYW1lKSB7XG4gICAgaWYgKCFuYW1lKSB0aHJvdyBuZXcgRXJyb3IoJy5mZWF0dXJlT2YoKSByZXF1aXJlcyBhIG5hbWUnKTtcbiAgICBpZiAoIXZhbHVlIHx8IHZhbHVlLnR5cGUgIT09ICdGZWF0dXJlJyB8fCAhdmFsdWUuZ2VvbWV0cnkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGlucHV0IHRvICcgKyBuYW1lICsgJywgRmVhdHVyZSB3aXRoIGdlb21ldHJ5IHJlcXVpcmVkJyk7XG4gICAgfVxuICAgIGlmICghdmFsdWUuZ2VvbWV0cnkgfHwgdmFsdWUuZ2VvbWV0cnkudHlwZSAhPT0gdHlwZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW5wdXQgdG8gJyArIG5hbWUgKyAnOiBtdXN0IGJlIGEgJyArIHR5cGUgKyAnLCBnaXZlbiAnICsgdmFsdWUuZ2VvbWV0cnkudHlwZSk7XG4gICAgfVxufVxuXG4vKipcbiAqIEVuZm9yY2UgZXhwZWN0YXRpb25zIGFib3V0IHR5cGVzIG9mIHtAbGluayBGZWF0dXJlQ29sbGVjdGlvbn0gaW5wdXRzIGZvciBUdXJmLlxuICogSW50ZXJuYWxseSB0aGlzIHVzZXMge0BsaW5rIGdlb2pzb25UeXBlfSB0byBqdWRnZSBnZW9tZXRyeSB0eXBlcy5cbiAqXG4gKiBAYWxpYXMgY29sbGVjdGlvbk9mXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufSBmZWF0dXJlY29sbGVjdGlvbiBhIGZlYXR1cmVjb2xsZWN0aW9uIGZvciB3aGljaCBmZWF0dXJlcyB3aWxsIGJlIGp1ZGdlZFxuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgZXhwZWN0ZWQgR2VvSlNPTiB0eXBlXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBuYW1lIG9mIGNhbGxpbmcgZnVuY3Rpb25cbiAqIEB0aHJvd3MgRXJyb3IgaWYgdmFsdWUgaXMgbm90IHRoZSBleHBlY3RlZCB0eXBlLlxuICovXG5mdW5jdGlvbiBjb2xsZWN0aW9uT2YodmFsdWUsIHR5cGUsIG5hbWUpIHtcbiAgICBpZiAoIW5hbWUpIHRocm93IG5ldyBFcnJvcignLmNvbGxlY3Rpb25PZigpIHJlcXVpcmVzIGEgbmFtZScpO1xuICAgIGlmICghdmFsdWUgfHwgdmFsdWUudHlwZSAhPT0gJ0ZlYXR1cmVDb2xsZWN0aW9uJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW5wdXQgdG8gJyArIG5hbWUgKyAnLCBGZWF0dXJlQ29sbGVjdGlvbiByZXF1aXJlZCcpO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZhbHVlLmZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBmZWF0dXJlID0gdmFsdWUuZmVhdHVyZXNbaV07XG4gICAgICAgIGlmICghZmVhdHVyZSB8fCBmZWF0dXJlLnR5cGUgIT09ICdGZWF0dXJlJyB8fCAhZmVhdHVyZS5nZW9tZXRyeSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGlucHV0IHRvICcgKyBuYW1lICsgJywgRmVhdHVyZSB3aXRoIGdlb21ldHJ5IHJlcXVpcmVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFmZWF0dXJlLmdlb21ldHJ5IHx8IGZlYXR1cmUuZ2VvbWV0cnkudHlwZSAhPT0gdHlwZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGlucHV0IHRvICcgKyBuYW1lICsgJzogbXVzdCBiZSBhICcgKyB0eXBlICsgJywgZ2l2ZW4gJyArIGZlYXR1cmUuZ2VvbWV0cnkudHlwZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCIvKipcbiAqIFRha2VzIG9uZSBvciBtb3JlIHtAbGluayBGZWF0dXJlfEZlYXR1cmVzfSBhbmQgY3JlYXRlcyBhIHtAbGluayBGZWF0dXJlQ29sbGVjdGlvbn1cbiAqXG4gKiBAbW9kdWxlIHR1cmYvZmVhdHVyZWNvbGxlY3Rpb25cbiAqIEBjYXRlZ29yeSBoZWxwZXJcbiAqIEBwYXJhbSB7RmVhdHVyZX0gZmVhdHVyZXMgaW5wdXQgRmVhdHVyZXNcbiAqIEByZXR1cm5zIHtGZWF0dXJlQ29sbGVjdGlvbn0gYSBGZWF0dXJlQ29sbGVjdGlvbiBvZiBpbnB1dCBmZWF0dXJlc1xuICogQGV4YW1wbGVcbiAqIHZhciBmZWF0dXJlcyA9IFtcbiAqICB0dXJmLnBvaW50KFstNzUuMzQzLCAzOS45ODRdLCB7bmFtZTogJ0xvY2F0aW9uIEEnfSksXG4gKiAgdHVyZi5wb2ludChbLTc1LjgzMywgMzkuMjg0XSwge25hbWU6ICdMb2NhdGlvbiBCJ30pLFxuICogIHR1cmYucG9pbnQoWy03NS41MzQsIDM5LjEyM10sIHtuYW1lOiAnTG9jYXRpb24gQyd9KVxuICogXTtcbiAqXG4gKiB2YXIgZmMgPSB0dXJmLmZlYXR1cmVjb2xsZWN0aW9uKGZlYXR1cmVzKTtcbiAqXG4gKiAvLz1mY1xuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGZlYXR1cmVzKXtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gICAgZmVhdHVyZXM6IGZlYXR1cmVzXG4gIH07XG59O1xuIiwiLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9FdmVuJUUyJTgwJTkzb2RkX3J1bGVcbi8vIG1vZGlmaWVkIGZyb206IGh0dHBzOi8vZ2l0aHViLmNvbS9zdWJzdGFjay9wb2ludC1pbi1wb2x5Z29uL2Jsb2IvbWFzdGVyL2luZGV4LmpzXG4vLyB3aGljaCB3YXMgbW9kaWZpZWQgZnJvbSBodHRwOi8vd3d3LmVjc2UucnBpLmVkdS9Ib21lcGFnZXMvd3JmL1Jlc2VhcmNoL1Nob3J0X05vdGVzL3BucG9seS5odG1sXG5cbi8qKlxuICogVGFrZXMgYSB7QGxpbmsgUG9pbnR9IGZlYXR1cmUgYW5kIGEge0BsaW5rIFBvbHlnb259IGZlYXR1cmUgYW5kIGRldGVybWluZXMgaWYgdGhlIFBvaW50IHJlc2lkZXMgaW5zaWRlIHRoZSBQb2x5Z29uLiBUaGUgUG9seWdvbiBjYW5cbiAqIGJlIGNvbnZleCBvciBjb25jYXZlLiBUaGUgZnVuY3Rpb24gYWNjZXB0cyBhbnkgdmFsaWQgUG9seWdvbiBvciB7QGxpbmsgTXVsdGlQb2x5Z29ufVxuICogYW5kIGFjY291bnRzIGZvciBob2xlcy5cbiAqXG4gKiBAbW9kdWxlIHR1cmYvaW5zaWRlXG4gKiBAY2F0ZWdvcnkgam9pbnNcbiAqIEBwYXJhbSB7UG9pbnR9IHBvaW50IGEgUG9pbnQgZmVhdHVyZVxuICogQHBhcmFtIHtQb2x5Z29ufSBwb2x5Z29uIGEgUG9seWdvbiBmZWF0dXJlXG4gKiBAcmV0dXJuIHtCb29sZWFufSBgdHJ1ZWAgaWYgdGhlIFBvaW50IGlzIGluc2lkZSB0aGUgUG9seWdvbjsgYGZhbHNlYCBpZiB0aGUgUG9pbnQgaXMgbm90IGluc2lkZSB0aGUgUG9seWdvblxuICogQGV4YW1wbGVcbiAqIHZhciBwdDEgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAqICAgICBcIm1hcmtlci1jb2xvclwiOiBcIiNmMDBcIlxuICogICB9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWy0xMTEuNDY3Mjg1LCA0MC43NTc2Nl1cbiAqICAgfVxuICogfTtcbiAqIHZhciBwdDIgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAqICAgICBcIm1hcmtlci1jb2xvclwiOiBcIiMwZjBcIlxuICogICB9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWy0xMTEuODczNzc5LCA0MC42NDczMDNdXG4gKiAgIH1cbiAqIH07XG4gKiB2YXIgcG9seSA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgIFwidHlwZVwiOiBcIlBvbHlnb25cIixcbiAqICAgICBcImNvb3JkaW5hdGVzXCI6IFtbXG4gKiAgICAgICBbLTExMi4wNzQyNzksIDQwLjUyMjE1XSxcbiAqICAgICAgIFstMTEyLjA3NDI3OSwgNDAuODUzMjkzXSxcbiAqICAgICAgIFstMTExLjYxMDEwNywgNDAuODUzMjkzXSxcbiAqICAgICAgIFstMTExLjYxMDEwNywgNDAuNTIyMTVdLFxuICogICAgICAgWy0xMTIuMDc0Mjc5LCA0MC41MjIxNV1cbiAqICAgICBdXVxuICogICB9XG4gKiB9O1xuICpcbiAqIHZhciBmZWF0dXJlcyA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAqICAgXCJmZWF0dXJlc1wiOiBbcHQxLCBwdDIsIHBvbHldXG4gKiB9O1xuICpcbiAqIC8vPWZlYXR1cmVzXG4gKlxuICogdmFyIGlzSW5zaWRlMSA9IHR1cmYuaW5zaWRlKHB0MSwgcG9seSk7XG4gKiAvLz1pc0luc2lkZTFcbiAqXG4gKiB2YXIgaXNJbnNpZGUyID0gdHVyZi5pbnNpZGUocHQyLCBwb2x5KTtcbiAqIC8vPWlzSW5zaWRlMlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBvaW50LCBwb2x5Z29uKSB7XG4gIHZhciBwb2x5cyA9IHBvbHlnb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG4gIHZhciBwdCA9IFtwb2ludC5nZW9tZXRyeS5jb29yZGluYXRlc1swXSwgcG9pbnQuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV1dO1xuICAvLyBub3JtYWxpemUgdG8gbXVsdGlwb2x5Z29uXG4gIGlmKHBvbHlnb24uZ2VvbWV0cnkudHlwZSA9PT0gJ1BvbHlnb24nKSBwb2x5cyA9IFtwb2x5c107XG5cbiAgdmFyIGluc2lkZVBvbHkgPSBmYWxzZTtcbiAgdmFyIGkgPSAwO1xuICB3aGlsZSAoaSA8IHBvbHlzLmxlbmd0aCAmJiAhaW5zaWRlUG9seSkge1xuICAgIC8vIGNoZWNrIGlmIGl0IGlzIGluIHRoZSBvdXRlciByaW5nIGZpcnN0XG4gICAgaWYoaW5SaW5nKHB0LCBwb2x5c1tpXVswXSkpIHtcbiAgICAgIHZhciBpbkhvbGUgPSBmYWxzZTtcbiAgICAgIHZhciBrID0gMTtcbiAgICAgIC8vIGNoZWNrIGZvciB0aGUgcG9pbnQgaW4gYW55IG9mIHRoZSBob2xlc1xuICAgICAgd2hpbGUoayA8IHBvbHlzW2ldLmxlbmd0aCAmJiAhaW5Ib2xlKSB7XG4gICAgICAgIGlmKGluUmluZyhwdCwgcG9seXNbaV1ba10pKSB7XG4gICAgICAgICAgaW5Ib2xlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBrKys7XG4gICAgICB9XG4gICAgICBpZighaW5Ib2xlKSBpbnNpZGVQb2x5ID0gdHJ1ZTtcbiAgICB9XG4gICAgaSsrO1xuICB9XG4gIHJldHVybiBpbnNpZGVQb2x5O1xufVxuXG4vLyBwdCBpcyBbeCx5XSBhbmQgcmluZyBpcyBbW3gseV0sIFt4LHldLC4uXVxuZnVuY3Rpb24gaW5SaW5nIChwdCwgcmluZykge1xuICB2YXIgaXNJbnNpZGUgPSBmYWxzZTtcbiAgZm9yICh2YXIgaSA9IDAsIGogPSByaW5nLmxlbmd0aCAtIDE7IGkgPCByaW5nLmxlbmd0aDsgaiA9IGkrKykge1xuICAgIHZhciB4aSA9IHJpbmdbaV1bMF0sIHlpID0gcmluZ1tpXVsxXTtcbiAgICB2YXIgeGogPSByaW5nW2pdWzBdLCB5aiA9IHJpbmdbal1bMV07XG4gICAgXG4gICAgdmFyIGludGVyc2VjdCA9ICgoeWkgPiBwdFsxXSkgIT0gKHlqID4gcHRbMV0pKVxuICAgICAgICAmJiAocHRbMF0gPCAoeGogLSB4aSkgKiAocHRbMV0gLSB5aSkgLyAoeWogLSB5aSkgKyB4aSk7XG4gICAgaWYgKGludGVyc2VjdCkgaXNJbnNpZGUgPSAhaXNJbnNpZGU7XG4gIH1cbiAgcmV0dXJuIGlzSW5zaWRlO1xufVxuXG4iLCIvKipcbiAqIENyZWF0ZXMgYSB7QGxpbmsgTGluZVN0cmluZ30ge0BsaW5rIEZlYXR1cmV9IGJhc2VkIG9uIGFcbiAqIGNvb3JkaW5hdGUgYXJyYXkuIFByb3BlcnRpZXMgY2FuIGJlIGFkZGVkIG9wdGlvbmFsbHkuXG4gKlxuICogQG1vZHVsZSB0dXJmL2xpbmVzdHJpbmdcbiAqIEBjYXRlZ29yeSBoZWxwZXJcbiAqIEBwYXJhbSB7QXJyYXk8QXJyYXk8TnVtYmVyPj59IGNvb3JkaW5hdGVzIGFuIGFycmF5IG9mIFBvc2l0aW9uc1xuICogQHBhcmFtIHtPYmplY3R9IHByb3BlcnRpZXMgYW4gT2JqZWN0IG9mIGtleS12YWx1ZSBwYWlycyB0byBhZGQgYXMgcHJvcGVydGllc1xuICogQHJldHVybiB7TGluZVN0cmluZ30gYSBMaW5lU3RyaW5nIGZlYXR1cmVcbiAqIEB0aHJvd3Mge0Vycm9yfSBpZiBubyBjb29yZGluYXRlcyBhcmUgcGFzc2VkXG4gKiBAZXhhbXBsZVxuICogdmFyIGxpbmVzdHJpbmcxID0gdHVyZi5saW5lc3RyaW5nKFtcbiAqXHRbLTIxLjk2NDQxNiwgNjQuMTQ4MjAzXSxcbiAqXHRbLTIxLjk1NjE3NiwgNjQuMTQxMzE2XSxcbiAqXHRbLTIxLjkzOTAxLCA2NC4xMzU5MjRdLFxuICpcdFstMjEuOTI3MzM3LCA2NC4xMzY2NzNdXG4gKiBdKTtcbiAqIHZhciBsaW5lc3RyaW5nMiA9IHR1cmYubGluZXN0cmluZyhbXG4gKlx0Wy0yMS45MjkwNTQsIDY0LjEyNzk4NV0sXG4gKlx0Wy0yMS45MTI5MTgsIDY0LjEzNDcyNl0sXG4gKlx0Wy0yMS45MTYwMDcsIDY0LjE0MTAxNl0sXG4gKiBcdFstMjEuOTMwMDg0LCA2NC4xNDQ0Nl1cbiAqIF0sIHtuYW1lOiAnbGluZSAxJywgZGlzdGFuY2U6IDE0NX0pO1xuICpcbiAqIC8vPWxpbmVzdHJpbmcxXG4gKlxuICogLy89bGluZXN0cmluZzJcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjb29yZGluYXRlcywgcHJvcGVydGllcyl7XG4gIGlmICghY29vcmRpbmF0ZXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gY29vcmRpbmF0ZXMgcGFzc2VkJyk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gICAgXCJnZW9tZXRyeVwiOiB7XG4gICAgICBcInR5cGVcIjogXCJMaW5lU3RyaW5nXCIsXG4gICAgICBcImNvb3JkaW5hdGVzXCI6IGNvb3JkaW5hdGVzXG4gICAgfSxcbiAgICBcInByb3BlcnRpZXNcIjogcHJvcGVydGllcyB8fCB7fVxuICB9O1xufTtcbiIsInZhciBkaXN0YW5jZSA9IHJlcXVpcmUoJ3R1cmYtZGlzdGFuY2UnKTtcbnZhciBwb2ludCA9IHJlcXVpcmUoJ3R1cmYtcG9pbnQnKTtcbnZhciBsaW5lc3RyaW5nID0gcmVxdWlyZSgndHVyZi1saW5lc3RyaW5nJyk7XG52YXIgYmVhcmluZyA9IHJlcXVpcmUoJ3R1cmYtYmVhcmluZycpO1xudmFyIGRlc3RpbmF0aW9uID0gcmVxdWlyZSgndHVyZi1kZXN0aW5hdGlvbicpO1xuXG4vKipcbiAqIFRha2VzIGEgUG9pbnQgYW5kIGEgTGluZVN0cmluZyBhbmQgY2FsY3VsYXRlcyB0aGUgY2xvc2VzdCBQb2ludCBvbiB0aGUgTGluZVN0cmluZ1xuICpcbiAqIEBtb2R1bGUgdHVyZi9wb2ludC1vbi1saW5lXG4gKlxuICogQHBhcmFtIHtMaW5lU3RyaW5nfSBMaW5lIHRvIHNuYXAgdG9cbiAqIEBwYXJhbSB7UG9pbnR9IFBvaW50IHRvIHNuYXAgZnJvbVxuICogQHJldHVybiB7UG9pbnR9IENsb3Nlc3QgUG9pbnQgb24gdGhlIExpbmVcbiAqIEBleGFtcGxlXG4gKiB2YXIgbGluZSA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgIFwidHlwZVwiOiBcIkxpbmVTdHJpbmdcIixcbiAqICAgICBcImNvb3JkaW5hdGVzXCI6IFtcbiAqICAgICAgIFstNzcuMDMxNjY5LCAzOC44Nzg2MDVdLFxuICogICAgICAgWy03Ny4wMjk2MDksIDM4Ljg4MTk0Nl0sXG4gKiAgICAgICBbLTc3LjAyMDMzOSwgMzguODg0MDg0XSxcbiAqICAgICAgIFstNzcuMDI1NjYxLCAzOC44ODU4MjFdLFxuICogICAgICAgWy03Ny4wMjE4ODQsIDM4Ljg4OTU2M10sXG4gKiAgICAgICBbLTc3LjAxOTgyNCwgMzguODkyMzY4XVxuICogICAgIF1cbiAqICAgfVxuICogfTtcbiAqIHZhciBwdCA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbLTc3LjAzNzA3NiwgMzguODg0MDE3XVxuICogICB9XG4gKiB9O1xuICogXG4gKiB2YXIgc25hcHBlZCA9IHR1cmYucG9pbnRPbkxpbmUobGluZSwgcHQpO1xuICogc25hcHBlZC5wcm9wZXJ0aWVzWydtYXJrZXItY29sb3InXSA9ICcjMDBmJ1xuICpcbiAqIHZhciByZXN1bHQgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gKiAgIFwiZmVhdHVyZXNcIjogW2xpbmUsIHB0LCBzbmFwcGVkXVxuICogfTtcbiAqXG4gKiAvLz1yZXN1bHRcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChsaW5lLCBwdCkgeyAgXG4gIHZhciBjb29yZHM7XG4gIGlmKGxpbmUudHlwZSA9PT0gJ0ZlYXR1cmUnKSBjb29yZHMgPSBsaW5lLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICBlbHNlIGlmKGxpbmUudHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSBjb29yZHMgPSBsaW5lLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICBlbHNlIHRocm93IG5ldyBFcnJvcignaW5wdXQgbXVzdCBiZSBhIExpbmVTdHJpbmcgRmVhdHVyZSBvciBHZW9tZXRyeScpO1xuXG4gIHJldHVybiBwb2ludE9uTGluZShwdCwgY29vcmRzKTtcbn1cblxuZnVuY3Rpb24gcG9pbnRPbkxpbmUgKHB0LCBjb29yZHMpIHtcbiAgdmFyIHVuaXRzID0gJ21pbGVzJ1xuICB2YXIgY2xvc2VzdFB0ID0gcG9pbnQoW0luZmluaXR5LCBJbmZpbml0eV0sIHtkaXN0OiBJbmZpbml0eX0pO1xuICBmb3IodmFyIGkgPSAwOyBpIDwgY29vcmRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgIHZhciBzdGFydCA9IHBvaW50KGNvb3Jkc1tpXSlcbiAgICB2YXIgc3RvcCA9IHBvaW50KGNvb3Jkc1tpKzFdKVxuICAgIC8vc3RhcnRcbiAgICBzdGFydC5wcm9wZXJ0aWVzLmRpc3QgPSBkaXN0YW5jZShwdCwgc3RhcnQsIHVuaXRzKTtcbiAgICAvL3N0b3BcbiAgICBzdG9wLnByb3BlcnRpZXMuZGlzdCA9IGRpc3RhbmNlKHB0LCBzdG9wLCB1bml0cyk7XG4gICAgLy9wZXJwZW5kaWN1bGFyXG4gICAgdmFyIGRpcmVjdGlvbiA9IGJlYXJpbmcoc3RhcnQsIHN0b3ApXG4gICAgdmFyIHBlcnBlbmRpY3VsYXJQdCA9IGRlc3RpbmF0aW9uKHB0LCAxMDAwICwgZGlyZWN0aW9uICsgOTAsIHVuaXRzKSAvLyAxMDAwID0gZ3Jvc3NcbiAgICB2YXIgaW50ZXJzZWN0ID0gbGluZUludGVyc2VjdHMoXG4gICAgICBwdC5nZW9tZXRyeS5jb29yZGluYXRlc1swXSxcbiAgICAgIHB0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzFdLFxuICAgICAgcGVycGVuZGljdWxhclB0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLFxuICAgICAgcGVycGVuZGljdWxhclB0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzFdLFxuICAgICAgc3RhcnQuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0sXG4gICAgICBzdGFydC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXSxcbiAgICAgIHN0b3AuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0sXG4gICAgICBzdG9wLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzFdXG4gICAgICApO1xuICAgIGlmKCFpbnRlcnNlY3QpIHtcbiAgICAgIHBlcnBlbmRpY3VsYXJQdCA9IGRlc3RpbmF0aW9uKHB0LCAxMDAwICwgZGlyZWN0aW9uIC0gOTAsIHVuaXRzKSAvLyAxMDAwID0gZ3Jvc3NcbiAgICAgIGludGVyc2VjdCA9IGxpbmVJbnRlcnNlY3RzKFxuICAgICAgICBwdC5nZW9tZXRyeS5jb29yZGluYXRlc1swXSxcbiAgICAgICAgcHQuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV0sXG4gICAgICAgIHBlcnBlbmRpY3VsYXJQdC5nZW9tZXRyeS5jb29yZGluYXRlc1swXSxcbiAgICAgICAgcGVycGVuZGljdWxhclB0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzFdLFxuICAgICAgICBzdGFydC5nZW9tZXRyeS5jb29yZGluYXRlc1swXSxcbiAgICAgICAgc3RhcnQuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV0sXG4gICAgICAgIHN0b3AuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0sXG4gICAgICAgIHN0b3AuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV1cbiAgICAgICAgKTtcbiAgICB9XG4gICAgcGVycGVuZGljdWxhclB0LnByb3BlcnRpZXMuZGlzdCA9IEluZmluaXR5O1xuICAgIHZhciBpbnRlcnNlY3RQdDtcbiAgICBpZihpbnRlcnNlY3QpIHtcbiAgICAgIHZhciBpbnRlcnNlY3RQdCA9IHBvaW50KGludGVyc2VjdCk7XG4gICAgICBpbnRlcnNlY3RQdC5wcm9wZXJ0aWVzLmRpc3QgPSBkaXN0YW5jZShwdCwgaW50ZXJzZWN0UHQsIHVuaXRzKTtcbiAgICB9XG4gICAgXG4gICAgaWYoc3RhcnQucHJvcGVydGllcy5kaXN0IDwgY2xvc2VzdFB0LnByb3BlcnRpZXMuZGlzdCkge1xuICAgICAgY2xvc2VzdFB0ID0gc3RhcnQ7XG4gICAgICBjbG9zZXN0UHQucHJvcGVydGllcy5pbmRleCA9IGk7XG4gICAgfVxuICAgIGlmKHN0b3AucHJvcGVydGllcy5kaXN0IDwgY2xvc2VzdFB0LnByb3BlcnRpZXMuZGlzdCkge1xuICAgICBjbG9zZXN0UHQgPSBzdG9wO1xuICAgICBjbG9zZXN0UHQucHJvcGVydGllcy5pbmRleCA9IGk7XG4gICAgfVxuICAgIGlmKGludGVyc2VjdFB0ICYmIGludGVyc2VjdFB0LnByb3BlcnRpZXMuZGlzdCA8IGNsb3Nlc3RQdC5wcm9wZXJ0aWVzLmRpc3QpeyBcbiAgICAgIGNsb3Nlc3RQdCA9IGludGVyc2VjdFB0O1xuICAgICAgY2xvc2VzdFB0LnByb3BlcnRpZXMuaW5kZXggPSBpO1xuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIGNsb3Nlc3RQdDtcbn1cblxuLy8gbW9kaWZpZWQgZnJvbSBodHRwOi8vanNmaWRkbGUubmV0L2p1c3Rpbl9jX3JvdW5kcy9HZDJTMi9saWdodC9cbmZ1bmN0aW9uIGxpbmVJbnRlcnNlY3RzKGxpbmUxU3RhcnRYLCBsaW5lMVN0YXJ0WSwgbGluZTFFbmRYLCBsaW5lMUVuZFksIGxpbmUyU3RhcnRYLCBsaW5lMlN0YXJ0WSwgbGluZTJFbmRYLCBsaW5lMkVuZFkpIHtcbiAgLy8gaWYgdGhlIGxpbmVzIGludGVyc2VjdCwgdGhlIHJlc3VsdCBjb250YWlucyB0aGUgeCBhbmQgeSBvZiB0aGUgaW50ZXJzZWN0aW9uICh0cmVhdGluZyB0aGUgbGluZXMgYXMgaW5maW5pdGUpIGFuZCBib29sZWFucyBmb3Igd2hldGhlciBsaW5lIHNlZ21lbnQgMSBvciBsaW5lIHNlZ21lbnQgMiBjb250YWluIHRoZSBwb2ludFxuICB2YXIgZGVub21pbmF0b3IsIGEsIGIsIG51bWVyYXRvcjEsIG51bWVyYXRvcjIsIHJlc3VsdCA9IHtcbiAgICB4OiBudWxsLFxuICAgIHk6IG51bGwsXG4gICAgb25MaW5lMTogZmFsc2UsXG4gICAgb25MaW5lMjogZmFsc2VcbiAgfTtcbiAgZGVub21pbmF0b3IgPSAoKGxpbmUyRW5kWSAtIGxpbmUyU3RhcnRZKSAqIChsaW5lMUVuZFggLSBsaW5lMVN0YXJ0WCkpIC0gKChsaW5lMkVuZFggLSBsaW5lMlN0YXJ0WCkgKiAobGluZTFFbmRZIC0gbGluZTFTdGFydFkpKTtcbiAgaWYgKGRlbm9taW5hdG9yID09IDApIHtcbiAgICBpZihyZXN1bHQueCAhPSBudWxsICYmIHJlc3VsdC55ICE9IG51bGwpIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgYSA9IGxpbmUxU3RhcnRZIC0gbGluZTJTdGFydFk7XG4gIGIgPSBsaW5lMVN0YXJ0WCAtIGxpbmUyU3RhcnRYO1xuICBudW1lcmF0b3IxID0gKChsaW5lMkVuZFggLSBsaW5lMlN0YXJ0WCkgKiBhKSAtICgobGluZTJFbmRZIC0gbGluZTJTdGFydFkpICogYik7XG4gIG51bWVyYXRvcjIgPSAoKGxpbmUxRW5kWCAtIGxpbmUxU3RhcnRYKSAqIGEpIC0gKChsaW5lMUVuZFkgLSBsaW5lMVN0YXJ0WSkgKiBiKTtcbiAgYSA9IG51bWVyYXRvcjEgLyBkZW5vbWluYXRvcjtcbiAgYiA9IG51bWVyYXRvcjIgLyBkZW5vbWluYXRvcjtcblxuICAvLyBpZiB3ZSBjYXN0IHRoZXNlIGxpbmVzIGluZmluaXRlbHkgaW4gYm90aCBkaXJlY3Rpb25zLCB0aGV5IGludGVyc2VjdCBoZXJlOlxuICByZXN1bHQueCA9IGxpbmUxU3RhcnRYICsgKGEgKiAobGluZTFFbmRYIC0gbGluZTFTdGFydFgpKTtcbiAgcmVzdWx0LnkgPSBsaW5lMVN0YXJ0WSArIChhICogKGxpbmUxRW5kWSAtIGxpbmUxU3RhcnRZKSk7XG5cbiAgLy8gaWYgbGluZTEgaXMgYSBzZWdtZW50IGFuZCBsaW5lMiBpcyBpbmZpbml0ZSwgdGhleSBpbnRlcnNlY3QgaWY6XG4gIGlmIChhID4gMCAmJiBhIDwgMSkge1xuICAgIHJlc3VsdC5vbkxpbmUxID0gdHJ1ZTtcbiAgfVxuICAvLyBpZiBsaW5lMiBpcyBhIHNlZ21lbnQgYW5kIGxpbmUxIGlzIGluZmluaXRlLCB0aGV5IGludGVyc2VjdCBpZjpcbiAgaWYgKGIgPiAwICYmIGIgPCAxKSB7XG4gICAgcmVzdWx0Lm9uTGluZTIgPSB0cnVlO1xuICB9XG4gIC8vIGlmIGxpbmUxIGFuZCBsaW5lMiBhcmUgc2VnbWVudHMsIHRoZXkgaW50ZXJzZWN0IGlmIGJvdGggb2YgdGhlIGFib3ZlIGFyZSB0cnVlXG4gIGlmKHJlc3VsdC5vbkxpbmUxICYmIHJlc3VsdC5vbkxpbmUyKXtcbiAgICByZXR1cm4gW3Jlc3VsdC54LCByZXN1bHQueV07XG4gIH1cbiAgZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iLCIvKipcbiAqIFRha2VzIGNvb3JkaW5hdGVzIGFuZCBwcm9wZXJ0aWVzIChvcHRpb25hbCkgYW5kIHJldHVybnMgYSBuZXcge0BsaW5rIFBvaW50fSBmZWF0dXJlLlxuICpcbiAqIEBtb2R1bGUgdHVyZi9wb2ludFxuICogQGNhdGVnb3J5IGhlbHBlclxuICogQHBhcmFtIHtudW1iZXJ9IGxvbmdpdHVkZSBwb3NpdGlvbiB3ZXN0IHRvIGVhc3QgaW4gZGVjaW1hbCBkZWdyZWVzXG4gKiBAcGFyYW0ge251bWJlcn0gbGF0aXR1ZGUgcG9zaXRpb24gc291dGggdG8gbm9ydGggaW4gZGVjaW1hbCBkZWdyZWVzXG4gKiBAcGFyYW0ge09iamVjdH0gcHJvcGVydGllcyBhbiBPYmplY3QgdGhhdCBpcyB1c2VkIGFzIHRoZSB7QGxpbmsgRmVhdHVyZX0nc1xuICogcHJvcGVydGllc1xuICogQHJldHVybiB7UG9pbnR9IGEgUG9pbnQgZmVhdHVyZVxuICogQGV4YW1wbGVcbiAqIHZhciBwdDEgPSB0dXJmLnBvaW50KFstNzUuMzQzLCAzOS45ODRdKTtcbiAqXG4gKiAvLz1wdDFcbiAqL1xudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uKGFyZykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyZykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjb29yZGluYXRlcywgcHJvcGVydGllcykge1xuICBpZiAoIWlzQXJyYXkoY29vcmRpbmF0ZXMpKSB0aHJvdyBuZXcgRXJyb3IoJ0Nvb3JkaW5hdGVzIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgaWYgKGNvb3JkaW5hdGVzLmxlbmd0aCA8IDIpIHRocm93IG5ldyBFcnJvcignQ29vcmRpbmF0ZXMgbXVzdCBiZSBhdCBsZWFzdCAyIG51bWJlcnMgbG9uZycpO1xuICByZXR1cm4ge1xuICAgIHR5cGU6IFwiRmVhdHVyZVwiLFxuICAgIGdlb21ldHJ5OiB7XG4gICAgICB0eXBlOiBcIlBvaW50XCIsXG4gICAgICBjb29yZGluYXRlczogY29vcmRpbmF0ZXNcbiAgICB9LFxuICAgIHByb3BlcnRpZXM6IHByb3BlcnRpZXMgfHwge31cbiAgfTtcbn07XG4iLCJ2YXIgaW5zaWRlID0gcmVxdWlyZSgndHVyZi1pbnNpZGUnKTtcbnZhciBmZWF0dXJlQ29sbGVjdGlvbiA9IHJlcXVpcmUoJ3R1cmYtZmVhdHVyZWNvbGxlY3Rpb24nKTtcblxuLyoqXG4gKiBUYWtlcyBhIHtAbGluayBGZWF0dXJlQ29sbGVjdGlvbn0gb2Yge0BsaW5rIFBvaW50fSBmZWF0dXJlcyBhbmQgYSBGZWF0dXJlQ29sbGVjdGlvbiBvZiB7QGxpbmsgUG9seWdvbn0gZmVhdHVyZXMgYW5kIHJldHVybnMgYSBGZWF0dXJlQ29sbGVjdGlvbiBvZiBQb2ludCBmZWF0dXJlcyByZXByZXNlbnRpbmcgYWxsIHBvaW50cyB0aGF0IGZhbGwgd2l0aGluIGEgY29sbGVjdGlvbiBvZiBwb2x5Z29ucy5cbiAqXG4gKiBAbW9kdWxlIHR1cmYvd2l0aGluXG4gKiBAY2F0ZWdvcnkgam9pbnNcbiAqIEBwYXJhbSB7RmVhdHVyZUNvbGxlY3Rpb259IHBvaW50cyBhIEZlYXR1cmVDb2xsZWN0aW9uIG9mIHtAbGluayBQb2ludH0gZmVhdHVyZXNcbiAqIEBwYXJhbSB7RmVhdHVyZUNvbGxlY3Rpb259IHBvbHlnb25zIGEgRmVhdHVyZUNvbGxlY3Rpb24gb2Yge0BsaW5rIFBvbHlnb259IGZlYXR1cmVzXG4gKiBAcmV0dXJuIHtGZWF0dXJlQ29sbGVjdGlvbn0gYSBjb2xsZWN0aW9uIG9mIGFsbCBwb2ludHMgdGhhdCBsYW5kXG4gKiB3aXRoaW4gYXQgbGVhc3Qgb25lIHBvbHlnb25cbiAqIEBleGFtcGxlXG4gKiB2YXIgc2VhcmNoV2l0aGluID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICogICBcImZlYXR1cmVzXCI6IFtcbiAqICAgICB7XG4gKiAgICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgICAgICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgICAgICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICAgICAgXCJ0eXBlXCI6IFwiUG9seWdvblwiLFxuICogICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFtbXG4gKiAgICAgICAgICAgWy00Ni42NTMsLTIzLjU0M10sXG4gKiAgICAgICAgICAgWy00Ni42MzQsLTIzLjUzNDZdLFxuICogICAgICAgICAgIFstNDYuNjEzLC0yMy41NDNdLFxuICogICAgICAgICAgIFstNDYuNjE0LC0yMy41NTldLFxuICogICAgICAgICAgIFstNDYuNjMxLC0yMy41NjddLFxuICogICAgICAgICAgIFstNDYuNjUzLC0yMy41NjBdLFxuICogICAgICAgICAgIFstNDYuNjUzLC0yMy41NDNdXG4gKiAgICAgICAgIF1dXG4gKiAgICAgICB9XG4gKiAgICAgfVxuICogICBdXG4gKiB9O1xuICogdmFyIHBvaW50cyA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAqICAgXCJmZWF0dXJlc1wiOiBbXG4gKiAgICAge1xuICogICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICAgICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICAgICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgICAgIFwiY29vcmRpbmF0ZXNcIjogWy00Ni42MzE4LCAtMjMuNTUyM11cbiAqICAgICAgIH1cbiAqICAgICB9LCB7XG4gKiAgICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgICAgICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgICAgICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICAgICAgXCJjb29yZGluYXRlc1wiOiBbLTQ2LjYyNDYsIC0yMy41MzI1XVxuICogICAgICAgfVxuICogICAgIH0sIHtcbiAqICAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgICAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFstNDYuNjA2MiwgLTIzLjU1MTNdXG4gKiAgICAgICB9XG4gKiAgICAgfSwge1xuICogICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICAgICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICAgICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgICAgIFwiY29vcmRpbmF0ZXNcIjogWy00Ni42NjMsIC0yMy41NTRdXG4gKiAgICAgICB9XG4gKiAgICAgfSwge1xuICogICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICAgICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICAgICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgICAgIFwiY29vcmRpbmF0ZXNcIjogWy00Ni42NDMsIC0yMy41NTddXG4gKiAgICAgICB9XG4gKiAgICAgfVxuICogICBdXG4gKiB9O1xuICpcbiAqIHZhciBwdHNXaXRoaW4gPSB0dXJmLndpdGhpbihwb2ludHMsIHNlYXJjaFdpdGhpbik7XG4gKlxuICogLy89cG9pbnRzXG4gKlxuICogLy89c2VhcmNoV2l0aGluXG4gKlxuICogLy89cHRzV2l0aGluXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocHRGQywgcG9seUZDKXtcbiAgdmFyIHBvaW50c1dpdGhpbiA9IGZlYXR1cmVDb2xsZWN0aW9uKFtdKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb2x5RkMuZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IHB0RkMuZmVhdHVyZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciBpc0luc2lkZSA9IGluc2lkZShwdEZDLmZlYXR1cmVzW2pdLCBwb2x5RkMuZmVhdHVyZXNbaV0pO1xuICAgICAgaWYoaXNJbnNpZGUpe1xuICAgICAgICBwb2ludHNXaXRoaW4uZmVhdHVyZXMucHVzaChwdEZDLmZlYXR1cmVzW2pdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHBvaW50c1dpdGhpbjtcbn07XG4iLCIvKiFcbkNvcHlyaWdodCAoQykgMjAxMC0yMDEzIFJheW1vbmQgSGlsbDogaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pXG5NSVQgTGljZW5zZTogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9MSUNFTlNFLm1kXG4qL1xuLypcbkF1dGhvcjogUmF5bW9uZCBIaWxsIChyaGlsbEByYXltb25kaGlsbC5uZXQpXG5Db250cmlidXRvcjogSmVzc2UgTW9yZ2FuIChtb3JnYWplbEBnbWFpbC5jb20pXG5GaWxlOiByaGlsbC12b3Jvbm9pLWNvcmUuanNcblZlcnNpb246IDAuOThcbkRhdGU6IEphbnVhcnkgMjEsIDIwMTNcbkRlc2NyaXB0aW9uOiBUaGlzIGlzIG15IHBlcnNvbmFsIEphdmFzY3JpcHQgaW1wbGVtZW50YXRpb24gb2ZcblN0ZXZlbiBGb3J0dW5lJ3MgYWxnb3JpdGhtIHRvIGNvbXB1dGUgVm9yb25vaSBkaWFncmFtcy5cblxuTGljZW5zZTogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9MSUNFTlNFLm1kXG5DcmVkaXRzOiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pL0NSRURJVFMubWRcbkhpc3Rvcnk6IFNlZSBodHRwczovL2dpdGh1Yi5jb20vZ29yaGlsbC9KYXZhc2NyaXB0LVZvcm9ub2kvQ0hBTkdFTE9HLm1kXG5cbiMjIFVzYWdlOlxuXG4gIHZhciBzaXRlcyA9IFt7eDozMDAseTozMDB9LCB7eDoxMDAseToxMDB9LCB7eDoyMDAseTo1MDB9LCB7eDoyNTAseTo0NTB9LCB7eDo2MDAseToxNTB9XTtcbiAgLy8geGwsIHhyIG1lYW5zIHggbGVmdCwgeCByaWdodFxuICAvLyB5dCwgeWIgbWVhbnMgeSB0b3AsIHkgYm90dG9tXG4gIHZhciBiYm94ID0ge3hsOjAsIHhyOjgwMCwgeXQ6MCwgeWI6NjAwfTtcbiAgdmFyIHZvcm9ub2kgPSBuZXcgVm9yb25vaSgpO1xuICAvLyBwYXNzIGFuIG9iamVjdCB3aGljaCBleGhpYml0cyB4bCwgeHIsIHl0LCB5YiBwcm9wZXJ0aWVzLiBUaGUgYm91bmRpbmdcbiAgLy8gYm94IHdpbGwgYmUgdXNlZCB0byBjb25uZWN0IHVuYm91bmQgZWRnZXMsIGFuZCB0byBjbG9zZSBvcGVuIGNlbGxzXG4gIHJlc3VsdCA9IHZvcm9ub2kuY29tcHV0ZShzaXRlcywgYmJveCk7XG4gIC8vIHJlbmRlciwgZnVydGhlciBhbmFseXplLCBldGMuXG5cblJldHVybiB2YWx1ZTpcbiAgQW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuXG4gIHJlc3VsdC52ZXJ0aWNlcyA9IGFuIGFycmF5IG9mIHVub3JkZXJlZCwgdW5pcXVlIFZvcm9ub2kuVmVydGV4IG9iamVjdHMgbWFraW5nXG4gICAgdXAgdGhlIFZvcm9ub2kgZGlhZ3JhbS5cbiAgcmVzdWx0LmVkZ2VzID0gYW4gYXJyYXkgb2YgdW5vcmRlcmVkLCB1bmlxdWUgVm9yb25vaS5FZGdlIG9iamVjdHMgbWFraW5nIHVwXG4gICAgdGhlIFZvcm9ub2kgZGlhZ3JhbS5cbiAgcmVzdWx0LmNlbGxzID0gYW4gYXJyYXkgb2YgVm9yb25vaS5DZWxsIG9iamVjdCBtYWtpbmcgdXAgdGhlIFZvcm9ub2kgZGlhZ3JhbS5cbiAgICBBIENlbGwgb2JqZWN0IG1pZ2h0IGhhdmUgYW4gZW1wdHkgYXJyYXkgb2YgaGFsZmVkZ2VzLCBtZWFuaW5nIG5vIFZvcm9ub2lcbiAgICBjZWxsIGNvdWxkIGJlIGNvbXB1dGVkIGZvciBhIHBhcnRpY3VsYXIgY2VsbC5cbiAgcmVzdWx0LmV4ZWNUaW1lID0gdGhlIHRpbWUgaXQgdG9vayB0byBjb21wdXRlIHRoZSBWb3Jvbm9pIGRpYWdyYW0sIGluXG4gICAgbWlsbGlzZWNvbmRzLlxuXG5Wb3Jvbm9pLlZlcnRleCBvYmplY3Q6XG4gIHg6IFRoZSB4IHBvc2l0aW9uIG9mIHRoZSB2ZXJ0ZXguXG4gIHk6IFRoZSB5IHBvc2l0aW9uIG9mIHRoZSB2ZXJ0ZXguXG5cblZvcm9ub2kuRWRnZSBvYmplY3Q6XG4gIGxTaXRlOiB0aGUgVm9yb25vaSBzaXRlIG9iamVjdCBhdCB0aGUgbGVmdCBvZiB0aGlzIFZvcm9ub2kuRWRnZSBvYmplY3QuXG4gIHJTaXRlOiB0aGUgVm9yb25vaSBzaXRlIG9iamVjdCBhdCB0aGUgcmlnaHQgb2YgdGhpcyBWb3Jvbm9pLkVkZ2Ugb2JqZWN0IChjYW5cbiAgICBiZSBudWxsKS5cbiAgdmE6IGFuIG9iamVjdCB3aXRoIGFuICd4JyBhbmQgYSAneScgcHJvcGVydHkgZGVmaW5pbmcgdGhlIHN0YXJ0IHBvaW50XG4gICAgKHJlbGF0aXZlIHRvIHRoZSBWb3Jvbm9pIHNpdGUgb24gdGhlIGxlZnQpIG9mIHRoaXMgVm9yb25vaS5FZGdlIG9iamVjdC5cbiAgdmI6IGFuIG9iamVjdCB3aXRoIGFuICd4JyBhbmQgYSAneScgcHJvcGVydHkgZGVmaW5pbmcgdGhlIGVuZCBwb2ludFxuICAgIChyZWxhdGl2ZSB0byBWb3Jvbm9pIHNpdGUgb24gdGhlIGxlZnQpIG9mIHRoaXMgVm9yb25vaS5FZGdlIG9iamVjdC5cblxuICBGb3IgZWRnZXMgd2hpY2ggYXJlIHVzZWQgdG8gY2xvc2Ugb3BlbiBjZWxscyAodXNpbmcgdGhlIHN1cHBsaWVkIGJvdW5kaW5nXG4gIGJveCksIHRoZSByU2l0ZSBwcm9wZXJ0eSB3aWxsIGJlIG51bGwuXG5cblZvcm9ub2kuQ2VsbCBvYmplY3Q6XG4gIHNpdGU6IHRoZSBWb3Jvbm9pIHNpdGUgb2JqZWN0IGFzc29jaWF0ZWQgd2l0aCB0aGUgVm9yb25vaSBjZWxsLlxuICBoYWxmZWRnZXM6IGFuIGFycmF5IG9mIFZvcm9ub2kuSGFsZmVkZ2Ugb2JqZWN0cywgb3JkZXJlZCBjb3VudGVyY2xvY2t3aXNlLFxuICAgIGRlZmluaW5nIHRoZSBwb2x5Z29uIGZvciB0aGlzIFZvcm9ub2kgY2VsbC5cblxuVm9yb25vaS5IYWxmZWRnZSBvYmplY3Q6XG4gIHNpdGU6IHRoZSBWb3Jvbm9pIHNpdGUgb2JqZWN0IG93bmluZyB0aGlzIFZvcm9ub2kuSGFsZmVkZ2Ugb2JqZWN0LlxuICBlZGdlOiBhIHJlZmVyZW5jZSB0byB0aGUgdW5pcXVlIFZvcm9ub2kuRWRnZSBvYmplY3QgdW5kZXJseWluZyB0aGlzXG4gICAgVm9yb25vaS5IYWxmZWRnZSBvYmplY3QuXG4gIGdldFN0YXJ0cG9pbnQoKTogYSBtZXRob2QgcmV0dXJuaW5nIGFuIG9iamVjdCB3aXRoIGFuICd4JyBhbmQgYSAneScgcHJvcGVydHlcbiAgICBmb3IgdGhlIHN0YXJ0IHBvaW50IG9mIHRoaXMgaGFsZmVkZ2UuIEtlZXAgaW4gbWluZCBoYWxmZWRnZXMgYXJlIGFsd2F5c1xuICAgIGNvdW50ZXJjb2Nrd2lzZS5cbiAgZ2V0RW5kcG9pbnQoKTogYSBtZXRob2QgcmV0dXJuaW5nIGFuIG9iamVjdCB3aXRoIGFuICd4JyBhbmQgYSAneScgcHJvcGVydHlcbiAgICBmb3IgdGhlIGVuZCBwb2ludCBvZiB0aGlzIGhhbGZlZGdlLiBLZWVwIGluIG1pbmQgaGFsZmVkZ2VzIGFyZSBhbHdheXNcbiAgICBjb3VudGVyY29ja3dpc2UuXG5cblRPRE86IElkZW50aWZ5IG9wcG9ydHVuaXRpZXMgZm9yIHBlcmZvcm1hbmNlIGltcHJvdmVtZW50LlxuXG5UT0RPOiBMZXQgdGhlIHVzZXIgY2xvc2UgdGhlIFZvcm9ub2kgY2VsbHMsIGRvIG5vdCBkbyBpdCBhdXRvbWF0aWNhbGx5LiBOb3Qgb25seSBsZXRcbiAgICAgIGhpbSBjbG9zZSB0aGUgY2VsbHMsIGJ1dCBhbHNvIGFsbG93IGhpbSB0byBjbG9zZSBtb3JlIHRoYW4gb25jZSB1c2luZyBhIGRpZmZlcmVudFxuICAgICAgYm91bmRpbmcgYm94IGZvciB0aGUgc2FtZSBWb3Jvbm9pIGRpYWdyYW0uXG4qL1xuXG4vKmdsb2JhbCBNYXRoICovXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5mdW5jdGlvbiBWb3Jvbm9pKCkge1xuICAgIHRoaXMudmVydGljZXMgPSBudWxsO1xuICAgIHRoaXMuZWRnZXMgPSBudWxsO1xuICAgIHRoaXMuY2VsbHMgPSBudWxsO1xuICAgIHRoaXMudG9SZWN5Y2xlID0gbnVsbDtcbiAgICB0aGlzLmJlYWNoc2VjdGlvbkp1bmt5YXJkID0gW107XG4gICAgdGhpcy5jaXJjbGVFdmVudEp1bmt5YXJkID0gW107XG4gICAgdGhpcy52ZXJ0ZXhKdW5reWFyZCA9IFtdO1xuICAgIHRoaXMuZWRnZUp1bmt5YXJkID0gW107XG4gICAgdGhpcy5jZWxsSnVua3lhcmQgPSBbXTtcbiAgICB9XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5iZWFjaGxpbmUpIHtcbiAgICAgICAgdGhpcy5iZWFjaGxpbmUgPSBuZXcgdGhpcy5SQlRyZWUoKTtcbiAgICAgICAgfVxuICAgIC8vIE1vdmUgbGVmdG92ZXIgYmVhY2hzZWN0aW9ucyB0byB0aGUgYmVhY2hzZWN0aW9uIGp1bmt5YXJkLlxuICAgIGlmICh0aGlzLmJlYWNobGluZS5yb290KSB7XG4gICAgICAgIHZhciBiZWFjaHNlY3Rpb24gPSB0aGlzLmJlYWNobGluZS5nZXRGaXJzdCh0aGlzLmJlYWNobGluZS5yb290KTtcbiAgICAgICAgd2hpbGUgKGJlYWNoc2VjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5iZWFjaHNlY3Rpb25KdW5reWFyZC5wdXNoKGJlYWNoc2VjdGlvbik7IC8vIG1hcmsgZm9yIHJldXNlXG4gICAgICAgICAgICBiZWFjaHNlY3Rpb24gPSBiZWFjaHNlY3Rpb24ucmJOZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgdGhpcy5iZWFjaGxpbmUucm9vdCA9IG51bGw7XG4gICAgaWYgKCF0aGlzLmNpcmNsZUV2ZW50cykge1xuICAgICAgICB0aGlzLmNpcmNsZUV2ZW50cyA9IG5ldyB0aGlzLlJCVHJlZSgpO1xuICAgICAgICB9XG4gICAgdGhpcy5jaXJjbGVFdmVudHMucm9vdCA9IHRoaXMuZmlyc3RDaXJjbGVFdmVudCA9IG51bGw7XG4gICAgdGhpcy52ZXJ0aWNlcyA9IFtdO1xuICAgIHRoaXMuZWRnZXMgPSBbXTtcbiAgICB0aGlzLmNlbGxzID0gW107XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuc3FydCA9IE1hdGguc3FydDtcblZvcm9ub2kucHJvdG90eXBlLmFicyA9IE1hdGguYWJzO1xuVm9yb25vaS5wcm90b3R5cGUuzrUgPSBWb3Jvbm9pLs61ID0gMWUtOTtcblZvcm9ub2kucHJvdG90eXBlLmluds61ID0gVm9yb25vaS5pbnbOtSA9IDEuMCAvIFZvcm9ub2kuzrU7XG5Wb3Jvbm9pLnByb3RvdHlwZS5lcXVhbFdpdGhFcHNpbG9uID0gZnVuY3Rpb24oYSxiKXtyZXR1cm4gdGhpcy5hYnMoYS1iKTwxZS05O307XG5Wb3Jvbm9pLnByb3RvdHlwZS5ncmVhdGVyVGhhbldpdGhFcHNpbG9uID0gZnVuY3Rpb24oYSxiKXtyZXR1cm4gYS1iPjFlLTk7fTtcblZvcm9ub2kucHJvdG90eXBlLmdyZWF0ZXJUaGFuT3JFcXVhbFdpdGhFcHNpbG9uID0gZnVuY3Rpb24oYSxiKXtyZXR1cm4gYi1hPDFlLTk7fTtcblZvcm9ub2kucHJvdG90eXBlLmxlc3NUaGFuV2l0aEVwc2lsb24gPSBmdW5jdGlvbihhLGIpe3JldHVybiBiLWE+MWUtOTt9O1xuVm9yb25vaS5wcm90b3R5cGUubGVzc1RoYW5PckVxdWFsV2l0aEVwc2lsb24gPSBmdW5jdGlvbihhLGIpe3JldHVybiBhLWI8MWUtOTt9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFJlZC1CbGFjayB0cmVlIGNvZGUgKGJhc2VkIG9uIEMgdmVyc2lvbiBvZiBcInJidHJlZVwiIGJ5IEZyYW5jayBCdWktSHV1XG4vLyBodHRwczovL2dpdGh1Yi5jb20vZmJ1aWh1dS9saWJ0cmVlL2Jsb2IvbWFzdGVyL3JiLmNcblxuVm9yb25vaS5wcm90b3R5cGUuUkJUcmVlID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yb290ID0gbnVsbDtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLnJiSW5zZXJ0U3VjY2Vzc29yID0gZnVuY3Rpb24obm9kZSwgc3VjY2Vzc29yKSB7XG4gICAgdmFyIHBhcmVudDtcbiAgICBpZiAobm9kZSkge1xuICAgICAgICAvLyA+Pj4gcmhpbGwgMjAxMS0wNS0yNzogUGVyZm9ybWFuY2U6IGNhY2hlIHByZXZpb3VzL25leHQgbm9kZXNcbiAgICAgICAgc3VjY2Vzc29yLnJiUHJldmlvdXMgPSBub2RlO1xuICAgICAgICBzdWNjZXNzb3IucmJOZXh0ID0gbm9kZS5yYk5leHQ7XG4gICAgICAgIGlmIChub2RlLnJiTmV4dCkge1xuICAgICAgICAgICAgbm9kZS5yYk5leHQucmJQcmV2aW91cyA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgbm9kZS5yYk5leHQgPSBzdWNjZXNzb3I7XG4gICAgICAgIC8vIDw8PFxuICAgICAgICBpZiAobm9kZS5yYlJpZ2h0KSB7XG4gICAgICAgICAgICAvLyBpbi1wbGFjZSBleHBhbnNpb24gb2Ygbm9kZS5yYlJpZ2h0LmdldEZpcnN0KCk7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5yYlJpZ2h0O1xuICAgICAgICAgICAgd2hpbGUgKG5vZGUucmJMZWZ0KSB7bm9kZSA9IG5vZGUucmJMZWZ0O31cbiAgICAgICAgICAgIG5vZGUucmJMZWZ0ID0gc3VjY2Vzc29yO1xuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG5vZGUucmJSaWdodCA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgcGFyZW50ID0gbm9kZTtcbiAgICAgICAgfVxuICAgIC8vIHJoaWxsIDIwMTEtMDYtMDc6IGlmIG5vZGUgaXMgbnVsbCwgc3VjY2Vzc29yIG11c3QgYmUgaW5zZXJ0ZWRcbiAgICAvLyB0byB0aGUgbGVmdC1tb3N0IHBhcnQgb2YgdGhlIHRyZWVcbiAgICBlbHNlIGlmICh0aGlzLnJvb3QpIHtcbiAgICAgICAgbm9kZSA9IHRoaXMuZ2V0Rmlyc3QodGhpcy5yb290KTtcbiAgICAgICAgLy8gPj4+IFBlcmZvcm1hbmNlOiBjYWNoZSBwcmV2aW91cy9uZXh0IG5vZGVzXG4gICAgICAgIHN1Y2Nlc3Nvci5yYlByZXZpb3VzID0gbnVsbDtcbiAgICAgICAgc3VjY2Vzc29yLnJiTmV4dCA9IG5vZGU7XG4gICAgICAgIG5vZGUucmJQcmV2aW91cyA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgLy8gPDw8XG4gICAgICAgIG5vZGUucmJMZWZ0ID0gc3VjY2Vzc29yO1xuICAgICAgICBwYXJlbnQgPSBub2RlO1xuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIC8vID4+PiBQZXJmb3JtYW5jZTogY2FjaGUgcHJldmlvdXMvbmV4dCBub2Rlc1xuICAgICAgICBzdWNjZXNzb3IucmJQcmV2aW91cyA9IHN1Y2Nlc3Nvci5yYk5leHQgPSBudWxsO1xuICAgICAgICAvLyA8PDxcbiAgICAgICAgdGhpcy5yb290ID0gc3VjY2Vzc29yO1xuICAgICAgICBwYXJlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgc3VjY2Vzc29yLnJiTGVmdCA9IHN1Y2Nlc3Nvci5yYlJpZ2h0ID0gbnVsbDtcbiAgICBzdWNjZXNzb3IucmJQYXJlbnQgPSBwYXJlbnQ7XG4gICAgc3VjY2Vzc29yLnJiUmVkID0gdHJ1ZTtcbiAgICAvLyBGaXh1cCB0aGUgbW9kaWZpZWQgdHJlZSBieSByZWNvbG9yaW5nIG5vZGVzIGFuZCBwZXJmb3JtaW5nXG4gICAgLy8gcm90YXRpb25zICgyIGF0IG1vc3QpIGhlbmNlIHRoZSByZWQtYmxhY2sgdHJlZSBwcm9wZXJ0aWVzIGFyZVxuICAgIC8vIHByZXNlcnZlZC5cbiAgICB2YXIgZ3JhbmRwYSwgdW5jbGU7XG4gICAgbm9kZSA9IHN1Y2Nlc3NvcjtcbiAgICB3aGlsZSAocGFyZW50ICYmIHBhcmVudC5yYlJlZCkge1xuICAgICAgICBncmFuZHBhID0gcGFyZW50LnJiUGFyZW50O1xuICAgICAgICBpZiAocGFyZW50ID09PSBncmFuZHBhLnJiTGVmdCkge1xuICAgICAgICAgICAgdW5jbGUgPSBncmFuZHBhLnJiUmlnaHQ7XG4gICAgICAgICAgICBpZiAodW5jbGUgJiYgdW5jbGUucmJSZWQpIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQucmJSZWQgPSB1bmNsZS5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGdyYW5kcGEucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIG5vZGUgPSBncmFuZHBhO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChub2RlID09PSBwYXJlbnQucmJSaWdodCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlTGVmdChwYXJlbnQpO1xuICAgICAgICAgICAgICAgICAgICBub2RlID0gcGFyZW50O1xuICAgICAgICAgICAgICAgICAgICBwYXJlbnQgPSBub2RlLnJiUGFyZW50O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcGFyZW50LnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgZ3JhbmRwYS5yYlJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZVJpZ2h0KGdyYW5kcGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB1bmNsZSA9IGdyYW5kcGEucmJMZWZ0O1xuICAgICAgICAgICAgaWYgKHVuY2xlICYmIHVuY2xlLnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJiUmVkID0gdW5jbGUucmJSZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBncmFuZHBhLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBub2RlID0gZ3JhbmRwYTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobm9kZSA9PT0gcGFyZW50LnJiTGVmdCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlUmlnaHQocGFyZW50KTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZSA9IHBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50ID0gbm9kZS5yYlBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGdyYW5kcGEucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMucmJSb3RhdGVMZWZ0KGdyYW5kcGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgcGFyZW50ID0gbm9kZS5yYlBhcmVudDtcbiAgICAgICAgfVxuICAgIHRoaXMucm9vdC5yYlJlZCA9IGZhbHNlO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLlJCVHJlZS5wcm90b3R5cGUucmJSZW1vdmVOb2RlID0gZnVuY3Rpb24obm9kZSkge1xuICAgIC8vID4+PiByaGlsbCAyMDExLTA1LTI3OiBQZXJmb3JtYW5jZTogY2FjaGUgcHJldmlvdXMvbmV4dCBub2Rlc1xuICAgIGlmIChub2RlLnJiTmV4dCkge1xuICAgICAgICBub2RlLnJiTmV4dC5yYlByZXZpb3VzID0gbm9kZS5yYlByZXZpb3VzO1xuICAgICAgICB9XG4gICAgaWYgKG5vZGUucmJQcmV2aW91cykge1xuICAgICAgICBub2RlLnJiUHJldmlvdXMucmJOZXh0ID0gbm9kZS5yYk5leHQ7XG4gICAgICAgIH1cbiAgICBub2RlLnJiTmV4dCA9IG5vZGUucmJQcmV2aW91cyA9IG51bGw7XG4gICAgLy8gPDw8XG4gICAgdmFyIHBhcmVudCA9IG5vZGUucmJQYXJlbnQsXG4gICAgICAgIGxlZnQgPSBub2RlLnJiTGVmdCxcbiAgICAgICAgcmlnaHQgPSBub2RlLnJiUmlnaHQsXG4gICAgICAgIG5leHQ7XG4gICAgaWYgKCFsZWZ0KSB7XG4gICAgICAgIG5leHQgPSByaWdodDtcbiAgICAgICAgfVxuICAgIGVsc2UgaWYgKCFyaWdodCkge1xuICAgICAgICBuZXh0ID0gbGVmdDtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBuZXh0ID0gdGhpcy5nZXRGaXJzdChyaWdodCk7XG4gICAgICAgIH1cbiAgICBpZiAocGFyZW50KSB7XG4gICAgICAgIGlmIChwYXJlbnQucmJMZWZ0ID09PSBub2RlKSB7XG4gICAgICAgICAgICBwYXJlbnQucmJMZWZ0ID0gbmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBwYXJlbnQucmJSaWdodCA9IG5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5yb290ID0gbmV4dDtcbiAgICAgICAgfVxuICAgIC8vIGVuZm9yY2UgcmVkLWJsYWNrIHJ1bGVzXG4gICAgdmFyIGlzUmVkO1xuICAgIGlmIChsZWZ0ICYmIHJpZ2h0KSB7XG4gICAgICAgIGlzUmVkID0gbmV4dC5yYlJlZDtcbiAgICAgICAgbmV4dC5yYlJlZCA9IG5vZGUucmJSZWQ7XG4gICAgICAgIG5leHQucmJMZWZ0ID0gbGVmdDtcbiAgICAgICAgbGVmdC5yYlBhcmVudCA9IG5leHQ7XG4gICAgICAgIGlmIChuZXh0ICE9PSByaWdodCkge1xuICAgICAgICAgICAgcGFyZW50ID0gbmV4dC5yYlBhcmVudDtcbiAgICAgICAgICAgIG5leHQucmJQYXJlbnQgPSBub2RlLnJiUGFyZW50O1xuICAgICAgICAgICAgbm9kZSA9IG5leHQucmJSaWdodDtcbiAgICAgICAgICAgIHBhcmVudC5yYkxlZnQgPSBub2RlO1xuICAgICAgICAgICAgbmV4dC5yYlJpZ2h0ID0gcmlnaHQ7XG4gICAgICAgICAgICByaWdodC5yYlBhcmVudCA9IG5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbmV4dC5yYlBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgICAgIHBhcmVudCA9IG5leHQ7XG4gICAgICAgICAgICBub2RlID0gbmV4dC5yYlJpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlzUmVkID0gbm9kZS5yYlJlZDtcbiAgICAgICAgbm9kZSA9IG5leHQ7XG4gICAgICAgIH1cbiAgICAvLyAnbm9kZScgaXMgbm93IHRoZSBzb2xlIHN1Y2Nlc3NvcidzIGNoaWxkIGFuZCAncGFyZW50JyBpdHNcbiAgICAvLyBuZXcgcGFyZW50IChzaW5jZSB0aGUgc3VjY2Vzc29yIGNhbiBoYXZlIGJlZW4gbW92ZWQpXG4gICAgaWYgKG5vZGUpIHtcbiAgICAgICAgbm9kZS5yYlBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgfVxuICAgIC8vIHRoZSAnZWFzeScgY2FzZXNcbiAgICBpZiAoaXNSZWQpIHtyZXR1cm47fVxuICAgIGlmIChub2RlICYmIG5vZGUucmJSZWQpIHtcbiAgICAgICAgbm9kZS5yYlJlZCA9IGZhbHNlO1xuICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAvLyB0aGUgb3RoZXIgY2FzZXNcbiAgICB2YXIgc2libGluZztcbiAgICBkbyB7XG4gICAgICAgIGlmIChub2RlID09PSB0aGlzLnJvb3QpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICBpZiAobm9kZSA9PT0gcGFyZW50LnJiTGVmdCkge1xuICAgICAgICAgICAgc2libGluZyA9IHBhcmVudC5yYlJpZ2h0O1xuICAgICAgICAgICAgaWYgKHNpYmxpbmcucmJSZWQpIHtcbiAgICAgICAgICAgICAgICBzaWJsaW5nLnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlTGVmdChwYXJlbnQpO1xuICAgICAgICAgICAgICAgIHNpYmxpbmcgPSBwYXJlbnQucmJSaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoKHNpYmxpbmcucmJMZWZ0ICYmIHNpYmxpbmcucmJMZWZ0LnJiUmVkKSB8fCAoc2libGluZy5yYlJpZ2h0ICYmIHNpYmxpbmcucmJSaWdodC5yYlJlZCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXNpYmxpbmcucmJSaWdodCB8fCAhc2libGluZy5yYlJpZ2h0LnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcucmJMZWZ0LnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlUmlnaHQoc2libGluZyk7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcgPSBwYXJlbnQucmJSaWdodDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNpYmxpbmcucmJSZWQgPSBwYXJlbnQucmJSZWQ7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJiUmVkID0gc2libGluZy5yYlJpZ2h0LnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZUxlZnQocGFyZW50KTtcbiAgICAgICAgICAgICAgICBub2RlID0gdGhpcy5yb290O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBzaWJsaW5nID0gcGFyZW50LnJiTGVmdDtcbiAgICAgICAgICAgIGlmIChzaWJsaW5nLnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgc2libGluZy5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZVJpZ2h0KHBhcmVudCk7XG4gICAgICAgICAgICAgICAgc2libGluZyA9IHBhcmVudC5yYkxlZnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKChzaWJsaW5nLnJiTGVmdCAmJiBzaWJsaW5nLnJiTGVmdC5yYlJlZCkgfHwgKHNpYmxpbmcucmJSaWdodCAmJiBzaWJsaW5nLnJiUmlnaHQucmJSZWQpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzaWJsaW5nLnJiTGVmdCB8fCAhc2libGluZy5yYkxlZnQucmJSZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2libGluZy5yYlJpZ2h0LnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlTGVmdChzaWJsaW5nKTtcbiAgICAgICAgICAgICAgICAgICAgc2libGluZyA9IHBhcmVudC5yYkxlZnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzaWJsaW5nLnJiUmVkID0gcGFyZW50LnJiUmVkO1xuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IHNpYmxpbmcucmJMZWZ0LnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZVJpZ2h0KHBhcmVudCk7XG4gICAgICAgICAgICAgICAgbm9kZSA9IHRoaXMucm9vdDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIHNpYmxpbmcucmJSZWQgPSB0cnVlO1xuICAgICAgICBub2RlID0gcGFyZW50O1xuICAgICAgICBwYXJlbnQgPSBwYXJlbnQucmJQYXJlbnQ7XG4gICAgfSB3aGlsZSAoIW5vZGUucmJSZWQpO1xuICAgIGlmIChub2RlKSB7bm9kZS5yYlJlZCA9IGZhbHNlO31cbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLnJiUm90YXRlTGVmdCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgcCA9IG5vZGUsXG4gICAgICAgIHEgPSBub2RlLnJiUmlnaHQsIC8vIGNhbid0IGJlIG51bGxcbiAgICAgICAgcGFyZW50ID0gcC5yYlBhcmVudDtcbiAgICBpZiAocGFyZW50KSB7XG4gICAgICAgIGlmIChwYXJlbnQucmJMZWZ0ID09PSBwKSB7XG4gICAgICAgICAgICBwYXJlbnQucmJMZWZ0ID0gcTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBwYXJlbnQucmJSaWdodCA9IHE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5yb290ID0gcTtcbiAgICAgICAgfVxuICAgIHEucmJQYXJlbnQgPSBwYXJlbnQ7XG4gICAgcC5yYlBhcmVudCA9IHE7XG4gICAgcC5yYlJpZ2h0ID0gcS5yYkxlZnQ7XG4gICAgaWYgKHAucmJSaWdodCkge1xuICAgICAgICBwLnJiUmlnaHQucmJQYXJlbnQgPSBwO1xuICAgICAgICB9XG4gICAgcS5yYkxlZnQgPSBwO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLlJCVHJlZS5wcm90b3R5cGUucmJSb3RhdGVSaWdodCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgcCA9IG5vZGUsXG4gICAgICAgIHEgPSBub2RlLnJiTGVmdCwgLy8gY2FuJ3QgYmUgbnVsbFxuICAgICAgICBwYXJlbnQgPSBwLnJiUGFyZW50O1xuICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgaWYgKHBhcmVudC5yYkxlZnQgPT09IHApIHtcbiAgICAgICAgICAgIHBhcmVudC5yYkxlZnQgPSBxO1xuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHBhcmVudC5yYlJpZ2h0ID0gcTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aGlzLnJvb3QgPSBxO1xuICAgICAgICB9XG4gICAgcS5yYlBhcmVudCA9IHBhcmVudDtcbiAgICBwLnJiUGFyZW50ID0gcTtcbiAgICBwLnJiTGVmdCA9IHEucmJSaWdodDtcbiAgICBpZiAocC5yYkxlZnQpIHtcbiAgICAgICAgcC5yYkxlZnQucmJQYXJlbnQgPSBwO1xuICAgICAgICB9XG4gICAgcS5yYlJpZ2h0ID0gcDtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLmdldEZpcnN0ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHdoaWxlIChub2RlLnJiTGVmdCkge1xuICAgICAgICBub2RlID0gbm9kZS5yYkxlZnQ7XG4gICAgICAgIH1cbiAgICByZXR1cm4gbm9kZTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLmdldExhc3QgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgd2hpbGUgKG5vZGUucmJSaWdodCkge1xuICAgICAgICBub2RlID0gbm9kZS5yYlJpZ2h0O1xuICAgICAgICB9XG4gICAgcmV0dXJuIG5vZGU7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBEaWFncmFtIG1ldGhvZHNcblxuVm9yb25vaS5wcm90b3R5cGUuRGlhZ3JhbSA9IGZ1bmN0aW9uKHNpdGUpIHtcbiAgICB0aGlzLnNpdGUgPSBzaXRlO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gQ2VsbCBtZXRob2RzXG5cblZvcm9ub2kucHJvdG90eXBlLkNlbGwgPSBmdW5jdGlvbihzaXRlKSB7XG4gICAgdGhpcy5zaXRlID0gc2l0ZTtcbiAgICB0aGlzLmhhbGZlZGdlcyA9IFtdO1xuICAgIHRoaXMuY2xvc2VNZSA9IGZhbHNlO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLkNlbGwucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbihzaXRlKSB7XG4gICAgdGhpcy5zaXRlID0gc2l0ZTtcbiAgICB0aGlzLmhhbGZlZGdlcyA9IFtdO1xuICAgIHRoaXMuY2xvc2VNZSA9IGZhbHNlO1xuICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmNyZWF0ZUNlbGwgPSBmdW5jdGlvbihzaXRlKSB7XG4gICAgdmFyIGNlbGwgPSB0aGlzLmNlbGxKdW5reWFyZC5wb3AoKTtcbiAgICBpZiAoIGNlbGwgKSB7XG4gICAgICAgIHJldHVybiBjZWxsLmluaXQoc2l0ZSk7XG4gICAgICAgIH1cbiAgICByZXR1cm4gbmV3IHRoaXMuQ2VsbChzaXRlKTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsLnByb3RvdHlwZS5wcmVwYXJlSGFsZmVkZ2VzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGhhbGZlZGdlcyA9IHRoaXMuaGFsZmVkZ2VzLFxuICAgICAgICBpSGFsZmVkZ2UgPSBoYWxmZWRnZXMubGVuZ3RoLFxuICAgICAgICBlZGdlO1xuICAgIC8vIGdldCByaWQgb2YgdW51c2VkIGhhbGZlZGdlc1xuICAgIC8vIHJoaWxsIDIwMTEtMDUtMjc6IEtlZXAgaXQgc2ltcGxlLCBubyBwb2ludCBoZXJlIGluIHRyeWluZ1xuICAgIC8vIHRvIGJlIGZhbmN5OiBkYW5nbGluZyBlZGdlcyBhcmUgYSB0eXBpY2FsbHkgYSBtaW5vcml0eS5cbiAgICB3aGlsZSAoaUhhbGZlZGdlLS0pIHtcbiAgICAgICAgZWRnZSA9IGhhbGZlZGdlc1tpSGFsZmVkZ2VdLmVkZ2U7XG4gICAgICAgIGlmICghZWRnZS52YiB8fCAhZWRnZS52YSkge1xuICAgICAgICAgICAgaGFsZmVkZ2VzLnNwbGljZShpSGFsZmVkZ2UsMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIC8vIHJoaWxsIDIwMTEtMDUtMjY6IEkgdHJpZWQgdG8gdXNlIGEgYmluYXJ5IHNlYXJjaCBhdCBpbnNlcnRpb25cbiAgICAvLyB0aW1lIHRvIGtlZXAgdGhlIGFycmF5IHNvcnRlZCBvbi10aGUtZmx5IChpbiBDZWxsLmFkZEhhbGZlZGdlKCkpLlxuICAgIC8vIFRoZXJlIHdhcyBubyByZWFsIGJlbmVmaXRzIGluIGRvaW5nIHNvLCBwZXJmb3JtYW5jZSBvblxuICAgIC8vIEZpcmVmb3ggMy42IHdhcyBpbXByb3ZlZCBtYXJnaW5hbGx5LCB3aGlsZSBwZXJmb3JtYW5jZSBvblxuICAgIC8vIE9wZXJhIDExIHdhcyBwZW5hbGl6ZWQgbWFyZ2luYWxseS5cbiAgICBoYWxmZWRnZXMuc29ydChmdW5jdGlvbihhLGIpe3JldHVybiBiLmFuZ2xlLWEuYW5nbGU7fSk7XG4gICAgcmV0dXJuIGhhbGZlZGdlcy5sZW5ndGg7XG4gICAgfTtcblxuLy8gUmV0dXJuIGEgbGlzdCBvZiB0aGUgbmVpZ2hib3IgSWRzXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsLnByb3RvdHlwZS5nZXROZWlnaGJvcklkcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBuZWlnaGJvcnMgPSBbXSxcbiAgICAgICAgaUhhbGZlZGdlID0gdGhpcy5oYWxmZWRnZXMubGVuZ3RoLFxuICAgICAgICBlZGdlO1xuICAgIHdoaWxlIChpSGFsZmVkZ2UtLSl7XG4gICAgICAgIGVkZ2UgPSB0aGlzLmhhbGZlZGdlc1tpSGFsZmVkZ2VdLmVkZ2U7XG4gICAgICAgIGlmIChlZGdlLmxTaXRlICE9PSBudWxsICYmIGVkZ2UubFNpdGUudm9yb25vaUlkICE9IHRoaXMuc2l0ZS52b3Jvbm9pSWQpIHtcbiAgICAgICAgICAgIG5laWdoYm9ycy5wdXNoKGVkZ2UubFNpdGUudm9yb25vaUlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZWRnZS5yU2l0ZSAhPT0gbnVsbCAmJiBlZGdlLnJTaXRlLnZvcm9ub2lJZCAhPSB0aGlzLnNpdGUudm9yb25vaUlkKXtcbiAgICAgICAgICAgIG5laWdoYm9ycy5wdXNoKGVkZ2UuclNpdGUudm9yb25vaUlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIHJldHVybiBuZWlnaGJvcnM7XG4gICAgfTtcblxuLy8gQ29tcHV0ZSBib3VuZGluZyBib3hcbi8vXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsLnByb3RvdHlwZS5nZXRCYm94ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGhhbGZlZGdlcyA9IHRoaXMuaGFsZmVkZ2VzLFxuICAgICAgICBpSGFsZmVkZ2UgPSBoYWxmZWRnZXMubGVuZ3RoLFxuICAgICAgICB4bWluID0gSW5maW5pdHksXG4gICAgICAgIHltaW4gPSBJbmZpbml0eSxcbiAgICAgICAgeG1heCA9IC1JbmZpbml0eSxcbiAgICAgICAgeW1heCA9IC1JbmZpbml0eSxcbiAgICAgICAgdiwgdngsIHZ5O1xuICAgIHdoaWxlIChpSGFsZmVkZ2UtLSkge1xuICAgICAgICB2ID0gaGFsZmVkZ2VzW2lIYWxmZWRnZV0uZ2V0U3RhcnRwb2ludCgpO1xuICAgICAgICB2eCA9IHYueDtcbiAgICAgICAgdnkgPSB2Lnk7XG4gICAgICAgIGlmICh2eCA8IHhtaW4pIHt4bWluID0gdng7fVxuICAgICAgICBpZiAodnkgPCB5bWluKSB7eW1pbiA9IHZ5O31cbiAgICAgICAgaWYgKHZ4ID4geG1heCkge3htYXggPSB2eDt9XG4gICAgICAgIGlmICh2eSA+IHltYXgpIHt5bWF4ID0gdnk7fVxuICAgICAgICAvLyB3ZSBkb250IG5lZWQgdG8gdGFrZSBpbnRvIGFjY291bnQgZW5kIHBvaW50LFxuICAgICAgICAvLyBzaW5jZSBlYWNoIGVuZCBwb2ludCBtYXRjaGVzIGEgc3RhcnQgcG9pbnRcbiAgICAgICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIHg6IHhtaW4sXG4gICAgICAgIHk6IHltaW4sXG4gICAgICAgIHdpZHRoOiB4bWF4LXhtaW4sXG4gICAgICAgIGhlaWdodDogeW1heC15bWluXG4gICAgICAgIH07XG4gICAgfTtcblxuLy8gUmV0dXJuIHdoZXRoZXIgYSBwb2ludCBpcyBpbnNpZGUsIG9uLCBvciBvdXRzaWRlIHRoZSBjZWxsOlxuLy8gICAtMTogcG9pbnQgaXMgb3V0c2lkZSB0aGUgcGVyaW1ldGVyIG9mIHRoZSBjZWxsXG4vLyAgICAwOiBwb2ludCBpcyBvbiB0aGUgcGVyaW1ldGVyIG9mIHRoZSBjZWxsXG4vLyAgICAxOiBwb2ludCBpcyBpbnNpZGUgdGhlIHBlcmltZXRlciBvZiB0aGUgY2VsbFxuLy9cblZvcm9ub2kucHJvdG90eXBlLkNlbGwucHJvdG90eXBlLnBvaW50SW50ZXJzZWN0aW9uID0gZnVuY3Rpb24oeCwgeSkge1xuICAgIC8vIENoZWNrIGlmIHBvaW50IGluIHBvbHlnb24uIFNpbmNlIGFsbCBwb2x5Z29ucyBvZiBhIFZvcm9ub2lcbiAgICAvLyBkaWFncmFtIGFyZSBjb252ZXgsIHRoZW46XG4gICAgLy8gaHR0cDovL3BhdWxib3Vya2UubmV0L2dlb21ldHJ5L3BvbHlnb25tZXNoL1xuICAgIC8vIFNvbHV0aW9uIDMgKDJEKTpcbiAgICAvLyAgIFwiSWYgdGhlIHBvbHlnb24gaXMgY29udmV4IHRoZW4gb25lIGNhbiBjb25zaWRlciB0aGUgcG9seWdvblxuICAgIC8vICAgXCJhcyBhICdwYXRoJyBmcm9tIHRoZSBmaXJzdCB2ZXJ0ZXguIEEgcG9pbnQgaXMgb24gdGhlIGludGVyaW9yXG4gICAgLy8gICBcIm9mIHRoaXMgcG9seWdvbnMgaWYgaXQgaXMgYWx3YXlzIG9uIHRoZSBzYW1lIHNpZGUgb2YgYWxsIHRoZVxuICAgIC8vICAgXCJsaW5lIHNlZ21lbnRzIG1ha2luZyB1cCB0aGUgcGF0aC4gLi4uXG4gICAgLy8gICBcIih5IC0geTApICh4MSAtIHgwKSAtICh4IC0geDApICh5MSAtIHkwKVxuICAgIC8vICAgXCJpZiBpdCBpcyBsZXNzIHRoYW4gMCB0aGVuIFAgaXMgdG8gdGhlIHJpZ2h0IG9mIHRoZSBsaW5lIHNlZ21lbnQsXG4gICAgLy8gICBcImlmIGdyZWF0ZXIgdGhhbiAwIGl0IGlzIHRvIHRoZSBsZWZ0LCBpZiBlcXVhbCB0byAwIHRoZW4gaXQgbGllc1xuICAgIC8vICAgXCJvbiB0aGUgbGluZSBzZWdtZW50XCJcbiAgICB2YXIgaGFsZmVkZ2VzID0gdGhpcy5oYWxmZWRnZXMsXG4gICAgICAgIGlIYWxmZWRnZSA9IGhhbGZlZGdlcy5sZW5ndGgsXG4gICAgICAgIGhhbGZlZGdlLFxuICAgICAgICBwMCwgcDEsIHI7XG4gICAgd2hpbGUgKGlIYWxmZWRnZS0tKSB7XG4gICAgICAgIGhhbGZlZGdlID0gaGFsZmVkZ2VzW2lIYWxmZWRnZV07XG4gICAgICAgIHAwID0gaGFsZmVkZ2UuZ2V0U3RhcnRwb2ludCgpO1xuICAgICAgICBwMSA9IGhhbGZlZGdlLmdldEVuZHBvaW50KCk7XG4gICAgICAgIHIgPSAoeS1wMC55KSoocDEueC1wMC54KS0oeC1wMC54KSoocDEueS1wMC55KTtcbiAgICAgICAgaWYgKCFyKSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgaWYgKHIgPiAwKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICByZXR1cm4gMTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEVkZ2UgbWV0aG9kc1xuLy9cblxuVm9yb25vaS5wcm90b3R5cGUuVmVydGV4ID0gZnVuY3Rpb24oeCwgeSkge1xuICAgIHRoaXMueCA9IHg7XG4gICAgdGhpcy55ID0geTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5FZGdlID0gZnVuY3Rpb24obFNpdGUsIHJTaXRlKSB7XG4gICAgdGhpcy5sU2l0ZSA9IGxTaXRlO1xuICAgIHRoaXMuclNpdGUgPSByU2l0ZTtcbiAgICB0aGlzLnZhID0gdGhpcy52YiA9IG51bGw7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuSGFsZmVkZ2UgPSBmdW5jdGlvbihlZGdlLCBsU2l0ZSwgclNpdGUpIHtcbiAgICB0aGlzLnNpdGUgPSBsU2l0ZTtcbiAgICB0aGlzLmVkZ2UgPSBlZGdlO1xuICAgIC8vICdhbmdsZScgaXMgYSB2YWx1ZSB0byBiZSB1c2VkIGZvciBwcm9wZXJseSBzb3J0aW5nIHRoZVxuICAgIC8vIGhhbGZzZWdtZW50cyBjb3VudGVyY2xvY2t3aXNlLiBCeSBjb252ZW50aW9uLCB3ZSB3aWxsXG4gICAgLy8gdXNlIHRoZSBhbmdsZSBvZiB0aGUgbGluZSBkZWZpbmVkIGJ5IHRoZSAnc2l0ZSB0byB0aGUgbGVmdCdcbiAgICAvLyB0byB0aGUgJ3NpdGUgdG8gdGhlIHJpZ2h0Jy5cbiAgICAvLyBIb3dldmVyLCBib3JkZXIgZWRnZXMgaGF2ZSBubyAnc2l0ZSB0byB0aGUgcmlnaHQnOiB0aHVzIHdlXG4gICAgLy8gdXNlIHRoZSBhbmdsZSBvZiBsaW5lIHBlcnBlbmRpY3VsYXIgdG8gdGhlIGhhbGZzZWdtZW50ICh0aGVcbiAgICAvLyBlZGdlIHNob3VsZCBoYXZlIGJvdGggZW5kIHBvaW50cyBkZWZpbmVkIGluIHN1Y2ggY2FzZS4pXG4gICAgaWYgKHJTaXRlKSB7XG4gICAgICAgIHRoaXMuYW5nbGUgPSBNYXRoLmF0YW4yKHJTaXRlLnktbFNpdGUueSwgclNpdGUueC1sU2l0ZS54KTtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB2YXIgdmEgPSBlZGdlLnZhLFxuICAgICAgICAgICAgdmIgPSBlZGdlLnZiO1xuICAgICAgICAvLyByaGlsbCAyMDExLTA1LTMxOiB1c2VkIHRvIGNhbGwgZ2V0U3RhcnRwb2ludCgpL2dldEVuZHBvaW50KCksXG4gICAgICAgIC8vIGJ1dCBmb3IgcGVyZm9ybWFuY2UgcHVycG9zZSwgdGhlc2UgYXJlIGV4cGFuZGVkIGluIHBsYWNlIGhlcmUuXG4gICAgICAgIHRoaXMuYW5nbGUgPSBlZGdlLmxTaXRlID09PSBsU2l0ZSA/XG4gICAgICAgICAgICBNYXRoLmF0YW4yKHZiLngtdmEueCwgdmEueS12Yi55KSA6XG4gICAgICAgICAgICBNYXRoLmF0YW4yKHZhLngtdmIueCwgdmIueS12YS55KTtcbiAgICAgICAgfVxuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmNyZWF0ZUhhbGZlZGdlID0gZnVuY3Rpb24oZWRnZSwgbFNpdGUsIHJTaXRlKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLkhhbGZlZGdlKGVkZ2UsIGxTaXRlLCByU2l0ZSk7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuSGFsZmVkZ2UucHJvdG90eXBlLmdldFN0YXJ0cG9pbnQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5lZGdlLmxTaXRlID09PSB0aGlzLnNpdGUgPyB0aGlzLmVkZ2UudmEgOiB0aGlzLmVkZ2UudmI7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuSGFsZmVkZ2UucHJvdG90eXBlLmdldEVuZHBvaW50ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZWRnZS5sU2l0ZSA9PT0gdGhpcy5zaXRlID8gdGhpcy5lZGdlLnZiIDogdGhpcy5lZGdlLnZhO1xuICAgIH07XG5cblxuXG4vLyB0aGlzIGNyZWF0ZSBhbmQgYWRkIGEgdmVydGV4IHRvIHRoZSBpbnRlcm5hbCBjb2xsZWN0aW9uXG5cblZvcm9ub2kucHJvdG90eXBlLmNyZWF0ZVZlcnRleCA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICB2YXIgdiA9IHRoaXMudmVydGV4SnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCAhdiApIHtcbiAgICAgICAgdiA9IG5ldyB0aGlzLlZlcnRleCh4LCB5KTtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB2LnggPSB4O1xuICAgICAgICB2LnkgPSB5O1xuICAgICAgICB9XG4gICAgdGhpcy52ZXJ0aWNlcy5wdXNoKHYpO1xuICAgIHJldHVybiB2O1xuICAgIH07XG5cbi8vIHRoaXMgY3JlYXRlIGFuZCBhZGQgYW4gZWRnZSB0byBpbnRlcm5hbCBjb2xsZWN0aW9uLCBhbmQgYWxzbyBjcmVhdGVcbi8vIHR3byBoYWxmZWRnZXMgd2hpY2ggYXJlIGFkZGVkIHRvIGVhY2ggc2l0ZSdzIGNvdW50ZXJjbG9ja3dpc2UgYXJyYXlcbi8vIG9mIGhhbGZlZGdlcy5cblxuVm9yb25vaS5wcm90b3R5cGUuY3JlYXRlRWRnZSA9IGZ1bmN0aW9uKGxTaXRlLCByU2l0ZSwgdmEsIHZiKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLmVkZ2VKdW5reWFyZC5wb3AoKTtcbiAgICBpZiAoICFlZGdlICkge1xuICAgICAgICBlZGdlID0gbmV3IHRoaXMuRWRnZShsU2l0ZSwgclNpdGUpO1xuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGVkZ2UubFNpdGUgPSBsU2l0ZTtcbiAgICAgICAgZWRnZS5yU2l0ZSA9IHJTaXRlO1xuICAgICAgICBlZGdlLnZhID0gZWRnZS52YiA9IG51bGw7XG4gICAgICAgIH1cblxuICAgIHRoaXMuZWRnZXMucHVzaChlZGdlKTtcbiAgICBpZiAodmEpIHtcbiAgICAgICAgdGhpcy5zZXRFZGdlU3RhcnRwb2ludChlZGdlLCBsU2l0ZSwgclNpdGUsIHZhKTtcbiAgICAgICAgfVxuICAgIGlmICh2Yikge1xuICAgICAgICB0aGlzLnNldEVkZ2VFbmRwb2ludChlZGdlLCBsU2l0ZSwgclNpdGUsIHZiKTtcbiAgICAgICAgfVxuICAgIHRoaXMuY2VsbHNbbFNpdGUudm9yb25vaUlkXS5oYWxmZWRnZXMucHVzaCh0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGxTaXRlLCByU2l0ZSkpO1xuICAgIHRoaXMuY2VsbHNbclNpdGUudm9yb25vaUlkXS5oYWxmZWRnZXMucHVzaCh0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIHJTaXRlLCBsU2l0ZSkpO1xuICAgIHJldHVybiBlZGdlO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmNyZWF0ZUJvcmRlckVkZ2UgPSBmdW5jdGlvbihsU2l0ZSwgdmEsIHZiKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLmVkZ2VKdW5reWFyZC5wb3AoKTtcbiAgICBpZiAoICFlZGdlICkge1xuICAgICAgICBlZGdlID0gbmV3IHRoaXMuRWRnZShsU2l0ZSwgbnVsbCk7XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZWRnZS5sU2l0ZSA9IGxTaXRlO1xuICAgICAgICBlZGdlLnJTaXRlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIGVkZ2UudmEgPSB2YTtcbiAgICBlZGdlLnZiID0gdmI7XG4gICAgdGhpcy5lZGdlcy5wdXNoKGVkZ2UpO1xuICAgIHJldHVybiBlZGdlO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLnNldEVkZ2VTdGFydHBvaW50ID0gZnVuY3Rpb24oZWRnZSwgbFNpdGUsIHJTaXRlLCB2ZXJ0ZXgpIHtcbiAgICBpZiAoIWVkZ2UudmEgJiYgIWVkZ2UudmIpIHtcbiAgICAgICAgZWRnZS52YSA9IHZlcnRleDtcbiAgICAgICAgZWRnZS5sU2l0ZSA9IGxTaXRlO1xuICAgICAgICBlZGdlLnJTaXRlID0gclNpdGU7XG4gICAgICAgIH1cbiAgICBlbHNlIGlmIChlZGdlLmxTaXRlID09PSByU2l0ZSkge1xuICAgICAgICBlZGdlLnZiID0gdmVydGV4O1xuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGVkZ2UudmEgPSB2ZXJ0ZXg7XG4gICAgICAgIH1cbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5zZXRFZGdlRW5kcG9pbnQgPSBmdW5jdGlvbihlZGdlLCBsU2l0ZSwgclNpdGUsIHZlcnRleCkge1xuICAgIHRoaXMuc2V0RWRnZVN0YXJ0cG9pbnQoZWRnZSwgclNpdGUsIGxTaXRlLCB2ZXJ0ZXgpO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gQmVhY2hsaW5lIG1ldGhvZHNcblxuLy8gcmhpbGwgMjAxMS0wNi0wNzogRm9yIHNvbWUgcmVhc29ucywgcGVyZm9ybWFuY2Ugc3VmZmVycyBzaWduaWZpY2FudGx5XG4vLyB3aGVuIGluc3RhbmNpYXRpbmcgYSBsaXRlcmFsIG9iamVjdCBpbnN0ZWFkIG9mIGFuIGVtcHR5IGN0b3JcblZvcm9ub2kucHJvdG90eXBlLkJlYWNoc2VjdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIH07XG5cbi8vIHJoaWxsIDIwMTEtMDYtMDI6IEEgbG90IG9mIEJlYWNoc2VjdGlvbiBpbnN0YW5jaWF0aW9uc1xuLy8gb2NjdXIgZHVyaW5nIHRoZSBjb21wdXRhdGlvbiBvZiB0aGUgVm9yb25vaSBkaWFncmFtLFxuLy8gc29tZXdoZXJlIGJldHdlZW4gdGhlIG51bWJlciBvZiBzaXRlcyBhbmQgdHdpY2UgdGhlXG4vLyBudW1iZXIgb2Ygc2l0ZXMsIHdoaWxlIHRoZSBudW1iZXIgb2YgQmVhY2hzZWN0aW9ucyBvbiB0aGVcbi8vIGJlYWNobGluZSBhdCBhbnkgZ2l2ZW4gdGltZSBpcyBjb21wYXJhdGl2ZWx5IGxvdy4gRm9yIHRoaXNcbi8vIHJlYXNvbiwgd2UgcmV1c2UgYWxyZWFkeSBjcmVhdGVkIEJlYWNoc2VjdGlvbnMsIGluIG9yZGVyXG4vLyB0byBhdm9pZCBuZXcgbWVtb3J5IGFsbG9jYXRpb24uIFRoaXMgcmVzdWx0ZWQgaW4gYSBtZWFzdXJhYmxlXG4vLyBwZXJmb3JtYW5jZSBnYWluLlxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jcmVhdGVCZWFjaHNlY3Rpb24gPSBmdW5jdGlvbihzaXRlKSB7XG4gICAgdmFyIGJlYWNoc2VjdGlvbiA9IHRoaXMuYmVhY2hzZWN0aW9uSnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCFiZWFjaHNlY3Rpb24pIHtcbiAgICAgICAgYmVhY2hzZWN0aW9uID0gbmV3IHRoaXMuQmVhY2hzZWN0aW9uKCk7XG4gICAgICAgIH1cbiAgICBiZWFjaHNlY3Rpb24uc2l0ZSA9IHNpdGU7XG4gICAgcmV0dXJuIGJlYWNoc2VjdGlvbjtcbiAgICB9O1xuXG4vLyBjYWxjdWxhdGUgdGhlIGxlZnQgYnJlYWsgcG9pbnQgb2YgYSBwYXJ0aWN1bGFyIGJlYWNoIHNlY3Rpb24sXG4vLyBnaXZlbiBhIHBhcnRpY3VsYXIgc3dlZXAgbGluZVxuVm9yb25vaS5wcm90b3R5cGUubGVmdEJyZWFrUG9pbnQgPSBmdW5jdGlvbihhcmMsIGRpcmVjdHJpeCkge1xuICAgIC8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUGFyYWJvbGFcbiAgICAvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1F1YWRyYXRpY19lcXVhdGlvblxuICAgIC8vIGgxID0geDEsXG4gICAgLy8gazEgPSAoeTErZGlyZWN0cml4KS8yLFxuICAgIC8vIGgyID0geDIsXG4gICAgLy8gazIgPSAoeTIrZGlyZWN0cml4KS8yLFxuICAgIC8vIHAxID0gazEtZGlyZWN0cml4LFxuICAgIC8vIGExID0gMS8oNCpwMSksXG4gICAgLy8gYjEgPSAtaDEvKDIqcDEpLFxuICAgIC8vIGMxID0gaDEqaDEvKDQqcDEpK2sxLFxuICAgIC8vIHAyID0gazItZGlyZWN0cml4LFxuICAgIC8vIGEyID0gMS8oNCpwMiksXG4gICAgLy8gYjIgPSAtaDIvKDIqcDIpLFxuICAgIC8vIGMyID0gaDIqaDIvKDQqcDIpK2syLFxuICAgIC8vIHggPSAoLShiMi1iMSkgKyBNYXRoLnNxcnQoKGIyLWIxKSooYjItYjEpIC0gNCooYTItYTEpKihjMi1jMSkpKSAvICgyKihhMi1hMSkpXG4gICAgLy8gV2hlbiB4MSBiZWNvbWUgdGhlIHgtb3JpZ2luOlxuICAgIC8vIGgxID0gMCxcbiAgICAvLyBrMSA9ICh5MStkaXJlY3RyaXgpLzIsXG4gICAgLy8gaDIgPSB4Mi14MSxcbiAgICAvLyBrMiA9ICh5MitkaXJlY3RyaXgpLzIsXG4gICAgLy8gcDEgPSBrMS1kaXJlY3RyaXgsXG4gICAgLy8gYTEgPSAxLyg0KnAxKSxcbiAgICAvLyBiMSA9IDAsXG4gICAgLy8gYzEgPSBrMSxcbiAgICAvLyBwMiA9IGsyLWRpcmVjdHJpeCxcbiAgICAvLyBhMiA9IDEvKDQqcDIpLFxuICAgIC8vIGIyID0gLWgyLygyKnAyKSxcbiAgICAvLyBjMiA9IGgyKmgyLyg0KnAyKStrMixcbiAgICAvLyB4ID0gKC1iMiArIE1hdGguc3FydChiMipiMiAtIDQqKGEyLWExKSooYzItazEpKSkgLyAoMiooYTItYTEpKSArIHgxXG5cbiAgICAvLyBjaGFuZ2UgY29kZSBiZWxvdyBhdCB5b3VyIG93biByaXNrOiBjYXJlIGhhcyBiZWVuIHRha2VuIHRvXG4gICAgLy8gcmVkdWNlIGVycm9ycyBkdWUgdG8gY29tcHV0ZXJzJyBmaW5pdGUgYXJpdGhtZXRpYyBwcmVjaXNpb24uXG4gICAgLy8gTWF5YmUgY2FuIHN0aWxsIGJlIGltcHJvdmVkLCB3aWxsIHNlZSBpZiBhbnkgbW9yZSBvZiB0aGlzXG4gICAgLy8ga2luZCBvZiBlcnJvcnMgcG9wIHVwIGFnYWluLlxuICAgIHZhciBzaXRlID0gYXJjLnNpdGUsXG4gICAgICAgIHJmb2N4ID0gc2l0ZS54LFxuICAgICAgICByZm9jeSA9IHNpdGUueSxcbiAgICAgICAgcGJ5MiA9IHJmb2N5LWRpcmVjdHJpeDtcbiAgICAvLyBwYXJhYm9sYSBpbiBkZWdlbmVyYXRlIGNhc2Ugd2hlcmUgZm9jdXMgaXMgb24gZGlyZWN0cml4XG4gICAgaWYgKCFwYnkyKSB7XG4gICAgICAgIHJldHVybiByZm9jeDtcbiAgICAgICAgfVxuICAgIHZhciBsQXJjID0gYXJjLnJiUHJldmlvdXM7XG4gICAgaWYgKCFsQXJjKSB7XG4gICAgICAgIHJldHVybiAtSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICBzaXRlID0gbEFyYy5zaXRlO1xuICAgIHZhciBsZm9jeCA9IHNpdGUueCxcbiAgICAgICAgbGZvY3kgPSBzaXRlLnksXG4gICAgICAgIHBsYnkyID0gbGZvY3ktZGlyZWN0cml4O1xuICAgIC8vIHBhcmFib2xhIGluIGRlZ2VuZXJhdGUgY2FzZSB3aGVyZSBmb2N1cyBpcyBvbiBkaXJlY3RyaXhcbiAgICBpZiAoIXBsYnkyKSB7XG4gICAgICAgIHJldHVybiBsZm9jeDtcbiAgICAgICAgfVxuICAgIHZhciBobCA9IGxmb2N4LXJmb2N4LFxuICAgICAgICBhYnkyID0gMS9wYnkyLTEvcGxieTIsXG4gICAgICAgIGIgPSBobC9wbGJ5MjtcbiAgICBpZiAoYWJ5Mikge1xuICAgICAgICByZXR1cm4gKC1iK3RoaXMuc3FydChiKmItMiphYnkyKihobCpobC8oLTIqcGxieTIpLWxmb2N5K3BsYnkyLzIrcmZvY3ktcGJ5Mi8yKSkpL2FieTIrcmZvY3g7XG4gICAgICAgIH1cbiAgICAvLyBib3RoIHBhcmFib2xhcyBoYXZlIHNhbWUgZGlzdGFuY2UgdG8gZGlyZWN0cml4LCB0aHVzIGJyZWFrIHBvaW50IGlzIG1pZHdheVxuICAgIHJldHVybiAocmZvY3grbGZvY3gpLzI7XG4gICAgfTtcblxuLy8gY2FsY3VsYXRlIHRoZSByaWdodCBicmVhayBwb2ludCBvZiBhIHBhcnRpY3VsYXIgYmVhY2ggc2VjdGlvbixcbi8vIGdpdmVuIGEgcGFydGljdWxhciBkaXJlY3RyaXhcblZvcm9ub2kucHJvdG90eXBlLnJpZ2h0QnJlYWtQb2ludCA9IGZ1bmN0aW9uKGFyYywgZGlyZWN0cml4KSB7XG4gICAgdmFyIHJBcmMgPSBhcmMucmJOZXh0O1xuICAgIGlmIChyQXJjKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxlZnRCcmVha1BvaW50KHJBcmMsIGRpcmVjdHJpeCk7XG4gICAgICAgIH1cbiAgICB2YXIgc2l0ZSA9IGFyYy5zaXRlO1xuICAgIHJldHVybiBzaXRlLnkgPT09IGRpcmVjdHJpeCA/IHNpdGUueCA6IEluZmluaXR5O1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmRldGFjaEJlYWNoc2VjdGlvbiA9IGZ1bmN0aW9uKGJlYWNoc2VjdGlvbikge1xuICAgIHRoaXMuZGV0YWNoQ2lyY2xlRXZlbnQoYmVhY2hzZWN0aW9uKTsgLy8gZGV0YWNoIHBvdGVudGlhbGx5IGF0dGFjaGVkIGNpcmNsZSBldmVudFxuICAgIHRoaXMuYmVhY2hsaW5lLnJiUmVtb3ZlTm9kZShiZWFjaHNlY3Rpb24pOyAvLyByZW1vdmUgZnJvbSBSQi10cmVlXG4gICAgdGhpcy5iZWFjaHNlY3Rpb25KdW5reWFyZC5wdXNoKGJlYWNoc2VjdGlvbik7IC8vIG1hcmsgZm9yIHJldXNlXG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUucmVtb3ZlQmVhY2hzZWN0aW9uID0gZnVuY3Rpb24oYmVhY2hzZWN0aW9uKSB7XG4gICAgdmFyIGNpcmNsZSA9IGJlYWNoc2VjdGlvbi5jaXJjbGVFdmVudCxcbiAgICAgICAgeCA9IGNpcmNsZS54LFxuICAgICAgICB5ID0gY2lyY2xlLnljZW50ZXIsXG4gICAgICAgIHZlcnRleCA9IHRoaXMuY3JlYXRlVmVydGV4KHgsIHkpLFxuICAgICAgICBwcmV2aW91cyA9IGJlYWNoc2VjdGlvbi5yYlByZXZpb3VzLFxuICAgICAgICBuZXh0ID0gYmVhY2hzZWN0aW9uLnJiTmV4dCxcbiAgICAgICAgZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnMgPSBbYmVhY2hzZWN0aW9uXSxcbiAgICAgICAgYWJzX2ZuID0gTWF0aC5hYnM7XG5cbiAgICAvLyByZW1vdmUgY29sbGFwc2VkIGJlYWNoc2VjdGlvbiBmcm9tIGJlYWNobGluZVxuICAgIHRoaXMuZGV0YWNoQmVhY2hzZWN0aW9uKGJlYWNoc2VjdGlvbik7XG5cbiAgICAvLyB0aGVyZSBjb3VsZCBiZSBtb3JlIHRoYW4gb25lIGVtcHR5IGFyYyBhdCB0aGUgZGVsZXRpb24gcG9pbnQsIHRoaXNcbiAgICAvLyBoYXBwZW5zIHdoZW4gbW9yZSB0aGFuIHR3byBlZGdlcyBhcmUgbGlua2VkIGJ5IHRoZSBzYW1lIHZlcnRleCxcbiAgICAvLyBzbyB3ZSB3aWxsIGNvbGxlY3QgYWxsIHRob3NlIGVkZ2VzIGJ5IGxvb2tpbmcgdXAgYm90aCBzaWRlcyBvZlxuICAgIC8vIHRoZSBkZWxldGlvbiBwb2ludC5cbiAgICAvLyBieSB0aGUgd2F5LCB0aGVyZSBpcyAqYWx3YXlzKiBhIHByZWRlY2Vzc29yL3N1Y2Nlc3NvciB0byBhbnkgY29sbGFwc2VkXG4gICAgLy8gYmVhY2ggc2VjdGlvbiwgaXQncyBqdXN0IGltcG9zc2libGUgdG8gaGF2ZSBhIGNvbGxhcHNpbmcgZmlyc3QvbGFzdFxuICAgIC8vIGJlYWNoIHNlY3Rpb25zIG9uIHRoZSBiZWFjaGxpbmUsIHNpbmNlIHRoZXkgb2J2aW91c2x5IGFyZSB1bmNvbnN0cmFpbmVkXG4gICAgLy8gb24gdGhlaXIgbGVmdC9yaWdodCBzaWRlLlxuXG4gICAgLy8gbG9vayBsZWZ0XG4gICAgdmFyIGxBcmMgPSBwcmV2aW91cztcbiAgICB3aGlsZSAobEFyYy5jaXJjbGVFdmVudCAmJiBhYnNfZm4oeC1sQXJjLmNpcmNsZUV2ZW50LngpPDFlLTkgJiYgYWJzX2ZuKHktbEFyYy5jaXJjbGVFdmVudC55Y2VudGVyKTwxZS05KSB7XG4gICAgICAgIHByZXZpb3VzID0gbEFyYy5yYlByZXZpb3VzO1xuICAgICAgICBkaXNhcHBlYXJpbmdUcmFuc2l0aW9ucy51bnNoaWZ0KGxBcmMpO1xuICAgICAgICB0aGlzLmRldGFjaEJlYWNoc2VjdGlvbihsQXJjKTsgLy8gbWFyayBmb3IgcmV1c2VcbiAgICAgICAgbEFyYyA9IHByZXZpb3VzO1xuICAgICAgICB9XG4gICAgLy8gZXZlbiB0aG91Z2ggaXQgaXMgbm90IGRpc2FwcGVhcmluZywgSSB3aWxsIGFsc28gYWRkIHRoZSBiZWFjaCBzZWN0aW9uXG4gICAgLy8gaW1tZWRpYXRlbHkgdG8gdGhlIGxlZnQgb2YgdGhlIGxlZnQtbW9zdCBjb2xsYXBzZWQgYmVhY2ggc2VjdGlvbiwgZm9yXG4gICAgLy8gY29udmVuaWVuY2UsIHNpbmNlIHdlIG5lZWQgdG8gcmVmZXIgdG8gaXQgbGF0ZXIgYXMgdGhpcyBiZWFjaCBzZWN0aW9uXG4gICAgLy8gaXMgdGhlICdsZWZ0JyBzaXRlIG9mIGFuIGVkZ2UgZm9yIHdoaWNoIGEgc3RhcnQgcG9pbnQgaXMgc2V0LlxuICAgIGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zLnVuc2hpZnQobEFyYyk7XG4gICAgdGhpcy5kZXRhY2hDaXJjbGVFdmVudChsQXJjKTtcblxuICAgIC8vIGxvb2sgcmlnaHRcbiAgICB2YXIgckFyYyA9IG5leHQ7XG4gICAgd2hpbGUgKHJBcmMuY2lyY2xlRXZlbnQgJiYgYWJzX2ZuKHgtckFyYy5jaXJjbGVFdmVudC54KTwxZS05ICYmIGFic19mbih5LXJBcmMuY2lyY2xlRXZlbnQueWNlbnRlcik8MWUtOSkge1xuICAgICAgICBuZXh0ID0gckFyYy5yYk5leHQ7XG4gICAgICAgIGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zLnB1c2gockFyYyk7XG4gICAgICAgIHRoaXMuZGV0YWNoQmVhY2hzZWN0aW9uKHJBcmMpOyAvLyBtYXJrIGZvciByZXVzZVxuICAgICAgICByQXJjID0gbmV4dDtcbiAgICAgICAgfVxuICAgIC8vIHdlIGFsc28gaGF2ZSB0byBhZGQgdGhlIGJlYWNoIHNlY3Rpb24gaW1tZWRpYXRlbHkgdG8gdGhlIHJpZ2h0IG9mIHRoZVxuICAgIC8vIHJpZ2h0LW1vc3QgY29sbGFwc2VkIGJlYWNoIHNlY3Rpb24sIHNpbmNlIHRoZXJlIGlzIGFsc28gYSBkaXNhcHBlYXJpbmdcbiAgICAvLyB0cmFuc2l0aW9uIHJlcHJlc2VudGluZyBhbiBlZGdlJ3Mgc3RhcnQgcG9pbnQgb24gaXRzIGxlZnQuXG4gICAgZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnMucHVzaChyQXJjKTtcbiAgICB0aGlzLmRldGFjaENpcmNsZUV2ZW50KHJBcmMpO1xuXG4gICAgLy8gd2FsayB0aHJvdWdoIGFsbCB0aGUgZGlzYXBwZWFyaW5nIHRyYW5zaXRpb25zIGJldHdlZW4gYmVhY2ggc2VjdGlvbnMgYW5kXG4gICAgLy8gc2V0IHRoZSBzdGFydCBwb2ludCBvZiB0aGVpciAoaW1wbGllZCkgZWRnZS5cbiAgICB2YXIgbkFyY3MgPSBkaXNhcHBlYXJpbmdUcmFuc2l0aW9ucy5sZW5ndGgsXG4gICAgICAgIGlBcmM7XG4gICAgZm9yIChpQXJjPTE7IGlBcmM8bkFyY3M7IGlBcmMrKykge1xuICAgICAgICByQXJjID0gZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnNbaUFyY107XG4gICAgICAgIGxBcmMgPSBkaXNhcHBlYXJpbmdUcmFuc2l0aW9uc1tpQXJjLTFdO1xuICAgICAgICB0aGlzLnNldEVkZ2VTdGFydHBvaW50KHJBcmMuZWRnZSwgbEFyYy5zaXRlLCByQXJjLnNpdGUsIHZlcnRleCk7XG4gICAgICAgIH1cblxuICAgIC8vIGNyZWF0ZSBhIG5ldyBlZGdlIGFzIHdlIGhhdmUgbm93IGEgbmV3IHRyYW5zaXRpb24gYmV0d2VlblxuICAgIC8vIHR3byBiZWFjaCBzZWN0aW9ucyB3aGljaCB3ZXJlIHByZXZpb3VzbHkgbm90IGFkamFjZW50LlxuICAgIC8vIHNpbmNlIHRoaXMgZWRnZSBhcHBlYXJzIGFzIGEgbmV3IHZlcnRleCBpcyBkZWZpbmVkLCB0aGUgdmVydGV4XG4gICAgLy8gYWN0dWFsbHkgZGVmaW5lIGFuIGVuZCBwb2ludCBvZiB0aGUgZWRnZSAocmVsYXRpdmUgdG8gdGhlIHNpdGVcbiAgICAvLyBvbiB0aGUgbGVmdClcbiAgICBsQXJjID0gZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnNbMF07XG4gICAgckFyYyA9IGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zW25BcmNzLTFdO1xuICAgIHJBcmMuZWRnZSA9IHRoaXMuY3JlYXRlRWRnZShsQXJjLnNpdGUsIHJBcmMuc2l0ZSwgdW5kZWZpbmVkLCB2ZXJ0ZXgpO1xuXG4gICAgLy8gY3JlYXRlIGNpcmNsZSBldmVudHMgaWYgYW55IGZvciBiZWFjaCBzZWN0aW9ucyBsZWZ0IGluIHRoZSBiZWFjaGxpbmVcbiAgICAvLyBhZGphY2VudCB0byBjb2xsYXBzZWQgc2VjdGlvbnNcbiAgICB0aGlzLmF0dGFjaENpcmNsZUV2ZW50KGxBcmMpO1xuICAgIHRoaXMuYXR0YWNoQ2lyY2xlRXZlbnQockFyYyk7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuYWRkQmVhY2hzZWN0aW9uID0gZnVuY3Rpb24oc2l0ZSkge1xuICAgIHZhciB4ID0gc2l0ZS54LFxuICAgICAgICBkaXJlY3RyaXggPSBzaXRlLnk7XG5cbiAgICAvLyBmaW5kIHRoZSBsZWZ0IGFuZCByaWdodCBiZWFjaCBzZWN0aW9ucyB3aGljaCB3aWxsIHN1cnJvdW5kIHRoZSBuZXdseVxuICAgIC8vIGNyZWF0ZWQgYmVhY2ggc2VjdGlvbi5cbiAgICAvLyByaGlsbCAyMDExLTA2LTAxOiBUaGlzIGxvb3AgaXMgb25lIG9mIHRoZSBtb3N0IG9mdGVuIGV4ZWN1dGVkLFxuICAgIC8vIGhlbmNlIHdlIGV4cGFuZCBpbi1wbGFjZSB0aGUgY29tcGFyaXNvbi1hZ2FpbnN0LWVwc2lsb24gY2FsbHMuXG4gICAgdmFyIGxBcmMsIHJBcmMsXG4gICAgICAgIGR4bCwgZHhyLFxuICAgICAgICBub2RlID0gdGhpcy5iZWFjaGxpbmUucm9vdDtcblxuICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgIGR4bCA9IHRoaXMubGVmdEJyZWFrUG9pbnQobm9kZSxkaXJlY3RyaXgpLXg7XG4gICAgICAgIC8vIHggbGVzc1RoYW5XaXRoRXBzaWxvbiB4bCA9PiBmYWxscyBzb21ld2hlcmUgYmVmb3JlIHRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIGJlYWNoc2VjdGlvblxuICAgICAgICBpZiAoZHhsID4gMWUtOSkge1xuICAgICAgICAgICAgLy8gdGhpcyBjYXNlIHNob3VsZCBuZXZlciBoYXBwZW5cbiAgICAgICAgICAgIC8vIGlmICghbm9kZS5yYkxlZnQpIHtcbiAgICAgICAgICAgIC8vICAgIHJBcmMgPSBub2RlLnJiTGVmdDtcbiAgICAgICAgICAgIC8vICAgIGJyZWFrO1xuICAgICAgICAgICAgLy8gICAgfVxuICAgICAgICAgICAgbm9kZSA9IG5vZGUucmJMZWZ0O1xuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGR4ciA9IHgtdGhpcy5yaWdodEJyZWFrUG9pbnQobm9kZSxkaXJlY3RyaXgpO1xuICAgICAgICAgICAgLy8geCBncmVhdGVyVGhhbldpdGhFcHNpbG9uIHhyID0+IGZhbGxzIHNvbWV3aGVyZSBhZnRlciB0aGUgcmlnaHQgZWRnZSBvZiB0aGUgYmVhY2hzZWN0aW9uXG4gICAgICAgICAgICBpZiAoZHhyID4gMWUtOSkge1xuICAgICAgICAgICAgICAgIGlmICghbm9kZS5yYlJpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgIGxBcmMgPSBub2RlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLnJiUmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8geCBlcXVhbFdpdGhFcHNpbG9uIHhsID0+IGZhbGxzIGV4YWN0bHkgb24gdGhlIGxlZnQgZWRnZSBvZiB0aGUgYmVhY2hzZWN0aW9uXG4gICAgICAgICAgICAgICAgaWYgKGR4bCA+IC0xZS05KSB7XG4gICAgICAgICAgICAgICAgICAgIGxBcmMgPSBub2RlLnJiUHJldmlvdXM7XG4gICAgICAgICAgICAgICAgICAgIHJBcmMgPSBub2RlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8geCBlcXVhbFdpdGhFcHNpbG9uIHhyID0+IGZhbGxzIGV4YWN0bHkgb24gdGhlIHJpZ2h0IGVkZ2Ugb2YgdGhlIGJlYWNoc2VjdGlvblxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGR4ciA+IC0xZS05KSB7XG4gICAgICAgICAgICAgICAgICAgIGxBcmMgPSBub2RlO1xuICAgICAgICAgICAgICAgICAgICByQXJjID0gbm9kZS5yYk5leHQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBmYWxscyBleGFjdGx5IHNvbWV3aGVyZSBpbiB0aGUgbWlkZGxlIG9mIHRoZSBiZWFjaHNlY3Rpb25cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbEFyYyA9IHJBcmMgPSBub2RlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgLy8gYXQgdGhpcyBwb2ludCwga2VlcCBpbiBtaW5kIHRoYXQgbEFyYyBhbmQvb3IgckFyYyBjb3VsZCBiZVxuICAgIC8vIHVuZGVmaW5lZCBvciBudWxsLlxuXG4gICAgLy8gY3JlYXRlIGEgbmV3IGJlYWNoIHNlY3Rpb24gb2JqZWN0IGZvciB0aGUgc2l0ZSBhbmQgYWRkIGl0IHRvIFJCLXRyZWVcbiAgICB2YXIgbmV3QXJjID0gdGhpcy5jcmVhdGVCZWFjaHNlY3Rpb24oc2l0ZSk7XG4gICAgdGhpcy5iZWFjaGxpbmUucmJJbnNlcnRTdWNjZXNzb3IobEFyYywgbmV3QXJjKTtcblxuICAgIC8vIGNhc2VzOlxuICAgIC8vXG5cbiAgICAvLyBbbnVsbCxudWxsXVxuICAgIC8vIGxlYXN0IGxpa2VseSBjYXNlOiBuZXcgYmVhY2ggc2VjdGlvbiBpcyB0aGUgZmlyc3QgYmVhY2ggc2VjdGlvbiBvbiB0aGVcbiAgICAvLyBiZWFjaGxpbmUuXG4gICAgLy8gVGhpcyBjYXNlIG1lYW5zOlxuICAgIC8vICAgbm8gbmV3IHRyYW5zaXRpb24gYXBwZWFyc1xuICAgIC8vICAgbm8gY29sbGFwc2luZyBiZWFjaCBzZWN0aW9uXG4gICAgLy8gICBuZXcgYmVhY2hzZWN0aW9uIGJlY29tZSByb290IG9mIHRoZSBSQi10cmVlXG4gICAgaWYgKCFsQXJjICYmICFyQXJjKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgLy8gW2xBcmMsckFyY10gd2hlcmUgbEFyYyA9PSByQXJjXG4gICAgLy8gbW9zdCBsaWtlbHkgY2FzZTogbmV3IGJlYWNoIHNlY3Rpb24gc3BsaXQgYW4gZXhpc3RpbmcgYmVhY2hcbiAgICAvLyBzZWN0aW9uLlxuICAgIC8vIFRoaXMgY2FzZSBtZWFuczpcbiAgICAvLyAgIG9uZSBuZXcgdHJhbnNpdGlvbiBhcHBlYXJzXG4gICAgLy8gICB0aGUgbGVmdCBhbmQgcmlnaHQgYmVhY2ggc2VjdGlvbiBtaWdodCBiZSBjb2xsYXBzaW5nIGFzIGEgcmVzdWx0XG4gICAgLy8gICB0d28gbmV3IG5vZGVzIGFkZGVkIHRvIHRoZSBSQi10cmVlXG4gICAgaWYgKGxBcmMgPT09IHJBcmMpIHtcbiAgICAgICAgLy8gaW52YWxpZGF0ZSBjaXJjbGUgZXZlbnQgb2Ygc3BsaXQgYmVhY2ggc2VjdGlvblxuICAgICAgICB0aGlzLmRldGFjaENpcmNsZUV2ZW50KGxBcmMpO1xuXG4gICAgICAgIC8vIHNwbGl0IHRoZSBiZWFjaCBzZWN0aW9uIGludG8gdHdvIHNlcGFyYXRlIGJlYWNoIHNlY3Rpb25zXG4gICAgICAgIHJBcmMgPSB0aGlzLmNyZWF0ZUJlYWNoc2VjdGlvbihsQXJjLnNpdGUpO1xuICAgICAgICB0aGlzLmJlYWNobGluZS5yYkluc2VydFN1Y2Nlc3NvcihuZXdBcmMsIHJBcmMpO1xuXG4gICAgICAgIC8vIHNpbmNlIHdlIGhhdmUgYSBuZXcgdHJhbnNpdGlvbiBiZXR3ZWVuIHR3byBiZWFjaCBzZWN0aW9ucyxcbiAgICAgICAgLy8gYSBuZXcgZWRnZSBpcyBib3JuXG4gICAgICAgIG5ld0FyYy5lZGdlID0gckFyYy5lZGdlID0gdGhpcy5jcmVhdGVFZGdlKGxBcmMuc2l0ZSwgbmV3QXJjLnNpdGUpO1xuXG4gICAgICAgIC8vIGNoZWNrIHdoZXRoZXIgdGhlIGxlZnQgYW5kIHJpZ2h0IGJlYWNoIHNlY3Rpb25zIGFyZSBjb2xsYXBzaW5nXG4gICAgICAgIC8vIGFuZCBpZiBzbyBjcmVhdGUgY2lyY2xlIGV2ZW50cywgdG8gYmUgbm90aWZpZWQgd2hlbiB0aGUgcG9pbnQgb2ZcbiAgICAgICAgLy8gY29sbGFwc2UgaXMgcmVhY2hlZC5cbiAgICAgICAgdGhpcy5hdHRhY2hDaXJjbGVFdmVudChsQXJjKTtcbiAgICAgICAgdGhpcy5hdHRhY2hDaXJjbGVFdmVudChyQXJjKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAvLyBbbEFyYyxudWxsXVxuICAgIC8vIGV2ZW4gbGVzcyBsaWtlbHkgY2FzZTogbmV3IGJlYWNoIHNlY3Rpb24gaXMgdGhlICpsYXN0KiBiZWFjaCBzZWN0aW9uXG4gICAgLy8gb24gdGhlIGJlYWNobGluZSAtLSB0aGlzIGNhbiBoYXBwZW4gKm9ubHkqIGlmICphbGwqIHRoZSBwcmV2aW91cyBiZWFjaFxuICAgIC8vIHNlY3Rpb25zIGN1cnJlbnRseSBvbiB0aGUgYmVhY2hsaW5lIHNoYXJlIHRoZSBzYW1lIHkgdmFsdWUgYXNcbiAgICAvLyB0aGUgbmV3IGJlYWNoIHNlY3Rpb24uXG4gICAgLy8gVGhpcyBjYXNlIG1lYW5zOlxuICAgIC8vICAgb25lIG5ldyB0cmFuc2l0aW9uIGFwcGVhcnNcbiAgICAvLyAgIG5vIGNvbGxhcHNpbmcgYmVhY2ggc2VjdGlvbiBhcyBhIHJlc3VsdFxuICAgIC8vICAgbmV3IGJlYWNoIHNlY3Rpb24gYmVjb21lIHJpZ2h0LW1vc3Qgbm9kZSBvZiB0aGUgUkItdHJlZVxuICAgIGlmIChsQXJjICYmICFyQXJjKSB7XG4gICAgICAgIG5ld0FyYy5lZGdlID0gdGhpcy5jcmVhdGVFZGdlKGxBcmMuc2l0ZSxuZXdBcmMuc2l0ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgLy8gW251bGwsckFyY11cbiAgICAvLyBpbXBvc3NpYmxlIGNhc2U6IGJlY2F1c2Ugc2l0ZXMgYXJlIHN0cmljdGx5IHByb2Nlc3NlZCBmcm9tIHRvcCB0byBib3R0b20sXG4gICAgLy8gYW5kIGxlZnQgdG8gcmlnaHQsIHdoaWNoIGd1YXJhbnRlZXMgdGhhdCB0aGVyZSB3aWxsIGFsd2F5cyBiZSBhIGJlYWNoIHNlY3Rpb25cbiAgICAvLyBvbiB0aGUgbGVmdCAtLSBleGNlcHQgb2YgY291cnNlIHdoZW4gdGhlcmUgYXJlIG5vIGJlYWNoIHNlY3Rpb24gYXQgYWxsIG9uXG4gICAgLy8gdGhlIGJlYWNoIGxpbmUsIHdoaWNoIGNhc2Ugd2FzIGhhbmRsZWQgYWJvdmUuXG4gICAgLy8gcmhpbGwgMjAxMS0wNi0wMjogTm8gcG9pbnQgdGVzdGluZyBpbiBub24tZGVidWcgdmVyc2lvblxuICAgIC8vaWYgKCFsQXJjICYmIHJBcmMpIHtcbiAgICAvLyAgICB0aHJvdyBcIlZvcm9ub2kuYWRkQmVhY2hzZWN0aW9uKCk6IFdoYXQgaXMgdGhpcyBJIGRvbid0IGV2ZW5cIjtcbiAgICAvLyAgICB9XG5cbiAgICAvLyBbbEFyYyxyQXJjXSB3aGVyZSBsQXJjICE9IHJBcmNcbiAgICAvLyBzb21ld2hhdCBsZXNzIGxpa2VseSBjYXNlOiBuZXcgYmVhY2ggc2VjdGlvbiBmYWxscyAqZXhhY3RseSogaW4gYmV0d2VlbiB0d29cbiAgICAvLyBleGlzdGluZyBiZWFjaCBzZWN0aW9uc1xuICAgIC8vIFRoaXMgY2FzZSBtZWFuczpcbiAgICAvLyAgIG9uZSB0cmFuc2l0aW9uIGRpc2FwcGVhcnNcbiAgICAvLyAgIHR3byBuZXcgdHJhbnNpdGlvbnMgYXBwZWFyXG4gICAgLy8gICB0aGUgbGVmdCBhbmQgcmlnaHQgYmVhY2ggc2VjdGlvbiBtaWdodCBiZSBjb2xsYXBzaW5nIGFzIGEgcmVzdWx0XG4gICAgLy8gICBvbmx5IG9uZSBuZXcgbm9kZSBhZGRlZCB0byB0aGUgUkItdHJlZVxuICAgIGlmIChsQXJjICE9PSByQXJjKSB7XG4gICAgICAgIC8vIGludmFsaWRhdGUgY2lyY2xlIGV2ZW50cyBvZiBsZWZ0IGFuZCByaWdodCBzaXRlc1xuICAgICAgICB0aGlzLmRldGFjaENpcmNsZUV2ZW50KGxBcmMpO1xuICAgICAgICB0aGlzLmRldGFjaENpcmNsZUV2ZW50KHJBcmMpO1xuXG4gICAgICAgIC8vIGFuIGV4aXN0aW5nIHRyYW5zaXRpb24gZGlzYXBwZWFycywgbWVhbmluZyBhIHZlcnRleCBpcyBkZWZpbmVkIGF0XG4gICAgICAgIC8vIHRoZSBkaXNhcHBlYXJhbmNlIHBvaW50LlxuICAgICAgICAvLyBzaW5jZSB0aGUgZGlzYXBwZWFyYW5jZSBpcyBjYXVzZWQgYnkgdGhlIG5ldyBiZWFjaHNlY3Rpb24sIHRoZVxuICAgICAgICAvLyB2ZXJ0ZXggaXMgYXQgdGhlIGNlbnRlciBvZiB0aGUgY2lyY3Vtc2NyaWJlZCBjaXJjbGUgb2YgdGhlIGxlZnQsXG4gICAgICAgIC8vIG5ldyBhbmQgcmlnaHQgYmVhY2hzZWN0aW9ucy5cbiAgICAgICAgLy8gaHR0cDovL21hdGhmb3J1bS5vcmcvbGlicmFyeS9kcm1hdGgvdmlldy81NTAwMi5odG1sXG4gICAgICAgIC8vIEV4Y2VwdCB0aGF0IEkgYnJpbmcgdGhlIG9yaWdpbiBhdCBBIHRvIHNpbXBsaWZ5XG4gICAgICAgIC8vIGNhbGN1bGF0aW9uXG4gICAgICAgIHZhciBsU2l0ZSA9IGxBcmMuc2l0ZSxcbiAgICAgICAgICAgIGF4ID0gbFNpdGUueCxcbiAgICAgICAgICAgIGF5ID0gbFNpdGUueSxcbiAgICAgICAgICAgIGJ4PXNpdGUueC1heCxcbiAgICAgICAgICAgIGJ5PXNpdGUueS1heSxcbiAgICAgICAgICAgIHJTaXRlID0gckFyYy5zaXRlLFxuICAgICAgICAgICAgY3g9clNpdGUueC1heCxcbiAgICAgICAgICAgIGN5PXJTaXRlLnktYXksXG4gICAgICAgICAgICBkPTIqKGJ4KmN5LWJ5KmN4KSxcbiAgICAgICAgICAgIGhiPWJ4KmJ4K2J5KmJ5LFxuICAgICAgICAgICAgaGM9Y3gqY3grY3kqY3ksXG4gICAgICAgICAgICB2ZXJ0ZXggPSB0aGlzLmNyZWF0ZVZlcnRleCgoY3kqaGItYnkqaGMpL2QrYXgsIChieCpoYy1jeCpoYikvZCtheSk7XG5cbiAgICAgICAgLy8gb25lIHRyYW5zaXRpb24gZGlzYXBwZWFyXG4gICAgICAgIHRoaXMuc2V0RWRnZVN0YXJ0cG9pbnQockFyYy5lZGdlLCBsU2l0ZSwgclNpdGUsIHZlcnRleCk7XG5cbiAgICAgICAgLy8gdHdvIG5ldyB0cmFuc2l0aW9ucyBhcHBlYXIgYXQgdGhlIG5ldyB2ZXJ0ZXggbG9jYXRpb25cbiAgICAgICAgbmV3QXJjLmVkZ2UgPSB0aGlzLmNyZWF0ZUVkZ2UobFNpdGUsIHNpdGUsIHVuZGVmaW5lZCwgdmVydGV4KTtcbiAgICAgICAgckFyYy5lZGdlID0gdGhpcy5jcmVhdGVFZGdlKHNpdGUsIHJTaXRlLCB1bmRlZmluZWQsIHZlcnRleCk7XG5cbiAgICAgICAgLy8gY2hlY2sgd2hldGhlciB0aGUgbGVmdCBhbmQgcmlnaHQgYmVhY2ggc2VjdGlvbnMgYXJlIGNvbGxhcHNpbmdcbiAgICAgICAgLy8gYW5kIGlmIHNvIGNyZWF0ZSBjaXJjbGUgZXZlbnRzLCB0byBoYW5kbGUgdGhlIHBvaW50IG9mIGNvbGxhcHNlLlxuICAgICAgICB0aGlzLmF0dGFjaENpcmNsZUV2ZW50KGxBcmMpO1xuICAgICAgICB0aGlzLmF0dGFjaENpcmNsZUV2ZW50KHJBcmMpO1xuICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIENpcmNsZSBldmVudCBtZXRob2RzXG5cbi8vIHJoaWxsIDIwMTEtMDYtMDc6IEZvciBzb21lIHJlYXNvbnMsIHBlcmZvcm1hbmNlIHN1ZmZlcnMgc2lnbmlmaWNhbnRseVxuLy8gd2hlbiBpbnN0YW5jaWF0aW5nIGEgbGl0ZXJhbCBvYmplY3QgaW5zdGVhZCBvZiBhbiBlbXB0eSBjdG9yXG5Wb3Jvbm9pLnByb3RvdHlwZS5DaXJjbGVFdmVudCA9IGZ1bmN0aW9uKCkge1xuICAgIC8vIHJoaWxsIDIwMTMtMTAtMTI6IGl0IGhlbHBzIHRvIHN0YXRlIGV4YWN0bHkgd2hhdCB3ZSBhcmUgYXQgY3RvciB0aW1lLlxuICAgIHRoaXMuYXJjID0gbnVsbDtcbiAgICB0aGlzLnJiTGVmdCA9IG51bGw7XG4gICAgdGhpcy5yYk5leHQgPSBudWxsO1xuICAgIHRoaXMucmJQYXJlbnQgPSBudWxsO1xuICAgIHRoaXMucmJQcmV2aW91cyA9IG51bGw7XG4gICAgdGhpcy5yYlJlZCA9IGZhbHNlO1xuICAgIHRoaXMucmJSaWdodCA9IG51bGw7XG4gICAgdGhpcy5zaXRlID0gbnVsbDtcbiAgICB0aGlzLnggPSB0aGlzLnkgPSB0aGlzLnljZW50ZXIgPSAwO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmF0dGFjaENpcmNsZUV2ZW50ID0gZnVuY3Rpb24oYXJjKSB7XG4gICAgdmFyIGxBcmMgPSBhcmMucmJQcmV2aW91cyxcbiAgICAgICAgckFyYyA9IGFyYy5yYk5leHQ7XG4gICAgaWYgKCFsQXJjIHx8ICFyQXJjKSB7cmV0dXJuO30gLy8gZG9lcyB0aGF0IGV2ZXIgaGFwcGVuP1xuICAgIHZhciBsU2l0ZSA9IGxBcmMuc2l0ZSxcbiAgICAgICAgY1NpdGUgPSBhcmMuc2l0ZSxcbiAgICAgICAgclNpdGUgPSByQXJjLnNpdGU7XG5cbiAgICAvLyBJZiBzaXRlIG9mIGxlZnQgYmVhY2hzZWN0aW9uIGlzIHNhbWUgYXMgc2l0ZSBvZlxuICAgIC8vIHJpZ2h0IGJlYWNoc2VjdGlvbiwgdGhlcmUgY2FuJ3QgYmUgY29udmVyZ2VuY2VcbiAgICBpZiAobFNpdGU9PT1yU2l0ZSkge3JldHVybjt9XG5cbiAgICAvLyBGaW5kIHRoZSBjaXJjdW1zY3JpYmVkIGNpcmNsZSBmb3IgdGhlIHRocmVlIHNpdGVzIGFzc29jaWF0ZWRcbiAgICAvLyB3aXRoIHRoZSBiZWFjaHNlY3Rpb24gdHJpcGxldC5cbiAgICAvLyByaGlsbCAyMDExLTA1LTI2OiBJdCBpcyBtb3JlIGVmZmljaWVudCB0byBjYWxjdWxhdGUgaW4tcGxhY2VcbiAgICAvLyByYXRoZXIgdGhhbiBnZXR0aW5nIHRoZSByZXN1bHRpbmcgY2lyY3Vtc2NyaWJlZCBjaXJjbGUgZnJvbSBhblxuICAgIC8vIG9iamVjdCByZXR1cm5lZCBieSBjYWxsaW5nIFZvcm9ub2kuY2lyY3VtY2lyY2xlKClcbiAgICAvLyBodHRwOi8vbWF0aGZvcnVtLm9yZy9saWJyYXJ5L2RybWF0aC92aWV3LzU1MDAyLmh0bWxcbiAgICAvLyBFeGNlcHQgdGhhdCBJIGJyaW5nIHRoZSBvcmlnaW4gYXQgY1NpdGUgdG8gc2ltcGxpZnkgY2FsY3VsYXRpb25zLlxuICAgIC8vIFRoZSBib3R0b20tbW9zdCBwYXJ0IG9mIHRoZSBjaXJjdW1jaXJjbGUgaXMgb3VyIEZvcnR1bmUgJ2NpcmNsZVxuICAgIC8vIGV2ZW50JywgYW5kIGl0cyBjZW50ZXIgaXMgYSB2ZXJ0ZXggcG90ZW50aWFsbHkgcGFydCBvZiB0aGUgZmluYWxcbiAgICAvLyBWb3Jvbm9pIGRpYWdyYW0uXG4gICAgdmFyIGJ4ID0gY1NpdGUueCxcbiAgICAgICAgYnkgPSBjU2l0ZS55LFxuICAgICAgICBheCA9IGxTaXRlLngtYngsXG4gICAgICAgIGF5ID0gbFNpdGUueS1ieSxcbiAgICAgICAgY3ggPSByU2l0ZS54LWJ4LFxuICAgICAgICBjeSA9IHJTaXRlLnktYnk7XG5cbiAgICAvLyBJZiBwb2ludHMgbC0+Yy0+ciBhcmUgY2xvY2t3aXNlLCB0aGVuIGNlbnRlciBiZWFjaCBzZWN0aW9uIGRvZXMgbm90XG4gICAgLy8gY29sbGFwc2UsIGhlbmNlIGl0IGNhbid0IGVuZCB1cCBhcyBhIHZlcnRleCAod2UgcmV1c2UgJ2QnIGhlcmUsIHdoaWNoXG4gICAgLy8gc2lnbiBpcyByZXZlcnNlIG9mIHRoZSBvcmllbnRhdGlvbiwgaGVuY2Ugd2UgcmV2ZXJzZSB0aGUgdGVzdC5cbiAgICAvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0N1cnZlX29yaWVudGF0aW9uI09yaWVudGF0aW9uX29mX2Ffc2ltcGxlX3BvbHlnb25cbiAgICAvLyByaGlsbCAyMDExLTA1LTIxOiBOYXN0eSBmaW5pdGUgcHJlY2lzaW9uIGVycm9yIHdoaWNoIGNhdXNlZCBjaXJjdW1jaXJjbGUoKSB0b1xuICAgIC8vIHJldHVybiBpbmZpbml0ZXM6IDFlLTEyIHNlZW1zIHRvIGZpeCB0aGUgcHJvYmxlbS5cbiAgICB2YXIgZCA9IDIqKGF4KmN5LWF5KmN4KTtcbiAgICBpZiAoZCA+PSAtMmUtMTIpe3JldHVybjt9XG5cbiAgICB2YXIgaGEgPSBheCpheCtheSpheSxcbiAgICAgICAgaGMgPSBjeCpjeCtjeSpjeSxcbiAgICAgICAgeCA9IChjeSpoYS1heSpoYykvZCxcbiAgICAgICAgeSA9IChheCpoYy1jeCpoYSkvZCxcbiAgICAgICAgeWNlbnRlciA9IHkrYnk7XG5cbiAgICAvLyBJbXBvcnRhbnQ6IHlib3R0b20gc2hvdWxkIGFsd2F5cyBiZSB1bmRlciBvciBhdCBzd2VlcCwgc28gbm8gbmVlZFxuICAgIC8vIHRvIHdhc3RlIENQVSBjeWNsZXMgYnkgY2hlY2tpbmdcblxuICAgIC8vIHJlY3ljbGUgY2lyY2xlIGV2ZW50IG9iamVjdCBpZiBwb3NzaWJsZVxuICAgIHZhciBjaXJjbGVFdmVudCA9IHRoaXMuY2lyY2xlRXZlbnRKdW5reWFyZC5wb3AoKTtcbiAgICBpZiAoIWNpcmNsZUV2ZW50KSB7XG4gICAgICAgIGNpcmNsZUV2ZW50ID0gbmV3IHRoaXMuQ2lyY2xlRXZlbnQoKTtcbiAgICAgICAgfVxuICAgIGNpcmNsZUV2ZW50LmFyYyA9IGFyYztcbiAgICBjaXJjbGVFdmVudC5zaXRlID0gY1NpdGU7XG4gICAgY2lyY2xlRXZlbnQueCA9IHgrYng7XG4gICAgY2lyY2xlRXZlbnQueSA9IHljZW50ZXIrdGhpcy5zcXJ0KHgqeCt5KnkpOyAvLyB5IGJvdHRvbVxuICAgIGNpcmNsZUV2ZW50LnljZW50ZXIgPSB5Y2VudGVyO1xuICAgIGFyYy5jaXJjbGVFdmVudCA9IGNpcmNsZUV2ZW50O1xuXG4gICAgLy8gZmluZCBpbnNlcnRpb24gcG9pbnQgaW4gUkItdHJlZTogY2lyY2xlIGV2ZW50cyBhcmUgb3JkZXJlZCBmcm9tXG4gICAgLy8gc21hbGxlc3QgdG8gbGFyZ2VzdFxuICAgIHZhciBwcmVkZWNlc3NvciA9IG51bGwsXG4gICAgICAgIG5vZGUgPSB0aGlzLmNpcmNsZUV2ZW50cy5yb290O1xuICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgIGlmIChjaXJjbGVFdmVudC55IDwgbm9kZS55IHx8IChjaXJjbGVFdmVudC55ID09PSBub2RlLnkgJiYgY2lyY2xlRXZlbnQueCA8PSBub2RlLngpKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5yYkxlZnQpIHtcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5yYkxlZnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcHJlZGVjZXNzb3IgPSBub2RlLnJiUHJldmlvdXM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChub2RlLnJiUmlnaHQpIHtcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5yYlJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHByZWRlY2Vzc29yID0gbm9kZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB0aGlzLmNpcmNsZUV2ZW50cy5yYkluc2VydFN1Y2Nlc3NvcihwcmVkZWNlc3NvciwgY2lyY2xlRXZlbnQpO1xuICAgIGlmICghcHJlZGVjZXNzb3IpIHtcbiAgICAgICAgdGhpcy5maXJzdENpcmNsZUV2ZW50ID0gY2lyY2xlRXZlbnQ7XG4gICAgICAgIH1cbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5kZXRhY2hDaXJjbGVFdmVudCA9IGZ1bmN0aW9uKGFyYykge1xuICAgIHZhciBjaXJjbGVFdmVudCA9IGFyYy5jaXJjbGVFdmVudDtcbiAgICBpZiAoY2lyY2xlRXZlbnQpIHtcbiAgICAgICAgaWYgKCFjaXJjbGVFdmVudC5yYlByZXZpb3VzKSB7XG4gICAgICAgICAgICB0aGlzLmZpcnN0Q2lyY2xlRXZlbnQgPSBjaXJjbGVFdmVudC5yYk5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIHRoaXMuY2lyY2xlRXZlbnRzLnJiUmVtb3ZlTm9kZShjaXJjbGVFdmVudCk7IC8vIHJlbW92ZSBmcm9tIFJCLXRyZWVcbiAgICAgICAgdGhpcy5jaXJjbGVFdmVudEp1bmt5YXJkLnB1c2goY2lyY2xlRXZlbnQpO1xuICAgICAgICBhcmMuY2lyY2xlRXZlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBEaWFncmFtIGNvbXBsZXRpb24gbWV0aG9kc1xuXG4vLyBjb25uZWN0IGRhbmdsaW5nIGVkZ2VzIChub3QgaWYgYSBjdXJzb3J5IHRlc3QgdGVsbHMgdXNcbi8vIGl0IGlzIG5vdCBnb2luZyB0byBiZSB2aXNpYmxlLlxuLy8gcmV0dXJuIHZhbHVlOlxuLy8gICBmYWxzZTogdGhlIGRhbmdsaW5nIGVuZHBvaW50IGNvdWxkbid0IGJlIGNvbm5lY3RlZFxuLy8gICB0cnVlOiB0aGUgZGFuZ2xpbmcgZW5kcG9pbnQgY291bGQgYmUgY29ubmVjdGVkXG5Wb3Jvbm9pLnByb3RvdHlwZS5jb25uZWN0RWRnZSA9IGZ1bmN0aW9uKGVkZ2UsIGJib3gpIHtcbiAgICAvLyBza2lwIGlmIGVuZCBwb2ludCBhbHJlYWR5IGNvbm5lY3RlZFxuICAgIHZhciB2YiA9IGVkZ2UudmI7XG4gICAgaWYgKCEhdmIpIHtyZXR1cm4gdHJ1ZTt9XG5cbiAgICAvLyBtYWtlIGxvY2FsIGNvcHkgZm9yIHBlcmZvcm1hbmNlIHB1cnBvc2VcbiAgICB2YXIgdmEgPSBlZGdlLnZhLFxuICAgICAgICB4bCA9IGJib3gueGwsXG4gICAgICAgIHhyID0gYmJveC54cixcbiAgICAgICAgeXQgPSBiYm94Lnl0LFxuICAgICAgICB5YiA9IGJib3gueWIsXG4gICAgICAgIGxTaXRlID0gZWRnZS5sU2l0ZSxcbiAgICAgICAgclNpdGUgPSBlZGdlLnJTaXRlLFxuICAgICAgICBseCA9IGxTaXRlLngsXG4gICAgICAgIGx5ID0gbFNpdGUueSxcbiAgICAgICAgcnggPSByU2l0ZS54LFxuICAgICAgICByeSA9IHJTaXRlLnksXG4gICAgICAgIGZ4ID0gKGx4K3J4KS8yLFxuICAgICAgICBmeSA9IChseStyeSkvMixcbiAgICAgICAgZm0sIGZiO1xuXG4gICAgLy8gaWYgd2UgcmVhY2ggaGVyZSwgdGhpcyBtZWFucyBjZWxscyB3aGljaCB1c2UgdGhpcyBlZGdlIHdpbGwgbmVlZFxuICAgIC8vIHRvIGJlIGNsb3NlZCwgd2hldGhlciBiZWNhdXNlIHRoZSBlZGdlIHdhcyByZW1vdmVkLCBvciBiZWNhdXNlIGl0XG4gICAgLy8gd2FzIGNvbm5lY3RlZCB0byB0aGUgYm91bmRpbmcgYm94LlxuICAgIHRoaXMuY2VsbHNbbFNpdGUudm9yb25vaUlkXS5jbG9zZU1lID0gdHJ1ZTtcbiAgICB0aGlzLmNlbGxzW3JTaXRlLnZvcm9ub2lJZF0uY2xvc2VNZSA9IHRydWU7XG5cbiAgICAvLyBnZXQgdGhlIGxpbmUgZXF1YXRpb24gb2YgdGhlIGJpc2VjdG9yIGlmIGxpbmUgaXMgbm90IHZlcnRpY2FsXG4gICAgaWYgKHJ5ICE9PSBseSkge1xuICAgICAgICBmbSA9IChseC1yeCkvKHJ5LWx5KTtcbiAgICAgICAgZmIgPSBmeS1mbSpmeDtcbiAgICAgICAgfVxuXG4gICAgLy8gcmVtZW1iZXIsIGRpcmVjdGlvbiBvZiBsaW5lIChyZWxhdGl2ZSB0byBsZWZ0IHNpdGUpOlxuICAgIC8vIHVwd2FyZDogbGVmdC54IDwgcmlnaHQueFxuICAgIC8vIGRvd253YXJkOiBsZWZ0LnggPiByaWdodC54XG4gICAgLy8gaG9yaXpvbnRhbDogbGVmdC54ID09IHJpZ2h0LnhcbiAgICAvLyB1cHdhcmQ6IGxlZnQueCA8IHJpZ2h0LnhcbiAgICAvLyByaWdodHdhcmQ6IGxlZnQueSA8IHJpZ2h0LnlcbiAgICAvLyBsZWZ0d2FyZDogbGVmdC55ID4gcmlnaHQueVxuICAgIC8vIHZlcnRpY2FsOiBsZWZ0LnkgPT0gcmlnaHQueVxuXG4gICAgLy8gZGVwZW5kaW5nIG9uIHRoZSBkaXJlY3Rpb24sIGZpbmQgdGhlIGJlc3Qgc2lkZSBvZiB0aGVcbiAgICAvLyBib3VuZGluZyBib3ggdG8gdXNlIHRvIGRldGVybWluZSBhIHJlYXNvbmFibGUgc3RhcnQgcG9pbnRcblxuICAgIC8vIHJoaWxsIDIwMTMtMTItMDI6XG4gICAgLy8gV2hpbGUgYXQgaXQsIHNpbmNlIHdlIGhhdmUgdGhlIHZhbHVlcyB3aGljaCBkZWZpbmUgdGhlIGxpbmUsXG4gICAgLy8gY2xpcCB0aGUgZW5kIG9mIHZhIGlmIGl0IGlzIG91dHNpZGUgdGhlIGJib3guXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pL2lzc3Vlcy8xNVxuICAgIC8vIFRPRE86IERvIGFsbCB0aGUgY2xpcHBpbmcgaGVyZSByYXRoZXIgdGhhbiByZWx5IG9uIExpYW5nLUJhcnNreVxuICAgIC8vIHdoaWNoIGRvZXMgbm90IGRvIHdlbGwgc29tZXRpbWVzIGR1ZSB0byBsb3NzIG9mIGFyaXRobWV0aWNcbiAgICAvLyBwcmVjaXNpb24uIFRoZSBjb2RlIGhlcmUgZG9lc24ndCBkZWdyYWRlIGlmIG9uZSBvZiB0aGUgdmVydGV4IGlzXG4gICAgLy8gYXQgYSBodWdlIGRpc3RhbmNlLlxuXG4gICAgLy8gc3BlY2lhbCBjYXNlOiB2ZXJ0aWNhbCBsaW5lXG4gICAgaWYgKGZtID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gZG9lc24ndCBpbnRlcnNlY3Qgd2l0aCB2aWV3cG9ydFxuICAgICAgICBpZiAoZnggPCB4bCB8fCBmeCA+PSB4cikge3JldHVybiBmYWxzZTt9XG4gICAgICAgIC8vIGRvd253YXJkXG4gICAgICAgIGlmIChseCA+IHJ4KSB7XG4gICAgICAgICAgICBpZiAoIXZhIHx8IHZhLnkgPCB5dCkge1xuICAgICAgICAgICAgICAgIHZhID0gdGhpcy5jcmVhdGVWZXJ0ZXgoZngsIHl0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh2YS55ID49IHliKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoZngsIHliKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgLy8gdXB3YXJkXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS55ID4geWIpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KGZ4LCB5Yik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmEueSA8IHl0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoZngsIHl0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIC8vIGNsb3NlciB0byB2ZXJ0aWNhbCB0aGFuIGhvcml6b250YWwsIGNvbm5lY3Qgc3RhcnQgcG9pbnQgdG8gdGhlXG4gICAgLy8gdG9wIG9yIGJvdHRvbSBzaWRlIG9mIHRoZSBib3VuZGluZyBib3hcbiAgICBlbHNlIGlmIChmbSA8IC0xIHx8IGZtID4gMSkge1xuICAgICAgICAvLyBkb3dud2FyZFxuICAgICAgICBpZiAobHggPiByeCkge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS55IDwgeXQpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KCh5dC1mYikvZm0sIHl0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh2YS55ID49IHliKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoKHliLWZiKS9mbSwgeWIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAvLyB1cHdhcmRcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoIXZhIHx8IHZhLnkgPiB5Yikge1xuICAgICAgICAgICAgICAgIHZhID0gdGhpcy5jcmVhdGVWZXJ0ZXgoKHliLWZiKS9mbSwgeWIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHZhLnkgPCB5dCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KCh5dC1mYikvZm0sIHl0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIC8vIGNsb3NlciB0byBob3Jpem9udGFsIHRoYW4gdmVydGljYWwsIGNvbm5lY3Qgc3RhcnQgcG9pbnQgdG8gdGhlXG4gICAgLy8gbGVmdCBvciByaWdodCBzaWRlIG9mIHRoZSBib3VuZGluZyBib3hcbiAgICBlbHNlIHtcbiAgICAgICAgLy8gcmlnaHR3YXJkXG4gICAgICAgIGlmIChseSA8IHJ5KSB7XG4gICAgICAgICAgICBpZiAoIXZhIHx8IHZhLnggPCB4bCkge1xuICAgICAgICAgICAgICAgIHZhID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeGwsIGZtKnhsK2ZiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh2YS54ID49IHhyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeHIsIGZtKnhyK2ZiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgLy8gbGVmdHdhcmRcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoIXZhIHx8IHZhLnggPiB4cikge1xuICAgICAgICAgICAgICAgIHZhID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeHIsIGZtKnhyK2ZiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh2YS54IDwgeGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmIgPSB0aGlzLmNyZWF0ZVZlcnRleCh4bCwgZm0qeGwrZmIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgZWRnZS52YSA9IHZhO1xuICAgIGVkZ2UudmIgPSB2YjtcblxuICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbi8vIGxpbmUtY2xpcHBpbmcgY29kZSB0YWtlbiBmcm9tOlxuLy8gICBMaWFuZy1CYXJza3kgZnVuY3Rpb24gYnkgRGFuaWVsIFdoaXRlXG4vLyAgIGh0dHA6Ly93d3cuc2t5dG9waWEuY29tL3Byb2plY3QvYXJ0aWNsZXMvY29tcHNjaS9jbGlwcGluZy5odG1sXG4vLyBUaGFua3MhXG4vLyBBIGJpdCBtb2RpZmllZCB0byBtaW5pbWl6ZSBjb2RlIHBhdGhzXG5Wb3Jvbm9pLnByb3RvdHlwZS5jbGlwRWRnZSA9IGZ1bmN0aW9uKGVkZ2UsIGJib3gpIHtcbiAgICB2YXIgYXggPSBlZGdlLnZhLngsXG4gICAgICAgIGF5ID0gZWRnZS52YS55LFxuICAgICAgICBieCA9IGVkZ2UudmIueCxcbiAgICAgICAgYnkgPSBlZGdlLnZiLnksXG4gICAgICAgIHQwID0gMCxcbiAgICAgICAgdDEgPSAxLFxuICAgICAgICBkeCA9IGJ4LWF4LFxuICAgICAgICBkeSA9IGJ5LWF5O1xuICAgIC8vIGxlZnRcbiAgICB2YXIgcSA9IGF4LWJib3gueGw7XG4gICAgaWYgKGR4PT09MCAmJiBxPDApIHtyZXR1cm4gZmFsc2U7fVxuICAgIHZhciByID0gLXEvZHg7XG4gICAgaWYgKGR4PDApIHtcbiAgICAgICAgaWYgKHI8dDApIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocjx0MSkge3QxPXI7fVxuICAgICAgICB9XG4gICAgZWxzZSBpZiAoZHg+MCkge1xuICAgICAgICBpZiAocj50MSkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPnQwKSB7dDA9cjt9XG4gICAgICAgIH1cbiAgICAvLyByaWdodFxuICAgIHEgPSBiYm94LnhyLWF4O1xuICAgIGlmIChkeD09PTAgJiYgcTwwKSB7cmV0dXJuIGZhbHNlO31cbiAgICByID0gcS9keDtcbiAgICBpZiAoZHg8MCkge1xuICAgICAgICBpZiAocj50MSkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPnQwKSB7dDA9cjt9XG4gICAgICAgIH1cbiAgICBlbHNlIGlmIChkeD4wKSB7XG4gICAgICAgIGlmIChyPHQwKSB7cmV0dXJuIGZhbHNlO31cbiAgICAgICAgaWYgKHI8dDEpIHt0MT1yO31cbiAgICAgICAgfVxuICAgIC8vIHRvcFxuICAgIHEgPSBheS1iYm94Lnl0O1xuICAgIGlmIChkeT09PTAgJiYgcTwwKSB7cmV0dXJuIGZhbHNlO31cbiAgICByID0gLXEvZHk7XG4gICAgaWYgKGR5PDApIHtcbiAgICAgICAgaWYgKHI8dDApIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocjx0MSkge3QxPXI7fVxuICAgICAgICB9XG4gICAgZWxzZSBpZiAoZHk+MCkge1xuICAgICAgICBpZiAocj50MSkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPnQwKSB7dDA9cjt9XG4gICAgICAgIH1cbiAgICAvLyBib3R0b20gICAgICAgIFxuICAgIHEgPSBiYm94LnliLWF5O1xuICAgIGlmIChkeT09PTAgJiYgcTwwKSB7cmV0dXJuIGZhbHNlO31cbiAgICByID0gcS9keTtcbiAgICBpZiAoZHk8MCkge1xuICAgICAgICBpZiAocj50MSkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPnQwKSB7dDA9cjt9XG4gICAgICAgIH1cbiAgICBlbHNlIGlmIChkeT4wKSB7XG4gICAgICAgIGlmIChyPHQwKSB7cmV0dXJuIGZhbHNlO31cbiAgICAgICAgaWYgKHI8dDEpIHt0MT1yO31cbiAgICAgICAgfVxuXG4gICAgLy8gaWYgd2UgcmVhY2ggdGhpcyBwb2ludCwgVm9yb25vaSBlZGdlIGlzIHdpdGhpbiBiYm94XG5cbiAgICAvLyBpZiB0MCA+IDAsIHZhIG5lZWRzIHRvIGNoYW5nZVxuICAgIC8vIHJoaWxsIDIwMTEtMDYtMDM6IHdlIG5lZWQgdG8gY3JlYXRlIGEgbmV3IHZlcnRleCByYXRoZXJcbiAgICAvLyB0aGFuIG1vZGlmeWluZyB0aGUgZXhpc3Rpbmcgb25lLCBzaW5jZSB0aGUgZXhpc3RpbmdcbiAgICAvLyBvbmUgaXMgbGlrZWx5IHNoYXJlZCB3aXRoIGF0IGxlYXN0IGFub3RoZXIgZWRnZVxuICAgIGlmICh0MCA+IDApIHtcbiAgICAgICAgZWRnZS52YSA9IHRoaXMuY3JlYXRlVmVydGV4KGF4K3QwKmR4LCBheSt0MCpkeSk7XG4gICAgICAgIH1cblxuICAgIC8vIGlmIHQxIDwgMSwgdmIgbmVlZHMgdG8gY2hhbmdlXG4gICAgLy8gcmhpbGwgMjAxMS0wNi0wMzogd2UgbmVlZCB0byBjcmVhdGUgYSBuZXcgdmVydGV4IHJhdGhlclxuICAgIC8vIHRoYW4gbW9kaWZ5aW5nIHRoZSBleGlzdGluZyBvbmUsIHNpbmNlIHRoZSBleGlzdGluZ1xuICAgIC8vIG9uZSBpcyBsaWtlbHkgc2hhcmVkIHdpdGggYXQgbGVhc3QgYW5vdGhlciBlZGdlXG4gICAgaWYgKHQxIDwgMSkge1xuICAgICAgICBlZGdlLnZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoYXgrdDEqZHgsIGF5K3QxKmR5KTtcbiAgICAgICAgfVxuXG4gICAgLy8gdmEgYW5kL29yIHZiIHdlcmUgY2xpcHBlZCwgdGh1cyB3ZSB3aWxsIG5lZWQgdG8gY2xvc2VcbiAgICAvLyBjZWxscyB3aGljaCB1c2UgdGhpcyBlZGdlLlxuICAgIGlmICggdDAgPiAwIHx8IHQxIDwgMSApIHtcbiAgICAgICAgdGhpcy5jZWxsc1tlZGdlLmxTaXRlLnZvcm9ub2lJZF0uY2xvc2VNZSA9IHRydWU7XG4gICAgICAgIHRoaXMuY2VsbHNbZWRnZS5yU2l0ZS52b3Jvbm9pSWRdLmNsb3NlTWUgPSB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbi8vIENvbm5lY3QvY3V0IGVkZ2VzIGF0IGJvdW5kaW5nIGJveFxuVm9yb25vaS5wcm90b3R5cGUuY2xpcEVkZ2VzID0gZnVuY3Rpb24oYmJveCkge1xuICAgIC8vIGNvbm5lY3QgYWxsIGRhbmdsaW5nIGVkZ2VzIHRvIGJvdW5kaW5nIGJveFxuICAgIC8vIG9yIGdldCByaWQgb2YgdGhlbSBpZiBpdCBjYW4ndCBiZSBkb25lXG4gICAgdmFyIGVkZ2VzID0gdGhpcy5lZGdlcyxcbiAgICAgICAgaUVkZ2UgPSBlZGdlcy5sZW5ndGgsXG4gICAgICAgIGVkZ2UsXG4gICAgICAgIGFic19mbiA9IE1hdGguYWJzO1xuXG4gICAgLy8gaXRlcmF0ZSBiYWNrd2FyZCBzbyB3ZSBjYW4gc3BsaWNlIHNhZmVseVxuICAgIHdoaWxlIChpRWRnZS0tKSB7XG4gICAgICAgIGVkZ2UgPSBlZGdlc1tpRWRnZV07XG4gICAgICAgIC8vIGVkZ2UgaXMgcmVtb3ZlZCBpZjpcbiAgICAgICAgLy8gICBpdCBpcyB3aG9sbHkgb3V0c2lkZSB0aGUgYm91bmRpbmcgYm94XG4gICAgICAgIC8vICAgaXQgaXMgbG9va2luZyBtb3JlIGxpa2UgYSBwb2ludCB0aGFuIGEgbGluZVxuICAgICAgICBpZiAoIXRoaXMuY29ubmVjdEVkZ2UoZWRnZSwgYmJveCkgfHxcbiAgICAgICAgICAgICF0aGlzLmNsaXBFZGdlKGVkZ2UsIGJib3gpIHx8XG4gICAgICAgICAgICAoYWJzX2ZuKGVkZ2UudmEueC1lZGdlLnZiLngpPDFlLTkgJiYgYWJzX2ZuKGVkZ2UudmEueS1lZGdlLnZiLnkpPDFlLTkpKSB7XG4gICAgICAgICAgICBlZGdlLnZhID0gZWRnZS52YiA9IG51bGw7XG4gICAgICAgICAgICBlZGdlcy5zcGxpY2UoaUVkZ2UsMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyBDbG9zZSB0aGUgY2VsbHMuXG4vLyBUaGUgY2VsbHMgYXJlIGJvdW5kIGJ5IHRoZSBzdXBwbGllZCBib3VuZGluZyBib3guXG4vLyBFYWNoIGNlbGwgcmVmZXJzIHRvIGl0cyBhc3NvY2lhdGVkIHNpdGUsIGFuZCBhIGxpc3Rcbi8vIG9mIGhhbGZlZGdlcyBvcmRlcmVkIGNvdW50ZXJjbG9ja3dpc2UuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jbG9zZUNlbGxzID0gZnVuY3Rpb24oYmJveCkge1xuICAgIHZhciB4bCA9IGJib3gueGwsXG4gICAgICAgIHhyID0gYmJveC54cixcbiAgICAgICAgeXQgPSBiYm94Lnl0LFxuICAgICAgICB5YiA9IGJib3gueWIsXG4gICAgICAgIGNlbGxzID0gdGhpcy5jZWxscyxcbiAgICAgICAgaUNlbGwgPSBjZWxscy5sZW5ndGgsXG4gICAgICAgIGNlbGwsXG4gICAgICAgIGlMZWZ0LFxuICAgICAgICBoYWxmZWRnZXMsIG5IYWxmZWRnZXMsXG4gICAgICAgIGVkZ2UsXG4gICAgICAgIHZhLCB2YiwgdnosXG4gICAgICAgIGxhc3RCb3JkZXJTZWdtZW50LFxuICAgICAgICBhYnNfZm4gPSBNYXRoLmFicztcblxuICAgIHdoaWxlIChpQ2VsbC0tKSB7XG4gICAgICAgIGNlbGwgPSBjZWxsc1tpQ2VsbF07XG4gICAgICAgIC8vIHBydW5lLCBvcmRlciBoYWxmZWRnZXMgY291bnRlcmNsb2Nrd2lzZSwgdGhlbiBhZGQgbWlzc2luZyBvbmVzXG4gICAgICAgIC8vIHJlcXVpcmVkIHRvIGNsb3NlIGNlbGxzXG4gICAgICAgIGlmICghY2VsbC5wcmVwYXJlSGFsZmVkZ2VzKCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICBpZiAoIWNlbGwuY2xvc2VNZSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIC8vIGZpbmQgZmlyc3QgJ3VuY2xvc2VkJyBwb2ludC5cbiAgICAgICAgLy8gYW4gJ3VuY2xvc2VkJyBwb2ludCB3aWxsIGJlIHRoZSBlbmQgcG9pbnQgb2YgYSBoYWxmZWRnZSB3aGljaFxuICAgICAgICAvLyBkb2VzIG5vdCBtYXRjaCB0aGUgc3RhcnQgcG9pbnQgb2YgdGhlIGZvbGxvd2luZyBoYWxmZWRnZVxuICAgICAgICBoYWxmZWRnZXMgPSBjZWxsLmhhbGZlZGdlcztcbiAgICAgICAgbkhhbGZlZGdlcyA9IGhhbGZlZGdlcy5sZW5ndGg7XG4gICAgICAgIC8vIHNwZWNpYWwgY2FzZTogb25seSBvbmUgc2l0ZSwgaW4gd2hpY2ggY2FzZSwgdGhlIHZpZXdwb3J0IGlzIHRoZSBjZWxsXG4gICAgICAgIC8vIC4uLlxuXG4gICAgICAgIC8vIGFsbCBvdGhlciBjYXNlc1xuICAgICAgICBpTGVmdCA9IDA7XG4gICAgICAgIHdoaWxlIChpTGVmdCA8IG5IYWxmZWRnZXMpIHtcbiAgICAgICAgICAgIHZhID0gaGFsZmVkZ2VzW2lMZWZ0XS5nZXRFbmRwb2ludCgpO1xuICAgICAgICAgICAgdnogPSBoYWxmZWRnZXNbKGlMZWZ0KzEpICUgbkhhbGZlZGdlc10uZ2V0U3RhcnRwb2ludCgpO1xuICAgICAgICAgICAgLy8gaWYgZW5kIHBvaW50IGlzIG5vdCBlcXVhbCB0byBzdGFydCBwb2ludCwgd2UgbmVlZCB0byBhZGQgdGhlIG1pc3NpbmdcbiAgICAgICAgICAgIC8vIGhhbGZlZGdlKHMpIHVwIHRvIHZ6XG4gICAgICAgICAgICBpZiAoYWJzX2ZuKHZhLngtdnoueCk+PTFlLTkgfHwgYWJzX2ZuKHZhLnktdnoueSk+PTFlLTkpIHtcblxuICAgICAgICAgICAgICAgIC8vIHJoaWxsIDIwMTMtMTItMDI6XG4gICAgICAgICAgICAgICAgLy8gXCJIb2xlc1wiIGluIHRoZSBoYWxmZWRnZXMgYXJlIG5vdCBuZWNlc3NhcmlseSBhbHdheXMgYWRqYWNlbnQuXG4gICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pL2lzc3Vlcy8xNlxuXG4gICAgICAgICAgICAgICAgLy8gZmluZCBlbnRyeSBwb2ludDpcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRydWUpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyB3YWxrIGRvd253YXJkIGFsb25nIGxlZnQgc2lkZVxuICAgICAgICAgICAgICAgICAgICBjYXNlIHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2YS54LHhsKSAmJiB0aGlzLmxlc3NUaGFuV2l0aEVwc2lsb24odmEueSx5Yik6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei54LHhsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeGwsIGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueSA6IHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmEgPSB2YjtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHdhbGsgcmlnaHR3YXJkIGFsb25nIGJvdHRvbSBzaWRlXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgdGhpcy5lcXVhbFdpdGhFcHNpbG9uKHZhLnkseWIpICYmIHRoaXMubGVzc1RoYW5XaXRoRXBzaWxvbih2YS54LHhyKTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RCb3JkZXJTZWdtZW50ID0gdGhpcy5lcXVhbFdpdGhFcHNpbG9uKHZ6LnkseWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmIgPSB0aGlzLmNyZWF0ZVZlcnRleChsYXN0Qm9yZGVyU2VnbWVudCA/IHZ6LnggOiB4ciwgeWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZSA9IHRoaXMuY3JlYXRlQm9yZGVyRWRnZShjZWxsLnNpdGUsIHZhLCB2Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpTGVmdCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFsZmVkZ2VzLnNwbGljZShpTGVmdCwgMCwgdGhpcy5jcmVhdGVIYWxmZWRnZShlZGdlLCBjZWxsLnNpdGUsIG51bGwpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5IYWxmZWRnZXMrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggbGFzdEJvcmRlclNlZ21lbnQgKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YSA9IHZiO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gd2FsayB1cHdhcmQgYWxvbmcgcmlnaHQgc2lkZVxuICAgICAgICAgICAgICAgICAgICBjYXNlIHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2YS54LHhyKSAmJiB0aGlzLmdyZWF0ZXJUaGFuV2l0aEVwc2lsb24odmEueSx5dCk6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei54LHhyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeHIsIGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueSA6IHl0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmEgPSB2YjtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHdhbGsgbGVmdHdhcmQgYWxvbmcgdG9wIHNpZGVcbiAgICAgICAgICAgICAgICAgICAgY2FzZSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odmEueSx5dCkgJiYgdGhpcy5ncmVhdGVyVGhhbldpdGhFcHNpbG9uKHZhLngseGwpOlxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEJvcmRlclNlZ21lbnQgPSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odnoueSx5dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueCA6IHhsLCB5dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlID0gdGhpcy5jcmVhdGVCb3JkZXJFZGdlKGNlbGwuc2l0ZSwgdmEsIHZiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYWxmZWRnZXMuc3BsaWNlKGlMZWZ0LCAwLCB0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGNlbGwuc2l0ZSwgbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbkhhbGZlZGdlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBsYXN0Qm9yZGVyU2VnbWVudCApIHsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhID0gdmI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsIHRocm91Z2hcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2FsayBkb3dud2FyZCBhbG9uZyBsZWZ0IHNpZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RCb3JkZXJTZWdtZW50ID0gdGhpcy5lcXVhbFdpdGhFcHNpbG9uKHZ6LngseGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmIgPSB0aGlzLmNyZWF0ZVZlcnRleCh4bCwgbGFzdEJvcmRlclNlZ21lbnQgPyB2ei55IDogeWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZSA9IHRoaXMuY3JlYXRlQm9yZGVyRWRnZShjZWxsLnNpdGUsIHZhLCB2Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpTGVmdCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFsZmVkZ2VzLnNwbGljZShpTGVmdCwgMCwgdGhpcy5jcmVhdGVIYWxmZWRnZShlZGdlLCBjZWxsLnNpdGUsIG51bGwpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5IYWxmZWRnZXMrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggbGFzdEJvcmRlclNlZ21lbnQgKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YSA9IHZiO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdhbGsgcmlnaHR3YXJkIGFsb25nIGJvdHRvbSBzaWRlXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei55LHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgobGFzdEJvcmRlclNlZ21lbnQgPyB2ei54IDogeHIsIHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmEgPSB2YjtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB3YWxrIHVwd2FyZCBhbG9uZyByaWdodCBzaWRlXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei54LHhyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeHIsIGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueSA6IHl0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoXG5cbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IFwiVm9yb25vaS5jbG9zZUNlbGxzKCkgPiB0aGlzIG1ha2VzIG5vIHNlbnNlIVwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgY2VsbC5jbG9zZU1lID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIERlYnVnZ2luZyBoZWxwZXJcbi8qXG5Wb3Jvbm9pLnByb3RvdHlwZS5kdW1wQmVhY2hsaW5lID0gZnVuY3Rpb24oeSkge1xuICAgIGNvbnNvbGUubG9nKCdWb3Jvbm9pLmR1bXBCZWFjaGxpbmUoJWYpID4gQmVhY2hzZWN0aW9ucywgZnJvbSBsZWZ0IHRvIHJpZ2h0OicsIHkpO1xuICAgIGlmICggIXRoaXMuYmVhY2hsaW5lICkge1xuICAgICAgICBjb25zb2xlLmxvZygnICBOb25lJyk7XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIGJzID0gdGhpcy5iZWFjaGxpbmUuZ2V0Rmlyc3QodGhpcy5iZWFjaGxpbmUucm9vdCk7XG4gICAgICAgIHdoaWxlICggYnMgKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnICBzaXRlICVkOiB4bDogJWYsIHhyOiAlZicsIGJzLnNpdGUudm9yb25vaUlkLCB0aGlzLmxlZnRCcmVha1BvaW50KGJzLCB5KSwgdGhpcy5yaWdodEJyZWFrUG9pbnQoYnMsIHkpKTtcbiAgICAgICAgICAgIGJzID0gYnMucmJOZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbiovXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gSGVscGVyOiBRdWFudGl6ZSBzaXRlc1xuXG4vLyByaGlsbCAyMDEzLTEwLTEyOlxuLy8gVGhpcyBpcyB0byBzb2x2ZSBodHRwczovL2dpdGh1Yi5jb20vZ29yaGlsbC9KYXZhc2NyaXB0LVZvcm9ub2kvaXNzdWVzLzE1XG4vLyBTaW5jZSBub3QgYWxsIHVzZXJzIHdpbGwgZW5kIHVwIHVzaW5nIHRoZSBraW5kIG9mIGNvb3JkIHZhbHVlcyB3aGljaCB3b3VsZFxuLy8gY2F1c2UgdGhlIGlzc3VlIHRvIGFyaXNlLCBJIGNob3NlIHRvIGxldCB0aGUgdXNlciBkZWNpZGUgd2hldGhlciBvciBub3Rcbi8vIGhlIHNob3VsZCBzYW5pdGl6ZSBoaXMgY29vcmQgdmFsdWVzIHRocm91Z2ggdGhpcyBoZWxwZXIuIFRoaXMgd2F5LCBmb3Jcbi8vIHRob3NlIHVzZXJzIHdobyB1c2VzIGNvb3JkIHZhbHVlcyB3aGljaCBhcmUga25vd24gdG8gYmUgZmluZSwgbm8gb3ZlcmhlYWQgaXNcbi8vIGFkZGVkLlxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5xdWFudGl6ZVNpdGVzID0gZnVuY3Rpb24oc2l0ZXMpIHtcbiAgICB2YXIgzrUgPSB0aGlzLs61LFxuICAgICAgICBuID0gc2l0ZXMubGVuZ3RoLFxuICAgICAgICBzaXRlO1xuICAgIHdoaWxlICggbi0tICkge1xuICAgICAgICBzaXRlID0gc2l0ZXNbbl07XG4gICAgICAgIHNpdGUueCA9IE1hdGguZmxvb3Ioc2l0ZS54IC8gzrUpICogzrU7XG4gICAgICAgIHNpdGUueSA9IE1hdGguZmxvb3Ioc2l0ZS55IC8gzrUpICogzrU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEhlbHBlcjogUmVjeWNsZSBkaWFncmFtOiBhbGwgdmVydGV4LCBlZGdlIGFuZCBjZWxsIG9iamVjdHMgYXJlXG4vLyBcInN1cnJlbmRlcmVkXCIgdG8gdGhlIFZvcm9ub2kgb2JqZWN0IGZvciByZXVzZS5cbi8vIFRPRE86IHJoaWxsLXZvcm9ub2ktY29yZSB2MjogbW9yZSBwZXJmb3JtYW5jZSB0byBiZSBnYWluZWRcbi8vIHdoZW4gSSBjaGFuZ2UgdGhlIHNlbWFudGljIG9mIHdoYXQgaXMgcmV0dXJuZWQuXG5cblZvcm9ub2kucHJvdG90eXBlLnJlY3ljbGUgPSBmdW5jdGlvbihkaWFncmFtKSB7XG4gICAgaWYgKCBkaWFncmFtICkge1xuICAgICAgICBpZiAoIGRpYWdyYW0gaW5zdGFuY2VvZiB0aGlzLkRpYWdyYW0gKSB7XG4gICAgICAgICAgICB0aGlzLnRvUmVjeWNsZSA9IGRpYWdyYW07XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgJ1Zvcm9ub2kucmVjeWNsZURpYWdyYW0oKSA+IE5lZWQgYSBEaWFncmFtIG9iamVjdC4nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBUb3AtbGV2ZWwgRm9ydHVuZSBsb29wXG5cbi8vIHJoaWxsIDIwMTEtMDUtMTk6XG4vLyAgIFZvcm9ub2kgc2l0ZXMgYXJlIGtlcHQgY2xpZW50LXNpZGUgbm93LCB0byBhbGxvd1xuLy8gICB1c2VyIHRvIGZyZWVseSBtb2RpZnkgY29udGVudC4gQXQgY29tcHV0ZSB0aW1lLFxuLy8gICAqcmVmZXJlbmNlcyogdG8gc2l0ZXMgYXJlIGNvcGllZCBsb2NhbGx5LlxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jb21wdXRlID0gZnVuY3Rpb24oc2l0ZXMsIGJib3gpIHtcbiAgICAvLyB0byBtZWFzdXJlIGV4ZWN1dGlvbiB0aW1lXG4gICAgdmFyIHN0YXJ0VGltZSA9IG5ldyBEYXRlKCk7XG5cbiAgICAvLyBpbml0IGludGVybmFsIHN0YXRlXG4gICAgdGhpcy5yZXNldCgpO1xuXG4gICAgLy8gYW55IGRpYWdyYW0gZGF0YSBhdmFpbGFibGUgZm9yIHJlY3ljbGluZz9cbiAgICAvLyBJIGRvIHRoYXQgaGVyZSBzbyB0aGF0IHRoaXMgaXMgaW5jbHVkZWQgaW4gZXhlY3V0aW9uIHRpbWVcbiAgICBpZiAoIHRoaXMudG9SZWN5Y2xlICkge1xuICAgICAgICB0aGlzLnZlcnRleEp1bmt5YXJkID0gdGhpcy52ZXJ0ZXhKdW5reWFyZC5jb25jYXQodGhpcy50b1JlY3ljbGUudmVydGljZXMpO1xuICAgICAgICB0aGlzLmVkZ2VKdW5reWFyZCA9IHRoaXMuZWRnZUp1bmt5YXJkLmNvbmNhdCh0aGlzLnRvUmVjeWNsZS5lZGdlcyk7XG4gICAgICAgIHRoaXMuY2VsbEp1bmt5YXJkID0gdGhpcy5jZWxsSnVua3lhcmQuY29uY2F0KHRoaXMudG9SZWN5Y2xlLmNlbGxzKTtcbiAgICAgICAgdGhpcy50b1JlY3ljbGUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAvLyBJbml0aWFsaXplIHNpdGUgZXZlbnQgcXVldWVcbiAgICB2YXIgc2l0ZUV2ZW50cyA9IHNpdGVzLnNsaWNlKDApO1xuICAgIHNpdGVFdmVudHMuc29ydChmdW5jdGlvbihhLGIpe1xuICAgICAgICB2YXIgciA9IGIueSAtIGEueTtcbiAgICAgICAgaWYgKHIpIHtyZXR1cm4gcjt9XG4gICAgICAgIHJldHVybiBiLnggLSBhLng7XG4gICAgICAgIH0pO1xuXG4gICAgLy8gcHJvY2VzcyBxdWV1ZVxuICAgIHZhciBzaXRlID0gc2l0ZUV2ZW50cy5wb3AoKSxcbiAgICAgICAgc2l0ZWlkID0gMCxcbiAgICAgICAgeHNpdGV4LCAvLyB0byBhdm9pZCBkdXBsaWNhdGUgc2l0ZXNcbiAgICAgICAgeHNpdGV5LFxuICAgICAgICBjZWxscyA9IHRoaXMuY2VsbHMsXG4gICAgICAgIGNpcmNsZTtcblxuICAgIC8vIG1haW4gbG9vcFxuICAgIGZvciAoOzspIHtcbiAgICAgICAgLy8gd2UgbmVlZCB0byBmaWd1cmUgd2hldGhlciB3ZSBoYW5kbGUgYSBzaXRlIG9yIGNpcmNsZSBldmVudFxuICAgICAgICAvLyBmb3IgdGhpcyB3ZSBmaW5kIG91dCBpZiB0aGVyZSBpcyBhIHNpdGUgZXZlbnQgYW5kIGl0IGlzXG4gICAgICAgIC8vICdlYXJsaWVyJyB0aGFuIHRoZSBjaXJjbGUgZXZlbnRcbiAgICAgICAgY2lyY2xlID0gdGhpcy5maXJzdENpcmNsZUV2ZW50O1xuXG4gICAgICAgIC8vIGFkZCBiZWFjaCBzZWN0aW9uXG4gICAgICAgIGlmIChzaXRlICYmICghY2lyY2xlIHx8IHNpdGUueSA8IGNpcmNsZS55IHx8IChzaXRlLnkgPT09IGNpcmNsZS55ICYmIHNpdGUueCA8IGNpcmNsZS54KSkpIHtcbiAgICAgICAgICAgIC8vIG9ubHkgaWYgc2l0ZSBpcyBub3QgYSBkdXBsaWNhdGVcbiAgICAgICAgICAgIGlmIChzaXRlLnggIT09IHhzaXRleCB8fCBzaXRlLnkgIT09IHhzaXRleSkge1xuICAgICAgICAgICAgICAgIC8vIGZpcnN0IGNyZWF0ZSBjZWxsIGZvciBuZXcgc2l0ZVxuICAgICAgICAgICAgICAgIGNlbGxzW3NpdGVpZF0gPSB0aGlzLmNyZWF0ZUNlbGwoc2l0ZSk7XG4gICAgICAgICAgICAgICAgc2l0ZS52b3Jvbm9pSWQgPSBzaXRlaWQrKztcbiAgICAgICAgICAgICAgICAvLyB0aGVuIGNyZWF0ZSBhIGJlYWNoc2VjdGlvbiBmb3IgdGhhdCBzaXRlXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRCZWFjaHNlY3Rpb24oc2l0ZSk7XG4gICAgICAgICAgICAgICAgLy8gcmVtZW1iZXIgbGFzdCBzaXRlIGNvb3JkcyB0byBkZXRlY3QgZHVwbGljYXRlXG4gICAgICAgICAgICAgICAgeHNpdGV5ID0gc2l0ZS55O1xuICAgICAgICAgICAgICAgIHhzaXRleCA9IHNpdGUueDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBzaXRlID0gc2l0ZUV2ZW50cy5wb3AoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgYmVhY2ggc2VjdGlvblxuICAgICAgICBlbHNlIGlmIChjaXJjbGUpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlQmVhY2hzZWN0aW9uKGNpcmNsZS5hcmMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIC8vIGFsbCBkb25lLCBxdWl0XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIC8vIHdyYXBwaW5nLXVwOlxuICAgIC8vICAgY29ubmVjdCBkYW5nbGluZyBlZGdlcyB0byBib3VuZGluZyBib3hcbiAgICAvLyAgIGN1dCBlZGdlcyBhcyBwZXIgYm91bmRpbmcgYm94XG4gICAgLy8gICBkaXNjYXJkIGVkZ2VzIGNvbXBsZXRlbHkgb3V0c2lkZSBib3VuZGluZyBib3hcbiAgICAvLyAgIGRpc2NhcmQgZWRnZXMgd2hpY2ggYXJlIHBvaW50LWxpa2VcbiAgICB0aGlzLmNsaXBFZGdlcyhiYm94KTtcblxuICAgIC8vICAgYWRkIG1pc3NpbmcgZWRnZXMgaW4gb3JkZXIgdG8gY2xvc2Ugb3BlbmVkIGNlbGxzXG4gICAgdGhpcy5jbG9zZUNlbGxzKGJib3gpO1xuXG4gICAgLy8gdG8gbWVhc3VyZSBleGVjdXRpb24gdGltZVxuICAgIHZhciBzdG9wVGltZSA9IG5ldyBEYXRlKCk7XG5cbiAgICAvLyBwcmVwYXJlIHJldHVybiB2YWx1ZXNcbiAgICB2YXIgZGlhZ3JhbSA9IG5ldyB0aGlzLkRpYWdyYW0oKTtcbiAgICBkaWFncmFtLmNlbGxzID0gdGhpcy5jZWxscztcbiAgICBkaWFncmFtLmVkZ2VzID0gdGhpcy5lZGdlcztcbiAgICBkaWFncmFtLnZlcnRpY2VzID0gdGhpcy52ZXJ0aWNlcztcbiAgICBkaWFncmFtLmV4ZWNUaW1lID0gc3RvcFRpbWUuZ2V0VGltZSgpLXN0YXJ0VGltZS5nZXRUaW1lKCk7XG5cbiAgICAvLyBjbGVhbiB1cFxuICAgIHRoaXMucmVzZXQoKTtcblxuICAgIHJldHVybiBkaWFncmFtO1xuICAgIH07XG5cbmlmKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSBtb2R1bGUuZXhwb3J0cyA9IFZvcm9ub2k7XG4iXX0=

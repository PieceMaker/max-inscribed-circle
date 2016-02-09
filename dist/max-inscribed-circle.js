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

},{"turf-bearing":3,"turf-destination":4,"turf-distance":5,"turf-linestring":9,"turf-point":10}],2:[function(require,module,exports){
var Voronoi = require('voronoi');
var voronoi = new Voronoi;
var point = require('turf-point');
var pointOnLine = require('./lib/turf-point-on-line/index.js');
var within = require('turf-within');

/**
 * Takes a polygon feature and estimates the best position for label placement that is guaranteed to be inside the polygon. This uses voronoi to estimate the medial axis.
 *
 * @module turf/label-position
 * @param {Polygon} polygon a Polygon feature of the underlying polygon geometry in EPSG:4326
 * @returns {Point} a Point feature at the best estimated label position
 */

module.exports = function(polygon) {
    fixMultiPoly(polygon);
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
/**
 * Takes a polygon and generates the sites needed to generate Voronoi
 *
 * @param polygon
 * @returns {{sites: Array, bbox: {xl: *, xr: *, yt: *, yb: *}}}
 */
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
                if(polyRing[j][1] < ymin) {
                    ymin = polyRing[j][1];
                }
                if(polyRing[j][1] > ymax) {
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

/**
 * Checks to see if the feature is a Polygon formatted as a MultiPolygon. Does not return anything,
 * instead saves results directly back to feature passed in.
 *
 * @param polygon
 */
function fixMultiPoly(polygon) {
    if(polygon.geometry.type == 'MultiPolygon' && polygon.geometry.coordinates[0].length == 1) {
        polygon.geometry.type = 'Polygon';
        polygon.geometry.coordinates = polygon.geometry.coordinates[0];
    }
    //TODO: Implement logic to test for actual MultiPolygon and return piece with largest area as a Polygon.
}
},{"./lib/turf-point-on-line/index.js":1,"turf-point":10,"turf-within":11,"voronoi":12}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
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

},{"turf-point":10}],5:[function(require,module,exports){
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

},{"turf-invariant":8}],6:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
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

},{}]},{},[2])(2)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvdHVyZi1wb2ludC1vbi1saW5lL2luZGV4LmpzIiwibWF4SW5zY3JpYmVkQ2lyY2xlLmpzIiwibm9kZV9tb2R1bGVzL3R1cmYtYmVhcmluZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLWRlc3RpbmF0aW9uL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3R1cmYtZGlzdGFuY2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdHVyZi1mZWF0dXJlY29sbGVjdGlvbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLWluc2lkZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLWludmFyaWFudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLWxpbmVzdHJpbmcvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdHVyZi1wb2ludC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLXdpdGhpbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy92b3Jvbm9pL3JoaWxsLXZvcm9ub2ktY29yZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBkaXN0YW5jZSA9IHJlcXVpcmUoJ3R1cmYtZGlzdGFuY2UnKTtcclxudmFyIHBvaW50ID0gcmVxdWlyZSgndHVyZi1wb2ludCcpO1xyXG52YXIgbGluZXN0cmluZyA9IHJlcXVpcmUoJ3R1cmYtbGluZXN0cmluZycpO1xyXG52YXIgYmVhcmluZyA9IHJlcXVpcmUoJ3R1cmYtYmVhcmluZycpO1xyXG52YXIgZGVzdGluYXRpb24gPSByZXF1aXJlKCd0dXJmLWRlc3RpbmF0aW9uJyk7XHJcblxyXG4vKipcclxuICogVGFrZXMgYSBQb2ludCBhbmQgYSBMaW5lU3RyaW5nIGFuZCBjYWxjdWxhdGVzIHRoZSBjbG9zZXN0IFBvaW50IG9uIHRoZSBMaW5lU3RyaW5nXHJcbiAqXHJcbiAqIEBtb2R1bGUgdHVyZi9wb2ludC1vbi1saW5lXHJcbiAqXHJcbiAqIEBwYXJhbSB7TGluZVN0cmluZ30gTGluZSB0byBzbmFwIHRvXHJcbiAqIEBwYXJhbSB7UG9pbnR9IFBvaW50IHRvIHNuYXAgZnJvbVxyXG4gKiBAcmV0dXJuIHtQb2ludH0gQ2xvc2VzdCBQb2ludCBvbiB0aGUgTGluZVxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgbGluZSA9IHtcclxuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXHJcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxyXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xyXG4gKiAgICAgXCJ0eXBlXCI6IFwiTGluZVN0cmluZ1wiLFxyXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbXHJcbiAqICAgICAgIFstNzcuMDMxNjY5LCAzOC44Nzg2MDVdLFxyXG4gKiAgICAgICBbLTc3LjAyOTYwOSwgMzguODgxOTQ2XSxcclxuICogICAgICAgWy03Ny4wMjAzMzksIDM4Ljg4NDA4NF0sXHJcbiAqICAgICAgIFstNzcuMDI1NjYxLCAzOC44ODU4MjFdLFxyXG4gKiAgICAgICBbLTc3LjAyMTg4NCwgMzguODg5NTYzXSxcclxuICogICAgICAgWy03Ny4wMTk4MjQsIDM4Ljg5MjM2OF1cclxuICogICAgIF1cclxuICogICB9XHJcbiAqIH07XHJcbiAqIHZhciBwdCA9IHtcclxuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXHJcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxyXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xyXG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcclxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWy03Ny4wMzcwNzYsIDM4Ljg4NDAxN11cclxuICogICB9XHJcbiAqIH07XHJcbiAqIFxyXG4gKiB2YXIgc25hcHBlZCA9IHR1cmYucG9pbnRPbkxpbmUobGluZSwgcHQpO1xyXG4gKiBzbmFwcGVkLnByb3BlcnRpZXNbJ21hcmtlci1jb2xvciddID0gJyMwMGYnXHJcbiAqXHJcbiAqIHZhciByZXN1bHQgPSB7XHJcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcclxuICogICBcImZlYXR1cmVzXCI6IFtsaW5lLCBwdCwgc25hcHBlZF1cclxuICogfTtcclxuICpcclxuICogLy89cmVzdWx0XHJcbiAqL1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAobGluZSwgcHQpIHsgIFxyXG4gIHZhciBjb29yZHM7XHJcbiAgaWYobGluZS50eXBlID09PSAnRmVhdHVyZScpIGNvb3JkcyA9IGxpbmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XHJcbiAgZWxzZSBpZihsaW5lLnR5cGUgPT09ICdMaW5lU3RyaW5nJykgY29vcmRzID0gbGluZS5nZW9tZXRyeS5jb29yZGluYXRlcztcclxuICBlbHNlIHRocm93IG5ldyBFcnJvcignaW5wdXQgbXVzdCBiZSBhIExpbmVTdHJpbmcgRmVhdHVyZSBvciBHZW9tZXRyeScpO1xyXG5cclxuICByZXR1cm4gcG9pbnRPbkxpbmUocHQsIGNvb3Jkcyk7XHJcbn07XHJcblxyXG5mdW5jdGlvbiBwb2ludE9uTGluZSAocHQsIGNvb3Jkcykge1xyXG4gIHZhciB1bml0cyA9ICdtaWxlcyc7XHJcbiAgdmFyIGNsb3Nlc3RQdCA9IHBvaW50KFtJbmZpbml0eSwgSW5maW5pdHldLCB7ZGlzdDogSW5maW5pdHl9KTtcclxuICBmb3IodmFyIGkgPSAwOyBpIDwgY29vcmRzLmxlbmd0aCAtIDE7IGkrKykge1xyXG4gICAgdmFyIHN0YXJ0ID0gcG9pbnQoY29vcmRzW2ldKTtcclxuICAgIHZhciBzdG9wID0gcG9pbnQoY29vcmRzW2krMV0pO1xyXG4gICAgLy9zdGFydFxyXG4gICAgc3RhcnQucHJvcGVydGllcy5kaXN0ID0gZGlzdGFuY2UocHQsIHN0YXJ0LCB1bml0cyk7XHJcbiAgICAvL3N0b3BcclxuICAgIHN0b3AucHJvcGVydGllcy5kaXN0ID0gZGlzdGFuY2UocHQsIHN0b3AsIHVuaXRzKTtcclxuICAgIC8vcGVycGVuZGljdWxhclxyXG4gICAgdmFyIGRpcmVjdGlvbiA9IGJlYXJpbmcoc3RhcnQsIHN0b3ApO1xyXG4gICAgdmFyIHBlcnBlbmRpY3VsYXJQdCA9IGRlc3RpbmF0aW9uKHB0LCAxMDAwICwgZGlyZWN0aW9uICsgOTAsIHVuaXRzKTsgLy8gMTAwMCA9IGdyb3NzXHJcbiAgICB2YXIgaW50ZXJzZWN0ID0gbGluZUludGVyc2VjdHMoXHJcbiAgICAgIHB0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLFxyXG4gICAgICBwdC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXSxcclxuICAgICAgcGVycGVuZGljdWxhclB0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLFxyXG4gICAgICBwZXJwZW5kaWN1bGFyUHQuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV0sXHJcbiAgICAgIHN0YXJ0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLFxyXG4gICAgICBzdGFydC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXSxcclxuICAgICAgc3RvcC5nZW9tZXRyeS5jb29yZGluYXRlc1swXSxcclxuICAgICAgc3RvcC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXVxyXG4gICAgICApO1xyXG4gICAgaWYoIWludGVyc2VjdCkge1xyXG4gICAgICBwZXJwZW5kaWN1bGFyUHQgPSBkZXN0aW5hdGlvbihwdCwgMTAwMCAsIGRpcmVjdGlvbiAtIDkwLCB1bml0cyk7IC8vIDEwMDAgPSBncm9zc1xyXG4gICAgICBpbnRlcnNlY3QgPSBsaW5lSW50ZXJzZWN0cyhcclxuICAgICAgICBwdC5nZW9tZXRyeS5jb29yZGluYXRlc1swXSxcclxuICAgICAgICBwdC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXSxcclxuICAgICAgICBwZXJwZW5kaWN1bGFyUHQuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0sXHJcbiAgICAgICAgcGVycGVuZGljdWxhclB0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzFdLFxyXG4gICAgICAgIHN0YXJ0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLFxyXG4gICAgICAgIHN0YXJ0Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzFdLFxyXG4gICAgICAgIHN0b3AuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0sXHJcbiAgICAgICAgc3RvcC5nZW9tZXRyeS5jb29yZGluYXRlc1sxXVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbiAgICBwZXJwZW5kaWN1bGFyUHQucHJvcGVydGllcy5kaXN0ID0gSW5maW5pdHk7XHJcbiAgICB2YXIgaW50ZXJzZWN0UHQ7XHJcbiAgICBpZihpbnRlcnNlY3QpIHtcclxuICAgICAgdmFyIGludGVyc2VjdFB0ID0gcG9pbnQoaW50ZXJzZWN0KTtcclxuICAgICAgaW50ZXJzZWN0UHQucHJvcGVydGllcy5kaXN0ID0gZGlzdGFuY2UocHQsIGludGVyc2VjdFB0LCB1bml0cyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGlmKHN0YXJ0LnByb3BlcnRpZXMuZGlzdCA8IGNsb3Nlc3RQdC5wcm9wZXJ0aWVzLmRpc3QpIHtcclxuICAgICAgY2xvc2VzdFB0ID0gc3RhcnQ7XHJcbiAgICAgIGNsb3Nlc3RQdC5wcm9wZXJ0aWVzLmluZGV4ID0gaTtcclxuICAgIH1cclxuICAgIGlmKHN0b3AucHJvcGVydGllcy5kaXN0IDwgY2xvc2VzdFB0LnByb3BlcnRpZXMuZGlzdCkge1xyXG4gICAgIGNsb3Nlc3RQdCA9IHN0b3A7XHJcbiAgICAgY2xvc2VzdFB0LnByb3BlcnRpZXMuaW5kZXggPSBpO1xyXG4gICAgfVxyXG4gICAgaWYoaW50ZXJzZWN0UHQgJiYgaW50ZXJzZWN0UHQucHJvcGVydGllcy5kaXN0IDwgY2xvc2VzdFB0LnByb3BlcnRpZXMuZGlzdCl7IFxyXG4gICAgICBjbG9zZXN0UHQgPSBpbnRlcnNlY3RQdDtcclxuICAgICAgY2xvc2VzdFB0LnByb3BlcnRpZXMuaW5kZXggPSBpO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICByZXR1cm4gY2xvc2VzdFB0O1xyXG59XHJcblxyXG4vLyBtb2RpZmllZCBmcm9tIGh0dHA6Ly9qc2ZpZGRsZS5uZXQvanVzdGluX2Nfcm91bmRzL0dkMlMyL2xpZ2h0L1xyXG5mdW5jdGlvbiBsaW5lSW50ZXJzZWN0cyhsaW5lMVN0YXJ0WCwgbGluZTFTdGFydFksIGxpbmUxRW5kWCwgbGluZTFFbmRZLCBsaW5lMlN0YXJ0WCwgbGluZTJTdGFydFksIGxpbmUyRW5kWCwgbGluZTJFbmRZKSB7XHJcbiAgLy8gaWYgdGhlIGxpbmVzIGludGVyc2VjdCwgdGhlIHJlc3VsdCBjb250YWlucyB0aGUgeCBhbmQgeSBvZiB0aGUgaW50ZXJzZWN0aW9uICh0cmVhdGluZyB0aGUgbGluZXMgYXMgaW5maW5pdGUpIGFuZCBib29sZWFucyBmb3Igd2hldGhlciBsaW5lIHNlZ21lbnQgMSBvciBsaW5lIHNlZ21lbnQgMiBjb250YWluIHRoZSBwb2ludFxyXG4gIHZhciBkZW5vbWluYXRvciwgYSwgYiwgbnVtZXJhdG9yMSwgbnVtZXJhdG9yMiwgcmVzdWx0ID0ge1xyXG4gICAgeDogbnVsbCxcclxuICAgIHk6IG51bGwsXHJcbiAgICBvbkxpbmUxOiBmYWxzZSxcclxuICAgIG9uTGluZTI6IGZhbHNlXHJcbiAgfTtcclxuICBkZW5vbWluYXRvciA9ICgobGluZTJFbmRZIC0gbGluZTJTdGFydFkpICogKGxpbmUxRW5kWCAtIGxpbmUxU3RhcnRYKSkgLSAoKGxpbmUyRW5kWCAtIGxpbmUyU3RhcnRYKSAqIChsaW5lMUVuZFkgLSBsaW5lMVN0YXJ0WSkpO1xyXG4gIGlmIChkZW5vbWluYXRvciA9PSAwKSB7XHJcbiAgICBpZihyZXN1bHQueCAhPSBudWxsICYmIHJlc3VsdC55ICE9IG51bGwpIHtcclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICB9XHJcbiAgYSA9IGxpbmUxU3RhcnRZIC0gbGluZTJTdGFydFk7XHJcbiAgYiA9IGxpbmUxU3RhcnRYIC0gbGluZTJTdGFydFg7XHJcbiAgbnVtZXJhdG9yMSA9ICgobGluZTJFbmRYIC0gbGluZTJTdGFydFgpICogYSkgLSAoKGxpbmUyRW5kWSAtIGxpbmUyU3RhcnRZKSAqIGIpO1xyXG4gIG51bWVyYXRvcjIgPSAoKGxpbmUxRW5kWCAtIGxpbmUxU3RhcnRYKSAqIGEpIC0gKChsaW5lMUVuZFkgLSBsaW5lMVN0YXJ0WSkgKiBiKTtcclxuICBhID0gbnVtZXJhdG9yMSAvIGRlbm9taW5hdG9yO1xyXG4gIGIgPSBudW1lcmF0b3IyIC8gZGVub21pbmF0b3I7XHJcblxyXG4gIC8vIGlmIHdlIGNhc3QgdGhlc2UgbGluZXMgaW5maW5pdGVseSBpbiBib3RoIGRpcmVjdGlvbnMsIHRoZXkgaW50ZXJzZWN0IGhlcmU6XHJcbiAgcmVzdWx0LnggPSBsaW5lMVN0YXJ0WCArIChhICogKGxpbmUxRW5kWCAtIGxpbmUxU3RhcnRYKSk7XHJcbiAgcmVzdWx0LnkgPSBsaW5lMVN0YXJ0WSArIChhICogKGxpbmUxRW5kWSAtIGxpbmUxU3RhcnRZKSk7XHJcblxyXG4gIC8vIGlmIGxpbmUxIGlzIGEgc2VnbWVudCBhbmQgbGluZTIgaXMgaW5maW5pdGUsIHRoZXkgaW50ZXJzZWN0IGlmOlxyXG4gIGlmIChhID49IDAgJiYgYSA8PSAxKSB7XHJcbiAgICByZXN1bHQub25MaW5lMSA9IHRydWU7XHJcbiAgfVxyXG4gIC8vIGlmIGxpbmUyIGlzIGEgc2VnbWVudCBhbmQgbGluZTEgaXMgaW5maW5pdGUsIHRoZXkgaW50ZXJzZWN0IGlmOlxyXG4gIGlmIChiID49IDAgJiYgYiA8PSAxKSB7XHJcbiAgICByZXN1bHQub25MaW5lMiA9IHRydWU7XHJcbiAgfVxyXG4gIC8vIGlmIGxpbmUxIGFuZCBsaW5lMiBhcmUgc2VnbWVudHMsIHRoZXkgaW50ZXJzZWN0IGlmIGJvdGggb2YgdGhlIGFib3ZlIGFyZSB0cnVlXHJcbiAgaWYocmVzdWx0Lm9uTGluZTEgJiYgcmVzdWx0Lm9uTGluZTIpe1xyXG4gICAgcmV0dXJuIFtyZXN1bHQueCwgcmVzdWx0LnldO1xyXG4gIH1cclxuICBlbHNlIHtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcbn1cclxuIiwidmFyIFZvcm9ub2kgPSByZXF1aXJlKCd2b3Jvbm9pJyk7XHJcbnZhciB2b3Jvbm9pID0gbmV3IFZvcm9ub2k7XHJcbnZhciBwb2ludCA9IHJlcXVpcmUoJ3R1cmYtcG9pbnQnKTtcclxudmFyIHBvaW50T25MaW5lID0gcmVxdWlyZSgnLi9saWIvdHVyZi1wb2ludC1vbi1saW5lL2luZGV4LmpzJyk7XHJcbnZhciB3aXRoaW4gPSByZXF1aXJlKCd0dXJmLXdpdGhpbicpO1xyXG5cclxuLyoqXHJcbiAqIFRha2VzIGEgcG9seWdvbiBmZWF0dXJlIGFuZCBlc3RpbWF0ZXMgdGhlIGJlc3QgcG9zaXRpb24gZm9yIGxhYmVsIHBsYWNlbWVudCB0aGF0IGlzIGd1YXJhbnRlZWQgdG8gYmUgaW5zaWRlIHRoZSBwb2x5Z29uLiBUaGlzIHVzZXMgdm9yb25vaSB0byBlc3RpbWF0ZSB0aGUgbWVkaWFsIGF4aXMuXHJcbiAqXHJcbiAqIEBtb2R1bGUgdHVyZi9sYWJlbC1wb3NpdGlvblxyXG4gKiBAcGFyYW0ge1BvbHlnb259IHBvbHlnb24gYSBQb2x5Z29uIGZlYXR1cmUgb2YgdGhlIHVuZGVybHlpbmcgcG9seWdvbiBnZW9tZXRyeSBpbiBFUFNHOjQzMjZcclxuICogQHJldHVybnMge1BvaW50fSBhIFBvaW50IGZlYXR1cmUgYXQgdGhlIGJlc3QgZXN0aW1hdGVkIGxhYmVsIHBvc2l0aW9uXHJcbiAqL1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwb2x5Z29uKSB7XHJcbiAgICBmaXhNdWx0aVBvbHkocG9seWdvbik7XHJcbiAgICB2YXIgcG9seVNpdGVzID0gc2l0ZXMocG9seWdvbik7XHJcbiAgICB2YXIgZGlhZ3JhbSA9IHZvcm9ub2kuY29tcHV0ZShwb2x5U2l0ZXMuc2l0ZXMsIHBvbHlTaXRlcy5iYm94KTtcclxuICAgIHZhciB2ZXJ0aWNlcyA9IHtcclxuICAgICAgICB0eXBlOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXHJcbiAgICAgICAgZmVhdHVyZXM6IFtdXHJcbiAgICB9O1xyXG4gICAgLy9jb25zdHJ1Y3QgR2VvSlNPTiBvYmplY3Qgb2Ygdm9yb25vaSB2ZXJ0aWNlc1xyXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGRpYWdyYW0udmVydGljZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2ZXJ0aWNlcy5mZWF0dXJlcy5wdXNoKHtcclxuICAgICAgICAgICAgdHlwZTogXCJGZWF0dXJlXCIsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9LFxyXG4gICAgICAgICAgICBnZW9tZXRyeToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogXCJQb2ludFwiLFxyXG4gICAgICAgICAgICAgICAgY29vcmRpbmF0ZXM6IFtkaWFncmFtLnZlcnRpY2VzW2ldLngsIGRpYWdyYW0udmVydGljZXNbaV0ueV1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcbiAgICAvL3dpdGhpbiByZXF1aXJlcyBhIEZlYXR1cmVDb2xsZWN0aW9uIGZvciBpbnB1dCBwb2x5Z29uc1xyXG4gICAgdmFyIHBvbHlnb25GZWF0dXJlQ29sbGVjdGlvbiA9IHtcclxuICAgICAgICB0eXBlOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXHJcbiAgICAgICAgZmVhdHVyZXM6IFtwb2x5Z29uXVxyXG4gICAgfTtcclxuICAgIHZhciBwdHNXaXRoaW4gPSB3aXRoaW4odmVydGljZXMsIHBvbHlnb25GZWF0dXJlQ29sbGVjdGlvbik7IC8vcmVtb3ZlIGFueSB2ZXJ0aWNlcyB0aGF0IGFyZSBub3QgaW5zaWRlIHRoZSBwb2x5Z29uXHJcbiAgICB2YXIgbGFiZWxMb2NhdGlvbiA9IHtcclxuICAgICAgICBjb29yZGluYXRlczogWzAsMF0sXHJcbiAgICAgICAgbWF4RGlzdDogMFxyXG4gICAgfTtcclxuICAgIHZhciBwb2x5Z29uQm91bmRhcmllcyA9IHtcclxuICAgICAgICB0eXBlOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXHJcbiAgICAgICAgZmVhdHVyZXM6IFtdXHJcbiAgICB9O1xyXG4gICAgdmFyIHZlcnRleERpc3RhbmNlO1xyXG5cclxuICAgIC8vZGVmaW5lIGJvcmRlcnMgb2YgcG9seWdvbiBhbmQgaG9sZXMgYXMgTGluZVN0cmluZ3NcclxuICAgIGZvcih2YXIgaiA9IDA7IGogPCBwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgcG9seWdvbkJvdW5kYXJpZXMuZmVhdHVyZXMucHVzaCh7XHJcbiAgICAgICAgICAgIHR5cGU6IFwiRmVhdHVyZVwiLFxyXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fSxcclxuICAgICAgICAgICAgZ2VvbWV0cnk6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwiTGluZVN0cmluZ1wiLFxyXG4gICAgICAgICAgICAgICAgY29vcmRpbmF0ZXM6IHBvbHlnb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbal1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcblxyXG4gICAgZm9yKHZhciBrID0gMDsgayA8IHB0c1dpdGhpbi5mZWF0dXJlcy5sZW5ndGg7IGsrKykge1xyXG4gICAgICAgIGZvcih2YXIgbCA9IDA7IGwgPCBwb2x5Z29uQm91bmRhcmllcy5mZWF0dXJlcy5sZW5ndGg7IGwrKykge1xyXG4gICAgICAgICAgICBpZihsID09IDApIHtcclxuICAgICAgICAgICAgICAgIHZlcnRleERpc3RhbmNlID0gcG9pbnRPbkxpbmUocG9seWdvbkJvdW5kYXJpZXMuZmVhdHVyZXNbbF0sIHB0c1dpdGhpbi5mZWF0dXJlc1trXSkucHJvcGVydGllcy5kaXN0O1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdmVydGV4RGlzdGFuY2UgPSBNYXRoLm1pbih2ZXJ0ZXhEaXN0YW5jZSxcclxuICAgICAgICAgICAgICAgICAgICBwb2ludE9uTGluZShwb2x5Z29uQm91bmRhcmllcy5mZWF0dXJlc1tsXSwgcHRzV2l0aGluLmZlYXR1cmVzW2tdKS5wcm9wZXJ0aWVzLmRpc3QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmKHZlcnRleERpc3RhbmNlID4gbGFiZWxMb2NhdGlvbi5tYXhEaXN0KSB7XHJcbiAgICAgICAgICAgIGxhYmVsTG9jYXRpb24uY29vcmRpbmF0ZXMgPSBwdHNXaXRoaW4uZmVhdHVyZXNba10uZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XHJcbiAgICAgICAgICAgIGxhYmVsTG9jYXRpb24ubWF4RGlzdCA9IHZlcnRleERpc3RhbmNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcG9pbnQobGFiZWxMb2NhdGlvbi5jb29yZGluYXRlcyk7XHJcbn07XHJcbi8qKlxyXG4gKiBUYWtlcyBhIHBvbHlnb24gYW5kIGdlbmVyYXRlcyB0aGUgc2l0ZXMgbmVlZGVkIHRvIGdlbmVyYXRlIFZvcm9ub2lcclxuICpcclxuICogQHBhcmFtIHBvbHlnb25cclxuICogQHJldHVybnMge3tzaXRlczogQXJyYXksIGJib3g6IHt4bDogKiwgeHI6ICosIHl0OiAqLCB5YjogKn19fVxyXG4gKi9cclxuZnVuY3Rpb24gc2l0ZXMocG9seWdvbikge1xyXG4gICAgdmFyIHBvbHlnb25TaXRlcyA9IFtdO1xyXG4gICAgdmFyIHhtaW4seG1heCx5bWluLHltYXg7XHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgcG9seWdvbi5nZW9tZXRyeS5jb29yZGluYXRlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciBwb2x5UmluZyA9IHBvbHlnb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbaV0uc2xpY2UoKTtcclxuICAgICAgICBmb3IodmFyIGogPSAwOyBqIDwgcG9seVJpbmcubGVuZ3RoLTE7IGorKykge1xyXG4gICAgICAgICAgICAvL1B1c2ggb3JpZ2luYWwgcG9pbnRcclxuICAgICAgICAgICAgcG9seWdvblNpdGVzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgeDogcG9seVJpbmdbal1bMF0sXHJcbiAgICAgICAgICAgICAgICB5OiBwb2x5UmluZ1tqXVsxXVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgLy9QdXNoIG1pZHBvaW50cyBvZiBzZWdtZW50c1xyXG4gICAgICAgICAgICBwb2x5Z29uU2l0ZXMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICB4OiAocG9seVJpbmdbal1bMF0rcG9seVJpbmdbaisxXVswXSkvMixcclxuICAgICAgICAgICAgICAgIHk6IChwb2x5UmluZ1tqXVsxXStwb2x5UmluZ1tqKzFdWzFdKS8yXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAvL2luaXRpYWxpemUgYm91bmRpbmcgYm94XHJcbiAgICAgICAgICAgIGlmKChpID09IDApICYmIChqID09IDApKSB7XHJcbiAgICAgICAgICAgICAgICB4bWluID0gcG9seVJpbmdbal1bMF07XHJcbiAgICAgICAgICAgICAgICB4bWF4ID0geG1pbjtcclxuICAgICAgICAgICAgICAgIHltaW4gPSBwb2x5UmluZ1tqXVsxXTtcclxuICAgICAgICAgICAgICAgIHltYXggPSB5bWluO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaWYocG9seVJpbmdbal1bMF0gPCB4bWluKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgeG1pbiA9IHBvbHlSaW5nW2pdWzBdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYocG9seVJpbmdbal1bMF0gPiB4bWF4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgeG1heCA9IHBvbHlSaW5nW2pdWzBdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYocG9seVJpbmdbal1bMV0gPCB5bWluKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgeW1pbiA9IHBvbHlSaW5nW2pdWzFdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYocG9seVJpbmdbal1bMV0gPiB5bWF4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgeW1heCA9IHBvbHlSaW5nW2pdWzFdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzaXRlczogcG9seWdvblNpdGVzLFxyXG4gICAgICAgIGJib3g6IHtcclxuICAgICAgICAgICAgeGw6IHhtaW4sXHJcbiAgICAgICAgICAgIHhyOiB4bWF4LFxyXG4gICAgICAgICAgICB5dDogeW1pbixcclxuICAgICAgICAgICAgeWI6IHltYXhcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2tzIHRvIHNlZSBpZiB0aGUgZmVhdHVyZSBpcyBhIFBvbHlnb24gZm9ybWF0dGVkIGFzIGEgTXVsdGlQb2x5Z29uLiBEb2VzIG5vdCByZXR1cm4gYW55dGhpbmcsXHJcbiAqIGluc3RlYWQgc2F2ZXMgcmVzdWx0cyBkaXJlY3RseSBiYWNrIHRvIGZlYXR1cmUgcGFzc2VkIGluLlxyXG4gKlxyXG4gKiBAcGFyYW0gcG9seWdvblxyXG4gKi9cclxuZnVuY3Rpb24gZml4TXVsdGlQb2x5KHBvbHlnb24pIHtcclxuICAgIGlmKHBvbHlnb24uZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2x5Z29uJyAmJiBwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLmxlbmd0aCA9PSAxKSB7XHJcbiAgICAgICAgcG9seWdvbi5nZW9tZXRyeS50eXBlID0gJ1BvbHlnb24nO1xyXG4gICAgICAgIHBvbHlnb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXMgPSBwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdO1xyXG4gICAgfVxyXG4gICAgLy9UT0RPOiBJbXBsZW1lbnQgbG9naWMgdG8gdGVzdCBmb3IgYWN0dWFsIE11bHRpUG9seWdvbiBhbmQgcmV0dXJuIHBpZWNlIHdpdGggbGFyZ2VzdCBhcmVhIGFzIGEgUG9seWdvbi5cclxufSIsIi8vaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9IYXZlcnNpbmVfZm9ybXVsYVxuLy9odHRwOi8vd3d3Lm1vdmFibGUtdHlwZS5jby51ay9zY3JpcHRzL2xhdGxvbmcuaHRtbFxuXG4vKipcbiAqIFRha2VzIHR3byB7QGxpbmsgUG9pbnR8cG9pbnRzfSBhbmQgZmluZHMgdGhlIGdlb2dyYXBoaWMgYmVhcmluZyBiZXR3ZWVuIHRoZW0uXG4gKlxuICogQG1vZHVsZSB0dXJmL2JlYXJpbmdcbiAqIEBjYXRlZ29yeSBtZWFzdXJlbWVudFxuICogQHBhcmFtIHtGZWF0dXJlPFBvaW50Pn0gc3RhcnQgc3RhcnRpbmcgUG9pbnRcbiAqIEBwYXJhbSB7RmVhdHVyZTxQb2ludD59IGVuZCBlbmRpbmcgUG9pbnRcbiAqIEBjYXRlZ29yeSBtZWFzdXJlbWVudFxuICogQHJldHVybnMge051bWJlcn0gYmVhcmluZyBpbiBkZWNpbWFsIGRlZ3JlZXNcbiAqIEBleGFtcGxlXG4gKiB2YXIgcG9pbnQxID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgIFwicHJvcGVydGllc1wiOiB7XG4gKiAgICAgXCJtYXJrZXItY29sb3JcIjogJyNmMDAnXG4gKiAgIH0sXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbLTc1LjM0MywgMzkuOTg0XVxuICogICB9XG4gKiB9O1xuICogdmFyIHBvaW50MiA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge1xuICogICAgIFwibWFya2VyLWNvbG9yXCI6ICcjMGYwJ1xuICogICB9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWy03NS41MzQsIDM5LjEyM11cbiAqICAgfVxuICogfTtcbiAqXG4gKiB2YXIgcG9pbnRzID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICogICBcImZlYXR1cmVzXCI6IFtwb2ludDEsIHBvaW50Ml1cbiAqIH07XG4gKlxuICogLy89cG9pbnRzXG4gKlxuICogdmFyIGJlYXJpbmcgPSB0dXJmLmJlYXJpbmcocG9pbnQxLCBwb2ludDIpO1xuICpcbiAqIC8vPWJlYXJpbmdcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAocG9pbnQxLCBwb2ludDIpIHtcbiAgICB2YXIgY29vcmRpbmF0ZXMxID0gcG9pbnQxLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgIHZhciBjb29yZGluYXRlczIgPSBwb2ludDIuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG5cbiAgICB2YXIgbG9uMSA9IHRvUmFkKGNvb3JkaW5hdGVzMVswXSk7XG4gICAgdmFyIGxvbjIgPSB0b1JhZChjb29yZGluYXRlczJbMF0pO1xuICAgIHZhciBsYXQxID0gdG9SYWQoY29vcmRpbmF0ZXMxWzFdKTtcbiAgICB2YXIgbGF0MiA9IHRvUmFkKGNvb3JkaW5hdGVzMlsxXSk7XG4gICAgdmFyIGEgPSBNYXRoLnNpbihsb24yIC0gbG9uMSkgKiBNYXRoLmNvcyhsYXQyKTtcbiAgICB2YXIgYiA9IE1hdGguY29zKGxhdDEpICogTWF0aC5zaW4obGF0MikgLVxuICAgICAgICBNYXRoLnNpbihsYXQxKSAqIE1hdGguY29zKGxhdDIpICogTWF0aC5jb3MobG9uMiAtIGxvbjEpO1xuXG4gICAgdmFyIGJlYXJpbmcgPSB0b0RlZyhNYXRoLmF0YW4yKGEsIGIpKTtcblxuICAgIHJldHVybiBiZWFyaW5nO1xufTtcblxuZnVuY3Rpb24gdG9SYWQoZGVncmVlKSB7XG4gICAgcmV0dXJuIGRlZ3JlZSAqIE1hdGguUEkgLyAxODA7XG59XG5cbmZ1bmN0aW9uIHRvRGVnKHJhZGlhbikge1xuICAgIHJldHVybiByYWRpYW4gKiAxODAgLyBNYXRoLlBJO1xufVxuIiwiLy9odHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0hhdmVyc2luZV9mb3JtdWxhXG4vL2h0dHA6Ly93d3cubW92YWJsZS10eXBlLmNvLnVrL3NjcmlwdHMvbGF0bG9uZy5odG1sXG52YXIgcG9pbnQgPSByZXF1aXJlKCd0dXJmLXBvaW50Jyk7XG5cbi8qKlxuICogVGFrZXMgYSB7QGxpbmsgUG9pbnR9IGZlYXR1cmUgYW5kIGNhbGN1bGF0ZXMgdGhlIGxvY2F0aW9uIG9mIGEgZGVzdGluYXRpb24gcG9pbnQgZ2l2ZW4gYSBkaXN0YW5jZSBpbiBkZWdyZWVzLCByYWRpYW5zLCBtaWxlcywgb3Iga2lsb21ldGVyczsgYW5kIGJlYXJpbmcgaW4gZGVncmVlcy4gVGhpcyB1c2VzIHRoZSBbSGF2ZXJzaW5lIGZvcm11bGFdKGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGF2ZXJzaW5lX2Zvcm11bGEpIHRvIGFjY291bnQgZm9yIGdsb2JhbCBjdXJ2YXR1cmUuXG4gKlxuICogQG1vZHVsZSB0dXJmL2Rlc3RpbmF0aW9uXG4gKiBAY2F0ZWdvcnkgbWVhc3VyZW1lbnRcbiAqIEBwYXJhbSB7UG9pbnR9IHN0YXJ0IGEgUG9pbnQgZmVhdHVyZSBhdCB0aGUgc3RhcnRpbmcgcG9pbnRcbiAqIEBwYXJhbSB7TnVtYmVyfSBkaXN0YW5jZSBkaXN0YW5jZSBmcm9tIHRoZSBzdGFydGluZyBwb2ludFxuICogQHBhcmFtIHtOdW1iZXJ9IGJlYXJpbmcgcmFuZ2luZyBmcm9tIC0xODAgdG8gMTgwXG4gKiBAcGFyYW0ge1N0cmluZ30gdW5pdHMgbWlsZXMsIGtpbG9tZXRlcnMsIGRlZ3JlZXMsIG9yIHJhZGlhbnNcbiAqIEByZXR1cm5zIHtQb2ludH0gYSBQb2ludCBmZWF0dXJlIGF0IHRoZSBkZXN0aW5hdGlvblxuICogQGV4YW1wbGVcbiAqIHZhciBwb2ludCA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge1xuICogICAgIFwibWFya2VyLWNvbG9yXCI6IFwiIzBmMFwiXG4gKiAgIH0sXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbLTc1LjM0MywgMzkuOTg0XVxuICogICB9XG4gKiB9O1xuICogdmFyIGRpc3RhbmNlID0gNTA7XG4gKiB2YXIgYmVhcmluZyA9IDkwO1xuICogdmFyIHVuaXRzID0gJ21pbGVzJztcbiAqXG4gKiB2YXIgZGVzdGluYXRpb24gPSB0dXJmLmRlc3RpbmF0aW9uKHBvaW50LCBkaXN0YW5jZSwgYmVhcmluZywgdW5pdHMpO1xuICogZGVzdGluYXRpb24ucHJvcGVydGllc1snbWFya2VyLWNvbG9yJ10gPSAnI2YwMCc7XG4gKlxuICogdmFyIHJlc3VsdCA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAqICAgXCJmZWF0dXJlc1wiOiBbcG9pbnQsIGRlc3RpbmF0aW9uXVxuICogfTtcbiAqXG4gKiAvLz1yZXN1bHRcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAocG9pbnQxLCBkaXN0YW5jZSwgYmVhcmluZywgdW5pdHMpIHtcbiAgICB2YXIgY29vcmRpbmF0ZXMxID0gcG9pbnQxLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgIHZhciBsb25naXR1ZGUxID0gdG9SYWQoY29vcmRpbmF0ZXMxWzBdKTtcbiAgICB2YXIgbGF0aXR1ZGUxID0gdG9SYWQoY29vcmRpbmF0ZXMxWzFdKTtcbiAgICB2YXIgYmVhcmluZ19yYWQgPSB0b1JhZChiZWFyaW5nKTtcblxuICAgIHZhciBSID0gMDtcbiAgICBzd2l0Y2ggKHVuaXRzKSB7XG4gICAgY2FzZSAnbWlsZXMnOlxuICAgICAgICBSID0gMzk2MDtcbiAgICAgICAgYnJlYWtcbiAgICBjYXNlICdraWxvbWV0ZXJzJzpcbiAgICAgICAgUiA9IDYzNzM7XG4gICAgICAgIGJyZWFrXG4gICAgY2FzZSAnZGVncmVlcyc6XG4gICAgICAgIFIgPSA1Ny4yOTU3Nzk1O1xuICAgICAgICBicmVha1xuICAgIGNhc2UgJ3JhZGlhbnMnOlxuICAgICAgICBSID0gMTtcbiAgICAgICAgYnJlYWtcbiAgICB9XG5cbiAgICB2YXIgbGF0aXR1ZGUyID0gTWF0aC5hc2luKE1hdGguc2luKGxhdGl0dWRlMSkgKiBNYXRoLmNvcyhkaXN0YW5jZSAvIFIpICtcbiAgICAgICAgTWF0aC5jb3MobGF0aXR1ZGUxKSAqIE1hdGguc2luKGRpc3RhbmNlIC8gUikgKiBNYXRoLmNvcyhiZWFyaW5nX3JhZCkpO1xuICAgIHZhciBsb25naXR1ZGUyID0gbG9uZ2l0dWRlMSArIE1hdGguYXRhbjIoTWF0aC5zaW4oYmVhcmluZ19yYWQpICogTWF0aC5zaW4oZGlzdGFuY2UgLyBSKSAqIE1hdGguY29zKGxhdGl0dWRlMSksXG4gICAgICAgIE1hdGguY29zKGRpc3RhbmNlIC8gUikgLSBNYXRoLnNpbihsYXRpdHVkZTEpICogTWF0aC5zaW4obGF0aXR1ZGUyKSk7XG5cbiAgICByZXR1cm4gcG9pbnQoW3RvRGVnKGxvbmdpdHVkZTIpLCB0b0RlZyhsYXRpdHVkZTIpXSk7XG59O1xuXG5mdW5jdGlvbiB0b1JhZChkZWdyZWUpIHtcbiAgICByZXR1cm4gZGVncmVlICogTWF0aC5QSSAvIDE4MDtcbn1cblxuZnVuY3Rpb24gdG9EZWcocmFkKSB7XG4gICAgcmV0dXJuIHJhZCAqIDE4MCAvIE1hdGguUEk7XG59XG4iLCJ2YXIgaW52YXJpYW50ID0gcmVxdWlyZSgndHVyZi1pbnZhcmlhbnQnKTtcbi8vaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9IYXZlcnNpbmVfZm9ybXVsYVxuLy9odHRwOi8vd3d3Lm1vdmFibGUtdHlwZS5jby51ay9zY3JpcHRzL2xhdGxvbmcuaHRtbFxuXG4vKipcbiAqIENhbGN1bGF0ZXMgdGhlIGRpc3RhbmNlIGJldHdlZW4gdHdvIHtAbGluayBQb2ludHxwb2ludHN9IGluIGRlZ3Jlc3MsIHJhZGlhbnMsXG4gKiBtaWxlcywgb3Iga2lsb21ldGVycy4gVGhpcyB1c2VzIHRoZVxuICogW0hhdmVyc2luZSBmb3JtdWxhXShodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0hhdmVyc2luZV9mb3JtdWxhKVxuICogdG8gYWNjb3VudCBmb3IgZ2xvYmFsIGN1cnZhdHVyZS5cbiAqXG4gKiBAbW9kdWxlIHR1cmYvZGlzdGFuY2VcbiAqIEBjYXRlZ29yeSBtZWFzdXJlbWVudFxuICogQHBhcmFtIHtGZWF0dXJlPFBvaW50Pn0gZnJvbSBvcmlnaW4gcG9pbnRcbiAqIEBwYXJhbSB7RmVhdHVyZTxQb2ludD59IHRvIGRlc3RpbmF0aW9uIHBvaW50XG4gKiBAcGFyYW0ge1N0cmluZ30gW3VuaXRzPWtpbG9tZXRlcnNdIGNhbiBiZSBkZWdyZWVzLCByYWRpYW5zLCBtaWxlcywgb3Iga2lsb21ldGVyc1xuICogQHJldHVybiB7TnVtYmVyfSBkaXN0YW5jZSBiZXR3ZWVuIHRoZSB0d28gcG9pbnRzXG4gKiBAZXhhbXBsZVxuICogdmFyIHBvaW50MSA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbLTc1LjM0MywgMzkuOTg0XVxuICogICB9XG4gKiB9O1xuICogdmFyIHBvaW50MiA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbLTc1LjUzNCwgMzkuMTIzXVxuICogICB9XG4gKiB9O1xuICogdmFyIHVuaXRzID0gXCJtaWxlc1wiO1xuICpcbiAqIHZhciBwb2ludHMgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gKiAgIFwiZmVhdHVyZXNcIjogW3BvaW50MSwgcG9pbnQyXVxuICogfTtcbiAqXG4gKiAvLz1wb2ludHNcbiAqXG4gKiB2YXIgZGlzdGFuY2UgPSB0dXJmLmRpc3RhbmNlKHBvaW50MSwgcG9pbnQyLCB1bml0cyk7XG4gKlxuICogLy89ZGlzdGFuY2VcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwb2ludDEsIHBvaW50MiwgdW5pdHMpIHtcbiAgaW52YXJpYW50LmZlYXR1cmVPZihwb2ludDEsICdQb2ludCcsICdkaXN0YW5jZScpO1xuICBpbnZhcmlhbnQuZmVhdHVyZU9mKHBvaW50MiwgJ1BvaW50JywgJ2Rpc3RhbmNlJyk7XG4gIHZhciBjb29yZGluYXRlczEgPSBwb2ludDEuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG4gIHZhciBjb29yZGluYXRlczIgPSBwb2ludDIuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG5cbiAgdmFyIGRMYXQgPSB0b1JhZChjb29yZGluYXRlczJbMV0gLSBjb29yZGluYXRlczFbMV0pO1xuICB2YXIgZExvbiA9IHRvUmFkKGNvb3JkaW5hdGVzMlswXSAtIGNvb3JkaW5hdGVzMVswXSk7XG4gIHZhciBsYXQxID0gdG9SYWQoY29vcmRpbmF0ZXMxWzFdKTtcbiAgdmFyIGxhdDIgPSB0b1JhZChjb29yZGluYXRlczJbMV0pO1xuXG4gIHZhciBhID0gTWF0aC5wb3coTWF0aC5zaW4oZExhdC8yKSwgMikgK1xuICAgICAgICAgIE1hdGgucG93KE1hdGguc2luKGRMb24vMiksIDIpICogTWF0aC5jb3MobGF0MSkgKiBNYXRoLmNvcyhsYXQyKTtcbiAgdmFyIGMgPSAyICogTWF0aC5hdGFuMihNYXRoLnNxcnQoYSksIE1hdGguc3FydCgxLWEpKTtcblxuICB2YXIgUjtcbiAgc3dpdGNoKHVuaXRzKSB7XG4gICAgY2FzZSAnbWlsZXMnOlxuICAgICAgUiA9IDM5NjA7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdraWxvbWV0ZXJzJzpcbiAgICBjYXNlICdraWxvbWV0cmVzJzpcbiAgICAgIFIgPSA2MzczO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZGVncmVlcyc6XG4gICAgICBSID0gNTcuMjk1Nzc5NTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3JhZGlhbnMnOlxuICAgICAgUiA9IDE7XG4gICAgICBicmVhaztcbiAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgIFIgPSA2MzczO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5rbm93biBvcHRpb24gZ2l2ZW4gdG8gXCJ1bml0c1wiJyk7XG4gIH1cblxuICB2YXIgZGlzdGFuY2UgPSBSICogYztcbiAgcmV0dXJuIGRpc3RhbmNlO1xufTtcblxuZnVuY3Rpb24gdG9SYWQoZGVncmVlKSB7XG4gIHJldHVybiBkZWdyZWUgKiBNYXRoLlBJIC8gMTgwO1xufVxuIiwiLyoqXG4gKiBUYWtlcyBvbmUgb3IgbW9yZSB7QGxpbmsgRmVhdHVyZXxGZWF0dXJlc30gYW5kIGNyZWF0ZXMgYSB7QGxpbmsgRmVhdHVyZUNvbGxlY3Rpb259XG4gKlxuICogQG1vZHVsZSB0dXJmL2ZlYXR1cmVjb2xsZWN0aW9uXG4gKiBAY2F0ZWdvcnkgaGVscGVyXG4gKiBAcGFyYW0ge0ZlYXR1cmV9IGZlYXR1cmVzIGlucHV0IEZlYXR1cmVzXG4gKiBAcmV0dXJucyB7RmVhdHVyZUNvbGxlY3Rpb259IGEgRmVhdHVyZUNvbGxlY3Rpb24gb2YgaW5wdXQgZmVhdHVyZXNcbiAqIEBleGFtcGxlXG4gKiB2YXIgZmVhdHVyZXMgPSBbXG4gKiAgdHVyZi5wb2ludChbLTc1LjM0MywgMzkuOTg0XSwge25hbWU6ICdMb2NhdGlvbiBBJ30pLFxuICogIHR1cmYucG9pbnQoWy03NS44MzMsIDM5LjI4NF0sIHtuYW1lOiAnTG9jYXRpb24gQid9KSxcbiAqICB0dXJmLnBvaW50KFstNzUuNTM0LCAzOS4xMjNdLCB7bmFtZTogJ0xvY2F0aW9uIEMnfSlcbiAqIF07XG4gKlxuICogdmFyIGZjID0gdHVyZi5mZWF0dXJlY29sbGVjdGlvbihmZWF0dXJlcyk7XG4gKlxuICogLy89ZmNcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihmZWF0dXJlcyl7XG4gIHJldHVybiB7XG4gICAgdHlwZTogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICAgIGZlYXR1cmVzOiBmZWF0dXJlc1xuICB9O1xufTtcbiIsIi8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRXZlbiVFMiU4MCU5M29kZF9ydWxlXG4vLyBtb2RpZmllZCBmcm9tOiBodHRwczovL2dpdGh1Yi5jb20vc3Vic3RhY2svcG9pbnQtaW4tcG9seWdvbi9ibG9iL21hc3Rlci9pbmRleC5qc1xuLy8gd2hpY2ggd2FzIG1vZGlmaWVkIGZyb20gaHR0cDovL3d3dy5lY3NlLnJwaS5lZHUvSG9tZXBhZ2VzL3dyZi9SZXNlYXJjaC9TaG9ydF9Ob3Rlcy9wbnBvbHkuaHRtbFxuXG4vKipcbiAqIFRha2VzIGEge0BsaW5rIFBvaW50fSBmZWF0dXJlIGFuZCBhIHtAbGluayBQb2x5Z29ufSBmZWF0dXJlIGFuZCBkZXRlcm1pbmVzIGlmIHRoZSBQb2ludCByZXNpZGVzIGluc2lkZSB0aGUgUG9seWdvbi4gVGhlIFBvbHlnb24gY2FuXG4gKiBiZSBjb252ZXggb3IgY29uY2F2ZS4gVGhlIGZ1bmN0aW9uIGFjY2VwdHMgYW55IHZhbGlkIFBvbHlnb24gb3Ige0BsaW5rIE11bHRpUG9seWdvbn1cbiAqIGFuZCBhY2NvdW50cyBmb3IgaG9sZXMuXG4gKlxuICogQG1vZHVsZSB0dXJmL2luc2lkZVxuICogQGNhdGVnb3J5IGpvaW5zXG4gKiBAcGFyYW0ge1BvaW50fSBwb2ludCBhIFBvaW50IGZlYXR1cmVcbiAqIEBwYXJhbSB7UG9seWdvbn0gcG9seWdvbiBhIFBvbHlnb24gZmVhdHVyZVxuICogQHJldHVybiB7Qm9vbGVhbn0gYHRydWVgIGlmIHRoZSBQb2ludCBpcyBpbnNpZGUgdGhlIFBvbHlnb247IGBmYWxzZWAgaWYgdGhlIFBvaW50IGlzIG5vdCBpbnNpZGUgdGhlIFBvbHlnb25cbiAqIEBleGFtcGxlXG4gKiB2YXIgcHQxID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgIFwicHJvcGVydGllc1wiOiB7XG4gKiAgICAgXCJtYXJrZXItY29sb3JcIjogXCIjZjAwXCJcbiAqICAgfSxcbiAqICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICBcImNvb3JkaW5hdGVzXCI6IFstMTExLjQ2NzI4NSwgNDAuNzU3NjZdXG4gKiAgIH1cbiAqIH07XG4gKiB2YXIgcHQyID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgIFwicHJvcGVydGllc1wiOiB7XG4gKiAgICAgXCJtYXJrZXItY29sb3JcIjogXCIjMGYwXCJcbiAqICAgfSxcbiAqICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICBcImNvb3JkaW5hdGVzXCI6IFstMTExLjg3Mzc3OSwgNDAuNjQ3MzAzXVxuICogICB9XG4gKiB9O1xuICogdmFyIHBvbHkgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2x5Z29uXCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbW1xuICogICAgICAgWy0xMTIuMDc0Mjc5LCA0MC41MjIxNV0sXG4gKiAgICAgICBbLTExMi4wNzQyNzksIDQwLjg1MzI5M10sXG4gKiAgICAgICBbLTExMS42MTAxMDcsIDQwLjg1MzI5M10sXG4gKiAgICAgICBbLTExMS42MTAxMDcsIDQwLjUyMjE1XSxcbiAqICAgICAgIFstMTEyLjA3NDI3OSwgNDAuNTIyMTVdXG4gKiAgICAgXV1cbiAqICAgfVxuICogfTtcbiAqXG4gKiB2YXIgZmVhdHVyZXMgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gKiAgIFwiZmVhdHVyZXNcIjogW3B0MSwgcHQyLCBwb2x5XVxuICogfTtcbiAqXG4gKiAvLz1mZWF0dXJlc1xuICpcbiAqIHZhciBpc0luc2lkZTEgPSB0dXJmLmluc2lkZShwdDEsIHBvbHkpO1xuICogLy89aXNJbnNpZGUxXG4gKlxuICogdmFyIGlzSW5zaWRlMiA9IHR1cmYuaW5zaWRlKHB0MiwgcG9seSk7XG4gKiAvLz1pc0luc2lkZTJcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwb2ludCwgcG9seWdvbikge1xuICB2YXIgcG9seXMgPSBwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICB2YXIgcHQgPSBbcG9pbnQuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0sIHBvaW50Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzFdXTtcbiAgLy8gbm9ybWFsaXplIHRvIG11bHRpcG9seWdvblxuICBpZihwb2x5Z29uLmdlb21ldHJ5LnR5cGUgPT09ICdQb2x5Z29uJykgcG9seXMgPSBbcG9seXNdO1xuXG4gIHZhciBpbnNpZGVQb2x5ID0gZmFsc2U7XG4gIHZhciBpID0gMDtcbiAgd2hpbGUgKGkgPCBwb2x5cy5sZW5ndGggJiYgIWluc2lkZVBvbHkpIHtcbiAgICAvLyBjaGVjayBpZiBpdCBpcyBpbiB0aGUgb3V0ZXIgcmluZyBmaXJzdFxuICAgIGlmKGluUmluZyhwdCwgcG9seXNbaV1bMF0pKSB7XG4gICAgICB2YXIgaW5Ib2xlID0gZmFsc2U7XG4gICAgICB2YXIgayA9IDE7XG4gICAgICAvLyBjaGVjayBmb3IgdGhlIHBvaW50IGluIGFueSBvZiB0aGUgaG9sZXNcbiAgICAgIHdoaWxlKGsgPCBwb2x5c1tpXS5sZW5ndGggJiYgIWluSG9sZSkge1xuICAgICAgICBpZihpblJpbmcocHQsIHBvbHlzW2ldW2tdKSkge1xuICAgICAgICAgIGluSG9sZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaysrO1xuICAgICAgfVxuICAgICAgaWYoIWluSG9sZSkgaW5zaWRlUG9seSA9IHRydWU7XG4gICAgfVxuICAgIGkrKztcbiAgfVxuICByZXR1cm4gaW5zaWRlUG9seTtcbn1cblxuLy8gcHQgaXMgW3gseV0gYW5kIHJpbmcgaXMgW1t4LHldLCBbeCx5XSwuLl1cbmZ1bmN0aW9uIGluUmluZyAocHQsIHJpbmcpIHtcbiAgdmFyIGlzSW5zaWRlID0gZmFsc2U7XG4gIGZvciAodmFyIGkgPSAwLCBqID0gcmluZy5sZW5ndGggLSAxOyBpIDwgcmluZy5sZW5ndGg7IGogPSBpKyspIHtcbiAgICB2YXIgeGkgPSByaW5nW2ldWzBdLCB5aSA9IHJpbmdbaV1bMV07XG4gICAgdmFyIHhqID0gcmluZ1tqXVswXSwgeWogPSByaW5nW2pdWzFdO1xuICAgIFxuICAgIHZhciBpbnRlcnNlY3QgPSAoKHlpID4gcHRbMV0pICE9ICh5aiA+IHB0WzFdKSlcbiAgICAgICAgJiYgKHB0WzBdIDwgKHhqIC0geGkpICogKHB0WzFdIC0geWkpIC8gKHlqIC0geWkpICsgeGkpO1xuICAgIGlmIChpbnRlcnNlY3QpIGlzSW5zaWRlID0gIWlzSW5zaWRlO1xuICB9XG4gIHJldHVybiBpc0luc2lkZTtcbn1cblxuIiwibW9kdWxlLmV4cG9ydHMuZ2VvanNvblR5cGUgPSBnZW9qc29uVHlwZTtcbm1vZHVsZS5leHBvcnRzLmNvbGxlY3Rpb25PZiA9IGNvbGxlY3Rpb25PZjtcbm1vZHVsZS5leHBvcnRzLmZlYXR1cmVPZiA9IGZlYXR1cmVPZjtcblxuLyoqXG4gKiBFbmZvcmNlIGV4cGVjdGF0aW9ucyBhYm91dCB0eXBlcyBvZiBHZW9KU09OIG9iamVjdHMgZm9yIFR1cmYuXG4gKlxuICogQGFsaWFzIGdlb2pzb25UeXBlXG4gKiBAcGFyYW0ge0dlb0pTT059IHZhbHVlIGFueSBHZW9KU09OIG9iamVjdFxuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgZXhwZWN0ZWQgR2VvSlNPTiB0eXBlXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBuYW1lIG9mIGNhbGxpbmcgZnVuY3Rpb25cbiAqIEB0aHJvd3MgRXJyb3IgaWYgdmFsdWUgaXMgbm90IHRoZSBleHBlY3RlZCB0eXBlLlxuICovXG5mdW5jdGlvbiBnZW9qc29uVHlwZSh2YWx1ZSwgdHlwZSwgbmFtZSkge1xuICAgIGlmICghdHlwZSB8fCAhbmFtZSkgdGhyb3cgbmV3IEVycm9yKCd0eXBlIGFuZCBuYW1lIHJlcXVpcmVkJyk7XG5cbiAgICBpZiAoIXZhbHVlIHx8IHZhbHVlLnR5cGUgIT09IHR5cGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGlucHV0IHRvICcgKyBuYW1lICsgJzogbXVzdCBiZSBhICcgKyB0eXBlICsgJywgZ2l2ZW4gJyArIHZhbHVlLnR5cGUpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBFbmZvcmNlIGV4cGVjdGF0aW9ucyBhYm91dCB0eXBlcyBvZiB7QGxpbmsgRmVhdHVyZX0gaW5wdXRzIGZvciBUdXJmLlxuICogSW50ZXJuYWxseSB0aGlzIHVzZXMge0BsaW5rIGdlb2pzb25UeXBlfSB0byBqdWRnZSBnZW9tZXRyeSB0eXBlcy5cbiAqXG4gKiBAYWxpYXMgZmVhdHVyZU9mXG4gKiBAcGFyYW0ge0ZlYXR1cmV9IGZlYXR1cmUgYSBmZWF0dXJlIHdpdGggYW4gZXhwZWN0ZWQgZ2VvbWV0cnkgdHlwZVxuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgZXhwZWN0ZWQgR2VvSlNPTiB0eXBlXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBuYW1lIG9mIGNhbGxpbmcgZnVuY3Rpb25cbiAqIEB0aHJvd3MgRXJyb3IgaWYgdmFsdWUgaXMgbm90IHRoZSBleHBlY3RlZCB0eXBlLlxuICovXG5mdW5jdGlvbiBmZWF0dXJlT2YodmFsdWUsIHR5cGUsIG5hbWUpIHtcbiAgICBpZiAoIW5hbWUpIHRocm93IG5ldyBFcnJvcignLmZlYXR1cmVPZigpIHJlcXVpcmVzIGEgbmFtZScpO1xuICAgIGlmICghdmFsdWUgfHwgdmFsdWUudHlwZSAhPT0gJ0ZlYXR1cmUnIHx8ICF2YWx1ZS5nZW9tZXRyeSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW5wdXQgdG8gJyArIG5hbWUgKyAnLCBGZWF0dXJlIHdpdGggZ2VvbWV0cnkgcmVxdWlyZWQnKTtcbiAgICB9XG4gICAgaWYgKCF2YWx1ZS5nZW9tZXRyeSB8fCB2YWx1ZS5nZW9tZXRyeS50eXBlICE9PSB0eXBlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBpbnB1dCB0byAnICsgbmFtZSArICc6IG11c3QgYmUgYSAnICsgdHlwZSArICcsIGdpdmVuICcgKyB2YWx1ZS5nZW9tZXRyeS50eXBlKTtcbiAgICB9XG59XG5cbi8qKlxuICogRW5mb3JjZSBleHBlY3RhdGlvbnMgYWJvdXQgdHlwZXMgb2Yge0BsaW5rIEZlYXR1cmVDb2xsZWN0aW9ufSBpbnB1dHMgZm9yIFR1cmYuXG4gKiBJbnRlcm5hbGx5IHRoaXMgdXNlcyB7QGxpbmsgZ2VvanNvblR5cGV9IHRvIGp1ZGdlIGdlb21ldHJ5IHR5cGVzLlxuICpcbiAqIEBhbGlhcyBjb2xsZWN0aW9uT2ZcbiAqIEBwYXJhbSB7RmVhdHVyZUNvbGxlY3Rpb259IGZlYXR1cmVjb2xsZWN0aW9uIGEgZmVhdHVyZWNvbGxlY3Rpb24gZm9yIHdoaWNoIGZlYXR1cmVzIHdpbGwgYmUganVkZ2VkXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBleHBlY3RlZCBHZW9KU09OIHR5cGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG5hbWUgb2YgY2FsbGluZyBmdW5jdGlvblxuICogQHRocm93cyBFcnJvciBpZiB2YWx1ZSBpcyBub3QgdGhlIGV4cGVjdGVkIHR5cGUuXG4gKi9cbmZ1bmN0aW9uIGNvbGxlY3Rpb25PZih2YWx1ZSwgdHlwZSwgbmFtZSkge1xuICAgIGlmICghbmFtZSkgdGhyb3cgbmV3IEVycm9yKCcuY29sbGVjdGlvbk9mKCkgcmVxdWlyZXMgYSBuYW1lJyk7XG4gICAgaWYgKCF2YWx1ZSB8fCB2YWx1ZS50eXBlICE9PSAnRmVhdHVyZUNvbGxlY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBpbnB1dCB0byAnICsgbmFtZSArICcsIEZlYXR1cmVDb2xsZWN0aW9uIHJlcXVpcmVkJyk7XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmFsdWUuZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGZlYXR1cmUgPSB2YWx1ZS5mZWF0dXJlc1tpXTtcbiAgICAgICAgaWYgKCFmZWF0dXJlIHx8IGZlYXR1cmUudHlwZSAhPT0gJ0ZlYXR1cmUnIHx8ICFmZWF0dXJlLmdlb21ldHJ5KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW5wdXQgdG8gJyArIG5hbWUgKyAnLCBGZWF0dXJlIHdpdGggZ2VvbWV0cnkgcmVxdWlyZWQnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWZlYXR1cmUuZ2VvbWV0cnkgfHwgZmVhdHVyZS5nZW9tZXRyeS50eXBlICE9PSB0eXBlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW5wdXQgdG8gJyArIG5hbWUgKyAnOiBtdXN0IGJlIGEgJyArIHR5cGUgKyAnLCBnaXZlbiAnICsgZmVhdHVyZS5nZW9tZXRyeS50eXBlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIi8qKlxuICogQ3JlYXRlcyBhIHtAbGluayBMaW5lU3RyaW5nfSB7QGxpbmsgRmVhdHVyZX0gYmFzZWQgb24gYVxuICogY29vcmRpbmF0ZSBhcnJheS4gUHJvcGVydGllcyBjYW4gYmUgYWRkZWQgb3B0aW9uYWxseS5cbiAqXG4gKiBAbW9kdWxlIHR1cmYvbGluZXN0cmluZ1xuICogQGNhdGVnb3J5IGhlbHBlclxuICogQHBhcmFtIHtBcnJheTxBcnJheTxOdW1iZXI+Pn0gY29vcmRpbmF0ZXMgYW4gYXJyYXkgb2YgUG9zaXRpb25zXG4gKiBAcGFyYW0ge09iamVjdH0gcHJvcGVydGllcyBhbiBPYmplY3Qgb2Yga2V5LXZhbHVlIHBhaXJzIHRvIGFkZCBhcyBwcm9wZXJ0aWVzXG4gKiBAcmV0dXJuIHtMaW5lU3RyaW5nfSBhIExpbmVTdHJpbmcgZmVhdHVyZVxuICogQHRocm93cyB7RXJyb3J9IGlmIG5vIGNvb3JkaW5hdGVzIGFyZSBwYXNzZWRcbiAqIEBleGFtcGxlXG4gKiB2YXIgbGluZXN0cmluZzEgPSB0dXJmLmxpbmVzdHJpbmcoW1xuICpcdFstMjEuOTY0NDE2LCA2NC4xNDgyMDNdLFxuICpcdFstMjEuOTU2MTc2LCA2NC4xNDEzMTZdLFxuICpcdFstMjEuOTM5MDEsIDY0LjEzNTkyNF0sXG4gKlx0Wy0yMS45MjczMzcsIDY0LjEzNjY3M11cbiAqIF0pO1xuICogdmFyIGxpbmVzdHJpbmcyID0gdHVyZi5saW5lc3RyaW5nKFtcbiAqXHRbLTIxLjkyOTA1NCwgNjQuMTI3OTg1XSxcbiAqXHRbLTIxLjkxMjkxOCwgNjQuMTM0NzI2XSxcbiAqXHRbLTIxLjkxNjAwNywgNjQuMTQxMDE2XSxcbiAqIFx0Wy0yMS45MzAwODQsIDY0LjE0NDQ2XVxuICogXSwge25hbWU6ICdsaW5lIDEnLCBkaXN0YW5jZTogMTQ1fSk7XG4gKlxuICogLy89bGluZXN0cmluZzFcbiAqXG4gKiAvLz1saW5lc3RyaW5nMlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGNvb3JkaW5hdGVzLCBwcm9wZXJ0aWVzKXtcbiAgaWYgKCFjb29yZGluYXRlcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBjb29yZGluYXRlcyBwYXNzZWQnKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAgICBcImdlb21ldHJ5XCI6IHtcbiAgICAgIFwidHlwZVwiOiBcIkxpbmVTdHJpbmdcIixcbiAgICAgIFwiY29vcmRpbmF0ZXNcIjogY29vcmRpbmF0ZXNcbiAgICB9LFxuICAgIFwicHJvcGVydGllc1wiOiBwcm9wZXJ0aWVzIHx8IHt9XG4gIH07XG59O1xuIiwiLyoqXG4gKiBUYWtlcyBjb29yZGluYXRlcyBhbmQgcHJvcGVydGllcyAob3B0aW9uYWwpIGFuZCByZXR1cm5zIGEgbmV3IHtAbGluayBQb2ludH0gZmVhdHVyZS5cbiAqXG4gKiBAbW9kdWxlIHR1cmYvcG9pbnRcbiAqIEBjYXRlZ29yeSBoZWxwZXJcbiAqIEBwYXJhbSB7bnVtYmVyfSBsb25naXR1ZGUgcG9zaXRpb24gd2VzdCB0byBlYXN0IGluIGRlY2ltYWwgZGVncmVlc1xuICogQHBhcmFtIHtudW1iZXJ9IGxhdGl0dWRlIHBvc2l0aW9uIHNvdXRoIHRvIG5vcnRoIGluIGRlY2ltYWwgZGVncmVlc1xuICogQHBhcmFtIHtPYmplY3R9IHByb3BlcnRpZXMgYW4gT2JqZWN0IHRoYXQgaXMgdXNlZCBhcyB0aGUge0BsaW5rIEZlYXR1cmV9J3NcbiAqIHByb3BlcnRpZXNcbiAqIEByZXR1cm4ge1BvaW50fSBhIFBvaW50IGZlYXR1cmVcbiAqIEBleGFtcGxlXG4gKiB2YXIgcHQxID0gdHVyZi5wb2ludChbLTc1LjM0MywgMzkuOTg0XSk7XG4gKlxuICogLy89cHQxXG4gKi9cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcmcpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY29vcmRpbmF0ZXMsIHByb3BlcnRpZXMpIHtcbiAgaWYgKCFpc0FycmF5KGNvb3JkaW5hdGVzKSkgdGhyb3cgbmV3IEVycm9yKCdDb29yZGluYXRlcyBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gIGlmIChjb29yZGluYXRlcy5sZW5ndGggPCAyKSB0aHJvdyBuZXcgRXJyb3IoJ0Nvb3JkaW5hdGVzIG11c3QgYmUgYXQgbGVhc3QgMiBudW1iZXJzIGxvbmcnKTtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBcIkZlYXR1cmVcIixcbiAgICBnZW9tZXRyeToge1xuICAgICAgdHlwZTogXCJQb2ludFwiLFxuICAgICAgY29vcmRpbmF0ZXM6IGNvb3JkaW5hdGVzXG4gICAgfSxcbiAgICBwcm9wZXJ0aWVzOiBwcm9wZXJ0aWVzIHx8IHt9XG4gIH07XG59O1xuIiwidmFyIGluc2lkZSA9IHJlcXVpcmUoJ3R1cmYtaW5zaWRlJyk7XG52YXIgZmVhdHVyZUNvbGxlY3Rpb24gPSByZXF1aXJlKCd0dXJmLWZlYXR1cmVjb2xsZWN0aW9uJyk7XG5cbi8qKlxuICogVGFrZXMgYSB7QGxpbmsgRmVhdHVyZUNvbGxlY3Rpb259IG9mIHtAbGluayBQb2ludH0gZmVhdHVyZXMgYW5kIGEgRmVhdHVyZUNvbGxlY3Rpb24gb2Yge0BsaW5rIFBvbHlnb259IGZlYXR1cmVzIGFuZCByZXR1cm5zIGEgRmVhdHVyZUNvbGxlY3Rpb24gb2YgUG9pbnQgZmVhdHVyZXMgcmVwcmVzZW50aW5nIGFsbCBwb2ludHMgdGhhdCBmYWxsIHdpdGhpbiBhIGNvbGxlY3Rpb24gb2YgcG9seWdvbnMuXG4gKlxuICogQG1vZHVsZSB0dXJmL3dpdGhpblxuICogQGNhdGVnb3J5IGpvaW5zXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufSBwb2ludHMgYSBGZWF0dXJlQ29sbGVjdGlvbiBvZiB7QGxpbmsgUG9pbnR9IGZlYXR1cmVzXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufSBwb2x5Z29ucyBhIEZlYXR1cmVDb2xsZWN0aW9uIG9mIHtAbGluayBQb2x5Z29ufSBmZWF0dXJlc1xuICogQHJldHVybiB7RmVhdHVyZUNvbGxlY3Rpb259IGEgY29sbGVjdGlvbiBvZiBhbGwgcG9pbnRzIHRoYXQgbGFuZFxuICogd2l0aGluIGF0IGxlYXN0IG9uZSBwb2x5Z29uXG4gKiBAZXhhbXBsZVxuICogdmFyIHNlYXJjaFdpdGhpbiA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAqICAgXCJmZWF0dXJlc1wiOiBbXG4gKiAgICAge1xuICogICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICAgICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICAgICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgICAgIFwidHlwZVwiOiBcIlBvbHlnb25cIixcbiAqICAgICAgICAgXCJjb29yZGluYXRlc1wiOiBbW1xuICogICAgICAgICAgIFstNDYuNjUzLC0yMy41NDNdLFxuICogICAgICAgICAgIFstNDYuNjM0LC0yMy41MzQ2XSxcbiAqICAgICAgICAgICBbLTQ2LjYxMywtMjMuNTQzXSxcbiAqICAgICAgICAgICBbLTQ2LjYxNCwtMjMuNTU5XSxcbiAqICAgICAgICAgICBbLTQ2LjYzMSwtMjMuNTY3XSxcbiAqICAgICAgICAgICBbLTQ2LjY1MywtMjMuNTYwXSxcbiAqICAgICAgICAgICBbLTQ2LjY1MywtMjMuNTQzXVxuICogICAgICAgICBdXVxuICogICAgICAgfVxuICogICAgIH1cbiAqICAgXVxuICogfTtcbiAqIHZhciBwb2ludHMgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gKiAgIFwiZmVhdHVyZXNcIjogW1xuICogICAgIHtcbiAqICAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgICAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFstNDYuNjMxOCwgLTIzLjU1MjNdXG4gKiAgICAgICB9XG4gKiAgICAgfSwge1xuICogICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICAgICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICAgICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgICAgIFwiY29vcmRpbmF0ZXNcIjogWy00Ni42MjQ2LCAtMjMuNTMyNV1cbiAqICAgICAgIH1cbiAqICAgICB9LCB7XG4gKiAgICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgICAgICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgICAgICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICAgICAgXCJjb29yZGluYXRlc1wiOiBbLTQ2LjYwNjIsIC0yMy41NTEzXVxuICogICAgICAgfVxuICogICAgIH0sIHtcbiAqICAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgICAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFstNDYuNjYzLCAtMjMuNTU0XVxuICogICAgICAgfVxuICogICAgIH0sIHtcbiAqICAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgICAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFstNDYuNjQzLCAtMjMuNTU3XVxuICogICAgICAgfVxuICogICAgIH1cbiAqICAgXVxuICogfTtcbiAqXG4gKiB2YXIgcHRzV2l0aGluID0gdHVyZi53aXRoaW4ocG9pbnRzLCBzZWFyY2hXaXRoaW4pO1xuICpcbiAqIC8vPXBvaW50c1xuICpcbiAqIC8vPXNlYXJjaFdpdGhpblxuICpcbiAqIC8vPXB0c1dpdGhpblxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHB0RkMsIHBvbHlGQyl7XG4gIHZhciBwb2ludHNXaXRoaW4gPSBmZWF0dXJlQ29sbGVjdGlvbihbXSk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcG9seUZDLmZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBwdEZDLmZlYXR1cmVzLmxlbmd0aDsgaisrKSB7XG4gICAgICB2YXIgaXNJbnNpZGUgPSBpbnNpZGUocHRGQy5mZWF0dXJlc1tqXSwgcG9seUZDLmZlYXR1cmVzW2ldKTtcbiAgICAgIGlmKGlzSW5zaWRlKXtcbiAgICAgICAgcG9pbnRzV2l0aGluLmZlYXR1cmVzLnB1c2gocHRGQy5mZWF0dXJlc1tqXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBwb2ludHNXaXRoaW47XG59O1xuIiwiLyohXG5Db3B5cmlnaHQgKEMpIDIwMTAtMjAxMyBSYXltb25kIEhpbGw6IGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaVxuTUlUIExpY2Vuc2U6IFNlZSBodHRwczovL2dpdGh1Yi5jb20vZ29yaGlsbC9KYXZhc2NyaXB0LVZvcm9ub2kvTElDRU5TRS5tZFxuKi9cbi8qXG5BdXRob3I6IFJheW1vbmQgSGlsbCAocmhpbGxAcmF5bW9uZGhpbGwubmV0KVxuQ29udHJpYnV0b3I6IEplc3NlIE1vcmdhbiAobW9yZ2FqZWxAZ21haWwuY29tKVxuRmlsZTogcmhpbGwtdm9yb25vaS1jb3JlLmpzXG5WZXJzaW9uOiAwLjk4XG5EYXRlOiBKYW51YXJ5IDIxLCAyMDEzXG5EZXNjcmlwdGlvbjogVGhpcyBpcyBteSBwZXJzb25hbCBKYXZhc2NyaXB0IGltcGxlbWVudGF0aW9uIG9mXG5TdGV2ZW4gRm9ydHVuZSdzIGFsZ29yaXRobSB0byBjb21wdXRlIFZvcm9ub2kgZGlhZ3JhbXMuXG5cbkxpY2Vuc2U6IFNlZSBodHRwczovL2dpdGh1Yi5jb20vZ29yaGlsbC9KYXZhc2NyaXB0LVZvcm9ub2kvTElDRU5TRS5tZFxuQ3JlZGl0czogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9DUkVESVRTLm1kXG5IaXN0b3J5OiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pL0NIQU5HRUxPRy5tZFxuXG4jIyBVc2FnZTpcblxuICB2YXIgc2l0ZXMgPSBbe3g6MzAwLHk6MzAwfSwge3g6MTAwLHk6MTAwfSwge3g6MjAwLHk6NTAwfSwge3g6MjUwLHk6NDUwfSwge3g6NjAwLHk6MTUwfV07XG4gIC8vIHhsLCB4ciBtZWFucyB4IGxlZnQsIHggcmlnaHRcbiAgLy8geXQsIHliIG1lYW5zIHkgdG9wLCB5IGJvdHRvbVxuICB2YXIgYmJveCA9IHt4bDowLCB4cjo4MDAsIHl0OjAsIHliOjYwMH07XG4gIHZhciB2b3Jvbm9pID0gbmV3IFZvcm9ub2koKTtcbiAgLy8gcGFzcyBhbiBvYmplY3Qgd2hpY2ggZXhoaWJpdHMgeGwsIHhyLCB5dCwgeWIgcHJvcGVydGllcy4gVGhlIGJvdW5kaW5nXG4gIC8vIGJveCB3aWxsIGJlIHVzZWQgdG8gY29ubmVjdCB1bmJvdW5kIGVkZ2VzLCBhbmQgdG8gY2xvc2Ugb3BlbiBjZWxsc1xuICByZXN1bHQgPSB2b3Jvbm9pLmNvbXB1dGUoc2l0ZXMsIGJib3gpO1xuICAvLyByZW5kZXIsIGZ1cnRoZXIgYW5hbHl6ZSwgZXRjLlxuXG5SZXR1cm4gdmFsdWU6XG4gIEFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcblxuICByZXN1bHQudmVydGljZXMgPSBhbiBhcnJheSBvZiB1bm9yZGVyZWQsIHVuaXF1ZSBWb3Jvbm9pLlZlcnRleCBvYmplY3RzIG1ha2luZ1xuICAgIHVwIHRoZSBWb3Jvbm9pIGRpYWdyYW0uXG4gIHJlc3VsdC5lZGdlcyA9IGFuIGFycmF5IG9mIHVub3JkZXJlZCwgdW5pcXVlIFZvcm9ub2kuRWRnZSBvYmplY3RzIG1ha2luZyB1cFxuICAgIHRoZSBWb3Jvbm9pIGRpYWdyYW0uXG4gIHJlc3VsdC5jZWxscyA9IGFuIGFycmF5IG9mIFZvcm9ub2kuQ2VsbCBvYmplY3QgbWFraW5nIHVwIHRoZSBWb3Jvbm9pIGRpYWdyYW0uXG4gICAgQSBDZWxsIG9iamVjdCBtaWdodCBoYXZlIGFuIGVtcHR5IGFycmF5IG9mIGhhbGZlZGdlcywgbWVhbmluZyBubyBWb3Jvbm9pXG4gICAgY2VsbCBjb3VsZCBiZSBjb21wdXRlZCBmb3IgYSBwYXJ0aWN1bGFyIGNlbGwuXG4gIHJlc3VsdC5leGVjVGltZSA9IHRoZSB0aW1lIGl0IHRvb2sgdG8gY29tcHV0ZSB0aGUgVm9yb25vaSBkaWFncmFtLCBpblxuICAgIG1pbGxpc2Vjb25kcy5cblxuVm9yb25vaS5WZXJ0ZXggb2JqZWN0OlxuICB4OiBUaGUgeCBwb3NpdGlvbiBvZiB0aGUgdmVydGV4LlxuICB5OiBUaGUgeSBwb3NpdGlvbiBvZiB0aGUgdmVydGV4LlxuXG5Wb3Jvbm9pLkVkZ2Ugb2JqZWN0OlxuICBsU2l0ZTogdGhlIFZvcm9ub2kgc2l0ZSBvYmplY3QgYXQgdGhlIGxlZnQgb2YgdGhpcyBWb3Jvbm9pLkVkZ2Ugb2JqZWN0LlxuICByU2l0ZTogdGhlIFZvcm9ub2kgc2l0ZSBvYmplY3QgYXQgdGhlIHJpZ2h0IG9mIHRoaXMgVm9yb25vaS5FZGdlIG9iamVjdCAoY2FuXG4gICAgYmUgbnVsbCkuXG4gIHZhOiBhbiBvYmplY3Qgd2l0aCBhbiAneCcgYW5kIGEgJ3knIHByb3BlcnR5IGRlZmluaW5nIHRoZSBzdGFydCBwb2ludFxuICAgIChyZWxhdGl2ZSB0byB0aGUgVm9yb25vaSBzaXRlIG9uIHRoZSBsZWZ0KSBvZiB0aGlzIFZvcm9ub2kuRWRnZSBvYmplY3QuXG4gIHZiOiBhbiBvYmplY3Qgd2l0aCBhbiAneCcgYW5kIGEgJ3knIHByb3BlcnR5IGRlZmluaW5nIHRoZSBlbmQgcG9pbnRcbiAgICAocmVsYXRpdmUgdG8gVm9yb25vaSBzaXRlIG9uIHRoZSBsZWZ0KSBvZiB0aGlzIFZvcm9ub2kuRWRnZSBvYmplY3QuXG5cbiAgRm9yIGVkZ2VzIHdoaWNoIGFyZSB1c2VkIHRvIGNsb3NlIG9wZW4gY2VsbHMgKHVzaW5nIHRoZSBzdXBwbGllZCBib3VuZGluZ1xuICBib3gpLCB0aGUgclNpdGUgcHJvcGVydHkgd2lsbCBiZSBudWxsLlxuXG5Wb3Jvbm9pLkNlbGwgb2JqZWN0OlxuICBzaXRlOiB0aGUgVm9yb25vaSBzaXRlIG9iamVjdCBhc3NvY2lhdGVkIHdpdGggdGhlIFZvcm9ub2kgY2VsbC5cbiAgaGFsZmVkZ2VzOiBhbiBhcnJheSBvZiBWb3Jvbm9pLkhhbGZlZGdlIG9iamVjdHMsIG9yZGVyZWQgY291bnRlcmNsb2Nrd2lzZSxcbiAgICBkZWZpbmluZyB0aGUgcG9seWdvbiBmb3IgdGhpcyBWb3Jvbm9pIGNlbGwuXG5cblZvcm9ub2kuSGFsZmVkZ2Ugb2JqZWN0OlxuICBzaXRlOiB0aGUgVm9yb25vaSBzaXRlIG9iamVjdCBvd25pbmcgdGhpcyBWb3Jvbm9pLkhhbGZlZGdlIG9iamVjdC5cbiAgZWRnZTogYSByZWZlcmVuY2UgdG8gdGhlIHVuaXF1ZSBWb3Jvbm9pLkVkZ2Ugb2JqZWN0IHVuZGVybHlpbmcgdGhpc1xuICAgIFZvcm9ub2kuSGFsZmVkZ2Ugb2JqZWN0LlxuICBnZXRTdGFydHBvaW50KCk6IGEgbWV0aG9kIHJldHVybmluZyBhbiBvYmplY3Qgd2l0aCBhbiAneCcgYW5kIGEgJ3knIHByb3BlcnR5XG4gICAgZm9yIHRoZSBzdGFydCBwb2ludCBvZiB0aGlzIGhhbGZlZGdlLiBLZWVwIGluIG1pbmQgaGFsZmVkZ2VzIGFyZSBhbHdheXNcbiAgICBjb3VudGVyY29ja3dpc2UuXG4gIGdldEVuZHBvaW50KCk6IGEgbWV0aG9kIHJldHVybmluZyBhbiBvYmplY3Qgd2l0aCBhbiAneCcgYW5kIGEgJ3knIHByb3BlcnR5XG4gICAgZm9yIHRoZSBlbmQgcG9pbnQgb2YgdGhpcyBoYWxmZWRnZS4gS2VlcCBpbiBtaW5kIGhhbGZlZGdlcyBhcmUgYWx3YXlzXG4gICAgY291bnRlcmNvY2t3aXNlLlxuXG5UT0RPOiBJZGVudGlmeSBvcHBvcnR1bml0aWVzIGZvciBwZXJmb3JtYW5jZSBpbXByb3ZlbWVudC5cblxuVE9ETzogTGV0IHRoZSB1c2VyIGNsb3NlIHRoZSBWb3Jvbm9pIGNlbGxzLCBkbyBub3QgZG8gaXQgYXV0b21hdGljYWxseS4gTm90IG9ubHkgbGV0XG4gICAgICBoaW0gY2xvc2UgdGhlIGNlbGxzLCBidXQgYWxzbyBhbGxvdyBoaW0gdG8gY2xvc2UgbW9yZSB0aGFuIG9uY2UgdXNpbmcgYSBkaWZmZXJlbnRcbiAgICAgIGJvdW5kaW5nIGJveCBmb3IgdGhlIHNhbWUgVm9yb25vaSBkaWFncmFtLlxuKi9cblxuLypnbG9iYWwgTWF0aCAqL1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gVm9yb25vaSgpIHtcbiAgICB0aGlzLnZlcnRpY2VzID0gbnVsbDtcbiAgICB0aGlzLmVkZ2VzID0gbnVsbDtcbiAgICB0aGlzLmNlbGxzID0gbnVsbDtcbiAgICB0aGlzLnRvUmVjeWNsZSA9IG51bGw7XG4gICAgdGhpcy5iZWFjaHNlY3Rpb25KdW5reWFyZCA9IFtdO1xuICAgIHRoaXMuY2lyY2xlRXZlbnRKdW5reWFyZCA9IFtdO1xuICAgIHRoaXMudmVydGV4SnVua3lhcmQgPSBbXTtcbiAgICB0aGlzLmVkZ2VKdW5reWFyZCA9IFtdO1xuICAgIHRoaXMuY2VsbEp1bmt5YXJkID0gW107XG4gICAgfVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuVm9yb25vaS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuYmVhY2hsaW5lKSB7XG4gICAgICAgIHRoaXMuYmVhY2hsaW5lID0gbmV3IHRoaXMuUkJUcmVlKCk7XG4gICAgICAgIH1cbiAgICAvLyBNb3ZlIGxlZnRvdmVyIGJlYWNoc2VjdGlvbnMgdG8gdGhlIGJlYWNoc2VjdGlvbiBqdW5reWFyZC5cbiAgICBpZiAodGhpcy5iZWFjaGxpbmUucm9vdCkge1xuICAgICAgICB2YXIgYmVhY2hzZWN0aW9uID0gdGhpcy5iZWFjaGxpbmUuZ2V0Rmlyc3QodGhpcy5iZWFjaGxpbmUucm9vdCk7XG4gICAgICAgIHdoaWxlIChiZWFjaHNlY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuYmVhY2hzZWN0aW9uSnVua3lhcmQucHVzaChiZWFjaHNlY3Rpb24pOyAvLyBtYXJrIGZvciByZXVzZVxuICAgICAgICAgICAgYmVhY2hzZWN0aW9uID0gYmVhY2hzZWN0aW9uLnJiTmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIHRoaXMuYmVhY2hsaW5lLnJvb3QgPSBudWxsO1xuICAgIGlmICghdGhpcy5jaXJjbGVFdmVudHMpIHtcbiAgICAgICAgdGhpcy5jaXJjbGVFdmVudHMgPSBuZXcgdGhpcy5SQlRyZWUoKTtcbiAgICAgICAgfVxuICAgIHRoaXMuY2lyY2xlRXZlbnRzLnJvb3QgPSB0aGlzLmZpcnN0Q2lyY2xlRXZlbnQgPSBudWxsO1xuICAgIHRoaXMudmVydGljZXMgPSBbXTtcbiAgICB0aGlzLmVkZ2VzID0gW107XG4gICAgdGhpcy5jZWxscyA9IFtdO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLnNxcnQgPSBNYXRoLnNxcnQ7XG5Wb3Jvbm9pLnByb3RvdHlwZS5hYnMgPSBNYXRoLmFicztcblZvcm9ub2kucHJvdG90eXBlLs61ID0gVm9yb25vaS7OtSA9IDFlLTk7XG5Wb3Jvbm9pLnByb3RvdHlwZS5pbnbOtSA9IFZvcm9ub2kuaW52zrUgPSAxLjAgLyBWb3Jvbm9pLs61O1xuVm9yb25vaS5wcm90b3R5cGUuZXF1YWxXaXRoRXBzaWxvbiA9IGZ1bmN0aW9uKGEsYil7cmV0dXJuIHRoaXMuYWJzKGEtYik8MWUtOTt9O1xuVm9yb25vaS5wcm90b3R5cGUuZ3JlYXRlclRoYW5XaXRoRXBzaWxvbiA9IGZ1bmN0aW9uKGEsYil7cmV0dXJuIGEtYj4xZS05O307XG5Wb3Jvbm9pLnByb3RvdHlwZS5ncmVhdGVyVGhhbk9yRXF1YWxXaXRoRXBzaWxvbiA9IGZ1bmN0aW9uKGEsYil7cmV0dXJuIGItYTwxZS05O307XG5Wb3Jvbm9pLnByb3RvdHlwZS5sZXNzVGhhbldpdGhFcHNpbG9uID0gZnVuY3Rpb24oYSxiKXtyZXR1cm4gYi1hPjFlLTk7fTtcblZvcm9ub2kucHJvdG90eXBlLmxlc3NUaGFuT3JFcXVhbFdpdGhFcHNpbG9uID0gZnVuY3Rpb24oYSxiKXtyZXR1cm4gYS1iPDFlLTk7fTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBSZWQtQmxhY2sgdHJlZSBjb2RlIChiYXNlZCBvbiBDIHZlcnNpb24gb2YgXCJyYnRyZWVcIiBieSBGcmFuY2sgQnVpLUh1dVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2ZidWlodXUvbGlidHJlZS9ibG9iL21hc3Rlci9yYi5jXG5cblZvcm9ub2kucHJvdG90eXBlLlJCVHJlZSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucm9vdCA9IG51bGw7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuUkJUcmVlLnByb3RvdHlwZS5yYkluc2VydFN1Y2Nlc3NvciA9IGZ1bmN0aW9uKG5vZGUsIHN1Y2Nlc3Nvcikge1xuICAgIHZhciBwYXJlbnQ7XG4gICAgaWYgKG5vZGUpIHtcbiAgICAgICAgLy8gPj4+IHJoaWxsIDIwMTEtMDUtMjc6IFBlcmZvcm1hbmNlOiBjYWNoZSBwcmV2aW91cy9uZXh0IG5vZGVzXG4gICAgICAgIHN1Y2Nlc3Nvci5yYlByZXZpb3VzID0gbm9kZTtcbiAgICAgICAgc3VjY2Vzc29yLnJiTmV4dCA9IG5vZGUucmJOZXh0O1xuICAgICAgICBpZiAobm9kZS5yYk5leHQpIHtcbiAgICAgICAgICAgIG5vZGUucmJOZXh0LnJiUHJldmlvdXMgPSBzdWNjZXNzb3I7XG4gICAgICAgICAgICB9XG4gICAgICAgIG5vZGUucmJOZXh0ID0gc3VjY2Vzc29yO1xuICAgICAgICAvLyA8PDxcbiAgICAgICAgaWYgKG5vZGUucmJSaWdodCkge1xuICAgICAgICAgICAgLy8gaW4tcGxhY2UgZXhwYW5zaW9uIG9mIG5vZGUucmJSaWdodC5nZXRGaXJzdCgpO1xuICAgICAgICAgICAgbm9kZSA9IG5vZGUucmJSaWdodDtcbiAgICAgICAgICAgIHdoaWxlIChub2RlLnJiTGVmdCkge25vZGUgPSBub2RlLnJiTGVmdDt9XG4gICAgICAgICAgICBub2RlLnJiTGVmdCA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBub2RlLnJiUmlnaHQgPSBzdWNjZXNzb3I7XG4gICAgICAgICAgICB9XG4gICAgICAgIHBhcmVudCA9IG5vZGU7XG4gICAgICAgIH1cbiAgICAvLyByaGlsbCAyMDExLTA2LTA3OiBpZiBub2RlIGlzIG51bGwsIHN1Y2Nlc3NvciBtdXN0IGJlIGluc2VydGVkXG4gICAgLy8gdG8gdGhlIGxlZnQtbW9zdCBwYXJ0IG9mIHRoZSB0cmVlXG4gICAgZWxzZSBpZiAodGhpcy5yb290KSB7XG4gICAgICAgIG5vZGUgPSB0aGlzLmdldEZpcnN0KHRoaXMucm9vdCk7XG4gICAgICAgIC8vID4+PiBQZXJmb3JtYW5jZTogY2FjaGUgcHJldmlvdXMvbmV4dCBub2Rlc1xuICAgICAgICBzdWNjZXNzb3IucmJQcmV2aW91cyA9IG51bGw7XG4gICAgICAgIHN1Y2Nlc3Nvci5yYk5leHQgPSBub2RlO1xuICAgICAgICBub2RlLnJiUHJldmlvdXMgPSBzdWNjZXNzb3I7XG4gICAgICAgIC8vIDw8PFxuICAgICAgICBub2RlLnJiTGVmdCA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgcGFyZW50ID0gbm9kZTtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICAvLyA+Pj4gUGVyZm9ybWFuY2U6IGNhY2hlIHByZXZpb3VzL25leHQgbm9kZXNcbiAgICAgICAgc3VjY2Vzc29yLnJiUHJldmlvdXMgPSBzdWNjZXNzb3IucmJOZXh0ID0gbnVsbDtcbiAgICAgICAgLy8gPDw8XG4gICAgICAgIHRoaXMucm9vdCA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgcGFyZW50ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIHN1Y2Nlc3Nvci5yYkxlZnQgPSBzdWNjZXNzb3IucmJSaWdodCA9IG51bGw7XG4gICAgc3VjY2Vzc29yLnJiUGFyZW50ID0gcGFyZW50O1xuICAgIHN1Y2Nlc3Nvci5yYlJlZCA9IHRydWU7XG4gICAgLy8gRml4dXAgdGhlIG1vZGlmaWVkIHRyZWUgYnkgcmVjb2xvcmluZyBub2RlcyBhbmQgcGVyZm9ybWluZ1xuICAgIC8vIHJvdGF0aW9ucyAoMiBhdCBtb3N0KSBoZW5jZSB0aGUgcmVkLWJsYWNrIHRyZWUgcHJvcGVydGllcyBhcmVcbiAgICAvLyBwcmVzZXJ2ZWQuXG4gICAgdmFyIGdyYW5kcGEsIHVuY2xlO1xuICAgIG5vZGUgPSBzdWNjZXNzb3I7XG4gICAgd2hpbGUgKHBhcmVudCAmJiBwYXJlbnQucmJSZWQpIHtcbiAgICAgICAgZ3JhbmRwYSA9IHBhcmVudC5yYlBhcmVudDtcbiAgICAgICAgaWYgKHBhcmVudCA9PT0gZ3JhbmRwYS5yYkxlZnQpIHtcbiAgICAgICAgICAgIHVuY2xlID0gZ3JhbmRwYS5yYlJpZ2h0O1xuICAgICAgICAgICAgaWYgKHVuY2xlICYmIHVuY2xlLnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJiUmVkID0gdW5jbGUucmJSZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBncmFuZHBhLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBub2RlID0gZ3JhbmRwYTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobm9kZSA9PT0gcGFyZW50LnJiUmlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZUxlZnQocGFyZW50KTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZSA9IHBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50ID0gbm9kZS5yYlBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGdyYW5kcGEucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMucmJSb3RhdGVSaWdodChncmFuZHBhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdW5jbGUgPSBncmFuZHBhLnJiTGVmdDtcbiAgICAgICAgICAgIGlmICh1bmNsZSAmJiB1bmNsZS5yYlJlZCkge1xuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IHVuY2xlLnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgZ3JhbmRwYS5yYlJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgbm9kZSA9IGdyYW5kcGE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUgPT09IHBhcmVudC5yYkxlZnQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZVJpZ2h0KHBhcmVudCk7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUgPSBwYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgIHBhcmVudCA9IG5vZGUucmJQYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwYXJlbnQucmJSZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBncmFuZHBhLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlTGVmdChncmFuZHBhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIHBhcmVudCA9IG5vZGUucmJQYXJlbnQ7XG4gICAgICAgIH1cbiAgICB0aGlzLnJvb3QucmJSZWQgPSBmYWxzZTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLnJiUmVtb3ZlTm9kZSA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAvLyA+Pj4gcmhpbGwgMjAxMS0wNS0yNzogUGVyZm9ybWFuY2U6IGNhY2hlIHByZXZpb3VzL25leHQgbm9kZXNcbiAgICBpZiAobm9kZS5yYk5leHQpIHtcbiAgICAgICAgbm9kZS5yYk5leHQucmJQcmV2aW91cyA9IG5vZGUucmJQcmV2aW91cztcbiAgICAgICAgfVxuICAgIGlmIChub2RlLnJiUHJldmlvdXMpIHtcbiAgICAgICAgbm9kZS5yYlByZXZpb3VzLnJiTmV4dCA9IG5vZGUucmJOZXh0O1xuICAgICAgICB9XG4gICAgbm9kZS5yYk5leHQgPSBub2RlLnJiUHJldmlvdXMgPSBudWxsO1xuICAgIC8vIDw8PFxuICAgIHZhciBwYXJlbnQgPSBub2RlLnJiUGFyZW50LFxuICAgICAgICBsZWZ0ID0gbm9kZS5yYkxlZnQsXG4gICAgICAgIHJpZ2h0ID0gbm9kZS5yYlJpZ2h0LFxuICAgICAgICBuZXh0O1xuICAgIGlmICghbGVmdCkge1xuICAgICAgICBuZXh0ID0gcmlnaHQ7XG4gICAgICAgIH1cbiAgICBlbHNlIGlmICghcmlnaHQpIHtcbiAgICAgICAgbmV4dCA9IGxlZnQ7XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgbmV4dCA9IHRoaXMuZ2V0Rmlyc3QocmlnaHQpO1xuICAgICAgICB9XG4gICAgaWYgKHBhcmVudCkge1xuICAgICAgICBpZiAocGFyZW50LnJiTGVmdCA9PT0gbm9kZSkge1xuICAgICAgICAgICAgcGFyZW50LnJiTGVmdCA9IG5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcGFyZW50LnJiUmlnaHQgPSBuZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMucm9vdCA9IG5leHQ7XG4gICAgICAgIH1cbiAgICAvLyBlbmZvcmNlIHJlZC1ibGFjayBydWxlc1xuICAgIHZhciBpc1JlZDtcbiAgICBpZiAobGVmdCAmJiByaWdodCkge1xuICAgICAgICBpc1JlZCA9IG5leHQucmJSZWQ7XG4gICAgICAgIG5leHQucmJSZWQgPSBub2RlLnJiUmVkO1xuICAgICAgICBuZXh0LnJiTGVmdCA9IGxlZnQ7XG4gICAgICAgIGxlZnQucmJQYXJlbnQgPSBuZXh0O1xuICAgICAgICBpZiAobmV4dCAhPT0gcmlnaHQpIHtcbiAgICAgICAgICAgIHBhcmVudCA9IG5leHQucmJQYXJlbnQ7XG4gICAgICAgICAgICBuZXh0LnJiUGFyZW50ID0gbm9kZS5yYlBhcmVudDtcbiAgICAgICAgICAgIG5vZGUgPSBuZXh0LnJiUmlnaHQ7XG4gICAgICAgICAgICBwYXJlbnQucmJMZWZ0ID0gbm9kZTtcbiAgICAgICAgICAgIG5leHQucmJSaWdodCA9IHJpZ2h0O1xuICAgICAgICAgICAgcmlnaHQucmJQYXJlbnQgPSBuZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG5leHQucmJQYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgICAgICBwYXJlbnQgPSBuZXh0O1xuICAgICAgICAgICAgbm9kZSA9IG5leHQucmJSaWdodDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpc1JlZCA9IG5vZGUucmJSZWQ7XG4gICAgICAgIG5vZGUgPSBuZXh0O1xuICAgICAgICB9XG4gICAgLy8gJ25vZGUnIGlzIG5vdyB0aGUgc29sZSBzdWNjZXNzb3IncyBjaGlsZCBhbmQgJ3BhcmVudCcgaXRzXG4gICAgLy8gbmV3IHBhcmVudCAoc2luY2UgdGhlIHN1Y2Nlc3NvciBjYW4gaGF2ZSBiZWVuIG1vdmVkKVxuICAgIGlmIChub2RlKSB7XG4gICAgICAgIG5vZGUucmJQYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgIH1cbiAgICAvLyB0aGUgJ2Vhc3knIGNhc2VzXG4gICAgaWYgKGlzUmVkKSB7cmV0dXJuO31cbiAgICBpZiAobm9kZSAmJiBub2RlLnJiUmVkKSB7XG4gICAgICAgIG5vZGUucmJSZWQgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgLy8gdGhlIG90aGVyIGNhc2VzXG4gICAgdmFyIHNpYmxpbmc7XG4gICAgZG8ge1xuICAgICAgICBpZiAobm9kZSA9PT0gdGhpcy5yb290KSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUgPT09IHBhcmVudC5yYkxlZnQpIHtcbiAgICAgICAgICAgIHNpYmxpbmcgPSBwYXJlbnQucmJSaWdodDtcbiAgICAgICAgICAgIGlmIChzaWJsaW5nLnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgc2libGluZy5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZUxlZnQocGFyZW50KTtcbiAgICAgICAgICAgICAgICBzaWJsaW5nID0gcGFyZW50LnJiUmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKChzaWJsaW5nLnJiTGVmdCAmJiBzaWJsaW5nLnJiTGVmdC5yYlJlZCkgfHwgKHNpYmxpbmcucmJSaWdodCAmJiBzaWJsaW5nLnJiUmlnaHQucmJSZWQpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzaWJsaW5nLnJiUmlnaHQgfHwgIXNpYmxpbmcucmJSaWdodC5yYlJlZCkge1xuICAgICAgICAgICAgICAgICAgICBzaWJsaW5nLnJiTGVmdC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBzaWJsaW5nLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZVJpZ2h0KHNpYmxpbmcpO1xuICAgICAgICAgICAgICAgICAgICBzaWJsaW5nID0gcGFyZW50LnJiUmlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzaWJsaW5nLnJiUmVkID0gcGFyZW50LnJiUmVkO1xuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IHNpYmxpbmcucmJSaWdodC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMucmJSb3RhdGVMZWZ0KHBhcmVudCk7XG4gICAgICAgICAgICAgICAgbm9kZSA9IHRoaXMucm9vdDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2libGluZyA9IHBhcmVudC5yYkxlZnQ7XG4gICAgICAgICAgICBpZiAoc2libGluZy5yYlJlZCkge1xuICAgICAgICAgICAgICAgIHNpYmxpbmcucmJSZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBwYXJlbnQucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMucmJSb3RhdGVSaWdodChwYXJlbnQpO1xuICAgICAgICAgICAgICAgIHNpYmxpbmcgPSBwYXJlbnQucmJMZWZ0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgoc2libGluZy5yYkxlZnQgJiYgc2libGluZy5yYkxlZnQucmJSZWQpIHx8IChzaWJsaW5nLnJiUmlnaHQgJiYgc2libGluZy5yYlJpZ2h0LnJiUmVkKSkge1xuICAgICAgICAgICAgICAgIGlmICghc2libGluZy5yYkxlZnQgfHwgIXNpYmxpbmcucmJMZWZ0LnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcucmJSaWdodC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBzaWJsaW5nLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZUxlZnQoc2libGluZyk7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcgPSBwYXJlbnQucmJMZWZ0O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2libGluZy5yYlJlZCA9IHBhcmVudC5yYlJlZDtcbiAgICAgICAgICAgICAgICBwYXJlbnQucmJSZWQgPSBzaWJsaW5nLnJiTGVmdC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMucmJSb3RhdGVSaWdodChwYXJlbnQpO1xuICAgICAgICAgICAgICAgIG5vZGUgPSB0aGlzLnJvb3Q7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBzaWJsaW5nLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgbm9kZSA9IHBhcmVudDtcbiAgICAgICAgcGFyZW50ID0gcGFyZW50LnJiUGFyZW50O1xuICAgIH0gd2hpbGUgKCFub2RlLnJiUmVkKTtcbiAgICBpZiAobm9kZSkge25vZGUucmJSZWQgPSBmYWxzZTt9XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuUkJUcmVlLnByb3RvdHlwZS5yYlJvdGF0ZUxlZnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHAgPSBub2RlLFxuICAgICAgICBxID0gbm9kZS5yYlJpZ2h0LCAvLyBjYW4ndCBiZSBudWxsXG4gICAgICAgIHBhcmVudCA9IHAucmJQYXJlbnQ7XG4gICAgaWYgKHBhcmVudCkge1xuICAgICAgICBpZiAocGFyZW50LnJiTGVmdCA9PT0gcCkge1xuICAgICAgICAgICAgcGFyZW50LnJiTGVmdCA9IHE7XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcGFyZW50LnJiUmlnaHQgPSBxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMucm9vdCA9IHE7XG4gICAgICAgIH1cbiAgICBxLnJiUGFyZW50ID0gcGFyZW50O1xuICAgIHAucmJQYXJlbnQgPSBxO1xuICAgIHAucmJSaWdodCA9IHEucmJMZWZ0O1xuICAgIGlmIChwLnJiUmlnaHQpIHtcbiAgICAgICAgcC5yYlJpZ2h0LnJiUGFyZW50ID0gcDtcbiAgICAgICAgfVxuICAgIHEucmJMZWZ0ID0gcDtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLnJiUm90YXRlUmlnaHQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHAgPSBub2RlLFxuICAgICAgICBxID0gbm9kZS5yYkxlZnQsIC8vIGNhbid0IGJlIG51bGxcbiAgICAgICAgcGFyZW50ID0gcC5yYlBhcmVudDtcbiAgICBpZiAocGFyZW50KSB7XG4gICAgICAgIGlmIChwYXJlbnQucmJMZWZ0ID09PSBwKSB7XG4gICAgICAgICAgICBwYXJlbnQucmJMZWZ0ID0gcTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBwYXJlbnQucmJSaWdodCA9IHE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5yb290ID0gcTtcbiAgICAgICAgfVxuICAgIHEucmJQYXJlbnQgPSBwYXJlbnQ7XG4gICAgcC5yYlBhcmVudCA9IHE7XG4gICAgcC5yYkxlZnQgPSBxLnJiUmlnaHQ7XG4gICAgaWYgKHAucmJMZWZ0KSB7XG4gICAgICAgIHAucmJMZWZ0LnJiUGFyZW50ID0gcDtcbiAgICAgICAgfVxuICAgIHEucmJSaWdodCA9IHA7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuUkJUcmVlLnByb3RvdHlwZS5nZXRGaXJzdCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB3aGlsZSAobm9kZS5yYkxlZnQpIHtcbiAgICAgICAgbm9kZSA9IG5vZGUucmJMZWZ0O1xuICAgICAgICB9XG4gICAgcmV0dXJuIG5vZGU7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuUkJUcmVlLnByb3RvdHlwZS5nZXRMYXN0ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHdoaWxlIChub2RlLnJiUmlnaHQpIHtcbiAgICAgICAgbm9kZSA9IG5vZGUucmJSaWdodDtcbiAgICAgICAgfVxuICAgIHJldHVybiBub2RlO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gRGlhZ3JhbSBtZXRob2RzXG5cblZvcm9ub2kucHJvdG90eXBlLkRpYWdyYW0gPSBmdW5jdGlvbihzaXRlKSB7XG4gICAgdGhpcy5zaXRlID0gc2l0ZTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIENlbGwgbWV0aG9kc1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsID0gZnVuY3Rpb24oc2l0ZSkge1xuICAgIHRoaXMuc2l0ZSA9IHNpdGU7XG4gICAgdGhpcy5oYWxmZWRnZXMgPSBbXTtcbiAgICB0aGlzLmNsb3NlTWUgPSBmYWxzZTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oc2l0ZSkge1xuICAgIHRoaXMuc2l0ZSA9IHNpdGU7XG4gICAgdGhpcy5oYWxmZWRnZXMgPSBbXTtcbiAgICB0aGlzLmNsb3NlTWUgPSBmYWxzZTtcbiAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jcmVhdGVDZWxsID0gZnVuY3Rpb24oc2l0ZSkge1xuICAgIHZhciBjZWxsID0gdGhpcy5jZWxsSnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCBjZWxsICkge1xuICAgICAgICByZXR1cm4gY2VsbC5pbml0KHNpdGUpO1xuICAgICAgICB9XG4gICAgcmV0dXJuIG5ldyB0aGlzLkNlbGwoc2l0ZSk7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuQ2VsbC5wcm90b3R5cGUucHJlcGFyZUhhbGZlZGdlcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBoYWxmZWRnZXMgPSB0aGlzLmhhbGZlZGdlcyxcbiAgICAgICAgaUhhbGZlZGdlID0gaGFsZmVkZ2VzLmxlbmd0aCxcbiAgICAgICAgZWRnZTtcbiAgICAvLyBnZXQgcmlkIG9mIHVudXNlZCBoYWxmZWRnZXNcbiAgICAvLyByaGlsbCAyMDExLTA1LTI3OiBLZWVwIGl0IHNpbXBsZSwgbm8gcG9pbnQgaGVyZSBpbiB0cnlpbmdcbiAgICAvLyB0byBiZSBmYW5jeTogZGFuZ2xpbmcgZWRnZXMgYXJlIGEgdHlwaWNhbGx5IGEgbWlub3JpdHkuXG4gICAgd2hpbGUgKGlIYWxmZWRnZS0tKSB7XG4gICAgICAgIGVkZ2UgPSBoYWxmZWRnZXNbaUhhbGZlZGdlXS5lZGdlO1xuICAgICAgICBpZiAoIWVkZ2UudmIgfHwgIWVkZ2UudmEpIHtcbiAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUhhbGZlZGdlLDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAvLyByaGlsbCAyMDExLTA1LTI2OiBJIHRyaWVkIHRvIHVzZSBhIGJpbmFyeSBzZWFyY2ggYXQgaW5zZXJ0aW9uXG4gICAgLy8gdGltZSB0byBrZWVwIHRoZSBhcnJheSBzb3J0ZWQgb24tdGhlLWZseSAoaW4gQ2VsbC5hZGRIYWxmZWRnZSgpKS5cbiAgICAvLyBUaGVyZSB3YXMgbm8gcmVhbCBiZW5lZml0cyBpbiBkb2luZyBzbywgcGVyZm9ybWFuY2Ugb25cbiAgICAvLyBGaXJlZm94IDMuNiB3YXMgaW1wcm92ZWQgbWFyZ2luYWxseSwgd2hpbGUgcGVyZm9ybWFuY2Ugb25cbiAgICAvLyBPcGVyYSAxMSB3YXMgcGVuYWxpemVkIG1hcmdpbmFsbHkuXG4gICAgaGFsZmVkZ2VzLnNvcnQoZnVuY3Rpb24oYSxiKXtyZXR1cm4gYi5hbmdsZS1hLmFuZ2xlO30pO1xuICAgIHJldHVybiBoYWxmZWRnZXMubGVuZ3RoO1xuICAgIH07XG5cbi8vIFJldHVybiBhIGxpc3Qgb2YgdGhlIG5laWdoYm9yIElkc1xuVm9yb25vaS5wcm90b3R5cGUuQ2VsbC5wcm90b3R5cGUuZ2V0TmVpZ2hib3JJZHMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbmVpZ2hib3JzID0gW10sXG4gICAgICAgIGlIYWxmZWRnZSA9IHRoaXMuaGFsZmVkZ2VzLmxlbmd0aCxcbiAgICAgICAgZWRnZTtcbiAgICB3aGlsZSAoaUhhbGZlZGdlLS0pe1xuICAgICAgICBlZGdlID0gdGhpcy5oYWxmZWRnZXNbaUhhbGZlZGdlXS5lZGdlO1xuICAgICAgICBpZiAoZWRnZS5sU2l0ZSAhPT0gbnVsbCAmJiBlZGdlLmxTaXRlLnZvcm9ub2lJZCAhPSB0aGlzLnNpdGUudm9yb25vaUlkKSB7XG4gICAgICAgICAgICBuZWlnaGJvcnMucHVzaChlZGdlLmxTaXRlLnZvcm9ub2lJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGVkZ2UuclNpdGUgIT09IG51bGwgJiYgZWRnZS5yU2l0ZS52b3Jvbm9pSWQgIT0gdGhpcy5zaXRlLnZvcm9ub2lJZCl7XG4gICAgICAgICAgICBuZWlnaGJvcnMucHVzaChlZGdlLnJTaXRlLnZvcm9ub2lJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICByZXR1cm4gbmVpZ2hib3JzO1xuICAgIH07XG5cbi8vIENvbXB1dGUgYm91bmRpbmcgYm94XG4vL1xuVm9yb25vaS5wcm90b3R5cGUuQ2VsbC5wcm90b3R5cGUuZ2V0QmJveCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBoYWxmZWRnZXMgPSB0aGlzLmhhbGZlZGdlcyxcbiAgICAgICAgaUhhbGZlZGdlID0gaGFsZmVkZ2VzLmxlbmd0aCxcbiAgICAgICAgeG1pbiA9IEluZmluaXR5LFxuICAgICAgICB5bWluID0gSW5maW5pdHksXG4gICAgICAgIHhtYXggPSAtSW5maW5pdHksXG4gICAgICAgIHltYXggPSAtSW5maW5pdHksXG4gICAgICAgIHYsIHZ4LCB2eTtcbiAgICB3aGlsZSAoaUhhbGZlZGdlLS0pIHtcbiAgICAgICAgdiA9IGhhbGZlZGdlc1tpSGFsZmVkZ2VdLmdldFN0YXJ0cG9pbnQoKTtcbiAgICAgICAgdnggPSB2Lng7XG4gICAgICAgIHZ5ID0gdi55O1xuICAgICAgICBpZiAodnggPCB4bWluKSB7eG1pbiA9IHZ4O31cbiAgICAgICAgaWYgKHZ5IDwgeW1pbikge3ltaW4gPSB2eTt9XG4gICAgICAgIGlmICh2eCA+IHhtYXgpIHt4bWF4ID0gdng7fVxuICAgICAgICBpZiAodnkgPiB5bWF4KSB7eW1heCA9IHZ5O31cbiAgICAgICAgLy8gd2UgZG9udCBuZWVkIHRvIHRha2UgaW50byBhY2NvdW50IGVuZCBwb2ludCxcbiAgICAgICAgLy8gc2luY2UgZWFjaCBlbmQgcG9pbnQgbWF0Y2hlcyBhIHN0YXJ0IHBvaW50XG4gICAgICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICB4OiB4bWluLFxuICAgICAgICB5OiB5bWluLFxuICAgICAgICB3aWR0aDogeG1heC14bWluLFxuICAgICAgICBoZWlnaHQ6IHltYXgteW1pblxuICAgICAgICB9O1xuICAgIH07XG5cbi8vIFJldHVybiB3aGV0aGVyIGEgcG9pbnQgaXMgaW5zaWRlLCBvbiwgb3Igb3V0c2lkZSB0aGUgY2VsbDpcbi8vICAgLTE6IHBvaW50IGlzIG91dHNpZGUgdGhlIHBlcmltZXRlciBvZiB0aGUgY2VsbFxuLy8gICAgMDogcG9pbnQgaXMgb24gdGhlIHBlcmltZXRlciBvZiB0aGUgY2VsbFxuLy8gICAgMTogcG9pbnQgaXMgaW5zaWRlIHRoZSBwZXJpbWV0ZXIgb2YgdGhlIGNlbGxcbi8vXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsLnByb3RvdHlwZS5wb2ludEludGVyc2VjdGlvbiA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAvLyBDaGVjayBpZiBwb2ludCBpbiBwb2x5Z29uLiBTaW5jZSBhbGwgcG9seWdvbnMgb2YgYSBWb3Jvbm9pXG4gICAgLy8gZGlhZ3JhbSBhcmUgY29udmV4LCB0aGVuOlxuICAgIC8vIGh0dHA6Ly9wYXVsYm91cmtlLm5ldC9nZW9tZXRyeS9wb2x5Z29ubWVzaC9cbiAgICAvLyBTb2x1dGlvbiAzICgyRCk6XG4gICAgLy8gICBcIklmIHRoZSBwb2x5Z29uIGlzIGNvbnZleCB0aGVuIG9uZSBjYW4gY29uc2lkZXIgdGhlIHBvbHlnb25cbiAgICAvLyAgIFwiYXMgYSAncGF0aCcgZnJvbSB0aGUgZmlyc3QgdmVydGV4LiBBIHBvaW50IGlzIG9uIHRoZSBpbnRlcmlvclxuICAgIC8vICAgXCJvZiB0aGlzIHBvbHlnb25zIGlmIGl0IGlzIGFsd2F5cyBvbiB0aGUgc2FtZSBzaWRlIG9mIGFsbCB0aGVcbiAgICAvLyAgIFwibGluZSBzZWdtZW50cyBtYWtpbmcgdXAgdGhlIHBhdGguIC4uLlxuICAgIC8vICAgXCIoeSAtIHkwKSAoeDEgLSB4MCkgLSAoeCAtIHgwKSAoeTEgLSB5MClcbiAgICAvLyAgIFwiaWYgaXQgaXMgbGVzcyB0aGFuIDAgdGhlbiBQIGlzIHRvIHRoZSByaWdodCBvZiB0aGUgbGluZSBzZWdtZW50LFxuICAgIC8vICAgXCJpZiBncmVhdGVyIHRoYW4gMCBpdCBpcyB0byB0aGUgbGVmdCwgaWYgZXF1YWwgdG8gMCB0aGVuIGl0IGxpZXNcbiAgICAvLyAgIFwib24gdGhlIGxpbmUgc2VnbWVudFwiXG4gICAgdmFyIGhhbGZlZGdlcyA9IHRoaXMuaGFsZmVkZ2VzLFxuICAgICAgICBpSGFsZmVkZ2UgPSBoYWxmZWRnZXMubGVuZ3RoLFxuICAgICAgICBoYWxmZWRnZSxcbiAgICAgICAgcDAsIHAxLCByO1xuICAgIHdoaWxlIChpSGFsZmVkZ2UtLSkge1xuICAgICAgICBoYWxmZWRnZSA9IGhhbGZlZGdlc1tpSGFsZmVkZ2VdO1xuICAgICAgICBwMCA9IGhhbGZlZGdlLmdldFN0YXJ0cG9pbnQoKTtcbiAgICAgICAgcDEgPSBoYWxmZWRnZS5nZXRFbmRwb2ludCgpO1xuICAgICAgICByID0gKHktcDAueSkqKHAxLngtcDAueCktKHgtcDAueCkqKHAxLnktcDAueSk7XG4gICAgICAgIGlmICghcikge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIGlmIChyID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgcmV0dXJuIDE7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBFZGdlIG1ldGhvZHNcbi8vXG5cblZvcm9ub2kucHJvdG90eXBlLlZlcnRleCA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICB0aGlzLnggPSB4O1xuICAgIHRoaXMueSA9IHk7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuRWRnZSA9IGZ1bmN0aW9uKGxTaXRlLCByU2l0ZSkge1xuICAgIHRoaXMubFNpdGUgPSBsU2l0ZTtcbiAgICB0aGlzLnJTaXRlID0gclNpdGU7XG4gICAgdGhpcy52YSA9IHRoaXMudmIgPSBudWxsO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLkhhbGZlZGdlID0gZnVuY3Rpb24oZWRnZSwgbFNpdGUsIHJTaXRlKSB7XG4gICAgdGhpcy5zaXRlID0gbFNpdGU7XG4gICAgdGhpcy5lZGdlID0gZWRnZTtcbiAgICAvLyAnYW5nbGUnIGlzIGEgdmFsdWUgdG8gYmUgdXNlZCBmb3IgcHJvcGVybHkgc29ydGluZyB0aGVcbiAgICAvLyBoYWxmc2VnbWVudHMgY291bnRlcmNsb2Nrd2lzZS4gQnkgY29udmVudGlvbiwgd2Ugd2lsbFxuICAgIC8vIHVzZSB0aGUgYW5nbGUgb2YgdGhlIGxpbmUgZGVmaW5lZCBieSB0aGUgJ3NpdGUgdG8gdGhlIGxlZnQnXG4gICAgLy8gdG8gdGhlICdzaXRlIHRvIHRoZSByaWdodCcuXG4gICAgLy8gSG93ZXZlciwgYm9yZGVyIGVkZ2VzIGhhdmUgbm8gJ3NpdGUgdG8gdGhlIHJpZ2h0JzogdGh1cyB3ZVxuICAgIC8vIHVzZSB0aGUgYW5nbGUgb2YgbGluZSBwZXJwZW5kaWN1bGFyIHRvIHRoZSBoYWxmc2VnbWVudCAodGhlXG4gICAgLy8gZWRnZSBzaG91bGQgaGF2ZSBib3RoIGVuZCBwb2ludHMgZGVmaW5lZCBpbiBzdWNoIGNhc2UuKVxuICAgIGlmIChyU2l0ZSkge1xuICAgICAgICB0aGlzLmFuZ2xlID0gTWF0aC5hdGFuMihyU2l0ZS55LWxTaXRlLnksIHJTaXRlLngtbFNpdGUueCk7XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIHZhID0gZWRnZS52YSxcbiAgICAgICAgICAgIHZiID0gZWRnZS52YjtcbiAgICAgICAgLy8gcmhpbGwgMjAxMS0wNS0zMTogdXNlZCB0byBjYWxsIGdldFN0YXJ0cG9pbnQoKS9nZXRFbmRwb2ludCgpLFxuICAgICAgICAvLyBidXQgZm9yIHBlcmZvcm1hbmNlIHB1cnBvc2UsIHRoZXNlIGFyZSBleHBhbmRlZCBpbiBwbGFjZSBoZXJlLlxuICAgICAgICB0aGlzLmFuZ2xlID0gZWRnZS5sU2l0ZSA9PT0gbFNpdGUgP1xuICAgICAgICAgICAgTWF0aC5hdGFuMih2Yi54LXZhLngsIHZhLnktdmIueSkgOlxuICAgICAgICAgICAgTWF0aC5hdGFuMih2YS54LXZiLngsIHZiLnktdmEueSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jcmVhdGVIYWxmZWRnZSA9IGZ1bmN0aW9uKGVkZ2UsIGxTaXRlLCByU2l0ZSkge1xuICAgIHJldHVybiBuZXcgdGhpcy5IYWxmZWRnZShlZGdlLCBsU2l0ZSwgclNpdGUpO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLkhhbGZlZGdlLnByb3RvdHlwZS5nZXRTdGFydHBvaW50ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZWRnZS5sU2l0ZSA9PT0gdGhpcy5zaXRlID8gdGhpcy5lZGdlLnZhIDogdGhpcy5lZGdlLnZiO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLkhhbGZlZGdlLnByb3RvdHlwZS5nZXRFbmRwb2ludCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmVkZ2UubFNpdGUgPT09IHRoaXMuc2l0ZSA/IHRoaXMuZWRnZS52YiA6IHRoaXMuZWRnZS52YTtcbiAgICB9O1xuXG5cblxuLy8gdGhpcyBjcmVhdGUgYW5kIGFkZCBhIHZlcnRleCB0byB0aGUgaW50ZXJuYWwgY29sbGVjdGlvblxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jcmVhdGVWZXJ0ZXggPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgdmFyIHYgPSB0aGlzLnZlcnRleEp1bmt5YXJkLnBvcCgpO1xuICAgIGlmICggIXYgKSB7XG4gICAgICAgIHYgPSBuZXcgdGhpcy5WZXJ0ZXgoeCwgeSk7XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdi54ID0geDtcbiAgICAgICAgdi55ID0geTtcbiAgICAgICAgfVxuICAgIHRoaXMudmVydGljZXMucHVzaCh2KTtcbiAgICByZXR1cm4gdjtcbiAgICB9O1xuXG4vLyB0aGlzIGNyZWF0ZSBhbmQgYWRkIGFuIGVkZ2UgdG8gaW50ZXJuYWwgY29sbGVjdGlvbiwgYW5kIGFsc28gY3JlYXRlXG4vLyB0d28gaGFsZmVkZ2VzIHdoaWNoIGFyZSBhZGRlZCB0byBlYWNoIHNpdGUncyBjb3VudGVyY2xvY2t3aXNlIGFycmF5XG4vLyBvZiBoYWxmZWRnZXMuXG5cblZvcm9ub2kucHJvdG90eXBlLmNyZWF0ZUVkZ2UgPSBmdW5jdGlvbihsU2l0ZSwgclNpdGUsIHZhLCB2Yikge1xuICAgIHZhciBlZGdlID0gdGhpcy5lZGdlSnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCAhZWRnZSApIHtcbiAgICAgICAgZWRnZSA9IG5ldyB0aGlzLkVkZ2UobFNpdGUsIHJTaXRlKTtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBlZGdlLmxTaXRlID0gbFNpdGU7XG4gICAgICAgIGVkZ2UuclNpdGUgPSByU2l0ZTtcbiAgICAgICAgZWRnZS52YSA9IGVkZ2UudmIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICB0aGlzLmVkZ2VzLnB1c2goZWRnZSk7XG4gICAgaWYgKHZhKSB7XG4gICAgICAgIHRoaXMuc2V0RWRnZVN0YXJ0cG9pbnQoZWRnZSwgbFNpdGUsIHJTaXRlLCB2YSk7XG4gICAgICAgIH1cbiAgICBpZiAodmIpIHtcbiAgICAgICAgdGhpcy5zZXRFZGdlRW5kcG9pbnQoZWRnZSwgbFNpdGUsIHJTaXRlLCB2Yik7XG4gICAgICAgIH1cbiAgICB0aGlzLmNlbGxzW2xTaXRlLnZvcm9ub2lJZF0uaGFsZmVkZ2VzLnB1c2godGhpcy5jcmVhdGVIYWxmZWRnZShlZGdlLCBsU2l0ZSwgclNpdGUpKTtcbiAgICB0aGlzLmNlbGxzW3JTaXRlLnZvcm9ub2lJZF0uaGFsZmVkZ2VzLnB1c2godGhpcy5jcmVhdGVIYWxmZWRnZShlZGdlLCByU2l0ZSwgbFNpdGUpKTtcbiAgICByZXR1cm4gZWRnZTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jcmVhdGVCb3JkZXJFZGdlID0gZnVuY3Rpb24obFNpdGUsIHZhLCB2Yikge1xuICAgIHZhciBlZGdlID0gdGhpcy5lZGdlSnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCAhZWRnZSApIHtcbiAgICAgICAgZWRnZSA9IG5ldyB0aGlzLkVkZ2UobFNpdGUsIG51bGwpO1xuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGVkZ2UubFNpdGUgPSBsU2l0ZTtcbiAgICAgICAgZWRnZS5yU2l0ZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICBlZGdlLnZhID0gdmE7XG4gICAgZWRnZS52YiA9IHZiO1xuICAgIHRoaXMuZWRnZXMucHVzaChlZGdlKTtcbiAgICByZXR1cm4gZWRnZTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5zZXRFZGdlU3RhcnRwb2ludCA9IGZ1bmN0aW9uKGVkZ2UsIGxTaXRlLCByU2l0ZSwgdmVydGV4KSB7XG4gICAgaWYgKCFlZGdlLnZhICYmICFlZGdlLnZiKSB7XG4gICAgICAgIGVkZ2UudmEgPSB2ZXJ0ZXg7XG4gICAgICAgIGVkZ2UubFNpdGUgPSBsU2l0ZTtcbiAgICAgICAgZWRnZS5yU2l0ZSA9IHJTaXRlO1xuICAgICAgICB9XG4gICAgZWxzZSBpZiAoZWRnZS5sU2l0ZSA9PT0gclNpdGUpIHtcbiAgICAgICAgZWRnZS52YiA9IHZlcnRleDtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBlZGdlLnZhID0gdmVydGV4O1xuICAgICAgICB9XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuc2V0RWRnZUVuZHBvaW50ID0gZnVuY3Rpb24oZWRnZSwgbFNpdGUsIHJTaXRlLCB2ZXJ0ZXgpIHtcbiAgICB0aGlzLnNldEVkZ2VTdGFydHBvaW50KGVkZ2UsIHJTaXRlLCBsU2l0ZSwgdmVydGV4KTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEJlYWNobGluZSBtZXRob2RzXG5cbi8vIHJoaWxsIDIwMTEtMDYtMDc6IEZvciBzb21lIHJlYXNvbnMsIHBlcmZvcm1hbmNlIHN1ZmZlcnMgc2lnbmlmaWNhbnRseVxuLy8gd2hlbiBpbnN0YW5jaWF0aW5nIGEgbGl0ZXJhbCBvYmplY3QgaW5zdGVhZCBvZiBhbiBlbXB0eSBjdG9yXG5Wb3Jvbm9pLnByb3RvdHlwZS5CZWFjaHNlY3Rpb24gPSBmdW5jdGlvbigpIHtcbiAgICB9O1xuXG4vLyByaGlsbCAyMDExLTA2LTAyOiBBIGxvdCBvZiBCZWFjaHNlY3Rpb24gaW5zdGFuY2lhdGlvbnNcbi8vIG9jY3VyIGR1cmluZyB0aGUgY29tcHV0YXRpb24gb2YgdGhlIFZvcm9ub2kgZGlhZ3JhbSxcbi8vIHNvbWV3aGVyZSBiZXR3ZWVuIHRoZSBudW1iZXIgb2Ygc2l0ZXMgYW5kIHR3aWNlIHRoZVxuLy8gbnVtYmVyIG9mIHNpdGVzLCB3aGlsZSB0aGUgbnVtYmVyIG9mIEJlYWNoc2VjdGlvbnMgb24gdGhlXG4vLyBiZWFjaGxpbmUgYXQgYW55IGdpdmVuIHRpbWUgaXMgY29tcGFyYXRpdmVseSBsb3cuIEZvciB0aGlzXG4vLyByZWFzb24sIHdlIHJldXNlIGFscmVhZHkgY3JlYXRlZCBCZWFjaHNlY3Rpb25zLCBpbiBvcmRlclxuLy8gdG8gYXZvaWQgbmV3IG1lbW9yeSBhbGxvY2F0aW9uLiBUaGlzIHJlc3VsdGVkIGluIGEgbWVhc3VyYWJsZVxuLy8gcGVyZm9ybWFuY2UgZ2Fpbi5cblxuVm9yb25vaS5wcm90b3R5cGUuY3JlYXRlQmVhY2hzZWN0aW9uID0gZnVuY3Rpb24oc2l0ZSkge1xuICAgIHZhciBiZWFjaHNlY3Rpb24gPSB0aGlzLmJlYWNoc2VjdGlvbkp1bmt5YXJkLnBvcCgpO1xuICAgIGlmICghYmVhY2hzZWN0aW9uKSB7XG4gICAgICAgIGJlYWNoc2VjdGlvbiA9IG5ldyB0aGlzLkJlYWNoc2VjdGlvbigpO1xuICAgICAgICB9XG4gICAgYmVhY2hzZWN0aW9uLnNpdGUgPSBzaXRlO1xuICAgIHJldHVybiBiZWFjaHNlY3Rpb247XG4gICAgfTtcblxuLy8gY2FsY3VsYXRlIHRoZSBsZWZ0IGJyZWFrIHBvaW50IG9mIGEgcGFydGljdWxhciBiZWFjaCBzZWN0aW9uLFxuLy8gZ2l2ZW4gYSBwYXJ0aWN1bGFyIHN3ZWVwIGxpbmVcblZvcm9ub2kucHJvdG90eXBlLmxlZnRCcmVha1BvaW50ID0gZnVuY3Rpb24oYXJjLCBkaXJlY3RyaXgpIHtcbiAgICAvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1BhcmFib2xhXG4gICAgLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9RdWFkcmF0aWNfZXF1YXRpb25cbiAgICAvLyBoMSA9IHgxLFxuICAgIC8vIGsxID0gKHkxK2RpcmVjdHJpeCkvMixcbiAgICAvLyBoMiA9IHgyLFxuICAgIC8vIGsyID0gKHkyK2RpcmVjdHJpeCkvMixcbiAgICAvLyBwMSA9IGsxLWRpcmVjdHJpeCxcbiAgICAvLyBhMSA9IDEvKDQqcDEpLFxuICAgIC8vIGIxID0gLWgxLygyKnAxKSxcbiAgICAvLyBjMSA9IGgxKmgxLyg0KnAxKStrMSxcbiAgICAvLyBwMiA9IGsyLWRpcmVjdHJpeCxcbiAgICAvLyBhMiA9IDEvKDQqcDIpLFxuICAgIC8vIGIyID0gLWgyLygyKnAyKSxcbiAgICAvLyBjMiA9IGgyKmgyLyg0KnAyKStrMixcbiAgICAvLyB4ID0gKC0oYjItYjEpICsgTWF0aC5zcXJ0KChiMi1iMSkqKGIyLWIxKSAtIDQqKGEyLWExKSooYzItYzEpKSkgLyAoMiooYTItYTEpKVxuICAgIC8vIFdoZW4geDEgYmVjb21lIHRoZSB4LW9yaWdpbjpcbiAgICAvLyBoMSA9IDAsXG4gICAgLy8gazEgPSAoeTErZGlyZWN0cml4KS8yLFxuICAgIC8vIGgyID0geDIteDEsXG4gICAgLy8gazIgPSAoeTIrZGlyZWN0cml4KS8yLFxuICAgIC8vIHAxID0gazEtZGlyZWN0cml4LFxuICAgIC8vIGExID0gMS8oNCpwMSksXG4gICAgLy8gYjEgPSAwLFxuICAgIC8vIGMxID0gazEsXG4gICAgLy8gcDIgPSBrMi1kaXJlY3RyaXgsXG4gICAgLy8gYTIgPSAxLyg0KnAyKSxcbiAgICAvLyBiMiA9IC1oMi8oMipwMiksXG4gICAgLy8gYzIgPSBoMipoMi8oNCpwMikrazIsXG4gICAgLy8geCA9ICgtYjIgKyBNYXRoLnNxcnQoYjIqYjIgLSA0KihhMi1hMSkqKGMyLWsxKSkpIC8gKDIqKGEyLWExKSkgKyB4MVxuXG4gICAgLy8gY2hhbmdlIGNvZGUgYmVsb3cgYXQgeW91ciBvd24gcmlzazogY2FyZSBoYXMgYmVlbiB0YWtlbiB0b1xuICAgIC8vIHJlZHVjZSBlcnJvcnMgZHVlIHRvIGNvbXB1dGVycycgZmluaXRlIGFyaXRobWV0aWMgcHJlY2lzaW9uLlxuICAgIC8vIE1heWJlIGNhbiBzdGlsbCBiZSBpbXByb3ZlZCwgd2lsbCBzZWUgaWYgYW55IG1vcmUgb2YgdGhpc1xuICAgIC8vIGtpbmQgb2YgZXJyb3JzIHBvcCB1cCBhZ2Fpbi5cbiAgICB2YXIgc2l0ZSA9IGFyYy5zaXRlLFxuICAgICAgICByZm9jeCA9IHNpdGUueCxcbiAgICAgICAgcmZvY3kgPSBzaXRlLnksXG4gICAgICAgIHBieTIgPSByZm9jeS1kaXJlY3RyaXg7XG4gICAgLy8gcGFyYWJvbGEgaW4gZGVnZW5lcmF0ZSBjYXNlIHdoZXJlIGZvY3VzIGlzIG9uIGRpcmVjdHJpeFxuICAgIGlmICghcGJ5Mikge1xuICAgICAgICByZXR1cm4gcmZvY3g7XG4gICAgICAgIH1cbiAgICB2YXIgbEFyYyA9IGFyYy5yYlByZXZpb3VzO1xuICAgIGlmICghbEFyYykge1xuICAgICAgICByZXR1cm4gLUluZmluaXR5O1xuICAgICAgICB9XG4gICAgc2l0ZSA9IGxBcmMuc2l0ZTtcbiAgICB2YXIgbGZvY3ggPSBzaXRlLngsXG4gICAgICAgIGxmb2N5ID0gc2l0ZS55LFxuICAgICAgICBwbGJ5MiA9IGxmb2N5LWRpcmVjdHJpeDtcbiAgICAvLyBwYXJhYm9sYSBpbiBkZWdlbmVyYXRlIGNhc2Ugd2hlcmUgZm9jdXMgaXMgb24gZGlyZWN0cml4XG4gICAgaWYgKCFwbGJ5Mikge1xuICAgICAgICByZXR1cm4gbGZvY3g7XG4gICAgICAgIH1cbiAgICB2YXIgaGwgPSBsZm9jeC1yZm9jeCxcbiAgICAgICAgYWJ5MiA9IDEvcGJ5Mi0xL3BsYnkyLFxuICAgICAgICBiID0gaGwvcGxieTI7XG4gICAgaWYgKGFieTIpIHtcbiAgICAgICAgcmV0dXJuICgtYit0aGlzLnNxcnQoYipiLTIqYWJ5MiooaGwqaGwvKC0yKnBsYnkyKS1sZm9jeStwbGJ5Mi8yK3Jmb2N5LXBieTIvMikpKS9hYnkyK3Jmb2N4O1xuICAgICAgICB9XG4gICAgLy8gYm90aCBwYXJhYm9sYXMgaGF2ZSBzYW1lIGRpc3RhbmNlIHRvIGRpcmVjdHJpeCwgdGh1cyBicmVhayBwb2ludCBpcyBtaWR3YXlcbiAgICByZXR1cm4gKHJmb2N4K2xmb2N4KS8yO1xuICAgIH07XG5cbi8vIGNhbGN1bGF0ZSB0aGUgcmlnaHQgYnJlYWsgcG9pbnQgb2YgYSBwYXJ0aWN1bGFyIGJlYWNoIHNlY3Rpb24sXG4vLyBnaXZlbiBhIHBhcnRpY3VsYXIgZGlyZWN0cml4XG5Wb3Jvbm9pLnByb3RvdHlwZS5yaWdodEJyZWFrUG9pbnQgPSBmdW5jdGlvbihhcmMsIGRpcmVjdHJpeCkge1xuICAgIHZhciByQXJjID0gYXJjLnJiTmV4dDtcbiAgICBpZiAockFyYykge1xuICAgICAgICByZXR1cm4gdGhpcy5sZWZ0QnJlYWtQb2ludChyQXJjLCBkaXJlY3RyaXgpO1xuICAgICAgICB9XG4gICAgdmFyIHNpdGUgPSBhcmMuc2l0ZTtcbiAgICByZXR1cm4gc2l0ZS55ID09PSBkaXJlY3RyaXggPyBzaXRlLnggOiBJbmZpbml0eTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5kZXRhY2hCZWFjaHNlY3Rpb24gPSBmdW5jdGlvbihiZWFjaHNlY3Rpb24pIHtcbiAgICB0aGlzLmRldGFjaENpcmNsZUV2ZW50KGJlYWNoc2VjdGlvbik7IC8vIGRldGFjaCBwb3RlbnRpYWxseSBhdHRhY2hlZCBjaXJjbGUgZXZlbnRcbiAgICB0aGlzLmJlYWNobGluZS5yYlJlbW92ZU5vZGUoYmVhY2hzZWN0aW9uKTsgLy8gcmVtb3ZlIGZyb20gUkItdHJlZVxuICAgIHRoaXMuYmVhY2hzZWN0aW9uSnVua3lhcmQucHVzaChiZWFjaHNlY3Rpb24pOyAvLyBtYXJrIGZvciByZXVzZVxuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLnJlbW92ZUJlYWNoc2VjdGlvbiA9IGZ1bmN0aW9uKGJlYWNoc2VjdGlvbikge1xuICAgIHZhciBjaXJjbGUgPSBiZWFjaHNlY3Rpb24uY2lyY2xlRXZlbnQsXG4gICAgICAgIHggPSBjaXJjbGUueCxcbiAgICAgICAgeSA9IGNpcmNsZS55Y2VudGVyLFxuICAgICAgICB2ZXJ0ZXggPSB0aGlzLmNyZWF0ZVZlcnRleCh4LCB5KSxcbiAgICAgICAgcHJldmlvdXMgPSBiZWFjaHNlY3Rpb24ucmJQcmV2aW91cyxcbiAgICAgICAgbmV4dCA9IGJlYWNoc2VjdGlvbi5yYk5leHQsXG4gICAgICAgIGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zID0gW2JlYWNoc2VjdGlvbl0sXG4gICAgICAgIGFic19mbiA9IE1hdGguYWJzO1xuXG4gICAgLy8gcmVtb3ZlIGNvbGxhcHNlZCBiZWFjaHNlY3Rpb24gZnJvbSBiZWFjaGxpbmVcbiAgICB0aGlzLmRldGFjaEJlYWNoc2VjdGlvbihiZWFjaHNlY3Rpb24pO1xuXG4gICAgLy8gdGhlcmUgY291bGQgYmUgbW9yZSB0aGFuIG9uZSBlbXB0eSBhcmMgYXQgdGhlIGRlbGV0aW9uIHBvaW50LCB0aGlzXG4gICAgLy8gaGFwcGVucyB3aGVuIG1vcmUgdGhhbiB0d28gZWRnZXMgYXJlIGxpbmtlZCBieSB0aGUgc2FtZSB2ZXJ0ZXgsXG4gICAgLy8gc28gd2Ugd2lsbCBjb2xsZWN0IGFsbCB0aG9zZSBlZGdlcyBieSBsb29raW5nIHVwIGJvdGggc2lkZXMgb2ZcbiAgICAvLyB0aGUgZGVsZXRpb24gcG9pbnQuXG4gICAgLy8gYnkgdGhlIHdheSwgdGhlcmUgaXMgKmFsd2F5cyogYSBwcmVkZWNlc3Nvci9zdWNjZXNzb3IgdG8gYW55IGNvbGxhcHNlZFxuICAgIC8vIGJlYWNoIHNlY3Rpb24sIGl0J3MganVzdCBpbXBvc3NpYmxlIHRvIGhhdmUgYSBjb2xsYXBzaW5nIGZpcnN0L2xhc3RcbiAgICAvLyBiZWFjaCBzZWN0aW9ucyBvbiB0aGUgYmVhY2hsaW5lLCBzaW5jZSB0aGV5IG9idmlvdXNseSBhcmUgdW5jb25zdHJhaW5lZFxuICAgIC8vIG9uIHRoZWlyIGxlZnQvcmlnaHQgc2lkZS5cblxuICAgIC8vIGxvb2sgbGVmdFxuICAgIHZhciBsQXJjID0gcHJldmlvdXM7XG4gICAgd2hpbGUgKGxBcmMuY2lyY2xlRXZlbnQgJiYgYWJzX2ZuKHgtbEFyYy5jaXJjbGVFdmVudC54KTwxZS05ICYmIGFic19mbih5LWxBcmMuY2lyY2xlRXZlbnQueWNlbnRlcik8MWUtOSkge1xuICAgICAgICBwcmV2aW91cyA9IGxBcmMucmJQcmV2aW91cztcbiAgICAgICAgZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnMudW5zaGlmdChsQXJjKTtcbiAgICAgICAgdGhpcy5kZXRhY2hCZWFjaHNlY3Rpb24obEFyYyk7IC8vIG1hcmsgZm9yIHJldXNlXG4gICAgICAgIGxBcmMgPSBwcmV2aW91cztcbiAgICAgICAgfVxuICAgIC8vIGV2ZW4gdGhvdWdoIGl0IGlzIG5vdCBkaXNhcHBlYXJpbmcsIEkgd2lsbCBhbHNvIGFkZCB0aGUgYmVhY2ggc2VjdGlvblxuICAgIC8vIGltbWVkaWF0ZWx5IHRvIHRoZSBsZWZ0IG9mIHRoZSBsZWZ0LW1vc3QgY29sbGFwc2VkIGJlYWNoIHNlY3Rpb24sIGZvclxuICAgIC8vIGNvbnZlbmllbmNlLCBzaW5jZSB3ZSBuZWVkIHRvIHJlZmVyIHRvIGl0IGxhdGVyIGFzIHRoaXMgYmVhY2ggc2VjdGlvblxuICAgIC8vIGlzIHRoZSAnbGVmdCcgc2l0ZSBvZiBhbiBlZGdlIGZvciB3aGljaCBhIHN0YXJ0IHBvaW50IGlzIHNldC5cbiAgICBkaXNhcHBlYXJpbmdUcmFuc2l0aW9ucy51bnNoaWZ0KGxBcmMpO1xuICAgIHRoaXMuZGV0YWNoQ2lyY2xlRXZlbnQobEFyYyk7XG5cbiAgICAvLyBsb29rIHJpZ2h0XG4gICAgdmFyIHJBcmMgPSBuZXh0O1xuICAgIHdoaWxlIChyQXJjLmNpcmNsZUV2ZW50ICYmIGFic19mbih4LXJBcmMuY2lyY2xlRXZlbnQueCk8MWUtOSAmJiBhYnNfZm4oeS1yQXJjLmNpcmNsZUV2ZW50LnljZW50ZXIpPDFlLTkpIHtcbiAgICAgICAgbmV4dCA9IHJBcmMucmJOZXh0O1xuICAgICAgICBkaXNhcHBlYXJpbmdUcmFuc2l0aW9ucy5wdXNoKHJBcmMpO1xuICAgICAgICB0aGlzLmRldGFjaEJlYWNoc2VjdGlvbihyQXJjKTsgLy8gbWFyayBmb3IgcmV1c2VcbiAgICAgICAgckFyYyA9IG5leHQ7XG4gICAgICAgIH1cbiAgICAvLyB3ZSBhbHNvIGhhdmUgdG8gYWRkIHRoZSBiZWFjaCBzZWN0aW9uIGltbWVkaWF0ZWx5IHRvIHRoZSByaWdodCBvZiB0aGVcbiAgICAvLyByaWdodC1tb3N0IGNvbGxhcHNlZCBiZWFjaCBzZWN0aW9uLCBzaW5jZSB0aGVyZSBpcyBhbHNvIGEgZGlzYXBwZWFyaW5nXG4gICAgLy8gdHJhbnNpdGlvbiByZXByZXNlbnRpbmcgYW4gZWRnZSdzIHN0YXJ0IHBvaW50IG9uIGl0cyBsZWZ0LlxuICAgIGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zLnB1c2gockFyYyk7XG4gICAgdGhpcy5kZXRhY2hDaXJjbGVFdmVudChyQXJjKTtcblxuICAgIC8vIHdhbGsgdGhyb3VnaCBhbGwgdGhlIGRpc2FwcGVhcmluZyB0cmFuc2l0aW9ucyBiZXR3ZWVuIGJlYWNoIHNlY3Rpb25zIGFuZFxuICAgIC8vIHNldCB0aGUgc3RhcnQgcG9pbnQgb2YgdGhlaXIgKGltcGxpZWQpIGVkZ2UuXG4gICAgdmFyIG5BcmNzID0gZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnMubGVuZ3RoLFxuICAgICAgICBpQXJjO1xuICAgIGZvciAoaUFyYz0xOyBpQXJjPG5BcmNzOyBpQXJjKyspIHtcbiAgICAgICAgckFyYyA9IGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zW2lBcmNdO1xuICAgICAgICBsQXJjID0gZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnNbaUFyYy0xXTtcbiAgICAgICAgdGhpcy5zZXRFZGdlU3RhcnRwb2ludChyQXJjLmVkZ2UsIGxBcmMuc2l0ZSwgckFyYy5zaXRlLCB2ZXJ0ZXgpO1xuICAgICAgICB9XG5cbiAgICAvLyBjcmVhdGUgYSBuZXcgZWRnZSBhcyB3ZSBoYXZlIG5vdyBhIG5ldyB0cmFuc2l0aW9uIGJldHdlZW5cbiAgICAvLyB0d28gYmVhY2ggc2VjdGlvbnMgd2hpY2ggd2VyZSBwcmV2aW91c2x5IG5vdCBhZGphY2VudC5cbiAgICAvLyBzaW5jZSB0aGlzIGVkZ2UgYXBwZWFycyBhcyBhIG5ldyB2ZXJ0ZXggaXMgZGVmaW5lZCwgdGhlIHZlcnRleFxuICAgIC8vIGFjdHVhbGx5IGRlZmluZSBhbiBlbmQgcG9pbnQgb2YgdGhlIGVkZ2UgKHJlbGF0aXZlIHRvIHRoZSBzaXRlXG4gICAgLy8gb24gdGhlIGxlZnQpXG4gICAgbEFyYyA9IGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zWzBdO1xuICAgIHJBcmMgPSBkaXNhcHBlYXJpbmdUcmFuc2l0aW9uc1tuQXJjcy0xXTtcbiAgICByQXJjLmVkZ2UgPSB0aGlzLmNyZWF0ZUVkZ2UobEFyYy5zaXRlLCByQXJjLnNpdGUsIHVuZGVmaW5lZCwgdmVydGV4KTtcblxuICAgIC8vIGNyZWF0ZSBjaXJjbGUgZXZlbnRzIGlmIGFueSBmb3IgYmVhY2ggc2VjdGlvbnMgbGVmdCBpbiB0aGUgYmVhY2hsaW5lXG4gICAgLy8gYWRqYWNlbnQgdG8gY29sbGFwc2VkIHNlY3Rpb25zXG4gICAgdGhpcy5hdHRhY2hDaXJjbGVFdmVudChsQXJjKTtcbiAgICB0aGlzLmF0dGFjaENpcmNsZUV2ZW50KHJBcmMpO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmFkZEJlYWNoc2VjdGlvbiA9IGZ1bmN0aW9uKHNpdGUpIHtcbiAgICB2YXIgeCA9IHNpdGUueCxcbiAgICAgICAgZGlyZWN0cml4ID0gc2l0ZS55O1xuXG4gICAgLy8gZmluZCB0aGUgbGVmdCBhbmQgcmlnaHQgYmVhY2ggc2VjdGlvbnMgd2hpY2ggd2lsbCBzdXJyb3VuZCB0aGUgbmV3bHlcbiAgICAvLyBjcmVhdGVkIGJlYWNoIHNlY3Rpb24uXG4gICAgLy8gcmhpbGwgMjAxMS0wNi0wMTogVGhpcyBsb29wIGlzIG9uZSBvZiB0aGUgbW9zdCBvZnRlbiBleGVjdXRlZCxcbiAgICAvLyBoZW5jZSB3ZSBleHBhbmQgaW4tcGxhY2UgdGhlIGNvbXBhcmlzb24tYWdhaW5zdC1lcHNpbG9uIGNhbGxzLlxuICAgIHZhciBsQXJjLCByQXJjLFxuICAgICAgICBkeGwsIGR4cixcbiAgICAgICAgbm9kZSA9IHRoaXMuYmVhY2hsaW5lLnJvb3Q7XG5cbiAgICB3aGlsZSAobm9kZSkge1xuICAgICAgICBkeGwgPSB0aGlzLmxlZnRCcmVha1BvaW50KG5vZGUsZGlyZWN0cml4KS14O1xuICAgICAgICAvLyB4IGxlc3NUaGFuV2l0aEVwc2lsb24geGwgPT4gZmFsbHMgc29tZXdoZXJlIGJlZm9yZSB0aGUgbGVmdCBlZGdlIG9mIHRoZSBiZWFjaHNlY3Rpb25cbiAgICAgICAgaWYgKGR4bCA+IDFlLTkpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgY2FzZSBzaG91bGQgbmV2ZXIgaGFwcGVuXG4gICAgICAgICAgICAvLyBpZiAoIW5vZGUucmJMZWZ0KSB7XG4gICAgICAgICAgICAvLyAgICByQXJjID0gbm9kZS5yYkxlZnQ7XG4gICAgICAgICAgICAvLyAgICBicmVhaztcbiAgICAgICAgICAgIC8vICAgIH1cbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnJiTGVmdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkeHIgPSB4LXRoaXMucmlnaHRCcmVha1BvaW50KG5vZGUsZGlyZWN0cml4KTtcbiAgICAgICAgICAgIC8vIHggZ3JlYXRlclRoYW5XaXRoRXBzaWxvbiB4ciA9PiBmYWxscyBzb21ld2hlcmUgYWZ0ZXIgdGhlIHJpZ2h0IGVkZ2Ugb2YgdGhlIGJlYWNoc2VjdGlvblxuICAgICAgICAgICAgaWYgKGR4ciA+IDFlLTkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGUucmJSaWdodCkge1xuICAgICAgICAgICAgICAgICAgICBsQXJjID0gbm9kZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5yYlJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHggZXF1YWxXaXRoRXBzaWxvbiB4bCA9PiBmYWxscyBleGFjdGx5IG9uIHRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIGJlYWNoc2VjdGlvblxuICAgICAgICAgICAgICAgIGlmIChkeGwgPiAtMWUtOSkge1xuICAgICAgICAgICAgICAgICAgICBsQXJjID0gbm9kZS5yYlByZXZpb3VzO1xuICAgICAgICAgICAgICAgICAgICByQXJjID0gbm9kZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIHggZXF1YWxXaXRoRXBzaWxvbiB4ciA9PiBmYWxscyBleGFjdGx5IG9uIHRoZSByaWdodCBlZGdlIG9mIHRoZSBiZWFjaHNlY3Rpb25cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChkeHIgPiAtMWUtOSkge1xuICAgICAgICAgICAgICAgICAgICBsQXJjID0gbm9kZTtcbiAgICAgICAgICAgICAgICAgICAgckFyYyA9IG5vZGUucmJOZXh0O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gZmFsbHMgZXhhY3RseSBzb21ld2hlcmUgaW4gdGhlIG1pZGRsZSBvZiB0aGUgYmVhY2hzZWN0aW9uXG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxBcmMgPSByQXJjID0gbm9kZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIC8vIGF0IHRoaXMgcG9pbnQsIGtlZXAgaW4gbWluZCB0aGF0IGxBcmMgYW5kL29yIHJBcmMgY291bGQgYmVcbiAgICAvLyB1bmRlZmluZWQgb3IgbnVsbC5cblxuICAgIC8vIGNyZWF0ZSBhIG5ldyBiZWFjaCBzZWN0aW9uIG9iamVjdCBmb3IgdGhlIHNpdGUgYW5kIGFkZCBpdCB0byBSQi10cmVlXG4gICAgdmFyIG5ld0FyYyA9IHRoaXMuY3JlYXRlQmVhY2hzZWN0aW9uKHNpdGUpO1xuICAgIHRoaXMuYmVhY2hsaW5lLnJiSW5zZXJ0U3VjY2Vzc29yKGxBcmMsIG5ld0FyYyk7XG5cbiAgICAvLyBjYXNlczpcbiAgICAvL1xuXG4gICAgLy8gW251bGwsbnVsbF1cbiAgICAvLyBsZWFzdCBsaWtlbHkgY2FzZTogbmV3IGJlYWNoIHNlY3Rpb24gaXMgdGhlIGZpcnN0IGJlYWNoIHNlY3Rpb24gb24gdGhlXG4gICAgLy8gYmVhY2hsaW5lLlxuICAgIC8vIFRoaXMgY2FzZSBtZWFuczpcbiAgICAvLyAgIG5vIG5ldyB0cmFuc2l0aW9uIGFwcGVhcnNcbiAgICAvLyAgIG5vIGNvbGxhcHNpbmcgYmVhY2ggc2VjdGlvblxuICAgIC8vICAgbmV3IGJlYWNoc2VjdGlvbiBiZWNvbWUgcm9vdCBvZiB0aGUgUkItdHJlZVxuICAgIGlmICghbEFyYyAmJiAhckFyYykge1xuICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgIC8vIFtsQXJjLHJBcmNdIHdoZXJlIGxBcmMgPT0gckFyY1xuICAgIC8vIG1vc3QgbGlrZWx5IGNhc2U6IG5ldyBiZWFjaCBzZWN0aW9uIHNwbGl0IGFuIGV4aXN0aW5nIGJlYWNoXG4gICAgLy8gc2VjdGlvbi5cbiAgICAvLyBUaGlzIGNhc2UgbWVhbnM6XG4gICAgLy8gICBvbmUgbmV3IHRyYW5zaXRpb24gYXBwZWFyc1xuICAgIC8vICAgdGhlIGxlZnQgYW5kIHJpZ2h0IGJlYWNoIHNlY3Rpb24gbWlnaHQgYmUgY29sbGFwc2luZyBhcyBhIHJlc3VsdFxuICAgIC8vICAgdHdvIG5ldyBub2RlcyBhZGRlZCB0byB0aGUgUkItdHJlZVxuICAgIGlmIChsQXJjID09PSByQXJjKSB7XG4gICAgICAgIC8vIGludmFsaWRhdGUgY2lyY2xlIGV2ZW50IG9mIHNwbGl0IGJlYWNoIHNlY3Rpb25cbiAgICAgICAgdGhpcy5kZXRhY2hDaXJjbGVFdmVudChsQXJjKTtcblxuICAgICAgICAvLyBzcGxpdCB0aGUgYmVhY2ggc2VjdGlvbiBpbnRvIHR3byBzZXBhcmF0ZSBiZWFjaCBzZWN0aW9uc1xuICAgICAgICByQXJjID0gdGhpcy5jcmVhdGVCZWFjaHNlY3Rpb24obEFyYy5zaXRlKTtcbiAgICAgICAgdGhpcy5iZWFjaGxpbmUucmJJbnNlcnRTdWNjZXNzb3IobmV3QXJjLCByQXJjKTtcblxuICAgICAgICAvLyBzaW5jZSB3ZSBoYXZlIGEgbmV3IHRyYW5zaXRpb24gYmV0d2VlbiB0d28gYmVhY2ggc2VjdGlvbnMsXG4gICAgICAgIC8vIGEgbmV3IGVkZ2UgaXMgYm9yblxuICAgICAgICBuZXdBcmMuZWRnZSA9IHJBcmMuZWRnZSA9IHRoaXMuY3JlYXRlRWRnZShsQXJjLnNpdGUsIG5ld0FyYy5zaXRlKTtcblxuICAgICAgICAvLyBjaGVjayB3aGV0aGVyIHRoZSBsZWZ0IGFuZCByaWdodCBiZWFjaCBzZWN0aW9ucyBhcmUgY29sbGFwc2luZ1xuICAgICAgICAvLyBhbmQgaWYgc28gY3JlYXRlIGNpcmNsZSBldmVudHMsIHRvIGJlIG5vdGlmaWVkIHdoZW4gdGhlIHBvaW50IG9mXG4gICAgICAgIC8vIGNvbGxhcHNlIGlzIHJlYWNoZWQuXG4gICAgICAgIHRoaXMuYXR0YWNoQ2lyY2xlRXZlbnQobEFyYyk7XG4gICAgICAgIHRoaXMuYXR0YWNoQ2lyY2xlRXZlbnQockFyYyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgLy8gW2xBcmMsbnVsbF1cbiAgICAvLyBldmVuIGxlc3MgbGlrZWx5IGNhc2U6IG5ldyBiZWFjaCBzZWN0aW9uIGlzIHRoZSAqbGFzdCogYmVhY2ggc2VjdGlvblxuICAgIC8vIG9uIHRoZSBiZWFjaGxpbmUgLS0gdGhpcyBjYW4gaGFwcGVuICpvbmx5KiBpZiAqYWxsKiB0aGUgcHJldmlvdXMgYmVhY2hcbiAgICAvLyBzZWN0aW9ucyBjdXJyZW50bHkgb24gdGhlIGJlYWNobGluZSBzaGFyZSB0aGUgc2FtZSB5IHZhbHVlIGFzXG4gICAgLy8gdGhlIG5ldyBiZWFjaCBzZWN0aW9uLlxuICAgIC8vIFRoaXMgY2FzZSBtZWFuczpcbiAgICAvLyAgIG9uZSBuZXcgdHJhbnNpdGlvbiBhcHBlYXJzXG4gICAgLy8gICBubyBjb2xsYXBzaW5nIGJlYWNoIHNlY3Rpb24gYXMgYSByZXN1bHRcbiAgICAvLyAgIG5ldyBiZWFjaCBzZWN0aW9uIGJlY29tZSByaWdodC1tb3N0IG5vZGUgb2YgdGhlIFJCLXRyZWVcbiAgICBpZiAobEFyYyAmJiAhckFyYykge1xuICAgICAgICBuZXdBcmMuZWRnZSA9IHRoaXMuY3JlYXRlRWRnZShsQXJjLnNpdGUsbmV3QXJjLnNpdGUpO1xuICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgIC8vIFtudWxsLHJBcmNdXG4gICAgLy8gaW1wb3NzaWJsZSBjYXNlOiBiZWNhdXNlIHNpdGVzIGFyZSBzdHJpY3RseSBwcm9jZXNzZWQgZnJvbSB0b3AgdG8gYm90dG9tLFxuICAgIC8vIGFuZCBsZWZ0IHRvIHJpZ2h0LCB3aGljaCBndWFyYW50ZWVzIHRoYXQgdGhlcmUgd2lsbCBhbHdheXMgYmUgYSBiZWFjaCBzZWN0aW9uXG4gICAgLy8gb24gdGhlIGxlZnQgLS0gZXhjZXB0IG9mIGNvdXJzZSB3aGVuIHRoZXJlIGFyZSBubyBiZWFjaCBzZWN0aW9uIGF0IGFsbCBvblxuICAgIC8vIHRoZSBiZWFjaCBsaW5lLCB3aGljaCBjYXNlIHdhcyBoYW5kbGVkIGFib3ZlLlxuICAgIC8vIHJoaWxsIDIwMTEtMDYtMDI6IE5vIHBvaW50IHRlc3RpbmcgaW4gbm9uLWRlYnVnIHZlcnNpb25cbiAgICAvL2lmICghbEFyYyAmJiByQXJjKSB7XG4gICAgLy8gICAgdGhyb3cgXCJWb3Jvbm9pLmFkZEJlYWNoc2VjdGlvbigpOiBXaGF0IGlzIHRoaXMgSSBkb24ndCBldmVuXCI7XG4gICAgLy8gICAgfVxuXG4gICAgLy8gW2xBcmMsckFyY10gd2hlcmUgbEFyYyAhPSByQXJjXG4gICAgLy8gc29tZXdoYXQgbGVzcyBsaWtlbHkgY2FzZTogbmV3IGJlYWNoIHNlY3Rpb24gZmFsbHMgKmV4YWN0bHkqIGluIGJldHdlZW4gdHdvXG4gICAgLy8gZXhpc3RpbmcgYmVhY2ggc2VjdGlvbnNcbiAgICAvLyBUaGlzIGNhc2UgbWVhbnM6XG4gICAgLy8gICBvbmUgdHJhbnNpdGlvbiBkaXNhcHBlYXJzXG4gICAgLy8gICB0d28gbmV3IHRyYW5zaXRpb25zIGFwcGVhclxuICAgIC8vICAgdGhlIGxlZnQgYW5kIHJpZ2h0IGJlYWNoIHNlY3Rpb24gbWlnaHQgYmUgY29sbGFwc2luZyBhcyBhIHJlc3VsdFxuICAgIC8vICAgb25seSBvbmUgbmV3IG5vZGUgYWRkZWQgdG8gdGhlIFJCLXRyZWVcbiAgICBpZiAobEFyYyAhPT0gckFyYykge1xuICAgICAgICAvLyBpbnZhbGlkYXRlIGNpcmNsZSBldmVudHMgb2YgbGVmdCBhbmQgcmlnaHQgc2l0ZXNcbiAgICAgICAgdGhpcy5kZXRhY2hDaXJjbGVFdmVudChsQXJjKTtcbiAgICAgICAgdGhpcy5kZXRhY2hDaXJjbGVFdmVudChyQXJjKTtcblxuICAgICAgICAvLyBhbiBleGlzdGluZyB0cmFuc2l0aW9uIGRpc2FwcGVhcnMsIG1lYW5pbmcgYSB2ZXJ0ZXggaXMgZGVmaW5lZCBhdFxuICAgICAgICAvLyB0aGUgZGlzYXBwZWFyYW5jZSBwb2ludC5cbiAgICAgICAgLy8gc2luY2UgdGhlIGRpc2FwcGVhcmFuY2UgaXMgY2F1c2VkIGJ5IHRoZSBuZXcgYmVhY2hzZWN0aW9uLCB0aGVcbiAgICAgICAgLy8gdmVydGV4IGlzIGF0IHRoZSBjZW50ZXIgb2YgdGhlIGNpcmN1bXNjcmliZWQgY2lyY2xlIG9mIHRoZSBsZWZ0LFxuICAgICAgICAvLyBuZXcgYW5kIHJpZ2h0IGJlYWNoc2VjdGlvbnMuXG4gICAgICAgIC8vIGh0dHA6Ly9tYXRoZm9ydW0ub3JnL2xpYnJhcnkvZHJtYXRoL3ZpZXcvNTUwMDIuaHRtbFxuICAgICAgICAvLyBFeGNlcHQgdGhhdCBJIGJyaW5nIHRoZSBvcmlnaW4gYXQgQSB0byBzaW1wbGlmeVxuICAgICAgICAvLyBjYWxjdWxhdGlvblxuICAgICAgICB2YXIgbFNpdGUgPSBsQXJjLnNpdGUsXG4gICAgICAgICAgICBheCA9IGxTaXRlLngsXG4gICAgICAgICAgICBheSA9IGxTaXRlLnksXG4gICAgICAgICAgICBieD1zaXRlLngtYXgsXG4gICAgICAgICAgICBieT1zaXRlLnktYXksXG4gICAgICAgICAgICByU2l0ZSA9IHJBcmMuc2l0ZSxcbiAgICAgICAgICAgIGN4PXJTaXRlLngtYXgsXG4gICAgICAgICAgICBjeT1yU2l0ZS55LWF5LFxuICAgICAgICAgICAgZD0yKihieCpjeS1ieSpjeCksXG4gICAgICAgICAgICBoYj1ieCpieCtieSpieSxcbiAgICAgICAgICAgIGhjPWN4KmN4K2N5KmN5LFxuICAgICAgICAgICAgdmVydGV4ID0gdGhpcy5jcmVhdGVWZXJ0ZXgoKGN5KmhiLWJ5KmhjKS9kK2F4LCAoYngqaGMtY3gqaGIpL2QrYXkpO1xuXG4gICAgICAgIC8vIG9uZSB0cmFuc2l0aW9uIGRpc2FwcGVhclxuICAgICAgICB0aGlzLnNldEVkZ2VTdGFydHBvaW50KHJBcmMuZWRnZSwgbFNpdGUsIHJTaXRlLCB2ZXJ0ZXgpO1xuXG4gICAgICAgIC8vIHR3byBuZXcgdHJhbnNpdGlvbnMgYXBwZWFyIGF0IHRoZSBuZXcgdmVydGV4IGxvY2F0aW9uXG4gICAgICAgIG5ld0FyYy5lZGdlID0gdGhpcy5jcmVhdGVFZGdlKGxTaXRlLCBzaXRlLCB1bmRlZmluZWQsIHZlcnRleCk7XG4gICAgICAgIHJBcmMuZWRnZSA9IHRoaXMuY3JlYXRlRWRnZShzaXRlLCByU2l0ZSwgdW5kZWZpbmVkLCB2ZXJ0ZXgpO1xuXG4gICAgICAgIC8vIGNoZWNrIHdoZXRoZXIgdGhlIGxlZnQgYW5kIHJpZ2h0IGJlYWNoIHNlY3Rpb25zIGFyZSBjb2xsYXBzaW5nXG4gICAgICAgIC8vIGFuZCBpZiBzbyBjcmVhdGUgY2lyY2xlIGV2ZW50cywgdG8gaGFuZGxlIHRoZSBwb2ludCBvZiBjb2xsYXBzZS5cbiAgICAgICAgdGhpcy5hdHRhY2hDaXJjbGVFdmVudChsQXJjKTtcbiAgICAgICAgdGhpcy5hdHRhY2hDaXJjbGVFdmVudChyQXJjKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBDaXJjbGUgZXZlbnQgbWV0aG9kc1xuXG4vLyByaGlsbCAyMDExLTA2LTA3OiBGb3Igc29tZSByZWFzb25zLCBwZXJmb3JtYW5jZSBzdWZmZXJzIHNpZ25pZmljYW50bHlcbi8vIHdoZW4gaW5zdGFuY2lhdGluZyBhIGxpdGVyYWwgb2JqZWN0IGluc3RlYWQgb2YgYW4gZW1wdHkgY3RvclxuVm9yb25vaS5wcm90b3R5cGUuQ2lyY2xlRXZlbnQgPSBmdW5jdGlvbigpIHtcbiAgICAvLyByaGlsbCAyMDEzLTEwLTEyOiBpdCBoZWxwcyB0byBzdGF0ZSBleGFjdGx5IHdoYXQgd2UgYXJlIGF0IGN0b3IgdGltZS5cbiAgICB0aGlzLmFyYyA9IG51bGw7XG4gICAgdGhpcy5yYkxlZnQgPSBudWxsO1xuICAgIHRoaXMucmJOZXh0ID0gbnVsbDtcbiAgICB0aGlzLnJiUGFyZW50ID0gbnVsbDtcbiAgICB0aGlzLnJiUHJldmlvdXMgPSBudWxsO1xuICAgIHRoaXMucmJSZWQgPSBmYWxzZTtcbiAgICB0aGlzLnJiUmlnaHQgPSBudWxsO1xuICAgIHRoaXMuc2l0ZSA9IG51bGw7XG4gICAgdGhpcy54ID0gdGhpcy55ID0gdGhpcy55Y2VudGVyID0gMDtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5hdHRhY2hDaXJjbGVFdmVudCA9IGZ1bmN0aW9uKGFyYykge1xuICAgIHZhciBsQXJjID0gYXJjLnJiUHJldmlvdXMsXG4gICAgICAgIHJBcmMgPSBhcmMucmJOZXh0O1xuICAgIGlmICghbEFyYyB8fCAhckFyYykge3JldHVybjt9IC8vIGRvZXMgdGhhdCBldmVyIGhhcHBlbj9cbiAgICB2YXIgbFNpdGUgPSBsQXJjLnNpdGUsXG4gICAgICAgIGNTaXRlID0gYXJjLnNpdGUsXG4gICAgICAgIHJTaXRlID0gckFyYy5zaXRlO1xuXG4gICAgLy8gSWYgc2l0ZSBvZiBsZWZ0IGJlYWNoc2VjdGlvbiBpcyBzYW1lIGFzIHNpdGUgb2ZcbiAgICAvLyByaWdodCBiZWFjaHNlY3Rpb24sIHRoZXJlIGNhbid0IGJlIGNvbnZlcmdlbmNlXG4gICAgaWYgKGxTaXRlPT09clNpdGUpIHtyZXR1cm47fVxuXG4gICAgLy8gRmluZCB0aGUgY2lyY3Vtc2NyaWJlZCBjaXJjbGUgZm9yIHRoZSB0aHJlZSBzaXRlcyBhc3NvY2lhdGVkXG4gICAgLy8gd2l0aCB0aGUgYmVhY2hzZWN0aW9uIHRyaXBsZXQuXG4gICAgLy8gcmhpbGwgMjAxMS0wNS0yNjogSXQgaXMgbW9yZSBlZmZpY2llbnQgdG8gY2FsY3VsYXRlIGluLXBsYWNlXG4gICAgLy8gcmF0aGVyIHRoYW4gZ2V0dGluZyB0aGUgcmVzdWx0aW5nIGNpcmN1bXNjcmliZWQgY2lyY2xlIGZyb20gYW5cbiAgICAvLyBvYmplY3QgcmV0dXJuZWQgYnkgY2FsbGluZyBWb3Jvbm9pLmNpcmN1bWNpcmNsZSgpXG4gICAgLy8gaHR0cDovL21hdGhmb3J1bS5vcmcvbGlicmFyeS9kcm1hdGgvdmlldy81NTAwMi5odG1sXG4gICAgLy8gRXhjZXB0IHRoYXQgSSBicmluZyB0aGUgb3JpZ2luIGF0IGNTaXRlIHRvIHNpbXBsaWZ5IGNhbGN1bGF0aW9ucy5cbiAgICAvLyBUaGUgYm90dG9tLW1vc3QgcGFydCBvZiB0aGUgY2lyY3VtY2lyY2xlIGlzIG91ciBGb3J0dW5lICdjaXJjbGVcbiAgICAvLyBldmVudCcsIGFuZCBpdHMgY2VudGVyIGlzIGEgdmVydGV4IHBvdGVudGlhbGx5IHBhcnQgb2YgdGhlIGZpbmFsXG4gICAgLy8gVm9yb25vaSBkaWFncmFtLlxuICAgIHZhciBieCA9IGNTaXRlLngsXG4gICAgICAgIGJ5ID0gY1NpdGUueSxcbiAgICAgICAgYXggPSBsU2l0ZS54LWJ4LFxuICAgICAgICBheSA9IGxTaXRlLnktYnksXG4gICAgICAgIGN4ID0gclNpdGUueC1ieCxcbiAgICAgICAgY3kgPSByU2l0ZS55LWJ5O1xuXG4gICAgLy8gSWYgcG9pbnRzIGwtPmMtPnIgYXJlIGNsb2Nrd2lzZSwgdGhlbiBjZW50ZXIgYmVhY2ggc2VjdGlvbiBkb2VzIG5vdFxuICAgIC8vIGNvbGxhcHNlLCBoZW5jZSBpdCBjYW4ndCBlbmQgdXAgYXMgYSB2ZXJ0ZXggKHdlIHJldXNlICdkJyBoZXJlLCB3aGljaFxuICAgIC8vIHNpZ24gaXMgcmV2ZXJzZSBvZiB0aGUgb3JpZW50YXRpb24sIGhlbmNlIHdlIHJldmVyc2UgdGhlIHRlc3QuXG4gICAgLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9DdXJ2ZV9vcmllbnRhdGlvbiNPcmllbnRhdGlvbl9vZl9hX3NpbXBsZV9wb2x5Z29uXG4gICAgLy8gcmhpbGwgMjAxMS0wNS0yMTogTmFzdHkgZmluaXRlIHByZWNpc2lvbiBlcnJvciB3aGljaCBjYXVzZWQgY2lyY3VtY2lyY2xlKCkgdG9cbiAgICAvLyByZXR1cm4gaW5maW5pdGVzOiAxZS0xMiBzZWVtcyB0byBmaXggdGhlIHByb2JsZW0uXG4gICAgdmFyIGQgPSAyKihheCpjeS1heSpjeCk7XG4gICAgaWYgKGQgPj0gLTJlLTEyKXtyZXR1cm47fVxuXG4gICAgdmFyIGhhID0gYXgqYXgrYXkqYXksXG4gICAgICAgIGhjID0gY3gqY3grY3kqY3ksXG4gICAgICAgIHggPSAoY3kqaGEtYXkqaGMpL2QsXG4gICAgICAgIHkgPSAoYXgqaGMtY3gqaGEpL2QsXG4gICAgICAgIHljZW50ZXIgPSB5K2J5O1xuXG4gICAgLy8gSW1wb3J0YW50OiB5Ym90dG9tIHNob3VsZCBhbHdheXMgYmUgdW5kZXIgb3IgYXQgc3dlZXAsIHNvIG5vIG5lZWRcbiAgICAvLyB0byB3YXN0ZSBDUFUgY3ljbGVzIGJ5IGNoZWNraW5nXG5cbiAgICAvLyByZWN5Y2xlIGNpcmNsZSBldmVudCBvYmplY3QgaWYgcG9zc2libGVcbiAgICB2YXIgY2lyY2xlRXZlbnQgPSB0aGlzLmNpcmNsZUV2ZW50SnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCFjaXJjbGVFdmVudCkge1xuICAgICAgICBjaXJjbGVFdmVudCA9IG5ldyB0aGlzLkNpcmNsZUV2ZW50KCk7XG4gICAgICAgIH1cbiAgICBjaXJjbGVFdmVudC5hcmMgPSBhcmM7XG4gICAgY2lyY2xlRXZlbnQuc2l0ZSA9IGNTaXRlO1xuICAgIGNpcmNsZUV2ZW50LnggPSB4K2J4O1xuICAgIGNpcmNsZUV2ZW50LnkgPSB5Y2VudGVyK3RoaXMuc3FydCh4KngreSp5KTsgLy8geSBib3R0b21cbiAgICBjaXJjbGVFdmVudC55Y2VudGVyID0geWNlbnRlcjtcbiAgICBhcmMuY2lyY2xlRXZlbnQgPSBjaXJjbGVFdmVudDtcblxuICAgIC8vIGZpbmQgaW5zZXJ0aW9uIHBvaW50IGluIFJCLXRyZWU6IGNpcmNsZSBldmVudHMgYXJlIG9yZGVyZWQgZnJvbVxuICAgIC8vIHNtYWxsZXN0IHRvIGxhcmdlc3RcbiAgICB2YXIgcHJlZGVjZXNzb3IgPSBudWxsLFxuICAgICAgICBub2RlID0gdGhpcy5jaXJjbGVFdmVudHMucm9vdDtcbiAgICB3aGlsZSAobm9kZSkge1xuICAgICAgICBpZiAoY2lyY2xlRXZlbnQueSA8IG5vZGUueSB8fCAoY2lyY2xlRXZlbnQueSA9PT0gbm9kZS55ICYmIGNpcmNsZUV2ZW50LnggPD0gbm9kZS54KSkge1xuICAgICAgICAgICAgaWYgKG5vZGUucmJMZWZ0KSB7XG4gICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUucmJMZWZ0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHByZWRlY2Vzc29yID0gbm9kZS5yYlByZXZpb3VzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAobm9kZS5yYlJpZ2h0KSB7XG4gICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUucmJSaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBwcmVkZWNlc3NvciA9IG5vZGU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgdGhpcy5jaXJjbGVFdmVudHMucmJJbnNlcnRTdWNjZXNzb3IocHJlZGVjZXNzb3IsIGNpcmNsZUV2ZW50KTtcbiAgICBpZiAoIXByZWRlY2Vzc29yKSB7XG4gICAgICAgIHRoaXMuZmlyc3RDaXJjbGVFdmVudCA9IGNpcmNsZUV2ZW50O1xuICAgICAgICB9XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuZGV0YWNoQ2lyY2xlRXZlbnQgPSBmdW5jdGlvbihhcmMpIHtcbiAgICB2YXIgY2lyY2xlRXZlbnQgPSBhcmMuY2lyY2xlRXZlbnQ7XG4gICAgaWYgKGNpcmNsZUV2ZW50KSB7XG4gICAgICAgIGlmICghY2lyY2xlRXZlbnQucmJQcmV2aW91cykge1xuICAgICAgICAgICAgdGhpcy5maXJzdENpcmNsZUV2ZW50ID0gY2lyY2xlRXZlbnQucmJOZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB0aGlzLmNpcmNsZUV2ZW50cy5yYlJlbW92ZU5vZGUoY2lyY2xlRXZlbnQpOyAvLyByZW1vdmUgZnJvbSBSQi10cmVlXG4gICAgICAgIHRoaXMuY2lyY2xlRXZlbnRKdW5reWFyZC5wdXNoKGNpcmNsZUV2ZW50KTtcbiAgICAgICAgYXJjLmNpcmNsZUV2ZW50ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gRGlhZ3JhbSBjb21wbGV0aW9uIG1ldGhvZHNcblxuLy8gY29ubmVjdCBkYW5nbGluZyBlZGdlcyAobm90IGlmIGEgY3Vyc29yeSB0ZXN0IHRlbGxzIHVzXG4vLyBpdCBpcyBub3QgZ29pbmcgdG8gYmUgdmlzaWJsZS5cbi8vIHJldHVybiB2YWx1ZTpcbi8vICAgZmFsc2U6IHRoZSBkYW5nbGluZyBlbmRwb2ludCBjb3VsZG4ndCBiZSBjb25uZWN0ZWRcbi8vICAgdHJ1ZTogdGhlIGRhbmdsaW5nIGVuZHBvaW50IGNvdWxkIGJlIGNvbm5lY3RlZFxuVm9yb25vaS5wcm90b3R5cGUuY29ubmVjdEVkZ2UgPSBmdW5jdGlvbihlZGdlLCBiYm94KSB7XG4gICAgLy8gc2tpcCBpZiBlbmQgcG9pbnQgYWxyZWFkeSBjb25uZWN0ZWRcbiAgICB2YXIgdmIgPSBlZGdlLnZiO1xuICAgIGlmICghIXZiKSB7cmV0dXJuIHRydWU7fVxuXG4gICAgLy8gbWFrZSBsb2NhbCBjb3B5IGZvciBwZXJmb3JtYW5jZSBwdXJwb3NlXG4gICAgdmFyIHZhID0gZWRnZS52YSxcbiAgICAgICAgeGwgPSBiYm94LnhsLFxuICAgICAgICB4ciA9IGJib3gueHIsXG4gICAgICAgIHl0ID0gYmJveC55dCxcbiAgICAgICAgeWIgPSBiYm94LnliLFxuICAgICAgICBsU2l0ZSA9IGVkZ2UubFNpdGUsXG4gICAgICAgIHJTaXRlID0gZWRnZS5yU2l0ZSxcbiAgICAgICAgbHggPSBsU2l0ZS54LFxuICAgICAgICBseSA9IGxTaXRlLnksXG4gICAgICAgIHJ4ID0gclNpdGUueCxcbiAgICAgICAgcnkgPSByU2l0ZS55LFxuICAgICAgICBmeCA9IChseCtyeCkvMixcbiAgICAgICAgZnkgPSAobHkrcnkpLzIsXG4gICAgICAgIGZtLCBmYjtcblxuICAgIC8vIGlmIHdlIHJlYWNoIGhlcmUsIHRoaXMgbWVhbnMgY2VsbHMgd2hpY2ggdXNlIHRoaXMgZWRnZSB3aWxsIG5lZWRcbiAgICAvLyB0byBiZSBjbG9zZWQsIHdoZXRoZXIgYmVjYXVzZSB0aGUgZWRnZSB3YXMgcmVtb3ZlZCwgb3IgYmVjYXVzZSBpdFxuICAgIC8vIHdhcyBjb25uZWN0ZWQgdG8gdGhlIGJvdW5kaW5nIGJveC5cbiAgICB0aGlzLmNlbGxzW2xTaXRlLnZvcm9ub2lJZF0uY2xvc2VNZSA9IHRydWU7XG4gICAgdGhpcy5jZWxsc1tyU2l0ZS52b3Jvbm9pSWRdLmNsb3NlTWUgPSB0cnVlO1xuXG4gICAgLy8gZ2V0IHRoZSBsaW5lIGVxdWF0aW9uIG9mIHRoZSBiaXNlY3RvciBpZiBsaW5lIGlzIG5vdCB2ZXJ0aWNhbFxuICAgIGlmIChyeSAhPT0gbHkpIHtcbiAgICAgICAgZm0gPSAobHgtcngpLyhyeS1seSk7XG4gICAgICAgIGZiID0gZnktZm0qZng7XG4gICAgICAgIH1cblxuICAgIC8vIHJlbWVtYmVyLCBkaXJlY3Rpb24gb2YgbGluZSAocmVsYXRpdmUgdG8gbGVmdCBzaXRlKTpcbiAgICAvLyB1cHdhcmQ6IGxlZnQueCA8IHJpZ2h0LnhcbiAgICAvLyBkb3dud2FyZDogbGVmdC54ID4gcmlnaHQueFxuICAgIC8vIGhvcml6b250YWw6IGxlZnQueCA9PSByaWdodC54XG4gICAgLy8gdXB3YXJkOiBsZWZ0LnggPCByaWdodC54XG4gICAgLy8gcmlnaHR3YXJkOiBsZWZ0LnkgPCByaWdodC55XG4gICAgLy8gbGVmdHdhcmQ6IGxlZnQueSA+IHJpZ2h0LnlcbiAgICAvLyB2ZXJ0aWNhbDogbGVmdC55ID09IHJpZ2h0LnlcblxuICAgIC8vIGRlcGVuZGluZyBvbiB0aGUgZGlyZWN0aW9uLCBmaW5kIHRoZSBiZXN0IHNpZGUgb2YgdGhlXG4gICAgLy8gYm91bmRpbmcgYm94IHRvIHVzZSB0byBkZXRlcm1pbmUgYSByZWFzb25hYmxlIHN0YXJ0IHBvaW50XG5cbiAgICAvLyByaGlsbCAyMDEzLTEyLTAyOlxuICAgIC8vIFdoaWxlIGF0IGl0LCBzaW5jZSB3ZSBoYXZlIHRoZSB2YWx1ZXMgd2hpY2ggZGVmaW5lIHRoZSBsaW5lLFxuICAgIC8vIGNsaXAgdGhlIGVuZCBvZiB2YSBpZiBpdCBpcyBvdXRzaWRlIHRoZSBiYm94LlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9pc3N1ZXMvMTVcbiAgICAvLyBUT0RPOiBEbyBhbGwgdGhlIGNsaXBwaW5nIGhlcmUgcmF0aGVyIHRoYW4gcmVseSBvbiBMaWFuZy1CYXJza3lcbiAgICAvLyB3aGljaCBkb2VzIG5vdCBkbyB3ZWxsIHNvbWV0aW1lcyBkdWUgdG8gbG9zcyBvZiBhcml0aG1ldGljXG4gICAgLy8gcHJlY2lzaW9uLiBUaGUgY29kZSBoZXJlIGRvZXNuJ3QgZGVncmFkZSBpZiBvbmUgb2YgdGhlIHZlcnRleCBpc1xuICAgIC8vIGF0IGEgaHVnZSBkaXN0YW5jZS5cblxuICAgIC8vIHNwZWNpYWwgY2FzZTogdmVydGljYWwgbGluZVxuICAgIGlmIChmbSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIGRvZXNuJ3QgaW50ZXJzZWN0IHdpdGggdmlld3BvcnRcbiAgICAgICAgaWYgKGZ4IDwgeGwgfHwgZnggPj0geHIpIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICAvLyBkb3dud2FyZFxuICAgICAgICBpZiAobHggPiByeCkge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS55IDwgeXQpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KGZ4LCB5dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmEueSA+PSB5Yikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KGZ4LCB5Yik7XG4gICAgICAgICAgICB9XG4gICAgICAgIC8vIHVwd2FyZFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmICghdmEgfHwgdmEueSA+IHliKSB7XG4gICAgICAgICAgICAgICAgdmEgPSB0aGlzLmNyZWF0ZVZlcnRleChmeCwgeWIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHZhLnkgPCB5dCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KGZ4LCB5dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAvLyBjbG9zZXIgdG8gdmVydGljYWwgdGhhbiBob3Jpem9udGFsLCBjb25uZWN0IHN0YXJ0IHBvaW50IHRvIHRoZVxuICAgIC8vIHRvcCBvciBib3R0b20gc2lkZSBvZiB0aGUgYm91bmRpbmcgYm94XG4gICAgZWxzZSBpZiAoZm0gPCAtMSB8fCBmbSA+IDEpIHtcbiAgICAgICAgLy8gZG93bndhcmRcbiAgICAgICAgaWYgKGx4ID4gcngpIHtcbiAgICAgICAgICAgIGlmICghdmEgfHwgdmEueSA8IHl0KSB7XG4gICAgICAgICAgICAgICAgdmEgPSB0aGlzLmNyZWF0ZVZlcnRleCgoeXQtZmIpL2ZtLCB5dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmEueSA+PSB5Yikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KCh5Yi1mYikvZm0sIHliKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgLy8gdXB3YXJkXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS55ID4geWIpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KCh5Yi1mYikvZm0sIHliKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh2YS55IDwgeXQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmIgPSB0aGlzLmNyZWF0ZVZlcnRleCgoeXQtZmIpL2ZtLCB5dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAvLyBjbG9zZXIgdG8gaG9yaXpvbnRhbCB0aGFuIHZlcnRpY2FsLCBjb25uZWN0IHN0YXJ0IHBvaW50IHRvIHRoZVxuICAgIC8vIGxlZnQgb3IgcmlnaHQgc2lkZSBvZiB0aGUgYm91bmRpbmcgYm94XG4gICAgZWxzZSB7XG4gICAgICAgIC8vIHJpZ2h0d2FyZFxuICAgICAgICBpZiAobHkgPCByeSkge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS54IDwgeGwpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KHhsLCBmbSp4bCtmYik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmEueCA+PSB4cikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KHhyLCBmbSp4citmYik7XG4gICAgICAgICAgICB9XG4gICAgICAgIC8vIGxlZnR3YXJkXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS54ID4geHIpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KHhyLCBmbSp4citmYik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmEueCA8IHhsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeGwsIGZtKnhsK2ZiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIGVkZ2UudmEgPSB2YTtcbiAgICBlZGdlLnZiID0gdmI7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4vLyBsaW5lLWNsaXBwaW5nIGNvZGUgdGFrZW4gZnJvbTpcbi8vICAgTGlhbmctQmFyc2t5IGZ1bmN0aW9uIGJ5IERhbmllbCBXaGl0ZVxuLy8gICBodHRwOi8vd3d3LnNreXRvcGlhLmNvbS9wcm9qZWN0L2FydGljbGVzL2NvbXBzY2kvY2xpcHBpbmcuaHRtbFxuLy8gVGhhbmtzIVxuLy8gQSBiaXQgbW9kaWZpZWQgdG8gbWluaW1pemUgY29kZSBwYXRoc1xuVm9yb25vaS5wcm90b3R5cGUuY2xpcEVkZ2UgPSBmdW5jdGlvbihlZGdlLCBiYm94KSB7XG4gICAgdmFyIGF4ID0gZWRnZS52YS54LFxuICAgICAgICBheSA9IGVkZ2UudmEueSxcbiAgICAgICAgYnggPSBlZGdlLnZiLngsXG4gICAgICAgIGJ5ID0gZWRnZS52Yi55LFxuICAgICAgICB0MCA9IDAsXG4gICAgICAgIHQxID0gMSxcbiAgICAgICAgZHggPSBieC1heCxcbiAgICAgICAgZHkgPSBieS1heTtcbiAgICAvLyBsZWZ0XG4gICAgdmFyIHEgPSBheC1iYm94LnhsO1xuICAgIGlmIChkeD09PTAgJiYgcTwwKSB7cmV0dXJuIGZhbHNlO31cbiAgICB2YXIgciA9IC1xL2R4O1xuICAgIGlmIChkeDwwKSB7XG4gICAgICAgIGlmIChyPHQwKSB7cmV0dXJuIGZhbHNlO31cbiAgICAgICAgaWYgKHI8dDEpIHt0MT1yO31cbiAgICAgICAgfVxuICAgIGVsc2UgaWYgKGR4PjApIHtcbiAgICAgICAgaWYgKHI+dDEpIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocj50MCkge3QwPXI7fVxuICAgICAgICB9XG4gICAgLy8gcmlnaHRcbiAgICBxID0gYmJveC54ci1heDtcbiAgICBpZiAoZHg9PT0wICYmIHE8MCkge3JldHVybiBmYWxzZTt9XG4gICAgciA9IHEvZHg7XG4gICAgaWYgKGR4PDApIHtcbiAgICAgICAgaWYgKHI+dDEpIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocj50MCkge3QwPXI7fVxuICAgICAgICB9XG4gICAgZWxzZSBpZiAoZHg+MCkge1xuICAgICAgICBpZiAocjx0MCkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPHQxKSB7dDE9cjt9XG4gICAgICAgIH1cbiAgICAvLyB0b3BcbiAgICBxID0gYXktYmJveC55dDtcbiAgICBpZiAoZHk9PT0wICYmIHE8MCkge3JldHVybiBmYWxzZTt9XG4gICAgciA9IC1xL2R5O1xuICAgIGlmIChkeTwwKSB7XG4gICAgICAgIGlmIChyPHQwKSB7cmV0dXJuIGZhbHNlO31cbiAgICAgICAgaWYgKHI8dDEpIHt0MT1yO31cbiAgICAgICAgfVxuICAgIGVsc2UgaWYgKGR5PjApIHtcbiAgICAgICAgaWYgKHI+dDEpIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocj50MCkge3QwPXI7fVxuICAgICAgICB9XG4gICAgLy8gYm90dG9tICAgICAgICBcbiAgICBxID0gYmJveC55Yi1heTtcbiAgICBpZiAoZHk9PT0wICYmIHE8MCkge3JldHVybiBmYWxzZTt9XG4gICAgciA9IHEvZHk7XG4gICAgaWYgKGR5PDApIHtcbiAgICAgICAgaWYgKHI+dDEpIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocj50MCkge3QwPXI7fVxuICAgICAgICB9XG4gICAgZWxzZSBpZiAoZHk+MCkge1xuICAgICAgICBpZiAocjx0MCkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPHQxKSB7dDE9cjt9XG4gICAgICAgIH1cblxuICAgIC8vIGlmIHdlIHJlYWNoIHRoaXMgcG9pbnQsIFZvcm9ub2kgZWRnZSBpcyB3aXRoaW4gYmJveFxuXG4gICAgLy8gaWYgdDAgPiAwLCB2YSBuZWVkcyB0byBjaGFuZ2VcbiAgICAvLyByaGlsbCAyMDExLTA2LTAzOiB3ZSBuZWVkIHRvIGNyZWF0ZSBhIG5ldyB2ZXJ0ZXggcmF0aGVyXG4gICAgLy8gdGhhbiBtb2RpZnlpbmcgdGhlIGV4aXN0aW5nIG9uZSwgc2luY2UgdGhlIGV4aXN0aW5nXG4gICAgLy8gb25lIGlzIGxpa2VseSBzaGFyZWQgd2l0aCBhdCBsZWFzdCBhbm90aGVyIGVkZ2VcbiAgICBpZiAodDAgPiAwKSB7XG4gICAgICAgIGVkZ2UudmEgPSB0aGlzLmNyZWF0ZVZlcnRleChheCt0MCpkeCwgYXkrdDAqZHkpO1xuICAgICAgICB9XG5cbiAgICAvLyBpZiB0MSA8IDEsIHZiIG5lZWRzIHRvIGNoYW5nZVxuICAgIC8vIHJoaWxsIDIwMTEtMDYtMDM6IHdlIG5lZWQgdG8gY3JlYXRlIGEgbmV3IHZlcnRleCByYXRoZXJcbiAgICAvLyB0aGFuIG1vZGlmeWluZyB0aGUgZXhpc3Rpbmcgb25lLCBzaW5jZSB0aGUgZXhpc3RpbmdcbiAgICAvLyBvbmUgaXMgbGlrZWx5IHNoYXJlZCB3aXRoIGF0IGxlYXN0IGFub3RoZXIgZWRnZVxuICAgIGlmICh0MSA8IDEpIHtcbiAgICAgICAgZWRnZS52YiA9IHRoaXMuY3JlYXRlVmVydGV4KGF4K3QxKmR4LCBheSt0MSpkeSk7XG4gICAgICAgIH1cblxuICAgIC8vIHZhIGFuZC9vciB2YiB3ZXJlIGNsaXBwZWQsIHRodXMgd2Ugd2lsbCBuZWVkIHRvIGNsb3NlXG4gICAgLy8gY2VsbHMgd2hpY2ggdXNlIHRoaXMgZWRnZS5cbiAgICBpZiAoIHQwID4gMCB8fCB0MSA8IDEgKSB7XG4gICAgICAgIHRoaXMuY2VsbHNbZWRnZS5sU2l0ZS52b3Jvbm9pSWRdLmNsb3NlTWUgPSB0cnVlO1xuICAgICAgICB0aGlzLmNlbGxzW2VkZ2UuclNpdGUudm9yb25vaUlkXS5jbG9zZU1lID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4vLyBDb25uZWN0L2N1dCBlZGdlcyBhdCBib3VuZGluZyBib3hcblZvcm9ub2kucHJvdG90eXBlLmNsaXBFZGdlcyA9IGZ1bmN0aW9uKGJib3gpIHtcbiAgICAvLyBjb25uZWN0IGFsbCBkYW5nbGluZyBlZGdlcyB0byBib3VuZGluZyBib3hcbiAgICAvLyBvciBnZXQgcmlkIG9mIHRoZW0gaWYgaXQgY2FuJ3QgYmUgZG9uZVxuICAgIHZhciBlZGdlcyA9IHRoaXMuZWRnZXMsXG4gICAgICAgIGlFZGdlID0gZWRnZXMubGVuZ3RoLFxuICAgICAgICBlZGdlLFxuICAgICAgICBhYnNfZm4gPSBNYXRoLmFicztcblxuICAgIC8vIGl0ZXJhdGUgYmFja3dhcmQgc28gd2UgY2FuIHNwbGljZSBzYWZlbHlcbiAgICB3aGlsZSAoaUVkZ2UtLSkge1xuICAgICAgICBlZGdlID0gZWRnZXNbaUVkZ2VdO1xuICAgICAgICAvLyBlZGdlIGlzIHJlbW92ZWQgaWY6XG4gICAgICAgIC8vICAgaXQgaXMgd2hvbGx5IG91dHNpZGUgdGhlIGJvdW5kaW5nIGJveFxuICAgICAgICAvLyAgIGl0IGlzIGxvb2tpbmcgbW9yZSBsaWtlIGEgcG9pbnQgdGhhbiBhIGxpbmVcbiAgICAgICAgaWYgKCF0aGlzLmNvbm5lY3RFZGdlKGVkZ2UsIGJib3gpIHx8XG4gICAgICAgICAgICAhdGhpcy5jbGlwRWRnZShlZGdlLCBiYm94KSB8fFxuICAgICAgICAgICAgKGFic19mbihlZGdlLnZhLngtZWRnZS52Yi54KTwxZS05ICYmIGFic19mbihlZGdlLnZhLnktZWRnZS52Yi55KTwxZS05KSkge1xuICAgICAgICAgICAgZWRnZS52YSA9IGVkZ2UudmIgPSBudWxsO1xuICAgICAgICAgICAgZWRnZXMuc3BsaWNlKGlFZGdlLDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuLy8gQ2xvc2UgdGhlIGNlbGxzLlxuLy8gVGhlIGNlbGxzIGFyZSBib3VuZCBieSB0aGUgc3VwcGxpZWQgYm91bmRpbmcgYm94LlxuLy8gRWFjaCBjZWxsIHJlZmVycyB0byBpdHMgYXNzb2NpYXRlZCBzaXRlLCBhbmQgYSBsaXN0XG4vLyBvZiBoYWxmZWRnZXMgb3JkZXJlZCBjb3VudGVyY2xvY2t3aXNlLlxuVm9yb25vaS5wcm90b3R5cGUuY2xvc2VDZWxscyA9IGZ1bmN0aW9uKGJib3gpIHtcbiAgICB2YXIgeGwgPSBiYm94LnhsLFxuICAgICAgICB4ciA9IGJib3gueHIsXG4gICAgICAgIHl0ID0gYmJveC55dCxcbiAgICAgICAgeWIgPSBiYm94LnliLFxuICAgICAgICBjZWxscyA9IHRoaXMuY2VsbHMsXG4gICAgICAgIGlDZWxsID0gY2VsbHMubGVuZ3RoLFxuICAgICAgICBjZWxsLFxuICAgICAgICBpTGVmdCxcbiAgICAgICAgaGFsZmVkZ2VzLCBuSGFsZmVkZ2VzLFxuICAgICAgICBlZGdlLFxuICAgICAgICB2YSwgdmIsIHZ6LFxuICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCxcbiAgICAgICAgYWJzX2ZuID0gTWF0aC5hYnM7XG5cbiAgICB3aGlsZSAoaUNlbGwtLSkge1xuICAgICAgICBjZWxsID0gY2VsbHNbaUNlbGxdO1xuICAgICAgICAvLyBwcnVuZSwgb3JkZXIgaGFsZmVkZ2VzIGNvdW50ZXJjbG9ja3dpc2UsIHRoZW4gYWRkIG1pc3Npbmcgb25lc1xuICAgICAgICAvLyByZXF1aXJlZCB0byBjbG9zZSBjZWxsc1xuICAgICAgICBpZiAoIWNlbGwucHJlcGFyZUhhbGZlZGdlcygpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgaWYgKCFjZWxsLmNsb3NlTWUpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAvLyBmaW5kIGZpcnN0ICd1bmNsb3NlZCcgcG9pbnQuXG4gICAgICAgIC8vIGFuICd1bmNsb3NlZCcgcG9pbnQgd2lsbCBiZSB0aGUgZW5kIHBvaW50IG9mIGEgaGFsZmVkZ2Ugd2hpY2hcbiAgICAgICAgLy8gZG9lcyBub3QgbWF0Y2ggdGhlIHN0YXJ0IHBvaW50IG9mIHRoZSBmb2xsb3dpbmcgaGFsZmVkZ2VcbiAgICAgICAgaGFsZmVkZ2VzID0gY2VsbC5oYWxmZWRnZXM7XG4gICAgICAgIG5IYWxmZWRnZXMgPSBoYWxmZWRnZXMubGVuZ3RoO1xuICAgICAgICAvLyBzcGVjaWFsIGNhc2U6IG9ubHkgb25lIHNpdGUsIGluIHdoaWNoIGNhc2UsIHRoZSB2aWV3cG9ydCBpcyB0aGUgY2VsbFxuICAgICAgICAvLyAuLi5cblxuICAgICAgICAvLyBhbGwgb3RoZXIgY2FzZXNcbiAgICAgICAgaUxlZnQgPSAwO1xuICAgICAgICB3aGlsZSAoaUxlZnQgPCBuSGFsZmVkZ2VzKSB7XG4gICAgICAgICAgICB2YSA9IGhhbGZlZGdlc1tpTGVmdF0uZ2V0RW5kcG9pbnQoKTtcbiAgICAgICAgICAgIHZ6ID0gaGFsZmVkZ2VzWyhpTGVmdCsxKSAlIG5IYWxmZWRnZXNdLmdldFN0YXJ0cG9pbnQoKTtcbiAgICAgICAgICAgIC8vIGlmIGVuZCBwb2ludCBpcyBub3QgZXF1YWwgdG8gc3RhcnQgcG9pbnQsIHdlIG5lZWQgdG8gYWRkIHRoZSBtaXNzaW5nXG4gICAgICAgICAgICAvLyBoYWxmZWRnZShzKSB1cCB0byB2elxuICAgICAgICAgICAgaWYgKGFic19mbih2YS54LXZ6LngpPj0xZS05IHx8IGFic19mbih2YS55LXZ6LnkpPj0xZS05KSB7XG5cbiAgICAgICAgICAgICAgICAvLyByaGlsbCAyMDEzLTEyLTAyOlxuICAgICAgICAgICAgICAgIC8vIFwiSG9sZXNcIiBpbiB0aGUgaGFsZmVkZ2VzIGFyZSBub3QgbmVjZXNzYXJpbHkgYWx3YXlzIGFkamFjZW50LlxuICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9pc3N1ZXMvMTZcblxuICAgICAgICAgICAgICAgIC8vIGZpbmQgZW50cnkgcG9pbnQ6XG4gICAgICAgICAgICAgICAgc3dpdGNoICh0cnVlKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gd2FsayBkb3dud2FyZCBhbG9uZyBsZWZ0IHNpZGVcbiAgICAgICAgICAgICAgICAgICAgY2FzZSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odmEueCx4bCkgJiYgdGhpcy5sZXNzVGhhbldpdGhFcHNpbG9uKHZhLnkseWIpOlxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEJvcmRlclNlZ21lbnQgPSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odnoueCx4bCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KHhsLCBsYXN0Qm9yZGVyU2VnbWVudCA/IHZ6LnkgOiB5Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlID0gdGhpcy5jcmVhdGVCb3JkZXJFZGdlKGNlbGwuc2l0ZSwgdmEsIHZiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYWxmZWRnZXMuc3BsaWNlKGlMZWZ0LCAwLCB0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGNlbGwuc2l0ZSwgbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbkhhbGZlZGdlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBsYXN0Qm9yZGVyU2VnbWVudCApIHsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhID0gdmI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsIHRocm91Z2hcblxuICAgICAgICAgICAgICAgICAgICAvLyB3YWxrIHJpZ2h0d2FyZCBhbG9uZyBib3R0b20gc2lkZVxuICAgICAgICAgICAgICAgICAgICBjYXNlIHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2YS55LHliKSAmJiB0aGlzLmxlc3NUaGFuV2l0aEVwc2lsb24odmEueCx4cik6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei55LHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgobGFzdEJvcmRlclNlZ21lbnQgPyB2ei54IDogeHIsIHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmEgPSB2YjtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHdhbGsgdXB3YXJkIGFsb25nIHJpZ2h0IHNpZGVcbiAgICAgICAgICAgICAgICAgICAgY2FzZSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odmEueCx4cikgJiYgdGhpcy5ncmVhdGVyVGhhbldpdGhFcHNpbG9uKHZhLnkseXQpOlxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEJvcmRlclNlZ21lbnQgPSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odnoueCx4cik7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KHhyLCBsYXN0Qm9yZGVyU2VnbWVudCA/IHZ6LnkgOiB5dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlID0gdGhpcy5jcmVhdGVCb3JkZXJFZGdlKGNlbGwuc2l0ZSwgdmEsIHZiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYWxmZWRnZXMuc3BsaWNlKGlMZWZ0LCAwLCB0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGNlbGwuc2l0ZSwgbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbkhhbGZlZGdlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBsYXN0Qm9yZGVyU2VnbWVudCApIHsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhID0gdmI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsIHRocm91Z2hcblxuICAgICAgICAgICAgICAgICAgICAvLyB3YWxrIGxlZnR3YXJkIGFsb25nIHRvcCBzaWRlXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgdGhpcy5lcXVhbFdpdGhFcHNpbG9uKHZhLnkseXQpICYmIHRoaXMuZ3JlYXRlclRoYW5XaXRoRXBzaWxvbih2YS54LHhsKTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RCb3JkZXJTZWdtZW50ID0gdGhpcy5lcXVhbFdpdGhFcHNpbG9uKHZ6LnkseXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmIgPSB0aGlzLmNyZWF0ZVZlcnRleChsYXN0Qm9yZGVyU2VnbWVudCA/IHZ6LnggOiB4bCwgeXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZSA9IHRoaXMuY3JlYXRlQm9yZGVyRWRnZShjZWxsLnNpdGUsIHZhLCB2Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpTGVmdCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFsZmVkZ2VzLnNwbGljZShpTGVmdCwgMCwgdGhpcy5jcmVhdGVIYWxmZWRnZShlZGdlLCBjZWxsLnNpdGUsIG51bGwpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5IYWxmZWRnZXMrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggbGFzdEJvcmRlclNlZ21lbnQgKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YSA9IHZiO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdhbGsgZG93bndhcmQgYWxvbmcgbGVmdCBzaWRlXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei54LHhsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeGwsIGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueSA6IHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmEgPSB2YjtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB3YWxrIHJpZ2h0d2FyZCBhbG9uZyBib3R0b20gc2lkZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEJvcmRlclNlZ21lbnQgPSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odnoueSx5Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueCA6IHhyLCB5Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlID0gdGhpcy5jcmVhdGVCb3JkZXJFZGdlKGNlbGwuc2l0ZSwgdmEsIHZiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYWxmZWRnZXMuc3BsaWNlKGlMZWZ0LCAwLCB0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGNlbGwuc2l0ZSwgbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbkhhbGZlZGdlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBsYXN0Qm9yZGVyU2VnbWVudCApIHsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhID0gdmI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsIHRocm91Z2hcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2FsayB1cHdhcmQgYWxvbmcgcmlnaHQgc2lkZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEJvcmRlclNlZ21lbnQgPSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odnoueCx4cik7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KHhyLCBsYXN0Qm9yZGVyU2VnbWVudCA/IHZ6LnkgOiB5dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlID0gdGhpcy5jcmVhdGVCb3JkZXJFZGdlKGNlbGwuc2l0ZSwgdmEsIHZiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYWxmZWRnZXMuc3BsaWNlKGlMZWZ0LCAwLCB0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGNlbGwuc2l0ZSwgbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbkhhbGZlZGdlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBsYXN0Qm9yZGVyU2VnbWVudCApIHsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBcIlZvcm9ub2kuY2xvc2VDZWxscygpID4gdGhpcyBtYWtlcyBubyBzZW5zZSFcIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgIGNlbGwuY2xvc2VNZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBEZWJ1Z2dpbmcgaGVscGVyXG4vKlxuVm9yb25vaS5wcm90b3R5cGUuZHVtcEJlYWNobGluZSA9IGZ1bmN0aW9uKHkpIHtcbiAgICBjb25zb2xlLmxvZygnVm9yb25vaS5kdW1wQmVhY2hsaW5lKCVmKSA+IEJlYWNoc2VjdGlvbnMsIGZyb20gbGVmdCB0byByaWdodDonLCB5KTtcbiAgICBpZiAoICF0aGlzLmJlYWNobGluZSApIHtcbiAgICAgICAgY29uc29sZS5sb2coJyAgTm9uZScpO1xuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhciBicyA9IHRoaXMuYmVhY2hsaW5lLmdldEZpcnN0KHRoaXMuYmVhY2hsaW5lLnJvb3QpO1xuICAgICAgICB3aGlsZSAoIGJzICkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJyAgc2l0ZSAlZDogeGw6ICVmLCB4cjogJWYnLCBicy5zaXRlLnZvcm9ub2lJZCwgdGhpcy5sZWZ0QnJlYWtQb2ludChicywgeSksIHRoaXMucmlnaHRCcmVha1BvaW50KGJzLCB5KSk7XG4gICAgICAgICAgICBicyA9IGJzLnJiTmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG4qL1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEhlbHBlcjogUXVhbnRpemUgc2l0ZXNcblxuLy8gcmhpbGwgMjAxMy0xMC0xMjpcbi8vIFRoaXMgaXMgdG8gc29sdmUgaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pL2lzc3Vlcy8xNVxuLy8gU2luY2Ugbm90IGFsbCB1c2VycyB3aWxsIGVuZCB1cCB1c2luZyB0aGUga2luZCBvZiBjb29yZCB2YWx1ZXMgd2hpY2ggd291bGRcbi8vIGNhdXNlIHRoZSBpc3N1ZSB0byBhcmlzZSwgSSBjaG9zZSB0byBsZXQgdGhlIHVzZXIgZGVjaWRlIHdoZXRoZXIgb3Igbm90XG4vLyBoZSBzaG91bGQgc2FuaXRpemUgaGlzIGNvb3JkIHZhbHVlcyB0aHJvdWdoIHRoaXMgaGVscGVyLiBUaGlzIHdheSwgZm9yXG4vLyB0aG9zZSB1c2VycyB3aG8gdXNlcyBjb29yZCB2YWx1ZXMgd2hpY2ggYXJlIGtub3duIHRvIGJlIGZpbmUsIG5vIG92ZXJoZWFkIGlzXG4vLyBhZGRlZC5cblxuVm9yb25vaS5wcm90b3R5cGUucXVhbnRpemVTaXRlcyA9IGZ1bmN0aW9uKHNpdGVzKSB7XG4gICAgdmFyIM61ID0gdGhpcy7OtSxcbiAgICAgICAgbiA9IHNpdGVzLmxlbmd0aCxcbiAgICAgICAgc2l0ZTtcbiAgICB3aGlsZSAoIG4tLSApIHtcbiAgICAgICAgc2l0ZSA9IHNpdGVzW25dO1xuICAgICAgICBzaXRlLnggPSBNYXRoLmZsb29yKHNpdGUueCAvIM61KSAqIM61O1xuICAgICAgICBzaXRlLnkgPSBNYXRoLmZsb29yKHNpdGUueSAvIM61KSAqIM61O1xuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBIZWxwZXI6IFJlY3ljbGUgZGlhZ3JhbTogYWxsIHZlcnRleCwgZWRnZSBhbmQgY2VsbCBvYmplY3RzIGFyZVxuLy8gXCJzdXJyZW5kZXJlZFwiIHRvIHRoZSBWb3Jvbm9pIG9iamVjdCBmb3IgcmV1c2UuXG4vLyBUT0RPOiByaGlsbC12b3Jvbm9pLWNvcmUgdjI6IG1vcmUgcGVyZm9ybWFuY2UgdG8gYmUgZ2FpbmVkXG4vLyB3aGVuIEkgY2hhbmdlIHRoZSBzZW1hbnRpYyBvZiB3aGF0IGlzIHJldHVybmVkLlxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5yZWN5Y2xlID0gZnVuY3Rpb24oZGlhZ3JhbSkge1xuICAgIGlmICggZGlhZ3JhbSApIHtcbiAgICAgICAgaWYgKCBkaWFncmFtIGluc3RhbmNlb2YgdGhpcy5EaWFncmFtICkge1xuICAgICAgICAgICAgdGhpcy50b1JlY3ljbGUgPSBkaWFncmFtO1xuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93ICdWb3Jvbm9pLnJlY3ljbGVEaWFncmFtKCkgPiBOZWVkIGEgRGlhZ3JhbSBvYmplY3QuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gVG9wLWxldmVsIEZvcnR1bmUgbG9vcFxuXG4vLyByaGlsbCAyMDExLTA1LTE5OlxuLy8gICBWb3Jvbm9pIHNpdGVzIGFyZSBrZXB0IGNsaWVudC1zaWRlIG5vdywgdG8gYWxsb3dcbi8vICAgdXNlciB0byBmcmVlbHkgbW9kaWZ5IGNvbnRlbnQuIEF0IGNvbXB1dGUgdGltZSxcbi8vICAgKnJlZmVyZW5jZXMqIHRvIHNpdGVzIGFyZSBjb3BpZWQgbG9jYWxseS5cblxuVm9yb25vaS5wcm90b3R5cGUuY29tcHV0ZSA9IGZ1bmN0aW9uKHNpdGVzLCBiYm94KSB7XG4gICAgLy8gdG8gbWVhc3VyZSBleGVjdXRpb24gdGltZVxuICAgIHZhciBzdGFydFRpbWUgPSBuZXcgRGF0ZSgpO1xuXG4gICAgLy8gaW5pdCBpbnRlcm5hbCBzdGF0ZVxuICAgIHRoaXMucmVzZXQoKTtcblxuICAgIC8vIGFueSBkaWFncmFtIGRhdGEgYXZhaWxhYmxlIGZvciByZWN5Y2xpbmc/XG4gICAgLy8gSSBkbyB0aGF0IGhlcmUgc28gdGhhdCB0aGlzIGlzIGluY2x1ZGVkIGluIGV4ZWN1dGlvbiB0aW1lXG4gICAgaWYgKCB0aGlzLnRvUmVjeWNsZSApIHtcbiAgICAgICAgdGhpcy52ZXJ0ZXhKdW5reWFyZCA9IHRoaXMudmVydGV4SnVua3lhcmQuY29uY2F0KHRoaXMudG9SZWN5Y2xlLnZlcnRpY2VzKTtcbiAgICAgICAgdGhpcy5lZGdlSnVua3lhcmQgPSB0aGlzLmVkZ2VKdW5reWFyZC5jb25jYXQodGhpcy50b1JlY3ljbGUuZWRnZXMpO1xuICAgICAgICB0aGlzLmNlbGxKdW5reWFyZCA9IHRoaXMuY2VsbEp1bmt5YXJkLmNvbmNhdCh0aGlzLnRvUmVjeWNsZS5jZWxscyk7XG4gICAgICAgIHRoaXMudG9SZWN5Y2xlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgLy8gSW5pdGlhbGl6ZSBzaXRlIGV2ZW50IHF1ZXVlXG4gICAgdmFyIHNpdGVFdmVudHMgPSBzaXRlcy5zbGljZSgwKTtcbiAgICBzaXRlRXZlbnRzLnNvcnQoZnVuY3Rpb24oYSxiKXtcbiAgICAgICAgdmFyIHIgPSBiLnkgLSBhLnk7XG4gICAgICAgIGlmIChyKSB7cmV0dXJuIHI7fVxuICAgICAgICByZXR1cm4gYi54IC0gYS54O1xuICAgICAgICB9KTtcblxuICAgIC8vIHByb2Nlc3MgcXVldWVcbiAgICB2YXIgc2l0ZSA9IHNpdGVFdmVudHMucG9wKCksXG4gICAgICAgIHNpdGVpZCA9IDAsXG4gICAgICAgIHhzaXRleCwgLy8gdG8gYXZvaWQgZHVwbGljYXRlIHNpdGVzXG4gICAgICAgIHhzaXRleSxcbiAgICAgICAgY2VsbHMgPSB0aGlzLmNlbGxzLFxuICAgICAgICBjaXJjbGU7XG5cbiAgICAvLyBtYWluIGxvb3BcbiAgICBmb3IgKDs7KSB7XG4gICAgICAgIC8vIHdlIG5lZWQgdG8gZmlndXJlIHdoZXRoZXIgd2UgaGFuZGxlIGEgc2l0ZSBvciBjaXJjbGUgZXZlbnRcbiAgICAgICAgLy8gZm9yIHRoaXMgd2UgZmluZCBvdXQgaWYgdGhlcmUgaXMgYSBzaXRlIGV2ZW50IGFuZCBpdCBpc1xuICAgICAgICAvLyAnZWFybGllcicgdGhhbiB0aGUgY2lyY2xlIGV2ZW50XG4gICAgICAgIGNpcmNsZSA9IHRoaXMuZmlyc3RDaXJjbGVFdmVudDtcblxuICAgICAgICAvLyBhZGQgYmVhY2ggc2VjdGlvblxuICAgICAgICBpZiAoc2l0ZSAmJiAoIWNpcmNsZSB8fCBzaXRlLnkgPCBjaXJjbGUueSB8fCAoc2l0ZS55ID09PSBjaXJjbGUueSAmJiBzaXRlLnggPCBjaXJjbGUueCkpKSB7XG4gICAgICAgICAgICAvLyBvbmx5IGlmIHNpdGUgaXMgbm90IGEgZHVwbGljYXRlXG4gICAgICAgICAgICBpZiAoc2l0ZS54ICE9PSB4c2l0ZXggfHwgc2l0ZS55ICE9PSB4c2l0ZXkpIHtcbiAgICAgICAgICAgICAgICAvLyBmaXJzdCBjcmVhdGUgY2VsbCBmb3IgbmV3IHNpdGVcbiAgICAgICAgICAgICAgICBjZWxsc1tzaXRlaWRdID0gdGhpcy5jcmVhdGVDZWxsKHNpdGUpO1xuICAgICAgICAgICAgICAgIHNpdGUudm9yb25vaUlkID0gc2l0ZWlkKys7XG4gICAgICAgICAgICAgICAgLy8gdGhlbiBjcmVhdGUgYSBiZWFjaHNlY3Rpb24gZm9yIHRoYXQgc2l0ZVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkQmVhY2hzZWN0aW9uKHNpdGUpO1xuICAgICAgICAgICAgICAgIC8vIHJlbWVtYmVyIGxhc3Qgc2l0ZSBjb29yZHMgdG8gZGV0ZWN0IGR1cGxpY2F0ZVxuICAgICAgICAgICAgICAgIHhzaXRleSA9IHNpdGUueTtcbiAgICAgICAgICAgICAgICB4c2l0ZXggPSBzaXRlLng7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2l0ZSA9IHNpdGVFdmVudHMucG9wKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIGJlYWNoIHNlY3Rpb25cbiAgICAgICAgZWxzZSBpZiAoY2lyY2xlKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUJlYWNoc2VjdGlvbihjaXJjbGUuYXJjKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAvLyBhbGwgZG9uZSwgcXVpdFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAvLyB3cmFwcGluZy11cDpcbiAgICAvLyAgIGNvbm5lY3QgZGFuZ2xpbmcgZWRnZXMgdG8gYm91bmRpbmcgYm94XG4gICAgLy8gICBjdXQgZWRnZXMgYXMgcGVyIGJvdW5kaW5nIGJveFxuICAgIC8vICAgZGlzY2FyZCBlZGdlcyBjb21wbGV0ZWx5IG91dHNpZGUgYm91bmRpbmcgYm94XG4gICAgLy8gICBkaXNjYXJkIGVkZ2VzIHdoaWNoIGFyZSBwb2ludC1saWtlXG4gICAgdGhpcy5jbGlwRWRnZXMoYmJveCk7XG5cbiAgICAvLyAgIGFkZCBtaXNzaW5nIGVkZ2VzIGluIG9yZGVyIHRvIGNsb3NlIG9wZW5lZCBjZWxsc1xuICAgIHRoaXMuY2xvc2VDZWxscyhiYm94KTtcblxuICAgIC8vIHRvIG1lYXN1cmUgZXhlY3V0aW9uIHRpbWVcbiAgICB2YXIgc3RvcFRpbWUgPSBuZXcgRGF0ZSgpO1xuXG4gICAgLy8gcHJlcGFyZSByZXR1cm4gdmFsdWVzXG4gICAgdmFyIGRpYWdyYW0gPSBuZXcgdGhpcy5EaWFncmFtKCk7XG4gICAgZGlhZ3JhbS5jZWxscyA9IHRoaXMuY2VsbHM7XG4gICAgZGlhZ3JhbS5lZGdlcyA9IHRoaXMuZWRnZXM7XG4gICAgZGlhZ3JhbS52ZXJ0aWNlcyA9IHRoaXMudmVydGljZXM7XG4gICAgZGlhZ3JhbS5leGVjVGltZSA9IHN0b3BUaW1lLmdldFRpbWUoKS1zdGFydFRpbWUuZ2V0VGltZSgpO1xuXG4gICAgLy8gY2xlYW4gdXBcbiAgICB0aGlzLnJlc2V0KCk7XG5cbiAgICByZXR1cm4gZGlhZ3JhbTtcbiAgICB9O1xuXG5pZih0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykgbW9kdWxlLmV4cG9ydHMgPSBWb3Jvbm9pO1xuIl19

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.maxInscribedCircle = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
const Voronoi = require('voronoi');
const voronoi = new Voronoi;
const centroid = require('turf-centroid');
const point = require('turf-point');
const nearestPointOnLine = require('@turf/nearest-point-on-line').default;
const within = require('turf-within');
const makeError = require('make-error');
const NoPointsInShapeError = makeError('NoPointsInShapeError');
const GeoJSONUtils = require('./utils/geojson-utils.js');

/**
 * Takes a polygon feature and estimates the best position for label placement that is guaranteed to be inside the polygon. This uses voronoi to estimate the medial axis.
 *
 * @module turf/label-position
 * @param {Polygon} polygon A GeoJSON Polygon feature of the underlying polygon geometry in EPSG:4326
 * @param {number} decimalPlaces A power of 10 used to truncate the decimal places of the polygon sites and
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
                vertexDistance = nearestPointOnLine(polygonBoundaries.features[l], ptsWithin.features[k]).properties.dist;
            } else {
                vertexDistance = Math.min(vertexDistance,
                    nearestPointOnLine(polygonBoundaries.features[l], ptsWithin.features[k]).properties.dist);
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
},{"./utils/geojson-utils.js":28,"@turf/nearest-point-on-line":11,"make-error":15,"turf-centroid":19,"turf-point":24,"turf-within":25,"voronoi":26}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var meta_1 = require("@turf/meta");
/**
 * Takes a set of features, calculates the bbox of all input features, and returns a bounding box.
 *
 * @name bbox
 * @param {GeoJSON} geojson any GeoJSON object
 * @returns {BBox} bbox extent in [minX, minY, maxX, maxY] order
 * @example
 * var line = turf.lineString([[-74, 40], [-78, 42], [-82, 35]]);
 * var bbox = turf.bbox(line);
 * var bboxPolygon = turf.bboxPolygon(bbox);
 *
 * //addToMap
 * var addToMap = [line, bboxPolygon]
 */
function bbox(geojson) {
    var result = [Infinity, Infinity, -Infinity, -Infinity];
    meta_1.coordEach(geojson, function (coord) {
        if (result[0] > coord[0]) {
            result[0] = coord[0];
        }
        if (result[1] > coord[1]) {
            result[1] = coord[1];
        }
        if (result[2] < coord[0]) {
            result[2] = coord[0];
        }
        if (result[3] < coord[1]) {
            result[3] = coord[1];
        }
    });
    return result;
}
exports.default = bbox;

},{"@turf/meta":10}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var helpers_1 = require("@turf/helpers");
var invariant_1 = require("@turf/invariant");
// http://en.wikipedia.org/wiki/Haversine_formula
// http://www.movable-type.co.uk/scripts/latlong.html
/**
 * Takes two {@link Point|points} and finds the geographic bearing between them,
 * i.e. the angle measured in degrees from the north line (0 degrees)
 *
 * @name bearing
 * @param {Coord} start starting Point
 * @param {Coord} end ending Point
 * @param {Object} [options={}] Optional parameters
 * @param {boolean} [options.final=false] calculates the final bearing if true
 * @returns {number} bearing in decimal degrees, between -180 and 180 degrees (positive clockwise)
 * @example
 * var point1 = turf.point([-75.343, 39.984]);
 * var point2 = turf.point([-75.534, 39.123]);
 *
 * var bearing = turf.bearing(point1, point2);
 *
 * //addToMap
 * var addToMap = [point1, point2]
 * point1.properties['marker-color'] = '#f00'
 * point2.properties['marker-color'] = '#0f0'
 * point1.properties.bearing = bearing
 */
function bearing(start, end, options) {
    if (options === void 0) { options = {}; }
    // Reverse calculation
    if (options.final === true) {
        return calculateFinalBearing(start, end);
    }
    var coordinates1 = invariant_1.getCoord(start);
    var coordinates2 = invariant_1.getCoord(end);
    var lon1 = helpers_1.degreesToRadians(coordinates1[0]);
    var lon2 = helpers_1.degreesToRadians(coordinates2[0]);
    var lat1 = helpers_1.degreesToRadians(coordinates1[1]);
    var lat2 = helpers_1.degreesToRadians(coordinates2[1]);
    var a = Math.sin(lon2 - lon1) * Math.cos(lat2);
    var b = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    return helpers_1.radiansToDegrees(Math.atan2(a, b));
}
/**
 * Calculates Final Bearing
 *
 * @private
 * @param {Coord} start starting Point
 * @param {Coord} end ending Point
 * @returns {number} bearing
 */
function calculateFinalBearing(start, end) {
    // Swap start & end
    var bear = bearing(end, start);
    bear = (bear + 180) % 360;
    return bear;
}
exports.default = bearing;

},{"@turf/helpers":6,"@turf/invariant":7}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// http://en.wikipedia.org/wiki/Haversine_formula
// http://www.movable-type.co.uk/scripts/latlong.html
var helpers_1 = require("@turf/helpers");
var invariant_1 = require("@turf/invariant");
/**
 * Takes a {@link Point} and calculates the location of a destination point given a distance in
 * degrees, radians, miles, or kilometers; and bearing in degrees.
 * This uses the [Haversine formula](http://en.wikipedia.org/wiki/Haversine_formula) to account for global curvature.
 *
 * @name destination
 * @param {Coord} origin starting point
 * @param {number} distance distance from the origin point
 * @param {number} bearing ranging from -180 to 180
 * @param {Object} [options={}] Optional parameters
 * @param {string} [options.units='kilometers'] miles, kilometers, degrees, or radians
 * @param {Object} [options.properties={}] Translate properties to Point
 * @returns {Feature<Point>} destination point
 * @example
 * var point = turf.point([-75.343, 39.984]);
 * var distance = 50;
 * var bearing = 90;
 * var options = {units: 'miles'};
 *
 * var destination = turf.destination(point, distance, bearing, options);
 *
 * //addToMap
 * var addToMap = [point, destination]
 * destination.properties['marker-color'] = '#f00';
 * point.properties['marker-color'] = '#0f0';
 */
function destination(origin, distance, bearing, options) {
    if (options === void 0) { options = {}; }
    // Handle input
    var coordinates1 = invariant_1.getCoord(origin);
    var longitude1 = helpers_1.degreesToRadians(coordinates1[0]);
    var latitude1 = helpers_1.degreesToRadians(coordinates1[1]);
    var bearingRad = helpers_1.degreesToRadians(bearing);
    var radians = helpers_1.lengthToRadians(distance, options.units);
    // Main
    var latitude2 = Math.asin(Math.sin(latitude1) * Math.cos(radians) +
        Math.cos(latitude1) * Math.sin(radians) * Math.cos(bearingRad));
    var longitude2 = longitude1 + Math.atan2(Math.sin(bearingRad) * Math.sin(radians) * Math.cos(latitude1), Math.cos(radians) - Math.sin(latitude1) * Math.sin(latitude2));
    var lng = helpers_1.radiansToDegrees(longitude2);
    var lat = helpers_1.radiansToDegrees(latitude2);
    return helpers_1.point([lng, lat], options.properties);
}
exports.default = destination;

},{"@turf/helpers":6,"@turf/invariant":7}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var invariant_1 = require("@turf/invariant");
var helpers_1 = require("@turf/helpers");
//http://en.wikipedia.org/wiki/Haversine_formula
//http://www.movable-type.co.uk/scripts/latlong.html
/**
 * Calculates the distance between two {@link Point|points} in degrees, radians, miles, or kilometers.
 * This uses the [Haversine formula](http://en.wikipedia.org/wiki/Haversine_formula) to account for global curvature.
 *
 * @name distance
 * @param {Coord} from origin point
 * @param {Coord} to destination point
 * @param {Object} [options={}] Optional parameters
 * @param {string} [options.units='kilometers'] can be degrees, radians, miles, or kilometers
 * @returns {number} distance between the two points
 * @example
 * var from = turf.point([-75.343, 39.984]);
 * var to = turf.point([-75.534, 39.123]);
 * var options = {units: 'miles'};
 *
 * var distance = turf.distance(from, to, options);
 *
 * //addToMap
 * var addToMap = [from, to];
 * from.properties.distance = distance;
 * to.properties.distance = distance;
 */
function distance(from, to, options) {
    if (options === void 0) { options = {}; }
    var coordinates1 = invariant_1.getCoord(from);
    var coordinates2 = invariant_1.getCoord(to);
    var dLat = helpers_1.degreesToRadians((coordinates2[1] - coordinates1[1]));
    var dLon = helpers_1.degreesToRadians((coordinates2[0] - coordinates1[0]));
    var lat1 = helpers_1.degreesToRadians(coordinates1[1]);
    var lat2 = helpers_1.degreesToRadians(coordinates2[1]);
    var a = Math.pow(Math.sin(dLat / 2), 2) +
        Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
    return helpers_1.radiansToLength(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)), options.units);
}
exports.default = distance;

},{"@turf/helpers":6,"@turf/invariant":7}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @module helpers
 */
/**
 * Earth Radius used with the Harvesine formula and approximates using a spherical (non-ellipsoid) Earth.
 *
 * @memberof helpers
 * @type {number}
 */
exports.earthRadius = 6371008.8;
/**
 * Unit of measurement factors using a spherical (non-ellipsoid) earth radius.
 *
 * @memberof helpers
 * @type {Object}
 */
exports.factors = {
    centimeters: exports.earthRadius * 100,
    centimetres: exports.earthRadius * 100,
    degrees: exports.earthRadius / 111325,
    feet: exports.earthRadius * 3.28084,
    inches: exports.earthRadius * 39.370,
    kilometers: exports.earthRadius / 1000,
    kilometres: exports.earthRadius / 1000,
    meters: exports.earthRadius,
    metres: exports.earthRadius,
    miles: exports.earthRadius / 1609.344,
    millimeters: exports.earthRadius * 1000,
    millimetres: exports.earthRadius * 1000,
    nauticalmiles: exports.earthRadius / 1852,
    radians: 1,
    yards: exports.earthRadius / 1.0936,
};
/**
 * Units of measurement factors based on 1 meter.
 *
 * @memberof helpers
 * @type {Object}
 */
exports.unitsFactors = {
    centimeters: 100,
    centimetres: 100,
    degrees: 1 / 111325,
    feet: 3.28084,
    inches: 39.370,
    kilometers: 1 / 1000,
    kilometres: 1 / 1000,
    meters: 1,
    metres: 1,
    miles: 1 / 1609.344,
    millimeters: 1000,
    millimetres: 1000,
    nauticalmiles: 1 / 1852,
    radians: 1 / exports.earthRadius,
    yards: 1 / 1.0936,
};
/**
 * Area of measurement factors based on 1 square meter.
 *
 * @memberof helpers
 * @type {Object}
 */
exports.areaFactors = {
    acres: 0.000247105,
    centimeters: 10000,
    centimetres: 10000,
    feet: 10.763910417,
    inches: 1550.003100006,
    kilometers: 0.000001,
    kilometres: 0.000001,
    meters: 1,
    metres: 1,
    miles: 3.86e-7,
    millimeters: 1000000,
    millimetres: 1000000,
    yards: 1.195990046,
};
/**
 * Wraps a GeoJSON {@link Geometry} in a GeoJSON {@link Feature}.
 *
 * @name feature
 * @param {Geometry} geometry input geometry
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature} a GeoJSON Feature
 * @example
 * var geometry = {
 *   "type": "Point",
 *   "coordinates": [110, 50]
 * };
 *
 * var feature = turf.feature(geometry);
 *
 * //=feature
 */
function feature(geom, properties, options) {
    if (options === void 0) { options = {}; }
    var feat = { type: "Feature" };
    if (options.id === 0 || options.id) {
        feat.id = options.id;
    }
    if (options.bbox) {
        feat.bbox = options.bbox;
    }
    feat.properties = properties || {};
    feat.geometry = geom;
    return feat;
}
exports.feature = feature;
/**
 * Creates a GeoJSON {@link Geometry} from a Geometry string type & coordinates.
 * For GeometryCollection type use `helpers.geometryCollection`
 *
 * @name geometry
 * @param {string} type Geometry Type
 * @param {Array<any>} coordinates Coordinates
 * @param {Object} [options={}] Optional Parameters
 * @returns {Geometry} a GeoJSON Geometry
 * @example
 * var type = "Point";
 * var coordinates = [110, 50];
 * var geometry = turf.geometry(type, coordinates);
 * // => geometry
 */
function geometry(type, coordinates, options) {
    if (options === void 0) { options = {}; }
    switch (type) {
        case "Point": return point(coordinates).geometry;
        case "LineString": return lineString(coordinates).geometry;
        case "Polygon": return polygon(coordinates).geometry;
        case "MultiPoint": return multiPoint(coordinates).geometry;
        case "MultiLineString": return multiLineString(coordinates).geometry;
        case "MultiPolygon": return multiPolygon(coordinates).geometry;
        default: throw new Error(type + " is invalid");
    }
}
exports.geometry = geometry;
/**
 * Creates a {@link Point} {@link Feature} from a Position.
 *
 * @name point
 * @param {Array<number>} coordinates longitude, latitude position (each in decimal degrees)
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<Point>} a Point feature
 * @example
 * var point = turf.point([-75.343, 39.984]);
 *
 * //=point
 */
function point(coordinates, properties, options) {
    if (options === void 0) { options = {}; }
    var geom = {
        type: "Point",
        coordinates: coordinates,
    };
    return feature(geom, properties, options);
}
exports.point = point;
/**
 * Creates a {@link Point} {@link FeatureCollection} from an Array of Point coordinates.
 *
 * @name points
 * @param {Array<Array<number>>} coordinates an array of Points
 * @param {Object} [properties={}] Translate these properties to each Feature
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north]
 * associated with the FeatureCollection
 * @param {string|number} [options.id] Identifier associated with the FeatureCollection
 * @returns {FeatureCollection<Point>} Point Feature
 * @example
 * var points = turf.points([
 *   [-75, 39],
 *   [-80, 45],
 *   [-78, 50]
 * ]);
 *
 * //=points
 */
function points(coordinates, properties, options) {
    if (options === void 0) { options = {}; }
    return featureCollection(coordinates.map(function (coords) {
        return point(coords, properties);
    }), options);
}
exports.points = points;
/**
 * Creates a {@link Polygon} {@link Feature} from an Array of LinearRings.
 *
 * @name polygon
 * @param {Array<Array<Array<number>>>} coordinates an array of LinearRings
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<Polygon>} Polygon Feature
 * @example
 * var polygon = turf.polygon([[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]], { name: 'poly1' });
 *
 * //=polygon
 */
function polygon(coordinates, properties, options) {
    if (options === void 0) { options = {}; }
    for (var _i = 0, coordinates_1 = coordinates; _i < coordinates_1.length; _i++) {
        var ring = coordinates_1[_i];
        if (ring.length < 4) {
            throw new Error("Each LinearRing of a Polygon must have 4 or more Positions.");
        }
        for (var j = 0; j < ring[ring.length - 1].length; j++) {
            // Check if first point of Polygon contains two numbers
            if (ring[ring.length - 1][j] !== ring[0][j]) {
                throw new Error("First and last Position are not equivalent.");
            }
        }
    }
    var geom = {
        type: "Polygon",
        coordinates: coordinates,
    };
    return feature(geom, properties, options);
}
exports.polygon = polygon;
/**
 * Creates a {@link Polygon} {@link FeatureCollection} from an Array of Polygon coordinates.
 *
 * @name polygons
 * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygon coordinates
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the FeatureCollection
 * @returns {FeatureCollection<Polygon>} Polygon FeatureCollection
 * @example
 * var polygons = turf.polygons([
 *   [[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]],
 *   [[[-15, 42], [-14, 46], [-12, 41], [-17, 44], [-15, 42]]],
 * ]);
 *
 * //=polygons
 */
function polygons(coordinates, properties, options) {
    if (options === void 0) { options = {}; }
    return featureCollection(coordinates.map(function (coords) {
        return polygon(coords, properties);
    }), options);
}
exports.polygons = polygons;
/**
 * Creates a {@link LineString} {@link Feature} from an Array of Positions.
 *
 * @name lineString
 * @param {Array<Array<number>>} coordinates an array of Positions
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<LineString>} LineString Feature
 * @example
 * var linestring1 = turf.lineString([[-24, 63], [-23, 60], [-25, 65], [-20, 69]], {name: 'line 1'});
 * var linestring2 = turf.lineString([[-14, 43], [-13, 40], [-15, 45], [-10, 49]], {name: 'line 2'});
 *
 * //=linestring1
 * //=linestring2
 */
function lineString(coordinates, properties, options) {
    if (options === void 0) { options = {}; }
    if (coordinates.length < 2) {
        throw new Error("coordinates must be an array of two or more positions");
    }
    var geom = {
        type: "LineString",
        coordinates: coordinates,
    };
    return feature(geom, properties, options);
}
exports.lineString = lineString;
/**
 * Creates a {@link LineString} {@link FeatureCollection} from an Array of LineString coordinates.
 *
 * @name lineStrings
 * @param {Array<Array<Array<number>>>} coordinates an array of LinearRings
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north]
 * associated with the FeatureCollection
 * @param {string|number} [options.id] Identifier associated with the FeatureCollection
 * @returns {FeatureCollection<LineString>} LineString FeatureCollection
 * @example
 * var linestrings = turf.lineStrings([
 *   [[-24, 63], [-23, 60], [-25, 65], [-20, 69]],
 *   [[-14, 43], [-13, 40], [-15, 45], [-10, 49]]
 * ]);
 *
 * //=linestrings
 */
function lineStrings(coordinates, properties, options) {
    if (options === void 0) { options = {}; }
    return featureCollection(coordinates.map(function (coords) {
        return lineString(coords, properties);
    }), options);
}
exports.lineStrings = lineStrings;
/**
 * Takes one or more {@link Feature|Features} and creates a {@link FeatureCollection}.
 *
 * @name featureCollection
 * @param {Feature[]} features input features
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {FeatureCollection} FeatureCollection of Features
 * @example
 * var locationA = turf.point([-75.343, 39.984], {name: 'Location A'});
 * var locationB = turf.point([-75.833, 39.284], {name: 'Location B'});
 * var locationC = turf.point([-75.534, 39.123], {name: 'Location C'});
 *
 * var collection = turf.featureCollection([
 *   locationA,
 *   locationB,
 *   locationC
 * ]);
 *
 * //=collection
 */
function featureCollection(features, options) {
    if (options === void 0) { options = {}; }
    var fc = { type: "FeatureCollection" };
    if (options.id) {
        fc.id = options.id;
    }
    if (options.bbox) {
        fc.bbox = options.bbox;
    }
    fc.features = features;
    return fc;
}
exports.featureCollection = featureCollection;
/**
 * Creates a {@link Feature<MultiLineString>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiLineString
 * @param {Array<Array<Array<number>>>} coordinates an array of LineStrings
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<MultiLineString>} a MultiLineString feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiLine = turf.multiLineString([[[0,0],[10,10]]]);
 *
 * //=multiLine
 */
function multiLineString(coordinates, properties, options) {
    if (options === void 0) { options = {}; }
    var geom = {
        type: "MultiLineString",
        coordinates: coordinates,
    };
    return feature(geom, properties, options);
}
exports.multiLineString = multiLineString;
/**
 * Creates a {@link Feature<MultiPoint>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiPoint
 * @param {Array<Array<number>>} coordinates an array of Positions
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<MultiPoint>} a MultiPoint feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiPt = turf.multiPoint([[0,0],[10,10]]);
 *
 * //=multiPt
 */
function multiPoint(coordinates, properties, options) {
    if (options === void 0) { options = {}; }
    var geom = {
        type: "MultiPoint",
        coordinates: coordinates,
    };
    return feature(geom, properties, options);
}
exports.multiPoint = multiPoint;
/**
 * Creates a {@link Feature<MultiPolygon>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiPolygon
 * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygons
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<MultiPolygon>} a multipolygon feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiPoly = turf.multiPolygon([[[[0,0],[0,10],[10,10],[10,0],[0,0]]]]);
 *
 * //=multiPoly
 *
 */
function multiPolygon(coordinates, properties, options) {
    if (options === void 0) { options = {}; }
    var geom = {
        type: "MultiPolygon",
        coordinates: coordinates,
    };
    return feature(geom, properties, options);
}
exports.multiPolygon = multiPolygon;
/**
 * Creates a {@link Feature<GeometryCollection>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name geometryCollection
 * @param {Array<Geometry>} geometries an array of GeoJSON Geometries
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<GeometryCollection>} a GeoJSON GeometryCollection Feature
 * @example
 * var pt = turf.geometry("Point", [100, 0]);
 * var line = turf.geometry("LineString", [[101, 0], [102, 1]]);
 * var collection = turf.geometryCollection([pt, line]);
 *
 * // => collection
 */
function geometryCollection(geometries, properties, options) {
    if (options === void 0) { options = {}; }
    var geom = {
        type: "GeometryCollection",
        geometries: geometries,
    };
    return feature(geom, properties, options);
}
exports.geometryCollection = geometryCollection;
/**
 * Round number to precision
 *
 * @param {number} num Number
 * @param {number} [precision=0] Precision
 * @returns {number} rounded number
 * @example
 * turf.round(120.4321)
 * //=120
 *
 * turf.round(120.4321, 2)
 * //=120.43
 */
function round(num, precision) {
    if (precision === void 0) { precision = 0; }
    if (precision && !(precision >= 0)) {
        throw new Error("precision must be a positive number");
    }
    var multiplier = Math.pow(10, precision || 0);
    return Math.round(num * multiplier) / multiplier;
}
exports.round = round;
/**
 * Convert a distance measurement (assuming a spherical Earth) from radians to a more friendly unit.
 * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
 *
 * @name radiansToLength
 * @param {number} radians in radians across the sphere
 * @param {string} [units="kilometers"] can be degrees, radians, miles, or kilometers inches, yards, metres,
 * meters, kilometres, kilometers.
 * @returns {number} distance
 */
function radiansToLength(radians, units) {
    if (units === void 0) { units = "kilometers"; }
    var factor = exports.factors[units];
    if (!factor) {
        throw new Error(units + " units is invalid");
    }
    return radians * factor;
}
exports.radiansToLength = radiansToLength;
/**
 * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into radians
 * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
 *
 * @name lengthToRadians
 * @param {number} distance in real units
 * @param {string} [units="kilometers"] can be degrees, radians, miles, or kilometers inches, yards, metres,
 * meters, kilometres, kilometers.
 * @returns {number} radians
 */
function lengthToRadians(distance, units) {
    if (units === void 0) { units = "kilometers"; }
    var factor = exports.factors[units];
    if (!factor) {
        throw new Error(units + " units is invalid");
    }
    return distance / factor;
}
exports.lengthToRadians = lengthToRadians;
/**
 * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into degrees
 * Valid units: miles, nauticalmiles, inches, yards, meters, metres, centimeters, kilometres, feet
 *
 * @name lengthToDegrees
 * @param {number} distance in real units
 * @param {string} [units="kilometers"] can be degrees, radians, miles, or kilometers inches, yards, metres,
 * meters, kilometres, kilometers.
 * @returns {number} degrees
 */
function lengthToDegrees(distance, units) {
    return radiansToDegrees(lengthToRadians(distance, units));
}
exports.lengthToDegrees = lengthToDegrees;
/**
 * Converts any bearing angle from the north line direction (positive clockwise)
 * and returns an angle between 0-360 degrees (positive clockwise), 0 being the north line
 *
 * @name bearingToAzimuth
 * @param {number} bearing angle, between -180 and +180 degrees
 * @returns {number} angle between 0 and 360 degrees
 */
function bearingToAzimuth(bearing) {
    var angle = bearing % 360;
    if (angle < 0) {
        angle += 360;
    }
    return angle;
}
exports.bearingToAzimuth = bearingToAzimuth;
/**
 * Converts an angle in radians to degrees
 *
 * @name radiansToDegrees
 * @param {number} radians angle in radians
 * @returns {number} degrees between 0 and 360 degrees
 */
function radiansToDegrees(radians) {
    var degrees = radians % (2 * Math.PI);
    return degrees * 180 / Math.PI;
}
exports.radiansToDegrees = radiansToDegrees;
/**
 * Converts an angle in degrees to radians
 *
 * @name degreesToRadians
 * @param {number} degrees angle between 0 and 360 degrees
 * @returns {number} angle in radians
 */
function degreesToRadians(degrees) {
    var radians = degrees % 360;
    return radians * Math.PI / 180;
}
exports.degreesToRadians = degreesToRadians;
/**
 * Converts a length to the requested unit.
 * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
 *
 * @param {number} length to be converted
 * @param {Units} [originalUnit="kilometers"] of the length
 * @param {Units} [finalUnit="kilometers"] returned unit
 * @returns {number} the converted length
 */
function convertLength(length, originalUnit, finalUnit) {
    if (originalUnit === void 0) { originalUnit = "kilometers"; }
    if (finalUnit === void 0) { finalUnit = "kilometers"; }
    if (!(length >= 0)) {
        throw new Error("length must be a positive number");
    }
    return radiansToLength(lengthToRadians(length, originalUnit), finalUnit);
}
exports.convertLength = convertLength;
/**
 * Converts a area to the requested unit.
 * Valid units: kilometers, kilometres, meters, metres, centimetres, millimeters, acres, miles, yards, feet, inches
 * @param {number} area to be converted
 * @param {Units} [originalUnit="meters"] of the distance
 * @param {Units} [finalUnit="kilometers"] returned unit
 * @returns {number} the converted distance
 */
function convertArea(area, originalUnit, finalUnit) {
    if (originalUnit === void 0) { originalUnit = "meters"; }
    if (finalUnit === void 0) { finalUnit = "kilometers"; }
    if (!(area >= 0)) {
        throw new Error("area must be a positive number");
    }
    var startFactor = exports.areaFactors[originalUnit];
    if (!startFactor) {
        throw new Error("invalid original units");
    }
    var finalFactor = exports.areaFactors[finalUnit];
    if (!finalFactor) {
        throw new Error("invalid final units");
    }
    return (area / startFactor) * finalFactor;
}
exports.convertArea = convertArea;
/**
 * isNumber
 *
 * @param {*} num Number to validate
 * @returns {boolean} true/false
 * @example
 * turf.isNumber(123)
 * //=true
 * turf.isNumber('foo')
 * //=false
 */
function isNumber(num) {
    return !isNaN(num) && num !== null && !Array.isArray(num) && !/^\s*$/.test(num);
}
exports.isNumber = isNumber;
/**
 * isObject
 *
 * @param {*} input variable to validate
 * @returns {boolean} true/false
 * @example
 * turf.isObject({elevation: 10})
 * //=true
 * turf.isObject('foo')
 * //=false
 */
function isObject(input) {
    return (!!input) && (input.constructor === Object);
}
exports.isObject = isObject;
/**
 * Validate BBox
 *
 * @private
 * @param {Array<number>} bbox BBox to validate
 * @returns {void}
 * @throws Error if BBox is not valid
 * @example
 * validateBBox([-180, -40, 110, 50])
 * //=OK
 * validateBBox([-180, -40])
 * //=Error
 * validateBBox('Foo')
 * //=Error
 * validateBBox(5)
 * //=Error
 * validateBBox(null)
 * //=Error
 * validateBBox(undefined)
 * //=Error
 */
function validateBBox(bbox) {
    if (!bbox) {
        throw new Error("bbox is required");
    }
    if (!Array.isArray(bbox)) {
        throw new Error("bbox must be an Array");
    }
    if (bbox.length !== 4 && bbox.length !== 6) {
        throw new Error("bbox must be an Array of 4 or 6 numbers");
    }
    bbox.forEach(function (num) {
        if (!isNumber(num)) {
            throw new Error("bbox must only contain numbers");
        }
    });
}
exports.validateBBox = validateBBox;
/**
 * Validate Id
 *
 * @private
 * @param {string|number} id Id to validate
 * @returns {void}
 * @throws Error if Id is not valid
 * @example
 * validateId([-180, -40, 110, 50])
 * //=Error
 * validateId([-180, -40])
 * //=Error
 * validateId('Foo')
 * //=OK
 * validateId(5)
 * //=OK
 * validateId(null)
 * //=Error
 * validateId(undefined)
 * //=Error
 */
function validateId(id) {
    if (!id) {
        throw new Error("id is required");
    }
    if (["string", "number"].indexOf(typeof id) === -1) {
        throw new Error("id must be a number or a string");
    }
}
exports.validateId = validateId;
// Deprecated methods
function radians2degrees() {
    throw new Error("method has been renamed to `radiansToDegrees`");
}
exports.radians2degrees = radians2degrees;
function degrees2radians() {
    throw new Error("method has been renamed to `degreesToRadians`");
}
exports.degrees2radians = degrees2radians;
function distanceToDegrees() {
    throw new Error("method has been renamed to `lengthToDegrees`");
}
exports.distanceToDegrees = distanceToDegrees;
function distanceToRadians() {
    throw new Error("method has been renamed to `lengthToRadians`");
}
exports.distanceToRadians = distanceToRadians;
function radiansToDistance() {
    throw new Error("method has been renamed to `radiansToLength`");
}
exports.radiansToDistance = radiansToDistance;
function bearingToAngle() {
    throw new Error("method has been renamed to `bearingToAzimuth`");
}
exports.bearingToAngle = bearingToAngle;
function convertDistance() {
    throw new Error("method has been renamed to `convertLength`");
}
exports.convertDistance = convertDistance;

},{}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var helpers_1 = require("@turf/helpers");
/**
 * Unwrap a coordinate from a Point Feature, Geometry or a single coordinate.
 *
 * @name getCoord
 * @param {Array<number>|Geometry<Point>|Feature<Point>} coord GeoJSON Point or an Array of numbers
 * @returns {Array<number>} coordinates
 * @example
 * var pt = turf.point([10, 10]);
 *
 * var coord = turf.getCoord(pt);
 * //= [10, 10]
 */
function getCoord(coord) {
    if (!coord) {
        throw new Error("coord is required");
    }
    if (!Array.isArray(coord)) {
        if (coord.type === "Feature" && coord.geometry !== null && coord.geometry.type === "Point") {
            return coord.geometry.coordinates;
        }
        if (coord.type === "Point") {
            return coord.coordinates;
        }
    }
    if (Array.isArray(coord) && coord.length >= 2 && !Array.isArray(coord[0]) && !Array.isArray(coord[1])) {
        return coord;
    }
    throw new Error("coord must be GeoJSON Point or an Array of numbers");
}
exports.getCoord = getCoord;
/**
 * Unwrap coordinates from a Feature, Geometry Object or an Array
 *
 * @name getCoords
 * @param {Array<any>|Geometry|Feature} coords Feature, Geometry Object or an Array
 * @returns {Array<any>} coordinates
 * @example
 * var poly = turf.polygon([[[119.32, -8.7], [119.55, -8.69], [119.51, -8.54], [119.32, -8.7]]]);
 *
 * var coords = turf.getCoords(poly);
 * //= [[[119.32, -8.7], [119.55, -8.69], [119.51, -8.54], [119.32, -8.7]]]
 */
function getCoords(coords) {
    if (Array.isArray(coords)) {
        return coords;
    }
    // Feature
    if (coords.type === "Feature") {
        if (coords.geometry !== null) {
            return coords.geometry.coordinates;
        }
    }
    else {
        // Geometry
        if (coords.coordinates) {
            return coords.coordinates;
        }
    }
    throw new Error("coords must be GeoJSON Feature, Geometry Object or an Array");
}
exports.getCoords = getCoords;
/**
 * Checks if coordinates contains a number
 *
 * @name containsNumber
 * @param {Array<any>} coordinates GeoJSON Coordinates
 * @returns {boolean} true if Array contains a number
 */
function containsNumber(coordinates) {
    if (coordinates.length > 1 && helpers_1.isNumber(coordinates[0]) && helpers_1.isNumber(coordinates[1])) {
        return true;
    }
    if (Array.isArray(coordinates[0]) && coordinates[0].length) {
        return containsNumber(coordinates[0]);
    }
    throw new Error("coordinates must only contain numbers");
}
exports.containsNumber = containsNumber;
/**
 * Enforce expectations about types of GeoJSON objects for Turf.
 *
 * @name geojsonType
 * @param {GeoJSON} value any GeoJSON object
 * @param {string} type expected GeoJSON type
 * @param {string} name name of calling function
 * @throws {Error} if value is not the expected type.
 */
function geojsonType(value, type, name) {
    if (!type || !name) {
        throw new Error("type and name required");
    }
    if (!value || value.type !== type) {
        throw new Error("Invalid input to " + name + ": must be a " + type + ", given " + value.type);
    }
}
exports.geojsonType = geojsonType;
/**
 * Enforce expectations about types of {@link Feature} inputs for Turf.
 * Internally this uses {@link geojsonType} to judge geometry types.
 *
 * @name featureOf
 * @param {Feature} feature a feature with an expected geometry type
 * @param {string} type expected GeoJSON type
 * @param {string} name name of calling function
 * @throws {Error} error if value is not the expected type.
 */
function featureOf(feature, type, name) {
    if (!feature) {
        throw new Error("No feature passed");
    }
    if (!name) {
        throw new Error(".featureOf() requires a name");
    }
    if (!feature || feature.type !== "Feature" || !feature.geometry) {
        throw new Error("Invalid input to " + name + ", Feature with geometry required");
    }
    if (!feature.geometry || feature.geometry.type !== type) {
        throw new Error("Invalid input to " + name + ": must be a " + type + ", given " + feature.geometry.type);
    }
}
exports.featureOf = featureOf;
/**
 * Enforce expectations about types of {@link FeatureCollection} inputs for Turf.
 * Internally this uses {@link geojsonType} to judge geometry types.
 *
 * @name collectionOf
 * @param {FeatureCollection} featureCollection a FeatureCollection for which features will be judged
 * @param {string} type expected GeoJSON type
 * @param {string} name name of calling function
 * @throws {Error} if value is not the expected type.
 */
function collectionOf(featureCollection, type, name) {
    if (!featureCollection) {
        throw new Error("No featureCollection passed");
    }
    if (!name) {
        throw new Error(".collectionOf() requires a name");
    }
    if (!featureCollection || featureCollection.type !== "FeatureCollection") {
        throw new Error("Invalid input to " + name + ", FeatureCollection required");
    }
    for (var _i = 0, _a = featureCollection.features; _i < _a.length; _i++) {
        var feature = _a[_i];
        if (!feature || feature.type !== "Feature" || !feature.geometry) {
            throw new Error("Invalid input to " + name + ", Feature with geometry required");
        }
        if (!feature.geometry || feature.geometry.type !== type) {
            throw new Error("Invalid input to " + name + ": must be a " + type + ", given " + feature.geometry.type);
        }
    }
}
exports.collectionOf = collectionOf;
/**
 * Get Geometry from Feature or Geometry Object
 *
 * @param {Feature|Geometry} geojson GeoJSON Feature or Geometry Object
 * @returns {Geometry|null} GeoJSON Geometry Object
 * @throws {Error} if geojson is not a Feature or Geometry Object
 * @example
 * var point = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [110, 40]
 *   }
 * }
 * var geom = turf.getGeom(point)
 * //={"type": "Point", "coordinates": [110, 40]}
 */
function getGeom(geojson) {
    if (geojson.type === "Feature") {
        return geojson.geometry;
    }
    return geojson;
}
exports.getGeom = getGeom;
/**
 * Get GeoJSON object's type, Geometry type is prioritize.
 *
 * @param {GeoJSON} geojson GeoJSON object
 * @param {string} [name="geojson"] name of the variable to display in error message
 * @returns {string} GeoJSON type
 * @example
 * var point = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [110, 40]
 *   }
 * }
 * var geom = turf.getType(point)
 * //="Point"
 */
function getType(geojson, name) {
    if (geojson.type === "FeatureCollection") {
        return "FeatureCollection";
    }
    if (geojson.type === "GeometryCollection") {
        return "GeometryCollection";
    }
    if (geojson.type === "Feature" && geojson.geometry !== null) {
        return geojson.geometry.type;
    }
    return geojson.type;
}
exports.getType = getType;

},{"@turf/helpers":6}],8:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
var helpers_1 = require("@turf/helpers");
var invariant_1 = require("@turf/invariant");
var line_segment_1 = __importDefault(require("@turf/line-segment"));
var meta_1 = require("@turf/meta");
var geojson_rbush_1 = __importDefault(require("geojson-rbush"));
/**
 * Takes any LineString or Polygon GeoJSON and returns the intersecting point(s).
 *
 * @name lineIntersect
 * @param {GeoJSON} line1 any LineString or Polygon
 * @param {GeoJSON} line2 any LineString or Polygon
 * @returns {FeatureCollection<Point>} point(s) that intersect both
 * @example
 * var line1 = turf.lineString([[126, -11], [129, -21]]);
 * var line2 = turf.lineString([[123, -18], [131, -14]]);
 * var intersects = turf.lineIntersect(line1, line2);
 *
 * //addToMap
 * var addToMap = [line1, line2, intersects]
 */
function lineIntersect(line1, line2) {
    var unique = {};
    var results = [];
    // First, normalize geometries to features
    // Then, handle simple 2-vertex segments
    if (line1.type === "LineString") {
        line1 = helpers_1.feature(line1);
    }
    if (line2.type === "LineString") {
        line2 = helpers_1.feature(line2);
    }
    if (line1.type === "Feature" &&
        line2.type === "Feature" &&
        line1.geometry !== null &&
        line2.geometry !== null &&
        line1.geometry.type === "LineString" &&
        line2.geometry.type === "LineString" &&
        line1.geometry.coordinates.length === 2 &&
        line2.geometry.coordinates.length === 2) {
        var intersect = intersects(line1, line2);
        if (intersect) {
            results.push(intersect);
        }
        return helpers_1.featureCollection(results);
    }
    // Handles complex GeoJSON Geometries
    var tree = geojson_rbush_1.default();
    tree.load(line_segment_1.default(line2));
    meta_1.featureEach(line_segment_1.default(line1), function (segment) {
        meta_1.featureEach(tree.search(segment), function (match) {
            var intersect = intersects(segment, match);
            if (intersect) {
                // prevent duplicate points https://github.com/Turfjs/turf/issues/688
                var key = invariant_1.getCoords(intersect).join(",");
                if (!unique[key]) {
                    unique[key] = true;
                    results.push(intersect);
                }
            }
        });
    });
    return helpers_1.featureCollection(results);
}
/**
 * Find a point that intersects LineStrings with two coordinates each
 *
 * @private
 * @param {Feature<LineString>} line1 GeoJSON LineString (Must only contain 2 coordinates)
 * @param {Feature<LineString>} line2 GeoJSON LineString (Must only contain 2 coordinates)
 * @returns {Feature<Point>} intersecting GeoJSON Point
 */
function intersects(line1, line2) {
    var coords1 = invariant_1.getCoords(line1);
    var coords2 = invariant_1.getCoords(line2);
    if (coords1.length !== 2) {
        throw new Error("<intersects> line1 must only contain 2 coordinates");
    }
    if (coords2.length !== 2) {
        throw new Error("<intersects> line2 must only contain 2 coordinates");
    }
    var x1 = coords1[0][0];
    var y1 = coords1[0][1];
    var x2 = coords1[1][0];
    var y2 = coords1[1][1];
    var x3 = coords2[0][0];
    var y3 = coords2[0][1];
    var x4 = coords2[1][0];
    var y4 = coords2[1][1];
    var denom = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));
    var numeA = ((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3));
    var numeB = ((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3));
    if (denom === 0) {
        if (numeA === 0 && numeB === 0) {
            return null;
        }
        return null;
    }
    var uA = numeA / denom;
    var uB = numeB / denom;
    if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
        var x = x1 + (uA * (x2 - x1));
        var y = y1 + (uA * (y2 - y1));
        return helpers_1.point([x, y]);
    }
    return null;
}
exports.default = lineIntersect;

},{"@turf/helpers":6,"@turf/invariant":7,"@turf/line-segment":9,"@turf/meta":10,"geojson-rbush":13}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var helpers_1 = require("@turf/helpers");
var invariant_1 = require("@turf/invariant");
var meta_1 = require("@turf/meta");
/**
 * Creates a {@link FeatureCollection} of 2-vertex {@link LineString} segments from a
 * {@link LineString|(Multi)LineString} or {@link Polygon|(Multi)Polygon}.
 *
 * @name lineSegment
 * @param {GeoJSON} geojson GeoJSON Polygon or LineString
 * @returns {FeatureCollection<LineString>} 2-vertex line segments
 * @example
 * var polygon = turf.polygon([[[-50, 5], [-40, -10], [-50, -10], [-40, 5], [-50, 5]]]);
 * var segments = turf.lineSegment(polygon);
 *
 * //addToMap
 * var addToMap = [polygon, segments]
 */
function lineSegment(geojson) {
    if (!geojson) {
        throw new Error("geojson is required");
    }
    var results = [];
    meta_1.flattenEach(geojson, function (feature) {
        lineSegmentFeature(feature, results);
    });
    return helpers_1.featureCollection(results);
}
/**
 * Line Segment
 *
 * @private
 * @param {Feature<LineString|Polygon>} geojson Line or polygon feature
 * @param {Array} results push to results
 * @returns {void}
 */
function lineSegmentFeature(geojson, results) {
    var coords = [];
    var geometry = geojson.geometry;
    if (geometry !== null) {
        switch (geometry.type) {
            case "Polygon":
                coords = invariant_1.getCoords(geometry);
                break;
            case "LineString":
                coords = [invariant_1.getCoords(geometry)];
        }
        coords.forEach(function (coord) {
            var segments = createSegments(coord, geojson.properties);
            segments.forEach(function (segment) {
                segment.id = results.length;
                results.push(segment);
            });
        });
    }
}
/**
 * Create Segments from LineString coordinates
 *
 * @private
 * @param {Array<Array<number>>} coords LineString coordinates
 * @param {*} properties GeoJSON properties
 * @returns {Array<Feature<LineString>>} line segments
 */
function createSegments(coords, properties) {
    var segments = [];
    coords.reduce(function (previousCoords, currentCoords) {
        var segment = helpers_1.lineString([previousCoords, currentCoords], properties);
        segment.bbox = bbox(previousCoords, currentCoords);
        segments.push(segment);
        return currentCoords;
    });
    return segments;
}
/**
 * Create BBox between two coordinates (faster than @turf/bbox)
 *
 * @private
 * @param {Array<number>} coords1 Point coordinate
 * @param {Array<number>} coords2 Point coordinate
 * @returns {BBox} [west, south, east, north]
 */
function bbox(coords1, coords2) {
    var x1 = coords1[0];
    var y1 = coords1[1];
    var x2 = coords2[0];
    var y2 = coords2[1];
    var west = (x1 < x2) ? x1 : x2;
    var south = (y1 < y2) ? y1 : y2;
    var east = (x1 > x2) ? x1 : x2;
    var north = (y1 > y2) ? y1 : y2;
    return [west, south, east, north];
}
exports.default = lineSegment;

},{"@turf/helpers":6,"@turf/invariant":7,"@turf/meta":10}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var helpers = require('@turf/helpers');

/**
 * Callback for coordEach
 *
 * @callback coordEachCallback
 * @param {Array<number>} currentCoord The current coordinate being processed.
 * @param {number} coordIndex The current index of the coordinate being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 * @param {number} geometryIndex The current index of the Geometry being processed.
 */

/**
 * Iterate over coordinates in any GeoJSON object, similar to Array.forEach()
 *
 * @name coordEach
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (currentCoord, coordIndex, featureIndex, multiFeatureIndex)
 * @param {boolean} [excludeWrapCoord=false] whether or not to include the final coordinate of LinearRings that wraps the ring in its iteration.
 * @returns {void}
 * @example
 * var features = turf.featureCollection([
 *   turf.point([26, 37], {"foo": "bar"}),
 *   turf.point([36, 53], {"hello": "world"})
 * ]);
 *
 * turf.coordEach(features, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
 *   //=currentCoord
 *   //=coordIndex
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   //=geometryIndex
 * });
 */
function coordEach(geojson, callback, excludeWrapCoord) {
    // Handles null Geometry -- Skips this GeoJSON
    if (geojson === null) return;
    var j, k, l, geometry, stopG, coords,
        geometryMaybeCollection,
        wrapShrink = 0,
        coordIndex = 0,
        isGeometryCollection,
        type = geojson.type,
        isFeatureCollection = type === 'FeatureCollection',
        isFeature = type === 'Feature',
        stop = isFeatureCollection ? geojson.features.length : 1;

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
    for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
        geometryMaybeCollection = (isFeatureCollection ? geojson.features[featureIndex].geometry :
            (isFeature ? geojson.geometry : geojson));
        isGeometryCollection = (geometryMaybeCollection) ? geometryMaybeCollection.type === 'GeometryCollection' : false;
        stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;

        for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
            var multiFeatureIndex = 0;
            var geometryIndex = 0;
            geometry = isGeometryCollection ?
                geometryMaybeCollection.geometries[geomIndex] : geometryMaybeCollection;

            // Handles null Geometry -- Skips this geometry
            if (geometry === null) continue;
            coords = geometry.coordinates;
            var geomType = geometry.type;

            wrapShrink = (excludeWrapCoord && (geomType === 'Polygon' || geomType === 'MultiPolygon')) ? 1 : 0;

            switch (geomType) {
            case null:
                break;
            case 'Point':
                if (callback(coords, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                coordIndex++;
                multiFeatureIndex++;
                break;
            case 'LineString':
            case 'MultiPoint':
                for (j = 0; j < coords.length; j++) {
                    if (callback(coords[j], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                    coordIndex++;
                    if (geomType === 'MultiPoint') multiFeatureIndex++;
                }
                if (geomType === 'LineString') multiFeatureIndex++;
                break;
            case 'Polygon':
            case 'MultiLineString':
                for (j = 0; j < coords.length; j++) {
                    for (k = 0; k < coords[j].length - wrapShrink; k++) {
                        if (callback(coords[j][k], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                        coordIndex++;
                    }
                    if (geomType === 'MultiLineString') multiFeatureIndex++;
                    if (geomType === 'Polygon') geometryIndex++;
                }
                if (geomType === 'Polygon') multiFeatureIndex++;
                break;
            case 'MultiPolygon':
                for (j = 0; j < coords.length; j++) {
                    geometryIndex = 0;
                    for (k = 0; k < coords[j].length; k++) {
                        for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
                            if (callback(coords[j][k][l], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                            coordIndex++;
                        }
                        geometryIndex++;
                    }
                    multiFeatureIndex++;
                }
                break;
            case 'GeometryCollection':
                for (j = 0; j < geometry.geometries.length; j++)
                    if (coordEach(geometry.geometries[j], callback, excludeWrapCoord) === false) return false;
                break;
            default:
                throw new Error('Unknown Geometry Type');
            }
        }
    }
}

/**
 * Callback for coordReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback coordReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Array<number>} currentCoord The current coordinate being processed.
 * @param {number} coordIndex The current index of the coordinate being processed.
 * Starts at index 0, if an initialValue is provided, and at index 1 otherwise.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 * @param {number} geometryIndex The current index of the Geometry being processed.
 */

/**
 * Reduce coordinates in any GeoJSON object, similar to Array.reduce()
 *
 * @name coordReduce
 * @param {FeatureCollection|Geometry|Feature} geojson any GeoJSON object
 * @param {Function} callback a method that takes (previousValue, currentCoord, coordIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @param {boolean} [excludeWrapCoord=false] whether or not to include the final coordinate of LinearRings that wraps the ring in its iteration.
 * @returns {*} The value that results from the reduction.
 * @example
 * var features = turf.featureCollection([
 *   turf.point([26, 37], {"foo": "bar"}),
 *   turf.point([36, 53], {"hello": "world"})
 * ]);
 *
 * turf.coordReduce(features, function (previousValue, currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
 *   //=previousValue
 *   //=currentCoord
 *   //=coordIndex
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   //=geometryIndex
 *   return currentCoord;
 * });
 */
function coordReduce(geojson, callback, initialValue, excludeWrapCoord) {
    var previousValue = initialValue;
    coordEach(geojson, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
        if (coordIndex === 0 && initialValue === undefined) previousValue = currentCoord;
        else previousValue = callback(previousValue, currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex);
    }, excludeWrapCoord);
    return previousValue;
}

/**
 * Callback for propEach
 *
 * @callback propEachCallback
 * @param {Object} currentProperties The current Properties being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 */

/**
 * Iterate over properties in any GeoJSON object, similar to Array.forEach()
 *
 * @name propEach
 * @param {FeatureCollection|Feature} geojson any GeoJSON object
 * @param {Function} callback a method that takes (currentProperties, featureIndex)
 * @returns {void}
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * turf.propEach(features, function (currentProperties, featureIndex) {
 *   //=currentProperties
 *   //=featureIndex
 * });
 */
function propEach(geojson, callback) {
    var i;
    switch (geojson.type) {
    case 'FeatureCollection':
        for (i = 0; i < geojson.features.length; i++) {
            if (callback(geojson.features[i].properties, i) === false) break;
        }
        break;
    case 'Feature':
        callback(geojson.properties, 0);
        break;
    }
}


/**
 * Callback for propReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback propReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {*} currentProperties The current Properties being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 */

/**
 * Reduce properties in any GeoJSON object into a single value,
 * similar to how Array.reduce works. However, in this case we lazily run
 * the reduction, so an array of all properties is unnecessary.
 *
 * @name propReduce
 * @param {FeatureCollection|Feature} geojson any GeoJSON object
 * @param {Function} callback a method that takes (previousValue, currentProperties, featureIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {*} The value that results from the reduction.
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * turf.propReduce(features, function (previousValue, currentProperties, featureIndex) {
 *   //=previousValue
 *   //=currentProperties
 *   //=featureIndex
 *   return currentProperties
 * });
 */
function propReduce(geojson, callback, initialValue) {
    var previousValue = initialValue;
    propEach(geojson, function (currentProperties, featureIndex) {
        if (featureIndex === 0 && initialValue === undefined) previousValue = currentProperties;
        else previousValue = callback(previousValue, currentProperties, featureIndex);
    });
    return previousValue;
}

/**
 * Callback for featureEach
 *
 * @callback featureEachCallback
 * @param {Feature<any>} currentFeature The current Feature being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 */

/**
 * Iterate over features in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @name featureEach
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (currentFeature, featureIndex)
 * @returns {void}
 * @example
 * var features = turf.featureCollection([
 *   turf.point([26, 37], {foo: 'bar'}),
 *   turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * turf.featureEach(features, function (currentFeature, featureIndex) {
 *   //=currentFeature
 *   //=featureIndex
 * });
 */
function featureEach(geojson, callback) {
    if (geojson.type === 'Feature') {
        callback(geojson, 0);
    } else if (geojson.type === 'FeatureCollection') {
        for (var i = 0; i < geojson.features.length; i++) {
            if (callback(geojson.features[i], i) === false) break;
        }
    }
}

/**
 * Callback for featureReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback featureReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Feature} currentFeature The current Feature being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 */

/**
 * Reduce features in any GeoJSON object, similar to Array.reduce().
 *
 * @name featureReduce
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (previousValue, currentFeature, featureIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {*} The value that results from the reduction.
 * @example
 * var features = turf.featureCollection([
 *   turf.point([26, 37], {"foo": "bar"}),
 *   turf.point([36, 53], {"hello": "world"})
 * ]);
 *
 * turf.featureReduce(features, function (previousValue, currentFeature, featureIndex) {
 *   //=previousValue
 *   //=currentFeature
 *   //=featureIndex
 *   return currentFeature
 * });
 */
function featureReduce(geojson, callback, initialValue) {
    var previousValue = initialValue;
    featureEach(geojson, function (currentFeature, featureIndex) {
        if (featureIndex === 0 && initialValue === undefined) previousValue = currentFeature;
        else previousValue = callback(previousValue, currentFeature, featureIndex);
    });
    return previousValue;
}

/**
 * Get all coordinates from any GeoJSON object.
 *
 * @name coordAll
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @returns {Array<Array<number>>} coordinate position array
 * @example
 * var features = turf.featureCollection([
 *   turf.point([26, 37], {foo: 'bar'}),
 *   turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * var coords = turf.coordAll(features);
 * //= [[26, 37], [36, 53]]
 */
function coordAll(geojson) {
    var coords = [];
    coordEach(geojson, function (coord) {
        coords.push(coord);
    });
    return coords;
}

/**
 * Callback for geomEach
 *
 * @callback geomEachCallback
 * @param {Geometry} currentGeometry The current Geometry being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {Object} featureProperties The current Feature Properties being processed.
 * @param {Array<number>} featureBBox The current Feature BBox being processed.
 * @param {number|string} featureId The current Feature Id being processed.
 */

/**
 * Iterate over each geometry in any GeoJSON object, similar to Array.forEach()
 *
 * @name geomEach
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (currentGeometry, featureIndex, featureProperties, featureBBox, featureId)
 * @returns {void}
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * turf.geomEach(features, function (currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
 *   //=currentGeometry
 *   //=featureIndex
 *   //=featureProperties
 *   //=featureBBox
 *   //=featureId
 * });
 */
function geomEach(geojson, callback) {
    var i, j, g, geometry, stopG,
        geometryMaybeCollection,
        isGeometryCollection,
        featureProperties,
        featureBBox,
        featureId,
        featureIndex = 0,
        isFeatureCollection = geojson.type === 'FeatureCollection',
        isFeature = geojson.type === 'Feature',
        stop = isFeatureCollection ? geojson.features.length : 1;

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

        geometryMaybeCollection = (isFeatureCollection ? geojson.features[i].geometry :
            (isFeature ? geojson.geometry : geojson));
        featureProperties = (isFeatureCollection ? geojson.features[i].properties :
            (isFeature ? geojson.properties : {}));
        featureBBox = (isFeatureCollection ? geojson.features[i].bbox :
            (isFeature ? geojson.bbox : undefined));
        featureId = (isFeatureCollection ? geojson.features[i].id :
            (isFeature ? geojson.id : undefined));
        isGeometryCollection = (geometryMaybeCollection) ? geometryMaybeCollection.type === 'GeometryCollection' : false;
        stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;

        for (g = 0; g < stopG; g++) {
            geometry = isGeometryCollection ?
                geometryMaybeCollection.geometries[g] : geometryMaybeCollection;

            // Handle null Geometry
            if (geometry === null) {
                if (callback(null, featureIndex, featureProperties, featureBBox, featureId) === false) return false;
                continue;
            }
            switch (geometry.type) {
            case 'Point':
            case 'LineString':
            case 'MultiPoint':
            case 'Polygon':
            case 'MultiLineString':
            case 'MultiPolygon': {
                if (callback(geometry, featureIndex, featureProperties, featureBBox, featureId) === false) return false;
                break;
            }
            case 'GeometryCollection': {
                for (j = 0; j < geometry.geometries.length; j++) {
                    if (callback(geometry.geometries[j], featureIndex, featureProperties, featureBBox, featureId) === false) return false;
                }
                break;
            }
            default:
                throw new Error('Unknown Geometry Type');
            }
        }
        // Only increase `featureIndex` per each feature
        featureIndex++;
    }
}

/**
 * Callback for geomReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback geomReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Geometry} currentGeometry The current Geometry being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {Object} featureProperties The current Feature Properties being processed.
 * @param {Array<number>} featureBBox The current Feature BBox being processed.
 * @param {number|string} featureId The current Feature Id being processed.
 */

/**
 * Reduce geometry in any GeoJSON object, similar to Array.reduce().
 *
 * @name geomReduce
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (previousValue, currentGeometry, featureIndex, featureProperties, featureBBox, featureId)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {*} The value that results from the reduction.
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * turf.geomReduce(features, function (previousValue, currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
 *   //=previousValue
 *   //=currentGeometry
 *   //=featureIndex
 *   //=featureProperties
 *   //=featureBBox
 *   //=featureId
 *   return currentGeometry
 * });
 */
function geomReduce(geojson, callback, initialValue) {
    var previousValue = initialValue;
    geomEach(geojson, function (currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
        if (featureIndex === 0 && initialValue === undefined) previousValue = currentGeometry;
        else previousValue = callback(previousValue, currentGeometry, featureIndex, featureProperties, featureBBox, featureId);
    });
    return previousValue;
}

/**
 * Callback for flattenEach
 *
 * @callback flattenEachCallback
 * @param {Feature} currentFeature The current flattened feature being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 */

/**
 * Iterate over flattened features in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @name flattenEach
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (currentFeature, featureIndex, multiFeatureIndex)
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.multiPoint([[40, 30], [36, 53]], {hello: 'world'})
 * ]);
 *
 * turf.flattenEach(features, function (currentFeature, featureIndex, multiFeatureIndex) {
 *   //=currentFeature
 *   //=featureIndex
 *   //=multiFeatureIndex
 * });
 */
function flattenEach(geojson, callback) {
    geomEach(geojson, function (geometry, featureIndex, properties, bbox, id) {
        // Callback for single geometry
        var type = (geometry === null) ? null : geometry.type;
        switch (type) {
        case null:
        case 'Point':
        case 'LineString':
        case 'Polygon':
            if (callback(helpers.feature(geometry, properties, {bbox: bbox, id: id}), featureIndex, 0) === false) return false;
            return;
        }

        var geomType;

        // Callback for multi-geometry
        switch (type) {
        case 'MultiPoint':
            geomType = 'Point';
            break;
        case 'MultiLineString':
            geomType = 'LineString';
            break;
        case 'MultiPolygon':
            geomType = 'Polygon';
            break;
        }

        for (var multiFeatureIndex = 0; multiFeatureIndex < geometry.coordinates.length; multiFeatureIndex++) {
            var coordinate = geometry.coordinates[multiFeatureIndex];
            var geom = {
                type: geomType,
                coordinates: coordinate
            };
            if (callback(helpers.feature(geom, properties), featureIndex, multiFeatureIndex) === false) return false;
        }
    });
}

/**
 * Callback for flattenReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback flattenReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Feature} currentFeature The current Feature being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 */

/**
 * Reduce flattened features in any GeoJSON object, similar to Array.reduce().
 *
 * @name flattenReduce
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (previousValue, currentFeature, featureIndex, multiFeatureIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {*} The value that results from the reduction.
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.multiPoint([[40, 30], [36, 53]], {hello: 'world'})
 * ]);
 *
 * turf.flattenReduce(features, function (previousValue, currentFeature, featureIndex, multiFeatureIndex) {
 *   //=previousValue
 *   //=currentFeature
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   return currentFeature
 * });
 */
function flattenReduce(geojson, callback, initialValue) {
    var previousValue = initialValue;
    flattenEach(geojson, function (currentFeature, featureIndex, multiFeatureIndex) {
        if (featureIndex === 0 && multiFeatureIndex === 0 && initialValue === undefined) previousValue = currentFeature;
        else previousValue = callback(previousValue, currentFeature, featureIndex, multiFeatureIndex);
    });
    return previousValue;
}

/**
 * Callback for segmentEach
 *
 * @callback segmentEachCallback
 * @param {Feature<LineString>} currentSegment The current Segment being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 * @param {number} geometryIndex The current index of the Geometry being processed.
 * @param {number} segmentIndex The current index of the Segment being processed.
 * @returns {void}
 */

/**
 * Iterate over 2-vertex line segment in any GeoJSON object, similar to Array.forEach()
 * (Multi)Point geometries do not contain segments therefore they are ignored during this operation.
 *
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON
 * @param {Function} callback a method that takes (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex)
 * @returns {void}
 * @example
 * var polygon = turf.polygon([[[-50, 5], [-40, -10], [-50, -10], [-40, 5], [-50, 5]]]);
 *
 * // Iterate over GeoJSON by 2-vertex segments
 * turf.segmentEach(polygon, function (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
 *   //=currentSegment
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   //=geometryIndex
 *   //=segmentIndex
 * });
 *
 * // Calculate the total number of segments
 * var total = 0;
 * turf.segmentEach(polygon, function () {
 *     total++;
 * });
 */
function segmentEach(geojson, callback) {
    flattenEach(geojson, function (feature, featureIndex, multiFeatureIndex) {
        var segmentIndex = 0;

        // Exclude null Geometries
        if (!feature.geometry) return;
        // (Multi)Point geometries do not contain segments therefore they are ignored during this operation.
        var type = feature.geometry.type;
        if (type === 'Point' || type === 'MultiPoint') return;

        // Generate 2-vertex line segments
        var previousCoords;
        var previousFeatureIndex = 0;
        var previousMultiIndex = 0;
        var prevGeomIndex = 0;
        if (coordEach(feature, function (currentCoord, coordIndex, featureIndexCoord, multiPartIndexCoord, geometryIndex) {
            // Simulating a meta.coordReduce() since `reduce` operations cannot be stopped by returning `false`
            if (previousCoords === undefined || featureIndex > previousFeatureIndex || multiPartIndexCoord > previousMultiIndex || geometryIndex > prevGeomIndex) {
                previousCoords = currentCoord;
                previousFeatureIndex = featureIndex;
                previousMultiIndex = multiPartIndexCoord;
                prevGeomIndex = geometryIndex;
                segmentIndex = 0;
                return;
            }
            var currentSegment = helpers.lineString([previousCoords, currentCoord], feature.properties);
            if (callback(currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) === false) return false;
            segmentIndex++;
            previousCoords = currentCoord;
        }) === false) return false;
    });
}

/**
 * Callback for segmentReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback segmentReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Feature<LineString>} currentSegment The current Segment being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 * @param {number} geometryIndex The current index of the Geometry being processed.
 * @param {number} segmentIndex The current index of the Segment being processed.
 */

/**
 * Reduce 2-vertex line segment in any GeoJSON object, similar to Array.reduce()
 * (Multi)Point geometries do not contain segments therefore they are ignored during this operation.
 *
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON
 * @param {Function} callback a method that takes (previousValue, currentSegment, currentIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {void}
 * @example
 * var polygon = turf.polygon([[[-50, 5], [-40, -10], [-50, -10], [-40, 5], [-50, 5]]]);
 *
 * // Iterate over GeoJSON by 2-vertex segments
 * turf.segmentReduce(polygon, function (previousSegment, currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
 *   //= previousSegment
 *   //= currentSegment
 *   //= featureIndex
 *   //= multiFeatureIndex
 *   //= geometryIndex
 *   //= segmentInex
 *   return currentSegment
 * });
 *
 * // Calculate the total number of segments
 * var initialValue = 0
 * var total = turf.segmentReduce(polygon, function (previousValue) {
 *     previousValue++;
 *     return previousValue;
 * }, initialValue);
 */
function segmentReduce(geojson, callback, initialValue) {
    var previousValue = initialValue;
    var started = false;
    segmentEach(geojson, function (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
        if (started === false && initialValue === undefined) previousValue = currentSegment;
        else previousValue = callback(previousValue, currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex);
        started = true;
    });
    return previousValue;
}

/**
 * Callback for lineEach
 *
 * @callback lineEachCallback
 * @param {Feature<LineString>} currentLine The current LineString|LinearRing being processed
 * @param {number} featureIndex The current index of the Feature being processed
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed
 * @param {number} geometryIndex The current index of the Geometry being processed
 */

/**
 * Iterate over line or ring coordinates in LineString, Polygon, MultiLineString, MultiPolygon Features or Geometries,
 * similar to Array.forEach.
 *
 * @name lineEach
 * @param {Geometry|Feature<LineString|Polygon|MultiLineString|MultiPolygon>} geojson object
 * @param {Function} callback a method that takes (currentLine, featureIndex, multiFeatureIndex, geometryIndex)
 * @example
 * var multiLine = turf.multiLineString([
 *   [[26, 37], [35, 45]],
 *   [[36, 53], [38, 50], [41, 55]]
 * ]);
 *
 * turf.lineEach(multiLine, function (currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
 *   //=currentLine
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   //=geometryIndex
 * });
 */
function lineEach(geojson, callback) {
    // validation
    if (!geojson) throw new Error('geojson is required');

    flattenEach(geojson, function (feature, featureIndex, multiFeatureIndex) {
        if (feature.geometry === null) return;
        var type = feature.geometry.type;
        var coords = feature.geometry.coordinates;
        switch (type) {
        case 'LineString':
            if (callback(feature, featureIndex, multiFeatureIndex, 0, 0) === false) return false;
            break;
        case 'Polygon':
            for (var geometryIndex = 0; geometryIndex < coords.length; geometryIndex++) {
                if (callback(helpers.lineString(coords[geometryIndex], feature.properties), featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
            }
            break;
        }
    });
}

/**
 * Callback for lineReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback lineReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Feature<LineString>} currentLine The current LineString|LinearRing being processed.
 * @param {number} featureIndex The current index of the Feature being processed
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed
 * @param {number} geometryIndex The current index of the Geometry being processed
 */

/**
 * Reduce features in any GeoJSON object, similar to Array.reduce().
 *
 * @name lineReduce
 * @param {Geometry|Feature<LineString|Polygon|MultiLineString|MultiPolygon>} geojson object
 * @param {Function} callback a method that takes (previousValue, currentLine, featureIndex, multiFeatureIndex, geometryIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {*} The value that results from the reduction.
 * @example
 * var multiPoly = turf.multiPolygon([
 *   turf.polygon([[[12,48],[2,41],[24,38],[12,48]], [[9,44],[13,41],[13,45],[9,44]]]),
 *   turf.polygon([[[5, 5], [0, 0], [2, 2], [4, 4], [5, 5]]])
 * ]);
 *
 * turf.lineReduce(multiPoly, function (previousValue, currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
 *   //=previousValue
 *   //=currentLine
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   //=geometryIndex
 *   return currentLine
 * });
 */
function lineReduce(geojson, callback, initialValue) {
    var previousValue = initialValue;
    lineEach(geojson, function (currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
        if (featureIndex === 0 && initialValue === undefined) previousValue = currentLine;
        else previousValue = callback(previousValue, currentLine, featureIndex, multiFeatureIndex, geometryIndex);
    });
    return previousValue;
}

/**
 * Finds a particular 2-vertex LineString Segment from a GeoJSON using `@turf/meta` indexes.
 *
 * Negative indexes are permitted.
 * Point & MultiPoint will always return null.
 *
 * @param {FeatureCollection|Feature|Geometry} geojson Any GeoJSON Feature or Geometry
 * @param {Object} [options={}] Optional parameters
 * @param {number} [options.featureIndex=0] Feature Index
 * @param {number} [options.multiFeatureIndex=0] Multi-Feature Index
 * @param {number} [options.geometryIndex=0] Geometry Index
 * @param {number} [options.segmentIndex=0] Segment Index
 * @param {Object} [options.properties={}] Translate Properties to output LineString
 * @param {BBox} [options.bbox={}] Translate BBox to output LineString
 * @param {number|string} [options.id={}] Translate Id to output LineString
 * @returns {Feature<LineString>} 2-vertex GeoJSON Feature LineString
 * @example
 * var multiLine = turf.multiLineString([
 *     [[10, 10], [50, 30], [30, 40]],
 *     [[-10, -10], [-50, -30], [-30, -40]]
 * ]);
 *
 * // First Segment (defaults are 0)
 * turf.findSegment(multiLine);
 * // => Feature<LineString<[[10, 10], [50, 30]]>>
 *
 * // First Segment of 2nd Multi Feature
 * turf.findSegment(multiLine, {multiFeatureIndex: 1});
 * // => Feature<LineString<[[-10, -10], [-50, -30]]>>
 *
 * // Last Segment of Last Multi Feature
 * turf.findSegment(multiLine, {multiFeatureIndex: -1, segmentIndex: -1});
 * // => Feature<LineString<[[-50, -30], [-30, -40]]>>
 */
function findSegment(geojson, options) {
    // Optional Parameters
    options = options || {};
    if (!helpers.isObject(options)) throw new Error('options is invalid');
    var featureIndex = options.featureIndex || 0;
    var multiFeatureIndex = options.multiFeatureIndex || 0;
    var geometryIndex = options.geometryIndex || 0;
    var segmentIndex = options.segmentIndex || 0;

    // Find FeatureIndex
    var properties = options.properties;
    var geometry;

    switch (geojson.type) {
    case 'FeatureCollection':
        if (featureIndex < 0) featureIndex = geojson.features.length + featureIndex;
        properties = properties || geojson.features[featureIndex].properties;
        geometry = geojson.features[featureIndex].geometry;
        break;
    case 'Feature':
        properties = properties || geojson.properties;
        geometry = geojson.geometry;
        break;
    case 'Point':
    case 'MultiPoint':
        return null;
    case 'LineString':
    case 'Polygon':
    case 'MultiLineString':
    case 'MultiPolygon':
        geometry = geojson;
        break;
    default:
        throw new Error('geojson is invalid');
    }

    // Find SegmentIndex
    if (geometry === null) return null;
    var coords = geometry.coordinates;
    switch (geometry.type) {
    case 'Point':
    case 'MultiPoint':
        return null;
    case 'LineString':
        if (segmentIndex < 0) segmentIndex = coords.length + segmentIndex - 1;
        return helpers.lineString([coords[segmentIndex], coords[segmentIndex + 1]], properties, options);
    case 'Polygon':
        if (geometryIndex < 0) geometryIndex = coords.length + geometryIndex;
        if (segmentIndex < 0) segmentIndex = coords[geometryIndex].length + segmentIndex - 1;
        return helpers.lineString([coords[geometryIndex][segmentIndex], coords[geometryIndex][segmentIndex + 1]], properties, options);
    case 'MultiLineString':
        if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
        if (segmentIndex < 0) segmentIndex = coords[multiFeatureIndex].length + segmentIndex - 1;
        return helpers.lineString([coords[multiFeatureIndex][segmentIndex], coords[multiFeatureIndex][segmentIndex + 1]], properties, options);
    case 'MultiPolygon':
        if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
        if (geometryIndex < 0) geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
        if (segmentIndex < 0) segmentIndex = coords[multiFeatureIndex][geometryIndex].length - segmentIndex - 1;
        return helpers.lineString([coords[multiFeatureIndex][geometryIndex][segmentIndex], coords[multiFeatureIndex][geometryIndex][segmentIndex + 1]], properties, options);
    }
    throw new Error('geojson is invalid');
}

/**
 * Finds a particular Point from a GeoJSON using `@turf/meta` indexes.
 *
 * Negative indexes are permitted.
 *
 * @param {FeatureCollection|Feature|Geometry} geojson Any GeoJSON Feature or Geometry
 * @param {Object} [options={}] Optional parameters
 * @param {number} [options.featureIndex=0] Feature Index
 * @param {number} [options.multiFeatureIndex=0] Multi-Feature Index
 * @param {number} [options.geometryIndex=0] Geometry Index
 * @param {number} [options.coordIndex=0] Coord Index
 * @param {Object} [options.properties={}] Translate Properties to output Point
 * @param {BBox} [options.bbox={}] Translate BBox to output Point
 * @param {number|string} [options.id={}] Translate Id to output Point
 * @returns {Feature<Point>} 2-vertex GeoJSON Feature Point
 * @example
 * var multiLine = turf.multiLineString([
 *     [[10, 10], [50, 30], [30, 40]],
 *     [[-10, -10], [-50, -30], [-30, -40]]
 * ]);
 *
 * // First Segment (defaults are 0)
 * turf.findPoint(multiLine);
 * // => Feature<Point<[10, 10]>>
 *
 * // First Segment of the 2nd Multi-Feature
 * turf.findPoint(multiLine, {multiFeatureIndex: 1});
 * // => Feature<Point<[-10, -10]>>
 *
 * // Last Segment of last Multi-Feature
 * turf.findPoint(multiLine, {multiFeatureIndex: -1, coordIndex: -1});
 * // => Feature<Point<[-30, -40]>>
 */
function findPoint(geojson, options) {
    // Optional Parameters
    options = options || {};
    if (!helpers.isObject(options)) throw new Error('options is invalid');
    var featureIndex = options.featureIndex || 0;
    var multiFeatureIndex = options.multiFeatureIndex || 0;
    var geometryIndex = options.geometryIndex || 0;
    var coordIndex = options.coordIndex || 0;

    // Find FeatureIndex
    var properties = options.properties;
    var geometry;

    switch (geojson.type) {
    case 'FeatureCollection':
        if (featureIndex < 0) featureIndex = geojson.features.length + featureIndex;
        properties = properties || geojson.features[featureIndex].properties;
        geometry = geojson.features[featureIndex].geometry;
        break;
    case 'Feature':
        properties = properties || geojson.properties;
        geometry = geojson.geometry;
        break;
    case 'Point':
    case 'MultiPoint':
        return null;
    case 'LineString':
    case 'Polygon':
    case 'MultiLineString':
    case 'MultiPolygon':
        geometry = geojson;
        break;
    default:
        throw new Error('geojson is invalid');
    }

    // Find Coord Index
    if (geometry === null) return null;
    var coords = geometry.coordinates;
    switch (geometry.type) {
    case 'Point':
        return helpers.point(coords, properties, options);
    case 'MultiPoint':
        if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
        return helpers.point(coords[multiFeatureIndex], properties, options);
    case 'LineString':
        if (coordIndex < 0) coordIndex = coords.length + coordIndex;
        return helpers.point(coords[coordIndex], properties, options);
    case 'Polygon':
        if (geometryIndex < 0) geometryIndex = coords.length + geometryIndex;
        if (coordIndex < 0) coordIndex = coords[geometryIndex].length + coordIndex;
        return helpers.point(coords[geometryIndex][coordIndex], properties, options);
    case 'MultiLineString':
        if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
        if (coordIndex < 0) coordIndex = coords[multiFeatureIndex].length + coordIndex;
        return helpers.point(coords[multiFeatureIndex][coordIndex], properties, options);
    case 'MultiPolygon':
        if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
        if (geometryIndex < 0) geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
        if (coordIndex < 0) coordIndex = coords[multiFeatureIndex][geometryIndex].length - coordIndex;
        return helpers.point(coords[multiFeatureIndex][geometryIndex][coordIndex], properties, options);
    }
    throw new Error('geojson is invalid');
}

exports.coordEach = coordEach;
exports.coordReduce = coordReduce;
exports.propEach = propEach;
exports.propReduce = propReduce;
exports.featureEach = featureEach;
exports.featureReduce = featureReduce;
exports.coordAll = coordAll;
exports.geomEach = geomEach;
exports.geomReduce = geomReduce;
exports.flattenEach = flattenEach;
exports.flattenReduce = flattenReduce;
exports.segmentEach = segmentEach;
exports.segmentReduce = segmentReduce;
exports.lineEach = lineEach;
exports.lineReduce = lineReduce;
exports.findSegment = findSegment;
exports.findPoint = findPoint;

},{"@turf/helpers":6}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bearing_1 = require("@turf/bearing");
var distance_1 = require("@turf/distance");
var destination_1 = require("@turf/destination");
var line_intersect_1 = require("@turf/line-intersect");
var meta_1 = require("@turf/meta");
var helpers_1 = require("@turf/helpers");
var invariant_1 = require("@turf/invariant");
/**
 * Takes a {@link Point} and a {@link LineString} and calculates the closest Point on the (Multi)LineString.
 *
 * @name nearestPointOnLine
 * @param {Geometry|Feature<LineString|MultiLineString>} lines lines to snap to
 * @param {Geometry|Feature<Point>|number[]} pt point to snap from
 * @param {Object} [options={}] Optional parameters
 * @param {string} [options.units='kilometers'] can be degrees, radians, miles, or kilometers
 * @returns {Feature<Point>} closest point on the `line` to `point`. The properties object will contain three values: `index`: closest point was found on nth line part, `dist`: distance between pt and the closest point, `location`: distance along the line between start and the closest point.
 * @example
 * var line = turf.lineString([
 *     [-77.031669, 38.878605],
 *     [-77.029609, 38.881946],
 *     [-77.020339, 38.884084],
 *     [-77.025661, 38.885821],
 *     [-77.021884, 38.889563],
 *     [-77.019824, 38.892368]
 * ]);
 * var pt = turf.point([-77.037076, 38.884017]);
 *
 * var snapped = turf.nearestPointOnLine(line, pt, {units: 'miles'});
 *
 * //addToMap
 * var addToMap = [line, pt, snapped];
 * snapped.properties['marker-color'] = '#00f';
 */
function nearestPointOnLine(lines, pt, options) {
    if (options === void 0) { options = {}; }
    var closestPt = helpers_1.point([Infinity, Infinity], {
        dist: Infinity
    });
    var length = 0.0;
    meta_1.flattenEach(lines, function (line) {
        var coords = invariant_1.getCoords(line);
        for (var i = 0; i < coords.length - 1; i++) {
            //start
            var start = helpers_1.point(coords[i]);
            start.properties.dist = distance_1.default(pt, start, options);
            //stop
            var stop_1 = helpers_1.point(coords[i + 1]);
            stop_1.properties.dist = distance_1.default(pt, stop_1, options);
            // sectionLength
            var sectionLength = distance_1.default(start, stop_1, options);
            //perpendicular
            var heightDistance = Math.max(start.properties.dist, stop_1.properties.dist);
            var direction = bearing_1.default(start, stop_1);
            var perpendicularPt1 = destination_1.default(pt, heightDistance, direction + 90, options);
            var perpendicularPt2 = destination_1.default(pt, heightDistance, direction - 90, options);
            var intersect = line_intersect_1.default(helpers_1.lineString([perpendicularPt1.geometry.coordinates, perpendicularPt2.geometry.coordinates]), helpers_1.lineString([start.geometry.coordinates, stop_1.geometry.coordinates]));
            var intersectPt = null;
            if (intersect.features.length > 0) {
                intersectPt = intersect.features[0];
                intersectPt.properties.dist = distance_1.default(pt, intersectPt, options);
                intersectPt.properties.location = length + distance_1.default(start, intersectPt, options);
            }
            if (start.properties.dist < closestPt.properties.dist) {
                closestPt = start;
                closestPt.properties.index = i;
                closestPt.properties.location = length;
            }
            if (stop_1.properties.dist < closestPt.properties.dist) {
                closestPt = stop_1;
                closestPt.properties.index = i + 1;
                closestPt.properties.location = length + sectionLength;
            }
            if (intersectPt && intersectPt.properties.dist < closestPt.properties.dist) {
                closestPt = intersectPt;
                closestPt.properties.index = i;
            }
            // update length
            length += sectionLength;
        }
    });
    return closestPt;
}
exports.default = nearestPointOnLine;

},{"@turf/bearing":3,"@turf/destination":4,"@turf/distance":5,"@turf/helpers":6,"@turf/invariant":7,"@turf/line-intersect":8,"@turf/meta":10}],12:[function(require,module,exports){
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
},{"wgs84":27}],13:[function(require,module,exports){
var rbush = require('rbush');
var helpers = require('@turf/helpers');
var meta = require('@turf/meta');
var turfBBox = require('@turf/bbox').default;
var featureEach = meta.featureEach;
var coordEach = meta.coordEach;
var polygon = helpers.polygon;
var featureCollection = helpers.featureCollection;

/**
 * GeoJSON implementation of [RBush](https://github.com/mourner/rbush#rbush) spatial index.
 *
 * @name rbush
 * @param {number} [maxEntries=9] defines the maximum number of entries in a tree node. 9 (used by default) is a
 * reasonable choice for most applications. Higher value means faster insertion and slower search, and vice versa.
 * @returns {RBush} GeoJSON RBush
 * @example
 * var geojsonRbush = require('geojson-rbush').default;
 * var tree = geojsonRbush();
 */
function geojsonRbush(maxEntries) {
    var tree = rbush(maxEntries);
    /**
     * [insert](https://github.com/mourner/rbush#data-format)
     *
     * @param {Feature} feature insert single GeoJSON Feature
     * @returns {RBush} GeoJSON RBush
     * @example
     * var poly = turf.polygon([[[-78, 41], [-67, 41], [-67, 48], [-78, 48], [-78, 41]]]);
     * tree.insert(poly)
     */
    tree.insert = function (feature) {
        if (feature.type !== 'Feature') throw new Error('invalid feature');
        feature.bbox = feature.bbox ? feature.bbox : turfBBox(feature);
        return rbush.prototype.insert.call(this, feature);
    };

    /**
     * [load](https://github.com/mourner/rbush#bulk-inserting-data)
     *
     * @param {FeatureCollection|Array<Feature>} features load entire GeoJSON FeatureCollection
     * @returns {RBush} GeoJSON RBush
     * @example
     * var polys = turf.polygons([
     *     [[[-78, 41], [-67, 41], [-67, 48], [-78, 48], [-78, 41]]],
     *     [[[-93, 32], [-83, 32], [-83, 39], [-93, 39], [-93, 32]]]
     * ]);
     * tree.load(polys);
     */
    tree.load = function (features) {
        var load = [];
        // Load an Array of Features
        if (Array.isArray(features)) {
            features.forEach(function (feature) {
                if (feature.type !== 'Feature') throw new Error('invalid features');
                feature.bbox = feature.bbox ? feature.bbox : turfBBox(feature);
                load.push(feature);
            });
        } else {
            // Load a FeatureCollection
            featureEach(features, function (feature) {
                if (feature.type !== 'Feature') throw new Error('invalid features');
                feature.bbox = feature.bbox ? feature.bbox : turfBBox(feature);
                load.push(feature);
            });
        }
        return rbush.prototype.load.call(this, load);
    };

    /**
     * [remove](https://github.com/mourner/rbush#removing-data)
     *
     * @param {Feature} feature remove single GeoJSON Feature
     * @param {Function} equals Pass a custom equals function to compare by value for removal.
     * @returns {RBush} GeoJSON RBush
     * @example
     * var poly = turf.polygon([[[-78, 41], [-67, 41], [-67, 48], [-78, 48], [-78, 41]]]);
     *
     * tree.remove(poly);
     */
    tree.remove = function (feature, equals) {
        if (feature.type !== 'Feature') throw new Error('invalid feature');
        feature.bbox = feature.bbox ? feature.bbox : turfBBox(feature);
        return rbush.prototype.remove.call(this, feature, equals);
    };

    /**
     * [clear](https://github.com/mourner/rbush#removing-data)
     *
     * @returns {RBush} GeoJSON Rbush
     * @example
     * tree.clear()
     */
    tree.clear = function () {
        return rbush.prototype.clear.call(this);
    };

    /**
     * [search](https://github.com/mourner/rbush#search)
     *
     * @param {BBox|FeatureCollection|Feature} geojson search with GeoJSON
     * @returns {FeatureCollection} all features that intersects with the given GeoJSON.
     * @example
     * var poly = turf.polygon([[[-78, 41], [-67, 41], [-67, 48], [-78, 48], [-78, 41]]]);
     *
     * tree.search(poly);
     */
    tree.search = function (geojson) {
        var features = rbush.prototype.search.call(this, this.toBBox(geojson));
        return featureCollection(features);
    };

    /**
     * [collides](https://github.com/mourner/rbush#collisions)
     *
     * @param {BBox|FeatureCollection|Feature} geojson collides with GeoJSON
     * @returns {boolean} true if there are any items intersecting the given GeoJSON, otherwise false.
     * @example
     * var poly = turf.polygon([[[-78, 41], [-67, 41], [-67, 48], [-78, 48], [-78, 41]]]);
     *
     * tree.collides(poly);
     */
    tree.collides = function (geojson) {
        return rbush.prototype.collides.call(this, this.toBBox(geojson));
    };

    /**
     * [all](https://github.com/mourner/rbush#search)
     *
     * @returns {FeatureCollection} all the features in RBush
     * @example
     * tree.all()
     */
    tree.all = function () {
        var features = rbush.prototype.all.call(this);
        return featureCollection(features);
    };

    /**
     * [toJSON](https://github.com/mourner/rbush#export-and-import)
     *
     * @returns {any} export data as JSON object
     * @example
     * var exported = tree.toJSON()
     */
    tree.toJSON = function () {
        return rbush.prototype.toJSON.call(this);
    };

    /**
     * [fromJSON](https://github.com/mourner/rbush#export-and-import)
     *
     * @param {any} json import previously exported data
     * @returns {RBush} GeoJSON RBush
     * @example
     * var exported = {
     *   "children": [
     *     {
     *       "type": "Feature",
     *       "geometry": {
     *         "type": "Point",
     *         "coordinates": [110, 50]
     *       },
     *       "properties": {},
     *       "bbox": [110, 50, 110, 50]
     *     }
     *   ],
     *   "height": 1,
     *   "leaf": true,
     *   "minX": 110,
     *   "minY": 50,
     *   "maxX": 110,
     *   "maxY": 50
     * }
     * tree.fromJSON(exported)
     */
    tree.fromJSON = function (json) {
        return rbush.prototype.fromJSON.call(this, json);
    };

    /**
     * Converts GeoJSON to {minX, minY, maxX, maxY} schema
     *
     * @private
     * @param {BBox|FeatureCollection|Feature} geojson feature(s) to retrieve BBox from
     * @returns {Object} converted to {minX, minY, maxX, maxY}
     */
    tree.toBBox = function (geojson) {
        var bbox;
        if (geojson.bbox) bbox = geojson.bbox;
        else if (Array.isArray(geojson) && geojson.length === 4) bbox = geojson;
        else if (Array.isArray(geojson) && geojson.length === 6) bbox = [geojson[0], geojson[1], geojson[3], geojson[4]];
        else if (geojson.type === 'Feature') bbox = turfBBox(geojson);
        else if (geojson.type === 'FeatureCollection') bbox = turfBBox(geojson);
        else throw new Error('invalid geojson')

        return {
            minX: bbox[0],
            minY: bbox[1],
            maxX: bbox[2],
            maxY: bbox[3]
        };
    };
    return tree;
}

module.exports = geojsonRbush;
module.exports.default = geojsonRbush;

},{"@turf/bbox":2,"@turf/helpers":6,"@turf/meta":10,"rbush":17}],14:[function(require,module,exports){
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

},{}],15:[function(require,module,exports){
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

},{}],16:[function(require,module,exports){
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.quickselect = factory());
}(this, (function () { 'use strict';

function quickselect(arr, k, left, right, compare) {
    quickselectStep(arr, k, left || 0, right || (arr.length - 1), compare || defaultCompare);
}

function quickselectStep(arr, k, left, right, compare) {

    while (right > left) {
        if (right - left > 600) {
            var n = right - left + 1;
            var m = k - left + 1;
            var z = Math.log(n);
            var s = 0.5 * Math.exp(2 * z / 3);
            var sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
            var newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
            var newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
            quickselectStep(arr, k, newLeft, newRight, compare);
        }

        var t = arr[k];
        var i = left;
        var j = right;

        swap(arr, left, k);
        if (compare(arr[right], t) > 0) swap(arr, left, right);

        while (i < j) {
            swap(arr, i, j);
            i++;
            j--;
            while (compare(arr[i], t) < 0) i++;
            while (compare(arr[j], t) > 0) j--;
        }

        if (compare(arr[left], t) === 0) swap(arr, left, j);
        else {
            j++;
            swap(arr, j, right);
        }

        if (j <= k) left = j + 1;
        if (k <= j) right = j - 1;
    }
}

function swap(arr, i, j) {
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}

function defaultCompare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

return quickselect;

})));

},{}],17:[function(require,module,exports){
'use strict';

module.exports = rbush;
module.exports.default = rbush;

var quickselect = require('quickselect');

function rbush(maxEntries, format) {
    if (!(this instanceof rbush)) return new rbush(maxEntries, format);

    // max entries in a node is 9 by default; min node fill is 40% for best performance
    this._maxEntries = Math.max(4, maxEntries || 9);
    this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4));

    if (format) {
        this._initFormat(format);
    }

    this.clear();
}

rbush.prototype = {

    all: function () {
        return this._all(this.data, []);
    },

    search: function (bbox) {

        var node = this.data,
            result = [],
            toBBox = this.toBBox;

        if (!intersects(bbox, node)) return result;

        var nodesToSearch = [],
            i, len, child, childBBox;

        while (node) {
            for (i = 0, len = node.children.length; i < len; i++) {

                child = node.children[i];
                childBBox = node.leaf ? toBBox(child) : child;

                if (intersects(bbox, childBBox)) {
                    if (node.leaf) result.push(child);
                    else if (contains(bbox, childBBox)) this._all(child, result);
                    else nodesToSearch.push(child);
                }
            }
            node = nodesToSearch.pop();
        }

        return result;
    },

    collides: function (bbox) {

        var node = this.data,
            toBBox = this.toBBox;

        if (!intersects(bbox, node)) return false;

        var nodesToSearch = [],
            i, len, child, childBBox;

        while (node) {
            for (i = 0, len = node.children.length; i < len; i++) {

                child = node.children[i];
                childBBox = node.leaf ? toBBox(child) : child;

                if (intersects(bbox, childBBox)) {
                    if (node.leaf || contains(bbox, childBBox)) return true;
                    nodesToSearch.push(child);
                }
            }
            node = nodesToSearch.pop();
        }

        return false;
    },

    load: function (data) {
        if (!(data && data.length)) return this;

        if (data.length < this._minEntries) {
            for (var i = 0, len = data.length; i < len; i++) {
                this.insert(data[i]);
            }
            return this;
        }

        // recursively build the tree with the given data from scratch using OMT algorithm
        var node = this._build(data.slice(), 0, data.length - 1, 0);

        if (!this.data.children.length) {
            // save as is if tree is empty
            this.data = node;

        } else if (this.data.height === node.height) {
            // split root if trees have the same height
            this._splitRoot(this.data, node);

        } else {
            if (this.data.height < node.height) {
                // swap trees if inserted one is bigger
                var tmpNode = this.data;
                this.data = node;
                node = tmpNode;
            }

            // insert the small tree into the large tree at appropriate level
            this._insert(node, this.data.height - node.height - 1, true);
        }

        return this;
    },

    insert: function (item) {
        if (item) this._insert(item, this.data.height - 1);
        return this;
    },

    clear: function () {
        this.data = createNode([]);
        return this;
    },

    remove: function (item, equalsFn) {
        if (!item) return this;

        var node = this.data,
            bbox = this.toBBox(item),
            path = [],
            indexes = [],
            i, parent, index, goingUp;

        // depth-first iterative tree traversal
        while (node || path.length) {

            if (!node) { // go up
                node = path.pop();
                parent = path[path.length - 1];
                i = indexes.pop();
                goingUp = true;
            }

            if (node.leaf) { // check current node
                index = findItem(item, node.children, equalsFn);

                if (index !== -1) {
                    // item found, remove the item and condense tree upwards
                    node.children.splice(index, 1);
                    path.push(node);
                    this._condense(path);
                    return this;
                }
            }

            if (!goingUp && !node.leaf && contains(node, bbox)) { // go down
                path.push(node);
                indexes.push(i);
                i = 0;
                parent = node;
                node = node.children[0];

            } else if (parent) { // go right
                i++;
                node = parent.children[i];
                goingUp = false;

            } else node = null; // nothing found
        }

        return this;
    },

    toBBox: function (item) { return item; },

    compareMinX: compareNodeMinX,
    compareMinY: compareNodeMinY,

    toJSON: function () { return this.data; },

    fromJSON: function (data) {
        this.data = data;
        return this;
    },

    _all: function (node, result) {
        var nodesToSearch = [];
        while (node) {
            if (node.leaf) result.push.apply(result, node.children);
            else nodesToSearch.push.apply(nodesToSearch, node.children);

            node = nodesToSearch.pop();
        }
        return result;
    },

    _build: function (items, left, right, height) {

        var N = right - left + 1,
            M = this._maxEntries,
            node;

        if (N <= M) {
            // reached leaf level; return leaf
            node = createNode(items.slice(left, right + 1));
            calcBBox(node, this.toBBox);
            return node;
        }

        if (!height) {
            // target height of the bulk-loaded tree
            height = Math.ceil(Math.log(N) / Math.log(M));

            // target number of root entries to maximize storage utilization
            M = Math.ceil(N / Math.pow(M, height - 1));
        }

        node = createNode([]);
        node.leaf = false;
        node.height = height;

        // split the items into M mostly square tiles

        var N2 = Math.ceil(N / M),
            N1 = N2 * Math.ceil(Math.sqrt(M)),
            i, j, right2, right3;

        multiSelect(items, left, right, N1, this.compareMinX);

        for (i = left; i <= right; i += N1) {

            right2 = Math.min(i + N1 - 1, right);

            multiSelect(items, i, right2, N2, this.compareMinY);

            for (j = i; j <= right2; j += N2) {

                right3 = Math.min(j + N2 - 1, right2);

                // pack each entry recursively
                node.children.push(this._build(items, j, right3, height - 1));
            }
        }

        calcBBox(node, this.toBBox);

        return node;
    },

    _chooseSubtree: function (bbox, node, level, path) {

        var i, len, child, targetNode, area, enlargement, minArea, minEnlargement;

        while (true) {
            path.push(node);

            if (node.leaf || path.length - 1 === level) break;

            minArea = minEnlargement = Infinity;

            for (i = 0, len = node.children.length; i < len; i++) {
                child = node.children[i];
                area = bboxArea(child);
                enlargement = enlargedArea(bbox, child) - area;

                // choose entry with the least area enlargement
                if (enlargement < minEnlargement) {
                    minEnlargement = enlargement;
                    minArea = area < minArea ? area : minArea;
                    targetNode = child;

                } else if (enlargement === minEnlargement) {
                    // otherwise choose one with the smallest area
                    if (area < minArea) {
                        minArea = area;
                        targetNode = child;
                    }
                }
            }

            node = targetNode || node.children[0];
        }

        return node;
    },

    _insert: function (item, level, isNode) {

        var toBBox = this.toBBox,
            bbox = isNode ? item : toBBox(item),
            insertPath = [];

        // find the best node for accommodating the item, saving all nodes along the path too
        var node = this._chooseSubtree(bbox, this.data, level, insertPath);

        // put the item into the node
        node.children.push(item);
        extend(node, bbox);

        // split on node overflow; propagate upwards if necessary
        while (level >= 0) {
            if (insertPath[level].children.length > this._maxEntries) {
                this._split(insertPath, level);
                level--;
            } else break;
        }

        // adjust bboxes along the insertion path
        this._adjustParentBBoxes(bbox, insertPath, level);
    },

    // split overflowed node into two
    _split: function (insertPath, level) {

        var node = insertPath[level],
            M = node.children.length,
            m = this._minEntries;

        this._chooseSplitAxis(node, m, M);

        var splitIndex = this._chooseSplitIndex(node, m, M);

        var newNode = createNode(node.children.splice(splitIndex, node.children.length - splitIndex));
        newNode.height = node.height;
        newNode.leaf = node.leaf;

        calcBBox(node, this.toBBox);
        calcBBox(newNode, this.toBBox);

        if (level) insertPath[level - 1].children.push(newNode);
        else this._splitRoot(node, newNode);
    },

    _splitRoot: function (node, newNode) {
        // split root node
        this.data = createNode([node, newNode]);
        this.data.height = node.height + 1;
        this.data.leaf = false;
        calcBBox(this.data, this.toBBox);
    },

    _chooseSplitIndex: function (node, m, M) {

        var i, bbox1, bbox2, overlap, area, minOverlap, minArea, index;

        minOverlap = minArea = Infinity;

        for (i = m; i <= M - m; i++) {
            bbox1 = distBBox(node, 0, i, this.toBBox);
            bbox2 = distBBox(node, i, M, this.toBBox);

            overlap = intersectionArea(bbox1, bbox2);
            area = bboxArea(bbox1) + bboxArea(bbox2);

            // choose distribution with minimum overlap
            if (overlap < minOverlap) {
                minOverlap = overlap;
                index = i;

                minArea = area < minArea ? area : minArea;

            } else if (overlap === minOverlap) {
                // otherwise choose distribution with minimum area
                if (area < minArea) {
                    minArea = area;
                    index = i;
                }
            }
        }

        return index;
    },

    // sorts node children by the best axis for split
    _chooseSplitAxis: function (node, m, M) {

        var compareMinX = node.leaf ? this.compareMinX : compareNodeMinX,
            compareMinY = node.leaf ? this.compareMinY : compareNodeMinY,
            xMargin = this._allDistMargin(node, m, M, compareMinX),
            yMargin = this._allDistMargin(node, m, M, compareMinY);

        // if total distributions margin value is minimal for x, sort by minX,
        // otherwise it's already sorted by minY
        if (xMargin < yMargin) node.children.sort(compareMinX);
    },

    // total margin of all possible split distributions where each node is at least m full
    _allDistMargin: function (node, m, M, compare) {

        node.children.sort(compare);

        var toBBox = this.toBBox,
            leftBBox = distBBox(node, 0, m, toBBox),
            rightBBox = distBBox(node, M - m, M, toBBox),
            margin = bboxMargin(leftBBox) + bboxMargin(rightBBox),
            i, child;

        for (i = m; i < M - m; i++) {
            child = node.children[i];
            extend(leftBBox, node.leaf ? toBBox(child) : child);
            margin += bboxMargin(leftBBox);
        }

        for (i = M - m - 1; i >= m; i--) {
            child = node.children[i];
            extend(rightBBox, node.leaf ? toBBox(child) : child);
            margin += bboxMargin(rightBBox);
        }

        return margin;
    },

    _adjustParentBBoxes: function (bbox, path, level) {
        // adjust bboxes along the given tree path
        for (var i = level; i >= 0; i--) {
            extend(path[i], bbox);
        }
    },

    _condense: function (path) {
        // go through the path, removing empty nodes and updating bboxes
        for (var i = path.length - 1, siblings; i >= 0; i--) {
            if (path[i].children.length === 0) {
                if (i > 0) {
                    siblings = path[i - 1].children;
                    siblings.splice(siblings.indexOf(path[i]), 1);

                } else this.clear();

            } else calcBBox(path[i], this.toBBox);
        }
    },

    _initFormat: function (format) {
        // data format (minX, minY, maxX, maxY accessors)

        // uses eval-type function compilation instead of just accepting a toBBox function
        // because the algorithms are very sensitive to sorting functions performance,
        // so they should be dead simple and without inner calls

        var compareArr = ['return a', ' - b', ';'];

        this.compareMinX = new Function('a', 'b', compareArr.join(format[0]));
        this.compareMinY = new Function('a', 'b', compareArr.join(format[1]));

        this.toBBox = new Function('a',
            'return {minX: a' + format[0] +
            ', minY: a' + format[1] +
            ', maxX: a' + format[2] +
            ', maxY: a' + format[3] + '};');
    }
};

function findItem(item, items, equalsFn) {
    if (!equalsFn) return items.indexOf(item);

    for (var i = 0; i < items.length; i++) {
        if (equalsFn(item, items[i])) return i;
    }
    return -1;
}

// calculate node's bbox from bboxes of its children
function calcBBox(node, toBBox) {
    distBBox(node, 0, node.children.length, toBBox, node);
}

// min bounding rectangle of node children from k to p-1
function distBBox(node, k, p, toBBox, destNode) {
    if (!destNode) destNode = createNode(null);
    destNode.minX = Infinity;
    destNode.minY = Infinity;
    destNode.maxX = -Infinity;
    destNode.maxY = -Infinity;

    for (var i = k, child; i < p; i++) {
        child = node.children[i];
        extend(destNode, node.leaf ? toBBox(child) : child);
    }

    return destNode;
}

function extend(a, b) {
    a.minX = Math.min(a.minX, b.minX);
    a.minY = Math.min(a.minY, b.minY);
    a.maxX = Math.max(a.maxX, b.maxX);
    a.maxY = Math.max(a.maxY, b.maxY);
    return a;
}

function compareNodeMinX(a, b) { return a.minX - b.minX; }
function compareNodeMinY(a, b) { return a.minY - b.minY; }

function bboxArea(a)   { return (a.maxX - a.minX) * (a.maxY - a.minY); }
function bboxMargin(a) { return (a.maxX - a.minX) + (a.maxY - a.minY); }

function enlargedArea(a, b) {
    return (Math.max(b.maxX, a.maxX) - Math.min(b.minX, a.minX)) *
           (Math.max(b.maxY, a.maxY) - Math.min(b.minY, a.minY));
}

function intersectionArea(a, b) {
    var minX = Math.max(a.minX, b.minX),
        minY = Math.max(a.minY, b.minY),
        maxX = Math.min(a.maxX, b.maxX),
        maxY = Math.min(a.maxY, b.maxY);

    return Math.max(0, maxX - minX) *
           Math.max(0, maxY - minY);
}

function contains(a, b) {
    return a.minX <= b.minX &&
           a.minY <= b.minY &&
           b.maxX <= a.maxX &&
           b.maxY <= a.maxY;
}

function intersects(a, b) {
    return b.minX <= a.maxX &&
           b.minY <= a.maxY &&
           b.maxX >= a.minX &&
           b.maxY >= a.minY;
}

function createNode(children) {
    return {
        children: children,
        height: 1,
        leaf: true,
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
    };
}

// sort an array so that items come in groups of n unsorted items, with groups sorted between each other;
// combines selection algorithm with binary divide & conquer approach

function multiSelect(arr, left, right, n, compare) {
    var stack = [left, right],
        mid;

    while (stack.length) {
        right = stack.pop();
        left = stack.pop();

        if (right - left <= n) continue;

        mid = left + Math.ceil((right - left) / n / 2) * n;
        quickselect(arr, mid, left, right, compare);

        stack.push(left, mid, mid, right);
    }
}

},{"quickselect":16}],18:[function(require,module,exports){
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

},{"geojson-area":12}],19:[function(require,module,exports){
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

},{"turf-helpers":21,"turf-meta":23}],20:[function(require,module,exports){
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

},{}],21:[function(require,module,exports){
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

},{}],22:[function(require,module,exports){
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


},{}],23:[function(require,module,exports){
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

},{}],24:[function(require,module,exports){
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

},{}],25:[function(require,module,exports){
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

},{"turf-featurecollection":20,"turf-inside":22}],26:[function(require,module,exports){
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

},{}],27:[function(require,module,exports){
module.exports.RADIUS = 6378137;
module.exports.FLATTENING = 1/298.257223563;
module.exports.POLAR_RADIUS = 6356752.3142;

},{}],28:[function(require,module,exports){
// ---------------------------------------------------------------------------------------------------------------------
// GeoJSONUtils
//
// @module
// ---------------------------------------------------------------------------------------------------------------------

const area = require('turf-area');
const _ = require('lodash');

// ---------------------------------------------------------------------------------------------------------------------

class GeoJSONUtils {
    constructor() {
    }

    /**
     * Checks to see if the feature is a Polygon formatted as a MultiPolygon.
     *
     * @param {Polygon} polygon
     * @returns {Polygon}
     */
    fixMultiPoly(polygon) {
        if(polygon.geometry.type === 'MultiPolygon' && polygon.geometry.coordinates[0].length === 1) {
            // Handle a Polygon in the form of a MultiPolygon
            polygon.geometry.type = 'Polygon';
            polygon.geometry.coordinates = polygon.geometry.coordinates[0];

            return polygon;
        } else if(polygon.geometry.type === 'MultiPolygon' && polygon.geometry.coordinates[0].length > 1) {
            // Handle a true MultiPolygon by returning the Polygon of largest area
            const polygons = _.map(polygon.geometry.coordinates[0], ((coordinates) => {
                return this._toGeoJSONFeature(
                    this._toGeoJSONPolygon(coordinates)
                );
            }));
            const collectionArea = _.map(polygons, area);
            const largestAreaIndex = _.indexOf(collectionArea, _.max(collectionArea));

            return polygons[largestAreaIndex];
        } else {
            return polygon;
        }
    }

    /**
     * Takes a polygon and generates the sites needed to generate Voronoi
     *
     * @param {Polygon} polygon
     * @param {number} decimalPlaces A power of 10 used to truncate the decimal places of the polygon sites and
     *   bbox. This is a workaround due to the issue referred to here:
     *   https://github.com/gorhill/Javascript-Voronoi/issues/15
     *   Defaults to 1e-20.
     * @returns {{sites: Array, bbox: {xl: number, xr: number, yt: number, yb: number}}}
     */
    sites(polygon, decimalPlaces) {
        if(decimalPlaces === undefined) {
            decimalPlaces = 1e-20;
        }
        let polygonSites = [];
        let xmin,xmax,ymin,ymax;
        for(let i = 0; i < polygon.geometry.coordinates.length; i++) {
            const polyRing = polygon.geometry.coordinates[i].slice();
            for(let j = 0; j < polyRing.length-1; j++) {
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
                if((i === 0) && (j === 0)) {
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
    }

    /**
     * @param {Geometry} geom
     * @returns {{type: string, geometry: Geometry}}
     * @private
     */
    _toGeoJSONFeature(geom) {
        return {
            "type": "Feature",
            "geometry": geom
        };
    }

    /**
     * @param {number[]} coordinates
     * @returns {{type: string, coordinates: number[]}}
     * @private
     */
    _toGeoJSONPolygon(coordinates) {
        const geom = {
            "type": "Polygon",
            "coordinates": [coordinates]
        };
        return(geom);
    }
}

// ---------------------------------------------------------------------------------------------------------------------

module.exports = new GeoJSONUtils();

// ---------------------------------------------------------------------------------------------------------------------
},{"lodash":14,"turf-area":18}]},{},[1])(1)
});

//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJtYXgtaW5zY3JpYmVkLWNpcmNsZS5qcyIsIm5vZGVfbW9kdWxlcy9AdHVyZi9iYm94L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0B0dXJmL2JlYXJpbmcvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQHR1cmYvZGVzdGluYXRpb24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvQHR1cmYvZGlzdGFuY2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQHR1cmYvaGVscGVycy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AdHVyZi9pbnZhcmlhbnQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQHR1cmYvbGluZS1pbnRlcnNlY3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQHR1cmYvbGluZS1zZWdtZW50L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0B0dXJmL21ldGEvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQHR1cmYvbmVhcmVzdC1wb2ludC1vbi1saW5lL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2dlb2pzb24tYXJlYS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9nZW9qc29uLXJidXNoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9sb2Rhc2guanMiLCJub2RlX21vZHVsZXMvbWFrZS1lcnJvci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9xdWlja3NlbGVjdC9xdWlja3NlbGVjdC5qcyIsIm5vZGVfbW9kdWxlcy9yYnVzaC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLWFyZWEvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdHVyZi1jZW50cm9pZC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLWZlYXR1cmVjb2xsZWN0aW9uL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3R1cmYtaGVscGVycy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLWluc2lkZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLW1ldGEvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdHVyZi1wb2ludC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90dXJmLXdpdGhpbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy92b3Jvbm9pL3JoaWxsLXZvcm9ub2ktY29yZS5qcyIsIm5vZGVfbW9kdWxlcy93Z3M4NC9pbmRleC5qcyIsInV0aWxzL2dlb2pzb24tdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3dEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbk5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1bUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2hOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbHFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbGpCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDblVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeHJEQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImNvbnN0IFZvcm9ub2kgPSByZXF1aXJlKCd2b3Jvbm9pJyk7XG5jb25zdCB2b3Jvbm9pID0gbmV3IFZvcm9ub2k7XG5jb25zdCBjZW50cm9pZCA9IHJlcXVpcmUoJ3R1cmYtY2VudHJvaWQnKTtcbmNvbnN0IHBvaW50ID0gcmVxdWlyZSgndHVyZi1wb2ludCcpO1xuY29uc3QgbmVhcmVzdFBvaW50T25MaW5lID0gcmVxdWlyZSgnQHR1cmYvbmVhcmVzdC1wb2ludC1vbi1saW5lJykuZGVmYXVsdDtcbmNvbnN0IHdpdGhpbiA9IHJlcXVpcmUoJ3R1cmYtd2l0aGluJyk7XG5jb25zdCBtYWtlRXJyb3IgPSByZXF1aXJlKCdtYWtlLWVycm9yJyk7XG5jb25zdCBOb1BvaW50c0luU2hhcGVFcnJvciA9IG1ha2VFcnJvcignTm9Qb2ludHNJblNoYXBlRXJyb3InKTtcbmNvbnN0IEdlb0pTT05VdGlscyA9IHJlcXVpcmUoJy4vdXRpbHMvZ2VvanNvbi11dGlscy5qcycpO1xuXG4vKipcbiAqIFRha2VzIGEgcG9seWdvbiBmZWF0dXJlIGFuZCBlc3RpbWF0ZXMgdGhlIGJlc3QgcG9zaXRpb24gZm9yIGxhYmVsIHBsYWNlbWVudCB0aGF0IGlzIGd1YXJhbnRlZWQgdG8gYmUgaW5zaWRlIHRoZSBwb2x5Z29uLiBUaGlzIHVzZXMgdm9yb25vaSB0byBlc3RpbWF0ZSB0aGUgbWVkaWFsIGF4aXMuXG4gKlxuICogQG1vZHVsZSB0dXJmL2xhYmVsLXBvc2l0aW9uXG4gKiBAcGFyYW0ge1BvbHlnb259IHBvbHlnb24gQSBHZW9KU09OIFBvbHlnb24gZmVhdHVyZSBvZiB0aGUgdW5kZXJseWluZyBwb2x5Z29uIGdlb21ldHJ5IGluIEVQU0c6NDMyNlxuICogQHBhcmFtIHtudW1iZXJ9IGRlY2ltYWxQbGFjZXMgQSBwb3dlciBvZiAxMCB1c2VkIHRvIHRydW5jYXRlIHRoZSBkZWNpbWFsIHBsYWNlcyBvZiB0aGUgcG9seWdvbiBzaXRlcyBhbmRcbiAqICAgYmJveC4gVGhpcyBpcyBhIHdvcmthcm91bmQgZHVlIHRvIHRoZSBpc3N1ZSByZWZlcnJlZCB0byBoZXJlOlxuICogICBodHRwczovL2dpdGh1Yi5jb20vZ29yaGlsbC9KYXZhc2NyaXB0LVZvcm9ub2kvaXNzdWVzLzE1XG4gKiAgIElmIGxlZnQgZW1wdHksIHdpbGwgZGVmYXVsdCB0byB0dW5jYXRpbmcgYXQgMjB0aCBkZWNpbWFsIHBsYWNlLlxuICogQHJldHVybnMge1BvaW50fSBhIFBvaW50IGZlYXR1cmUgYXQgdGhlIGJlc3QgZXN0aW1hdGVkIGxhYmVsIHBvc2l0aW9uXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwb2x5Z29uLCBkZWNpbWFsUGxhY2VzKSB7XG4gICAgcG9seWdvbiA9IEdlb0pTT05VdGlscy5maXhNdWx0aVBvbHkocG9seWdvbik7XG4gICAgY29uc3QgcG9seVNpdGVzID0gR2VvSlNPTlV0aWxzLnNpdGVzKHBvbHlnb24sIGRlY2ltYWxQbGFjZXMpO1xuICAgIGNvbnN0IGRpYWdyYW0gPSB2b3Jvbm9pLmNvbXB1dGUocG9seVNpdGVzLnNpdGVzLCBwb2x5U2l0ZXMuYmJveCk7XG4gICAgY29uc3QgdmVydGljZXMgPSB7XG4gICAgICAgIHR5cGU6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAgICAgICAgZmVhdHVyZXM6IFtdXG4gICAgfTtcbiAgICAvL2NvbnN0cnVjdCBHZW9KU09OIG9iamVjdCBvZiB2b3Jvbm9pIHZlcnRpY2VzXG4gICAgZm9yKGxldCBpID0gMDsgaSA8IGRpYWdyYW0udmVydGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmVydGljZXMuZmVhdHVyZXMucHVzaCh7XG4gICAgICAgICAgICB0eXBlOiBcIkZlYXR1cmVcIixcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgICAgICAgZ2VvbWV0cnk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIlBvaW50XCIsXG4gICAgICAgICAgICAgICAgY29vcmRpbmF0ZXM6IFtkaWFncmFtLnZlcnRpY2VzW2ldLngsIGRpYWdyYW0udmVydGljZXNbaV0ueV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG4gICAgdmVydGljZXMuZmVhdHVyZXMucHVzaChjZW50cm9pZChwb2x5Z29uKSk7XG4gICAgLy93aXRoaW4gcmVxdWlyZXMgYSBGZWF0dXJlQ29sbGVjdGlvbiBmb3IgaW5wdXQgcG9seWdvbnNcbiAgICBjb25zdCBwb2x5Z29uRmVhdHVyZUNvbGxlY3Rpb24gPSB7XG4gICAgICAgIHR5cGU6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAgICAgICAgZmVhdHVyZXM6IFtwb2x5Z29uXVxuICAgIH07XG4gICAgY29uc3QgcHRzV2l0aGluID0gd2l0aGluKHZlcnRpY2VzLCBwb2x5Z29uRmVhdHVyZUNvbGxlY3Rpb24pOyAvL3JlbW92ZSBhbnkgdmVydGljZXMgdGhhdCBhcmUgbm90IGluc2lkZSB0aGUgcG9seWdvblxuICAgIGlmKHB0c1dpdGhpbi5mZWF0dXJlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IE5vUG9pbnRzSW5TaGFwZUVycm9yKCdOZWl0aGVyIHRoZSBjZW50cm9pZCBub3IgYW55IFZvcm9ub2kgdmVydGljZXMgaW50ZXJzZWN0IHRoZSBzaGFwZS4nKTtcbiAgICB9XG4gICAgY29uc3QgbGFiZWxMb2NhdGlvbiA9IHtcbiAgICAgICAgY29vcmRpbmF0ZXM6IFswLDBdLFxuICAgICAgICBtYXhEaXN0OiAwXG4gICAgfTtcbiAgICBjb25zdCBwb2x5Z29uQm91bmRhcmllcyA9IHtcbiAgICAgICAgdHlwZTogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICAgICAgICBmZWF0dXJlczogW11cbiAgICB9O1xuICAgIGxldCB2ZXJ0ZXhEaXN0YW5jZTtcblxuICAgIC8vZGVmaW5lIGJvcmRlcnMgb2YgcG9seWdvbiBhbmQgaG9sZXMgYXMgTGluZVN0cmluZ3NcbiAgICBmb3IobGV0IGogPSAwOyBqIDwgcG9seWdvbi5nZW9tZXRyeS5jb29yZGluYXRlcy5sZW5ndGg7IGorKykge1xuICAgICAgICBwb2x5Z29uQm91bmRhcmllcy5mZWF0dXJlcy5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6IFwiRmVhdHVyZVwiLFxuICAgICAgICAgICAgcHJvcGVydGllczoge30sXG4gICAgICAgICAgICBnZW9tZXRyeToge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiTGluZVN0cmluZ1wiLFxuICAgICAgICAgICAgICAgIGNvb3JkaW5hdGVzOiBwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzW2pdXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgZm9yKGxldCBrID0gMDsgayA8IHB0c1dpdGhpbi5mZWF0dXJlcy5sZW5ndGg7IGsrKykge1xuICAgICAgICBmb3IobGV0IGwgPSAwOyBsIDwgcG9seWdvbkJvdW5kYXJpZXMuZmVhdHVyZXMubGVuZ3RoOyBsKyspIHtcbiAgICAgICAgICAgIGlmKGwgPT09IDApIHtcbiAgICAgICAgICAgICAgICB2ZXJ0ZXhEaXN0YW5jZSA9IG5lYXJlc3RQb2ludE9uTGluZShwb2x5Z29uQm91bmRhcmllcy5mZWF0dXJlc1tsXSwgcHRzV2l0aGluLmZlYXR1cmVzW2tdKS5wcm9wZXJ0aWVzLmRpc3Q7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZlcnRleERpc3RhbmNlID0gTWF0aC5taW4odmVydGV4RGlzdGFuY2UsXG4gICAgICAgICAgICAgICAgICAgIG5lYXJlc3RQb2ludE9uTGluZShwb2x5Z29uQm91bmRhcmllcy5mZWF0dXJlc1tsXSwgcHRzV2l0aGluLmZlYXR1cmVzW2tdKS5wcm9wZXJ0aWVzLmRpc3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmKHZlcnRleERpc3RhbmNlID4gbGFiZWxMb2NhdGlvbi5tYXhEaXN0KSB7XG4gICAgICAgICAgICBsYWJlbExvY2F0aW9uLmNvb3JkaW5hdGVzID0gcHRzV2l0aGluLmZlYXR1cmVzW2tdLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgICAgICAgICAgbGFiZWxMb2NhdGlvbi5tYXhEaXN0ID0gdmVydGV4RGlzdGFuY2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcG9pbnQobGFiZWxMb2NhdGlvbi5jb29yZGluYXRlcyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5Ob1BvaW50c0luU2hhcGVFcnJvciA9IE5vUG9pbnRzSW5TaGFwZUVycm9yOyIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xudmFyIG1ldGFfMSA9IHJlcXVpcmUoXCJAdHVyZi9tZXRhXCIpO1xuLyoqXG4gKiBUYWtlcyBhIHNldCBvZiBmZWF0dXJlcywgY2FsY3VsYXRlcyB0aGUgYmJveCBvZiBhbGwgaW5wdXQgZmVhdHVyZXMsIGFuZCByZXR1cm5zIGEgYm91bmRpbmcgYm94LlxuICpcbiAqIEBuYW1lIGJib3hcbiAqIEBwYXJhbSB7R2VvSlNPTn0gZ2VvanNvbiBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEByZXR1cm5zIHtCQm94fSBiYm94IGV4dGVudCBpbiBbbWluWCwgbWluWSwgbWF4WCwgbWF4WV0gb3JkZXJcbiAqIEBleGFtcGxlXG4gKiB2YXIgbGluZSA9IHR1cmYubGluZVN0cmluZyhbWy03NCwgNDBdLCBbLTc4LCA0Ml0sIFstODIsIDM1XV0pO1xuICogdmFyIGJib3ggPSB0dXJmLmJib3gobGluZSk7XG4gKiB2YXIgYmJveFBvbHlnb24gPSB0dXJmLmJib3hQb2x5Z29uKGJib3gpO1xuICpcbiAqIC8vYWRkVG9NYXBcbiAqIHZhciBhZGRUb01hcCA9IFtsaW5lLCBiYm94UG9seWdvbl1cbiAqL1xuZnVuY3Rpb24gYmJveChnZW9qc29uKSB7XG4gICAgdmFyIHJlc3VsdCA9IFtJbmZpbml0eSwgSW5maW5pdHksIC1JbmZpbml0eSwgLUluZmluaXR5XTtcbiAgICBtZXRhXzEuY29vcmRFYWNoKGdlb2pzb24sIGZ1bmN0aW9uIChjb29yZCkge1xuICAgICAgICBpZiAocmVzdWx0WzBdID4gY29vcmRbMF0pIHtcbiAgICAgICAgICAgIHJlc3VsdFswXSA9IGNvb3JkWzBdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHRbMV0gPiBjb29yZFsxXSkge1xuICAgICAgICAgICAgcmVzdWx0WzFdID0gY29vcmRbMV07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdFsyXSA8IGNvb3JkWzBdKSB7XG4gICAgICAgICAgICByZXN1bHRbMl0gPSBjb29yZFswXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzdWx0WzNdIDwgY29vcmRbMV0pIHtcbiAgICAgICAgICAgIHJlc3VsdFszXSA9IGNvb3JkWzFdO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cbmV4cG9ydHMuZGVmYXVsdCA9IGJib3g7XG4iLCJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbnZhciBoZWxwZXJzXzEgPSByZXF1aXJlKFwiQHR1cmYvaGVscGVyc1wiKTtcbnZhciBpbnZhcmlhbnRfMSA9IHJlcXVpcmUoXCJAdHVyZi9pbnZhcmlhbnRcIik7XG4vLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0hhdmVyc2luZV9mb3JtdWxhXG4vLyBodHRwOi8vd3d3Lm1vdmFibGUtdHlwZS5jby51ay9zY3JpcHRzL2xhdGxvbmcuaHRtbFxuLyoqXG4gKiBUYWtlcyB0d28ge0BsaW5rIFBvaW50fHBvaW50c30gYW5kIGZpbmRzIHRoZSBnZW9ncmFwaGljIGJlYXJpbmcgYmV0d2VlbiB0aGVtLFxuICogaS5lLiB0aGUgYW5nbGUgbWVhc3VyZWQgaW4gZGVncmVlcyBmcm9tIHRoZSBub3J0aCBsaW5lICgwIGRlZ3JlZXMpXG4gKlxuICogQG5hbWUgYmVhcmluZ1xuICogQHBhcmFtIHtDb29yZH0gc3RhcnQgc3RhcnRpbmcgUG9pbnRcbiAqIEBwYXJhbSB7Q29vcmR9IGVuZCBlbmRpbmcgUG9pbnRcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gT3B0aW9uYWwgcGFyYW1ldGVyc1xuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5maW5hbD1mYWxzZV0gY2FsY3VsYXRlcyB0aGUgZmluYWwgYmVhcmluZyBpZiB0cnVlXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBiZWFyaW5nIGluIGRlY2ltYWwgZGVncmVlcywgYmV0d2VlbiAtMTgwIGFuZCAxODAgZGVncmVlcyAocG9zaXRpdmUgY2xvY2t3aXNlKVxuICogQGV4YW1wbGVcbiAqIHZhciBwb2ludDEgPSB0dXJmLnBvaW50KFstNzUuMzQzLCAzOS45ODRdKTtcbiAqIHZhciBwb2ludDIgPSB0dXJmLnBvaW50KFstNzUuNTM0LCAzOS4xMjNdKTtcbiAqXG4gKiB2YXIgYmVhcmluZyA9IHR1cmYuYmVhcmluZyhwb2ludDEsIHBvaW50Mik7XG4gKlxuICogLy9hZGRUb01hcFxuICogdmFyIGFkZFRvTWFwID0gW3BvaW50MSwgcG9pbnQyXVxuICogcG9pbnQxLnByb3BlcnRpZXNbJ21hcmtlci1jb2xvciddID0gJyNmMDAnXG4gKiBwb2ludDIucHJvcGVydGllc1snbWFya2VyLWNvbG9yJ10gPSAnIzBmMCdcbiAqIHBvaW50MS5wcm9wZXJ0aWVzLmJlYXJpbmcgPSBiZWFyaW5nXG4gKi9cbmZ1bmN0aW9uIGJlYXJpbmcoc3RhcnQsIGVuZCwgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zID09PSB2b2lkIDApIHsgb3B0aW9ucyA9IHt9OyB9XG4gICAgLy8gUmV2ZXJzZSBjYWxjdWxhdGlvblxuICAgIGlmIChvcHRpb25zLmZpbmFsID09PSB0cnVlKSB7XG4gICAgICAgIHJldHVybiBjYWxjdWxhdGVGaW5hbEJlYXJpbmcoc3RhcnQsIGVuZCk7XG4gICAgfVxuICAgIHZhciBjb29yZGluYXRlczEgPSBpbnZhcmlhbnRfMS5nZXRDb29yZChzdGFydCk7XG4gICAgdmFyIGNvb3JkaW5hdGVzMiA9IGludmFyaWFudF8xLmdldENvb3JkKGVuZCk7XG4gICAgdmFyIGxvbjEgPSBoZWxwZXJzXzEuZGVncmVlc1RvUmFkaWFucyhjb29yZGluYXRlczFbMF0pO1xuICAgIHZhciBsb24yID0gaGVscGVyc18xLmRlZ3JlZXNUb1JhZGlhbnMoY29vcmRpbmF0ZXMyWzBdKTtcbiAgICB2YXIgbGF0MSA9IGhlbHBlcnNfMS5kZWdyZWVzVG9SYWRpYW5zKGNvb3JkaW5hdGVzMVsxXSk7XG4gICAgdmFyIGxhdDIgPSBoZWxwZXJzXzEuZGVncmVlc1RvUmFkaWFucyhjb29yZGluYXRlczJbMV0pO1xuICAgIHZhciBhID0gTWF0aC5zaW4obG9uMiAtIGxvbjEpICogTWF0aC5jb3MobGF0Mik7XG4gICAgdmFyIGIgPSBNYXRoLmNvcyhsYXQxKSAqIE1hdGguc2luKGxhdDIpIC1cbiAgICAgICAgTWF0aC5zaW4obGF0MSkgKiBNYXRoLmNvcyhsYXQyKSAqIE1hdGguY29zKGxvbjIgLSBsb24xKTtcbiAgICByZXR1cm4gaGVscGVyc18xLnJhZGlhbnNUb0RlZ3JlZXMoTWF0aC5hdGFuMihhLCBiKSk7XG59XG4vKipcbiAqIENhbGN1bGF0ZXMgRmluYWwgQmVhcmluZ1xuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Nvb3JkfSBzdGFydCBzdGFydGluZyBQb2ludFxuICogQHBhcmFtIHtDb29yZH0gZW5kIGVuZGluZyBQb2ludFxuICogQHJldHVybnMge251bWJlcn0gYmVhcmluZ1xuICovXG5mdW5jdGlvbiBjYWxjdWxhdGVGaW5hbEJlYXJpbmcoc3RhcnQsIGVuZCkge1xuICAgIC8vIFN3YXAgc3RhcnQgJiBlbmRcbiAgICB2YXIgYmVhciA9IGJlYXJpbmcoZW5kLCBzdGFydCk7XG4gICAgYmVhciA9IChiZWFyICsgMTgwKSAlIDM2MDtcbiAgICByZXR1cm4gYmVhcjtcbn1cbmV4cG9ydHMuZGVmYXVsdCA9IGJlYXJpbmc7XG4iLCJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbi8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGF2ZXJzaW5lX2Zvcm11bGFcbi8vIGh0dHA6Ly93d3cubW92YWJsZS10eXBlLmNvLnVrL3NjcmlwdHMvbGF0bG9uZy5odG1sXG52YXIgaGVscGVyc18xID0gcmVxdWlyZShcIkB0dXJmL2hlbHBlcnNcIik7XG52YXIgaW52YXJpYW50XzEgPSByZXF1aXJlKFwiQHR1cmYvaW52YXJpYW50XCIpO1xuLyoqXG4gKiBUYWtlcyBhIHtAbGluayBQb2ludH0gYW5kIGNhbGN1bGF0ZXMgdGhlIGxvY2F0aW9uIG9mIGEgZGVzdGluYXRpb24gcG9pbnQgZ2l2ZW4gYSBkaXN0YW5jZSBpblxuICogZGVncmVlcywgcmFkaWFucywgbWlsZXMsIG9yIGtpbG9tZXRlcnM7IGFuZCBiZWFyaW5nIGluIGRlZ3JlZXMuXG4gKiBUaGlzIHVzZXMgdGhlIFtIYXZlcnNpbmUgZm9ybXVsYV0oaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9IYXZlcnNpbmVfZm9ybXVsYSkgdG8gYWNjb3VudCBmb3IgZ2xvYmFsIGN1cnZhdHVyZS5cbiAqXG4gKiBAbmFtZSBkZXN0aW5hdGlvblxuICogQHBhcmFtIHtDb29yZH0gb3JpZ2luIHN0YXJ0aW5nIHBvaW50XG4gKiBAcGFyYW0ge251bWJlcn0gZGlzdGFuY2UgZGlzdGFuY2UgZnJvbSB0aGUgb3JpZ2luIHBvaW50XG4gKiBAcGFyYW0ge251bWJlcn0gYmVhcmluZyByYW5naW5nIGZyb20gLTE4MCB0byAxODBcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gT3B0aW9uYWwgcGFyYW1ldGVyc1xuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnVuaXRzPSdraWxvbWV0ZXJzJ10gbWlsZXMsIGtpbG9tZXRlcnMsIGRlZ3JlZXMsIG9yIHJhZGlhbnNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5wcm9wZXJ0aWVzPXt9XSBUcmFuc2xhdGUgcHJvcGVydGllcyB0byBQb2ludFxuICogQHJldHVybnMge0ZlYXR1cmU8UG9pbnQ+fSBkZXN0aW5hdGlvbiBwb2ludFxuICogQGV4YW1wbGVcbiAqIHZhciBwb2ludCA9IHR1cmYucG9pbnQoWy03NS4zNDMsIDM5Ljk4NF0pO1xuICogdmFyIGRpc3RhbmNlID0gNTA7XG4gKiB2YXIgYmVhcmluZyA9IDkwO1xuICogdmFyIG9wdGlvbnMgPSB7dW5pdHM6ICdtaWxlcyd9O1xuICpcbiAqIHZhciBkZXN0aW5hdGlvbiA9IHR1cmYuZGVzdGluYXRpb24ocG9pbnQsIGRpc3RhbmNlLCBiZWFyaW5nLCBvcHRpb25zKTtcbiAqXG4gKiAvL2FkZFRvTWFwXG4gKiB2YXIgYWRkVG9NYXAgPSBbcG9pbnQsIGRlc3RpbmF0aW9uXVxuICogZGVzdGluYXRpb24ucHJvcGVydGllc1snbWFya2VyLWNvbG9yJ10gPSAnI2YwMCc7XG4gKiBwb2ludC5wcm9wZXJ0aWVzWydtYXJrZXItY29sb3InXSA9ICcjMGYwJztcbiAqL1xuZnVuY3Rpb24gZGVzdGluYXRpb24ob3JpZ2luLCBkaXN0YW5jZSwgYmVhcmluZywgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zID09PSB2b2lkIDApIHsgb3B0aW9ucyA9IHt9OyB9XG4gICAgLy8gSGFuZGxlIGlucHV0XG4gICAgdmFyIGNvb3JkaW5hdGVzMSA9IGludmFyaWFudF8xLmdldENvb3JkKG9yaWdpbik7XG4gICAgdmFyIGxvbmdpdHVkZTEgPSBoZWxwZXJzXzEuZGVncmVlc1RvUmFkaWFucyhjb29yZGluYXRlczFbMF0pO1xuICAgIHZhciBsYXRpdHVkZTEgPSBoZWxwZXJzXzEuZGVncmVlc1RvUmFkaWFucyhjb29yZGluYXRlczFbMV0pO1xuICAgIHZhciBiZWFyaW5nUmFkID0gaGVscGVyc18xLmRlZ3JlZXNUb1JhZGlhbnMoYmVhcmluZyk7XG4gICAgdmFyIHJhZGlhbnMgPSBoZWxwZXJzXzEubGVuZ3RoVG9SYWRpYW5zKGRpc3RhbmNlLCBvcHRpb25zLnVuaXRzKTtcbiAgICAvLyBNYWluXG4gICAgdmFyIGxhdGl0dWRlMiA9IE1hdGguYXNpbihNYXRoLnNpbihsYXRpdHVkZTEpICogTWF0aC5jb3MocmFkaWFucykgK1xuICAgICAgICBNYXRoLmNvcyhsYXRpdHVkZTEpICogTWF0aC5zaW4ocmFkaWFucykgKiBNYXRoLmNvcyhiZWFyaW5nUmFkKSk7XG4gICAgdmFyIGxvbmdpdHVkZTIgPSBsb25naXR1ZGUxICsgTWF0aC5hdGFuMihNYXRoLnNpbihiZWFyaW5nUmFkKSAqIE1hdGguc2luKHJhZGlhbnMpICogTWF0aC5jb3MobGF0aXR1ZGUxKSwgTWF0aC5jb3MocmFkaWFucykgLSBNYXRoLnNpbihsYXRpdHVkZTEpICogTWF0aC5zaW4obGF0aXR1ZGUyKSk7XG4gICAgdmFyIGxuZyA9IGhlbHBlcnNfMS5yYWRpYW5zVG9EZWdyZWVzKGxvbmdpdHVkZTIpO1xuICAgIHZhciBsYXQgPSBoZWxwZXJzXzEucmFkaWFuc1RvRGVncmVlcyhsYXRpdHVkZTIpO1xuICAgIHJldHVybiBoZWxwZXJzXzEucG9pbnQoW2xuZywgbGF0XSwgb3B0aW9ucy5wcm9wZXJ0aWVzKTtcbn1cbmV4cG9ydHMuZGVmYXVsdCA9IGRlc3RpbmF0aW9uO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG52YXIgaW52YXJpYW50XzEgPSByZXF1aXJlKFwiQHR1cmYvaW52YXJpYW50XCIpO1xudmFyIGhlbHBlcnNfMSA9IHJlcXVpcmUoXCJAdHVyZi9oZWxwZXJzXCIpO1xuLy9odHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0hhdmVyc2luZV9mb3JtdWxhXG4vL2h0dHA6Ly93d3cubW92YWJsZS10eXBlLmNvLnVrL3NjcmlwdHMvbGF0bG9uZy5odG1sXG4vKipcbiAqIENhbGN1bGF0ZXMgdGhlIGRpc3RhbmNlIGJldHdlZW4gdHdvIHtAbGluayBQb2ludHxwb2ludHN9IGluIGRlZ3JlZXMsIHJhZGlhbnMsIG1pbGVzLCBvciBraWxvbWV0ZXJzLlxuICogVGhpcyB1c2VzIHRoZSBbSGF2ZXJzaW5lIGZvcm11bGFdKGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGF2ZXJzaW5lX2Zvcm11bGEpIHRvIGFjY291bnQgZm9yIGdsb2JhbCBjdXJ2YXR1cmUuXG4gKlxuICogQG5hbWUgZGlzdGFuY2VcbiAqIEBwYXJhbSB7Q29vcmR9IGZyb20gb3JpZ2luIHBvaW50XG4gKiBAcGFyYW0ge0Nvb3JkfSB0byBkZXN0aW5hdGlvbiBwb2ludFxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBPcHRpb25hbCBwYXJhbWV0ZXJzXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMudW5pdHM9J2tpbG9tZXRlcnMnXSBjYW4gYmUgZGVncmVlcywgcmFkaWFucywgbWlsZXMsIG9yIGtpbG9tZXRlcnNcbiAqIEByZXR1cm5zIHtudW1iZXJ9IGRpc3RhbmNlIGJldHdlZW4gdGhlIHR3byBwb2ludHNcbiAqIEBleGFtcGxlXG4gKiB2YXIgZnJvbSA9IHR1cmYucG9pbnQoWy03NS4zNDMsIDM5Ljk4NF0pO1xuICogdmFyIHRvID0gdHVyZi5wb2ludChbLTc1LjUzNCwgMzkuMTIzXSk7XG4gKiB2YXIgb3B0aW9ucyA9IHt1bml0czogJ21pbGVzJ307XG4gKlxuICogdmFyIGRpc3RhbmNlID0gdHVyZi5kaXN0YW5jZShmcm9tLCB0bywgb3B0aW9ucyk7XG4gKlxuICogLy9hZGRUb01hcFxuICogdmFyIGFkZFRvTWFwID0gW2Zyb20sIHRvXTtcbiAqIGZyb20ucHJvcGVydGllcy5kaXN0YW5jZSA9IGRpc3RhbmNlO1xuICogdG8ucHJvcGVydGllcy5kaXN0YW5jZSA9IGRpc3RhbmNlO1xuICovXG5mdW5jdGlvbiBkaXN0YW5jZShmcm9tLCB0bywgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zID09PSB2b2lkIDApIHsgb3B0aW9ucyA9IHt9OyB9XG4gICAgdmFyIGNvb3JkaW5hdGVzMSA9IGludmFyaWFudF8xLmdldENvb3JkKGZyb20pO1xuICAgIHZhciBjb29yZGluYXRlczIgPSBpbnZhcmlhbnRfMS5nZXRDb29yZCh0byk7XG4gICAgdmFyIGRMYXQgPSBoZWxwZXJzXzEuZGVncmVlc1RvUmFkaWFucygoY29vcmRpbmF0ZXMyWzFdIC0gY29vcmRpbmF0ZXMxWzFdKSk7XG4gICAgdmFyIGRMb24gPSBoZWxwZXJzXzEuZGVncmVlc1RvUmFkaWFucygoY29vcmRpbmF0ZXMyWzBdIC0gY29vcmRpbmF0ZXMxWzBdKSk7XG4gICAgdmFyIGxhdDEgPSBoZWxwZXJzXzEuZGVncmVlc1RvUmFkaWFucyhjb29yZGluYXRlczFbMV0pO1xuICAgIHZhciBsYXQyID0gaGVscGVyc18xLmRlZ3JlZXNUb1JhZGlhbnMoY29vcmRpbmF0ZXMyWzFdKTtcbiAgICB2YXIgYSA9IE1hdGgucG93KE1hdGguc2luKGRMYXQgLyAyKSwgMikgK1xuICAgICAgICBNYXRoLnBvdyhNYXRoLnNpbihkTG9uIC8gMiksIDIpICogTWF0aC5jb3MobGF0MSkgKiBNYXRoLmNvcyhsYXQyKTtcbiAgICByZXR1cm4gaGVscGVyc18xLnJhZGlhbnNUb0xlbmd0aCgyICogTWF0aC5hdGFuMihNYXRoLnNxcnQoYSksIE1hdGguc3FydCgxIC0gYSkpLCBvcHRpb25zLnVuaXRzKTtcbn1cbmV4cG9ydHMuZGVmYXVsdCA9IGRpc3RhbmNlO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG4vKipcbiAqIEBtb2R1bGUgaGVscGVyc1xuICovXG4vKipcbiAqIEVhcnRoIFJhZGl1cyB1c2VkIHdpdGggdGhlIEhhcnZlc2luZSBmb3JtdWxhIGFuZCBhcHByb3hpbWF0ZXMgdXNpbmcgYSBzcGhlcmljYWwgKG5vbi1lbGxpcHNvaWQpIEVhcnRoLlxuICpcbiAqIEBtZW1iZXJvZiBoZWxwZXJzXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnRzLmVhcnRoUmFkaXVzID0gNjM3MTAwOC44O1xuLyoqXG4gKiBVbml0IG9mIG1lYXN1cmVtZW50IGZhY3RvcnMgdXNpbmcgYSBzcGhlcmljYWwgKG5vbi1lbGxpcHNvaWQpIGVhcnRoIHJhZGl1cy5cbiAqXG4gKiBAbWVtYmVyb2YgaGVscGVyc1xuICogQHR5cGUge09iamVjdH1cbiAqL1xuZXhwb3J0cy5mYWN0b3JzID0ge1xuICAgIGNlbnRpbWV0ZXJzOiBleHBvcnRzLmVhcnRoUmFkaXVzICogMTAwLFxuICAgIGNlbnRpbWV0cmVzOiBleHBvcnRzLmVhcnRoUmFkaXVzICogMTAwLFxuICAgIGRlZ3JlZXM6IGV4cG9ydHMuZWFydGhSYWRpdXMgLyAxMTEzMjUsXG4gICAgZmVldDogZXhwb3J0cy5lYXJ0aFJhZGl1cyAqIDMuMjgwODQsXG4gICAgaW5jaGVzOiBleHBvcnRzLmVhcnRoUmFkaXVzICogMzkuMzcwLFxuICAgIGtpbG9tZXRlcnM6IGV4cG9ydHMuZWFydGhSYWRpdXMgLyAxMDAwLFxuICAgIGtpbG9tZXRyZXM6IGV4cG9ydHMuZWFydGhSYWRpdXMgLyAxMDAwLFxuICAgIG1ldGVyczogZXhwb3J0cy5lYXJ0aFJhZGl1cyxcbiAgICBtZXRyZXM6IGV4cG9ydHMuZWFydGhSYWRpdXMsXG4gICAgbWlsZXM6IGV4cG9ydHMuZWFydGhSYWRpdXMgLyAxNjA5LjM0NCxcbiAgICBtaWxsaW1ldGVyczogZXhwb3J0cy5lYXJ0aFJhZGl1cyAqIDEwMDAsXG4gICAgbWlsbGltZXRyZXM6IGV4cG9ydHMuZWFydGhSYWRpdXMgKiAxMDAwLFxuICAgIG5hdXRpY2FsbWlsZXM6IGV4cG9ydHMuZWFydGhSYWRpdXMgLyAxODUyLFxuICAgIHJhZGlhbnM6IDEsXG4gICAgeWFyZHM6IGV4cG9ydHMuZWFydGhSYWRpdXMgLyAxLjA5MzYsXG59O1xuLyoqXG4gKiBVbml0cyBvZiBtZWFzdXJlbWVudCBmYWN0b3JzIGJhc2VkIG9uIDEgbWV0ZXIuXG4gKlxuICogQG1lbWJlcm9mIGhlbHBlcnNcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMudW5pdHNGYWN0b3JzID0ge1xuICAgIGNlbnRpbWV0ZXJzOiAxMDAsXG4gICAgY2VudGltZXRyZXM6IDEwMCxcbiAgICBkZWdyZWVzOiAxIC8gMTExMzI1LFxuICAgIGZlZXQ6IDMuMjgwODQsXG4gICAgaW5jaGVzOiAzOS4zNzAsXG4gICAga2lsb21ldGVyczogMSAvIDEwMDAsXG4gICAga2lsb21ldHJlczogMSAvIDEwMDAsXG4gICAgbWV0ZXJzOiAxLFxuICAgIG1ldHJlczogMSxcbiAgICBtaWxlczogMSAvIDE2MDkuMzQ0LFxuICAgIG1pbGxpbWV0ZXJzOiAxMDAwLFxuICAgIG1pbGxpbWV0cmVzOiAxMDAwLFxuICAgIG5hdXRpY2FsbWlsZXM6IDEgLyAxODUyLFxuICAgIHJhZGlhbnM6IDEgLyBleHBvcnRzLmVhcnRoUmFkaXVzLFxuICAgIHlhcmRzOiAxIC8gMS4wOTM2LFxufTtcbi8qKlxuICogQXJlYSBvZiBtZWFzdXJlbWVudCBmYWN0b3JzIGJhc2VkIG9uIDEgc3F1YXJlIG1ldGVyLlxuICpcbiAqIEBtZW1iZXJvZiBoZWxwZXJzXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5leHBvcnRzLmFyZWFGYWN0b3JzID0ge1xuICAgIGFjcmVzOiAwLjAwMDI0NzEwNSxcbiAgICBjZW50aW1ldGVyczogMTAwMDAsXG4gICAgY2VudGltZXRyZXM6IDEwMDAwLFxuICAgIGZlZXQ6IDEwLjc2MzkxMDQxNyxcbiAgICBpbmNoZXM6IDE1NTAuMDAzMTAwMDA2LFxuICAgIGtpbG9tZXRlcnM6IDAuMDAwMDAxLFxuICAgIGtpbG9tZXRyZXM6IDAuMDAwMDAxLFxuICAgIG1ldGVyczogMSxcbiAgICBtZXRyZXM6IDEsXG4gICAgbWlsZXM6IDMuODZlLTcsXG4gICAgbWlsbGltZXRlcnM6IDEwMDAwMDAsXG4gICAgbWlsbGltZXRyZXM6IDEwMDAwMDAsXG4gICAgeWFyZHM6IDEuMTk1OTkwMDQ2LFxufTtcbi8qKlxuICogV3JhcHMgYSBHZW9KU09OIHtAbGluayBHZW9tZXRyeX0gaW4gYSBHZW9KU09OIHtAbGluayBGZWF0dXJlfS5cbiAqXG4gKiBAbmFtZSBmZWF0dXJlXG4gKiBAcGFyYW0ge0dlb21ldHJ5fSBnZW9tZXRyeSBpbnB1dCBnZW9tZXRyeVxuICogQHBhcmFtIHtPYmplY3R9IFtwcm9wZXJ0aWVzPXt9XSBhbiBPYmplY3Qgb2Yga2V5LXZhbHVlIHBhaXJzIHRvIGFkZCBhcyBwcm9wZXJ0aWVzXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIE9wdGlvbmFsIFBhcmFtZXRlcnNcbiAqIEBwYXJhbSB7QXJyYXk8bnVtYmVyPn0gW29wdGlvbnMuYmJveF0gQm91bmRpbmcgQm94IEFycmF5IFt3ZXN0LCBzb3V0aCwgZWFzdCwgbm9ydGhdIGFzc29jaWF0ZWQgd2l0aCB0aGUgRmVhdHVyZVxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBbb3B0aW9ucy5pZF0gSWRlbnRpZmllciBhc3NvY2lhdGVkIHdpdGggdGhlIEZlYXR1cmVcbiAqIEByZXR1cm5zIHtGZWF0dXJlfSBhIEdlb0pTT04gRmVhdHVyZVxuICogQGV4YW1wbGVcbiAqIHZhciBnZW9tZXRyeSA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgXCJjb29yZGluYXRlc1wiOiBbMTEwLCA1MF1cbiAqIH07XG4gKlxuICogdmFyIGZlYXR1cmUgPSB0dXJmLmZlYXR1cmUoZ2VvbWV0cnkpO1xuICpcbiAqIC8vPWZlYXR1cmVcbiAqL1xuZnVuY3Rpb24gZmVhdHVyZShnZW9tLCBwcm9wZXJ0aWVzLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgPT09IHZvaWQgMCkgeyBvcHRpb25zID0ge307IH1cbiAgICB2YXIgZmVhdCA9IHsgdHlwZTogXCJGZWF0dXJlXCIgfTtcbiAgICBpZiAob3B0aW9ucy5pZCA9PT0gMCB8fCBvcHRpb25zLmlkKSB7XG4gICAgICAgIGZlYXQuaWQgPSBvcHRpb25zLmlkO1xuICAgIH1cbiAgICBpZiAob3B0aW9ucy5iYm94KSB7XG4gICAgICAgIGZlYXQuYmJveCA9IG9wdGlvbnMuYmJveDtcbiAgICB9XG4gICAgZmVhdC5wcm9wZXJ0aWVzID0gcHJvcGVydGllcyB8fCB7fTtcbiAgICBmZWF0Lmdlb21ldHJ5ID0gZ2VvbTtcbiAgICByZXR1cm4gZmVhdDtcbn1cbmV4cG9ydHMuZmVhdHVyZSA9IGZlYXR1cmU7XG4vKipcbiAqIENyZWF0ZXMgYSBHZW9KU09OIHtAbGluayBHZW9tZXRyeX0gZnJvbSBhIEdlb21ldHJ5IHN0cmluZyB0eXBlICYgY29vcmRpbmF0ZXMuXG4gKiBGb3IgR2VvbWV0cnlDb2xsZWN0aW9uIHR5cGUgdXNlIGBoZWxwZXJzLmdlb21ldHJ5Q29sbGVjdGlvbmBcbiAqXG4gKiBAbmFtZSBnZW9tZXRyeVxuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgR2VvbWV0cnkgVHlwZVxuICogQHBhcmFtIHtBcnJheTxhbnk+fSBjb29yZGluYXRlcyBDb29yZGluYXRlc1xuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBPcHRpb25hbCBQYXJhbWV0ZXJzXG4gKiBAcmV0dXJucyB7R2VvbWV0cnl9IGEgR2VvSlNPTiBHZW9tZXRyeVxuICogQGV4YW1wbGVcbiAqIHZhciB0eXBlID0gXCJQb2ludFwiO1xuICogdmFyIGNvb3JkaW5hdGVzID0gWzExMCwgNTBdO1xuICogdmFyIGdlb21ldHJ5ID0gdHVyZi5nZW9tZXRyeSh0eXBlLCBjb29yZGluYXRlcyk7XG4gKiAvLyA9PiBnZW9tZXRyeVxuICovXG5mdW5jdGlvbiBnZW9tZXRyeSh0eXBlLCBjb29yZGluYXRlcywgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zID09PSB2b2lkIDApIHsgb3B0aW9ucyA9IHt9OyB9XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgXCJQb2ludFwiOiByZXR1cm4gcG9pbnQoY29vcmRpbmF0ZXMpLmdlb21ldHJ5O1xuICAgICAgICBjYXNlIFwiTGluZVN0cmluZ1wiOiByZXR1cm4gbGluZVN0cmluZyhjb29yZGluYXRlcykuZ2VvbWV0cnk7XG4gICAgICAgIGNhc2UgXCJQb2x5Z29uXCI6IHJldHVybiBwb2x5Z29uKGNvb3JkaW5hdGVzKS5nZW9tZXRyeTtcbiAgICAgICAgY2FzZSBcIk11bHRpUG9pbnRcIjogcmV0dXJuIG11bHRpUG9pbnQoY29vcmRpbmF0ZXMpLmdlb21ldHJ5O1xuICAgICAgICBjYXNlIFwiTXVsdGlMaW5lU3RyaW5nXCI6IHJldHVybiBtdWx0aUxpbmVTdHJpbmcoY29vcmRpbmF0ZXMpLmdlb21ldHJ5O1xuICAgICAgICBjYXNlIFwiTXVsdGlQb2x5Z29uXCI6IHJldHVybiBtdWx0aVBvbHlnb24oY29vcmRpbmF0ZXMpLmdlb21ldHJ5O1xuICAgICAgICBkZWZhdWx0OiB0aHJvdyBuZXcgRXJyb3IodHlwZSArIFwiIGlzIGludmFsaWRcIik7XG4gICAgfVxufVxuZXhwb3J0cy5nZW9tZXRyeSA9IGdlb21ldHJ5O1xuLyoqXG4gKiBDcmVhdGVzIGEge0BsaW5rIFBvaW50fSB7QGxpbmsgRmVhdHVyZX0gZnJvbSBhIFBvc2l0aW9uLlxuICpcbiAqIEBuYW1lIHBvaW50XG4gKiBAcGFyYW0ge0FycmF5PG51bWJlcj59IGNvb3JkaW5hdGVzIGxvbmdpdHVkZSwgbGF0aXR1ZGUgcG9zaXRpb24gKGVhY2ggaW4gZGVjaW1hbCBkZWdyZWVzKVxuICogQHBhcmFtIHtPYmplY3R9IFtwcm9wZXJ0aWVzPXt9XSBhbiBPYmplY3Qgb2Yga2V5LXZhbHVlIHBhaXJzIHRvIGFkZCBhcyBwcm9wZXJ0aWVzXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIE9wdGlvbmFsIFBhcmFtZXRlcnNcbiAqIEBwYXJhbSB7QXJyYXk8bnVtYmVyPn0gW29wdGlvbnMuYmJveF0gQm91bmRpbmcgQm94IEFycmF5IFt3ZXN0LCBzb3V0aCwgZWFzdCwgbm9ydGhdIGFzc29jaWF0ZWQgd2l0aCB0aGUgRmVhdHVyZVxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBbb3B0aW9ucy5pZF0gSWRlbnRpZmllciBhc3NvY2lhdGVkIHdpdGggdGhlIEZlYXR1cmVcbiAqIEByZXR1cm5zIHtGZWF0dXJlPFBvaW50Pn0gYSBQb2ludCBmZWF0dXJlXG4gKiBAZXhhbXBsZVxuICogdmFyIHBvaW50ID0gdHVyZi5wb2ludChbLTc1LjM0MywgMzkuOTg0XSk7XG4gKlxuICogLy89cG9pbnRcbiAqL1xuZnVuY3Rpb24gcG9pbnQoY29vcmRpbmF0ZXMsIHByb3BlcnRpZXMsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgIHZhciBnZW9tID0ge1xuICAgICAgICB0eXBlOiBcIlBvaW50XCIsXG4gICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlcyxcbiAgICB9O1xuICAgIHJldHVybiBmZWF0dXJlKGdlb20sIHByb3BlcnRpZXMsIG9wdGlvbnMpO1xufVxuZXhwb3J0cy5wb2ludCA9IHBvaW50O1xuLyoqXG4gKiBDcmVhdGVzIGEge0BsaW5rIFBvaW50fSB7QGxpbmsgRmVhdHVyZUNvbGxlY3Rpb259IGZyb20gYW4gQXJyYXkgb2YgUG9pbnQgY29vcmRpbmF0ZXMuXG4gKlxuICogQG5hbWUgcG9pbnRzXG4gKiBAcGFyYW0ge0FycmF5PEFycmF5PG51bWJlcj4+fSBjb29yZGluYXRlcyBhbiBhcnJheSBvZiBQb2ludHNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbcHJvcGVydGllcz17fV0gVHJhbnNsYXRlIHRoZXNlIHByb3BlcnRpZXMgdG8gZWFjaCBGZWF0dXJlXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIE9wdGlvbmFsIFBhcmFtZXRlcnNcbiAqIEBwYXJhbSB7QXJyYXk8bnVtYmVyPn0gW29wdGlvbnMuYmJveF0gQm91bmRpbmcgQm94IEFycmF5IFt3ZXN0LCBzb3V0aCwgZWFzdCwgbm9ydGhdXG4gKiBhc3NvY2lhdGVkIHdpdGggdGhlIEZlYXR1cmVDb2xsZWN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IFtvcHRpb25zLmlkXSBJZGVudGlmaWVyIGFzc29jaWF0ZWQgd2l0aCB0aGUgRmVhdHVyZUNvbGxlY3Rpb25cbiAqIEByZXR1cm5zIHtGZWF0dXJlQ29sbGVjdGlvbjxQb2ludD59IFBvaW50IEZlYXR1cmVcbiAqIEBleGFtcGxlXG4gKiB2YXIgcG9pbnRzID0gdHVyZi5wb2ludHMoW1xuICogICBbLTc1LCAzOV0sXG4gKiAgIFstODAsIDQ1XSxcbiAqICAgWy03OCwgNTBdXG4gKiBdKTtcbiAqXG4gKiAvLz1wb2ludHNcbiAqL1xuZnVuY3Rpb24gcG9pbnRzKGNvb3JkaW5hdGVzLCBwcm9wZXJ0aWVzLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgPT09IHZvaWQgMCkgeyBvcHRpb25zID0ge307IH1cbiAgICByZXR1cm4gZmVhdHVyZUNvbGxlY3Rpb24oY29vcmRpbmF0ZXMubWFwKGZ1bmN0aW9uIChjb29yZHMpIHtcbiAgICAgICAgcmV0dXJuIHBvaW50KGNvb3JkcywgcHJvcGVydGllcyk7XG4gICAgfSksIG9wdGlvbnMpO1xufVxuZXhwb3J0cy5wb2ludHMgPSBwb2ludHM7XG4vKipcbiAqIENyZWF0ZXMgYSB7QGxpbmsgUG9seWdvbn0ge0BsaW5rIEZlYXR1cmV9IGZyb20gYW4gQXJyYXkgb2YgTGluZWFyUmluZ3MuXG4gKlxuICogQG5hbWUgcG9seWdvblxuICogQHBhcmFtIHtBcnJheTxBcnJheTxBcnJheTxudW1iZXI+Pj59IGNvb3JkaW5hdGVzIGFuIGFycmF5IG9mIExpbmVhclJpbmdzXG4gKiBAcGFyYW0ge09iamVjdH0gW3Byb3BlcnRpZXM9e31dIGFuIE9iamVjdCBvZiBrZXktdmFsdWUgcGFpcnMgdG8gYWRkIGFzIHByb3BlcnRpZXNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gT3B0aW9uYWwgUGFyYW1ldGVyc1xuICogQHBhcmFtIHtBcnJheTxudW1iZXI+fSBbb3B0aW9ucy5iYm94XSBCb3VuZGluZyBCb3ggQXJyYXkgW3dlc3QsIHNvdXRoLCBlYXN0LCBub3J0aF0gYXNzb2NpYXRlZCB3aXRoIHRoZSBGZWF0dXJlXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IFtvcHRpb25zLmlkXSBJZGVudGlmaWVyIGFzc29jaWF0ZWQgd2l0aCB0aGUgRmVhdHVyZVxuICogQHJldHVybnMge0ZlYXR1cmU8UG9seWdvbj59IFBvbHlnb24gRmVhdHVyZVxuICogQGV4YW1wbGVcbiAqIHZhciBwb2x5Z29uID0gdHVyZi5wb2x5Z29uKFtbWy01LCA1Ml0sIFstNCwgNTZdLCBbLTIsIDUxXSwgWy03LCA1NF0sIFstNSwgNTJdXV0sIHsgbmFtZTogJ3BvbHkxJyB9KTtcbiAqXG4gKiAvLz1wb2x5Z29uXG4gKi9cbmZ1bmN0aW9uIHBvbHlnb24oY29vcmRpbmF0ZXMsIHByb3BlcnRpZXMsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgIGZvciAodmFyIF9pID0gMCwgY29vcmRpbmF0ZXNfMSA9IGNvb3JkaW5hdGVzOyBfaSA8IGNvb3JkaW5hdGVzXzEubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgIHZhciByaW5nID0gY29vcmRpbmF0ZXNfMVtfaV07XG4gICAgICAgIGlmIChyaW5nLmxlbmd0aCA8IDQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVhY2ggTGluZWFyUmluZyBvZiBhIFBvbHlnb24gbXVzdCBoYXZlIDQgb3IgbW9yZSBQb3NpdGlvbnMuXCIpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgcmluZ1tyaW5nLmxlbmd0aCAtIDFdLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiBmaXJzdCBwb2ludCBvZiBQb2x5Z29uIGNvbnRhaW5zIHR3byBudW1iZXJzXG4gICAgICAgICAgICBpZiAocmluZ1tyaW5nLmxlbmd0aCAtIDFdW2pdICE9PSByaW5nWzBdW2pdKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRmlyc3QgYW5kIGxhc3QgUG9zaXRpb24gYXJlIG5vdCBlcXVpdmFsZW50LlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICB2YXIgZ2VvbSA9IHtcbiAgICAgICAgdHlwZTogXCJQb2x5Z29uXCIsXG4gICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlcyxcbiAgICB9O1xuICAgIHJldHVybiBmZWF0dXJlKGdlb20sIHByb3BlcnRpZXMsIG9wdGlvbnMpO1xufVxuZXhwb3J0cy5wb2x5Z29uID0gcG9seWdvbjtcbi8qKlxuICogQ3JlYXRlcyBhIHtAbGluayBQb2x5Z29ufSB7QGxpbmsgRmVhdHVyZUNvbGxlY3Rpb259IGZyb20gYW4gQXJyYXkgb2YgUG9seWdvbiBjb29yZGluYXRlcy5cbiAqXG4gKiBAbmFtZSBwb2x5Z29uc1xuICogQHBhcmFtIHtBcnJheTxBcnJheTxBcnJheTxBcnJheTxudW1iZXI+Pj4+fSBjb29yZGluYXRlcyBhbiBhcnJheSBvZiBQb2x5Z29uIGNvb3JkaW5hdGVzXG4gKiBAcGFyYW0ge09iamVjdH0gW3Byb3BlcnRpZXM9e31dIGFuIE9iamVjdCBvZiBrZXktdmFsdWUgcGFpcnMgdG8gYWRkIGFzIHByb3BlcnRpZXNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gT3B0aW9uYWwgUGFyYW1ldGVyc1xuICogQHBhcmFtIHtBcnJheTxudW1iZXI+fSBbb3B0aW9ucy5iYm94XSBCb3VuZGluZyBCb3ggQXJyYXkgW3dlc3QsIHNvdXRoLCBlYXN0LCBub3J0aF0gYXNzb2NpYXRlZCB3aXRoIHRoZSBGZWF0dXJlXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IFtvcHRpb25zLmlkXSBJZGVudGlmaWVyIGFzc29jaWF0ZWQgd2l0aCB0aGUgRmVhdHVyZUNvbGxlY3Rpb25cbiAqIEByZXR1cm5zIHtGZWF0dXJlQ29sbGVjdGlvbjxQb2x5Z29uPn0gUG9seWdvbiBGZWF0dXJlQ29sbGVjdGlvblxuICogQGV4YW1wbGVcbiAqIHZhciBwb2x5Z29ucyA9IHR1cmYucG9seWdvbnMoW1xuICogICBbW1stNSwgNTJdLCBbLTQsIDU2XSwgWy0yLCA1MV0sIFstNywgNTRdLCBbLTUsIDUyXV1dLFxuICogICBbW1stMTUsIDQyXSwgWy0xNCwgNDZdLCBbLTEyLCA0MV0sIFstMTcsIDQ0XSwgWy0xNSwgNDJdXV0sXG4gKiBdKTtcbiAqXG4gKiAvLz1wb2x5Z29uc1xuICovXG5mdW5jdGlvbiBwb2x5Z29ucyhjb29yZGluYXRlcywgcHJvcGVydGllcywgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zID09PSB2b2lkIDApIHsgb3B0aW9ucyA9IHt9OyB9XG4gICAgcmV0dXJuIGZlYXR1cmVDb2xsZWN0aW9uKGNvb3JkaW5hdGVzLm1hcChmdW5jdGlvbiAoY29vcmRzKSB7XG4gICAgICAgIHJldHVybiBwb2x5Z29uKGNvb3JkcywgcHJvcGVydGllcyk7XG4gICAgfSksIG9wdGlvbnMpO1xufVxuZXhwb3J0cy5wb2x5Z29ucyA9IHBvbHlnb25zO1xuLyoqXG4gKiBDcmVhdGVzIGEge0BsaW5rIExpbmVTdHJpbmd9IHtAbGluayBGZWF0dXJlfSBmcm9tIGFuIEFycmF5IG9mIFBvc2l0aW9ucy5cbiAqXG4gKiBAbmFtZSBsaW5lU3RyaW5nXG4gKiBAcGFyYW0ge0FycmF5PEFycmF5PG51bWJlcj4+fSBjb29yZGluYXRlcyBhbiBhcnJheSBvZiBQb3NpdGlvbnNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbcHJvcGVydGllcz17fV0gYW4gT2JqZWN0IG9mIGtleS12YWx1ZSBwYWlycyB0byBhZGQgYXMgcHJvcGVydGllc1xuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBPcHRpb25hbCBQYXJhbWV0ZXJzXG4gKiBAcGFyYW0ge0FycmF5PG51bWJlcj59IFtvcHRpb25zLmJib3hdIEJvdW5kaW5nIEJveCBBcnJheSBbd2VzdCwgc291dGgsIGVhc3QsIG5vcnRoXSBhc3NvY2lhdGVkIHdpdGggdGhlIEZlYXR1cmVcbiAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gW29wdGlvbnMuaWRdIElkZW50aWZpZXIgYXNzb2NpYXRlZCB3aXRoIHRoZSBGZWF0dXJlXG4gKiBAcmV0dXJucyB7RmVhdHVyZTxMaW5lU3RyaW5nPn0gTGluZVN0cmluZyBGZWF0dXJlXG4gKiBAZXhhbXBsZVxuICogdmFyIGxpbmVzdHJpbmcxID0gdHVyZi5saW5lU3RyaW5nKFtbLTI0LCA2M10sIFstMjMsIDYwXSwgWy0yNSwgNjVdLCBbLTIwLCA2OV1dLCB7bmFtZTogJ2xpbmUgMSd9KTtcbiAqIHZhciBsaW5lc3RyaW5nMiA9IHR1cmYubGluZVN0cmluZyhbWy0xNCwgNDNdLCBbLTEzLCA0MF0sIFstMTUsIDQ1XSwgWy0xMCwgNDldXSwge25hbWU6ICdsaW5lIDInfSk7XG4gKlxuICogLy89bGluZXN0cmluZzFcbiAqIC8vPWxpbmVzdHJpbmcyXG4gKi9cbmZ1bmN0aW9uIGxpbmVTdHJpbmcoY29vcmRpbmF0ZXMsIHByb3BlcnRpZXMsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgIGlmIChjb29yZGluYXRlcy5sZW5ndGggPCAyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImNvb3JkaW5hdGVzIG11c3QgYmUgYW4gYXJyYXkgb2YgdHdvIG9yIG1vcmUgcG9zaXRpb25zXCIpO1xuICAgIH1cbiAgICB2YXIgZ2VvbSA9IHtcbiAgICAgICAgdHlwZTogXCJMaW5lU3RyaW5nXCIsXG4gICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlcyxcbiAgICB9O1xuICAgIHJldHVybiBmZWF0dXJlKGdlb20sIHByb3BlcnRpZXMsIG9wdGlvbnMpO1xufVxuZXhwb3J0cy5saW5lU3RyaW5nID0gbGluZVN0cmluZztcbi8qKlxuICogQ3JlYXRlcyBhIHtAbGluayBMaW5lU3RyaW5nfSB7QGxpbmsgRmVhdHVyZUNvbGxlY3Rpb259IGZyb20gYW4gQXJyYXkgb2YgTGluZVN0cmluZyBjb29yZGluYXRlcy5cbiAqXG4gKiBAbmFtZSBsaW5lU3RyaW5nc1xuICogQHBhcmFtIHtBcnJheTxBcnJheTxBcnJheTxudW1iZXI+Pj59IGNvb3JkaW5hdGVzIGFuIGFycmF5IG9mIExpbmVhclJpbmdzXG4gKiBAcGFyYW0ge09iamVjdH0gW3Byb3BlcnRpZXM9e31dIGFuIE9iamVjdCBvZiBrZXktdmFsdWUgcGFpcnMgdG8gYWRkIGFzIHByb3BlcnRpZXNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gT3B0aW9uYWwgUGFyYW1ldGVyc1xuICogQHBhcmFtIHtBcnJheTxudW1iZXI+fSBbb3B0aW9ucy5iYm94XSBCb3VuZGluZyBCb3ggQXJyYXkgW3dlc3QsIHNvdXRoLCBlYXN0LCBub3J0aF1cbiAqIGFzc29jaWF0ZWQgd2l0aCB0aGUgRmVhdHVyZUNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gW29wdGlvbnMuaWRdIElkZW50aWZpZXIgYXNzb2NpYXRlZCB3aXRoIHRoZSBGZWF0dXJlQ29sbGVjdGlvblxuICogQHJldHVybnMge0ZlYXR1cmVDb2xsZWN0aW9uPExpbmVTdHJpbmc+fSBMaW5lU3RyaW5nIEZlYXR1cmVDb2xsZWN0aW9uXG4gKiBAZXhhbXBsZVxuICogdmFyIGxpbmVzdHJpbmdzID0gdHVyZi5saW5lU3RyaW5ncyhbXG4gKiAgIFtbLTI0LCA2M10sIFstMjMsIDYwXSwgWy0yNSwgNjVdLCBbLTIwLCA2OV1dLFxuICogICBbWy0xNCwgNDNdLCBbLTEzLCA0MF0sIFstMTUsIDQ1XSwgWy0xMCwgNDldXVxuICogXSk7XG4gKlxuICogLy89bGluZXN0cmluZ3NcbiAqL1xuZnVuY3Rpb24gbGluZVN0cmluZ3MoY29vcmRpbmF0ZXMsIHByb3BlcnRpZXMsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgIHJldHVybiBmZWF0dXJlQ29sbGVjdGlvbihjb29yZGluYXRlcy5tYXAoZnVuY3Rpb24gKGNvb3Jkcykge1xuICAgICAgICByZXR1cm4gbGluZVN0cmluZyhjb29yZHMsIHByb3BlcnRpZXMpO1xuICAgIH0pLCBvcHRpb25zKTtcbn1cbmV4cG9ydHMubGluZVN0cmluZ3MgPSBsaW5lU3RyaW5ncztcbi8qKlxuICogVGFrZXMgb25lIG9yIG1vcmUge0BsaW5rIEZlYXR1cmV8RmVhdHVyZXN9IGFuZCBjcmVhdGVzIGEge0BsaW5rIEZlYXR1cmVDb2xsZWN0aW9ufS5cbiAqXG4gKiBAbmFtZSBmZWF0dXJlQ29sbGVjdGlvblxuICogQHBhcmFtIHtGZWF0dXJlW119IGZlYXR1cmVzIGlucHV0IGZlYXR1cmVzXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIE9wdGlvbmFsIFBhcmFtZXRlcnNcbiAqIEBwYXJhbSB7QXJyYXk8bnVtYmVyPn0gW29wdGlvbnMuYmJveF0gQm91bmRpbmcgQm94IEFycmF5IFt3ZXN0LCBzb3V0aCwgZWFzdCwgbm9ydGhdIGFzc29jaWF0ZWQgd2l0aCB0aGUgRmVhdHVyZVxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBbb3B0aW9ucy5pZF0gSWRlbnRpZmllciBhc3NvY2lhdGVkIHdpdGggdGhlIEZlYXR1cmVcbiAqIEByZXR1cm5zIHtGZWF0dXJlQ29sbGVjdGlvbn0gRmVhdHVyZUNvbGxlY3Rpb24gb2YgRmVhdHVyZXNcbiAqIEBleGFtcGxlXG4gKiB2YXIgbG9jYXRpb25BID0gdHVyZi5wb2ludChbLTc1LjM0MywgMzkuOTg0XSwge25hbWU6ICdMb2NhdGlvbiBBJ30pO1xuICogdmFyIGxvY2F0aW9uQiA9IHR1cmYucG9pbnQoWy03NS44MzMsIDM5LjI4NF0sIHtuYW1lOiAnTG9jYXRpb24gQid9KTtcbiAqIHZhciBsb2NhdGlvbkMgPSB0dXJmLnBvaW50KFstNzUuNTM0LCAzOS4xMjNdLCB7bmFtZTogJ0xvY2F0aW9uIEMnfSk7XG4gKlxuICogdmFyIGNvbGxlY3Rpb24gPSB0dXJmLmZlYXR1cmVDb2xsZWN0aW9uKFtcbiAqICAgbG9jYXRpb25BLFxuICogICBsb2NhdGlvbkIsXG4gKiAgIGxvY2F0aW9uQ1xuICogXSk7XG4gKlxuICogLy89Y29sbGVjdGlvblxuICovXG5mdW5jdGlvbiBmZWF0dXJlQ29sbGVjdGlvbihmZWF0dXJlcywgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zID09PSB2b2lkIDApIHsgb3B0aW9ucyA9IHt9OyB9XG4gICAgdmFyIGZjID0geyB0eXBlOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIgfTtcbiAgICBpZiAob3B0aW9ucy5pZCkge1xuICAgICAgICBmYy5pZCA9IG9wdGlvbnMuaWQ7XG4gICAgfVxuICAgIGlmIChvcHRpb25zLmJib3gpIHtcbiAgICAgICAgZmMuYmJveCA9IG9wdGlvbnMuYmJveDtcbiAgICB9XG4gICAgZmMuZmVhdHVyZXMgPSBmZWF0dXJlcztcbiAgICByZXR1cm4gZmM7XG59XG5leHBvcnRzLmZlYXR1cmVDb2xsZWN0aW9uID0gZmVhdHVyZUNvbGxlY3Rpb247XG4vKipcbiAqIENyZWF0ZXMgYSB7QGxpbmsgRmVhdHVyZTxNdWx0aUxpbmVTdHJpbmc+fSBiYXNlZCBvbiBhXG4gKiBjb29yZGluYXRlIGFycmF5LiBQcm9wZXJ0aWVzIGNhbiBiZSBhZGRlZCBvcHRpb25hbGx5LlxuICpcbiAqIEBuYW1lIG11bHRpTGluZVN0cmluZ1xuICogQHBhcmFtIHtBcnJheTxBcnJheTxBcnJheTxudW1iZXI+Pj59IGNvb3JkaW5hdGVzIGFuIGFycmF5IG9mIExpbmVTdHJpbmdzXG4gKiBAcGFyYW0ge09iamVjdH0gW3Byb3BlcnRpZXM9e31dIGFuIE9iamVjdCBvZiBrZXktdmFsdWUgcGFpcnMgdG8gYWRkIGFzIHByb3BlcnRpZXNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gT3B0aW9uYWwgUGFyYW1ldGVyc1xuICogQHBhcmFtIHtBcnJheTxudW1iZXI+fSBbb3B0aW9ucy5iYm94XSBCb3VuZGluZyBCb3ggQXJyYXkgW3dlc3QsIHNvdXRoLCBlYXN0LCBub3J0aF0gYXNzb2NpYXRlZCB3aXRoIHRoZSBGZWF0dXJlXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IFtvcHRpb25zLmlkXSBJZGVudGlmaWVyIGFzc29jaWF0ZWQgd2l0aCB0aGUgRmVhdHVyZVxuICogQHJldHVybnMge0ZlYXR1cmU8TXVsdGlMaW5lU3RyaW5nPn0gYSBNdWx0aUxpbmVTdHJpbmcgZmVhdHVyZVxuICogQHRocm93cyB7RXJyb3J9IGlmIG5vIGNvb3JkaW5hdGVzIGFyZSBwYXNzZWRcbiAqIEBleGFtcGxlXG4gKiB2YXIgbXVsdGlMaW5lID0gdHVyZi5tdWx0aUxpbmVTdHJpbmcoW1tbMCwwXSxbMTAsMTBdXV0pO1xuICpcbiAqIC8vPW11bHRpTGluZVxuICovXG5mdW5jdGlvbiBtdWx0aUxpbmVTdHJpbmcoY29vcmRpbmF0ZXMsIHByb3BlcnRpZXMsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgIHZhciBnZW9tID0ge1xuICAgICAgICB0eXBlOiBcIk11bHRpTGluZVN0cmluZ1wiLFxuICAgICAgICBjb29yZGluYXRlczogY29vcmRpbmF0ZXMsXG4gICAgfTtcbiAgICByZXR1cm4gZmVhdHVyZShnZW9tLCBwcm9wZXJ0aWVzLCBvcHRpb25zKTtcbn1cbmV4cG9ydHMubXVsdGlMaW5lU3RyaW5nID0gbXVsdGlMaW5lU3RyaW5nO1xuLyoqXG4gKiBDcmVhdGVzIGEge0BsaW5rIEZlYXR1cmU8TXVsdGlQb2ludD59IGJhc2VkIG9uIGFcbiAqIGNvb3JkaW5hdGUgYXJyYXkuIFByb3BlcnRpZXMgY2FuIGJlIGFkZGVkIG9wdGlvbmFsbHkuXG4gKlxuICogQG5hbWUgbXVsdGlQb2ludFxuICogQHBhcmFtIHtBcnJheTxBcnJheTxudW1iZXI+Pn0gY29vcmRpbmF0ZXMgYW4gYXJyYXkgb2YgUG9zaXRpb25zXG4gKiBAcGFyYW0ge09iamVjdH0gW3Byb3BlcnRpZXM9e31dIGFuIE9iamVjdCBvZiBrZXktdmFsdWUgcGFpcnMgdG8gYWRkIGFzIHByb3BlcnRpZXNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gT3B0aW9uYWwgUGFyYW1ldGVyc1xuICogQHBhcmFtIHtBcnJheTxudW1iZXI+fSBbb3B0aW9ucy5iYm94XSBCb3VuZGluZyBCb3ggQXJyYXkgW3dlc3QsIHNvdXRoLCBlYXN0LCBub3J0aF0gYXNzb2NpYXRlZCB3aXRoIHRoZSBGZWF0dXJlXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IFtvcHRpb25zLmlkXSBJZGVudGlmaWVyIGFzc29jaWF0ZWQgd2l0aCB0aGUgRmVhdHVyZVxuICogQHJldHVybnMge0ZlYXR1cmU8TXVsdGlQb2ludD59IGEgTXVsdGlQb2ludCBmZWF0dXJlXG4gKiBAdGhyb3dzIHtFcnJvcn0gaWYgbm8gY29vcmRpbmF0ZXMgYXJlIHBhc3NlZFxuICogQGV4YW1wbGVcbiAqIHZhciBtdWx0aVB0ID0gdHVyZi5tdWx0aVBvaW50KFtbMCwwXSxbMTAsMTBdXSk7XG4gKlxuICogLy89bXVsdGlQdFxuICovXG5mdW5jdGlvbiBtdWx0aVBvaW50KGNvb3JkaW5hdGVzLCBwcm9wZXJ0aWVzLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgPT09IHZvaWQgMCkgeyBvcHRpb25zID0ge307IH1cbiAgICB2YXIgZ2VvbSA9IHtcbiAgICAgICAgdHlwZTogXCJNdWx0aVBvaW50XCIsXG4gICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlcyxcbiAgICB9O1xuICAgIHJldHVybiBmZWF0dXJlKGdlb20sIHByb3BlcnRpZXMsIG9wdGlvbnMpO1xufVxuZXhwb3J0cy5tdWx0aVBvaW50ID0gbXVsdGlQb2ludDtcbi8qKlxuICogQ3JlYXRlcyBhIHtAbGluayBGZWF0dXJlPE11bHRpUG9seWdvbj59IGJhc2VkIG9uIGFcbiAqIGNvb3JkaW5hdGUgYXJyYXkuIFByb3BlcnRpZXMgY2FuIGJlIGFkZGVkIG9wdGlvbmFsbHkuXG4gKlxuICogQG5hbWUgbXVsdGlQb2x5Z29uXG4gKiBAcGFyYW0ge0FycmF5PEFycmF5PEFycmF5PEFycmF5PG51bWJlcj4+Pj59IGNvb3JkaW5hdGVzIGFuIGFycmF5IG9mIFBvbHlnb25zXG4gKiBAcGFyYW0ge09iamVjdH0gW3Byb3BlcnRpZXM9e31dIGFuIE9iamVjdCBvZiBrZXktdmFsdWUgcGFpcnMgdG8gYWRkIGFzIHByb3BlcnRpZXNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gT3B0aW9uYWwgUGFyYW1ldGVyc1xuICogQHBhcmFtIHtBcnJheTxudW1iZXI+fSBbb3B0aW9ucy5iYm94XSBCb3VuZGluZyBCb3ggQXJyYXkgW3dlc3QsIHNvdXRoLCBlYXN0LCBub3J0aF0gYXNzb2NpYXRlZCB3aXRoIHRoZSBGZWF0dXJlXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IFtvcHRpb25zLmlkXSBJZGVudGlmaWVyIGFzc29jaWF0ZWQgd2l0aCB0aGUgRmVhdHVyZVxuICogQHJldHVybnMge0ZlYXR1cmU8TXVsdGlQb2x5Z29uPn0gYSBtdWx0aXBvbHlnb24gZmVhdHVyZVxuICogQHRocm93cyB7RXJyb3J9IGlmIG5vIGNvb3JkaW5hdGVzIGFyZSBwYXNzZWRcbiAqIEBleGFtcGxlXG4gKiB2YXIgbXVsdGlQb2x5ID0gdHVyZi5tdWx0aVBvbHlnb24oW1tbWzAsMF0sWzAsMTBdLFsxMCwxMF0sWzEwLDBdLFswLDBdXV1dKTtcbiAqXG4gKiAvLz1tdWx0aVBvbHlcbiAqXG4gKi9cbmZ1bmN0aW9uIG11bHRpUG9seWdvbihjb29yZGluYXRlcywgcHJvcGVydGllcywgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zID09PSB2b2lkIDApIHsgb3B0aW9ucyA9IHt9OyB9XG4gICAgdmFyIGdlb20gPSB7XG4gICAgICAgIHR5cGU6IFwiTXVsdGlQb2x5Z29uXCIsXG4gICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlcyxcbiAgICB9O1xuICAgIHJldHVybiBmZWF0dXJlKGdlb20sIHByb3BlcnRpZXMsIG9wdGlvbnMpO1xufVxuZXhwb3J0cy5tdWx0aVBvbHlnb24gPSBtdWx0aVBvbHlnb247XG4vKipcbiAqIENyZWF0ZXMgYSB7QGxpbmsgRmVhdHVyZTxHZW9tZXRyeUNvbGxlY3Rpb24+fSBiYXNlZCBvbiBhXG4gKiBjb29yZGluYXRlIGFycmF5LiBQcm9wZXJ0aWVzIGNhbiBiZSBhZGRlZCBvcHRpb25hbGx5LlxuICpcbiAqIEBuYW1lIGdlb21ldHJ5Q29sbGVjdGlvblxuICogQHBhcmFtIHtBcnJheTxHZW9tZXRyeT59IGdlb21ldHJpZXMgYW4gYXJyYXkgb2YgR2VvSlNPTiBHZW9tZXRyaWVzXG4gKiBAcGFyYW0ge09iamVjdH0gW3Byb3BlcnRpZXM9e31dIGFuIE9iamVjdCBvZiBrZXktdmFsdWUgcGFpcnMgdG8gYWRkIGFzIHByb3BlcnRpZXNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gT3B0aW9uYWwgUGFyYW1ldGVyc1xuICogQHBhcmFtIHtBcnJheTxudW1iZXI+fSBbb3B0aW9ucy5iYm94XSBCb3VuZGluZyBCb3ggQXJyYXkgW3dlc3QsIHNvdXRoLCBlYXN0LCBub3J0aF0gYXNzb2NpYXRlZCB3aXRoIHRoZSBGZWF0dXJlXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IFtvcHRpb25zLmlkXSBJZGVudGlmaWVyIGFzc29jaWF0ZWQgd2l0aCB0aGUgRmVhdHVyZVxuICogQHJldHVybnMge0ZlYXR1cmU8R2VvbWV0cnlDb2xsZWN0aW9uPn0gYSBHZW9KU09OIEdlb21ldHJ5Q29sbGVjdGlvbiBGZWF0dXJlXG4gKiBAZXhhbXBsZVxuICogdmFyIHB0ID0gdHVyZi5nZW9tZXRyeShcIlBvaW50XCIsIFsxMDAsIDBdKTtcbiAqIHZhciBsaW5lID0gdHVyZi5nZW9tZXRyeShcIkxpbmVTdHJpbmdcIiwgW1sxMDEsIDBdLCBbMTAyLCAxXV0pO1xuICogdmFyIGNvbGxlY3Rpb24gPSB0dXJmLmdlb21ldHJ5Q29sbGVjdGlvbihbcHQsIGxpbmVdKTtcbiAqXG4gKiAvLyA9PiBjb2xsZWN0aW9uXG4gKi9cbmZ1bmN0aW9uIGdlb21ldHJ5Q29sbGVjdGlvbihnZW9tZXRyaWVzLCBwcm9wZXJ0aWVzLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgPT09IHZvaWQgMCkgeyBvcHRpb25zID0ge307IH1cbiAgICB2YXIgZ2VvbSA9IHtcbiAgICAgICAgdHlwZTogXCJHZW9tZXRyeUNvbGxlY3Rpb25cIixcbiAgICAgICAgZ2VvbWV0cmllczogZ2VvbWV0cmllcyxcbiAgICB9O1xuICAgIHJldHVybiBmZWF0dXJlKGdlb20sIHByb3BlcnRpZXMsIG9wdGlvbnMpO1xufVxuZXhwb3J0cy5nZW9tZXRyeUNvbGxlY3Rpb24gPSBnZW9tZXRyeUNvbGxlY3Rpb247XG4vKipcbiAqIFJvdW5kIG51bWJlciB0byBwcmVjaXNpb25cbiAqXG4gKiBAcGFyYW0ge251bWJlcn0gbnVtIE51bWJlclxuICogQHBhcmFtIHtudW1iZXJ9IFtwcmVjaXNpb249MF0gUHJlY2lzaW9uXG4gKiBAcmV0dXJucyB7bnVtYmVyfSByb3VuZGVkIG51bWJlclxuICogQGV4YW1wbGVcbiAqIHR1cmYucm91bmQoMTIwLjQzMjEpXG4gKiAvLz0xMjBcbiAqXG4gKiB0dXJmLnJvdW5kKDEyMC40MzIxLCAyKVxuICogLy89MTIwLjQzXG4gKi9cbmZ1bmN0aW9uIHJvdW5kKG51bSwgcHJlY2lzaW9uKSB7XG4gICAgaWYgKHByZWNpc2lvbiA9PT0gdm9pZCAwKSB7IHByZWNpc2lvbiA9IDA7IH1cbiAgICBpZiAocHJlY2lzaW9uICYmICEocHJlY2lzaW9uID49IDApKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInByZWNpc2lvbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIpO1xuICAgIH1cbiAgICB2YXIgbXVsdGlwbGllciA9IE1hdGgucG93KDEwLCBwcmVjaXNpb24gfHwgMCk7XG4gICAgcmV0dXJuIE1hdGgucm91bmQobnVtICogbXVsdGlwbGllcikgLyBtdWx0aXBsaWVyO1xufVxuZXhwb3J0cy5yb3VuZCA9IHJvdW5kO1xuLyoqXG4gKiBDb252ZXJ0IGEgZGlzdGFuY2UgbWVhc3VyZW1lbnQgKGFzc3VtaW5nIGEgc3BoZXJpY2FsIEVhcnRoKSBmcm9tIHJhZGlhbnMgdG8gYSBtb3JlIGZyaWVuZGx5IHVuaXQuXG4gKiBWYWxpZCB1bml0czogbWlsZXMsIG5hdXRpY2FsbWlsZXMsIGluY2hlcywgeWFyZHMsIG1ldGVycywgbWV0cmVzLCBraWxvbWV0ZXJzLCBjZW50aW1ldGVycywgZmVldFxuICpcbiAqIEBuYW1lIHJhZGlhbnNUb0xlbmd0aFxuICogQHBhcmFtIHtudW1iZXJ9IHJhZGlhbnMgaW4gcmFkaWFucyBhY3Jvc3MgdGhlIHNwaGVyZVxuICogQHBhcmFtIHtzdHJpbmd9IFt1bml0cz1cImtpbG9tZXRlcnNcIl0gY2FuIGJlIGRlZ3JlZXMsIHJhZGlhbnMsIG1pbGVzLCBvciBraWxvbWV0ZXJzIGluY2hlcywgeWFyZHMsIG1ldHJlcyxcbiAqIG1ldGVycywga2lsb21ldHJlcywga2lsb21ldGVycy5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IGRpc3RhbmNlXG4gKi9cbmZ1bmN0aW9uIHJhZGlhbnNUb0xlbmd0aChyYWRpYW5zLCB1bml0cykge1xuICAgIGlmICh1bml0cyA9PT0gdm9pZCAwKSB7IHVuaXRzID0gXCJraWxvbWV0ZXJzXCI7IH1cbiAgICB2YXIgZmFjdG9yID0gZXhwb3J0cy5mYWN0b3JzW3VuaXRzXTtcbiAgICBpZiAoIWZhY3Rvcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IodW5pdHMgKyBcIiB1bml0cyBpcyBpbnZhbGlkXCIpO1xuICAgIH1cbiAgICByZXR1cm4gcmFkaWFucyAqIGZhY3Rvcjtcbn1cbmV4cG9ydHMucmFkaWFuc1RvTGVuZ3RoID0gcmFkaWFuc1RvTGVuZ3RoO1xuLyoqXG4gKiBDb252ZXJ0IGEgZGlzdGFuY2UgbWVhc3VyZW1lbnQgKGFzc3VtaW5nIGEgc3BoZXJpY2FsIEVhcnRoKSBmcm9tIGEgcmVhbC13b3JsZCB1bml0IGludG8gcmFkaWFuc1xuICogVmFsaWQgdW5pdHM6IG1pbGVzLCBuYXV0aWNhbG1pbGVzLCBpbmNoZXMsIHlhcmRzLCBtZXRlcnMsIG1ldHJlcywga2lsb21ldGVycywgY2VudGltZXRlcnMsIGZlZXRcbiAqXG4gKiBAbmFtZSBsZW5ndGhUb1JhZGlhbnNcbiAqIEBwYXJhbSB7bnVtYmVyfSBkaXN0YW5jZSBpbiByZWFsIHVuaXRzXG4gKiBAcGFyYW0ge3N0cmluZ30gW3VuaXRzPVwia2lsb21ldGVyc1wiXSBjYW4gYmUgZGVncmVlcywgcmFkaWFucywgbWlsZXMsIG9yIGtpbG9tZXRlcnMgaW5jaGVzLCB5YXJkcywgbWV0cmVzLFxuICogbWV0ZXJzLCBraWxvbWV0cmVzLCBraWxvbWV0ZXJzLlxuICogQHJldHVybnMge251bWJlcn0gcmFkaWFuc1xuICovXG5mdW5jdGlvbiBsZW5ndGhUb1JhZGlhbnMoZGlzdGFuY2UsIHVuaXRzKSB7XG4gICAgaWYgKHVuaXRzID09PSB2b2lkIDApIHsgdW5pdHMgPSBcImtpbG9tZXRlcnNcIjsgfVxuICAgIHZhciBmYWN0b3IgPSBleHBvcnRzLmZhY3RvcnNbdW5pdHNdO1xuICAgIGlmICghZmFjdG9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcih1bml0cyArIFwiIHVuaXRzIGlzIGludmFsaWRcIik7XG4gICAgfVxuICAgIHJldHVybiBkaXN0YW5jZSAvIGZhY3Rvcjtcbn1cbmV4cG9ydHMubGVuZ3RoVG9SYWRpYW5zID0gbGVuZ3RoVG9SYWRpYW5zO1xuLyoqXG4gKiBDb252ZXJ0IGEgZGlzdGFuY2UgbWVhc3VyZW1lbnQgKGFzc3VtaW5nIGEgc3BoZXJpY2FsIEVhcnRoKSBmcm9tIGEgcmVhbC13b3JsZCB1bml0IGludG8gZGVncmVlc1xuICogVmFsaWQgdW5pdHM6IG1pbGVzLCBuYXV0aWNhbG1pbGVzLCBpbmNoZXMsIHlhcmRzLCBtZXRlcnMsIG1ldHJlcywgY2VudGltZXRlcnMsIGtpbG9tZXRyZXMsIGZlZXRcbiAqXG4gKiBAbmFtZSBsZW5ndGhUb0RlZ3JlZXNcbiAqIEBwYXJhbSB7bnVtYmVyfSBkaXN0YW5jZSBpbiByZWFsIHVuaXRzXG4gKiBAcGFyYW0ge3N0cmluZ30gW3VuaXRzPVwia2lsb21ldGVyc1wiXSBjYW4gYmUgZGVncmVlcywgcmFkaWFucywgbWlsZXMsIG9yIGtpbG9tZXRlcnMgaW5jaGVzLCB5YXJkcywgbWV0cmVzLFxuICogbWV0ZXJzLCBraWxvbWV0cmVzLCBraWxvbWV0ZXJzLlxuICogQHJldHVybnMge251bWJlcn0gZGVncmVlc1xuICovXG5mdW5jdGlvbiBsZW5ndGhUb0RlZ3JlZXMoZGlzdGFuY2UsIHVuaXRzKSB7XG4gICAgcmV0dXJuIHJhZGlhbnNUb0RlZ3JlZXMobGVuZ3RoVG9SYWRpYW5zKGRpc3RhbmNlLCB1bml0cykpO1xufVxuZXhwb3J0cy5sZW5ndGhUb0RlZ3JlZXMgPSBsZW5ndGhUb0RlZ3JlZXM7XG4vKipcbiAqIENvbnZlcnRzIGFueSBiZWFyaW5nIGFuZ2xlIGZyb20gdGhlIG5vcnRoIGxpbmUgZGlyZWN0aW9uIChwb3NpdGl2ZSBjbG9ja3dpc2UpXG4gKiBhbmQgcmV0dXJucyBhbiBhbmdsZSBiZXR3ZWVuIDAtMzYwIGRlZ3JlZXMgKHBvc2l0aXZlIGNsb2Nrd2lzZSksIDAgYmVpbmcgdGhlIG5vcnRoIGxpbmVcbiAqXG4gKiBAbmFtZSBiZWFyaW5nVG9BemltdXRoXG4gKiBAcGFyYW0ge251bWJlcn0gYmVhcmluZyBhbmdsZSwgYmV0d2VlbiAtMTgwIGFuZCArMTgwIGRlZ3JlZXNcbiAqIEByZXR1cm5zIHtudW1iZXJ9IGFuZ2xlIGJldHdlZW4gMCBhbmQgMzYwIGRlZ3JlZXNcbiAqL1xuZnVuY3Rpb24gYmVhcmluZ1RvQXppbXV0aChiZWFyaW5nKSB7XG4gICAgdmFyIGFuZ2xlID0gYmVhcmluZyAlIDM2MDtcbiAgICBpZiAoYW5nbGUgPCAwKSB7XG4gICAgICAgIGFuZ2xlICs9IDM2MDtcbiAgICB9XG4gICAgcmV0dXJuIGFuZ2xlO1xufVxuZXhwb3J0cy5iZWFyaW5nVG9BemltdXRoID0gYmVhcmluZ1RvQXppbXV0aDtcbi8qKlxuICogQ29udmVydHMgYW4gYW5nbGUgaW4gcmFkaWFucyB0byBkZWdyZWVzXG4gKlxuICogQG5hbWUgcmFkaWFuc1RvRGVncmVlc1xuICogQHBhcmFtIHtudW1iZXJ9IHJhZGlhbnMgYW5nbGUgaW4gcmFkaWFuc1xuICogQHJldHVybnMge251bWJlcn0gZGVncmVlcyBiZXR3ZWVuIDAgYW5kIDM2MCBkZWdyZWVzXG4gKi9cbmZ1bmN0aW9uIHJhZGlhbnNUb0RlZ3JlZXMocmFkaWFucykge1xuICAgIHZhciBkZWdyZWVzID0gcmFkaWFucyAlICgyICogTWF0aC5QSSk7XG4gICAgcmV0dXJuIGRlZ3JlZXMgKiAxODAgLyBNYXRoLlBJO1xufVxuZXhwb3J0cy5yYWRpYW5zVG9EZWdyZWVzID0gcmFkaWFuc1RvRGVncmVlcztcbi8qKlxuICogQ29udmVydHMgYW4gYW5nbGUgaW4gZGVncmVlcyB0byByYWRpYW5zXG4gKlxuICogQG5hbWUgZGVncmVlc1RvUmFkaWFuc1xuICogQHBhcmFtIHtudW1iZXJ9IGRlZ3JlZXMgYW5nbGUgYmV0d2VlbiAwIGFuZCAzNjAgZGVncmVlc1xuICogQHJldHVybnMge251bWJlcn0gYW5nbGUgaW4gcmFkaWFuc1xuICovXG5mdW5jdGlvbiBkZWdyZWVzVG9SYWRpYW5zKGRlZ3JlZXMpIHtcbiAgICB2YXIgcmFkaWFucyA9IGRlZ3JlZXMgJSAzNjA7XG4gICAgcmV0dXJuIHJhZGlhbnMgKiBNYXRoLlBJIC8gMTgwO1xufVxuZXhwb3J0cy5kZWdyZWVzVG9SYWRpYW5zID0gZGVncmVlc1RvUmFkaWFucztcbi8qKlxuICogQ29udmVydHMgYSBsZW5ndGggdG8gdGhlIHJlcXVlc3RlZCB1bml0LlxuICogVmFsaWQgdW5pdHM6IG1pbGVzLCBuYXV0aWNhbG1pbGVzLCBpbmNoZXMsIHlhcmRzLCBtZXRlcnMsIG1ldHJlcywga2lsb21ldGVycywgY2VudGltZXRlcnMsIGZlZXRcbiAqXG4gKiBAcGFyYW0ge251bWJlcn0gbGVuZ3RoIHRvIGJlIGNvbnZlcnRlZFxuICogQHBhcmFtIHtVbml0c30gW29yaWdpbmFsVW5pdD1cImtpbG9tZXRlcnNcIl0gb2YgdGhlIGxlbmd0aFxuICogQHBhcmFtIHtVbml0c30gW2ZpbmFsVW5pdD1cImtpbG9tZXRlcnNcIl0gcmV0dXJuZWQgdW5pdFxuICogQHJldHVybnMge251bWJlcn0gdGhlIGNvbnZlcnRlZCBsZW5ndGhcbiAqL1xuZnVuY3Rpb24gY29udmVydExlbmd0aChsZW5ndGgsIG9yaWdpbmFsVW5pdCwgZmluYWxVbml0KSB7XG4gICAgaWYgKG9yaWdpbmFsVW5pdCA9PT0gdm9pZCAwKSB7IG9yaWdpbmFsVW5pdCA9IFwia2lsb21ldGVyc1wiOyB9XG4gICAgaWYgKGZpbmFsVW5pdCA9PT0gdm9pZCAwKSB7IGZpbmFsVW5pdCA9IFwia2lsb21ldGVyc1wiOyB9XG4gICAgaWYgKCEobGVuZ3RoID49IDApKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImxlbmd0aCBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIpO1xuICAgIH1cbiAgICByZXR1cm4gcmFkaWFuc1RvTGVuZ3RoKGxlbmd0aFRvUmFkaWFucyhsZW5ndGgsIG9yaWdpbmFsVW5pdCksIGZpbmFsVW5pdCk7XG59XG5leHBvcnRzLmNvbnZlcnRMZW5ndGggPSBjb252ZXJ0TGVuZ3RoO1xuLyoqXG4gKiBDb252ZXJ0cyBhIGFyZWEgdG8gdGhlIHJlcXVlc3RlZCB1bml0LlxuICogVmFsaWQgdW5pdHM6IGtpbG9tZXRlcnMsIGtpbG9tZXRyZXMsIG1ldGVycywgbWV0cmVzLCBjZW50aW1ldHJlcywgbWlsbGltZXRlcnMsIGFjcmVzLCBtaWxlcywgeWFyZHMsIGZlZXQsIGluY2hlc1xuICogQHBhcmFtIHtudW1iZXJ9IGFyZWEgdG8gYmUgY29udmVydGVkXG4gKiBAcGFyYW0ge1VuaXRzfSBbb3JpZ2luYWxVbml0PVwibWV0ZXJzXCJdIG9mIHRoZSBkaXN0YW5jZVxuICogQHBhcmFtIHtVbml0c30gW2ZpbmFsVW5pdD1cImtpbG9tZXRlcnNcIl0gcmV0dXJuZWQgdW5pdFxuICogQHJldHVybnMge251bWJlcn0gdGhlIGNvbnZlcnRlZCBkaXN0YW5jZVxuICovXG5mdW5jdGlvbiBjb252ZXJ0QXJlYShhcmVhLCBvcmlnaW5hbFVuaXQsIGZpbmFsVW5pdCkge1xuICAgIGlmIChvcmlnaW5hbFVuaXQgPT09IHZvaWQgMCkgeyBvcmlnaW5hbFVuaXQgPSBcIm1ldGVyc1wiOyB9XG4gICAgaWYgKGZpbmFsVW5pdCA9PT0gdm9pZCAwKSB7IGZpbmFsVW5pdCA9IFwia2lsb21ldGVyc1wiOyB9XG4gICAgaWYgKCEoYXJlYSA+PSAwKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJhcmVhIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXJcIik7XG4gICAgfVxuICAgIHZhciBzdGFydEZhY3RvciA9IGV4cG9ydHMuYXJlYUZhY3RvcnNbb3JpZ2luYWxVbml0XTtcbiAgICBpZiAoIXN0YXJ0RmFjdG9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImludmFsaWQgb3JpZ2luYWwgdW5pdHNcIik7XG4gICAgfVxuICAgIHZhciBmaW5hbEZhY3RvciA9IGV4cG9ydHMuYXJlYUZhY3RvcnNbZmluYWxVbml0XTtcbiAgICBpZiAoIWZpbmFsRmFjdG9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImludmFsaWQgZmluYWwgdW5pdHNcIik7XG4gICAgfVxuICAgIHJldHVybiAoYXJlYSAvIHN0YXJ0RmFjdG9yKSAqIGZpbmFsRmFjdG9yO1xufVxuZXhwb3J0cy5jb252ZXJ0QXJlYSA9IGNvbnZlcnRBcmVhO1xuLyoqXG4gKiBpc051bWJlclxuICpcbiAqIEBwYXJhbSB7Kn0gbnVtIE51bWJlciB0byB2YWxpZGF0ZVxuICogQHJldHVybnMge2Jvb2xlYW59IHRydWUvZmFsc2VcbiAqIEBleGFtcGxlXG4gKiB0dXJmLmlzTnVtYmVyKDEyMylcbiAqIC8vPXRydWVcbiAqIHR1cmYuaXNOdW1iZXIoJ2ZvbycpXG4gKiAvLz1mYWxzZVxuICovXG5mdW5jdGlvbiBpc051bWJlcihudW0pIHtcbiAgICByZXR1cm4gIWlzTmFOKG51bSkgJiYgbnVtICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KG51bSkgJiYgIS9eXFxzKiQvLnRlc3QobnVtKTtcbn1cbmV4cG9ydHMuaXNOdW1iZXIgPSBpc051bWJlcjtcbi8qKlxuICogaXNPYmplY3RcbiAqXG4gKiBAcGFyYW0geyp9IGlucHV0IHZhcmlhYmxlIHRvIHZhbGlkYXRlXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gdHJ1ZS9mYWxzZVxuICogQGV4YW1wbGVcbiAqIHR1cmYuaXNPYmplY3Qoe2VsZXZhdGlvbjogMTB9KVxuICogLy89dHJ1ZVxuICogdHVyZi5pc09iamVjdCgnZm9vJylcbiAqIC8vPWZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KGlucHV0KSB7XG4gICAgcmV0dXJuICghIWlucHV0KSAmJiAoaW5wdXQuY29uc3RydWN0b3IgPT09IE9iamVjdCk7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG4vKipcbiAqIFZhbGlkYXRlIEJCb3hcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtBcnJheTxudW1iZXI+fSBiYm94IEJCb3ggdG8gdmFsaWRhdGVcbiAqIEByZXR1cm5zIHt2b2lkfVxuICogQHRocm93cyBFcnJvciBpZiBCQm94IGlzIG5vdCB2YWxpZFxuICogQGV4YW1wbGVcbiAqIHZhbGlkYXRlQkJveChbLTE4MCwgLTQwLCAxMTAsIDUwXSlcbiAqIC8vPU9LXG4gKiB2YWxpZGF0ZUJCb3goWy0xODAsIC00MF0pXG4gKiAvLz1FcnJvclxuICogdmFsaWRhdGVCQm94KCdGb28nKVxuICogLy89RXJyb3JcbiAqIHZhbGlkYXRlQkJveCg1KVxuICogLy89RXJyb3JcbiAqIHZhbGlkYXRlQkJveChudWxsKVxuICogLy89RXJyb3JcbiAqIHZhbGlkYXRlQkJveCh1bmRlZmluZWQpXG4gKiAvLz1FcnJvclxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZUJCb3goYmJveCkge1xuICAgIGlmICghYmJveCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJiYm94IGlzIHJlcXVpcmVkXCIpO1xuICAgIH1cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYmJveCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiYmJveCBtdXN0IGJlIGFuIEFycmF5XCIpO1xuICAgIH1cbiAgICBpZiAoYmJveC5sZW5ndGggIT09IDQgJiYgYmJveC5sZW5ndGggIT09IDYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiYmJveCBtdXN0IGJlIGFuIEFycmF5IG9mIDQgb3IgNiBudW1iZXJzXCIpO1xuICAgIH1cbiAgICBiYm94LmZvckVhY2goZnVuY3Rpb24gKG51bSkge1xuICAgICAgICBpZiAoIWlzTnVtYmVyKG51bSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImJib3ggbXVzdCBvbmx5IGNvbnRhaW4gbnVtYmVyc1wiKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuZXhwb3J0cy52YWxpZGF0ZUJCb3ggPSB2YWxpZGF0ZUJCb3g7XG4vKipcbiAqIFZhbGlkYXRlIElkXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gaWQgSWQgdG8gdmFsaWRhdGVcbiAqIEByZXR1cm5zIHt2b2lkfVxuICogQHRocm93cyBFcnJvciBpZiBJZCBpcyBub3QgdmFsaWRcbiAqIEBleGFtcGxlXG4gKiB2YWxpZGF0ZUlkKFstMTgwLCAtNDAsIDExMCwgNTBdKVxuICogLy89RXJyb3JcbiAqIHZhbGlkYXRlSWQoWy0xODAsIC00MF0pXG4gKiAvLz1FcnJvclxuICogdmFsaWRhdGVJZCgnRm9vJylcbiAqIC8vPU9LXG4gKiB2YWxpZGF0ZUlkKDUpXG4gKiAvLz1PS1xuICogdmFsaWRhdGVJZChudWxsKVxuICogLy89RXJyb3JcbiAqIHZhbGlkYXRlSWQodW5kZWZpbmVkKVxuICogLy89RXJyb3JcbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVJZChpZCkge1xuICAgIGlmICghaWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWQgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuICAgIGlmIChbXCJzdHJpbmdcIiwgXCJudW1iZXJcIl0uaW5kZXhPZih0eXBlb2YgaWQpID09PSAtMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpZCBtdXN0IGJlIGEgbnVtYmVyIG9yIGEgc3RyaW5nXCIpO1xuICAgIH1cbn1cbmV4cG9ydHMudmFsaWRhdGVJZCA9IHZhbGlkYXRlSWQ7XG4vLyBEZXByZWNhdGVkIG1ldGhvZHNcbmZ1bmN0aW9uIHJhZGlhbnMyZGVncmVlcygpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJtZXRob2QgaGFzIGJlZW4gcmVuYW1lZCB0byBgcmFkaWFuc1RvRGVncmVlc2BcIik7XG59XG5leHBvcnRzLnJhZGlhbnMyZGVncmVlcyA9IHJhZGlhbnMyZGVncmVlcztcbmZ1bmN0aW9uIGRlZ3JlZXMycmFkaWFucygpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJtZXRob2QgaGFzIGJlZW4gcmVuYW1lZCB0byBgZGVncmVlc1RvUmFkaWFuc2BcIik7XG59XG5leHBvcnRzLmRlZ3JlZXMycmFkaWFucyA9IGRlZ3JlZXMycmFkaWFucztcbmZ1bmN0aW9uIGRpc3RhbmNlVG9EZWdyZWVzKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIm1ldGhvZCBoYXMgYmVlbiByZW5hbWVkIHRvIGBsZW5ndGhUb0RlZ3JlZXNgXCIpO1xufVxuZXhwb3J0cy5kaXN0YW5jZVRvRGVncmVlcyA9IGRpc3RhbmNlVG9EZWdyZWVzO1xuZnVuY3Rpb24gZGlzdGFuY2VUb1JhZGlhbnMoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwibWV0aG9kIGhhcyBiZWVuIHJlbmFtZWQgdG8gYGxlbmd0aFRvUmFkaWFuc2BcIik7XG59XG5leHBvcnRzLmRpc3RhbmNlVG9SYWRpYW5zID0gZGlzdGFuY2VUb1JhZGlhbnM7XG5mdW5jdGlvbiByYWRpYW5zVG9EaXN0YW5jZSgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJtZXRob2QgaGFzIGJlZW4gcmVuYW1lZCB0byBgcmFkaWFuc1RvTGVuZ3RoYFwiKTtcbn1cbmV4cG9ydHMucmFkaWFuc1RvRGlzdGFuY2UgPSByYWRpYW5zVG9EaXN0YW5jZTtcbmZ1bmN0aW9uIGJlYXJpbmdUb0FuZ2xlKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIm1ldGhvZCBoYXMgYmVlbiByZW5hbWVkIHRvIGBiZWFyaW5nVG9BemltdXRoYFwiKTtcbn1cbmV4cG9ydHMuYmVhcmluZ1RvQW5nbGUgPSBiZWFyaW5nVG9BbmdsZTtcbmZ1bmN0aW9uIGNvbnZlcnREaXN0YW5jZSgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJtZXRob2QgaGFzIGJlZW4gcmVuYW1lZCB0byBgY29udmVydExlbmd0aGBcIik7XG59XG5leHBvcnRzLmNvbnZlcnREaXN0YW5jZSA9IGNvbnZlcnREaXN0YW5jZTtcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbnZhciBoZWxwZXJzXzEgPSByZXF1aXJlKFwiQHR1cmYvaGVscGVyc1wiKTtcclxuLyoqXHJcbiAqIFVud3JhcCBhIGNvb3JkaW5hdGUgZnJvbSBhIFBvaW50IEZlYXR1cmUsIEdlb21ldHJ5IG9yIGEgc2luZ2xlIGNvb3JkaW5hdGUuXHJcbiAqXHJcbiAqIEBuYW1lIGdldENvb3JkXHJcbiAqIEBwYXJhbSB7QXJyYXk8bnVtYmVyPnxHZW9tZXRyeTxQb2ludD58RmVhdHVyZTxQb2ludD59IGNvb3JkIEdlb0pTT04gUG9pbnQgb3IgYW4gQXJyYXkgb2YgbnVtYmVyc1xyXG4gKiBAcmV0dXJucyB7QXJyYXk8bnVtYmVyPn0gY29vcmRpbmF0ZXNcclxuICogQGV4YW1wbGVcclxuICogdmFyIHB0ID0gdHVyZi5wb2ludChbMTAsIDEwXSk7XHJcbiAqXHJcbiAqIHZhciBjb29yZCA9IHR1cmYuZ2V0Q29vcmQocHQpO1xyXG4gKiAvLz0gWzEwLCAxMF1cclxuICovXHJcbmZ1bmN0aW9uIGdldENvb3JkKGNvb3JkKSB7XHJcbiAgICBpZiAoIWNvb3JkKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY29vcmQgaXMgcmVxdWlyZWRcIik7XHJcbiAgICB9XHJcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoY29vcmQpKSB7XHJcbiAgICAgICAgaWYgKGNvb3JkLnR5cGUgPT09IFwiRmVhdHVyZVwiICYmIGNvb3JkLmdlb21ldHJ5ICE9PSBudWxsICYmIGNvb3JkLmdlb21ldHJ5LnR5cGUgPT09IFwiUG9pbnRcIikge1xyXG4gICAgICAgICAgICByZXR1cm4gY29vcmQuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChjb29yZC50eXBlID09PSBcIlBvaW50XCIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNvb3JkLmNvb3JkaW5hdGVzO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmIChBcnJheS5pc0FycmF5KGNvb3JkKSAmJiBjb29yZC5sZW5ndGggPj0gMiAmJiAhQXJyYXkuaXNBcnJheShjb29yZFswXSkgJiYgIUFycmF5LmlzQXJyYXkoY29vcmRbMV0pKSB7XHJcbiAgICAgICAgcmV0dXJuIGNvb3JkO1xyXG4gICAgfVxyXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiY29vcmQgbXVzdCBiZSBHZW9KU09OIFBvaW50IG9yIGFuIEFycmF5IG9mIG51bWJlcnNcIik7XHJcbn1cclxuZXhwb3J0cy5nZXRDb29yZCA9IGdldENvb3JkO1xyXG4vKipcclxuICogVW53cmFwIGNvb3JkaW5hdGVzIGZyb20gYSBGZWF0dXJlLCBHZW9tZXRyeSBPYmplY3Qgb3IgYW4gQXJyYXlcclxuICpcclxuICogQG5hbWUgZ2V0Q29vcmRzXHJcbiAqIEBwYXJhbSB7QXJyYXk8YW55PnxHZW9tZXRyeXxGZWF0dXJlfSBjb29yZHMgRmVhdHVyZSwgR2VvbWV0cnkgT2JqZWN0IG9yIGFuIEFycmF5XHJcbiAqIEByZXR1cm5zIHtBcnJheTxhbnk+fSBjb29yZGluYXRlc1xyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgcG9seSA9IHR1cmYucG9seWdvbihbW1sxMTkuMzIsIC04LjddLCBbMTE5LjU1LCAtOC42OV0sIFsxMTkuNTEsIC04LjU0XSwgWzExOS4zMiwgLTguN11dXSk7XHJcbiAqXHJcbiAqIHZhciBjb29yZHMgPSB0dXJmLmdldENvb3Jkcyhwb2x5KTtcclxuICogLy89IFtbWzExOS4zMiwgLTguN10sIFsxMTkuNTUsIC04LjY5XSwgWzExOS41MSwgLTguNTRdLCBbMTE5LjMyLCAtOC43XV1dXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRDb29yZHMoY29vcmRzKSB7XHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShjb29yZHMpKSB7XHJcbiAgICAgICAgcmV0dXJuIGNvb3JkcztcclxuICAgIH1cclxuICAgIC8vIEZlYXR1cmVcclxuICAgIGlmIChjb29yZHMudHlwZSA9PT0gXCJGZWF0dXJlXCIpIHtcclxuICAgICAgICBpZiAoY29vcmRzLmdlb21ldHJ5ICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjb29yZHMuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgLy8gR2VvbWV0cnlcclxuICAgICAgICBpZiAoY29vcmRzLmNvb3JkaW5hdGVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjb29yZHMuY29vcmRpbmF0ZXM7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiY29vcmRzIG11c3QgYmUgR2VvSlNPTiBGZWF0dXJlLCBHZW9tZXRyeSBPYmplY3Qgb3IgYW4gQXJyYXlcIik7XHJcbn1cclxuZXhwb3J0cy5nZXRDb29yZHMgPSBnZXRDb29yZHM7XHJcbi8qKlxyXG4gKiBDaGVja3MgaWYgY29vcmRpbmF0ZXMgY29udGFpbnMgYSBudW1iZXJcclxuICpcclxuICogQG5hbWUgY29udGFpbnNOdW1iZXJcclxuICogQHBhcmFtIHtBcnJheTxhbnk+fSBjb29yZGluYXRlcyBHZW9KU09OIENvb3JkaW5hdGVzXHJcbiAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmIEFycmF5IGNvbnRhaW5zIGEgbnVtYmVyXHJcbiAqL1xyXG5mdW5jdGlvbiBjb250YWluc051bWJlcihjb29yZGluYXRlcykge1xyXG4gICAgaWYgKGNvb3JkaW5hdGVzLmxlbmd0aCA+IDEgJiYgaGVscGVyc18xLmlzTnVtYmVyKGNvb3JkaW5hdGVzWzBdKSAmJiBoZWxwZXJzXzEuaXNOdW1iZXIoY29vcmRpbmF0ZXNbMV0pKSB7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShjb29yZGluYXRlc1swXSkgJiYgY29vcmRpbmF0ZXNbMF0ubGVuZ3RoKSB7XHJcbiAgICAgICAgcmV0dXJuIGNvbnRhaW5zTnVtYmVyKGNvb3JkaW5hdGVzWzBdKTtcclxuICAgIH1cclxuICAgIHRocm93IG5ldyBFcnJvcihcImNvb3JkaW5hdGVzIG11c3Qgb25seSBjb250YWluIG51bWJlcnNcIik7XHJcbn1cclxuZXhwb3J0cy5jb250YWluc051bWJlciA9IGNvbnRhaW5zTnVtYmVyO1xyXG4vKipcclxuICogRW5mb3JjZSBleHBlY3RhdGlvbnMgYWJvdXQgdHlwZXMgb2YgR2VvSlNPTiBvYmplY3RzIGZvciBUdXJmLlxyXG4gKlxyXG4gKiBAbmFtZSBnZW9qc29uVHlwZVxyXG4gKiBAcGFyYW0ge0dlb0pTT059IHZhbHVlIGFueSBHZW9KU09OIG9iamVjdFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBleHBlY3RlZCBHZW9KU09OIHR5cGVcclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgbmFtZSBvZiBjYWxsaW5nIGZ1bmN0aW9uXHJcbiAqIEB0aHJvd3Mge0Vycm9yfSBpZiB2YWx1ZSBpcyBub3QgdGhlIGV4cGVjdGVkIHR5cGUuXHJcbiAqL1xyXG5mdW5jdGlvbiBnZW9qc29uVHlwZSh2YWx1ZSwgdHlwZSwgbmFtZSkge1xyXG4gICAgaWYgKCF0eXBlIHx8ICFuYW1lKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwidHlwZSBhbmQgbmFtZSByZXF1aXJlZFwiKTtcclxuICAgIH1cclxuICAgIGlmICghdmFsdWUgfHwgdmFsdWUudHlwZSAhPT0gdHlwZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgaW5wdXQgdG8gXCIgKyBuYW1lICsgXCI6IG11c3QgYmUgYSBcIiArIHR5cGUgKyBcIiwgZ2l2ZW4gXCIgKyB2YWx1ZS50eXBlKTtcclxuICAgIH1cclxufVxyXG5leHBvcnRzLmdlb2pzb25UeXBlID0gZ2VvanNvblR5cGU7XHJcbi8qKlxyXG4gKiBFbmZvcmNlIGV4cGVjdGF0aW9ucyBhYm91dCB0eXBlcyBvZiB7QGxpbmsgRmVhdHVyZX0gaW5wdXRzIGZvciBUdXJmLlxyXG4gKiBJbnRlcm5hbGx5IHRoaXMgdXNlcyB7QGxpbmsgZ2VvanNvblR5cGV9IHRvIGp1ZGdlIGdlb21ldHJ5IHR5cGVzLlxyXG4gKlxyXG4gKiBAbmFtZSBmZWF0dXJlT2ZcclxuICogQHBhcmFtIHtGZWF0dXJlfSBmZWF0dXJlIGEgZmVhdHVyZSB3aXRoIGFuIGV4cGVjdGVkIGdlb21ldHJ5IHR5cGVcclxuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgZXhwZWN0ZWQgR2VvSlNPTiB0eXBlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIG5hbWUgb2YgY2FsbGluZyBmdW5jdGlvblxyXG4gKiBAdGhyb3dzIHtFcnJvcn0gZXJyb3IgaWYgdmFsdWUgaXMgbm90IHRoZSBleHBlY3RlZCB0eXBlLlxyXG4gKi9cclxuZnVuY3Rpb24gZmVhdHVyZU9mKGZlYXR1cmUsIHR5cGUsIG5hbWUpIHtcclxuICAgIGlmICghZmVhdHVyZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIGZlYXR1cmUgcGFzc2VkXCIpO1xyXG4gICAgfVxyXG4gICAgaWYgKCFuYW1lKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiLmZlYXR1cmVPZigpIHJlcXVpcmVzIGEgbmFtZVwiKTtcclxuICAgIH1cclxuICAgIGlmICghZmVhdHVyZSB8fCBmZWF0dXJlLnR5cGUgIT09IFwiRmVhdHVyZVwiIHx8ICFmZWF0dXJlLmdlb21ldHJ5KSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBpbnB1dCB0byBcIiArIG5hbWUgKyBcIiwgRmVhdHVyZSB3aXRoIGdlb21ldHJ5IHJlcXVpcmVkXCIpO1xyXG4gICAgfVxyXG4gICAgaWYgKCFmZWF0dXJlLmdlb21ldHJ5IHx8IGZlYXR1cmUuZ2VvbWV0cnkudHlwZSAhPT0gdHlwZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgaW5wdXQgdG8gXCIgKyBuYW1lICsgXCI6IG11c3QgYmUgYSBcIiArIHR5cGUgKyBcIiwgZ2l2ZW4gXCIgKyBmZWF0dXJlLmdlb21ldHJ5LnR5cGUpO1xyXG4gICAgfVxyXG59XHJcbmV4cG9ydHMuZmVhdHVyZU9mID0gZmVhdHVyZU9mO1xyXG4vKipcclxuICogRW5mb3JjZSBleHBlY3RhdGlvbnMgYWJvdXQgdHlwZXMgb2Yge0BsaW5rIEZlYXR1cmVDb2xsZWN0aW9ufSBpbnB1dHMgZm9yIFR1cmYuXHJcbiAqIEludGVybmFsbHkgdGhpcyB1c2VzIHtAbGluayBnZW9qc29uVHlwZX0gdG8ganVkZ2UgZ2VvbWV0cnkgdHlwZXMuXHJcbiAqXHJcbiAqIEBuYW1lIGNvbGxlY3Rpb25PZlxyXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufSBmZWF0dXJlQ29sbGVjdGlvbiBhIEZlYXR1cmVDb2xsZWN0aW9uIGZvciB3aGljaCBmZWF0dXJlcyB3aWxsIGJlIGp1ZGdlZFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBleHBlY3RlZCBHZW9KU09OIHR5cGVcclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgbmFtZSBvZiBjYWxsaW5nIGZ1bmN0aW9uXHJcbiAqIEB0aHJvd3Mge0Vycm9yfSBpZiB2YWx1ZSBpcyBub3QgdGhlIGV4cGVjdGVkIHR5cGUuXHJcbiAqL1xyXG5mdW5jdGlvbiBjb2xsZWN0aW9uT2YoZmVhdHVyZUNvbGxlY3Rpb24sIHR5cGUsIG5hbWUpIHtcclxuICAgIGlmICghZmVhdHVyZUNvbGxlY3Rpb24pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBmZWF0dXJlQ29sbGVjdGlvbiBwYXNzZWRcIik7XHJcbiAgICB9XHJcbiAgICBpZiAoIW5hbWUpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCIuY29sbGVjdGlvbk9mKCkgcmVxdWlyZXMgYSBuYW1lXCIpO1xyXG4gICAgfVxyXG4gICAgaWYgKCFmZWF0dXJlQ29sbGVjdGlvbiB8fCBmZWF0dXJlQ29sbGVjdGlvbi50eXBlICE9PSBcIkZlYXR1cmVDb2xsZWN0aW9uXCIpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGlucHV0IHRvIFwiICsgbmFtZSArIFwiLCBGZWF0dXJlQ29sbGVjdGlvbiByZXF1aXJlZFwiKTtcclxuICAgIH1cclxuICAgIGZvciAodmFyIF9pID0gMCwgX2EgPSBmZWF0dXJlQ29sbGVjdGlvbi5mZWF0dXJlczsgX2kgPCBfYS5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICB2YXIgZmVhdHVyZSA9IF9hW19pXTtcclxuICAgICAgICBpZiAoIWZlYXR1cmUgfHwgZmVhdHVyZS50eXBlICE9PSBcIkZlYXR1cmVcIiB8fCAhZmVhdHVyZS5nZW9tZXRyeSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGlucHV0IHRvIFwiICsgbmFtZSArIFwiLCBGZWF0dXJlIHdpdGggZ2VvbWV0cnkgcmVxdWlyZWRcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghZmVhdHVyZS5nZW9tZXRyeSB8fCBmZWF0dXJlLmdlb21ldHJ5LnR5cGUgIT09IHR5cGUpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBpbnB1dCB0byBcIiArIG5hbWUgKyBcIjogbXVzdCBiZSBhIFwiICsgdHlwZSArIFwiLCBnaXZlbiBcIiArIGZlYXR1cmUuZ2VvbWV0cnkudHlwZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbmV4cG9ydHMuY29sbGVjdGlvbk9mID0gY29sbGVjdGlvbk9mO1xyXG4vKipcclxuICogR2V0IEdlb21ldHJ5IGZyb20gRmVhdHVyZSBvciBHZW9tZXRyeSBPYmplY3RcclxuICpcclxuICogQHBhcmFtIHtGZWF0dXJlfEdlb21ldHJ5fSBnZW9qc29uIEdlb0pTT04gRmVhdHVyZSBvciBHZW9tZXRyeSBPYmplY3RcclxuICogQHJldHVybnMge0dlb21ldHJ5fG51bGx9IEdlb0pTT04gR2VvbWV0cnkgT2JqZWN0XHJcbiAqIEB0aHJvd3Mge0Vycm9yfSBpZiBnZW9qc29uIGlzIG5vdCBhIEZlYXR1cmUgb3IgR2VvbWV0cnkgT2JqZWN0XHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciBwb2ludCA9IHtcclxuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXHJcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxyXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xyXG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcclxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWzExMCwgNDBdXHJcbiAqICAgfVxyXG4gKiB9XHJcbiAqIHZhciBnZW9tID0gdHVyZi5nZXRHZW9tKHBvaW50KVxyXG4gKiAvLz17XCJ0eXBlXCI6IFwiUG9pbnRcIiwgXCJjb29yZGluYXRlc1wiOiBbMTEwLCA0MF19XHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRHZW9tKGdlb2pzb24pIHtcclxuICAgIGlmIChnZW9qc29uLnR5cGUgPT09IFwiRmVhdHVyZVwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdlb2pzb24uZ2VvbWV0cnk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZ2VvanNvbjtcclxufVxyXG5leHBvcnRzLmdldEdlb20gPSBnZXRHZW9tO1xyXG4vKipcclxuICogR2V0IEdlb0pTT04gb2JqZWN0J3MgdHlwZSwgR2VvbWV0cnkgdHlwZSBpcyBwcmlvcml0aXplLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0dlb0pTT059IGdlb2pzb24gR2VvSlNPTiBvYmplY3RcclxuICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lPVwiZ2VvanNvblwiXSBuYW1lIG9mIHRoZSB2YXJpYWJsZSB0byBkaXNwbGF5IGluIGVycm9yIG1lc3NhZ2VcclxuICogQHJldHVybnMge3N0cmluZ30gR2VvSlNPTiB0eXBlXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciBwb2ludCA9IHtcclxuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXHJcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxyXG4gKiAgIFwiZ2VvbWV0cnlcIjoge1xyXG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcclxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogWzExMCwgNDBdXHJcbiAqICAgfVxyXG4gKiB9XHJcbiAqIHZhciBnZW9tID0gdHVyZi5nZXRUeXBlKHBvaW50KVxyXG4gKiAvLz1cIlBvaW50XCJcclxuICovXHJcbmZ1bmN0aW9uIGdldFR5cGUoZ2VvanNvbiwgbmFtZSkge1xyXG4gICAgaWYgKGdlb2pzb24udHlwZSA9PT0gXCJGZWF0dXJlQ29sbGVjdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIFwiRmVhdHVyZUNvbGxlY3Rpb25cIjtcclxuICAgIH1cclxuICAgIGlmIChnZW9qc29uLnR5cGUgPT09IFwiR2VvbWV0cnlDb2xsZWN0aW9uXCIpIHtcclxuICAgICAgICByZXR1cm4gXCJHZW9tZXRyeUNvbGxlY3Rpb25cIjtcclxuICAgIH1cclxuICAgIGlmIChnZW9qc29uLnR5cGUgPT09IFwiRmVhdHVyZVwiICYmIGdlb2pzb24uZ2VvbWV0cnkgIT09IG51bGwpIHtcclxuICAgICAgICByZXR1cm4gZ2VvanNvbi5nZW9tZXRyeS50eXBlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGdlb2pzb24udHlwZTtcclxufVxyXG5leHBvcnRzLmdldFR5cGUgPSBnZXRUeXBlO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBfX2ltcG9ydERlZmF1bHQgPSAodGhpcyAmJiB0aGlzLl9faW1wb3J0RGVmYXVsdCkgfHwgZnVuY3Rpb24gKG1vZCkge1xuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgXCJkZWZhdWx0XCI6IG1vZCB9O1xufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xudmFyIGhlbHBlcnNfMSA9IHJlcXVpcmUoXCJAdHVyZi9oZWxwZXJzXCIpO1xudmFyIGludmFyaWFudF8xID0gcmVxdWlyZShcIkB0dXJmL2ludmFyaWFudFwiKTtcbnZhciBsaW5lX3NlZ21lbnRfMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwiQHR1cmYvbGluZS1zZWdtZW50XCIpKTtcbnZhciBtZXRhXzEgPSByZXF1aXJlKFwiQHR1cmYvbWV0YVwiKTtcbnZhciBnZW9qc29uX3JidXNoXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcImdlb2pzb24tcmJ1c2hcIikpO1xuLyoqXG4gKiBUYWtlcyBhbnkgTGluZVN0cmluZyBvciBQb2x5Z29uIEdlb0pTT04gYW5kIHJldHVybnMgdGhlIGludGVyc2VjdGluZyBwb2ludChzKS5cbiAqXG4gKiBAbmFtZSBsaW5lSW50ZXJzZWN0XG4gKiBAcGFyYW0ge0dlb0pTT059IGxpbmUxIGFueSBMaW5lU3RyaW5nIG9yIFBvbHlnb25cbiAqIEBwYXJhbSB7R2VvSlNPTn0gbGluZTIgYW55IExpbmVTdHJpbmcgb3IgUG9seWdvblxuICogQHJldHVybnMge0ZlYXR1cmVDb2xsZWN0aW9uPFBvaW50Pn0gcG9pbnQocykgdGhhdCBpbnRlcnNlY3QgYm90aFxuICogQGV4YW1wbGVcbiAqIHZhciBsaW5lMSA9IHR1cmYubGluZVN0cmluZyhbWzEyNiwgLTExXSwgWzEyOSwgLTIxXV0pO1xuICogdmFyIGxpbmUyID0gdHVyZi5saW5lU3RyaW5nKFtbMTIzLCAtMThdLCBbMTMxLCAtMTRdXSk7XG4gKiB2YXIgaW50ZXJzZWN0cyA9IHR1cmYubGluZUludGVyc2VjdChsaW5lMSwgbGluZTIpO1xuICpcbiAqIC8vYWRkVG9NYXBcbiAqIHZhciBhZGRUb01hcCA9IFtsaW5lMSwgbGluZTIsIGludGVyc2VjdHNdXG4gKi9cbmZ1bmN0aW9uIGxpbmVJbnRlcnNlY3QobGluZTEsIGxpbmUyKSB7XG4gICAgdmFyIHVuaXF1ZSA9IHt9O1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgLy8gRmlyc3QsIG5vcm1hbGl6ZSBnZW9tZXRyaWVzIHRvIGZlYXR1cmVzXG4gICAgLy8gVGhlbiwgaGFuZGxlIHNpbXBsZSAyLXZlcnRleCBzZWdtZW50c1xuICAgIGlmIChsaW5lMS50eXBlID09PSBcIkxpbmVTdHJpbmdcIikge1xuICAgICAgICBsaW5lMSA9IGhlbHBlcnNfMS5mZWF0dXJlKGxpbmUxKTtcbiAgICB9XG4gICAgaWYgKGxpbmUyLnR5cGUgPT09IFwiTGluZVN0cmluZ1wiKSB7XG4gICAgICAgIGxpbmUyID0gaGVscGVyc18xLmZlYXR1cmUobGluZTIpO1xuICAgIH1cbiAgICBpZiAobGluZTEudHlwZSA9PT0gXCJGZWF0dXJlXCIgJiZcbiAgICAgICAgbGluZTIudHlwZSA9PT0gXCJGZWF0dXJlXCIgJiZcbiAgICAgICAgbGluZTEuZ2VvbWV0cnkgIT09IG51bGwgJiZcbiAgICAgICAgbGluZTIuZ2VvbWV0cnkgIT09IG51bGwgJiZcbiAgICAgICAgbGluZTEuZ2VvbWV0cnkudHlwZSA9PT0gXCJMaW5lU3RyaW5nXCIgJiZcbiAgICAgICAgbGluZTIuZ2VvbWV0cnkudHlwZSA9PT0gXCJMaW5lU3RyaW5nXCIgJiZcbiAgICAgICAgbGluZTEuZ2VvbWV0cnkuY29vcmRpbmF0ZXMubGVuZ3RoID09PSAyICYmXG4gICAgICAgIGxpbmUyLmdlb21ldHJ5LmNvb3JkaW5hdGVzLmxlbmd0aCA9PT0gMikge1xuICAgICAgICB2YXIgaW50ZXJzZWN0ID0gaW50ZXJzZWN0cyhsaW5lMSwgbGluZTIpO1xuICAgICAgICBpZiAoaW50ZXJzZWN0KSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goaW50ZXJzZWN0KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGVscGVyc18xLmZlYXR1cmVDb2xsZWN0aW9uKHJlc3VsdHMpO1xuICAgIH1cbiAgICAvLyBIYW5kbGVzIGNvbXBsZXggR2VvSlNPTiBHZW9tZXRyaWVzXG4gICAgdmFyIHRyZWUgPSBnZW9qc29uX3JidXNoXzEuZGVmYXVsdCgpO1xuICAgIHRyZWUubG9hZChsaW5lX3NlZ21lbnRfMS5kZWZhdWx0KGxpbmUyKSk7XG4gICAgbWV0YV8xLmZlYXR1cmVFYWNoKGxpbmVfc2VnbWVudF8xLmRlZmF1bHQobGluZTEpLCBmdW5jdGlvbiAoc2VnbWVudCkge1xuICAgICAgICBtZXRhXzEuZmVhdHVyZUVhY2godHJlZS5zZWFyY2goc2VnbWVudCksIGZ1bmN0aW9uIChtYXRjaCkge1xuICAgICAgICAgICAgdmFyIGludGVyc2VjdCA9IGludGVyc2VjdHMoc2VnbWVudCwgbWF0Y2gpO1xuICAgICAgICAgICAgaWYgKGludGVyc2VjdCkge1xuICAgICAgICAgICAgICAgIC8vIHByZXZlbnQgZHVwbGljYXRlIHBvaW50cyBodHRwczovL2dpdGh1Yi5jb20vVHVyZmpzL3R1cmYvaXNzdWVzLzY4OFxuICAgICAgICAgICAgICAgIHZhciBrZXkgPSBpbnZhcmlhbnRfMS5nZXRDb29yZHMoaW50ZXJzZWN0KS5qb2luKFwiLFwiKTtcbiAgICAgICAgICAgICAgICBpZiAoIXVuaXF1ZVtrZXldKSB7XG4gICAgICAgICAgICAgICAgICAgIHVuaXF1ZVtrZXldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKGludGVyc2VjdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gaGVscGVyc18xLmZlYXR1cmVDb2xsZWN0aW9uKHJlc3VsdHMpO1xufVxuLyoqXG4gKiBGaW5kIGEgcG9pbnQgdGhhdCBpbnRlcnNlY3RzIExpbmVTdHJpbmdzIHdpdGggdHdvIGNvb3JkaW5hdGVzIGVhY2hcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGZWF0dXJlPExpbmVTdHJpbmc+fSBsaW5lMSBHZW9KU09OIExpbmVTdHJpbmcgKE11c3Qgb25seSBjb250YWluIDIgY29vcmRpbmF0ZXMpXG4gKiBAcGFyYW0ge0ZlYXR1cmU8TGluZVN0cmluZz59IGxpbmUyIEdlb0pTT04gTGluZVN0cmluZyAoTXVzdCBvbmx5IGNvbnRhaW4gMiBjb29yZGluYXRlcylcbiAqIEByZXR1cm5zIHtGZWF0dXJlPFBvaW50Pn0gaW50ZXJzZWN0aW5nIEdlb0pTT04gUG9pbnRcbiAqL1xuZnVuY3Rpb24gaW50ZXJzZWN0cyhsaW5lMSwgbGluZTIpIHtcbiAgICB2YXIgY29vcmRzMSA9IGludmFyaWFudF8xLmdldENvb3JkcyhsaW5lMSk7XG4gICAgdmFyIGNvb3JkczIgPSBpbnZhcmlhbnRfMS5nZXRDb29yZHMobGluZTIpO1xuICAgIGlmIChjb29yZHMxLmxlbmd0aCAhPT0gMikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCI8aW50ZXJzZWN0cz4gbGluZTEgbXVzdCBvbmx5IGNvbnRhaW4gMiBjb29yZGluYXRlc1wiKTtcbiAgICB9XG4gICAgaWYgKGNvb3JkczIubGVuZ3RoICE9PSAyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIjxpbnRlcnNlY3RzPiBsaW5lMiBtdXN0IG9ubHkgY29udGFpbiAyIGNvb3JkaW5hdGVzXCIpO1xuICAgIH1cbiAgICB2YXIgeDEgPSBjb29yZHMxWzBdWzBdO1xuICAgIHZhciB5MSA9IGNvb3JkczFbMF1bMV07XG4gICAgdmFyIHgyID0gY29vcmRzMVsxXVswXTtcbiAgICB2YXIgeTIgPSBjb29yZHMxWzFdWzFdO1xuICAgIHZhciB4MyA9IGNvb3JkczJbMF1bMF07XG4gICAgdmFyIHkzID0gY29vcmRzMlswXVsxXTtcbiAgICB2YXIgeDQgPSBjb29yZHMyWzFdWzBdO1xuICAgIHZhciB5NCA9IGNvb3JkczJbMV1bMV07XG4gICAgdmFyIGRlbm9tID0gKCh5NCAtIHkzKSAqICh4MiAtIHgxKSkgLSAoKHg0IC0geDMpICogKHkyIC0geTEpKTtcbiAgICB2YXIgbnVtZUEgPSAoKHg0IC0geDMpICogKHkxIC0geTMpKSAtICgoeTQgLSB5MykgKiAoeDEgLSB4MykpO1xuICAgIHZhciBudW1lQiA9ICgoeDIgLSB4MSkgKiAoeTEgLSB5MykpIC0gKCh5MiAtIHkxKSAqICh4MSAtIHgzKSk7XG4gICAgaWYgKGRlbm9tID09PSAwKSB7XG4gICAgICAgIGlmIChudW1lQSA9PT0gMCAmJiBudW1lQiA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHZhciB1QSA9IG51bWVBIC8gZGVub207XG4gICAgdmFyIHVCID0gbnVtZUIgLyBkZW5vbTtcbiAgICBpZiAodUEgPj0gMCAmJiB1QSA8PSAxICYmIHVCID49IDAgJiYgdUIgPD0gMSkge1xuICAgICAgICB2YXIgeCA9IHgxICsgKHVBICogKHgyIC0geDEpKTtcbiAgICAgICAgdmFyIHkgPSB5MSArICh1QSAqICh5MiAtIHkxKSk7XG4gICAgICAgIHJldHVybiBoZWxwZXJzXzEucG9pbnQoW3gsIHldKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5leHBvcnRzLmRlZmF1bHQgPSBsaW5lSW50ZXJzZWN0O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG52YXIgaGVscGVyc18xID0gcmVxdWlyZShcIkB0dXJmL2hlbHBlcnNcIik7XG52YXIgaW52YXJpYW50XzEgPSByZXF1aXJlKFwiQHR1cmYvaW52YXJpYW50XCIpO1xudmFyIG1ldGFfMSA9IHJlcXVpcmUoXCJAdHVyZi9tZXRhXCIpO1xuLyoqXG4gKiBDcmVhdGVzIGEge0BsaW5rIEZlYXR1cmVDb2xsZWN0aW9ufSBvZiAyLXZlcnRleCB7QGxpbmsgTGluZVN0cmluZ30gc2VnbWVudHMgZnJvbSBhXG4gKiB7QGxpbmsgTGluZVN0cmluZ3woTXVsdGkpTGluZVN0cmluZ30gb3Ige0BsaW5rIFBvbHlnb258KE11bHRpKVBvbHlnb259LlxuICpcbiAqIEBuYW1lIGxpbmVTZWdtZW50XG4gKiBAcGFyYW0ge0dlb0pTT059IGdlb2pzb24gR2VvSlNPTiBQb2x5Z29uIG9yIExpbmVTdHJpbmdcbiAqIEByZXR1cm5zIHtGZWF0dXJlQ29sbGVjdGlvbjxMaW5lU3RyaW5nPn0gMi12ZXJ0ZXggbGluZSBzZWdtZW50c1xuICogQGV4YW1wbGVcbiAqIHZhciBwb2x5Z29uID0gdHVyZi5wb2x5Z29uKFtbWy01MCwgNV0sIFstNDAsIC0xMF0sIFstNTAsIC0xMF0sIFstNDAsIDVdLCBbLTUwLCA1XV1dKTtcbiAqIHZhciBzZWdtZW50cyA9IHR1cmYubGluZVNlZ21lbnQocG9seWdvbik7XG4gKlxuICogLy9hZGRUb01hcFxuICogdmFyIGFkZFRvTWFwID0gW3BvbHlnb24sIHNlZ21lbnRzXVxuICovXG5mdW5jdGlvbiBsaW5lU2VnbWVudChnZW9qc29uKSB7XG4gICAgaWYgKCFnZW9qc29uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImdlb2pzb24gaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgbWV0YV8xLmZsYXR0ZW5FYWNoKGdlb2pzb24sIGZ1bmN0aW9uIChmZWF0dXJlKSB7XG4gICAgICAgIGxpbmVTZWdtZW50RmVhdHVyZShmZWF0dXJlLCByZXN1bHRzKTtcbiAgICB9KTtcbiAgICByZXR1cm4gaGVscGVyc18xLmZlYXR1cmVDb2xsZWN0aW9uKHJlc3VsdHMpO1xufVxuLyoqXG4gKiBMaW5lIFNlZ21lbnRcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGZWF0dXJlPExpbmVTdHJpbmd8UG9seWdvbj59IGdlb2pzb24gTGluZSBvciBwb2x5Z29uIGZlYXR1cmVcbiAqIEBwYXJhbSB7QXJyYXl9IHJlc3VsdHMgcHVzaCB0byByZXN1bHRzXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqL1xuZnVuY3Rpb24gbGluZVNlZ21lbnRGZWF0dXJlKGdlb2pzb24sIHJlc3VsdHMpIHtcbiAgICB2YXIgY29vcmRzID0gW107XG4gICAgdmFyIGdlb21ldHJ5ID0gZ2VvanNvbi5nZW9tZXRyeTtcbiAgICBpZiAoZ2VvbWV0cnkgIT09IG51bGwpIHtcbiAgICAgICAgc3dpdGNoIChnZW9tZXRyeS50eXBlKSB7XG4gICAgICAgICAgICBjYXNlIFwiUG9seWdvblwiOlxuICAgICAgICAgICAgICAgIGNvb3JkcyA9IGludmFyaWFudF8xLmdldENvb3JkcyhnZW9tZXRyeSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiTGluZVN0cmluZ1wiOlxuICAgICAgICAgICAgICAgIGNvb3JkcyA9IFtpbnZhcmlhbnRfMS5nZXRDb29yZHMoZ2VvbWV0cnkpXTtcbiAgICAgICAgfVxuICAgICAgICBjb29yZHMuZm9yRWFjaChmdW5jdGlvbiAoY29vcmQpIHtcbiAgICAgICAgICAgIHZhciBzZWdtZW50cyA9IGNyZWF0ZVNlZ21lbnRzKGNvb3JkLCBnZW9qc29uLnByb3BlcnRpZXMpO1xuICAgICAgICAgICAgc2VnbWVudHMuZm9yRWFjaChmdW5jdGlvbiAoc2VnbWVudCkge1xuICAgICAgICAgICAgICAgIHNlZ21lbnQuaWQgPSByZXN1bHRzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goc2VnbWVudCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLyoqXG4gKiBDcmVhdGUgU2VnbWVudHMgZnJvbSBMaW5lU3RyaW5nIGNvb3JkaW5hdGVzXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXk8QXJyYXk8bnVtYmVyPj59IGNvb3JkcyBMaW5lU3RyaW5nIGNvb3JkaW5hdGVzXG4gKiBAcGFyYW0geyp9IHByb3BlcnRpZXMgR2VvSlNPTiBwcm9wZXJ0aWVzXG4gKiBAcmV0dXJucyB7QXJyYXk8RmVhdHVyZTxMaW5lU3RyaW5nPj59IGxpbmUgc2VnbWVudHNcbiAqL1xuZnVuY3Rpb24gY3JlYXRlU2VnbWVudHMoY29vcmRzLCBwcm9wZXJ0aWVzKSB7XG4gICAgdmFyIHNlZ21lbnRzID0gW107XG4gICAgY29vcmRzLnJlZHVjZShmdW5jdGlvbiAocHJldmlvdXNDb29yZHMsIGN1cnJlbnRDb29yZHMpIHtcbiAgICAgICAgdmFyIHNlZ21lbnQgPSBoZWxwZXJzXzEubGluZVN0cmluZyhbcHJldmlvdXNDb29yZHMsIGN1cnJlbnRDb29yZHNdLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgc2VnbWVudC5iYm94ID0gYmJveChwcmV2aW91c0Nvb3JkcywgY3VycmVudENvb3Jkcyk7XG4gICAgICAgIHNlZ21lbnRzLnB1c2goc2VnbWVudCk7XG4gICAgICAgIHJldHVybiBjdXJyZW50Q29vcmRzO1xuICAgIH0pO1xuICAgIHJldHVybiBzZWdtZW50cztcbn1cbi8qKlxuICogQ3JlYXRlIEJCb3ggYmV0d2VlbiB0d28gY29vcmRpbmF0ZXMgKGZhc3RlciB0aGFuIEB0dXJmL2Jib3gpXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXk8bnVtYmVyPn0gY29vcmRzMSBQb2ludCBjb29yZGluYXRlXG4gKiBAcGFyYW0ge0FycmF5PG51bWJlcj59IGNvb3JkczIgUG9pbnQgY29vcmRpbmF0ZVxuICogQHJldHVybnMge0JCb3h9IFt3ZXN0LCBzb3V0aCwgZWFzdCwgbm9ydGhdXG4gKi9cbmZ1bmN0aW9uIGJib3goY29vcmRzMSwgY29vcmRzMikge1xuICAgIHZhciB4MSA9IGNvb3JkczFbMF07XG4gICAgdmFyIHkxID0gY29vcmRzMVsxXTtcbiAgICB2YXIgeDIgPSBjb29yZHMyWzBdO1xuICAgIHZhciB5MiA9IGNvb3JkczJbMV07XG4gICAgdmFyIHdlc3QgPSAoeDEgPCB4MikgPyB4MSA6IHgyO1xuICAgIHZhciBzb3V0aCA9ICh5MSA8IHkyKSA/IHkxIDogeTI7XG4gICAgdmFyIGVhc3QgPSAoeDEgPiB4MikgPyB4MSA6IHgyO1xuICAgIHZhciBub3J0aCA9ICh5MSA+IHkyKSA/IHkxIDogeTI7XG4gICAgcmV0dXJuIFt3ZXN0LCBzb3V0aCwgZWFzdCwgbm9ydGhdO1xufVxuZXhwb3J0cy5kZWZhdWx0ID0gbGluZVNlZ21lbnQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG5cbnZhciBoZWxwZXJzID0gcmVxdWlyZSgnQHR1cmYvaGVscGVycycpO1xuXG4vKipcbiAqIENhbGxiYWNrIGZvciBjb29yZEVhY2hcbiAqXG4gKiBAY2FsbGJhY2sgY29vcmRFYWNoQ2FsbGJhY2tcbiAqIEBwYXJhbSB7QXJyYXk8bnVtYmVyPn0gY3VycmVudENvb3JkIFRoZSBjdXJyZW50IGNvb3JkaW5hdGUgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ9IGNvb3JkSW5kZXggVGhlIGN1cnJlbnQgaW5kZXggb2YgdGhlIGNvb3JkaW5hdGUgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ9IGZlYXR1cmVJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgRmVhdHVyZSBiZWluZyBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gbXVsdGlGZWF0dXJlSW5kZXggVGhlIGN1cnJlbnQgaW5kZXggb2YgdGhlIE11bHRpLUZlYXR1cmUgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ9IGdlb21ldHJ5SW5kZXggVGhlIGN1cnJlbnQgaW5kZXggb2YgdGhlIEdlb21ldHJ5IGJlaW5nIHByb2Nlc3NlZC5cbiAqL1xuXG4vKipcbiAqIEl0ZXJhdGUgb3ZlciBjb29yZGluYXRlcyBpbiBhbnkgR2VvSlNPTiBvYmplY3QsIHNpbWlsYXIgdG8gQXJyYXkuZm9yRWFjaCgpXG4gKlxuICogQG5hbWUgY29vcmRFYWNoXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufEZlYXR1cmV8R2VvbWV0cnl9IGdlb2pzb24gYW55IEdlb0pTT04gb2JqZWN0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBhIG1ldGhvZCB0aGF0IHRha2VzIChjdXJyZW50Q29vcmQsIGNvb3JkSW5kZXgsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgpXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtleGNsdWRlV3JhcENvb3JkPWZhbHNlXSB3aGV0aGVyIG9yIG5vdCB0byBpbmNsdWRlIHRoZSBmaW5hbCBjb29yZGluYXRlIG9mIExpbmVhclJpbmdzIHRoYXQgd3JhcHMgdGhlIHJpbmcgaW4gaXRzIGl0ZXJhdGlvbi5cbiAqIEByZXR1cm5zIHt2b2lkfVxuICogQGV4YW1wbGVcbiAqIHZhciBmZWF0dXJlcyA9IHR1cmYuZmVhdHVyZUNvbGxlY3Rpb24oW1xuICogICB0dXJmLnBvaW50KFsyNiwgMzddLCB7XCJmb29cIjogXCJiYXJcIn0pLFxuICogICB0dXJmLnBvaW50KFszNiwgNTNdLCB7XCJoZWxsb1wiOiBcIndvcmxkXCJ9KVxuICogXSk7XG4gKlxuICogdHVyZi5jb29yZEVhY2goZmVhdHVyZXMsIGZ1bmN0aW9uIChjdXJyZW50Q29vcmQsIGNvb3JkSW5kZXgsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIGdlb21ldHJ5SW5kZXgpIHtcbiAqICAgLy89Y3VycmVudENvb3JkXG4gKiAgIC8vPWNvb3JkSW5kZXhcbiAqICAgLy89ZmVhdHVyZUluZGV4XG4gKiAgIC8vPW11bHRpRmVhdHVyZUluZGV4XG4gKiAgIC8vPWdlb21ldHJ5SW5kZXhcbiAqIH0pO1xuICovXG5mdW5jdGlvbiBjb29yZEVhY2goZ2VvanNvbiwgY2FsbGJhY2ssIGV4Y2x1ZGVXcmFwQ29vcmQpIHtcbiAgICAvLyBIYW5kbGVzIG51bGwgR2VvbWV0cnkgLS0gU2tpcHMgdGhpcyBHZW9KU09OXG4gICAgaWYgKGdlb2pzb24gPT09IG51bGwpIHJldHVybjtcbiAgICB2YXIgaiwgaywgbCwgZ2VvbWV0cnksIHN0b3BHLCBjb29yZHMsXG4gICAgICAgIGdlb21ldHJ5TWF5YmVDb2xsZWN0aW9uLFxuICAgICAgICB3cmFwU2hyaW5rID0gMCxcbiAgICAgICAgY29vcmRJbmRleCA9IDAsXG4gICAgICAgIGlzR2VvbWV0cnlDb2xsZWN0aW9uLFxuICAgICAgICB0eXBlID0gZ2VvanNvbi50eXBlLFxuICAgICAgICBpc0ZlYXR1cmVDb2xsZWN0aW9uID0gdHlwZSA9PT0gJ0ZlYXR1cmVDb2xsZWN0aW9uJyxcbiAgICAgICAgaXNGZWF0dXJlID0gdHlwZSA9PT0gJ0ZlYXR1cmUnLFxuICAgICAgICBzdG9wID0gaXNGZWF0dXJlQ29sbGVjdGlvbiA/IGdlb2pzb24uZmVhdHVyZXMubGVuZ3RoIDogMTtcblxuICAgIC8vIFRoaXMgbG9naWMgbWF5IGxvb2sgYSBsaXR0bGUgd2VpcmQuIFRoZSByZWFzb24gd2h5IGl0IGlzIHRoYXQgd2F5XG4gICAgLy8gaXMgYmVjYXVzZSBpdCdzIHRyeWluZyB0byBiZSBmYXN0LiBHZW9KU09OIHN1cHBvcnRzIG11bHRpcGxlIGtpbmRzXG4gICAgLy8gb2Ygb2JqZWN0cyBhdCBpdHMgcm9vdDogRmVhdHVyZUNvbGxlY3Rpb24sIEZlYXR1cmVzLCBHZW9tZXRyaWVzLlxuICAgIC8vIFRoaXMgZnVuY3Rpb24gaGFzIHRoZSByZXNwb25zaWJpbGl0eSBvZiBoYW5kbGluZyBhbGwgb2YgdGhlbSwgYW5kIHRoYXRcbiAgICAvLyBtZWFucyB0aGF0IHNvbWUgb2YgdGhlIGBmb3JgIGxvb3BzIHlvdSBzZWUgYmVsb3cgYWN0dWFsbHkganVzdCBkb24ndCBhcHBseVxuICAgIC8vIHRvIGNlcnRhaW4gaW5wdXRzLiBGb3IgaW5zdGFuY2UsIGlmIHlvdSBnaXZlIHRoaXMganVzdCBhXG4gICAgLy8gUG9pbnQgZ2VvbWV0cnksIHRoZW4gYm90aCBsb29wcyBhcmUgc2hvcnQtY2lyY3VpdGVkIGFuZCBhbGwgd2UgZG9cbiAgICAvLyBpcyBncmFkdWFsbHkgcmVuYW1lIHRoZSBpbnB1dCB1bnRpbCBpdCdzIGNhbGxlZCAnZ2VvbWV0cnknLlxuICAgIC8vXG4gICAgLy8gVGhpcyBhbHNvIGFpbXMgdG8gYWxsb2NhdGUgYXMgZmV3IHJlc291cmNlcyBhcyBwb3NzaWJsZToganVzdCBhXG4gICAgLy8gZmV3IG51bWJlcnMgYW5kIGJvb2xlYW5zLCByYXRoZXIgdGhhbiBhbnkgdGVtcG9yYXJ5IGFycmF5cyBhcyB3b3VsZFxuICAgIC8vIGJlIHJlcXVpcmVkIHdpdGggdGhlIG5vcm1hbGl6YXRpb24gYXBwcm9hY2guXG4gICAgZm9yICh2YXIgZmVhdHVyZUluZGV4ID0gMDsgZmVhdHVyZUluZGV4IDwgc3RvcDsgZmVhdHVyZUluZGV4KyspIHtcbiAgICAgICAgZ2VvbWV0cnlNYXliZUNvbGxlY3Rpb24gPSAoaXNGZWF0dXJlQ29sbGVjdGlvbiA/IGdlb2pzb24uZmVhdHVyZXNbZmVhdHVyZUluZGV4XS5nZW9tZXRyeSA6XG4gICAgICAgICAgICAoaXNGZWF0dXJlID8gZ2VvanNvbi5nZW9tZXRyeSA6IGdlb2pzb24pKTtcbiAgICAgICAgaXNHZW9tZXRyeUNvbGxlY3Rpb24gPSAoZ2VvbWV0cnlNYXliZUNvbGxlY3Rpb24pID8gZ2VvbWV0cnlNYXliZUNvbGxlY3Rpb24udHlwZSA9PT0gJ0dlb21ldHJ5Q29sbGVjdGlvbicgOiBmYWxzZTtcbiAgICAgICAgc3RvcEcgPSBpc0dlb21ldHJ5Q29sbGVjdGlvbiA/IGdlb21ldHJ5TWF5YmVDb2xsZWN0aW9uLmdlb21ldHJpZXMubGVuZ3RoIDogMTtcblxuICAgICAgICBmb3IgKHZhciBnZW9tSW5kZXggPSAwOyBnZW9tSW5kZXggPCBzdG9wRzsgZ2VvbUluZGV4KyspIHtcbiAgICAgICAgICAgIHZhciBtdWx0aUZlYXR1cmVJbmRleCA9IDA7XG4gICAgICAgICAgICB2YXIgZ2VvbWV0cnlJbmRleCA9IDA7XG4gICAgICAgICAgICBnZW9tZXRyeSA9IGlzR2VvbWV0cnlDb2xsZWN0aW9uID9cbiAgICAgICAgICAgICAgICBnZW9tZXRyeU1heWJlQ29sbGVjdGlvbi5nZW9tZXRyaWVzW2dlb21JbmRleF0gOiBnZW9tZXRyeU1heWJlQ29sbGVjdGlvbjtcblxuICAgICAgICAgICAgLy8gSGFuZGxlcyBudWxsIEdlb21ldHJ5IC0tIFNraXBzIHRoaXMgZ2VvbWV0cnlcbiAgICAgICAgICAgIGlmIChnZW9tZXRyeSA9PT0gbnVsbCkgY29udGludWU7XG4gICAgICAgICAgICBjb29yZHMgPSBnZW9tZXRyeS5jb29yZGluYXRlcztcbiAgICAgICAgICAgIHZhciBnZW9tVHlwZSA9IGdlb21ldHJ5LnR5cGU7XG5cbiAgICAgICAgICAgIHdyYXBTaHJpbmsgPSAoZXhjbHVkZVdyYXBDb29yZCAmJiAoZ2VvbVR5cGUgPT09ICdQb2x5Z29uJyB8fCBnZW9tVHlwZSA9PT0gJ011bHRpUG9seWdvbicpKSA/IDEgOiAwO1xuXG4gICAgICAgICAgICBzd2l0Y2ggKGdlb21UeXBlKSB7XG4gICAgICAgICAgICBjYXNlIG51bGw6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdQb2ludCc6XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKGNvb3JkcywgY29vcmRJbmRleCwgZmVhdHVyZUluZGV4LCBtdWx0aUZlYXR1cmVJbmRleCwgZ2VvbWV0cnlJbmRleCkgPT09IGZhbHNlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgY29vcmRJbmRleCsrO1xuICAgICAgICAgICAgICAgIG11bHRpRmVhdHVyZUluZGV4Kys7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdMaW5lU3RyaW5nJzpcbiAgICAgICAgICAgIGNhc2UgJ011bHRpUG9pbnQnOlxuICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBjb29yZHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKGNvb3Jkc1tqXSwgY29vcmRJbmRleCwgZmVhdHVyZUluZGV4LCBtdWx0aUZlYXR1cmVJbmRleCwgZ2VvbWV0cnlJbmRleCkgPT09IGZhbHNlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGNvb3JkSW5kZXgrKztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdlb21UeXBlID09PSAnTXVsdGlQb2ludCcpIG11bHRpRmVhdHVyZUluZGV4Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChnZW9tVHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSBtdWx0aUZlYXR1cmVJbmRleCsrO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnUG9seWdvbic6XG4gICAgICAgICAgICBjYXNlICdNdWx0aUxpbmVTdHJpbmcnOlxuICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBjb29yZHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChrID0gMDsgayA8IGNvb3Jkc1tqXS5sZW5ndGggLSB3cmFwU2hyaW5rOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjayhjb29yZHNbal1ba10sIGNvb3JkSW5kZXgsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIGdlb21ldHJ5SW5kZXgpID09PSBmYWxzZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29vcmRJbmRleCsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChnZW9tVHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycpIG11bHRpRmVhdHVyZUluZGV4Kys7XG4gICAgICAgICAgICAgICAgICAgIGlmIChnZW9tVHlwZSA9PT0gJ1BvbHlnb24nKSBnZW9tZXRyeUluZGV4Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChnZW9tVHlwZSA9PT0gJ1BvbHlnb24nKSBtdWx0aUZlYXR1cmVJbmRleCsrO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnTXVsdGlQb2x5Z29uJzpcbiAgICAgICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgY29vcmRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGdlb21ldHJ5SW5kZXggPSAwO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGsgPSAwOyBrIDwgY29vcmRzW2pdLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGwgPSAwOyBsIDwgY29vcmRzW2pdW2tdLmxlbmd0aCAtIHdyYXBTaHJpbms7IGwrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjayhjb29yZHNbal1ba11bbF0sIGNvb3JkSW5kZXgsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIGdlb21ldHJ5SW5kZXgpID09PSBmYWxzZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvb3JkSW5kZXgrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGdlb21ldHJ5SW5kZXgrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBtdWx0aUZlYXR1cmVJbmRleCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ0dlb21ldHJ5Q29sbGVjdGlvbic6XG4gICAgICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IGdlb21ldHJ5Lmdlb21ldHJpZXMubGVuZ3RoOyBqKyspXG4gICAgICAgICAgICAgICAgICAgIGlmIChjb29yZEVhY2goZ2VvbWV0cnkuZ2VvbWV0cmllc1tqXSwgY2FsbGJhY2ssIGV4Y2x1ZGVXcmFwQ29vcmQpID09PSBmYWxzZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gR2VvbWV0cnkgVHlwZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIENhbGxiYWNrIGZvciBjb29yZFJlZHVjZVxuICpcbiAqIFRoZSBmaXJzdCB0aW1lIHRoZSBjYWxsYmFjayBmdW5jdGlvbiBpcyBjYWxsZWQsIHRoZSB2YWx1ZXMgcHJvdmlkZWQgYXMgYXJndW1lbnRzIGRlcGVuZFxuICogb24gd2hldGhlciB0aGUgcmVkdWNlIG1ldGhvZCBoYXMgYW4gaW5pdGlhbFZhbHVlIGFyZ3VtZW50LlxuICpcbiAqIElmIGFuIGluaXRpYWxWYWx1ZSBpcyBwcm92aWRlZCB0byB0aGUgcmVkdWNlIG1ldGhvZDpcbiAqICAtIFRoZSBwcmV2aW91c1ZhbHVlIGFyZ3VtZW50IGlzIGluaXRpYWxWYWx1ZS5cbiAqICAtIFRoZSBjdXJyZW50VmFsdWUgYXJndW1lbnQgaXMgdGhlIHZhbHVlIG9mIHRoZSBmaXJzdCBlbGVtZW50IHByZXNlbnQgaW4gdGhlIGFycmF5LlxuICpcbiAqIElmIGFuIGluaXRpYWxWYWx1ZSBpcyBub3QgcHJvdmlkZWQ6XG4gKiAgLSBUaGUgcHJldmlvdXNWYWx1ZSBhcmd1bWVudCBpcyB0aGUgdmFsdWUgb2YgdGhlIGZpcnN0IGVsZW1lbnQgcHJlc2VudCBpbiB0aGUgYXJyYXkuXG4gKiAgLSBUaGUgY3VycmVudFZhbHVlIGFyZ3VtZW50IGlzIHRoZSB2YWx1ZSBvZiB0aGUgc2Vjb25kIGVsZW1lbnQgcHJlc2VudCBpbiB0aGUgYXJyYXkuXG4gKlxuICogQGNhbGxiYWNrIGNvb3JkUmVkdWNlQ2FsbGJhY2tcbiAqIEBwYXJhbSB7Kn0gcHJldmlvdXNWYWx1ZSBUaGUgYWNjdW11bGF0ZWQgdmFsdWUgcHJldmlvdXNseSByZXR1cm5lZCBpbiB0aGUgbGFzdCBpbnZvY2F0aW9uXG4gKiBvZiB0aGUgY2FsbGJhY2ssIG9yIGluaXRpYWxWYWx1ZSwgaWYgc3VwcGxpZWQuXG4gKiBAcGFyYW0ge0FycmF5PG51bWJlcj59IGN1cnJlbnRDb29yZCBUaGUgY3VycmVudCBjb29yZGluYXRlIGJlaW5nIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBjb29yZEluZGV4IFRoZSBjdXJyZW50IGluZGV4IG9mIHRoZSBjb29yZGluYXRlIGJlaW5nIHByb2Nlc3NlZC5cbiAqIFN0YXJ0cyBhdCBpbmRleCAwLCBpZiBhbiBpbml0aWFsVmFsdWUgaXMgcHJvdmlkZWQsIGFuZCBhdCBpbmRleCAxIG90aGVyd2lzZS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBmZWF0dXJlSW5kZXggVGhlIGN1cnJlbnQgaW5kZXggb2YgdGhlIEZlYXR1cmUgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ9IG11bHRpRmVhdHVyZUluZGV4IFRoZSBjdXJyZW50IGluZGV4IG9mIHRoZSBNdWx0aS1GZWF0dXJlIGJlaW5nIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBnZW9tZXRyeUluZGV4IFRoZSBjdXJyZW50IGluZGV4IG9mIHRoZSBHZW9tZXRyeSBiZWluZyBwcm9jZXNzZWQuXG4gKi9cblxuLyoqXG4gKiBSZWR1Y2UgY29vcmRpbmF0ZXMgaW4gYW55IEdlb0pTT04gb2JqZWN0LCBzaW1pbGFyIHRvIEFycmF5LnJlZHVjZSgpXG4gKlxuICogQG5hbWUgY29vcmRSZWR1Y2VcbiAqIEBwYXJhbSB7RmVhdHVyZUNvbGxlY3Rpb258R2VvbWV0cnl8RmVhdHVyZX0gZ2VvanNvbiBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGEgbWV0aG9kIHRoYXQgdGFrZXMgKHByZXZpb3VzVmFsdWUsIGN1cnJlbnRDb29yZCwgY29vcmRJbmRleClcbiAqIEBwYXJhbSB7Kn0gW2luaXRpYWxWYWx1ZV0gVmFsdWUgdG8gdXNlIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgZmlyc3QgY2FsbCBvZiB0aGUgY2FsbGJhY2suXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtleGNsdWRlV3JhcENvb3JkPWZhbHNlXSB3aGV0aGVyIG9yIG5vdCB0byBpbmNsdWRlIHRoZSBmaW5hbCBjb29yZGluYXRlIG9mIExpbmVhclJpbmdzIHRoYXQgd3JhcHMgdGhlIHJpbmcgaW4gaXRzIGl0ZXJhdGlvbi5cbiAqIEByZXR1cm5zIHsqfSBUaGUgdmFsdWUgdGhhdCByZXN1bHRzIGZyb20gdGhlIHJlZHVjdGlvbi5cbiAqIEBleGFtcGxlXG4gKiB2YXIgZmVhdHVyZXMgPSB0dXJmLmZlYXR1cmVDb2xsZWN0aW9uKFtcbiAqICAgdHVyZi5wb2ludChbMjYsIDM3XSwge1wiZm9vXCI6IFwiYmFyXCJ9KSxcbiAqICAgdHVyZi5wb2ludChbMzYsIDUzXSwge1wiaGVsbG9cIjogXCJ3b3JsZFwifSlcbiAqIF0pO1xuICpcbiAqIHR1cmYuY29vcmRSZWR1Y2UoZmVhdHVyZXMsIGZ1bmN0aW9uIChwcmV2aW91c1ZhbHVlLCBjdXJyZW50Q29vcmQsIGNvb3JkSW5kZXgsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIGdlb21ldHJ5SW5kZXgpIHtcbiAqICAgLy89cHJldmlvdXNWYWx1ZVxuICogICAvLz1jdXJyZW50Q29vcmRcbiAqICAgLy89Y29vcmRJbmRleFxuICogICAvLz1mZWF0dXJlSW5kZXhcbiAqICAgLy89bXVsdGlGZWF0dXJlSW5kZXhcbiAqICAgLy89Z2VvbWV0cnlJbmRleFxuICogICByZXR1cm4gY3VycmVudENvb3JkO1xuICogfSk7XG4gKi9cbmZ1bmN0aW9uIGNvb3JkUmVkdWNlKGdlb2pzb24sIGNhbGxiYWNrLCBpbml0aWFsVmFsdWUsIGV4Y2x1ZGVXcmFwQ29vcmQpIHtcbiAgICB2YXIgcHJldmlvdXNWYWx1ZSA9IGluaXRpYWxWYWx1ZTtcbiAgICBjb29yZEVhY2goZ2VvanNvbiwgZnVuY3Rpb24gKGN1cnJlbnRDb29yZCwgY29vcmRJbmRleCwgZmVhdHVyZUluZGV4LCBtdWx0aUZlYXR1cmVJbmRleCwgZ2VvbWV0cnlJbmRleCkge1xuICAgICAgICBpZiAoY29vcmRJbmRleCA9PT0gMCAmJiBpbml0aWFsVmFsdWUgPT09IHVuZGVmaW5lZCkgcHJldmlvdXNWYWx1ZSA9IGN1cnJlbnRDb29yZDtcbiAgICAgICAgZWxzZSBwcmV2aW91c1ZhbHVlID0gY2FsbGJhY2socHJldmlvdXNWYWx1ZSwgY3VycmVudENvb3JkLCBjb29yZEluZGV4LCBmZWF0dXJlSW5kZXgsIG11bHRpRmVhdHVyZUluZGV4LCBnZW9tZXRyeUluZGV4KTtcbiAgICB9LCBleGNsdWRlV3JhcENvb3JkKTtcbiAgICByZXR1cm4gcHJldmlvdXNWYWx1ZTtcbn1cblxuLyoqXG4gKiBDYWxsYmFjayBmb3IgcHJvcEVhY2hcbiAqXG4gKiBAY2FsbGJhY2sgcHJvcEVhY2hDYWxsYmFja1xuICogQHBhcmFtIHtPYmplY3R9IGN1cnJlbnRQcm9wZXJ0aWVzIFRoZSBjdXJyZW50IFByb3BlcnRpZXMgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ9IGZlYXR1cmVJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgRmVhdHVyZSBiZWluZyBwcm9jZXNzZWQuXG4gKi9cblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgcHJvcGVydGllcyBpbiBhbnkgR2VvSlNPTiBvYmplY3QsIHNpbWlsYXIgdG8gQXJyYXkuZm9yRWFjaCgpXG4gKlxuICogQG5hbWUgcHJvcEVhY2hcbiAqIEBwYXJhbSB7RmVhdHVyZUNvbGxlY3Rpb258RmVhdHVyZX0gZ2VvanNvbiBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGEgbWV0aG9kIHRoYXQgdGFrZXMgKGN1cnJlbnRQcm9wZXJ0aWVzLCBmZWF0dXJlSW5kZXgpXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqIEBleGFtcGxlXG4gKiB2YXIgZmVhdHVyZXMgPSB0dXJmLmZlYXR1cmVDb2xsZWN0aW9uKFtcbiAqICAgICB0dXJmLnBvaW50KFsyNiwgMzddLCB7Zm9vOiAnYmFyJ30pLFxuICogICAgIHR1cmYucG9pbnQoWzM2LCA1M10sIHtoZWxsbzogJ3dvcmxkJ30pXG4gKiBdKTtcbiAqXG4gKiB0dXJmLnByb3BFYWNoKGZlYXR1cmVzLCBmdW5jdGlvbiAoY3VycmVudFByb3BlcnRpZXMsIGZlYXR1cmVJbmRleCkge1xuICogICAvLz1jdXJyZW50UHJvcGVydGllc1xuICogICAvLz1mZWF0dXJlSW5kZXhcbiAqIH0pO1xuICovXG5mdW5jdGlvbiBwcm9wRWFjaChnZW9qc29uLCBjYWxsYmFjaykge1xuICAgIHZhciBpO1xuICAgIHN3aXRjaCAoZ2VvanNvbi50eXBlKSB7XG4gICAgY2FzZSAnRmVhdHVyZUNvbGxlY3Rpb24nOlxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZ2VvanNvbi5mZWF0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKGdlb2pzb24uZmVhdHVyZXNbaV0ucHJvcGVydGllcywgaSkgPT09IGZhbHNlKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICBjYXNlICdGZWF0dXJlJzpcbiAgICAgICAgY2FsbGJhY2soZ2VvanNvbi5wcm9wZXJ0aWVzLCAwKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxufVxuXG5cbi8qKlxuICogQ2FsbGJhY2sgZm9yIHByb3BSZWR1Y2VcbiAqXG4gKiBUaGUgZmlyc3QgdGltZSB0aGUgY2FsbGJhY2sgZnVuY3Rpb24gaXMgY2FsbGVkLCB0aGUgdmFsdWVzIHByb3ZpZGVkIGFzIGFyZ3VtZW50cyBkZXBlbmRcbiAqIG9uIHdoZXRoZXIgdGhlIHJlZHVjZSBtZXRob2QgaGFzIGFuIGluaXRpYWxWYWx1ZSBhcmd1bWVudC5cbiAqXG4gKiBJZiBhbiBpbml0aWFsVmFsdWUgaXMgcHJvdmlkZWQgdG8gdGhlIHJlZHVjZSBtZXRob2Q6XG4gKiAgLSBUaGUgcHJldmlvdXNWYWx1ZSBhcmd1bWVudCBpcyBpbml0aWFsVmFsdWUuXG4gKiAgLSBUaGUgY3VycmVudFZhbHVlIGFyZ3VtZW50IGlzIHRoZSB2YWx1ZSBvZiB0aGUgZmlyc3QgZWxlbWVudCBwcmVzZW50IGluIHRoZSBhcnJheS5cbiAqXG4gKiBJZiBhbiBpbml0aWFsVmFsdWUgaXMgbm90IHByb3ZpZGVkOlxuICogIC0gVGhlIHByZXZpb3VzVmFsdWUgYXJndW1lbnQgaXMgdGhlIHZhbHVlIG9mIHRoZSBmaXJzdCBlbGVtZW50IHByZXNlbnQgaW4gdGhlIGFycmF5LlxuICogIC0gVGhlIGN1cnJlbnRWYWx1ZSBhcmd1bWVudCBpcyB0aGUgdmFsdWUgb2YgdGhlIHNlY29uZCBlbGVtZW50IHByZXNlbnQgaW4gdGhlIGFycmF5LlxuICpcbiAqIEBjYWxsYmFjayBwcm9wUmVkdWNlQ2FsbGJhY2tcbiAqIEBwYXJhbSB7Kn0gcHJldmlvdXNWYWx1ZSBUaGUgYWNjdW11bGF0ZWQgdmFsdWUgcHJldmlvdXNseSByZXR1cm5lZCBpbiB0aGUgbGFzdCBpbnZvY2F0aW9uXG4gKiBvZiB0aGUgY2FsbGJhY2ssIG9yIGluaXRpYWxWYWx1ZSwgaWYgc3VwcGxpZWQuXG4gKiBAcGFyYW0geyp9IGN1cnJlbnRQcm9wZXJ0aWVzIFRoZSBjdXJyZW50IFByb3BlcnRpZXMgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ9IGZlYXR1cmVJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgRmVhdHVyZSBiZWluZyBwcm9jZXNzZWQuXG4gKi9cblxuLyoqXG4gKiBSZWR1Y2UgcHJvcGVydGllcyBpbiBhbnkgR2VvSlNPTiBvYmplY3QgaW50byBhIHNpbmdsZSB2YWx1ZSxcbiAqIHNpbWlsYXIgdG8gaG93IEFycmF5LnJlZHVjZSB3b3Jrcy4gSG93ZXZlciwgaW4gdGhpcyBjYXNlIHdlIGxhemlseSBydW5cbiAqIHRoZSByZWR1Y3Rpb24sIHNvIGFuIGFycmF5IG9mIGFsbCBwcm9wZXJ0aWVzIGlzIHVubmVjZXNzYXJ5LlxuICpcbiAqIEBuYW1lIHByb3BSZWR1Y2VcbiAqIEBwYXJhbSB7RmVhdHVyZUNvbGxlY3Rpb258RmVhdHVyZX0gZ2VvanNvbiBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGEgbWV0aG9kIHRoYXQgdGFrZXMgKHByZXZpb3VzVmFsdWUsIGN1cnJlbnRQcm9wZXJ0aWVzLCBmZWF0dXJlSW5kZXgpXG4gKiBAcGFyYW0geyp9IFtpbml0aWFsVmFsdWVdIFZhbHVlIHRvIHVzZSBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlIGZpcnN0IGNhbGwgb2YgdGhlIGNhbGxiYWNrLlxuICogQHJldHVybnMgeyp9IFRoZSB2YWx1ZSB0aGF0IHJlc3VsdHMgZnJvbSB0aGUgcmVkdWN0aW9uLlxuICogQGV4YW1wbGVcbiAqIHZhciBmZWF0dXJlcyA9IHR1cmYuZmVhdHVyZUNvbGxlY3Rpb24oW1xuICogICAgIHR1cmYucG9pbnQoWzI2LCAzN10sIHtmb286ICdiYXInfSksXG4gKiAgICAgdHVyZi5wb2ludChbMzYsIDUzXSwge2hlbGxvOiAnd29ybGQnfSlcbiAqIF0pO1xuICpcbiAqIHR1cmYucHJvcFJlZHVjZShmZWF0dXJlcywgZnVuY3Rpb24gKHByZXZpb3VzVmFsdWUsIGN1cnJlbnRQcm9wZXJ0aWVzLCBmZWF0dXJlSW5kZXgpIHtcbiAqICAgLy89cHJldmlvdXNWYWx1ZVxuICogICAvLz1jdXJyZW50UHJvcGVydGllc1xuICogICAvLz1mZWF0dXJlSW5kZXhcbiAqICAgcmV0dXJuIGN1cnJlbnRQcm9wZXJ0aWVzXG4gKiB9KTtcbiAqL1xuZnVuY3Rpb24gcHJvcFJlZHVjZShnZW9qc29uLCBjYWxsYmFjaywgaW5pdGlhbFZhbHVlKSB7XG4gICAgdmFyIHByZXZpb3VzVmFsdWUgPSBpbml0aWFsVmFsdWU7XG4gICAgcHJvcEVhY2goZ2VvanNvbiwgZnVuY3Rpb24gKGN1cnJlbnRQcm9wZXJ0aWVzLCBmZWF0dXJlSW5kZXgpIHtcbiAgICAgICAgaWYgKGZlYXR1cmVJbmRleCA9PT0gMCAmJiBpbml0aWFsVmFsdWUgPT09IHVuZGVmaW5lZCkgcHJldmlvdXNWYWx1ZSA9IGN1cnJlbnRQcm9wZXJ0aWVzO1xuICAgICAgICBlbHNlIHByZXZpb3VzVmFsdWUgPSBjYWxsYmFjayhwcmV2aW91c1ZhbHVlLCBjdXJyZW50UHJvcGVydGllcywgZmVhdHVyZUluZGV4KTtcbiAgICB9KTtcbiAgICByZXR1cm4gcHJldmlvdXNWYWx1ZTtcbn1cblxuLyoqXG4gKiBDYWxsYmFjayBmb3IgZmVhdHVyZUVhY2hcbiAqXG4gKiBAY2FsbGJhY2sgZmVhdHVyZUVhY2hDYWxsYmFja1xuICogQHBhcmFtIHtGZWF0dXJlPGFueT59IGN1cnJlbnRGZWF0dXJlIFRoZSBjdXJyZW50IEZlYXR1cmUgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ9IGZlYXR1cmVJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgRmVhdHVyZSBiZWluZyBwcm9jZXNzZWQuXG4gKi9cblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgZmVhdHVyZXMgaW4gYW55IEdlb0pTT04gb2JqZWN0LCBzaW1pbGFyIHRvXG4gKiBBcnJheS5mb3JFYWNoLlxuICpcbiAqIEBuYW1lIGZlYXR1cmVFYWNoXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufEZlYXR1cmV8R2VvbWV0cnl9IGdlb2pzb24gYW55IEdlb0pTT04gb2JqZWN0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBhIG1ldGhvZCB0aGF0IHRha2VzIChjdXJyZW50RmVhdHVyZSwgZmVhdHVyZUluZGV4KVxuICogQHJldHVybnMge3ZvaWR9XG4gKiBAZXhhbXBsZVxuICogdmFyIGZlYXR1cmVzID0gdHVyZi5mZWF0dXJlQ29sbGVjdGlvbihbXG4gKiAgIHR1cmYucG9pbnQoWzI2LCAzN10sIHtmb286ICdiYXInfSksXG4gKiAgIHR1cmYucG9pbnQoWzM2LCA1M10sIHtoZWxsbzogJ3dvcmxkJ30pXG4gKiBdKTtcbiAqXG4gKiB0dXJmLmZlYXR1cmVFYWNoKGZlYXR1cmVzLCBmdW5jdGlvbiAoY3VycmVudEZlYXR1cmUsIGZlYXR1cmVJbmRleCkge1xuICogICAvLz1jdXJyZW50RmVhdHVyZVxuICogICAvLz1mZWF0dXJlSW5kZXhcbiAqIH0pO1xuICovXG5mdW5jdGlvbiBmZWF0dXJlRWFjaChnZW9qc29uLCBjYWxsYmFjaykge1xuICAgIGlmIChnZW9qc29uLnR5cGUgPT09ICdGZWF0dXJlJykge1xuICAgICAgICBjYWxsYmFjayhnZW9qc29uLCAwKTtcbiAgICB9IGVsc2UgaWYgKGdlb2pzb24udHlwZSA9PT0gJ0ZlYXR1cmVDb2xsZWN0aW9uJykge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdlb2pzb24uZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjayhnZW9qc29uLmZlYXR1cmVzW2ldLCBpKSA9PT0gZmFsc2UpIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIENhbGxiYWNrIGZvciBmZWF0dXJlUmVkdWNlXG4gKlxuICogVGhlIGZpcnN0IHRpbWUgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uIGlzIGNhbGxlZCwgdGhlIHZhbHVlcyBwcm92aWRlZCBhcyBhcmd1bWVudHMgZGVwZW5kXG4gKiBvbiB3aGV0aGVyIHRoZSByZWR1Y2UgbWV0aG9kIGhhcyBhbiBpbml0aWFsVmFsdWUgYXJndW1lbnQuXG4gKlxuICogSWYgYW4gaW5pdGlhbFZhbHVlIGlzIHByb3ZpZGVkIHRvIHRoZSByZWR1Y2UgbWV0aG9kOlxuICogIC0gVGhlIHByZXZpb3VzVmFsdWUgYXJndW1lbnQgaXMgaW5pdGlhbFZhbHVlLlxuICogIC0gVGhlIGN1cnJlbnRWYWx1ZSBhcmd1bWVudCBpcyB0aGUgdmFsdWUgb2YgdGhlIGZpcnN0IGVsZW1lbnQgcHJlc2VudCBpbiB0aGUgYXJyYXkuXG4gKlxuICogSWYgYW4gaW5pdGlhbFZhbHVlIGlzIG5vdCBwcm92aWRlZDpcbiAqICAtIFRoZSBwcmV2aW91c1ZhbHVlIGFyZ3VtZW50IGlzIHRoZSB2YWx1ZSBvZiB0aGUgZmlyc3QgZWxlbWVudCBwcmVzZW50IGluIHRoZSBhcnJheS5cbiAqICAtIFRoZSBjdXJyZW50VmFsdWUgYXJndW1lbnQgaXMgdGhlIHZhbHVlIG9mIHRoZSBzZWNvbmQgZWxlbWVudCBwcmVzZW50IGluIHRoZSBhcnJheS5cbiAqXG4gKiBAY2FsbGJhY2sgZmVhdHVyZVJlZHVjZUNhbGxiYWNrXG4gKiBAcGFyYW0geyp9IHByZXZpb3VzVmFsdWUgVGhlIGFjY3VtdWxhdGVkIHZhbHVlIHByZXZpb3VzbHkgcmV0dXJuZWQgaW4gdGhlIGxhc3QgaW52b2NhdGlvblxuICogb2YgdGhlIGNhbGxiYWNrLCBvciBpbml0aWFsVmFsdWUsIGlmIHN1cHBsaWVkLlxuICogQHBhcmFtIHtGZWF0dXJlfSBjdXJyZW50RmVhdHVyZSBUaGUgY3VycmVudCBGZWF0dXJlIGJlaW5nIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBmZWF0dXJlSW5kZXggVGhlIGN1cnJlbnQgaW5kZXggb2YgdGhlIEZlYXR1cmUgYmVpbmcgcHJvY2Vzc2VkLlxuICovXG5cbi8qKlxuICogUmVkdWNlIGZlYXR1cmVzIGluIGFueSBHZW9KU09OIG9iamVjdCwgc2ltaWxhciB0byBBcnJheS5yZWR1Y2UoKS5cbiAqXG4gKiBAbmFtZSBmZWF0dXJlUmVkdWNlXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufEZlYXR1cmV8R2VvbWV0cnl9IGdlb2pzb24gYW55IEdlb0pTT04gb2JqZWN0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBhIG1ldGhvZCB0aGF0IHRha2VzIChwcmV2aW91c1ZhbHVlLCBjdXJyZW50RmVhdHVyZSwgZmVhdHVyZUluZGV4KVxuICogQHBhcmFtIHsqfSBbaW5pdGlhbFZhbHVlXSBWYWx1ZSB0byB1c2UgYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHRvIHRoZSBmaXJzdCBjYWxsIG9mIHRoZSBjYWxsYmFjay5cbiAqIEByZXR1cm5zIHsqfSBUaGUgdmFsdWUgdGhhdCByZXN1bHRzIGZyb20gdGhlIHJlZHVjdGlvbi5cbiAqIEBleGFtcGxlXG4gKiB2YXIgZmVhdHVyZXMgPSB0dXJmLmZlYXR1cmVDb2xsZWN0aW9uKFtcbiAqICAgdHVyZi5wb2ludChbMjYsIDM3XSwge1wiZm9vXCI6IFwiYmFyXCJ9KSxcbiAqICAgdHVyZi5wb2ludChbMzYsIDUzXSwge1wiaGVsbG9cIjogXCJ3b3JsZFwifSlcbiAqIF0pO1xuICpcbiAqIHR1cmYuZmVhdHVyZVJlZHVjZShmZWF0dXJlcywgZnVuY3Rpb24gKHByZXZpb3VzVmFsdWUsIGN1cnJlbnRGZWF0dXJlLCBmZWF0dXJlSW5kZXgpIHtcbiAqICAgLy89cHJldmlvdXNWYWx1ZVxuICogICAvLz1jdXJyZW50RmVhdHVyZVxuICogICAvLz1mZWF0dXJlSW5kZXhcbiAqICAgcmV0dXJuIGN1cnJlbnRGZWF0dXJlXG4gKiB9KTtcbiAqL1xuZnVuY3Rpb24gZmVhdHVyZVJlZHVjZShnZW9qc29uLCBjYWxsYmFjaywgaW5pdGlhbFZhbHVlKSB7XG4gICAgdmFyIHByZXZpb3VzVmFsdWUgPSBpbml0aWFsVmFsdWU7XG4gICAgZmVhdHVyZUVhY2goZ2VvanNvbiwgZnVuY3Rpb24gKGN1cnJlbnRGZWF0dXJlLCBmZWF0dXJlSW5kZXgpIHtcbiAgICAgICAgaWYgKGZlYXR1cmVJbmRleCA9PT0gMCAmJiBpbml0aWFsVmFsdWUgPT09IHVuZGVmaW5lZCkgcHJldmlvdXNWYWx1ZSA9IGN1cnJlbnRGZWF0dXJlO1xuICAgICAgICBlbHNlIHByZXZpb3VzVmFsdWUgPSBjYWxsYmFjayhwcmV2aW91c1ZhbHVlLCBjdXJyZW50RmVhdHVyZSwgZmVhdHVyZUluZGV4KTtcbiAgICB9KTtcbiAgICByZXR1cm4gcHJldmlvdXNWYWx1ZTtcbn1cblxuLyoqXG4gKiBHZXQgYWxsIGNvb3JkaW5hdGVzIGZyb20gYW55IEdlb0pTT04gb2JqZWN0LlxuICpcbiAqIEBuYW1lIGNvb3JkQWxsXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufEZlYXR1cmV8R2VvbWV0cnl9IGdlb2pzb24gYW55IEdlb0pTT04gb2JqZWN0XG4gKiBAcmV0dXJucyB7QXJyYXk8QXJyYXk8bnVtYmVyPj59IGNvb3JkaW5hdGUgcG9zaXRpb24gYXJyYXlcbiAqIEBleGFtcGxlXG4gKiB2YXIgZmVhdHVyZXMgPSB0dXJmLmZlYXR1cmVDb2xsZWN0aW9uKFtcbiAqICAgdHVyZi5wb2ludChbMjYsIDM3XSwge2ZvbzogJ2Jhcid9KSxcbiAqICAgdHVyZi5wb2ludChbMzYsIDUzXSwge2hlbGxvOiAnd29ybGQnfSlcbiAqIF0pO1xuICpcbiAqIHZhciBjb29yZHMgPSB0dXJmLmNvb3JkQWxsKGZlYXR1cmVzKTtcbiAqIC8vPSBbWzI2LCAzN10sIFszNiwgNTNdXVxuICovXG5mdW5jdGlvbiBjb29yZEFsbChnZW9qc29uKSB7XG4gICAgdmFyIGNvb3JkcyA9IFtdO1xuICAgIGNvb3JkRWFjaChnZW9qc29uLCBmdW5jdGlvbiAoY29vcmQpIHtcbiAgICAgICAgY29vcmRzLnB1c2goY29vcmQpO1xuICAgIH0pO1xuICAgIHJldHVybiBjb29yZHM7XG59XG5cbi8qKlxuICogQ2FsbGJhY2sgZm9yIGdlb21FYWNoXG4gKlxuICogQGNhbGxiYWNrIGdlb21FYWNoQ2FsbGJhY2tcbiAqIEBwYXJhbSB7R2VvbWV0cnl9IGN1cnJlbnRHZW9tZXRyeSBUaGUgY3VycmVudCBHZW9tZXRyeSBiZWluZyBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gZmVhdHVyZUluZGV4IFRoZSBjdXJyZW50IGluZGV4IG9mIHRoZSBGZWF0dXJlIGJlaW5nIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBmZWF0dXJlUHJvcGVydGllcyBUaGUgY3VycmVudCBGZWF0dXJlIFByb3BlcnRpZXMgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtBcnJheTxudW1iZXI+fSBmZWF0dXJlQkJveCBUaGUgY3VycmVudCBGZWF0dXJlIEJCb3ggYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSBmZWF0dXJlSWQgVGhlIGN1cnJlbnQgRmVhdHVyZSBJZCBiZWluZyBwcm9jZXNzZWQuXG4gKi9cblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgZWFjaCBnZW9tZXRyeSBpbiBhbnkgR2VvSlNPTiBvYmplY3QsIHNpbWlsYXIgdG8gQXJyYXkuZm9yRWFjaCgpXG4gKlxuICogQG5hbWUgZ2VvbUVhY2hcbiAqIEBwYXJhbSB7RmVhdHVyZUNvbGxlY3Rpb258RmVhdHVyZXxHZW9tZXRyeX0gZ2VvanNvbiBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGEgbWV0aG9kIHRoYXQgdGFrZXMgKGN1cnJlbnRHZW9tZXRyeSwgZmVhdHVyZUluZGV4LCBmZWF0dXJlUHJvcGVydGllcywgZmVhdHVyZUJCb3gsIGZlYXR1cmVJZClcbiAqIEByZXR1cm5zIHt2b2lkfVxuICogQGV4YW1wbGVcbiAqIHZhciBmZWF0dXJlcyA9IHR1cmYuZmVhdHVyZUNvbGxlY3Rpb24oW1xuICogICAgIHR1cmYucG9pbnQoWzI2LCAzN10sIHtmb286ICdiYXInfSksXG4gKiAgICAgdHVyZi5wb2ludChbMzYsIDUzXSwge2hlbGxvOiAnd29ybGQnfSlcbiAqIF0pO1xuICpcbiAqIHR1cmYuZ2VvbUVhY2goZmVhdHVyZXMsIGZ1bmN0aW9uIChjdXJyZW50R2VvbWV0cnksIGZlYXR1cmVJbmRleCwgZmVhdHVyZVByb3BlcnRpZXMsIGZlYXR1cmVCQm94LCBmZWF0dXJlSWQpIHtcbiAqICAgLy89Y3VycmVudEdlb21ldHJ5XG4gKiAgIC8vPWZlYXR1cmVJbmRleFxuICogICAvLz1mZWF0dXJlUHJvcGVydGllc1xuICogICAvLz1mZWF0dXJlQkJveFxuICogICAvLz1mZWF0dXJlSWRcbiAqIH0pO1xuICovXG5mdW5jdGlvbiBnZW9tRWFjaChnZW9qc29uLCBjYWxsYmFjaykge1xuICAgIHZhciBpLCBqLCBnLCBnZW9tZXRyeSwgc3RvcEcsXG4gICAgICAgIGdlb21ldHJ5TWF5YmVDb2xsZWN0aW9uLFxuICAgICAgICBpc0dlb21ldHJ5Q29sbGVjdGlvbixcbiAgICAgICAgZmVhdHVyZVByb3BlcnRpZXMsXG4gICAgICAgIGZlYXR1cmVCQm94LFxuICAgICAgICBmZWF0dXJlSWQsXG4gICAgICAgIGZlYXR1cmVJbmRleCA9IDAsXG4gICAgICAgIGlzRmVhdHVyZUNvbGxlY3Rpb24gPSBnZW9qc29uLnR5cGUgPT09ICdGZWF0dXJlQ29sbGVjdGlvbicsXG4gICAgICAgIGlzRmVhdHVyZSA9IGdlb2pzb24udHlwZSA9PT0gJ0ZlYXR1cmUnLFxuICAgICAgICBzdG9wID0gaXNGZWF0dXJlQ29sbGVjdGlvbiA/IGdlb2pzb24uZmVhdHVyZXMubGVuZ3RoIDogMTtcblxuICAgIC8vIFRoaXMgbG9naWMgbWF5IGxvb2sgYSBsaXR0bGUgd2VpcmQuIFRoZSByZWFzb24gd2h5IGl0IGlzIHRoYXQgd2F5XG4gICAgLy8gaXMgYmVjYXVzZSBpdCdzIHRyeWluZyB0byBiZSBmYXN0LiBHZW9KU09OIHN1cHBvcnRzIG11bHRpcGxlIGtpbmRzXG4gICAgLy8gb2Ygb2JqZWN0cyBhdCBpdHMgcm9vdDogRmVhdHVyZUNvbGxlY3Rpb24sIEZlYXR1cmVzLCBHZW9tZXRyaWVzLlxuICAgIC8vIFRoaXMgZnVuY3Rpb24gaGFzIHRoZSByZXNwb25zaWJpbGl0eSBvZiBoYW5kbGluZyBhbGwgb2YgdGhlbSwgYW5kIHRoYXRcbiAgICAvLyBtZWFucyB0aGF0IHNvbWUgb2YgdGhlIGBmb3JgIGxvb3BzIHlvdSBzZWUgYmVsb3cgYWN0dWFsbHkganVzdCBkb24ndCBhcHBseVxuICAgIC8vIHRvIGNlcnRhaW4gaW5wdXRzLiBGb3IgaW5zdGFuY2UsIGlmIHlvdSBnaXZlIHRoaXMganVzdCBhXG4gICAgLy8gUG9pbnQgZ2VvbWV0cnksIHRoZW4gYm90aCBsb29wcyBhcmUgc2hvcnQtY2lyY3VpdGVkIGFuZCBhbGwgd2UgZG9cbiAgICAvLyBpcyBncmFkdWFsbHkgcmVuYW1lIHRoZSBpbnB1dCB1bnRpbCBpdCdzIGNhbGxlZCAnZ2VvbWV0cnknLlxuICAgIC8vXG4gICAgLy8gVGhpcyBhbHNvIGFpbXMgdG8gYWxsb2NhdGUgYXMgZmV3IHJlc291cmNlcyBhcyBwb3NzaWJsZToganVzdCBhXG4gICAgLy8gZmV3IG51bWJlcnMgYW5kIGJvb2xlYW5zLCByYXRoZXIgdGhhbiBhbnkgdGVtcG9yYXJ5IGFycmF5cyBhcyB3b3VsZFxuICAgIC8vIGJlIHJlcXVpcmVkIHdpdGggdGhlIG5vcm1hbGl6YXRpb24gYXBwcm9hY2guXG4gICAgZm9yIChpID0gMDsgaSA8IHN0b3A7IGkrKykge1xuXG4gICAgICAgIGdlb21ldHJ5TWF5YmVDb2xsZWN0aW9uID0gKGlzRmVhdHVyZUNvbGxlY3Rpb24gPyBnZW9qc29uLmZlYXR1cmVzW2ldLmdlb21ldHJ5IDpcbiAgICAgICAgICAgIChpc0ZlYXR1cmUgPyBnZW9qc29uLmdlb21ldHJ5IDogZ2VvanNvbikpO1xuICAgICAgICBmZWF0dXJlUHJvcGVydGllcyA9IChpc0ZlYXR1cmVDb2xsZWN0aW9uID8gZ2VvanNvbi5mZWF0dXJlc1tpXS5wcm9wZXJ0aWVzIDpcbiAgICAgICAgICAgIChpc0ZlYXR1cmUgPyBnZW9qc29uLnByb3BlcnRpZXMgOiB7fSkpO1xuICAgICAgICBmZWF0dXJlQkJveCA9IChpc0ZlYXR1cmVDb2xsZWN0aW9uID8gZ2VvanNvbi5mZWF0dXJlc1tpXS5iYm94IDpcbiAgICAgICAgICAgIChpc0ZlYXR1cmUgPyBnZW9qc29uLmJib3ggOiB1bmRlZmluZWQpKTtcbiAgICAgICAgZmVhdHVyZUlkID0gKGlzRmVhdHVyZUNvbGxlY3Rpb24gPyBnZW9qc29uLmZlYXR1cmVzW2ldLmlkIDpcbiAgICAgICAgICAgIChpc0ZlYXR1cmUgPyBnZW9qc29uLmlkIDogdW5kZWZpbmVkKSk7XG4gICAgICAgIGlzR2VvbWV0cnlDb2xsZWN0aW9uID0gKGdlb21ldHJ5TWF5YmVDb2xsZWN0aW9uKSA/IGdlb21ldHJ5TWF5YmVDb2xsZWN0aW9uLnR5cGUgPT09ICdHZW9tZXRyeUNvbGxlY3Rpb24nIDogZmFsc2U7XG4gICAgICAgIHN0b3BHID0gaXNHZW9tZXRyeUNvbGxlY3Rpb24gPyBnZW9tZXRyeU1heWJlQ29sbGVjdGlvbi5nZW9tZXRyaWVzLmxlbmd0aCA6IDE7XG5cbiAgICAgICAgZm9yIChnID0gMDsgZyA8IHN0b3BHOyBnKyspIHtcbiAgICAgICAgICAgIGdlb21ldHJ5ID0gaXNHZW9tZXRyeUNvbGxlY3Rpb24gP1xuICAgICAgICAgICAgICAgIGdlb21ldHJ5TWF5YmVDb2xsZWN0aW9uLmdlb21ldHJpZXNbZ10gOiBnZW9tZXRyeU1heWJlQ29sbGVjdGlvbjtcblxuICAgICAgICAgICAgLy8gSGFuZGxlIG51bGwgR2VvbWV0cnlcbiAgICAgICAgICAgIGlmIChnZW9tZXRyeSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjayhudWxsLCBmZWF0dXJlSW5kZXgsIGZlYXR1cmVQcm9wZXJ0aWVzLCBmZWF0dXJlQkJveCwgZmVhdHVyZUlkKSA9PT0gZmFsc2UpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHN3aXRjaCAoZ2VvbWV0cnkudHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnUG9pbnQnOlxuICAgICAgICAgICAgY2FzZSAnTGluZVN0cmluZyc6XG4gICAgICAgICAgICBjYXNlICdNdWx0aVBvaW50JzpcbiAgICAgICAgICAgIGNhc2UgJ1BvbHlnb24nOlxuICAgICAgICAgICAgY2FzZSAnTXVsdGlMaW5lU3RyaW5nJzpcbiAgICAgICAgICAgIGNhc2UgJ011bHRpUG9seWdvbic6IHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2soZ2VvbWV0cnksIGZlYXR1cmVJbmRleCwgZmVhdHVyZVByb3BlcnRpZXMsIGZlYXR1cmVCQm94LCBmZWF0dXJlSWQpID09PSBmYWxzZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSAnR2VvbWV0cnlDb2xsZWN0aW9uJzoge1xuICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBnZW9tZXRyeS5nZW9tZXRyaWVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjayhnZW9tZXRyeS5nZW9tZXRyaWVzW2pdLCBmZWF0dXJlSW5kZXgsIGZlYXR1cmVQcm9wZXJ0aWVzLCBmZWF0dXJlQkJveCwgZmVhdHVyZUlkKSA9PT0gZmFsc2UpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBHZW9tZXRyeSBUeXBlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gT25seSBpbmNyZWFzZSBgZmVhdHVyZUluZGV4YCBwZXIgZWFjaCBmZWF0dXJlXG4gICAgICAgIGZlYXR1cmVJbmRleCsrO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDYWxsYmFjayBmb3IgZ2VvbVJlZHVjZVxuICpcbiAqIFRoZSBmaXJzdCB0aW1lIHRoZSBjYWxsYmFjayBmdW5jdGlvbiBpcyBjYWxsZWQsIHRoZSB2YWx1ZXMgcHJvdmlkZWQgYXMgYXJndW1lbnRzIGRlcGVuZFxuICogb24gd2hldGhlciB0aGUgcmVkdWNlIG1ldGhvZCBoYXMgYW4gaW5pdGlhbFZhbHVlIGFyZ3VtZW50LlxuICpcbiAqIElmIGFuIGluaXRpYWxWYWx1ZSBpcyBwcm92aWRlZCB0byB0aGUgcmVkdWNlIG1ldGhvZDpcbiAqICAtIFRoZSBwcmV2aW91c1ZhbHVlIGFyZ3VtZW50IGlzIGluaXRpYWxWYWx1ZS5cbiAqICAtIFRoZSBjdXJyZW50VmFsdWUgYXJndW1lbnQgaXMgdGhlIHZhbHVlIG9mIHRoZSBmaXJzdCBlbGVtZW50IHByZXNlbnQgaW4gdGhlIGFycmF5LlxuICpcbiAqIElmIGFuIGluaXRpYWxWYWx1ZSBpcyBub3QgcHJvdmlkZWQ6XG4gKiAgLSBUaGUgcHJldmlvdXNWYWx1ZSBhcmd1bWVudCBpcyB0aGUgdmFsdWUgb2YgdGhlIGZpcnN0IGVsZW1lbnQgcHJlc2VudCBpbiB0aGUgYXJyYXkuXG4gKiAgLSBUaGUgY3VycmVudFZhbHVlIGFyZ3VtZW50IGlzIHRoZSB2YWx1ZSBvZiB0aGUgc2Vjb25kIGVsZW1lbnQgcHJlc2VudCBpbiB0aGUgYXJyYXkuXG4gKlxuICogQGNhbGxiYWNrIGdlb21SZWR1Y2VDYWxsYmFja1xuICogQHBhcmFtIHsqfSBwcmV2aW91c1ZhbHVlIFRoZSBhY2N1bXVsYXRlZCB2YWx1ZSBwcmV2aW91c2x5IHJldHVybmVkIGluIHRoZSBsYXN0IGludm9jYXRpb25cbiAqIG9mIHRoZSBjYWxsYmFjaywgb3IgaW5pdGlhbFZhbHVlLCBpZiBzdXBwbGllZC5cbiAqIEBwYXJhbSB7R2VvbWV0cnl9IGN1cnJlbnRHZW9tZXRyeSBUaGUgY3VycmVudCBHZW9tZXRyeSBiZWluZyBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gZmVhdHVyZUluZGV4IFRoZSBjdXJyZW50IGluZGV4IG9mIHRoZSBGZWF0dXJlIGJlaW5nIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBmZWF0dXJlUHJvcGVydGllcyBUaGUgY3VycmVudCBGZWF0dXJlIFByb3BlcnRpZXMgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtBcnJheTxudW1iZXI+fSBmZWF0dXJlQkJveCBUaGUgY3VycmVudCBGZWF0dXJlIEJCb3ggYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSBmZWF0dXJlSWQgVGhlIGN1cnJlbnQgRmVhdHVyZSBJZCBiZWluZyBwcm9jZXNzZWQuXG4gKi9cblxuLyoqXG4gKiBSZWR1Y2UgZ2VvbWV0cnkgaW4gYW55IEdlb0pTT04gb2JqZWN0LCBzaW1pbGFyIHRvIEFycmF5LnJlZHVjZSgpLlxuICpcbiAqIEBuYW1lIGdlb21SZWR1Y2VcbiAqIEBwYXJhbSB7RmVhdHVyZUNvbGxlY3Rpb258RmVhdHVyZXxHZW9tZXRyeX0gZ2VvanNvbiBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGEgbWV0aG9kIHRoYXQgdGFrZXMgKHByZXZpb3VzVmFsdWUsIGN1cnJlbnRHZW9tZXRyeSwgZmVhdHVyZUluZGV4LCBmZWF0dXJlUHJvcGVydGllcywgZmVhdHVyZUJCb3gsIGZlYXR1cmVJZClcbiAqIEBwYXJhbSB7Kn0gW2luaXRpYWxWYWx1ZV0gVmFsdWUgdG8gdXNlIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgZmlyc3QgY2FsbCBvZiB0aGUgY2FsbGJhY2suXG4gKiBAcmV0dXJucyB7Kn0gVGhlIHZhbHVlIHRoYXQgcmVzdWx0cyBmcm9tIHRoZSByZWR1Y3Rpb24uXG4gKiBAZXhhbXBsZVxuICogdmFyIGZlYXR1cmVzID0gdHVyZi5mZWF0dXJlQ29sbGVjdGlvbihbXG4gKiAgICAgdHVyZi5wb2ludChbMjYsIDM3XSwge2ZvbzogJ2Jhcid9KSxcbiAqICAgICB0dXJmLnBvaW50KFszNiwgNTNdLCB7aGVsbG86ICd3b3JsZCd9KVxuICogXSk7XG4gKlxuICogdHVyZi5nZW9tUmVkdWNlKGZlYXR1cmVzLCBmdW5jdGlvbiAocHJldmlvdXNWYWx1ZSwgY3VycmVudEdlb21ldHJ5LCBmZWF0dXJlSW5kZXgsIGZlYXR1cmVQcm9wZXJ0aWVzLCBmZWF0dXJlQkJveCwgZmVhdHVyZUlkKSB7XG4gKiAgIC8vPXByZXZpb3VzVmFsdWVcbiAqICAgLy89Y3VycmVudEdlb21ldHJ5XG4gKiAgIC8vPWZlYXR1cmVJbmRleFxuICogICAvLz1mZWF0dXJlUHJvcGVydGllc1xuICogICAvLz1mZWF0dXJlQkJveFxuICogICAvLz1mZWF0dXJlSWRcbiAqICAgcmV0dXJuIGN1cnJlbnRHZW9tZXRyeVxuICogfSk7XG4gKi9cbmZ1bmN0aW9uIGdlb21SZWR1Y2UoZ2VvanNvbiwgY2FsbGJhY2ssIGluaXRpYWxWYWx1ZSkge1xuICAgIHZhciBwcmV2aW91c1ZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICAgIGdlb21FYWNoKGdlb2pzb24sIGZ1bmN0aW9uIChjdXJyZW50R2VvbWV0cnksIGZlYXR1cmVJbmRleCwgZmVhdHVyZVByb3BlcnRpZXMsIGZlYXR1cmVCQm94LCBmZWF0dXJlSWQpIHtcbiAgICAgICAgaWYgKGZlYXR1cmVJbmRleCA9PT0gMCAmJiBpbml0aWFsVmFsdWUgPT09IHVuZGVmaW5lZCkgcHJldmlvdXNWYWx1ZSA9IGN1cnJlbnRHZW9tZXRyeTtcbiAgICAgICAgZWxzZSBwcmV2aW91c1ZhbHVlID0gY2FsbGJhY2socHJldmlvdXNWYWx1ZSwgY3VycmVudEdlb21ldHJ5LCBmZWF0dXJlSW5kZXgsIGZlYXR1cmVQcm9wZXJ0aWVzLCBmZWF0dXJlQkJveCwgZmVhdHVyZUlkKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcHJldmlvdXNWYWx1ZTtcbn1cblxuLyoqXG4gKiBDYWxsYmFjayBmb3IgZmxhdHRlbkVhY2hcbiAqXG4gKiBAY2FsbGJhY2sgZmxhdHRlbkVhY2hDYWxsYmFja1xuICogQHBhcmFtIHtGZWF0dXJlfSBjdXJyZW50RmVhdHVyZSBUaGUgY3VycmVudCBmbGF0dGVuZWQgZmVhdHVyZSBiZWluZyBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gZmVhdHVyZUluZGV4IFRoZSBjdXJyZW50IGluZGV4IG9mIHRoZSBGZWF0dXJlIGJlaW5nIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBtdWx0aUZlYXR1cmVJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgTXVsdGktRmVhdHVyZSBiZWluZyBwcm9jZXNzZWQuXG4gKi9cblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgZmxhdHRlbmVkIGZlYXR1cmVzIGluIGFueSBHZW9KU09OIG9iamVjdCwgc2ltaWxhciB0b1xuICogQXJyYXkuZm9yRWFjaC5cbiAqXG4gKiBAbmFtZSBmbGF0dGVuRWFjaFxuICogQHBhcmFtIHtGZWF0dXJlQ29sbGVjdGlvbnxGZWF0dXJlfEdlb21ldHJ5fSBnZW9qc29uIGFueSBHZW9KU09OIG9iamVjdFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgYSBtZXRob2QgdGhhdCB0YWtlcyAoY3VycmVudEZlYXR1cmUsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgpXG4gKiBAZXhhbXBsZVxuICogdmFyIGZlYXR1cmVzID0gdHVyZi5mZWF0dXJlQ29sbGVjdGlvbihbXG4gKiAgICAgdHVyZi5wb2ludChbMjYsIDM3XSwge2ZvbzogJ2Jhcid9KSxcbiAqICAgICB0dXJmLm11bHRpUG9pbnQoW1s0MCwgMzBdLCBbMzYsIDUzXV0sIHtoZWxsbzogJ3dvcmxkJ30pXG4gKiBdKTtcbiAqXG4gKiB0dXJmLmZsYXR0ZW5FYWNoKGZlYXR1cmVzLCBmdW5jdGlvbiAoY3VycmVudEZlYXR1cmUsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgpIHtcbiAqICAgLy89Y3VycmVudEZlYXR1cmVcbiAqICAgLy89ZmVhdHVyZUluZGV4XG4gKiAgIC8vPW11bHRpRmVhdHVyZUluZGV4XG4gKiB9KTtcbiAqL1xuZnVuY3Rpb24gZmxhdHRlbkVhY2goZ2VvanNvbiwgY2FsbGJhY2spIHtcbiAgICBnZW9tRWFjaChnZW9qc29uLCBmdW5jdGlvbiAoZ2VvbWV0cnksIGZlYXR1cmVJbmRleCwgcHJvcGVydGllcywgYmJveCwgaWQpIHtcbiAgICAgICAgLy8gQ2FsbGJhY2sgZm9yIHNpbmdsZSBnZW9tZXRyeVxuICAgICAgICB2YXIgdHlwZSA9IChnZW9tZXRyeSA9PT0gbnVsbCkgPyBudWxsIDogZ2VvbWV0cnkudHlwZTtcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgbnVsbDpcbiAgICAgICAgY2FzZSAnUG9pbnQnOlxuICAgICAgICBjYXNlICdMaW5lU3RyaW5nJzpcbiAgICAgICAgY2FzZSAnUG9seWdvbic6XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2soaGVscGVycy5mZWF0dXJlKGdlb21ldHJ5LCBwcm9wZXJ0aWVzLCB7YmJveDogYmJveCwgaWQ6IGlkfSksIGZlYXR1cmVJbmRleCwgMCkgPT09IGZhbHNlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZ2VvbVR5cGU7XG5cbiAgICAgICAgLy8gQ2FsbGJhY2sgZm9yIG11bHRpLWdlb21ldHJ5XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlICdNdWx0aVBvaW50JzpcbiAgICAgICAgICAgIGdlb21UeXBlID0gJ1BvaW50JztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdNdWx0aUxpbmVTdHJpbmcnOlxuICAgICAgICAgICAgZ2VvbVR5cGUgPSAnTGluZVN0cmluZyc7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnTXVsdGlQb2x5Z29uJzpcbiAgICAgICAgICAgIGdlb21UeXBlID0gJ1BvbHlnb24nO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBtdWx0aUZlYXR1cmVJbmRleCA9IDA7IG11bHRpRmVhdHVyZUluZGV4IDwgZ2VvbWV0cnkuY29vcmRpbmF0ZXMubGVuZ3RoOyBtdWx0aUZlYXR1cmVJbmRleCsrKSB7XG4gICAgICAgICAgICB2YXIgY29vcmRpbmF0ZSA9IGdlb21ldHJ5LmNvb3JkaW5hdGVzW211bHRpRmVhdHVyZUluZGV4XTtcbiAgICAgICAgICAgIHZhciBnZW9tID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IGdlb21UeXBlLFxuICAgICAgICAgICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKGhlbHBlcnMuZmVhdHVyZShnZW9tLCBwcm9wZXJ0aWVzKSwgZmVhdHVyZUluZGV4LCBtdWx0aUZlYXR1cmVJbmRleCkgPT09IGZhbHNlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuLyoqXG4gKiBDYWxsYmFjayBmb3IgZmxhdHRlblJlZHVjZVxuICpcbiAqIFRoZSBmaXJzdCB0aW1lIHRoZSBjYWxsYmFjayBmdW5jdGlvbiBpcyBjYWxsZWQsIHRoZSB2YWx1ZXMgcHJvdmlkZWQgYXMgYXJndW1lbnRzIGRlcGVuZFxuICogb24gd2hldGhlciB0aGUgcmVkdWNlIG1ldGhvZCBoYXMgYW4gaW5pdGlhbFZhbHVlIGFyZ3VtZW50LlxuICpcbiAqIElmIGFuIGluaXRpYWxWYWx1ZSBpcyBwcm92aWRlZCB0byB0aGUgcmVkdWNlIG1ldGhvZDpcbiAqICAtIFRoZSBwcmV2aW91c1ZhbHVlIGFyZ3VtZW50IGlzIGluaXRpYWxWYWx1ZS5cbiAqICAtIFRoZSBjdXJyZW50VmFsdWUgYXJndW1lbnQgaXMgdGhlIHZhbHVlIG9mIHRoZSBmaXJzdCBlbGVtZW50IHByZXNlbnQgaW4gdGhlIGFycmF5LlxuICpcbiAqIElmIGFuIGluaXRpYWxWYWx1ZSBpcyBub3QgcHJvdmlkZWQ6XG4gKiAgLSBUaGUgcHJldmlvdXNWYWx1ZSBhcmd1bWVudCBpcyB0aGUgdmFsdWUgb2YgdGhlIGZpcnN0IGVsZW1lbnQgcHJlc2VudCBpbiB0aGUgYXJyYXkuXG4gKiAgLSBUaGUgY3VycmVudFZhbHVlIGFyZ3VtZW50IGlzIHRoZSB2YWx1ZSBvZiB0aGUgc2Vjb25kIGVsZW1lbnQgcHJlc2VudCBpbiB0aGUgYXJyYXkuXG4gKlxuICogQGNhbGxiYWNrIGZsYXR0ZW5SZWR1Y2VDYWxsYmFja1xuICogQHBhcmFtIHsqfSBwcmV2aW91c1ZhbHVlIFRoZSBhY2N1bXVsYXRlZCB2YWx1ZSBwcmV2aW91c2x5IHJldHVybmVkIGluIHRoZSBsYXN0IGludm9jYXRpb25cbiAqIG9mIHRoZSBjYWxsYmFjaywgb3IgaW5pdGlhbFZhbHVlLCBpZiBzdXBwbGllZC5cbiAqIEBwYXJhbSB7RmVhdHVyZX0gY3VycmVudEZlYXR1cmUgVGhlIGN1cnJlbnQgRmVhdHVyZSBiZWluZyBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gZmVhdHVyZUluZGV4IFRoZSBjdXJyZW50IGluZGV4IG9mIHRoZSBGZWF0dXJlIGJlaW5nIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBtdWx0aUZlYXR1cmVJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgTXVsdGktRmVhdHVyZSBiZWluZyBwcm9jZXNzZWQuXG4gKi9cblxuLyoqXG4gKiBSZWR1Y2UgZmxhdHRlbmVkIGZlYXR1cmVzIGluIGFueSBHZW9KU09OIG9iamVjdCwgc2ltaWxhciB0byBBcnJheS5yZWR1Y2UoKS5cbiAqXG4gKiBAbmFtZSBmbGF0dGVuUmVkdWNlXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufEZlYXR1cmV8R2VvbWV0cnl9IGdlb2pzb24gYW55IEdlb0pTT04gb2JqZWN0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBhIG1ldGhvZCB0aGF0IHRha2VzIChwcmV2aW91c1ZhbHVlLCBjdXJyZW50RmVhdHVyZSwgZmVhdHVyZUluZGV4LCBtdWx0aUZlYXR1cmVJbmRleClcbiAqIEBwYXJhbSB7Kn0gW2luaXRpYWxWYWx1ZV0gVmFsdWUgdG8gdXNlIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgZmlyc3QgY2FsbCBvZiB0aGUgY2FsbGJhY2suXG4gKiBAcmV0dXJucyB7Kn0gVGhlIHZhbHVlIHRoYXQgcmVzdWx0cyBmcm9tIHRoZSByZWR1Y3Rpb24uXG4gKiBAZXhhbXBsZVxuICogdmFyIGZlYXR1cmVzID0gdHVyZi5mZWF0dXJlQ29sbGVjdGlvbihbXG4gKiAgICAgdHVyZi5wb2ludChbMjYsIDM3XSwge2ZvbzogJ2Jhcid9KSxcbiAqICAgICB0dXJmLm11bHRpUG9pbnQoW1s0MCwgMzBdLCBbMzYsIDUzXV0sIHtoZWxsbzogJ3dvcmxkJ30pXG4gKiBdKTtcbiAqXG4gKiB0dXJmLmZsYXR0ZW5SZWR1Y2UoZmVhdHVyZXMsIGZ1bmN0aW9uIChwcmV2aW91c1ZhbHVlLCBjdXJyZW50RmVhdHVyZSwgZmVhdHVyZUluZGV4LCBtdWx0aUZlYXR1cmVJbmRleCkge1xuICogICAvLz1wcmV2aW91c1ZhbHVlXG4gKiAgIC8vPWN1cnJlbnRGZWF0dXJlXG4gKiAgIC8vPWZlYXR1cmVJbmRleFxuICogICAvLz1tdWx0aUZlYXR1cmVJbmRleFxuICogICByZXR1cm4gY3VycmVudEZlYXR1cmVcbiAqIH0pO1xuICovXG5mdW5jdGlvbiBmbGF0dGVuUmVkdWNlKGdlb2pzb24sIGNhbGxiYWNrLCBpbml0aWFsVmFsdWUpIHtcbiAgICB2YXIgcHJldmlvdXNWYWx1ZSA9IGluaXRpYWxWYWx1ZTtcbiAgICBmbGF0dGVuRWFjaChnZW9qc29uLCBmdW5jdGlvbiAoY3VycmVudEZlYXR1cmUsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgpIHtcbiAgICAgICAgaWYgKGZlYXR1cmVJbmRleCA9PT0gMCAmJiBtdWx0aUZlYXR1cmVJbmRleCA9PT0gMCAmJiBpbml0aWFsVmFsdWUgPT09IHVuZGVmaW5lZCkgcHJldmlvdXNWYWx1ZSA9IGN1cnJlbnRGZWF0dXJlO1xuICAgICAgICBlbHNlIHByZXZpb3VzVmFsdWUgPSBjYWxsYmFjayhwcmV2aW91c1ZhbHVlLCBjdXJyZW50RmVhdHVyZSwgZmVhdHVyZUluZGV4LCBtdWx0aUZlYXR1cmVJbmRleCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHByZXZpb3VzVmFsdWU7XG59XG5cbi8qKlxuICogQ2FsbGJhY2sgZm9yIHNlZ21lbnRFYWNoXG4gKlxuICogQGNhbGxiYWNrIHNlZ21lbnRFYWNoQ2FsbGJhY2tcbiAqIEBwYXJhbSB7RmVhdHVyZTxMaW5lU3RyaW5nPn0gY3VycmVudFNlZ21lbnQgVGhlIGN1cnJlbnQgU2VnbWVudCBiZWluZyBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gZmVhdHVyZUluZGV4IFRoZSBjdXJyZW50IGluZGV4IG9mIHRoZSBGZWF0dXJlIGJlaW5nIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBtdWx0aUZlYXR1cmVJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgTXVsdGktRmVhdHVyZSBiZWluZyBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gZ2VvbWV0cnlJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgR2VvbWV0cnkgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ9IHNlZ21lbnRJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgU2VnbWVudCBiZWluZyBwcm9jZXNzZWQuXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqL1xuXG4vKipcbiAqIEl0ZXJhdGUgb3ZlciAyLXZlcnRleCBsaW5lIHNlZ21lbnQgaW4gYW55IEdlb0pTT04gb2JqZWN0LCBzaW1pbGFyIHRvIEFycmF5LmZvckVhY2goKVxuICogKE11bHRpKVBvaW50IGdlb21ldHJpZXMgZG8gbm90IGNvbnRhaW4gc2VnbWVudHMgdGhlcmVmb3JlIHRoZXkgYXJlIGlnbm9yZWQgZHVyaW5nIHRoaXMgb3BlcmF0aW9uLlxuICpcbiAqIEBwYXJhbSB7RmVhdHVyZUNvbGxlY3Rpb258RmVhdHVyZXxHZW9tZXRyeX0gZ2VvanNvbiBhbnkgR2VvSlNPTlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgYSBtZXRob2QgdGhhdCB0YWtlcyAoY3VycmVudFNlZ21lbnQsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIGdlb21ldHJ5SW5kZXgsIHNlZ21lbnRJbmRleClcbiAqIEByZXR1cm5zIHt2b2lkfVxuICogQGV4YW1wbGVcbiAqIHZhciBwb2x5Z29uID0gdHVyZi5wb2x5Z29uKFtbWy01MCwgNV0sIFstNDAsIC0xMF0sIFstNTAsIC0xMF0sIFstNDAsIDVdLCBbLTUwLCA1XV1dKTtcbiAqXG4gKiAvLyBJdGVyYXRlIG92ZXIgR2VvSlNPTiBieSAyLXZlcnRleCBzZWdtZW50c1xuICogdHVyZi5zZWdtZW50RWFjaChwb2x5Z29uLCBmdW5jdGlvbiAoY3VycmVudFNlZ21lbnQsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIGdlb21ldHJ5SW5kZXgsIHNlZ21lbnRJbmRleCkge1xuICogICAvLz1jdXJyZW50U2VnbWVudFxuICogICAvLz1mZWF0dXJlSW5kZXhcbiAqICAgLy89bXVsdGlGZWF0dXJlSW5kZXhcbiAqICAgLy89Z2VvbWV0cnlJbmRleFxuICogICAvLz1zZWdtZW50SW5kZXhcbiAqIH0pO1xuICpcbiAqIC8vIENhbGN1bGF0ZSB0aGUgdG90YWwgbnVtYmVyIG9mIHNlZ21lbnRzXG4gKiB2YXIgdG90YWwgPSAwO1xuICogdHVyZi5zZWdtZW50RWFjaChwb2x5Z29uLCBmdW5jdGlvbiAoKSB7XG4gKiAgICAgdG90YWwrKztcbiAqIH0pO1xuICovXG5mdW5jdGlvbiBzZWdtZW50RWFjaChnZW9qc29uLCBjYWxsYmFjaykge1xuICAgIGZsYXR0ZW5FYWNoKGdlb2pzb24sIGZ1bmN0aW9uIChmZWF0dXJlLCBmZWF0dXJlSW5kZXgsIG11bHRpRmVhdHVyZUluZGV4KSB7XG4gICAgICAgIHZhciBzZWdtZW50SW5kZXggPSAwO1xuXG4gICAgICAgIC8vIEV4Y2x1ZGUgbnVsbCBHZW9tZXRyaWVzXG4gICAgICAgIGlmICghZmVhdHVyZS5nZW9tZXRyeSkgcmV0dXJuO1xuICAgICAgICAvLyAoTXVsdGkpUG9pbnQgZ2VvbWV0cmllcyBkbyBub3QgY29udGFpbiBzZWdtZW50cyB0aGVyZWZvcmUgdGhleSBhcmUgaWdub3JlZCBkdXJpbmcgdGhpcyBvcGVyYXRpb24uXG4gICAgICAgIHZhciB0eXBlID0gZmVhdHVyZS5nZW9tZXRyeS50eXBlO1xuICAgICAgICBpZiAodHlwZSA9PT0gJ1BvaW50JyB8fCB0eXBlID09PSAnTXVsdGlQb2ludCcpIHJldHVybjtcblxuICAgICAgICAvLyBHZW5lcmF0ZSAyLXZlcnRleCBsaW5lIHNlZ21lbnRzXG4gICAgICAgIHZhciBwcmV2aW91c0Nvb3JkcztcbiAgICAgICAgdmFyIHByZXZpb3VzRmVhdHVyZUluZGV4ID0gMDtcbiAgICAgICAgdmFyIHByZXZpb3VzTXVsdGlJbmRleCA9IDA7XG4gICAgICAgIHZhciBwcmV2R2VvbUluZGV4ID0gMDtcbiAgICAgICAgaWYgKGNvb3JkRWFjaChmZWF0dXJlLCBmdW5jdGlvbiAoY3VycmVudENvb3JkLCBjb29yZEluZGV4LCBmZWF0dXJlSW5kZXhDb29yZCwgbXVsdGlQYXJ0SW5kZXhDb29yZCwgZ2VvbWV0cnlJbmRleCkge1xuICAgICAgICAgICAgLy8gU2ltdWxhdGluZyBhIG1ldGEuY29vcmRSZWR1Y2UoKSBzaW5jZSBgcmVkdWNlYCBvcGVyYXRpb25zIGNhbm5vdCBiZSBzdG9wcGVkIGJ5IHJldHVybmluZyBgZmFsc2VgXG4gICAgICAgICAgICBpZiAocHJldmlvdXNDb29yZHMgPT09IHVuZGVmaW5lZCB8fCBmZWF0dXJlSW5kZXggPiBwcmV2aW91c0ZlYXR1cmVJbmRleCB8fCBtdWx0aVBhcnRJbmRleENvb3JkID4gcHJldmlvdXNNdWx0aUluZGV4IHx8IGdlb21ldHJ5SW5kZXggPiBwcmV2R2VvbUluZGV4KSB7XG4gICAgICAgICAgICAgICAgcHJldmlvdXNDb29yZHMgPSBjdXJyZW50Q29vcmQ7XG4gICAgICAgICAgICAgICAgcHJldmlvdXNGZWF0dXJlSW5kZXggPSBmZWF0dXJlSW5kZXg7XG4gICAgICAgICAgICAgICAgcHJldmlvdXNNdWx0aUluZGV4ID0gbXVsdGlQYXJ0SW5kZXhDb29yZDtcbiAgICAgICAgICAgICAgICBwcmV2R2VvbUluZGV4ID0gZ2VvbWV0cnlJbmRleDtcbiAgICAgICAgICAgICAgICBzZWdtZW50SW5kZXggPSAwO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBjdXJyZW50U2VnbWVudCA9IGhlbHBlcnMubGluZVN0cmluZyhbcHJldmlvdXNDb29yZHMsIGN1cnJlbnRDb29yZF0sIGZlYXR1cmUucHJvcGVydGllcyk7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2soY3VycmVudFNlZ21lbnQsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIGdlb21ldHJ5SW5kZXgsIHNlZ21lbnRJbmRleCkgPT09IGZhbHNlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICBzZWdtZW50SW5kZXgrKztcbiAgICAgICAgICAgIHByZXZpb3VzQ29vcmRzID0gY3VycmVudENvb3JkO1xuICAgICAgICB9KSA9PT0gZmFsc2UpIHJldHVybiBmYWxzZTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBDYWxsYmFjayBmb3Igc2VnbWVudFJlZHVjZVxuICpcbiAqIFRoZSBmaXJzdCB0aW1lIHRoZSBjYWxsYmFjayBmdW5jdGlvbiBpcyBjYWxsZWQsIHRoZSB2YWx1ZXMgcHJvdmlkZWQgYXMgYXJndW1lbnRzIGRlcGVuZFxuICogb24gd2hldGhlciB0aGUgcmVkdWNlIG1ldGhvZCBoYXMgYW4gaW5pdGlhbFZhbHVlIGFyZ3VtZW50LlxuICpcbiAqIElmIGFuIGluaXRpYWxWYWx1ZSBpcyBwcm92aWRlZCB0byB0aGUgcmVkdWNlIG1ldGhvZDpcbiAqICAtIFRoZSBwcmV2aW91c1ZhbHVlIGFyZ3VtZW50IGlzIGluaXRpYWxWYWx1ZS5cbiAqICAtIFRoZSBjdXJyZW50VmFsdWUgYXJndW1lbnQgaXMgdGhlIHZhbHVlIG9mIHRoZSBmaXJzdCBlbGVtZW50IHByZXNlbnQgaW4gdGhlIGFycmF5LlxuICpcbiAqIElmIGFuIGluaXRpYWxWYWx1ZSBpcyBub3QgcHJvdmlkZWQ6XG4gKiAgLSBUaGUgcHJldmlvdXNWYWx1ZSBhcmd1bWVudCBpcyB0aGUgdmFsdWUgb2YgdGhlIGZpcnN0IGVsZW1lbnQgcHJlc2VudCBpbiB0aGUgYXJyYXkuXG4gKiAgLSBUaGUgY3VycmVudFZhbHVlIGFyZ3VtZW50IGlzIHRoZSB2YWx1ZSBvZiB0aGUgc2Vjb25kIGVsZW1lbnQgcHJlc2VudCBpbiB0aGUgYXJyYXkuXG4gKlxuICogQGNhbGxiYWNrIHNlZ21lbnRSZWR1Y2VDYWxsYmFja1xuICogQHBhcmFtIHsqfSBwcmV2aW91c1ZhbHVlIFRoZSBhY2N1bXVsYXRlZCB2YWx1ZSBwcmV2aW91c2x5IHJldHVybmVkIGluIHRoZSBsYXN0IGludm9jYXRpb25cbiAqIG9mIHRoZSBjYWxsYmFjaywgb3IgaW5pdGlhbFZhbHVlLCBpZiBzdXBwbGllZC5cbiAqIEBwYXJhbSB7RmVhdHVyZTxMaW5lU3RyaW5nPn0gY3VycmVudFNlZ21lbnQgVGhlIGN1cnJlbnQgU2VnbWVudCBiZWluZyBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gZmVhdHVyZUluZGV4IFRoZSBjdXJyZW50IGluZGV4IG9mIHRoZSBGZWF0dXJlIGJlaW5nIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBtdWx0aUZlYXR1cmVJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgTXVsdGktRmVhdHVyZSBiZWluZyBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gZ2VvbWV0cnlJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgR2VvbWV0cnkgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ9IHNlZ21lbnRJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgU2VnbWVudCBiZWluZyBwcm9jZXNzZWQuXG4gKi9cblxuLyoqXG4gKiBSZWR1Y2UgMi12ZXJ0ZXggbGluZSBzZWdtZW50IGluIGFueSBHZW9KU09OIG9iamVjdCwgc2ltaWxhciB0byBBcnJheS5yZWR1Y2UoKVxuICogKE11bHRpKVBvaW50IGdlb21ldHJpZXMgZG8gbm90IGNvbnRhaW4gc2VnbWVudHMgdGhlcmVmb3JlIHRoZXkgYXJlIGlnbm9yZWQgZHVyaW5nIHRoaXMgb3BlcmF0aW9uLlxuICpcbiAqIEBwYXJhbSB7RmVhdHVyZUNvbGxlY3Rpb258RmVhdHVyZXxHZW9tZXRyeX0gZ2VvanNvbiBhbnkgR2VvSlNPTlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgYSBtZXRob2QgdGhhdCB0YWtlcyAocHJldmlvdXNWYWx1ZSwgY3VycmVudFNlZ21lbnQsIGN1cnJlbnRJbmRleClcbiAqIEBwYXJhbSB7Kn0gW2luaXRpYWxWYWx1ZV0gVmFsdWUgdG8gdXNlIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgZmlyc3QgY2FsbCBvZiB0aGUgY2FsbGJhY2suXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqIEBleGFtcGxlXG4gKiB2YXIgcG9seWdvbiA9IHR1cmYucG9seWdvbihbW1stNTAsIDVdLCBbLTQwLCAtMTBdLCBbLTUwLCAtMTBdLCBbLTQwLCA1XSwgWy01MCwgNV1dXSk7XG4gKlxuICogLy8gSXRlcmF0ZSBvdmVyIEdlb0pTT04gYnkgMi12ZXJ0ZXggc2VnbWVudHNcbiAqIHR1cmYuc2VnbWVudFJlZHVjZShwb2x5Z29uLCBmdW5jdGlvbiAocHJldmlvdXNTZWdtZW50LCBjdXJyZW50U2VnbWVudCwgZmVhdHVyZUluZGV4LCBtdWx0aUZlYXR1cmVJbmRleCwgZ2VvbWV0cnlJbmRleCwgc2VnbWVudEluZGV4KSB7XG4gKiAgIC8vPSBwcmV2aW91c1NlZ21lbnRcbiAqICAgLy89IGN1cnJlbnRTZWdtZW50XG4gKiAgIC8vPSBmZWF0dXJlSW5kZXhcbiAqICAgLy89IG11bHRpRmVhdHVyZUluZGV4XG4gKiAgIC8vPSBnZW9tZXRyeUluZGV4XG4gKiAgIC8vPSBzZWdtZW50SW5leFxuICogICByZXR1cm4gY3VycmVudFNlZ21lbnRcbiAqIH0pO1xuICpcbiAqIC8vIENhbGN1bGF0ZSB0aGUgdG90YWwgbnVtYmVyIG9mIHNlZ21lbnRzXG4gKiB2YXIgaW5pdGlhbFZhbHVlID0gMFxuICogdmFyIHRvdGFsID0gdHVyZi5zZWdtZW50UmVkdWNlKHBvbHlnb24sIGZ1bmN0aW9uIChwcmV2aW91c1ZhbHVlKSB7XG4gKiAgICAgcHJldmlvdXNWYWx1ZSsrO1xuICogICAgIHJldHVybiBwcmV2aW91c1ZhbHVlO1xuICogfSwgaW5pdGlhbFZhbHVlKTtcbiAqL1xuZnVuY3Rpb24gc2VnbWVudFJlZHVjZShnZW9qc29uLCBjYWxsYmFjaywgaW5pdGlhbFZhbHVlKSB7XG4gICAgdmFyIHByZXZpb3VzVmFsdWUgPSBpbml0aWFsVmFsdWU7XG4gICAgdmFyIHN0YXJ0ZWQgPSBmYWxzZTtcbiAgICBzZWdtZW50RWFjaChnZW9qc29uLCBmdW5jdGlvbiAoY3VycmVudFNlZ21lbnQsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIGdlb21ldHJ5SW5kZXgsIHNlZ21lbnRJbmRleCkge1xuICAgICAgICBpZiAoc3RhcnRlZCA9PT0gZmFsc2UgJiYgaW5pdGlhbFZhbHVlID09PSB1bmRlZmluZWQpIHByZXZpb3VzVmFsdWUgPSBjdXJyZW50U2VnbWVudDtcbiAgICAgICAgZWxzZSBwcmV2aW91c1ZhbHVlID0gY2FsbGJhY2socHJldmlvdXNWYWx1ZSwgY3VycmVudFNlZ21lbnQsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIGdlb21ldHJ5SW5kZXgsIHNlZ21lbnRJbmRleCk7XG4gICAgICAgIHN0YXJ0ZWQgPSB0cnVlO1xuICAgIH0pO1xuICAgIHJldHVybiBwcmV2aW91c1ZhbHVlO1xufVxuXG4vKipcbiAqIENhbGxiYWNrIGZvciBsaW5lRWFjaFxuICpcbiAqIEBjYWxsYmFjayBsaW5lRWFjaENhbGxiYWNrXG4gKiBAcGFyYW0ge0ZlYXR1cmU8TGluZVN0cmluZz59IGN1cnJlbnRMaW5lIFRoZSBjdXJyZW50IExpbmVTdHJpbmd8TGluZWFyUmluZyBiZWluZyBwcm9jZXNzZWRcbiAqIEBwYXJhbSB7bnVtYmVyfSBmZWF0dXJlSW5kZXggVGhlIGN1cnJlbnQgaW5kZXggb2YgdGhlIEZlYXR1cmUgYmVpbmcgcHJvY2Vzc2VkXG4gKiBAcGFyYW0ge251bWJlcn0gbXVsdGlGZWF0dXJlSW5kZXggVGhlIGN1cnJlbnQgaW5kZXggb2YgdGhlIE11bHRpLUZlYXR1cmUgYmVpbmcgcHJvY2Vzc2VkXG4gKiBAcGFyYW0ge251bWJlcn0gZ2VvbWV0cnlJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgR2VvbWV0cnkgYmVpbmcgcHJvY2Vzc2VkXG4gKi9cblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgbGluZSBvciByaW5nIGNvb3JkaW5hdGVzIGluIExpbmVTdHJpbmcsIFBvbHlnb24sIE11bHRpTGluZVN0cmluZywgTXVsdGlQb2x5Z29uIEZlYXR1cmVzIG9yIEdlb21ldHJpZXMsXG4gKiBzaW1pbGFyIHRvIEFycmF5LmZvckVhY2guXG4gKlxuICogQG5hbWUgbGluZUVhY2hcbiAqIEBwYXJhbSB7R2VvbWV0cnl8RmVhdHVyZTxMaW5lU3RyaW5nfFBvbHlnb258TXVsdGlMaW5lU3RyaW5nfE11bHRpUG9seWdvbj59IGdlb2pzb24gb2JqZWN0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBhIG1ldGhvZCB0aGF0IHRha2VzIChjdXJyZW50TGluZSwgZmVhdHVyZUluZGV4LCBtdWx0aUZlYXR1cmVJbmRleCwgZ2VvbWV0cnlJbmRleClcbiAqIEBleGFtcGxlXG4gKiB2YXIgbXVsdGlMaW5lID0gdHVyZi5tdWx0aUxpbmVTdHJpbmcoW1xuICogICBbWzI2LCAzN10sIFszNSwgNDVdXSxcbiAqICAgW1szNiwgNTNdLCBbMzgsIDUwXSwgWzQxLCA1NV1dXG4gKiBdKTtcbiAqXG4gKiB0dXJmLmxpbmVFYWNoKG11bHRpTGluZSwgZnVuY3Rpb24gKGN1cnJlbnRMaW5lLCBmZWF0dXJlSW5kZXgsIG11bHRpRmVhdHVyZUluZGV4LCBnZW9tZXRyeUluZGV4KSB7XG4gKiAgIC8vPWN1cnJlbnRMaW5lXG4gKiAgIC8vPWZlYXR1cmVJbmRleFxuICogICAvLz1tdWx0aUZlYXR1cmVJbmRleFxuICogICAvLz1nZW9tZXRyeUluZGV4XG4gKiB9KTtcbiAqL1xuZnVuY3Rpb24gbGluZUVhY2goZ2VvanNvbiwgY2FsbGJhY2spIHtcbiAgICAvLyB2YWxpZGF0aW9uXG4gICAgaWYgKCFnZW9qc29uKSB0aHJvdyBuZXcgRXJyb3IoJ2dlb2pzb24gaXMgcmVxdWlyZWQnKTtcblxuICAgIGZsYXR0ZW5FYWNoKGdlb2pzb24sIGZ1bmN0aW9uIChmZWF0dXJlLCBmZWF0dXJlSW5kZXgsIG11bHRpRmVhdHVyZUluZGV4KSB7XG4gICAgICAgIGlmIChmZWF0dXJlLmdlb21ldHJ5ID09PSBudWxsKSByZXR1cm47XG4gICAgICAgIHZhciB0eXBlID0gZmVhdHVyZS5nZW9tZXRyeS50eXBlO1xuICAgICAgICB2YXIgY29vcmRzID0gZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcztcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgJ0xpbmVTdHJpbmcnOlxuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKGZlYXR1cmUsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIDAsIDApID09PSBmYWxzZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1BvbHlnb24nOlxuICAgICAgICAgICAgZm9yICh2YXIgZ2VvbWV0cnlJbmRleCA9IDA7IGdlb21ldHJ5SW5kZXggPCBjb29yZHMubGVuZ3RoOyBnZW9tZXRyeUluZGV4KyspIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2soaGVscGVycy5saW5lU3RyaW5nKGNvb3Jkc1tnZW9tZXRyeUluZGV4XSwgZmVhdHVyZS5wcm9wZXJ0aWVzKSwgZmVhdHVyZUluZGV4LCBtdWx0aUZlYXR1cmVJbmRleCwgZ2VvbWV0cnlJbmRleCkgPT09IGZhbHNlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG4vKipcbiAqIENhbGxiYWNrIGZvciBsaW5lUmVkdWNlXG4gKlxuICogVGhlIGZpcnN0IHRpbWUgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uIGlzIGNhbGxlZCwgdGhlIHZhbHVlcyBwcm92aWRlZCBhcyBhcmd1bWVudHMgZGVwZW5kXG4gKiBvbiB3aGV0aGVyIHRoZSByZWR1Y2UgbWV0aG9kIGhhcyBhbiBpbml0aWFsVmFsdWUgYXJndW1lbnQuXG4gKlxuICogSWYgYW4gaW5pdGlhbFZhbHVlIGlzIHByb3ZpZGVkIHRvIHRoZSByZWR1Y2UgbWV0aG9kOlxuICogIC0gVGhlIHByZXZpb3VzVmFsdWUgYXJndW1lbnQgaXMgaW5pdGlhbFZhbHVlLlxuICogIC0gVGhlIGN1cnJlbnRWYWx1ZSBhcmd1bWVudCBpcyB0aGUgdmFsdWUgb2YgdGhlIGZpcnN0IGVsZW1lbnQgcHJlc2VudCBpbiB0aGUgYXJyYXkuXG4gKlxuICogSWYgYW4gaW5pdGlhbFZhbHVlIGlzIG5vdCBwcm92aWRlZDpcbiAqICAtIFRoZSBwcmV2aW91c1ZhbHVlIGFyZ3VtZW50IGlzIHRoZSB2YWx1ZSBvZiB0aGUgZmlyc3QgZWxlbWVudCBwcmVzZW50IGluIHRoZSBhcnJheS5cbiAqICAtIFRoZSBjdXJyZW50VmFsdWUgYXJndW1lbnQgaXMgdGhlIHZhbHVlIG9mIHRoZSBzZWNvbmQgZWxlbWVudCBwcmVzZW50IGluIHRoZSBhcnJheS5cbiAqXG4gKiBAY2FsbGJhY2sgbGluZVJlZHVjZUNhbGxiYWNrXG4gKiBAcGFyYW0geyp9IHByZXZpb3VzVmFsdWUgVGhlIGFjY3VtdWxhdGVkIHZhbHVlIHByZXZpb3VzbHkgcmV0dXJuZWQgaW4gdGhlIGxhc3QgaW52b2NhdGlvblxuICogb2YgdGhlIGNhbGxiYWNrLCBvciBpbml0aWFsVmFsdWUsIGlmIHN1cHBsaWVkLlxuICogQHBhcmFtIHtGZWF0dXJlPExpbmVTdHJpbmc+fSBjdXJyZW50TGluZSBUaGUgY3VycmVudCBMaW5lU3RyaW5nfExpbmVhclJpbmcgYmVpbmcgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHtudW1iZXJ9IGZlYXR1cmVJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgRmVhdHVyZSBiZWluZyBwcm9jZXNzZWRcbiAqIEBwYXJhbSB7bnVtYmVyfSBtdWx0aUZlYXR1cmVJbmRleCBUaGUgY3VycmVudCBpbmRleCBvZiB0aGUgTXVsdGktRmVhdHVyZSBiZWluZyBwcm9jZXNzZWRcbiAqIEBwYXJhbSB7bnVtYmVyfSBnZW9tZXRyeUluZGV4IFRoZSBjdXJyZW50IGluZGV4IG9mIHRoZSBHZW9tZXRyeSBiZWluZyBwcm9jZXNzZWRcbiAqL1xuXG4vKipcbiAqIFJlZHVjZSBmZWF0dXJlcyBpbiBhbnkgR2VvSlNPTiBvYmplY3QsIHNpbWlsYXIgdG8gQXJyYXkucmVkdWNlKCkuXG4gKlxuICogQG5hbWUgbGluZVJlZHVjZVxuICogQHBhcmFtIHtHZW9tZXRyeXxGZWF0dXJlPExpbmVTdHJpbmd8UG9seWdvbnxNdWx0aUxpbmVTdHJpbmd8TXVsdGlQb2x5Z29uPn0gZ2VvanNvbiBvYmplY3RcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGEgbWV0aG9kIHRoYXQgdGFrZXMgKHByZXZpb3VzVmFsdWUsIGN1cnJlbnRMaW5lLCBmZWF0dXJlSW5kZXgsIG11bHRpRmVhdHVyZUluZGV4LCBnZW9tZXRyeUluZGV4KVxuICogQHBhcmFtIHsqfSBbaW5pdGlhbFZhbHVlXSBWYWx1ZSB0byB1c2UgYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHRvIHRoZSBmaXJzdCBjYWxsIG9mIHRoZSBjYWxsYmFjay5cbiAqIEByZXR1cm5zIHsqfSBUaGUgdmFsdWUgdGhhdCByZXN1bHRzIGZyb20gdGhlIHJlZHVjdGlvbi5cbiAqIEBleGFtcGxlXG4gKiB2YXIgbXVsdGlQb2x5ID0gdHVyZi5tdWx0aVBvbHlnb24oW1xuICogICB0dXJmLnBvbHlnb24oW1tbMTIsNDhdLFsyLDQxXSxbMjQsMzhdLFsxMiw0OF1dLCBbWzksNDRdLFsxMyw0MV0sWzEzLDQ1XSxbOSw0NF1dXSksXG4gKiAgIHR1cmYucG9seWdvbihbW1s1LCA1XSwgWzAsIDBdLCBbMiwgMl0sIFs0LCA0XSwgWzUsIDVdXV0pXG4gKiBdKTtcbiAqXG4gKiB0dXJmLmxpbmVSZWR1Y2UobXVsdGlQb2x5LCBmdW5jdGlvbiAocHJldmlvdXNWYWx1ZSwgY3VycmVudExpbmUsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIGdlb21ldHJ5SW5kZXgpIHtcbiAqICAgLy89cHJldmlvdXNWYWx1ZVxuICogICAvLz1jdXJyZW50TGluZVxuICogICAvLz1mZWF0dXJlSW5kZXhcbiAqICAgLy89bXVsdGlGZWF0dXJlSW5kZXhcbiAqICAgLy89Z2VvbWV0cnlJbmRleFxuICogICByZXR1cm4gY3VycmVudExpbmVcbiAqIH0pO1xuICovXG5mdW5jdGlvbiBsaW5lUmVkdWNlKGdlb2pzb24sIGNhbGxiYWNrLCBpbml0aWFsVmFsdWUpIHtcbiAgICB2YXIgcHJldmlvdXNWYWx1ZSA9IGluaXRpYWxWYWx1ZTtcbiAgICBsaW5lRWFjaChnZW9qc29uLCBmdW5jdGlvbiAoY3VycmVudExpbmUsIGZlYXR1cmVJbmRleCwgbXVsdGlGZWF0dXJlSW5kZXgsIGdlb21ldHJ5SW5kZXgpIHtcbiAgICAgICAgaWYgKGZlYXR1cmVJbmRleCA9PT0gMCAmJiBpbml0aWFsVmFsdWUgPT09IHVuZGVmaW5lZCkgcHJldmlvdXNWYWx1ZSA9IGN1cnJlbnRMaW5lO1xuICAgICAgICBlbHNlIHByZXZpb3VzVmFsdWUgPSBjYWxsYmFjayhwcmV2aW91c1ZhbHVlLCBjdXJyZW50TGluZSwgZmVhdHVyZUluZGV4LCBtdWx0aUZlYXR1cmVJbmRleCwgZ2VvbWV0cnlJbmRleCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHByZXZpb3VzVmFsdWU7XG59XG5cbi8qKlxuICogRmluZHMgYSBwYXJ0aWN1bGFyIDItdmVydGV4IExpbmVTdHJpbmcgU2VnbWVudCBmcm9tIGEgR2VvSlNPTiB1c2luZyBgQHR1cmYvbWV0YWAgaW5kZXhlcy5cbiAqXG4gKiBOZWdhdGl2ZSBpbmRleGVzIGFyZSBwZXJtaXR0ZWQuXG4gKiBQb2ludCAmIE11bHRpUG9pbnQgd2lsbCBhbHdheXMgcmV0dXJuIG51bGwuXG4gKlxuICogQHBhcmFtIHtGZWF0dXJlQ29sbGVjdGlvbnxGZWF0dXJlfEdlb21ldHJ5fSBnZW9qc29uIEFueSBHZW9KU09OIEZlYXR1cmUgb3IgR2VvbWV0cnlcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gT3B0aW9uYWwgcGFyYW1ldGVyc1xuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZlYXR1cmVJbmRleD0wXSBGZWF0dXJlIEluZGV4XG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubXVsdGlGZWF0dXJlSW5kZXg9MF0gTXVsdGktRmVhdHVyZSBJbmRleFxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmdlb21ldHJ5SW5kZXg9MF0gR2VvbWV0cnkgSW5kZXhcbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zZWdtZW50SW5kZXg9MF0gU2VnbWVudCBJbmRleFxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnByb3BlcnRpZXM9e31dIFRyYW5zbGF0ZSBQcm9wZXJ0aWVzIHRvIG91dHB1dCBMaW5lU3RyaW5nXG4gKiBAcGFyYW0ge0JCb3h9IFtvcHRpb25zLmJib3g9e31dIFRyYW5zbGF0ZSBCQm94IHRvIG91dHB1dCBMaW5lU3RyaW5nXG4gKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IFtvcHRpb25zLmlkPXt9XSBUcmFuc2xhdGUgSWQgdG8gb3V0cHV0IExpbmVTdHJpbmdcbiAqIEByZXR1cm5zIHtGZWF0dXJlPExpbmVTdHJpbmc+fSAyLXZlcnRleCBHZW9KU09OIEZlYXR1cmUgTGluZVN0cmluZ1xuICogQGV4YW1wbGVcbiAqIHZhciBtdWx0aUxpbmUgPSB0dXJmLm11bHRpTGluZVN0cmluZyhbXG4gKiAgICAgW1sxMCwgMTBdLCBbNTAsIDMwXSwgWzMwLCA0MF1dLFxuICogICAgIFtbLTEwLCAtMTBdLCBbLTUwLCAtMzBdLCBbLTMwLCAtNDBdXVxuICogXSk7XG4gKlxuICogLy8gRmlyc3QgU2VnbWVudCAoZGVmYXVsdHMgYXJlIDApXG4gKiB0dXJmLmZpbmRTZWdtZW50KG11bHRpTGluZSk7XG4gKiAvLyA9PiBGZWF0dXJlPExpbmVTdHJpbmc8W1sxMCwgMTBdLCBbNTAsIDMwXV0+PlxuICpcbiAqIC8vIEZpcnN0IFNlZ21lbnQgb2YgMm5kIE11bHRpIEZlYXR1cmVcbiAqIHR1cmYuZmluZFNlZ21lbnQobXVsdGlMaW5lLCB7bXVsdGlGZWF0dXJlSW5kZXg6IDF9KTtcbiAqIC8vID0+IEZlYXR1cmU8TGluZVN0cmluZzxbWy0xMCwgLTEwXSwgWy01MCwgLTMwXV0+PlxuICpcbiAqIC8vIExhc3QgU2VnbWVudCBvZiBMYXN0IE11bHRpIEZlYXR1cmVcbiAqIHR1cmYuZmluZFNlZ21lbnQobXVsdGlMaW5lLCB7bXVsdGlGZWF0dXJlSW5kZXg6IC0xLCBzZWdtZW50SW5kZXg6IC0xfSk7XG4gKiAvLyA9PiBGZWF0dXJlPExpbmVTdHJpbmc8W1stNTAsIC0zMF0sIFstMzAsIC00MF1dPj5cbiAqL1xuZnVuY3Rpb24gZmluZFNlZ21lbnQoZ2VvanNvbiwgb3B0aW9ucykge1xuICAgIC8vIE9wdGlvbmFsIFBhcmFtZXRlcnNcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICBpZiAoIWhlbHBlcnMuaXNPYmplY3Qob3B0aW9ucykpIHRocm93IG5ldyBFcnJvcignb3B0aW9ucyBpcyBpbnZhbGlkJyk7XG4gICAgdmFyIGZlYXR1cmVJbmRleCA9IG9wdGlvbnMuZmVhdHVyZUluZGV4IHx8IDA7XG4gICAgdmFyIG11bHRpRmVhdHVyZUluZGV4ID0gb3B0aW9ucy5tdWx0aUZlYXR1cmVJbmRleCB8fCAwO1xuICAgIHZhciBnZW9tZXRyeUluZGV4ID0gb3B0aW9ucy5nZW9tZXRyeUluZGV4IHx8IDA7XG4gICAgdmFyIHNlZ21lbnRJbmRleCA9IG9wdGlvbnMuc2VnbWVudEluZGV4IHx8IDA7XG5cbiAgICAvLyBGaW5kIEZlYXR1cmVJbmRleFxuICAgIHZhciBwcm9wZXJ0aWVzID0gb3B0aW9ucy5wcm9wZXJ0aWVzO1xuICAgIHZhciBnZW9tZXRyeTtcblxuICAgIHN3aXRjaCAoZ2VvanNvbi50eXBlKSB7XG4gICAgY2FzZSAnRmVhdHVyZUNvbGxlY3Rpb24nOlxuICAgICAgICBpZiAoZmVhdHVyZUluZGV4IDwgMCkgZmVhdHVyZUluZGV4ID0gZ2VvanNvbi5mZWF0dXJlcy5sZW5ndGggKyBmZWF0dXJlSW5kZXg7XG4gICAgICAgIHByb3BlcnRpZXMgPSBwcm9wZXJ0aWVzIHx8IGdlb2pzb24uZmVhdHVyZXNbZmVhdHVyZUluZGV4XS5wcm9wZXJ0aWVzO1xuICAgICAgICBnZW9tZXRyeSA9IGdlb2pzb24uZmVhdHVyZXNbZmVhdHVyZUluZGV4XS5nZW9tZXRyeTtcbiAgICAgICAgYnJlYWs7XG4gICAgY2FzZSAnRmVhdHVyZSc6XG4gICAgICAgIHByb3BlcnRpZXMgPSBwcm9wZXJ0aWVzIHx8IGdlb2pzb24ucHJvcGVydGllcztcbiAgICAgICAgZ2VvbWV0cnkgPSBnZW9qc29uLmdlb21ldHJ5O1xuICAgICAgICBicmVhaztcbiAgICBjYXNlICdQb2ludCc6XG4gICAgY2FzZSAnTXVsdGlQb2ludCc6XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIGNhc2UgJ0xpbmVTdHJpbmcnOlxuICAgIGNhc2UgJ1BvbHlnb24nOlxuICAgIGNhc2UgJ011bHRpTGluZVN0cmluZyc6XG4gICAgY2FzZSAnTXVsdGlQb2x5Z29uJzpcbiAgICAgICAgZ2VvbWV0cnkgPSBnZW9qc29uO1xuICAgICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2dlb2pzb24gaXMgaW52YWxpZCcpO1xuICAgIH1cblxuICAgIC8vIEZpbmQgU2VnbWVudEluZGV4XG4gICAgaWYgKGdlb21ldHJ5ID09PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgICB2YXIgY29vcmRzID0gZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG4gICAgc3dpdGNoIChnZW9tZXRyeS50eXBlKSB7XG4gICAgY2FzZSAnUG9pbnQnOlxuICAgIGNhc2UgJ011bHRpUG9pbnQnOlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICBjYXNlICdMaW5lU3RyaW5nJzpcbiAgICAgICAgaWYgKHNlZ21lbnRJbmRleCA8IDApIHNlZ21lbnRJbmRleCA9IGNvb3Jkcy5sZW5ndGggKyBzZWdtZW50SW5kZXggLSAxO1xuICAgICAgICByZXR1cm4gaGVscGVycy5saW5lU3RyaW5nKFtjb29yZHNbc2VnbWVudEluZGV4XSwgY29vcmRzW3NlZ21lbnRJbmRleCArIDFdXSwgcHJvcGVydGllcywgb3B0aW9ucyk7XG4gICAgY2FzZSAnUG9seWdvbic6XG4gICAgICAgIGlmIChnZW9tZXRyeUluZGV4IDwgMCkgZ2VvbWV0cnlJbmRleCA9IGNvb3Jkcy5sZW5ndGggKyBnZW9tZXRyeUluZGV4O1xuICAgICAgICBpZiAoc2VnbWVudEluZGV4IDwgMCkgc2VnbWVudEluZGV4ID0gY29vcmRzW2dlb21ldHJ5SW5kZXhdLmxlbmd0aCArIHNlZ21lbnRJbmRleCAtIDE7XG4gICAgICAgIHJldHVybiBoZWxwZXJzLmxpbmVTdHJpbmcoW2Nvb3Jkc1tnZW9tZXRyeUluZGV4XVtzZWdtZW50SW5kZXhdLCBjb29yZHNbZ2VvbWV0cnlJbmRleF1bc2VnbWVudEluZGV4ICsgMV1dLCBwcm9wZXJ0aWVzLCBvcHRpb25zKTtcbiAgICBjYXNlICdNdWx0aUxpbmVTdHJpbmcnOlxuICAgICAgICBpZiAobXVsdGlGZWF0dXJlSW5kZXggPCAwKSBtdWx0aUZlYXR1cmVJbmRleCA9IGNvb3Jkcy5sZW5ndGggKyBtdWx0aUZlYXR1cmVJbmRleDtcbiAgICAgICAgaWYgKHNlZ21lbnRJbmRleCA8IDApIHNlZ21lbnRJbmRleCA9IGNvb3Jkc1ttdWx0aUZlYXR1cmVJbmRleF0ubGVuZ3RoICsgc2VnbWVudEluZGV4IC0gMTtcbiAgICAgICAgcmV0dXJuIGhlbHBlcnMubGluZVN0cmluZyhbY29vcmRzW211bHRpRmVhdHVyZUluZGV4XVtzZWdtZW50SW5kZXhdLCBjb29yZHNbbXVsdGlGZWF0dXJlSW5kZXhdW3NlZ21lbnRJbmRleCArIDFdXSwgcHJvcGVydGllcywgb3B0aW9ucyk7XG4gICAgY2FzZSAnTXVsdGlQb2x5Z29uJzpcbiAgICAgICAgaWYgKG11bHRpRmVhdHVyZUluZGV4IDwgMCkgbXVsdGlGZWF0dXJlSW5kZXggPSBjb29yZHMubGVuZ3RoICsgbXVsdGlGZWF0dXJlSW5kZXg7XG4gICAgICAgIGlmIChnZW9tZXRyeUluZGV4IDwgMCkgZ2VvbWV0cnlJbmRleCA9IGNvb3Jkc1ttdWx0aUZlYXR1cmVJbmRleF0ubGVuZ3RoICsgZ2VvbWV0cnlJbmRleDtcbiAgICAgICAgaWYgKHNlZ21lbnRJbmRleCA8IDApIHNlZ21lbnRJbmRleCA9IGNvb3Jkc1ttdWx0aUZlYXR1cmVJbmRleF1bZ2VvbWV0cnlJbmRleF0ubGVuZ3RoIC0gc2VnbWVudEluZGV4IC0gMTtcbiAgICAgICAgcmV0dXJuIGhlbHBlcnMubGluZVN0cmluZyhbY29vcmRzW211bHRpRmVhdHVyZUluZGV4XVtnZW9tZXRyeUluZGV4XVtzZWdtZW50SW5kZXhdLCBjb29yZHNbbXVsdGlGZWF0dXJlSW5kZXhdW2dlb21ldHJ5SW5kZXhdW3NlZ21lbnRJbmRleCArIDFdXSwgcHJvcGVydGllcywgb3B0aW9ucyk7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcignZ2VvanNvbiBpcyBpbnZhbGlkJyk7XG59XG5cbi8qKlxuICogRmluZHMgYSBwYXJ0aWN1bGFyIFBvaW50IGZyb20gYSBHZW9KU09OIHVzaW5nIGBAdHVyZi9tZXRhYCBpbmRleGVzLlxuICpcbiAqIE5lZ2F0aXZlIGluZGV4ZXMgYXJlIHBlcm1pdHRlZC5cbiAqXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufEZlYXR1cmV8R2VvbWV0cnl9IGdlb2pzb24gQW55IEdlb0pTT04gRmVhdHVyZSBvciBHZW9tZXRyeVxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBPcHRpb25hbCBwYXJhbWV0ZXJzXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZmVhdHVyZUluZGV4PTBdIEZlYXR1cmUgSW5kZXhcbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tdWx0aUZlYXR1cmVJbmRleD0wXSBNdWx0aS1GZWF0dXJlIEluZGV4XG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZ2VvbWV0cnlJbmRleD0wXSBHZW9tZXRyeSBJbmRleFxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmNvb3JkSW5kZXg9MF0gQ29vcmQgSW5kZXhcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5wcm9wZXJ0aWVzPXt9XSBUcmFuc2xhdGUgUHJvcGVydGllcyB0byBvdXRwdXQgUG9pbnRcbiAqIEBwYXJhbSB7QkJveH0gW29wdGlvbnMuYmJveD17fV0gVHJhbnNsYXRlIEJCb3ggdG8gb3V0cHV0IFBvaW50XG4gKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IFtvcHRpb25zLmlkPXt9XSBUcmFuc2xhdGUgSWQgdG8gb3V0cHV0IFBvaW50XG4gKiBAcmV0dXJucyB7RmVhdHVyZTxQb2ludD59IDItdmVydGV4IEdlb0pTT04gRmVhdHVyZSBQb2ludFxuICogQGV4YW1wbGVcbiAqIHZhciBtdWx0aUxpbmUgPSB0dXJmLm11bHRpTGluZVN0cmluZyhbXG4gKiAgICAgW1sxMCwgMTBdLCBbNTAsIDMwXSwgWzMwLCA0MF1dLFxuICogICAgIFtbLTEwLCAtMTBdLCBbLTUwLCAtMzBdLCBbLTMwLCAtNDBdXVxuICogXSk7XG4gKlxuICogLy8gRmlyc3QgU2VnbWVudCAoZGVmYXVsdHMgYXJlIDApXG4gKiB0dXJmLmZpbmRQb2ludChtdWx0aUxpbmUpO1xuICogLy8gPT4gRmVhdHVyZTxQb2ludDxbMTAsIDEwXT4+XG4gKlxuICogLy8gRmlyc3QgU2VnbWVudCBvZiB0aGUgMm5kIE11bHRpLUZlYXR1cmVcbiAqIHR1cmYuZmluZFBvaW50KG11bHRpTGluZSwge211bHRpRmVhdHVyZUluZGV4OiAxfSk7XG4gKiAvLyA9PiBGZWF0dXJlPFBvaW50PFstMTAsIC0xMF0+PlxuICpcbiAqIC8vIExhc3QgU2VnbWVudCBvZiBsYXN0IE11bHRpLUZlYXR1cmVcbiAqIHR1cmYuZmluZFBvaW50KG11bHRpTGluZSwge211bHRpRmVhdHVyZUluZGV4OiAtMSwgY29vcmRJbmRleDogLTF9KTtcbiAqIC8vID0+IEZlYXR1cmU8UG9pbnQ8Wy0zMCwgLTQwXT4+XG4gKi9cbmZ1bmN0aW9uIGZpbmRQb2ludChnZW9qc29uLCBvcHRpb25zKSB7XG4gICAgLy8gT3B0aW9uYWwgUGFyYW1ldGVyc1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIGlmICghaGVscGVycy5pc09iamVjdChvcHRpb25zKSkgdGhyb3cgbmV3IEVycm9yKCdvcHRpb25zIGlzIGludmFsaWQnKTtcbiAgICB2YXIgZmVhdHVyZUluZGV4ID0gb3B0aW9ucy5mZWF0dXJlSW5kZXggfHwgMDtcbiAgICB2YXIgbXVsdGlGZWF0dXJlSW5kZXggPSBvcHRpb25zLm11bHRpRmVhdHVyZUluZGV4IHx8IDA7XG4gICAgdmFyIGdlb21ldHJ5SW5kZXggPSBvcHRpb25zLmdlb21ldHJ5SW5kZXggfHwgMDtcbiAgICB2YXIgY29vcmRJbmRleCA9IG9wdGlvbnMuY29vcmRJbmRleCB8fCAwO1xuXG4gICAgLy8gRmluZCBGZWF0dXJlSW5kZXhcbiAgICB2YXIgcHJvcGVydGllcyA9IG9wdGlvbnMucHJvcGVydGllcztcbiAgICB2YXIgZ2VvbWV0cnk7XG5cbiAgICBzd2l0Y2ggKGdlb2pzb24udHlwZSkge1xuICAgIGNhc2UgJ0ZlYXR1cmVDb2xsZWN0aW9uJzpcbiAgICAgICAgaWYgKGZlYXR1cmVJbmRleCA8IDApIGZlYXR1cmVJbmRleCA9IGdlb2pzb24uZmVhdHVyZXMubGVuZ3RoICsgZmVhdHVyZUluZGV4O1xuICAgICAgICBwcm9wZXJ0aWVzID0gcHJvcGVydGllcyB8fCBnZW9qc29uLmZlYXR1cmVzW2ZlYXR1cmVJbmRleF0ucHJvcGVydGllcztcbiAgICAgICAgZ2VvbWV0cnkgPSBnZW9qc29uLmZlYXR1cmVzW2ZlYXR1cmVJbmRleF0uZ2VvbWV0cnk7XG4gICAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0ZlYXR1cmUnOlxuICAgICAgICBwcm9wZXJ0aWVzID0gcHJvcGVydGllcyB8fCBnZW9qc29uLnByb3BlcnRpZXM7XG4gICAgICAgIGdlb21ldHJ5ID0gZ2VvanNvbi5nZW9tZXRyeTtcbiAgICAgICAgYnJlYWs7XG4gICAgY2FzZSAnUG9pbnQnOlxuICAgIGNhc2UgJ011bHRpUG9pbnQnOlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICBjYXNlICdMaW5lU3RyaW5nJzpcbiAgICBjYXNlICdQb2x5Z29uJzpcbiAgICBjYXNlICdNdWx0aUxpbmVTdHJpbmcnOlxuICAgIGNhc2UgJ011bHRpUG9seWdvbic6XG4gICAgICAgIGdlb21ldHJ5ID0gZ2VvanNvbjtcbiAgICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdnZW9qc29uIGlzIGludmFsaWQnKTtcbiAgICB9XG5cbiAgICAvLyBGaW5kIENvb3JkIEluZGV4XG4gICAgaWYgKGdlb21ldHJ5ID09PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgICB2YXIgY29vcmRzID0gZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG4gICAgc3dpdGNoIChnZW9tZXRyeS50eXBlKSB7XG4gICAgY2FzZSAnUG9pbnQnOlxuICAgICAgICByZXR1cm4gaGVscGVycy5wb2ludChjb29yZHMsIHByb3BlcnRpZXMsIG9wdGlvbnMpO1xuICAgIGNhc2UgJ011bHRpUG9pbnQnOlxuICAgICAgICBpZiAobXVsdGlGZWF0dXJlSW5kZXggPCAwKSBtdWx0aUZlYXR1cmVJbmRleCA9IGNvb3Jkcy5sZW5ndGggKyBtdWx0aUZlYXR1cmVJbmRleDtcbiAgICAgICAgcmV0dXJuIGhlbHBlcnMucG9pbnQoY29vcmRzW211bHRpRmVhdHVyZUluZGV4XSwgcHJvcGVydGllcywgb3B0aW9ucyk7XG4gICAgY2FzZSAnTGluZVN0cmluZyc6XG4gICAgICAgIGlmIChjb29yZEluZGV4IDwgMCkgY29vcmRJbmRleCA9IGNvb3Jkcy5sZW5ndGggKyBjb29yZEluZGV4O1xuICAgICAgICByZXR1cm4gaGVscGVycy5wb2ludChjb29yZHNbY29vcmRJbmRleF0sIHByb3BlcnRpZXMsIG9wdGlvbnMpO1xuICAgIGNhc2UgJ1BvbHlnb24nOlxuICAgICAgICBpZiAoZ2VvbWV0cnlJbmRleCA8IDApIGdlb21ldHJ5SW5kZXggPSBjb29yZHMubGVuZ3RoICsgZ2VvbWV0cnlJbmRleDtcbiAgICAgICAgaWYgKGNvb3JkSW5kZXggPCAwKSBjb29yZEluZGV4ID0gY29vcmRzW2dlb21ldHJ5SW5kZXhdLmxlbmd0aCArIGNvb3JkSW5kZXg7XG4gICAgICAgIHJldHVybiBoZWxwZXJzLnBvaW50KGNvb3Jkc1tnZW9tZXRyeUluZGV4XVtjb29yZEluZGV4XSwgcHJvcGVydGllcywgb3B0aW9ucyk7XG4gICAgY2FzZSAnTXVsdGlMaW5lU3RyaW5nJzpcbiAgICAgICAgaWYgKG11bHRpRmVhdHVyZUluZGV4IDwgMCkgbXVsdGlGZWF0dXJlSW5kZXggPSBjb29yZHMubGVuZ3RoICsgbXVsdGlGZWF0dXJlSW5kZXg7XG4gICAgICAgIGlmIChjb29yZEluZGV4IDwgMCkgY29vcmRJbmRleCA9IGNvb3Jkc1ttdWx0aUZlYXR1cmVJbmRleF0ubGVuZ3RoICsgY29vcmRJbmRleDtcbiAgICAgICAgcmV0dXJuIGhlbHBlcnMucG9pbnQoY29vcmRzW211bHRpRmVhdHVyZUluZGV4XVtjb29yZEluZGV4XSwgcHJvcGVydGllcywgb3B0aW9ucyk7XG4gICAgY2FzZSAnTXVsdGlQb2x5Z29uJzpcbiAgICAgICAgaWYgKG11bHRpRmVhdHVyZUluZGV4IDwgMCkgbXVsdGlGZWF0dXJlSW5kZXggPSBjb29yZHMubGVuZ3RoICsgbXVsdGlGZWF0dXJlSW5kZXg7XG4gICAgICAgIGlmIChnZW9tZXRyeUluZGV4IDwgMCkgZ2VvbWV0cnlJbmRleCA9IGNvb3Jkc1ttdWx0aUZlYXR1cmVJbmRleF0ubGVuZ3RoICsgZ2VvbWV0cnlJbmRleDtcbiAgICAgICAgaWYgKGNvb3JkSW5kZXggPCAwKSBjb29yZEluZGV4ID0gY29vcmRzW211bHRpRmVhdHVyZUluZGV4XVtnZW9tZXRyeUluZGV4XS5sZW5ndGggLSBjb29yZEluZGV4O1xuICAgICAgICByZXR1cm4gaGVscGVycy5wb2ludChjb29yZHNbbXVsdGlGZWF0dXJlSW5kZXhdW2dlb21ldHJ5SW5kZXhdW2Nvb3JkSW5kZXhdLCBwcm9wZXJ0aWVzLCBvcHRpb25zKTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKCdnZW9qc29uIGlzIGludmFsaWQnKTtcbn1cblxuZXhwb3J0cy5jb29yZEVhY2ggPSBjb29yZEVhY2g7XG5leHBvcnRzLmNvb3JkUmVkdWNlID0gY29vcmRSZWR1Y2U7XG5leHBvcnRzLnByb3BFYWNoID0gcHJvcEVhY2g7XG5leHBvcnRzLnByb3BSZWR1Y2UgPSBwcm9wUmVkdWNlO1xuZXhwb3J0cy5mZWF0dXJlRWFjaCA9IGZlYXR1cmVFYWNoO1xuZXhwb3J0cy5mZWF0dXJlUmVkdWNlID0gZmVhdHVyZVJlZHVjZTtcbmV4cG9ydHMuY29vcmRBbGwgPSBjb29yZEFsbDtcbmV4cG9ydHMuZ2VvbUVhY2ggPSBnZW9tRWFjaDtcbmV4cG9ydHMuZ2VvbVJlZHVjZSA9IGdlb21SZWR1Y2U7XG5leHBvcnRzLmZsYXR0ZW5FYWNoID0gZmxhdHRlbkVhY2g7XG5leHBvcnRzLmZsYXR0ZW5SZWR1Y2UgPSBmbGF0dGVuUmVkdWNlO1xuZXhwb3J0cy5zZWdtZW50RWFjaCA9IHNlZ21lbnRFYWNoO1xuZXhwb3J0cy5zZWdtZW50UmVkdWNlID0gc2VnbWVudFJlZHVjZTtcbmV4cG9ydHMubGluZUVhY2ggPSBsaW5lRWFjaDtcbmV4cG9ydHMubGluZVJlZHVjZSA9IGxpbmVSZWR1Y2U7XG5leHBvcnRzLmZpbmRTZWdtZW50ID0gZmluZFNlZ21lbnQ7XG5leHBvcnRzLmZpbmRQb2ludCA9IGZpbmRQb2ludDtcbiIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xudmFyIGJlYXJpbmdfMSA9IHJlcXVpcmUoXCJAdHVyZi9iZWFyaW5nXCIpO1xudmFyIGRpc3RhbmNlXzEgPSByZXF1aXJlKFwiQHR1cmYvZGlzdGFuY2VcIik7XG52YXIgZGVzdGluYXRpb25fMSA9IHJlcXVpcmUoXCJAdHVyZi9kZXN0aW5hdGlvblwiKTtcbnZhciBsaW5lX2ludGVyc2VjdF8xID0gcmVxdWlyZShcIkB0dXJmL2xpbmUtaW50ZXJzZWN0XCIpO1xudmFyIG1ldGFfMSA9IHJlcXVpcmUoXCJAdHVyZi9tZXRhXCIpO1xudmFyIGhlbHBlcnNfMSA9IHJlcXVpcmUoXCJAdHVyZi9oZWxwZXJzXCIpO1xudmFyIGludmFyaWFudF8xID0gcmVxdWlyZShcIkB0dXJmL2ludmFyaWFudFwiKTtcbi8qKlxuICogVGFrZXMgYSB7QGxpbmsgUG9pbnR9IGFuZCBhIHtAbGluayBMaW5lU3RyaW5nfSBhbmQgY2FsY3VsYXRlcyB0aGUgY2xvc2VzdCBQb2ludCBvbiB0aGUgKE11bHRpKUxpbmVTdHJpbmcuXG4gKlxuICogQG5hbWUgbmVhcmVzdFBvaW50T25MaW5lXG4gKiBAcGFyYW0ge0dlb21ldHJ5fEZlYXR1cmU8TGluZVN0cmluZ3xNdWx0aUxpbmVTdHJpbmc+fSBsaW5lcyBsaW5lcyB0byBzbmFwIHRvXG4gKiBAcGFyYW0ge0dlb21ldHJ5fEZlYXR1cmU8UG9pbnQ+fG51bWJlcltdfSBwdCBwb2ludCB0byBzbmFwIGZyb21cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gT3B0aW9uYWwgcGFyYW1ldGVyc1xuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnVuaXRzPSdraWxvbWV0ZXJzJ10gY2FuIGJlIGRlZ3JlZXMsIHJhZGlhbnMsIG1pbGVzLCBvciBraWxvbWV0ZXJzXG4gKiBAcmV0dXJucyB7RmVhdHVyZTxQb2ludD59IGNsb3Nlc3QgcG9pbnQgb24gdGhlIGBsaW5lYCB0byBgcG9pbnRgLiBUaGUgcHJvcGVydGllcyBvYmplY3Qgd2lsbCBjb250YWluIHRocmVlIHZhbHVlczogYGluZGV4YDogY2xvc2VzdCBwb2ludCB3YXMgZm91bmQgb24gbnRoIGxpbmUgcGFydCwgYGRpc3RgOiBkaXN0YW5jZSBiZXR3ZWVuIHB0IGFuZCB0aGUgY2xvc2VzdCBwb2ludCwgYGxvY2F0aW9uYDogZGlzdGFuY2UgYWxvbmcgdGhlIGxpbmUgYmV0d2VlbiBzdGFydCBhbmQgdGhlIGNsb3Nlc3QgcG9pbnQuXG4gKiBAZXhhbXBsZVxuICogdmFyIGxpbmUgPSB0dXJmLmxpbmVTdHJpbmcoW1xuICogICAgIFstNzcuMDMxNjY5LCAzOC44Nzg2MDVdLFxuICogICAgIFstNzcuMDI5NjA5LCAzOC44ODE5NDZdLFxuICogICAgIFstNzcuMDIwMzM5LCAzOC44ODQwODRdLFxuICogICAgIFstNzcuMDI1NjYxLCAzOC44ODU4MjFdLFxuICogICAgIFstNzcuMDIxODg0LCAzOC44ODk1NjNdLFxuICogICAgIFstNzcuMDE5ODI0LCAzOC44OTIzNjhdXG4gKiBdKTtcbiAqIHZhciBwdCA9IHR1cmYucG9pbnQoWy03Ny4wMzcwNzYsIDM4Ljg4NDAxN10pO1xuICpcbiAqIHZhciBzbmFwcGVkID0gdHVyZi5uZWFyZXN0UG9pbnRPbkxpbmUobGluZSwgcHQsIHt1bml0czogJ21pbGVzJ30pO1xuICpcbiAqIC8vYWRkVG9NYXBcbiAqIHZhciBhZGRUb01hcCA9IFtsaW5lLCBwdCwgc25hcHBlZF07XG4gKiBzbmFwcGVkLnByb3BlcnRpZXNbJ21hcmtlci1jb2xvciddID0gJyMwMGYnO1xuICovXG5mdW5jdGlvbiBuZWFyZXN0UG9pbnRPbkxpbmUobGluZXMsIHB0LCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgPT09IHZvaWQgMCkgeyBvcHRpb25zID0ge307IH1cbiAgICB2YXIgY2xvc2VzdFB0ID0gaGVscGVyc18xLnBvaW50KFtJbmZpbml0eSwgSW5maW5pdHldLCB7XG4gICAgICAgIGRpc3Q6IEluZmluaXR5XG4gICAgfSk7XG4gICAgdmFyIGxlbmd0aCA9IDAuMDtcbiAgICBtZXRhXzEuZmxhdHRlbkVhY2gobGluZXMsIGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgICAgIHZhciBjb29yZHMgPSBpbnZhcmlhbnRfMS5nZXRDb29yZHMobGluZSk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29vcmRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgLy9zdGFydFxuICAgICAgICAgICAgdmFyIHN0YXJ0ID0gaGVscGVyc18xLnBvaW50KGNvb3Jkc1tpXSk7XG4gICAgICAgICAgICBzdGFydC5wcm9wZXJ0aWVzLmRpc3QgPSBkaXN0YW5jZV8xLmRlZmF1bHQocHQsIHN0YXJ0LCBvcHRpb25zKTtcbiAgICAgICAgICAgIC8vc3RvcFxuICAgICAgICAgICAgdmFyIHN0b3BfMSA9IGhlbHBlcnNfMS5wb2ludChjb29yZHNbaSArIDFdKTtcbiAgICAgICAgICAgIHN0b3BfMS5wcm9wZXJ0aWVzLmRpc3QgPSBkaXN0YW5jZV8xLmRlZmF1bHQocHQsIHN0b3BfMSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAvLyBzZWN0aW9uTGVuZ3RoXG4gICAgICAgICAgICB2YXIgc2VjdGlvbkxlbmd0aCA9IGRpc3RhbmNlXzEuZGVmYXVsdChzdGFydCwgc3RvcF8xLCBvcHRpb25zKTtcbiAgICAgICAgICAgIC8vcGVycGVuZGljdWxhclxuICAgICAgICAgICAgdmFyIGhlaWdodERpc3RhbmNlID0gTWF0aC5tYXgoc3RhcnQucHJvcGVydGllcy5kaXN0LCBzdG9wXzEucHJvcGVydGllcy5kaXN0KTtcbiAgICAgICAgICAgIHZhciBkaXJlY3Rpb24gPSBiZWFyaW5nXzEuZGVmYXVsdChzdGFydCwgc3RvcF8xKTtcbiAgICAgICAgICAgIHZhciBwZXJwZW5kaWN1bGFyUHQxID0gZGVzdGluYXRpb25fMS5kZWZhdWx0KHB0LCBoZWlnaHREaXN0YW5jZSwgZGlyZWN0aW9uICsgOTAsIG9wdGlvbnMpO1xuICAgICAgICAgICAgdmFyIHBlcnBlbmRpY3VsYXJQdDIgPSBkZXN0aW5hdGlvbl8xLmRlZmF1bHQocHQsIGhlaWdodERpc3RhbmNlLCBkaXJlY3Rpb24gLSA5MCwgb3B0aW9ucyk7XG4gICAgICAgICAgICB2YXIgaW50ZXJzZWN0ID0gbGluZV9pbnRlcnNlY3RfMS5kZWZhdWx0KGhlbHBlcnNfMS5saW5lU3RyaW5nKFtwZXJwZW5kaWN1bGFyUHQxLmdlb21ldHJ5LmNvb3JkaW5hdGVzLCBwZXJwZW5kaWN1bGFyUHQyLmdlb21ldHJ5LmNvb3JkaW5hdGVzXSksIGhlbHBlcnNfMS5saW5lU3RyaW5nKFtzdGFydC5nZW9tZXRyeS5jb29yZGluYXRlcywgc3RvcF8xLmdlb21ldHJ5LmNvb3JkaW5hdGVzXSkpO1xuICAgICAgICAgICAgdmFyIGludGVyc2VjdFB0ID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChpbnRlcnNlY3QuZmVhdHVyZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGludGVyc2VjdFB0ID0gaW50ZXJzZWN0LmZlYXR1cmVzWzBdO1xuICAgICAgICAgICAgICAgIGludGVyc2VjdFB0LnByb3BlcnRpZXMuZGlzdCA9IGRpc3RhbmNlXzEuZGVmYXVsdChwdCwgaW50ZXJzZWN0UHQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGludGVyc2VjdFB0LnByb3BlcnRpZXMubG9jYXRpb24gPSBsZW5ndGggKyBkaXN0YW5jZV8xLmRlZmF1bHQoc3RhcnQsIGludGVyc2VjdFB0LCBvcHRpb25zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdGFydC5wcm9wZXJ0aWVzLmRpc3QgPCBjbG9zZXN0UHQucHJvcGVydGllcy5kaXN0KSB7XG4gICAgICAgICAgICAgICAgY2xvc2VzdFB0ID0gc3RhcnQ7XG4gICAgICAgICAgICAgICAgY2xvc2VzdFB0LnByb3BlcnRpZXMuaW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIGNsb3Nlc3RQdC5wcm9wZXJ0aWVzLmxvY2F0aW9uID0gbGVuZ3RoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0b3BfMS5wcm9wZXJ0aWVzLmRpc3QgPCBjbG9zZXN0UHQucHJvcGVydGllcy5kaXN0KSB7XG4gICAgICAgICAgICAgICAgY2xvc2VzdFB0ID0gc3RvcF8xO1xuICAgICAgICAgICAgICAgIGNsb3Nlc3RQdC5wcm9wZXJ0aWVzLmluZGV4ID0gaSArIDE7XG4gICAgICAgICAgICAgICAgY2xvc2VzdFB0LnByb3BlcnRpZXMubG9jYXRpb24gPSBsZW5ndGggKyBzZWN0aW9uTGVuZ3RoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGludGVyc2VjdFB0ICYmIGludGVyc2VjdFB0LnByb3BlcnRpZXMuZGlzdCA8IGNsb3Nlc3RQdC5wcm9wZXJ0aWVzLmRpc3QpIHtcbiAgICAgICAgICAgICAgICBjbG9zZXN0UHQgPSBpbnRlcnNlY3RQdDtcbiAgICAgICAgICAgICAgICBjbG9zZXN0UHQucHJvcGVydGllcy5pbmRleCA9IGk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB1cGRhdGUgbGVuZ3RoXG4gICAgICAgICAgICBsZW5ndGggKz0gc2VjdGlvbkxlbmd0aDtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBjbG9zZXN0UHQ7XG59XG5leHBvcnRzLmRlZmF1bHQgPSBuZWFyZXN0UG9pbnRPbkxpbmU7XG4iLCJ2YXIgd2dzODQgPSByZXF1aXJlKCd3Z3M4NCcpO1xuXG5tb2R1bGUuZXhwb3J0cy5nZW9tZXRyeSA9IGdlb21ldHJ5O1xubW9kdWxlLmV4cG9ydHMucmluZyA9IHJpbmdBcmVhO1xuXG5mdW5jdGlvbiBnZW9tZXRyeShfKSB7XG4gICAgdmFyIGFyZWEgPSAwLCBpO1xuICAgIHN3aXRjaCAoXy50eXBlKSB7XG4gICAgICAgIGNhc2UgJ1BvbHlnb24nOlxuICAgICAgICAgICAgcmV0dXJuIHBvbHlnb25BcmVhKF8uY29vcmRpbmF0ZXMpO1xuICAgICAgICBjYXNlICdNdWx0aVBvbHlnb24nOlxuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IF8uY29vcmRpbmF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBhcmVhICs9IHBvbHlnb25BcmVhKF8uY29vcmRpbmF0ZXNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGFyZWE7XG4gICAgICAgIGNhc2UgJ1BvaW50JzpcbiAgICAgICAgY2FzZSAnTXVsdGlQb2ludCc6XG4gICAgICAgIGNhc2UgJ0xpbmVTdHJpbmcnOlxuICAgICAgICBjYXNlICdNdWx0aUxpbmVTdHJpbmcnOlxuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIGNhc2UgJ0dlb21ldHJ5Q29sbGVjdGlvbic6XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgXy5nZW9tZXRyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYXJlYSArPSBnZW9tZXRyeShfLmdlb21ldHJpZXNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGFyZWE7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwb2x5Z29uQXJlYShjb29yZHMpIHtcbiAgICB2YXIgYXJlYSA9IDA7XG4gICAgaWYgKGNvb3JkcyAmJiBjb29yZHMubGVuZ3RoID4gMCkge1xuICAgICAgICBhcmVhICs9IE1hdGguYWJzKHJpbmdBcmVhKGNvb3Jkc1swXSkpO1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGNvb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJlYSAtPSBNYXRoLmFicyhyaW5nQXJlYShjb29yZHNbaV0pKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXJlYTtcbn1cblxuLyoqXG4gKiBDYWxjdWxhdGUgdGhlIGFwcHJveGltYXRlIGFyZWEgb2YgdGhlIHBvbHlnb24gd2VyZSBpdCBwcm9qZWN0ZWQgb250b1xuICogICAgIHRoZSBlYXJ0aC4gIE5vdGUgdGhhdCB0aGlzIGFyZWEgd2lsbCBiZSBwb3NpdGl2ZSBpZiByaW5nIGlzIG9yaWVudGVkXG4gKiAgICAgY2xvY2t3aXNlLCBvdGhlcndpc2UgaXQgd2lsbCBiZSBuZWdhdGl2ZS5cbiAqXG4gKiBSZWZlcmVuY2U6XG4gKiBSb2JlcnQuIEcuIENoYW1iZXJsYWluIGFuZCBXaWxsaWFtIEguIER1cXVldHRlLCBcIlNvbWUgQWxnb3JpdGhtcyBmb3JcbiAqICAgICBQb2x5Z29ucyBvbiBhIFNwaGVyZVwiLCBKUEwgUHVibGljYXRpb24gMDctMDMsIEpldCBQcm9wdWxzaW9uXG4gKiAgICAgTGFib3JhdG9yeSwgUGFzYWRlbmEsIENBLCBKdW5lIDIwMDcgaHR0cDovL3Rycy1uZXcuanBsLm5hc2EuZ292L2RzcGFjZS9oYW5kbGUvMjAxNC80MDQwOVxuICpcbiAqIFJldHVybnM6XG4gKiB7ZmxvYXR9IFRoZSBhcHByb3hpbWF0ZSBzaWduZWQgZ2VvZGVzaWMgYXJlYSBvZiB0aGUgcG9seWdvbiBpbiBzcXVhcmVcbiAqICAgICBtZXRlcnMuXG4gKi9cblxuZnVuY3Rpb24gcmluZ0FyZWEoY29vcmRzKSB7XG4gICAgdmFyIHAxLCBwMiwgcDMsIGxvd2VySW5kZXgsIG1pZGRsZUluZGV4LCB1cHBlckluZGV4LFxuICAgIGFyZWEgPSAwLFxuICAgIGNvb3Jkc0xlbmd0aCA9IGNvb3Jkcy5sZW5ndGg7XG5cbiAgICBpZiAoY29vcmRzTGVuZ3RoID4gMikge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY29vcmRzTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpID09PSBjb29yZHNMZW5ndGggLSAyKSB7Ly8gaSA9IE4tMlxuICAgICAgICAgICAgICAgIGxvd2VySW5kZXggPSBjb29yZHNMZW5ndGggLSAyO1xuICAgICAgICAgICAgICAgIG1pZGRsZUluZGV4ID0gY29vcmRzTGVuZ3RoIC0xO1xuICAgICAgICAgICAgICAgIHVwcGVySW5kZXggPSAwO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpID09PSBjb29yZHNMZW5ndGggLSAxKSB7Ly8gaSA9IE4tMVxuICAgICAgICAgICAgICAgIGxvd2VySW5kZXggPSBjb29yZHNMZW5ndGggLSAxO1xuICAgICAgICAgICAgICAgIG1pZGRsZUluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICB1cHBlckluZGV4ID0gMTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIGkgPSAwIHRvIE4tM1xuICAgICAgICAgICAgICAgIGxvd2VySW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIG1pZGRsZUluZGV4ID0gaSsxO1xuICAgICAgICAgICAgICAgIHVwcGVySW5kZXggPSBpKzI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwMSA9IGNvb3Jkc1tsb3dlckluZGV4XTtcbiAgICAgICAgICAgIHAyID0gY29vcmRzW21pZGRsZUluZGV4XTtcbiAgICAgICAgICAgIHAzID0gY29vcmRzW3VwcGVySW5kZXhdO1xuICAgICAgICAgICAgYXJlYSArPSAoIHJhZChwM1swXSkgLSByYWQocDFbMF0pICkgKiBNYXRoLnNpbiggcmFkKHAyWzFdKSk7XG4gICAgICAgIH1cblxuICAgICAgICBhcmVhID0gYXJlYSAqIHdnczg0LlJBRElVUyAqIHdnczg0LlJBRElVUyAvIDI7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFyZWE7XG59XG5cbmZ1bmN0aW9uIHJhZChfKSB7XG4gICAgcmV0dXJuIF8gKiBNYXRoLlBJIC8gMTgwO1xufSIsInZhciByYnVzaCA9IHJlcXVpcmUoJ3JidXNoJyk7XG52YXIgaGVscGVycyA9IHJlcXVpcmUoJ0B0dXJmL2hlbHBlcnMnKTtcbnZhciBtZXRhID0gcmVxdWlyZSgnQHR1cmYvbWV0YScpO1xudmFyIHR1cmZCQm94ID0gcmVxdWlyZSgnQHR1cmYvYmJveCcpLmRlZmF1bHQ7XG52YXIgZmVhdHVyZUVhY2ggPSBtZXRhLmZlYXR1cmVFYWNoO1xudmFyIGNvb3JkRWFjaCA9IG1ldGEuY29vcmRFYWNoO1xudmFyIHBvbHlnb24gPSBoZWxwZXJzLnBvbHlnb247XG52YXIgZmVhdHVyZUNvbGxlY3Rpb24gPSBoZWxwZXJzLmZlYXR1cmVDb2xsZWN0aW9uO1xuXG4vKipcbiAqIEdlb0pTT04gaW1wbGVtZW50YXRpb24gb2YgW1JCdXNoXShodHRwczovL2dpdGh1Yi5jb20vbW91cm5lci9yYnVzaCNyYnVzaCkgc3BhdGlhbCBpbmRleC5cbiAqXG4gKiBAbmFtZSByYnVzaFxuICogQHBhcmFtIHtudW1iZXJ9IFttYXhFbnRyaWVzPTldIGRlZmluZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIGVudHJpZXMgaW4gYSB0cmVlIG5vZGUuIDkgKHVzZWQgYnkgZGVmYXVsdCkgaXMgYVxuICogcmVhc29uYWJsZSBjaG9pY2UgZm9yIG1vc3QgYXBwbGljYXRpb25zLiBIaWdoZXIgdmFsdWUgbWVhbnMgZmFzdGVyIGluc2VydGlvbiBhbmQgc2xvd2VyIHNlYXJjaCwgYW5kIHZpY2UgdmVyc2EuXG4gKiBAcmV0dXJucyB7UkJ1c2h9IEdlb0pTT04gUkJ1c2hcbiAqIEBleGFtcGxlXG4gKiB2YXIgZ2VvanNvblJidXNoID0gcmVxdWlyZSgnZ2VvanNvbi1yYnVzaCcpLmRlZmF1bHQ7XG4gKiB2YXIgdHJlZSA9IGdlb2pzb25SYnVzaCgpO1xuICovXG5mdW5jdGlvbiBnZW9qc29uUmJ1c2gobWF4RW50cmllcykge1xuICAgIHZhciB0cmVlID0gcmJ1c2gobWF4RW50cmllcyk7XG4gICAgLyoqXG4gICAgICogW2luc2VydF0oaHR0cHM6Ly9naXRodWIuY29tL21vdXJuZXIvcmJ1c2gjZGF0YS1mb3JtYXQpXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZlYXR1cmV9IGZlYXR1cmUgaW5zZXJ0IHNpbmdsZSBHZW9KU09OIEZlYXR1cmVcbiAgICAgKiBAcmV0dXJucyB7UkJ1c2h9IEdlb0pTT04gUkJ1c2hcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBwb2x5ID0gdHVyZi5wb2x5Z29uKFtbWy03OCwgNDFdLCBbLTY3LCA0MV0sIFstNjcsIDQ4XSwgWy03OCwgNDhdLCBbLTc4LCA0MV1dXSk7XG4gICAgICogdHJlZS5pbnNlcnQocG9seSlcbiAgICAgKi9cbiAgICB0cmVlLmluc2VydCA9IGZ1bmN0aW9uIChmZWF0dXJlKSB7XG4gICAgICAgIGlmIChmZWF0dXJlLnR5cGUgIT09ICdGZWF0dXJlJykgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIGZlYXR1cmUnKTtcbiAgICAgICAgZmVhdHVyZS5iYm94ID0gZmVhdHVyZS5iYm94ID8gZmVhdHVyZS5iYm94IDogdHVyZkJCb3goZmVhdHVyZSk7XG4gICAgICAgIHJldHVybiByYnVzaC5wcm90b3R5cGUuaW5zZXJ0LmNhbGwodGhpcywgZmVhdHVyZSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFtsb2FkXShodHRwczovL2dpdGh1Yi5jb20vbW91cm5lci9yYnVzaCNidWxrLWluc2VydGluZy1kYXRhKVxuICAgICAqXG4gICAgICogQHBhcmFtIHtGZWF0dXJlQ29sbGVjdGlvbnxBcnJheTxGZWF0dXJlPn0gZmVhdHVyZXMgbG9hZCBlbnRpcmUgR2VvSlNPTiBGZWF0dXJlQ29sbGVjdGlvblxuICAgICAqIEByZXR1cm5zIHtSQnVzaH0gR2VvSlNPTiBSQnVzaFxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHBvbHlzID0gdHVyZi5wb2x5Z29ucyhbXG4gICAgICogICAgIFtbWy03OCwgNDFdLCBbLTY3LCA0MV0sIFstNjcsIDQ4XSwgWy03OCwgNDhdLCBbLTc4LCA0MV1dXSxcbiAgICAgKiAgICAgW1tbLTkzLCAzMl0sIFstODMsIDMyXSwgWy04MywgMzldLCBbLTkzLCAzOV0sIFstOTMsIDMyXV1dXG4gICAgICogXSk7XG4gICAgICogdHJlZS5sb2FkKHBvbHlzKTtcbiAgICAgKi9cbiAgICB0cmVlLmxvYWQgPSBmdW5jdGlvbiAoZmVhdHVyZXMpIHtcbiAgICAgICAgdmFyIGxvYWQgPSBbXTtcbiAgICAgICAgLy8gTG9hZCBhbiBBcnJheSBvZiBGZWF0dXJlc1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShmZWF0dXJlcykpIHtcbiAgICAgICAgICAgIGZlYXR1cmVzLmZvckVhY2goZnVuY3Rpb24gKGZlYXR1cmUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZmVhdHVyZS50eXBlICE9PSAnRmVhdHVyZScpIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBmZWF0dXJlcycpO1xuICAgICAgICAgICAgICAgIGZlYXR1cmUuYmJveCA9IGZlYXR1cmUuYmJveCA/IGZlYXR1cmUuYmJveCA6IHR1cmZCQm94KGZlYXR1cmUpO1xuICAgICAgICAgICAgICAgIGxvYWQucHVzaChmZWF0dXJlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gTG9hZCBhIEZlYXR1cmVDb2xsZWN0aW9uXG4gICAgICAgICAgICBmZWF0dXJlRWFjaChmZWF0dXJlcywgZnVuY3Rpb24gKGZlYXR1cmUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZmVhdHVyZS50eXBlICE9PSAnRmVhdHVyZScpIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBmZWF0dXJlcycpO1xuICAgICAgICAgICAgICAgIGZlYXR1cmUuYmJveCA9IGZlYXR1cmUuYmJveCA/IGZlYXR1cmUuYmJveCA6IHR1cmZCQm94KGZlYXR1cmUpO1xuICAgICAgICAgICAgICAgIGxvYWQucHVzaChmZWF0dXJlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByYnVzaC5wcm90b3R5cGUubG9hZC5jYWxsKHRoaXMsIGxvYWQpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBbcmVtb3ZlXShodHRwczovL2dpdGh1Yi5jb20vbW91cm5lci9yYnVzaCNyZW1vdmluZy1kYXRhKVxuICAgICAqXG4gICAgICogQHBhcmFtIHtGZWF0dXJlfSBmZWF0dXJlIHJlbW92ZSBzaW5nbGUgR2VvSlNPTiBGZWF0dXJlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZXF1YWxzIFBhc3MgYSBjdXN0b20gZXF1YWxzIGZ1bmN0aW9uIHRvIGNvbXBhcmUgYnkgdmFsdWUgZm9yIHJlbW92YWwuXG4gICAgICogQHJldHVybnMge1JCdXNofSBHZW9KU09OIFJCdXNoXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcG9seSA9IHR1cmYucG9seWdvbihbW1stNzgsIDQxXSwgWy02NywgNDFdLCBbLTY3LCA0OF0sIFstNzgsIDQ4XSwgWy03OCwgNDFdXV0pO1xuICAgICAqXG4gICAgICogdHJlZS5yZW1vdmUocG9seSk7XG4gICAgICovXG4gICAgdHJlZS5yZW1vdmUgPSBmdW5jdGlvbiAoZmVhdHVyZSwgZXF1YWxzKSB7XG4gICAgICAgIGlmIChmZWF0dXJlLnR5cGUgIT09ICdGZWF0dXJlJykgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIGZlYXR1cmUnKTtcbiAgICAgICAgZmVhdHVyZS5iYm94ID0gZmVhdHVyZS5iYm94ID8gZmVhdHVyZS5iYm94IDogdHVyZkJCb3goZmVhdHVyZSk7XG4gICAgICAgIHJldHVybiByYnVzaC5wcm90b3R5cGUucmVtb3ZlLmNhbGwodGhpcywgZmVhdHVyZSwgZXF1YWxzKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogW2NsZWFyXShodHRwczovL2dpdGh1Yi5jb20vbW91cm5lci9yYnVzaCNyZW1vdmluZy1kYXRhKVxuICAgICAqXG4gICAgICogQHJldHVybnMge1JCdXNofSBHZW9KU09OIFJidXNoXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB0cmVlLmNsZWFyKClcbiAgICAgKi9cbiAgICB0cmVlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gcmJ1c2gucHJvdG90eXBlLmNsZWFyLmNhbGwodGhpcyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFtzZWFyY2hdKGh0dHBzOi8vZ2l0aHViLmNvbS9tb3VybmVyL3JidXNoI3NlYXJjaClcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QkJveHxGZWF0dXJlQ29sbGVjdGlvbnxGZWF0dXJlfSBnZW9qc29uIHNlYXJjaCB3aXRoIEdlb0pTT05cbiAgICAgKiBAcmV0dXJucyB7RmVhdHVyZUNvbGxlY3Rpb259IGFsbCBmZWF0dXJlcyB0aGF0IGludGVyc2VjdHMgd2l0aCB0aGUgZ2l2ZW4gR2VvSlNPTi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBwb2x5ID0gdHVyZi5wb2x5Z29uKFtbWy03OCwgNDFdLCBbLTY3LCA0MV0sIFstNjcsIDQ4XSwgWy03OCwgNDhdLCBbLTc4LCA0MV1dXSk7XG4gICAgICpcbiAgICAgKiB0cmVlLnNlYXJjaChwb2x5KTtcbiAgICAgKi9cbiAgICB0cmVlLnNlYXJjaCA9IGZ1bmN0aW9uIChnZW9qc29uKSB7XG4gICAgICAgIHZhciBmZWF0dXJlcyA9IHJidXNoLnByb3RvdHlwZS5zZWFyY2guY2FsbCh0aGlzLCB0aGlzLnRvQkJveChnZW9qc29uKSk7XG4gICAgICAgIHJldHVybiBmZWF0dXJlQ29sbGVjdGlvbihmZWF0dXJlcyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFtjb2xsaWRlc10oaHR0cHM6Ly9naXRodWIuY29tL21vdXJuZXIvcmJ1c2gjY29sbGlzaW9ucylcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QkJveHxGZWF0dXJlQ29sbGVjdGlvbnxGZWF0dXJlfSBnZW9qc29uIGNvbGxpZGVzIHdpdGggR2VvSlNPTlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmIHRoZXJlIGFyZSBhbnkgaXRlbXMgaW50ZXJzZWN0aW5nIHRoZSBnaXZlbiBHZW9KU09OLCBvdGhlcndpc2UgZmFsc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcG9seSA9IHR1cmYucG9seWdvbihbW1stNzgsIDQxXSwgWy02NywgNDFdLCBbLTY3LCA0OF0sIFstNzgsIDQ4XSwgWy03OCwgNDFdXV0pO1xuICAgICAqXG4gICAgICogdHJlZS5jb2xsaWRlcyhwb2x5KTtcbiAgICAgKi9cbiAgICB0cmVlLmNvbGxpZGVzID0gZnVuY3Rpb24gKGdlb2pzb24pIHtcbiAgICAgICAgcmV0dXJuIHJidXNoLnByb3RvdHlwZS5jb2xsaWRlcy5jYWxsKHRoaXMsIHRoaXMudG9CQm94KGdlb2pzb24pKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogW2FsbF0oaHR0cHM6Ly9naXRodWIuY29tL21vdXJuZXIvcmJ1c2gjc2VhcmNoKVxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZlYXR1cmVDb2xsZWN0aW9ufSBhbGwgdGhlIGZlYXR1cmVzIGluIFJCdXNoXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB0cmVlLmFsbCgpXG4gICAgICovXG4gICAgdHJlZS5hbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmZWF0dXJlcyA9IHJidXNoLnByb3RvdHlwZS5hbGwuY2FsbCh0aGlzKTtcbiAgICAgICAgcmV0dXJuIGZlYXR1cmVDb2xsZWN0aW9uKGZlYXR1cmVzKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogW3RvSlNPTl0oaHR0cHM6Ly9naXRodWIuY29tL21vdXJuZXIvcmJ1c2gjZXhwb3J0LWFuZC1pbXBvcnQpXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7YW55fSBleHBvcnQgZGF0YSBhcyBKU09OIG9iamVjdFxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGV4cG9ydGVkID0gdHJlZS50b0pTT04oKVxuICAgICAqL1xuICAgIHRyZWUudG9KU09OID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gcmJ1c2gucHJvdG90eXBlLnRvSlNPTi5jYWxsKHRoaXMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBbZnJvbUpTT05dKGh0dHBzOi8vZ2l0aHViLmNvbS9tb3VybmVyL3JidXNoI2V4cG9ydC1hbmQtaW1wb3J0KVxuICAgICAqXG4gICAgICogQHBhcmFtIHthbnl9IGpzb24gaW1wb3J0IHByZXZpb3VzbHkgZXhwb3J0ZWQgZGF0YVxuICAgICAqIEByZXR1cm5zIHtSQnVzaH0gR2VvSlNPTiBSQnVzaFxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGV4cG9ydGVkID0ge1xuICAgICAqICAgXCJjaGlsZHJlblwiOiBbXG4gICAgICogICAgIHtcbiAgICAgKiAgICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gICAgICogICAgICAgXCJnZW9tZXRyeVwiOiB7XG4gICAgICogICAgICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICAgICAqICAgICAgICAgXCJjb29yZGluYXRlc1wiOiBbMTEwLCA1MF1cbiAgICAgKiAgICAgICB9LFxuICAgICAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAgICAgKiAgICAgICBcImJib3hcIjogWzExMCwgNTAsIDExMCwgNTBdXG4gICAgICogICAgIH1cbiAgICAgKiAgIF0sXG4gICAgICogICBcImhlaWdodFwiOiAxLFxuICAgICAqICAgXCJsZWFmXCI6IHRydWUsXG4gICAgICogICBcIm1pblhcIjogMTEwLFxuICAgICAqICAgXCJtaW5ZXCI6IDUwLFxuICAgICAqICAgXCJtYXhYXCI6IDExMCxcbiAgICAgKiAgIFwibWF4WVwiOiA1MFxuICAgICAqIH1cbiAgICAgKiB0cmVlLmZyb21KU09OKGV4cG9ydGVkKVxuICAgICAqL1xuICAgIHRyZWUuZnJvbUpTT04gPSBmdW5jdGlvbiAoanNvbikge1xuICAgICAgICByZXR1cm4gcmJ1c2gucHJvdG90eXBlLmZyb21KU09OLmNhbGwodGhpcywganNvbik7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIEdlb0pTT04gdG8ge21pblgsIG1pblksIG1heFgsIG1heFl9IHNjaGVtYVxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0ge0JCb3h8RmVhdHVyZUNvbGxlY3Rpb258RmVhdHVyZX0gZ2VvanNvbiBmZWF0dXJlKHMpIHRvIHJldHJpZXZlIEJCb3ggZnJvbVxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IGNvbnZlcnRlZCB0byB7bWluWCwgbWluWSwgbWF4WCwgbWF4WX1cbiAgICAgKi9cbiAgICB0cmVlLnRvQkJveCA9IGZ1bmN0aW9uIChnZW9qc29uKSB7XG4gICAgICAgIHZhciBiYm94O1xuICAgICAgICBpZiAoZ2VvanNvbi5iYm94KSBiYm94ID0gZ2VvanNvbi5iYm94O1xuICAgICAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KGdlb2pzb24pICYmIGdlb2pzb24ubGVuZ3RoID09PSA0KSBiYm94ID0gZ2VvanNvbjtcbiAgICAgICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShnZW9qc29uKSAmJiBnZW9qc29uLmxlbmd0aCA9PT0gNikgYmJveCA9IFtnZW9qc29uWzBdLCBnZW9qc29uWzFdLCBnZW9qc29uWzNdLCBnZW9qc29uWzRdXTtcbiAgICAgICAgZWxzZSBpZiAoZ2VvanNvbi50eXBlID09PSAnRmVhdHVyZScpIGJib3ggPSB0dXJmQkJveChnZW9qc29uKTtcbiAgICAgICAgZWxzZSBpZiAoZ2VvanNvbi50eXBlID09PSAnRmVhdHVyZUNvbGxlY3Rpb24nKSBiYm94ID0gdHVyZkJCb3goZ2VvanNvbik7XG4gICAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIGdlb2pzb24nKVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBtaW5YOiBiYm94WzBdLFxuICAgICAgICAgICAgbWluWTogYmJveFsxXSxcbiAgICAgICAgICAgIG1heFg6IGJib3hbMl0sXG4gICAgICAgICAgICBtYXhZOiBiYm94WzNdXG4gICAgICAgIH07XG4gICAgfTtcbiAgICByZXR1cm4gdHJlZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZW9qc29uUmJ1c2g7XG5tb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gZ2VvanNvblJidXNoO1xuIiwiLyohXG4gKiBMby1EYXNoIHYwLjkuMiA8aHR0cDovL2xvZGFzaC5jb20+XG4gKiAoYykgMjAxMiBKb2huLURhdmlkIERhbHRvbiA8aHR0cDovL2FsbHlvdWNhbmxlZXQuY29tLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS40LjIgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnPlxuICogKGMpIDIwMDktMjAxMiBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgSW5jLlxuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG47KGZ1bmN0aW9uKHdpbmRvdywgdW5kZWZpbmVkKSB7XG5cbiAgLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBleHBvcnRzYCAqL1xuICB2YXIgZnJlZUV4cG9ydHMgPSB0eXBlb2YgZXhwb3J0cyA9PSAnb2JqZWN0JyAmJiBleHBvcnRzO1xuXG4gIC8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZ2xvYmFsYCBhbmQgdXNlIGl0IGFzIGB3aW5kb3dgICovXG4gIHZhciBmcmVlR2xvYmFsID0gdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWw7XG4gIGlmIChmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCkge1xuICAgIHdpbmRvdyA9IGZyZWVHbG9iYWw7XG4gIH1cblxuICAvKiogVXNlZCBmb3IgYXJyYXkgYW5kIG9iamVjdCBtZXRob2QgcmVmZXJlbmNlcyAqL1xuICB2YXIgYXJyYXlSZWYgPSBbXSxcbiAgICAgIC8vIGF2b2lkIGEgQ2xvc3VyZSBDb21waWxlciBidWcgYnkgY3JlYXRpdmVseSBjcmVhdGluZyBhbiBvYmplY3RcbiAgICAgIG9iamVjdFJlZiA9IG5ldyBmdW5jdGlvbigpe307XG5cbiAgLyoqIFVzZWQgdG8gZ2VuZXJhdGUgdW5pcXVlIElEcyAqL1xuICB2YXIgaWRDb3VudGVyID0gMDtcblxuICAvKiogVXNlZCBpbnRlcm5hbGx5IHRvIGluZGljYXRlIHZhcmlvdXMgdGhpbmdzICovXG4gIHZhciBpbmRpY2F0b3JPYmplY3QgPSBvYmplY3RSZWY7XG5cbiAgLyoqIFVzZWQgYnkgYGNhY2hlZENvbnRhaW5zYCBhcyB0aGUgZGVmYXVsdCBzaXplIHdoZW4gb3B0aW1pemF0aW9ucyBhcmUgZW5hYmxlZCBmb3IgbGFyZ2UgYXJyYXlzICovXG4gIHZhciBsYXJnZUFycmF5U2l6ZSA9IDMwO1xuXG4gIC8qKiBVc2VkIHRvIHJlc3RvcmUgdGhlIG9yaWdpbmFsIGBfYCByZWZlcmVuY2UgaW4gYG5vQ29uZmxpY3RgICovXG4gIHZhciBvbGREYXNoID0gd2luZG93Ll87XG5cbiAgLyoqIFVzZWQgdG8gZGV0ZWN0IHRlbXBsYXRlIGRlbGltaXRlciB2YWx1ZXMgdGhhdCByZXF1aXJlIGEgd2l0aC1zdGF0ZW1lbnQgKi9cbiAgdmFyIHJlQ29tcGxleERlbGltaXRlciA9IC9bLT8rPSF+KiUmXjw+fHsoXFwvXXxcXFtcXER8XFxiKD86ZGVsZXRlfGlufGluc3RhbmNlb2Z8bmV3fHR5cGVvZnx2b2lkKVxcYi87XG5cbiAgLyoqIFVzZWQgdG8gbWF0Y2ggSFRNTCBlbnRpdGllcyAqL1xuICB2YXIgcmVFc2NhcGVkSHRtbCA9IC8mKD86YW1wfGx0fGd0fHF1b3R8I3gyNyk7L2c7XG5cbiAgLyoqIFVzZWQgdG8gbWF0Y2ggZW1wdHkgc3RyaW5nIGxpdGVyYWxzIGluIGNvbXBpbGVkIHRlbXBsYXRlIHNvdXJjZSAqL1xuICB2YXIgcmVFbXB0eVN0cmluZ0xlYWRpbmcgPSAvXFxiX19wIFxcKz0gJyc7L2csXG4gICAgICByZUVtcHR5U3RyaW5nTWlkZGxlID0gL1xcYihfX3AgXFwrPSkgJycgXFwrL2csXG4gICAgICByZUVtcHR5U3RyaW5nVHJhaWxpbmcgPSAvKF9fZVxcKC4qP1xcKXxcXGJfX3RcXCkpIFxcK1xcbicnOy9nO1xuXG4gIC8qKiBVc2VkIHRvIG1hdGNoIHJlZ2V4cCBmbGFncyBmcm9tIHRoZWlyIGNvZXJjZWQgc3RyaW5nIHZhbHVlcyAqL1xuICB2YXIgcmVGbGFncyA9IC9cXHcqJC87XG5cbiAgLyoqIFVzZWQgdG8gaW5zZXJ0IHRoZSBkYXRhIG9iamVjdCB2YXJpYWJsZSBpbnRvIGNvbXBpbGVkIHRlbXBsYXRlIHNvdXJjZSAqL1xuICB2YXIgcmVJbnNlcnRWYXJpYWJsZSA9IC8oPzpfX2V8X190ID0gKVxcKFxccyooPyFbXFxkXFxzXCInXXx0aGlzXFwuKS9nO1xuXG4gIC8qKiBVc2VkIHRvIGRldGVjdCBpZiBhIG1ldGhvZCBpcyBuYXRpdmUgKi9cbiAgdmFyIHJlTmF0aXZlID0gUmVnRXhwKCdeJyArXG4gICAgKG9iamVjdFJlZi52YWx1ZU9mICsgJycpXG4gICAgICAucmVwbGFjZSgvWy4qKz9ePSE6JHt9KCl8W1xcXVxcL1xcXFxdL2csICdcXFxcJCYnKVxuICAgICAgLnJlcGxhY2UoL3ZhbHVlT2Z8Zm9yIFteXFxdXSsvZywgJy4rPycpICsgJyQnXG4gICk7XG5cbiAgLyoqXG4gICAqIFVzZWQgdG8gbWF0Y2ggRVM2IHRlbXBsYXRlIGRlbGltaXRlcnNcbiAgICogaHR0cDovL3Blb3BsZS5tb3ppbGxhLm9yZy9+am9yZW5kb3JmZi9lczYtZHJhZnQuaHRtbCNzZWMtNy44LjZcbiAgICovXG4gIHZhciByZUVzVGVtcGxhdGUgPSAvXFwkXFx7KCg/Oig/PVxcXFw/KVxcXFw/W1xcc1xcU10pKj8pfS9nO1xuXG4gIC8qKiBVc2VkIHRvIG1hdGNoIFwiaW50ZXJwb2xhdGVcIiB0ZW1wbGF0ZSBkZWxpbWl0ZXJzICovXG4gIHZhciByZUludGVycG9sYXRlID0gLzwlPShbXFxzXFxTXSs/KSU+L2c7XG5cbiAgLyoqIFVzZWQgdG8gZW5zdXJlIGNhcHR1cmluZyBvcmRlciBvZiB0ZW1wbGF0ZSBkZWxpbWl0ZXJzICovXG4gIHZhciByZU5vTWF0Y2ggPSAvKCReKS87XG5cbiAgLyoqIFVzZWQgdG8gbWF0Y2ggSFRNTCBjaGFyYWN0ZXJzICovXG4gIHZhciByZVVuZXNjYXBlZEh0bWwgPSAvWyY8PlwiJ10vZztcblxuICAvKiogVXNlZCB0byBtYXRjaCB1bmVzY2FwZWQgY2hhcmFjdGVycyBpbiBjb21waWxlZCBzdHJpbmcgbGl0ZXJhbHMgKi9cbiAgdmFyIHJlVW5lc2NhcGVkU3RyaW5nID0gL1snXFxuXFxyXFx0XFx1MjAyOFxcdTIwMjlcXFxcXS9nO1xuXG4gIC8qKiBVc2VkIHRvIGZpeCB0aGUgSlNjcmlwdCBbW0RvbnRFbnVtXV0gYnVnICovXG4gIHZhciBzaGFkb3dlZCA9IFtcbiAgICAnY29uc3RydWN0b3InLCAnaGFzT3duUHJvcGVydHknLCAnaXNQcm90b3R5cGVPZicsICdwcm9wZXJ0eUlzRW51bWVyYWJsZScsXG4gICAgJ3RvTG9jYWxlU3RyaW5nJywgJ3RvU3RyaW5nJywgJ3ZhbHVlT2YnXG4gIF07XG5cbiAgLyoqIFVzZWQgdG8gbWFrZSB0ZW1wbGF0ZSBzb3VyY2VVUkxzIGVhc2llciB0byBpZGVudGlmeSAqL1xuICB2YXIgdGVtcGxhdGVDb3VudGVyID0gMDtcblxuICAvKiogTmF0aXZlIG1ldGhvZCBzaG9ydGN1dHMgKi9cbiAgdmFyIGNlaWwgPSBNYXRoLmNlaWwsXG4gICAgICBjb25jYXQgPSBhcnJheVJlZi5jb25jYXQsXG4gICAgICBmbG9vciA9IE1hdGguZmxvb3IsXG4gICAgICBnZXRQcm90b3R5cGVPZiA9IHJlTmF0aXZlLnRlc3QoZ2V0UHJvdG90eXBlT2YgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YpICYmIGdldFByb3RvdHlwZU9mLFxuICAgICAgaGFzT3duUHJvcGVydHkgPSBvYmplY3RSZWYuaGFzT3duUHJvcGVydHksXG4gICAgICBwdXNoID0gYXJyYXlSZWYucHVzaCxcbiAgICAgIHByb3BlcnR5SXNFbnVtZXJhYmxlID0gb2JqZWN0UmVmLnByb3BlcnR5SXNFbnVtZXJhYmxlLFxuICAgICAgc2xpY2UgPSBhcnJheVJlZi5zbGljZSxcbiAgICAgIHRvU3RyaW5nID0gb2JqZWN0UmVmLnRvU3RyaW5nO1xuXG4gIC8qIE5hdGl2ZSBtZXRob2Qgc2hvcnRjdXRzIGZvciBtZXRob2RzIHdpdGggdGhlIHNhbWUgbmFtZSBhcyBvdGhlciBgbG9kYXNoYCBtZXRob2RzICovXG4gIHZhciBuYXRpdmVCaW5kID0gcmVOYXRpdmUudGVzdChuYXRpdmVCaW5kID0gc2xpY2UuYmluZCkgJiYgbmF0aXZlQmluZCxcbiAgICAgIG5hdGl2ZUlzQXJyYXkgPSByZU5hdGl2ZS50ZXN0KG5hdGl2ZUlzQXJyYXkgPSBBcnJheS5pc0FycmF5KSAmJiBuYXRpdmVJc0FycmF5LFxuICAgICAgbmF0aXZlSXNGaW5pdGUgPSB3aW5kb3cuaXNGaW5pdGUsXG4gICAgICBuYXRpdmVJc05hTiA9IHdpbmRvdy5pc05hTixcbiAgICAgIG5hdGl2ZUtleXMgPSByZU5hdGl2ZS50ZXN0KG5hdGl2ZUtleXMgPSBPYmplY3Qua2V5cykgJiYgbmF0aXZlS2V5cyxcbiAgICAgIG5hdGl2ZU1heCA9IE1hdGgubWF4LFxuICAgICAgbmF0aXZlTWluID0gTWF0aC5taW4sXG4gICAgICBuYXRpdmVSYW5kb20gPSBNYXRoLnJhbmRvbTtcblxuICAvKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHNob3J0Y3V0cyAqL1xuICB2YXIgYXJnc0NsYXNzID0gJ1tvYmplY3QgQXJndW1lbnRzXScsXG4gICAgICBhcnJheUNsYXNzID0gJ1tvYmplY3QgQXJyYXldJyxcbiAgICAgIGJvb2xDbGFzcyA9ICdbb2JqZWN0IEJvb2xlYW5dJyxcbiAgICAgIGRhdGVDbGFzcyA9ICdbb2JqZWN0IERhdGVdJyxcbiAgICAgIGZ1bmNDbGFzcyA9ICdbb2JqZWN0IEZ1bmN0aW9uXScsXG4gICAgICBudW1iZXJDbGFzcyA9ICdbb2JqZWN0IE51bWJlcl0nLFxuICAgICAgb2JqZWN0Q2xhc3MgPSAnW29iamVjdCBPYmplY3RdJyxcbiAgICAgIHJlZ2V4cENsYXNzID0gJ1tvYmplY3QgUmVnRXhwXScsXG4gICAgICBzdHJpbmdDbGFzcyA9ICdbb2JqZWN0IFN0cmluZ10nO1xuXG4gIC8qKlxuICAgKiBEZXRlY3QgdGhlIEpTY3JpcHQgW1tEb250RW51bV1dIGJ1ZzpcbiAgICpcbiAgICogSW4gSUUgPCA5IGFuIG9iamVjdHMgb3duIHByb3BlcnRpZXMsIHNoYWRvd2luZyBub24tZW51bWVyYWJsZSBvbmVzLCBhcmVcbiAgICogbWFkZSBub24tZW51bWVyYWJsZSBhcyB3ZWxsLlxuICAgKi9cbiAgdmFyIGhhc0RvbnRFbnVtQnVnO1xuXG4gIC8qKiBEZXRlY3QgaWYgb3duIHByb3BlcnRpZXMgYXJlIGl0ZXJhdGVkIGFmdGVyIGluaGVyaXRlZCBwcm9wZXJ0aWVzIChJRSA8IDkpICovXG4gIHZhciBpdGVyYXRlc093bkxhc3Q7XG5cbiAgLyoqXG4gICAqIERldGVjdCBpZiBgQXJyYXkjc2hpZnRgIGFuZCBgQXJyYXkjc3BsaWNlYCBhdWdtZW50IGFycmF5LWxpa2Ugb2JqZWN0c1xuICAgKiBpbmNvcnJlY3RseTpcbiAgICpcbiAgICogRmlyZWZveCA8IDEwLCBJRSBjb21wYXRpYmlsaXR5IG1vZGUsIGFuZCBJRSA8IDkgaGF2ZSBidWdneSBBcnJheSBgc2hpZnQoKWBcbiAgICogYW5kIGBzcGxpY2UoKWAgZnVuY3Rpb25zIHRoYXQgZmFpbCB0byByZW1vdmUgdGhlIGxhc3QgZWxlbWVudCwgYHZhbHVlWzBdYCxcbiAgICogb2YgYXJyYXktbGlrZSBvYmplY3RzIGV2ZW4gdGhvdWdoIHRoZSBgbGVuZ3RoYCBwcm9wZXJ0eSBpcyBzZXQgdG8gYDBgLlxuICAgKiBUaGUgYHNoaWZ0KClgIG1ldGhvZCBpcyBidWdneSBpbiBJRSA4IGNvbXBhdGliaWxpdHkgbW9kZSwgd2hpbGUgYHNwbGljZSgpYFxuICAgKiBpcyBidWdneSByZWdhcmRsZXNzIG9mIG1vZGUgaW4gSUUgPCA5IGFuZCBidWdneSBpbiBjb21wYXRpYmlsaXR5IG1vZGUgaW4gSUUgOS5cbiAgICovXG4gIHZhciBoYXNPYmplY3RTcGxpY2VCdWcgPSAoaGFzT2JqZWN0U3BsaWNlQnVnID0geyAnMCc6IDEsICdsZW5ndGgnOiAxIH0sXG4gICAgYXJyYXlSZWYuc3BsaWNlLmNhbGwoaGFzT2JqZWN0U3BsaWNlQnVnLCAwLCAxKSwgaGFzT2JqZWN0U3BsaWNlQnVnWzBdKTtcblxuICAvKiogRGV0ZWN0IGlmIGFuIGBhcmd1bWVudHNgIG9iamVjdCdzIGluZGV4ZXMgYXJlIG5vbi1lbnVtZXJhYmxlIChJRSA8IDkpICovXG4gIHZhciBub0FyZ3NFbnVtID0gdHJ1ZTtcblxuICAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIHByb3BzID0gW107XG4gICAgZnVuY3Rpb24gY3RvcigpIHsgdGhpcy54ID0gMTsgfVxuICAgIGN0b3IucHJvdG90eXBlID0geyAndmFsdWVPZic6IDEsICd5JzogMSB9O1xuICAgIGZvciAodmFyIHByb3AgaW4gbmV3IGN0b3IpIHsgcHJvcHMucHVzaChwcm9wKTsgfVxuICAgIGZvciAocHJvcCBpbiBhcmd1bWVudHMpIHsgbm9BcmdzRW51bSA9ICFwcm9wOyB9XG5cbiAgICBoYXNEb250RW51bUJ1ZyA9ICEvdmFsdWVPZi8udGVzdChwcm9wcyk7XG4gICAgaXRlcmF0ZXNPd25MYXN0ID0gcHJvcHNbMF0gIT0gJ3gnO1xuICB9KDEpKTtcblxuICAvKiogRGV0ZWN0IGlmIGFuIGBhcmd1bWVudHNgIG9iamVjdCdzIFtbQ2xhc3NdXSBpcyB1bnJlc29sdmFibGUgKEZpcmVmb3ggPCA0LCBJRSA8IDkpICovXG4gIHZhciBub0FyZ3NDbGFzcyA9ICFpc0FyZ3VtZW50cyhhcmd1bWVudHMpO1xuXG4gIC8qKiBEZXRlY3QgaWYgYEFycmF5I3NsaWNlYCBjYW5ub3QgYmUgdXNlZCB0byBjb252ZXJ0IHN0cmluZ3MgdG8gYXJyYXlzIChPcGVyYSA8IDEwLjUyKSAqL1xuICB2YXIgbm9BcnJheVNsaWNlT25TdHJpbmdzID0gc2xpY2UuY2FsbCgneCcpWzBdICE9ICd4JztcblxuICAvKipcbiAgICogRGV0ZWN0IGxhY2sgb2Ygc3VwcG9ydCBmb3IgYWNjZXNzaW5nIHN0cmluZyBjaGFyYWN0ZXJzIGJ5IGluZGV4OlxuICAgKlxuICAgKiBJRSA8IDggY2FuJ3QgYWNjZXNzIGNoYXJhY3RlcnMgYnkgaW5kZXggYW5kIElFIDggY2FuIG9ubHkgYWNjZXNzXG4gICAqIGNoYXJhY3RlcnMgYnkgaW5kZXggb24gc3RyaW5nIGxpdGVyYWxzLlxuICAgKi9cbiAgdmFyIG5vQ2hhckJ5SW5kZXggPSAoJ3gnWzBdICsgT2JqZWN0KCd4JylbMF0pICE9ICd4eCc7XG5cbiAgLyoqXG4gICAqIERldGVjdCBpZiBhIG5vZGUncyBbW0NsYXNzXV0gaXMgdW5yZXNvbHZhYmxlIChJRSA8IDkpXG4gICAqIGFuZCB0aGF0IHRoZSBKUyBlbmdpbmUgd29uJ3QgZXJyb3Igd2hlbiBhdHRlbXB0aW5nIHRvIGNvZXJjZSBhbiBvYmplY3QgdG9cbiAgICogYSBzdHJpbmcgd2l0aG91dCBhIGB0b1N0cmluZ2AgcHJvcGVydHkgdmFsdWUgb2YgYHR5cGVvZmAgXCJmdW5jdGlvblwiLlxuICAgKi9cbiAgdHJ5IHtcbiAgICB2YXIgbm9Ob2RlQ2xhc3MgPSAoeyAndG9TdHJpbmcnOiAwIH0gKyAnJywgdG9TdHJpbmcuY2FsbCh3aW5kb3cuZG9jdW1lbnQgfHwgMCkgPT0gb2JqZWN0Q2xhc3MpO1xuICB9IGNhdGNoKGUpIHsgfVxuXG4gIC8qIERldGVjdCBpZiBgRnVuY3Rpb24jYmluZGAgZXhpc3RzIGFuZCBpcyBpbmZlcnJlZCB0byBiZSBmYXN0IChhbGwgYnV0IFY4KSAqL1xuICB2YXIgaXNCaW5kRmFzdCA9IG5hdGl2ZUJpbmQgJiYgL1xcbnxPcGVyYS8udGVzdChuYXRpdmVCaW5kICsgdG9TdHJpbmcuY2FsbCh3aW5kb3cub3BlcmEpKTtcblxuICAvKiBEZXRlY3QgaWYgYE9iamVjdC5rZXlzYCBleGlzdHMgYW5kIGlzIGluZmVycmVkIHRvIGJlIGZhc3QgKElFLCBPcGVyYSwgVjgpICovXG4gIHZhciBpc0tleXNGYXN0ID0gbmF0aXZlS2V5cyAmJiAvXi4rJHx0cnVlLy50ZXN0KG5hdGl2ZUtleXMgKyAhIXdpbmRvdy5hdHRhY2hFdmVudCk7XG5cbiAgLyoqXG4gICAqIERldGVjdCBpZiBzb3VyY2VVUkwgc3ludGF4IGlzIHVzYWJsZSB3aXRob3V0IGVycm9yaW5nOlxuICAgKlxuICAgKiBUaGUgSlMgZW5naW5lIGluIEFkb2JlIHByb2R1Y3RzLCBsaWtlIEluRGVzaWduLCB3aWxsIHRocm93IGEgc3ludGF4IGVycm9yXG4gICAqIHdoZW4gaXQgZW5jb3VudGVycyBhIHNpbmdsZSBsaW5lIGNvbW1lbnQgYmVnaW5uaW5nIHdpdGggdGhlIGBAYCBzeW1ib2wuXG4gICAqXG4gICAqIFRoZSBKUyBlbmdpbmUgaW4gTmFyd2hhbCB3aWxsIGdlbmVyYXRlIHRoZSBmdW5jdGlvbiBgZnVuY3Rpb24gYW5vbnltb3VzKCl7Ly99YFxuICAgKiBhbmQgdGhyb3cgYSBzeW50YXggZXJyb3IuXG4gICAqXG4gICAqIEF2b2lkIGNvbW1lbnRzIGJlZ2lubmluZyBgQGAgc3ltYm9scyBpbiBJRSBiZWNhdXNlIHRoZXkgYXJlIHBhcnQgb2YgaXRzXG4gICAqIG5vbi1zdGFuZGFyZCBjb25kaXRpb25hbCBjb21waWxhdGlvbiBzdXBwb3J0LlxuICAgKiBodHRwOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvMTIxaHp0azModj12cy45NCkuYXNweFxuICAgKi9cbiAgdHJ5IHtcbiAgICB2YXIgdXNlU291cmNlVVJMID0gKEZ1bmN0aW9uKCcvL0AnKSgpLCAhd2luZG93LmF0dGFjaEV2ZW50KTtcbiAgfSBjYXRjaChlKSB7IH1cblxuICAvKiogVXNlZCB0byBpZGVudGlmeSBvYmplY3QgY2xhc3NpZmljYXRpb25zIHRoYXQgYF8uY2xvbmVgIHN1cHBvcnRzICovXG4gIHZhciBjbG9uZWFibGVDbGFzc2VzID0ge307XG4gIGNsb25lYWJsZUNsYXNzZXNbYXJnc0NsYXNzXSA9IGNsb25lYWJsZUNsYXNzZXNbZnVuY0NsYXNzXSA9IGZhbHNlO1xuICBjbG9uZWFibGVDbGFzc2VzW2FycmF5Q2xhc3NdID0gY2xvbmVhYmxlQ2xhc3Nlc1tib29sQ2xhc3NdID0gY2xvbmVhYmxlQ2xhc3Nlc1tkYXRlQ2xhc3NdID1cbiAgY2xvbmVhYmxlQ2xhc3Nlc1tudW1iZXJDbGFzc10gPSBjbG9uZWFibGVDbGFzc2VzW29iamVjdENsYXNzXSA9IGNsb25lYWJsZUNsYXNzZXNbcmVnZXhwQ2xhc3NdID1cbiAgY2xvbmVhYmxlQ2xhc3Nlc1tzdHJpbmdDbGFzc10gPSB0cnVlO1xuXG4gIC8qKiBVc2VkIHRvIGRldGVybWluZSBpZiB2YWx1ZXMgYXJlIG9mIHRoZSBsYW5ndWFnZSB0eXBlIE9iamVjdCAqL1xuICB2YXIgb2JqZWN0VHlwZXMgPSB7XG4gICAgJ2Jvb2xlYW4nOiBmYWxzZSxcbiAgICAnZnVuY3Rpb24nOiB0cnVlLFxuICAgICdvYmplY3QnOiB0cnVlLFxuICAgICdudW1iZXInOiBmYWxzZSxcbiAgICAnc3RyaW5nJzogZmFsc2UsXG4gICAgJ3VuZGVmaW5lZCc6IGZhbHNlXG4gIH07XG5cbiAgLyoqIFVzZWQgdG8gZXNjYXBlIGNoYXJhY3RlcnMgZm9yIGluY2x1c2lvbiBpbiBjb21waWxlZCBzdHJpbmcgbGl0ZXJhbHMgKi9cbiAgdmFyIHN0cmluZ0VzY2FwZXMgPSB7XG4gICAgJ1xcXFwnOiAnXFxcXCcsXG4gICAgXCInXCI6IFwiJ1wiLFxuICAgICdcXG4nOiAnbicsXG4gICAgJ1xccic6ICdyJyxcbiAgICAnXFx0JzogJ3QnLFxuICAgICdcXHUyMDI4JzogJ3UyMDI4JyxcbiAgICAnXFx1MjAyOSc6ICd1MjAyOSdcbiAgfTtcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvKipcbiAgICogVGhlIGBsb2Rhc2hgIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAbmFtZSBfXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAY2F0ZWdvcnkgQ2hhaW5pbmdcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIHdyYXAgaW4gYSBgbG9kYXNoYCBpbnN0YW5jZS5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhIGBsb2Rhc2hgIGluc3RhbmNlLlxuICAgKi9cbiAgZnVuY3Rpb24gbG9kYXNoKHZhbHVlKSB7XG4gICAgLy8gZXhpdCBlYXJseSBpZiBhbHJlYWR5IHdyYXBwZWRcbiAgICBpZiAodmFsdWUgJiYgdmFsdWUuX193cmFwcGVkX18pIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgLy8gYWxsb3cgaW52b2tpbmcgYGxvZGFzaGAgd2l0aG91dCB0aGUgYG5ld2Agb3BlcmF0b3JcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgbG9kYXNoKSkge1xuICAgICAgcmV0dXJuIG5ldyBsb2Rhc2godmFsdWUpO1xuICAgIH1cbiAgICB0aGlzLl9fd3JhcHBlZF9fID0gdmFsdWU7XG4gIH1cblxuICAvKipcbiAgICogQnkgZGVmYXVsdCwgdGhlIHRlbXBsYXRlIGRlbGltaXRlcnMgdXNlZCBieSBMby1EYXNoIGFyZSBzaW1pbGFyIHRvIHRob3NlIGluXG4gICAqIGVtYmVkZGVkIFJ1YnkgKEVSQikuIENoYW5nZSB0aGUgZm9sbG93aW5nIHRlbXBsYXRlIHNldHRpbmdzIHRvIHVzZSBhbHRlcm5hdGl2ZVxuICAgKiBkZWxpbWl0ZXJzLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEB0eXBlIE9iamVjdFxuICAgKi9cbiAgbG9kYXNoLnRlbXBsYXRlU2V0dGluZ3MgPSB7XG5cbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIGRldGVjdCBgZGF0YWAgcHJvcGVydHkgdmFsdWVzIHRvIGJlIEhUTUwtZXNjYXBlZC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgXy50ZW1wbGF0ZVNldHRpbmdzXG4gICAgICogQHR5cGUgUmVnRXhwXG4gICAgICovXG4gICAgJ2VzY2FwZSc6IC88JS0oW1xcc1xcU10rPyklPi9nLFxuXG4gICAgLyoqXG4gICAgICogVXNlZCB0byBkZXRlY3QgY29kZSB0byBiZSBldmFsdWF0ZWQuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF8udGVtcGxhdGVTZXR0aW5nc1xuICAgICAqIEB0eXBlIFJlZ0V4cFxuICAgICAqL1xuICAgICdldmFsdWF0ZSc6IC88JShbXFxzXFxTXSs/KSU+L2csXG5cbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIGRldGVjdCBgZGF0YWAgcHJvcGVydHkgdmFsdWVzIHRvIGluamVjdC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgXy50ZW1wbGF0ZVNldHRpbmdzXG4gICAgICogQHR5cGUgUmVnRXhwXG4gICAgICovXG4gICAgJ2ludGVycG9sYXRlJzogcmVJbnRlcnBvbGF0ZSxcblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gcmVmZXJlbmNlIHRoZSBkYXRhIG9iamVjdCBpbiB0aGUgdGVtcGxhdGUgdGV4dC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgXy50ZW1wbGF0ZVNldHRpbmdzXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgJ3ZhcmlhYmxlJzogJydcbiAgfTtcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvKipcbiAgICogVGhlIHRlbXBsYXRlIHVzZWQgdG8gY3JlYXRlIGl0ZXJhdG9yIGZ1bmN0aW9ucy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmVjdH0gZGF0YSBUaGUgZGF0YSBvYmplY3QgdXNlZCB0byBwb3B1bGF0ZSB0aGUgdGV4dC5cbiAgICogQHJldHVybnMge1N0cmluZ30gUmV0dXJucyB0aGUgaW50ZXJwb2xhdGVkIHRleHQuXG4gICAqL1xuICB2YXIgaXRlcmF0b3JUZW1wbGF0ZSA9IHRlbXBsYXRlKFxuICAgIC8vIGNvbmRpdGlvbmFsIHN0cmljdCBtb2RlXG4gICAgJzwlIGlmIChvYmoudXNlU3RyaWN0KSB7ICU+XFwndXNlIHN0cmljdFxcJztcXG48JSB9ICU+JyArXG5cbiAgICAvLyB0aGUgYGl0ZXJhdGVlYCBtYXkgYmUgcmVhc3NpZ25lZCBieSB0aGUgYHRvcGAgc25pcHBldFxuICAgICd2YXIgaW5kZXgsIHZhbHVlLCBpdGVyYXRlZSA9IDwlPSBmaXJzdEFyZyAlPiwgJyArXG4gICAgLy8gYXNzaWduIHRoZSBgcmVzdWx0YCB2YXJpYWJsZSBhbiBpbml0aWFsIHZhbHVlXG4gICAgJ3Jlc3VsdCA9IDwlPSBmaXJzdEFyZyAlPjtcXG4nICtcbiAgICAvLyBleGl0IGVhcmx5IGlmIHRoZSBmaXJzdCBhcmd1bWVudCBpcyBmYWxzZXlcbiAgICAnaWYgKCE8JT0gZmlyc3RBcmcgJT4pIHJldHVybiByZXN1bHQ7XFxuJyArXG4gICAgLy8gYWRkIGNvZGUgYmVmb3JlIHRoZSBpdGVyYXRpb24gYnJhbmNoZXNcbiAgICAnPCU9IHRvcCAlPjtcXG4nICtcblxuICAgIC8vIGFycmF5LWxpa2UgaXRlcmF0aW9uOlxuICAgICc8JSBpZiAoYXJyYXlMb29wKSB7ICU+JyArXG4gICAgJ3ZhciBsZW5ndGggPSBpdGVyYXRlZS5sZW5ndGg7IGluZGV4ID0gLTE7XFxuJyArXG4gICAgJ2lmICh0eXBlb2YgbGVuZ3RoID09IFxcJ251bWJlclxcJykgeycgK1xuXG4gICAgLy8gYWRkIHN1cHBvcnQgZm9yIGFjY2Vzc2luZyBzdHJpbmcgY2hhcmFjdGVycyBieSBpbmRleCBpZiBuZWVkZWRcbiAgICAnICA8JSBpZiAobm9DaGFyQnlJbmRleCkgeyAlPlxcbicgK1xuICAgICcgIGlmIChpc1N0cmluZyhpdGVyYXRlZSkpIHtcXG4nICtcbiAgICAnICAgIGl0ZXJhdGVlID0gaXRlcmF0ZWUuc3BsaXQoXFwnXFwnKVxcbicgK1xuICAgICcgIH0nICtcbiAgICAnICA8JSB9ICU+XFxuJyArXG5cbiAgICAvLyBpdGVyYXRlIG92ZXIgdGhlIGFycmF5LWxpa2UgdmFsdWVcbiAgICAnICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xcbicgK1xuICAgICcgICAgdmFsdWUgPSBpdGVyYXRlZVtpbmRleF07XFxuJyArXG4gICAgJyAgICA8JT0gYXJyYXlMb29wICU+XFxuJyArXG4gICAgJyAgfVxcbicgK1xuICAgICd9XFxuJyArXG4gICAgJ2Vsc2UgeycgK1xuXG4gICAgLy8gb2JqZWN0IGl0ZXJhdGlvbjpcbiAgICAvLyBhZGQgc3VwcG9ydCBmb3IgaXRlcmF0aW5nIG92ZXIgYGFyZ3VtZW50c2Agb2JqZWN0cyBpZiBuZWVkZWRcbiAgICAnICA8JSAgfSBlbHNlIGlmIChub0FyZ3NFbnVtKSB7ICU+XFxuJyArXG4gICAgJyAgdmFyIGxlbmd0aCA9IGl0ZXJhdGVlLmxlbmd0aDsgaW5kZXggPSAtMTtcXG4nICtcbiAgICAnICBpZiAobGVuZ3RoICYmIGlzQXJndW1lbnRzKGl0ZXJhdGVlKSkge1xcbicgK1xuICAgICcgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcXG4nICtcbiAgICAnICAgICAgdmFsdWUgPSBpdGVyYXRlZVtpbmRleCArPSBcXCdcXCddO1xcbicgK1xuICAgICcgICAgICA8JT0gb2JqZWN0TG9vcCAlPlxcbicgK1xuICAgICcgICAgfVxcbicgK1xuICAgICcgIH0gZWxzZSB7JyArXG4gICAgJyAgPCUgfSAlPicgK1xuXG4gICAgLy8gRmlyZWZveCA8IDMuNiwgT3BlcmEgPiA5LjUwIC0gT3BlcmEgPCAxMS42MCwgYW5kIFNhZmFyaSA8IDUuMVxuICAgIC8vIChpZiB0aGUgcHJvdG90eXBlIG9yIGEgcHJvcGVydHkgb24gdGhlIHByb3RvdHlwZSBoYXMgYmVlbiBzZXQpXG4gICAgLy8gaW5jb3JyZWN0bHkgc2V0cyBhIGZ1bmN0aW9uJ3MgYHByb3RvdHlwZWAgcHJvcGVydHkgW1tFbnVtZXJhYmxlXV1cbiAgICAvLyB2YWx1ZSB0byBgdHJ1ZWAuIEJlY2F1c2Ugb2YgdGhpcyBMby1EYXNoIHN0YW5kYXJkaXplcyBvbiBza2lwcGluZ1xuICAgIC8vIHRoZSB0aGUgYHByb3RvdHlwZWAgcHJvcGVydHkgb2YgZnVuY3Rpb25zIHJlZ2FyZGxlc3Mgb2YgaXRzXG4gICAgLy8gW1tFbnVtZXJhYmxlXV0gdmFsdWUuXG4gICAgJyAgPCUgaWYgKCFoYXNEb250RW51bUJ1ZykgeyAlPlxcbicgK1xuICAgICcgIHZhciBza2lwUHJvdG8gPSB0eXBlb2YgaXRlcmF0ZWUgPT0gXFwnZnVuY3Rpb25cXCcgJiYgXFxuJyArXG4gICAgJyAgICBwcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKGl0ZXJhdGVlLCBcXCdwcm90b3R5cGVcXCcpO1xcbicgK1xuICAgICcgIDwlIH0gJT4nICtcblxuICAgIC8vIGl0ZXJhdGUgb3duIHByb3BlcnRpZXMgdXNpbmcgYE9iamVjdC5rZXlzYCBpZiBpdCdzIGZhc3RcbiAgICAnICA8JSBpZiAoaXNLZXlzRmFzdCAmJiB1c2VIYXMpIHsgJT5cXG4nICtcbiAgICAnICB2YXIgb3duSW5kZXggPSAtMSxcXG4nICtcbiAgICAnICAgICAgb3duUHJvcHMgPSBvYmplY3RUeXBlc1t0eXBlb2YgaXRlcmF0ZWVdID8gbmF0aXZlS2V5cyhpdGVyYXRlZSkgOiBbXSxcXG4nICtcbiAgICAnICAgICAgbGVuZ3RoID0gb3duUHJvcHMubGVuZ3RoO1xcblxcbicgK1xuICAgICcgIHdoaWxlICgrK293bkluZGV4IDwgbGVuZ3RoKSB7XFxuJyArXG4gICAgJyAgICBpbmRleCA9IG93blByb3BzW293bkluZGV4XTtcXG4nICtcbiAgICAnICAgIDwlIGlmICghaGFzRG9udEVudW1CdWcpIHsgJT5pZiAoIShza2lwUHJvdG8gJiYgaW5kZXggPT0gXFwncHJvdG90eXBlXFwnKSkge1xcbiAgPCUgfSAlPicgK1xuICAgICcgICAgdmFsdWUgPSBpdGVyYXRlZVtpbmRleF07XFxuJyArXG4gICAgJyAgICA8JT0gb2JqZWN0TG9vcCAlPlxcbicgK1xuICAgICcgICAgPCUgaWYgKCFoYXNEb250RW51bUJ1ZykgeyAlPn1cXG48JSB9ICU+JyArXG4gICAgJyAgfScgK1xuXG4gICAgLy8gZWxzZSB1c2luZyBhIGZvci1pbiBsb29wXG4gICAgJyAgPCUgfSBlbHNlIHsgJT5cXG4nICtcbiAgICAnICBmb3IgKGluZGV4IGluIGl0ZXJhdGVlKSB7PCUnICtcbiAgICAnICAgIGlmICghaGFzRG9udEVudW1CdWcgfHwgdXNlSGFzKSB7ICU+XFxuICAgIGlmICg8JScgK1xuICAgICcgICAgICBpZiAoIWhhc0RvbnRFbnVtQnVnKSB7ICU+IShza2lwUHJvdG8gJiYgaW5kZXggPT0gXFwncHJvdG90eXBlXFwnKTwlIH0nICtcbiAgICAnICAgICAgaWYgKCFoYXNEb250RW51bUJ1ZyAmJiB1c2VIYXMpIHsgJT4gJiYgPCUgfScgK1xuICAgICcgICAgICBpZiAodXNlSGFzKSB7ICU+aGFzT3duUHJvcGVydHkuY2FsbChpdGVyYXRlZSwgaW5kZXgpPCUgfScgK1xuICAgICcgICAgJT4pIHsnICtcbiAgICAnICAgIDwlIH0gJT5cXG4nICtcbiAgICAnICAgIHZhbHVlID0gaXRlcmF0ZWVbaW5kZXhdO1xcbicgK1xuICAgICcgICAgPCU9IG9iamVjdExvb3AgJT47JyArXG4gICAgJyAgICA8JSBpZiAoIWhhc0RvbnRFbnVtQnVnIHx8IHVzZUhhcykgeyAlPlxcbiAgICB9PCUgfSAlPlxcbicgK1xuICAgICcgIH0nICtcbiAgICAnICA8JSB9ICU+JyArXG5cbiAgICAvLyBCZWNhdXNlIElFIDwgOSBjYW4ndCBzZXQgdGhlIGBbW0VudW1lcmFibGVdXWAgYXR0cmlidXRlIG9mIGFuXG4gICAgLy8gZXhpc3RpbmcgcHJvcGVydHkgYW5kIHRoZSBgY29uc3RydWN0b3JgIHByb3BlcnR5IG9mIGEgcHJvdG90eXBlXG4gICAgLy8gZGVmYXVsdHMgdG8gbm9uLWVudW1lcmFibGUsIExvLURhc2ggc2tpcHMgdGhlIGBjb25zdHJ1Y3RvcmBcbiAgICAvLyBwcm9wZXJ0eSB3aGVuIGl0IGluZmVycyBpdCdzIGl0ZXJhdGluZyBvdmVyIGEgYHByb3RvdHlwZWAgb2JqZWN0LlxuICAgICcgIDwlIGlmIChoYXNEb250RW51bUJ1ZykgeyAlPlxcblxcbicgK1xuICAgICcgIHZhciBjdG9yID0gaXRlcmF0ZWUuY29uc3RydWN0b3I7XFxuJyArXG4gICAgJyAgICA8JSBmb3IgKHZhciBrID0gMDsgayA8IDc7IGsrKykgeyAlPlxcbicgK1xuICAgICcgIGluZGV4ID0gXFwnPCU9IHNoYWRvd2VkW2tdICU+XFwnO1xcbicgK1xuICAgICcgIGlmICg8JScgK1xuICAgICcgICAgICBpZiAoc2hhZG93ZWRba10gPT0gXFwnY29uc3RydWN0b3JcXCcpIHsnICtcbiAgICAnICAgICAgICAlPiEoY3RvciAmJiBjdG9yLnByb3RvdHlwZSA9PT0gaXRlcmF0ZWUpICYmIDwlJyArXG4gICAgJyAgICAgIH0gJT5oYXNPd25Qcm9wZXJ0eS5jYWxsKGl0ZXJhdGVlLCBpbmRleCkpIHtcXG4nICtcbiAgICAnICAgIHZhbHVlID0gaXRlcmF0ZWVbaW5kZXhdO1xcbicgK1xuICAgICcgICAgPCU9IG9iamVjdExvb3AgJT5cXG4nICtcbiAgICAnICB9JyArXG4gICAgJyAgICA8JSB9ICU+JyArXG4gICAgJyAgPCUgfSAlPicgK1xuICAgICcgIDwlIGlmIChhcnJheUxvb3AgfHwgbm9BcmdzRW51bSkgeyAlPlxcbn08JSB9ICU+XFxuJyArXG5cbiAgICAvLyBhZGQgY29kZSB0byB0aGUgYm90dG9tIG9mIHRoZSBpdGVyYXRpb24gZnVuY3Rpb25cbiAgICAnPCU9IGJvdHRvbSAlPjtcXG4nICtcbiAgICAvLyBmaW5hbGx5LCByZXR1cm4gdGhlIGByZXN1bHRgXG4gICAgJ3JldHVybiByZXN1bHQnXG4gICk7XG5cbiAgLyoqXG4gICAqIFJldXNhYmxlIGl0ZXJhdG9yIG9wdGlvbnMgc2hhcmVkIGJ5IGBmb3JFYWNoYCwgYGZvckluYCwgYW5kIGBmb3JPd25gLlxuICAgKi9cbiAgdmFyIGZvckVhY2hJdGVyYXRvck9wdGlvbnMgPSB7XG4gICAgJ2FyZ3MnOiAnY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcnLFxuICAgICd0b3AnOiAnY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyknLFxuICAgICdhcnJheUxvb3AnOiAnaWYgKGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikgPT09IGZhbHNlKSByZXR1cm4gcmVzdWx0JyxcbiAgICAnb2JqZWN0TG9vcCc6ICdpZiAoY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSA9PT0gZmFsc2UpIHJldHVybiByZXN1bHQnXG4gIH07XG5cbiAgLyoqIFJldXNhYmxlIGl0ZXJhdG9yIG9wdGlvbnMgZm9yIGBkZWZhdWx0c2AsIGFuZCBgZXh0ZW5kYCAqL1xuICB2YXIgZXh0ZW5kSXRlcmF0b3JPcHRpb25zID0ge1xuICAgICd1c2VIYXMnOiBmYWxzZSxcbiAgICAnYXJncyc6ICdvYmplY3QnLFxuICAgICd0b3AnOlxuICAgICAgJ2ZvciAodmFyIGFyZ3NJbmRleCA9IDEsIGFyZ3NMZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoOyBhcmdzSW5kZXggPCBhcmdzTGVuZ3RoOyBhcmdzSW5kZXgrKykge1xcbicgK1xuICAgICAgJyAgaWYgKGl0ZXJhdGVlID0gYXJndW1lbnRzW2FyZ3NJbmRleF0pIHsnLFxuICAgICdvYmplY3RMb29wJzogJ3Jlc3VsdFtpbmRleF0gPSB2YWx1ZScsXG4gICAgJ2JvdHRvbSc6ICcgIH1cXG59J1xuICB9O1xuXG4gIC8qKiBSZXVzYWJsZSBpdGVyYXRvciBvcHRpb25zIGZvciBgZm9ySW5gIGFuZCBgZm9yT3duYCAqL1xuICB2YXIgZm9yT3duSXRlcmF0b3JPcHRpb25zID0ge1xuICAgICdhcnJheUxvb3AnOiBudWxsXG4gIH07XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBmdW5jdGlvbiBvcHRpbWl6ZWQgdG8gc2VhcmNoIGxhcmdlIGFycmF5cyBmb3IgYSBnaXZlbiBgdmFsdWVgLFxuICAgKiBzdGFydGluZyBhdCBgZnJvbUluZGV4YCwgdXNpbmcgc3RyaWN0IGVxdWFsaXR5IGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHNlYXJjaC5cbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIHNlYXJjaCBmb3IuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbZnJvbUluZGV4PTBdIFRoZSBpbmRleCB0byBzZWFyY2ggZnJvbS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IFtsYXJnZVNpemU9MzBdIFRoZSBsZW5ndGggYXQgd2hpY2ggYW4gYXJyYXkgaXMgY29uc2lkZXJlZCBsYXJnZS5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgZm91bmQsIGVsc2UgYGZhbHNlYC5cbiAgICovXG4gIGZ1bmN0aW9uIGNhY2hlZENvbnRhaW5zKGFycmF5LCBmcm9tSW5kZXgsIGxhcmdlU2l6ZSkge1xuICAgIGZyb21JbmRleCB8fCAoZnJvbUluZGV4ID0gMCk7XG5cbiAgICB2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoLFxuICAgICAgICBpc0xhcmdlID0gKGxlbmd0aCAtIGZyb21JbmRleCkgPj0gKGxhcmdlU2l6ZSB8fCBsYXJnZUFycmF5U2l6ZSk7XG5cbiAgICBpZiAoaXNMYXJnZSkge1xuICAgICAgdmFyIGNhY2hlID0ge30sXG4gICAgICAgICAgaW5kZXggPSBmcm9tSW5kZXggLSAxO1xuXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAvLyBtYW51YWxseSBjb2VyY2UgYHZhbHVlYCB0byBhIHN0cmluZyBiZWNhdXNlIGBoYXNPd25Qcm9wZXJ0eWAsIGluIHNvbWVcbiAgICAgICAgLy8gb2xkZXIgdmVyc2lvbnMgb2YgRmlyZWZveCwgY29lcmNlcyBvYmplY3RzIGluY29ycmVjdGx5XG4gICAgICAgIHZhciBrZXkgPSBhcnJheVtpbmRleF0gKyAnJztcbiAgICAgICAgKGhhc093blByb3BlcnR5LmNhbGwoY2FjaGUsIGtleSkgPyBjYWNoZVtrZXldIDogKGNhY2hlW2tleV0gPSBbXSkpLnB1c2goYXJyYXlbaW5kZXhdKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBpZiAoaXNMYXJnZSkge1xuICAgICAgICB2YXIga2V5ID0gdmFsdWUgKyAnJztcbiAgICAgICAgcmV0dXJuIGhhc093blByb3BlcnR5LmNhbGwoY2FjaGUsIGtleSkgJiYgaW5kZXhPZihjYWNoZVtrZXldLCB2YWx1ZSkgPiAtMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbmRleE9mKGFycmF5LCB2YWx1ZSwgZnJvbUluZGV4KSA+IC0xO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBVc2VkIGJ5IGBfLm1heGAgYW5kIGBfLm1pbmAgYXMgdGhlIGRlZmF1bHQgYGNhbGxiYWNrYCB3aGVuIGEgZ2l2ZW5cbiAgICogYGNvbGxlY3Rpb25gIGlzIGEgc3RyaW5nIHZhbHVlLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgVGhlIGNoYXJhY3RlciB0byBpbnNwZWN0LlxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSBSZXR1cm5zIHRoZSBjb2RlIHVuaXQgb2YgZ2l2ZW4gY2hhcmFjdGVyLlxuICAgKi9cbiAgZnVuY3Rpb24gY2hhckF0Q2FsbGJhY2sodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUuY2hhckNvZGVBdCgwKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVc2VkIGJ5IGBzb3J0QnlgIHRvIGNvbXBhcmUgdHJhbnNmb3JtZWQgYGNvbGxlY3Rpb25gIHZhbHVlcywgc3RhYmxlIHNvcnRpbmdcbiAgICogdGhlbSBpbiBhc2NlbmRpbmcgb3JkZXIuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBhIFRoZSBvYmplY3QgdG8gY29tcGFyZSB0byBgYmAuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBiIFRoZSBvYmplY3QgdG8gY29tcGFyZSB0byBgYWAuXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IFJldHVybnMgdGhlIHNvcnQgb3JkZXIgaW5kaWNhdG9yIG9mIGAxYCBvciBgLTFgLlxuICAgKi9cbiAgZnVuY3Rpb24gY29tcGFyZUFzY2VuZGluZyhhLCBiKSB7XG4gICAgdmFyIGFpID0gYS5pbmRleCxcbiAgICAgICAgYmkgPSBiLmluZGV4O1xuXG4gICAgYSA9IGEuY3JpdGVyaWE7XG4gICAgYiA9IGIuY3JpdGVyaWE7XG5cbiAgICAvLyBlbnN1cmUgYSBzdGFibGUgc29ydCBpbiBWOCBhbmQgb3RoZXIgZW5naW5lc1xuICAgIC8vIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTkwXG4gICAgaWYgKGEgIT09IGIpIHtcbiAgICAgIGlmIChhID4gYiB8fCBhID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgICB9XG4gICAgICBpZiAoYSA8IGIgfHwgYiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiAtMTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFpIDwgYmkgPyAtMSA6IDE7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gY2FsbGVkLCBpbnZva2VzIGBmdW5jYCB3aXRoIHRoZSBgdGhpc2BcbiAgICogYmluZGluZyBvZiBgdGhpc0FyZ2AgYW5kIHByZXBlbmRzIGFueSBgcGFydGFpbEFyZ3NgIHRvIHRoZSBhcmd1bWVudHMgcGFzc2VkXG4gICAqIHRvIHRoZSBib3VuZCBmdW5jdGlvbi5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtGdW5jdGlvbnxTdHJpbmd9IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGJpbmQgb3IgdGhlIG1ldGhvZCBuYW1lLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAgICogQHBhcmFtIHtBcnJheX0gcGFydGlhbEFyZ3MgQW4gYXJyYXkgb2YgYXJndW1lbnRzIHRvIGJlIHBhcnRpYWxseSBhcHBsaWVkLlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBib3VuZCBmdW5jdGlvbi5cbiAgICovXG4gIGZ1bmN0aW9uIGNyZWF0ZUJvdW5kKGZ1bmMsIHRoaXNBcmcsIHBhcnRpYWxBcmdzKSB7XG4gICAgdmFyIGlzRnVuYyA9IGlzRnVuY3Rpb24oZnVuYyksXG4gICAgICAgIGlzUGFydGlhbCA9ICFwYXJ0aWFsQXJncyxcbiAgICAgICAgbWV0aG9kTmFtZSA9IGZ1bmM7XG5cbiAgICAvLyBqdWdnbGUgYXJndW1lbnRzXG4gICAgaWYgKGlzUGFydGlhbCkge1xuICAgICAgcGFydGlhbEFyZ3MgPSB0aGlzQXJnO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJvdW5kKCkge1xuICAgICAgLy8gYEZ1bmN0aW9uI2JpbmRgIHNwZWNcbiAgICAgIC8vIGh0dHA6Ly9lczUuZ2l0aHViLmNvbS8jeDE1LjMuNC41XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgICB0aGlzQmluZGluZyA9IGlzUGFydGlhbCA/IHRoaXMgOiB0aGlzQXJnO1xuXG4gICAgICBpZiAoIWlzRnVuYykge1xuICAgICAgICBmdW5jID0gdGhpc0FyZ1ttZXRob2ROYW1lXTtcbiAgICAgIH1cbiAgICAgIGlmIChwYXJ0aWFsQXJncy5sZW5ndGgpIHtcbiAgICAgICAgYXJncyA9IGFyZ3MubGVuZ3RoXG4gICAgICAgICAgPyBwYXJ0aWFsQXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmdzKSlcbiAgICAgICAgICA6IHBhcnRpYWxBcmdzO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkge1xuICAgICAgICAvLyBnZXQgYGZ1bmNgIGluc3RhbmNlIGlmIGBib3VuZGAgaXMgaW52b2tlZCBpbiBhIGBuZXdgIGV4cHJlc3Npb25cbiAgICAgICAgbm9vcC5wcm90b3R5cGUgPSBmdW5jLnByb3RvdHlwZTtcbiAgICAgICAgdGhpc0JpbmRpbmcgPSBuZXcgbm9vcDtcblxuICAgICAgICAvLyBtaW1pYyB0aGUgY29uc3RydWN0b3IncyBgcmV0dXJuYCBiZWhhdmlvclxuICAgICAgICAvLyBodHRwOi8vZXM1LmdpdGh1Yi5jb20vI3gxMy4yLjJcbiAgICAgICAgdmFyIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpc0JpbmRpbmcsIGFyZ3MpO1xuICAgICAgICByZXR1cm4gaXNPYmplY3QocmVzdWx0KVxuICAgICAgICAgID8gcmVzdWx0XG4gICAgICAgICAgOiB0aGlzQmluZGluZ1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpc0JpbmRpbmcsIGFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gYm91bmQ7XG4gIH1cblxuICAvKipcbiAgICogUHJvZHVjZXMgYW4gaXRlcmF0aW9uIGNhbGxiYWNrIGJvdW5kIHRvIGFuIG9wdGlvbmFsIGB0aGlzQXJnYC4gSWYgYGZ1bmNgIGlzXG4gICAqIGEgcHJvcGVydHkgbmFtZSwgdGhlIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBmb3IgYSBnaXZlbiBlbGVtZW50LlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufFN0cmluZ30gW2Z1bmM9aWRlbnRpdHl8cHJvcGVydHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyXG4gICAqIGl0ZXJhdGlvbiBvciBwcm9wZXJ0eSBuYW1lIHRvIHF1ZXJ5LlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyBhIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gY3JlYXRlQ2FsbGJhY2soZnVuYywgdGhpc0FyZykge1xuICAgIGlmICghZnVuYykge1xuICAgICAgcmV0dXJuIGlkZW50aXR5O1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGZ1bmMgIT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgICAgICByZXR1cm4gb2JqZWN0W2Z1bmNdO1xuICAgICAgfTtcbiAgICB9XG4gICAgaWYgKHRoaXNBcmcgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgb2JqZWN0KSB7XG4gICAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgdmFsdWUsIGluZGV4LCBvYmplY3QpO1xuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmM7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBjb21waWxlZCBpdGVyYXRpb24gZnVuY3Rpb25zLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMxLCBvcHRpb25zMiwgLi4uXSBUaGUgY29tcGlsZSBvcHRpb25zIG9iamVjdChzKS5cbiAgICogIHVzZUhhcyAtIEEgYm9vbGVhbiB0byBzcGVjaWZ5IHVzaW5nIGBoYXNPd25Qcm9wZXJ0eWAgY2hlY2tzIGluIHRoZSBvYmplY3QgbG9vcC5cbiAgICogIGFyZ3MgLSBBIHN0cmluZyBvZiBjb21tYSBzZXBhcmF0ZWQgYXJndW1lbnRzIHRoZSBpdGVyYXRpb24gZnVuY3Rpb24gd2lsbCBhY2NlcHQuXG4gICAqICB0b3AgLSBBIHN0cmluZyBvZiBjb2RlIHRvIGV4ZWN1dGUgYmVmb3JlIHRoZSBpdGVyYXRpb24gYnJhbmNoZXMuXG4gICAqICBhcnJheUxvb3AgLSBBIHN0cmluZyBvZiBjb2RlIHRvIGV4ZWN1dGUgaW4gdGhlIGFycmF5IGxvb3AuXG4gICAqICBvYmplY3RMb29wIC0gQSBzdHJpbmcgb2YgY29kZSB0byBleGVjdXRlIGluIHRoZSBvYmplY3QgbG9vcC5cbiAgICogIGJvdHRvbSAtIEEgc3RyaW5nIG9mIGNvZGUgdG8gZXhlY3V0ZSBhZnRlciB0aGUgaXRlcmF0aW9uIGJyYW5jaGVzLlxuICAgKlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gY3JlYXRlSXRlcmF0b3IoKSB7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICAnYXJyYXlMb29wJzogJycsXG4gICAgICAnYm90dG9tJzogJycsXG4gICAgICAnaGFzRG9udEVudW1CdWcnOiBoYXNEb250RW51bUJ1ZyxcbiAgICAgICdpc0tleXNGYXN0JzogaXNLZXlzRmFzdCxcbiAgICAgICdvYmplY3RMb29wJzogJycsXG4gICAgICAnbm9BcmdzRW51bSc6IG5vQXJnc0VudW0sXG4gICAgICAnbm9DaGFyQnlJbmRleCc6IG5vQ2hhckJ5SW5kZXgsXG4gICAgICAnc2hhZG93ZWQnOiBzaGFkb3dlZCxcbiAgICAgICd0b3AnOiAnJyxcbiAgICAgICd1c2VIYXMnOiB0cnVlXG4gICAgfTtcblxuICAgIC8vIG1lcmdlIG9wdGlvbnMgaW50byBhIHRlbXBsYXRlIGRhdGEgb2JqZWN0XG4gICAgZm9yICh2YXIgb2JqZWN0LCBpbmRleCA9IDA7IG9iamVjdCA9IGFyZ3VtZW50c1tpbmRleF07IGluZGV4KyspIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICAgICAgZGF0YVtrZXldID0gb2JqZWN0W2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBhcmdzID0gZGF0YS5hcmdzO1xuICAgIGRhdGEuZmlyc3RBcmcgPSAvXlteLF0rLy5leGVjKGFyZ3MpWzBdO1xuXG4gICAgLy8gY3JlYXRlIHRoZSBmdW5jdGlvbiBmYWN0b3J5XG4gICAgdmFyIGZhY3RvcnkgPSBGdW5jdGlvbihcbiAgICAgICAgJ2NyZWF0ZUNhbGxiYWNrLCBoYXNPd25Qcm9wZXJ0eSwgaXNBcmd1bWVudHMsIGlzU3RyaW5nLCBvYmplY3RUeXBlcywgJyArXG4gICAgICAgICduYXRpdmVLZXlzLCBwcm9wZXJ0eUlzRW51bWVyYWJsZScsXG4gICAgICAncmV0dXJuIGZ1bmN0aW9uKCcgKyBhcmdzICsgJykge1xcbicgKyBpdGVyYXRvclRlbXBsYXRlKGRhdGEpICsgJ1xcbn0nXG4gICAgKTtcbiAgICAvLyByZXR1cm4gdGhlIGNvbXBpbGVkIGZ1bmN0aW9uXG4gICAgcmV0dXJuIGZhY3RvcnkoXG4gICAgICBjcmVhdGVDYWxsYmFjaywgaGFzT3duUHJvcGVydHksIGlzQXJndW1lbnRzLCBpc1N0cmluZywgb2JqZWN0VHlwZXMsXG4gICAgICBuYXRpdmVLZXlzLCBwcm9wZXJ0eUlzRW51bWVyYWJsZVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogVXNlZCBieSBgdGVtcGxhdGVgIHRvIGVzY2FwZSBjaGFyYWN0ZXJzIGZvciBpbmNsdXNpb24gaW4gY29tcGlsZWRcbiAgICogc3RyaW5nIGxpdGVyYWxzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWF0Y2ggVGhlIG1hdGNoZWQgY2hhcmFjdGVyIHRvIGVzY2FwZS5cbiAgICogQHJldHVybnMge1N0cmluZ30gUmV0dXJucyB0aGUgZXNjYXBlZCBjaGFyYWN0ZXIuXG4gICAqL1xuICBmdW5jdGlvbiBlc2NhcGVTdHJpbmdDaGFyKG1hdGNoKSB7XG4gICAgcmV0dXJuICdcXFxcJyArIHN0cmluZ0VzY2FwZXNbbWF0Y2hdO1xuICB9XG5cbiAgLyoqXG4gICAqIFVzZWQgYnkgYGVzY2FwZWAgdG8gY29udmVydCBjaGFyYWN0ZXJzIHRvIEhUTUwgZW50aXRpZXMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtYXRjaCBUaGUgbWF0Y2hlZCBjaGFyYWN0ZXIgdG8gZXNjYXBlLlxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBSZXR1cm5zIHRoZSBlc2NhcGVkIGNoYXJhY3Rlci5cbiAgICovXG4gIGZ1bmN0aW9uIGVzY2FwZUh0bWxDaGFyKG1hdGNoKSB7XG4gICAgcmV0dXJuIGh0bWxFc2NhcGVzW21hdGNoXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIG5vLW9wZXJhdGlvbiBmdW5jdGlvbi5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIG5vb3AoKSB7XG4gICAgLy8gbm8gb3BlcmF0aW9uIHBlcmZvcm1lZFxuICB9XG5cbiAgLyoqXG4gICAqIFVzZWQgYnkgYHVuZXNjYXBlYCB0byBjb252ZXJ0IEhUTUwgZW50aXRpZXMgdG8gY2hhcmFjdGVycy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1hdGNoIFRoZSBtYXRjaGVkIGNoYXJhY3RlciB0byB1bmVzY2FwZS5cbiAgICogQHJldHVybnMge1N0cmluZ30gUmV0dXJucyB0aGUgdW5lc2NhcGVkIGNoYXJhY3Rlci5cbiAgICovXG4gIGZ1bmN0aW9uIHVuZXNjYXBlSHRtbENoYXIobWF0Y2gpIHtcbiAgICByZXR1cm4gaHRtbFVuZXNjYXBlc1ttYXRjaF07XG4gIH1cblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYW4gYGFyZ3VtZW50c2Agb2JqZWN0LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGFuIGBhcmd1bWVudHNgIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiAoZnVuY3Rpb24oKSB7IHJldHVybiBfLmlzQXJndW1lbnRzKGFyZ3VtZW50cyk7IH0pKDEsIDIsIDMpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uaXNBcmd1bWVudHMoWzEsIDIsIDNdKTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICovXG4gIGZ1bmN0aW9uIGlzQXJndW1lbnRzKHZhbHVlKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsdWUpID09IGFyZ3NDbGFzcztcbiAgfVxuICAvLyBmYWxsYmFjayBmb3IgYnJvd3NlcnMgdGhhdCBjYW4ndCBkZXRlY3QgYGFyZ3VtZW50c2Agb2JqZWN0cyBieSBbW0NsYXNzXV1cbiAgaWYgKG5vQXJnc0NsYXNzKSB7XG4gICAgaXNBcmd1bWVudHMgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuIHZhbHVlID8gaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgJ2NhbGxlZScpIDogZmFsc2U7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJdGVyYXRlcyBvdmVyIGBvYmplY3RgJ3Mgb3duIGFuZCBpbmhlcml0ZWQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzLCBleGVjdXRpbmdcbiAgICogdGhlIGBjYWxsYmFja2AgZm9yIGVhY2ggcHJvcGVydHkuIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmRcbiAgICogaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBrZXksIG9iamVjdCkuIENhbGxiYWNrcyBtYXkgZXhpdCBpdGVyYXRpb25cbiAgICogZWFybHkgYnkgZXhwbGljaXRseSByZXR1cm5pbmcgYGZhbHNlYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogZnVuY3Rpb24gRG9nKG5hbWUpIHtcbiAgICogICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgKiB9XG4gICAqXG4gICAqIERvZy5wcm90b3R5cGUuYmFyayA9IGZ1bmN0aW9uKCkge1xuICAgKiAgIGFsZXJ0KCdXb29mLCB3b29mIScpO1xuICAgKiB9O1xuICAgKlxuICAgKiBfLmZvckluKG5ldyBEb2coJ0RhZ255JyksIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICogICBhbGVydChrZXkpO1xuICAgKiB9KTtcbiAgICogLy8gPT4gYWxlcnRzICduYW1lJyBhbmQgJ2JhcmsnIChvcmRlciBpcyBub3QgZ3VhcmFudGVlZClcbiAgICovXG4gIHZhciBmb3JJbiA9IGNyZWF0ZUl0ZXJhdG9yKGZvckVhY2hJdGVyYXRvck9wdGlvbnMsIGZvck93bkl0ZXJhdG9yT3B0aW9ucywge1xuICAgICd1c2VIYXMnOiBmYWxzZVxuICB9KTtcblxuICAvKipcbiAgICogSXRlcmF0ZXMgb3ZlciBgb2JqZWN0YCdzIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMsIGV4ZWN1dGluZyB0aGUgYGNhbGxiYWNrYFxuICAgKiBmb3IgZWFjaCBwcm9wZXJ0eS4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWVcbiAgICogYXJndW1lbnRzOyAodmFsdWUsIGtleSwgb2JqZWN0KS4gQ2FsbGJhY2tzIG1heSBleGl0IGl0ZXJhdGlvbiBlYXJseSBieSBleHBsaWNpdGx5XG4gICAqIHJldHVybmluZyBgZmFsc2VgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmZvck93bih7ICcwJzogJ3plcm8nLCAnMSc6ICdvbmUnLCAnbGVuZ3RoJzogMiB9LCBmdW5jdGlvbihudW0sIGtleSkge1xuICAgKiAgIGFsZXJ0KGtleSk7XG4gICAqIH0pO1xuICAgKiAvLyA9PiBhbGVydHMgJzAnLCAnMScsIGFuZCAnbGVuZ3RoJyAob3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gICAqL1xuICB2YXIgZm9yT3duID0gY3JlYXRlSXRlcmF0b3IoZm9yRWFjaEl0ZXJhdG9yT3B0aW9ucywgZm9yT3duSXRlcmF0b3JPcHRpb25zKTtcblxuICAvKipcbiAgICogQSBmYWxsYmFjayBpbXBsZW1lbnRhdGlvbiBvZiBgaXNQbGFpbk9iamVjdGAgdGhhdCBjaGVja3MgaWYgYSBnaXZlbiBgdmFsdWVgXG4gICAqIGlzIGFuIG9iamVjdCBjcmVhdGVkIGJ5IHRoZSBgT2JqZWN0YCBjb25zdHJ1Y3RvciwgYXNzdW1pbmcgb2JqZWN0cyBjcmVhdGVkXG4gICAqIGJ5IHRoZSBgT2JqZWN0YCBjb25zdHJ1Y3RvciBoYXZlIG5vIGluaGVyaXRlZCBlbnVtZXJhYmxlIHByb3BlcnRpZXMgYW5kIHRoYXRcbiAgICogdGhlcmUgYXJlIG5vIGBPYmplY3QucHJvdG90eXBlYCBleHRlbnNpb25zLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgcGxhaW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gICAqL1xuICBmdW5jdGlvbiBzaGltSXNQbGFpbk9iamVjdCh2YWx1ZSkge1xuICAgIC8vIGF2b2lkIG5vbi1vYmplY3RzIGFuZCBmYWxzZSBwb3NpdGl2ZXMgZm9yIGBhcmd1bWVudHNgIG9iamVjdHNcbiAgICB2YXIgcmVzdWx0ID0gZmFsc2U7XG4gICAgaWYgKCEodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnKSB8fCBpc0FyZ3VtZW50cyh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIC8vIElFIDwgOSBwcmVzZW50cyBET00gbm9kZXMgYXMgYE9iamVjdGAgb2JqZWN0cyBleGNlcHQgdGhleSBoYXZlIGB0b1N0cmluZ2BcbiAgICAvLyBtZXRob2RzIHRoYXQgYXJlIGB0eXBlb2ZgIFwic3RyaW5nXCIgYW5kIHN0aWxsIGNhbiBjb2VyY2Ugbm9kZXMgdG8gc3RyaW5ncy5cbiAgICAvLyBBbHNvIGNoZWNrIHRoYXQgdGhlIGNvbnN0cnVjdG9yIGlzIGBPYmplY3RgIChpLmUuIGBPYmplY3QgaW5zdGFuY2VvZiBPYmplY3RgKVxuICAgIHZhciBjdG9yID0gdmFsdWUuY29uc3RydWN0b3I7XG4gICAgaWYgKCghbm9Ob2RlQ2xhc3MgfHwgISh0eXBlb2YgdmFsdWUudG9TdHJpbmcgIT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgKHZhbHVlICsgJycpID09ICdzdHJpbmcnKSkgJiZcbiAgICAgICAgKCFpc0Z1bmN0aW9uKGN0b3IpIHx8IGN0b3IgaW5zdGFuY2VvZiBjdG9yKSkge1xuICAgICAgLy8gSUUgPCA5IGl0ZXJhdGVzIGluaGVyaXRlZCBwcm9wZXJ0aWVzIGJlZm9yZSBvd24gcHJvcGVydGllcy4gSWYgdGhlIGZpcnN0XG4gICAgICAvLyBpdGVyYXRlZCBwcm9wZXJ0eSBpcyBhbiBvYmplY3QncyBvd24gcHJvcGVydHkgdGhlbiB0aGVyZSBhcmUgbm8gaW5oZXJpdGVkXG4gICAgICAvLyBlbnVtZXJhYmxlIHByb3BlcnRpZXMuXG4gICAgICBpZiAoaXRlcmF0ZXNPd25MYXN0KSB7XG4gICAgICAgIGZvckluKHZhbHVlLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBvYmplY3QpIHtcbiAgICAgICAgICByZXN1bHQgPSAhaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIGtleSk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdCA9PT0gZmFsc2U7XG4gICAgICB9XG4gICAgICAvLyBJbiBtb3N0IGVudmlyb25tZW50cyBhbiBvYmplY3QncyBvd24gcHJvcGVydGllcyBhcmUgaXRlcmF0ZWQgYmVmb3JlXG4gICAgICAvLyBpdHMgaW5oZXJpdGVkIHByb3BlcnRpZXMuIElmIHRoZSBsYXN0IGl0ZXJhdGVkIHByb3BlcnR5IGlzIGFuIG9iamVjdCdzXG4gICAgICAvLyBvd24gcHJvcGVydHkgdGhlbiB0aGVyZSBhcmUgbm8gaW5oZXJpdGVkIGVudW1lcmFibGUgcHJvcGVydGllcy5cbiAgICAgIGZvckluKHZhbHVlLCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICAgIHJlc3VsdCA9IGtleTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdCA9PT0gZmFsc2UgfHwgaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgcmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIGZhbGxiYWNrIGltcGxlbWVudGF0aW9uIG9mIGBPYmplY3Qua2V5c2AgdGhhdCBwcm9kdWNlcyBhbiBhcnJheSBvZiB0aGVcbiAgICogZ2l2ZW4gb2JqZWN0J3Mgb3duIGVudW1lcmFibGUgcHJvcGVydHkgbmFtZXMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnNwZWN0LlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgcHJvcGVydHkgbmFtZXMuXG4gICAqL1xuICBmdW5jdGlvbiBzaGltS2V5cyhvYmplY3QpIHtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgZm9yT3duKG9iamVjdCwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIFVzZWQgdG8gY29udmVydCBjaGFyYWN0ZXJzIHRvIEhUTUwgZW50aXRpZXM6XG4gICAqXG4gICAqIFRob3VnaCB0aGUgYD5gIGNoYXJhY3RlciBpcyBlc2NhcGVkIGZvciBzeW1tZXRyeSwgY2hhcmFjdGVycyBsaWtlIGA+YCBhbmQgYC9gXG4gICAqIGRvbid0IHJlcXVpcmUgZXNjYXBpbmcgaW4gSFRNTCBhbmQgaGF2ZSBubyBzcGVjaWFsIG1lYW5pbmcgdW5sZXNzIHRoZXkncmUgcGFydFxuICAgKiBvZiBhIHRhZyBvciBhbiB1bnF1b3RlZCBhdHRyaWJ1dGUgdmFsdWUuXG4gICAqIGh0dHA6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2FtYmlndW91cy1hbXBlcnNhbmRzICh1bmRlciBcInNlbWktcmVsYXRlZCBmdW4gZmFjdFwiKVxuICAgKi9cbiAgdmFyIGh0bWxFc2NhcGVzID0ge1xuICAgICcmJzogJyZhbXA7JyxcbiAgICAnPCc6ICcmbHQ7JyxcbiAgICAnPic6ICcmZ3Q7JyxcbiAgICAnXCInOiAnJnF1b3Q7JyxcbiAgICBcIidcIjogJyYjeDI3OydcbiAgfTtcblxuICAvKiogVXNlZCB0byBjb252ZXJ0IEhUTUwgZW50aXRpZXMgdG8gY2hhcmFjdGVycyAqL1xuICB2YXIgaHRtbFVuZXNjYXBlcyA9IGludmVydChodG1sRXNjYXBlcyk7XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBjbG9uZSBvZiBgdmFsdWVgLiBJZiBgZGVlcGAgaXMgYHRydWVgLCBhbGwgbmVzdGVkIG9iamVjdHMgd2lsbFxuICAgKiBhbHNvIGJlIGNsb25lZCBvdGhlcndpc2UgdGhleSB3aWxsIGJlIGFzc2lnbmVkIGJ5IHJlZmVyZW5jZS4gRnVuY3Rpb25zLCBET01cbiAgICogbm9kZXMsIGBhcmd1bWVudHNgIG9iamVjdHMsIGFuZCBvYmplY3RzIGNyZWF0ZWQgYnkgY29uc3RydWN0b3JzIG90aGVyIHRoYW5cbiAgICogYE9iamVjdGAgYXJlICoqbm90KiogY2xvbmVkLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjbG9uZS5cbiAgICogQHBhcmFtIHtCb29sZWFufSBkZWVwIEEgZmxhZyB0byBpbmRpY2F0ZSBhIGRlZXAgY2xvbmUuXG4gICAqIEBwYXJhbS0ge09iamVjdH0gW2d1YXJkXSBJbnRlcm5hbGx5IHVzZWQgdG8gYWxsb3cgdGhpcyBtZXRob2QgdG8gd29yayB3aXRoXG4gICAqICBvdGhlcnMgbGlrZSBgXy5tYXBgIHdpdGhvdXQgdXNpbmcgdGhlaXIgY2FsbGJhY2sgYGluZGV4YCBhcmd1bWVudCBmb3IgYGRlZXBgLlxuICAgKiBAcGFyYW0tIHtBcnJheX0gW3N0YWNrQT1bXV0gSW50ZXJuYWxseSB1c2VkIHRvIHRyYWNrIHRyYXZlcnNlZCBzb3VyY2Ugb2JqZWN0cy5cbiAgICogQHBhcmFtLSB7QXJyYXl9IFtzdGFja0I9W11dIEludGVybmFsbHkgdXNlZCB0byBhc3NvY2lhdGUgY2xvbmVzIHdpdGggdGhlaXJcbiAgICogIHNvdXJjZSBjb3VudGVycGFydHMuXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgY2xvbmVkIGB2YWx1ZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBzdG9vZ2VzID0gW1xuICAgKiAgIHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH0sXG4gICAqICAgeyAnbmFtZSc6ICdsYXJyeScsICdhZ2UnOiA1MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnY3VybHknLCAnYWdlJzogNjAgfVxuICAgKiBdO1xuICAgKlxuICAgKiBfLmNsb25lKHsgJ25hbWUnOiAnbW9lJyB9KTtcbiAgICogLy8gPT4geyAnbmFtZSc6ICdtb2UnIH1cbiAgICpcbiAgICogdmFyIHNoYWxsb3cgPSBfLmNsb25lKHN0b29nZXMpO1xuICAgKiBzaGFsbG93WzBdID09PSBzdG9vZ2VzWzBdO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIHZhciBkZWVwID0gXy5jbG9uZShzdG9vZ2VzLCB0cnVlKTtcbiAgICogc2hhbGxvd1swXSA9PT0gc3Rvb2dlc1swXTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICovXG4gIGZ1bmN0aW9uIGNsb25lKHZhbHVlLCBkZWVwLCBndWFyZCwgc3RhY2tBLCBzdGFja0IpIHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICBpZiAoZ3VhcmQpIHtcbiAgICAgIGRlZXAgPSBmYWxzZTtcbiAgICB9XG4gICAgLy8gaW5zcGVjdCBbW0NsYXNzXV1cbiAgICB2YXIgaXNPYmogPSBpc09iamVjdCh2YWx1ZSk7XG4gICAgaWYgKGlzT2JqKSB7XG4gICAgICAvLyBkb24ndCBjbG9uZSBgYXJndW1lbnRzYCBvYmplY3RzLCBmdW5jdGlvbnMsIG9yIG5vbi1vYmplY3QgT2JqZWN0c1xuICAgICAgdmFyIGNsYXNzTmFtZSA9IHRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICAgICAgaWYgKCFjbG9uZWFibGVDbGFzc2VzW2NsYXNzTmFtZV0gfHwgKG5vQXJnc0NsYXNzICYmIGlzQXJndW1lbnRzKHZhbHVlKSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgICAgdmFyIGlzQXJyID0gY2xhc3NOYW1lID09IGFycmF5Q2xhc3M7XG4gICAgICBpc09iaiA9IGlzQXJyIHx8IChjbGFzc05hbWUgPT0gb2JqZWN0Q2xhc3MgPyBpc1BsYWluT2JqZWN0KHZhbHVlKSA6IGlzT2JqKTtcbiAgICB9XG4gICAgLy8gc2hhbGxvdyBjbG9uZVxuICAgIGlmICghaXNPYmogfHwgIWRlZXApIHtcbiAgICAgIC8vIGRvbid0IGNsb25lIGZ1bmN0aW9uc1xuICAgICAgcmV0dXJuIGlzT2JqXG4gICAgICAgID8gKGlzQXJyID8gc2xpY2UuY2FsbCh2YWx1ZSkgOiBleHRlbmQoe30sIHZhbHVlKSlcbiAgICAgICAgOiB2YWx1ZTtcbiAgICB9XG5cbiAgICB2YXIgY3RvciA9IHZhbHVlLmNvbnN0cnVjdG9yO1xuICAgIHN3aXRjaCAoY2xhc3NOYW1lKSB7XG4gICAgICBjYXNlIGJvb2xDbGFzczpcbiAgICAgIGNhc2UgZGF0ZUNsYXNzOlxuICAgICAgICByZXR1cm4gbmV3IGN0b3IoK3ZhbHVlKTtcblxuICAgICAgY2FzZSBudW1iZXJDbGFzczpcbiAgICAgIGNhc2Ugc3RyaW5nQ2xhc3M6XG4gICAgICAgIHJldHVybiBuZXcgY3Rvcih2YWx1ZSk7XG5cbiAgICAgIGNhc2UgcmVnZXhwQ2xhc3M6XG4gICAgICAgIHJldHVybiBjdG9yKHZhbHVlLnNvdXJjZSwgcmVGbGFncy5leGVjKHZhbHVlKSk7XG4gICAgfVxuICAgIC8vIGNoZWNrIGZvciBjaXJjdWxhciByZWZlcmVuY2VzIGFuZCByZXR1cm4gY29ycmVzcG9uZGluZyBjbG9uZVxuICAgIHN0YWNrQSB8fCAoc3RhY2tBID0gW10pO1xuICAgIHN0YWNrQiB8fCAoc3RhY2tCID0gW10pO1xuXG4gICAgdmFyIGxlbmd0aCA9IHN0YWNrQS5sZW5ndGg7XG4gICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICBpZiAoc3RhY2tBW2xlbmd0aF0gPT0gdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHN0YWNrQltsZW5ndGhdO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpbml0IGNsb25lZCBvYmplY3RcbiAgICB2YXIgcmVzdWx0ID0gaXNBcnIgPyBjdG9yKHZhbHVlLmxlbmd0aCkgOiB7fTtcblxuICAgIC8vIGFkZCB0aGUgc291cmNlIHZhbHVlIHRvIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0c1xuICAgIC8vIGFuZCBhc3NvY2lhdGUgaXQgd2l0aCBpdHMgY2xvbmVcbiAgICBzdGFja0EucHVzaCh2YWx1ZSk7XG4gICAgc3RhY2tCLnB1c2gocmVzdWx0KTtcblxuICAgIC8vIHJlY3Vyc2l2ZWx5IHBvcHVsYXRlIGNsb25lIChzdXNjZXB0aWJsZSB0byBjYWxsIHN0YWNrIGxpbWl0cylcbiAgICAoaXNBcnIgPyBmb3JFYWNoIDogZm9yT3duKSh2YWx1ZSwgZnVuY3Rpb24ob2JqVmFsdWUsIGtleSkge1xuICAgICAgcmVzdWx0W2tleV0gPSBjbG9uZShvYmpWYWx1ZSwgZGVlcCwgbnVsbCwgc3RhY2tBLCBzdGFja0IpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3NpZ25zIGVudW1lcmFibGUgcHJvcGVydGllcyBvZiB0aGUgZGVmYXVsdCBvYmplY3QocykgdG8gdGhlIGBkZXN0aW5hdGlvbmBcbiAgICogb2JqZWN0IGZvciBhbGwgYGRlc3RpbmF0aW9uYCBwcm9wZXJ0aWVzIHRoYXQgcmVzb2x2ZSB0byBgbnVsbGAvYHVuZGVmaW5lZGAuXG4gICAqIE9uY2UgYSBwcm9wZXJ0eSBpcyBzZXQsIGFkZGl0aW9uYWwgZGVmYXVsdHMgb2YgdGhlIHNhbWUgcHJvcGVydHkgd2lsbCBiZVxuICAgKiBpZ25vcmVkLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtkZWZhdWx0MSwgZGVmYXVsdDIsIC4uLl0gVGhlIGRlZmF1bHQgb2JqZWN0cy5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgaWNlQ3JlYW0gPSB7ICdmbGF2b3InOiAnY2hvY29sYXRlJyB9O1xuICAgKiBfLmRlZmF1bHRzKGljZUNyZWFtLCB7ICdmbGF2b3InOiAndmFuaWxsYScsICdzcHJpbmtsZXMnOiAncmFpbmJvdycgfSk7XG4gICAqIC8vID0+IHsgJ2ZsYXZvcic6ICdjaG9jb2xhdGUnLCAnc3ByaW5rbGVzJzogJ3JhaW5ib3cnIH1cbiAgICovXG4gIHZhciBkZWZhdWx0cyA9IGNyZWF0ZUl0ZXJhdG9yKGV4dGVuZEl0ZXJhdG9yT3B0aW9ucywge1xuICAgICdvYmplY3RMb29wJzogJ2lmIChyZXN1bHRbaW5kZXhdID09IG51bGwpICcgKyBleHRlbmRJdGVyYXRvck9wdGlvbnMub2JqZWN0TG9vcFxuICB9KTtcblxuICAvKipcbiAgICogQXNzaWducyBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2YgdGhlIHNvdXJjZSBvYmplY3QocykgdG8gdGhlIGBkZXN0aW5hdGlvbmBcbiAgICogb2JqZWN0LiBTdWJzZXF1ZW50IHNvdXJjZXMgd2lsbCBvdmVyd3JpdGUgcHJvcGVyeSBhc3NpZ25tZW50cyBvZiBwcmV2aW91c1xuICAgKiBzb3VyY2VzLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtzb3VyY2UxLCBzb3VyY2UyLCAuLi5dIFRoZSBzb3VyY2Ugb2JqZWN0cy5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmV4dGVuZCh7ICduYW1lJzogJ21vZScgfSwgeyAnYWdlJzogNDAgfSk7XG4gICAqIC8vID0+IHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH1cbiAgICovXG4gIHZhciBleHRlbmQgPSBjcmVhdGVJdGVyYXRvcihleHRlbmRJdGVyYXRvck9wdGlvbnMpO1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgc29ydGVkIGFycmF5IG9mIGFsbCBlbnVtZXJhYmxlIHByb3BlcnRpZXMsIG93biBhbmQgaW5oZXJpdGVkLFxuICAgKiBvZiBgb2JqZWN0YCB0aGF0IGhhdmUgZnVuY3Rpb24gdmFsdWVzLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBhbGlhcyBtZXRob2RzXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnNwZWN0LlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgcHJvcGVydHkgbmFtZXMgdGhhdCBoYXZlIGZ1bmN0aW9uIHZhbHVlcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5mdW5jdGlvbnMoXyk7XG4gICAqIC8vID0+IFsnYWxsJywgJ2FueScsICdiaW5kJywgJ2JpbmRBbGwnLCAnY2xvbmUnLCAnY29tcGFjdCcsICdjb21wb3NlJywgLi4uXVxuICAgKi9cbiAgZnVuY3Rpb24gZnVuY3Rpb25zKG9iamVjdCkge1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICBmb3JJbihvYmplY3QsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICAgIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQuc29ydCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGUgc3BlY2lmaWVkIG9iamVjdCBgcHJvcGVydHlgIGV4aXN0cyBhbmQgaXMgYSBkaXJlY3QgcHJvcGVydHksXG4gICAqIGluc3RlYWQgb2YgYW4gaW5oZXJpdGVkIHByb3BlcnR5LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBjaGVjay5cbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5IFRoZSBwcm9wZXJ0eSB0byBjaGVjayBmb3IuXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBrZXkgaXMgYSBkaXJlY3QgcHJvcGVydHksIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5oYXMoeyAnYSc6IDEsICdiJzogMiwgJ2MnOiAzIH0sICdiJyk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGhhcyhvYmplY3QsIHByb3BlcnR5KSB7XG4gICAgcmV0dXJuIG9iamVjdCA/IGhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wZXJ0eSkgOiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIG9iamVjdCBjb21wb3NlZCBvZiB0aGUgaW52ZXJ0ZWQga2V5cyBhbmQgdmFsdWVzIG9mIHRoZSBnaXZlbiBgb2JqZWN0YC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW52ZXJ0LlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBjcmVhdGVkIGludmVydGVkIG9iamVjdC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogIF8uaW52ZXJ0KHsgJ2ZpcnN0JzogJ01vZScsICdzZWNvbmQnOiAnTGFycnknLCAndGhpcmQnOiAnQ3VybHknIH0pO1xuICAgKiAvLyA9PiB7ICdNb2UnOiAnZmlyc3QnLCAnTGFycnknOiAnc2Vjb25kJywgJ0N1cmx5JzogJ3RoaXJkJyB9IChvcmRlciBpcyBub3QgZ3VhcmFudGVlZClcbiAgICovXG4gIGZ1bmN0aW9uIGludmVydChvYmplY3QpIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgZm9yT3duKG9iamVjdCwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgcmVzdWx0W3ZhbHVlXSA9IGtleTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGFuIGFycmF5LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGFuIGFycmF5LCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIChmdW5jdGlvbigpIHsgcmV0dXJuIF8uaXNBcnJheShhcmd1bWVudHMpOyB9KSgpO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiBfLmlzQXJyYXkoWzEsIDIsIDNdKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKi9cbiAgdmFyIGlzQXJyYXkgPSBuYXRpdmVJc0FycmF5IHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsdWUpID09IGFycmF5Q2xhc3M7XG4gIH07XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgYm9vbGVhbiAoYHRydWVgIG9yIGBmYWxzZWApIHZhbHVlLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGEgYm9vbGVhbiB2YWx1ZSwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmlzQm9vbGVhbihudWxsKTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICovXG4gIGZ1bmN0aW9uIGlzQm9vbGVhbih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gZmFsc2UgfHwgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gYm9vbENsYXNzO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgZGF0ZS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhIGRhdGUsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc0RhdGUobmV3IERhdGUpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc0RhdGUodmFsdWUpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gZGF0ZUNsYXNzO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgRE9NIGVsZW1lbnQuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYSBET00gZWxlbWVudCwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmlzRWxlbWVudChkb2N1bWVudC5ib2R5KTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKi9cbiAgZnVuY3Rpb24gaXNFbGVtZW50KHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID8gdmFsdWUubm9kZVR5cGUgPT09IDEgOiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBlbXB0eS4gQXJyYXlzLCBzdHJpbmdzLCBvciBgYXJndW1lbnRzYCBvYmplY3RzIHdpdGggYVxuICAgKiBsZW5ndGggb2YgYDBgIGFuZCBvYmplY3RzIHdpdGggbm8gb3duIGVudW1lcmFibGUgcHJvcGVydGllcyBhcmUgY29uc2lkZXJlZFxuICAgKiBcImVtcHR5XCIuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSB2YWx1ZSBUaGUgdmFsdWUgdG8gaW5zcGVjdC5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGVtcHR5LCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNFbXB0eShbMSwgMiwgM10pO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiBfLmlzRW1wdHkoe30pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uaXNFbXB0eSgnJyk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGlzRW1wdHkodmFsdWUpIHtcbiAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcbiAgICBpZiAoIXZhbHVlKSB7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbCh2YWx1ZSksXG4gICAgICAgIGxlbmd0aCA9IHZhbHVlLmxlbmd0aDtcblxuICAgIGlmICgoY2xhc3NOYW1lID09IGFycmF5Q2xhc3MgfHwgY2xhc3NOYW1lID09IHN0cmluZ0NsYXNzIHx8XG4gICAgICAgIGNsYXNzTmFtZSA9PSBhcmdzQ2xhc3MgfHwgKG5vQXJnc0NsYXNzICYmIGlzQXJndW1lbnRzKHZhbHVlKSkpIHx8XG4gICAgICAgIChjbGFzc05hbWUgPT0gb2JqZWN0Q2xhc3MgJiYgdHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJyAmJiBpc0Z1bmN0aW9uKHZhbHVlLnNwbGljZSkpKSB7XG4gICAgICByZXR1cm4gIWxlbmd0aDtcbiAgICB9XG4gICAgZm9yT3duKHZhbHVlLCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAocmVzdWx0ID0gZmFsc2UpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogUGVyZm9ybXMgYSBkZWVwIGNvbXBhcmlzb24gYmV0d2VlbiB0d28gdmFsdWVzIHRvIGRldGVybWluZSBpZiB0aGV5IGFyZVxuICAgKiBlcXVpdmFsZW50IHRvIGVhY2ggb3RoZXIuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gYSBUaGUgdmFsdWUgdG8gY29tcGFyZS5cbiAgICogQHBhcmFtIHtNaXhlZH0gYiBUaGUgb3RoZXIgdmFsdWUgdG8gY29tcGFyZS5cbiAgICogQHBhcmFtLSB7T2JqZWN0fSBbc3RhY2tBPVtdXSBJbnRlcm5hbGx5IHVzZWQgdHJhY2sgdHJhdmVyc2VkIGBhYCBvYmplY3RzLlxuICAgKiBAcGFyYW0tIHtPYmplY3R9IFtzdGFja0I9W11dIEludGVybmFsbHkgdXNlZCB0cmFjayB0cmF2ZXJzZWQgYGJgIG9iamVjdHMuXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWVzIGFyZSBlcXV2YWxlbnQsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIG1vZSA9IHsgJ25hbWUnOiAnbW9lJywgJ2x1Y2t5TnVtYmVycyc6IFsxMywgMjcsIDM0XSB9O1xuICAgKiB2YXIgY2xvbmUgPSB7ICduYW1lJzogJ21vZScsICdsdWNreU51bWJlcnMnOiBbMTMsIDI3LCAzNF0gfTtcbiAgICpcbiAgICogbW9lID09IGNsb25lO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiBfLmlzRXF1YWwobW9lLCBjbG9uZSk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGlzRXF1YWwoYSwgYiwgc3RhY2tBLCBzdGFja0IpIHtcbiAgICAvLyBleGl0IGVhcmx5IGZvciBpZGVudGljYWwgdmFsdWVzXG4gICAgaWYgKGEgPT09IGIpIHtcbiAgICAgIC8vIHRyZWF0IGArMGAgdnMuIGAtMGAgYXMgbm90IGVxdWFsXG4gICAgICByZXR1cm4gYSAhPT0gMCB8fCAoMSAvIGEgPT0gMSAvIGIpO1xuICAgIH1cbiAgICAvLyBhIHN0cmljdCBjb21wYXJpc29uIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIGBudWxsID09IHVuZGVmaW5lZGBcbiAgICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGEgPT09IGI7XG4gICAgfVxuICAgIC8vIGNvbXBhcmUgW1tDbGFzc11dIG5hbWVzXG4gICAgdmFyIGNsYXNzTmFtZSA9IHRvU3RyaW5nLmNhbGwoYSk7XG4gICAgaWYgKGNsYXNzTmFtZSAhPSB0b1N0cmluZy5jYWxsKGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHN3aXRjaCAoY2xhc3NOYW1lKSB7XG4gICAgICBjYXNlIGJvb2xDbGFzczpcbiAgICAgIGNhc2UgZGF0ZUNsYXNzOlxuICAgICAgICAvLyBjb2VyY2UgZGF0ZXMgYW5kIGJvb2xlYW5zIHRvIG51bWJlcnMsIGRhdGVzIHRvIG1pbGxpc2Vjb25kcyBhbmQgYm9vbGVhbnNcbiAgICAgICAgLy8gdG8gYDFgIG9yIGAwYCwgdHJlYXRpbmcgaW52YWxpZCBkYXRlcyBjb2VyY2VkIHRvIGBOYU5gIGFzIG5vdCBlcXVhbFxuICAgICAgICByZXR1cm4gK2EgPT0gK2I7XG5cbiAgICAgIGNhc2UgbnVtYmVyQ2xhc3M6XG4gICAgICAgIC8vIHRyZWF0IGBOYU5gIHZzLiBgTmFOYCBhcyBlcXVhbFxuICAgICAgICByZXR1cm4gYSAhPSArYVxuICAgICAgICAgID8gYiAhPSArYlxuICAgICAgICAgIC8vIGJ1dCB0cmVhdCBgKzBgIHZzLiBgLTBgIGFzIG5vdCBlcXVhbFxuICAgICAgICAgIDogKGEgPT0gMCA/ICgxIC8gYSA9PSAxIC8gYikgOiBhID09ICtiKTtcblxuICAgICAgY2FzZSByZWdleHBDbGFzczpcbiAgICAgIGNhc2Ugc3RyaW5nQ2xhc3M6XG4gICAgICAgIC8vIGNvZXJjZSByZWdleGVzIHRvIHN0cmluZ3MgKGh0dHA6Ly9lczUuZ2l0aHViLmNvbS8jeDE1LjEwLjYuNClcbiAgICAgICAgLy8gdHJlYXQgc3RyaW5nIHByaW1pdGl2ZXMgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgb2JqZWN0IGluc3RhbmNlcyBhcyBlcXVhbFxuICAgICAgICByZXR1cm4gYSA9PSBiICsgJyc7XG4gICAgfVxuICAgIC8vIGV4aXQgZWFybHksIGluIG9sZGVyIGJyb3dzZXJzLCBpZiBgYWAgaXMgYXJyYXktbGlrZSBidXQgbm90IGBiYFxuICAgIHZhciBpc0FyciA9IGNsYXNzTmFtZSA9PSBhcnJheUNsYXNzIHx8IGNsYXNzTmFtZSA9PSBhcmdzQ2xhc3M7XG4gICAgaWYgKG5vQXJnc0NsYXNzICYmICFpc0FyciAmJiAoaXNBcnIgPSBpc0FyZ3VtZW50cyhhKSkgJiYgIWlzQXJndW1lbnRzKGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmICghaXNBcnIpIHtcbiAgICAgIC8vIHVud3JhcCBhbnkgYGxvZGFzaGAgd3JhcHBlZCB2YWx1ZXNcbiAgICAgIGlmIChhLl9fd3JhcHBlZF9fIHx8IGIuX193cmFwcGVkX18pIHtcbiAgICAgICAgcmV0dXJuIGlzRXF1YWwoYS5fX3dyYXBwZWRfXyB8fCBhLCBiLl9fd3JhcHBlZF9fIHx8IGIpO1xuICAgICAgfVxuICAgICAgLy8gZXhpdCBmb3IgZnVuY3Rpb25zIGFuZCBET00gbm9kZXNcbiAgICAgIGlmIChjbGFzc05hbWUgIT0gb2JqZWN0Q2xhc3MgfHwgKG5vTm9kZUNsYXNzICYmIChcbiAgICAgICAgICAodHlwZW9mIGEudG9TdHJpbmcgIT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgKGEgKyAnJykgPT0gJ3N0cmluZycpIHx8XG4gICAgICAgICAgKHR5cGVvZiBiLnRvU3RyaW5nICE9ICdmdW5jdGlvbicgJiYgdHlwZW9mIChiICsgJycpID09ICdzdHJpbmcnKSkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHZhciBjdG9yQSA9IGEuY29uc3RydWN0b3IsXG4gICAgICAgICAgY3RvckIgPSBiLmNvbnN0cnVjdG9yO1xuXG4gICAgICAvLyBub24gYE9iamVjdGAgb2JqZWN0IGluc3RhbmNlcyB3aXRoIGRpZmZlcmVudCBjb25zdHJ1Y3RvcnMgYXJlIG5vdCBlcXVhbFxuICAgICAgaWYgKGN0b3JBICE9IGN0b3JCICYmICEoXG4gICAgICAgICAgICBpc0Z1bmN0aW9uKGN0b3JBKSAmJiBjdG9yQSBpbnN0YW5jZW9mIGN0b3JBICYmXG4gICAgICAgICAgICBpc0Z1bmN0aW9uKGN0b3JCKSAmJiBjdG9yQiBpbnN0YW5jZW9mIGN0b3JCXG4gICAgICAgICAgKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGFzc3VtZSBjeWNsaWMgc3RydWN0dXJlcyBhcmUgZXF1YWxcbiAgICAvLyB0aGUgYWxnb3JpdGhtIGZvciBkZXRlY3RpbmcgY3ljbGljIHN0cnVjdHVyZXMgaXMgYWRhcHRlZCBmcm9tIEVTIDUuMVxuICAgIC8vIHNlY3Rpb24gMTUuMTIuMywgYWJzdHJhY3Qgb3BlcmF0aW9uIGBKT2AgKGh0dHA6Ly9lczUuZ2l0aHViLmNvbS8jeDE1LjEyLjMpXG4gICAgc3RhY2tBIHx8IChzdGFja0EgPSBbXSk7XG4gICAgc3RhY2tCIHx8IChzdGFja0IgPSBbXSk7XG5cbiAgICB2YXIgbGVuZ3RoID0gc3RhY2tBLmxlbmd0aDtcbiAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgIGlmIChzdGFja0FbbGVuZ3RoXSA9PSBhKSB7XG4gICAgICAgIHJldHVybiBzdGFja0JbbGVuZ3RoXSA9PSBiO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICByZXN1bHQgPSB0cnVlLFxuICAgICAgICBzaXplID0gMDtcblxuICAgIC8vIGFkZCBgYWAgYW5kIGBiYCB0byB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHNcbiAgICBzdGFja0EucHVzaChhKTtcbiAgICBzdGFja0IucHVzaChiKTtcblxuICAgIC8vIHJlY3Vyc2l2ZWx5IGNvbXBhcmUgb2JqZWN0cyBhbmQgYXJyYXlzIChzdXNjZXB0aWJsZSB0byBjYWxsIHN0YWNrIGxpbWl0cylcbiAgICBpZiAoaXNBcnIpIHtcbiAgICAgIC8vIGNvbXBhcmUgbGVuZ3RocyB0byBkZXRlcm1pbmUgaWYgYSBkZWVwIGNvbXBhcmlzb24gaXMgbmVjZXNzYXJ5XG4gICAgICBzaXplID0gYS5sZW5ndGg7XG4gICAgICByZXN1bHQgPSBzaXplID09IGIubGVuZ3RoO1xuXG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIC8vIGRlZXAgY29tcGFyZSB0aGUgY29udGVudHMsIGlnbm9yaW5nIG5vbi1udW1lcmljIHByb3BlcnRpZXNcbiAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgIGlmICghKHJlc3VsdCA9IGlzRXF1YWwoYVtzaXplXSwgYltzaXplXSwgc3RhY2tBLCBzdGFja0IpKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICAvLyBkZWVwIGNvbXBhcmUgb2JqZWN0c1xuICAgIGZvciAodmFyIGtleSBpbiBhKSB7XG4gICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChhLCBrZXkpKSB7XG4gICAgICAgIC8vIGNvdW50IHRoZSBudW1iZXIgb2YgcHJvcGVydGllcy5cbiAgICAgICAgc2l6ZSsrO1xuICAgICAgICAvLyBkZWVwIGNvbXBhcmUgZWFjaCBwcm9wZXJ0eSB2YWx1ZS5cbiAgICAgICAgaWYgKCEoaGFzT3duUHJvcGVydHkuY2FsbChiLCBrZXkpICYmIGlzRXF1YWwoYVtrZXldLCBiW2tleV0sIHN0YWNrQSwgc3RhY2tCKSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZW5zdXJlIGJvdGggb2JqZWN0cyBoYXZlIHRoZSBzYW1lIG51bWJlciBvZiBwcm9wZXJ0aWVzXG4gICAgZm9yIChrZXkgaW4gYikge1xuICAgICAgLy8gVGhlIEpTIGVuZ2luZSBpbiBBZG9iZSBwcm9kdWN0cywgbGlrZSBJbkRlc2lnbiwgaGFzIGEgYnVnIHRoYXQgY2F1c2VzXG4gICAgICAvLyBgIXNpemUtLWAgdG8gdGhyb3cgYW4gZXJyb3Igc28gaXQgbXVzdCBiZSB3cmFwcGVkIGluIHBhcmVudGhlc2VzLlxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2RvY3VtZW50Y2xvdWQvdW5kZXJzY29yZS9pc3N1ZXMvMzU1XG4gICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChiLCBrZXkpICYmICEoc2l6ZS0tKSkge1xuICAgICAgICAvLyBgc2l6ZWAgd2lsbCBiZSBgLTFgIGlmIGBiYCBoYXMgbW9yZSBwcm9wZXJ0aWVzIHRoYW4gYGFgXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaGFuZGxlIEpTY3JpcHQgW1tEb250RW51bV1dIGJ1Z1xuICAgIGlmIChoYXNEb250RW51bUJ1Zykge1xuICAgICAgd2hpbGUgKCsraW5kZXggPCA3KSB7XG4gICAgICAgIGtleSA9IHNoYWRvd2VkW2luZGV4XTtcbiAgICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoYSwga2V5KSAmJlxuICAgICAgICAgICAgIShoYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIGtleSkgJiYgaXNFcXVhbChhW2tleV0sIGJba2V5XSwgc3RhY2tBLCBzdGFja0IpKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcywgb3IgY2FuIGJlIGNvZXJjZWQgdG8sIGEgZmluaXRlIG51bWJlci5cbiAgICpcbiAgICogTm90ZTogVGhpcyBpcyBub3QgdGhlIHNhbWUgYXMgbmF0aXZlIGBpc0Zpbml0ZWAsIHdoaWNoIHdpbGwgcmV0dXJuIHRydWUgZm9yXG4gICAqIGJvb2xlYW5zIGFuZCBlbXB0eSBzdHJpbmdzLiBTZWUgaHR0cDovL2VzNS5naXRodWIuY29tLyN4MTUuMS4yLjUuXG4gICAqXG4gICAqIEBkZXByZWNhdGVkXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYSBmaW5pdGUgbnVtYmVyLCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNGaW5pdGUoLTEwMSk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogXy5pc0Zpbml0ZSgnMTAnKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmlzRmluaXRlKHRydWUpO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiBfLmlzRmluaXRlKCcnKTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICpcbiAgICogXy5pc0Zpbml0ZShJbmZpbml0eSk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqL1xuICBmdW5jdGlvbiBpc0Zpbml0ZSh2YWx1ZSkge1xuICAgIHJldHVybiBuYXRpdmVJc0Zpbml0ZSh2YWx1ZSkgJiYgIW5hdGl2ZUlzTmFOKHBhcnNlRmxvYXQodmFsdWUpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGEgZnVuY3Rpb24sIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc0Z1bmN0aW9uKF8pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnZnVuY3Rpb24nO1xuICB9XG4gIC8vIGZhbGxiYWNrIGZvciBvbGRlciB2ZXJzaW9ucyBvZiBDaHJvbWUgYW5kIFNhZmFyaVxuICBpZiAoaXNGdW5jdGlvbigveC8pKSB7XG4gICAgaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gZnVuY0NsYXNzO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIGxhbmd1YWdlIHR5cGUgb2YgT2JqZWN0LlxuICAgKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc09iamVjdCh7fSk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uaXNPYmplY3QoMSk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqL1xuICBmdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICAgIC8vIGNoZWNrIGlmIHRoZSB2YWx1ZSBpcyB0aGUgRUNNQVNjcmlwdCBsYW5ndWFnZSB0eXBlIG9mIE9iamVjdFxuICAgIC8vIGh0dHA6Ly9lczUuZ2l0aHViLmNvbS8jeDhcbiAgICAvLyBhbmQgYXZvaWQgYSBWOCBidWdcbiAgICAvLyBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0yMjkxXG4gICAgcmV0dXJuIHZhbHVlID8gb2JqZWN0VHlwZXNbdHlwZW9mIHZhbHVlXSA6IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGBOYU5gLlxuICAgKlxuICAgKiBOb3RlOiBUaGlzIGlzIG5vdCB0aGUgc2FtZSBhcyBuYXRpdmUgYGlzTmFOYCwgd2hpY2ggd2lsbCByZXR1cm4gdHJ1ZSBmb3JcbiAgICogYHVuZGVmaW5lZGAgYW5kIG90aGVyIHZhbHVlcy4gU2VlIGh0dHA6Ly9lczUuZ2l0aHViLmNvbS8jeDE1LjEuMi40LlxuICAgKlxuICAgKiBAZGVwcmVjYXRlZFxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGBOYU5gLCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNOYU4oTmFOKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmlzTmFOKG5ldyBOdW1iZXIoTmFOKSk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogaXNOYU4odW5kZWZpbmVkKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmlzTmFOKHVuZGVmaW5lZCk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqL1xuICBmdW5jdGlvbiBpc05hTih2YWx1ZSkge1xuICAgIC8vIGBOYU5gIGFzIGEgcHJpbWl0aXZlIGlzIHRoZSBvbmx5IHZhbHVlIHRoYXQgaXMgbm90IGVxdWFsIHRvIGl0c2VsZlxuICAgIC8vIChwZXJmb3JtIHRoZSBbW0NsYXNzXV0gY2hlY2sgZmlyc3QgdG8gYXZvaWQgZXJyb3JzIHdpdGggc29tZSBob3N0IG9iamVjdHMgaW4gSUUpXG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsdWUpID09IG51bWJlckNsYXNzICYmIHZhbHVlICE9ICt2YWx1ZVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGBudWxsYC5cbiAgICpcbiAgICogQGRlcHJlY2F0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBgbnVsbGAsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc051bGwobnVsbCk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogXy5pc051bGwodW5kZWZpbmVkKTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICovXG4gIGZ1bmN0aW9uIGlzTnVsbCh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIG51bWJlci5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhIG51bWJlciwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmlzTnVtYmVyKDguNCAqIDUpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc051bWJlcih2YWx1ZSkge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBudW1iZXJDbGFzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYSBnaXZlbiBgdmFsdWVgIGlzIGFuIG9iamVjdCBjcmVhdGVkIGJ5IHRoZSBgT2JqZWN0YCBjb25zdHJ1Y3Rvci5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgcGxhaW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIGZ1bmN0aW9uIFN0b29nZShuYW1lLCBhZ2UpIHtcbiAgICogICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgKiAgIHRoaXMuYWdlID0gYWdlO1xuICAgKiB9XG4gICAqXG4gICAqIF8uaXNQbGFpbk9iamVjdChuZXcgU3Rvb2dlKCdtb2UnLCA0MCkpO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiBfLmlzUGxhaW5PYmplY3QoWzEsIDIsIDNdKTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICpcbiAgICogXy5pc1BsYWluT2JqZWN0KHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH0pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICB2YXIgaXNQbGFpbk9iamVjdCA9ICFnZXRQcm90b3R5cGVPZiA/IHNoaW1Jc1BsYWluT2JqZWN0IDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICBpZiAoISh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHZhciB2YWx1ZU9mID0gdmFsdWUudmFsdWVPZixcbiAgICAgICAgb2JqUHJvdG8gPSB0eXBlb2YgdmFsdWVPZiA9PSAnZnVuY3Rpb24nICYmIChvYmpQcm90byA9IGdldFByb3RvdHlwZU9mKHZhbHVlT2YpKSAmJiBnZXRQcm90b3R5cGVPZihvYmpQcm90byk7XG5cbiAgICByZXR1cm4gb2JqUHJvdG9cbiAgICAgID8gdmFsdWUgPT0gb2JqUHJvdG8gfHwgKGdldFByb3RvdHlwZU9mKHZhbHVlKSA9PSBvYmpQcm90byAmJiAhaXNBcmd1bWVudHModmFsdWUpKVxuICAgICAgOiBzaGltSXNQbGFpbk9iamVjdCh2YWx1ZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgcmVndWxhciBleHByZXNzaW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGEgcmVndWxhciBleHByZXNzaW9uLCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNSZWdFeHAoL21vZS8pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc1JlZ0V4cCh2YWx1ZSkge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSByZWdleHBDbGFzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHN0cmluZy5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhIHN0cmluZywgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmlzU3RyaW5nKCdtb2UnKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKi9cbiAgZnVuY3Rpb24gaXNTdHJpbmcodmFsdWUpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gc3RyaW5nQ2xhc3M7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYHVuZGVmaW5lZGAuXG4gICAqXG4gICAqIEBkZXByZWNhdGVkXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYHVuZGVmaW5lZGAsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc1VuZGVmaW5lZCh2b2lkIDApO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc1VuZGVmaW5lZCh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gdW5kZWZpbmVkO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYXJyYXkgY29tcG9zZWQgb2YgdGhlIG93biBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGBvYmplY3RgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnNwZWN0LlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgcHJvcGVydHkgbmFtZXMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ua2V5cyh7ICdvbmUnOiAxLCAndHdvJzogMiwgJ3RocmVlJzogMyB9KTtcbiAgICogLy8gPT4gWydvbmUnLCAndHdvJywgJ3RocmVlJ10gKG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICAgKi9cbiAgdmFyIGtleXMgPSAhbmF0aXZlS2V5cyA/IHNoaW1LZXlzIDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgLy8gYXZvaWQgaXRlcmF0aW5nIG92ZXIgdGhlIGBwcm90b3R5cGVgIHByb3BlcnR5XG4gICAgcmV0dXJuIHR5cGVvZiBvYmplY3QgPT0gJ2Z1bmN0aW9uJyAmJiBwcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKG9iamVjdCwgJ3Byb3RvdHlwZScpXG4gICAgICA/IHNoaW1LZXlzKG9iamVjdClcbiAgICAgIDogKGlzT2JqZWN0KG9iamVjdCkgPyBuYXRpdmVLZXlzKG9iamVjdCkgOiBbXSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIE1lcmdlcyBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2YgdGhlIHNvdXJjZSBvYmplY3QocykgaW50byB0aGUgYGRlc3RpbmF0aW9uYFxuICAgKiBvYmplY3QuIFN1YnNlcXVlbnQgc291cmNlcyB3aWxsIG92ZXJ3cml0ZSBwcm9wZXJ5IGFzc2lnbm1lbnRzIG9mIHByZXZpb3VzXG4gICAqIHNvdXJjZXMuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgKiBAcGFyYW0ge09iamVjdH0gW3NvdXJjZTEsIHNvdXJjZTIsIC4uLl0gVGhlIHNvdXJjZSBvYmplY3RzLlxuICAgKiBAcGFyYW0tIHtPYmplY3R9IFtpbmRpY2F0b3JdIEludGVybmFsbHkgdXNlZCB0byBpbmRpY2F0ZSB0aGF0IHRoZSBgc3RhY2tgXG4gICAqICBhcmd1bWVudCBpcyBhbiBhcnJheSBvZiB0cmF2ZXJzZWQgb2JqZWN0cyBpbnN0ZWFkIG9mIGFub3RoZXIgc291cmNlIG9iamVjdC5cbiAgICogQHBhcmFtLSB7QXJyYXl9IFtzdGFja0E9W11dIEludGVybmFsbHkgdXNlZCB0byB0cmFjayB0cmF2ZXJzZWQgc291cmNlIG9iamVjdHMuXG4gICAqIEBwYXJhbS0ge0FycmF5fSBbc3RhY2tCPVtdXSBJbnRlcm5hbGx5IHVzZWQgdG8gYXNzb2NpYXRlIHZhbHVlcyB3aXRoIHRoZWlyXG4gICAqICBzb3VyY2UgY291bnRlcnBhcnRzLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBzdG9vZ2VzID0gW1xuICAgKiAgIHsgJ25hbWUnOiAnbW9lJyB9LFxuICAgKiAgIHsgJ25hbWUnOiAnbGFycnknIH1cbiAgICogXTtcbiAgICpcbiAgICogdmFyIGFnZXMgPSBbXG4gICAqICAgeyAnYWdlJzogNDAgfSxcbiAgICogICB7ICdhZ2UnOiA1MCB9XG4gICAqIF07XG4gICAqXG4gICAqIF8ubWVyZ2Uoc3Rvb2dlcywgYWdlcyk7XG4gICAqIC8vID0+IFt7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9LCB7ICduYW1lJzogJ2xhcnJ5JywgJ2FnZSc6IDUwIH1dXG4gICAqL1xuICBmdW5jdGlvbiBtZXJnZShvYmplY3QsIHNvdXJjZSwgaW5kaWNhdG9yKSB7XG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgIGluZGV4ID0gMCxcbiAgICAgICAgbGVuZ3RoID0gMixcbiAgICAgICAgc3RhY2tBID0gYXJnc1szXSxcbiAgICAgICAgc3RhY2tCID0gYXJnc1s0XTtcblxuICAgIGlmIChpbmRpY2F0b3IgIT09IG9iamVjdFJlZikge1xuICAgICAgc3RhY2tBID0gW107XG4gICAgICBzdGFja0IgPSBbXTtcbiAgICAgIGxlbmd0aCA9IGFyZ3MubGVuZ3RoO1xuICAgIH1cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgZm9yT3duKGFyZ3NbaW5kZXhdLCBmdW5jdGlvbihzb3VyY2UsIGtleSkge1xuICAgICAgICB2YXIgZm91bmQsIGlzQXJyLCB2YWx1ZTtcbiAgICAgICAgaWYgKHNvdXJjZSAmJiAoKGlzQXJyID0gaXNBcnJheShzb3VyY2UpKSB8fCBpc1BsYWluT2JqZWN0KHNvdXJjZSkpKSB7XG4gICAgICAgICAgLy8gYXZvaWQgbWVyZ2luZyBwcmV2aW91c2x5IG1lcmdlZCBjeWNsaWMgc291cmNlc1xuICAgICAgICAgIHZhciBzdGFja0xlbmd0aCA9IHN0YWNrQS5sZW5ndGg7XG4gICAgICAgICAgd2hpbGUgKHN0YWNrTGVuZ3RoLS0pIHtcbiAgICAgICAgICAgIGZvdW5kID0gc3RhY2tBW3N0YWNrTGVuZ3RoXSA9PSBzb3VyY2U7XG4gICAgICAgICAgICBpZiAoZm91bmQpIHtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChmb3VuZCkge1xuICAgICAgICAgICAgb2JqZWN0W2tleV0gPSBzdGFja0Jbc3RhY2tMZW5ndGhdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFkZCBgc291cmNlYCBhbmQgYXNzb2NpYXRlZCBgdmFsdWVgIHRvIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0c1xuICAgICAgICAgICAgc3RhY2tBLnB1c2goc291cmNlKTtcbiAgICAgICAgICAgIHN0YWNrQi5wdXNoKHZhbHVlID0gKHZhbHVlID0gb2JqZWN0W2tleV0sIGlzQXJyKVxuICAgICAgICAgICAgICA/IChpc0FycmF5KHZhbHVlKSA/IHZhbHVlIDogW10pXG4gICAgICAgICAgICAgIDogKGlzUGxhaW5PYmplY3QodmFsdWUpID8gdmFsdWUgOiB7fSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICAvLyByZWN1cnNpdmVseSBtZXJnZSBvYmplY3RzIGFuZCBhcnJheXMgKHN1c2NlcHRpYmxlIHRvIGNhbGwgc3RhY2sgbGltaXRzKVxuICAgICAgICAgICAgb2JqZWN0W2tleV0gPSBtZXJnZSh2YWx1ZSwgc291cmNlLCBvYmplY3RSZWYsIHN0YWNrQSwgc3RhY2tCKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc291cmNlICE9IG51bGwpIHtcbiAgICAgICAgICBvYmplY3Rba2V5XSA9IHNvdXJjZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3Q7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIHNoYWxsb3cgY2xvbmUgb2YgYG9iamVjdGAgZXhjbHVkaW5nIHRoZSBzcGVjaWZpZWQgcHJvcGVydGllcy5cbiAgICogUHJvcGVydHkgbmFtZXMgbWF5IGJlIHNwZWNpZmllZCBhcyBpbmRpdmlkdWFsIGFyZ3VtZW50cyBvciBhcyBhcnJheXMgb2ZcbiAgICogcHJvcGVydHkgbmFtZXMuIElmIGBjYWxsYmFja2AgaXMgcGFzc2VkLCBpdCB3aWxsIGJlIGV4ZWN1dGVkIGZvciBlYWNoIHByb3BlcnR5XG4gICAqIGluIHRoZSBgb2JqZWN0YCwgb21pdHRpbmcgdGhlIHByb3BlcnRpZXMgYGNhbGxiYWNrYCByZXR1cm5zIHRydXRoeSBmb3IuIFRoZVxuICAgKiBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBrZXksIG9iamVjdCkuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgc291cmNlIG9iamVjdC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxTdHJpbmd9IGNhbGxiYWNrfFtwcm9wMSwgcHJvcDIsIC4uLl0gVGhlIHByb3BlcnRpZXMgdG8gb21pdFxuICAgKiAgb3IgdGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYW4gb2JqZWN0IHdpdGhvdXQgdGhlIG9taXR0ZWQgcHJvcGVydGllcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5vbWl0KHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwLCAndXNlcmlkJzogJ21vZTEnIH0sICd1c2VyaWQnKTtcbiAgICogLy8gPT4geyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfVxuICAgKlxuICAgKiBfLm9taXQoeyAnbmFtZSc6ICdtb2UnLCAnX2hpbnQnOiAna251Y2tsZWhlYWQnLCAnX3NlZWQnOiAnOTZjNGViJyB9LCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAqICAgcmV0dXJuIGtleS5jaGFyQXQoMCkgPT0gJ18nO1xuICAgKiB9KTtcbiAgICogLy8gPT4geyAnbmFtZSc6ICdtb2UnIH1cbiAgICovXG4gIGZ1bmN0aW9uIG9taXQob2JqZWN0LCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciBpc0Z1bmMgPSB0eXBlb2YgY2FsbGJhY2sgPT0gJ2Z1bmN0aW9uJyxcbiAgICAgICAgcmVzdWx0ID0ge307XG5cbiAgICBpZiAoaXNGdW5jKSB7XG4gICAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHByb3BzID0gY29uY2F0LmFwcGx5KGFycmF5UmVmLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgICBmb3JJbihvYmplY3QsIGZ1bmN0aW9uKHZhbHVlLCBrZXksIG9iamVjdCkge1xuICAgICAgaWYgKGlzRnVuY1xuICAgICAgICAgICAgPyAhY2FsbGJhY2sodmFsdWUsIGtleSwgb2JqZWN0KVxuICAgICAgICAgICAgOiBpbmRleE9mKHByb3BzLCBrZXksIDEpIDwgMFxuICAgICAgICAgICkge1xuICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIHR3byBkaW1lbnNpb25hbCBhcnJheSBvZiB0aGUgZ2l2ZW4gb2JqZWN0J3Mga2V5LXZhbHVlIHBhaXJzLFxuICAgKiBpLmUuIGBbW2tleTEsIHZhbHVlMV0sIFtrZXkyLCB2YWx1ZTJdXWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGluc3BlY3QuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBuZXcgYXJyYXkgb2Yga2V5LXZhbHVlIHBhaXJzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnBhaXJzKHsgJ21vZSc6IDMwLCAnbGFycnknOiA0MCwgJ2N1cmx5JzogNTAgfSk7XG4gICAqIC8vID0+IFtbJ21vZScsIDMwXSwgWydsYXJyeScsIDQwXSwgWydjdXJseScsIDUwXV0gKG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICAgKi9cbiAgZnVuY3Rpb24gcGFpcnMob2JqZWN0KSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIGZvck93bihvYmplY3QsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKFtrZXksIHZhbHVlXSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgc2hhbGxvdyBjbG9uZSBvZiBgb2JqZWN0YCBjb21wb3NlZCBvZiB0aGUgc3BlY2lmaWVkIHByb3BlcnRpZXMuXG4gICAqIFByb3BlcnR5IG5hbWVzIG1heSBiZSBzcGVjaWZpZWQgYXMgaW5kaXZpZHVhbCBhcmd1bWVudHMgb3IgYXMgYXJyYXlzIG9mXG4gICAqIHByb3BlcnR5IG5hbWVzLiBJZiBgY2FsbGJhY2tgIGlzIHBhc3NlZCwgaXQgd2lsbCBiZSBleGVjdXRlZCBmb3IgZWFjaCBwcm9wZXJ0eVxuICAgKiBpbiB0aGUgYG9iamVjdGAsIHBpY2tpbmcgdGhlIHByb3BlcnRpZXMgYGNhbGxiYWNrYCByZXR1cm5zIHRydXRoeSBmb3IuIFRoZVxuICAgKiBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBrZXksIG9iamVjdCkuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgc291cmNlIG9iamVjdC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxTdHJpbmd9IGNhbGxiYWNrfFtwcm9wMSwgcHJvcDIsIC4uLl0gVGhlIHByb3BlcnRpZXMgdG8gcGlja1xuICAgKiAgb3IgdGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYW4gb2JqZWN0IGNvbXBvc2VkIG9mIHRoZSBwaWNrZWQgcHJvcGVydGllcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5waWNrKHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwLCAndXNlcmlkJzogJ21vZTEnIH0sICduYW1lJywgJ2FnZScpO1xuICAgKiAvLyA9PiB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9XG4gICAqXG4gICAqIF8ucGljayh7ICduYW1lJzogJ21vZScsICdfaGludCc6ICdrbnVja2xlaGVhZCcsICdfc2VlZCc6ICc5NmM0ZWInIH0sIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICogICByZXR1cm4ga2V5LmNoYXJBdCgwKSAhPSAnXyc7XG4gICAqIH0pO1xuICAgKiAvLyA9PiB7ICduYW1lJzogJ21vZScgfVxuICAgKi9cbiAgZnVuY3Rpb24gcGljayhvYmplY3QsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdmFyIGluZGV4ID0gMCxcbiAgICAgICAgICBwcm9wcyA9IGNvbmNhdC5hcHBseShhcnJheVJlZiwgYXJndW1lbnRzKSxcbiAgICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGg7XG5cbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XG4gICAgICAgIGlmIChrZXkgaW4gb2JqZWN0KSB7XG4gICAgICAgICAgcmVzdWx0W2tleV0gPSBvYmplY3Rba2V5XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgICAgIGZvckluKG9iamVjdCwgZnVuY3Rpb24odmFsdWUsIGtleSwgb2JqZWN0KSB7XG4gICAgICAgIGlmIChjYWxsYmFjayh2YWx1ZSwga2V5LCBvYmplY3QpKSB7XG4gICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhcnJheSBjb21wb3NlZCBvZiB0aGUgb3duIGVudW1lcmFibGUgcHJvcGVydHkgdmFsdWVzIG9mIGBvYmplY3RgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnNwZWN0LlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgcHJvcGVydHkgdmFsdWVzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnZhbHVlcyh7ICdvbmUnOiAxLCAndHdvJzogMiwgJ3RocmVlJzogMyB9KTtcbiAgICogLy8gPT4gWzEsIDIsIDNdXG4gICAqL1xuICBmdW5jdGlvbiB2YWx1ZXMob2JqZWN0KSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIGZvck93bihvYmplY3QsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYSBnaXZlbiBgdGFyZ2V0YCBlbGVtZW50IGlzIHByZXNlbnQgaW4gYSBgY29sbGVjdGlvbmAgdXNpbmcgc3RyaWN0XG4gICAqIGVxdWFsaXR5IGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC4gSWYgYGZyb21JbmRleGAgaXMgbmVnYXRpdmUsIGl0IGlzIHVzZWRcbiAgICogYXMgdGhlIG9mZnNldCBmcm9tIHRoZSBlbmQgb2YgdGhlIGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIGluY2x1ZGVcbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHRhcmdldCBUaGUgdmFsdWUgdG8gY2hlY2sgZm9yLlxuICAgKiBAcGFyYW0ge051bWJlcn0gW2Zyb21JbmRleD0wXSBUaGUgaW5kZXggdG8gc2VhcmNoIGZyb20uXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHRhcmdldGAgZWxlbWVudCBpcyBmb3VuZCwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmNvbnRhaW5zKFsxLCAyLCAzXSwgMSk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogXy5jb250YWlucyhbMSwgMiwgM10sIDEsIDIpO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiBfLmNvbnRhaW5zKHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH0sICdtb2UnKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmNvbnRhaW5zKCdjdXJseScsICd1cicpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBjb250YWlucyhjb2xsZWN0aW9uLCB0YXJnZXQsIGZyb21JbmRleCkge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwO1xuXG4gICAgZnJvbUluZGV4ID0gKGZyb21JbmRleCA8IDAgPyBuYXRpdmVNYXgoMCwgbGVuZ3RoICsgZnJvbUluZGV4KSA6IGZyb21JbmRleCkgfHwgMDtcbiAgICBpZiAodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuIChpc1N0cmluZyhjb2xsZWN0aW9uKVxuICAgICAgICA/IGNvbGxlY3Rpb24uaW5kZXhPZih0YXJnZXQsIGZyb21JbmRleClcbiAgICAgICAgOiBpbmRleE9mKGNvbGxlY3Rpb24sIHRhcmdldCwgZnJvbUluZGV4KVxuICAgICAgKSA+IC0xO1xuICAgIH1cbiAgICByZXR1cm4gc29tZShjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuICsraW5kZXggPj0gZnJvbUluZGV4ICYmIHZhbHVlID09PSB0YXJnZXQ7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBvYmplY3QgY29tcG9zZWQgb2Yga2V5cyByZXR1cm5lZCBmcm9tIHJ1bm5pbmcgZWFjaCBlbGVtZW50IG9mXG4gICAqIGBjb2xsZWN0aW9uYCB0aHJvdWdoIGEgYGNhbGxiYWNrYC4gVGhlIGNvcnJlc3BvbmRpbmcgdmFsdWUgb2YgZWFjaCBrZXkgaXNcbiAgICogdGhlIG51bWJlciBvZiB0aW1lcyB0aGUga2V5IHdhcyByZXR1cm5lZCBieSBgY2FsbGJhY2tgLiBUaGUgYGNhbGxiYWNrYCBpc1xuICAgKiBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICogVGhlIGBjYWxsYmFja2AgYXJndW1lbnQgbWF5IGFsc28gYmUgdGhlIG5hbWUgb2YgYSBwcm9wZXJ0eSB0byBjb3VudCBieSAoZS5nLiAnbGVuZ3RoJykuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258U3RyaW5nfSBjYWxsYmFja3xwcm9wZXJ0eSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb25cbiAgICogIG9yIHByb3BlcnR5IG5hbWUgdG8gY291bnQgYnkuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgY29tcG9zZWQgYWdncmVnYXRlIG9iamVjdC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5jb3VudEJ5KFs0LjMsIDYuMSwgNi40XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBNYXRoLmZsb29yKG51bSk7IH0pO1xuICAgKiAvLyA9PiB7ICc0JzogMSwgJzYnOiAyIH1cbiAgICpcbiAgICogXy5jb3VudEJ5KFs0LjMsIDYuMSwgNi40XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiB0aGlzLmZsb29yKG51bSk7IH0sIE1hdGgpO1xuICAgKiAvLyA9PiB7ICc0JzogMSwgJzYnOiAyIH1cbiAgICpcbiAgICogXy5jb3VudEJ5KFsnb25lJywgJ3R3bycsICd0aHJlZSddLCAnbGVuZ3RoJyk7XG4gICAqIC8vID0+IHsgJzMnOiAyLCAnNSc6IDEgfVxuICAgKi9cbiAgZnVuY3Rpb24gY291bnRCeShjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBrZXksIGNvbGxlY3Rpb24pIHtcbiAgICAgIGtleSA9IGNhbGxiYWNrKHZhbHVlLCBrZXksIGNvbGxlY3Rpb24pO1xuICAgICAgKGhhc093blByb3BlcnR5LmNhbGwocmVzdWx0LCBrZXkpID8gcmVzdWx0W2tleV0rKyA6IHJlc3VsdFtrZXldID0gMSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIGBjYWxsYmFja2AgcmV0dXJucyBhIHRydXRoeSB2YWx1ZSBmb3IgKiphbGwqKiBlbGVtZW50cyBvZiBhXG4gICAqIGBjb2xsZWN0aW9uYC4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWVcbiAgICogYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIGFsbFxuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGFsbCBlbGVtZW50cyBwYXNzIHRoZSBjYWxsYmFjayBjaGVjayxcbiAgICogIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5ldmVyeShbdHJ1ZSwgMSwgbnVsbCwgJ3llcyddLCBCb29sZWFuKTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICovXG4gIGZ1bmN0aW9uIGV2ZXJ5KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIHJlc3VsdCA9IHRydWU7XG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG5cbiAgICBpZiAoaXNBcnJheShjb2xsZWN0aW9uKSkge1xuICAgICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbi5sZW5ndGg7XG5cbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIGlmICghKHJlc3VsdCA9ICEhY2FsbGJhY2soY29sbGVjdGlvbltpbmRleF0sIGluZGV4LCBjb2xsZWN0aW9uKSkpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gKHJlc3VsdCA9ICEhY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGFtaW5lcyBlYWNoIGVsZW1lbnQgaW4gYSBgY29sbGVjdGlvbmAsIHJldHVybmluZyBhbiBhcnJheSBvZiBhbGwgZWxlbWVudHNcbiAgICogdGhlIGBjYWxsYmFja2AgcmV0dXJucyB0cnV0aHkgZm9yLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kXG4gICAqIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgc2VsZWN0XG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZWxlbWVudHMgdGhhdCBwYXNzZWQgdGhlIGNhbGxiYWNrIGNoZWNrLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgZXZlbnMgPSBfLmZpbHRlcihbMSwgMiwgMywgNCwgNSwgNl0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gbnVtICUgMiA9PSAwOyB9KTtcbiAgICogLy8gPT4gWzIsIDQsIDZdXG4gICAqL1xuICBmdW5jdGlvbiBmaWx0ZXIoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIGlmIChjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4YW1pbmVzIGVhY2ggZWxlbWVudCBpbiBhIGBjb2xsZWN0aW9uYCwgcmV0dXJuaW5nIHRoZSBmaXJzdCBvbmUgdGhlIGBjYWxsYmFja2BcbiAgICogcmV0dXJucyB0cnV0aHkgZm9yLiBUaGUgZnVuY3Rpb24gcmV0dXJucyBhcyBzb29uIGFzIGl0IGZpbmRzIGFuIGFjY2VwdGFibGVcbiAgICogZWxlbWVudCwgYW5kIGRvZXMgbm90IGl0ZXJhdGUgb3ZlciB0aGUgZW50aXJlIGBjb2xsZWN0aW9uYC4gVGhlIGBjYWxsYmFja2AgaXNcbiAgICogYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIGRldGVjdFxuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgZWxlbWVudCB0aGF0IHBhc3NlZCB0aGUgY2FsbGJhY2sgY2hlY2ssXG4gICAqICBlbHNlIGB1bmRlZmluZWRgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgZXZlbiA9IF8uZmluZChbMSwgMiwgMywgNCwgNSwgNl0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gbnVtICUgMiA9PSAwOyB9KTtcbiAgICogLy8gPT4gMlxuICAgKi9cbiAgZnVuY3Rpb24gZmluZChjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciByZXN1bHQ7XG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIGlmIChjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJdGVyYXRlcyBvdmVyIGEgYGNvbGxlY3Rpb25gLCBleGVjdXRpbmcgdGhlIGBjYWxsYmFja2AgZm9yIGVhY2ggZWxlbWVudCBpblxuICAgKiB0aGUgYGNvbGxlY3Rpb25gLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZVxuICAgKiBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS4gQ2FsbGJhY2tzIG1heSBleGl0IGl0ZXJhdGlvbiBlYXJseVxuICAgKiBieSBleHBsaWNpdGx5IHJldHVybmluZyBgZmFsc2VgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBhbGlhcyBlYWNoXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0FycmF5fE9iamVjdHxTdHJpbmd9IFJldHVybnMgYGNvbGxlY3Rpb25gLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfKFsxLCAyLCAzXSkuZm9yRWFjaChhbGVydCkuam9pbignLCcpO1xuICAgKiAvLyA9PiBhbGVydHMgZWFjaCBudW1iZXIgYW5kIHJldHVybnMgJzEsMiwzJ1xuICAgKlxuICAgKiBfLmZvckVhY2goeyAnb25lJzogMSwgJ3R3byc6IDIsICd0aHJlZSc6IDMgfSwgYWxlcnQpO1xuICAgKiAvLyA9PiBhbGVydHMgZWFjaCBudW1iZXIgKG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICAgKi9cbiAgdmFyIGZvckVhY2ggPSBjcmVhdGVJdGVyYXRvcihmb3JFYWNoSXRlcmF0b3JPcHRpb25zKTtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBvYmplY3QgY29tcG9zZWQgb2Yga2V5cyByZXR1cm5lZCBmcm9tIHJ1bm5pbmcgZWFjaCBlbGVtZW50IG9mXG4gICAqIGBjb2xsZWN0aW9uYCB0aHJvdWdoIGEgYGNhbGxiYWNrYC4gVGhlIGNvcnJlc3BvbmRpbmcgdmFsdWUgb2YgZWFjaCBrZXkgaXMgYW5cbiAgICogYXJyYXkgb2YgZWxlbWVudHMgcGFzc2VkIHRvIGBjYWxsYmFja2AgdGhhdCByZXR1cm5lZCB0aGUga2V5LiBUaGUgYGNhbGxiYWNrYFxuICAgKiBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICogVGhlIGBjYWxsYmFja2AgYXJndW1lbnQgbWF5IGFsc28gYmUgdGhlIG5hbWUgb2YgYSBwcm9wZXJ0eSB0byBncm91cCBieSAoZS5nLiAnbGVuZ3RoJykuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258U3RyaW5nfSBjYWxsYmFja3xwcm9wZXJ0eSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb25cbiAgICogIG9yIHByb3BlcnR5IG5hbWUgdG8gZ3JvdXAgYnkuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgY29tcG9zZWQgYWdncmVnYXRlIG9iamVjdC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5ncm91cEJ5KFs0LjIsIDYuMSwgNi40XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBNYXRoLmZsb29yKG51bSk7IH0pO1xuICAgKiAvLyA9PiB7ICc0JzogWzQuMl0sICc2JzogWzYuMSwgNi40XSB9XG4gICAqXG4gICAqIF8uZ3JvdXBCeShbNC4yLCA2LjEsIDYuNF0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gdGhpcy5mbG9vcihudW0pOyB9LCBNYXRoKTtcbiAgICogLy8gPT4geyAnNCc6IFs0LjJdLCAnNic6IFs2LjEsIDYuNF0gfVxuICAgKlxuICAgKiBfLmdyb3VwQnkoWydvbmUnLCAndHdvJywgJ3RocmVlJ10sICdsZW5ndGgnKTtcbiAgICogLy8gPT4geyAnMyc6IFsnb25lJywgJ3R3byddLCAnNSc6IFsndGhyZWUnXSB9XG4gICAqL1xuICBmdW5jdGlvbiBncm91cEJ5KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGtleSwgY29sbGVjdGlvbikge1xuICAgICAga2V5ID0gY2FsbGJhY2sodmFsdWUsIGtleSwgY29sbGVjdGlvbik7XG4gICAgICAoaGFzT3duUHJvcGVydHkuY2FsbChyZXN1bHQsIGtleSkgPyByZXN1bHRba2V5XSA6IHJlc3VsdFtrZXldID0gW10pLnB1c2godmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgbWV0aG9kIG5hbWVkIGJ5IGBtZXRob2ROYW1lYCBvbiBlYWNoIGVsZW1lbnQgaW4gdGhlIGBjb2xsZWN0aW9uYCxcbiAgICogcmV0dXJuaW5nIGFuIGFycmF5IG9mIHRoZSByZXN1bHRzIG9mIGVhY2ggaW52b2tlZCBtZXRob2QuIEFkZGl0aW9uYWwgYXJndW1lbnRzXG4gICAqIHdpbGwgYmUgcGFzc2VkIHRvIGVhY2ggaW52b2tlZCBtZXRob2QuIElmIGBtZXRob2ROYW1lYCBpcyBhIGZ1bmN0aW9uIGl0IHdpbGxcbiAgICogYmUgaW52b2tlZCBmb3IsIGFuZCBgdGhpc2AgYm91bmQgdG8sIGVhY2ggZWxlbWVudCBpbiB0aGUgYGNvbGxlY3Rpb25gLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufFN0cmluZ30gbWV0aG9kTmFtZSBUaGUgbmFtZSBvZiB0aGUgbWV0aG9kIHRvIGludm9rZSBvclxuICAgKiAgdGhlIGZ1bmN0aW9uIGludm9rZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW2FyZzEsIGFyZzIsIC4uLl0gQXJndW1lbnRzIHRvIGludm9rZSB0aGUgbWV0aG9kIHdpdGguXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiB0aGUgcmVzdWx0cyBvZiBlYWNoIGludm9rZWQgbWV0aG9kLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmludm9rZShbWzUsIDEsIDddLCBbMywgMiwgMV1dLCAnc29ydCcpO1xuICAgKiAvLyA9PiBbWzEsIDUsIDddLCBbMSwgMiwgM11dXG4gICAqXG4gICAqIF8uaW52b2tlKFsxMjMsIDQ1Nl0sIFN0cmluZy5wcm90b3R5cGUuc3BsaXQsICcnKTtcbiAgICogLy8gPT4gW1snMScsICcyJywgJzMnXSwgWyc0JywgJzUnLCAnNiddXVxuICAgKi9cbiAgZnVuY3Rpb24gaW52b2tlKGNvbGxlY3Rpb24sIG1ldGhvZE5hbWUpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSxcbiAgICAgICAgaXNGdW5jID0gdHlwZW9mIG1ldGhvZE5hbWUgPT0gJ2Z1bmN0aW9uJyxcbiAgICAgICAgcmVzdWx0ID0gW107XG5cbiAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXN1bHQucHVzaCgoaXNGdW5jID8gbWV0aG9kTmFtZSA6IHZhbHVlW21ldGhvZE5hbWVdKS5hcHBseSh2YWx1ZSwgYXJncykpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhcnJheSBvZiB2YWx1ZXMgYnkgcnVubmluZyBlYWNoIGVsZW1lbnQgaW4gdGhlIGBjb2xsZWN0aW9uYFxuICAgKiB0aHJvdWdoIGEgYGNhbGxiYWNrYC4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGhcbiAgICogdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIGNvbGxlY3RcbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiB0aGUgcmVzdWx0cyBvZiBlYWNoIGBjYWxsYmFja2AgZXhlY3V0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLm1hcChbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gbnVtICogMzsgfSk7XG4gICAqIC8vID0+IFszLCA2LCA5XVxuICAgKlxuICAgKiBfLm1hcCh7ICdvbmUnOiAxLCAndHdvJzogMiwgJ3RocmVlJzogMyB9LCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIG51bSAqIDM7IH0pO1xuICAgKiAvLyA9PiBbMywgNiwgOV0gKG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICAgKi9cbiAgZnVuY3Rpb24gbWFwKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDAsXG4gICAgICAgIHJlc3VsdCA9IEFycmF5KHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgPyBsZW5ndGggOiAwKTtcblxuICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgIGlmIChpc0FycmF5KGNvbGxlY3Rpb24pKSB7XG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICByZXN1bHRbaW5kZXhdID0gY2FsbGJhY2soY29sbGVjdGlvbltpbmRleF0sIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgIHJlc3VsdFsrK2luZGV4XSA9IGNhbGxiYWNrKHZhbHVlLCBrZXksIGNvbGxlY3Rpb24pO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSBtYXhpbXVtIHZhbHVlIG9mIGFuIGBhcnJheWAuIElmIGBjYWxsYmFja2AgaXMgcGFzc2VkLFxuICAgKiBpdCB3aWxsIGJlIGV4ZWN1dGVkIGZvciBlYWNoIHZhbHVlIGluIHRoZSBgYXJyYXlgIHRvIGdlbmVyYXRlIHRoZVxuICAgKiBjcml0ZXJpb24gYnkgd2hpY2ggdGhlIHZhbHVlIGlzIHJhbmtlZC4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG9cbiAgICogYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSBtYXhpbXVtIHZhbHVlLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgc3Rvb2dlcyA9IFtcbiAgICogICB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnbGFycnknLCAnYWdlJzogNTAgfSxcbiAgICogICB7ICduYW1lJzogJ2N1cmx5JywgJ2FnZSc6IDYwIH1cbiAgICogXTtcbiAgICpcbiAgICogXy5tYXgoc3Rvb2dlcywgZnVuY3Rpb24oc3Rvb2dlKSB7IHJldHVybiBzdG9vZ2UuYWdlOyB9KTtcbiAgICogLy8gPT4geyAnbmFtZSc6ICdjdXJseScsICdhZ2UnOiA2MCB9O1xuICAgKi9cbiAgZnVuY3Rpb24gbWF4KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIGNvbXB1dGVkID0gLUluZmluaXR5LFxuICAgICAgICBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwLFxuICAgICAgICByZXN1bHQgPSBjb21wdXRlZDtcblxuICAgIGlmIChjYWxsYmFjayB8fCAhaXNBcnJheShjb2xsZWN0aW9uKSkge1xuICAgICAgY2FsbGJhY2sgPSAhY2FsbGJhY2sgJiYgaXNTdHJpbmcoY29sbGVjdGlvbilcbiAgICAgICAgPyBjaGFyQXRDYWxsYmFja1xuICAgICAgICA6IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcblxuICAgICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSBjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgICBpZiAoY3VycmVudCA+IGNvbXB1dGVkKSB7XG4gICAgICAgICAgY29tcHV0ZWQgPSBjdXJyZW50O1xuICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb25baW5kZXhdID4gcmVzdWx0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gY29sbGVjdGlvbltpbmRleF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIG1pbmltdW0gdmFsdWUgb2YgYW4gYGFycmF5YC4gSWYgYGNhbGxiYWNrYCBpcyBwYXNzZWQsXG4gICAqIGl0IHdpbGwgYmUgZXhlY3V0ZWQgZm9yIGVhY2ggdmFsdWUgaW4gdGhlIGBhcnJheWAgdG8gZ2VuZXJhdGUgdGhlXG4gICAqIGNyaXRlcmlvbiBieSB3aGljaCB0aGUgdmFsdWUgaXMgcmFua2VkLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2BcbiAgICogYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgdGhlIG1pbmltdW0gdmFsdWUuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ubWluKFsxMCwgNSwgMTAwLCAyLCAxMDAwXSk7XG4gICAqIC8vID0+IDJcbiAgICovXG4gIGZ1bmN0aW9uIG1pbihjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciBjb21wdXRlZCA9IEluZmluaXR5LFxuICAgICAgICBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwLFxuICAgICAgICByZXN1bHQgPSBjb21wdXRlZDtcblxuICAgIGlmIChjYWxsYmFjayB8fCAhaXNBcnJheShjb2xsZWN0aW9uKSkge1xuICAgICAgY2FsbGJhY2sgPSAhY2FsbGJhY2sgJiYgaXNTdHJpbmcoY29sbGVjdGlvbilcbiAgICAgICAgPyBjaGFyQXRDYWxsYmFja1xuICAgICAgICA6IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcblxuICAgICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSBjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgICBpZiAoY3VycmVudCA8IGNvbXB1dGVkKSB7XG4gICAgICAgICAgY29tcHV0ZWQgPSBjdXJyZW50O1xuICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb25baW5kZXhdIDwgcmVzdWx0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gY29sbGVjdGlvbltpbmRleF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIHZhbHVlIG9mIGEgc3BlY2lmaWVkIHByb3BlcnR5IGZyb20gYWxsIGVsZW1lbnRzIGluXG4gICAqIHRoZSBgY29sbGVjdGlvbmAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eSBUaGUgcHJvcGVydHkgdG8gcGx1Y2suXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBwcm9wZXJ0eSB2YWx1ZXMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBzdG9vZ2VzID0gW1xuICAgKiAgIHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH0sXG4gICAqICAgeyAnbmFtZSc6ICdsYXJyeScsICdhZ2UnOiA1MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnY3VybHknLCAnYWdlJzogNjAgfVxuICAgKiBdO1xuICAgKlxuICAgKiBfLnBsdWNrKHN0b29nZXMsICduYW1lJyk7XG4gICAqIC8vID0+IFsnbW9lJywgJ2xhcnJ5JywgJ2N1cmx5J11cbiAgICovXG4gIGZ1bmN0aW9uIHBsdWNrKGNvbGxlY3Rpb24sIHByb3BlcnR5KSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHZhbHVlW3Byb3BlcnR5XSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCb2lscyBkb3duIGEgYGNvbGxlY3Rpb25gIHRvIGEgc2luZ2xlIHZhbHVlLiBUaGUgaW5pdGlhbCBzdGF0ZSBvZiB0aGVcbiAgICogcmVkdWN0aW9uIGlzIGBhY2N1bXVsYXRvcmAgYW5kIGVhY2ggc3VjY2Vzc2l2ZSBzdGVwIG9mIGl0IHNob3VsZCBiZSByZXR1cm5lZFxuICAgKiBieSB0aGUgYGNhbGxiYWNrYC4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggNFxuICAgKiBhcmd1bWVudHM7IGZvciBhcnJheXMgdGhleSBhcmUgKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgZm9sZGwsIGluamVjdFxuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbYWNjdW11bGF0b3JdIEluaXRpYWwgdmFsdWUgb2YgdGhlIGFjY3VtdWxhdG9yLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgYWNjdW11bGF0ZWQgdmFsdWUuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBzdW0gPSBfLnJlZHVjZShbMSwgMiwgM10sIGZ1bmN0aW9uKG1lbW8sIG51bSkgeyByZXR1cm4gbWVtbyArIG51bTsgfSk7XG4gICAqIC8vID0+IDZcbiAgICovXG4gIGZ1bmN0aW9uIHJlZHVjZShjb2xsZWN0aW9uLCBjYWxsYmFjaywgYWNjdW11bGF0b3IsIHRoaXNBcmcpIHtcbiAgICB2YXIgbm9hY2N1bSA9IGFyZ3VtZW50cy5sZW5ndGggPCAzO1xuICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICBhY2N1bXVsYXRvciA9IG5vYWNjdW1cbiAgICAgICAgPyAobm9hY2N1bSA9IGZhbHNlLCB2YWx1ZSlcbiAgICAgICAgOiBjYWxsYmFjayhhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKVxuICAgIH0pO1xuICAgIHJldHVybiBhY2N1bXVsYXRvcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgcmlnaHQtYXNzb2NpYXRpdmUgdmVyc2lvbiBvZiBgXy5yZWR1Y2VgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBhbGlhcyBmb2xkclxuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbYWNjdW11bGF0b3JdIEluaXRpYWwgdmFsdWUgb2YgdGhlIGFjY3VtdWxhdG9yLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgYWNjdW11bGF0ZWQgdmFsdWUuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBsaXN0ID0gW1swLCAxXSwgWzIsIDNdLCBbNCwgNV1dO1xuICAgKiB2YXIgZmxhdCA9IF8ucmVkdWNlUmlnaHQobGlzdCwgZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYS5jb25jYXQoYik7IH0sIFtdKTtcbiAgICogLy8gPT4gWzQsIDUsIDIsIDMsIDAsIDFdXG4gICAqL1xuICBmdW5jdGlvbiByZWR1Y2VSaWdodChjb2xsZWN0aW9uLCBjYWxsYmFjaywgYWNjdW11bGF0b3IsIHRoaXNBcmcpIHtcbiAgICB2YXIgaXRlcmF0ZWUgPSBjb2xsZWN0aW9uLFxuICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwLFxuICAgICAgICBub2FjY3VtID0gYXJndW1lbnRzLmxlbmd0aCA8IDM7XG5cbiAgICBpZiAodHlwZW9mIGxlbmd0aCAhPSAnbnVtYmVyJykge1xuICAgICAgdmFyIHByb3BzID0ga2V5cyhjb2xsZWN0aW9uKTtcbiAgICAgIGxlbmd0aCA9IHByb3BzLmxlbmd0aDtcbiAgICB9IGVsc2UgaWYgKG5vQ2hhckJ5SW5kZXggJiYgaXNTdHJpbmcoY29sbGVjdGlvbikpIHtcbiAgICAgIGl0ZXJhdGVlID0gY29sbGVjdGlvbi5zcGxpdCgnJyk7XG4gICAgfVxuICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICBpbmRleCA9IHByb3BzID8gcHJvcHNbLS1sZW5ndGhdIDogLS1sZW5ndGg7XG4gICAgICBhY2N1bXVsYXRvciA9IG5vYWNjdW1cbiAgICAgICAgPyAobm9hY2N1bSA9IGZhbHNlLCBpdGVyYXRlZVtpbmRleF0pXG4gICAgICAgIDogY2FsbGJhY2suY2FsbCh0aGlzQXJnLCBhY2N1bXVsYXRvciwgaXRlcmF0ZWVbaW5kZXhdLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgfSk7XG4gICAgcmV0dXJuIGFjY3VtdWxhdG9yO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBvcHBvc2l0ZSBvZiBgXy5maWx0ZXJgLCB0aGlzIG1ldGhvZCByZXR1cm5zIHRoZSB2YWx1ZXMgb2YgYVxuICAgKiBgY29sbGVjdGlvbmAgdGhhdCBgY2FsbGJhY2tgIGRvZXMgKipub3QqKiByZXR1cm4gdHJ1dGh5IGZvci5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGVsZW1lbnRzIHRoYXQgZGlkICoqbm90KiogcGFzcyB0aGVcbiAgICogIGNhbGxiYWNrIGNoZWNrLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgb2RkcyA9IF8ucmVqZWN0KFsxLCAyLCAzLCA0LCA1LCA2XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gJSAyID09IDA7IH0pO1xuICAgKiAvLyA9PiBbMSwgMywgNV1cbiAgICovXG4gIGZ1bmN0aW9uIHJlamVjdChjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgIHJldHVybiBmaWx0ZXIoY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICByZXR1cm4gIWNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhcnJheSBvZiBzaHVmZmxlZCBgYXJyYXlgIHZhbHVlcywgdXNpbmcgYSB2ZXJzaW9uIG9mIHRoZVxuICAgKiBGaXNoZXItWWF0ZXMgc2h1ZmZsZS4gU2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRmlzaGVyLVlhdGVzX3NodWZmbGUuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBzaHVmZmxlLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgc2h1ZmZsZWQgY29sbGVjdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5zaHVmZmxlKFsxLCAyLCAzLCA0LCA1LCA2XSk7XG4gICAqIC8vID0+IFs0LCAxLCA2LCAzLCA1LCAyXVxuICAgKi9cbiAgZnVuY3Rpb24gc2h1ZmZsZShjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIHJlc3VsdCA9IEFycmF5KGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDApO1xuXG4gICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFyIHJhbmQgPSBmbG9vcihuYXRpdmVSYW5kb20oKSAqICgrK2luZGV4ICsgMSkpO1xuICAgICAgcmVzdWx0W2luZGV4XSA9IHJlc3VsdFtyYW5kXTtcbiAgICAgIHJlc3VsdFtyYW5kXSA9IHZhbHVlO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgc2l6ZSBvZiB0aGUgYGNvbGxlY3Rpb25gIGJ5IHJldHVybmluZyBgY29sbGVjdGlvbi5sZW5ndGhgIGZvciBhcnJheXNcbiAgICogYW5kIGFycmF5LWxpa2Ugb2JqZWN0cyBvciB0aGUgbnVtYmVyIG9mIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgZm9yIG9iamVjdHMuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpbnNwZWN0LlxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSBSZXR1cm5zIGBjb2xsZWN0aW9uLmxlbmd0aGAgb3IgbnVtYmVyIG9mIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uc2l6ZShbMSwgMl0pO1xuICAgKiAvLyA9PiAyXG4gICAqXG4gICAqIF8uc2l6ZSh7ICdvbmUnOiAxLCAndHdvJzogMiwgJ3RocmVlJzogMyB9KTtcbiAgICogLy8gPT4gM1xuICAgKlxuICAgKiBfLnNpemUoJ2N1cmx5Jyk7XG4gICAqIC8vID0+IDVcbiAgICovXG4gIGZ1bmN0aW9uIHNpemUoY29sbGVjdGlvbikge1xuICAgIHZhciBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwO1xuICAgIHJldHVybiB0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInID8gbGVuZ3RoIDoga2V5cyhjb2xsZWN0aW9uKS5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSBgY2FsbGJhY2tgIHJldHVybnMgYSB0cnV0aHkgdmFsdWUgZm9yICoqYW55KiogZWxlbWVudCBvZiBhXG4gICAqIGBjb2xsZWN0aW9uYC4gVGhlIGZ1bmN0aW9uIHJldHVybnMgYXMgc29vbiBhcyBpdCBmaW5kcyBwYXNzaW5nIHZhbHVlLCBhbmRcbiAgICogZG9lcyBub3QgaXRlcmF0ZSBvdmVyIHRoZSBlbnRpcmUgYGNvbGxlY3Rpb25gLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0b1xuICAgKiBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgYW55XG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYW55IGVsZW1lbnQgcGFzc2VzIHRoZSBjYWxsYmFjayBjaGVjayxcbiAgICogIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5zb21lKFtudWxsLCAwLCAneWVzJywgZmFsc2VdKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKi9cbiAgZnVuY3Rpb24gc29tZShjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciByZXN1bHQ7XG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG5cbiAgICBpZiAoaXNBcnJheShjb2xsZWN0aW9uKSkge1xuICAgICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbi5sZW5ndGg7XG5cbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIGlmIChyZXN1bHQgPSBjYWxsYmFjayhjb2xsZWN0aW9uW2luZGV4XSwgaW5kZXgsIGNvbGxlY3Rpb24pKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuICEocmVzdWx0ID0gY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuICEhcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYXJyYXksIHN0YWJsZSBzb3J0ZWQgaW4gYXNjZW5kaW5nIG9yZGVyIGJ5IHRoZSByZXN1bHRzIG9mXG4gICAqIHJ1bm5pbmcgZWFjaCBlbGVtZW50IG9mIGBjb2xsZWN0aW9uYCB0aHJvdWdoIGEgYGNhbGxiYWNrYC4gVGhlIGBjYWxsYmFja2BcbiAgICogaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAqIFRoZSBgY2FsbGJhY2tgIGFyZ3VtZW50IG1heSBhbHNvIGJlIHRoZSBuYW1lIG9mIGEgcHJvcGVydHkgdG8gc29ydCBieSAoZS5nLiAnbGVuZ3RoJykuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258U3RyaW5nfSBjYWxsYmFja3xwcm9wZXJ0eSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb25cbiAgICogIG9yIHByb3BlcnR5IG5hbWUgdG8gc29ydCBieS5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2Ygc29ydGVkIGVsZW1lbnRzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnNvcnRCeShbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gTWF0aC5zaW4obnVtKTsgfSk7XG4gICAqIC8vID0+IFszLCAxLCAyXVxuICAgKlxuICAgKiBfLnNvcnRCeShbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gdGhpcy5zaW4obnVtKTsgfSwgTWF0aCk7XG4gICAqIC8vID0+IFszLCAxLCAyXVxuICAgKlxuICAgKiBfLnNvcnRCeShbJ2xhcnJ5JywgJ2JyZW5kYW4nLCAnbW9lJ10sICdsZW5ndGgnKTtcbiAgICogLy8gPT4gWydtb2UnLCAnbGFycnknLCAnYnJlbmRhbiddXG4gICAqL1xuICBmdW5jdGlvbiBzb3J0QnkoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIHJlc3VsdC5wdXNoKHtcbiAgICAgICAgJ2NyaXRlcmlhJzogY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSxcbiAgICAgICAgJ2luZGV4JzogaW5kZXgsXG4gICAgICAgICd2YWx1ZSc6IHZhbHVlXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHZhciBsZW5ndGggPSByZXN1bHQubGVuZ3RoO1xuICAgIHJlc3VsdC5zb3J0KGNvbXBhcmVBc2NlbmRpbmcpO1xuICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgcmVzdWx0W2xlbmd0aF0gPSByZXN1bHRbbGVuZ3RoXS52YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0aGUgYGNvbGxlY3Rpb25gLCB0byBhbiBhcnJheS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGNvbnZlcnQuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgbmV3IGNvbnZlcnRlZCBhcnJheS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogKGZ1bmN0aW9uKCkgeyByZXR1cm4gXy50b0FycmF5KGFyZ3VtZW50cykuc2xpY2UoMSk7IH0pKDEsIDIsIDMsIDQpO1xuICAgKiAvLyA9PiBbMiwgMywgNF1cbiAgICovXG4gIGZ1bmN0aW9uIHRvQXJyYXkoY29sbGVjdGlvbikge1xuICAgIGlmIChjb2xsZWN0aW9uICYmIHR5cGVvZiBjb2xsZWN0aW9uLmxlbmd0aCA9PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuIChub0FycmF5U2xpY2VPblN0cmluZ3MgPyBpc1N0cmluZyhjb2xsZWN0aW9uKSA6IHR5cGVvZiBjb2xsZWN0aW9uID09ICdzdHJpbmcnKVxuICAgICAgICA/IGNvbGxlY3Rpb24uc3BsaXQoJycpXG4gICAgICAgIDogc2xpY2UuY2FsbChjb2xsZWN0aW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcyhjb2xsZWN0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGFtaW5lcyBlYWNoIGVsZW1lbnQgaW4gYSBgY29sbGVjdGlvbmAsIHJldHVybmluZyBhbiBhcnJheSBvZiBhbGwgZWxlbWVudHNcbiAgICogdGhhdCBjb250YWluIHRoZSBnaXZlbiBgcHJvcGVydGllc2AuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wZXJ0aWVzIFRoZSBvYmplY3Qgb2YgcHJvcGVydHkgdmFsdWVzIHRvIGZpbHRlciBieS5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGVsZW1lbnRzIHRoYXQgY29udGFpbiB0aGUgZ2l2ZW4gYHByb3BlcnRpZXNgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgc3Rvb2dlcyA9IFtcbiAgICogICB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnbGFycnknLCAnYWdlJzogNTAgfSxcbiAgICogICB7ICduYW1lJzogJ2N1cmx5JywgJ2FnZSc6IDYwIH1cbiAgICogXTtcbiAgICpcbiAgICogXy53aGVyZShzdG9vZ2VzLCB7ICdhZ2UnOiA0MCB9KTtcbiAgICogLy8gPT4gW3sgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH1dXG4gICAqL1xuICBmdW5jdGlvbiB3aGVyZShjb2xsZWN0aW9uLCBwcm9wZXJ0aWVzKSB7XG4gICAgdmFyIHByb3BzID0gW107XG4gICAgZm9ySW4ocHJvcGVydGllcywgZnVuY3Rpb24odmFsdWUsIHByb3ApIHtcbiAgICAgIHByb3BzLnB1c2gocHJvcCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGZpbHRlcihjb2xsZWN0aW9uLCBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgIHZhciBsZW5ndGggPSBwcm9wcy5sZW5ndGg7XG4gICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IG9iamVjdFtwcm9wc1tsZW5ndGhdXSA9PT0gcHJvcGVydGllc1twcm9wc1tsZW5ndGhdXTtcbiAgICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuICEhcmVzdWx0O1xuICAgIH0pO1xuICB9XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYXJyYXkgd2l0aCBhbGwgZmFsc2V5IHZhbHVlcyBvZiBgYXJyYXlgIHJlbW92ZWQuIFRoZSB2YWx1ZXNcbiAgICogYGZhbHNlYCwgYG51bGxgLCBgMGAsIGBcIlwiYCwgYHVuZGVmaW5lZGAgYW5kIGBOYU5gIGFyZSBhbGwgZmFsc2V5LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGNvbXBhY3QuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBmaWx0ZXJlZCBhcnJheS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5jb21wYWN0KFswLCAxLCBmYWxzZSwgMiwgJycsIDNdKTtcbiAgICogLy8gPT4gWzEsIDIsIDNdXG4gICAqL1xuICBmdW5jdGlvbiBjb21wYWN0KGFycmF5KSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMCxcbiAgICAgICAgcmVzdWx0ID0gW107XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgdmFyIHZhbHVlID0gYXJyYXlbaW5kZXhdO1xuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFycmF5IG9mIGBhcnJheWAgZWxlbWVudHMgbm90IHByZXNlbnQgaW4gdGhlIG90aGVyIGFycmF5c1xuICAgKiB1c2luZyBzdHJpY3QgZXF1YWxpdHkgZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHByb2Nlc3MuXG4gICAqIEBwYXJhbSB7QXJyYXl9IFthcnJheTEsIGFycmF5MiwgLi4uXSBBcnJheXMgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBgYXJyYXlgIGVsZW1lbnRzIG5vdCBwcmVzZW50IGluIHRoZVxuICAgKiAgb3RoZXIgYXJyYXlzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmRpZmZlcmVuY2UoWzEsIDIsIDMsIDQsIDVdLCBbNSwgMiwgMTBdKTtcbiAgICogLy8gPT4gWzEsIDMsIDRdXG4gICAqL1xuICBmdW5jdGlvbiBkaWZmZXJlbmNlKGFycmF5KSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMCxcbiAgICAgICAgZmxhdHRlbmVkID0gY29uY2F0LmFwcGx5KGFycmF5UmVmLCBhcmd1bWVudHMpLFxuICAgICAgICBjb250YWlucyA9IGNhY2hlZENvbnRhaW5zKGZsYXR0ZW5lZCwgbGVuZ3RoKSxcbiAgICAgICAgcmVzdWx0ID0gW107XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgdmFyIHZhbHVlID0gYXJyYXlbaW5kZXhdO1xuICAgICAgaWYgKCFjb250YWlucyh2YWx1ZSkpIHtcbiAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIGZpcnN0IGVsZW1lbnQgb2YgdGhlIGBhcnJheWAuIFBhc3MgYG5gIHRvIHJldHVybiB0aGUgZmlyc3QgYG5gXG4gICAqIGVsZW1lbnRzIG9mIHRoZSBgYXJyYXlgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBhbGlhcyBoZWFkLCB0YWtlXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHF1ZXJ5LlxuICAgKiBAcGFyYW0ge051bWJlcn0gW25dIFRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gcmV0dXJuLlxuICAgKiBAcGFyYW0tIHtPYmplY3R9IFtndWFyZF0gSW50ZXJuYWxseSB1c2VkIHRvIGFsbG93IHRoaXMgbWV0aG9kIHRvIHdvcmsgd2l0aFxuICAgKiAgb3RoZXJzIGxpa2UgYF8ubWFwYCB3aXRob3V0IHVzaW5nIHRoZWlyIGNhbGxiYWNrIGBpbmRleGAgYXJndW1lbnQgZm9yIGBuYC5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSBmaXJzdCBlbGVtZW50IG9yIGFuIGFycmF5IG9mIHRoZSBmaXJzdCBgbmBcbiAgICogIGVsZW1lbnRzIG9mIGBhcnJheWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uZmlyc3QoWzUsIDQsIDMsIDIsIDFdKTtcbiAgICogLy8gPT4gNVxuICAgKi9cbiAgZnVuY3Rpb24gZmlyc3QoYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgaWYgKGFycmF5KSB7XG4gICAgICByZXR1cm4gKG4gPT0gbnVsbCB8fCBndWFyZCkgPyBhcnJheVswXSA6IHNsaWNlLmNhbGwoYXJyYXksIDAsIG4pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGbGF0dGVucyBhIG5lc3RlZCBhcnJheSAodGhlIG5lc3RpbmcgY2FuIGJlIHRvIGFueSBkZXB0aCkuIElmIGBzaGFsbG93YCBpc1xuICAgKiB0cnV0aHksIGBhcnJheWAgd2lsbCBvbmx5IGJlIGZsYXR0ZW5lZCBhIHNpbmdsZSBsZXZlbC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBjb21wYWN0LlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IHNoYWxsb3cgQSBmbGFnIHRvIGluZGljYXRlIG9ubHkgZmxhdHRlbmluZyBhIHNpbmdsZSBsZXZlbC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGZsYXR0ZW5lZCBhcnJheS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5mbGF0dGVuKFsxLCBbMl0sIFszLCBbWzRdXV1dKTtcbiAgICogLy8gPT4gWzEsIDIsIDMsIDRdO1xuICAgKlxuICAgKiBfLmZsYXR0ZW4oWzEsIFsyXSwgWzMsIFtbNF1dXV0sIHRydWUpO1xuICAgKiAvLyA9PiBbMSwgMiwgMywgW1s0XV1dO1xuICAgKi9cbiAgZnVuY3Rpb24gZmxhdHRlbihhcnJheSwgc2hhbGxvdykge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDAsXG4gICAgICAgIHJlc3VsdCA9IFtdO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2luZGV4XTtcblxuICAgICAgLy8gcmVjdXJzaXZlbHkgZmxhdHRlbiBhcnJheXMgKHN1c2NlcHRpYmxlIHRvIGNhbGwgc3RhY2sgbGltaXRzKVxuICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIHB1c2guYXBwbHkocmVzdWx0LCBzaGFsbG93ID8gdmFsdWUgOiBmbGF0dGVuKHZhbHVlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgaW5kZXggYXQgd2hpY2ggdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2YgYHZhbHVlYCBpcyBmb3VuZCB1c2luZ1xuICAgKiBzdHJpY3QgZXF1YWxpdHkgZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLiBJZiB0aGUgYGFycmF5YCBpcyBhbHJlYWR5XG4gICAqIHNvcnRlZCwgcGFzc2luZyBgdHJ1ZWAgZm9yIGBmcm9tSW5kZXhgIHdpbGwgcnVuIGEgZmFzdGVyIGJpbmFyeSBzZWFyY2guXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gc2VhcmNoLlxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2VhcmNoIGZvci5cbiAgICogQHBhcmFtIHtCb29sZWFufE51bWJlcn0gW2Zyb21JbmRleD0wXSBUaGUgaW5kZXggdG8gc2VhcmNoIGZyb20gb3IgYHRydWVgIHRvXG4gICAqICBwZXJmb3JtIGEgYmluYXJ5IHNlYXJjaCBvbiBhIHNvcnRlZCBgYXJyYXlgLlxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSBSZXR1cm5zIHRoZSBpbmRleCBvZiB0aGUgbWF0Y2hlZCB2YWx1ZSBvciBgLTFgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmluZGV4T2YoWzEsIDIsIDMsIDEsIDIsIDNdLCAyKTtcbiAgICogLy8gPT4gMVxuICAgKlxuICAgKiBfLmluZGV4T2YoWzEsIDIsIDMsIDEsIDIsIDNdLCAyLCAzKTtcbiAgICogLy8gPT4gNFxuICAgKlxuICAgKiBfLmluZGV4T2YoWzEsIDEsIDIsIDIsIDMsIDNdLCAyLCB0cnVlKTtcbiAgICogLy8gPT4gMlxuICAgKi9cbiAgZnVuY3Rpb24gaW5kZXhPZihhcnJheSwgdmFsdWUsIGZyb21JbmRleCkge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XG5cbiAgICBpZiAodHlwZW9mIGZyb21JbmRleCA9PSAnbnVtYmVyJykge1xuICAgICAgaW5kZXggPSAoZnJvbUluZGV4IDwgMCA/IG5hdGl2ZU1heCgwLCBsZW5ndGggKyBmcm9tSW5kZXgpIDogZnJvbUluZGV4IHx8IDApIC0gMTtcbiAgICB9IGVsc2UgaWYgKGZyb21JbmRleCkge1xuICAgICAgaW5kZXggPSBzb3J0ZWRJbmRleChhcnJheSwgdmFsdWUpO1xuICAgICAgcmV0dXJuIGFycmF5W2luZGV4XSA9PT0gdmFsdWUgPyBpbmRleCA6IC0xO1xuICAgIH1cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgaWYgKGFycmF5W2luZGV4XSA9PT0gdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhbGwgYnV0IHRoZSBsYXN0IGVsZW1lbnQgb2YgYGFycmF5YC4gUGFzcyBgbmAgdG8gZXhjbHVkZSB0aGUgbGFzdCBgbmBcbiAgICogZWxlbWVudHMgZnJvbSB0aGUgcmVzdWx0LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHF1ZXJ5LlxuICAgKiBAcGFyYW0ge051bWJlcn0gW249MV0gVGhlIG51bWJlciBvZiBlbGVtZW50cyB0byBleGNsdWRlLlxuICAgKiBAcGFyYW0tIHtPYmplY3R9IFtndWFyZF0gSW50ZXJuYWxseSB1c2VkIHRvIGFsbG93IHRoaXMgbWV0aG9kIHRvIHdvcmsgd2l0aFxuICAgKiAgb3RoZXJzIGxpa2UgYF8ubWFwYCB3aXRob3V0IHVzaW5nIHRoZWlyIGNhbGxiYWNrIGBpbmRleGAgYXJndW1lbnQgZm9yIGBuYC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGFsbCBidXQgdGhlIGxhc3QgZWxlbWVudCBvciBgbmAgZWxlbWVudHMgb2YgYGFycmF5YC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pbml0aWFsKFszLCAyLCAxXSk7XG4gICAqIC8vID0+IFszLCAyXVxuICAgKi9cbiAgZnVuY3Rpb24gaW5pdGlhbChhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICByZXR1cm4gYXJyYXlcbiAgICAgID8gc2xpY2UuY2FsbChhcnJheSwgMCwgLSgobiA9PSBudWxsIHx8IGd1YXJkKSA/IDEgOiBuKSlcbiAgICAgIDogW107XG4gIH1cblxuICAvKipcbiAgICogQ29tcHV0ZXMgdGhlIGludGVyc2VjdGlvbiBvZiBhbGwgdGhlIHBhc3NlZC1pbiBhcnJheXMgdXNpbmcgc3RyaWN0IGVxdWFsaXR5XG4gICAqIGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IFthcnJheTEsIGFycmF5MiwgLi4uXSBBcnJheXMgdG8gcHJvY2Vzcy5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHVuaXF1ZSBlbGVtZW50cywgaW4gb3JkZXIsIHRoYXQgYXJlXG4gICAqICBwcmVzZW50IGluICoqYWxsKiogb2YgdGhlIGFycmF5cy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pbnRlcnNlY3Rpb24oWzEsIDIsIDNdLCBbMTAxLCAyLCAxLCAxMF0sIFsyLCAxXSk7XG4gICAqIC8vID0+IFsxLCAyXVxuICAgKi9cbiAgZnVuY3Rpb24gaW50ZXJzZWN0aW9uKGFycmF5KSB7XG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgIGFyZ3NMZW5ndGggPSBhcmdzLmxlbmd0aCxcbiAgICAgICAgY2FjaGUgPSB7fSxcbiAgICAgICAgcmVzdWx0ID0gW107XG5cbiAgICBmb3JFYWNoKGFycmF5LCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgaWYgKGluZGV4T2YocmVzdWx0LCB2YWx1ZSkgPCAwKSB7XG4gICAgICAgIHZhciBsZW5ndGggPSBhcmdzTGVuZ3RoO1xuICAgICAgICB3aGlsZSAoLS1sZW5ndGgpIHtcbiAgICAgICAgICBpZiAoIShjYWNoZVtsZW5ndGhdIHx8IChjYWNoZVtsZW5ndGhdID0gY2FjaGVkQ29udGFpbnMoYXJnc1tsZW5ndGhdKSkpKHZhbHVlKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBsYXN0IGVsZW1lbnQgb2YgdGhlIGBhcnJheWAuIFBhc3MgYG5gIHRvIHJldHVybiB0aGUgbGFzdCBgbmBcbiAgICogZWxlbWVudHMgb2YgdGhlIGBhcnJheWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcXVlcnkuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbbl0gVGhlIG51bWJlciBvZiBlbGVtZW50cyB0byByZXR1cm4uXG4gICAqIEBwYXJhbS0ge09iamVjdH0gW2d1YXJkXSBJbnRlcm5hbGx5IHVzZWQgdG8gYWxsb3cgdGhpcyBtZXRob2QgdG8gd29yayB3aXRoXG4gICAqICBvdGhlcnMgbGlrZSBgXy5tYXBgIHdpdGhvdXQgdXNpbmcgdGhlaXIgY2FsbGJhY2sgYGluZGV4YCBhcmd1bWVudCBmb3IgYG5gLlxuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgdGhlIGxhc3QgZWxlbWVudCBvciBhbiBhcnJheSBvZiB0aGUgbGFzdCBgbmBcbiAgICogIGVsZW1lbnRzIG9mIGBhcnJheWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ubGFzdChbMywgMiwgMV0pO1xuICAgKiAvLyA9PiAxXG4gICAqL1xuICBmdW5jdGlvbiBsYXN0KGFycmF5LCBuLCBndWFyZCkge1xuICAgIGlmIChhcnJheSkge1xuICAgICAgdmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcbiAgICAgIHJldHVybiAobiA9PSBudWxsIHx8IGd1YXJkKSA/IGFycmF5W2xlbmd0aCAtIDFdIDogc2xpY2UuY2FsbChhcnJheSwgLW4gfHwgbGVuZ3RoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgaW5kZXggYXQgd2hpY2ggdGhlIGxhc3Qgb2NjdXJyZW5jZSBvZiBgdmFsdWVgIGlzIGZvdW5kIHVzaW5nIHN0cmljdFxuICAgKiBlcXVhbGl0eSBmb3IgY29tcGFyaXNvbnMsIGkuZS4gYD09PWAuIElmIGBmcm9tSW5kZXhgIGlzIG5lZ2F0aXZlLCBpdCBpcyB1c2VkXG4gICAqIGFzIHRoZSBvZmZzZXQgZnJvbSB0aGUgZW5kIG9mIHRoZSBjb2xsZWN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHNlYXJjaC5cbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIHNlYXJjaCBmb3IuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbZnJvbUluZGV4PWFycmF5Lmxlbmd0aC0xXSBUaGUgaW5kZXggdG8gc2VhcmNoIGZyb20uXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IFJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBtYXRjaGVkIHZhbHVlIG9yIGAtMWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ubGFzdEluZGV4T2YoWzEsIDIsIDMsIDEsIDIsIDNdLCAyKTtcbiAgICogLy8gPT4gNFxuICAgKlxuICAgKiBfLmxhc3RJbmRleE9mKFsxLCAyLCAzLCAxLCAyLCAzXSwgMiwgMyk7XG4gICAqIC8vID0+IDFcbiAgICovXG4gIGZ1bmN0aW9uIGxhc3RJbmRleE9mKGFycmF5LCB2YWx1ZSwgZnJvbUluZGV4KSB7XG4gICAgdmFyIGluZGV4ID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwO1xuICAgIGlmICh0eXBlb2YgZnJvbUluZGV4ID09ICdudW1iZXInKSB7XG4gICAgICBpbmRleCA9IChmcm9tSW5kZXggPCAwID8gbmF0aXZlTWF4KDAsIGluZGV4ICsgZnJvbUluZGV4KSA6IG5hdGl2ZU1pbihmcm9tSW5kZXgsIGluZGV4IC0gMSkpICsgMTtcbiAgICB9XG4gICAgd2hpbGUgKGluZGV4LS0pIHtcbiAgICAgIGlmIChhcnJheVtpbmRleF0gPT09IHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBpbmRleDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gb2JqZWN0IGNvbXBvc2VkIGZyb20gYXJyYXlzIG9mIGBrZXlzYCBhbmQgYHZhbHVlc2AuIFBhc3MgZWl0aGVyXG4gICAqIGEgc2luZ2xlIHR3byBkaW1lbnNpb25hbCBhcnJheSwgaS5lLiBgW1trZXkxLCB2YWx1ZTFdLCBba2V5MiwgdmFsdWUyXV1gLCBvclxuICAgKiB0d28gYXJyYXlzLCBvbmUgb2YgYGtleXNgIGFuZCBvbmUgb2YgY29ycmVzcG9uZGluZyBgdmFsdWVzYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IGtleXMgVGhlIGFycmF5IG9mIGtleXMuXG4gICAqIEBwYXJhbSB7QXJyYXl9IFt2YWx1ZXM9W11dIFRoZSBhcnJheSBvZiB2YWx1ZXMuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYW4gb2JqZWN0IGNvbXBvc2VkIG9mIHRoZSBnaXZlbiBrZXlzIGFuZFxuICAgKiAgY29ycmVzcG9uZGluZyB2YWx1ZXMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ub2JqZWN0KFsnbW9lJywgJ2xhcnJ5JywgJ2N1cmx5J10sIFszMCwgNDAsIDUwXSk7XG4gICAqIC8vID0+IHsgJ21vZSc6IDMwLCAnbGFycnknOiA0MCwgJ2N1cmx5JzogNTAgfVxuICAgKi9cbiAgZnVuY3Rpb24gb2JqZWN0KGtleXMsIHZhbHVlcykge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBrZXlzID8ga2V5cy5sZW5ndGggOiAwLFxuICAgICAgICByZXN1bHQgPSB7fTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIga2V5ID0ga2V5c1tpbmRleF07XG4gICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWVzW2luZGV4XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtrZXlbMF1dID0ga2V5WzFdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgbnVtYmVycyAocG9zaXRpdmUgYW5kL29yIG5lZ2F0aXZlKSBwcm9ncmVzc2luZyBmcm9tXG4gICAqIGBzdGFydGAgdXAgdG8gYnV0IG5vdCBpbmNsdWRpbmcgYHN0b3BgLiBUaGlzIG1ldGhvZCBpcyBhIHBvcnQgb2YgUHl0aG9uJ3NcbiAgICogYHJhbmdlKClgIGZ1bmN0aW9uLiBTZWUgaHR0cDovL2RvY3MucHl0aG9uLm9yZy9saWJyYXJ5L2Z1bmN0aW9ucy5odG1sI3JhbmdlLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtOdW1iZXJ9IFtzdGFydD0wXSBUaGUgc3RhcnQgb2YgdGhlIHJhbmdlLlxuICAgKiBAcGFyYW0ge051bWJlcn0gZW5kIFRoZSBlbmQgb2YgdGhlIHJhbmdlLlxuICAgKiBAcGFyYW0ge051bWJlcn0gW3N0ZXA9MV0gVGhlIHZhbHVlIHRvIGluY3JlbWVudCBvciBkZXNjcmVtZW50IGJ5LlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgcmFuZ2UgYXJyYXkuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ucmFuZ2UoMTApO1xuICAgKiAvLyA9PiBbMCwgMSwgMiwgMywgNCwgNSwgNiwgNywgOCwgOV1cbiAgICpcbiAgICogXy5yYW5nZSgxLCAxMSk7XG4gICAqIC8vID0+IFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMF1cbiAgICpcbiAgICogXy5yYW5nZSgwLCAzMCwgNSk7XG4gICAqIC8vID0+IFswLCA1LCAxMCwgMTUsIDIwLCAyNV1cbiAgICpcbiAgICogXy5yYW5nZSgwLCAtMTAsIC0xKTtcbiAgICogLy8gPT4gWzAsIC0xLCAtMiwgLTMsIC00LCAtNSwgLTYsIC03LCAtOCwgLTldXG4gICAqXG4gICAqIF8ucmFuZ2UoMCk7XG4gICAqIC8vID0+IFtdXG4gICAqL1xuICBmdW5jdGlvbiByYW5nZShzdGFydCwgZW5kLCBzdGVwKSB7XG4gICAgc3RhcnQgPSArc3RhcnQgfHwgMDtcbiAgICBzdGVwID0gK3N0ZXAgfHwgMTtcblxuICAgIGlmIChlbmQgPT0gbnVsbCkge1xuICAgICAgZW5kID0gc3RhcnQ7XG4gICAgICBzdGFydCA9IDA7XG4gICAgfVxuICAgIC8vIHVzZSBgQXJyYXkobGVuZ3RoKWAgc28gVjggd2lsbCBhdm9pZCB0aGUgc2xvd2VyIFwiZGljdGlvbmFyeVwiIG1vZGVcbiAgICAvLyBodHRwOi8vd3d3LnlvdXR1YmUuY29tL3dhdGNoP3Y9WEFxSXBHVThaWmsjdD0xNm0yN3NcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gbmF0aXZlTWF4KDAsIGNlaWwoKGVuZCAtIHN0YXJ0KSAvIHN0ZXApKSxcbiAgICAgICAgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICByZXN1bHRbaW5kZXhdID0gc3RhcnQ7XG4gICAgICBzdGFydCArPSBzdGVwO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBvcHBvc2l0ZSBvZiBgXy5pbml0aWFsYCwgdGhpcyBtZXRob2QgZ2V0cyBhbGwgYnV0IHRoZSBmaXJzdCB2YWx1ZSBvZlxuICAgKiBgYXJyYXlgLiBQYXNzIGBuYCB0byBleGNsdWRlIHRoZSBmaXJzdCBgbmAgdmFsdWVzIGZyb20gdGhlIHJlc3VsdC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgZHJvcCwgdGFpbFxuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBxdWVyeS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IFtuPTFdIFRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gZXhjbHVkZS5cbiAgICogQHBhcmFtLSB7T2JqZWN0fSBbZ3VhcmRdIEludGVybmFsbHkgdXNlZCB0byBhbGxvdyB0aGlzIG1ldGhvZCB0byB3b3JrIHdpdGhcbiAgICogIG90aGVycyBsaWtlIGBfLm1hcGAgd2l0aG91dCB1c2luZyB0aGVpciBjYWxsYmFjayBgaW5kZXhgIGFyZ3VtZW50IGZvciBgbmAuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbGwgYnV0IHRoZSBmaXJzdCB2YWx1ZSBvciBgbmAgdmFsdWVzIG9mIGBhcnJheWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ucmVzdChbMywgMiwgMV0pO1xuICAgKiAvLyA9PiBbMiwgMV1cbiAgICovXG4gIGZ1bmN0aW9uIHJlc3QoYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgcmV0dXJuIGFycmF5XG4gICAgICA/IHNsaWNlLmNhbGwoYXJyYXksIChuID09IG51bGwgfHwgZ3VhcmQpID8gMSA6IG4pXG4gICAgICA6IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFVzZXMgYSBiaW5hcnkgc2VhcmNoIHRvIGRldGVybWluZSB0aGUgc21hbGxlc3QgaW5kZXggYXQgd2hpY2ggdGhlIGB2YWx1ZWBcbiAgICogc2hvdWxkIGJlIGluc2VydGVkIGludG8gYGFycmF5YCBpbiBvcmRlciB0byBtYWludGFpbiB0aGUgc29ydCBvcmRlciBvZiB0aGVcbiAgICogc29ydGVkIGBhcnJheWAuIElmIGBjYWxsYmFja2AgaXMgcGFzc2VkLCBpdCB3aWxsIGJlIGV4ZWN1dGVkIGZvciBgdmFsdWVgIGFuZFxuICAgKiBlYWNoIGVsZW1lbnQgaW4gYGFycmF5YCB0byBjb21wdXRlIHRoZWlyIHNvcnQgcmFua2luZy4gVGhlIGBjYWxsYmFja2AgaXNcbiAgICogYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggb25lIGFyZ3VtZW50OyAodmFsdWUpLiBUaGUgYGNhbGxiYWNrYFxuICAgKiBhcmd1bWVudCBtYXkgYWxzbyBiZSB0aGUgbmFtZSBvZiBhIHByb3BlcnR5IHRvIG9yZGVyIGJ5LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGV2YWx1YXRlLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufFN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5fHByb3BlcnR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXG4gICAqICBwZXIgaXRlcmF0aW9uIG9yIHByb3BlcnR5IG5hbWUgdG8gb3JkZXIgYnkuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge051bWJlcn0gUmV0dXJucyB0aGUgaW5kZXggYXQgd2hpY2ggdGhlIHZhbHVlIHNob3VsZCBiZSBpbnNlcnRlZFxuICAgKiAgaW50byBgYXJyYXlgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnNvcnRlZEluZGV4KFsyMCwgMzAsIDUwXSwgNDApO1xuICAgKiAvLyA9PiAyXG4gICAqXG4gICAqIF8uc29ydGVkSW5kZXgoW3sgJ3gnOiAyMCB9LCB7ICd4JzogMzAgfSwgeyAneCc6IDUwIH1dLCB7ICd4JzogNDAgfSwgJ3gnKTtcbiAgICogLy8gPT4gMlxuICAgKlxuICAgKiB2YXIgZGljdCA9IHtcbiAgICogICAnd29yZFRvTnVtYmVyJzogeyAndHdlbnR5JzogMjAsICd0aGlydHknOiAzMCwgJ2ZvdXJ0eSc6IDQwLCAnZmlmdHknOiA1MCB9XG4gICAqIH07XG4gICAqXG4gICAqIF8uc29ydGVkSW5kZXgoWyd0d2VudHknLCAndGhpcnR5JywgJ2ZpZnR5J10sICdmb3VydHknLCBmdW5jdGlvbih3b3JkKSB7XG4gICAqICAgcmV0dXJuIGRpY3Qud29yZFRvTnVtYmVyW3dvcmRdO1xuICAgKiB9KTtcbiAgICogLy8gPT4gMlxuICAgKlxuICAgKiBfLnNvcnRlZEluZGV4KFsndHdlbnR5JywgJ3RoaXJ0eScsICdmaWZ0eSddLCAnZm91cnR5JywgZnVuY3Rpb24od29yZCkge1xuICAgKiAgIHJldHVybiB0aGlzLndvcmRUb051bWJlclt3b3JkXTtcbiAgICogfSwgZGljdCk7XG4gICAqIC8vID0+IDJcbiAgICovXG4gIGZ1bmN0aW9uIHNvcnRlZEluZGV4KGFycmF5LCB2YWx1ZSwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgbG93ID0gMCxcbiAgICAgICAgaGlnaCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogbG93O1xuXG4gICAgLy8gZXhwbGljaXRseSByZWZlcmVuY2UgYGlkZW50aXR5YCBmb3IgYmV0dGVyIGVuZ2luZSBpbmxpbmluZ1xuICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgPyBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZykgOiBpZGVudGl0eTtcbiAgICB2YWx1ZSA9IGNhbGxiYWNrKHZhbHVlKTtcbiAgICB3aGlsZSAobG93IDwgaGlnaCkge1xuICAgICAgdmFyIG1pZCA9IChsb3cgKyBoaWdoKSA+Pj4gMTtcbiAgICAgIGNhbGxiYWNrKGFycmF5W21pZF0pIDwgdmFsdWVcbiAgICAgICAgPyBsb3cgPSBtaWQgKyAxXG4gICAgICAgIDogaGlnaCA9IG1pZDtcbiAgICB9XG4gICAgcmV0dXJuIGxvdztcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wdXRlcyB0aGUgdW5pb24gb2YgdGhlIHBhc3NlZC1pbiBhcnJheXMgdXNpbmcgc3RyaWN0IGVxdWFsaXR5IGZvclxuICAgKiBjb21wYXJpc29ucywgaS5lLiBgPT09YC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IFthcnJheTEsIGFycmF5MiwgLi4uXSBBcnJheXMgdG8gcHJvY2Vzcy5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHVuaXF1ZSB2YWx1ZXMsIGluIG9yZGVyLCB0aGF0IGFyZVxuICAgKiAgcHJlc2VudCBpbiBvbmUgb3IgbW9yZSBvZiB0aGUgYXJyYXlzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnVuaW9uKFsxLCAyLCAzXSwgWzEwMSwgMiwgMSwgMTBdLCBbMiwgMV0pO1xuICAgKiAvLyA9PiBbMSwgMiwgMywgMTAxLCAxMF1cbiAgICovXG4gIGZ1bmN0aW9uIHVuaW9uKCkge1xuICAgIHJldHVybiB1bmlxKGNvbmNhdC5hcHBseShhcnJheVJlZiwgYXJndW1lbnRzKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGR1cGxpY2F0ZS12YWx1ZS1mcmVlIHZlcnNpb24gb2YgdGhlIGBhcnJheWAgdXNpbmcgc3RyaWN0IGVxdWFsaXR5XG4gICAqIGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC4gSWYgdGhlIGBhcnJheWAgaXMgYWxyZWFkeSBzb3J0ZWQsIHBhc3NpbmcgYHRydWVgXG4gICAqIGZvciBgaXNTb3J0ZWRgIHdpbGwgcnVuIGEgZmFzdGVyIGFsZ29yaXRobS4gSWYgYGNhbGxiYWNrYCBpcyBwYXNzZWQsIGVhY2hcbiAgICogZWxlbWVudCBvZiBgYXJyYXlgIGlzIHBhc3NlZCB0aHJvdWdoIGEgY2FsbGJhY2tgIGJlZm9yZSB1bmlxdWVuZXNzIGlzIGNvbXB1dGVkLlxuICAgKiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGFycmF5KS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgdW5pcXVlXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHByb2Nlc3MuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gW2lzU29ydGVkPWZhbHNlXSBBIGZsYWcgdG8gaW5kaWNhdGUgdGhhdCB0aGUgYGFycmF5YCBpcyBhbHJlYWR5IHNvcnRlZC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgZHVwbGljYXRlLXZhbHVlLWZyZWUgYXJyYXkuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8udW5pcShbMSwgMiwgMSwgMywgMV0pO1xuICAgKiAvLyA9PiBbMSwgMiwgM11cbiAgICpcbiAgICogXy51bmlxKFsxLCAxLCAyLCAyLCAzXSwgdHJ1ZSk7XG4gICAqIC8vID0+IFsxLCAyLCAzXVxuICAgKlxuICAgKiBfLnVuaXEoWzEsIDIsIDEuNSwgMywgMi41XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBNYXRoLmZsb29yKG51bSk7IH0pO1xuICAgKiAvLyA9PiBbMSwgMiwgM11cbiAgICpcbiAgICogXy51bmlxKFsxLCAyLCAxLjUsIDMsIDIuNV0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gdGhpcy5mbG9vcihudW0pOyB9LCBNYXRoKTtcbiAgICogLy8gPT4gWzEsIDIsIDNdXG4gICAqL1xuICBmdW5jdGlvbiB1bmlxKGFycmF5LCBpc1NvcnRlZCwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwLFxuICAgICAgICByZXN1bHQgPSBbXSxcbiAgICAgICAgc2VlbiA9IHJlc3VsdDtcblxuICAgIC8vIGp1Z2dsZSBhcmd1bWVudHNcbiAgICBpZiAodHlwZW9mIGlzU29ydGVkID09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXNBcmcgPSBjYWxsYmFjaztcbiAgICAgIGNhbGxiYWNrID0gaXNTb3J0ZWQ7XG4gICAgICBpc1NvcnRlZCA9IGZhbHNlO1xuICAgIH1cbiAgICAvLyBpbml0IHZhbHVlIGNhY2hlIGZvciBsYXJnZSBhcnJheXNcbiAgICB2YXIgaXNMYXJnZSA9ICFpc1NvcnRlZCAmJiBsZW5ndGggPiA3NDtcbiAgICBpZiAoaXNMYXJnZSkge1xuICAgICAgdmFyIGNhY2hlID0ge307XG4gICAgfVxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgc2VlbiA9IFtdO1xuICAgICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgfVxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF0sXG4gICAgICAgICAgY29tcHV0ZWQgPSBjYWxsYmFjayA/IGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgYXJyYXkpIDogdmFsdWU7XG5cbiAgICAgIGlmIChpc0xhcmdlKSB7XG4gICAgICAgIC8vIG1hbnVhbGx5IGNvZXJjZSBgY29tcHV0ZWRgIHRvIGEgc3RyaW5nIGJlY2F1c2UgYGhhc093blByb3BlcnR5YCwgaW5cbiAgICAgICAgLy8gc29tZSBvbGRlciB2ZXJzaW9ucyBvZiBGaXJlZm94LCBjb2VyY2VzIG9iamVjdHMgaW5jb3JyZWN0bHlcbiAgICAgICAgc2VlbiA9IGhhc093blByb3BlcnR5LmNhbGwoY2FjaGUsIGNvbXB1dGVkICsgJycpID8gY2FjaGVbY29tcHV0ZWRdIDogKGNhY2hlW2NvbXB1dGVkXSA9IFtdKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc1NvcnRlZFxuICAgICAgICAgICAgPyAhaW5kZXggfHwgc2VlbltzZWVuLmxlbmd0aCAtIDFdICE9PSBjb21wdXRlZFxuICAgICAgICAgICAgOiBpbmRleE9mKHNlZW4sIGNvbXB1dGVkKSA8IDBcbiAgICAgICAgICApIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrIHx8IGlzTGFyZ2UpIHtcbiAgICAgICAgICBzZWVuLnB1c2goY29tcHV0ZWQpO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFycmF5IHdpdGggYWxsIG9jY3VycmVuY2VzIG9mIHRoZSBwYXNzZWQgdmFsdWVzIHJlbW92ZWQgdXNpbmdcbiAgICogc3RyaWN0IGVxdWFsaXR5IGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBmaWx0ZXIuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt2YWx1ZTEsIHZhbHVlMiwgLi4uXSBWYWx1ZXMgdG8gcmVtb3ZlLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgZmlsdGVyZWQgYXJyYXkuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ud2l0aG91dChbMSwgMiwgMSwgMCwgMywgMSwgNF0sIDAsIDEpO1xuICAgKiAvLyA9PiBbMiwgMywgNF1cbiAgICovXG4gIGZ1bmN0aW9uIHdpdGhvdXQoYXJyYXkpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwLFxuICAgICAgICBjb250YWlucyA9IGNhY2hlZENvbnRhaW5zKGFyZ3VtZW50cywgMSwgMjApLFxuICAgICAgICByZXN1bHQgPSBbXTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF07XG4gICAgICBpZiAoIWNvbnRhaW5zKHZhbHVlKSkge1xuICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogR3JvdXBzIHRoZSBlbGVtZW50cyBvZiBlYWNoIGFycmF5IGF0IHRoZWlyIGNvcnJlc3BvbmRpbmcgaW5kZXhlcy4gVXNlZnVsIGZvclxuICAgKiBzZXBhcmF0ZSBkYXRhIHNvdXJjZXMgdGhhdCBhcmUgY29vcmRpbmF0ZWQgdGhyb3VnaCBtYXRjaGluZyBhcnJheSBpbmRleGVzLlxuICAgKiBGb3IgYSBtYXRyaXggb2YgbmVzdGVkIGFycmF5cywgYF8uemlwLmFwcGx5KC4uLilgIGNhbiB0cmFuc3Bvc2UgdGhlIG1hdHJpeFxuICAgKiBpbiBhIHNpbWlsYXIgZmFzaGlvbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IFthcnJheTEsIGFycmF5MiwgLi4uXSBBcnJheXMgdG8gcHJvY2Vzcy5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGdyb3VwZWQgZWxlbWVudHMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uemlwKFsnbW9lJywgJ2xhcnJ5JywgJ2N1cmx5J10sIFszMCwgNDAsIDUwXSwgW3RydWUsIGZhbHNlLCBmYWxzZV0pO1xuICAgKiAvLyA9PiBbWydtb2UnLCAzMCwgdHJ1ZV0sIFsnbGFycnknLCA0MCwgZmFsc2VdLCBbJ2N1cmx5JywgNTAsIGZhbHNlXV1cbiAgICovXG4gIGZ1bmN0aW9uIHppcChhcnJheSkge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBhcnJheSA/IG1heChwbHVjayhhcmd1bWVudHMsICdsZW5ndGgnKSkgOiAwLFxuICAgICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBwbHVjayhhcmd1bWVudHMsIGluZGV4KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpcyByZXN0cmljdGVkIHRvIGV4ZWN1dGluZyBgZnVuY2Agb25seSBhZnRlciBpdCBpc1xuICAgKiBjYWxsZWQgYG5gIHRpbWVzLiBUaGUgYGZ1bmNgIGlzIGV4ZWN1dGVkIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZVxuICAgKiBjcmVhdGVkIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG4gVGhlIG51bWJlciBvZiB0aW1lcyB0aGUgZnVuY3Rpb24gbXVzdCBiZSBjYWxsZWQgYmVmb3JlXG4gICAqIGl0IGlzIGV4ZWN1dGVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byByZXN0cmljdC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcmVzdHJpY3RlZCBmdW5jdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIHJlbmRlck5vdGVzID0gXy5hZnRlcihub3Rlcy5sZW5ndGgsIHJlbmRlcik7XG4gICAqIF8uZm9yRWFjaChub3RlcywgZnVuY3Rpb24obm90ZSkge1xuICAgKiAgIG5vdGUuYXN5bmNTYXZlKHsgJ3N1Y2Nlc3MnOiByZW5kZXJOb3RlcyB9KTtcbiAgICogfSk7XG4gICAqIC8vIGByZW5kZXJOb3Rlc2AgaXMgcnVuIG9uY2UsIGFmdGVyIGFsbCBub3RlcyBoYXZlIHNhdmVkXG4gICAqL1xuICBmdW5jdGlvbiBhZnRlcihuLCBmdW5jKSB7XG4gICAgaWYgKG4gPCAxKSB7XG4gICAgICByZXR1cm4gZnVuYygpO1xuICAgIH1cbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS1uIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gY2FsbGVkLCBpbnZva2VzIGBmdW5jYCB3aXRoIHRoZSBgdGhpc2BcbiAgICogYmluZGluZyBvZiBgdGhpc0FyZ2AgYW5kIHByZXBlbmRzIGFueSBhZGRpdGlvbmFsIGBiaW5kYCBhcmd1bWVudHMgdG8gdGhvc2VcbiAgICogcGFzc2VkIHRvIHRoZSBib3VuZCBmdW5jdGlvbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGJpbmQuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICAgKiBAcGFyYW0ge01peGVkfSBbYXJnMSwgYXJnMiwgLi4uXSBBcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGJvdW5kIGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgZnVuYyA9IGZ1bmN0aW9uKGdyZWV0aW5nKSB7XG4gICAqICAgcmV0dXJuIGdyZWV0aW5nICsgJyAnICsgdGhpcy5uYW1lO1xuICAgKiB9O1xuICAgKlxuICAgKiBmdW5jID0gXy5iaW5kKGZ1bmMsIHsgJ25hbWUnOiAnbW9lJyB9LCAnaGknKTtcbiAgICogZnVuYygpO1xuICAgKiAvLyA9PiAnaGkgbW9lJ1xuICAgKi9cbiAgZnVuY3Rpb24gYmluZChmdW5jLCB0aGlzQXJnKSB7XG4gICAgLy8gdXNlIGBGdW5jdGlvbiNiaW5kYCBpZiBpdCBleGlzdHMgYW5kIGlzIGZhc3RcbiAgICAvLyAoaW4gVjggYEZ1bmN0aW9uI2JpbmRgIGlzIHNsb3dlciBleGNlcHQgd2hlbiBwYXJ0aWFsbHkgYXBwbGllZClcbiAgICByZXR1cm4gaXNCaW5kRmFzdCB8fCAobmF0aXZlQmluZCAmJiBhcmd1bWVudHMubGVuZ3RoID4gMilcbiAgICAgID8gbmF0aXZlQmluZC5jYWxsLmFwcGx5KG5hdGl2ZUJpbmQsIGFyZ3VtZW50cylcbiAgICAgIDogY3JlYXRlQm91bmQoZnVuYywgdGhpc0FyZywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCaW5kcyBtZXRob2RzIG9uIGBvYmplY3RgIHRvIGBvYmplY3RgLCBvdmVyd3JpdGluZyB0aGUgZXhpc3RpbmcgbWV0aG9kLlxuICAgKiBJZiBubyBtZXRob2QgbmFtZXMgYXJlIHByb3ZpZGVkLCBhbGwgdGhlIGZ1bmN0aW9uIHByb3BlcnRpZXMgb2YgYG9iamVjdGBcbiAgICogd2lsbCBiZSBib3VuZC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBiaW5kIGFuZCBhc3NpZ24gdGhlIGJvdW5kIG1ldGhvZHMgdG8uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbbWV0aG9kTmFtZTEsIG1ldGhvZE5hbWUyLCAuLi5dIE1ldGhvZCBuYW1lcyBvbiB0aGUgb2JqZWN0IHRvIGJpbmQuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBidXR0b25WaWV3ID0ge1xuICAgKiAgJ2xhYmVsJzogJ2xvZGFzaCcsXG4gICAqICAnb25DbGljayc6IGZ1bmN0aW9uKCkgeyBhbGVydCgnY2xpY2tlZDogJyArIHRoaXMubGFiZWwpOyB9XG4gICAqIH07XG4gICAqXG4gICAqIF8uYmluZEFsbChidXR0b25WaWV3KTtcbiAgICogalF1ZXJ5KCcjbG9kYXNoX2J1dHRvbicpLm9uKCdjbGljaycsIGJ1dHRvblZpZXcub25DbGljayk7XG4gICAqIC8vID0+IFdoZW4gdGhlIGJ1dHRvbiBpcyBjbGlja2VkLCBgdGhpcy5sYWJlbGAgd2lsbCBoYXZlIHRoZSBjb3JyZWN0IHZhbHVlXG4gICAqL1xuICBmdW5jdGlvbiBiaW5kQWxsKG9iamVjdCkge1xuICAgIHZhciBmdW5jcyA9IGFyZ3VtZW50cyxcbiAgICAgICAgaW5kZXggPSBmdW5jcy5sZW5ndGggPiAxID8gMCA6IChmdW5jcyA9IGZ1bmN0aW9ucyhvYmplY3QpLCAtMSksXG4gICAgICAgIGxlbmd0aCA9IGZ1bmNzLmxlbmd0aDtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIga2V5ID0gZnVuY3NbaW5kZXhdO1xuICAgICAgb2JqZWN0W2tleV0gPSBiaW5kKG9iamVjdFtrZXldLCBvYmplY3QpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGlzIHRoZSBjb21wb3NpdGlvbiBvZiB0aGUgcGFzc2VkIGZ1bmN0aW9ucyxcbiAgICogd2hlcmUgZWFjaCBmdW5jdGlvbiBjb25zdW1lcyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB0aGF0IGZvbGxvd3MuXG4gICAqIEluIG1hdGggdGVybXMsIGNvbXBvc2luZyB0aGUgZnVuY3Rpb25zIGBmKClgLCBgZygpYCwgYW5kIGBoKClgIHByb2R1Y2VzIGBmKGcoaCgpKSlgLlxuICAgKiBFYWNoIGZ1bmN0aW9uIGlzIGV4ZWN1dGVkIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBjb21wb3NlZCBmdW5jdGlvbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtmdW5jMSwgZnVuYzIsIC4uLl0gRnVuY3Rpb25zIHRvIGNvbXBvc2UuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGNvbXBvc2VkIGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgZ3JlZXQgPSBmdW5jdGlvbihuYW1lKSB7IHJldHVybiAnaGk6ICcgKyBuYW1lOyB9O1xuICAgKiB2YXIgZXhjbGFpbSA9IGZ1bmN0aW9uKHN0YXRlbWVudCkgeyByZXR1cm4gc3RhdGVtZW50ICsgJyEnOyB9O1xuICAgKiB2YXIgd2VsY29tZSA9IF8uY29tcG9zZShleGNsYWltLCBncmVldCk7XG4gICAqIHdlbGNvbWUoJ21vZScpO1xuICAgKiAvLyA9PiAnaGk6IG1vZSEnXG4gICAqL1xuICBmdW5jdGlvbiBjb21wb3NlKCkge1xuICAgIHZhciBmdW5jcyA9IGFyZ3VtZW50cztcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgICBsZW5ndGggPSBmdW5jcy5sZW5ndGg7XG5cbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICBhcmdzID0gW2Z1bmNzW2xlbmd0aF0uYXBwbHkodGhpcywgYXJncyldO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFyZ3NbMF07XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGRlbGF5IHRoZSBleGVjdXRpb24gb2YgYGZ1bmNgIHVudGlsIGFmdGVyXG4gICAqIGB3YWl0YCBtaWxsaXNlY29uZHMgaGF2ZSBlbGFwc2VkIHNpbmNlIHRoZSBsYXN0IHRpbWUgaXQgd2FzIGludm9rZWQuIFBhc3NcbiAgICogYHRydWVgIGZvciBgaW1tZWRpYXRlYCB0byBjYXVzZSBkZWJvdW5jZSB0byBpbnZva2UgYGZ1bmNgIG9uIHRoZSBsZWFkaW5nLFxuICAgKiBpbnN0ZWFkIG9mIHRoZSB0cmFpbGluZywgZWRnZSBvZiB0aGUgYHdhaXRgIHRpbWVvdXQuIFN1YnNlcXVlbnQgY2FsbHMgdG9cbiAgICogdGhlIGRlYm91bmNlZCBmdW5jdGlvbiB3aWxsIHJldHVybiB0aGUgcmVzdWx0IG9mIHRoZSBsYXN0IGBmdW5jYCBjYWxsLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gZGVib3VuY2UuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB3YWl0IFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIGRlbGF5LlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGltbWVkaWF0ZSBBIGZsYWcgdG8gaW5kaWNhdGUgZXhlY3V0aW9uIGlzIG9uIHRoZSBsZWFkaW5nXG4gICAqICBlZGdlIG9mIHRoZSB0aW1lb3V0LlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBkZWJvdW5jZWQgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBsYXp5TGF5b3V0ID0gXy5kZWJvdW5jZShjYWxjdWxhdGVMYXlvdXQsIDMwMCk7XG4gICAqIGpRdWVyeSh3aW5kb3cpLm9uKCdyZXNpemUnLCBsYXp5TGF5b3V0KTtcbiAgICovXG4gIGZ1bmN0aW9uIGRlYm91bmNlKGZ1bmMsIHdhaXQsIGltbWVkaWF0ZSkge1xuICAgIHZhciBhcmdzLFxuICAgICAgICByZXN1bHQsXG4gICAgICAgIHRoaXNBcmcsXG4gICAgICAgIHRpbWVvdXRJZDtcblxuICAgIGZ1bmN0aW9uIGRlbGF5ZWQoKSB7XG4gICAgICB0aW1lb3V0SWQgPSBudWxsO1xuICAgICAgaWYgKCFpbW1lZGlhdGUpIHtcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGlzSW1tZWRpYXRlID0gaW1tZWRpYXRlICYmICF0aW1lb3V0SWQ7XG4gICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgdGhpc0FyZyA9IHRoaXM7XG5cbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgdGltZW91dElkID0gc2V0VGltZW91dChkZWxheWVkLCB3YWl0KTtcblxuICAgICAgaWYgKGlzSW1tZWRpYXRlKSB7XG4gICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZXMgdGhlIGBmdW5jYCBmdW5jdGlvbiBhZnRlciBgd2FpdGAgbWlsbGlzZWNvbmRzLiBBZGRpdGlvbmFsIGFyZ3VtZW50c1xuICAgKiB3aWxsIGJlIHBhc3NlZCB0byBgZnVuY2Agd2hlbiBpdCBpcyBpbnZva2VkLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gZGVsYXkuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB3YWl0IFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIGRlbGF5IGV4ZWN1dGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW2FyZzEsIGFyZzIsIC4uLl0gQXJndW1lbnRzIHRvIGludm9rZSB0aGUgZnVuY3Rpb24gd2l0aC5cbiAgICogQHJldHVybnMge051bWJlcn0gUmV0dXJucyB0aGUgYHNldFRpbWVvdXRgIHRpbWVvdXQgaWQuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBsb2cgPSBfLmJpbmQoY29uc29sZS5sb2csIGNvbnNvbGUpO1xuICAgKiBfLmRlbGF5KGxvZywgMTAwMCwgJ2xvZ2dlZCBsYXRlcicpO1xuICAgKiAvLyA9PiAnbG9nZ2VkIGxhdGVyJyAoQXBwZWFycyBhZnRlciBvbmUgc2Vjb25kLilcbiAgICovXG4gIGZ1bmN0aW9uIGRlbGF5KGZ1bmMsIHdhaXQpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHsgZnVuYy5hcHBseSh1bmRlZmluZWQsIGFyZ3MpOyB9LCB3YWl0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWZlcnMgZXhlY3V0aW5nIHRoZSBgZnVuY2AgZnVuY3Rpb24gdW50aWwgdGhlIGN1cnJlbnQgY2FsbCBzdGFjayBoYXMgY2xlYXJlZC5cbiAgICogQWRkaXRpb25hbCBhcmd1bWVudHMgd2lsbCBiZSBwYXNzZWQgdG8gYGZ1bmNgIHdoZW4gaXQgaXMgaW52b2tlZC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGRlZmVyLlxuICAgKiBAcGFyYW0ge01peGVkfSBbYXJnMSwgYXJnMiwgLi4uXSBBcmd1bWVudHMgdG8gaW52b2tlIHRoZSBmdW5jdGlvbiB3aXRoLlxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSBSZXR1cm5zIHRoZSBgc2V0VGltZW91dGAgdGltZW91dCBpZC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5kZWZlcihmdW5jdGlvbigpIHsgYWxlcnQoJ2RlZmVycmVkJyk7IH0pO1xuICAgKiAvLyByZXR1cm5zIGZyb20gdGhlIGZ1bmN0aW9uIGJlZm9yZSBgYWxlcnRgIGlzIGNhbGxlZFxuICAgKi9cbiAgZnVuY3Rpb24gZGVmZXIoZnVuYykge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBmdW5jLmFwcGx5KHVuZGVmaW5lZCwgYXJncyk7IH0sIDEpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0LCB3aGVuIGNhbGxlZCwgaW52b2tlcyBgb2JqZWN0W21ldGhvZE5hbWVdYCBhbmRcbiAgICogcHJlcGVuZHMgYW55IGFkZGl0aW9uYWwgYGxhdGVCaW5kYCBhcmd1bWVudHMgdG8gdGhvc2UgcGFzc2VkIHRvIHRoZSBib3VuZFxuICAgKiBmdW5jdGlvbi4gVGhpcyBtZXRob2QgZGlmZmVycyBmcm9tIGBfLmJpbmRgIGJ5IGFsbG93aW5nIGJvdW5kIGZ1bmN0aW9ucyB0b1xuICAgKiByZWZlcmVuY2UgbWV0aG9kcyB0aGF0IHdpbGwgYmUgcmVkZWZpbmVkIG9yIGRvbid0IHlldCBleGlzdC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0aGUgbWV0aG9kIGJlbG9uZ3MgdG8uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2ROYW1lIFRoZSBtZXRob2QgbmFtZS5cbiAgICogQHBhcmFtIHtNaXhlZH0gW2FyZzEsIGFyZzIsIC4uLl0gQXJndW1lbnRzIHRvIGJlIHBhcnRpYWxseSBhcHBsaWVkLlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBib3VuZCBmdW5jdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIG9iamVjdCA9IHtcbiAgICogICAnbmFtZSc6ICdtb2UnLFxuICAgKiAgICdncmVldCc6IGZ1bmN0aW9uKGdyZWV0aW5nKSB7XG4gICAqICAgICByZXR1cm4gZ3JlZXRpbmcgKyAnICcgKyB0aGlzLm5hbWU7XG4gICAqICAgfVxuICAgKiB9O1xuICAgKlxuICAgKiB2YXIgZnVuYyA9IF8ubGF0ZUJpbmQob2JqZWN0LCAnZ3JlZXQnLCAnaGknKTtcbiAgICogZnVuYygpO1xuICAgKiAvLyA9PiAnaGkgbW9lJ1xuICAgKlxuICAgKiBvYmplY3QuZ3JlZXQgPSBmdW5jdGlvbihncmVldGluZykge1xuICAgKiAgIHJldHVybiBncmVldGluZyArICcsICcgKyB0aGlzLm5hbWUgKyAnISc7XG4gICAqIH07XG4gICAqXG4gICAqIGZ1bmMoKTtcbiAgICogLy8gPT4gJ2hpLCBtb2UhJ1xuICAgKi9cbiAgZnVuY3Rpb24gbGF0ZUJpbmQob2JqZWN0LCBtZXRob2ROYW1lKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJvdW5kKG1ldGhvZE5hbWUsIG9iamVjdCwgc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBtZW1vaXplcyB0aGUgcmVzdWx0IG9mIGBmdW5jYC4gSWYgYHJlc29sdmVyYCBpc1xuICAgKiBwYXNzZWQsIGl0IHdpbGwgYmUgdXNlZCB0byBkZXRlcm1pbmUgdGhlIGNhY2hlIGtleSBmb3Igc3RvcmluZyB0aGUgcmVzdWx0XG4gICAqIGJhc2VkIG9uIHRoZSBhcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBtZW1vaXplZCBmdW5jdGlvbi4gQnkgZGVmYXVsdCwgdGhlIGZpcnN0XG4gICAqIGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgbWVtb2l6ZWQgZnVuY3Rpb24gaXMgdXNlZCBhcyB0aGUgY2FjaGUga2V5LiBUaGUgYGZ1bmNgXG4gICAqIGlzIGV4ZWN1dGVkIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBtZW1vaXplZCBmdW5jdGlvbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGhhdmUgaXRzIG91dHB1dCBtZW1vaXplZC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW3Jlc29sdmVyXSBBIGZ1bmN0aW9uIHVzZWQgdG8gcmVzb2x2ZSB0aGUgY2FjaGUga2V5LlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBtZW1vaXppbmcgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBmaWJvbmFjY2kgPSBfLm1lbW9pemUoZnVuY3Rpb24obikge1xuICAgKiAgIHJldHVybiBuIDwgMiA/IG4gOiBmaWJvbmFjY2kobiAtIDEpICsgZmlib25hY2NpKG4gLSAyKTtcbiAgICogfSk7XG4gICAqL1xuICBmdW5jdGlvbiBtZW1vaXplKGZ1bmMsIHJlc29sdmVyKSB7XG4gICAgdmFyIGNhY2hlID0ge307XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGtleSA9IHJlc29sdmVyID8gcmVzb2x2ZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKSA6IGFyZ3VtZW50c1swXTtcbiAgICAgIHJldHVybiBoYXNPd25Qcm9wZXJ0eS5jYWxsKGNhY2hlLCBrZXkpXG4gICAgICAgID8gY2FjaGVba2V5XVxuICAgICAgICA6IChjYWNoZVtrZXldID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpKTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGlzIHJlc3RyaWN0ZWQgdG8gZXhlY3V0ZSBgZnVuY2Agb25jZS4gUmVwZWF0IGNhbGxzIHRvXG4gICAqIHRoZSBmdW5jdGlvbiB3aWxsIHJldHVybiB0aGUgdmFsdWUgb2YgdGhlIGZpcnN0IGNhbGwuIFRoZSBgZnVuY2AgaXMgZXhlY3V0ZWRcbiAgICogd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlIGNyZWF0ZWQgZnVuY3Rpb24uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byByZXN0cmljdC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcmVzdHJpY3RlZCBmdW5jdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIGluaXRpYWxpemUgPSBfLm9uY2UoY3JlYXRlQXBwbGljYXRpb24pO1xuICAgKiBpbml0aWFsaXplKCk7XG4gICAqIGluaXRpYWxpemUoKTtcbiAgICogLy8gQXBwbGljYXRpb24gaXMgb25seSBjcmVhdGVkIG9uY2UuXG4gICAqL1xuICBmdW5jdGlvbiBvbmNlKGZ1bmMpIHtcbiAgICB2YXIgcmVzdWx0LFxuICAgICAgICByYW4gPSBmYWxzZTtcblxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChyYW4pIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIHJhbiA9IHRydWU7XG4gICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICAgIC8vIGNsZWFyIHRoZSBgZnVuY2AgdmFyaWFibGUgc28gdGhlIGZ1bmN0aW9uIG1heSBiZSBnYXJiYWdlIGNvbGxlY3RlZFxuICAgICAgZnVuYyA9IG51bGw7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gY2FsbGVkLCBpbnZva2VzIGBmdW5jYCB3aXRoIGFueSBhZGRpdGlvbmFsXG4gICAqIGBwYXJ0aWFsYCBhcmd1bWVudHMgcHJlcGVuZGVkIHRvIHRob3NlIHBhc3NlZCB0byB0aGUgbmV3IGZ1bmN0aW9uLiBUaGlzXG4gICAqIG1ldGhvZCBpcyBzaW1pbGFyIHRvIGBiaW5kYCwgZXhjZXB0IGl0IGRvZXMgKipub3QqKiBhbHRlciB0aGUgYHRoaXNgIGJpbmRpbmcuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBwYXJ0aWFsbHkgYXBwbHkgYXJndW1lbnRzIHRvLlxuICAgKiBAcGFyYW0ge01peGVkfSBbYXJnMSwgYXJnMiwgLi4uXSBBcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHBhcnRpYWxseSBhcHBsaWVkIGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgZ3JlZXQgPSBmdW5jdGlvbihncmVldGluZywgbmFtZSkgeyByZXR1cm4gZ3JlZXRpbmcgKyAnOiAnICsgbmFtZTsgfTtcbiAgICogdmFyIGhpID0gXy5wYXJ0aWFsKGdyZWV0LCAnaGknKTtcbiAgICogaGkoJ21vZScpO1xuICAgKiAvLyA9PiAnaGk6IG1vZSdcbiAgICovXG4gIGZ1bmN0aW9uIHBhcnRpYWwoZnVuYykge1xuICAgIHJldHVybiBjcmVhdGVCb3VuZChmdW5jLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0LCB3aGVuIGV4ZWN1dGVkLCB3aWxsIG9ubHkgY2FsbCB0aGUgYGZ1bmNgXG4gICAqIGZ1bmN0aW9uIGF0IG1vc3Qgb25jZSBwZXIgZXZlcnkgYHdhaXRgIG1pbGxpc2Vjb25kcy4gSWYgdGhlIHRocm90dGxlZFxuICAgKiBmdW5jdGlvbiBpcyBpbnZva2VkIG1vcmUgdGhhbiBvbmNlIGR1cmluZyB0aGUgYHdhaXRgIHRpbWVvdXQsIGBmdW5jYCB3aWxsXG4gICAqIGFsc28gYmUgY2FsbGVkIG9uIHRoZSB0cmFpbGluZyBlZGdlIG9mIHRoZSB0aW1lb3V0LiBTdWJzZXF1ZW50IGNhbGxzIHRvIHRoZVxuICAgKiB0aHJvdHRsZWQgZnVuY3Rpb24gd2lsbCByZXR1cm4gdGhlIHJlc3VsdCBvZiB0aGUgbGFzdCBgZnVuY2AgY2FsbC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHRocm90dGxlLlxuICAgKiBAcGFyYW0ge051bWJlcn0gd2FpdCBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyB0byB0aHJvdHRsZSBleGVjdXRpb25zIHRvLlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyB0aHJvdHRsZWQgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciB0aHJvdHRsZWQgPSBfLnRocm90dGxlKHVwZGF0ZVBvc2l0aW9uLCAxMDApO1xuICAgKiBqUXVlcnkod2luZG93KS5vbignc2Nyb2xsJywgdGhyb3R0bGVkKTtcbiAgICovXG4gIGZ1bmN0aW9uIHRocm90dGxlKGZ1bmMsIHdhaXQpIHtcbiAgICB2YXIgYXJncyxcbiAgICAgICAgcmVzdWx0LFxuICAgICAgICB0aGlzQXJnLFxuICAgICAgICB0aW1lb3V0SWQsXG4gICAgICAgIGxhc3RDYWxsZWQgPSAwO1xuXG4gICAgZnVuY3Rpb24gdHJhaWxpbmdDYWxsKCkge1xuICAgICAgbGFzdENhbGxlZCA9IG5ldyBEYXRlO1xuICAgICAgdGltZW91dElkID0gbnVsbDtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyk7XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBub3cgPSBuZXcgRGF0ZSxcbiAgICAgICAgICByZW1haW5pbmcgPSB3YWl0IC0gKG5vdyAtIGxhc3RDYWxsZWQpO1xuXG4gICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgdGhpc0FyZyA9IHRoaXM7XG5cbiAgICAgIGlmIChyZW1haW5pbmcgPD0gMCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgbGFzdENhbGxlZCA9IG5vdztcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKCF0aW1lb3V0SWQpIHtcbiAgICAgICAgdGltZW91dElkID0gc2V0VGltZW91dCh0cmFpbGluZ0NhbGwsIHJlbWFpbmluZyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgcGFzc2VzIGB2YWx1ZWAgdG8gdGhlIGB3cmFwcGVyYCBmdW5jdGlvbiBhcyBpdHNcbiAgICogZmlyc3QgYXJndW1lbnQuIEFkZGl0aW9uYWwgYXJndW1lbnRzIHBhc3NlZCB0byB0aGUgZnVuY3Rpb24gYXJlIGFwcGVuZGVkXG4gICAqIHRvIHRob3NlIHBhc3NlZCB0byB0aGUgYHdyYXBwZXJgIGZ1bmN0aW9uLiBUaGUgYHdyYXBwZXJgIGlzIGV4ZWN1dGVkIHdpdGhcbiAgICogdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBjcmVhdGVkIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIHdyYXAuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IHdyYXBwZXIgVGhlIHdyYXBwZXIgZnVuY3Rpb24uXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgaGVsbG8gPSBmdW5jdGlvbihuYW1lKSB7IHJldHVybiAnaGVsbG8gJyArIG5hbWU7IH07XG4gICAqIGhlbGxvID0gXy53cmFwKGhlbGxvLCBmdW5jdGlvbihmdW5jKSB7XG4gICAqICAgcmV0dXJuICdiZWZvcmUsICcgKyBmdW5jKCdtb2UnKSArICcsIGFmdGVyJztcbiAgICogfSk7XG4gICAqIGhlbGxvKCk7XG4gICAqIC8vID0+ICdiZWZvcmUsIGhlbGxvIG1vZSwgYWZ0ZXInXG4gICAqL1xuICBmdW5jdGlvbiB3cmFwKHZhbHVlLCB3cmFwcGVyKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBbdmFsdWVdO1xuICAgICAgcHVzaC5hcHBseShhcmdzLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIHdyYXBwZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfTtcbiAgfVxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0aGUgY2hhcmFjdGVycyBgJmAsIGA8YCwgYD5gLCBgXCJgLCBhbmQgYCdgIGluIGBzdHJpbmdgIHRvIHRoZWlyXG4gICAqIGNvcnJlc3BvbmRpbmcgSFRNTCBlbnRpdGllcy5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmcgVGhlIHN0cmluZyB0byBlc2NhcGUuXG4gICAqIEByZXR1cm5zIHtTdHJpbmd9IFJldHVybnMgdGhlIGVzY2FwZWQgc3RyaW5nLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmVzY2FwZSgnTW9lLCBMYXJyeSAmIEN1cmx5Jyk7XG4gICAqIC8vID0+IFwiTW9lLCBMYXJyeSAmYW1wOyBDdXJseVwiXG4gICAqL1xuICBmdW5jdGlvbiBlc2NhcGUoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZyA9PSBudWxsID8gJycgOiAoc3RyaW5nICsgJycpLnJlcGxhY2UocmVVbmVzY2FwZWRIdG1sLCBlc2NhcGVIdG1sQ2hhcik7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBmdW5jdGlvbiByZXR1cm5zIHRoZSBmaXJzdCBhcmd1bWVudCBwYXNzZWQgdG8gaXQuXG4gICAqXG4gICAqIE5vdGU6IEl0IGlzIHVzZWQgdGhyb3VnaG91dCBMby1EYXNoIGFzIGEgZGVmYXVsdCBjYWxsYmFjay5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIEFueSB2YWx1ZS5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIGB2YWx1ZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBtb2UgPSB7ICduYW1lJzogJ21vZScgfTtcbiAgICogbW9lID09PSBfLmlkZW50aXR5KG1vZSk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGlkZW50aXR5KHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgZnVuY3Rpb25zIHByb3BlcnRpZXMgb2YgYG9iamVjdGAgdG8gdGhlIGBsb2Rhc2hgIGZ1bmN0aW9uIGFuZCBjaGFpbmFibGVcbiAgICogd3JhcHBlci5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCBvZiBmdW5jdGlvbiBwcm9wZXJ0aWVzIHRvIGFkZCB0byBgbG9kYXNoYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5taXhpbih7XG4gICAqICAgJ2NhcGl0YWxpemUnOiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICogICAgIHJldHVybiBzdHJpbmcuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHJpbmcuc2xpY2UoMSkudG9Mb3dlckNhc2UoKTtcbiAgICogICB9XG4gICAqIH0pO1xuICAgKlxuICAgKiBfLmNhcGl0YWxpemUoJ2xhcnJ5Jyk7XG4gICAqIC8vID0+ICdMYXJyeSdcbiAgICpcbiAgICogXygnY3VybHknKS5jYXBpdGFsaXplKCk7XG4gICAqIC8vID0+ICdDdXJseSdcbiAgICovXG4gIGZ1bmN0aW9uIG1peGluKG9iamVjdCkge1xuICAgIGZvckVhY2goZnVuY3Rpb25zKG9iamVjdCksIGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICAgIHZhciBmdW5jID0gbG9kYXNoW21ldGhvZE5hbWVdID0gb2JqZWN0W21ldGhvZE5hbWVdO1xuXG4gICAgICBsb2Rhc2gucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW3RoaXMuX193cmFwcGVkX19dO1xuICAgICAgICBwdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG5cbiAgICAgICAgdmFyIHJlc3VsdCA9IGZ1bmMuYXBwbHkobG9kYXNoLCBhcmdzKTtcbiAgICAgICAgaWYgKHRoaXMuX19jaGFpbl9fKSB7XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IGxvZGFzaChyZXN1bHQpO1xuICAgICAgICAgIHJlc3VsdC5fX2NoYWluX18gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldmVydHMgdGhlICdfJyB2YXJpYWJsZSB0byBpdHMgcHJldmlvdXMgdmFsdWUgYW5kIHJldHVybnMgYSByZWZlcmVuY2UgdG9cbiAgICogdGhlIGBsb2Rhc2hgIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBgbG9kYXNoYCBmdW5jdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIGxvZGFzaCA9IF8ubm9Db25mbGljdCgpO1xuICAgKi9cbiAgZnVuY3Rpb24gbm9Db25mbGljdCgpIHtcbiAgICB3aW5kb3cuXyA9IG9sZERhc2g7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUHJvZHVjZXMgYSByYW5kb20gbnVtYmVyIGJldHdlZW4gYG1pbmAgYW5kIGBtYXhgIChpbmNsdXNpdmUpLiBJZiBvbmx5IG9uZVxuICAgKiBhcmd1bWVudCBpcyBwYXNzZWQsIGEgbnVtYmVyIGJldHdlZW4gYDBgIGFuZCB0aGUgZ2l2ZW4gbnVtYmVyIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgKiBAcGFyYW0ge051bWJlcn0gW21pbj0wXSBUaGUgbWluaW11bSBwb3NzaWJsZSB2YWx1ZS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IFttYXg9MV0gVGhlIG1heGltdW0gcG9zc2libGUgdmFsdWUuXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IFJldHVybnMgYSByYW5kb20gbnVtYmVyLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnJhbmRvbSgwLCA1KTtcbiAgICogLy8gPT4gYSBudW1iZXIgYmV0d2VlbiAxIGFuZCA1XG4gICAqXG4gICAqIF8ucmFuZG9tKDUpO1xuICAgKiAvLyA9PiBhbHNvIGEgbnVtYmVyIGJldHdlZW4gMSBhbmQgNVxuICAgKi9cbiAgZnVuY3Rpb24gcmFuZG9tKG1pbiwgbWF4KSB7XG4gICAgaWYgKG1pbiA9PSBudWxsICYmIG1heCA9PSBudWxsKSB7XG4gICAgICBtYXggPSAxO1xuICAgIH1cbiAgICBtaW4gPSArbWluIHx8IDA7XG4gICAgaWYgKG1heCA9PSBudWxsKSB7XG4gICAgICBtYXggPSBtaW47XG4gICAgICBtaW4gPSAwO1xuICAgIH1cbiAgICByZXR1cm4gbWluICsgZmxvb3IobmF0aXZlUmFuZG9tKCkgKiAoKCttYXggfHwgMCkgLSBtaW4gKyAxKSk7XG4gIH1cblxuICAvKipcbiAgICogUmVzb2x2ZXMgdGhlIHZhbHVlIG9mIGBwcm9wZXJ0eWAgb24gYG9iamVjdGAuIElmIGBwcm9wZXJ0eWAgaXMgYSBmdW5jdGlvblxuICAgKiBpdCB3aWxsIGJlIGludm9rZWQgYW5kIGl0cyByZXN1bHQgcmV0dXJuZWQsIGVsc2UgdGhlIHByb3BlcnR5IHZhbHVlIGlzXG4gICAqIHJldHVybmVkLiBJZiBgb2JqZWN0YCBpcyBmYWxzZXksIHRoZW4gYG51bGxgIGlzIHJldHVybmVkLlxuICAgKlxuICAgKiBAZGVwcmVjYXRlZFxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGluc3BlY3QuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eSBUaGUgcHJvcGVydHkgdG8gZ2V0IHRoZSB2YWx1ZSBvZi5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSByZXNvbHZlZCB2YWx1ZS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIG9iamVjdCA9IHtcbiAgICogICAnY2hlZXNlJzogJ2NydW1wZXRzJyxcbiAgICogICAnc3R1ZmYnOiBmdW5jdGlvbigpIHtcbiAgICogICAgIHJldHVybiAnbm9uc2Vuc2UnO1xuICAgKiAgIH1cbiAgICogfTtcbiAgICpcbiAgICogXy5yZXN1bHQob2JqZWN0LCAnY2hlZXNlJyk7XG4gICAqIC8vID0+ICdjcnVtcGV0cydcbiAgICpcbiAgICogXy5yZXN1bHQob2JqZWN0LCAnc3R1ZmYnKTtcbiAgICogLy8gPT4gJ25vbnNlbnNlJ1xuICAgKi9cbiAgZnVuY3Rpb24gcmVzdWx0KG9iamVjdCwgcHJvcGVydHkpIHtcbiAgICAvLyBiYXNlZCBvbiBCYWNrYm9uZSdzIHByaXZhdGUgYGdldFZhbHVlYCBmdW5jdGlvblxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9kb2N1bWVudGNsb3VkL2JhY2tib25lL2Jsb2IvMC45LjIvYmFja2JvbmUuanMjTDE0MTktMTQyNFxuICAgIHZhciB2YWx1ZSA9IG9iamVjdCA/IG9iamVjdFtwcm9wZXJ0eV0gOiBudWxsO1xuICAgIHJldHVybiBpc0Z1bmN0aW9uKHZhbHVlKSA/IG9iamVjdFtwcm9wZXJ0eV0oKSA6IHZhbHVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgbWljcm8tdGVtcGxhdGluZyBtZXRob2QgdGhhdCBoYW5kbGVzIGFyYml0cmFyeSBkZWxpbWl0ZXJzLCBwcmVzZXJ2ZXNcbiAgICogd2hpdGVzcGFjZSwgYW5kIGNvcnJlY3RseSBlc2NhcGVzIHF1b3RlcyB3aXRoaW4gaW50ZXJwb2xhdGVkIGNvZGUuXG4gICAqXG4gICAqIE5vdGU6IEluIHRoZSBkZXZlbG9wbWVudCBidWlsZCBgXy50ZW1wbGF0ZWAgdXRpbGl6ZXMgc291cmNlVVJMcyBmb3IgZWFzaWVyXG4gICAqIGRlYnVnZ2luZy4gU2VlIGh0dHA6Ly93d3cuaHRtbDVyb2Nrcy5jb20vZW4vdHV0b3JpYWxzL2RldmVsb3BlcnRvb2xzL3NvdXJjZW1hcHMvI3RvYy1zb3VyY2V1cmxcbiAgICpcbiAgICogTm90ZTogTG8tRGFzaCBtYXkgYmUgdXNlZCBpbiBDaHJvbWUgZXh0ZW5zaW9ucyBieSBlaXRoZXIgY3JlYXRpbmcgYSBgbG9kYXNoIGNzcGBcbiAgICogYnVpbGQgYW5kIGF2b2lkaW5nIGBfLnRlbXBsYXRlYCB1c2UsIG9yIGxvYWRpbmcgTG8tRGFzaCBpbiBhIHNhbmRib3hlZCBwYWdlLlxuICAgKiBTZWUgaHR0cDovL2RldmVsb3Blci5jaHJvbWUuY29tL3RydW5rL2V4dGVuc2lvbnMvc2FuZGJveGluZ0V2YWwuaHRtbFxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHQgVGhlIHRlbXBsYXRlIHRleHQuXG4gICAqIEBwYXJhbSB7T2JlY3R9IGRhdGEgVGhlIGRhdGEgb2JqZWN0IHVzZWQgdG8gcG9wdWxhdGUgdGhlIHRleHQuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogIGVzY2FwZSAtIFRoZSBcImVzY2FwZVwiIGRlbGltaXRlciByZWdleHAuXG4gICAqICBldmFsdWF0ZSAtIFRoZSBcImV2YWx1YXRlXCIgZGVsaW1pdGVyIHJlZ2V4cC5cbiAgICogIGludGVycG9sYXRlIC0gVGhlIFwiaW50ZXJwb2xhdGVcIiBkZWxpbWl0ZXIgcmVnZXhwLlxuICAgKiAgc291cmNlVVJMIC0gVGhlIHNvdXJjZVVSTCBvZiB0aGUgdGVtcGxhdGUncyBjb21waWxlZCBzb3VyY2UuXG4gICAqICB2YXJpYWJsZSAtIFRoZSBkYXRhIG9iamVjdCB2YXJpYWJsZSBuYW1lLlxuICAgKlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb258U3RyaW5nfSBSZXR1cm5zIGEgY29tcGlsZWQgZnVuY3Rpb24gd2hlbiBubyBgZGF0YWAgb2JqZWN0XG4gICAqICBpcyBnaXZlbiwgZWxzZSBpdCByZXR1cm5zIHRoZSBpbnRlcnBvbGF0ZWQgdGV4dC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogLy8gdXNpbmcgYSBjb21waWxlZCB0ZW1wbGF0ZVxuICAgKiB2YXIgY29tcGlsZWQgPSBfLnRlbXBsYXRlKCdoZWxsbyA8JT0gbmFtZSAlPicpO1xuICAgKiBjb21waWxlZCh7ICduYW1lJzogJ21vZScgfSk7XG4gICAqIC8vID0+ICdoZWxsbyBtb2UnXG4gICAqXG4gICAqIHZhciBsaXN0ID0gJzwlIF8uZm9yRWFjaChwZW9wbGUsIGZ1bmN0aW9uKG5hbWUpIHsgJT48bGk+PCU9IG5hbWUgJT48L2xpPjwlIH0pOyAlPic7XG4gICAqIF8udGVtcGxhdGUobGlzdCwgeyAncGVvcGxlJzogWydtb2UnLCAnbGFycnknLCAnY3VybHknXSB9KTtcbiAgICogLy8gPT4gJzxsaT5tb2U8L2xpPjxsaT5sYXJyeTwvbGk+PGxpPmN1cmx5PC9saT4nXG4gICAqXG4gICAqIC8vIHVzaW5nIHRoZSBcImVzY2FwZVwiIGRlbGltaXRlciB0byBlc2NhcGUgSFRNTCBpbiBkYXRhIHByb3BlcnR5IHZhbHVlc1xuICAgKiBfLnRlbXBsYXRlKCc8Yj48JS0gdmFsdWUgJT48L2I+JywgeyAndmFsdWUnOiAnPHNjcmlwdD4nIH0pO1xuICAgKiAvLyA9PiAnPGI+Jmx0O3NjcmlwdCZndDs8L2I+J1xuICAgKlxuICAgKiAvLyB1c2luZyB0aGUgRVM2IGRlbGltaXRlciBhcyBhbiBhbHRlcm5hdGl2ZSB0byB0aGUgZGVmYXVsdCBcImludGVycG9sYXRlXCIgZGVsaW1pdGVyXG4gICAqIF8udGVtcGxhdGUoJ2hlbGxvICR7IG5hbWUgfScsIHsgJ25hbWUnOiAnY3VybHknIH0pO1xuICAgKiAvLyA9PiAnaGVsbG8gY3VybHknXG4gICAqXG4gICAqIC8vIHVzaW5nIHRoZSBpbnRlcm5hbCBgcHJpbnRgIGZ1bmN0aW9uIGluIFwiZXZhbHVhdGVcIiBkZWxpbWl0ZXJzXG4gICAqIF8udGVtcGxhdGUoJzwlIHByaW50KFwiaGVsbG8gXCIgKyBlcGl0aGV0KTsgJT4hJywgeyAnZXBpdGhldCc6ICdzdG9vZ2UnIH0pO1xuICAgKiAvLyA9PiAnaGVsbG8gc3Rvb2dlISdcbiAgICpcbiAgICogLy8gdXNpbmcgY3VzdG9tIHRlbXBsYXRlIGRlbGltaXRlcnNcbiAgICogXy50ZW1wbGF0ZVNldHRpbmdzID0ge1xuICAgKiAgICdpbnRlcnBvbGF0ZSc6IC97eyhbXFxzXFxTXSs/KX19L2dcbiAgICogfTtcbiAgICpcbiAgICogXy50ZW1wbGF0ZSgnaGVsbG8ge3sgbmFtZSB9fSEnLCB7ICduYW1lJzogJ211c3RhY2hlJyB9KTtcbiAgICogLy8gPT4gJ2hlbGxvIG11c3RhY2hlISdcbiAgICpcbiAgICogLy8gdXNpbmcgdGhlIGBzb3VyY2VVUkxgIG9wdGlvbiB0byBzcGVjaWZ5IGEgY3VzdG9tIHNvdXJjZVVSTCBmb3IgdGhlIHRlbXBsYXRlXG4gICAqIHZhciBjb21waWxlZCA9IF8udGVtcGxhdGUoJ2hlbGxvIDwlPSBuYW1lICU+JywgbnVsbCwgeyAnc291cmNlVVJMJzogJy9iYXNpYy9ncmVldGluZy5qc3QnIH0pO1xuICAgKiBjb21waWxlZChkYXRhKTtcbiAgICogLy8gPT4gZmluZCB0aGUgc291cmNlIG9mIFwiZ3JlZXRpbmcuanN0XCIgdW5kZXIgdGhlIFNvdXJjZXMgdGFiIG9yIFJlc291cmNlcyBwYW5lbCBvZiB0aGUgd2ViIGluc3BlY3RvclxuICAgKlxuICAgKiAvLyB1c2luZyB0aGUgYHZhcmlhYmxlYCBvcHRpb24gdG8gZW5zdXJlIGEgd2l0aC1zdGF0ZW1lbnQgaXNuJ3QgdXNlZCBpbiB0aGUgY29tcGlsZWQgdGVtcGxhdGVcbiAgICogdmFyIGNvbXBpbGVkID0gXy50ZW1wbGF0ZSgnaGVsbG8gPCU9IGRhdGEubmFtZSAlPiEnLCBudWxsLCB7ICd2YXJpYWJsZSc6ICdkYXRhJyB9KTtcbiAgICogY29tcGlsZWQuc291cmNlO1xuICAgKiAvLyA9PiBmdW5jdGlvbihkYXRhKSB7XG4gICAqICAgdmFyIF9fdCwgX19wID0gJycsIF9fZSA9IF8uZXNjYXBlO1xuICAgKiAgIF9fcCArPSAnaGVsbG8gJyArICgoX190ID0gKCBkYXRhLm5hbWUgKSkgPT0gbnVsbCA/ICcnIDogX190KSArICchJztcbiAgICogICByZXR1cm4gX19wO1xuICAgKiB9XG4gICAqXG4gICAqIC8vIHVzaW5nIHRoZSBgc291cmNlYCBwcm9wZXJ0eSB0byBpbmxpbmUgY29tcGlsZWQgdGVtcGxhdGVzIGZvciBtZWFuaW5nZnVsXG4gICAqIC8vIGxpbmUgbnVtYmVycyBpbiBlcnJvciBtZXNzYWdlcyBhbmQgYSBzdGFjayB0cmFjZVxuICAgKiBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihjd2QsICdqc3QuanMnKSwgJ1xcXG4gICAqICAgdmFyIEpTVCA9IHtcXFxuICAgKiAgICAgXCJtYWluXCI6ICcgKyBfLnRlbXBsYXRlKG1haW5UZXh0KS5zb3VyY2UgKyAnXFxcbiAgICogICB9O1xcXG4gICAqICcpO1xuICAgKi9cbiAgZnVuY3Rpb24gdGVtcGxhdGUodGV4dCwgZGF0YSwgb3B0aW9ucykge1xuICAgIC8vIGJhc2VkIG9uIEpvaG4gUmVzaWcncyBgdG1wbGAgaW1wbGVtZW50YXRpb25cbiAgICAvLyBodHRwOi8vZWpvaG4ub3JnL2Jsb2cvamF2YXNjcmlwdC1taWNyby10ZW1wbGF0aW5nL1xuICAgIC8vIGFuZCBMYXVyYSBEb2t0b3JvdmEncyBkb1QuanNcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vb2xhZG8vZG9UXG4gICAgdGV4dCB8fCAodGV4dCA9ICcnKTtcbiAgICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pO1xuXG4gICAgdmFyIGlzRXZhbHVhdGluZyxcbiAgICAgICAgcmVzdWx0LFxuICAgICAgICBzZXR0aW5ncyA9IGxvZGFzaC50ZW1wbGF0ZVNldHRpbmdzLFxuICAgICAgICBpbmRleCA9IDAsXG4gICAgICAgIGludGVycG9sYXRlID0gb3B0aW9ucy5pbnRlcnBvbGF0ZSB8fCBzZXR0aW5ncy5pbnRlcnBvbGF0ZSB8fCByZU5vTWF0Y2gsXG4gICAgICAgIHNvdXJjZSA9IFwiX19wICs9ICdcIixcbiAgICAgICAgdmFyaWFibGUgPSBvcHRpb25zLnZhcmlhYmxlIHx8IHNldHRpbmdzLnZhcmlhYmxlLFxuICAgICAgICBoYXNWYXJpYWJsZSA9IHZhcmlhYmxlO1xuXG4gICAgLy8gY29tcGlsZSByZWdleHAgdG8gbWF0Y2ggZWFjaCBkZWxpbWl0ZXJcbiAgICB2YXIgcmVEZWxpbWl0ZXJzID0gUmVnRXhwKFxuICAgICAgKG9wdGlvbnMuZXNjYXBlIHx8IHNldHRpbmdzLmVzY2FwZSB8fCByZU5vTWF0Y2gpLnNvdXJjZSArICd8JyArXG4gICAgICBpbnRlcnBvbGF0ZS5zb3VyY2UgKyAnfCcgK1xuICAgICAgKGludGVycG9sYXRlID09PSByZUludGVycG9sYXRlID8gcmVFc1RlbXBsYXRlIDogcmVOb01hdGNoKS5zb3VyY2UgKyAnfCcgK1xuICAgICAgKG9wdGlvbnMuZXZhbHVhdGUgfHwgc2V0dGluZ3MuZXZhbHVhdGUgfHwgcmVOb01hdGNoKS5zb3VyY2UgKyAnfCQnXG4gICAgLCAnZycpO1xuXG4gICAgdGV4dC5yZXBsYWNlKHJlRGVsaW1pdGVycywgZnVuY3Rpb24obWF0Y2gsIGVzY2FwZVZhbHVlLCBpbnRlcnBvbGF0ZVZhbHVlLCBlc1RlbXBsYXRlVmFsdWUsIGV2YWx1YXRlVmFsdWUsIG9mZnNldCkge1xuICAgICAgaW50ZXJwb2xhdGVWYWx1ZSB8fCAoaW50ZXJwb2xhdGVWYWx1ZSA9IGVzVGVtcGxhdGVWYWx1ZSk7XG5cbiAgICAgIC8vIGVzY2FwZSBjaGFyYWN0ZXJzIHRoYXQgY2Fubm90IGJlIGluY2x1ZGVkIGluIHN0cmluZyBsaXRlcmFsc1xuICAgICAgc291cmNlICs9IHRleHQuc2xpY2UoaW5kZXgsIG9mZnNldCkucmVwbGFjZShyZVVuZXNjYXBlZFN0cmluZywgZXNjYXBlU3RyaW5nQ2hhcik7XG5cbiAgICAgIC8vIHJlcGxhY2UgZGVsaW1pdGVycyB3aXRoIHNuaXBwZXRzXG4gICAgICBzb3VyY2UgKz1cbiAgICAgICAgZXNjYXBlVmFsdWUgPyBcIicgK1xcbl9fZShcIiArIGVzY2FwZVZhbHVlICsgXCIpICtcXG4nXCIgOlxuICAgICAgICBldmFsdWF0ZVZhbHVlID8gXCInO1xcblwiICsgZXZhbHVhdGVWYWx1ZSArIFwiO1xcbl9fcCArPSAnXCIgOlxuICAgICAgICBpbnRlcnBvbGF0ZVZhbHVlID8gXCInICtcXG4oKF9fdCA9IChcIiArIGludGVycG9sYXRlVmFsdWUgKyBcIikpID09IG51bGwgPyAnJyA6IF9fdCkgK1xcbidcIiA6ICcnO1xuXG4gICAgICBpc0V2YWx1YXRpbmcgfHwgKGlzRXZhbHVhdGluZyA9IGV2YWx1YXRlVmFsdWUgfHwgcmVDb21wbGV4RGVsaW1pdGVyLnRlc3QoZXNjYXBlVmFsdWUgfHwgaW50ZXJwb2xhdGVWYWx1ZSkpO1xuICAgICAgaW5kZXggPSBvZmZzZXQgKyBtYXRjaC5sZW5ndGg7XG4gICAgfSk7XG5cbiAgICBzb3VyY2UgKz0gXCInO1xcblwiO1xuXG4gICAgLy8gaWYgYHZhcmlhYmxlYCBpcyBub3Qgc3BlY2lmaWVkIGFuZCB0aGUgdGVtcGxhdGUgY29udGFpbnMgXCJldmFsdWF0ZVwiXG4gICAgLy8gZGVsaW1pdGVycywgd3JhcCBhIHdpdGgtc3RhdGVtZW50IGFyb3VuZCB0aGUgZ2VuZXJhdGVkIGNvZGUgdG8gYWRkIHRoZVxuICAgIC8vIGRhdGEgb2JqZWN0IHRvIHRoZSB0b3Agb2YgdGhlIHNjb3BlIGNoYWluXG4gICAgaWYgKCFoYXNWYXJpYWJsZSkge1xuICAgICAgdmFyaWFibGUgPSAnb2JqJztcbiAgICAgIGlmIChpc0V2YWx1YXRpbmcpIHtcbiAgICAgICAgc291cmNlID0gJ3dpdGggKCcgKyB2YXJpYWJsZSArICcpIHtcXG4nICsgc291cmNlICsgJ1xcbn1cXG4nO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIC8vIGF2b2lkIGEgd2l0aC1zdGF0ZW1lbnQgYnkgcHJlcGVuZGluZyBkYXRhIG9iamVjdCByZWZlcmVuY2VzIHRvIHByb3BlcnR5IG5hbWVzXG4gICAgICAgIHZhciByZURvdWJsZVZhcmlhYmxlID0gUmVnRXhwKCcoXFxcXChcXFxccyopJyArIHZhcmlhYmxlICsgJ1xcXFwuJyArIHZhcmlhYmxlICsgJ1xcXFxiJywgJ2cnKTtcbiAgICAgICAgc291cmNlID0gc291cmNlXG4gICAgICAgICAgLnJlcGxhY2UocmVJbnNlcnRWYXJpYWJsZSwgJyQmJyArIHZhcmlhYmxlICsgJy4nKVxuICAgICAgICAgIC5yZXBsYWNlKHJlRG91YmxlVmFyaWFibGUsICckMV9fZCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNsZWFudXAgY29kZSBieSBzdHJpcHBpbmcgZW1wdHkgc3RyaW5nc1xuICAgIHNvdXJjZSA9IChpc0V2YWx1YXRpbmcgPyBzb3VyY2UucmVwbGFjZShyZUVtcHR5U3RyaW5nTGVhZGluZywgJycpIDogc291cmNlKVxuICAgICAgLnJlcGxhY2UocmVFbXB0eVN0cmluZ01pZGRsZSwgJyQxJylcbiAgICAgIC5yZXBsYWNlKHJlRW1wdHlTdHJpbmdUcmFpbGluZywgJyQxOycpO1xuXG4gICAgLy8gZnJhbWUgY29kZSBhcyB0aGUgZnVuY3Rpb24gYm9keVxuICAgIHNvdXJjZSA9ICdmdW5jdGlvbignICsgdmFyaWFibGUgKyAnKSB7XFxuJyArXG4gICAgICAoaGFzVmFyaWFibGUgPyAnJyA6IHZhcmlhYmxlICsgJyB8fCAoJyArIHZhcmlhYmxlICsgJyA9IHt9KTtcXG4nKSArXG4gICAgICAndmFyIF9fdCwgX19wID0gXFwnXFwnLCBfX2UgPSBfLmVzY2FwZScgK1xuICAgICAgKGlzRXZhbHVhdGluZ1xuICAgICAgICA/ICcsIF9faiA9IEFycmF5LnByb3RvdHlwZS5qb2luO1xcbicgK1xuICAgICAgICAgICdmdW5jdGlvbiBwcmludCgpIHsgX19wICs9IF9fai5jYWxsKGFyZ3VtZW50cywgXFwnXFwnKSB9XFxuJ1xuICAgICAgICA6IChoYXNWYXJpYWJsZSA/ICcnIDogJywgX19kID0gJyArIHZhcmlhYmxlICsgJy4nICsgdmFyaWFibGUgKyAnIHx8ICcgKyB2YXJpYWJsZSkgKyAnO1xcbidcbiAgICAgICkgK1xuICAgICAgc291cmNlICtcbiAgICAgICdyZXR1cm4gX19wXFxufSc7XG5cbiAgICAvLyB1c2UgYSBzb3VyY2VVUkwgZm9yIGVhc2llciBkZWJ1Z2dpbmdcbiAgICAvLyBodHRwOi8vd3d3Lmh0bWw1cm9ja3MuY29tL2VuL3R1dG9yaWFscy9kZXZlbG9wZXJ0b29scy9zb3VyY2VtYXBzLyN0b2Mtc291cmNldXJsXG4gICAgdmFyIHNvdXJjZVVSTCA9IHVzZVNvdXJjZVVSTFxuICAgICAgPyAnXFxuLy9AIHNvdXJjZVVSTD0nICsgKG9wdGlvbnMuc291cmNlVVJMIHx8ICcvbG9kYXNoL3RlbXBsYXRlL3NvdXJjZVsnICsgKHRlbXBsYXRlQ291bnRlcisrKSArICddJylcbiAgICAgIDogJyc7XG5cbiAgICB0cnkge1xuICAgICAgcmVzdWx0ID0gRnVuY3Rpb24oJ18nLCAncmV0dXJuICcgKyBzb3VyY2UgKyBzb3VyY2VVUkwpKGxvZGFzaCk7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICBlLnNvdXJjZSA9IHNvdXJjZTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgaWYgKGRhdGEpIHtcbiAgICAgIHJldHVybiByZXN1bHQoZGF0YSk7XG4gICAgfVxuICAgIC8vIHByb3ZpZGUgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uJ3Mgc291cmNlIHZpYSBpdHMgYHRvU3RyaW5nYCBtZXRob2QsIGluXG4gICAgLy8gc3VwcG9ydGVkIGVudmlyb25tZW50cywgb3IgdGhlIGBzb3VyY2VgIHByb3BlcnR5IGFzIGEgY29udmVuaWVuY2UgZm9yXG4gICAgLy8gaW5saW5pbmcgY29tcGlsZWQgdGVtcGxhdGVzIGR1cmluZyB0aGUgYnVpbGQgcHJvY2Vzc1xuICAgIHJlc3VsdC5zb3VyY2UgPSBzb3VyY2U7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyB0aGUgYGNhbGxiYWNrYCBmdW5jdGlvbiBgbmAgdGltZXMsIHJldHVybmluZyBhbiBhcnJheSBvZiB0aGUgcmVzdWx0c1xuICAgKiBvZiBlYWNoIGBjYWxsYmFja2AgZXhlY3V0aW9uLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWRcbiAgICogd2l0aCBvbmUgYXJndW1lbnQ7IChpbmRleCkuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgKiBAcGFyYW0ge051bWJlcn0gbiBUaGUgbnVtYmVyIG9mIHRpbWVzIHRvIGV4ZWN1dGUgdGhlIGNhbGxiYWNrLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHRoZSByZXN1bHRzIG9mIGVhY2ggYGNhbGxiYWNrYCBleGVjdXRpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBkaWNlUm9sbHMgPSBfLnRpbWVzKDMsIF8ucGFydGlhbChfLnJhbmRvbSwgMSwgNikpO1xuICAgKiAvLyA9PiBbMywgNiwgNF1cbiAgICpcbiAgICogXy50aW1lcygzLCBmdW5jdGlvbihuKSB7IG1hZ2UuY2FzdFNwZWxsKG4pOyB9KTtcbiAgICogLy8gPT4gY2FsbHMgYG1hZ2UuY2FzdFNwZWxsKG4pYCB0aHJlZSB0aW1lcywgcGFzc2luZyBgbmAgb2YgYDBgLCBgMWAsIGFuZCBgMmAgcmVzcGVjdGl2ZWx5XG4gICAqXG4gICAqIF8udGltZXMoMywgZnVuY3Rpb24obikgeyB0aGlzLmNhc3Qobik7IH0sIG1hZ2UpO1xuICAgKiAvLyA9PiBhbHNvIGNhbGxzIGBtYWdlLmNhc3RTcGVsbChuKWAgdGhyZWUgdGltZXNcbiAgICovXG4gIGZ1bmN0aW9uIHRpbWVzKG4sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgbiA9ICtuIHx8IDA7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIHJlc3VsdCA9IEFycmF5KG4pO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBuKSB7XG4gICAgICByZXN1bHRbaW5kZXhdID0gY2FsbGJhY2suY2FsbCh0aGlzQXJnLCBpbmRleCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogVGhlIG9wcG9zaXRlIG9mIGBfLmVzY2FwZWAsIHRoaXMgbWV0aG9kIGNvbnZlcnRzIHRoZSBIVE1MIGVudGl0aWVzXG4gICAqIGAmYW1wO2AsIGAmbHQ7YCwgYCZndDtgLCBgJnF1b3Q7YCwgYW5kIGAmI3gyNztgIGluIGBzdHJpbmdgIHRvIHRoZWlyXG4gICAqIGNvcnJlc3BvbmRpbmcgY2hhcmFjdGVycy5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmcgVGhlIHN0cmluZyB0byB1bmVzY2FwZS5cbiAgICogQHJldHVybnMge1N0cmluZ30gUmV0dXJucyB0aGUgdW5lc2NhcGVkIHN0cmluZy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy51bmVzY2FwZSgnTW9lLCBMYXJyeSAmYW1wOyBDdXJseScpO1xuICAgKiAvLyA9PiBcIk1vZSwgTGFycnkgJiBDdXJseVwiXG4gICAqL1xuICBmdW5jdGlvbiB1bmVzY2FwZShzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nID09IG51bGwgPyAnJyA6IChzdHJpbmcgKyAnJykucmVwbGFjZShyZUVzY2FwZWRIdG1sLCB1bmVzY2FwZUh0bWxDaGFyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYSB1bmlxdWUgaWQuIElmIGBwcmVmaXhgIGlzIHBhc3NlZCwgdGhlIGlkIHdpbGwgYmUgYXBwZW5kZWQgdG8gaXQuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gW3ByZWZpeF0gVGhlIHZhbHVlIHRvIHByZWZpeCB0aGUgaWQgd2l0aC5cbiAgICogQHJldHVybnMge051bWJlcnxTdHJpbmd9IFJldHVybnMgYSBudW1lcmljIGlkIGlmIG5vIHByZWZpeCBpcyBwYXNzZWQsIGVsc2VcbiAgICogIGEgc3RyaW5nIGlkIG1heSBiZSByZXR1cm5lZC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy51bmlxdWVJZCgnY29udGFjdF8nKTtcbiAgICogLy8gPT4gJ2NvbnRhY3RfMTA0J1xuICAgKi9cbiAgZnVuY3Rpb24gdW5pcXVlSWQocHJlZml4KSB7XG4gICAgdmFyIGlkID0gaWRDb3VudGVyKys7XG4gICAgcmV0dXJuIHByZWZpeCA/IHByZWZpeCArIGlkIDogaWQ7XG4gIH1cblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvKipcbiAgICogV3JhcHMgdGhlIHZhbHVlIGluIGEgYGxvZGFzaGAgd3JhcHBlciBvYmplY3QuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENoYWluaW5nXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byB3cmFwLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSB3cmFwcGVyIG9iamVjdC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIHN0b29nZXMgPSBbXG4gICAqICAgeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfSxcbiAgICogICB7ICduYW1lJzogJ2xhcnJ5JywgJ2FnZSc6IDUwIH0sXG4gICAqICAgeyAnbmFtZSc6ICdjdXJseScsICdhZ2UnOiA2MCB9XG4gICAqIF07XG4gICAqXG4gICAqIHZhciB5b3VuZ2VzdCA9IF8uY2hhaW4oc3Rvb2dlcylcbiAgICogICAgIC5zb3J0QnkoZnVuY3Rpb24oc3Rvb2dlKSB7IHJldHVybiBzdG9vZ2UuYWdlOyB9KVxuICAgKiAgICAgLm1hcChmdW5jdGlvbihzdG9vZ2UpIHsgcmV0dXJuIHN0b29nZS5uYW1lICsgJyBpcyAnICsgc3Rvb2dlLmFnZTsgfSlcbiAgICogICAgIC5maXJzdCgpXG4gICAqICAgICAudmFsdWUoKTtcbiAgICogLy8gPT4gJ21vZSBpcyA0MCdcbiAgICovXG4gIGZ1bmN0aW9uIGNoYWluKHZhbHVlKSB7XG4gICAgdmFsdWUgPSBuZXcgbG9kYXNoKHZhbHVlKTtcbiAgICB2YWx1ZS5fX2NoYWluX18gPSB0cnVlO1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIGBpbnRlcmNlcHRvcmAgd2l0aCB0aGUgYHZhbHVlYCBhcyB0aGUgZmlyc3QgYXJndW1lbnQsIGFuZCB0aGVuXG4gICAqIHJldHVybnMgYHZhbHVlYC4gVGhlIHB1cnBvc2Ugb2YgdGhpcyBtZXRob2QgaXMgdG8gXCJ0YXAgaW50b1wiIGEgbWV0aG9kIGNoYWluLFxuICAgKiBpbiBvcmRlciB0byBwZXJmb3JtIG9wZXJhdGlvbnMgb24gaW50ZXJtZWRpYXRlIHJlc3VsdHMgd2l0aGluIHRoZSBjaGFpbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ2hhaW5pbmdcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIHBhc3MgdG8gYGludGVyY2VwdG9yYC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gaW50ZXJjZXB0b3IgVGhlIGZ1bmN0aW9uIHRvIGludm9rZS5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIGB2YWx1ZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uY2hhaW4oWzEsIDIsIDMsIDIwMF0pXG4gICAqICAuZmlsdGVyKGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gbnVtICUgMiA9PSAwOyB9KVxuICAgKiAgLnRhcChhbGVydClcbiAgICogIC5tYXAoZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gKiBudW0gfSlcbiAgICogIC52YWx1ZSgpO1xuICAgKiAvLyA9PiAvLyBbMiwgMjAwXSAoYWxlcnRlZClcbiAgICogLy8gPT4gWzQsIDQwMDAwXVxuICAgKi9cbiAgZnVuY3Rpb24gdGFwKHZhbHVlLCBpbnRlcmNlcHRvcikge1xuICAgIGludGVyY2VwdG9yKHZhbHVlKTtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICAvKipcbiAgICogRW5hYmxlcyBtZXRob2QgY2hhaW5pbmcgb24gdGhlIHdyYXBwZXIgb2JqZWN0LlxuICAgKlxuICAgKiBAbmFtZSBjaGFpblxuICAgKiBAZGVwcmVjYXRlZFxuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ2hhaW5pbmdcbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSB3cmFwcGVyIG9iamVjdC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXyhbMSwgMiwgM10pLnZhbHVlKCk7XG4gICAqIC8vID0+IFsxLCAyLCAzXVxuICAgKi9cbiAgZnVuY3Rpb24gd3JhcHBlckNoYWluKCkge1xuICAgIHRoaXMuX19jaGFpbl9fID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0cyB0aGUgd3JhcHBlZCB2YWx1ZS5cbiAgICpcbiAgICogQG5hbWUgdmFsdWVcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENoYWluaW5nXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgd3JhcHBlZCB2YWx1ZS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXyhbMSwgMiwgM10pLnZhbHVlKCk7XG4gICAqIC8vID0+IFsxLCAyLCAzXVxuICAgKi9cbiAgZnVuY3Rpb24gd3JhcHBlclZhbHVlKCkge1xuICAgIHJldHVybiB0aGlzLl9fd3JhcHBlZF9fO1xuICB9XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIFRoZSBzZW1hbnRpYyB2ZXJzaW9uIG51bWJlci5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAdHlwZSBTdHJpbmdcbiAgICovXG4gIGxvZGFzaC5WRVJTSU9OID0gJzAuOS4yJztcblxuICAvLyBhc3NpZ24gc3RhdGljIG1ldGhvZHNcbiAgbG9kYXNoLmFmdGVyID0gYWZ0ZXI7XG4gIGxvZGFzaC5iaW5kID0gYmluZDtcbiAgbG9kYXNoLmJpbmRBbGwgPSBiaW5kQWxsO1xuICBsb2Rhc2guY2hhaW4gPSBjaGFpbjtcbiAgbG9kYXNoLmNsb25lID0gY2xvbmU7XG4gIGxvZGFzaC5jb21wYWN0ID0gY29tcGFjdDtcbiAgbG9kYXNoLmNvbXBvc2UgPSBjb21wb3NlO1xuICBsb2Rhc2guY29udGFpbnMgPSBjb250YWlucztcbiAgbG9kYXNoLmNvdW50QnkgPSBjb3VudEJ5O1xuICBsb2Rhc2guZGVib3VuY2UgPSBkZWJvdW5jZTtcbiAgbG9kYXNoLmRlZmF1bHRzID0gZGVmYXVsdHM7XG4gIGxvZGFzaC5kZWZlciA9IGRlZmVyO1xuICBsb2Rhc2guZGVsYXkgPSBkZWxheTtcbiAgbG9kYXNoLmRpZmZlcmVuY2UgPSBkaWZmZXJlbmNlO1xuICBsb2Rhc2guZXNjYXBlID0gZXNjYXBlO1xuICBsb2Rhc2guZXZlcnkgPSBldmVyeTtcbiAgbG9kYXNoLmV4dGVuZCA9IGV4dGVuZDtcbiAgbG9kYXNoLmZpbHRlciA9IGZpbHRlcjtcbiAgbG9kYXNoLmZpbmQgPSBmaW5kO1xuICBsb2Rhc2guZmlyc3QgPSBmaXJzdDtcbiAgbG9kYXNoLmZsYXR0ZW4gPSBmbGF0dGVuO1xuICBsb2Rhc2guZm9yRWFjaCA9IGZvckVhY2g7XG4gIGxvZGFzaC5mb3JJbiA9IGZvckluO1xuICBsb2Rhc2guZm9yT3duID0gZm9yT3duO1xuICBsb2Rhc2guZnVuY3Rpb25zID0gZnVuY3Rpb25zO1xuICBsb2Rhc2guZ3JvdXBCeSA9IGdyb3VwQnk7XG4gIGxvZGFzaC5oYXMgPSBoYXM7XG4gIGxvZGFzaC5pZGVudGl0eSA9IGlkZW50aXR5O1xuICBsb2Rhc2guaW5kZXhPZiA9IGluZGV4T2Y7XG4gIGxvZGFzaC5pbml0aWFsID0gaW5pdGlhbDtcbiAgbG9kYXNoLmludGVyc2VjdGlvbiA9IGludGVyc2VjdGlvbjtcbiAgbG9kYXNoLmludmVydCA9IGludmVydDtcbiAgbG9kYXNoLmludm9rZSA9IGludm9rZTtcbiAgbG9kYXNoLmlzQXJndW1lbnRzID0gaXNBcmd1bWVudHM7XG4gIGxvZGFzaC5pc0FycmF5ID0gaXNBcnJheTtcbiAgbG9kYXNoLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcbiAgbG9kYXNoLmlzRGF0ZSA9IGlzRGF0ZTtcbiAgbG9kYXNoLmlzRWxlbWVudCA9IGlzRWxlbWVudDtcbiAgbG9kYXNoLmlzRW1wdHkgPSBpc0VtcHR5O1xuICBsb2Rhc2guaXNFcXVhbCA9IGlzRXF1YWw7XG4gIGxvZGFzaC5pc0Zpbml0ZSA9IGlzRmluaXRlO1xuICBsb2Rhc2guaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG4gIGxvZGFzaC5pc05hTiA9IGlzTmFOO1xuICBsb2Rhc2guaXNOdWxsID0gaXNOdWxsO1xuICBsb2Rhc2guaXNOdW1iZXIgPSBpc051bWJlcjtcbiAgbG9kYXNoLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG4gIGxvZGFzaC5pc1BsYWluT2JqZWN0ID0gaXNQbGFpbk9iamVjdDtcbiAgbG9kYXNoLmlzUmVnRXhwID0gaXNSZWdFeHA7XG4gIGxvZGFzaC5pc1N0cmluZyA9IGlzU3RyaW5nO1xuICBsb2Rhc2guaXNVbmRlZmluZWQgPSBpc1VuZGVmaW5lZDtcbiAgbG9kYXNoLmtleXMgPSBrZXlzO1xuICBsb2Rhc2gubGFzdCA9IGxhc3Q7XG4gIGxvZGFzaC5sYXN0SW5kZXhPZiA9IGxhc3RJbmRleE9mO1xuICBsb2Rhc2gubGF0ZUJpbmQgPSBsYXRlQmluZDtcbiAgbG9kYXNoLm1hcCA9IG1hcDtcbiAgbG9kYXNoLm1heCA9IG1heDtcbiAgbG9kYXNoLm1lbW9pemUgPSBtZW1vaXplO1xuICBsb2Rhc2gubWVyZ2UgPSBtZXJnZTtcbiAgbG9kYXNoLm1pbiA9IG1pbjtcbiAgbG9kYXNoLm1peGluID0gbWl4aW47XG4gIGxvZGFzaC5ub0NvbmZsaWN0ID0gbm9Db25mbGljdDtcbiAgbG9kYXNoLm9iamVjdCA9IG9iamVjdDtcbiAgbG9kYXNoLm9taXQgPSBvbWl0O1xuICBsb2Rhc2gub25jZSA9IG9uY2U7XG4gIGxvZGFzaC5wYWlycyA9IHBhaXJzO1xuICBsb2Rhc2gucGFydGlhbCA9IHBhcnRpYWw7XG4gIGxvZGFzaC5waWNrID0gcGljaztcbiAgbG9kYXNoLnBsdWNrID0gcGx1Y2s7XG4gIGxvZGFzaC5yYW5kb20gPSByYW5kb207XG4gIGxvZGFzaC5yYW5nZSA9IHJhbmdlO1xuICBsb2Rhc2gucmVkdWNlID0gcmVkdWNlO1xuICBsb2Rhc2gucmVkdWNlUmlnaHQgPSByZWR1Y2VSaWdodDtcbiAgbG9kYXNoLnJlamVjdCA9IHJlamVjdDtcbiAgbG9kYXNoLnJlc3QgPSByZXN0O1xuICBsb2Rhc2gucmVzdWx0ID0gcmVzdWx0O1xuICBsb2Rhc2guc2h1ZmZsZSA9IHNodWZmbGU7XG4gIGxvZGFzaC5zaXplID0gc2l6ZTtcbiAgbG9kYXNoLnNvbWUgPSBzb21lO1xuICBsb2Rhc2guc29ydEJ5ID0gc29ydEJ5O1xuICBsb2Rhc2guc29ydGVkSW5kZXggPSBzb3J0ZWRJbmRleDtcbiAgbG9kYXNoLnRhcCA9IHRhcDtcbiAgbG9kYXNoLnRlbXBsYXRlID0gdGVtcGxhdGU7XG4gIGxvZGFzaC50aHJvdHRsZSA9IHRocm90dGxlO1xuICBsb2Rhc2gudGltZXMgPSB0aW1lcztcbiAgbG9kYXNoLnRvQXJyYXkgPSB0b0FycmF5O1xuICBsb2Rhc2gudW5lc2NhcGUgPSB1bmVzY2FwZTtcbiAgbG9kYXNoLnVuaW9uID0gdW5pb247XG4gIGxvZGFzaC51bmlxID0gdW5pcTtcbiAgbG9kYXNoLnVuaXF1ZUlkID0gdW5pcXVlSWQ7XG4gIGxvZGFzaC52YWx1ZXMgPSB2YWx1ZXM7XG4gIGxvZGFzaC53aGVyZSA9IHdoZXJlO1xuICBsb2Rhc2gud2l0aG91dCA9IHdpdGhvdXQ7XG4gIGxvZGFzaC53cmFwID0gd3JhcDtcbiAgbG9kYXNoLnppcCA9IHppcDtcblxuICAvLyBhc3NpZ24gYWxpYXNlc1xuICBsb2Rhc2guYWxsID0gZXZlcnk7XG4gIGxvZGFzaC5hbnkgPSBzb21lO1xuICBsb2Rhc2guY29sbGVjdCA9IG1hcDtcbiAgbG9kYXNoLmRldGVjdCA9IGZpbmQ7XG4gIGxvZGFzaC5kcm9wID0gcmVzdDtcbiAgbG9kYXNoLmVhY2ggPSBmb3JFYWNoO1xuICBsb2Rhc2guZm9sZGwgPSByZWR1Y2U7XG4gIGxvZGFzaC5mb2xkciA9IHJlZHVjZVJpZ2h0O1xuICBsb2Rhc2guaGVhZCA9IGZpcnN0O1xuICBsb2Rhc2guaW5jbHVkZSA9IGNvbnRhaW5zO1xuICBsb2Rhc2guaW5qZWN0ID0gcmVkdWNlO1xuICBsb2Rhc2gubWV0aG9kcyA9IGZ1bmN0aW9ucztcbiAgbG9kYXNoLnNlbGVjdCA9IGZpbHRlcjtcbiAgbG9kYXNoLnRhaWwgPSByZXN0O1xuICBsb2Rhc2gudGFrZSA9IGZpcnN0O1xuICBsb2Rhc2gudW5pcXVlID0gdW5pcTtcblxuICAvLyBhZGQgcHNldWRvIHByaXZhdGUgcHJvcGVydHkgdG8gYmUgdXNlZCBhbmQgcmVtb3ZlZCBkdXJpbmcgdGhlIGJ1aWxkIHByb2Nlc3NcbiAgbG9kYXNoLl9pdGVyYXRvclRlbXBsYXRlID0gaXRlcmF0b3JUZW1wbGF0ZTtcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvLyBhZGQgYWxsIHN0YXRpYyBmdW5jdGlvbnMgdG8gYGxvZGFzaC5wcm90b3R5cGVgXG4gIG1peGluKGxvZGFzaCk7XG5cbiAgLy8gYWRkIGBsb2Rhc2gucHJvdG90eXBlLmNoYWluYCBhZnRlciBjYWxsaW5nIGBtaXhpbigpYCB0byBhdm9pZCBvdmVyd3JpdGluZ1xuICAvLyBpdCB3aXRoIHRoZSB3cmFwcGVkIGBsb2Rhc2guY2hhaW5gXG4gIGxvZGFzaC5wcm90b3R5cGUuY2hhaW4gPSB3cmFwcGVyQ2hhaW47XG4gIGxvZGFzaC5wcm90b3R5cGUudmFsdWUgPSB3cmFwcGVyVmFsdWU7XG5cbiAgLy8gYWRkIGFsbCBtdXRhdG9yIEFycmF5IGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlci5cbiAgZm9yRWFjaChbJ3BvcCcsICdwdXNoJywgJ3JldmVyc2UnLCAnc2hpZnQnLCAnc29ydCcsICdzcGxpY2UnLCAndW5zaGlmdCddLCBmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgdmFyIGZ1bmMgPSBhcnJheVJlZlttZXRob2ROYW1lXTtcblxuICAgIGxvZGFzaC5wcm90b3R5cGVbbWV0aG9kTmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciB2YWx1ZSA9IHRoaXMuX193cmFwcGVkX187XG4gICAgICBmdW5jLmFwcGx5KHZhbHVlLCBhcmd1bWVudHMpO1xuXG4gICAgICAvLyBhdm9pZCBhcnJheS1saWtlIG9iamVjdCBidWdzIHdpdGggYEFycmF5I3NoaWZ0YCBhbmQgYEFycmF5I3NwbGljZWAgaW5cbiAgICAgIC8vIEZpcmVmb3ggPCAxMCBhbmQgSUUgPCA5XG4gICAgICBpZiAoaGFzT2JqZWN0U3BsaWNlQnVnICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBkZWxldGUgdmFsdWVbMF07XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fX2NoYWluX18pIHtcbiAgICAgICAgdmFsdWUgPSBuZXcgbG9kYXNoKHZhbHVlKTtcbiAgICAgICAgdmFsdWUuX19jaGFpbl9fID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBhZGQgYWxsIGFjY2Vzc29yIEFycmF5IGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlci5cbiAgZm9yRWFjaChbJ2NvbmNhdCcsICdqb2luJywgJ3NsaWNlJ10sIGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICB2YXIgZnVuYyA9IGFycmF5UmVmW21ldGhvZE5hbWVdO1xuXG4gICAgbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHZhbHVlID0gdGhpcy5fX3dyYXBwZWRfXyxcbiAgICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KHZhbHVlLCBhcmd1bWVudHMpO1xuXG4gICAgICBpZiAodGhpcy5fX2NoYWluX18pIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IGxvZGFzaChyZXN1bHQpO1xuICAgICAgICByZXN1bHQuX19jaGFpbl9fID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfSk7XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gZXhwb3NlIExvLURhc2hcbiAgLy8gc29tZSBBTUQgYnVpbGQgb3B0aW1pemVycywgbGlrZSByLmpzLCBjaGVjayBmb3Igc3BlY2lmaWMgY29uZGl0aW9uIHBhdHRlcm5zIGxpa2UgdGhlIGZvbGxvd2luZzpcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgLy8gRXhwb3NlIExvLURhc2ggdG8gdGhlIGdsb2JhbCBvYmplY3QgZXZlbiB3aGVuIGFuIEFNRCBsb2FkZXIgaXMgcHJlc2VudCBpblxuICAgIC8vIGNhc2UgTG8tRGFzaCB3YXMgaW5qZWN0ZWQgYnkgYSB0aGlyZC1wYXJ0eSBzY3JpcHQgYW5kIG5vdCBpbnRlbmRlZCB0byBiZVxuICAgIC8vIGxvYWRlZCBhcyBhIG1vZHVsZS4gVGhlIGdsb2JhbCBhc3NpZ25tZW50IGNhbiBiZSByZXZlcnRlZCBpbiB0aGUgTG8tRGFzaFxuICAgIC8vIG1vZHVsZSB2aWEgaXRzIGBub0NvbmZsaWN0KClgIG1ldGhvZC5cbiAgICB3aW5kb3cuXyA9IGxvZGFzaDtcblxuICAgIC8vIGRlZmluZSBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlIHNvLCB0aHJvdWdoIHBhdGggbWFwcGluZywgaXQgY2FuIGJlXG4gICAgLy8gcmVmZXJlbmNlZCBhcyB0aGUgXCJ1bmRlcnNjb3JlXCIgbW9kdWxlXG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGxvZGFzaDtcbiAgICB9KTtcbiAgfVxuICAvLyBjaGVjayBmb3IgYGV4cG9ydHNgIGFmdGVyIGBkZWZpbmVgIGluIGNhc2UgYSBidWlsZCBvcHRpbWl6ZXIgYWRkcyBhbiBgZXhwb3J0c2Agb2JqZWN0XG4gIGVsc2UgaWYgKGZyZWVFeHBvcnRzKSB7XG4gICAgLy8gaW4gTm9kZS5qcyBvciBSaW5nb0pTIHYwLjguMCtcbiAgICBpZiAodHlwZW9mIG1vZHVsZSA9PSAnb2JqZWN0JyAmJiBtb2R1bGUgJiYgbW9kdWxlLmV4cG9ydHMgPT0gZnJlZUV4cG9ydHMpIHtcbiAgICAgIChtb2R1bGUuZXhwb3J0cyA9IGxvZGFzaCkuXyA9IGxvZGFzaDtcbiAgICB9XG4gICAgLy8gaW4gTmFyd2hhbCBvciBSaW5nb0pTIHYwLjcuMC1cbiAgICBlbHNlIHtcbiAgICAgIGZyZWVFeHBvcnRzLl8gPSBsb2Rhc2g7XG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIC8vIGluIGEgYnJvd3NlciBvciBSaGlub1xuICAgIHdpbmRvdy5fID0gbG9kYXNoO1xuICB9XG59KHRoaXMpKTtcbiIsIi8vIElTQyBAIEp1bGllbiBGb250YW5ldFxuXG4ndXNlIHN0cmljdCdcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG52YXIgY29uc3RydWN0ID0gdHlwZW9mIFJlZmxlY3QgIT09ICd1bmRlZmluZWQnID8gUmVmbGVjdC5jb25zdHJ1Y3QgOiB1bmRlZmluZWRcbnZhciBkZWZpbmVQcm9wZXJ0eSA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbnZhciBjYXB0dXJlU3RhY2tUcmFjZSA9IEVycm9yLmNhcHR1cmVTdGFja1RyYWNlXG5pZiAoY2FwdHVyZVN0YWNrVHJhY2UgPT09IHVuZGVmaW5lZCkge1xuICBjYXB0dXJlU3RhY2tUcmFjZSA9IGZ1bmN0aW9uIGNhcHR1cmVTdGFja1RyYWNlIChlcnJvcikge1xuICAgIHZhciBjb250YWluZXIgPSBuZXcgRXJyb3IoKVxuXG4gICAgZGVmaW5lUHJvcGVydHkoZXJyb3IsICdzdGFjaycsIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIGdldDogZnVuY3Rpb24gZ2V0U3RhY2sgKCkge1xuICAgICAgICB2YXIgc3RhY2sgPSBjb250YWluZXIuc3RhY2tcblxuICAgICAgICAvLyBSZXBsYWNlIHByb3BlcnR5IHdpdGggdmFsdWUgZm9yIGZhc3RlciBmdXR1cmUgYWNjZXNzZXMuXG4gICAgICAgIGRlZmluZVByb3BlcnR5KHRoaXMsICdzdGFjaycsIHtcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgdmFsdWU6IHN0YWNrLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgICAgIH0pXG5cbiAgICAgICAgcmV0dXJuIHN0YWNrXG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbiBzZXRTdGFjayAoc3RhY2spIHtcbiAgICAgICAgZGVmaW5lUHJvcGVydHkoZXJyb3IsICdzdGFjaycsIHtcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgdmFsdWU6IHN0YWNrLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmZ1bmN0aW9uIEJhc2VFcnJvciAobWVzc2FnZSkge1xuICBpZiAobWVzc2FnZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5lUHJvcGVydHkodGhpcywgJ21lc3NhZ2UnLCB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB2YWx1ZTogbWVzc2FnZSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgfSlcbiAgfVxuXG4gIHZhciBjbmFtZSA9IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICBpZiAoXG4gICAgY25hbWUgIT09IHVuZGVmaW5lZCAmJlxuICAgIGNuYW1lICE9PSB0aGlzLm5hbWVcbiAgKSB7XG4gICAgZGVmaW5lUHJvcGVydHkodGhpcywgJ25hbWUnLCB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB2YWx1ZTogY25hbWUsXG4gICAgICB3cml0YWJsZTogdHJ1ZVxuICAgIH0pXG4gIH1cblxuICBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKVxufVxuXG5CYXNlRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUsIHtcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vSnNDb21tdW5pdHkvbWFrZS1lcnJvci9pc3N1ZXMvNFxuICBjb25zdHJ1Y3Rvcjoge1xuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogQmFzZUVycm9yLFxuICAgIHdyaXRhYmxlOiB0cnVlXG4gIH1cbn0pXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLy8gU2V0cyB0aGUgbmFtZSBvZiBhIGZ1bmN0aW9uIGlmIHBvc3NpYmxlIChkZXBlbmRzIG9mIHRoZSBKUyBlbmdpbmUpLlxudmFyIHNldEZ1bmN0aW9uTmFtZSA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIHNldEZ1bmN0aW9uTmFtZSAoZm4sIG5hbWUpIHtcbiAgICByZXR1cm4gZGVmaW5lUHJvcGVydHkoZm4sICduYW1lJywge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgdmFsdWU6IG5hbWVcbiAgICB9KVxuICB9XG4gIHRyeSB7XG4gICAgdmFyIGYgPSBmdW5jdGlvbiAoKSB7fVxuICAgIHNldEZ1bmN0aW9uTmFtZShmLCAnZm9vJylcbiAgICBpZiAoZi5uYW1lID09PSAnZm9vJykge1xuICAgICAgcmV0dXJuIHNldEZ1bmN0aW9uTmFtZVxuICAgIH1cbiAgfSBjYXRjaCAoXykge31cbn0pKClcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5mdW5jdGlvbiBtYWtlRXJyb3IgKGNvbnN0cnVjdG9yLCBzdXBlcl8pIHtcbiAgaWYgKHN1cGVyXyA9PSBudWxsIHx8IHN1cGVyXyA9PT0gRXJyb3IpIHtcbiAgICBzdXBlcl8gPSBCYXNlRXJyb3JcbiAgfSBlbHNlIGlmICh0eXBlb2Ygc3VwZXJfICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignc3VwZXJfIHNob3VsZCBiZSBhIGZ1bmN0aW9uJylcbiAgfVxuXG4gIHZhciBuYW1lXG4gIGlmICh0eXBlb2YgY29uc3RydWN0b3IgPT09ICdzdHJpbmcnKSB7XG4gICAgbmFtZSA9IGNvbnN0cnVjdG9yXG4gICAgY29uc3RydWN0b3IgPSBjb25zdHJ1Y3QgIT09IHVuZGVmaW5lZFxuICAgICAgPyBmdW5jdGlvbiAoKSB7IHJldHVybiBjb25zdHJ1Y3Qoc3VwZXJfLCBhcmd1bWVudHMsIHRoaXMuY29uc3RydWN0b3IpIH1cbiAgICAgIDogZnVuY3Rpb24gKCkgeyBzdXBlcl8uYXBwbHkodGhpcywgYXJndW1lbnRzKSB9XG5cbiAgICAvLyBJZiB0aGUgbmFtZSBjYW4gYmUgc2V0LCBkbyBpdCBvbmNlIGFuZCBmb3IgYWxsLlxuICAgIGlmIChzZXRGdW5jdGlvbk5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgc2V0RnVuY3Rpb25OYW1lKGNvbnN0cnVjdG9yLCBuYW1lKVxuICAgICAgbmFtZSA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlb2YgY29uc3RydWN0b3IgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdjb25zdHJ1Y3RvciBzaG91bGQgYmUgZWl0aGVyIGEgc3RyaW5nIG9yIGEgZnVuY3Rpb24nKVxuICB9XG5cbiAgLy8gQWxzbyByZWdpc3RlciB0aGUgc3VwZXIgY29uc3RydWN0b3IgYWxzbyBhcyBgY29uc3RydWN0b3Iuc3VwZXJfYCBqdXN0XG4gIC8vIGxpa2UgTm9kZSdzIGB1dGlsLmluaGVyaXRzKClgLlxuICBjb25zdHJ1Y3Rvci5zdXBlcl8gPSBjb25zdHJ1Y3Rvclsnc3VwZXInXSA9IHN1cGVyX1xuXG4gIHZhciBwcm9wZXJ0aWVzID0ge1xuICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB2YWx1ZTogY29uc3RydWN0b3IsXG4gICAgICB3cml0YWJsZTogdHJ1ZVxuICAgIH1cbiAgfVxuXG4gIC8vIElmIHRoZSBuYW1lIGNvdWxkIG5vdCBiZSBzZXQgb24gdGhlIGNvbnN0cnVjdG9yLCBzZXQgaXQgb24gdGhlXG4gIC8vIHByb3RvdHlwZS5cbiAgaWYgKG5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHByb3BlcnRpZXMubmFtZSA9IHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHZhbHVlOiBuYW1lLFxuICAgICAgd3JpdGFibGU6IHRydWVcbiAgICB9XG4gIH1cbiAgY29uc3RydWN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlcl8ucHJvdG90eXBlLCBwcm9wZXJ0aWVzKVxuXG4gIHJldHVybiBjb25zdHJ1Y3RvclxufVxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gbWFrZUVycm9yXG5leHBvcnRzLkJhc2VFcnJvciA9IEJhc2VFcnJvclxuIiwiKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcblx0dHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgOlxuXHR0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoZmFjdG9yeSkgOlxuXHQoZ2xvYmFsLnF1aWNrc2VsZWN0ID0gZmFjdG9yeSgpKTtcbn0odGhpcywgKGZ1bmN0aW9uICgpIHsgJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBxdWlja3NlbGVjdChhcnIsIGssIGxlZnQsIHJpZ2h0LCBjb21wYXJlKSB7XG4gICAgcXVpY2tzZWxlY3RTdGVwKGFyciwgaywgbGVmdCB8fCAwLCByaWdodCB8fCAoYXJyLmxlbmd0aCAtIDEpLCBjb21wYXJlIHx8IGRlZmF1bHRDb21wYXJlKTtcbn1cblxuZnVuY3Rpb24gcXVpY2tzZWxlY3RTdGVwKGFyciwgaywgbGVmdCwgcmlnaHQsIGNvbXBhcmUpIHtcblxuICAgIHdoaWxlIChyaWdodCA+IGxlZnQpIHtcbiAgICAgICAgaWYgKHJpZ2h0IC0gbGVmdCA+IDYwMCkge1xuICAgICAgICAgICAgdmFyIG4gPSByaWdodCAtIGxlZnQgKyAxO1xuICAgICAgICAgICAgdmFyIG0gPSBrIC0gbGVmdCArIDE7XG4gICAgICAgICAgICB2YXIgeiA9IE1hdGgubG9nKG4pO1xuICAgICAgICAgICAgdmFyIHMgPSAwLjUgKiBNYXRoLmV4cCgyICogeiAvIDMpO1xuICAgICAgICAgICAgdmFyIHNkID0gMC41ICogTWF0aC5zcXJ0KHogKiBzICogKG4gLSBzKSAvIG4pICogKG0gLSBuIC8gMiA8IDAgPyAtMSA6IDEpO1xuICAgICAgICAgICAgdmFyIG5ld0xlZnQgPSBNYXRoLm1heChsZWZ0LCBNYXRoLmZsb29yKGsgLSBtICogcyAvIG4gKyBzZCkpO1xuICAgICAgICAgICAgdmFyIG5ld1JpZ2h0ID0gTWF0aC5taW4ocmlnaHQsIE1hdGguZmxvb3IoayArIChuIC0gbSkgKiBzIC8gbiArIHNkKSk7XG4gICAgICAgICAgICBxdWlja3NlbGVjdFN0ZXAoYXJyLCBrLCBuZXdMZWZ0LCBuZXdSaWdodCwgY29tcGFyZSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdCA9IGFycltrXTtcbiAgICAgICAgdmFyIGkgPSBsZWZ0O1xuICAgICAgICB2YXIgaiA9IHJpZ2h0O1xuXG4gICAgICAgIHN3YXAoYXJyLCBsZWZ0LCBrKTtcbiAgICAgICAgaWYgKGNvbXBhcmUoYXJyW3JpZ2h0XSwgdCkgPiAwKSBzd2FwKGFyciwgbGVmdCwgcmlnaHQpO1xuXG4gICAgICAgIHdoaWxlIChpIDwgaikge1xuICAgICAgICAgICAgc3dhcChhcnIsIGksIGopO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgai0tO1xuICAgICAgICAgICAgd2hpbGUgKGNvbXBhcmUoYXJyW2ldLCB0KSA8IDApIGkrKztcbiAgICAgICAgICAgIHdoaWxlIChjb21wYXJlKGFycltqXSwgdCkgPiAwKSBqLS07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29tcGFyZShhcnJbbGVmdF0sIHQpID09PSAwKSBzd2FwKGFyciwgbGVmdCwgaik7XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaisrO1xuICAgICAgICAgICAgc3dhcChhcnIsIGosIHJpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChqIDw9IGspIGxlZnQgPSBqICsgMTtcbiAgICAgICAgaWYgKGsgPD0gaikgcmlnaHQgPSBqIC0gMTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHN3YXAoYXJyLCBpLCBqKSB7XG4gICAgdmFyIHRtcCA9IGFycltpXTtcbiAgICBhcnJbaV0gPSBhcnJbal07XG4gICAgYXJyW2pdID0gdG1wO1xufVxuXG5mdW5jdGlvbiBkZWZhdWx0Q29tcGFyZShhLCBiKSB7XG4gICAgcmV0dXJuIGEgPCBiID8gLTEgOiBhID4gYiA/IDEgOiAwO1xufVxuXG5yZXR1cm4gcXVpY2tzZWxlY3Q7XG5cbn0pKSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gcmJ1c2g7XG5tb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gcmJ1c2g7XG5cbnZhciBxdWlja3NlbGVjdCA9IHJlcXVpcmUoJ3F1aWNrc2VsZWN0Jyk7XG5cbmZ1bmN0aW9uIHJidXNoKG1heEVudHJpZXMsIGZvcm1hdCkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiByYnVzaCkpIHJldHVybiBuZXcgcmJ1c2gobWF4RW50cmllcywgZm9ybWF0KTtcblxuICAgIC8vIG1heCBlbnRyaWVzIGluIGEgbm9kZSBpcyA5IGJ5IGRlZmF1bHQ7IG1pbiBub2RlIGZpbGwgaXMgNDAlIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhpcy5fbWF4RW50cmllcyA9IE1hdGgubWF4KDQsIG1heEVudHJpZXMgfHwgOSk7XG4gICAgdGhpcy5fbWluRW50cmllcyA9IE1hdGgubWF4KDIsIE1hdGguY2VpbCh0aGlzLl9tYXhFbnRyaWVzICogMC40KSk7XG5cbiAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgIHRoaXMuX2luaXRGb3JtYXQoZm9ybWF0KTtcbiAgICB9XG5cbiAgICB0aGlzLmNsZWFyKCk7XG59XG5cbnJidXNoLnByb3RvdHlwZSA9IHtcblxuICAgIGFsbDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWxsKHRoaXMuZGF0YSwgW10pO1xuICAgIH0sXG5cbiAgICBzZWFyY2g6IGZ1bmN0aW9uIChiYm94KSB7XG5cbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLmRhdGEsXG4gICAgICAgICAgICByZXN1bHQgPSBbXSxcbiAgICAgICAgICAgIHRvQkJveCA9IHRoaXMudG9CQm94O1xuXG4gICAgICAgIGlmICghaW50ZXJzZWN0cyhiYm94LCBub2RlKSkgcmV0dXJuIHJlc3VsdDtcblxuICAgICAgICB2YXIgbm9kZXNUb1NlYXJjaCA9IFtdLFxuICAgICAgICAgICAgaSwgbGVuLCBjaGlsZCwgY2hpbGRCQm94O1xuXG4gICAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XG4gICAgICAgICAgICAgICAgY2hpbGRCQm94ID0gbm9kZS5sZWFmID8gdG9CQm94KGNoaWxkKSA6IGNoaWxkO1xuXG4gICAgICAgICAgICAgICAgaWYgKGludGVyc2VjdHMoYmJveCwgY2hpbGRCQm94KSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobm9kZS5sZWFmKSByZXN1bHQucHVzaChjaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvbnRhaW5zKGJib3gsIGNoaWxkQkJveCkpIHRoaXMuX2FsbChjaGlsZCwgcmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBub2Rlc1RvU2VhcmNoLnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5vZGUgPSBub2Rlc1RvU2VhcmNoLnBvcCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgY29sbGlkZXM6IGZ1bmN0aW9uIChiYm94KSB7XG5cbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLmRhdGEsXG4gICAgICAgICAgICB0b0JCb3ggPSB0aGlzLnRvQkJveDtcblxuICAgICAgICBpZiAoIWludGVyc2VjdHMoYmJveCwgbm9kZSkpIHJldHVybiBmYWxzZTtcblxuICAgICAgICB2YXIgbm9kZXNUb1NlYXJjaCA9IFtdLFxuICAgICAgICAgICAgaSwgbGVuLCBjaGlsZCwgY2hpbGRCQm94O1xuXG4gICAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XG4gICAgICAgICAgICAgICAgY2hpbGRCQm94ID0gbm9kZS5sZWFmID8gdG9CQm94KGNoaWxkKSA6IGNoaWxkO1xuXG4gICAgICAgICAgICAgICAgaWYgKGludGVyc2VjdHMoYmJveCwgY2hpbGRCQm94KSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobm9kZS5sZWFmIHx8IGNvbnRhaW5zKGJib3gsIGNoaWxkQkJveCkpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBub2Rlc1RvU2VhcmNoLnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5vZGUgPSBub2Rlc1RvU2VhcmNoLnBvcCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cbiAgICBsb2FkOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICBpZiAoIShkYXRhICYmIGRhdGEubGVuZ3RoKSkgcmV0dXJuIHRoaXM7XG5cbiAgICAgICAgaWYgKGRhdGEubGVuZ3RoIDwgdGhpcy5fbWluRW50cmllcykge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGRhdGEubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluc2VydChkYXRhW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVjdXJzaXZlbHkgYnVpbGQgdGhlIHRyZWUgd2l0aCB0aGUgZ2l2ZW4gZGF0YSBmcm9tIHNjcmF0Y2ggdXNpbmcgT01UIGFsZ29yaXRobVxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuX2J1aWxkKGRhdGEuc2xpY2UoKSwgMCwgZGF0YS5sZW5ndGggLSAxLCAwKTtcblxuICAgICAgICBpZiAoIXRoaXMuZGF0YS5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIHNhdmUgYXMgaXMgaWYgdHJlZSBpcyBlbXB0eVxuICAgICAgICAgICAgdGhpcy5kYXRhID0gbm9kZTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZGF0YS5oZWlnaHQgPT09IG5vZGUuaGVpZ2h0KSB7XG4gICAgICAgICAgICAvLyBzcGxpdCByb290IGlmIHRyZWVzIGhhdmUgdGhlIHNhbWUgaGVpZ2h0XG4gICAgICAgICAgICB0aGlzLl9zcGxpdFJvb3QodGhpcy5kYXRhLCBub2RlKTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuZGF0YS5oZWlnaHQgPCBub2RlLmhlaWdodCkge1xuICAgICAgICAgICAgICAgIC8vIHN3YXAgdHJlZXMgaWYgaW5zZXJ0ZWQgb25lIGlzIGJpZ2dlclxuICAgICAgICAgICAgICAgIHZhciB0bXBOb2RlID0gdGhpcy5kYXRhO1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YSA9IG5vZGU7XG4gICAgICAgICAgICAgICAgbm9kZSA9IHRtcE5vZGU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGluc2VydCB0aGUgc21hbGwgdHJlZSBpbnRvIHRoZSBsYXJnZSB0cmVlIGF0IGFwcHJvcHJpYXRlIGxldmVsXG4gICAgICAgICAgICB0aGlzLl9pbnNlcnQobm9kZSwgdGhpcy5kYXRhLmhlaWdodCAtIG5vZGUuaGVpZ2h0IC0gMSwgdHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgaW5zZXJ0OiBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICBpZiAoaXRlbSkgdGhpcy5faW5zZXJ0KGl0ZW0sIHRoaXMuZGF0YS5oZWlnaHQgLSAxKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIGNsZWFyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IGNyZWF0ZU5vZGUoW10pO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgcmVtb3ZlOiBmdW5jdGlvbiAoaXRlbSwgZXF1YWxzRm4pIHtcbiAgICAgICAgaWYgKCFpdGVtKSByZXR1cm4gdGhpcztcblxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuZGF0YSxcbiAgICAgICAgICAgIGJib3ggPSB0aGlzLnRvQkJveChpdGVtKSxcbiAgICAgICAgICAgIHBhdGggPSBbXSxcbiAgICAgICAgICAgIGluZGV4ZXMgPSBbXSxcbiAgICAgICAgICAgIGksIHBhcmVudCwgaW5kZXgsIGdvaW5nVXA7XG5cbiAgICAgICAgLy8gZGVwdGgtZmlyc3QgaXRlcmF0aXZlIHRyZWUgdHJhdmVyc2FsXG4gICAgICAgIHdoaWxlIChub2RlIHx8IHBhdGgubGVuZ3RoKSB7XG5cbiAgICAgICAgICAgIGlmICghbm9kZSkgeyAvLyBnbyB1cFxuICAgICAgICAgICAgICAgIG5vZGUgPSBwYXRoLnBvcCgpO1xuICAgICAgICAgICAgICAgIHBhcmVudCA9IHBhdGhbcGF0aC5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgICBpID0gaW5kZXhlcy5wb3AoKTtcbiAgICAgICAgICAgICAgICBnb2luZ1VwID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG5vZGUubGVhZikgeyAvLyBjaGVjayBjdXJyZW50IG5vZGVcbiAgICAgICAgICAgICAgICBpbmRleCA9IGZpbmRJdGVtKGl0ZW0sIG5vZGUuY2hpbGRyZW4sIGVxdWFsc0ZuKTtcblxuICAgICAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaXRlbSBmb3VuZCwgcmVtb3ZlIHRoZSBpdGVtIGFuZCBjb25kZW5zZSB0cmVlIHVwd2FyZHNcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICBwYXRoLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlKHBhdGgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZ29pbmdVcCAmJiAhbm9kZS5sZWFmICYmIGNvbnRhaW5zKG5vZGUsIGJib3gpKSB7IC8vIGdvIGRvd25cbiAgICAgICAgICAgICAgICBwYXRoLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgICAgaW5kZXhlcy5wdXNoKGkpO1xuICAgICAgICAgICAgICAgIGkgPSAwO1xuICAgICAgICAgICAgICAgIHBhcmVudCA9IG5vZGU7XG4gICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUuY2hpbGRyZW5bMF07XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGFyZW50KSB7IC8vIGdvIHJpZ2h0XG4gICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgICAgIG5vZGUgPSBwYXJlbnQuY2hpbGRyZW5baV07XG4gICAgICAgICAgICAgICAgZ29pbmdVcCA9IGZhbHNlO1xuXG4gICAgICAgICAgICB9IGVsc2Ugbm9kZSA9IG51bGw7IC8vIG5vdGhpbmcgZm91bmRcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICB0b0JCb3g6IGZ1bmN0aW9uIChpdGVtKSB7IHJldHVybiBpdGVtOyB9LFxuXG4gICAgY29tcGFyZU1pblg6IGNvbXBhcmVOb2RlTWluWCxcbiAgICBjb21wYXJlTWluWTogY29tcGFyZU5vZGVNaW5ZLFxuXG4gICAgdG9KU09OOiBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzLmRhdGE7IH0sXG5cbiAgICBmcm9tSlNPTjogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIF9hbGw6IGZ1bmN0aW9uIChub2RlLCByZXN1bHQpIHtcbiAgICAgICAgdmFyIG5vZGVzVG9TZWFyY2ggPSBbXTtcbiAgICAgICAgd2hpbGUgKG5vZGUpIHtcbiAgICAgICAgICAgIGlmIChub2RlLmxlYWYpIHJlc3VsdC5wdXNoLmFwcGx5KHJlc3VsdCwgbm9kZS5jaGlsZHJlbik7XG4gICAgICAgICAgICBlbHNlIG5vZGVzVG9TZWFyY2gucHVzaC5hcHBseShub2Rlc1RvU2VhcmNoLCBub2RlLmNoaWxkcmVuKTtcblxuICAgICAgICAgICAgbm9kZSA9IG5vZGVzVG9TZWFyY2gucG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgX2J1aWxkOiBmdW5jdGlvbiAoaXRlbXMsIGxlZnQsIHJpZ2h0LCBoZWlnaHQpIHtcblxuICAgICAgICB2YXIgTiA9IHJpZ2h0IC0gbGVmdCArIDEsXG4gICAgICAgICAgICBNID0gdGhpcy5fbWF4RW50cmllcyxcbiAgICAgICAgICAgIG5vZGU7XG5cbiAgICAgICAgaWYgKE4gPD0gTSkge1xuICAgICAgICAgICAgLy8gcmVhY2hlZCBsZWFmIGxldmVsOyByZXR1cm4gbGVhZlxuICAgICAgICAgICAgbm9kZSA9IGNyZWF0ZU5vZGUoaXRlbXMuc2xpY2UobGVmdCwgcmlnaHQgKyAxKSk7XG4gICAgICAgICAgICBjYWxjQkJveChub2RlLCB0aGlzLnRvQkJveCk7XG4gICAgICAgICAgICByZXR1cm4gbm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaGVpZ2h0KSB7XG4gICAgICAgICAgICAvLyB0YXJnZXQgaGVpZ2h0IG9mIHRoZSBidWxrLWxvYWRlZCB0cmVlXG4gICAgICAgICAgICBoZWlnaHQgPSBNYXRoLmNlaWwoTWF0aC5sb2coTikgLyBNYXRoLmxvZyhNKSk7XG5cbiAgICAgICAgICAgIC8vIHRhcmdldCBudW1iZXIgb2Ygcm9vdCBlbnRyaWVzIHRvIG1heGltaXplIHN0b3JhZ2UgdXRpbGl6YXRpb25cbiAgICAgICAgICAgIE0gPSBNYXRoLmNlaWwoTiAvIE1hdGgucG93KE0sIGhlaWdodCAtIDEpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG5vZGUgPSBjcmVhdGVOb2RlKFtdKTtcbiAgICAgICAgbm9kZS5sZWFmID0gZmFsc2U7XG4gICAgICAgIG5vZGUuaGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgICAgIC8vIHNwbGl0IHRoZSBpdGVtcyBpbnRvIE0gbW9zdGx5IHNxdWFyZSB0aWxlc1xuXG4gICAgICAgIHZhciBOMiA9IE1hdGguY2VpbChOIC8gTSksXG4gICAgICAgICAgICBOMSA9IE4yICogTWF0aC5jZWlsKE1hdGguc3FydChNKSksXG4gICAgICAgICAgICBpLCBqLCByaWdodDIsIHJpZ2h0MztcblxuICAgICAgICBtdWx0aVNlbGVjdChpdGVtcywgbGVmdCwgcmlnaHQsIE4xLCB0aGlzLmNvbXBhcmVNaW5YKTtcblxuICAgICAgICBmb3IgKGkgPSBsZWZ0OyBpIDw9IHJpZ2h0OyBpICs9IE4xKSB7XG5cbiAgICAgICAgICAgIHJpZ2h0MiA9IE1hdGgubWluKGkgKyBOMSAtIDEsIHJpZ2h0KTtcblxuICAgICAgICAgICAgbXVsdGlTZWxlY3QoaXRlbXMsIGksIHJpZ2h0MiwgTjIsIHRoaXMuY29tcGFyZU1pblkpO1xuXG4gICAgICAgICAgICBmb3IgKGogPSBpOyBqIDw9IHJpZ2h0MjsgaiArPSBOMikge1xuXG4gICAgICAgICAgICAgICAgcmlnaHQzID0gTWF0aC5taW4oaiArIE4yIC0gMSwgcmlnaHQyKTtcblxuICAgICAgICAgICAgICAgIC8vIHBhY2sgZWFjaCBlbnRyeSByZWN1cnNpdmVseVxuICAgICAgICAgICAgICAgIG5vZGUuY2hpbGRyZW4ucHVzaCh0aGlzLl9idWlsZChpdGVtcywgaiwgcmlnaHQzLCBoZWlnaHQgLSAxKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjYWxjQkJveChub2RlLCB0aGlzLnRvQkJveCk7XG5cbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfSxcblxuICAgIF9jaG9vc2VTdWJ0cmVlOiBmdW5jdGlvbiAoYmJveCwgbm9kZSwgbGV2ZWwsIHBhdGgpIHtcblxuICAgICAgICB2YXIgaSwgbGVuLCBjaGlsZCwgdGFyZ2V0Tm9kZSwgYXJlYSwgZW5sYXJnZW1lbnQsIG1pbkFyZWEsIG1pbkVubGFyZ2VtZW50O1xuXG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICBwYXRoLnB1c2gobm9kZSk7XG5cbiAgICAgICAgICAgIGlmIChub2RlLmxlYWYgfHwgcGF0aC5sZW5ndGggLSAxID09PSBsZXZlbCkgYnJlYWs7XG5cbiAgICAgICAgICAgIG1pbkFyZWEgPSBtaW5FbmxhcmdlbWVudCA9IEluZmluaXR5O1xuXG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY2hpbGQgPSBub2RlLmNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgICAgIGFyZWEgPSBiYm94QXJlYShjaGlsZCk7XG4gICAgICAgICAgICAgICAgZW5sYXJnZW1lbnQgPSBlbmxhcmdlZEFyZWEoYmJveCwgY2hpbGQpIC0gYXJlYTtcblxuICAgICAgICAgICAgICAgIC8vIGNob29zZSBlbnRyeSB3aXRoIHRoZSBsZWFzdCBhcmVhIGVubGFyZ2VtZW50XG4gICAgICAgICAgICAgICAgaWYgKGVubGFyZ2VtZW50IDwgbWluRW5sYXJnZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbWluRW5sYXJnZW1lbnQgPSBlbmxhcmdlbWVudDtcbiAgICAgICAgICAgICAgICAgICAgbWluQXJlYSA9IGFyZWEgPCBtaW5BcmVhID8gYXJlYSA6IG1pbkFyZWE7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldE5vZGUgPSBjaGlsZDtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZW5sYXJnZW1lbnQgPT09IG1pbkVubGFyZ2VtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG90aGVyd2lzZSBjaG9vc2Ugb25lIHdpdGggdGhlIHNtYWxsZXN0IGFyZWFcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZWEgPCBtaW5BcmVhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5BcmVhID0gYXJlYTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldE5vZGUgPSBjaGlsZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9kZSA9IHRhcmdldE5vZGUgfHwgbm9kZS5jaGlsZHJlblswXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH0sXG5cbiAgICBfaW5zZXJ0OiBmdW5jdGlvbiAoaXRlbSwgbGV2ZWwsIGlzTm9kZSkge1xuXG4gICAgICAgIHZhciB0b0JCb3ggPSB0aGlzLnRvQkJveCxcbiAgICAgICAgICAgIGJib3ggPSBpc05vZGUgPyBpdGVtIDogdG9CQm94KGl0ZW0pLFxuICAgICAgICAgICAgaW5zZXJ0UGF0aCA9IFtdO1xuXG4gICAgICAgIC8vIGZpbmQgdGhlIGJlc3Qgbm9kZSBmb3IgYWNjb21tb2RhdGluZyB0aGUgaXRlbSwgc2F2aW5nIGFsbCBub2RlcyBhbG9uZyB0aGUgcGF0aCB0b29cbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLl9jaG9vc2VTdWJ0cmVlKGJib3gsIHRoaXMuZGF0YSwgbGV2ZWwsIGluc2VydFBhdGgpO1xuXG4gICAgICAgIC8vIHB1dCB0aGUgaXRlbSBpbnRvIHRoZSBub2RlXG4gICAgICAgIG5vZGUuY2hpbGRyZW4ucHVzaChpdGVtKTtcbiAgICAgICAgZXh0ZW5kKG5vZGUsIGJib3gpO1xuXG4gICAgICAgIC8vIHNwbGl0IG9uIG5vZGUgb3ZlcmZsb3c7IHByb3BhZ2F0ZSB1cHdhcmRzIGlmIG5lY2Vzc2FyeVxuICAgICAgICB3aGlsZSAobGV2ZWwgPj0gMCkge1xuICAgICAgICAgICAgaWYgKGluc2VydFBhdGhbbGV2ZWxdLmNoaWxkcmVuLmxlbmd0aCA+IHRoaXMuX21heEVudHJpZXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zcGxpdChpbnNlcnRQYXRoLCBsZXZlbCk7XG4gICAgICAgICAgICAgICAgbGV2ZWwtLTtcbiAgICAgICAgICAgIH0gZWxzZSBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFkanVzdCBiYm94ZXMgYWxvbmcgdGhlIGluc2VydGlvbiBwYXRoXG4gICAgICAgIHRoaXMuX2FkanVzdFBhcmVudEJCb3hlcyhiYm94LCBpbnNlcnRQYXRoLCBsZXZlbCk7XG4gICAgfSxcblxuICAgIC8vIHNwbGl0IG92ZXJmbG93ZWQgbm9kZSBpbnRvIHR3b1xuICAgIF9zcGxpdDogZnVuY3Rpb24gKGluc2VydFBhdGgsIGxldmVsKSB7XG5cbiAgICAgICAgdmFyIG5vZGUgPSBpbnNlcnRQYXRoW2xldmVsXSxcbiAgICAgICAgICAgIE0gPSBub2RlLmNoaWxkcmVuLmxlbmd0aCxcbiAgICAgICAgICAgIG0gPSB0aGlzLl9taW5FbnRyaWVzO1xuXG4gICAgICAgIHRoaXMuX2Nob29zZVNwbGl0QXhpcyhub2RlLCBtLCBNKTtcblxuICAgICAgICB2YXIgc3BsaXRJbmRleCA9IHRoaXMuX2Nob29zZVNwbGl0SW5kZXgobm9kZSwgbSwgTSk7XG5cbiAgICAgICAgdmFyIG5ld05vZGUgPSBjcmVhdGVOb2RlKG5vZGUuY2hpbGRyZW4uc3BsaWNlKHNwbGl0SW5kZXgsIG5vZGUuY2hpbGRyZW4ubGVuZ3RoIC0gc3BsaXRJbmRleCkpO1xuICAgICAgICBuZXdOb2RlLmhlaWdodCA9IG5vZGUuaGVpZ2h0O1xuICAgICAgICBuZXdOb2RlLmxlYWYgPSBub2RlLmxlYWY7XG5cbiAgICAgICAgY2FsY0JCb3gobm9kZSwgdGhpcy50b0JCb3gpO1xuICAgICAgICBjYWxjQkJveChuZXdOb2RlLCB0aGlzLnRvQkJveCk7XG5cbiAgICAgICAgaWYgKGxldmVsKSBpbnNlcnRQYXRoW2xldmVsIC0gMV0uY2hpbGRyZW4ucHVzaChuZXdOb2RlKTtcbiAgICAgICAgZWxzZSB0aGlzLl9zcGxpdFJvb3Qobm9kZSwgbmV3Tm9kZSk7XG4gICAgfSxcblxuICAgIF9zcGxpdFJvb3Q6IGZ1bmN0aW9uIChub2RlLCBuZXdOb2RlKSB7XG4gICAgICAgIC8vIHNwbGl0IHJvb3Qgbm9kZVxuICAgICAgICB0aGlzLmRhdGEgPSBjcmVhdGVOb2RlKFtub2RlLCBuZXdOb2RlXSk7XG4gICAgICAgIHRoaXMuZGF0YS5oZWlnaHQgPSBub2RlLmhlaWdodCArIDE7XG4gICAgICAgIHRoaXMuZGF0YS5sZWFmID0gZmFsc2U7XG4gICAgICAgIGNhbGNCQm94KHRoaXMuZGF0YSwgdGhpcy50b0JCb3gpO1xuICAgIH0sXG5cbiAgICBfY2hvb3NlU3BsaXRJbmRleDogZnVuY3Rpb24gKG5vZGUsIG0sIE0pIHtcblxuICAgICAgICB2YXIgaSwgYmJveDEsIGJib3gyLCBvdmVybGFwLCBhcmVhLCBtaW5PdmVybGFwLCBtaW5BcmVhLCBpbmRleDtcblxuICAgICAgICBtaW5PdmVybGFwID0gbWluQXJlYSA9IEluZmluaXR5O1xuXG4gICAgICAgIGZvciAoaSA9IG07IGkgPD0gTSAtIG07IGkrKykge1xuICAgICAgICAgICAgYmJveDEgPSBkaXN0QkJveChub2RlLCAwLCBpLCB0aGlzLnRvQkJveCk7XG4gICAgICAgICAgICBiYm94MiA9IGRpc3RCQm94KG5vZGUsIGksIE0sIHRoaXMudG9CQm94KTtcblxuICAgICAgICAgICAgb3ZlcmxhcCA9IGludGVyc2VjdGlvbkFyZWEoYmJveDEsIGJib3gyKTtcbiAgICAgICAgICAgIGFyZWEgPSBiYm94QXJlYShiYm94MSkgKyBiYm94QXJlYShiYm94Mik7XG5cbiAgICAgICAgICAgIC8vIGNob29zZSBkaXN0cmlidXRpb24gd2l0aCBtaW5pbXVtIG92ZXJsYXBcbiAgICAgICAgICAgIGlmIChvdmVybGFwIDwgbWluT3ZlcmxhcCkge1xuICAgICAgICAgICAgICAgIG1pbk92ZXJsYXAgPSBvdmVybGFwO1xuICAgICAgICAgICAgICAgIGluZGV4ID0gaTtcblxuICAgICAgICAgICAgICAgIG1pbkFyZWEgPSBhcmVhIDwgbWluQXJlYSA/IGFyZWEgOiBtaW5BcmVhO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKG92ZXJsYXAgPT09IG1pbk92ZXJsYXApIHtcbiAgICAgICAgICAgICAgICAvLyBvdGhlcndpc2UgY2hvb3NlIGRpc3RyaWJ1dGlvbiB3aXRoIG1pbmltdW0gYXJlYVxuICAgICAgICAgICAgICAgIGlmIChhcmVhIDwgbWluQXJlYSkge1xuICAgICAgICAgICAgICAgICAgICBtaW5BcmVhID0gYXJlYTtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpbmRleDtcbiAgICB9LFxuXG4gICAgLy8gc29ydHMgbm9kZSBjaGlsZHJlbiBieSB0aGUgYmVzdCBheGlzIGZvciBzcGxpdFxuICAgIF9jaG9vc2VTcGxpdEF4aXM6IGZ1bmN0aW9uIChub2RlLCBtLCBNKSB7XG5cbiAgICAgICAgdmFyIGNvbXBhcmVNaW5YID0gbm9kZS5sZWFmID8gdGhpcy5jb21wYXJlTWluWCA6IGNvbXBhcmVOb2RlTWluWCxcbiAgICAgICAgICAgIGNvbXBhcmVNaW5ZID0gbm9kZS5sZWFmID8gdGhpcy5jb21wYXJlTWluWSA6IGNvbXBhcmVOb2RlTWluWSxcbiAgICAgICAgICAgIHhNYXJnaW4gPSB0aGlzLl9hbGxEaXN0TWFyZ2luKG5vZGUsIG0sIE0sIGNvbXBhcmVNaW5YKSxcbiAgICAgICAgICAgIHlNYXJnaW4gPSB0aGlzLl9hbGxEaXN0TWFyZ2luKG5vZGUsIG0sIE0sIGNvbXBhcmVNaW5ZKTtcblxuICAgICAgICAvLyBpZiB0b3RhbCBkaXN0cmlidXRpb25zIG1hcmdpbiB2YWx1ZSBpcyBtaW5pbWFsIGZvciB4LCBzb3J0IGJ5IG1pblgsXG4gICAgICAgIC8vIG90aGVyd2lzZSBpdCdzIGFscmVhZHkgc29ydGVkIGJ5IG1pbllcbiAgICAgICAgaWYgKHhNYXJnaW4gPCB5TWFyZ2luKSBub2RlLmNoaWxkcmVuLnNvcnQoY29tcGFyZU1pblgpO1xuICAgIH0sXG5cbiAgICAvLyB0b3RhbCBtYXJnaW4gb2YgYWxsIHBvc3NpYmxlIHNwbGl0IGRpc3RyaWJ1dGlvbnMgd2hlcmUgZWFjaCBub2RlIGlzIGF0IGxlYXN0IG0gZnVsbFxuICAgIF9hbGxEaXN0TWFyZ2luOiBmdW5jdGlvbiAobm9kZSwgbSwgTSwgY29tcGFyZSkge1xuXG4gICAgICAgIG5vZGUuY2hpbGRyZW4uc29ydChjb21wYXJlKTtcblxuICAgICAgICB2YXIgdG9CQm94ID0gdGhpcy50b0JCb3gsXG4gICAgICAgICAgICBsZWZ0QkJveCA9IGRpc3RCQm94KG5vZGUsIDAsIG0sIHRvQkJveCksXG4gICAgICAgICAgICByaWdodEJCb3ggPSBkaXN0QkJveChub2RlLCBNIC0gbSwgTSwgdG9CQm94KSxcbiAgICAgICAgICAgIG1hcmdpbiA9IGJib3hNYXJnaW4obGVmdEJCb3gpICsgYmJveE1hcmdpbihyaWdodEJCb3gpLFxuICAgICAgICAgICAgaSwgY2hpbGQ7XG5cbiAgICAgICAgZm9yIChpID0gbTsgaSA8IE0gLSBtOyBpKyspIHtcbiAgICAgICAgICAgIGNoaWxkID0gbm9kZS5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgIGV4dGVuZChsZWZ0QkJveCwgbm9kZS5sZWFmID8gdG9CQm94KGNoaWxkKSA6IGNoaWxkKTtcbiAgICAgICAgICAgIG1hcmdpbiArPSBiYm94TWFyZ2luKGxlZnRCQm94KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoaSA9IE0gLSBtIC0gMTsgaSA+PSBtOyBpLS0pIHtcbiAgICAgICAgICAgIGNoaWxkID0gbm9kZS5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgIGV4dGVuZChyaWdodEJCb3gsIG5vZGUubGVhZiA/IHRvQkJveChjaGlsZCkgOiBjaGlsZCk7XG4gICAgICAgICAgICBtYXJnaW4gKz0gYmJveE1hcmdpbihyaWdodEJCb3gpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1hcmdpbjtcbiAgICB9LFxuXG4gICAgX2FkanVzdFBhcmVudEJCb3hlczogZnVuY3Rpb24gKGJib3gsIHBhdGgsIGxldmVsKSB7XG4gICAgICAgIC8vIGFkanVzdCBiYm94ZXMgYWxvbmcgdGhlIGdpdmVuIHRyZWUgcGF0aFxuICAgICAgICBmb3IgKHZhciBpID0gbGV2ZWw7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBleHRlbmQocGF0aFtpXSwgYmJveCk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgX2NvbmRlbnNlOiBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICAvLyBnbyB0aHJvdWdoIHRoZSBwYXRoLCByZW1vdmluZyBlbXB0eSBub2RlcyBhbmQgdXBkYXRpbmcgYmJveGVzXG4gICAgICAgIGZvciAodmFyIGkgPSBwYXRoLmxlbmd0aCAtIDEsIHNpYmxpbmdzOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgaWYgKHBhdGhbaV0uY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmdzID0gcGF0aFtpIC0gMV0uY2hpbGRyZW47XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmdzLnNwbGljZShzaWJsaW5ncy5pbmRleE9mKHBhdGhbaV0pLCAxKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB0aGlzLmNsZWFyKCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSBjYWxjQkJveChwYXRoW2ldLCB0aGlzLnRvQkJveCk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgX2luaXRGb3JtYXQ6IGZ1bmN0aW9uIChmb3JtYXQpIHtcbiAgICAgICAgLy8gZGF0YSBmb3JtYXQgKG1pblgsIG1pblksIG1heFgsIG1heFkgYWNjZXNzb3JzKVxuXG4gICAgICAgIC8vIHVzZXMgZXZhbC10eXBlIGZ1bmN0aW9uIGNvbXBpbGF0aW9uIGluc3RlYWQgb2YganVzdCBhY2NlcHRpbmcgYSB0b0JCb3ggZnVuY3Rpb25cbiAgICAgICAgLy8gYmVjYXVzZSB0aGUgYWxnb3JpdGhtcyBhcmUgdmVyeSBzZW5zaXRpdmUgdG8gc29ydGluZyBmdW5jdGlvbnMgcGVyZm9ybWFuY2UsXG4gICAgICAgIC8vIHNvIHRoZXkgc2hvdWxkIGJlIGRlYWQgc2ltcGxlIGFuZCB3aXRob3V0IGlubmVyIGNhbGxzXG5cbiAgICAgICAgdmFyIGNvbXBhcmVBcnIgPSBbJ3JldHVybiBhJywgJyAtIGInLCAnOyddO1xuXG4gICAgICAgIHRoaXMuY29tcGFyZU1pblggPSBuZXcgRnVuY3Rpb24oJ2EnLCAnYicsIGNvbXBhcmVBcnIuam9pbihmb3JtYXRbMF0pKTtcbiAgICAgICAgdGhpcy5jb21wYXJlTWluWSA9IG5ldyBGdW5jdGlvbignYScsICdiJywgY29tcGFyZUFyci5qb2luKGZvcm1hdFsxXSkpO1xuXG4gICAgICAgIHRoaXMudG9CQm94ID0gbmV3IEZ1bmN0aW9uKCdhJyxcbiAgICAgICAgICAgICdyZXR1cm4ge21pblg6IGEnICsgZm9ybWF0WzBdICtcbiAgICAgICAgICAgICcsIG1pblk6IGEnICsgZm9ybWF0WzFdICtcbiAgICAgICAgICAgICcsIG1heFg6IGEnICsgZm9ybWF0WzJdICtcbiAgICAgICAgICAgICcsIG1heFk6IGEnICsgZm9ybWF0WzNdICsgJ307Jyk7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gZmluZEl0ZW0oaXRlbSwgaXRlbXMsIGVxdWFsc0ZuKSB7XG4gICAgaWYgKCFlcXVhbHNGbikgcmV0dXJuIGl0ZW1zLmluZGV4T2YoaXRlbSk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChlcXVhbHNGbihpdGVtLCBpdGVtc1tpXSkpIHJldHVybiBpO1xuICAgIH1cbiAgICByZXR1cm4gLTE7XG59XG5cbi8vIGNhbGN1bGF0ZSBub2RlJ3MgYmJveCBmcm9tIGJib3hlcyBvZiBpdHMgY2hpbGRyZW5cbmZ1bmN0aW9uIGNhbGNCQm94KG5vZGUsIHRvQkJveCkge1xuICAgIGRpc3RCQm94KG5vZGUsIDAsIG5vZGUuY2hpbGRyZW4ubGVuZ3RoLCB0b0JCb3gsIG5vZGUpO1xufVxuXG4vLyBtaW4gYm91bmRpbmcgcmVjdGFuZ2xlIG9mIG5vZGUgY2hpbGRyZW4gZnJvbSBrIHRvIHAtMVxuZnVuY3Rpb24gZGlzdEJCb3gobm9kZSwgaywgcCwgdG9CQm94LCBkZXN0Tm9kZSkge1xuICAgIGlmICghZGVzdE5vZGUpIGRlc3ROb2RlID0gY3JlYXRlTm9kZShudWxsKTtcbiAgICBkZXN0Tm9kZS5taW5YID0gSW5maW5pdHk7XG4gICAgZGVzdE5vZGUubWluWSA9IEluZmluaXR5O1xuICAgIGRlc3ROb2RlLm1heFggPSAtSW5maW5pdHk7XG4gICAgZGVzdE5vZGUubWF4WSA9IC1JbmZpbml0eTtcblxuICAgIGZvciAodmFyIGkgPSBrLCBjaGlsZDsgaSA8IHA7IGkrKykge1xuICAgICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XG4gICAgICAgIGV4dGVuZChkZXN0Tm9kZSwgbm9kZS5sZWFmID8gdG9CQm94KGNoaWxkKSA6IGNoaWxkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVzdE5vZGU7XG59XG5cbmZ1bmN0aW9uIGV4dGVuZChhLCBiKSB7XG4gICAgYS5taW5YID0gTWF0aC5taW4oYS5taW5YLCBiLm1pblgpO1xuICAgIGEubWluWSA9IE1hdGgubWluKGEubWluWSwgYi5taW5ZKTtcbiAgICBhLm1heFggPSBNYXRoLm1heChhLm1heFgsIGIubWF4WCk7XG4gICAgYS5tYXhZID0gTWF0aC5tYXgoYS5tYXhZLCBiLm1heFkpO1xuICAgIHJldHVybiBhO1xufVxuXG5mdW5jdGlvbiBjb21wYXJlTm9kZU1pblgoYSwgYikgeyByZXR1cm4gYS5taW5YIC0gYi5taW5YOyB9XG5mdW5jdGlvbiBjb21wYXJlTm9kZU1pblkoYSwgYikgeyByZXR1cm4gYS5taW5ZIC0gYi5taW5ZOyB9XG5cbmZ1bmN0aW9uIGJib3hBcmVhKGEpICAgeyByZXR1cm4gKGEubWF4WCAtIGEubWluWCkgKiAoYS5tYXhZIC0gYS5taW5ZKTsgfVxuZnVuY3Rpb24gYmJveE1hcmdpbihhKSB7IHJldHVybiAoYS5tYXhYIC0gYS5taW5YKSArIChhLm1heFkgLSBhLm1pblkpOyB9XG5cbmZ1bmN0aW9uIGVubGFyZ2VkQXJlYShhLCBiKSB7XG4gICAgcmV0dXJuIChNYXRoLm1heChiLm1heFgsIGEubWF4WCkgLSBNYXRoLm1pbihiLm1pblgsIGEubWluWCkpICpcbiAgICAgICAgICAgKE1hdGgubWF4KGIubWF4WSwgYS5tYXhZKSAtIE1hdGgubWluKGIubWluWSwgYS5taW5ZKSk7XG59XG5cbmZ1bmN0aW9uIGludGVyc2VjdGlvbkFyZWEoYSwgYikge1xuICAgIHZhciBtaW5YID0gTWF0aC5tYXgoYS5taW5YLCBiLm1pblgpLFxuICAgICAgICBtaW5ZID0gTWF0aC5tYXgoYS5taW5ZLCBiLm1pblkpLFxuICAgICAgICBtYXhYID0gTWF0aC5taW4oYS5tYXhYLCBiLm1heFgpLFxuICAgICAgICBtYXhZID0gTWF0aC5taW4oYS5tYXhZLCBiLm1heFkpO1xuXG4gICAgcmV0dXJuIE1hdGgubWF4KDAsIG1heFggLSBtaW5YKSAqXG4gICAgICAgICAgIE1hdGgubWF4KDAsIG1heFkgLSBtaW5ZKTtcbn1cblxuZnVuY3Rpb24gY29udGFpbnMoYSwgYikge1xuICAgIHJldHVybiBhLm1pblggPD0gYi5taW5YICYmXG4gICAgICAgICAgIGEubWluWSA8PSBiLm1pblkgJiZcbiAgICAgICAgICAgYi5tYXhYIDw9IGEubWF4WCAmJlxuICAgICAgICAgICBiLm1heFkgPD0gYS5tYXhZO1xufVxuXG5mdW5jdGlvbiBpbnRlcnNlY3RzKGEsIGIpIHtcbiAgICByZXR1cm4gYi5taW5YIDw9IGEubWF4WCAmJlxuICAgICAgICAgICBiLm1pblkgPD0gYS5tYXhZICYmXG4gICAgICAgICAgIGIubWF4WCA+PSBhLm1pblggJiZcbiAgICAgICAgICAgYi5tYXhZID49IGEubWluWTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTm9kZShjaGlsZHJlbikge1xuICAgIHJldHVybiB7XG4gICAgICAgIGNoaWxkcmVuOiBjaGlsZHJlbixcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgICBsZWFmOiB0cnVlLFxuICAgICAgICBtaW5YOiBJbmZpbml0eSxcbiAgICAgICAgbWluWTogSW5maW5pdHksXG4gICAgICAgIG1heFg6IC1JbmZpbml0eSxcbiAgICAgICAgbWF4WTogLUluZmluaXR5XG4gICAgfTtcbn1cblxuLy8gc29ydCBhbiBhcnJheSBzbyB0aGF0IGl0ZW1zIGNvbWUgaW4gZ3JvdXBzIG9mIG4gdW5zb3J0ZWQgaXRlbXMsIHdpdGggZ3JvdXBzIHNvcnRlZCBiZXR3ZWVuIGVhY2ggb3RoZXI7XG4vLyBjb21iaW5lcyBzZWxlY3Rpb24gYWxnb3JpdGhtIHdpdGggYmluYXJ5IGRpdmlkZSAmIGNvbnF1ZXIgYXBwcm9hY2hcblxuZnVuY3Rpb24gbXVsdGlTZWxlY3QoYXJyLCBsZWZ0LCByaWdodCwgbiwgY29tcGFyZSkge1xuICAgIHZhciBzdGFjayA9IFtsZWZ0LCByaWdodF0sXG4gICAgICAgIG1pZDtcblxuICAgIHdoaWxlIChzdGFjay5sZW5ndGgpIHtcbiAgICAgICAgcmlnaHQgPSBzdGFjay5wb3AoKTtcbiAgICAgICAgbGVmdCA9IHN0YWNrLnBvcCgpO1xuXG4gICAgICAgIGlmIChyaWdodCAtIGxlZnQgPD0gbikgY29udGludWU7XG5cbiAgICAgICAgbWlkID0gbGVmdCArIE1hdGguY2VpbCgocmlnaHQgLSBsZWZ0KSAvIG4gLyAyKSAqIG47XG4gICAgICAgIHF1aWNrc2VsZWN0KGFyciwgbWlkLCBsZWZ0LCByaWdodCwgY29tcGFyZSk7XG5cbiAgICAgICAgc3RhY2sucHVzaChsZWZ0LCBtaWQsIG1pZCwgcmlnaHQpO1xuICAgIH1cbn1cbiIsInZhciBnZW9tZXRyeUFyZWEgPSByZXF1aXJlKCdnZW9qc29uLWFyZWEnKS5nZW9tZXRyeTtcblxuLyoqXG4gKiBUYWtlcyBhIHtAbGluayBHZW9KU09OfSBmZWF0dXJlIG9yIHtAbGluayBGZWF0dXJlQ29sbGVjdGlvbn0gb2YgYW55IHR5cGUgYW5kIHJldHVybnMgdGhlIGFyZWEgb2YgdGhhdCBmZWF0dXJlXG4gKiBpbiBzcXVhcmUgbWV0ZXJzLlxuICpcbiAqIEBtb2R1bGUgdHVyZi9hcmVhXG4gKiBAY2F0ZWdvcnkgbWVhc3VyZW1lbnRcbiAqIEBwYXJhbSB7R2VvSlNPTn0gaW5wdXQgYSB7QGxpbmsgRmVhdHVyZX0gb3Ige0BsaW5rIEZlYXR1cmVDb2xsZWN0aW9ufSBvZiBhbnkgdHlwZVxuICogQHJldHVybiB7TnVtYmVyfSBhcmVhIGluIHNxdWFyZSBtZXRlcnNcbiAqIEBleGFtcGxlXG4gKiB2YXIgcG9seWdvbnMgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gKiAgIFwiZmVhdHVyZXNcIjogW1xuICogICAgIHtcbiAqICAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgICAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgICAgICBcInR5cGVcIjogXCJQb2x5Z29uXCIsXG4gKiAgICAgICAgIFwiY29vcmRpbmF0ZXNcIjogW1tcbiAqICAgICAgICAgICBbLTY3LjAzMTAyMSwgMTAuNDU4MTAyXSxcbiAqICAgICAgICAgICBbLTY3LjAzMTAyMSwgMTAuNTMzNzJdLFxuICogICAgICAgICAgIFstNjYuOTI5Mzk3LCAxMC41MzM3Ml0sXG4gKiAgICAgICAgICAgWy02Ni45MjkzOTcsIDEwLjQ1ODEwMl0sXG4gKiAgICAgICAgICAgWy02Ny4wMzEwMjEsIDEwLjQ1ODEwMl1cbiAqICAgICAgICAgXV1cbiAqICAgICAgIH1cbiAqICAgICB9LCB7XG4gKiAgICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgICAgICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgICAgICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICAgICAgXCJ0eXBlXCI6IFwiUG9seWdvblwiLFxuICogICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFtbXG4gKiAgICAgICAgICAgWy02Ni45MTk3ODQsIDEwLjM5NzMyNV0sXG4gKiAgICAgICAgICAgWy02Ni45MTk3ODQsIDEwLjUxMzQ2N10sXG4gKiAgICAgICAgICAgWy02Ni44MDUxMTQsIDEwLjUxMzQ2N10sXG4gKiAgICAgICAgICAgWy02Ni44MDUxMTQsIDEwLjM5NzMyNV0sXG4gKiAgICAgICAgICAgWy02Ni45MTk3ODQsIDEwLjM5NzMyNV1cbiAqICAgICAgICAgXV1cbiAqICAgICAgIH1cbiAqICAgICB9XG4gKiAgIF1cbiAqIH07XG4gKlxuICogdmFyIGFyZWEgPSB0dXJmLmFyZWEocG9seWdvbnMpO1xuICpcbiAqIC8vPWFyZWFcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihfKSB7XG4gICAgaWYgKF8udHlwZSA9PT0gJ0ZlYXR1cmVDb2xsZWN0aW9uJykge1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgc3VtID0gMDsgaSA8IF8uZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChfLmZlYXR1cmVzW2ldLmdlb21ldHJ5KSB7XG4gICAgICAgICAgICAgICAgc3VtICs9IGdlb21ldHJ5QXJlYShfLmZlYXR1cmVzW2ldLmdlb21ldHJ5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3VtO1xuICAgIH0gZWxzZSBpZiAoXy50eXBlID09PSAnRmVhdHVyZScpIHtcbiAgICAgICAgcmV0dXJuIGdlb21ldHJ5QXJlYShfLmdlb21ldHJ5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZ2VvbWV0cnlBcmVhKF8pO1xuICAgIH1cbn07XG4iLCJ2YXIgZWFjaCA9IHJlcXVpcmUoJ3R1cmYtbWV0YScpLmNvb3JkRWFjaDtcbnZhciBwb2ludCA9IHJlcXVpcmUoJ3R1cmYtaGVscGVycycpLnBvaW50O1xuXG4vKipcbiAqIFRha2VzIG9uZSBvciBtb3JlIGZlYXR1cmVzIGFuZCBjYWxjdWxhdGVzIHRoZSBjZW50cm9pZCB1c2luZ1xuICogdGhlIG1lYW4gb2YgYWxsIHZlcnRpY2VzLlxuICogVGhpcyBsZXNzZW5zIHRoZSBlZmZlY3Qgb2Ygc21hbGwgaXNsYW5kcyBhbmQgYXJ0aWZhY3RzIHdoZW4gY2FsY3VsYXRpbmdcbiAqIHRoZSBjZW50cm9pZCBvZiBhIHNldCBvZiBwb2x5Z29ucy5cbiAqXG4gKiBAbmFtZSBjZW50cm9pZFxuICogQHBhcmFtIHsoRmVhdHVyZXxGZWF0dXJlQ29sbGVjdGlvbil9IGZlYXR1cmVzIGlucHV0IGZlYXR1cmVzXG4gKiBAcmV0dXJuIHtGZWF0dXJlPFBvaW50Pn0gdGhlIGNlbnRyb2lkIG9mIHRoZSBpbnB1dCBmZWF0dXJlc1xuICogQGV4YW1wbGVcbiAqIHZhciBwb2x5ID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9seWdvblwiLFxuICogICAgIFwiY29vcmRpbmF0ZXNcIjogW1tcbiAqICAgICAgIFsxMDUuODE4OTM5LDIxLjAwNDcxNF0sXG4gKiAgICAgICBbMTA1LjgxODkzOSwyMS4wNjE3NTRdLFxuICogICAgICAgWzEwNS44OTAwMDcsMjEuMDYxNzU0XSxcbiAqICAgICAgIFsxMDUuODkwMDA3LDIxLjAwNDcxNF0sXG4gKiAgICAgICBbMTA1LjgxODkzOSwyMS4wMDQ3MTRdXG4gKiAgICAgXV1cbiAqICAgfVxuICogfTtcbiAqXG4gKiB2YXIgY2VudHJvaWRQdCA9IHR1cmYuY2VudHJvaWQocG9seSk7XG4gKlxuICogdmFyIHJlc3VsdCA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAqICAgXCJmZWF0dXJlc1wiOiBbcG9seSwgY2VudHJvaWRQdF1cbiAqIH07XG4gKlxuICogLy89cmVzdWx0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZlYXR1cmVzKSB7XG4gICAgdmFyIHhTdW0gPSAwLCB5U3VtID0gMCwgbGVuID0gMDtcbiAgICBlYWNoKGZlYXR1cmVzLCBmdW5jdGlvbiAoY29vcmQpIHtcbiAgICAgICAgeFN1bSArPSBjb29yZFswXTtcbiAgICAgICAgeVN1bSArPSBjb29yZFsxXTtcbiAgICAgICAgbGVuKys7XG4gICAgfSwgdHJ1ZSk7XG4gICAgcmV0dXJuIHBvaW50KFt4U3VtIC8gbGVuLCB5U3VtIC8gbGVuXSk7XG59O1xuIiwiLyoqXG4gKiBUYWtlcyBvbmUgb3IgbW9yZSB7QGxpbmsgRmVhdHVyZXxGZWF0dXJlc30gYW5kIGNyZWF0ZXMgYSB7QGxpbmsgRmVhdHVyZUNvbGxlY3Rpb259XG4gKlxuICogQG1vZHVsZSB0dXJmL2ZlYXR1cmVjb2xsZWN0aW9uXG4gKiBAY2F0ZWdvcnkgaGVscGVyXG4gKiBAcGFyYW0ge0ZlYXR1cmV9IGZlYXR1cmVzIGlucHV0IEZlYXR1cmVzXG4gKiBAcmV0dXJucyB7RmVhdHVyZUNvbGxlY3Rpb259IGEgRmVhdHVyZUNvbGxlY3Rpb24gb2YgaW5wdXQgZmVhdHVyZXNcbiAqIEBleGFtcGxlXG4gKiB2YXIgZmVhdHVyZXMgPSBbXG4gKiAgdHVyZi5wb2ludChbLTc1LjM0MywgMzkuOTg0XSwge25hbWU6ICdMb2NhdGlvbiBBJ30pLFxuICogIHR1cmYucG9pbnQoWy03NS44MzMsIDM5LjI4NF0sIHtuYW1lOiAnTG9jYXRpb24gQid9KSxcbiAqICB0dXJmLnBvaW50KFstNzUuNTM0LCAzOS4xMjNdLCB7bmFtZTogJ0xvY2F0aW9uIEMnfSlcbiAqIF07XG4gKlxuICogdmFyIGZjID0gdHVyZi5mZWF0dXJlY29sbGVjdGlvbihmZWF0dXJlcyk7XG4gKlxuICogLy89ZmNcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihmZWF0dXJlcyl7XG4gIHJldHVybiB7XG4gICAgdHlwZTogXCJGZWF0dXJlQ29sbGVjdGlvblwiLFxuICAgIGZlYXR1cmVzOiBmZWF0dXJlc1xuICB9O1xufTtcbiIsIi8qKlxuICogV3JhcHMgYSBHZW9KU09OIHtAbGluayBHZW9tZXRyeX0gaW4gYSBHZW9KU09OIHtAbGluayBGZWF0dXJlfS5cbiAqXG4gKiBAbmFtZSBmZWF0dXJlXG4gKiBAcGFyYW0ge0dlb21ldHJ5fSBnZW9tZXRyeSBpbnB1dCBnZW9tZXRyeVxuICogQHBhcmFtIHtPYmplY3R9IHByb3BlcnRpZXMgcHJvcGVydGllc1xuICogQHJldHVybnMge0ZlYXR1cmVDb2xsZWN0aW9ufSBhIEZlYXR1cmVDb2xsZWN0aW9uIG9mIGlucHV0IGZlYXR1cmVzXG4gKiBAZXhhbXBsZVxuICogdmFyIGdlb21ldHJ5ID0ge1xuICogICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgICBcImNvb3JkaW5hdGVzXCI6IFtcbiAqICAgICAgICA2Ny41LFxuICogICAgICAgIDMyLjg0MjY3MzYzMTk1NDMxXG4gKiAgICAgIF1cbiAqICAgIH1cbiAqXG4gKiB2YXIgZmVhdHVyZSA9IHR1cmYuZmVhdHVyZShnZW9tZXRyeSk7XG4gKlxuICogLy89ZmVhdHVyZVxuICovXG5mdW5jdGlvbiBmZWF0dXJlKGdlb21ldHJ5LCBwcm9wZXJ0aWVzKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZTogJ0ZlYXR1cmUnLFxuICAgICAgICBwcm9wZXJ0aWVzOiBwcm9wZXJ0aWVzIHx8IHt9LFxuICAgICAgICBnZW9tZXRyeTogZ2VvbWV0cnlcbiAgICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cy5mZWF0dXJlID0gZmVhdHVyZTtcblxuLyoqXG4gKiBUYWtlcyBjb29yZGluYXRlcyBhbmQgcHJvcGVydGllcyAob3B0aW9uYWwpIGFuZCByZXR1cm5zIGEgbmV3IHtAbGluayBQb2ludH0gZmVhdHVyZS5cbiAqXG4gKiBAbmFtZSBwb2ludFxuICogQHBhcmFtIHtudW1iZXJbXX0gY29vcmRpbmF0ZXMgbG9uZ2l0dWRlLCBsYXRpdHVkZSBwb3NpdGlvbiAoZWFjaCBpbiBkZWNpbWFsIGRlZ3JlZXMpXG4gKiBAcGFyYW0ge09iamVjdD19IHByb3BlcnRpZXMgYW4gT2JqZWN0IHRoYXQgaXMgdXNlZCBhcyB0aGUge0BsaW5rIEZlYXR1cmV9J3NcbiAqIHByb3BlcnRpZXNcbiAqIEByZXR1cm5zIHtGZWF0dXJlPFBvaW50Pn0gYSBQb2ludCBmZWF0dXJlXG4gKiBAZXhhbXBsZVxuICogdmFyIHB0MSA9IHR1cmYucG9pbnQoWy03NS4zNDMsIDM5Ljk4NF0pO1xuICpcbiAqIC8vPXB0MVxuICovXG5tb2R1bGUuZXhwb3J0cy5wb2ludCA9IGZ1bmN0aW9uIChjb29yZGluYXRlcywgcHJvcGVydGllcykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShjb29yZGluYXRlcykpIHRocm93IG5ldyBFcnJvcignQ29vcmRpbmF0ZXMgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgIGlmIChjb29yZGluYXRlcy5sZW5ndGggPCAyKSB0aHJvdyBuZXcgRXJyb3IoJ0Nvb3JkaW5hdGVzIG11c3QgYmUgYXQgbGVhc3QgMiBudW1iZXJzIGxvbmcnKTtcbiAgICByZXR1cm4gZmVhdHVyZSh7XG4gICAgICAgIHR5cGU6ICdQb2ludCcsXG4gICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlcy5zbGljZSgpXG4gICAgfSwgcHJvcGVydGllcyk7XG59O1xuXG4vKipcbiAqIFRha2VzIGFuIGFycmF5IG9mIExpbmVhclJpbmdzIGFuZCBvcHRpb25hbGx5IGFuIHtAbGluayBPYmplY3R9IHdpdGggcHJvcGVydGllcyBhbmQgcmV0dXJucyBhIHtAbGluayBQb2x5Z29ufSBmZWF0dXJlLlxuICpcbiAqIEBuYW1lIHBvbHlnb25cbiAqIEBwYXJhbSB7QXJyYXk8QXJyYXk8QXJyYXk8bnVtYmVyPj4+fSBjb29yZGluYXRlcyBhbiBhcnJheSBvZiBMaW5lYXJSaW5nc1xuICogQHBhcmFtIHtPYmplY3Q9fSBwcm9wZXJ0aWVzIGEgcHJvcGVydGllcyBvYmplY3RcbiAqIEByZXR1cm5zIHtGZWF0dXJlPFBvbHlnb24+fSBhIFBvbHlnb24gZmVhdHVyZVxuICogQHRocm93cyB7RXJyb3J9IHRocm93IGFuIGVycm9yIGlmIGEgTGluZWFyUmluZyBvZiB0aGUgcG9seWdvbiBoYXMgdG9vIGZldyBwb3NpdGlvbnNcbiAqIG9yIGlmIGEgTGluZWFyUmluZyBvZiB0aGUgUG9seWdvbiBkb2VzIG5vdCBoYXZlIG1hdGNoaW5nIFBvc2l0aW9ucyBhdCB0aGVcbiAqIGJlZ2lubmluZyAmIGVuZC5cbiAqIEBleGFtcGxlXG4gKiB2YXIgcG9seWdvbiA9IHR1cmYucG9seWdvbihbW1xuICogIFstMi4yNzU1NDMsIDUzLjQ2NDU0N10sXG4gKiAgWy0yLjI3NTU0MywgNTMuNDg5MjcxXSxcbiAqICBbLTIuMjE1MTE4LCA1My40ODkyNzFdLFxuICogIFstMi4yMTUxMTgsIDUzLjQ2NDU0N10sXG4gKiAgWy0yLjI3NTU0MywgNTMuNDY0NTQ3XVxuICogXV0sIHsgbmFtZTogJ3BvbHkxJywgcG9wdWxhdGlvbjogNDAwfSk7XG4gKlxuICogLy89cG9seWdvblxuICovXG5tb2R1bGUuZXhwb3J0cy5wb2x5Z29uID0gZnVuY3Rpb24gKGNvb3JkaW5hdGVzLCBwcm9wZXJ0aWVzKSB7XG5cbiAgICBpZiAoIWNvb3JkaW5hdGVzKSB0aHJvdyBuZXcgRXJyb3IoJ05vIGNvb3JkaW5hdGVzIHBhc3NlZCcpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb29yZGluYXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmluZyA9IGNvb3JkaW5hdGVzW2ldO1xuICAgICAgICBpZiAocmluZy5sZW5ndGggPCA0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0VhY2ggTGluZWFyUmluZyBvZiBhIFBvbHlnb24gbXVzdCBoYXZlIDQgb3IgbW9yZSBQb3NpdGlvbnMuJyk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCByaW5nW3JpbmcubGVuZ3RoIC0gMV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGlmIChyaW5nW3JpbmcubGVuZ3RoIC0gMV1bal0gIT09IHJpbmdbMF1bal0pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpcnN0IGFuZCBsYXN0IFBvc2l0aW9uIGFyZSBub3QgZXF1aXZhbGVudC4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmZWF0dXJlKHtcbiAgICAgICAgdHlwZTogJ1BvbHlnb24nLFxuICAgICAgICBjb29yZGluYXRlczogY29vcmRpbmF0ZXNcbiAgICB9LCBwcm9wZXJ0aWVzKTtcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhIHtAbGluayBMaW5lU3RyaW5nfSBiYXNlZCBvbiBhXG4gKiBjb29yZGluYXRlIGFycmF5LiBQcm9wZXJ0aWVzIGNhbiBiZSBhZGRlZCBvcHRpb25hbGx5LlxuICpcbiAqIEBuYW1lIGxpbmVTdHJpbmdcbiAqIEBwYXJhbSB7QXJyYXk8QXJyYXk8bnVtYmVyPj59IGNvb3JkaW5hdGVzIGFuIGFycmF5IG9mIFBvc2l0aW9uc1xuICogQHBhcmFtIHtPYmplY3Q9fSBwcm9wZXJ0aWVzIGFuIE9iamVjdCBvZiBrZXktdmFsdWUgcGFpcnMgdG8gYWRkIGFzIHByb3BlcnRpZXNcbiAqIEByZXR1cm5zIHtGZWF0dXJlPExpbmVTdHJpbmc+fSBhIExpbmVTdHJpbmcgZmVhdHVyZVxuICogQHRocm93cyB7RXJyb3J9IGlmIG5vIGNvb3JkaW5hdGVzIGFyZSBwYXNzZWRcbiAqIEBleGFtcGxlXG4gKiB2YXIgbGluZXN0cmluZzEgPSB0dXJmLmxpbmVTdHJpbmcoW1xuICpcdFstMjEuOTY0NDE2LCA2NC4xNDgyMDNdLFxuICpcdFstMjEuOTU2MTc2LCA2NC4xNDEzMTZdLFxuICpcdFstMjEuOTM5MDEsIDY0LjEzNTkyNF0sXG4gKlx0Wy0yMS45MjczMzcsIDY0LjEzNjY3M11cbiAqIF0pO1xuICogdmFyIGxpbmVzdHJpbmcyID0gdHVyZi5saW5lU3RyaW5nKFtcbiAqXHRbLTIxLjkyOTA1NCwgNjQuMTI3OTg1XSxcbiAqXHRbLTIxLjkxMjkxOCwgNjQuMTM0NzI2XSxcbiAqXHRbLTIxLjkxNjAwNywgNjQuMTQxMDE2XSxcbiAqIFx0Wy0yMS45MzAwODQsIDY0LjE0NDQ2XVxuICogXSwge25hbWU6ICdsaW5lIDEnLCBkaXN0YW5jZTogMTQ1fSk7XG4gKlxuICogLy89bGluZXN0cmluZzFcbiAqXG4gKiAvLz1saW5lc3RyaW5nMlxuICovXG5tb2R1bGUuZXhwb3J0cy5saW5lU3RyaW5nID0gZnVuY3Rpb24gKGNvb3JkaW5hdGVzLCBwcm9wZXJ0aWVzKSB7XG4gICAgaWYgKCFjb29yZGluYXRlcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGNvb3JkaW5hdGVzIHBhc3NlZCcpO1xuICAgIH1cbiAgICByZXR1cm4gZmVhdHVyZSh7XG4gICAgICAgIHR5cGU6ICdMaW5lU3RyaW5nJyxcbiAgICAgICAgY29vcmRpbmF0ZXM6IGNvb3JkaW5hdGVzXG4gICAgfSwgcHJvcGVydGllcyk7XG59O1xuXG4vKipcbiAqIFRha2VzIG9uZSBvciBtb3JlIHtAbGluayBGZWF0dXJlfEZlYXR1cmVzfSBhbmQgY3JlYXRlcyBhIHtAbGluayBGZWF0dXJlQ29sbGVjdGlvbn0uXG4gKlxuICogQG5hbWUgZmVhdHVyZUNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7RmVhdHVyZVtdfSBmZWF0dXJlcyBpbnB1dCBmZWF0dXJlc1xuICogQHJldHVybnMge0ZlYXR1cmVDb2xsZWN0aW9ufSBhIEZlYXR1cmVDb2xsZWN0aW9uIG9mIGlucHV0IGZlYXR1cmVzXG4gKiBAZXhhbXBsZVxuICogdmFyIGZlYXR1cmVzID0gW1xuICogIHR1cmYucG9pbnQoWy03NS4zNDMsIDM5Ljk4NF0sIHtuYW1lOiAnTG9jYXRpb24gQSd9KSxcbiAqICB0dXJmLnBvaW50KFstNzUuODMzLCAzOS4yODRdLCB7bmFtZTogJ0xvY2F0aW9uIEInfSksXG4gKiAgdHVyZi5wb2ludChbLTc1LjUzNCwgMzkuMTIzXSwge25hbWU6ICdMb2NhdGlvbiBDJ30pXG4gKiBdO1xuICpcbiAqIHZhciBmYyA9IHR1cmYuZmVhdHVyZUNvbGxlY3Rpb24oZmVhdHVyZXMpO1xuICpcbiAqIC8vPWZjXG4gKi9cbm1vZHVsZS5leHBvcnRzLmZlYXR1cmVDb2xsZWN0aW9uID0gZnVuY3Rpb24gKGZlYXR1cmVzKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZTogJ0ZlYXR1cmVDb2xsZWN0aW9uJyxcbiAgICAgICAgZmVhdHVyZXM6IGZlYXR1cmVzXG4gICAgfTtcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhIHtAbGluayBGZWF0dXJlPE11bHRpTGluZVN0cmluZz59IGJhc2VkIG9uIGFcbiAqIGNvb3JkaW5hdGUgYXJyYXkuIFByb3BlcnRpZXMgY2FuIGJlIGFkZGVkIG9wdGlvbmFsbHkuXG4gKlxuICogQG5hbWUgbXVsdGlMaW5lU3RyaW5nXG4gKiBAcGFyYW0ge0FycmF5PEFycmF5PEFycmF5PG51bWJlcj4+Pn0gY29vcmRpbmF0ZXMgYW4gYXJyYXkgb2YgTGluZVN0cmluZ3NcbiAqIEBwYXJhbSB7T2JqZWN0PX0gcHJvcGVydGllcyBhbiBPYmplY3Qgb2Yga2V5LXZhbHVlIHBhaXJzIHRvIGFkZCBhcyBwcm9wZXJ0aWVzXG4gKiBAcmV0dXJucyB7RmVhdHVyZTxNdWx0aUxpbmVTdHJpbmc+fSBhIE11bHRpTGluZVN0cmluZyBmZWF0dXJlXG4gKiBAdGhyb3dzIHtFcnJvcn0gaWYgbm8gY29vcmRpbmF0ZXMgYXJlIHBhc3NlZFxuICogQGV4YW1wbGVcbiAqIHZhciBtdWx0aUxpbmUgPSB0dXJmLm11bHRpTGluZVN0cmluZyhbW1swLDBdLFsxMCwxMF1dXSk7XG4gKlxuICogLy89bXVsdGlMaW5lXG4gKlxuICovXG5tb2R1bGUuZXhwb3J0cy5tdWx0aUxpbmVTdHJpbmcgPSBmdW5jdGlvbiAoY29vcmRpbmF0ZXMsIHByb3BlcnRpZXMpIHtcbiAgICBpZiAoIWNvb3JkaW5hdGVzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gY29vcmRpbmF0ZXMgcGFzc2VkJyk7XG4gICAgfVxuICAgIHJldHVybiBmZWF0dXJlKHtcbiAgICAgICAgdHlwZTogJ011bHRpTGluZVN0cmluZycsXG4gICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlc1xuICAgIH0sIHByb3BlcnRpZXMpO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGEge0BsaW5rIEZlYXR1cmU8TXVsdGlQb2ludD59IGJhc2VkIG9uIGFcbiAqIGNvb3JkaW5hdGUgYXJyYXkuIFByb3BlcnRpZXMgY2FuIGJlIGFkZGVkIG9wdGlvbmFsbHkuXG4gKlxuICogQG5hbWUgbXVsdGlQb2ludFxuICogQHBhcmFtIHtBcnJheTxBcnJheTxudW1iZXI+Pn0gY29vcmRpbmF0ZXMgYW4gYXJyYXkgb2YgUG9zaXRpb25zXG4gKiBAcGFyYW0ge09iamVjdD19IHByb3BlcnRpZXMgYW4gT2JqZWN0IG9mIGtleS12YWx1ZSBwYWlycyB0byBhZGQgYXMgcHJvcGVydGllc1xuICogQHJldHVybnMge0ZlYXR1cmU8TXVsdGlQb2ludD59IGEgTXVsdGlQb2ludCBmZWF0dXJlXG4gKiBAdGhyb3dzIHtFcnJvcn0gaWYgbm8gY29vcmRpbmF0ZXMgYXJlIHBhc3NlZFxuICogQGV4YW1wbGVcbiAqIHZhciBtdWx0aVB0ID0gdHVyZi5tdWx0aVBvaW50KFtbMCwwXSxbMTAsMTBdXSk7XG4gKlxuICogLy89bXVsdGlQdFxuICpcbiAqL1xubW9kdWxlLmV4cG9ydHMubXVsdGlQb2ludCA9IGZ1bmN0aW9uIChjb29yZGluYXRlcywgcHJvcGVydGllcykge1xuICAgIGlmICghY29vcmRpbmF0ZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBjb29yZGluYXRlcyBwYXNzZWQnKTtcbiAgICB9XG4gICAgcmV0dXJuIGZlYXR1cmUoe1xuICAgICAgICB0eXBlOiAnTXVsdGlQb2ludCcsXG4gICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlc1xuICAgIH0sIHByb3BlcnRpZXMpO1xufTtcblxuXG4vKipcbiAqIENyZWF0ZXMgYSB7QGxpbmsgRmVhdHVyZTxNdWx0aVBvbHlnb24+fSBiYXNlZCBvbiBhXG4gKiBjb29yZGluYXRlIGFycmF5LiBQcm9wZXJ0aWVzIGNhbiBiZSBhZGRlZCBvcHRpb25hbGx5LlxuICpcbiAqIEBuYW1lIG11bHRpUG9seWdvblxuICogQHBhcmFtIHtBcnJheTxBcnJheTxBcnJheTxBcnJheTxudW1iZXI+Pj4+fSBjb29yZGluYXRlcyBhbiBhcnJheSBvZiBQb2x5Z29uc1xuICogQHBhcmFtIHtPYmplY3Q9fSBwcm9wZXJ0aWVzIGFuIE9iamVjdCBvZiBrZXktdmFsdWUgcGFpcnMgdG8gYWRkIGFzIHByb3BlcnRpZXNcbiAqIEByZXR1cm5zIHtGZWF0dXJlPE11bHRpUG9seWdvbj59IGEgbXVsdGlwb2x5Z29uIGZlYXR1cmVcbiAqIEB0aHJvd3Mge0Vycm9yfSBpZiBubyBjb29yZGluYXRlcyBhcmUgcGFzc2VkXG4gKiBAZXhhbXBsZVxuICogdmFyIG11bHRpUG9seSA9IHR1cmYubXVsdGlQb2x5Z29uKFtbW1swLDBdLFswLDEwXSxbMTAsMTBdLFsxMCwwXSxbMCwwXV1dKTtcbiAqXG4gKiAvLz1tdWx0aVBvbHlcbiAqXG4gKi9cbm1vZHVsZS5leHBvcnRzLm11bHRpUG9seWdvbiA9IGZ1bmN0aW9uIChjb29yZGluYXRlcywgcHJvcGVydGllcykge1xuICAgIGlmICghY29vcmRpbmF0ZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBjb29yZGluYXRlcyBwYXNzZWQnKTtcbiAgICB9XG4gICAgcmV0dXJuIGZlYXR1cmUoe1xuICAgICAgICB0eXBlOiAnTXVsdGlQb2x5Z29uJyxcbiAgICAgICAgY29vcmRpbmF0ZXM6IGNvb3JkaW5hdGVzXG4gICAgfSwgcHJvcGVydGllcyk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSB7QGxpbmsgRmVhdHVyZTxHZW9tZXRyeUNvbGxlY3Rpb24+fSBiYXNlZCBvbiBhXG4gKiBjb29yZGluYXRlIGFycmF5LiBQcm9wZXJ0aWVzIGNhbiBiZSBhZGRlZCBvcHRpb25hbGx5LlxuICpcbiAqIEBuYW1lIGdlb21ldHJ5Q29sbGVjdGlvblxuICogQHBhcmFtIHtBcnJheTx7R2VvbWV0cnl9Pn0gZ2VvbWV0cmllcyBhbiBhcnJheSBvZiBHZW9KU09OIEdlb21ldHJpZXNcbiAqIEBwYXJhbSB7T2JqZWN0PX0gcHJvcGVydGllcyBhbiBPYmplY3Qgb2Yga2V5LXZhbHVlIHBhaXJzIHRvIGFkZCBhcyBwcm9wZXJ0aWVzXG4gKiBAcmV0dXJucyB7RmVhdHVyZTxHZW9tZXRyeUNvbGxlY3Rpb24+fSBhIGdlb21ldHJ5Y29sbGVjdGlvbiBmZWF0dXJlXG4gKiBAZXhhbXBsZVxuICogdmFyIHB0ID0ge1xuICogICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgICBcImNvb3JkaW5hdGVzXCI6IFsxMDAsIDBdXG4gKiAgICAgfTtcbiAqIHZhciBsaW5lID0ge1xuICogICAgIFwidHlwZVwiOiBcIkxpbmVTdHJpbmdcIixcbiAqICAgICBcImNvb3JkaW5hdGVzXCI6IFsgWzEwMSwgMF0sIFsxMDIsIDFdIF1cbiAqICAgfTtcbiAqIHZhciBjb2xsZWN0aW9uID0gdHVyZi5nZW9tZXRyeWNvbGxlY3Rpb24oW1swLDBdLFsxMCwxMF1dKTtcbiAqXG4gKiAvLz1jb2xsZWN0aW9uXG4gKi9cbm1vZHVsZS5leHBvcnRzLmdlb21ldHJ5Q29sbGVjdGlvbiA9IGZ1bmN0aW9uIChnZW9tZXRyaWVzLCBwcm9wZXJ0aWVzKSB7XG4gICAgcmV0dXJuIGZlYXR1cmUoe1xuICAgICAgICB0eXBlOiAnR2VvbWV0cnlDb2xsZWN0aW9uJyxcbiAgICAgICAgZ2VvbWV0cmllczogZ2VvbWV0cmllc1xuICAgIH0sIHByb3BlcnRpZXMpO1xufTtcblxudmFyIGZhY3RvcnMgPSB7XG4gICAgbWlsZXM6IDM5NjAsXG4gICAgbmF1dGljYWxtaWxlczogMzQ0MS4xNDUsXG4gICAgZGVncmVlczogNTcuMjk1Nzc5NSxcbiAgICByYWRpYW5zOiAxLFxuICAgIGluY2hlczogMjUwOTA1NjAwLFxuICAgIHlhcmRzOiA2OTY5NjAwLFxuICAgIG1ldGVyczogNjM3MzAwMCxcbiAgICBtZXRyZXM6IDYzNzMwMDAsXG4gICAga2lsb21ldGVyczogNjM3MyxcbiAgICBraWxvbWV0cmVzOiA2MzczXG59O1xuXG4vKlxuICogQ29udmVydCBhIGRpc3RhbmNlIG1lYXN1cmVtZW50IGZyb20gcmFkaWFucyB0byBhIG1vcmUgZnJpZW5kbHkgdW5pdC5cbiAqXG4gKiBAbmFtZSByYWRpYW5zVG9EaXN0YW5jZVxuICogQHBhcmFtIHtudW1iZXJ9IGRpc3RhbmNlIGluIHJhZGlhbnMgYWNyb3NzIHRoZSBzcGhlcmVcbiAqIEBwYXJhbSB7c3RyaW5nPWtpbG9tZXRlcnN9IHVuaXRzOiBvbmUgb2YgbWlsZXMsIG5hdXRpY2FsbWlsZXMsIGRlZ3JlZXMsIHJhZGlhbnMsXG4gKiBpbmNoZXMsIHlhcmRzLCBtZXRyZXMsIG1ldGVycywga2lsb21ldHJlcywga2lsb21ldGVycy5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IGRpc3RhbmNlXG4gKi9cbm1vZHVsZS5leHBvcnRzLnJhZGlhbnNUb0Rpc3RhbmNlID0gZnVuY3Rpb24gKHJhZGlhbnMsIHVuaXRzKSB7XG4gICAgdmFyIGZhY3RvciA9IGZhY3RvcnNbdW5pdHMgfHwgJ2tpbG9tZXRlcnMnXTtcbiAgICBpZiAoZmFjdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHVuaXQnKTtcbiAgICB9XG4gICAgcmV0dXJuIHJhZGlhbnMgKiBmYWN0b3I7XG59O1xuXG4vKlxuICogQ29udmVydCBhIGRpc3RhbmNlIG1lYXN1cmVtZW50IGZyb20gYSByZWFsLXdvcmxkIHVuaXQgaW50byByYWRpYW5zXG4gKlxuICogQG5hbWUgZGlzdGFuY2VUb1JhZGlhbnNcbiAqIEBwYXJhbSB7bnVtYmVyfSBkaXN0YW5jZSBpbiByZWFsIHVuaXRzXG4gKiBAcGFyYW0ge3N0cmluZz1raWxvbWV0ZXJzfSB1bml0czogb25lIG9mIG1pbGVzLCBuYXV0aWNhbG1pbGVzLCBkZWdyZWVzLCByYWRpYW5zLFxuICogaW5jaGVzLCB5YXJkcywgbWV0cmVzLCBtZXRlcnMsIGtpbG9tZXRyZXMsIGtpbG9tZXRlcnMuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSByYWRpYW5zXG4gKi9cbm1vZHVsZS5leHBvcnRzLmRpc3RhbmNlVG9SYWRpYW5zID0gZnVuY3Rpb24gKGRpc3RhbmNlLCB1bml0cykge1xuICAgIHZhciBmYWN0b3IgPSBmYWN0b3JzW3VuaXRzIHx8ICdraWxvbWV0ZXJzJ107XG4gICAgaWYgKGZhY3RvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB1bml0Jyk7XG4gICAgfVxuICAgIHJldHVybiBkaXN0YW5jZSAvIGZhY3Rvcjtcbn07XG5cbi8qXG4gKiBDb252ZXJ0IGEgZGlzdGFuY2UgbWVhc3VyZW1lbnQgZnJvbSBhIHJlYWwtd29ybGQgdW5pdCBpbnRvIGRlZ3JlZXNcbiAqXG4gKiBAbmFtZSBkaXN0YW5jZVRvUmFkaWFuc1xuICogQHBhcmFtIHtudW1iZXJ9IGRpc3RhbmNlIGluIHJlYWwgdW5pdHNcbiAqIEBwYXJhbSB7c3RyaW5nPWtpbG9tZXRlcnN9IHVuaXRzOiBvbmUgb2YgbWlsZXMsIG5hdXRpY2FsbWlsZXMsIGRlZ3JlZXMsIHJhZGlhbnMsXG4gKiBpbmNoZXMsIHlhcmRzLCBtZXRyZXMsIG1ldGVycywga2lsb21ldHJlcywga2lsb21ldGVycy5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IGRlZ3JlZXNcbiAqL1xubW9kdWxlLmV4cG9ydHMuZGlzdGFuY2VUb0RlZ3JlZXMgPSBmdW5jdGlvbiAoZGlzdGFuY2UsIHVuaXRzKSB7XG4gICAgdmFyIGZhY3RvciA9IGZhY3RvcnNbdW5pdHMgfHwgJ2tpbG9tZXRlcnMnXTtcbiAgICBpZiAoZmFjdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHVuaXQnKTtcbiAgICB9XG4gICAgcmV0dXJuIChkaXN0YW5jZSAvIGZhY3RvcikgKiA1Ny4yOTU4O1xufTtcbiIsIi8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRXZlbiVFMiU4MCU5M29kZF9ydWxlXG4vLyBtb2RpZmllZCBmcm9tOiBodHRwczovL2dpdGh1Yi5jb20vc3Vic3RhY2svcG9pbnQtaW4tcG9seWdvbi9ibG9iL21hc3Rlci9pbmRleC5qc1xuLy8gd2hpY2ggd2FzIG1vZGlmaWVkIGZyb20gaHR0cDovL3d3dy5lY3NlLnJwaS5lZHUvSG9tZXBhZ2VzL3dyZi9SZXNlYXJjaC9TaG9ydF9Ob3Rlcy9wbnBvbHkuaHRtbFxuXG4vKipcbiAqIFRha2VzIGEge0BsaW5rIFBvaW50fSBmZWF0dXJlIGFuZCBhIHtAbGluayBQb2x5Z29ufSBmZWF0dXJlIGFuZCBkZXRlcm1pbmVzIGlmIHRoZSBQb2ludCByZXNpZGVzIGluc2lkZSB0aGUgUG9seWdvbi4gVGhlIFBvbHlnb24gY2FuXG4gKiBiZSBjb252ZXggb3IgY29uY2F2ZS4gVGhlIGZ1bmN0aW9uIGFjY2VwdHMgYW55IHZhbGlkIFBvbHlnb24gb3Ige0BsaW5rIE11bHRpUG9seWdvbn1cbiAqIGFuZCBhY2NvdW50cyBmb3IgaG9sZXMuXG4gKlxuICogQG1vZHVsZSB0dXJmL2luc2lkZVxuICogQGNhdGVnb3J5IGpvaW5zXG4gKiBAcGFyYW0ge1BvaW50fSBwb2ludCBhIFBvaW50IGZlYXR1cmVcbiAqIEBwYXJhbSB7UG9seWdvbn0gcG9seWdvbiBhIFBvbHlnb24gZmVhdHVyZVxuICogQHJldHVybiB7Qm9vbGVhbn0gYHRydWVgIGlmIHRoZSBQb2ludCBpcyBpbnNpZGUgdGhlIFBvbHlnb247IGBmYWxzZWAgaWYgdGhlIFBvaW50IGlzIG5vdCBpbnNpZGUgdGhlIFBvbHlnb25cbiAqIEBleGFtcGxlXG4gKiB2YXIgcHQxID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgIFwicHJvcGVydGllc1wiOiB7XG4gKiAgICAgXCJtYXJrZXItY29sb3JcIjogXCIjZjAwXCJcbiAqICAgfSxcbiAqICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICBcImNvb3JkaW5hdGVzXCI6IFstMTExLjQ2NzI4NSwgNDAuNzU3NjZdXG4gKiAgIH1cbiAqIH07XG4gKiB2YXIgcHQyID0ge1xuICogICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgIFwicHJvcGVydGllc1wiOiB7XG4gKiAgICAgXCJtYXJrZXItY29sb3JcIjogXCIjMGYwXCJcbiAqICAgfSxcbiAqICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICBcImNvb3JkaW5hdGVzXCI6IFstMTExLjg3Mzc3OSwgNDAuNjQ3MzAzXVxuICogICB9XG4gKiB9O1xuICogdmFyIHBvbHkgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICBcInR5cGVcIjogXCJQb2x5Z29uXCIsXG4gKiAgICAgXCJjb29yZGluYXRlc1wiOiBbW1xuICogICAgICAgWy0xMTIuMDc0Mjc5LCA0MC41MjIxNV0sXG4gKiAgICAgICBbLTExMi4wNzQyNzksIDQwLjg1MzI5M10sXG4gKiAgICAgICBbLTExMS42MTAxMDcsIDQwLjg1MzI5M10sXG4gKiAgICAgICBbLTExMS42MTAxMDcsIDQwLjUyMjE1XSxcbiAqICAgICAgIFstMTEyLjA3NDI3OSwgNDAuNTIyMTVdXG4gKiAgICAgXV1cbiAqICAgfVxuICogfTtcbiAqXG4gKiB2YXIgZmVhdHVyZXMgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gKiAgIFwiZmVhdHVyZXNcIjogW3B0MSwgcHQyLCBwb2x5XVxuICogfTtcbiAqXG4gKiAvLz1mZWF0dXJlc1xuICpcbiAqIHZhciBpc0luc2lkZTEgPSB0dXJmLmluc2lkZShwdDEsIHBvbHkpO1xuICogLy89aXNJbnNpZGUxXG4gKlxuICogdmFyIGlzSW5zaWRlMiA9IHR1cmYuaW5zaWRlKHB0MiwgcG9seSk7XG4gKiAvLz1pc0luc2lkZTJcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwb2ludCwgcG9seWdvbikge1xuICB2YXIgcG9seXMgPSBwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICB2YXIgcHQgPSBbcG9pbnQuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0sIHBvaW50Lmdlb21ldHJ5LmNvb3JkaW5hdGVzWzFdXTtcbiAgLy8gbm9ybWFsaXplIHRvIG11bHRpcG9seWdvblxuICBpZihwb2x5Z29uLmdlb21ldHJ5LnR5cGUgPT09ICdQb2x5Z29uJykgcG9seXMgPSBbcG9seXNdO1xuXG4gIHZhciBpbnNpZGVQb2x5ID0gZmFsc2U7XG4gIHZhciBpID0gMDtcbiAgd2hpbGUgKGkgPCBwb2x5cy5sZW5ndGggJiYgIWluc2lkZVBvbHkpIHtcbiAgICAvLyBjaGVjayBpZiBpdCBpcyBpbiB0aGUgb3V0ZXIgcmluZyBmaXJzdFxuICAgIGlmKGluUmluZyhwdCwgcG9seXNbaV1bMF0pKSB7XG4gICAgICB2YXIgaW5Ib2xlID0gZmFsc2U7XG4gICAgICB2YXIgayA9IDE7XG4gICAgICAvLyBjaGVjayBmb3IgdGhlIHBvaW50IGluIGFueSBvZiB0aGUgaG9sZXNcbiAgICAgIHdoaWxlKGsgPCBwb2x5c1tpXS5sZW5ndGggJiYgIWluSG9sZSkge1xuICAgICAgICBpZihpblJpbmcocHQsIHBvbHlzW2ldW2tdKSkge1xuICAgICAgICAgIGluSG9sZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaysrO1xuICAgICAgfVxuICAgICAgaWYoIWluSG9sZSkgaW5zaWRlUG9seSA9IHRydWU7XG4gICAgfVxuICAgIGkrKztcbiAgfVxuICByZXR1cm4gaW5zaWRlUG9seTtcbn1cblxuLy8gcHQgaXMgW3gseV0gYW5kIHJpbmcgaXMgW1t4LHldLCBbeCx5XSwuLl1cbmZ1bmN0aW9uIGluUmluZyAocHQsIHJpbmcpIHtcbiAgdmFyIGlzSW5zaWRlID0gZmFsc2U7XG4gIGZvciAodmFyIGkgPSAwLCBqID0gcmluZy5sZW5ndGggLSAxOyBpIDwgcmluZy5sZW5ndGg7IGogPSBpKyspIHtcbiAgICB2YXIgeGkgPSByaW5nW2ldWzBdLCB5aSA9IHJpbmdbaV1bMV07XG4gICAgdmFyIHhqID0gcmluZ1tqXVswXSwgeWogPSByaW5nW2pdWzFdO1xuICAgIFxuICAgIHZhciBpbnRlcnNlY3QgPSAoKHlpID4gcHRbMV0pICE9ICh5aiA+IHB0WzFdKSlcbiAgICAgICAgJiYgKHB0WzBdIDwgKHhqIC0geGkpICogKHB0WzFdIC0geWkpIC8gKHlqIC0geWkpICsgeGkpO1xuICAgIGlmIChpbnRlcnNlY3QpIGlzSW5zaWRlID0gIWlzSW5zaWRlO1xuICB9XG4gIHJldHVybiBpc0luc2lkZTtcbn1cblxuIiwiLyoqXG4gKiBJdGVyYXRlIG92ZXIgY29vcmRpbmF0ZXMgaW4gYW55IEdlb0pTT04gb2JqZWN0LCBzaW1pbGFyIHRvXG4gKiBBcnJheS5mb3JFYWNoLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBsYXllciBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGEgbWV0aG9kIHRoYXQgdGFrZXMgKHZhbHVlKVxuICogQHBhcmFtIHtib29sZWFuPX0gZXhjbHVkZVdyYXBDb29yZCB3aGV0aGVyIG9yIG5vdCB0byBpbmNsdWRlXG4gKiB0aGUgZmluYWwgY29vcmRpbmF0ZSBvZiBMaW5lYXJSaW5ncyB0aGF0IHdyYXBzIHRoZSByaW5nIGluIGl0cyBpdGVyYXRpb24uXG4gKiBAZXhhbXBsZVxuICogdmFyIHBvaW50ID0geyB0eXBlOiAnUG9pbnQnLCBjb29yZGluYXRlczogWzAsIDBdIH07XG4gKiBjb29yZEVhY2gocG9pbnQsIGZ1bmN0aW9uKGNvb3Jkcykge1xuICogICAvLyBjb29yZHMgaXMgZXF1YWwgdG8gWzAsIDBdXG4gKiB9KTtcbiAqL1xuZnVuY3Rpb24gY29vcmRFYWNoKGxheWVyLCBjYWxsYmFjaywgZXhjbHVkZVdyYXBDb29yZCkge1xuICAgIHZhciBpLCBqLCBrLCBnLCBsLCBnZW9tZXRyeSwgc3RvcEcsIGNvb3JkcyxcbiAgICAgICAgZ2VvbWV0cnlNYXliZUNvbGxlY3Rpb24sXG4gICAgICAgIHdyYXBTaHJpbmsgPSAwLFxuICAgICAgICBpc0dlb21ldHJ5Q29sbGVjdGlvbixcbiAgICAgICAgaXNGZWF0dXJlQ29sbGVjdGlvbiA9IGxheWVyLnR5cGUgPT09ICdGZWF0dXJlQ29sbGVjdGlvbicsXG4gICAgICAgIGlzRmVhdHVyZSA9IGxheWVyLnR5cGUgPT09ICdGZWF0dXJlJyxcbiAgICAgICAgc3RvcCA9IGlzRmVhdHVyZUNvbGxlY3Rpb24gPyBsYXllci5mZWF0dXJlcy5sZW5ndGggOiAxO1xuXG4gIC8vIFRoaXMgbG9naWMgbWF5IGxvb2sgYSBsaXR0bGUgd2VpcmQuIFRoZSByZWFzb24gd2h5IGl0IGlzIHRoYXQgd2F5XG4gIC8vIGlzIGJlY2F1c2UgaXQncyB0cnlpbmcgdG8gYmUgZmFzdC4gR2VvSlNPTiBzdXBwb3J0cyBtdWx0aXBsZSBraW5kc1xuICAvLyBvZiBvYmplY3RzIGF0IGl0cyByb290OiBGZWF0dXJlQ29sbGVjdGlvbiwgRmVhdHVyZXMsIEdlb21ldHJpZXMuXG4gIC8vIFRoaXMgZnVuY3Rpb24gaGFzIHRoZSByZXNwb25zaWJpbGl0eSBvZiBoYW5kbGluZyBhbGwgb2YgdGhlbSwgYW5kIHRoYXRcbiAgLy8gbWVhbnMgdGhhdCBzb21lIG9mIHRoZSBgZm9yYCBsb29wcyB5b3Ugc2VlIGJlbG93IGFjdHVhbGx5IGp1c3QgZG9uJ3QgYXBwbHlcbiAgLy8gdG8gY2VydGFpbiBpbnB1dHMuIEZvciBpbnN0YW5jZSwgaWYgeW91IGdpdmUgdGhpcyBqdXN0IGFcbiAgLy8gUG9pbnQgZ2VvbWV0cnksIHRoZW4gYm90aCBsb29wcyBhcmUgc2hvcnQtY2lyY3VpdGVkIGFuZCBhbGwgd2UgZG9cbiAgLy8gaXMgZ3JhZHVhbGx5IHJlbmFtZSB0aGUgaW5wdXQgdW50aWwgaXQncyBjYWxsZWQgJ2dlb21ldHJ5Jy5cbiAgLy9cbiAgLy8gVGhpcyBhbHNvIGFpbXMgdG8gYWxsb2NhdGUgYXMgZmV3IHJlc291cmNlcyBhcyBwb3NzaWJsZToganVzdCBhXG4gIC8vIGZldyBudW1iZXJzIGFuZCBib29sZWFucywgcmF0aGVyIHRoYW4gYW55IHRlbXBvcmFyeSBhcnJheXMgYXMgd291bGRcbiAgLy8gYmUgcmVxdWlyZWQgd2l0aCB0aGUgbm9ybWFsaXphdGlvbiBhcHByb2FjaC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgc3RvcDsgaSsrKSB7XG5cbiAgICAgICAgZ2VvbWV0cnlNYXliZUNvbGxlY3Rpb24gPSAoaXNGZWF0dXJlQ29sbGVjdGlvbiA/IGxheWVyLmZlYXR1cmVzW2ldLmdlb21ldHJ5IDpcbiAgICAgICAgKGlzRmVhdHVyZSA/IGxheWVyLmdlb21ldHJ5IDogbGF5ZXIpKTtcbiAgICAgICAgaXNHZW9tZXRyeUNvbGxlY3Rpb24gPSBnZW9tZXRyeU1heWJlQ29sbGVjdGlvbi50eXBlID09PSAnR2VvbWV0cnlDb2xsZWN0aW9uJztcbiAgICAgICAgc3RvcEcgPSBpc0dlb21ldHJ5Q29sbGVjdGlvbiA/IGdlb21ldHJ5TWF5YmVDb2xsZWN0aW9uLmdlb21ldHJpZXMubGVuZ3RoIDogMTtcblxuICAgICAgICBmb3IgKGcgPSAwOyBnIDwgc3RvcEc7IGcrKykge1xuICAgICAgICAgICAgZ2VvbWV0cnkgPSBpc0dlb21ldHJ5Q29sbGVjdGlvbiA/XG4gICAgICAgICAgICBnZW9tZXRyeU1heWJlQ29sbGVjdGlvbi5nZW9tZXRyaWVzW2ddIDogZ2VvbWV0cnlNYXliZUNvbGxlY3Rpb247XG4gICAgICAgICAgICBjb29yZHMgPSBnZW9tZXRyeS5jb29yZGluYXRlcztcblxuICAgICAgICAgICAgd3JhcFNocmluayA9IChleGNsdWRlV3JhcENvb3JkICYmXG4gICAgICAgICAgICAgICAgKGdlb21ldHJ5LnR5cGUgPT09ICdQb2x5Z29uJyB8fCBnZW9tZXRyeS50eXBlID09PSAnTXVsdGlQb2x5Z29uJykpID9cbiAgICAgICAgICAgICAgICAxIDogMDtcblxuICAgICAgICAgICAgaWYgKGdlb21ldHJ5LnR5cGUgPT09ICdQb2ludCcpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhjb29yZHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChnZW9tZXRyeS50eXBlID09PSAnTGluZVN0cmluZycgfHwgZ2VvbWV0cnkudHlwZSA9PT0gJ011bHRpUG9pbnQnKSB7XG4gICAgICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IGNvb3Jkcy5sZW5ndGg7IGorKykgY2FsbGJhY2soY29vcmRzW2pdKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZ2VvbWV0cnkudHlwZSA9PT0gJ1BvbHlnb24nIHx8IGdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IGNvb3Jkcy5sZW5ndGg7IGorKylcbiAgICAgICAgICAgICAgICAgICAgZm9yIChrID0gMDsgayA8IGNvb3Jkc1tqXS5sZW5ndGggLSB3cmFwU2hyaW5rOyBrKyspXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhjb29yZHNbal1ba10pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChnZW9tZXRyeS50eXBlID09PSAnTXVsdGlQb2x5Z29uJykge1xuICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBjb29yZHMubGVuZ3RoOyBqKyspXG4gICAgICAgICAgICAgICAgICAgIGZvciAoayA9IDA7IGsgPCBjb29yZHNbal0ubGVuZ3RoOyBrKyspXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGwgPSAwOyBsIDwgY29vcmRzW2pdW2tdLmxlbmd0aCAtIHdyYXBTaHJpbms7IGwrKylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhjb29yZHNbal1ba11bbF0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gR2VvbWV0cnkgVHlwZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxubW9kdWxlLmV4cG9ydHMuY29vcmRFYWNoID0gY29vcmRFYWNoO1xuXG4vKipcbiAqIFJlZHVjZSBjb29yZGluYXRlcyBpbiBhbnkgR2VvSlNPTiBvYmplY3QgaW50byBhIHNpbmdsZSB2YWx1ZSxcbiAqIHNpbWlsYXIgdG8gaG93IEFycmF5LnJlZHVjZSB3b3Jrcy4gSG93ZXZlciwgaW4gdGhpcyBjYXNlIHdlIGxhemlseSBydW5cbiAqIHRoZSByZWR1Y3Rpb24sIHNvIGFuIGFycmF5IG9mIGFsbCBjb29yZGluYXRlcyBpcyB1bm5lY2Vzc2FyeS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gbGF5ZXIgYW55IEdlb0pTT04gb2JqZWN0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBhIG1ldGhvZCB0aGF0IHRha2VzIChtZW1vLCB2YWx1ZSkgYW5kIHJldHVybnNcbiAqIGEgbmV3IG1lbW9cbiAqIEBwYXJhbSB7Kn0gbWVtbyB0aGUgc3RhcnRpbmcgdmFsdWUgb2YgbWVtbzogY2FuIGJlIGFueSB0eXBlLlxuICogQHBhcmFtIHtib29sZWFuPX0gZXhjbHVkZVdyYXBDb29yZCB3aGV0aGVyIG9yIG5vdCB0byBpbmNsdWRlXG4gKiB0aGUgZmluYWwgY29vcmRpbmF0ZSBvZiBMaW5lYXJSaW5ncyB0aGF0IHdyYXBzIHRoZSByaW5nIGluIGl0cyBpdGVyYXRpb24uXG4gKiBAcmV0dXJuIHsqfSBjb21iaW5lZCB2YWx1ZVxuICovXG5mdW5jdGlvbiBjb29yZFJlZHVjZShsYXllciwgY2FsbGJhY2ssIG1lbW8sIGV4Y2x1ZGVXcmFwQ29vcmQpIHtcbiAgICBjb29yZEVhY2gobGF5ZXIsIGZ1bmN0aW9uIChjb29yZCkge1xuICAgICAgICBtZW1vID0gY2FsbGJhY2sobWVtbywgY29vcmQpO1xuICAgIH0sIGV4Y2x1ZGVXcmFwQ29vcmQpO1xuICAgIHJldHVybiBtZW1vO1xufVxubW9kdWxlLmV4cG9ydHMuY29vcmRSZWR1Y2UgPSBjb29yZFJlZHVjZTtcblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgcHJvcGVydHkgb2JqZWN0cyBpbiBhbnkgR2VvSlNPTiBvYmplY3QsIHNpbWlsYXIgdG9cbiAqIEFycmF5LmZvckVhY2guXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGxheWVyIGFueSBHZW9KU09OIG9iamVjdFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgYSBtZXRob2QgdGhhdCB0YWtlcyAodmFsdWUpXG4gKiBAZXhhbXBsZVxuICogdmFyIHBvaW50ID0geyB0eXBlOiAnRmVhdHVyZScsIGdlb21ldHJ5OiBudWxsLCBwcm9wZXJ0aWVzOiB7IGZvbzogMSB9IH07XG4gKiBwcm9wRWFjaChwb2ludCwgZnVuY3Rpb24ocHJvcHMpIHtcbiAqICAgLy8gcHJvcHMgaXMgZXF1YWwgdG8geyBmb286IDF9XG4gKiB9KTtcbiAqL1xuZnVuY3Rpb24gcHJvcEVhY2gobGF5ZXIsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGk7XG4gICAgc3dpdGNoIChsYXllci50eXBlKSB7XG4gICAgY2FzZSAnRmVhdHVyZUNvbGxlY3Rpb24nOlxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGF5ZXIuZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGxheWVyLmZlYXR1cmVzW2ldLnByb3BlcnRpZXMpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0ZlYXR1cmUnOlxuICAgICAgICBjYWxsYmFjayhsYXllci5wcm9wZXJ0aWVzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxufVxubW9kdWxlLmV4cG9ydHMucHJvcEVhY2ggPSBwcm9wRWFjaDtcblxuLyoqXG4gKiBSZWR1Y2UgcHJvcGVydGllcyBpbiBhbnkgR2VvSlNPTiBvYmplY3QgaW50byBhIHNpbmdsZSB2YWx1ZSxcbiAqIHNpbWlsYXIgdG8gaG93IEFycmF5LnJlZHVjZSB3b3Jrcy4gSG93ZXZlciwgaW4gdGhpcyBjYXNlIHdlIGxhemlseSBydW5cbiAqIHRoZSByZWR1Y3Rpb24sIHNvIGFuIGFycmF5IG9mIGFsbCBwcm9wZXJ0aWVzIGlzIHVubmVjZXNzYXJ5LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBsYXllciBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGEgbWV0aG9kIHRoYXQgdGFrZXMgKG1lbW8sIGNvb3JkKSBhbmQgcmV0dXJuc1xuICogYSBuZXcgbWVtb1xuICogQHBhcmFtIHsqfSBtZW1vIHRoZSBzdGFydGluZyB2YWx1ZSBvZiBtZW1vOiBjYW4gYmUgYW55IHR5cGUuXG4gKiBAcmV0dXJuIHsqfSBjb21iaW5lZCB2YWx1ZVxuICovXG5mdW5jdGlvbiBwcm9wUmVkdWNlKGxheWVyLCBjYWxsYmFjaywgbWVtbykge1xuICAgIHByb3BFYWNoKGxheWVyLCBmdW5jdGlvbiAocHJvcCkge1xuICAgICAgICBtZW1vID0gY2FsbGJhY2sobWVtbywgcHJvcCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIG1lbW87XG59XG5tb2R1bGUuZXhwb3J0cy5wcm9wUmVkdWNlID0gcHJvcFJlZHVjZTtcblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgZmVhdHVyZXMgaW4gYW55IEdlb0pTT04gb2JqZWN0LCBzaW1pbGFyIHRvXG4gKiBBcnJheS5mb3JFYWNoLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBsYXllciBhbnkgR2VvSlNPTiBvYmplY3RcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGEgbWV0aG9kIHRoYXQgdGFrZXMgKHZhbHVlKVxuICogQGV4YW1wbGVcbiAqIHZhciBmZWF0dXJlID0geyB0eXBlOiAnRmVhdHVyZScsIGdlb21ldHJ5OiBudWxsLCBwcm9wZXJ0aWVzOiB7fSB9O1xuICogZmVhdHVyZUVhY2goZmVhdHVyZSwgZnVuY3Rpb24oZmVhdHVyZSkge1xuICogICAvLyBmZWF0dXJlID09IGZlYXR1cmVcbiAqIH0pO1xuICovXG5mdW5jdGlvbiBmZWF0dXJlRWFjaChsYXllciwgY2FsbGJhY2spIHtcbiAgICBpZiAobGF5ZXIudHlwZSA9PT0gJ0ZlYXR1cmUnKSB7XG4gICAgICAgIGNhbGxiYWNrKGxheWVyKTtcbiAgICB9IGVsc2UgaWYgKGxheWVyLnR5cGUgPT09ICdGZWF0dXJlQ29sbGVjdGlvbicpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsYXllci5mZWF0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY2FsbGJhY2sobGF5ZXIuZmVhdHVyZXNbaV0pO1xuICAgICAgICB9XG4gICAgfVxufVxubW9kdWxlLmV4cG9ydHMuZmVhdHVyZUVhY2ggPSBmZWF0dXJlRWFjaDtcblxuLyoqXG4gKiBHZXQgYWxsIGNvb3JkaW5hdGVzIGZyb20gYW55IEdlb0pTT04gb2JqZWN0LCByZXR1cm5pbmcgYW4gYXJyYXkgb2YgY29vcmRpbmF0ZVxuICogYXJyYXlzLlxuICogQHBhcmFtIHtPYmplY3R9IGxheWVyIGFueSBHZW9KU09OIG9iamVjdFxuICogQHJldHVybiB7QXJyYXk8QXJyYXk8TnVtYmVyPj59IGNvb3JkaW5hdGUgcG9zaXRpb24gYXJyYXlcbiAqL1xuZnVuY3Rpb24gY29vcmRBbGwobGF5ZXIpIHtcbiAgICB2YXIgY29vcmRzID0gW107XG4gICAgY29vcmRFYWNoKGxheWVyLCBmdW5jdGlvbiAoY29vcmQpIHtcbiAgICAgICAgY29vcmRzLnB1c2goY29vcmQpO1xuICAgIH0pO1xuICAgIHJldHVybiBjb29yZHM7XG59XG5tb2R1bGUuZXhwb3J0cy5jb29yZEFsbCA9IGNvb3JkQWxsO1xuIiwiLyoqXG4gKiBUYWtlcyBjb29yZGluYXRlcyBhbmQgcHJvcGVydGllcyAob3B0aW9uYWwpIGFuZCByZXR1cm5zIGEgbmV3IHtAbGluayBQb2ludH0gZmVhdHVyZS5cbiAqXG4gKiBAbW9kdWxlIHR1cmYvcG9pbnRcbiAqIEBjYXRlZ29yeSBoZWxwZXJcbiAqIEBwYXJhbSB7bnVtYmVyfSBsb25naXR1ZGUgcG9zaXRpb24gd2VzdCB0byBlYXN0IGluIGRlY2ltYWwgZGVncmVlc1xuICogQHBhcmFtIHtudW1iZXJ9IGxhdGl0dWRlIHBvc2l0aW9uIHNvdXRoIHRvIG5vcnRoIGluIGRlY2ltYWwgZGVncmVlc1xuICogQHBhcmFtIHtPYmplY3R9IHByb3BlcnRpZXMgYW4gT2JqZWN0IHRoYXQgaXMgdXNlZCBhcyB0aGUge0BsaW5rIEZlYXR1cmV9J3NcbiAqIHByb3BlcnRpZXNcbiAqIEByZXR1cm4ge1BvaW50fSBhIFBvaW50IGZlYXR1cmVcbiAqIEBleGFtcGxlXG4gKiB2YXIgcHQxID0gdHVyZi5wb2ludChbLTc1LjM0MywgMzkuOTg0XSk7XG4gKlxuICogLy89cHQxXG4gKi9cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcmcpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY29vcmRpbmF0ZXMsIHByb3BlcnRpZXMpIHtcbiAgaWYgKCFpc0FycmF5KGNvb3JkaW5hdGVzKSkgdGhyb3cgbmV3IEVycm9yKCdDb29yZGluYXRlcyBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gIGlmIChjb29yZGluYXRlcy5sZW5ndGggPCAyKSB0aHJvdyBuZXcgRXJyb3IoJ0Nvb3JkaW5hdGVzIG11c3QgYmUgYXQgbGVhc3QgMiBudW1iZXJzIGxvbmcnKTtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBcIkZlYXR1cmVcIixcbiAgICBnZW9tZXRyeToge1xuICAgICAgdHlwZTogXCJQb2ludFwiLFxuICAgICAgY29vcmRpbmF0ZXM6IGNvb3JkaW5hdGVzXG4gICAgfSxcbiAgICBwcm9wZXJ0aWVzOiBwcm9wZXJ0aWVzIHx8IHt9XG4gIH07XG59O1xuIiwidmFyIGluc2lkZSA9IHJlcXVpcmUoJ3R1cmYtaW5zaWRlJyk7XG52YXIgZmVhdHVyZUNvbGxlY3Rpb24gPSByZXF1aXJlKCd0dXJmLWZlYXR1cmVjb2xsZWN0aW9uJyk7XG5cbi8qKlxuICogVGFrZXMgYSB7QGxpbmsgRmVhdHVyZUNvbGxlY3Rpb259IG9mIHtAbGluayBQb2ludH0gZmVhdHVyZXMgYW5kIGEgRmVhdHVyZUNvbGxlY3Rpb24gb2Yge0BsaW5rIFBvbHlnb259IGZlYXR1cmVzIGFuZCByZXR1cm5zIGEgRmVhdHVyZUNvbGxlY3Rpb24gb2YgUG9pbnQgZmVhdHVyZXMgcmVwcmVzZW50aW5nIGFsbCBwb2ludHMgdGhhdCBmYWxsIHdpdGhpbiBhIGNvbGxlY3Rpb24gb2YgcG9seWdvbnMuXG4gKlxuICogQG1vZHVsZSB0dXJmL3dpdGhpblxuICogQGNhdGVnb3J5IGpvaW5zXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufSBwb2ludHMgYSBGZWF0dXJlQ29sbGVjdGlvbiBvZiB7QGxpbmsgUG9pbnR9IGZlYXR1cmVzXG4gKiBAcGFyYW0ge0ZlYXR1cmVDb2xsZWN0aW9ufSBwb2x5Z29ucyBhIEZlYXR1cmVDb2xsZWN0aW9uIG9mIHtAbGluayBQb2x5Z29ufSBmZWF0dXJlc1xuICogQHJldHVybiB7RmVhdHVyZUNvbGxlY3Rpb259IGEgY29sbGVjdGlvbiBvZiBhbGwgcG9pbnRzIHRoYXQgbGFuZFxuICogd2l0aGluIGF0IGxlYXN0IG9uZSBwb2x5Z29uXG4gKiBAZXhhbXBsZVxuICogdmFyIHNlYXJjaFdpdGhpbiA9IHtcbiAqICAgXCJ0eXBlXCI6IFwiRmVhdHVyZUNvbGxlY3Rpb25cIixcbiAqICAgXCJmZWF0dXJlc1wiOiBbXG4gKiAgICAge1xuICogICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICAgICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICAgICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgICAgIFwidHlwZVwiOiBcIlBvbHlnb25cIixcbiAqICAgICAgICAgXCJjb29yZGluYXRlc1wiOiBbW1xuICogICAgICAgICAgIFstNDYuNjUzLC0yMy41NDNdLFxuICogICAgICAgICAgIFstNDYuNjM0LC0yMy41MzQ2XSxcbiAqICAgICAgICAgICBbLTQ2LjYxMywtMjMuNTQzXSxcbiAqICAgICAgICAgICBbLTQ2LjYxNCwtMjMuNTU5XSxcbiAqICAgICAgICAgICBbLTQ2LjYzMSwtMjMuNTY3XSxcbiAqICAgICAgICAgICBbLTQ2LjY1MywtMjMuNTYwXSxcbiAqICAgICAgICAgICBbLTQ2LjY1MywtMjMuNTQzXVxuICogICAgICAgICBdXVxuICogICAgICAgfVxuICogICAgIH1cbiAqICAgXVxuICogfTtcbiAqIHZhciBwb2ludHMgPSB7XG4gKiAgIFwidHlwZVwiOiBcIkZlYXR1cmVDb2xsZWN0aW9uXCIsXG4gKiAgIFwiZmVhdHVyZXNcIjogW1xuICogICAgIHtcbiAqICAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgICAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFstNDYuNjMxOCwgLTIzLjU1MjNdXG4gKiAgICAgICB9XG4gKiAgICAgfSwge1xuICogICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICogICAgICAgXCJwcm9wZXJ0aWVzXCI6IHt9LFxuICogICAgICAgXCJnZW9tZXRyeVwiOiB7XG4gKiAgICAgICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gKiAgICAgICAgIFwiY29vcmRpbmF0ZXNcIjogWy00Ni42MjQ2LCAtMjMuNTMyNV1cbiAqICAgICAgIH1cbiAqICAgICB9LCB7XG4gKiAgICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gKiAgICAgICBcInByb3BlcnRpZXNcIjoge30sXG4gKiAgICAgICBcImdlb21ldHJ5XCI6IHtcbiAqICAgICAgICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAqICAgICAgICAgXCJjb29yZGluYXRlc1wiOiBbLTQ2LjYwNjIsIC0yMy41NTEzXVxuICogICAgICAgfVxuICogICAgIH0sIHtcbiAqICAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgICAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFstNDYuNjYzLCAtMjMuNTU0XVxuICogICAgICAgfVxuICogICAgIH0sIHtcbiAqICAgICAgIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAqICAgICAgIFwicHJvcGVydGllc1wiOiB7fSxcbiAqICAgICAgIFwiZ2VvbWV0cnlcIjoge1xuICogICAgICAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICogICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFstNDYuNjQzLCAtMjMuNTU3XVxuICogICAgICAgfVxuICogICAgIH1cbiAqICAgXVxuICogfTtcbiAqXG4gKiB2YXIgcHRzV2l0aGluID0gdHVyZi53aXRoaW4ocG9pbnRzLCBzZWFyY2hXaXRoaW4pO1xuICpcbiAqIC8vPXBvaW50c1xuICpcbiAqIC8vPXNlYXJjaFdpdGhpblxuICpcbiAqIC8vPXB0c1dpdGhpblxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHB0RkMsIHBvbHlGQyl7XG4gIHZhciBwb2ludHNXaXRoaW4gPSBmZWF0dXJlQ29sbGVjdGlvbihbXSk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcG9seUZDLmZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBwdEZDLmZlYXR1cmVzLmxlbmd0aDsgaisrKSB7XG4gICAgICB2YXIgaXNJbnNpZGUgPSBpbnNpZGUocHRGQy5mZWF0dXJlc1tqXSwgcG9seUZDLmZlYXR1cmVzW2ldKTtcbiAgICAgIGlmKGlzSW5zaWRlKXtcbiAgICAgICAgcG9pbnRzV2l0aGluLmZlYXR1cmVzLnB1c2gocHRGQy5mZWF0dXJlc1tqXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBwb2ludHNXaXRoaW47XG59O1xuIiwiLyohXG5Db3B5cmlnaHQgKEMpIDIwMTAtMjAxMyBSYXltb25kIEhpbGw6IGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaVxuTUlUIExpY2Vuc2U6IFNlZSBodHRwczovL2dpdGh1Yi5jb20vZ29yaGlsbC9KYXZhc2NyaXB0LVZvcm9ub2kvTElDRU5TRS5tZFxuKi9cbi8qXG5BdXRob3I6IFJheW1vbmQgSGlsbCAocmhpbGxAcmF5bW9uZGhpbGwubmV0KVxuQ29udHJpYnV0b3I6IEplc3NlIE1vcmdhbiAobW9yZ2FqZWxAZ21haWwuY29tKVxuRmlsZTogcmhpbGwtdm9yb25vaS1jb3JlLmpzXG5WZXJzaW9uOiAwLjk4XG5EYXRlOiBKYW51YXJ5IDIxLCAyMDEzXG5EZXNjcmlwdGlvbjogVGhpcyBpcyBteSBwZXJzb25hbCBKYXZhc2NyaXB0IGltcGxlbWVudGF0aW9uIG9mXG5TdGV2ZW4gRm9ydHVuZSdzIGFsZ29yaXRobSB0byBjb21wdXRlIFZvcm9ub2kgZGlhZ3JhbXMuXG5cbkxpY2Vuc2U6IFNlZSBodHRwczovL2dpdGh1Yi5jb20vZ29yaGlsbC9KYXZhc2NyaXB0LVZvcm9ub2kvTElDRU5TRS5tZFxuQ3JlZGl0czogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9DUkVESVRTLm1kXG5IaXN0b3J5OiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pL0NIQU5HRUxPRy5tZFxuXG4jIyBVc2FnZTpcblxuICB2YXIgc2l0ZXMgPSBbe3g6MzAwLHk6MzAwfSwge3g6MTAwLHk6MTAwfSwge3g6MjAwLHk6NTAwfSwge3g6MjUwLHk6NDUwfSwge3g6NjAwLHk6MTUwfV07XG4gIC8vIHhsLCB4ciBtZWFucyB4IGxlZnQsIHggcmlnaHRcbiAgLy8geXQsIHliIG1lYW5zIHkgdG9wLCB5IGJvdHRvbVxuICB2YXIgYmJveCA9IHt4bDowLCB4cjo4MDAsIHl0OjAsIHliOjYwMH07XG4gIHZhciB2b3Jvbm9pID0gbmV3IFZvcm9ub2koKTtcbiAgLy8gcGFzcyBhbiBvYmplY3Qgd2hpY2ggZXhoaWJpdHMgeGwsIHhyLCB5dCwgeWIgcHJvcGVydGllcy4gVGhlIGJvdW5kaW5nXG4gIC8vIGJveCB3aWxsIGJlIHVzZWQgdG8gY29ubmVjdCB1bmJvdW5kIGVkZ2VzLCBhbmQgdG8gY2xvc2Ugb3BlbiBjZWxsc1xuICByZXN1bHQgPSB2b3Jvbm9pLmNvbXB1dGUoc2l0ZXMsIGJib3gpO1xuICAvLyByZW5kZXIsIGZ1cnRoZXIgYW5hbHl6ZSwgZXRjLlxuXG5SZXR1cm4gdmFsdWU6XG4gIEFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcblxuICByZXN1bHQudmVydGljZXMgPSBhbiBhcnJheSBvZiB1bm9yZGVyZWQsIHVuaXF1ZSBWb3Jvbm9pLlZlcnRleCBvYmplY3RzIG1ha2luZ1xuICAgIHVwIHRoZSBWb3Jvbm9pIGRpYWdyYW0uXG4gIHJlc3VsdC5lZGdlcyA9IGFuIGFycmF5IG9mIHVub3JkZXJlZCwgdW5pcXVlIFZvcm9ub2kuRWRnZSBvYmplY3RzIG1ha2luZyB1cFxuICAgIHRoZSBWb3Jvbm9pIGRpYWdyYW0uXG4gIHJlc3VsdC5jZWxscyA9IGFuIGFycmF5IG9mIFZvcm9ub2kuQ2VsbCBvYmplY3QgbWFraW5nIHVwIHRoZSBWb3Jvbm9pIGRpYWdyYW0uXG4gICAgQSBDZWxsIG9iamVjdCBtaWdodCBoYXZlIGFuIGVtcHR5IGFycmF5IG9mIGhhbGZlZGdlcywgbWVhbmluZyBubyBWb3Jvbm9pXG4gICAgY2VsbCBjb3VsZCBiZSBjb21wdXRlZCBmb3IgYSBwYXJ0aWN1bGFyIGNlbGwuXG4gIHJlc3VsdC5leGVjVGltZSA9IHRoZSB0aW1lIGl0IHRvb2sgdG8gY29tcHV0ZSB0aGUgVm9yb25vaSBkaWFncmFtLCBpblxuICAgIG1pbGxpc2Vjb25kcy5cblxuVm9yb25vaS5WZXJ0ZXggb2JqZWN0OlxuICB4OiBUaGUgeCBwb3NpdGlvbiBvZiB0aGUgdmVydGV4LlxuICB5OiBUaGUgeSBwb3NpdGlvbiBvZiB0aGUgdmVydGV4LlxuXG5Wb3Jvbm9pLkVkZ2Ugb2JqZWN0OlxuICBsU2l0ZTogdGhlIFZvcm9ub2kgc2l0ZSBvYmplY3QgYXQgdGhlIGxlZnQgb2YgdGhpcyBWb3Jvbm9pLkVkZ2Ugb2JqZWN0LlxuICByU2l0ZTogdGhlIFZvcm9ub2kgc2l0ZSBvYmplY3QgYXQgdGhlIHJpZ2h0IG9mIHRoaXMgVm9yb25vaS5FZGdlIG9iamVjdCAoY2FuXG4gICAgYmUgbnVsbCkuXG4gIHZhOiBhbiBvYmplY3Qgd2l0aCBhbiAneCcgYW5kIGEgJ3knIHByb3BlcnR5IGRlZmluaW5nIHRoZSBzdGFydCBwb2ludFxuICAgIChyZWxhdGl2ZSB0byB0aGUgVm9yb25vaSBzaXRlIG9uIHRoZSBsZWZ0KSBvZiB0aGlzIFZvcm9ub2kuRWRnZSBvYmplY3QuXG4gIHZiOiBhbiBvYmplY3Qgd2l0aCBhbiAneCcgYW5kIGEgJ3knIHByb3BlcnR5IGRlZmluaW5nIHRoZSBlbmQgcG9pbnRcbiAgICAocmVsYXRpdmUgdG8gVm9yb25vaSBzaXRlIG9uIHRoZSBsZWZ0KSBvZiB0aGlzIFZvcm9ub2kuRWRnZSBvYmplY3QuXG5cbiAgRm9yIGVkZ2VzIHdoaWNoIGFyZSB1c2VkIHRvIGNsb3NlIG9wZW4gY2VsbHMgKHVzaW5nIHRoZSBzdXBwbGllZCBib3VuZGluZ1xuICBib3gpLCB0aGUgclNpdGUgcHJvcGVydHkgd2lsbCBiZSBudWxsLlxuXG5Wb3Jvbm9pLkNlbGwgb2JqZWN0OlxuICBzaXRlOiB0aGUgVm9yb25vaSBzaXRlIG9iamVjdCBhc3NvY2lhdGVkIHdpdGggdGhlIFZvcm9ub2kgY2VsbC5cbiAgaGFsZmVkZ2VzOiBhbiBhcnJheSBvZiBWb3Jvbm9pLkhhbGZlZGdlIG9iamVjdHMsIG9yZGVyZWQgY291bnRlcmNsb2Nrd2lzZSxcbiAgICBkZWZpbmluZyB0aGUgcG9seWdvbiBmb3IgdGhpcyBWb3Jvbm9pIGNlbGwuXG5cblZvcm9ub2kuSGFsZmVkZ2Ugb2JqZWN0OlxuICBzaXRlOiB0aGUgVm9yb25vaSBzaXRlIG9iamVjdCBvd25pbmcgdGhpcyBWb3Jvbm9pLkhhbGZlZGdlIG9iamVjdC5cbiAgZWRnZTogYSByZWZlcmVuY2UgdG8gdGhlIHVuaXF1ZSBWb3Jvbm9pLkVkZ2Ugb2JqZWN0IHVuZGVybHlpbmcgdGhpc1xuICAgIFZvcm9ub2kuSGFsZmVkZ2Ugb2JqZWN0LlxuICBnZXRTdGFydHBvaW50KCk6IGEgbWV0aG9kIHJldHVybmluZyBhbiBvYmplY3Qgd2l0aCBhbiAneCcgYW5kIGEgJ3knIHByb3BlcnR5XG4gICAgZm9yIHRoZSBzdGFydCBwb2ludCBvZiB0aGlzIGhhbGZlZGdlLiBLZWVwIGluIG1pbmQgaGFsZmVkZ2VzIGFyZSBhbHdheXNcbiAgICBjb3VudGVyY29ja3dpc2UuXG4gIGdldEVuZHBvaW50KCk6IGEgbWV0aG9kIHJldHVybmluZyBhbiBvYmplY3Qgd2l0aCBhbiAneCcgYW5kIGEgJ3knIHByb3BlcnR5XG4gICAgZm9yIHRoZSBlbmQgcG9pbnQgb2YgdGhpcyBoYWxmZWRnZS4gS2VlcCBpbiBtaW5kIGhhbGZlZGdlcyBhcmUgYWx3YXlzXG4gICAgY291bnRlcmNvY2t3aXNlLlxuXG5UT0RPOiBJZGVudGlmeSBvcHBvcnR1bml0aWVzIGZvciBwZXJmb3JtYW5jZSBpbXByb3ZlbWVudC5cblxuVE9ETzogTGV0IHRoZSB1c2VyIGNsb3NlIHRoZSBWb3Jvbm9pIGNlbGxzLCBkbyBub3QgZG8gaXQgYXV0b21hdGljYWxseS4gTm90IG9ubHkgbGV0XG4gICAgICBoaW0gY2xvc2UgdGhlIGNlbGxzLCBidXQgYWxzbyBhbGxvdyBoaW0gdG8gY2xvc2UgbW9yZSB0aGFuIG9uY2UgdXNpbmcgYSBkaWZmZXJlbnRcbiAgICAgIGJvdW5kaW5nIGJveCBmb3IgdGhlIHNhbWUgVm9yb25vaSBkaWFncmFtLlxuKi9cblxuLypnbG9iYWwgTWF0aCAqL1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gVm9yb25vaSgpIHtcbiAgICB0aGlzLnZlcnRpY2VzID0gbnVsbDtcbiAgICB0aGlzLmVkZ2VzID0gbnVsbDtcbiAgICB0aGlzLmNlbGxzID0gbnVsbDtcbiAgICB0aGlzLnRvUmVjeWNsZSA9IG51bGw7XG4gICAgdGhpcy5iZWFjaHNlY3Rpb25KdW5reWFyZCA9IFtdO1xuICAgIHRoaXMuY2lyY2xlRXZlbnRKdW5reWFyZCA9IFtdO1xuICAgIHRoaXMudmVydGV4SnVua3lhcmQgPSBbXTtcbiAgICB0aGlzLmVkZ2VKdW5reWFyZCA9IFtdO1xuICAgIHRoaXMuY2VsbEp1bmt5YXJkID0gW107XG4gICAgfVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuVm9yb25vaS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuYmVhY2hsaW5lKSB7XG4gICAgICAgIHRoaXMuYmVhY2hsaW5lID0gbmV3IHRoaXMuUkJUcmVlKCk7XG4gICAgICAgIH1cbiAgICAvLyBNb3ZlIGxlZnRvdmVyIGJlYWNoc2VjdGlvbnMgdG8gdGhlIGJlYWNoc2VjdGlvbiBqdW5reWFyZC5cbiAgICBpZiAodGhpcy5iZWFjaGxpbmUucm9vdCkge1xuICAgICAgICB2YXIgYmVhY2hzZWN0aW9uID0gdGhpcy5iZWFjaGxpbmUuZ2V0Rmlyc3QodGhpcy5iZWFjaGxpbmUucm9vdCk7XG4gICAgICAgIHdoaWxlIChiZWFjaHNlY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuYmVhY2hzZWN0aW9uSnVua3lhcmQucHVzaChiZWFjaHNlY3Rpb24pOyAvLyBtYXJrIGZvciByZXVzZVxuICAgICAgICAgICAgYmVhY2hzZWN0aW9uID0gYmVhY2hzZWN0aW9uLnJiTmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIHRoaXMuYmVhY2hsaW5lLnJvb3QgPSBudWxsO1xuICAgIGlmICghdGhpcy5jaXJjbGVFdmVudHMpIHtcbiAgICAgICAgdGhpcy5jaXJjbGVFdmVudHMgPSBuZXcgdGhpcy5SQlRyZWUoKTtcbiAgICAgICAgfVxuICAgIHRoaXMuY2lyY2xlRXZlbnRzLnJvb3QgPSB0aGlzLmZpcnN0Q2lyY2xlRXZlbnQgPSBudWxsO1xuICAgIHRoaXMudmVydGljZXMgPSBbXTtcbiAgICB0aGlzLmVkZ2VzID0gW107XG4gICAgdGhpcy5jZWxscyA9IFtdO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLnNxcnQgPSBNYXRoLnNxcnQ7XG5Wb3Jvbm9pLnByb3RvdHlwZS5hYnMgPSBNYXRoLmFicztcblZvcm9ub2kucHJvdG90eXBlLs61ID0gVm9yb25vaS7OtSA9IDFlLTk7XG5Wb3Jvbm9pLnByb3RvdHlwZS5pbnbOtSA9IFZvcm9ub2kuaW52zrUgPSAxLjAgLyBWb3Jvbm9pLs61O1xuVm9yb25vaS5wcm90b3R5cGUuZXF1YWxXaXRoRXBzaWxvbiA9IGZ1bmN0aW9uKGEsYil7cmV0dXJuIHRoaXMuYWJzKGEtYik8MWUtOTt9O1xuVm9yb25vaS5wcm90b3R5cGUuZ3JlYXRlclRoYW5XaXRoRXBzaWxvbiA9IGZ1bmN0aW9uKGEsYil7cmV0dXJuIGEtYj4xZS05O307XG5Wb3Jvbm9pLnByb3RvdHlwZS5ncmVhdGVyVGhhbk9yRXF1YWxXaXRoRXBzaWxvbiA9IGZ1bmN0aW9uKGEsYil7cmV0dXJuIGItYTwxZS05O307XG5Wb3Jvbm9pLnByb3RvdHlwZS5sZXNzVGhhbldpdGhFcHNpbG9uID0gZnVuY3Rpb24oYSxiKXtyZXR1cm4gYi1hPjFlLTk7fTtcblZvcm9ub2kucHJvdG90eXBlLmxlc3NUaGFuT3JFcXVhbFdpdGhFcHNpbG9uID0gZnVuY3Rpb24oYSxiKXtyZXR1cm4gYS1iPDFlLTk7fTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBSZWQtQmxhY2sgdHJlZSBjb2RlIChiYXNlZCBvbiBDIHZlcnNpb24gb2YgXCJyYnRyZWVcIiBieSBGcmFuY2sgQnVpLUh1dVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2ZidWlodXUvbGlidHJlZS9ibG9iL21hc3Rlci9yYi5jXG5cblZvcm9ub2kucHJvdG90eXBlLlJCVHJlZSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucm9vdCA9IG51bGw7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuUkJUcmVlLnByb3RvdHlwZS5yYkluc2VydFN1Y2Nlc3NvciA9IGZ1bmN0aW9uKG5vZGUsIHN1Y2Nlc3Nvcikge1xuICAgIHZhciBwYXJlbnQ7XG4gICAgaWYgKG5vZGUpIHtcbiAgICAgICAgLy8gPj4+IHJoaWxsIDIwMTEtMDUtMjc6IFBlcmZvcm1hbmNlOiBjYWNoZSBwcmV2aW91cy9uZXh0IG5vZGVzXG4gICAgICAgIHN1Y2Nlc3Nvci5yYlByZXZpb3VzID0gbm9kZTtcbiAgICAgICAgc3VjY2Vzc29yLnJiTmV4dCA9IG5vZGUucmJOZXh0O1xuICAgICAgICBpZiAobm9kZS5yYk5leHQpIHtcbiAgICAgICAgICAgIG5vZGUucmJOZXh0LnJiUHJldmlvdXMgPSBzdWNjZXNzb3I7XG4gICAgICAgICAgICB9XG4gICAgICAgIG5vZGUucmJOZXh0ID0gc3VjY2Vzc29yO1xuICAgICAgICAvLyA8PDxcbiAgICAgICAgaWYgKG5vZGUucmJSaWdodCkge1xuICAgICAgICAgICAgLy8gaW4tcGxhY2UgZXhwYW5zaW9uIG9mIG5vZGUucmJSaWdodC5nZXRGaXJzdCgpO1xuICAgICAgICAgICAgbm9kZSA9IG5vZGUucmJSaWdodDtcbiAgICAgICAgICAgIHdoaWxlIChub2RlLnJiTGVmdCkge25vZGUgPSBub2RlLnJiTGVmdDt9XG4gICAgICAgICAgICBub2RlLnJiTGVmdCA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBub2RlLnJiUmlnaHQgPSBzdWNjZXNzb3I7XG4gICAgICAgICAgICB9XG4gICAgICAgIHBhcmVudCA9IG5vZGU7XG4gICAgICAgIH1cbiAgICAvLyByaGlsbCAyMDExLTA2LTA3OiBpZiBub2RlIGlzIG51bGwsIHN1Y2Nlc3NvciBtdXN0IGJlIGluc2VydGVkXG4gICAgLy8gdG8gdGhlIGxlZnQtbW9zdCBwYXJ0IG9mIHRoZSB0cmVlXG4gICAgZWxzZSBpZiAodGhpcy5yb290KSB7XG4gICAgICAgIG5vZGUgPSB0aGlzLmdldEZpcnN0KHRoaXMucm9vdCk7XG4gICAgICAgIC8vID4+PiBQZXJmb3JtYW5jZTogY2FjaGUgcHJldmlvdXMvbmV4dCBub2Rlc1xuICAgICAgICBzdWNjZXNzb3IucmJQcmV2aW91cyA9IG51bGw7XG4gICAgICAgIHN1Y2Nlc3Nvci5yYk5leHQgPSBub2RlO1xuICAgICAgICBub2RlLnJiUHJldmlvdXMgPSBzdWNjZXNzb3I7XG4gICAgICAgIC8vIDw8PFxuICAgICAgICBub2RlLnJiTGVmdCA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgcGFyZW50ID0gbm9kZTtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICAvLyA+Pj4gUGVyZm9ybWFuY2U6IGNhY2hlIHByZXZpb3VzL25leHQgbm9kZXNcbiAgICAgICAgc3VjY2Vzc29yLnJiUHJldmlvdXMgPSBzdWNjZXNzb3IucmJOZXh0ID0gbnVsbDtcbiAgICAgICAgLy8gPDw8XG4gICAgICAgIHRoaXMucm9vdCA9IHN1Y2Nlc3NvcjtcbiAgICAgICAgcGFyZW50ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIHN1Y2Nlc3Nvci5yYkxlZnQgPSBzdWNjZXNzb3IucmJSaWdodCA9IG51bGw7XG4gICAgc3VjY2Vzc29yLnJiUGFyZW50ID0gcGFyZW50O1xuICAgIHN1Y2Nlc3Nvci5yYlJlZCA9IHRydWU7XG4gICAgLy8gRml4dXAgdGhlIG1vZGlmaWVkIHRyZWUgYnkgcmVjb2xvcmluZyBub2RlcyBhbmQgcGVyZm9ybWluZ1xuICAgIC8vIHJvdGF0aW9ucyAoMiBhdCBtb3N0KSBoZW5jZSB0aGUgcmVkLWJsYWNrIHRyZWUgcHJvcGVydGllcyBhcmVcbiAgICAvLyBwcmVzZXJ2ZWQuXG4gICAgdmFyIGdyYW5kcGEsIHVuY2xlO1xuICAgIG5vZGUgPSBzdWNjZXNzb3I7XG4gICAgd2hpbGUgKHBhcmVudCAmJiBwYXJlbnQucmJSZWQpIHtcbiAgICAgICAgZ3JhbmRwYSA9IHBhcmVudC5yYlBhcmVudDtcbiAgICAgICAgaWYgKHBhcmVudCA9PT0gZ3JhbmRwYS5yYkxlZnQpIHtcbiAgICAgICAgICAgIHVuY2xlID0gZ3JhbmRwYS5yYlJpZ2h0O1xuICAgICAgICAgICAgaWYgKHVuY2xlICYmIHVuY2xlLnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJiUmVkID0gdW5jbGUucmJSZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBncmFuZHBhLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBub2RlID0gZ3JhbmRwYTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobm9kZSA9PT0gcGFyZW50LnJiUmlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZUxlZnQocGFyZW50KTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZSA9IHBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50ID0gbm9kZS5yYlBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGdyYW5kcGEucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMucmJSb3RhdGVSaWdodChncmFuZHBhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdW5jbGUgPSBncmFuZHBhLnJiTGVmdDtcbiAgICAgICAgICAgIGlmICh1bmNsZSAmJiB1bmNsZS5yYlJlZCkge1xuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IHVuY2xlLnJiUmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgZ3JhbmRwYS5yYlJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgbm9kZSA9IGdyYW5kcGE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUgPT09IHBhcmVudC5yYkxlZnQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZVJpZ2h0KHBhcmVudCk7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUgPSBwYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgIHBhcmVudCA9IG5vZGUucmJQYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwYXJlbnQucmJSZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBncmFuZHBhLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnJiUm90YXRlTGVmdChncmFuZHBhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIHBhcmVudCA9IG5vZGUucmJQYXJlbnQ7XG4gICAgICAgIH1cbiAgICB0aGlzLnJvb3QucmJSZWQgPSBmYWxzZTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLnJiUmVtb3ZlTm9kZSA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAvLyA+Pj4gcmhpbGwgMjAxMS0wNS0yNzogUGVyZm9ybWFuY2U6IGNhY2hlIHByZXZpb3VzL25leHQgbm9kZXNcbiAgICBpZiAobm9kZS5yYk5leHQpIHtcbiAgICAgICAgbm9kZS5yYk5leHQucmJQcmV2aW91cyA9IG5vZGUucmJQcmV2aW91cztcbiAgICAgICAgfVxuICAgIGlmIChub2RlLnJiUHJldmlvdXMpIHtcbiAgICAgICAgbm9kZS5yYlByZXZpb3VzLnJiTmV4dCA9IG5vZGUucmJOZXh0O1xuICAgICAgICB9XG4gICAgbm9kZS5yYk5leHQgPSBub2RlLnJiUHJldmlvdXMgPSBudWxsO1xuICAgIC8vIDw8PFxuICAgIHZhciBwYXJlbnQgPSBub2RlLnJiUGFyZW50LFxuICAgICAgICBsZWZ0ID0gbm9kZS5yYkxlZnQsXG4gICAgICAgIHJpZ2h0ID0gbm9kZS5yYlJpZ2h0LFxuICAgICAgICBuZXh0O1xuICAgIGlmICghbGVmdCkge1xuICAgICAgICBuZXh0ID0gcmlnaHQ7XG4gICAgICAgIH1cbiAgICBlbHNlIGlmICghcmlnaHQpIHtcbiAgICAgICAgbmV4dCA9IGxlZnQ7XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgbmV4dCA9IHRoaXMuZ2V0Rmlyc3QocmlnaHQpO1xuICAgICAgICB9XG4gICAgaWYgKHBhcmVudCkge1xuICAgICAgICBpZiAocGFyZW50LnJiTGVmdCA9PT0gbm9kZSkge1xuICAgICAgICAgICAgcGFyZW50LnJiTGVmdCA9IG5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcGFyZW50LnJiUmlnaHQgPSBuZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMucm9vdCA9IG5leHQ7XG4gICAgICAgIH1cbiAgICAvLyBlbmZvcmNlIHJlZC1ibGFjayBydWxlc1xuICAgIHZhciBpc1JlZDtcbiAgICBpZiAobGVmdCAmJiByaWdodCkge1xuICAgICAgICBpc1JlZCA9IG5leHQucmJSZWQ7XG4gICAgICAgIG5leHQucmJSZWQgPSBub2RlLnJiUmVkO1xuICAgICAgICBuZXh0LnJiTGVmdCA9IGxlZnQ7XG4gICAgICAgIGxlZnQucmJQYXJlbnQgPSBuZXh0O1xuICAgICAgICBpZiAobmV4dCAhPT0gcmlnaHQpIHtcbiAgICAgICAgICAgIHBhcmVudCA9IG5leHQucmJQYXJlbnQ7XG4gICAgICAgICAgICBuZXh0LnJiUGFyZW50ID0gbm9kZS5yYlBhcmVudDtcbiAgICAgICAgICAgIG5vZGUgPSBuZXh0LnJiUmlnaHQ7XG4gICAgICAgICAgICBwYXJlbnQucmJMZWZ0ID0gbm9kZTtcbiAgICAgICAgICAgIG5leHQucmJSaWdodCA9IHJpZ2h0O1xuICAgICAgICAgICAgcmlnaHQucmJQYXJlbnQgPSBuZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG5leHQucmJQYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgICAgICBwYXJlbnQgPSBuZXh0O1xuICAgICAgICAgICAgbm9kZSA9IG5leHQucmJSaWdodDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpc1JlZCA9IG5vZGUucmJSZWQ7XG4gICAgICAgIG5vZGUgPSBuZXh0O1xuICAgICAgICB9XG4gICAgLy8gJ25vZGUnIGlzIG5vdyB0aGUgc29sZSBzdWNjZXNzb3IncyBjaGlsZCBhbmQgJ3BhcmVudCcgaXRzXG4gICAgLy8gbmV3IHBhcmVudCAoc2luY2UgdGhlIHN1Y2Nlc3NvciBjYW4gaGF2ZSBiZWVuIG1vdmVkKVxuICAgIGlmIChub2RlKSB7XG4gICAgICAgIG5vZGUucmJQYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgIH1cbiAgICAvLyB0aGUgJ2Vhc3knIGNhc2VzXG4gICAgaWYgKGlzUmVkKSB7cmV0dXJuO31cbiAgICBpZiAobm9kZSAmJiBub2RlLnJiUmVkKSB7XG4gICAgICAgIG5vZGUucmJSZWQgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgLy8gdGhlIG90aGVyIGNhc2VzXG4gICAgdmFyIHNpYmxpbmc7XG4gICAgZG8ge1xuICAgICAgICBpZiAobm9kZSA9PT0gdGhpcy5yb290KSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUgPT09IHBhcmVudC5yYkxlZnQpIHtcbiAgICAgICAgICAgIHNpYmxpbmcgPSBwYXJlbnQucmJSaWdodDtcbiAgICAgICAgICAgIGlmIChzaWJsaW5nLnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgc2libGluZy5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZUxlZnQocGFyZW50KTtcbiAgICAgICAgICAgICAgICBzaWJsaW5nID0gcGFyZW50LnJiUmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKChzaWJsaW5nLnJiTGVmdCAmJiBzaWJsaW5nLnJiTGVmdC5yYlJlZCkgfHwgKHNpYmxpbmcucmJSaWdodCAmJiBzaWJsaW5nLnJiUmlnaHQucmJSZWQpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzaWJsaW5nLnJiUmlnaHQgfHwgIXNpYmxpbmcucmJSaWdodC5yYlJlZCkge1xuICAgICAgICAgICAgICAgICAgICBzaWJsaW5nLnJiTGVmdC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBzaWJsaW5nLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZVJpZ2h0KHNpYmxpbmcpO1xuICAgICAgICAgICAgICAgICAgICBzaWJsaW5nID0gcGFyZW50LnJiUmlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzaWJsaW5nLnJiUmVkID0gcGFyZW50LnJiUmVkO1xuICAgICAgICAgICAgICAgIHBhcmVudC5yYlJlZCA9IHNpYmxpbmcucmJSaWdodC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMucmJSb3RhdGVMZWZ0KHBhcmVudCk7XG4gICAgICAgICAgICAgICAgbm9kZSA9IHRoaXMucm9vdDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2libGluZyA9IHBhcmVudC5yYkxlZnQ7XG4gICAgICAgICAgICBpZiAoc2libGluZy5yYlJlZCkge1xuICAgICAgICAgICAgICAgIHNpYmxpbmcucmJSZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBwYXJlbnQucmJSZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMucmJSb3RhdGVSaWdodChwYXJlbnQpO1xuICAgICAgICAgICAgICAgIHNpYmxpbmcgPSBwYXJlbnQucmJMZWZ0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgoc2libGluZy5yYkxlZnQgJiYgc2libGluZy5yYkxlZnQucmJSZWQpIHx8IChzaWJsaW5nLnJiUmlnaHQgJiYgc2libGluZy5yYlJpZ2h0LnJiUmVkKSkge1xuICAgICAgICAgICAgICAgIGlmICghc2libGluZy5yYkxlZnQgfHwgIXNpYmxpbmcucmJMZWZ0LnJiUmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcucmJSaWdodC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBzaWJsaW5nLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYlJvdGF0ZUxlZnQoc2libGluZyk7XG4gICAgICAgICAgICAgICAgICAgIHNpYmxpbmcgPSBwYXJlbnQucmJMZWZ0O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2libGluZy5yYlJlZCA9IHBhcmVudC5yYlJlZDtcbiAgICAgICAgICAgICAgICBwYXJlbnQucmJSZWQgPSBzaWJsaW5nLnJiTGVmdC5yYlJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMucmJSb3RhdGVSaWdodChwYXJlbnQpO1xuICAgICAgICAgICAgICAgIG5vZGUgPSB0aGlzLnJvb3Q7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBzaWJsaW5nLnJiUmVkID0gdHJ1ZTtcbiAgICAgICAgbm9kZSA9IHBhcmVudDtcbiAgICAgICAgcGFyZW50ID0gcGFyZW50LnJiUGFyZW50O1xuICAgIH0gd2hpbGUgKCFub2RlLnJiUmVkKTtcbiAgICBpZiAobm9kZSkge25vZGUucmJSZWQgPSBmYWxzZTt9XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuUkJUcmVlLnByb3RvdHlwZS5yYlJvdGF0ZUxlZnQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHAgPSBub2RlLFxuICAgICAgICBxID0gbm9kZS5yYlJpZ2h0LCAvLyBjYW4ndCBiZSBudWxsXG4gICAgICAgIHBhcmVudCA9IHAucmJQYXJlbnQ7XG4gICAgaWYgKHBhcmVudCkge1xuICAgICAgICBpZiAocGFyZW50LnJiTGVmdCA9PT0gcCkge1xuICAgICAgICAgICAgcGFyZW50LnJiTGVmdCA9IHE7XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcGFyZW50LnJiUmlnaHQgPSBxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMucm9vdCA9IHE7XG4gICAgICAgIH1cbiAgICBxLnJiUGFyZW50ID0gcGFyZW50O1xuICAgIHAucmJQYXJlbnQgPSBxO1xuICAgIHAucmJSaWdodCA9IHEucmJMZWZ0O1xuICAgIGlmIChwLnJiUmlnaHQpIHtcbiAgICAgICAgcC5yYlJpZ2h0LnJiUGFyZW50ID0gcDtcbiAgICAgICAgfVxuICAgIHEucmJMZWZ0ID0gcDtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5SQlRyZWUucHJvdG90eXBlLnJiUm90YXRlUmlnaHQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHAgPSBub2RlLFxuICAgICAgICBxID0gbm9kZS5yYkxlZnQsIC8vIGNhbid0IGJlIG51bGxcbiAgICAgICAgcGFyZW50ID0gcC5yYlBhcmVudDtcbiAgICBpZiAocGFyZW50KSB7XG4gICAgICAgIGlmIChwYXJlbnQucmJMZWZ0ID09PSBwKSB7XG4gICAgICAgICAgICBwYXJlbnQucmJMZWZ0ID0gcTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBwYXJlbnQucmJSaWdodCA9IHE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5yb290ID0gcTtcbiAgICAgICAgfVxuICAgIHEucmJQYXJlbnQgPSBwYXJlbnQ7XG4gICAgcC5yYlBhcmVudCA9IHE7XG4gICAgcC5yYkxlZnQgPSBxLnJiUmlnaHQ7XG4gICAgaWYgKHAucmJMZWZ0KSB7XG4gICAgICAgIHAucmJMZWZ0LnJiUGFyZW50ID0gcDtcbiAgICAgICAgfVxuICAgIHEucmJSaWdodCA9IHA7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuUkJUcmVlLnByb3RvdHlwZS5nZXRGaXJzdCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB3aGlsZSAobm9kZS5yYkxlZnQpIHtcbiAgICAgICAgbm9kZSA9IG5vZGUucmJMZWZ0O1xuICAgICAgICB9XG4gICAgcmV0dXJuIG5vZGU7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuUkJUcmVlLnByb3RvdHlwZS5nZXRMYXN0ID0gZnVuY3Rpb24obm9kZSkge1xuICAgIHdoaWxlIChub2RlLnJiUmlnaHQpIHtcbiAgICAgICAgbm9kZSA9IG5vZGUucmJSaWdodDtcbiAgICAgICAgfVxuICAgIHJldHVybiBub2RlO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gRGlhZ3JhbSBtZXRob2RzXG5cblZvcm9ub2kucHJvdG90eXBlLkRpYWdyYW0gPSBmdW5jdGlvbihzaXRlKSB7XG4gICAgdGhpcy5zaXRlID0gc2l0ZTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIENlbGwgbWV0aG9kc1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsID0gZnVuY3Rpb24oc2l0ZSkge1xuICAgIHRoaXMuc2l0ZSA9IHNpdGU7XG4gICAgdGhpcy5oYWxmZWRnZXMgPSBbXTtcbiAgICB0aGlzLmNsb3NlTWUgPSBmYWxzZTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oc2l0ZSkge1xuICAgIHRoaXMuc2l0ZSA9IHNpdGU7XG4gICAgdGhpcy5oYWxmZWRnZXMgPSBbXTtcbiAgICB0aGlzLmNsb3NlTWUgPSBmYWxzZTtcbiAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jcmVhdGVDZWxsID0gZnVuY3Rpb24oc2l0ZSkge1xuICAgIHZhciBjZWxsID0gdGhpcy5jZWxsSnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCBjZWxsICkge1xuICAgICAgICByZXR1cm4gY2VsbC5pbml0KHNpdGUpO1xuICAgICAgICB9XG4gICAgcmV0dXJuIG5ldyB0aGlzLkNlbGwoc2l0ZSk7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuQ2VsbC5wcm90b3R5cGUucHJlcGFyZUhhbGZlZGdlcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBoYWxmZWRnZXMgPSB0aGlzLmhhbGZlZGdlcyxcbiAgICAgICAgaUhhbGZlZGdlID0gaGFsZmVkZ2VzLmxlbmd0aCxcbiAgICAgICAgZWRnZTtcbiAgICAvLyBnZXQgcmlkIG9mIHVudXNlZCBoYWxmZWRnZXNcbiAgICAvLyByaGlsbCAyMDExLTA1LTI3OiBLZWVwIGl0IHNpbXBsZSwgbm8gcG9pbnQgaGVyZSBpbiB0cnlpbmdcbiAgICAvLyB0byBiZSBmYW5jeTogZGFuZ2xpbmcgZWRnZXMgYXJlIGEgdHlwaWNhbGx5IGEgbWlub3JpdHkuXG4gICAgd2hpbGUgKGlIYWxmZWRnZS0tKSB7XG4gICAgICAgIGVkZ2UgPSBoYWxmZWRnZXNbaUhhbGZlZGdlXS5lZGdlO1xuICAgICAgICBpZiAoIWVkZ2UudmIgfHwgIWVkZ2UudmEpIHtcbiAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUhhbGZlZGdlLDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAvLyByaGlsbCAyMDExLTA1LTI2OiBJIHRyaWVkIHRvIHVzZSBhIGJpbmFyeSBzZWFyY2ggYXQgaW5zZXJ0aW9uXG4gICAgLy8gdGltZSB0byBrZWVwIHRoZSBhcnJheSBzb3J0ZWQgb24tdGhlLWZseSAoaW4gQ2VsbC5hZGRIYWxmZWRnZSgpKS5cbiAgICAvLyBUaGVyZSB3YXMgbm8gcmVhbCBiZW5lZml0cyBpbiBkb2luZyBzbywgcGVyZm9ybWFuY2Ugb25cbiAgICAvLyBGaXJlZm94IDMuNiB3YXMgaW1wcm92ZWQgbWFyZ2luYWxseSwgd2hpbGUgcGVyZm9ybWFuY2Ugb25cbiAgICAvLyBPcGVyYSAxMSB3YXMgcGVuYWxpemVkIG1hcmdpbmFsbHkuXG4gICAgaGFsZmVkZ2VzLnNvcnQoZnVuY3Rpb24oYSxiKXtyZXR1cm4gYi5hbmdsZS1hLmFuZ2xlO30pO1xuICAgIHJldHVybiBoYWxmZWRnZXMubGVuZ3RoO1xuICAgIH07XG5cbi8vIFJldHVybiBhIGxpc3Qgb2YgdGhlIG5laWdoYm9yIElkc1xuVm9yb25vaS5wcm90b3R5cGUuQ2VsbC5wcm90b3R5cGUuZ2V0TmVpZ2hib3JJZHMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbmVpZ2hib3JzID0gW10sXG4gICAgICAgIGlIYWxmZWRnZSA9IHRoaXMuaGFsZmVkZ2VzLmxlbmd0aCxcbiAgICAgICAgZWRnZTtcbiAgICB3aGlsZSAoaUhhbGZlZGdlLS0pe1xuICAgICAgICBlZGdlID0gdGhpcy5oYWxmZWRnZXNbaUhhbGZlZGdlXS5lZGdlO1xuICAgICAgICBpZiAoZWRnZS5sU2l0ZSAhPT0gbnVsbCAmJiBlZGdlLmxTaXRlLnZvcm9ub2lJZCAhPSB0aGlzLnNpdGUudm9yb25vaUlkKSB7XG4gICAgICAgICAgICBuZWlnaGJvcnMucHVzaChlZGdlLmxTaXRlLnZvcm9ub2lJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGVkZ2UuclNpdGUgIT09IG51bGwgJiYgZWRnZS5yU2l0ZS52b3Jvbm9pSWQgIT0gdGhpcy5zaXRlLnZvcm9ub2lJZCl7XG4gICAgICAgICAgICBuZWlnaGJvcnMucHVzaChlZGdlLnJTaXRlLnZvcm9ub2lJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICByZXR1cm4gbmVpZ2hib3JzO1xuICAgIH07XG5cbi8vIENvbXB1dGUgYm91bmRpbmcgYm94XG4vL1xuVm9yb25vaS5wcm90b3R5cGUuQ2VsbC5wcm90b3R5cGUuZ2V0QmJveCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBoYWxmZWRnZXMgPSB0aGlzLmhhbGZlZGdlcyxcbiAgICAgICAgaUhhbGZlZGdlID0gaGFsZmVkZ2VzLmxlbmd0aCxcbiAgICAgICAgeG1pbiA9IEluZmluaXR5LFxuICAgICAgICB5bWluID0gSW5maW5pdHksXG4gICAgICAgIHhtYXggPSAtSW5maW5pdHksXG4gICAgICAgIHltYXggPSAtSW5maW5pdHksXG4gICAgICAgIHYsIHZ4LCB2eTtcbiAgICB3aGlsZSAoaUhhbGZlZGdlLS0pIHtcbiAgICAgICAgdiA9IGhhbGZlZGdlc1tpSGFsZmVkZ2VdLmdldFN0YXJ0cG9pbnQoKTtcbiAgICAgICAgdnggPSB2Lng7XG4gICAgICAgIHZ5ID0gdi55O1xuICAgICAgICBpZiAodnggPCB4bWluKSB7eG1pbiA9IHZ4O31cbiAgICAgICAgaWYgKHZ5IDwgeW1pbikge3ltaW4gPSB2eTt9XG4gICAgICAgIGlmICh2eCA+IHhtYXgpIHt4bWF4ID0gdng7fVxuICAgICAgICBpZiAodnkgPiB5bWF4KSB7eW1heCA9IHZ5O31cbiAgICAgICAgLy8gd2UgZG9udCBuZWVkIHRvIHRha2UgaW50byBhY2NvdW50IGVuZCBwb2ludCxcbiAgICAgICAgLy8gc2luY2UgZWFjaCBlbmQgcG9pbnQgbWF0Y2hlcyBhIHN0YXJ0IHBvaW50XG4gICAgICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICB4OiB4bWluLFxuICAgICAgICB5OiB5bWluLFxuICAgICAgICB3aWR0aDogeG1heC14bWluLFxuICAgICAgICBoZWlnaHQ6IHltYXgteW1pblxuICAgICAgICB9O1xuICAgIH07XG5cbi8vIFJldHVybiB3aGV0aGVyIGEgcG9pbnQgaXMgaW5zaWRlLCBvbiwgb3Igb3V0c2lkZSB0aGUgY2VsbDpcbi8vICAgLTE6IHBvaW50IGlzIG91dHNpZGUgdGhlIHBlcmltZXRlciBvZiB0aGUgY2VsbFxuLy8gICAgMDogcG9pbnQgaXMgb24gdGhlIHBlcmltZXRlciBvZiB0aGUgY2VsbFxuLy8gICAgMTogcG9pbnQgaXMgaW5zaWRlIHRoZSBwZXJpbWV0ZXIgb2YgdGhlIGNlbGxcbi8vXG5Wb3Jvbm9pLnByb3RvdHlwZS5DZWxsLnByb3RvdHlwZS5wb2ludEludGVyc2VjdGlvbiA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAvLyBDaGVjayBpZiBwb2ludCBpbiBwb2x5Z29uLiBTaW5jZSBhbGwgcG9seWdvbnMgb2YgYSBWb3Jvbm9pXG4gICAgLy8gZGlhZ3JhbSBhcmUgY29udmV4LCB0aGVuOlxuICAgIC8vIGh0dHA6Ly9wYXVsYm91cmtlLm5ldC9nZW9tZXRyeS9wb2x5Z29ubWVzaC9cbiAgICAvLyBTb2x1dGlvbiAzICgyRCk6XG4gICAgLy8gICBcIklmIHRoZSBwb2x5Z29uIGlzIGNvbnZleCB0aGVuIG9uZSBjYW4gY29uc2lkZXIgdGhlIHBvbHlnb25cbiAgICAvLyAgIFwiYXMgYSAncGF0aCcgZnJvbSB0aGUgZmlyc3QgdmVydGV4LiBBIHBvaW50IGlzIG9uIHRoZSBpbnRlcmlvclxuICAgIC8vICAgXCJvZiB0aGlzIHBvbHlnb25zIGlmIGl0IGlzIGFsd2F5cyBvbiB0aGUgc2FtZSBzaWRlIG9mIGFsbCB0aGVcbiAgICAvLyAgIFwibGluZSBzZWdtZW50cyBtYWtpbmcgdXAgdGhlIHBhdGguIC4uLlxuICAgIC8vICAgXCIoeSAtIHkwKSAoeDEgLSB4MCkgLSAoeCAtIHgwKSAoeTEgLSB5MClcbiAgICAvLyAgIFwiaWYgaXQgaXMgbGVzcyB0aGFuIDAgdGhlbiBQIGlzIHRvIHRoZSByaWdodCBvZiB0aGUgbGluZSBzZWdtZW50LFxuICAgIC8vICAgXCJpZiBncmVhdGVyIHRoYW4gMCBpdCBpcyB0byB0aGUgbGVmdCwgaWYgZXF1YWwgdG8gMCB0aGVuIGl0IGxpZXNcbiAgICAvLyAgIFwib24gdGhlIGxpbmUgc2VnbWVudFwiXG4gICAgdmFyIGhhbGZlZGdlcyA9IHRoaXMuaGFsZmVkZ2VzLFxuICAgICAgICBpSGFsZmVkZ2UgPSBoYWxmZWRnZXMubGVuZ3RoLFxuICAgICAgICBoYWxmZWRnZSxcbiAgICAgICAgcDAsIHAxLCByO1xuICAgIHdoaWxlIChpSGFsZmVkZ2UtLSkge1xuICAgICAgICBoYWxmZWRnZSA9IGhhbGZlZGdlc1tpSGFsZmVkZ2VdO1xuICAgICAgICBwMCA9IGhhbGZlZGdlLmdldFN0YXJ0cG9pbnQoKTtcbiAgICAgICAgcDEgPSBoYWxmZWRnZS5nZXRFbmRwb2ludCgpO1xuICAgICAgICByID0gKHktcDAueSkqKHAxLngtcDAueCktKHgtcDAueCkqKHAxLnktcDAueSk7XG4gICAgICAgIGlmICghcikge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIGlmIChyID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgcmV0dXJuIDE7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBFZGdlIG1ldGhvZHNcbi8vXG5cblZvcm9ub2kucHJvdG90eXBlLlZlcnRleCA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICB0aGlzLnggPSB4O1xuICAgIHRoaXMueSA9IHk7XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuRWRnZSA9IGZ1bmN0aW9uKGxTaXRlLCByU2l0ZSkge1xuICAgIHRoaXMubFNpdGUgPSBsU2l0ZTtcbiAgICB0aGlzLnJTaXRlID0gclNpdGU7XG4gICAgdGhpcy52YSA9IHRoaXMudmIgPSBudWxsO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLkhhbGZlZGdlID0gZnVuY3Rpb24oZWRnZSwgbFNpdGUsIHJTaXRlKSB7XG4gICAgdGhpcy5zaXRlID0gbFNpdGU7XG4gICAgdGhpcy5lZGdlID0gZWRnZTtcbiAgICAvLyAnYW5nbGUnIGlzIGEgdmFsdWUgdG8gYmUgdXNlZCBmb3IgcHJvcGVybHkgc29ydGluZyB0aGVcbiAgICAvLyBoYWxmc2VnbWVudHMgY291bnRlcmNsb2Nrd2lzZS4gQnkgY29udmVudGlvbiwgd2Ugd2lsbFxuICAgIC8vIHVzZSB0aGUgYW5nbGUgb2YgdGhlIGxpbmUgZGVmaW5lZCBieSB0aGUgJ3NpdGUgdG8gdGhlIGxlZnQnXG4gICAgLy8gdG8gdGhlICdzaXRlIHRvIHRoZSByaWdodCcuXG4gICAgLy8gSG93ZXZlciwgYm9yZGVyIGVkZ2VzIGhhdmUgbm8gJ3NpdGUgdG8gdGhlIHJpZ2h0JzogdGh1cyB3ZVxuICAgIC8vIHVzZSB0aGUgYW5nbGUgb2YgbGluZSBwZXJwZW5kaWN1bGFyIHRvIHRoZSBoYWxmc2VnbWVudCAodGhlXG4gICAgLy8gZWRnZSBzaG91bGQgaGF2ZSBib3RoIGVuZCBwb2ludHMgZGVmaW5lZCBpbiBzdWNoIGNhc2UuKVxuICAgIGlmIChyU2l0ZSkge1xuICAgICAgICB0aGlzLmFuZ2xlID0gTWF0aC5hdGFuMihyU2l0ZS55LWxTaXRlLnksIHJTaXRlLngtbFNpdGUueCk7XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIHZhID0gZWRnZS52YSxcbiAgICAgICAgICAgIHZiID0gZWRnZS52YjtcbiAgICAgICAgLy8gcmhpbGwgMjAxMS0wNS0zMTogdXNlZCB0byBjYWxsIGdldFN0YXJ0cG9pbnQoKS9nZXRFbmRwb2ludCgpLFxuICAgICAgICAvLyBidXQgZm9yIHBlcmZvcm1hbmNlIHB1cnBvc2UsIHRoZXNlIGFyZSBleHBhbmRlZCBpbiBwbGFjZSBoZXJlLlxuICAgICAgICB0aGlzLmFuZ2xlID0gZWRnZS5sU2l0ZSA9PT0gbFNpdGUgP1xuICAgICAgICAgICAgTWF0aC5hdGFuMih2Yi54LXZhLngsIHZhLnktdmIueSkgOlxuICAgICAgICAgICAgTWF0aC5hdGFuMih2YS54LXZiLngsIHZiLnktdmEueSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jcmVhdGVIYWxmZWRnZSA9IGZ1bmN0aW9uKGVkZ2UsIGxTaXRlLCByU2l0ZSkge1xuICAgIHJldHVybiBuZXcgdGhpcy5IYWxmZWRnZShlZGdlLCBsU2l0ZSwgclNpdGUpO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLkhhbGZlZGdlLnByb3RvdHlwZS5nZXRTdGFydHBvaW50ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZWRnZS5sU2l0ZSA9PT0gdGhpcy5zaXRlID8gdGhpcy5lZGdlLnZhIDogdGhpcy5lZGdlLnZiO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLkhhbGZlZGdlLnByb3RvdHlwZS5nZXRFbmRwb2ludCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmVkZ2UubFNpdGUgPT09IHRoaXMuc2l0ZSA/IHRoaXMuZWRnZS52YiA6IHRoaXMuZWRnZS52YTtcbiAgICB9O1xuXG5cblxuLy8gdGhpcyBjcmVhdGUgYW5kIGFkZCBhIHZlcnRleCB0byB0aGUgaW50ZXJuYWwgY29sbGVjdGlvblxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jcmVhdGVWZXJ0ZXggPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgdmFyIHYgPSB0aGlzLnZlcnRleEp1bmt5YXJkLnBvcCgpO1xuICAgIGlmICggIXYgKSB7XG4gICAgICAgIHYgPSBuZXcgdGhpcy5WZXJ0ZXgoeCwgeSk7XG4gICAgICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdi54ID0geDtcbiAgICAgICAgdi55ID0geTtcbiAgICAgICAgfVxuICAgIHRoaXMudmVydGljZXMucHVzaCh2KTtcbiAgICByZXR1cm4gdjtcbiAgICB9O1xuXG4vLyB0aGlzIGNyZWF0ZSBhbmQgYWRkIGFuIGVkZ2UgdG8gaW50ZXJuYWwgY29sbGVjdGlvbiwgYW5kIGFsc28gY3JlYXRlXG4vLyB0d28gaGFsZmVkZ2VzIHdoaWNoIGFyZSBhZGRlZCB0byBlYWNoIHNpdGUncyBjb3VudGVyY2xvY2t3aXNlIGFycmF5XG4vLyBvZiBoYWxmZWRnZXMuXG5cblZvcm9ub2kucHJvdG90eXBlLmNyZWF0ZUVkZ2UgPSBmdW5jdGlvbihsU2l0ZSwgclNpdGUsIHZhLCB2Yikge1xuICAgIHZhciBlZGdlID0gdGhpcy5lZGdlSnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCAhZWRnZSApIHtcbiAgICAgICAgZWRnZSA9IG5ldyB0aGlzLkVkZ2UobFNpdGUsIHJTaXRlKTtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBlZGdlLmxTaXRlID0gbFNpdGU7XG4gICAgICAgIGVkZ2UuclNpdGUgPSByU2l0ZTtcbiAgICAgICAgZWRnZS52YSA9IGVkZ2UudmIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICB0aGlzLmVkZ2VzLnB1c2goZWRnZSk7XG4gICAgaWYgKHZhKSB7XG4gICAgICAgIHRoaXMuc2V0RWRnZVN0YXJ0cG9pbnQoZWRnZSwgbFNpdGUsIHJTaXRlLCB2YSk7XG4gICAgICAgIH1cbiAgICBpZiAodmIpIHtcbiAgICAgICAgdGhpcy5zZXRFZGdlRW5kcG9pbnQoZWRnZSwgbFNpdGUsIHJTaXRlLCB2Yik7XG4gICAgICAgIH1cbiAgICB0aGlzLmNlbGxzW2xTaXRlLnZvcm9ub2lJZF0uaGFsZmVkZ2VzLnB1c2godGhpcy5jcmVhdGVIYWxmZWRnZShlZGdlLCBsU2l0ZSwgclNpdGUpKTtcbiAgICB0aGlzLmNlbGxzW3JTaXRlLnZvcm9ub2lJZF0uaGFsZmVkZ2VzLnB1c2godGhpcy5jcmVhdGVIYWxmZWRnZShlZGdlLCByU2l0ZSwgbFNpdGUpKTtcbiAgICByZXR1cm4gZWRnZTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5jcmVhdGVCb3JkZXJFZGdlID0gZnVuY3Rpb24obFNpdGUsIHZhLCB2Yikge1xuICAgIHZhciBlZGdlID0gdGhpcy5lZGdlSnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCAhZWRnZSApIHtcbiAgICAgICAgZWRnZSA9IG5ldyB0aGlzLkVkZ2UobFNpdGUsIG51bGwpO1xuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGVkZ2UubFNpdGUgPSBsU2l0ZTtcbiAgICAgICAgZWRnZS5yU2l0ZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICBlZGdlLnZhID0gdmE7XG4gICAgZWRnZS52YiA9IHZiO1xuICAgIHRoaXMuZWRnZXMucHVzaChlZGdlKTtcbiAgICByZXR1cm4gZWRnZTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5zZXRFZGdlU3RhcnRwb2ludCA9IGZ1bmN0aW9uKGVkZ2UsIGxTaXRlLCByU2l0ZSwgdmVydGV4KSB7XG4gICAgaWYgKCFlZGdlLnZhICYmICFlZGdlLnZiKSB7XG4gICAgICAgIGVkZ2UudmEgPSB2ZXJ0ZXg7XG4gICAgICAgIGVkZ2UubFNpdGUgPSBsU2l0ZTtcbiAgICAgICAgZWRnZS5yU2l0ZSA9IHJTaXRlO1xuICAgICAgICB9XG4gICAgZWxzZSBpZiAoZWRnZS5sU2l0ZSA9PT0gclNpdGUpIHtcbiAgICAgICAgZWRnZS52YiA9IHZlcnRleDtcbiAgICAgICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBlZGdlLnZhID0gdmVydGV4O1xuICAgICAgICB9XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuc2V0RWRnZUVuZHBvaW50ID0gZnVuY3Rpb24oZWRnZSwgbFNpdGUsIHJTaXRlLCB2ZXJ0ZXgpIHtcbiAgICB0aGlzLnNldEVkZ2VTdGFydHBvaW50KGVkZ2UsIHJTaXRlLCBsU2l0ZSwgdmVydGV4KTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEJlYWNobGluZSBtZXRob2RzXG5cbi8vIHJoaWxsIDIwMTEtMDYtMDc6IEZvciBzb21lIHJlYXNvbnMsIHBlcmZvcm1hbmNlIHN1ZmZlcnMgc2lnbmlmaWNhbnRseVxuLy8gd2hlbiBpbnN0YW5jaWF0aW5nIGEgbGl0ZXJhbCBvYmplY3QgaW5zdGVhZCBvZiBhbiBlbXB0eSBjdG9yXG5Wb3Jvbm9pLnByb3RvdHlwZS5CZWFjaHNlY3Rpb24gPSBmdW5jdGlvbigpIHtcbiAgICB9O1xuXG4vLyByaGlsbCAyMDExLTA2LTAyOiBBIGxvdCBvZiBCZWFjaHNlY3Rpb24gaW5zdGFuY2lhdGlvbnNcbi8vIG9jY3VyIGR1cmluZyB0aGUgY29tcHV0YXRpb24gb2YgdGhlIFZvcm9ub2kgZGlhZ3JhbSxcbi8vIHNvbWV3aGVyZSBiZXR3ZWVuIHRoZSBudW1iZXIgb2Ygc2l0ZXMgYW5kIHR3aWNlIHRoZVxuLy8gbnVtYmVyIG9mIHNpdGVzLCB3aGlsZSB0aGUgbnVtYmVyIG9mIEJlYWNoc2VjdGlvbnMgb24gdGhlXG4vLyBiZWFjaGxpbmUgYXQgYW55IGdpdmVuIHRpbWUgaXMgY29tcGFyYXRpdmVseSBsb3cuIEZvciB0aGlzXG4vLyByZWFzb24sIHdlIHJldXNlIGFscmVhZHkgY3JlYXRlZCBCZWFjaHNlY3Rpb25zLCBpbiBvcmRlclxuLy8gdG8gYXZvaWQgbmV3IG1lbW9yeSBhbGxvY2F0aW9uLiBUaGlzIHJlc3VsdGVkIGluIGEgbWVhc3VyYWJsZVxuLy8gcGVyZm9ybWFuY2UgZ2Fpbi5cblxuVm9yb25vaS5wcm90b3R5cGUuY3JlYXRlQmVhY2hzZWN0aW9uID0gZnVuY3Rpb24oc2l0ZSkge1xuICAgIHZhciBiZWFjaHNlY3Rpb24gPSB0aGlzLmJlYWNoc2VjdGlvbkp1bmt5YXJkLnBvcCgpO1xuICAgIGlmICghYmVhY2hzZWN0aW9uKSB7XG4gICAgICAgIGJlYWNoc2VjdGlvbiA9IG5ldyB0aGlzLkJlYWNoc2VjdGlvbigpO1xuICAgICAgICB9XG4gICAgYmVhY2hzZWN0aW9uLnNpdGUgPSBzaXRlO1xuICAgIHJldHVybiBiZWFjaHNlY3Rpb247XG4gICAgfTtcblxuLy8gY2FsY3VsYXRlIHRoZSBsZWZ0IGJyZWFrIHBvaW50IG9mIGEgcGFydGljdWxhciBiZWFjaCBzZWN0aW9uLFxuLy8gZ2l2ZW4gYSBwYXJ0aWN1bGFyIHN3ZWVwIGxpbmVcblZvcm9ub2kucHJvdG90eXBlLmxlZnRCcmVha1BvaW50ID0gZnVuY3Rpb24oYXJjLCBkaXJlY3RyaXgpIHtcbiAgICAvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1BhcmFib2xhXG4gICAgLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9RdWFkcmF0aWNfZXF1YXRpb25cbiAgICAvLyBoMSA9IHgxLFxuICAgIC8vIGsxID0gKHkxK2RpcmVjdHJpeCkvMixcbiAgICAvLyBoMiA9IHgyLFxuICAgIC8vIGsyID0gKHkyK2RpcmVjdHJpeCkvMixcbiAgICAvLyBwMSA9IGsxLWRpcmVjdHJpeCxcbiAgICAvLyBhMSA9IDEvKDQqcDEpLFxuICAgIC8vIGIxID0gLWgxLygyKnAxKSxcbiAgICAvLyBjMSA9IGgxKmgxLyg0KnAxKStrMSxcbiAgICAvLyBwMiA9IGsyLWRpcmVjdHJpeCxcbiAgICAvLyBhMiA9IDEvKDQqcDIpLFxuICAgIC8vIGIyID0gLWgyLygyKnAyKSxcbiAgICAvLyBjMiA9IGgyKmgyLyg0KnAyKStrMixcbiAgICAvLyB4ID0gKC0oYjItYjEpICsgTWF0aC5zcXJ0KChiMi1iMSkqKGIyLWIxKSAtIDQqKGEyLWExKSooYzItYzEpKSkgLyAoMiooYTItYTEpKVxuICAgIC8vIFdoZW4geDEgYmVjb21lIHRoZSB4LW9yaWdpbjpcbiAgICAvLyBoMSA9IDAsXG4gICAgLy8gazEgPSAoeTErZGlyZWN0cml4KS8yLFxuICAgIC8vIGgyID0geDIteDEsXG4gICAgLy8gazIgPSAoeTIrZGlyZWN0cml4KS8yLFxuICAgIC8vIHAxID0gazEtZGlyZWN0cml4LFxuICAgIC8vIGExID0gMS8oNCpwMSksXG4gICAgLy8gYjEgPSAwLFxuICAgIC8vIGMxID0gazEsXG4gICAgLy8gcDIgPSBrMi1kaXJlY3RyaXgsXG4gICAgLy8gYTIgPSAxLyg0KnAyKSxcbiAgICAvLyBiMiA9IC1oMi8oMipwMiksXG4gICAgLy8gYzIgPSBoMipoMi8oNCpwMikrazIsXG4gICAgLy8geCA9ICgtYjIgKyBNYXRoLnNxcnQoYjIqYjIgLSA0KihhMi1hMSkqKGMyLWsxKSkpIC8gKDIqKGEyLWExKSkgKyB4MVxuXG4gICAgLy8gY2hhbmdlIGNvZGUgYmVsb3cgYXQgeW91ciBvd24gcmlzazogY2FyZSBoYXMgYmVlbiB0YWtlbiB0b1xuICAgIC8vIHJlZHVjZSBlcnJvcnMgZHVlIHRvIGNvbXB1dGVycycgZmluaXRlIGFyaXRobWV0aWMgcHJlY2lzaW9uLlxuICAgIC8vIE1heWJlIGNhbiBzdGlsbCBiZSBpbXByb3ZlZCwgd2lsbCBzZWUgaWYgYW55IG1vcmUgb2YgdGhpc1xuICAgIC8vIGtpbmQgb2YgZXJyb3JzIHBvcCB1cCBhZ2Fpbi5cbiAgICB2YXIgc2l0ZSA9IGFyYy5zaXRlLFxuICAgICAgICByZm9jeCA9IHNpdGUueCxcbiAgICAgICAgcmZvY3kgPSBzaXRlLnksXG4gICAgICAgIHBieTIgPSByZm9jeS1kaXJlY3RyaXg7XG4gICAgLy8gcGFyYWJvbGEgaW4gZGVnZW5lcmF0ZSBjYXNlIHdoZXJlIGZvY3VzIGlzIG9uIGRpcmVjdHJpeFxuICAgIGlmICghcGJ5Mikge1xuICAgICAgICByZXR1cm4gcmZvY3g7XG4gICAgICAgIH1cbiAgICB2YXIgbEFyYyA9IGFyYy5yYlByZXZpb3VzO1xuICAgIGlmICghbEFyYykge1xuICAgICAgICByZXR1cm4gLUluZmluaXR5O1xuICAgICAgICB9XG4gICAgc2l0ZSA9IGxBcmMuc2l0ZTtcbiAgICB2YXIgbGZvY3ggPSBzaXRlLngsXG4gICAgICAgIGxmb2N5ID0gc2l0ZS55LFxuICAgICAgICBwbGJ5MiA9IGxmb2N5LWRpcmVjdHJpeDtcbiAgICAvLyBwYXJhYm9sYSBpbiBkZWdlbmVyYXRlIGNhc2Ugd2hlcmUgZm9jdXMgaXMgb24gZGlyZWN0cml4XG4gICAgaWYgKCFwbGJ5Mikge1xuICAgICAgICByZXR1cm4gbGZvY3g7XG4gICAgICAgIH1cbiAgICB2YXIgaGwgPSBsZm9jeC1yZm9jeCxcbiAgICAgICAgYWJ5MiA9IDEvcGJ5Mi0xL3BsYnkyLFxuICAgICAgICBiID0gaGwvcGxieTI7XG4gICAgaWYgKGFieTIpIHtcbiAgICAgICAgcmV0dXJuICgtYit0aGlzLnNxcnQoYipiLTIqYWJ5MiooaGwqaGwvKC0yKnBsYnkyKS1sZm9jeStwbGJ5Mi8yK3Jmb2N5LXBieTIvMikpKS9hYnkyK3Jmb2N4O1xuICAgICAgICB9XG4gICAgLy8gYm90aCBwYXJhYm9sYXMgaGF2ZSBzYW1lIGRpc3RhbmNlIHRvIGRpcmVjdHJpeCwgdGh1cyBicmVhayBwb2ludCBpcyBtaWR3YXlcbiAgICByZXR1cm4gKHJmb2N4K2xmb2N4KS8yO1xuICAgIH07XG5cbi8vIGNhbGN1bGF0ZSB0aGUgcmlnaHQgYnJlYWsgcG9pbnQgb2YgYSBwYXJ0aWN1bGFyIGJlYWNoIHNlY3Rpb24sXG4vLyBnaXZlbiBhIHBhcnRpY3VsYXIgZGlyZWN0cml4XG5Wb3Jvbm9pLnByb3RvdHlwZS5yaWdodEJyZWFrUG9pbnQgPSBmdW5jdGlvbihhcmMsIGRpcmVjdHJpeCkge1xuICAgIHZhciByQXJjID0gYXJjLnJiTmV4dDtcbiAgICBpZiAockFyYykge1xuICAgICAgICByZXR1cm4gdGhpcy5sZWZ0QnJlYWtQb2ludChyQXJjLCBkaXJlY3RyaXgpO1xuICAgICAgICB9XG4gICAgdmFyIHNpdGUgPSBhcmMuc2l0ZTtcbiAgICByZXR1cm4gc2l0ZS55ID09PSBkaXJlY3RyaXggPyBzaXRlLnggOiBJbmZpbml0eTtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5kZXRhY2hCZWFjaHNlY3Rpb24gPSBmdW5jdGlvbihiZWFjaHNlY3Rpb24pIHtcbiAgICB0aGlzLmRldGFjaENpcmNsZUV2ZW50KGJlYWNoc2VjdGlvbik7IC8vIGRldGFjaCBwb3RlbnRpYWxseSBhdHRhY2hlZCBjaXJjbGUgZXZlbnRcbiAgICB0aGlzLmJlYWNobGluZS5yYlJlbW92ZU5vZGUoYmVhY2hzZWN0aW9uKTsgLy8gcmVtb3ZlIGZyb20gUkItdHJlZVxuICAgIHRoaXMuYmVhY2hzZWN0aW9uSnVua3lhcmQucHVzaChiZWFjaHNlY3Rpb24pOyAvLyBtYXJrIGZvciByZXVzZVxuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLnJlbW92ZUJlYWNoc2VjdGlvbiA9IGZ1bmN0aW9uKGJlYWNoc2VjdGlvbikge1xuICAgIHZhciBjaXJjbGUgPSBiZWFjaHNlY3Rpb24uY2lyY2xlRXZlbnQsXG4gICAgICAgIHggPSBjaXJjbGUueCxcbiAgICAgICAgeSA9IGNpcmNsZS55Y2VudGVyLFxuICAgICAgICB2ZXJ0ZXggPSB0aGlzLmNyZWF0ZVZlcnRleCh4LCB5KSxcbiAgICAgICAgcHJldmlvdXMgPSBiZWFjaHNlY3Rpb24ucmJQcmV2aW91cyxcbiAgICAgICAgbmV4dCA9IGJlYWNoc2VjdGlvbi5yYk5leHQsXG4gICAgICAgIGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zID0gW2JlYWNoc2VjdGlvbl0sXG4gICAgICAgIGFic19mbiA9IE1hdGguYWJzO1xuXG4gICAgLy8gcmVtb3ZlIGNvbGxhcHNlZCBiZWFjaHNlY3Rpb24gZnJvbSBiZWFjaGxpbmVcbiAgICB0aGlzLmRldGFjaEJlYWNoc2VjdGlvbihiZWFjaHNlY3Rpb24pO1xuXG4gICAgLy8gdGhlcmUgY291bGQgYmUgbW9yZSB0aGFuIG9uZSBlbXB0eSBhcmMgYXQgdGhlIGRlbGV0aW9uIHBvaW50LCB0aGlzXG4gICAgLy8gaGFwcGVucyB3aGVuIG1vcmUgdGhhbiB0d28gZWRnZXMgYXJlIGxpbmtlZCBieSB0aGUgc2FtZSB2ZXJ0ZXgsXG4gICAgLy8gc28gd2Ugd2lsbCBjb2xsZWN0IGFsbCB0aG9zZSBlZGdlcyBieSBsb29raW5nIHVwIGJvdGggc2lkZXMgb2ZcbiAgICAvLyB0aGUgZGVsZXRpb24gcG9pbnQuXG4gICAgLy8gYnkgdGhlIHdheSwgdGhlcmUgaXMgKmFsd2F5cyogYSBwcmVkZWNlc3Nvci9zdWNjZXNzb3IgdG8gYW55IGNvbGxhcHNlZFxuICAgIC8vIGJlYWNoIHNlY3Rpb24sIGl0J3MganVzdCBpbXBvc3NpYmxlIHRvIGhhdmUgYSBjb2xsYXBzaW5nIGZpcnN0L2xhc3RcbiAgICAvLyBiZWFjaCBzZWN0aW9ucyBvbiB0aGUgYmVhY2hsaW5lLCBzaW5jZSB0aGV5IG9idmlvdXNseSBhcmUgdW5jb25zdHJhaW5lZFxuICAgIC8vIG9uIHRoZWlyIGxlZnQvcmlnaHQgc2lkZS5cblxuICAgIC8vIGxvb2sgbGVmdFxuICAgIHZhciBsQXJjID0gcHJldmlvdXM7XG4gICAgd2hpbGUgKGxBcmMuY2lyY2xlRXZlbnQgJiYgYWJzX2ZuKHgtbEFyYy5jaXJjbGVFdmVudC54KTwxZS05ICYmIGFic19mbih5LWxBcmMuY2lyY2xlRXZlbnQueWNlbnRlcik8MWUtOSkge1xuICAgICAgICBwcmV2aW91cyA9IGxBcmMucmJQcmV2aW91cztcbiAgICAgICAgZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnMudW5zaGlmdChsQXJjKTtcbiAgICAgICAgdGhpcy5kZXRhY2hCZWFjaHNlY3Rpb24obEFyYyk7IC8vIG1hcmsgZm9yIHJldXNlXG4gICAgICAgIGxBcmMgPSBwcmV2aW91cztcbiAgICAgICAgfVxuICAgIC8vIGV2ZW4gdGhvdWdoIGl0IGlzIG5vdCBkaXNhcHBlYXJpbmcsIEkgd2lsbCBhbHNvIGFkZCB0aGUgYmVhY2ggc2VjdGlvblxuICAgIC8vIGltbWVkaWF0ZWx5IHRvIHRoZSBsZWZ0IG9mIHRoZSBsZWZ0LW1vc3QgY29sbGFwc2VkIGJlYWNoIHNlY3Rpb24sIGZvclxuICAgIC8vIGNvbnZlbmllbmNlLCBzaW5jZSB3ZSBuZWVkIHRvIHJlZmVyIHRvIGl0IGxhdGVyIGFzIHRoaXMgYmVhY2ggc2VjdGlvblxuICAgIC8vIGlzIHRoZSAnbGVmdCcgc2l0ZSBvZiBhbiBlZGdlIGZvciB3aGljaCBhIHN0YXJ0IHBvaW50IGlzIHNldC5cbiAgICBkaXNhcHBlYXJpbmdUcmFuc2l0aW9ucy51bnNoaWZ0KGxBcmMpO1xuICAgIHRoaXMuZGV0YWNoQ2lyY2xlRXZlbnQobEFyYyk7XG5cbiAgICAvLyBsb29rIHJpZ2h0XG4gICAgdmFyIHJBcmMgPSBuZXh0O1xuICAgIHdoaWxlIChyQXJjLmNpcmNsZUV2ZW50ICYmIGFic19mbih4LXJBcmMuY2lyY2xlRXZlbnQueCk8MWUtOSAmJiBhYnNfZm4oeS1yQXJjLmNpcmNsZUV2ZW50LnljZW50ZXIpPDFlLTkpIHtcbiAgICAgICAgbmV4dCA9IHJBcmMucmJOZXh0O1xuICAgICAgICBkaXNhcHBlYXJpbmdUcmFuc2l0aW9ucy5wdXNoKHJBcmMpO1xuICAgICAgICB0aGlzLmRldGFjaEJlYWNoc2VjdGlvbihyQXJjKTsgLy8gbWFyayBmb3IgcmV1c2VcbiAgICAgICAgckFyYyA9IG5leHQ7XG4gICAgICAgIH1cbiAgICAvLyB3ZSBhbHNvIGhhdmUgdG8gYWRkIHRoZSBiZWFjaCBzZWN0aW9uIGltbWVkaWF0ZWx5IHRvIHRoZSByaWdodCBvZiB0aGVcbiAgICAvLyByaWdodC1tb3N0IGNvbGxhcHNlZCBiZWFjaCBzZWN0aW9uLCBzaW5jZSB0aGVyZSBpcyBhbHNvIGEgZGlzYXBwZWFyaW5nXG4gICAgLy8gdHJhbnNpdGlvbiByZXByZXNlbnRpbmcgYW4gZWRnZSdzIHN0YXJ0IHBvaW50IG9uIGl0cyBsZWZ0LlxuICAgIGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zLnB1c2gockFyYyk7XG4gICAgdGhpcy5kZXRhY2hDaXJjbGVFdmVudChyQXJjKTtcblxuICAgIC8vIHdhbGsgdGhyb3VnaCBhbGwgdGhlIGRpc2FwcGVhcmluZyB0cmFuc2l0aW9ucyBiZXR3ZWVuIGJlYWNoIHNlY3Rpb25zIGFuZFxuICAgIC8vIHNldCB0aGUgc3RhcnQgcG9pbnQgb2YgdGhlaXIgKGltcGxpZWQpIGVkZ2UuXG4gICAgdmFyIG5BcmNzID0gZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnMubGVuZ3RoLFxuICAgICAgICBpQXJjO1xuICAgIGZvciAoaUFyYz0xOyBpQXJjPG5BcmNzOyBpQXJjKyspIHtcbiAgICAgICAgckFyYyA9IGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zW2lBcmNdO1xuICAgICAgICBsQXJjID0gZGlzYXBwZWFyaW5nVHJhbnNpdGlvbnNbaUFyYy0xXTtcbiAgICAgICAgdGhpcy5zZXRFZGdlU3RhcnRwb2ludChyQXJjLmVkZ2UsIGxBcmMuc2l0ZSwgckFyYy5zaXRlLCB2ZXJ0ZXgpO1xuICAgICAgICB9XG5cbiAgICAvLyBjcmVhdGUgYSBuZXcgZWRnZSBhcyB3ZSBoYXZlIG5vdyBhIG5ldyB0cmFuc2l0aW9uIGJldHdlZW5cbiAgICAvLyB0d28gYmVhY2ggc2VjdGlvbnMgd2hpY2ggd2VyZSBwcmV2aW91c2x5IG5vdCBhZGphY2VudC5cbiAgICAvLyBzaW5jZSB0aGlzIGVkZ2UgYXBwZWFycyBhcyBhIG5ldyB2ZXJ0ZXggaXMgZGVmaW5lZCwgdGhlIHZlcnRleFxuICAgIC8vIGFjdHVhbGx5IGRlZmluZSBhbiBlbmQgcG9pbnQgb2YgdGhlIGVkZ2UgKHJlbGF0aXZlIHRvIHRoZSBzaXRlXG4gICAgLy8gb24gdGhlIGxlZnQpXG4gICAgbEFyYyA9IGRpc2FwcGVhcmluZ1RyYW5zaXRpb25zWzBdO1xuICAgIHJBcmMgPSBkaXNhcHBlYXJpbmdUcmFuc2l0aW9uc1tuQXJjcy0xXTtcbiAgICByQXJjLmVkZ2UgPSB0aGlzLmNyZWF0ZUVkZ2UobEFyYy5zaXRlLCByQXJjLnNpdGUsIHVuZGVmaW5lZCwgdmVydGV4KTtcblxuICAgIC8vIGNyZWF0ZSBjaXJjbGUgZXZlbnRzIGlmIGFueSBmb3IgYmVhY2ggc2VjdGlvbnMgbGVmdCBpbiB0aGUgYmVhY2hsaW5lXG4gICAgLy8gYWRqYWNlbnQgdG8gY29sbGFwc2VkIHNlY3Rpb25zXG4gICAgdGhpcy5hdHRhY2hDaXJjbGVFdmVudChsQXJjKTtcbiAgICB0aGlzLmF0dGFjaENpcmNsZUV2ZW50KHJBcmMpO1xuICAgIH07XG5cblZvcm9ub2kucHJvdG90eXBlLmFkZEJlYWNoc2VjdGlvbiA9IGZ1bmN0aW9uKHNpdGUpIHtcbiAgICB2YXIgeCA9IHNpdGUueCxcbiAgICAgICAgZGlyZWN0cml4ID0gc2l0ZS55O1xuXG4gICAgLy8gZmluZCB0aGUgbGVmdCBhbmQgcmlnaHQgYmVhY2ggc2VjdGlvbnMgd2hpY2ggd2lsbCBzdXJyb3VuZCB0aGUgbmV3bHlcbiAgICAvLyBjcmVhdGVkIGJlYWNoIHNlY3Rpb24uXG4gICAgLy8gcmhpbGwgMjAxMS0wNi0wMTogVGhpcyBsb29wIGlzIG9uZSBvZiB0aGUgbW9zdCBvZnRlbiBleGVjdXRlZCxcbiAgICAvLyBoZW5jZSB3ZSBleHBhbmQgaW4tcGxhY2UgdGhlIGNvbXBhcmlzb24tYWdhaW5zdC1lcHNpbG9uIGNhbGxzLlxuICAgIHZhciBsQXJjLCByQXJjLFxuICAgICAgICBkeGwsIGR4cixcbiAgICAgICAgbm9kZSA9IHRoaXMuYmVhY2hsaW5lLnJvb3Q7XG5cbiAgICB3aGlsZSAobm9kZSkge1xuICAgICAgICBkeGwgPSB0aGlzLmxlZnRCcmVha1BvaW50KG5vZGUsZGlyZWN0cml4KS14O1xuICAgICAgICAvLyB4IGxlc3NUaGFuV2l0aEVwc2lsb24geGwgPT4gZmFsbHMgc29tZXdoZXJlIGJlZm9yZSB0aGUgbGVmdCBlZGdlIG9mIHRoZSBiZWFjaHNlY3Rpb25cbiAgICAgICAgaWYgKGR4bCA+IDFlLTkpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgY2FzZSBzaG91bGQgbmV2ZXIgaGFwcGVuXG4gICAgICAgICAgICAvLyBpZiAoIW5vZGUucmJMZWZ0KSB7XG4gICAgICAgICAgICAvLyAgICByQXJjID0gbm9kZS5yYkxlZnQ7XG4gICAgICAgICAgICAvLyAgICBicmVhaztcbiAgICAgICAgICAgIC8vICAgIH1cbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnJiTGVmdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkeHIgPSB4LXRoaXMucmlnaHRCcmVha1BvaW50KG5vZGUsZGlyZWN0cml4KTtcbiAgICAgICAgICAgIC8vIHggZ3JlYXRlclRoYW5XaXRoRXBzaWxvbiB4ciA9PiBmYWxscyBzb21ld2hlcmUgYWZ0ZXIgdGhlIHJpZ2h0IGVkZ2Ugb2YgdGhlIGJlYWNoc2VjdGlvblxuICAgICAgICAgICAgaWYgKGR4ciA+IDFlLTkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGUucmJSaWdodCkge1xuICAgICAgICAgICAgICAgICAgICBsQXJjID0gbm9kZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5yYlJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHggZXF1YWxXaXRoRXBzaWxvbiB4bCA9PiBmYWxscyBleGFjdGx5IG9uIHRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIGJlYWNoc2VjdGlvblxuICAgICAgICAgICAgICAgIGlmIChkeGwgPiAtMWUtOSkge1xuICAgICAgICAgICAgICAgICAgICBsQXJjID0gbm9kZS5yYlByZXZpb3VzO1xuICAgICAgICAgICAgICAgICAgICByQXJjID0gbm9kZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIHggZXF1YWxXaXRoRXBzaWxvbiB4ciA9PiBmYWxscyBleGFjdGx5IG9uIHRoZSByaWdodCBlZGdlIG9mIHRoZSBiZWFjaHNlY3Rpb25cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChkeHIgPiAtMWUtOSkge1xuICAgICAgICAgICAgICAgICAgICBsQXJjID0gbm9kZTtcbiAgICAgICAgICAgICAgICAgICAgckFyYyA9IG5vZGUucmJOZXh0O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gZmFsbHMgZXhhY3RseSBzb21ld2hlcmUgaW4gdGhlIG1pZGRsZSBvZiB0aGUgYmVhY2hzZWN0aW9uXG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxBcmMgPSByQXJjID0gbm9kZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIC8vIGF0IHRoaXMgcG9pbnQsIGtlZXAgaW4gbWluZCB0aGF0IGxBcmMgYW5kL29yIHJBcmMgY291bGQgYmVcbiAgICAvLyB1bmRlZmluZWQgb3IgbnVsbC5cblxuICAgIC8vIGNyZWF0ZSBhIG5ldyBiZWFjaCBzZWN0aW9uIG9iamVjdCBmb3IgdGhlIHNpdGUgYW5kIGFkZCBpdCB0byBSQi10cmVlXG4gICAgdmFyIG5ld0FyYyA9IHRoaXMuY3JlYXRlQmVhY2hzZWN0aW9uKHNpdGUpO1xuICAgIHRoaXMuYmVhY2hsaW5lLnJiSW5zZXJ0U3VjY2Vzc29yKGxBcmMsIG5ld0FyYyk7XG5cbiAgICAvLyBjYXNlczpcbiAgICAvL1xuXG4gICAgLy8gW251bGwsbnVsbF1cbiAgICAvLyBsZWFzdCBsaWtlbHkgY2FzZTogbmV3IGJlYWNoIHNlY3Rpb24gaXMgdGhlIGZpcnN0IGJlYWNoIHNlY3Rpb24gb24gdGhlXG4gICAgLy8gYmVhY2hsaW5lLlxuICAgIC8vIFRoaXMgY2FzZSBtZWFuczpcbiAgICAvLyAgIG5vIG5ldyB0cmFuc2l0aW9uIGFwcGVhcnNcbiAgICAvLyAgIG5vIGNvbGxhcHNpbmcgYmVhY2ggc2VjdGlvblxuICAgIC8vICAgbmV3IGJlYWNoc2VjdGlvbiBiZWNvbWUgcm9vdCBvZiB0aGUgUkItdHJlZVxuICAgIGlmICghbEFyYyAmJiAhckFyYykge1xuICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgIC8vIFtsQXJjLHJBcmNdIHdoZXJlIGxBcmMgPT0gckFyY1xuICAgIC8vIG1vc3QgbGlrZWx5IGNhc2U6IG5ldyBiZWFjaCBzZWN0aW9uIHNwbGl0IGFuIGV4aXN0aW5nIGJlYWNoXG4gICAgLy8gc2VjdGlvbi5cbiAgICAvLyBUaGlzIGNhc2UgbWVhbnM6XG4gICAgLy8gICBvbmUgbmV3IHRyYW5zaXRpb24gYXBwZWFyc1xuICAgIC8vICAgdGhlIGxlZnQgYW5kIHJpZ2h0IGJlYWNoIHNlY3Rpb24gbWlnaHQgYmUgY29sbGFwc2luZyBhcyBhIHJlc3VsdFxuICAgIC8vICAgdHdvIG5ldyBub2RlcyBhZGRlZCB0byB0aGUgUkItdHJlZVxuICAgIGlmIChsQXJjID09PSByQXJjKSB7XG4gICAgICAgIC8vIGludmFsaWRhdGUgY2lyY2xlIGV2ZW50IG9mIHNwbGl0IGJlYWNoIHNlY3Rpb25cbiAgICAgICAgdGhpcy5kZXRhY2hDaXJjbGVFdmVudChsQXJjKTtcblxuICAgICAgICAvLyBzcGxpdCB0aGUgYmVhY2ggc2VjdGlvbiBpbnRvIHR3byBzZXBhcmF0ZSBiZWFjaCBzZWN0aW9uc1xuICAgICAgICByQXJjID0gdGhpcy5jcmVhdGVCZWFjaHNlY3Rpb24obEFyYy5zaXRlKTtcbiAgICAgICAgdGhpcy5iZWFjaGxpbmUucmJJbnNlcnRTdWNjZXNzb3IobmV3QXJjLCByQXJjKTtcblxuICAgICAgICAvLyBzaW5jZSB3ZSBoYXZlIGEgbmV3IHRyYW5zaXRpb24gYmV0d2VlbiB0d28gYmVhY2ggc2VjdGlvbnMsXG4gICAgICAgIC8vIGEgbmV3IGVkZ2UgaXMgYm9yblxuICAgICAgICBuZXdBcmMuZWRnZSA9IHJBcmMuZWRnZSA9IHRoaXMuY3JlYXRlRWRnZShsQXJjLnNpdGUsIG5ld0FyYy5zaXRlKTtcblxuICAgICAgICAvLyBjaGVjayB3aGV0aGVyIHRoZSBsZWZ0IGFuZCByaWdodCBiZWFjaCBzZWN0aW9ucyBhcmUgY29sbGFwc2luZ1xuICAgICAgICAvLyBhbmQgaWYgc28gY3JlYXRlIGNpcmNsZSBldmVudHMsIHRvIGJlIG5vdGlmaWVkIHdoZW4gdGhlIHBvaW50IG9mXG4gICAgICAgIC8vIGNvbGxhcHNlIGlzIHJlYWNoZWQuXG4gICAgICAgIHRoaXMuYXR0YWNoQ2lyY2xlRXZlbnQobEFyYyk7XG4gICAgICAgIHRoaXMuYXR0YWNoQ2lyY2xlRXZlbnQockFyYyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgLy8gW2xBcmMsbnVsbF1cbiAgICAvLyBldmVuIGxlc3MgbGlrZWx5IGNhc2U6IG5ldyBiZWFjaCBzZWN0aW9uIGlzIHRoZSAqbGFzdCogYmVhY2ggc2VjdGlvblxuICAgIC8vIG9uIHRoZSBiZWFjaGxpbmUgLS0gdGhpcyBjYW4gaGFwcGVuICpvbmx5KiBpZiAqYWxsKiB0aGUgcHJldmlvdXMgYmVhY2hcbiAgICAvLyBzZWN0aW9ucyBjdXJyZW50bHkgb24gdGhlIGJlYWNobGluZSBzaGFyZSB0aGUgc2FtZSB5IHZhbHVlIGFzXG4gICAgLy8gdGhlIG5ldyBiZWFjaCBzZWN0aW9uLlxuICAgIC8vIFRoaXMgY2FzZSBtZWFuczpcbiAgICAvLyAgIG9uZSBuZXcgdHJhbnNpdGlvbiBhcHBlYXJzXG4gICAgLy8gICBubyBjb2xsYXBzaW5nIGJlYWNoIHNlY3Rpb24gYXMgYSByZXN1bHRcbiAgICAvLyAgIG5ldyBiZWFjaCBzZWN0aW9uIGJlY29tZSByaWdodC1tb3N0IG5vZGUgb2YgdGhlIFJCLXRyZWVcbiAgICBpZiAobEFyYyAmJiAhckFyYykge1xuICAgICAgICBuZXdBcmMuZWRnZSA9IHRoaXMuY3JlYXRlRWRnZShsQXJjLnNpdGUsbmV3QXJjLnNpdGUpO1xuICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgIC8vIFtudWxsLHJBcmNdXG4gICAgLy8gaW1wb3NzaWJsZSBjYXNlOiBiZWNhdXNlIHNpdGVzIGFyZSBzdHJpY3RseSBwcm9jZXNzZWQgZnJvbSB0b3AgdG8gYm90dG9tLFxuICAgIC8vIGFuZCBsZWZ0IHRvIHJpZ2h0LCB3aGljaCBndWFyYW50ZWVzIHRoYXQgdGhlcmUgd2lsbCBhbHdheXMgYmUgYSBiZWFjaCBzZWN0aW9uXG4gICAgLy8gb24gdGhlIGxlZnQgLS0gZXhjZXB0IG9mIGNvdXJzZSB3aGVuIHRoZXJlIGFyZSBubyBiZWFjaCBzZWN0aW9uIGF0IGFsbCBvblxuICAgIC8vIHRoZSBiZWFjaCBsaW5lLCB3aGljaCBjYXNlIHdhcyBoYW5kbGVkIGFib3ZlLlxuICAgIC8vIHJoaWxsIDIwMTEtMDYtMDI6IE5vIHBvaW50IHRlc3RpbmcgaW4gbm9uLWRlYnVnIHZlcnNpb25cbiAgICAvL2lmICghbEFyYyAmJiByQXJjKSB7XG4gICAgLy8gICAgdGhyb3cgXCJWb3Jvbm9pLmFkZEJlYWNoc2VjdGlvbigpOiBXaGF0IGlzIHRoaXMgSSBkb24ndCBldmVuXCI7XG4gICAgLy8gICAgfVxuXG4gICAgLy8gW2xBcmMsckFyY10gd2hlcmUgbEFyYyAhPSByQXJjXG4gICAgLy8gc29tZXdoYXQgbGVzcyBsaWtlbHkgY2FzZTogbmV3IGJlYWNoIHNlY3Rpb24gZmFsbHMgKmV4YWN0bHkqIGluIGJldHdlZW4gdHdvXG4gICAgLy8gZXhpc3RpbmcgYmVhY2ggc2VjdGlvbnNcbiAgICAvLyBUaGlzIGNhc2UgbWVhbnM6XG4gICAgLy8gICBvbmUgdHJhbnNpdGlvbiBkaXNhcHBlYXJzXG4gICAgLy8gICB0d28gbmV3IHRyYW5zaXRpb25zIGFwcGVhclxuICAgIC8vICAgdGhlIGxlZnQgYW5kIHJpZ2h0IGJlYWNoIHNlY3Rpb24gbWlnaHQgYmUgY29sbGFwc2luZyBhcyBhIHJlc3VsdFxuICAgIC8vICAgb25seSBvbmUgbmV3IG5vZGUgYWRkZWQgdG8gdGhlIFJCLXRyZWVcbiAgICBpZiAobEFyYyAhPT0gckFyYykge1xuICAgICAgICAvLyBpbnZhbGlkYXRlIGNpcmNsZSBldmVudHMgb2YgbGVmdCBhbmQgcmlnaHQgc2l0ZXNcbiAgICAgICAgdGhpcy5kZXRhY2hDaXJjbGVFdmVudChsQXJjKTtcbiAgICAgICAgdGhpcy5kZXRhY2hDaXJjbGVFdmVudChyQXJjKTtcblxuICAgICAgICAvLyBhbiBleGlzdGluZyB0cmFuc2l0aW9uIGRpc2FwcGVhcnMsIG1lYW5pbmcgYSB2ZXJ0ZXggaXMgZGVmaW5lZCBhdFxuICAgICAgICAvLyB0aGUgZGlzYXBwZWFyYW5jZSBwb2ludC5cbiAgICAgICAgLy8gc2luY2UgdGhlIGRpc2FwcGVhcmFuY2UgaXMgY2F1c2VkIGJ5IHRoZSBuZXcgYmVhY2hzZWN0aW9uLCB0aGVcbiAgICAgICAgLy8gdmVydGV4IGlzIGF0IHRoZSBjZW50ZXIgb2YgdGhlIGNpcmN1bXNjcmliZWQgY2lyY2xlIG9mIHRoZSBsZWZ0LFxuICAgICAgICAvLyBuZXcgYW5kIHJpZ2h0IGJlYWNoc2VjdGlvbnMuXG4gICAgICAgIC8vIGh0dHA6Ly9tYXRoZm9ydW0ub3JnL2xpYnJhcnkvZHJtYXRoL3ZpZXcvNTUwMDIuaHRtbFxuICAgICAgICAvLyBFeGNlcHQgdGhhdCBJIGJyaW5nIHRoZSBvcmlnaW4gYXQgQSB0byBzaW1wbGlmeVxuICAgICAgICAvLyBjYWxjdWxhdGlvblxuICAgICAgICB2YXIgbFNpdGUgPSBsQXJjLnNpdGUsXG4gICAgICAgICAgICBheCA9IGxTaXRlLngsXG4gICAgICAgICAgICBheSA9IGxTaXRlLnksXG4gICAgICAgICAgICBieD1zaXRlLngtYXgsXG4gICAgICAgICAgICBieT1zaXRlLnktYXksXG4gICAgICAgICAgICByU2l0ZSA9IHJBcmMuc2l0ZSxcbiAgICAgICAgICAgIGN4PXJTaXRlLngtYXgsXG4gICAgICAgICAgICBjeT1yU2l0ZS55LWF5LFxuICAgICAgICAgICAgZD0yKihieCpjeS1ieSpjeCksXG4gICAgICAgICAgICBoYj1ieCpieCtieSpieSxcbiAgICAgICAgICAgIGhjPWN4KmN4K2N5KmN5LFxuICAgICAgICAgICAgdmVydGV4ID0gdGhpcy5jcmVhdGVWZXJ0ZXgoKGN5KmhiLWJ5KmhjKS9kK2F4LCAoYngqaGMtY3gqaGIpL2QrYXkpO1xuXG4gICAgICAgIC8vIG9uZSB0cmFuc2l0aW9uIGRpc2FwcGVhclxuICAgICAgICB0aGlzLnNldEVkZ2VTdGFydHBvaW50KHJBcmMuZWRnZSwgbFNpdGUsIHJTaXRlLCB2ZXJ0ZXgpO1xuXG4gICAgICAgIC8vIHR3byBuZXcgdHJhbnNpdGlvbnMgYXBwZWFyIGF0IHRoZSBuZXcgdmVydGV4IGxvY2F0aW9uXG4gICAgICAgIG5ld0FyYy5lZGdlID0gdGhpcy5jcmVhdGVFZGdlKGxTaXRlLCBzaXRlLCB1bmRlZmluZWQsIHZlcnRleCk7XG4gICAgICAgIHJBcmMuZWRnZSA9IHRoaXMuY3JlYXRlRWRnZShzaXRlLCByU2l0ZSwgdW5kZWZpbmVkLCB2ZXJ0ZXgpO1xuXG4gICAgICAgIC8vIGNoZWNrIHdoZXRoZXIgdGhlIGxlZnQgYW5kIHJpZ2h0IGJlYWNoIHNlY3Rpb25zIGFyZSBjb2xsYXBzaW5nXG4gICAgICAgIC8vIGFuZCBpZiBzbyBjcmVhdGUgY2lyY2xlIGV2ZW50cywgdG8gaGFuZGxlIHRoZSBwb2ludCBvZiBjb2xsYXBzZS5cbiAgICAgICAgdGhpcy5hdHRhY2hDaXJjbGVFdmVudChsQXJjKTtcbiAgICAgICAgdGhpcy5hdHRhY2hDaXJjbGVFdmVudChyQXJjKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBDaXJjbGUgZXZlbnQgbWV0aG9kc1xuXG4vLyByaGlsbCAyMDExLTA2LTA3OiBGb3Igc29tZSByZWFzb25zLCBwZXJmb3JtYW5jZSBzdWZmZXJzIHNpZ25pZmljYW50bHlcbi8vIHdoZW4gaW5zdGFuY2lhdGluZyBhIGxpdGVyYWwgb2JqZWN0IGluc3RlYWQgb2YgYW4gZW1wdHkgY3RvclxuVm9yb25vaS5wcm90b3R5cGUuQ2lyY2xlRXZlbnQgPSBmdW5jdGlvbigpIHtcbiAgICAvLyByaGlsbCAyMDEzLTEwLTEyOiBpdCBoZWxwcyB0byBzdGF0ZSBleGFjdGx5IHdoYXQgd2UgYXJlIGF0IGN0b3IgdGltZS5cbiAgICB0aGlzLmFyYyA9IG51bGw7XG4gICAgdGhpcy5yYkxlZnQgPSBudWxsO1xuICAgIHRoaXMucmJOZXh0ID0gbnVsbDtcbiAgICB0aGlzLnJiUGFyZW50ID0gbnVsbDtcbiAgICB0aGlzLnJiUHJldmlvdXMgPSBudWxsO1xuICAgIHRoaXMucmJSZWQgPSBmYWxzZTtcbiAgICB0aGlzLnJiUmlnaHQgPSBudWxsO1xuICAgIHRoaXMuc2l0ZSA9IG51bGw7XG4gICAgdGhpcy54ID0gdGhpcy55ID0gdGhpcy55Y2VudGVyID0gMDtcbiAgICB9O1xuXG5Wb3Jvbm9pLnByb3RvdHlwZS5hdHRhY2hDaXJjbGVFdmVudCA9IGZ1bmN0aW9uKGFyYykge1xuICAgIHZhciBsQXJjID0gYXJjLnJiUHJldmlvdXMsXG4gICAgICAgIHJBcmMgPSBhcmMucmJOZXh0O1xuICAgIGlmICghbEFyYyB8fCAhckFyYykge3JldHVybjt9IC8vIGRvZXMgdGhhdCBldmVyIGhhcHBlbj9cbiAgICB2YXIgbFNpdGUgPSBsQXJjLnNpdGUsXG4gICAgICAgIGNTaXRlID0gYXJjLnNpdGUsXG4gICAgICAgIHJTaXRlID0gckFyYy5zaXRlO1xuXG4gICAgLy8gSWYgc2l0ZSBvZiBsZWZ0IGJlYWNoc2VjdGlvbiBpcyBzYW1lIGFzIHNpdGUgb2ZcbiAgICAvLyByaWdodCBiZWFjaHNlY3Rpb24sIHRoZXJlIGNhbid0IGJlIGNvbnZlcmdlbmNlXG4gICAgaWYgKGxTaXRlPT09clNpdGUpIHtyZXR1cm47fVxuXG4gICAgLy8gRmluZCB0aGUgY2lyY3Vtc2NyaWJlZCBjaXJjbGUgZm9yIHRoZSB0aHJlZSBzaXRlcyBhc3NvY2lhdGVkXG4gICAgLy8gd2l0aCB0aGUgYmVhY2hzZWN0aW9uIHRyaXBsZXQuXG4gICAgLy8gcmhpbGwgMjAxMS0wNS0yNjogSXQgaXMgbW9yZSBlZmZpY2llbnQgdG8gY2FsY3VsYXRlIGluLXBsYWNlXG4gICAgLy8gcmF0aGVyIHRoYW4gZ2V0dGluZyB0aGUgcmVzdWx0aW5nIGNpcmN1bXNjcmliZWQgY2lyY2xlIGZyb20gYW5cbiAgICAvLyBvYmplY3QgcmV0dXJuZWQgYnkgY2FsbGluZyBWb3Jvbm9pLmNpcmN1bWNpcmNsZSgpXG4gICAgLy8gaHR0cDovL21hdGhmb3J1bS5vcmcvbGlicmFyeS9kcm1hdGgvdmlldy81NTAwMi5odG1sXG4gICAgLy8gRXhjZXB0IHRoYXQgSSBicmluZyB0aGUgb3JpZ2luIGF0IGNTaXRlIHRvIHNpbXBsaWZ5IGNhbGN1bGF0aW9ucy5cbiAgICAvLyBUaGUgYm90dG9tLW1vc3QgcGFydCBvZiB0aGUgY2lyY3VtY2lyY2xlIGlzIG91ciBGb3J0dW5lICdjaXJjbGVcbiAgICAvLyBldmVudCcsIGFuZCBpdHMgY2VudGVyIGlzIGEgdmVydGV4IHBvdGVudGlhbGx5IHBhcnQgb2YgdGhlIGZpbmFsXG4gICAgLy8gVm9yb25vaSBkaWFncmFtLlxuICAgIHZhciBieCA9IGNTaXRlLngsXG4gICAgICAgIGJ5ID0gY1NpdGUueSxcbiAgICAgICAgYXggPSBsU2l0ZS54LWJ4LFxuICAgICAgICBheSA9IGxTaXRlLnktYnksXG4gICAgICAgIGN4ID0gclNpdGUueC1ieCxcbiAgICAgICAgY3kgPSByU2l0ZS55LWJ5O1xuXG4gICAgLy8gSWYgcG9pbnRzIGwtPmMtPnIgYXJlIGNsb2Nrd2lzZSwgdGhlbiBjZW50ZXIgYmVhY2ggc2VjdGlvbiBkb2VzIG5vdFxuICAgIC8vIGNvbGxhcHNlLCBoZW5jZSBpdCBjYW4ndCBlbmQgdXAgYXMgYSB2ZXJ0ZXggKHdlIHJldXNlICdkJyBoZXJlLCB3aGljaFxuICAgIC8vIHNpZ24gaXMgcmV2ZXJzZSBvZiB0aGUgb3JpZW50YXRpb24sIGhlbmNlIHdlIHJldmVyc2UgdGhlIHRlc3QuXG4gICAgLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9DdXJ2ZV9vcmllbnRhdGlvbiNPcmllbnRhdGlvbl9vZl9hX3NpbXBsZV9wb2x5Z29uXG4gICAgLy8gcmhpbGwgMjAxMS0wNS0yMTogTmFzdHkgZmluaXRlIHByZWNpc2lvbiBlcnJvciB3aGljaCBjYXVzZWQgY2lyY3VtY2lyY2xlKCkgdG9cbiAgICAvLyByZXR1cm4gaW5maW5pdGVzOiAxZS0xMiBzZWVtcyB0byBmaXggdGhlIHByb2JsZW0uXG4gICAgdmFyIGQgPSAyKihheCpjeS1heSpjeCk7XG4gICAgaWYgKGQgPj0gLTJlLTEyKXtyZXR1cm47fVxuXG4gICAgdmFyIGhhID0gYXgqYXgrYXkqYXksXG4gICAgICAgIGhjID0gY3gqY3grY3kqY3ksXG4gICAgICAgIHggPSAoY3kqaGEtYXkqaGMpL2QsXG4gICAgICAgIHkgPSAoYXgqaGMtY3gqaGEpL2QsXG4gICAgICAgIHljZW50ZXIgPSB5K2J5O1xuXG4gICAgLy8gSW1wb3J0YW50OiB5Ym90dG9tIHNob3VsZCBhbHdheXMgYmUgdW5kZXIgb3IgYXQgc3dlZXAsIHNvIG5vIG5lZWRcbiAgICAvLyB0byB3YXN0ZSBDUFUgY3ljbGVzIGJ5IGNoZWNraW5nXG5cbiAgICAvLyByZWN5Y2xlIGNpcmNsZSBldmVudCBvYmplY3QgaWYgcG9zc2libGVcbiAgICB2YXIgY2lyY2xlRXZlbnQgPSB0aGlzLmNpcmNsZUV2ZW50SnVua3lhcmQucG9wKCk7XG4gICAgaWYgKCFjaXJjbGVFdmVudCkge1xuICAgICAgICBjaXJjbGVFdmVudCA9IG5ldyB0aGlzLkNpcmNsZUV2ZW50KCk7XG4gICAgICAgIH1cbiAgICBjaXJjbGVFdmVudC5hcmMgPSBhcmM7XG4gICAgY2lyY2xlRXZlbnQuc2l0ZSA9IGNTaXRlO1xuICAgIGNpcmNsZUV2ZW50LnggPSB4K2J4O1xuICAgIGNpcmNsZUV2ZW50LnkgPSB5Y2VudGVyK3RoaXMuc3FydCh4KngreSp5KTsgLy8geSBib3R0b21cbiAgICBjaXJjbGVFdmVudC55Y2VudGVyID0geWNlbnRlcjtcbiAgICBhcmMuY2lyY2xlRXZlbnQgPSBjaXJjbGVFdmVudDtcblxuICAgIC8vIGZpbmQgaW5zZXJ0aW9uIHBvaW50IGluIFJCLXRyZWU6IGNpcmNsZSBldmVudHMgYXJlIG9yZGVyZWQgZnJvbVxuICAgIC8vIHNtYWxsZXN0IHRvIGxhcmdlc3RcbiAgICB2YXIgcHJlZGVjZXNzb3IgPSBudWxsLFxuICAgICAgICBub2RlID0gdGhpcy5jaXJjbGVFdmVudHMucm9vdDtcbiAgICB3aGlsZSAobm9kZSkge1xuICAgICAgICBpZiAoY2lyY2xlRXZlbnQueSA8IG5vZGUueSB8fCAoY2lyY2xlRXZlbnQueSA9PT0gbm9kZS55ICYmIGNpcmNsZUV2ZW50LnggPD0gbm9kZS54KSkge1xuICAgICAgICAgICAgaWYgKG5vZGUucmJMZWZ0KSB7XG4gICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUucmJMZWZ0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHByZWRlY2Vzc29yID0gbm9kZS5yYlByZXZpb3VzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAobm9kZS5yYlJpZ2h0KSB7XG4gICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUucmJSaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBwcmVkZWNlc3NvciA9IG5vZGU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgdGhpcy5jaXJjbGVFdmVudHMucmJJbnNlcnRTdWNjZXNzb3IocHJlZGVjZXNzb3IsIGNpcmNsZUV2ZW50KTtcbiAgICBpZiAoIXByZWRlY2Vzc29yKSB7XG4gICAgICAgIHRoaXMuZmlyc3RDaXJjbGVFdmVudCA9IGNpcmNsZUV2ZW50O1xuICAgICAgICB9XG4gICAgfTtcblxuVm9yb25vaS5wcm90b3R5cGUuZGV0YWNoQ2lyY2xlRXZlbnQgPSBmdW5jdGlvbihhcmMpIHtcbiAgICB2YXIgY2lyY2xlRXZlbnQgPSBhcmMuY2lyY2xlRXZlbnQ7XG4gICAgaWYgKGNpcmNsZUV2ZW50KSB7XG4gICAgICAgIGlmICghY2lyY2xlRXZlbnQucmJQcmV2aW91cykge1xuICAgICAgICAgICAgdGhpcy5maXJzdENpcmNsZUV2ZW50ID0gY2lyY2xlRXZlbnQucmJOZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB0aGlzLmNpcmNsZUV2ZW50cy5yYlJlbW92ZU5vZGUoY2lyY2xlRXZlbnQpOyAvLyByZW1vdmUgZnJvbSBSQi10cmVlXG4gICAgICAgIHRoaXMuY2lyY2xlRXZlbnRKdW5reWFyZC5wdXNoKGNpcmNsZUV2ZW50KTtcbiAgICAgICAgYXJjLmNpcmNsZUV2ZW50ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gRGlhZ3JhbSBjb21wbGV0aW9uIG1ldGhvZHNcblxuLy8gY29ubmVjdCBkYW5nbGluZyBlZGdlcyAobm90IGlmIGEgY3Vyc29yeSB0ZXN0IHRlbGxzIHVzXG4vLyBpdCBpcyBub3QgZ29pbmcgdG8gYmUgdmlzaWJsZS5cbi8vIHJldHVybiB2YWx1ZTpcbi8vICAgZmFsc2U6IHRoZSBkYW5nbGluZyBlbmRwb2ludCBjb3VsZG4ndCBiZSBjb25uZWN0ZWRcbi8vICAgdHJ1ZTogdGhlIGRhbmdsaW5nIGVuZHBvaW50IGNvdWxkIGJlIGNvbm5lY3RlZFxuVm9yb25vaS5wcm90b3R5cGUuY29ubmVjdEVkZ2UgPSBmdW5jdGlvbihlZGdlLCBiYm94KSB7XG4gICAgLy8gc2tpcCBpZiBlbmQgcG9pbnQgYWxyZWFkeSBjb25uZWN0ZWRcbiAgICB2YXIgdmIgPSBlZGdlLnZiO1xuICAgIGlmICghIXZiKSB7cmV0dXJuIHRydWU7fVxuXG4gICAgLy8gbWFrZSBsb2NhbCBjb3B5IGZvciBwZXJmb3JtYW5jZSBwdXJwb3NlXG4gICAgdmFyIHZhID0gZWRnZS52YSxcbiAgICAgICAgeGwgPSBiYm94LnhsLFxuICAgICAgICB4ciA9IGJib3gueHIsXG4gICAgICAgIHl0ID0gYmJveC55dCxcbiAgICAgICAgeWIgPSBiYm94LnliLFxuICAgICAgICBsU2l0ZSA9IGVkZ2UubFNpdGUsXG4gICAgICAgIHJTaXRlID0gZWRnZS5yU2l0ZSxcbiAgICAgICAgbHggPSBsU2l0ZS54LFxuICAgICAgICBseSA9IGxTaXRlLnksXG4gICAgICAgIHJ4ID0gclNpdGUueCxcbiAgICAgICAgcnkgPSByU2l0ZS55LFxuICAgICAgICBmeCA9IChseCtyeCkvMixcbiAgICAgICAgZnkgPSAobHkrcnkpLzIsXG4gICAgICAgIGZtLCBmYjtcblxuICAgIC8vIGlmIHdlIHJlYWNoIGhlcmUsIHRoaXMgbWVhbnMgY2VsbHMgd2hpY2ggdXNlIHRoaXMgZWRnZSB3aWxsIG5lZWRcbiAgICAvLyB0byBiZSBjbG9zZWQsIHdoZXRoZXIgYmVjYXVzZSB0aGUgZWRnZSB3YXMgcmVtb3ZlZCwgb3IgYmVjYXVzZSBpdFxuICAgIC8vIHdhcyBjb25uZWN0ZWQgdG8gdGhlIGJvdW5kaW5nIGJveC5cbiAgICB0aGlzLmNlbGxzW2xTaXRlLnZvcm9ub2lJZF0uY2xvc2VNZSA9IHRydWU7XG4gICAgdGhpcy5jZWxsc1tyU2l0ZS52b3Jvbm9pSWRdLmNsb3NlTWUgPSB0cnVlO1xuXG4gICAgLy8gZ2V0IHRoZSBsaW5lIGVxdWF0aW9uIG9mIHRoZSBiaXNlY3RvciBpZiBsaW5lIGlzIG5vdCB2ZXJ0aWNhbFxuICAgIGlmIChyeSAhPT0gbHkpIHtcbiAgICAgICAgZm0gPSAobHgtcngpLyhyeS1seSk7XG4gICAgICAgIGZiID0gZnktZm0qZng7XG4gICAgICAgIH1cblxuICAgIC8vIHJlbWVtYmVyLCBkaXJlY3Rpb24gb2YgbGluZSAocmVsYXRpdmUgdG8gbGVmdCBzaXRlKTpcbiAgICAvLyB1cHdhcmQ6IGxlZnQueCA8IHJpZ2h0LnhcbiAgICAvLyBkb3dud2FyZDogbGVmdC54ID4gcmlnaHQueFxuICAgIC8vIGhvcml6b250YWw6IGxlZnQueCA9PSByaWdodC54XG4gICAgLy8gdXB3YXJkOiBsZWZ0LnggPCByaWdodC54XG4gICAgLy8gcmlnaHR3YXJkOiBsZWZ0LnkgPCByaWdodC55XG4gICAgLy8gbGVmdHdhcmQ6IGxlZnQueSA+IHJpZ2h0LnlcbiAgICAvLyB2ZXJ0aWNhbDogbGVmdC55ID09IHJpZ2h0LnlcblxuICAgIC8vIGRlcGVuZGluZyBvbiB0aGUgZGlyZWN0aW9uLCBmaW5kIHRoZSBiZXN0IHNpZGUgb2YgdGhlXG4gICAgLy8gYm91bmRpbmcgYm94IHRvIHVzZSB0byBkZXRlcm1pbmUgYSByZWFzb25hYmxlIHN0YXJ0IHBvaW50XG5cbiAgICAvLyByaGlsbCAyMDEzLTEyLTAyOlxuICAgIC8vIFdoaWxlIGF0IGl0LCBzaW5jZSB3ZSBoYXZlIHRoZSB2YWx1ZXMgd2hpY2ggZGVmaW5lIHRoZSBsaW5lLFxuICAgIC8vIGNsaXAgdGhlIGVuZCBvZiB2YSBpZiBpdCBpcyBvdXRzaWRlIHRoZSBiYm94LlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9pc3N1ZXMvMTVcbiAgICAvLyBUT0RPOiBEbyBhbGwgdGhlIGNsaXBwaW5nIGhlcmUgcmF0aGVyIHRoYW4gcmVseSBvbiBMaWFuZy1CYXJza3lcbiAgICAvLyB3aGljaCBkb2VzIG5vdCBkbyB3ZWxsIHNvbWV0aW1lcyBkdWUgdG8gbG9zcyBvZiBhcml0aG1ldGljXG4gICAgLy8gcHJlY2lzaW9uLiBUaGUgY29kZSBoZXJlIGRvZXNuJ3QgZGVncmFkZSBpZiBvbmUgb2YgdGhlIHZlcnRleCBpc1xuICAgIC8vIGF0IGEgaHVnZSBkaXN0YW5jZS5cblxuICAgIC8vIHNwZWNpYWwgY2FzZTogdmVydGljYWwgbGluZVxuICAgIGlmIChmbSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIGRvZXNuJ3QgaW50ZXJzZWN0IHdpdGggdmlld3BvcnRcbiAgICAgICAgaWYgKGZ4IDwgeGwgfHwgZnggPj0geHIpIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICAvLyBkb3dud2FyZFxuICAgICAgICBpZiAobHggPiByeCkge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS55IDwgeXQpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KGZ4LCB5dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmEueSA+PSB5Yikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KGZ4LCB5Yik7XG4gICAgICAgICAgICB9XG4gICAgICAgIC8vIHVwd2FyZFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmICghdmEgfHwgdmEueSA+IHliKSB7XG4gICAgICAgICAgICAgICAgdmEgPSB0aGlzLmNyZWF0ZVZlcnRleChmeCwgeWIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHZhLnkgPCB5dCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KGZ4LCB5dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAvLyBjbG9zZXIgdG8gdmVydGljYWwgdGhhbiBob3Jpem9udGFsLCBjb25uZWN0IHN0YXJ0IHBvaW50IHRvIHRoZVxuICAgIC8vIHRvcCBvciBib3R0b20gc2lkZSBvZiB0aGUgYm91bmRpbmcgYm94XG4gICAgZWxzZSBpZiAoZm0gPCAtMSB8fCBmbSA+IDEpIHtcbiAgICAgICAgLy8gZG93bndhcmRcbiAgICAgICAgaWYgKGx4ID4gcngpIHtcbiAgICAgICAgICAgIGlmICghdmEgfHwgdmEueSA8IHl0KSB7XG4gICAgICAgICAgICAgICAgdmEgPSB0aGlzLmNyZWF0ZVZlcnRleCgoeXQtZmIpL2ZtLCB5dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmEueSA+PSB5Yikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KCh5Yi1mYikvZm0sIHliKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgLy8gdXB3YXJkXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS55ID4geWIpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KCh5Yi1mYikvZm0sIHliKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh2YS55IDwgeXQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmIgPSB0aGlzLmNyZWF0ZVZlcnRleCgoeXQtZmIpL2ZtLCB5dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAvLyBjbG9zZXIgdG8gaG9yaXpvbnRhbCB0aGFuIHZlcnRpY2FsLCBjb25uZWN0IHN0YXJ0IHBvaW50IHRvIHRoZVxuICAgIC8vIGxlZnQgb3IgcmlnaHQgc2lkZSBvZiB0aGUgYm91bmRpbmcgYm94XG4gICAgZWxzZSB7XG4gICAgICAgIC8vIHJpZ2h0d2FyZFxuICAgICAgICBpZiAobHkgPCByeSkge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS54IDwgeGwpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KHhsLCBmbSp4bCtmYik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmEueCA+PSB4cikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KHhyLCBmbSp4citmYik7XG4gICAgICAgICAgICB9XG4gICAgICAgIC8vIGxlZnR3YXJkXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKCF2YSB8fCB2YS54ID4geHIpIHtcbiAgICAgICAgICAgICAgICB2YSA9IHRoaXMuY3JlYXRlVmVydGV4KHhyLCBmbSp4citmYik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmEueCA8IHhsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeGwsIGZtKnhsK2ZiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIGVkZ2UudmEgPSB2YTtcbiAgICBlZGdlLnZiID0gdmI7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4vLyBsaW5lLWNsaXBwaW5nIGNvZGUgdGFrZW4gZnJvbTpcbi8vICAgTGlhbmctQmFyc2t5IGZ1bmN0aW9uIGJ5IERhbmllbCBXaGl0ZVxuLy8gICBodHRwOi8vd3d3LnNreXRvcGlhLmNvbS9wcm9qZWN0L2FydGljbGVzL2NvbXBzY2kvY2xpcHBpbmcuaHRtbFxuLy8gVGhhbmtzIVxuLy8gQSBiaXQgbW9kaWZpZWQgdG8gbWluaW1pemUgY29kZSBwYXRoc1xuVm9yb25vaS5wcm90b3R5cGUuY2xpcEVkZ2UgPSBmdW5jdGlvbihlZGdlLCBiYm94KSB7XG4gICAgdmFyIGF4ID0gZWRnZS52YS54LFxuICAgICAgICBheSA9IGVkZ2UudmEueSxcbiAgICAgICAgYnggPSBlZGdlLnZiLngsXG4gICAgICAgIGJ5ID0gZWRnZS52Yi55LFxuICAgICAgICB0MCA9IDAsXG4gICAgICAgIHQxID0gMSxcbiAgICAgICAgZHggPSBieC1heCxcbiAgICAgICAgZHkgPSBieS1heTtcbiAgICAvLyBsZWZ0XG4gICAgdmFyIHEgPSBheC1iYm94LnhsO1xuICAgIGlmIChkeD09PTAgJiYgcTwwKSB7cmV0dXJuIGZhbHNlO31cbiAgICB2YXIgciA9IC1xL2R4O1xuICAgIGlmIChkeDwwKSB7XG4gICAgICAgIGlmIChyPHQwKSB7cmV0dXJuIGZhbHNlO31cbiAgICAgICAgaWYgKHI8dDEpIHt0MT1yO31cbiAgICAgICAgfVxuICAgIGVsc2UgaWYgKGR4PjApIHtcbiAgICAgICAgaWYgKHI+dDEpIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocj50MCkge3QwPXI7fVxuICAgICAgICB9XG4gICAgLy8gcmlnaHRcbiAgICBxID0gYmJveC54ci1heDtcbiAgICBpZiAoZHg9PT0wICYmIHE8MCkge3JldHVybiBmYWxzZTt9XG4gICAgciA9IHEvZHg7XG4gICAgaWYgKGR4PDApIHtcbiAgICAgICAgaWYgKHI+dDEpIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocj50MCkge3QwPXI7fVxuICAgICAgICB9XG4gICAgZWxzZSBpZiAoZHg+MCkge1xuICAgICAgICBpZiAocjx0MCkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPHQxKSB7dDE9cjt9XG4gICAgICAgIH1cbiAgICAvLyB0b3BcbiAgICBxID0gYXktYmJveC55dDtcbiAgICBpZiAoZHk9PT0wICYmIHE8MCkge3JldHVybiBmYWxzZTt9XG4gICAgciA9IC1xL2R5O1xuICAgIGlmIChkeTwwKSB7XG4gICAgICAgIGlmIChyPHQwKSB7cmV0dXJuIGZhbHNlO31cbiAgICAgICAgaWYgKHI8dDEpIHt0MT1yO31cbiAgICAgICAgfVxuICAgIGVsc2UgaWYgKGR5PjApIHtcbiAgICAgICAgaWYgKHI+dDEpIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocj50MCkge3QwPXI7fVxuICAgICAgICB9XG4gICAgLy8gYm90dG9tICAgICAgICBcbiAgICBxID0gYmJveC55Yi1heTtcbiAgICBpZiAoZHk9PT0wICYmIHE8MCkge3JldHVybiBmYWxzZTt9XG4gICAgciA9IHEvZHk7XG4gICAgaWYgKGR5PDApIHtcbiAgICAgICAgaWYgKHI+dDEpIHtyZXR1cm4gZmFsc2U7fVxuICAgICAgICBpZiAocj50MCkge3QwPXI7fVxuICAgICAgICB9XG4gICAgZWxzZSBpZiAoZHk+MCkge1xuICAgICAgICBpZiAocjx0MCkge3JldHVybiBmYWxzZTt9XG4gICAgICAgIGlmIChyPHQxKSB7dDE9cjt9XG4gICAgICAgIH1cblxuICAgIC8vIGlmIHdlIHJlYWNoIHRoaXMgcG9pbnQsIFZvcm9ub2kgZWRnZSBpcyB3aXRoaW4gYmJveFxuXG4gICAgLy8gaWYgdDAgPiAwLCB2YSBuZWVkcyB0byBjaGFuZ2VcbiAgICAvLyByaGlsbCAyMDExLTA2LTAzOiB3ZSBuZWVkIHRvIGNyZWF0ZSBhIG5ldyB2ZXJ0ZXggcmF0aGVyXG4gICAgLy8gdGhhbiBtb2RpZnlpbmcgdGhlIGV4aXN0aW5nIG9uZSwgc2luY2UgdGhlIGV4aXN0aW5nXG4gICAgLy8gb25lIGlzIGxpa2VseSBzaGFyZWQgd2l0aCBhdCBsZWFzdCBhbm90aGVyIGVkZ2VcbiAgICBpZiAodDAgPiAwKSB7XG4gICAgICAgIGVkZ2UudmEgPSB0aGlzLmNyZWF0ZVZlcnRleChheCt0MCpkeCwgYXkrdDAqZHkpO1xuICAgICAgICB9XG5cbiAgICAvLyBpZiB0MSA8IDEsIHZiIG5lZWRzIHRvIGNoYW5nZVxuICAgIC8vIHJoaWxsIDIwMTEtMDYtMDM6IHdlIG5lZWQgdG8gY3JlYXRlIGEgbmV3IHZlcnRleCByYXRoZXJcbiAgICAvLyB0aGFuIG1vZGlmeWluZyB0aGUgZXhpc3Rpbmcgb25lLCBzaW5jZSB0aGUgZXhpc3RpbmdcbiAgICAvLyBvbmUgaXMgbGlrZWx5IHNoYXJlZCB3aXRoIGF0IGxlYXN0IGFub3RoZXIgZWRnZVxuICAgIGlmICh0MSA8IDEpIHtcbiAgICAgICAgZWRnZS52YiA9IHRoaXMuY3JlYXRlVmVydGV4KGF4K3QxKmR4LCBheSt0MSpkeSk7XG4gICAgICAgIH1cblxuICAgIC8vIHZhIGFuZC9vciB2YiB3ZXJlIGNsaXBwZWQsIHRodXMgd2Ugd2lsbCBuZWVkIHRvIGNsb3NlXG4gICAgLy8gY2VsbHMgd2hpY2ggdXNlIHRoaXMgZWRnZS5cbiAgICBpZiAoIHQwID4gMCB8fCB0MSA8IDEgKSB7XG4gICAgICAgIHRoaXMuY2VsbHNbZWRnZS5sU2l0ZS52b3Jvbm9pSWRdLmNsb3NlTWUgPSB0cnVlO1xuICAgICAgICB0aGlzLmNlbGxzW2VkZ2UuclNpdGUudm9yb25vaUlkXS5jbG9zZU1lID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4vLyBDb25uZWN0L2N1dCBlZGdlcyBhdCBib3VuZGluZyBib3hcblZvcm9ub2kucHJvdG90eXBlLmNsaXBFZGdlcyA9IGZ1bmN0aW9uKGJib3gpIHtcbiAgICAvLyBjb25uZWN0IGFsbCBkYW5nbGluZyBlZGdlcyB0byBib3VuZGluZyBib3hcbiAgICAvLyBvciBnZXQgcmlkIG9mIHRoZW0gaWYgaXQgY2FuJ3QgYmUgZG9uZVxuICAgIHZhciBlZGdlcyA9IHRoaXMuZWRnZXMsXG4gICAgICAgIGlFZGdlID0gZWRnZXMubGVuZ3RoLFxuICAgICAgICBlZGdlLFxuICAgICAgICBhYnNfZm4gPSBNYXRoLmFicztcblxuICAgIC8vIGl0ZXJhdGUgYmFja3dhcmQgc28gd2UgY2FuIHNwbGljZSBzYWZlbHlcbiAgICB3aGlsZSAoaUVkZ2UtLSkge1xuICAgICAgICBlZGdlID0gZWRnZXNbaUVkZ2VdO1xuICAgICAgICAvLyBlZGdlIGlzIHJlbW92ZWQgaWY6XG4gICAgICAgIC8vICAgaXQgaXMgd2hvbGx5IG91dHNpZGUgdGhlIGJvdW5kaW5nIGJveFxuICAgICAgICAvLyAgIGl0IGlzIGxvb2tpbmcgbW9yZSBsaWtlIGEgcG9pbnQgdGhhbiBhIGxpbmVcbiAgICAgICAgaWYgKCF0aGlzLmNvbm5lY3RFZGdlKGVkZ2UsIGJib3gpIHx8XG4gICAgICAgICAgICAhdGhpcy5jbGlwRWRnZShlZGdlLCBiYm94KSB8fFxuICAgICAgICAgICAgKGFic19mbihlZGdlLnZhLngtZWRnZS52Yi54KTwxZS05ICYmIGFic19mbihlZGdlLnZhLnktZWRnZS52Yi55KTwxZS05KSkge1xuICAgICAgICAgICAgZWRnZS52YSA9IGVkZ2UudmIgPSBudWxsO1xuICAgICAgICAgICAgZWRnZXMuc3BsaWNlKGlFZGdlLDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuLy8gQ2xvc2UgdGhlIGNlbGxzLlxuLy8gVGhlIGNlbGxzIGFyZSBib3VuZCBieSB0aGUgc3VwcGxpZWQgYm91bmRpbmcgYm94LlxuLy8gRWFjaCBjZWxsIHJlZmVycyB0byBpdHMgYXNzb2NpYXRlZCBzaXRlLCBhbmQgYSBsaXN0XG4vLyBvZiBoYWxmZWRnZXMgb3JkZXJlZCBjb3VudGVyY2xvY2t3aXNlLlxuVm9yb25vaS5wcm90b3R5cGUuY2xvc2VDZWxscyA9IGZ1bmN0aW9uKGJib3gpIHtcbiAgICB2YXIgeGwgPSBiYm94LnhsLFxuICAgICAgICB4ciA9IGJib3gueHIsXG4gICAgICAgIHl0ID0gYmJveC55dCxcbiAgICAgICAgeWIgPSBiYm94LnliLFxuICAgICAgICBjZWxscyA9IHRoaXMuY2VsbHMsXG4gICAgICAgIGlDZWxsID0gY2VsbHMubGVuZ3RoLFxuICAgICAgICBjZWxsLFxuICAgICAgICBpTGVmdCxcbiAgICAgICAgaGFsZmVkZ2VzLCBuSGFsZmVkZ2VzLFxuICAgICAgICBlZGdlLFxuICAgICAgICB2YSwgdmIsIHZ6LFxuICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCxcbiAgICAgICAgYWJzX2ZuID0gTWF0aC5hYnM7XG5cbiAgICB3aGlsZSAoaUNlbGwtLSkge1xuICAgICAgICBjZWxsID0gY2VsbHNbaUNlbGxdO1xuICAgICAgICAvLyBwcnVuZSwgb3JkZXIgaGFsZmVkZ2VzIGNvdW50ZXJjbG9ja3dpc2UsIHRoZW4gYWRkIG1pc3Npbmcgb25lc1xuICAgICAgICAvLyByZXF1aXJlZCB0byBjbG9zZSBjZWxsc1xuICAgICAgICBpZiAoIWNlbGwucHJlcGFyZUhhbGZlZGdlcygpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgaWYgKCFjZWxsLmNsb3NlTWUpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAvLyBmaW5kIGZpcnN0ICd1bmNsb3NlZCcgcG9pbnQuXG4gICAgICAgIC8vIGFuICd1bmNsb3NlZCcgcG9pbnQgd2lsbCBiZSB0aGUgZW5kIHBvaW50IG9mIGEgaGFsZmVkZ2Ugd2hpY2hcbiAgICAgICAgLy8gZG9lcyBub3QgbWF0Y2ggdGhlIHN0YXJ0IHBvaW50IG9mIHRoZSBmb2xsb3dpbmcgaGFsZmVkZ2VcbiAgICAgICAgaGFsZmVkZ2VzID0gY2VsbC5oYWxmZWRnZXM7XG4gICAgICAgIG5IYWxmZWRnZXMgPSBoYWxmZWRnZXMubGVuZ3RoO1xuICAgICAgICAvLyBzcGVjaWFsIGNhc2U6IG9ubHkgb25lIHNpdGUsIGluIHdoaWNoIGNhc2UsIHRoZSB2aWV3cG9ydCBpcyB0aGUgY2VsbFxuICAgICAgICAvLyAuLi5cblxuICAgICAgICAvLyBhbGwgb3RoZXIgY2FzZXNcbiAgICAgICAgaUxlZnQgPSAwO1xuICAgICAgICB3aGlsZSAoaUxlZnQgPCBuSGFsZmVkZ2VzKSB7XG4gICAgICAgICAgICB2YSA9IGhhbGZlZGdlc1tpTGVmdF0uZ2V0RW5kcG9pbnQoKTtcbiAgICAgICAgICAgIHZ6ID0gaGFsZmVkZ2VzWyhpTGVmdCsxKSAlIG5IYWxmZWRnZXNdLmdldFN0YXJ0cG9pbnQoKTtcbiAgICAgICAgICAgIC8vIGlmIGVuZCBwb2ludCBpcyBub3QgZXF1YWwgdG8gc3RhcnQgcG9pbnQsIHdlIG5lZWQgdG8gYWRkIHRoZSBtaXNzaW5nXG4gICAgICAgICAgICAvLyBoYWxmZWRnZShzKSB1cCB0byB2elxuICAgICAgICAgICAgaWYgKGFic19mbih2YS54LXZ6LngpPj0xZS05IHx8IGFic19mbih2YS55LXZ6LnkpPj0xZS05KSB7XG5cbiAgICAgICAgICAgICAgICAvLyByaGlsbCAyMDEzLTEyLTAyOlxuICAgICAgICAgICAgICAgIC8vIFwiSG9sZXNcIiBpbiB0aGUgaGFsZmVkZ2VzIGFyZSBub3QgbmVjZXNzYXJpbHkgYWx3YXlzIGFkamFjZW50LlxuICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9pc3N1ZXMvMTZcblxuICAgICAgICAgICAgICAgIC8vIGZpbmQgZW50cnkgcG9pbnQ6XG4gICAgICAgICAgICAgICAgc3dpdGNoICh0cnVlKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gd2FsayBkb3dud2FyZCBhbG9uZyBsZWZ0IHNpZGVcbiAgICAgICAgICAgICAgICAgICAgY2FzZSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odmEueCx4bCkgJiYgdGhpcy5sZXNzVGhhbldpdGhFcHNpbG9uKHZhLnkseWIpOlxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEJvcmRlclNlZ21lbnQgPSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odnoueCx4bCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KHhsLCBsYXN0Qm9yZGVyU2VnbWVudCA/IHZ6LnkgOiB5Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlID0gdGhpcy5jcmVhdGVCb3JkZXJFZGdlKGNlbGwuc2l0ZSwgdmEsIHZiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYWxmZWRnZXMuc3BsaWNlKGlMZWZ0LCAwLCB0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGNlbGwuc2l0ZSwgbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbkhhbGZlZGdlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBsYXN0Qm9yZGVyU2VnbWVudCApIHsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhID0gdmI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsIHRocm91Z2hcblxuICAgICAgICAgICAgICAgICAgICAvLyB3YWxrIHJpZ2h0d2FyZCBhbG9uZyBib3R0b20gc2lkZVxuICAgICAgICAgICAgICAgICAgICBjYXNlIHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2YS55LHliKSAmJiB0aGlzLmxlc3NUaGFuV2l0aEVwc2lsb24odmEueCx4cik6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei55LHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgobGFzdEJvcmRlclNlZ21lbnQgPyB2ei54IDogeHIsIHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmEgPSB2YjtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHdhbGsgdXB3YXJkIGFsb25nIHJpZ2h0IHNpZGVcbiAgICAgICAgICAgICAgICAgICAgY2FzZSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odmEueCx4cikgJiYgdGhpcy5ncmVhdGVyVGhhbldpdGhFcHNpbG9uKHZhLnkseXQpOlxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEJvcmRlclNlZ21lbnQgPSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odnoueCx4cik7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KHhyLCBsYXN0Qm9yZGVyU2VnbWVudCA/IHZ6LnkgOiB5dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlID0gdGhpcy5jcmVhdGVCb3JkZXJFZGdlKGNlbGwuc2l0ZSwgdmEsIHZiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYWxmZWRnZXMuc3BsaWNlKGlMZWZ0LCAwLCB0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGNlbGwuc2l0ZSwgbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbkhhbGZlZGdlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBsYXN0Qm9yZGVyU2VnbWVudCApIHsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhID0gdmI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsIHRocm91Z2hcblxuICAgICAgICAgICAgICAgICAgICAvLyB3YWxrIGxlZnR3YXJkIGFsb25nIHRvcCBzaWRlXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgdGhpcy5lcXVhbFdpdGhFcHNpbG9uKHZhLnkseXQpICYmIHRoaXMuZ3JlYXRlclRoYW5XaXRoRXBzaWxvbih2YS54LHhsKTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RCb3JkZXJTZWdtZW50ID0gdGhpcy5lcXVhbFdpdGhFcHNpbG9uKHZ6LnkseXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmIgPSB0aGlzLmNyZWF0ZVZlcnRleChsYXN0Qm9yZGVyU2VnbWVudCA/IHZ6LnggOiB4bCwgeXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZSA9IHRoaXMuY3JlYXRlQm9yZGVyRWRnZShjZWxsLnNpdGUsIHZhLCB2Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpTGVmdCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFsZmVkZ2VzLnNwbGljZShpTGVmdCwgMCwgdGhpcy5jcmVhdGVIYWxmZWRnZShlZGdlLCBjZWxsLnNpdGUsIG51bGwpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5IYWxmZWRnZXMrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggbGFzdEJvcmRlclNlZ21lbnQgKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YSA9IHZiO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdhbGsgZG93bndhcmQgYWxvbmcgbGVmdCBzaWRlXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Qm9yZGVyU2VnbWVudCA9IHRoaXMuZXF1YWxXaXRoRXBzaWxvbih2ei54LHhsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiID0gdGhpcy5jcmVhdGVWZXJ0ZXgoeGwsIGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueSA6IHliKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSB0aGlzLmNyZWF0ZUJvcmRlckVkZ2UoY2VsbC5zaXRlLCB2YSwgdmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaUxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbGZlZGdlcy5zcGxpY2UoaUxlZnQsIDAsIHRoaXMuY3JlYXRlSGFsZmVkZ2UoZWRnZSwgY2VsbC5zaXRlLCBudWxsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuSGFsZmVkZ2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGxhc3RCb3JkZXJTZWdtZW50ICkgeyBicmVhazsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmEgPSB2YjtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB3YWxrIHJpZ2h0d2FyZCBhbG9uZyBib3R0b20gc2lkZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEJvcmRlclNlZ21lbnQgPSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odnoueSx5Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KGxhc3RCb3JkZXJTZWdtZW50ID8gdnoueCA6IHhyLCB5Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlID0gdGhpcy5jcmVhdGVCb3JkZXJFZGdlKGNlbGwuc2l0ZSwgdmEsIHZiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYWxmZWRnZXMuc3BsaWNlKGlMZWZ0LCAwLCB0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGNlbGwuc2l0ZSwgbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbkhhbGZlZGdlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBsYXN0Qm9yZGVyU2VnbWVudCApIHsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhID0gdmI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsIHRocm91Z2hcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2FsayB1cHdhcmQgYWxvbmcgcmlnaHQgc2lkZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEJvcmRlclNlZ21lbnQgPSB0aGlzLmVxdWFsV2l0aEVwc2lsb24odnoueCx4cik7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YiA9IHRoaXMuY3JlYXRlVmVydGV4KHhyLCBsYXN0Qm9yZGVyU2VnbWVudCA/IHZ6LnkgOiB5dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlID0gdGhpcy5jcmVhdGVCb3JkZXJFZGdlKGNlbGwuc2l0ZSwgdmEsIHZiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYWxmZWRnZXMuc3BsaWNlKGlMZWZ0LCAwLCB0aGlzLmNyZWF0ZUhhbGZlZGdlKGVkZ2UsIGNlbGwuc2l0ZSwgbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbkhhbGZlZGdlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBsYXN0Qm9yZGVyU2VnbWVudCApIHsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaFxuXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBcIlZvcm9ub2kuY2xvc2VDZWxscygpID4gdGhpcyBtYWtlcyBubyBzZW5zZSFcIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlMZWZ0Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgIGNlbGwuY2xvc2VNZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBEZWJ1Z2dpbmcgaGVscGVyXG4vKlxuVm9yb25vaS5wcm90b3R5cGUuZHVtcEJlYWNobGluZSA9IGZ1bmN0aW9uKHkpIHtcbiAgICBjb25zb2xlLmxvZygnVm9yb25vaS5kdW1wQmVhY2hsaW5lKCVmKSA+IEJlYWNoc2VjdGlvbnMsIGZyb20gbGVmdCB0byByaWdodDonLCB5KTtcbiAgICBpZiAoICF0aGlzLmJlYWNobGluZSApIHtcbiAgICAgICAgY29uc29sZS5sb2coJyAgTm9uZScpO1xuICAgICAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhciBicyA9IHRoaXMuYmVhY2hsaW5lLmdldEZpcnN0KHRoaXMuYmVhY2hsaW5lLnJvb3QpO1xuICAgICAgICB3aGlsZSAoIGJzICkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJyAgc2l0ZSAlZDogeGw6ICVmLCB4cjogJWYnLCBicy5zaXRlLnZvcm9ub2lJZCwgdGhpcy5sZWZ0QnJlYWtQb2ludChicywgeSksIHRoaXMucmlnaHRCcmVha1BvaW50KGJzLCB5KSk7XG4gICAgICAgICAgICBicyA9IGJzLnJiTmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG4qL1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEhlbHBlcjogUXVhbnRpemUgc2l0ZXNcblxuLy8gcmhpbGwgMjAxMy0xMC0xMjpcbi8vIFRoaXMgaXMgdG8gc29sdmUgaHR0cHM6Ly9naXRodWIuY29tL2dvcmhpbGwvSmF2YXNjcmlwdC1Wb3Jvbm9pL2lzc3Vlcy8xNVxuLy8gU2luY2Ugbm90IGFsbCB1c2VycyB3aWxsIGVuZCB1cCB1c2luZyB0aGUga2luZCBvZiBjb29yZCB2YWx1ZXMgd2hpY2ggd291bGRcbi8vIGNhdXNlIHRoZSBpc3N1ZSB0byBhcmlzZSwgSSBjaG9zZSB0byBsZXQgdGhlIHVzZXIgZGVjaWRlIHdoZXRoZXIgb3Igbm90XG4vLyBoZSBzaG91bGQgc2FuaXRpemUgaGlzIGNvb3JkIHZhbHVlcyB0aHJvdWdoIHRoaXMgaGVscGVyLiBUaGlzIHdheSwgZm9yXG4vLyB0aG9zZSB1c2VycyB3aG8gdXNlcyBjb29yZCB2YWx1ZXMgd2hpY2ggYXJlIGtub3duIHRvIGJlIGZpbmUsIG5vIG92ZXJoZWFkIGlzXG4vLyBhZGRlZC5cblxuVm9yb25vaS5wcm90b3R5cGUucXVhbnRpemVTaXRlcyA9IGZ1bmN0aW9uKHNpdGVzKSB7XG4gICAgdmFyIM61ID0gdGhpcy7OtSxcbiAgICAgICAgbiA9IHNpdGVzLmxlbmd0aCxcbiAgICAgICAgc2l0ZTtcbiAgICB3aGlsZSAoIG4tLSApIHtcbiAgICAgICAgc2l0ZSA9IHNpdGVzW25dO1xuICAgICAgICBzaXRlLnggPSBNYXRoLmZsb29yKHNpdGUueCAvIM61KSAqIM61O1xuICAgICAgICBzaXRlLnkgPSBNYXRoLmZsb29yKHNpdGUueSAvIM61KSAqIM61O1xuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBIZWxwZXI6IFJlY3ljbGUgZGlhZ3JhbTogYWxsIHZlcnRleCwgZWRnZSBhbmQgY2VsbCBvYmplY3RzIGFyZVxuLy8gXCJzdXJyZW5kZXJlZFwiIHRvIHRoZSBWb3Jvbm9pIG9iamVjdCBmb3IgcmV1c2UuXG4vLyBUT0RPOiByaGlsbC12b3Jvbm9pLWNvcmUgdjI6IG1vcmUgcGVyZm9ybWFuY2UgdG8gYmUgZ2FpbmVkXG4vLyB3aGVuIEkgY2hhbmdlIHRoZSBzZW1hbnRpYyBvZiB3aGF0IGlzIHJldHVybmVkLlxuXG5Wb3Jvbm9pLnByb3RvdHlwZS5yZWN5Y2xlID0gZnVuY3Rpb24oZGlhZ3JhbSkge1xuICAgIGlmICggZGlhZ3JhbSApIHtcbiAgICAgICAgaWYgKCBkaWFncmFtIGluc3RhbmNlb2YgdGhpcy5EaWFncmFtICkge1xuICAgICAgICAgICAgdGhpcy50b1JlY3ljbGUgPSBkaWFncmFtO1xuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93ICdWb3Jvbm9pLnJlY3ljbGVEaWFncmFtKCkgPiBOZWVkIGEgRGlhZ3JhbSBvYmplY3QuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gVG9wLWxldmVsIEZvcnR1bmUgbG9vcFxuXG4vLyByaGlsbCAyMDExLTA1LTE5OlxuLy8gICBWb3Jvbm9pIHNpdGVzIGFyZSBrZXB0IGNsaWVudC1zaWRlIG5vdywgdG8gYWxsb3dcbi8vICAgdXNlciB0byBmcmVlbHkgbW9kaWZ5IGNvbnRlbnQuIEF0IGNvbXB1dGUgdGltZSxcbi8vICAgKnJlZmVyZW5jZXMqIHRvIHNpdGVzIGFyZSBjb3BpZWQgbG9jYWxseS5cblxuVm9yb25vaS5wcm90b3R5cGUuY29tcHV0ZSA9IGZ1bmN0aW9uKHNpdGVzLCBiYm94KSB7XG4gICAgLy8gdG8gbWVhc3VyZSBleGVjdXRpb24gdGltZVxuICAgIHZhciBzdGFydFRpbWUgPSBuZXcgRGF0ZSgpO1xuXG4gICAgLy8gaW5pdCBpbnRlcm5hbCBzdGF0ZVxuICAgIHRoaXMucmVzZXQoKTtcblxuICAgIC8vIGFueSBkaWFncmFtIGRhdGEgYXZhaWxhYmxlIGZvciByZWN5Y2xpbmc/XG4gICAgLy8gSSBkbyB0aGF0IGhlcmUgc28gdGhhdCB0aGlzIGlzIGluY2x1ZGVkIGluIGV4ZWN1dGlvbiB0aW1lXG4gICAgaWYgKCB0aGlzLnRvUmVjeWNsZSApIHtcbiAgICAgICAgdGhpcy52ZXJ0ZXhKdW5reWFyZCA9IHRoaXMudmVydGV4SnVua3lhcmQuY29uY2F0KHRoaXMudG9SZWN5Y2xlLnZlcnRpY2VzKTtcbiAgICAgICAgdGhpcy5lZGdlSnVua3lhcmQgPSB0aGlzLmVkZ2VKdW5reWFyZC5jb25jYXQodGhpcy50b1JlY3ljbGUuZWRnZXMpO1xuICAgICAgICB0aGlzLmNlbGxKdW5reWFyZCA9IHRoaXMuY2VsbEp1bmt5YXJkLmNvbmNhdCh0aGlzLnRvUmVjeWNsZS5jZWxscyk7XG4gICAgICAgIHRoaXMudG9SZWN5Y2xlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgLy8gSW5pdGlhbGl6ZSBzaXRlIGV2ZW50IHF1ZXVlXG4gICAgdmFyIHNpdGVFdmVudHMgPSBzaXRlcy5zbGljZSgwKTtcbiAgICBzaXRlRXZlbnRzLnNvcnQoZnVuY3Rpb24oYSxiKXtcbiAgICAgICAgdmFyIHIgPSBiLnkgLSBhLnk7XG4gICAgICAgIGlmIChyKSB7cmV0dXJuIHI7fVxuICAgICAgICByZXR1cm4gYi54IC0gYS54O1xuICAgICAgICB9KTtcblxuICAgIC8vIHByb2Nlc3MgcXVldWVcbiAgICB2YXIgc2l0ZSA9IHNpdGVFdmVudHMucG9wKCksXG4gICAgICAgIHNpdGVpZCA9IDAsXG4gICAgICAgIHhzaXRleCwgLy8gdG8gYXZvaWQgZHVwbGljYXRlIHNpdGVzXG4gICAgICAgIHhzaXRleSxcbiAgICAgICAgY2VsbHMgPSB0aGlzLmNlbGxzLFxuICAgICAgICBjaXJjbGU7XG5cbiAgICAvLyBtYWluIGxvb3BcbiAgICBmb3IgKDs7KSB7XG4gICAgICAgIC8vIHdlIG5lZWQgdG8gZmlndXJlIHdoZXRoZXIgd2UgaGFuZGxlIGEgc2l0ZSBvciBjaXJjbGUgZXZlbnRcbiAgICAgICAgLy8gZm9yIHRoaXMgd2UgZmluZCBvdXQgaWYgdGhlcmUgaXMgYSBzaXRlIGV2ZW50IGFuZCBpdCBpc1xuICAgICAgICAvLyAnZWFybGllcicgdGhhbiB0aGUgY2lyY2xlIGV2ZW50XG4gICAgICAgIGNpcmNsZSA9IHRoaXMuZmlyc3RDaXJjbGVFdmVudDtcblxuICAgICAgICAvLyBhZGQgYmVhY2ggc2VjdGlvblxuICAgICAgICBpZiAoc2l0ZSAmJiAoIWNpcmNsZSB8fCBzaXRlLnkgPCBjaXJjbGUueSB8fCAoc2l0ZS55ID09PSBjaXJjbGUueSAmJiBzaXRlLnggPCBjaXJjbGUueCkpKSB7XG4gICAgICAgICAgICAvLyBvbmx5IGlmIHNpdGUgaXMgbm90IGEgZHVwbGljYXRlXG4gICAgICAgICAgICBpZiAoc2l0ZS54ICE9PSB4c2l0ZXggfHwgc2l0ZS55ICE9PSB4c2l0ZXkpIHtcbiAgICAgICAgICAgICAgICAvLyBmaXJzdCBjcmVhdGUgY2VsbCBmb3IgbmV3IHNpdGVcbiAgICAgICAgICAgICAgICBjZWxsc1tzaXRlaWRdID0gdGhpcy5jcmVhdGVDZWxsKHNpdGUpO1xuICAgICAgICAgICAgICAgIHNpdGUudm9yb25vaUlkID0gc2l0ZWlkKys7XG4gICAgICAgICAgICAgICAgLy8gdGhlbiBjcmVhdGUgYSBiZWFjaHNlY3Rpb24gZm9yIHRoYXQgc2l0ZVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkQmVhY2hzZWN0aW9uKHNpdGUpO1xuICAgICAgICAgICAgICAgIC8vIHJlbWVtYmVyIGxhc3Qgc2l0ZSBjb29yZHMgdG8gZGV0ZWN0IGR1cGxpY2F0ZVxuICAgICAgICAgICAgICAgIHhzaXRleSA9IHNpdGUueTtcbiAgICAgICAgICAgICAgICB4c2l0ZXggPSBzaXRlLng7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2l0ZSA9IHNpdGVFdmVudHMucG9wKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIGJlYWNoIHNlY3Rpb25cbiAgICAgICAgZWxzZSBpZiAoY2lyY2xlKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUJlYWNoc2VjdGlvbihjaXJjbGUuYXJjKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAvLyBhbGwgZG9uZSwgcXVpdFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAvLyB3cmFwcGluZy11cDpcbiAgICAvLyAgIGNvbm5lY3QgZGFuZ2xpbmcgZWRnZXMgdG8gYm91bmRpbmcgYm94XG4gICAgLy8gICBjdXQgZWRnZXMgYXMgcGVyIGJvdW5kaW5nIGJveFxuICAgIC8vICAgZGlzY2FyZCBlZGdlcyBjb21wbGV0ZWx5IG91dHNpZGUgYm91bmRpbmcgYm94XG4gICAgLy8gICBkaXNjYXJkIGVkZ2VzIHdoaWNoIGFyZSBwb2ludC1saWtlXG4gICAgdGhpcy5jbGlwRWRnZXMoYmJveCk7XG5cbiAgICAvLyAgIGFkZCBtaXNzaW5nIGVkZ2VzIGluIG9yZGVyIHRvIGNsb3NlIG9wZW5lZCBjZWxsc1xuICAgIHRoaXMuY2xvc2VDZWxscyhiYm94KTtcblxuICAgIC8vIHRvIG1lYXN1cmUgZXhlY3V0aW9uIHRpbWVcbiAgICB2YXIgc3RvcFRpbWUgPSBuZXcgRGF0ZSgpO1xuXG4gICAgLy8gcHJlcGFyZSByZXR1cm4gdmFsdWVzXG4gICAgdmFyIGRpYWdyYW0gPSBuZXcgdGhpcy5EaWFncmFtKCk7XG4gICAgZGlhZ3JhbS5jZWxscyA9IHRoaXMuY2VsbHM7XG4gICAgZGlhZ3JhbS5lZGdlcyA9IHRoaXMuZWRnZXM7XG4gICAgZGlhZ3JhbS52ZXJ0aWNlcyA9IHRoaXMudmVydGljZXM7XG4gICAgZGlhZ3JhbS5leGVjVGltZSA9IHN0b3BUaW1lLmdldFRpbWUoKS1zdGFydFRpbWUuZ2V0VGltZSgpO1xuXG4gICAgLy8gY2xlYW4gdXBcbiAgICB0aGlzLnJlc2V0KCk7XG5cbiAgICByZXR1cm4gZGlhZ3JhbTtcbiAgICB9O1xuXG5pZih0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykgbW9kdWxlLmV4cG9ydHMgPSBWb3Jvbm9pO1xuIiwibW9kdWxlLmV4cG9ydHMuUkFESVVTID0gNjM3ODEzNztcbm1vZHVsZS5leHBvcnRzLkZMQVRURU5JTkcgPSAxLzI5OC4yNTcyMjM1NjM7XG5tb2R1bGUuZXhwb3J0cy5QT0xBUl9SQURJVVMgPSA2MzU2NzUyLjMxNDI7XG4iLCIvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEdlb0pTT05VdGlsc1xuLy9cbi8vIEBtb2R1bGVcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5jb25zdCBhcmVhID0gcmVxdWlyZSgndHVyZi1hcmVhJyk7XG5jb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoJyk7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5jbGFzcyBHZW9KU09OVXRpbHMge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyB0byBzZWUgaWYgdGhlIGZlYXR1cmUgaXMgYSBQb2x5Z29uIGZvcm1hdHRlZCBhcyBhIE11bHRpUG9seWdvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UG9seWdvbn0gcG9seWdvblxuICAgICAqIEByZXR1cm5zIHtQb2x5Z29ufVxuICAgICAqL1xuICAgIGZpeE11bHRpUG9seShwb2x5Z29uKSB7XG4gICAgICAgIGlmKHBvbHlnb24uZ2VvbWV0cnkudHlwZSA9PT0gJ011bHRpUG9seWdvbicgJiYgcG9seWdvbi5nZW9tZXRyeS5jb29yZGluYXRlc1swXS5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIC8vIEhhbmRsZSBhIFBvbHlnb24gaW4gdGhlIGZvcm0gb2YgYSBNdWx0aVBvbHlnb25cbiAgICAgICAgICAgIHBvbHlnb24uZ2VvbWV0cnkudHlwZSA9ICdQb2x5Z29uJztcbiAgICAgICAgICAgIHBvbHlnb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXMgPSBwb2x5Z29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdO1xuXG4gICAgICAgICAgICByZXR1cm4gcG9seWdvbjtcbiAgICAgICAgfSBlbHNlIGlmKHBvbHlnb24uZ2VvbWV0cnkudHlwZSA9PT0gJ011bHRpUG9seWdvbicgJiYgcG9seWdvbi5nZW9tZXRyeS5jb29yZGluYXRlc1swXS5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAvLyBIYW5kbGUgYSB0cnVlIE11bHRpUG9seWdvbiBieSByZXR1cm5pbmcgdGhlIFBvbHlnb24gb2YgbGFyZ2VzdCBhcmVhXG4gICAgICAgICAgICBjb25zdCBwb2x5Z29ucyA9IF8ubWFwKHBvbHlnb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0sICgoY29vcmRpbmF0ZXMpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fdG9HZW9KU09ORmVhdHVyZShcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdG9HZW9KU09OUG9seWdvbihjb29yZGluYXRlcylcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgY29uc3QgY29sbGVjdGlvbkFyZWEgPSBfLm1hcChwb2x5Z29ucywgYXJlYSk7XG4gICAgICAgICAgICBjb25zdCBsYXJnZXN0QXJlYUluZGV4ID0gXy5pbmRleE9mKGNvbGxlY3Rpb25BcmVhLCBfLm1heChjb2xsZWN0aW9uQXJlYSkpO1xuXG4gICAgICAgICAgICByZXR1cm4gcG9seWdvbnNbbGFyZ2VzdEFyZWFJbmRleF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gcG9seWdvbjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRha2VzIGEgcG9seWdvbiBhbmQgZ2VuZXJhdGVzIHRoZSBzaXRlcyBuZWVkZWQgdG8gZ2VuZXJhdGUgVm9yb25vaVxuICAgICAqXG4gICAgICogQHBhcmFtIHtQb2x5Z29ufSBwb2x5Z29uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRlY2ltYWxQbGFjZXMgQSBwb3dlciBvZiAxMCB1c2VkIHRvIHRydW5jYXRlIHRoZSBkZWNpbWFsIHBsYWNlcyBvZiB0aGUgcG9seWdvbiBzaXRlcyBhbmRcbiAgICAgKiAgIGJib3guIFRoaXMgaXMgYSB3b3JrYXJvdW5kIGR1ZSB0byB0aGUgaXNzdWUgcmVmZXJyZWQgdG8gaGVyZTpcbiAgICAgKiAgIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3JoaWxsL0phdmFzY3JpcHQtVm9yb25vaS9pc3N1ZXMvMTVcbiAgICAgKiAgIERlZmF1bHRzIHRvIDFlLTIwLlxuICAgICAqIEByZXR1cm5zIHt7c2l0ZXM6IEFycmF5LCBiYm94OiB7eGw6IG51bWJlciwgeHI6IG51bWJlciwgeXQ6IG51bWJlciwgeWI6IG51bWJlcn19fVxuICAgICAqL1xuICAgIHNpdGVzKHBvbHlnb24sIGRlY2ltYWxQbGFjZXMpIHtcbiAgICAgICAgaWYoZGVjaW1hbFBsYWNlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBkZWNpbWFsUGxhY2VzID0gMWUtMjA7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHBvbHlnb25TaXRlcyA9IFtdO1xuICAgICAgICBsZXQgeG1pbix4bWF4LHltaW4seW1heDtcbiAgICAgICAgZm9yKGxldCBpID0gMDsgaSA8IHBvbHlnb24uZ2VvbWV0cnkuY29vcmRpbmF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHBvbHlSaW5nID0gcG9seWdvbi5nZW9tZXRyeS5jb29yZGluYXRlc1tpXS5zbGljZSgpO1xuICAgICAgICAgICAgZm9yKGxldCBqID0gMDsgaiA8IHBvbHlSaW5nLmxlbmd0aC0xOyBqKyspIHtcbiAgICAgICAgICAgICAgICAvL1B1c2ggb3JpZ2luYWwgcG9pbnRcbiAgICAgICAgICAgICAgICBwb2x5Z29uU2l0ZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHg6IE1hdGguZmxvb3IocG9seVJpbmdbal1bMF0gLyBkZWNpbWFsUGxhY2VzKSAqIGRlY2ltYWxQbGFjZXMsXG4gICAgICAgICAgICAgICAgICAgIHk6IE1hdGguZmxvb3IocG9seVJpbmdbal1bMV0gLyBkZWNpbWFsUGxhY2VzKSAqIGRlY2ltYWxQbGFjZXNcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAvL1B1c2ggbWlkcG9pbnRzIG9mIHNlZ21lbnRzXG4gICAgICAgICAgICAgICAgcG9seWdvblNpdGVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICB4OiBNYXRoLmZsb29yKCgocG9seVJpbmdbal1bMF0rcG9seVJpbmdbaisxXVswXSkgLyAyKSAvIGRlY2ltYWxQbGFjZXMpICogZGVjaW1hbFBsYWNlcyxcbiAgICAgICAgICAgICAgICAgICAgeTogTWF0aC5mbG9vcigoKHBvbHlSaW5nW2pdWzFdK3BvbHlSaW5nW2orMV1bMV0pIC8gMikgLyBkZWNpbWFsUGxhY2VzKSAqIGRlY2ltYWxQbGFjZXNcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAvL2luaXRpYWxpemUgYm91bmRpbmcgYm94XG4gICAgICAgICAgICAgICAgaWYoKGkgPT09IDApICYmIChqID09PSAwKSkge1xuICAgICAgICAgICAgICAgICAgICB4bWluID0gTWF0aC5mbG9vcihwb2x5UmluZ1tqXVswXSAvIGRlY2ltYWxQbGFjZXMpICogZGVjaW1hbFBsYWNlcztcbiAgICAgICAgICAgICAgICAgICAgeG1heCA9IHhtaW47XG4gICAgICAgICAgICAgICAgICAgIHltaW4gPSBNYXRoLmZsb29yKHBvbHlSaW5nW2pdWzFdIC8gZGVjaW1hbFBsYWNlcykgKiBkZWNpbWFsUGxhY2VzO1xuICAgICAgICAgICAgICAgICAgICB5bWF4ID0geW1pbjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZihwb2x5UmluZ1tqXVswXSA8IHhtaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHhtaW4gPSBNYXRoLmZsb29yKHBvbHlSaW5nW2pdWzBdIC8gZGVjaW1hbFBsYWNlcykgKiBkZWNpbWFsUGxhY2VzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmKHBvbHlSaW5nW2pdWzBdID4geG1heCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgeG1heCA9IE1hdGguZmxvb3IocG9seVJpbmdbal1bMF0gLyBkZWNpbWFsUGxhY2VzKSAqIGRlY2ltYWxQbGFjZXM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYocG9seVJpbmdbal1bMV0gPCB5bWluKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB5bWluID0gTWF0aC5mbG9vcihwb2x5UmluZ1tqXVsxXSAvIGRlY2ltYWxQbGFjZXMpICogZGVjaW1hbFBsYWNlcztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZihwb2x5UmluZ1tqXVsxXSA+IHltYXgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHltYXggPSBNYXRoLmZsb29yKHBvbHlSaW5nW2pdWzFdIC8gZGVjaW1hbFBsYWNlcykgKiBkZWNpbWFsUGxhY2VzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzaXRlczogcG9seWdvblNpdGVzLFxuICAgICAgICAgICAgYmJveDoge1xuICAgICAgICAgICAgICAgIHhsOiB4bWluLFxuICAgICAgICAgICAgICAgIHhyOiB4bWF4LFxuICAgICAgICAgICAgICAgIHl0OiB5bWluLFxuICAgICAgICAgICAgICAgIHliOiB5bWF4XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtHZW9tZXRyeX0gZ2VvbVxuICAgICAqIEByZXR1cm5zIHt7dHlwZTogc3RyaW5nLCBnZW9tZXRyeTogR2VvbWV0cnl9fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3RvR2VvSlNPTkZlYXR1cmUoZ2VvbSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICAgICAgICAgICAgXCJnZW9tZXRyeVwiOiBnZW9tXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gY29vcmRpbmF0ZXNcbiAgICAgKiBAcmV0dXJucyB7e3R5cGU6IHN0cmluZywgY29vcmRpbmF0ZXM6IG51bWJlcltdfX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90b0dlb0pTT05Qb2x5Z29uKGNvb3JkaW5hdGVzKSB7XG4gICAgICAgIGNvbnN0IGdlb20gPSB7XG4gICAgICAgICAgICBcInR5cGVcIjogXCJQb2x5Z29uXCIsXG4gICAgICAgICAgICBcImNvb3JkaW5hdGVzXCI6IFtjb29yZGluYXRlc11cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuKGdlb20pO1xuICAgIH1cbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IEdlb0pTT05VdGlscygpO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0iXX0=

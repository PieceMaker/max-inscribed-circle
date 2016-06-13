var Voronoi = require('voronoi');
var voronoi = new Voronoi;
var centroid = require('turf-centroid');
var point = require('turf-point');
var pointOnLine = require('./lib/turf-point-on-line/index.js');
var within = require('turf-within');
var makeError = require('make-error');
var NoPointsInShapeError = makeError('NoPointsInShapeError');
var GeoJSONUtils = require('./utils/geojson-utils.js');

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
    var polySites = GeoJSONUtils.sites(polygon, decimalPlaces);
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
    vertices.features.push(centroid(polygon));
    //within requires a FeatureCollection for input polygons
    var polygonFeatureCollection = {
        type: "FeatureCollection",
        features: [polygon]
    };
    var ptsWithin = within(vertices, polygonFeatureCollection); //remove any vertices that are not inside the polygon
    if(ptsWithin.features.length == 0) {
        throw new NoPointsInShapeError('Neither the centroid nor any Voronoi vertices intersect the shape.');
    }
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

module.exports.NoPointsInShapeError = NoPointsInShapeError;
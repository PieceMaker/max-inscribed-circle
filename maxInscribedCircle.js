var Voronoi = require('voronoi');
var voronoi = new Voronoi;
var point = require('turf-point');
var pointOnLine = require('./lib/turf-point-on-line/index.js');
var within = require('turf-within');
var GeoJSONUtils = require('./utils/GeoJSONUtils.js');

/**
 * Takes a polygon feature and estimates the best position for label placement that is guaranteed to be inside the polygon. This uses voronoi to estimate the medial axis.
 *
 * @module turf/label-position
 * @param {Polygon} polygon a Polygon feature of the underlying polygon geometry in EPSG:4326
 * @returns {Point} a Point feature at the best estimated label position
 */

module.exports = function(polygon) {
    polygon = GeoJSONUtils.fixMultiPoly(polygon);
    var polySites = GeoJSONUtils.sites(polygon);
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
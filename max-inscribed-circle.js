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
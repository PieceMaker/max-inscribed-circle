import {assert} from 'chai';
import Voronoi from 'voronoi';
const voronoi = new Voronoi;
import centroid from '@turf/centroid';
import point from 'turf-point';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import within from '@turf/points-within-polygon';
import { NoPointsInShapeError } from './errors';
import GeoJSONUtils from './utils/geojson-utils.js';

/**
 * Takes a polygon feature and estimates the best position for label placement that is guaranteed to be inside the polygon. This uses voronoi to estimate the medial axis.
 *
 * @module turf/label-position
 * @param {Polygon} polygon - A GeoJSON Polygon feature of the underlying polygon geometry in EPSG:4326
 * @param {Object} [options]
 * @param {number} [options.decimalPlaces=1e-20] A power of 10 used to truncate the decimal places of the
 *   polygon sites and bbox. This is a workaround due to the issue referred to here:
 *   https://github.com/gorhill/Javascript-Voronoi/issues/15
 *   If left empty, will default to truncating at 20th decimal place.
 * @param {integer} [options.numSegments=2] The number of equal segments we split each polygon line into.
 *   The higher the value, the better the medial axis approximation. However, compute time will increase.
 * @param {string} [options.units="degrees"] The units of the returned radius. Defaults to "degrees" as that's
 *   the units of the input coordinates, but may also be "radians", "miles", or "kilometers".
 * @returns {Point} A Point feature at the best estimated label position
 */

function maxInscribedCircle(polygon, options) {
    options = Object.assign(
        {},
        {
            decimalPlaces: 1e-20,
            numSegments: 2,
            units: "degrees"
        }, // Default
        options // Overrides
    );
    const inputProperties = Object.assign({}, polygon.properties || {});
    assert.isNumber(options.decimalPlaces);
    assert.include(
        [ 'degrees', 'kilometers', 'miles', 'radians' ],
        options.units,
        'Invalid value for "options.units". Value values are: "degrees", "kilometers", "miles", and "radians".'
    );

    const decimalPlaces = options.decimalPlaces;
    const numSegments = options.numSegments;
    const units = options.units;

    polygon = GeoJSONUtils.fixMultiPoly(polygon);
    const polySites = GeoJSONUtils.sites(polygon, numSegments, decimalPlaces);
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
        throw new NoPointsInShapeError(
            'Neither the centroid nor any Voronoi vertices intersect the shape.',
            polygonFeatureCollection,
            vertices
        );
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
                vertexDistance = nearestPointOnLine(polygonBoundaries.features[l], ptsWithin.features[k], {units: units}).properties.dist;
            } else {
                vertexDistance = Math.min(vertexDistance,
                    nearestPointOnLine(polygonBoundaries.features[l], ptsWithin.features[k], {units: units}).properties.dist);
            }
        }
        if(vertexDistance > labelLocation.maxDist) {
            labelLocation.coordinates = ptsWithin.features[k].geometry.coordinates;
            labelLocation.maxDist = vertexDistance;
        }
    }

    return point(
        labelLocation.coordinates,
        Object.assign(
            inputProperties || {},
            {radius: labelLocation.maxDist, units: units}
        )
    );
};

export default maxInscribedCircle;
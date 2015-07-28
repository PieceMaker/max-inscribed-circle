var voronoi = new Voronoi();
var point = require('turf/node_modules/turf-point');
var pointOnLine = require('turf/node_modules/turf-point-on-line');
var within = require('turf/node_modules/turf-within');

/**
 * Takes a polygon feature and estimates the best position for label placement that is guaranteed to be inside the polygon. This uses voronoi to estimate the medial axis.
 *
 * @module turf/label-position
 * @param {Polygon} field a Polygon feature of the underlying field geometry in EPSG:4326
 * @returns {Point} a Point feature at the best estimated label position
 */

module.exports = function(field) {
    var fieldSites = sites(field);
    var diagram = voronoi.compute(fieldSites.sites, fieldSites.bbox);
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

    var ptsWithin = within(vertices, field); //remove any vertices that are not inside the polygon

    var labelLocation = {
        coordinates: [0,0],
        maxDist: 0
    };

    var fieldBoundaries = {
        type: "FeatureCollection",
        features: []
    };

    //define borders of polygon and holes as LineStrings
    for(var j = 0; j < field.features[0].geometry.coordinates.length; j++) {
        fieldBoundaries.features.push({
            type: "Feature",
            properties: {},
            geometry: {
                type: "LineString",
                coordinates: field.features[0].geometry.coordinates[j]
            }
        })
    }

    var vertexDistance;

    for(var k = 0; k < ptsWithin.features.length; k++) {
        for(var l = 0; l < fieldBoundaries.features.length; l++) {
            if(l == 0) {
                vertexDistance = pointOnLine(fieldBoundaries.features[l], ptsWithin.features[k]).properties.dist;
            } else {
                vertexDistance = Math.min(vertexDistance,
                    pointOnLine(fieldBoundaries.features[l], ptsWithin.features[k]).properties.dist);
            }
        }
        if(vertexDistance > labelLocation.maxDist) {
            labelLocation.coordinates = ptsWithin.features[k].geometry.coordinates;
            labelLocation.maxDist = vertexDistance;
        }
    }

    return point(labelLocation.coordinates);
};

function sites(field) {
    var fieldSites = [];
    var xmin,xmax,ymin,ymax;
    for(var i = 0; i < field.features[0].geometry.coordinates.length; i++) {
        var polyRing = field.features[0].geometry.coordinates[i].slice();
        for(var j = 0; j < polyRing.length-1; j++) {
            //Push original point
            fieldSites.push({
                x: polyRing[j][0],
                y: polyRing[j][1]
            });
            //Push midpoints of segments
            fieldSites.push({
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
        sites: fieldSites,
        bbox: {
            xmin: xmin,
            xmax: xmax,
            ymin: ymin,
            ymax: ymax
        }
    };
}
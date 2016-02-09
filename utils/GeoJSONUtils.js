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
 * @returns {{sites: Array, bbox: {xl: *, xr: *, yt: *, yb: *}}}
 */
GeoJSONUtils.prototype.sites = function(polygon) {
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
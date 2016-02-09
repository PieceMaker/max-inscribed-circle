// ---------------------------------------------------------------------------------------------------------------------
// GeoJSONUtils
//
// @module
// ---------------------------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------------------------

function GeoJSONUtils() {
}

/**
 * Checks to see if the feature is a Polygon formatted as a MultiPolygon. Does not return anything,
 * instead saves results directly back to feature passed in.
 *
 * @param polygon
 * @private
 */
GeoJSONUtils.prototype._fixMultiPoly = function(polygon) {
    if(polygon.geometry.type == 'MultiPolygon' && polygon.geometry.coordinates[0].length == 1) {
        polygon.geometry.type = 'Polygon';
        polygon.geometry.coordinates = polygon.geometry.coordinates[0];
    }
    //else if(polygon.geometry.type == 'MultiPolygon' && polygon.geometry.coordinates.length > 1) {
    //    var polygons = {
    //        "type": "FeatureCollection",
    //        "features": []
    //    };
    //    polygon.geometry.coordinates.forEach(function(coordinates) {
    //
    //    });
    //}
};

/**
 * Takes a polygon and generates the sites needed to generate Voronoi
 *
 * @param polygon
 * @returns {{sites: Array, bbox: {xl: *, xr: *, yt: *, yb: *}}}
 * @private
 */
GeoJSONUtils.prototype._sites = function(polygon) {
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
        "coordinates": coordinates
    };
    return(geom);
};

// ---------------------------------------------------------------------------------------------------------------------

module.exports = new GeoJSONUtils();

// ---------------------------------------------------------------------------------------------------------------------
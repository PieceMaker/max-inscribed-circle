// ---------------------------------------------------------------------------------------------------------------------
// GeoJSONUtils
//
// @module
// ---------------------------------------------------------------------------------------------------------------------

import area from '@turf/area';
import {indexOf, map, max} from 'lodash';

// ---------------------------------------------------------------------------------------------------------------------

class GeoJSONUtils {
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
            const polygons = map(polygon.geometry.coordinates[0], ((coordinates) => {
                return this._toGeoJSONFeature(
                    this._toGeoJSONPolygon(coordinates)
                );
            }));
            const collectionArea = map(polygons, area);
            const largestAreaIndex = indexOf(collectionArea, max(collectionArea));

            return polygons[largestAreaIndex];
        } else {
            return polygon;
        }
    }

    /**
     * Takes a polygon and generates the sites needed to generate Voronoi
     *
     * @param {Polygon} polygon
     * @param {integer} [numSegments=2] The number of equal segments we split each polygon line into.
     *   The higher the value, the better the medial axis approximation. However, comput time will increase.
     * @param {number} [decimalPlaces=1e-20] A power of 10 used to truncate the decimal places of the polygon sites and
     *   bbox. This is a workaround due to the issue referred to here:
     *   https://github.com/gorhill/Javascript-Voronoi/issues/15
     *   Defaults to 1e-20.
     * @returns {{sites: Array, bbox: {xl: number, xr: number, yt: number, yb: number}}}
     */
    sites(polygon, numSegments = 2, decimalPlaces = 1e-20) {
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
                //Push segments
                for(let k = 1; k < numSegments; k++) {
                    polygonSites.push({
                        x: Math.floor((polyRing[j][0]+(polyRing[j+1][0]-polyRing[j][0]) * k / numSegments) / decimalPlaces) * decimalPlaces,
                        y: Math.floor((polyRing[j][1]+(polyRing[j+1][1]-polyRing[j][1]) * k / numSegments) / decimalPlaces) * decimalPlaces
                    });
                }
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

export default new GeoJSONUtils();

// ---------------------------------------------------------------------------------------------------------------------
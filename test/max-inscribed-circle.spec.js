// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the maxInscribedCircle.spec.js module.
//
// @module maxInscribedCircle.spec.js
// ---------------------------------------------------------------------------------------------------------------------

import { expect } from 'chai';
import centroid from '@turf/centroid';
import maxInscribedCircle from '../max-inscribed-circle';

// ---------------------------------------------------------------------------------------------------------------------

describe('MaxInscribedCircle', function()
{
    beforeEach(function()
    {
        // Test 1
        this.inputPolygon = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [0.0, 0.0],
                    [1.0, 0.0],
                    [1.0, 3.0],
                    [2.0, 3.0],
                    [2.0, 0.0],
                    [3.0, 0.0],
                    [3.0, 4.0],
                    [0.0, 4.0],
                    [0.0, 0.0]
                ]]
            },
            "properties": {
                "id": 1
            }
        };
        this.expectedPoint = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [1.25, 3.5]
            },
            "properties": {
                "id": 1,
                "radius": 0.4994165362629234,
                "units": "degrees"
            }
        };
        this.expectedPointFiveSegments = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    0.5608695652173914,
                    3.4043478260869566
                ]
            },
            "properties": {
                "id": 1,
                "radius": 0.5592622404253412,
                "units": "degrees"
            }
        };
        this.expectedPointRadians = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [1.25, 3.5]
            },
            "properties": {
                "id": 1,
                "radius": 0.008726647167630651,
                "units": "radians"
            }
        };

        // Test 2
        this.inputFakeMultiPolygon = {
            "type": "Feature",
            "geometry": {
                "type": "MultiPolygon",
                "coordinates": [[[
                    [0.0, 0.0],
                    [1.0, 0.0],
                    [1.0, 3.0],
                    [2.0, 3.0],
                    [2.0, 0.0],
                    [3.0, 0.0],
                    [3.0, 4.0],
                    [0.0, 4.0],
                    [0.0, 0.0]
                ]]]
            },
            "properties": {
                "id": 1
            }
        };

        // Test 3
        this.inputMultiPolygon = {
            "type": "Feature",
            "geometry": {
                "type": "MultiPolygon",
                "coordinates": [
                    [
                        [
                            [0.0, 0.0],
                            [1.0, 0.0],
                            [1.0, 3.0],
                            [2.0, 3.0],
                            [2.0, 0.0],
                            [3.0, 0.0],
                            [3.0, 4.0],
                            [0.0, 4.0],
                            [0.0, 0.0]
                        ],
                        [
                            [1.0, -2.0],
                            [2.0, -2.0],
                            [2.0, -1.0],
                            [1.0, -1.0],
                            [1.0, -2.0]
                        ]
                    ]
                ]
            },
            "properties": {
                "id": 1
            }
        };

        // Test 4
        this.inputTinyPolygon = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-111.839291588403, 40.1198633592576], [-111.839286482893, 40.1198647078127],
                    [-111.839271728881, 40.1199017059989], [-111.839291588403, 40.1198633592576]
                ]]
            },
            "properties": {}
        };

        // Test 5
        this.trianglePolygon = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [0, 0],
                    [5, 0],
                    [5, 1],
                    [0, 0]
                ]]
            }
        };
        this.expectedTrianglePointTwoSegments = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    3.75,
                    0.25
                ]
            },
            "properties": {
                "radius": 0.2497082421592924,
                "units": "degrees"
            }
        };
        this.expectedTrianglePointTenSegments = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    4.55,
                    0.44999999999999996
                ]
            },
            "properties": {
                "radius": 0.44946097534854745,
                "units": "degrees"
            }
        };
    });

    afterEach(function()
    {
        // Code goes here.
    });

    // Test 1a
    it('should output the expected GeoJSON point', function()
    {
        expect(maxInscribedCircle(this.inputPolygon)).to.eql(this.expectedPoint);
    });
    // Test 1b
    it('should output the expected GeoJSON point with radius in radians', function()
    {
        expect(maxInscribedCircle(this.inputPolygon, {units: "radians"})).to.eql(this.expectedPointRadians);
    });
    // Test 1c
    it('should correctly calculate segments', function()
    {
        expect(maxInscribedCircle(this.inputPolygon, {numSegments: 5})).to.eql(this.expectedPointFiveSegments);
    });

    // Test 2
    it('should handle Polygons in format of MultiPolygons correctly', function()
    {
        expect(maxInscribedCircle(this.inputFakeMultiPolygon)).to.eql(this.expectedPoint);
    });

    // Test 3
    it('should handle MultiPolygons correctly', function()
    {
        expect(maxInscribedCircle(this.inputMultiPolygon)).to.eql(this.expectedPoint);
    });

    // Test 4
    it('should return the centroid when no Voronoi vertices are inside polygon', function()
    {
        expect(maxInscribedCircle(this.inputTinyPolygon).geometry).to.eql(centroid(this.inputTinyPolygon).geometry);
    });

    // Test 5a
    it('should return the expected point for polygon submitted in issue', function()
    {
        expect(maxInscribedCircle(this.trianglePolygon, {numSegments: 2})).to.eql(this.expectedTrianglePointTwoSegments);
    });
    // Test 5b
    it('should return the expected point for polygon submitted in issue', function()
    {
        expect(maxInscribedCircle(this.trianglePolygon, {numSegments: 10})).to.eql(this.expectedTrianglePointTenSegments);
    });
});

// ---------------------------------------------------------------------------------------------------------------------
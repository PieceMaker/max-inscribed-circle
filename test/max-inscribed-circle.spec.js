// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the maxInscribedCircle.spec.js module.
//
// @module maxInscribedCircle.spec.js
// ---------------------------------------------------------------------------------------------------------------------

const expect = require('chai').expect;
const centroid = require('@turf/centroid').default;
const maxCircle = require('../dist/max-inscribed-circle.js');

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
            "properties": {}
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
    });

    afterEach(function()
    {
        // Code goes here.
    });

    // Test 1
    it('should output the expected GeoJSON point', function()
    {
        expect(maxCircle(this.inputPolygon)).to.eql(this.expectedPoint);
    });

    // Test 2
    it('should handle Polygons in format of MultiPolygons correctly', function()
    {
        expect(maxCircle(this.inputFakeMultiPolygon)).to.eql(this.expectedPoint);
    });

    // Test 3
    it('should handle MultiPolygons correctly', function()
    {
        expect(maxCircle(this.inputMultiPolygon)).to.eql(this.expectedPoint);
    });

    // Test 4
    it('should return the centroid when no Voronoi vertices are inside polygon', function()
    {
        expect(maxCircle(this.inputTinyPolygon).geometry).to.eql(centroid(this.inputTinyPolygon).geometry);
    });
});

// ---------------------------------------------------------------------------------------------------------------------
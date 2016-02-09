// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the maxInscribedCircle.spec.js module.
//
// @module maxInscribedCircle.spec.js
// ---------------------------------------------------------------------------------------------------------------------

var expect = require('chai').expect;
var maxCircle = require('../dist/max-inscribed-circle.js');

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
    });

    afterEach(function()
    {
        // Code goes here.
    });

    // Test 1
    it('should output the expected GeoJSON point', function()
    {
        expect(JSON.stringify(maxCircle(this.inputPolygon))).to.equal(JSON.stringify(this.expectedPoint));
    });

    // Test 2
    it('should handle Polygons in format of MultiPolygons correctly', function()
    {
        expect(JSON.stringify(maxCircle(this.inputFakeMultiPolygon))).to.equal(JSON.stringify(this.expectedPoint));
    });

    // Test 3
    it('should handle MultiPolygons correctly', function()
    {
        expect(JSON.stringify(maxCircle(this.inputMultiPolygon))).to.equal(JSON.stringify(this.expectedPoint));
    });
});

// ---------------------------------------------------------------------------------------------------------------------
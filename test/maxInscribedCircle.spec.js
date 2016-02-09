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
});

// ---------------------------------------------------------------------------------------------------------------------
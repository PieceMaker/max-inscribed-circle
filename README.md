# max-inscribed-circle

![Motivation](doc/images/motivation.png)

A NodeJS implementation of an algorithm for finding the center of the maximum-radius inscribed circle of a polygon. The
center of the maximum circle will occur on the [medial axis](https://en.wikipedia.org/wiki/Medial_axis) of the polygon
and the medial axis. It is known that for planar 2D polygons the
[Voronoi diagram](https://en.wikipedia.org/wiki/Voronoi_diagram) will converge to the medial axis. Thus this library
uses Voronoi to approximate the medial axis.

This library takes a GeoJSON feature with Polygon geometry and returns the centroid of the maximum-radius inscribed
circle as a GeoJSON feature with Point geometry.

It is important to note that due to the underlying [turf](https://turfjs.org/) dependencies, this library has been
written to work primarily with `(lat,lon)` coordinates. If the polygon is in a known projection then it is recommended
you transform it to `WGS84 (EPSG:4326)`. The [reproject](https://github.com/perliedman/reproject) and
[pro4](https://github.com/proj4js/proj4js) libraries on NPM are good for this.

Version 1.* of this library provided a compiled, browser-ready version in the `dist/` directory. In version 2.* we
have opted to convert the entire library into an ES6 module. See the section on ES6 to learn how to run this in
NodeJS.

## Install

```bash
npm install max-inscribed-circle
```

### Usage

This module is provided in two forms: a fully ES2020 compliant ECMA Module (the default), and a transpiled ES5 UMD.

If you are working in an environment where you can use the ECMA module, we highly recommend you do so. (Currently, only
Node v13 and the latest versions of most browsers natively support ECMA modules. However, projects that utilize
transpiling should be able to import this module without issue.)

#### ECMA Module

Simply do:

```javascript
import maxInscribedCircle from 'max-inscribed-circle';
```

#### ES5 UMD

A [UMD](https://github.com/umdjs/umd) can be used either globally, as a CommonJS module, as a RequireJS module, or even
as an ECMA Module. However, we only support (as in we have only tested) using this module as a CommonJS module inside of
Node. To do so, simply import it like this:

```javascript
const maxInscribedCircle = require('max-inscribed-circle/dist/max-inscribed-circle.es5.min.js');
```

From there, usage should be the same.

## User Guide

An in-depth user guide can be found at [doc/guide.md](doc/guide.md).

## Options

Version 2 of this library has introduced the `options` parameter. Available options are as follows:

* `decimalPlaces` - A numeric power of 10 used to truncate the decimal places of the polygon sites and bbox. This is a
                    workaround due to the issue referred to here:
                    https://github.com/gorhill/Javascript-Voronoi/issues/15. (default: `1e-20`)
* `numSegments` - An integer specifying the number of equal segments we split each polygon line into. The higher the
                  value, the better the medial axis approximation. However, compute time will increase. (default: `2`)
* `units` - A string specifying what units the radius should be returned in. Available values are: "degrees", "radians",
            "miles", or "kilometers". (default: `"degrees"`)

## Examples

```javascript
import maxInscribedCircle from 'max-inscribed-circle';
const polygon = {
    "type": "Feature",
    "geometry": {
        "type": "Polygon",
        "coordinates": [[
            [0.0,0.0],
            [1.0,0.0],
            [1.0,3.0],
            [2.0,3.0],
            [2.0,0.0],
            [3.0,0.0],
            [3.0,4.0],
            [0.0,4.0],
            [0.0,0.0]
        ]]
    },
    "properties": {
        "id": 1
    }
};

console.log(maxInscribedCircle(polygon));
/*
{
    "type": "Feature",
    "geometry": {
        "type": "Point",
        "coordinates": [1.25,3.5]
    },
    "properties": {
        "id": 1,
        "radius": 0.4994165362629234,
        "units": "degrees"
    }
}
*/

console.log(maxInscribedCircle(polygon, {units: 'radians'}));
/*
{
    "type": "Feature",
    "geometry": {
        "type": "Point",
        "coordinates": [1.25,3.5]
    },
    "properties": {
        "id": 1,
        "radius": 0.008726647167630651,
        "units": "radians"
    }
}
*/
```

![Usage](doc/images/usage.png)

If a maximum circle cannot be inscribed, then the underlying centroid will be returned. In this case, `properties` will
not define `radius` or `units`.

## ES6

It was mentioned at the beginning of this documentation that this library has been converted to an ES6 module. This
decision was made since ES6 modules are natively supported in browsers and
[Node 12 will natively support ES6 modules](https://medium.com/@nodejs/announcing-a-new-experimental-modules-1be8d2d6c2ff)
in the near future. Until native support drops, it is recommended that you use the
[esm module](https://www.npmjs.com/package/esm).

## Workarounds

### Voronoi Close Cells Error

Occasionally this library will fail with the error `Voronoi.closeCells() > this makes no sense!`. This is a known issue
with floating point precision and was discussed in an issue in the voronoi library project page:
https://github.com/gorhill/Javascript-Voronoi/issues/15. There does not appear to be a guaranteed fix as of yet, but a
workaround argument has been added, `decimalPlaces`, which is used to truncate the inputs. It is recommended that you
run the function in a retry without defining `decimalPlaces`. If the voronoi error is thrown, retry and define
`decimalPlaces` as something relevant to your polygon, such as `1e-10`. Continue to increase this value until the error
is no longer thrown.

Note, this error has so far only been detected when running in Chrome. It has not currently been a reported issue in
Node.


# max-inscribed-circle
A NodeJS implementation of an algorithm for finding the center of the maximum-radius inscribed circle of a polygon. The center of the maximum circle will occur on the [medial axis](https://en.wikipedia.org/wiki/Medial_axis) of the polygon and the medial axis. It is known that for planar 2D polygons the [Voronoi diagram](https://en.wikipedia.org/wiki/Voronoi_diagram) will converge to the medial axis. Thus this library uses Voronoi to approximate the medial axis.
   
This library takes a GeoJSON feature with Polygon geometry and returns the centroid of the maximum-radius inscribed circle as a GeoJSON feature with Point geometry.

This library uses browserify to build a browser-ready version of this library. This version is included in the `dist/` directory.

It is important to note that due to the underlying `turf` dependencies, this library has been written to work primarily with `(lat,lon)` coordinates. If the polygon is in a known projection then it is recommended you transform it to `WGS84 (EPSG:4326)`. The `reproject` and `pro4` libraries on NPM are good for this.

## Getting Started

Install dependencies:

```bash
npm install
```

To browserify the library run:

```bash
grunt build
```

The output file will be in the `dist/` directory.

### Global Include

Just include the file in your page, and then reference it:

```html
<html>
   <head>
      <!-- ... -->
   </head>
   <body>
      <!-- ... -->
      <script src="/vendor/max-inscribed-circle/dist/max-inscribed-circle.min.js"></script>
      <script>
         var polygon = { /* ... */ };
         console.log(maxInscribedCircle(polygon));
      </script>
   </body>
</html>
```

(The library is exposed as `window.maxInscribedCircle`.)

### Node/Browserify

You can simple require the module directly, after installing it from NPM.

```javascript
var maxCircle = require('./max-inscribed-circle.js');
var polygon = { /* ... */};

console.log(maxCircle(polygon));
```

## Examples

```javascript
var maxCircle = require('./max-inscribed-circle.js');
var polygon = {
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

console.log(maxCircle(polygon));
/*
{
    "type": "Feature",
    "geometry": {
        "type": "Point",
        "coordinates": [1.25,3.5]
    },
    "properties": {
        "radius": 0.4994165362629234,
        "units": "degrees"
    }
}
*/
```

If a maximum circle cannot be inscribed, then the underlying centroid will be returned. In this case, `properties` will not define `radius` or `units`.

## Future

* Add ability to work with polygons in units other than `(lat,lon)`.
* Add ability to specify properties to copy from GeoJSON object passed in to returned GeoJSON object.
* Add ability to specify the complexity of the Voronoi approximation.

## Workarounds

### Voronoi Close Cells Error

Occasionally this library will fail with the error `Voronoi.closeCells() > this makes no sense!`. This is a known issue with floating point precision and was discussed in an issue in the voronoi library project page: https://github.com/gorhill/Javascript-Voronoi/issues/15. There does not appear to be a guaranteed fix as of yet, but a workaround argument has been added, `decimalPlaces`, which is used to truncate the inputs. It is recommended that you run the function in a retry without defining `decimalPlaces`. If the voronoi error is thrown, retry and define `decimalPlaces` as something relevant to your polygon, such as `1e-10`. Continue to increase this value until the error is no longer thrown.
  
Note, this error has so far only been detected when running in Chrome. It has not currently been a reported issue in Node.


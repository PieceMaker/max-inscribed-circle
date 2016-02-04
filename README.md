# max-inscribed-circle
A NodeJS implementation of an algorithm for finding the center of the maximum-radius inscribed circle of a polygon. The center of the maximum circle will occur on the [medial axis](https://en.wikipedia.org/wiki/Medial_axis) of the polygon and the medial axis. It is known that for planar 2D polygons the [Voronoi diagram](https://en.wikipedia.org/wiki/Voronoi_diagram) will converge to the medial axis. Thus this library uses Voronoi to approximate the medial axis.
   
This library takes a GeoJSON feature with Polygon geometry and returns the centroid of the maximum-radius inscribed circle as a GeoJSON feature with Point geometry.

This library uses browserify build a browser-ready version of this library. This version is included in the `dist/` directory.

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

## Examples



## Future

* Add ability to work with polygons in units other than `(lat,lon)`.
* Add ability to specify properties to copy from GeoJSON object passed in to returned GeoJSON object.
# User Guide

## Background

The goal of this library is to automatically calculate an optimal point that is always guaranteed to fall inside a
polygon. It was conceived when trying to optimize label placement in geometric shape data. Initial attempts at label
placement used the centroid. However, non-convex shapes were quite common and often labels would get drawn outside
the shape. Additionally, many shapes had centroids that resulted in label locations that did not look good to the naked
eye, typically residing in small areas of the shape such as narrow strips or near holes.

After some visual analysis and research, it became obvious that the optimal location for label placement would be at
the center of the largest circle that can be inscribed in the shape. This location is optimal as it is the part of the
shape that has the most space around it.

![Motivation](images/motivation.png)

This circle, known as the maximum inscribed circle, will always have its center lie on the
[medial axis](https://en.wikipedia.org/wiki/Medial_axis) of the shape. The medial axis can be thought of as the bone
structure of a shape, where every point on the medial axis has at least two equidistant closest points on the shape.
Note, the following example is a manual approximation and is not 100% accurate, particularly in the curved segments.

![Medial Axis](images/medial-axis.png)

A [Voronoi diagram](https://en.wikipedia.org/wiki/Voronoi_diagram) over the discretized edges of the shape can be used
to approximate the medial axis and, as the discretized points tend to infinity the diagram will start to converge to
the medial axis.

![2-secting](images/voronoi-2-secting.png)
![10-secting](images/voronoi-10-secting.png)

It is quite evident in the above plots how the Voronoi diagram becomes much closer to the medial axis as we go from
2-secting (bisecting) to 10-secting the edges of the shape.

## Usage

This library can be installed from NPM.

```bash
npm install max-inscribed-circle
```

To run it, simply import it and pass it a GeoJSON Polygon or MultiPolygon.

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
```

![Usage](images/usage.png)

There are actually infinitely many maximum inscribed circles in this sample shape. This library returns the first one
it finds.

## Options

There are three different options that can be specified when executing `maxInscribedCircle`. They are `decimalPlaces`,
`numSegments`, and `units`. Each of these is documented in their own subsection below.

### `decimalPlaces` - default `1e-20`

`decimalPlaces` is an option that was introduced as a workaround for a bug in the underlying voronoi library. Certain
polygons can cause the voronoi library to throw the error `Voronoi.closeCells() > this makes no sense!`. This is a
problem caused by floating point precision and the best workaround found so far has been to decrease the decimal
precision in calculations whenever this error is thrown. Note, using this option to decrease the precision will result
in less accurate estimates of the maximum inscribed circle.
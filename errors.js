class NoPointsInShapeError extends Error {
    constructor(message, polygon, vertices) {
        super(message);
        this.polygon = polygon;
        this.vertices = vertices;
    }

    toJSON() {
        return {
            message: this.message,
            polygon: this.polygon,
            vertices: this.vertices
        };
    }
}

module.exports = {
    NoPointsInShapeError
};
package com.shy.digitalmuseum.domain;

/** A navigable panorama position in a scenic site. */
public record PanoramaNode(
        String id,
        String name,
        String type,
        GeoPoint position,
        String thumbnailUrl,
        String description
) {
}

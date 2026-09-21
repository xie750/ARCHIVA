package com.shy.digitalmuseum.domain;

/** A point of interest shown on a scenic-site map. */
public record SitePoi(
        String id,
        String name,
        String type,
        GeoPoint position,
        String description,
        String modelId
) {
}

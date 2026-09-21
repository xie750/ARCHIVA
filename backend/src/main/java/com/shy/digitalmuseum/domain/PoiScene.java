package com.shy.digitalmuseum.domain;

/** The 3D scene associated with one point of interest. */
public record PoiScene(String siteId, String poiId, String modelId, ModelManifest manifest) {
}

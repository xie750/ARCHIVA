package com.shy.digitalmuseum.dto;

import com.shy.digitalmuseum.domain.ModelManifest;
import com.shy.digitalmuseum.domain.PoiScene;

public record PoiSceneResponse(
        String siteId,
        String poiId,
        String modelId,
        ModelManifest manifest
) {
    public static PoiSceneResponse from(PoiScene scene) {
        return new PoiSceneResponse(scene.siteId(), scene.poiId(), scene.modelId(), scene.manifest());
    }
}

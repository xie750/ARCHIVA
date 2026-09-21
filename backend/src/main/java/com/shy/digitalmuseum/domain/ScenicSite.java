package com.shy.digitalmuseum.domain;

import java.util.List;

/** Site-level contract used by the map and panorama experience. */
public record ScenicSite(
        String siteId,
        String regionCode,
        String name,
        GeoPoint center,
        List<PanoramaNode> panoramaNodes,
        List<SitePoi> poi
) {
    public ScenicSite {
        panoramaNodes = panoramaNodes == null ? List.of() : List.copyOf(panoramaNodes);
        poi = poi == null ? List.of() : List.copyOf(poi);
    }
}

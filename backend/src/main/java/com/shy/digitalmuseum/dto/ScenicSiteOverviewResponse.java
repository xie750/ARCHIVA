package com.shy.digitalmuseum.dto;

import com.shy.digitalmuseum.domain.GeoPoint;
import com.shy.digitalmuseum.domain.PanoramaNode;
import com.shy.digitalmuseum.domain.ScenicSite;
import com.shy.digitalmuseum.domain.SitePoi;

import java.util.List;

public record ScenicSiteOverviewResponse(
        String siteId,
        String regionCode,
        String name,
        GeoPoint center,
        List<PanoramaNode> panoramaNodes,
        List<SitePoi> poi
) {
    public static ScenicSiteOverviewResponse from(ScenicSite site) {
        return new ScenicSiteOverviewResponse(
                site.siteId(),
                site.regionCode(),
                site.name(),
                site.center(),
                site.panoramaNodes(),
                site.poi()
        );
    }
}

package com.shy.digitalmuseum.controller;

import com.shy.digitalmuseum.dto.PoiSceneResponse;
import com.shy.digitalmuseum.dto.ScenicSiteOverviewResponse;
import com.shy.digitalmuseum.service.ScenicSiteService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sites")
public class ScenicSiteController {

    private final ScenicSiteService scenicSiteService;

    public ScenicSiteController(ScenicSiteService scenicSiteService) {
        this.scenicSiteService = scenicSiteService;
    }

    @GetMapping("/{siteId}/overview")
    public ScenicSiteOverviewResponse overview(@PathVariable String siteId) {
        return scenicSiteService.getOverview(siteId);
    }

    @GetMapping("/{siteId}/poi/{poiId}/scene")
    public PoiSceneResponse poiScene(@PathVariable String siteId, @PathVariable String poiId) {
        return scenicSiteService.getPoiScene(siteId, poiId);
    }
}

package com.shy.digitalmuseum.service;

import com.shy.digitalmuseum.domain.PoiScene;
import com.shy.digitalmuseum.domain.ScenicSite;
import com.shy.digitalmuseum.dto.PoiSceneResponse;
import com.shy.digitalmuseum.dto.ScenicSiteOverviewResponse;
import com.shy.digitalmuseum.exception.ResourceNotFoundException;
import com.shy.digitalmuseum.repository.ScenicSiteRepository;
import org.springframework.stereotype.Service;

@Service
public class ScenicSiteService {

    private final ScenicSiteRepository scenicSiteRepository;

    public ScenicSiteService(ScenicSiteRepository scenicSiteRepository) {
        this.scenicSiteRepository = scenicSiteRepository;
    }

    public ScenicSiteOverviewResponse getOverview(String siteId) {
        ScenicSite site = scenicSiteRepository.findById(siteId)
                .orElseThrow(() -> new ResourceNotFoundException("未找到景区：" + siteId));
        return ScenicSiteOverviewResponse.from(site);
    }

    public PoiSceneResponse getPoiScene(String siteId, String poiId) {
        PoiScene scene = scenicSiteRepository.findPoiScene(siteId, poiId)
                .orElseThrow(() -> new ResourceNotFoundException("未找到景区点位场景：" + siteId + "/" + poiId));
        return PoiSceneResponse.from(scene);
    }
}

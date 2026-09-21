package com.shy.digitalmuseum.repository;

import com.shy.digitalmuseum.domain.PoiScene;
import com.shy.digitalmuseum.domain.ScenicSite;

import java.util.Optional;

public interface ScenicSiteRepository {

    Optional<ScenicSite> findById(String siteId);

    Optional<PoiScene> findPoiScene(String siteId, String poiId);
}

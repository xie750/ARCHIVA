package com.shy.digitalmuseum.service;

import com.shy.digitalmuseum.domain.Building;
import com.shy.digitalmuseum.domain.ModelManifest;
import com.shy.digitalmuseum.dto.BuildingDetailResponse;
import com.shy.digitalmuseum.dto.BuildingPageResponse;
import com.shy.digitalmuseum.dto.BuildingSummaryResponse;
import com.shy.digitalmuseum.exception.ResourceNotFoundException;
import com.shy.digitalmuseum.repository.BuildingRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class BuildingService {

    private final BuildingRepository buildingRepository;

    public BuildingService(BuildingRepository buildingRepository) {
        this.buildingRepository = buildingRepository;
    }

    public BuildingPageResponse search(
            String keyword,
            String type,
            String dynasty,
            String city,
            String region,
            int page,
            int size
    ) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), 50);
        String normalizedKeyword = normalize(keyword);
        String normalizedType = normalize(type);
        String normalizedDynasty = normalize(dynasty);
        String normalizedCity = normalize(city);
        String normalizedRegion = normalize(region);

        List<Building> filtered = buildingRepository.findAll().stream()
                .filter(building -> matchesKeyword(building, normalizedKeyword))
                .filter(building -> matches(building.type(), normalizedType))
                .filter(building -> matches(building.dynasty(), normalizedDynasty))
                .filter(building -> matches(building.city(), normalizedCity))
                .filter(building -> !StringUtils.hasText(normalizedRegion) || "河南".equals(normalizedRegion))
                .sorted(Comparator.comparing(Building::name))
                .toList();

        int fromIndex = Math.min((safePage - 1) * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        List<BuildingSummaryResponse> items = filtered.subList(fromIndex, toIndex).stream()
                .map(BuildingSummaryResponse::from)
                .toList();
        int totalPages = filtered.isEmpty() ? 0 : (int) Math.ceil((double) filtered.size() / safeSize);
        return new BuildingPageResponse(items, safePage, safeSize, filtered.size(), totalPages);
    }

    public BuildingDetailResponse getDetail(String id) {
        return BuildingDetailResponse.from(getBuilding(id));
    }

    public ModelManifest getModelManifest(String id) {
        return getBuilding(id).modelManifest();
    }

    private Building getBuilding(String id) {
        return buildingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("未找到建筑：" + id));
    }

    private boolean matchesKeyword(Building building, String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return true;
        }
        return List.of(building.name(), building.alias(), building.summary(), building.description())
                .stream()
                .filter(StringUtils::hasText)
                .map(value -> value.toLowerCase(Locale.ROOT))
                .anyMatch(value -> value.contains(keyword));
    }

    private boolean matches(String value, String expected) {
        return !StringUtils.hasText(expected) || normalize(value).equals(expected);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}

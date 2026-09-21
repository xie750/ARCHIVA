package com.shy.digitalmuseum.dto;

import com.shy.digitalmuseum.domain.Building;
import com.shy.digitalmuseum.domain.BuildingContentSection;
import com.shy.digitalmuseum.domain.SourceReference;

import java.util.List;

public record BuildingDetailResponse(
        BuildingSummaryResponse summary,
        String description,
        List<BuildingContentSection> contentSections,
        List<SourceReference> sourceReferences
) {
    public static BuildingDetailResponse from(Building building) {
        return new BuildingDetailResponse(
                BuildingSummaryResponse.from(building),
                building.description(),
                building.contentSections(),
                building.sourceReferences()
        );
    }
}

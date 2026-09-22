package com.shy.digitalmuseum.dto;

import com.shy.digitalmuseum.domain.Building;

import java.util.List;

public record BuildingSummaryResponse(
        String id,
        String region,
        String name,
        String alias,
        String city,
        String district,
        String type,
        String dynasty,
        String era,
        String protectionLevel,
        String summary,
        String coverImage,
        double latitude,
        double longitude,
        List<String> tags
) {
    public static BuildingSummaryResponse from(Building building) {
        return new BuildingSummaryResponse(
                building.id(),
                building.region(),
                building.name(),
                building.alias(),
                building.city(),
                building.district(),
                building.type(),
                building.dynasty(),
                building.era(),
                building.protectionLevel(),
                building.summary(),
                building.coverImage(),
                building.latitude(),
                building.longitude(),
                building.tags()
        );
    }
}

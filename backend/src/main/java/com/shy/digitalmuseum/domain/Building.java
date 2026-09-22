package com.shy.digitalmuseum.domain;

import java.util.List;

public record Building(
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
        String description,
        String coverImage,
        double latitude,
        double longitude,
        List<String> tags,
        List<BuildingContentSection> contentSections,
        List<SourceReference> sourceReferences,
        ModelManifest modelManifest
) {
    public Building {
        // Existing SQLite payloads predate the region field. Keep those records
        // readable while making the region explicit for future provinces.
        region = region == null || region.isBlank() ? "河南" : region.trim();
        tags = tags == null ? List.of() : List.copyOf(tags);
        contentSections = contentSections == null ? List.of() : List.copyOf(contentSections);
        sourceReferences = sourceReferences == null ? List.of() : List.copyOf(sourceReferences);
    }
}

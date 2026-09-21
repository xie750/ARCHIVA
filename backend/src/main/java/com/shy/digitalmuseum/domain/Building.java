package com.shy.digitalmuseum.domain;

import java.util.List;

public record Building(
        String id,
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
        tags = tags == null ? List.of() : List.copyOf(tags);
        contentSections = contentSections == null ? List.of() : List.copyOf(contentSections);
        sourceReferences = sourceReferences == null ? List.of() : List.copyOf(sourceReferences);
    }
}

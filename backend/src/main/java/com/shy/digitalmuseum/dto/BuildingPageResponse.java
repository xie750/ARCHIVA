package com.shy.digitalmuseum.dto;

import java.util.List;

public record BuildingPageResponse(
        List<BuildingSummaryResponse> items,
        int page,
        int size,
        long total,
        int totalPages
) {
}

package com.shy.digitalmuseum.controller;

import com.shy.digitalmuseum.domain.ModelManifest;
import com.shy.digitalmuseum.dto.BuildingDetailResponse;
import com.shy.digitalmuseum.dto.BuildingPageResponse;
import com.shy.digitalmuseum.service.BuildingService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping({"/api/buildings", "/api/v1/buildings"})
public class BuildingController {

    private final BuildingService buildingService;

    public BuildingController(BuildingService buildingService) {
        this.buildingService = buildingService;
    }

    @GetMapping
    public BuildingPageResponse list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String dynasty,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String region,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "12") @Min(1) @Max(50) int size
    ) {
        return buildingService.search(keyword, type, dynasty, city, region, page, size);
    }

    @GetMapping("/{id}")
    public BuildingDetailResponse detail(@PathVariable String id) {
        return buildingService.getDetail(id);
    }

    @GetMapping("/{id}/model-manifest")
    public ModelManifest modelManifest(@PathVariable String id) {
        return buildingService.getModelManifest(id);
    }
}

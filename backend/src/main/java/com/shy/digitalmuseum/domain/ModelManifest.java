package com.shy.digitalmuseum.domain;

import java.util.List;
import java.util.Map;

public record ModelManifest(
        String modelId,
        String version,
        String versionStatus,
        List<LodAsset> lod,
        TextureSet textures,
        CameraPreset defaultCamera,
        List<ModelHotspot> hotspots,
        List<ModelComponent> components,
        String assetStatus,
        String source,
        String license
) {
    public ModelManifest {
        lod = lod == null ? List.of() : List.copyOf(lod);
        hotspots = hotspots == null ? List.of() : List.copyOf(hotspots);
        components = components == null ? List.of() : List.copyOf(components);
    }

    /** Backward-compatible constructor for older seed records and clients. */
    public ModelManifest(
            String modelId,
            String version,
            String versionStatus,
            List<LodAsset> lod,
            TextureSet textures,
            CameraPreset defaultCamera,
            List<ModelHotspot> hotspots,
            List<ModelComponent> components
    ) {
        this(modelId, version, versionStatus, lod, textures, defaultCamera, hotspots, components, null, null, null);
    }

    public record LodAsset(String level, String url, long bytes) {
    }

    public record TextureSet(String format, String basePath, Map<String, String> variants) {
        public TextureSet {
            variants = variants == null ? Map.of() : Map.copyOf(variants);
        }
    }

    public record CameraPreset(double[] position, double[] target, double fov) {
        public CameraPreset {
            position = position == null ? new double[]{0, 0, 0} : position.clone();
            target = target == null ? new double[]{0, 0, 0} : target.clone();
        }

        @Override
        public double[] position() {
            return position.clone();
        }

        @Override
        public double[] target() {
            return target.clone();
        }
    }

    public record ModelHotspot(
            String id,
            String title,
            double[] position,
            String content
    ) {
        public ModelHotspot {
            position = position == null ? new double[]{0, 0, 0} : position.clone();
        }

        @Override
        public double[] position() {
            return position.clone();
        }
    }

    public record ModelComponent(
            String id,
            String name,
            String nodeName,
            String parentId
    ) {
    }
}

package com.shy.digitalmuseum.repository;

import com.shy.digitalmuseum.domain.GeoPoint;
import com.shy.digitalmuseum.domain.ModelManifest;
import com.shy.digitalmuseum.domain.PanoramaNode;
import com.shy.digitalmuseum.domain.PoiScene;
import com.shy.digitalmuseum.domain.ScenicSite;
import com.shy.digitalmuseum.domain.SitePoi;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/** In-memory site adapter for the publish demo; replace with a database adapter later. */
@Repository
public class InMemoryScenicSiteRepository implements ScenicSiteRepository {

    private final Map<String, ScenicSite> sites = Map.of("longmen", longmen());
    private final Map<String, PoiScene> scenes = Map.of(
            "longmen:main-buddha", new PoiScene(
                    "longmen",
                    "main-buddha",
                    "longmen-fengxian-temple",
                    manifest("longmen-fengxian-temple", "https://cdn.example.com/henan/longmen-fengxian-temple")
            ),
            "longmen:xiangshan", new PoiScene(
                    "longmen",
                    "xiangshan",
                    "longmen-xiangshan-garden",
                    manifest("longmen-xiangshan-garden", "https://cdn.example.com/henan/longmen-xiangshan-garden")
            )
    );

    @Override
    public Optional<ScenicSite> findById(String siteId) {
        return Optional.ofNullable(sites.get(siteId));
    }

    @Override
    public Optional<PoiScene> findPoiScene(String siteId, String poiId) {
        return Optional.ofNullable(scenes.get(siteId + ":" + poiId));
    }

    private static ScenicSite longmen() {
        return new ScenicSite(
                "longmen",
                "410311",
                "龙门石窟景区",
                new GeoPoint(34.5564, 112.4708),
                List.of(
                        new PanoramaNode("west-hill-gate", "西山入口", "entrance", new GeoPoint(34.5572, 112.4691), "https://cdn.example.com/henan/longmen/pano-west-gate.webp", "从西山入口沿伊河展开龙门石窟的第一段游览路径。"),
                        new PanoramaNode("fengxian-platform", "奉先寺平台", "viewpoint", new GeoPoint(34.5590, 112.4692), "https://cdn.example.com/henan/longmen/pano-fengxian.webp", "可观察奉先寺主佛、崖壁和伊河对岸山体的空间关系。"),
                        new PanoramaNode("xiangshan-terrace", "香山远眺台", "viewpoint", new GeoPoint(34.5550, 112.4745), "https://cdn.example.com/henan/longmen/pano-xiangshan.webp", "从东山回望西山石窟群，适合理解遗产地的整体山水格局。"),
                        new PanoramaNode("river-crossing", "伊河漫步段", "route", new GeoPoint(34.5549, 112.4717), "https://cdn.example.com/henan/longmen/pano-river.webp", "沿伊河连接西山、东山和香山景观节点。")
                ),
                List.of(
                        new SitePoi("main-buddha", "奉先寺卢舍那大佛", "3d-exhibit", new GeoPoint(34.5590, 112.4692), "唐代奉先寺主佛，是龙门石窟最具代表性的空间与造像节点。", "longmen-fengxian-temple"),
                        new SitePoi("xiangshan", "香山寺", "heritage", new GeoPoint(34.5550, 112.4745), "位于东山香山，连接龙门石窟的山水游览和文化记忆。", "longmen-xiangshan-garden"),
                        new SitePoi("binyang-cave", "宾阳三洞", "grotto", new GeoPoint(34.5607, 112.4687), "北魏至唐代持续营造的代表性洞窟群。", null)
                )
        );
    }

    private static ModelManifest manifest(String modelId, String basePath) {
        return new ModelManifest(
                modelId,
                "1.0.0",
                "PUBLISHED",
                List.of(
                        new ModelManifest.LodAsset("low", basePath + "/model-low.glb", 7_800_000),
                        new ModelManifest.LodAsset("medium", basePath + "/model-medium.glb", 23_400_000),
                        new ModelManifest.LodAsset("high", basePath + "/model-high.glb", 64_000_000)
                ),
                new ModelManifest.TextureSet(
                        "KTX2",
                        basePath + "/textures/",
                        Map.of("mobile", "1k", "desktop", "2k", "detail", "4k")
                ),
                new ModelManifest.CameraPreset(new double[]{20, 12, 24}, new double[]{0, 5, 0}, 45),
                List.of(
                        new ModelManifest.ModelHotspot("main-view", "主景视角", new double[]{0, 4, 0}, "从主视角阅读造像、崖壁与平台的空间关系。"),
                        new ModelManifest.ModelHotspot("carving", "石窟细部", new double[]{2.4, 8.1, -1.2}, "此处可挂接造像比例、雕刻工艺和保护说明。")
                ),
                List.of(
                        new ModelManifest.ModelComponent("cliff", "崖壁", "Cliff_Main", null),
                        new ModelManifest.ModelComponent("statue", "主佛造像", "Statue_Main", "cliff"),
                        new ModelManifest.ModelComponent("platform", "奉先寺平台", "Platform_Main", "cliff")
                )
        );
    }
}

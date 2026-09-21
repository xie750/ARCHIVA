package com.shy.digitalmuseum.repository;

import com.shy.digitalmuseum.domain.Building;
import com.shy.digitalmuseum.domain.BuildingContentSection;
import com.shy.digitalmuseum.domain.ModelManifest;
import com.shy.digitalmuseum.domain.SourceReference;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
public class InMemoryBuildingRepository implements BuildingRepository {

    private final List<Building> buildings = List.of(
            songyuePagoda(),
            longmenGrottoes(),
            ironPagoda(),
            whiteHorseTemple(),
            shaolinPagodaForest()
    );

    @Override
    public List<Building> findAll() {
        return buildings;
    }

    @Override
    public java.util.Optional<Building> findById(String id) {
        return buildings.stream().filter(building -> building.id().equals(id)).findFirst();
    }

    private static Building songyuePagoda() {
        return new Building(
                "songyue-pagoda",
                "嵩岳寺塔",
                "嵩岳寺砖塔",
                "郑州",
                "登封市",
                "古塔",
                "北魏",
                "523 年",
                "全国重点文物保护单位",
                "中国现存最早的密檐式砖塔之一，见证了中原佛教建筑的早期发展。",
                "嵩岳寺塔位于登封嵩山南麓，塔身以青砖砌筑，平面为十二边形，是中国古代砖塔由单层向多层演变的重要实例。",
                "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1600&q=80",
                34.4686,
                113.0506,
                List.of("北魏", "佛教建筑", "密檐式砖塔", "登封"),
                List.of(
                        new BuildingContentSection("overview", "建筑概览", "overview", "嵩岳寺塔通高约 37 米，塔身十二边形，十五层密檐舒展叠出，是中原地区早期砖石建筑技术的代表。"),
                        new BuildingContentSection("history", "历史沿革", "timeline", "塔始建于北魏正光元年，历经隋唐及后世维修，整体形制仍保留北魏时期的建筑特征。"),
                        new BuildingContentSection("craft", "结构与营造", "architecture", "塔身采用青砖砌筑，檐部逐层收分，券门与壁面装饰体现了佛塔由木构形式向砖石结构转化的过程。")
                ),
                List.of(
                        new SourceReference("中国古代建筑史（第二版）", "刘敦桢", "中国建筑工业出版社", 2016, "出版物", "ISBN 9787112182019", "出版物引用需取得授权", "用于建筑年代与形制校核"),
                        new SourceReference("嵩岳寺塔测绘资料（示例）", "数字建筑志项目组", "河南建筑数字志", 2026, "测绘资料", "internal://survey/songyue-pagoda", "项目内部资料", "待补充实测数据")
                ),
                manifest("songyue-pagoda", "1.0.0", "https://cdn.example.com/henan/songyue-pagoda")
        );
    }

    private static Building longmenGrottoes() {
        return new Building(
                "longmen-grottoes",
                "龙门石窟奉先寺",
                "奉先寺大像龛",
                "洛阳",
                "洛龙区",
                "石窟寺",
                "唐",
                "675—675 年",
                "世界文化遗产 / 全国重点文物保护单位",
                "伊河两岸崖壁上的石窟群，以奉先寺卢舍那大佛和连续的造像艺术闻名。",
                "龙门石窟以天然崖壁为载体，通过开凿、雕刻和题记形成持续数百年的石窟艺术长卷，展示了北魏至唐代中原地区的宗教、艺术与社会生活。",
                "https://images.unsplash.com/photo-1576675466969-38eeae4b41f6?auto=format&fit=crop&w=1600&q=80",
                34.5590,
                112.4692,
                List.of("世界遗产", "石窟艺术", "唐代", "洛阳"),
                List.of(
                        new BuildingContentSection("overview", "建筑概览", "overview", "奉先寺依崖而建，主佛卢舍那通高约 17 米，整体空间由崖壁、窟龛、造像和题记共同构成。"),
                        new BuildingContentSection("history", "历史沿革", "timeline", "龙门石窟开凿始于北魏孝文帝迁都洛阳前后，唐代奉先寺的营造将石窟艺术推向高峰。"),
                        new BuildingContentSection("craft", "石窟营造", "architecture", "工匠利用天然岩层组织龛窟尺度，以凿刻痕迹、造像比例和崖面排水共同处理长期保存问题。")
                ),
                List.of(
                        new SourceReference("龙门石窟研究院数字资料（示例）", "龙门石窟研究院", "龙门石窟研究院", 2024, "测绘资料", "https://www.lmsk.org.cn/", "以官方授权为准", "用于遗产信息与保护现状校核"),
                        new SourceReference("Longmen Grottoes", "UNESCO World Heritage Centre", "UNESCO", 2000, "网页资料", "https://whc.unesco.org/en/list/1003/", "遵循原站许可", "用于世界遗产信息校核")
                ),
                manifest("longmen-grottoes", "1.0.0", "https://cdn.example.com/henan/longmen-grottoes")
        );
    }

    private static Building ironPagoda() {
        return new Building(
                "kaifeng-iron-pagoda",
                "开封铁塔",
                "祐国寺塔",
                "开封",
                "顺河回族区",
                "古塔",
                "北宋",
                "1049 年",
                "全国重点文物保护单位",
                "以褐色琉璃砖砌成的北宋仿木楼阁式塔，是开封城市历史的重要地标。",
                "开封铁塔实际为琉璃砖塔，砖面以褐色釉色形成铁铸般的视觉效果。塔身比例修长，砖雕构件模拟木构斗拱、门窗和柱额。",
                "https://images.unsplash.com/photo-1537531383496-f4749b803e1d?auto=format&fit=crop&w=1600&q=80",
                34.8151,
                114.3645,
                List.of("北宋", "琉璃砖塔", "仿木结构", "开封"),
                List.of(
                        new BuildingContentSection("overview", "建筑概览", "overview", "铁塔高约 55 米，现存十三层，砖面雕饰细密，远望呈铁色，体现了北宋砖石建筑的精细化营造。"),
                        new BuildingContentSection("history", "历史沿革", "timeline", "塔始建于北宋皇祐元年，历经黄河水患、战乱和多次修缮，仍保存宋代楼阁式塔的基本形制。"),
                        new BuildingContentSection("craft", "材料与构件", "architecture", "塔砖表面施褐色釉，砖雕构件模拟木构建筑的柱、额、斗拱与门窗，体现了材料转换下的仿木表达。")
                ),
                List.of(
                        new SourceReference("开封铁塔志（示例）", "开封市文物考古研究院", "中州古籍出版社", 2021, "出版物", "ISBN 待补", "出版物引用需取得授权", "用于年代、形制和维修史校核")
                ),
                manifest("kaifeng-iron-pagoda", "1.0.0", "https://cdn.example.com/henan/kaifeng-iron-pagoda")
        );
    }

    private static Building whiteHorseTemple() {
        return new Building(
                "white-horse-temple",
                "白马寺",
                "中国第一古刹",
                "洛阳",
                "瀍河回族区",
                "佛寺",
                "东汉",
                "68 年",
                "全国重点文物保护单位",
                "中国佛教传入后兴建的第一座官办寺院，形成了中原佛寺布局和文化交流的早期源头。",
                "白马寺现存建筑多为明清时期重修，但中轴对称、院落递进的空间格局延续了中国佛寺长期发展的传统，寺院同时保留跨文化交流的历史记忆。",
                "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1600&q=80",
                34.7234,
                112.6297,
                List.of("东汉", "佛寺", "中外交流", "洛阳"),
                List.of(
                        new BuildingContentSection("overview", "建筑概览", "overview", "寺院坐北朝南，中轴线上依次布置山门、天王殿、大佛殿和毗卢阁，院落之间以门殿组织礼仪秩序。"),
                        new BuildingContentSection("history", "历史沿革", "timeline", "东汉明帝时期，摄摩腾与竺法兰携经东来，白马寺由此成为中国佛教传播史上的重要节点。"),
                        new BuildingContentSection("craft", "空间与礼仪", "architecture", "佛寺建筑以中轴线和多进院落组织礼仪动线，屋顶、台基和门殿尺度共同形成逐层递进的空间体验。")
                ),
                List.of(
                        new SourceReference("白马寺志（示例）", "洛阳市文物局", "中州古籍出版社", 2020, "出版物", "ISBN 待补", "出版物引用需取得授权", "用于寺院沿革与现存格局校核"),
                        new SourceReference("洛阳市文物局公开资料", "洛阳市文物局", "洛阳市人民政府", 2025, "网页资料", "https://wwj.ly.gov.cn/", "以官方授权为准", "用于保护信息校核")
                ),
                manifest("white-horse-temple", "1.0.0", "https://cdn.example.com/henan/white-horse-temple")
        );
    }

    private static Building shaolinPagodaForest() {
        return new Building(
                "shaolin-pagoda-forest",
                "少林寺塔林",
                "少林寺历代高僧墓塔群",
                "郑州",
                "登封市",
                "塔林",
                "唐—清",
                "791—1942 年",
                "全国重点文物保护单位",
                "少林寺历代高僧墓塔集中保存地，以数量、年代跨度和塔制多样性著称。",
                "塔林分布在少室山北麓，现存墓塔两百余座，形制涵盖单层塔、密檐塔和喇嘛塔等，塔身铭刻记录了少林寺的僧侣谱系与地方历史。",
                "https://images.unsplash.com/photo-1578321272176-b7bbc0679853?auto=format&fit=crop&w=1600&q=80",
                34.5088,
                112.9406,
                List.of("佛塔", "墓塔", "少林寺", "登封"),
                List.of(
                        new BuildingContentSection("overview", "建筑概览", "overview", "塔林按山势自然展开，塔体尺度和形制各异，形成一处可阅读的僧侣纪念与建筑类型谱系。"),
                        new BuildingContentSection("history", "历史沿革", "timeline", "现存塔林从唐代延续至民国，塔铭、题记和造型共同构成少林寺历史的连续档案。"),
                        new BuildingContentSection("craft", "塔制与材料", "architecture", "砖石塔身的层数、平面、檐部和装饰随时代变化，适合通过 3D 分层与热点方式讲解构件差异。")
                ),
                List.of(
                        new SourceReference("少林寺塔林调查报告（示例）", "河南省文物考古研究院", "科学出版社", 2019, "测绘资料", "ISBN 待补", "出版物引用需取得授权", "用于塔林数量与年代校核")
                ),
                manifest("shaolin-pagoda-forest", "1.0.0", "https://cdn.example.com/henan/shaolin-pagoda-forest")
        );
    }

    private static ModelManifest manifest(String modelId, String version, String basePath) {
        return new ModelManifest(
                modelId,
                version,
                "PUBLISHED",
                List.of(
                        new ModelManifest.LodAsset("low", basePath + "/model-low.glb", 8_200_000),
                        new ModelManifest.LodAsset("medium", basePath + "/model-medium.glb", 24_600_000),
                        new ModelManifest.LodAsset("high", basePath + "/model-high.glb", 68_000_000)
                ),
                new ModelManifest.TextureSet(
                        "KTX2",
                        basePath + "/textures/",
                        Map.of("mobile", "1k", "desktop", "2k", "detail", "4k")
                ),
                new ModelManifest.CameraPreset(new double[]{20, 12, 24}, new double[]{0, 5, 0}, 45),
                List.of(
                        new ModelManifest.ModelHotspot("overview", "建筑总览", new double[]{0, 4, 0}, "从整体尺度观察建筑与周边环境的关系。"),
                        new ModelManifest.ModelHotspot("structure", "结构节点", new double[]{2.4, 8.1, -1.2}, "这里可以替换为构件的出版级讲解内容。"),
                        new ModelManifest.ModelHotspot("material", "材料细节", new double[]{-1.4, 3.2, 1.8}, "材质、砌筑方式和修缮痕迹将在模型审核后补充。")
                ),
                List.of(
                        new ModelManifest.ModelComponent("main-body", "主体", "Building_Main", null),
                        new ModelManifest.ModelComponent("roof", "屋顶", "Roof_Main", "main-body"),
                        new ModelManifest.ModelComponent("opening", "门窗", "Openings", "main-body")
                )
        );
    }
}

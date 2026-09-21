package com.shy.digitalmuseum.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shy.digitalmuseum.domain.PoiScene;
import com.shy.digitalmuseum.domain.ScenicSite;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Optional;

/** SQLite adapter for scenic-site aggregates used by the map/panorama demo. */
@Primary
@Repository
public class SqliteScenicSiteRepository implements ScenicSiteRepository {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public SqliteScenicSiteRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void initialize() {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS scenic_sites (site_id TEXT PRIMARY KEY, payload TEXT NOT NULL)");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS poi_scenes (site_id TEXT NOT NULL, poi_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (site_id, poi_id))");
        Integer siteCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM scenic_sites", Integer.class);
        if (siteCount != null && siteCount == 0) {
            InMemoryScenicSiteRepository seed = new InMemoryScenicSiteRepository();
            seed.findById("longmen").ifPresent(this::saveSite);
            seed.findPoiScene("longmen", "main-buddha").ifPresent(this::saveScene);
            seed.findPoiScene("longmen", "xiangshan").ifPresent(this::saveScene);
        }
    }

    @Override
    public Optional<ScenicSite> findById(String siteId) {
        List<ScenicSite> matches = jdbcTemplate.query(
                "SELECT payload FROM scenic_sites WHERE site_id = ?",
                (rs, rowNum) -> read(rs.getString("payload"), ScenicSite.class), siteId
        );
        return matches.stream().findFirst();
    }

    @Override
    public Optional<PoiScene> findPoiScene(String siteId, String poiId) {
        List<PoiScene> matches = jdbcTemplate.query(
                "SELECT payload FROM poi_scenes WHERE site_id = ? AND poi_id = ?",
                (rs, rowNum) -> read(rs.getString("payload"), PoiScene.class), siteId, poiId
        );
        return matches.stream().findFirst();
    }

    private void saveSite(ScenicSite site) {
        jdbcTemplate.update("INSERT INTO scenic_sites (site_id, payload) VALUES (?, ?)", site.siteId(), write(site));
    }

    private void saveScene(PoiScene scene) {
        jdbcTemplate.update("INSERT INTO poi_scenes (site_id, poi_id, payload) VALUES (?, ?, ?)", scene.siteId(), scene.poiId(), write(scene));
    }

    private <T> T read(String payload, Class<T> type) {
        try {
            return objectMapper.readValue(payload, type);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("无法读取 SQLite 景区数据", ex);
        }
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("无法写入 SQLite 景区数据", ex);
        }
    }
}

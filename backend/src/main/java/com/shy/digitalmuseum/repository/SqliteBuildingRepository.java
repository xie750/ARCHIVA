package com.shy.digitalmuseum.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shy.digitalmuseum.domain.Building;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Optional;

/**
 * Small SQLite adapter used by the local demo. The complete aggregate is kept
 * as JSON so the public domain model and API can evolve without a migration
 * for every nested content field. Media files remain outside SQLite.
 */
@Primary
@Repository
public class SqliteBuildingRepository implements BuildingRepository {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public SqliteBuildingRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void initialize() {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS buildings (id TEXT PRIMARY KEY, payload TEXT NOT NULL)");
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM buildings", Integer.class);
        InMemoryBuildingRepository seed = new InMemoryBuildingRepository();
        if (count != null && count == 0) {
            seed.findAll().forEach(this::save);
            return;
        }

        // Upgrade the original placeholder manifest once the local reference
        // asset becomes available. User-edited records remain untouched.
        findById("kaifeng-iron-pagoda").ifPresent(existing -> {
            boolean pointsToPlaceholder = existing.modelManifest() != null
                    && existing.modelManifest().lod().stream()
                    .anyMatch(asset -> asset.url() != null && asset.url().contains("cdn.example.com"));
            boolean missingReferenceMetadata = "kaifeng-iron-pagoda".equals(existing.id())
                    && existing.modelManifest() != null
                    && existing.modelManifest().assetStatus() == null;
            boolean staleTextureFormat = "kaifeng-iron-pagoda".equals(existing.id())
                    && existing.modelManifest() != null
                    && existing.modelManifest().textures() != null
                    && "KTX2".equalsIgnoreCase(existing.modelManifest().textures().format());
            if (pointsToPlaceholder || missingReferenceMetadata || staleTextureFormat) {
                seed.findById("kaifeng-iron-pagoda").ifPresent(updated -> jdbcTemplate.update(
                        "UPDATE buildings SET payload = ? WHERE id = ?",
                        write(updated), updated.id()
                ));
            }
        });
    }

    @Override
    public List<Building> findAll() {
        return jdbcTemplate.query("SELECT payload FROM buildings ORDER BY id", (rs, rowNum) -> read(rs.getString("payload")));
    }

    @Override
    public Optional<Building> findById(String id) {
        List<Building> matches = jdbcTemplate.query(
                "SELECT payload FROM buildings WHERE id = ?",
                (rs, rowNum) -> read(rs.getString("payload")),
                id
        );
        return matches.stream().findFirst();
    }

    private void save(Building building) {
        jdbcTemplate.update(
                "INSERT INTO buildings (id, payload) VALUES (?, ?)",
                building.id(), write(building)
        );
    }

    private Building read(String payload) {
        try {
            return objectMapper.readValue(payload, Building.class);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("无法读取 SQLite 建筑数据", ex);
        }
    }

    private String write(Building building) {
        try {
            return objectMapper.writeValueAsString(building);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("无法写入 SQLite 建筑数据", ex);
        }
    }
}

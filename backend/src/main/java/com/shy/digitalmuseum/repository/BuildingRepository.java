package com.shy.digitalmuseum.repository;

import com.shy.digitalmuseum.domain.Building;

import java.util.List;
import java.util.Optional;

public interface BuildingRepository {

    List<Building> findAll();

    Optional<Building> findById(String id);
}

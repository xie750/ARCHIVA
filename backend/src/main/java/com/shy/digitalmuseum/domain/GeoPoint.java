package com.shy.digitalmuseum.domain;

/** A WGS84 geographic point. The API keeps coordinates explicit for map clients. */
public record GeoPoint(double latitude, double longitude) {
}

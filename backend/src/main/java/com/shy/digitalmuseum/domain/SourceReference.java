package com.shy.digitalmuseum.domain;

public record SourceReference(
        String title,
        String author,
        String publisher,
        Integer publishYear,
        String sourceType,
        String urlOrIsbn,
        String license,
        String note
) {
}

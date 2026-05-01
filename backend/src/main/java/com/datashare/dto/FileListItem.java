package com.datashare.dto;

import com.datashare.domain.FileRecord;
import com.datashare.domain.Tag;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record FileListItem(
    UUID id,
    String token,
    String originalFilename,
    String mimeType,
    long sizeBytes,
    boolean passwordRequired,
    OffsetDateTime createdAt,
    OffsetDateTime expiresAt,
    boolean expired,
    List<String> tags
) {
    public static FileListItem from(FileRecord file) {
        return new FileListItem(
            file.getId(),
            file.getDownloadToken(),
            file.getOriginalFilename(),
            file.getMimeType(),
            file.getSizeBytes(),
            file.isPasswordProtected(),
            file.getCreatedAt(),
            file.getExpiresAt(),
            file.isExpired(),
            file.getTags().stream().map(Tag::getLabel).sorted().toList()
        );
    }
}

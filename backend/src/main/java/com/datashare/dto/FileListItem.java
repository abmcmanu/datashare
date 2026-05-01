package com.datashare.dto;

import com.datashare.domain.FileRecord;

import java.time.OffsetDateTime;
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
    boolean expired
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
            file.isExpired()
        );
    }
}

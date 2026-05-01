package com.datashare.dto;

import com.datashare.domain.FileRecord;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Réponse de l'endpoint POST /api/v1/files (US01).
 * Aligné sur le schema FileUploadResponse du contrat OpenAPI 3.0.3.
 */
public record FileUploadResponse(
    UUID id,
    String token,
    String downloadUrl,
    String originalFilename,
    long sizeBytes,
    String mimeType,
    boolean passwordRequired,
    OffsetDateTime createdAt,
    OffsetDateTime expiresAt
) {

    public static FileUploadResponse from(FileRecord file, String publicBaseUrl) {
        String url = publicBaseUrl.replaceAll("/+$", "") + "/d/" + file.getDownloadToken();
        return new FileUploadResponse(
            file.getId(),
            file.getDownloadToken(),
            url,
            file.getOriginalFilename(),
            file.getSizeBytes(),
            file.getMimeType(),
            file.isPasswordProtected(),
            file.getCreatedAt(),
            file.getExpiresAt()
        );
    }
}

package com.datashare.dto;

import com.datashare.domain.FileRecord;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;

/**
 * Métadonnées d'un fichier renvoyées avant le téléchargement.
 * Ne contient pas le lien de stockage direct ni d'informations sensibles (owner).
 */
public record FileMetadataResponse(
    @Schema(description = "Nom original du fichier", example = "document.pdf")
    String originalFilename,

    @Schema(description = "Type MIME du fichier", example = "application/pdf")
    String mimeType,

    @Schema(description = "Taille du fichier en octets", example = "1048576")
    long sizeBytes,

    @Schema(description = "Date d'expiration du fichier")
    OffsetDateTime expiresAt,

    @Schema(description = "Indique si le fichier est protégé par un mot de passe")
    boolean isPasswordProtected
) {
    public static FileMetadataResponse from(FileRecord file) {
        return new FileMetadataResponse(
            file.getOriginalFilename(),
            file.getMimeType(),
            file.getSizeBytes(),
            file.getExpiresAt(),
            file.isPasswordProtected()
        );
    }
}

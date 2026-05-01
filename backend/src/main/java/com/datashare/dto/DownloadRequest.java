package com.datashare.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * DTO pour fournir le mot de passe lors du téléchargement d'un fichier (US02).
 */
public record DownloadRequest(
    @Schema(description = "Mot de passe requis si le fichier est protégé", example = "MonSecret123")
    String password
) {}

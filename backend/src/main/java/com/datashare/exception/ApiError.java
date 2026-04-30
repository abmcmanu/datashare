package com.datashare.exception;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Format unique d'erreur renvoyé par l'API — aligné sur le contrat OpenAPI 3.0.3.
 * Le champ {@code fieldErrors} n'est rempli que pour les erreurs de validation 400.
 */
public record ApiError(
    OffsetDateTime timestamp,
    int status,
    String error,
    String code,
    String message,
    String path,
    List<FieldError> fieldErrors
) {

    public static ApiError of(int status, String error, String code, String message, String path) {
        return new ApiError(OffsetDateTime.now(), status, error, code, message, path, List.of());
    }

    public static ApiError validation(int status, String message, String path, List<FieldError> fields) {
        return new ApiError(OffsetDateTime.now(), status, "Bad Request", "VALIDATION_FAILED", message, path, fields);
    }

    public record FieldError(String field, String message) {}
}

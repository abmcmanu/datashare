package com.datashare.dto;

/**
 * Réponse renvoyée après un signup ou un login réussi.
 */
public record AuthResponse(
    String accessToken,
    String tokenType,
    long expiresIn,
    UserDto user
) {

    public static AuthResponse bearer(String token, long expiresInSeconds, UserDto user) {
        return new AuthResponse(token, "Bearer", expiresInSeconds, user);
    }
}

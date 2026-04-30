package com.datashare.dto;

import com.datashare.domain.User;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Représentation publique d'un utilisateur — jamais le hash du mot de passe.
 */
public record UserDto(UUID id, String email, OffsetDateTime createdAt) {

    public static UserDto from(User user) {
        return new UserDto(user.getId(), user.getEmail(), user.getCreatedAt());
    }
}

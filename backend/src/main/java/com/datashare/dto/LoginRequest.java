package com.datashare.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Corps de connexion (US04).
 */
public record LoginRequest(
    @NotBlank(message = "L'email est requis.")
    @Email(message = "Format d'email invalide.")
    String email,

    @NotBlank(message = "Le mot de passe est requis.")
    String password
) {}

package com.datashare.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Corps d'inscription (US03).
 *
 * Contraintes validées par {@link jakarta.validation.Valid} dans le contrôleur.
 */
public record SignupRequest(
    @NotBlank(message = "L'email est requis.")
    @Email(message = "Format d'email invalide.")
    @Size(max = 255, message = "L'email ne doit pas dépasser 255 caractères.")
    String email,

    @NotBlank(message = "Le mot de passe est requis.")
    @Size(min = 8, max = 72, message = "Le mot de passe doit contenir entre 8 et 72 caractères.")
    String password
) {}

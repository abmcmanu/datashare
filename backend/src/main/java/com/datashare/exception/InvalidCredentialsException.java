package com.datashare.exception;

/**
 * Levée à la connexion si email ou mot de passe ne correspondent pas (US04).
 *
 * Le message est volontairement neutre pour ne pas indiquer si l'email existe ou pas
 * (protection énumération).
 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Email ou mot de passe invalide.");
    }
}

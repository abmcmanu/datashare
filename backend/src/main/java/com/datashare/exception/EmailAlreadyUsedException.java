package com.datashare.exception;

/**
 * Levée lors de l'inscription si l'email est déjà présent en base (US03).
 */
public class EmailAlreadyUsedException extends RuntimeException {

    public EmailAlreadyUsedException(String email) {
        super("L'email " + email + " est déjà utilisé.");
    }
}

package com.datashare.exception;

public class InvalidFilePasswordException extends RuntimeException {
    public InvalidFilePasswordException() {
        super("Mot de passe incorrect pour ce fichier.");
    }
}

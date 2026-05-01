package com.datashare.exception;

/**
 * Levée quand l'extension du fichier est interdite (US01).
 * Mappée sur HTTP 415 Unsupported Media Type.
 */
public class UnsupportedFileTypeException extends RuntimeException {
    public UnsupportedFileTypeException(String extension) {
        super("Type de fichier non autorisé : ." + extension);
    }
}

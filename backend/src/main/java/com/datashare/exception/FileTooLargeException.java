package com.datashare.exception;

/**
 * Levée quand un upload dépasse la taille maximale autorisée (US01 — 1 Go).
 * Mappée sur HTTP 413 Payload Too Large.
 */
public class FileTooLargeException extends RuntimeException {
    public FileTooLargeException(long sizeBytes, long maxBytes) {
        super("Le fichier (" + sizeBytes + " octets) dépasse la limite de " + maxBytes + " octets.");
    }
}

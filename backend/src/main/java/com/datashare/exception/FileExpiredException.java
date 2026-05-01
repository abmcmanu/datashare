package com.datashare.exception;

public class FileExpiredException extends RuntimeException {
    public FileExpiredException() {
        super("Ce fichier n'est plus disponible en téléchargement car il a expiré.");
    }
}

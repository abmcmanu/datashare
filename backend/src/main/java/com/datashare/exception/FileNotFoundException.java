package com.datashare.exception;

public class FileNotFoundException extends RuntimeException {
    public FileNotFoundException() {
        super("Fichier introuvable.");
    }
}

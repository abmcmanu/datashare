package com.datashare.storage;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Set;
import java.util.UUID;

/**
 * Implémentation par défaut : stockage des fichiers sur le système de fichiers local.
 *
 * <ul>
 *   <li>Le nom physique est un UUID v4 — jamais le nom utilisateur (anti path traversal).</li>
 *   <li>Le dossier racine est créé au démarrage avec permissions 0700 (POSIX uniquement).</li>
 *   <li>Les écritures se font en streaming via {@link Files#copy(InputStream, Path, java.nio.file.CopyOption...)}.</li>
 * </ul>
 */
@Service
public class LocalFileSystemStorage implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalFileSystemStorage.class);

    private final Path rootDirectory;

    public LocalFileSystemStorage(@Value("${datashare.storage.local-path}") String localPath) {
        this.rootDirectory = Paths.get(localPath).toAbsolutePath().normalize();
    }

    @PostConstruct
    void init() throws IOException {
        Files.createDirectories(rootDirectory);
        try {
            Set<PosixFilePermission> perms = PosixFilePermissions.fromString("rwx------");
            Files.setPosixFilePermissions(rootDirectory, perms);
        } catch (UnsupportedOperationException ignored) {
            // Windows : pas de POSIX, on accepte
        }
        log.info("Stockage local initialisé : {}", rootDirectory);
    }

    @Override
    public String store(InputStream input) throws IOException {
        String storageKey = UUID.randomUUID().toString();
        Path target = resolve(storageKey);
        Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        return storageKey;
    }

    @Override
    public InputStream openStream(String storageKey) throws IOException {
        return Files.newInputStream(resolve(storageKey));
    }

    @Override
    public void delete(String storageKey) throws IOException {
        Files.deleteIfExists(resolve(storageKey));
    }

    /**
     * Résout la clé en chemin absolu, en s'assurant qu'elle reste sous {@link #rootDirectory}.
     * Empêche toute tentative de path traversal (ex : "../../etc/passwd").
     */
    private Path resolve(String storageKey) {
        Path candidate = rootDirectory.resolve(storageKey).normalize();
        if (!candidate.startsWith(rootDirectory)) {
            throw new IllegalArgumentException("Storage key invalide : " + storageKey);
        }
        return candidate;
    }
}

package com.datashare.service;

import com.datashare.domain.FileRecord;
import com.datashare.domain.User;
import com.datashare.dto.FileMetadataResponse;
import com.datashare.dto.FileListItem;
import com.datashare.exception.FileNotFoundException;
import com.datashare.exception.FileExpiredException;
import com.datashare.exception.InvalidFilePasswordException;
import com.datashare.exception.FileTooLargeException;
import com.datashare.exception.InvalidCredentialsException;
import com.datashare.exception.UnsupportedFileTypeException;
import com.datashare.repository.FileRepository;
import com.datashare.repository.UserRepository;
import com.datashare.security.AuthenticatedUser;
import com.datashare.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Logique métier de l'upload de fichiers (US01).
 *
 * <ul>
 *   <li>Validation : taille &lt; 1 Go, extension non interdite</li>
 *   <li>Génération d'un token public 256 bits non prédictible (Base64URL, 43 chars)</li>
 *   <li>Hash BCrypt 10 rounds du mot de passe optionnel (US09 anticipé)</li>
 *   <li>Stockage du binaire via {@link StorageService}, métadonnées en BDD</li>
 * </ul>
 */
@Service
public class FileService {

    private static final Logger log = LoggerFactory.getLogger(FileService.class);

    private static final SecureRandom RNG = new SecureRandom();
    /** BCrypt 10 rounds pour les mots de passe de fichiers (cf. SECURITY.md). */
    private static final BCryptPasswordEncoder FILE_PASSWORD_ENCODER = new BCryptPasswordEncoder(10);

    private final FileRepository fileRepository;
    private final UserRepository userRepository;
    private final StorageService storage;

    private final long maxBytes;
    private final Set<String> forbiddenExtensions;
    private final int tokenBytes;
    private final int defaultExpirationDays;
    private final int maxExpirationDays;

    public FileService(
        FileRepository fileRepository,
        UserRepository userRepository,
        StorageService storage,
        @Value("${datashare.upload.max-bytes}") long maxBytes,
        @Value("${datashare.upload.forbidden-extensions}") String forbiddenExtensions,
        @Value("${datashare.download.token-bytes}") int tokenBytes,
        @Value("${datashare.expiration.default-days}") int defaultExpirationDays,
        @Value("${datashare.expiration.max-days}") int maxExpirationDays
    ) {
        this.fileRepository = fileRepository;
        this.userRepository = userRepository;
        this.storage = storage;
        this.maxBytes = maxBytes;
        this.forbiddenExtensions = Set.copyOf(
            java.util.Arrays.stream(forbiddenExtensions.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(String::toLowerCase)
                .toList()
        );
        this.tokenBytes = tokenBytes;
        this.defaultExpirationDays = defaultExpirationDays;
        this.maxExpirationDays = maxExpirationDays;
    }

    @Transactional
    public FileRecord upload(MultipartFile multipart,
                             Integer expiresInDays,
                             String password,
                             AuthenticatedUser principal) {

        validate(multipart);

        User owner = null;
        if (principal != null) {
            owner = userRepository.findById(principal.id())
                .orElseThrow(InvalidCredentialsException::new);
        }

        int days = clampExpirationDays(expiresInDays);
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plusDays(days);

        String storageKey;
        try (var in = multipart.getInputStream()) {
            storageKey = storage.store(in);
        } catch (IOException e) {
            throw new IllegalStateException("Échec d'écriture sur le disque.", e);
        }

        String token = generateUniqueToken();
        String passwordHash = (password != null && !password.isBlank())
            ? FILE_PASSWORD_ENCODER.encode(password)
            : null;

        FileRecord file = new FileRecord(
            owner,
            token,
            sanitizeFilename(multipart.getOriginalFilename()),
            storageKey,
            resolveMimeType(multipart),
            multipart.getSize(),
            passwordHash,
            expiresAt
        );

        FileRecord saved = fileRepository.save(file);
        log.info("Fichier téléversé : id={}, owner={}, size={}o, token={}",
            saved.getId(), owner != null ? owner.getId() : "anonyme", saved.getSizeBytes(), token);
        return saved;
    }

    /**
     * US02 : Récupérer les métadonnées d'un fichier (sans le contenu).
     * Accessible publiquement via le lien.
     */
    @Transactional(readOnly = true)
    public FileMetadataResponse getFileMetadata(String token) {
        FileRecord record = fileRepository.findByDownloadToken(token)
            .orElseThrow(FileNotFoundException::new);

        return FileMetadataResponse.from(record);
    }

    /**
     * US02 : Télécharger le binaire du fichier.
     * Accessible publiquement si token valide + non expiré + mot de passe correct.
     */
    @Transactional(readOnly = true)
    public InputStream downloadFile(String token, String password) {
        FileRecord record = fileRepository.findByDownloadToken(token)
            .orElseThrow(FileNotFoundException::new);

        if (record.isExpired()) {
            throw new FileExpiredException();
        }

        if (record.isPasswordProtected()) {
            if (password == null || password.isBlank() || !FILE_PASSWORD_ENCODER.matches(password, record.getPasswordHash())) {
                throw new InvalidFilePasswordException();
            }
        }

        try {
            return storage.openStream(record.getStorageKey());
        } catch (IOException e) {
            log.error("Impossible de lire le fichier {}", record.getStorageKey(), e);
            throw new IllegalStateException("Erreur de lecture du fichier.");
        }
    }

    @Transactional(readOnly = true)
    public List<FileListItem> listFiles(AuthenticatedUser principal) {
        User owner = userRepository.findById(principal.id())
            .orElseThrow(InvalidCredentialsException::new);
        return fileRepository.findByOwnerOrderByCreatedAtDesc(owner)
            .stream()
            .map(FileListItem::from)
            .toList();
    }

    @Transactional
    public void deleteFile(UUID fileId, AuthenticatedUser principal) {
        FileRecord record = fileRepository.findById(fileId)
            .orElseThrow(FileNotFoundException::new);

        if (!record.getOwner().getId().equals(principal.id())) {
            throw new org.springframework.security.access.AccessDeniedException("Accès refusé.");
        }

        try {
            storage.delete(record.getStorageKey());
        } catch (IOException e) {
            log.warn("Impossible de supprimer le fichier physique {}", record.getStorageKey(), e);
        }

        fileRepository.delete(record);
        log.info("Fichier supprimé : id={}, owner={}", fileId, principal.id());
    }

    // ---------- Helpers ----------

    private void validate(MultipartFile mp) {
        if (mp == null || mp.isEmpty()) {
            throw new IllegalArgumentException("Le fichier est requis et ne peut pas être vide.");
        }
        if (mp.getSize() > maxBytes) {
            throw new FileTooLargeException(mp.getSize(), maxBytes);
        }
        String ext = extensionOf(mp.getOriginalFilename());
        if (ext != null && forbiddenExtensions.contains(ext)) {
            throw new UnsupportedFileTypeException(ext);
        }
    }

    private int clampExpirationDays(Integer requested) {
        if (requested == null) return defaultExpirationDays;
        if (requested < 1) return 1;
        return Math.min(requested, maxExpirationDays);
    }

    /**
     * Vérifie l'unicité du token (collision SecureRandom 256 bits ≈ impossible
     * mais on garde la sécurité de la contrainte UNIQUE).
     */
    private String generateUniqueToken() {
        for (int attempt = 0; attempt < 5; attempt++) {
            String token = randomToken();
            if (!fileRepository.existsByDownloadToken(token)) {
                return token;
            }
        }
        throw new IllegalStateException("Impossible de générer un token unique.");
    }

    private String randomToken() {
        byte[] bytes = new byte[tokenBytes];
        RNG.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String extensionOf(String filename) {
        if (filename == null) return null;
        int idx = filename.lastIndexOf('.');
        if (idx <= 0 || idx == filename.length() - 1) return null;
        return filename.substring(idx + 1).toLowerCase();
    }

    private String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) return "fichier";
        // Supprime les segments de path et les caractères de contrôle
        String stripped = filename.replaceAll("[\\\\/]", "_")
            .replaceAll("[\\p{Cntrl}]", "")
            .trim();
        return stripped.length() > 255 ? stripped.substring(0, 255) : stripped;
    }

    private String resolveMimeType(MultipartFile mp) {
        String type = mp.getContentType();
        if (type == null || type.isBlank()) return "application/octet-stream";
        return type.length() > 100 ? type.substring(0, 100) : type;
    }
}

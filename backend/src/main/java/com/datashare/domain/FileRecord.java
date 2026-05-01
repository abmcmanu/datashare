package com.datashare.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Représente un fichier téléversé (US01).
 *
 * Mappée sur la table <code>files</code> définie dans la migration Flyway V1.
 * Le binaire est stocké hors-BDD via {@link com.datashare.storage.StorageService}.
 *
 * <p>Note : on nomme l'entité <code>FileRecord</code> pour éviter le shadowing
 * avec <code>java.io.File</code>.</p>
 */
@Entity
@Table(name = "files")
public class FileRecord {

    @Id
    @Column(name = "id", columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    /**
     * Propriétaire — nullable pour anticiper US07 (upload anonyme).
     * On charge en LAZY pour éviter de récupérer l'utilisateur à chaque liste de fichiers.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(name = "download_token", nullable = false, unique = true, length = 64)
    private String downloadToken;

    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    @Column(name = "storage_key", nullable = false, unique = true, length = 255)
    private String storageKey;

    @Column(name = "mime_type", nullable = false, length = 100)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    /** Hash BCrypt du mot de passe (US09). Null si fichier public. */
    @Column(name = "password_hash", length = 72)
    private String passwordHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "file_tags",
        joinColumns = @JoinColumn(name = "file_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();

    protected FileRecord() {}

    public FileRecord(User owner,
                      String downloadToken,
                      String originalFilename,
                      String storageKey,
                      String mimeType,
                      long sizeBytes,
                      String passwordHash,
                      OffsetDateTime expiresAt) {
        this.id = UUID.randomUUID();
        this.owner = owner;
        this.downloadToken = Objects.requireNonNull(downloadToken);
        this.originalFilename = Objects.requireNonNull(originalFilename);
        this.storageKey = Objects.requireNonNull(storageKey);
        this.mimeType = Objects.requireNonNull(mimeType);
        this.sizeBytes = sizeBytes;
        this.passwordHash = passwordHash; // peut être null
        this.expiresAt = Objects.requireNonNull(expiresAt);
    }

    @PrePersist
    void onCreate() {
        if (id == null)        id = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    /** Renvoie true si la date d'expiration est passée. */
    public boolean isExpired() {
        return expiresAt.isBefore(OffsetDateTime.now());
    }

    /** Renvoie true si un mot de passe est défini. */
    public boolean isPasswordProtected() {
        return passwordHash != null && !passwordHash.isBlank();
    }

    public UUID getId() { return id; }
    public User getOwner() { return owner; }
    public String getDownloadToken() { return downloadToken; }
    public String getOriginalFilename() { return originalFilename; }
    public String getStorageKey() { return storageKey; }
    public String getMimeType() { return mimeType; }
    public long getSizeBytes() { return sizeBytes; }
    public String getPasswordHash() { return passwordHash; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public Set<Tag> getTags() { return tags; }

    public void addTag(Tag tag) { tags.add(tag); }
    public void removeTag(Tag tag) { tags.remove(tag); }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof FileRecord other)) return false;
        return Objects.equals(id, other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}

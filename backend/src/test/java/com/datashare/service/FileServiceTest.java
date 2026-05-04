package com.datashare.service;

import com.datashare.domain.FileRecord;
import com.datashare.domain.Tag;
import com.datashare.domain.User;
import com.datashare.dto.FileListItem;
import com.datashare.dto.FileMetadataResponse;
import com.datashare.exception.FileExpiredException;
import com.datashare.exception.FileNotFoundException;
import com.datashare.exception.FileTooLargeException;
import com.datashare.exception.InvalidCredentialsException;
import com.datashare.exception.InvalidFilePasswordException;
import com.datashare.exception.UnsupportedFileTypeException;
import com.datashare.repository.FileRepository;
import com.datashare.repository.TagRepository;
import com.datashare.repository.UserRepository;
import com.datashare.security.AuthenticatedUser;
import com.datashare.storage.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@ExtendWith(MockitoExtension.class)
class FileServiceTest {

    @Mock FileRepository fileRepository;
    @Mock TagRepository tagRepository;
    @Mock UserRepository userRepository;
    @Mock StorageService storage;

    FileService fileService;

    private User owner;
    private AuthenticatedUser principal;

    @BeforeEach
    void setup() {
        fileService = new FileService(
            fileRepository,
            tagRepository,
            userRepository,
            storage,
            1_073_741_824L,                    // max-bytes 1 Go
            "exe,bat,cmd,sh,com,msi,scr,vbs,ps1",
            32,                                // token-bytes
            7, 7                               // expiration default/max
        );
        owner = new User("claire@example.com", "$2a$12$hashstub");
        principal = new AuthenticatedUser(owner.getId(), owner.getEmail());
    }

    @Test
    void upload_anonyme_sans_principal_reussit_avec_owner_null() throws Exception {
        when(storage.store(any())).thenReturn("phys-anon");
        when(fileRepository.existsByDownloadToken(any())).thenReturn(false);
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile mp = new MockMultipartFile("file", "x.txt", "text/plain", "abc".getBytes());
        FileRecord saved = fileService.upload(mp, 7, null, null);

        assertThat(saved.getOwner()).isNull();
        assertThat(saved.getDownloadToken()).isNotNull();
        verify(userRepository, never()).findById(any());
    }

    @Test
    void upload_fichier_vide_jette_illegal_argument() {
        MockMultipartFile mp = new MockMultipartFile("file", "x.txt", "text/plain", new byte[0]);
        assertThatThrownBy(() -> fileService.upload(mp, 7, null, principal))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void upload_extension_interdite_jette_unsupported() {
        // validate() est appelée avant findById → pas besoin de mocker userRepository
        MockMultipartFile mp = new MockMultipartFile("file", "virus.exe", "application/octet-stream",
            "MZ".getBytes());
        assertThatThrownBy(() -> fileService.upload(mp, 7, null, principal))
            .isInstanceOf(UnsupportedFileTypeException.class);
        verify(fileRepository, never()).save(any());
    }

    @Test
    void upload_trop_volumineux_jette_too_large() {
        // validate() est appelée avant findById → pas besoin de mocker userRepository
        MockMultipartFile huge = new MockMultipartFile("file", "big.bin",
            "application/octet-stream", new byte[10]) {
            @Override public long getSize() { return 1_073_741_824L + 1; }
        };
        assertThatThrownBy(() -> fileService.upload(huge, 7, null, principal))
            .isInstanceOf(FileTooLargeException.class);
    }

    @Test
    void upload_OK_sans_password_persiste_et_renvoie_un_token() throws Exception {
        when(userRepository.findById(any())).thenReturn(Optional.of(owner));
        when(storage.store(any())).thenReturn("phys-uuid");
        when(fileRepository.existsByDownloadToken(any())).thenReturn(false);
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile mp = new MockMultipartFile("file", "photo.jpg", "image/jpeg",
            "binarydata".getBytes());
        FileRecord saved = fileService.upload(mp, 3, null, principal);

        assertThat(saved.getDownloadToken()).hasSizeBetween(40, 50);  // ~43 chars en base64url
        assertThat(saved.getStorageKey()).isEqualTo("phys-uuid");
        assertThat(saved.getOriginalFilename()).isEqualTo("photo.jpg");
        assertThat(saved.getMimeType()).isEqualTo("image/jpeg");
        assertThat(saved.isPasswordProtected()).isFalse();
        assertThat(saved.getExpiresAt()).isAfter(saved.getCreatedAt());
    }

    @Test
    void upload_avec_password_hash_le_mot_de_passe() throws Exception {
        when(userRepository.findById(any())).thenReturn(Optional.of(owner));
        when(storage.store(any())).thenReturn("k");
        when(fileRepository.existsByDownloadToken(any())).thenReturn(false);
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile mp = new MockMultipartFile("file", "photo.jpg", "image/jpeg", "x".getBytes());
        FileRecord saved = fileService.upload(mp, 7, "secret123", principal);

        assertThat(saved.isPasswordProtected()).isTrue();
        assertThat(saved.getPasswordHash())
            .isNotNull()
            .startsWith("$2a$")  // BCrypt
            .isNotEqualTo("secret123");
    }

    @Test
    void expiration_au_dela_de_7_jours_est_clamp_a_7() throws Exception {
        when(userRepository.findById(any())).thenReturn(Optional.of(owner));
        when(storage.store(any())).thenReturn("k");
        when(fileRepository.existsByDownloadToken(any())).thenReturn(false);
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile mp = new MockMultipartFile("file", "x.txt", "text/plain", "x".getBytes());
        FileRecord saved = fileService.upload(mp, 99, null, principal);

        long days = java.time.Duration.between(saved.getCreatedAt(), saved.getExpiresAt()).toDays();
        assertThat(days).isBetween(6L, 7L);
    }

    @Test
    void getFileMetadata_renvoie_metadata_si_token_valide() {
        FileRecord record = new FileRecord(owner, "token123", "doc.pdf", "key1", "application/pdf", 100L, null, OffsetDateTime.now().plusDays(1));
        when(fileRepository.findByDownloadToken("token123")).thenReturn(Optional.of(record));

        FileMetadataResponse response = fileService.getFileMetadata("token123");
        assertThat(response.originalFilename()).isEqualTo("doc.pdf");
        assertThat(response.sizeBytes()).isEqualTo(100L);
        assertThat(response.isPasswordProtected()).isFalse();
    }

    @Test
    void getFileMetadata_jette_exception_si_introuvable() {
        when(fileRepository.findByDownloadToken("invalid")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> fileService.getFileMetadata("invalid"))
            .isInstanceOf(FileNotFoundException.class);
    }

    @Test
    void downloadFile_jette_exception_si_expire() {
        FileRecord record = new FileRecord(owner, "token123", "doc.pdf", "key1", "application/pdf", 100L, null, OffsetDateTime.now().minusDays(1));
        when(fileRepository.findByDownloadToken("token123")).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> fileService.downloadFile("token123", null))
            .isInstanceOf(FileExpiredException.class);
    }

    @Test
    void downloadFile_jette_exception_si_mot_de_passe_invalide() {
        FileRecord record = new FileRecord(owner, "token123", "doc.pdf", "key1", "application/pdf", 100L, "$2a$10$wJtK/Iof5N1JkG5mFzK1vO9vX5y8b2.c2w6K8uC2/8q8aQ3w3w8.", OffsetDateTime.now().plusDays(1));
        when(fileRepository.findByDownloadToken("token123")).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> fileService.downloadFile("token123", "wrong"))
            .isInstanceOf(InvalidFilePasswordException.class);
    }

    // ── listFiles ────────────────────────────────────────────────────────────

    @Test
    void listFiles_renvoie_fichiers_du_proprietaire() {
        when(userRepository.findById(any())).thenReturn(Optional.of(owner));
        FileRecord record = new FileRecord(owner, "tok1", "file.pdf", "key1", "application/pdf", 100L, null, OffsetDateTime.now().plusDays(1));
        when(fileRepository.findByOwnerOrderByCreatedAtDesc(owner)).thenReturn(List.of(record));

        List<FileListItem> result = fileService.listFiles(principal);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).originalFilename()).isEqualTo("file.pdf");
        verify(fileRepository).findByOwnerOrderByCreatedAtDesc(owner);
    }

    @Test
    void listFiles_jette_exception_si_utilisateur_introuvable() {
        when(userRepository.findById(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> fileService.listFiles(principal))
            .isInstanceOf(InvalidCredentialsException.class);
    }

    // ── deleteFile ───────────────────────────────────────────────────────────

    @Test
    void deleteFile_supprime_si_proprietaire() throws Exception {
        FileRecord record = new FileRecord(owner, "tok", "doc.pdf", "key", "application/pdf", 10L, null, OffsetDateTime.now().plusDays(1));
        when(fileRepository.findById(record.getId())).thenReturn(Optional.of(record));

        fileService.deleteFile(record.getId(), principal);

        verify(storage).delete("key");
        verify(fileRepository).delete(record);
    }

    @Test
    void deleteFile_continue_si_storage_ioexception() throws Exception {
        FileRecord record = new FileRecord(owner, "tok", "doc.pdf", "key", "application/pdf", 10L, null, OffsetDateTime.now().plusDays(1));
        when(fileRepository.findById(record.getId())).thenReturn(Optional.of(record));
        doThrow(new IOException("disque plein")).when(storage).delete(any());

        fileService.deleteFile(record.getId(), principal);

        verify(fileRepository).delete(record);
    }

    @Test
    void deleteFile_refuse_si_pas_proprietaire() {
        User autreUser = new User("autre@example.com", "hash");
        FileRecord record = new FileRecord(autreUser, "tok", "doc.pdf", "key", "application/pdf", 10L, null, OffsetDateTime.now().plusDays(1));
        when(fileRepository.findById(record.getId())).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> fileService.deleteFile(record.getId(), principal))
            .isInstanceOf(AccessDeniedException.class);
        verify(fileRepository, never()).delete(any());
    }

    @Test
    void deleteFile_jette_exception_si_fichier_introuvable() {
        UUID randomId = UUID.randomUUID();
        when(fileRepository.findById(randomId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> fileService.deleteFile(randomId, principal))
            .isInstanceOf(FileNotFoundException.class);
    }

    // ── purgeExpiredFiles ─────────────────────────────────────────────────────

    @Test
    void purge_supprime_fichiers_expires() throws Exception {
        FileRecord expired = new FileRecord(owner, "old", "old.txt", "keyOld", "text/plain", 5L, null, OffsetDateTime.now().minusDays(1));
        when(fileRepository.findByExpiresAtBefore(any())).thenReturn(List.of(expired));

        fileService.purgeExpiredFiles();

        verify(storage).delete("keyOld");
        verify(fileRepository).delete(expired);
    }

    @Test
    void purge_ne_fait_rien_si_aucun_expire() throws Exception {
        when(fileRepository.findByExpiresAtBefore(any())).thenReturn(List.of());

        fileService.purgeExpiredFiles();

        verify(storage, never()).delete(any());
        verify(fileRepository, never()).delete(any(FileRecord.class));
    }

    // ── addTag / removeTag ────────────────────────────────────────────────────

    @Test
    void addTag_cree_et_associe_nouveau_tag() {
        FileRecord record = new FileRecord(owner, "tok", "file.pdf", "key", "application/pdf", 10L, null, OffsetDateTime.now().plusDays(1));
        when(fileRepository.findById(record.getId())).thenReturn(Optional.of(record));
        Tag tag = new Tag(owner, "important");
        when(tagRepository.findByOwnerAndLabel(any(), any())).thenReturn(Optional.empty());
        when(tagRepository.save(any())).thenReturn(tag);
        when(fileRepository.save(any())).thenReturn(record);

        List<String> tags = fileService.addTag(record.getId(), "IMPORTANT", principal);

        assertThat(tags).contains("important");
    }

    @Test
    void addTag_reutilise_tag_existant() {
        FileRecord record = new FileRecord(owner, "tok", "file.pdf", "key", "application/pdf", 10L, null, OffsetDateTime.now().plusDays(1));
        when(fileRepository.findById(record.getId())).thenReturn(Optional.of(record));
        Tag existingTag = new Tag(owner, "archive");
        when(tagRepository.findByOwnerAndLabel(any(), any())).thenReturn(Optional.of(existingTag));
        when(fileRepository.save(any())).thenReturn(record);

        fileService.addTag(record.getId(), "archive", principal);

        verify(tagRepository, never()).save(any());
    }

    @Test
    void removeTag_retire_tag_existant() {
        Tag tag = new Tag(owner, "old-tag");
        FileRecord record = new FileRecord(owner, "tok", "file.pdf", "key", "application/pdf", 10L, null, OffsetDateTime.now().plusDays(1));
        record.addTag(tag);
        when(fileRepository.findById(record.getId())).thenReturn(Optional.of(record));
        when(fileRepository.save(any())).thenReturn(record);

        List<String> remaining = fileService.removeTag(record.getId(), "old-tag", principal);

        assertThat(remaining).doesNotContain("old-tag");
    }

    // ── branches clampExpirationDays ─────────────────────────────────────────

    @Test
    void upload_expiresInDays_null_utilise_defaut() throws Exception {
        when(userRepository.findById(any())).thenReturn(Optional.of(owner));
        when(storage.store(any())).thenReturn("k");
        when(fileRepository.existsByDownloadToken(any())).thenReturn(false);
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile mp = new MockMultipartFile("file", "x.txt", "text/plain", "x".getBytes());
        FileRecord saved = fileService.upload(mp, null, null, principal);

        long days = java.time.Duration.between(saved.getCreatedAt(), saved.getExpiresAt()).toDays();
        assertThat(days).isBetween(6L, 7L); // defaultExpirationDays=7
    }

    @Test
    void upload_expiresInDays_inferieur_a_1_clampe_a_1() throws Exception {
        when(userRepository.findById(any())).thenReturn(Optional.of(owner));
        when(storage.store(any())).thenReturn("k");
        when(fileRepository.existsByDownloadToken(any())).thenReturn(false);
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile mp = new MockMultipartFile("file", "x.txt", "text/plain", "x".getBytes());
        FileRecord saved = fileService.upload(mp, 0, null, principal);

        long hours = java.time.Duration.between(saved.getCreatedAt(), saved.getExpiresAt()).toHours();
        assertThat(hours).isBetween(20L, 28L); // clamped to 1 day
    }

    // ── branches validate / extensionOf / sanitizeFilename / resolveMimeType ──

    @Test
    void upload_filename_null_utilise_fichier_par_defaut() throws Exception {
        when(userRepository.findById(any())).thenReturn(Optional.of(owner));
        when(storage.store(any())).thenReturn("k");
        when(fileRepository.existsByDownloadToken(any())).thenReturn(false);
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile mp = new MockMultipartFile("file", null, "text/plain", "x".getBytes());
        FileRecord saved = fileService.upload(mp, 7, null, principal);

        assertThat(saved.getOriginalFilename()).isEqualTo("fichier");
    }

    @Test
    void upload_filename_sans_extension_accepte() throws Exception {
        when(userRepository.findById(any())).thenReturn(Optional.of(owner));
        when(storage.store(any())).thenReturn("k");
        when(fileRepository.existsByDownloadToken(any())).thenReturn(false);
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile mp = new MockMultipartFile("file", "noextension", "text/plain", "x".getBytes());
        FileRecord saved = fileService.upload(mp, 7, null, principal);

        assertThat(saved.getOriginalFilename()).isEqualTo("noextension");
    }

    @Test
    void upload_sans_content_type_utilise_octet_stream() throws Exception {
        when(userRepository.findById(any())).thenReturn(Optional.of(owner));
        when(storage.store(any())).thenReturn("k");
        when(fileRepository.existsByDownloadToken(any())).thenReturn(false);
        when(fileRepository.save(any(FileRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile mp = new MockMultipartFile("file", "photo.bin", null, "x".getBytes());
        FileRecord saved = fileService.upload(mp, 7, null, principal);

        assertThat(saved.getMimeType()).isEqualTo("application/octet-stream");
    }

    // ── branches downloadFile (password) ─────────────────────────────────────

    @Test
    void downloadFile_jette_si_password_null_sur_fichier_protege() {
        String hash = new BCryptPasswordEncoder(10).encode("secret");
        FileRecord record = new FileRecord(owner, "tok", "doc.pdf", "key", "application/pdf", 100L, hash, OffsetDateTime.now().plusDays(1));
        when(fileRepository.findByDownloadToken("tok")).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> fileService.downloadFile("tok", null))
            .isInstanceOf(InvalidFilePasswordException.class);
    }

    @Test
    void downloadFile_succes_avec_bon_mot_de_passe() throws Exception {
        String hash = new BCryptPasswordEncoder(10).encode("correct");
        FileRecord record = new FileRecord(owner, "tok", "doc.pdf", "key", "application/pdf", 100L, hash, OffsetDateTime.now().plusDays(1));
        when(fileRepository.findByDownloadToken("tok")).thenReturn(Optional.of(record));
        when(storage.openStream("key")).thenReturn(new ByteArrayInputStream("data".getBytes()));

        InputStream in = fileService.downloadFile("tok", "correct");

        assertThat(in).isNotNull();
        verify(storage).openStream("key");
    }

    // ── branches addTag / removeTag (owner null) ──────────────────────────────

    @Test
    void addTag_refuse_si_fichier_anonyme() {
        FileRecord record = new FileRecord(null, "tok", "file.pdf", "key", "application/pdf", 10L, null, OffsetDateTime.now().plusDays(1));
        when(fileRepository.findById(record.getId())).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> fileService.addTag(record.getId(), "tag", principal))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(fileRepository, never()).save(any());
    }

    @Test
    void removeTag_refuse_si_fichier_anonyme() {
        FileRecord record = new FileRecord(null, "tok", "file.pdf", "key", "application/pdf", 10L, null, OffsetDateTime.now().plusDays(1));
        when(fileRepository.findById(record.getId())).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> fileService.removeTag(record.getId(), "tag", principal))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(fileRepository, never()).save(any());
    }
}

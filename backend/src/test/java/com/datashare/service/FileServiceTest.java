package com.datashare.service;

import com.datashare.domain.FileRecord;
import com.datashare.domain.User;
import com.datashare.exception.FileTooLargeException;
import com.datashare.exception.InvalidCredentialsException;
import com.datashare.exception.UnsupportedFileTypeException;
import com.datashare.exception.FileNotFoundException;
import com.datashare.exception.FileExpiredException;
import com.datashare.exception.InvalidFilePasswordException;
import com.datashare.dto.FileMetadataResponse;
import com.datashare.repository.FileRepository;
import com.datashare.repository.UserRepository;
import com.datashare.security.AuthenticatedUser;
import com.datashare.storage.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileServiceTest {

    @Mock FileRepository fileRepository;
    @Mock UserRepository userRepository;
    @Mock StorageService storage;

    FileService fileService;

    private User owner;
    private AuthenticatedUser principal;

    @BeforeEach
    void setup() {
        fileService = new FileService(
            fileRepository,
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
    void upload_sans_principal_jette_invalid_credentials() {
        MockMultipartFile mp = new MockMultipartFile("file", "x.txt", "text/plain", "abc".getBytes());
        assertThatThrownBy(() -> fileService.upload(mp, 7, null, null))
            .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void upload_fichier_vide_jette_illegal_argument() {
        MockMultipartFile mp = new MockMultipartFile("file", "x.txt", "text/plain", new byte[0]);
        assertThatThrownBy(() -> fileService.upload(mp, 7, null, principal))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void upload_extension_interdite_jette_unsupported() {
        when(userRepository.findById(any())).thenReturn(Optional.of(owner));
        MockMultipartFile mp = new MockMultipartFile("file", "virus.exe", "application/octet-stream",
            "MZ".getBytes());
        assertThatThrownBy(() -> fileService.upload(mp, 7, null, principal))
            .isInstanceOf(UnsupportedFileTypeException.class);
        verify(fileRepository, never()).save(any());
    }

    @Test
    void upload_trop_volumineux_jette_too_large() {
        // Construit une version stub qui simule une grande taille sans allouer 1 Go
        MockMultipartFile huge = new MockMultipartFile("file", "big.bin",
            "application/octet-stream", new byte[10]) {
            @Override public long getSize() { return 1_073_741_824L + 1; }
        };
        when(userRepository.findById(any())).thenReturn(Optional.of(owner));
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
        // "secret" = $2a$10$CxnYh5H5mC5jH7V0K6lH2e/Wn/H7/K6lH2e/Wn/H7/K6lH2e/Wn/H7/ (faux hash pour simplifier, on encode)
        FileRecord record = new FileRecord(owner, "token123", "doc.pdf", "key1", "application/pdf", 100L, "$2a$10$wJtK/Iof5N1JkG5mFzK1vO9vX5y8b2.c2w6K8uC2/8q8aQ3w3w8.", OffsetDateTime.now().plusDays(1));
        when(fileRepository.findByDownloadToken("token123")).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> fileService.downloadFile("token123", "wrong"))
            .isInstanceOf(InvalidFilePasswordException.class);
    }
}

package com.datashare.controller;

import com.datashare.config.SecurityConfig;
import com.datashare.domain.FileRecord;
import com.datashare.domain.User;
import com.datashare.exception.GlobalExceptionHandler;
import com.datashare.security.AuthenticatedUser;
import com.datashare.security.JwtAuthenticationFilter;
import com.datashare.security.JwtService;
import com.datashare.service.FileService;
import com.datashare.dto.FileMetadataResponse;
import com.datashare.exception.FileNotFoundException;
import com.datashare.exception.FileExpiredException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import org.springframework.http.MediaType;
import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Map;

@WebMvcTest(FileController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtAuthenticationFilter.class})
class FileControllerTest {

    @Autowired MockMvc mvc;

    @MockBean FileService fileService;
    @MockBean JwtService jwtService;

    private void asAuthenticated() {
        AuthenticatedUser principal = new AuthenticatedUser(UUID.randomUUID(), "claire@example.com");
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, Collections.emptyList())
        );
    }

    @Test
    void upload_201_avec_token_et_downloadUrl() throws Exception {
        asAuthenticated();
        UUID userId = UUID.randomUUID();
        User owner = new User("claire@example.com", "$2a$12$h");
        FileRecord saved = new FileRecord(owner, "abc123token", "photo.jpg", "phys",
            "image/jpeg", 5L, null, OffsetDateTime.now().plusDays(7));
        when(fileService.upload(any(), any(), any(), any())).thenReturn(saved);

        MockMultipartFile file = new MockMultipartFile(
            "file", "photo.jpg", "image/jpeg", "binary".getBytes()
        );

        mvc.perform(multipart("/api/v1/files")
                .file(file)
                .param("expiresInDays", "3")
                .header("Origin", "http://localhost:4200"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.token").value("abc123token"))
            .andExpect(jsonPath("$.downloadUrl").value("http://localhost:4200/d/abc123token"))
            .andExpect(jsonPath("$.passwordRequired").value(false));
    }

    @Test
    void upload_201_anonyme_sans_authentification() throws Exception {
        SecurityContextHolder.clearContext();
        User dummyOwner = new User("anon@example.com", "$2a$12$h");
        FileRecord saved = new FileRecord(null, "token-anon", "photo.jpg", "phys",
            "image/jpeg", 5L, null, OffsetDateTime.now().plusDays(7));
        when(fileService.upload(any(), any(), any(), isNull())).thenReturn(saved);

        MockMultipartFile file = new MockMultipartFile(
            "file", "photo.jpg", "image/jpeg", "binary".getBytes()
        );
        mvc.perform(multipart("/api/v1/files")
                .file(file)
                .header("Origin", "http://localhost:4200"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.token").value("token-anon"));
    }

    @Test
    void upload_400_si_expiresInDays_hors_intervalle() throws Exception {
        asAuthenticated();
        MockMultipartFile file = new MockMultipartFile(
            "file", "photo.jpg", "image/jpeg", "x".getBytes()
        );
        // expiresInDays = 8 (>7) doit être refusé par @Max
        mvc.perform(multipart("/api/v1/files")
                .file(file)
                .param("expiresInDays", "8"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void getMetadata_retourne_200() throws Exception {
        FileMetadataResponse meta = new FileMetadataResponse("doc.pdf", "application/pdf", 100L, OffsetDateTime.now().plusDays(1), false);
        when(fileService.getFileMetadata("token123")).thenReturn(meta);

        mvc.perform(get("/api/v1/files/token123/metadata"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.originalFilename").value("doc.pdf"));
    }

    @Test
    void getMetadata_404_si_introuvable() throws Exception {
        when(fileService.getFileMetadata("invalid")).thenThrow(new FileNotFoundException());

        mvc.perform(get("/api/v1/files/invalid/metadata"))
            .andExpect(status().isNotFound());
    }

    @Test
    void download_retourne_fichier() throws Exception {
        FileMetadataResponse meta = new FileMetadataResponse("doc.pdf", "application/pdf", 10L, OffsetDateTime.now().plusDays(1), false);
        when(fileService.getFileMetadata("token123")).thenReturn(meta);
        when(fileService.downloadFile("token123", null)).thenReturn(new ByteArrayInputStream("filecontent".getBytes()));

        mvc.perform(post("/api/v1/files/token123/download")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition", "attachment; filename=\"doc.pdf\""))
            .andExpect(content().string("filecontent"));
    }

    @Test
    void download_410_si_expire() throws Exception {
        when(fileService.downloadFile(any(), any())).thenThrow(new FileExpiredException());

        mvc.perform(post("/api/v1/files/token123/download")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isGone());
    }

    @Test
    void download_sans_body_utilise_password_null() throws Exception {
        FileMetadataResponse meta = new FileMetadataResponse("doc.pdf", "application/pdf", 10L, OffsetDateTime.now().plusDays(1), false);
        when(fileService.getFileMetadata("tok")).thenReturn(meta);
        when(fileService.downloadFile("tok", null)).thenReturn(new ByteArrayInputStream("data".getBytes()));

        mvc.perform(post("/api/v1/files/tok/download"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition", "attachment; filename=\"doc.pdf\""));
    }

    @Test
    void listFiles_retourne_200_authentifie() throws Exception {
        asAuthenticated();
        when(fileService.listFiles(any())).thenReturn(List.of());

        mvc.perform(get("/api/v1/files"))
            .andExpect(status().isOk());
    }

    @Test
    void deleteFile_retourne_204_authentifie() throws Exception {
        asAuthenticated();
        UUID id = UUID.randomUUID();
        doNothing().when(fileService).deleteFile(any(), any());

        mvc.perform(delete("/api/v1/files/" + id))
            .andExpect(status().isNoContent());
    }

    @Test
    void addTag_retourne_200_avec_label_valide() throws Exception {
        asAuthenticated();
        UUID id = UUID.randomUUID();
        when(fileService.addTag(any(), any(), any())).thenReturn(List.of("important"));

        mvc.perform(post("/api/v1/files/" + id + "/tags")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"label\":\"important\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0]").value("important"));
    }

    @Test
    void addTag_retourne_400_si_label_vide() throws Exception {
        asAuthenticated();
        UUID id = UUID.randomUUID();

        mvc.perform(post("/api/v1/files/" + id + "/tags")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"label\":\"\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void addTag_retourne_400_si_label_trop_long() throws Exception {
        asAuthenticated();
        UUID id = UUID.randomUUID();
        String longLabel = "a".repeat(31);

        mvc.perform(post("/api/v1/files/" + id + "/tags")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"label\":\"" + longLabel + "\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void removeTag_retourne_200_authentifie() throws Exception {
        asAuthenticated();
        UUID id = UUID.randomUUID();
        when(fileService.removeTag(any(), any(), any())).thenReturn(List.of());

        mvc.perform(delete("/api/v1/files/" + id + "/tags/old-tag"))
            .andExpect(status().isOk());
    }

    @Test
    void upload_bearer_invalide_traite_comme_anonyme() throws Exception {
        when(jwtService.parse(any())).thenThrow(new io.jsonwebtoken.JwtException("bad token"));
        FileRecord saved = new FileRecord(null, "token-anon", "photo.jpg", "phys",
            "image/jpeg", 5L, null, OffsetDateTime.now().plusDays(7));
        when(fileService.upload(any(), any(), any(), isNull())).thenReturn(saved);

        MockMultipartFile file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", "x".getBytes());
        mvc.perform(multipart("/api/v1/files")
                .file(file)
                .header("Authorization", "Bearer invalid-token")
                .header("Origin", "http://localhost:4200"))
            .andExpect(status().isCreated());
    }

    @Test
    void upload_sans_origin_construit_url_depuis_request() throws Exception {
        SecurityContextHolder.clearContext();
        FileRecord saved = new FileRecord(null, "tok456", "f.jpg", "k", "image/jpeg", 1L, null,
            OffsetDateTime.now().plusDays(7));
        when(fileService.upload(any(), any(), any(), isNull())).thenReturn(saved);

        MockMultipartFile file = new MockMultipartFile("file", "f.jpg", "image/jpeg", "x".getBytes());
        mvc.perform(multipart("/api/v1/files").file(file))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.downloadUrl").value(
                org.hamcrest.Matchers.startsWith("http://")));
    }

    @Test
    void upload_auth_header_non_bearer_traite_comme_anonyme() throws Exception {
        SecurityContextHolder.clearContext();
        FileRecord saved = new FileRecord(null, "tok789", "f.jpg", "k", "image/jpeg", 1L, null,
            OffsetDateTime.now().plusDays(7));
        when(fileService.upload(any(), any(), any(), isNull())).thenReturn(saved);

        MockMultipartFile file = new MockMultipartFile("file", "f.jpg", "image/jpeg", "x".getBytes());
        mvc.perform(multipart("/api/v1/files")
                .file(file)
                .header("Authorization", "Basic dXNlcjpwYXNz")
                .header("Origin", "http://localhost:4200"))
            .andExpect(status().isCreated());
    }
}

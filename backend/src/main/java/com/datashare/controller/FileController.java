package com.datashare.controller;

import com.datashare.domain.FileRecord;
import com.datashare.dto.FileUploadResponse;
import com.datashare.dto.FileMetadataResponse;
import com.datashare.dto.FileListItem;
import com.datashare.dto.DownloadRequest;
import com.datashare.security.AuthenticatedUser;
import com.datashare.service.FileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;

/**
 * Endpoints liés aux fichiers (US01 ici, US02/US05/US06 ensuite).
 */
@RestController
@RequestMapping("/api/v1/files")
@Tag(name = "Files", description = "Upload, métadonnées, download, suppression (US01, US02, US06)")
@Validated
public class FileController {

    private final FileService fileService;

    public FileController(FileService fileService) {
        this.fileService = fileService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
        summary = "Téléverser un fichier (US01)",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<FileUploadResponse> upload(
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "expiresInDays", required = false)
            @Min(value = 1, message = "expiresInDays doit être ≥ 1")
            @Max(value = 7, message = "expiresInDays doit être ≤ 7")
            Integer expiresInDays,
        @RequestParam(value = "password", required = false)
            @Size(min = 6, max = 128, message = "Le mot de passe doit contenir entre 6 et 128 caractères.")
            String password,
        @AuthenticationPrincipal AuthenticatedUser principal,
        HttpServletRequest request
    ) {
        FileRecord saved = fileService.upload(file, expiresInDays, password, principal);
        FileUploadResponse body = FileUploadResponse.from(saved, publicBaseUrl(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/{token}/metadata")
    @Operation(summary = "Récupérer les métadonnées d'un fichier (US02)")
    public ResponseEntity<FileMetadataResponse> getMetadata(
        @Parameter(description = "Token unique de téléchargement")
        @PathVariable String token
    ) {
        FileMetadataResponse metadata = fileService.getFileMetadata(token);
        return ResponseEntity.ok(metadata);
    }

    @PostMapping("/{token}/download")
    @Operation(summary = "Télécharger un fichier via lien (US02)")
    public ResponseEntity<Resource> download(
        @Parameter(description = "Token unique de téléchargement")
        @PathVariable String token,
        @RequestBody(required = false) DownloadRequest request
    ) {
        String password = (request != null) ? request.password() : null;
        FileMetadataResponse metadata = fileService.getFileMetadata(token);
        InputStream in = fileService.downloadFile(token, password);

        InputStreamResource resource = new InputStreamResource(in);
        
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + metadata.originalFilename() + "\"")
            .contentType(MediaType.parseMediaType(metadata.mimeType()))
            .body(resource);
    }

    @GetMapping
    @Operation(
        summary = "Lister les fichiers de l'utilisateur connecté (US05)",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<List<FileListItem>> listFiles(
        @AuthenticationPrincipal AuthenticatedUser principal
    ) {
        return ResponseEntity.ok(fileService.listFiles(principal));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
        summary = "Supprimer un fichier (US05)",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Void> deleteFile(
        @PathVariable UUID id,
        @AuthenticationPrincipal AuthenticatedUser principal
    ) {
        fileService.deleteFile(id, principal);
        return ResponseEntity.noContent().build();
    }

    private String publicBaseUrl(HttpServletRequest req) {
        String origin = req.getHeader("Origin");
        if (origin != null && !origin.isBlank()) return origin;
        String scheme = req.getScheme();
        String host = req.getServerName();
        int port = req.getServerPort();
        boolean defaultPort = ("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443);
        return scheme + "://" + host + (defaultPort ? "" : ":" + port);
    }
}

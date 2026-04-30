package com.datashare.controller;

import com.datashare.dto.AuthResponse;
import com.datashare.dto.LoginRequest;
import com.datashare.dto.SignupRequest;
import com.datashare.dto.UserDto;
import com.datashare.exception.InvalidCredentialsException;
import com.datashare.repository.UserRepository;
import com.datashare.security.AuthenticatedUser;
import com.datashare.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Contrôleur d'authentification — implémente US03 (signup), US04 (login)
 * et l'endpoint /me protégé par JWT.
 */
@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth", description = "Création de compte, connexion (US03, US04)")
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;

    public AuthController(AuthService authService, UserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    @PostMapping("/signup")
    @Operation(summary = "Créer un compte (US03)")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        AuthResponse response = authService.signup(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    @Operation(summary = "Connexion (US04)")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    @Operation(summary = "Profil de l'utilisateur courant", security = @SecurityRequirement(name = "bearerAuth"))
    public UserDto me(Authentication authentication, @AuthenticationPrincipal AuthenticatedUser principal) {
        if (principal == null) {
            throw new InvalidCredentialsException();
        }
        return userRepository.findById(principal.id())
            .map(UserDto::from)
            .orElseThrow(InvalidCredentialsException::new);
    }
}

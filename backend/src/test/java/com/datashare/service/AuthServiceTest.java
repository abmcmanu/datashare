package com.datashare.service;

import com.datashare.domain.User;
import com.datashare.dto.AuthResponse;
import com.datashare.dto.LoginRequest;
import com.datashare.dto.SignupRequest;
import com.datashare.exception.EmailAlreadyUsedException;
import com.datashare.exception.InvalidCredentialsException;
import com.datashare.repository.UserRepository;
import com.datashare.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;

    @InjectMocks AuthService authService;

    private User existing;

    @BeforeEach
    void setup() {
        existing = new User("claire@example.com", "$2a$12$hashstub");
    }

    @Test
    void signup_creates_user_and_returns_token() {
        SignupRequest req = new SignupRequest("Claire@Example.com", "S3cret!1234");
        when(userRepository.existsByEmail("claire@example.com")).thenReturn(false);
        when(passwordEncoder.encode("S3cret!1234")).thenReturn("$2a$12$hash");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwtService.generate(any(UUID.class), anyString())).thenReturn("jwt-token");
        when(jwtService.getExpirationSeconds()).thenReturn(900L);

        AuthResponse response = authService.signup(req);

        assertThat(response.accessToken()).isEqualTo("jwt-token");
        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.expiresIn()).isEqualTo(900L);
        assertThat(response.user().email()).isEqualTo("claire@example.com");
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void signup_throws_when_email_already_used() {
        when(userRepository.existsByEmail("claire@example.com")).thenReturn(true);

        SignupRequest req = new SignupRequest("Claire@Example.com", "S3cret!1234");

        assertThatThrownBy(() -> authService.signup(req))
            .isInstanceOf(EmailAlreadyUsedException.class);
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void login_returns_token_when_password_matches() {
        when(userRepository.findByEmail("claire@example.com")).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches(eq("S3cret!1234"), eq("$2a$12$hashstub"))).thenReturn(true);
        when(jwtService.generate(any(UUID.class), anyString())).thenReturn("jwt-token");
        when(jwtService.getExpirationSeconds()).thenReturn(900L);

        AuthResponse response = authService.login(new LoginRequest("Claire@Example.com", "S3cret!1234"));

        assertThat(response.accessToken()).isEqualTo("jwt-token");
        assertThat(response.user().email()).isEqualTo("claire@example.com");
    }

    @Test
    void login_throws_when_user_not_found() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            authService.login(new LoginRequest("ghost@example.com", "whatever1")))
            .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void login_throws_when_password_does_not_match() {
        when(userRepository.findByEmail("claire@example.com")).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() ->
            authService.login(new LoginRequest("claire@example.com", "wrongpwd")))
            .isInstanceOf(InvalidCredentialsException.class);
    }
}

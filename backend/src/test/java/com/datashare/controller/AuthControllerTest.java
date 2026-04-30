package com.datashare.controller;

import com.datashare.config.SecurityConfig;
import com.datashare.dto.AuthResponse;
import com.datashare.dto.LoginRequest;
import com.datashare.dto.SignupRequest;
import com.datashare.dto.UserDto;
import com.datashare.exception.EmailAlreadyUsedException;
import com.datashare.exception.GlobalExceptionHandler;
import com.datashare.exception.InvalidCredentialsException;
import com.datashare.repository.UserRepository;
import com.datashare.security.JwtAuthenticationFilter;
import com.datashare.security.JwtService;
import com.datashare.service.AuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtAuthenticationFilter.class})
class AuthControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @MockBean AuthService authService;
    @MockBean UserRepository userRepository;
    @MockBean JwtService jwtService;

    @Test
    void signup_returns_201_with_token_on_success() throws Exception {
        SignupRequest req = new SignupRequest("claire@example.com", "S3cret!1234");
        UserDto user = new UserDto(UUID.randomUUID(), "claire@example.com", OffsetDateTime.now());
        when(authService.signup(any(SignupRequest.class)))
            .thenReturn(AuthResponse.bearer("jwt-token", 900, user));

        mvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.accessToken").value("jwt-token"))
            .andExpect(jsonPath("$.tokenType").value("Bearer"))
            .andExpect(jsonPath("$.user.email").value("claire@example.com"));
    }

    @Test
    void signup_returns_400_when_email_invalid() throws Exception {
        String body = """
            { "email": "not-an-email", "password": "S3cret!1234" }
            """;
        mvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
            .andExpect(jsonPath("$.fieldErrors[?(@.field == 'email')]").exists());
    }

    @Test
    void signup_returns_400_when_password_too_short() throws Exception {
        String body = """
            { "email": "ok@example.com", "password": "abc" }
            """;
        mvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fieldErrors[?(@.field == 'password')]").exists());
    }

    @Test
    void signup_returns_409_when_email_already_used() throws Exception {
        when(authService.signup(any(SignupRequest.class)))
            .thenThrow(new EmailAlreadyUsedException("claire@example.com"));

        SignupRequest req = new SignupRequest("claire@example.com", "S3cret!1234");
        mvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_USED"));
    }

    @Test
    void login_returns_200_with_token_on_success() throws Exception {
        LoginRequest req = new LoginRequest("claire@example.com", "S3cret!1234");
        UserDto user = new UserDto(UUID.randomUUID(), "claire@example.com", OffsetDateTime.now());
        when(authService.login(any(LoginRequest.class)))
            .thenReturn(AuthResponse.bearer("jwt-token", 900, user));

        mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").value("jwt-token"));
    }

    @Test
    void login_returns_401_on_invalid_credentials() throws Exception {
        when(authService.login(any(LoginRequest.class)))
            .thenThrow(new InvalidCredentialsException());

        LoginRequest req = new LoginRequest("claire@example.com", "wrongpwd");
        mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }
}

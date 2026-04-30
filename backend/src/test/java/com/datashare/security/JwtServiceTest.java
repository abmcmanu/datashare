package com.datashare.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "test-secret-must-be-at-least-32-characters-long-please";

    @Test
    void generate_then_parse_returns_same_subject_and_uid() {
        JwtService jwt = new JwtService(SECRET, 60_000);
        UUID userId = UUID.randomUUID();

        String token = jwt.generate(userId, "claire@example.com");
        Claims claims = jwt.parse(token);

        assertThat(claims.getSubject()).isEqualTo("claire@example.com");
        assertThat(claims.get("uid", String.class)).isEqualTo(userId.toString());
    }

    @Test
    void parse_with_wrong_secret_throws() {
        JwtService signer  = new JwtService(SECRET, 60_000);
        JwtService verifier = new JwtService("another-secret-of-at-least-32-characters-long!", 60_000);

        String token = signer.generate(UUID.randomUUID(), "x@y.z");

        assertThatThrownBy(() -> verifier.parse(token))
            .isInstanceOf(io.jsonwebtoken.JwtException.class);
    }

    @Test
    void parse_expired_token_throws() {
        JwtService jwt = new JwtService(SECRET, 1); // 1 ms
        String token = jwt.generate(UUID.randomUUID(), "x@y.z");
        try { Thread.sleep(20); } catch (InterruptedException ignored) {}

        assertThatThrownBy(() -> jwt.parse(token))
            .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void short_secret_is_rejected() {
        assertThatThrownBy(() -> new JwtService("too-short", 60_000))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void getExpirationSeconds_returns_seconds() throws Exception {
        JwtService jwt = new JwtService(SECRET, 900_000);
        // Vérifie le calcul interne via la méthode publique
        assertThat(jwt.getExpirationSeconds()).isEqualTo(900);

        // Vérifie aussi par réflexion que le champ interne est conservé
        Field f = JwtService.class.getDeclaredField("expirationMs");
        f.setAccessible(true);
        assertThat(f.getLong(jwt)).isEqualTo(900_000);
    }
}

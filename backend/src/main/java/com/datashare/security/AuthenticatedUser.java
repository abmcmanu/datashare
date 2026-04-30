package com.datashare.security;

import java.util.UUID;

/**
 * Principal Spring Security minimal — utilisé comme value-object dans le contexte
 * de sécurité après lecture du JWT par {@link JwtAuthenticationFilter}.
 */
public record AuthenticatedUser(UUID id, String email) {}

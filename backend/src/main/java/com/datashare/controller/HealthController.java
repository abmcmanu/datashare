package com.datashare.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Endpoint de santé public — sert également de "ping" pour le front-end.
 * Permet de valider de bout en bout l'enchaînement Angular → Spring Boot dès l'init.
 */
@RestController
@RequestMapping("/api/v1/health")
@Tag(name = "Health", description = "Supervision de l'application")
public class HealthController {

    @Value("${spring.application.name}")
    private String appName;

    @GetMapping
    @Operation(summary = "Health check public — utilisé par le front pour le ping E2E.")
    public Map<String, Object> health() {
        return Map.of(
            "status", "UP",
            "service", appName,
            "version", "0.1.0",
            "timestamp", OffsetDateTime.now().toString()
        );
    }
}

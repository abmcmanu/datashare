package com.datashare.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration springdoc-openapi : aligne la documentation auto-générée
 * sur le contrat d'interface défini dans <code>docs/conception/04-openapi.yaml</code>.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI dataShareOpenAPI() {
        final String securitySchemeName = "bearerAuth";

        return new OpenAPI()
            .info(new Info()
                .title("DataShare API")
                .version("0.1.0")
                .description("API REST de la plateforme DataShare — transfert sécurisé de fichiers.")
                .contact(new Contact().name("Équipe DataShare").email("tech@datashare.example"))
                .license(new License().name("Proprietary")))
            .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
            .components(new Components()
                .addSecuritySchemes(securitySchemeName,
                    new SecurityScheme()
                        .name(securitySchemeName)
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")));
    }
}

# ── Stage 1 : téléchargement des dépendances (couche mise en cache) ──────────
FROM maven:3.9-eclipse-temurin-21-alpine AS deps
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline -q

# ── Stage 2 : compilation ────────────────────────────────────────────────────
FROM deps AS builder
COPY src ./src
RUN mvn package -DskipTests -q

# ── Stage 3 : image de production (JRE minimal) ──────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS runtime

# Utilisateur non-root dédié
RUN addgroup -S datashare && adduser -S datashare -G datashare

WORKDIR /app

COPY --from=builder --chown=datashare:datashare /build/target/datashare-backend.jar app.jar

# Dossier uploads (monté en volume en prod)
RUN mkdir -p /app/uploads && chown datashare:datashare /app/uploads

USER datashare

EXPOSE 7777

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:7777/actuator/health || exit 1

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-Dspring.profiles.active=prod", \
  "-jar", "app.jar"]
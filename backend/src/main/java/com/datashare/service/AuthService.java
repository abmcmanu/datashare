package com.datashare.service;

import com.datashare.domain.User;
import com.datashare.dto.AuthResponse;
import com.datashare.dto.LoginRequest;
import com.datashare.dto.SignupRequest;
import com.datashare.dto.UserDto;
import com.datashare.exception.EmailAlreadyUsedException;
import com.datashare.exception.InvalidCredentialsException;
import com.datashare.repository.UserRepository;
import com.datashare.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Logique métier de l'authentification (US03 / US04).
 *
 * <ul>
 *   <li>Inscription : hash BCrypt + persistance + génération JWT</li>
 *   <li>Connexion   : vérification BCrypt + génération JWT</li>
 * </ul>
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String normalizedEmail = request.email().toLowerCase().trim();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new EmailAlreadyUsedException(normalizedEmail);
        }

        String hash = passwordEncoder.encode(request.password());
        User user = userRepository.save(new User(normalizedEmail, hash));

        log.info("Nouvel utilisateur inscrit : {}", user.getId());
        return buildAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.email().toLowerCase().trim();

        User user = userRepository.findByEmail(normalizedEmail)
            .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        log.info("Connexion réussie : {}", user.getId());
        return buildAuthResponse(user);
    }

    private AuthResponse buildAuthResponse(User user) {
        String token = jwtService.generate(user.getId(), user.getEmail());
        return AuthResponse.bearer(token, jwtService.getExpirationSeconds(), UserDto.from(user));
    }
}

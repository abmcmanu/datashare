package com.datashare.repository;

import com.datashare.domain.FileRecord;
import com.datashare.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Accès aux fichiers en base.
 */
@Repository
public interface FileRepository extends JpaRepository<FileRecord, UUID> {

    Optional<FileRecord> findByDownloadToken(String token);

    boolean existsByDownloadToken(String token);

    List<FileRecord> findByOwnerOrderByCreatedAtDesc(User owner);
}

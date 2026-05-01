package com.datashare.repository;

import com.datashare.domain.Tag;
import com.datashare.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TagRepository extends JpaRepository<Tag, UUID> {

    Optional<Tag> findByOwnerAndLabel(User owner, String label);

    List<Tag> findByOwner(User owner);
}

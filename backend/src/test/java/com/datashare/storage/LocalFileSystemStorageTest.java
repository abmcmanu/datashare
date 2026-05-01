package com.datashare.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalFileSystemStorageTest {

    @TempDir Path tmp;
    LocalFileSystemStorage storage;

    @BeforeEach
    void setup() throws Exception {
        storage = new LocalFileSystemStorage(tmp.toString());
        storage.init();
    }

    @Test
    void store_then_openStream_renvoie_le_meme_contenu() throws Exception {
        byte[] payload = "hello world".getBytes();
        String key;
        try (InputStream in = new ByteArrayInputStream(payload)) {
            key = storage.store(in);
        }
        assertThat(key).isNotBlank();

        try (InputStream out = storage.openStream(key)) {
            assertThat(out.readAllBytes()).isEqualTo(payload);
        }
    }

    @Test
    void delete_efface_le_fichier() throws Exception {
        String key;
        try (InputStream in = new ByteArrayInputStream(new byte[]{1, 2, 3})) {
            key = storage.store(in);
        }
        storage.delete(key);

        // delete idempotent
        storage.delete(key);
    }

    @Test
    void clé_avec_path_traversal_est_rejetée() {
        assertThatThrownBy(() -> storage.openStream("../" + UUID.randomUUID()))
            .isInstanceOf(IllegalArgumentException.class);
    }
}

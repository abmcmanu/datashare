package com.datashare.storage;

import java.io.IOException;
import java.io.InputStream;

/**
 * Abstraction du stockage des binaires.
 *
 * <p>Implémentation actuelle : <code>LocalFileSystemStorage</code> (système de fichiers).
 * Implémentation future : <code>S3Storage</code> (AWS S3) — sans toucher au reste du code.</p>
 */
public interface StorageService {

    /**
     * Stocke un nouveau fichier et renvoie une clé opaque permettant de le récupérer.
     *
     * @param input  flux du fichier (ne sera pas fermé par cette méthode)
     * @return       clé technique (UUID, chemin S3, ...)
     */
    String store(InputStream input) throws IOException;

    /**
     * Ouvre un flux de lecture sur le binaire identifié par la clé.
     * L'appelant est responsable de la fermeture du flux.
     */
    InputStream openStream(String storageKey) throws IOException;

    /**
     * Supprime physiquement le binaire. No-op si la clé n'existe plus.
     */
    void delete(String storageKey) throws IOException;
}

package com.datashare.job;

import com.datashare.service.FileService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Tâche planifiée pour purger les fichiers expirés (US10).
 */
@Component
public class FileExpirationJob {

    private final FileService fileService;

    public FileExpirationJob(FileService fileService) {
        this.fileService = fileService;
    }

    /**
     * S'exécute tous les jours à 2h00 du matin.
     * Expression Cron : Seconde Minute Heure Jour Mois JourSemaine
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void purgeExpiredFiles() {
        fileService.purgeExpiredFiles();
    }
}

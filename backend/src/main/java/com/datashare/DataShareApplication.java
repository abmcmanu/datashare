package com.datashare;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Point d'entrée de l'application DataShare.
 *
 * @EnableScheduling active la tâche planifiée de purge des fichiers expirés (US10).
 */
@SpringBootApplication
@EnableScheduling
public class DataShareApplication {

    public static void main(String[] args) {
        SpringApplication.run(DataShareApplication.class, args);
    }
}

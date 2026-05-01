import { Injectable } from '@angular/core';

/**
 * Calcule l'URL d'avatar Gravatar pour un email donné.
 *
 * Gravatar accepte SHA-256 (recommandé depuis 2024). On utilise l'API
 * Web Crypto native du navigateur — aucune dépendance externe.
 *
 * @see https://docs.gravatar.com/general/hash/
 */
@Injectable({ providedIn: 'root' })
export class AvatarService {

  private readonly cache = new Map<string, string>();

  /**
   * Renvoie une URL Gravatar (HTTPS). Les images sont mises en cache
   * pour éviter de re-hasher à chaque rendu.
   *
   * @param email   adresse email de l'utilisateur
   * @param size    taille en pixels (carrée), par défaut 80
   * @param fallback que renvoie Gravatar si l'utilisateur n'a pas de photo
   *                ('identicon', 'mp', 'retro', 'wavatar', 'robohash', '404')
   */
  async urlFor(email: string, size = 80, fallback: 'identicon' | 'mp' | 'retro' | 'wavatar' = 'identicon'): Promise<string> {
    const normalized = (email ?? '').trim().toLowerCase();
    const key = `${normalized}|${size}|${fallback}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const hash = await this.sha256Hex(normalized);
    const url = `https://gravatar.com/avatar/${hash}?s=${size}&d=${fallback}`;
    this.cache.set(key, url);
    return url;
  }

  private async sha256Hex(input: string): Promise<string> {
    const buffer = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

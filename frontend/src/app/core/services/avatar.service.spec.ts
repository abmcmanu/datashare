import { TestBed } from '@angular/core/testing';

import { AvatarService } from './avatar.service';

describe('AvatarService', () => {
  let service: AvatarService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AvatarService);
  });

  it("normalise l'email (trim + lowercase) et utilise SHA-256 hex de 64 caractères", async () => {
    const url1 = await service.urlFor('Claire@Example.com', 80);
    const url2 = await service.urlFor('  claire@example.com  ', 80);
    expect(url1).toBe(url2);
    expect(url1).toMatch(/^https:\/\/gravatar\.com\/avatar\/[0-9a-f]{64}\?s=80&d=identicon$/);
  });

  it('utilise le cache pour ne pas re-hasher', async () => {
    const spy = spyOn(crypto.subtle, 'digest').and.callThrough();
    await service.urlFor('a@b.c', 80);
    await service.urlFor('a@b.c', 80);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('respecte le paramètre size', async () => {
    const url = await service.urlFor('a@b.c', 256);
    expect(url).toContain('s=256');
  });
});

import { TestBed, fakeAsync, tick, flushMicrotasks } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { DashboardComponent } from './dashboard.component';
import { UserFileItem } from '../../core/files/file.service';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'datashare.jwt';
const USER_KEY  = 'datashare.user';
const FILES_URL  = `${environment.apiBaseUrl}/files`;

function loginSession(email = 'claire@example.com'): void {
  sessionStorage.setItem(TOKEN_KEY, 'fake-jwt');
  sessionStorage.setItem(USER_KEY, JSON.stringify({ id: '1', email, createdAt: '' }));
}

function makeFileItem(
  id: string,
  expired = false,
  tags: string[] = [],
  expiresAt?: string
): UserFileItem {
  const future = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
  const past   = new Date(Date.now() - 3600 * 1000).toISOString();
  return {
    id, token: id, originalFilename: `file-${id}.txt`,
    mimeType: 'text/plain', sizeBytes: 1024, passwordRequired: false,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt ?? (expired ? past : future),
    expired, tags
  };
}

describe('DashboardComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, DashboardComponent],
      providers: [provideRouter([])]
    });
    httpMock = TestBed.inject(HttpTestingController);
    router   = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  });

  afterEach(() => httpMock.verify());

  // ================================================================
  // ngOnInit — authentification
  // ================================================================

  it('redirige vers /login si non authentifié', () => {
    // sessionStorage vide → non authentifié
    TestBed.createComponent(DashboardComponent).detectChanges();
    httpMock.expectNone(FILES_URL);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('charge les fichiers au démarrage si authentifié', () => {
    loginSession();
    TestBed.createComponent(DashboardComponent).detectChanges();
    const req = httpMock.expectOne(FILES_URL);
    expect(req.request.method).toBe('GET');
    req.flush([makeFileItem('1')]);
  });

  // ================================================================
  // loadFiles()
  // ================================================================

  it('loadFiles() remplit files et passe loading à false', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    expect(cmp.loading()).toBeTrue();

    const items = [makeFileItem('a'), makeFileItem('b', true)];
    httpMock.expectOne(FILES_URL).flush(items);

    expect(cmp.loading()).toBeFalse();
    expect(cmp.files().length).toBe(2);
    expect(cmp.error()).toBeNull();
  });

  it('loadFiles() en erreur positionne error et passe loading à false', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    httpMock.expectOne(FILES_URL)
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(cmp.loading()).toBeFalse();
    expect(cmp.error()).toBeTruthy();
  });

  // ================================================================
  // filteredFiles computed — onglets
  // ================================================================

  it("filteredFiles sur 'actifs' exclut les fichiers expirés", () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    httpMock.expectOne(FILES_URL).flush([
      makeFileItem('active', false),
      makeFileItem('expired', true)
    ]);

    cmp.setTab('actifs');
    expect(cmp.filteredFiles().length).toBe(1);
    expect(cmp.filteredFiles()[0].id).toBe('active');
  });

  it("filteredFiles sur 'expire' exclut les fichiers non expirés", () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    httpMock.expectOne(FILES_URL).flush([
      makeFileItem('active', false),
      makeFileItem('expired', true)
    ]);

    cmp.setTab('expire');
    expect(cmp.filteredFiles().length).toBe(1);
    expect(cmp.filteredFiles()[0].id).toBe('expired');
  });

  it("filteredFiles sur 'tous' retourne tout", () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    httpMock.expectOne(FILES_URL).flush([
      makeFileItem('a', false),
      makeFileItem('b', true)
    ]);

    cmp.setTab('tous');
    expect(cmp.filteredFiles().length).toBe(2);
  });

  it("filteredFiles filtre par tag sélectionné", () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    httpMock.expectOne(FILES_URL).flush([
      makeFileItem('with-tag', false, ['important']),
      makeFileItem('no-tag', false, [])
    ]);

    cmp.setTab('tous');
    cmp.toggleTagFilter('important');
    expect(cmp.filteredFiles().length).toBe(1);
    expect(cmp.filteredFiles()[0].id).toBe('with-tag');
  });

  // ================================================================
  // allTags computed
  // ================================================================

  it('allTags retourne les tags uniques triés de tous les fichiers', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    httpMock.expectOne(FILES_URL).flush([
      makeFileItem('1', false, ['zebra', 'alpha']),
      makeFileItem('2', false, ['alpha', 'beta'])
    ]);

    expect(cmp.allTags()).toEqual(['alpha', 'beta', 'zebra']);
  });

  // ================================================================
  // askDelete / confirmDelete / cancelDelete
  // ================================================================

  it('askDelete() positionne fileToDelete', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('x');

    httpMock.expectOne(FILES_URL).flush([item]);
    cmp.askDelete(item);
    expect(cmp.fileToDelete()).toEqual(item);
  });

  it('cancelDelete() remet fileToDelete à null', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('x');

    httpMock.expectOne(FILES_URL).flush([item]);
    cmp.askDelete(item);
    cmp.cancelDelete();
    expect(cmp.fileToDelete()).toBeNull();
  });

  it('confirmDelete() est sans effet si fileToDelete est null', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    httpMock.expectOne(FILES_URL).flush([]);
    cmp.confirmDelete();
    httpMock.expectNone(`${FILES_URL}/x`);
    expect(cmp.fileToDelete()).toBeNull();
  });

  it('confirmDelete() supprime le fichier et retire de la liste', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('del-id');

    httpMock.expectOne(FILES_URL).flush([item]);
    cmp.askDelete(item);
    cmp.confirmDelete();

    const req = httpMock.expectOne(`${FILES_URL}/del-id`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(cmp.files().length).toBe(0);
    expect(cmp.fileToDelete()).toBeNull();
    expect(cmp.deleting()).toBeFalse();
  });

  it('confirmDelete() en erreur positionne error et remet deleting à false', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('del-id');

    httpMock.expectOne(FILES_URL).flush([item]);
    cmp.askDelete(item);
    cmp.confirmDelete();

    httpMock.expectOne(`${FILES_URL}/del-id`)
      .flush({}, { status: 500, statusText: 'Error' });

    expect(cmp.error()).toBeTruthy();
    expect(cmp.deleting()).toBeFalse();
    expect(cmp.fileToDelete()).toBeNull();
  });

  // ================================================================
  // toggleMobileActions / mobileAskDelete
  // ================================================================

  it('toggleMobileActions positionne et remet mobileActionsFile', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('m');

    httpMock.expectOne(FILES_URL).flush([item]);
    cmp.toggleMobileActions(item);
    expect(cmp.mobileActionsFile()).toEqual(item);

    cmp.toggleMobileActions(null);
    expect(cmp.mobileActionsFile()).toBeNull();
  });

  it('mobileAskDelete ferme le menu mobile et positionne fileToDelete', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('m');

    httpMock.expectOne(FILES_URL).flush([item]);
    cmp.toggleMobileActions(item);
    cmp.mobileAskDelete(item);

    expect(cmp.mobileActionsFile()).toBeNull();
    expect(cmp.fileToDelete()).toEqual(item);
  });

  // ================================================================
  // formatExpiresLabel()
  // ================================================================

  it('formatExpiresLabel retourne Expiré pour un fichier expiré', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    httpMock.expectOne(FILES_URL).flush([]);

    const item = makeFileItem('x', true);
    expect(cmp.formatExpiresLabel(item)).toBe('Expiré');
  });

  it('formatExpiresLabel retourne Expire demain si ≤ 1 jour restant', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    httpMock.expectOne(FILES_URL).flush([]);

    const tomorrow = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
    const item = makeFileItem('x', false, [], tomorrow);
    expect(cmp.formatExpiresLabel(item)).toBe('Expire demain');
  });

  it('formatExpiresLabel retourne Expire dans N jours si > 1 jour restant', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    httpMock.expectOne(FILES_URL).flush([]);

    const threeDays = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const item = makeFileItem('x', false, [], threeDays);
    const label = cmp.formatExpiresLabel(item);
    expect(label).toMatch(/^Expire dans \d+ jours$/);
  });

  // ================================================================
  // logout()
  // ================================================================

  it('logout() déconnecte et navigue vers /', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    httpMock.expectOne(FILES_URL).flush([]);

    cmp.logout();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(cmp.auth.isAuthenticated()).toBeFalse();
  });

  // ================================================================
  // toggleMobileMenu()
  // ================================================================

  it('toggleMobileMenu() bascule mobileMenuOpen', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    httpMock.expectOne(FILES_URL).flush([]);

    expect(cmp.mobileMenuOpen).toBeFalse();
    cmp.toggleMobileMenu();
    expect(cmp.mobileMenuOpen).toBeTrue();
    cmp.toggleMobileMenu();
    expect(cmp.mobileMenuOpen).toBeFalse();
  });

  // ================================================================
  // setTab()
  // ================================================================

  it('setTab() change l\'onglet courant', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    httpMock.expectOne(FILES_URL).flush([]);

    cmp.setTab('tous');
    expect(cmp.currentTab()).toBe('tous');
    cmp.setTab('expire');
    expect(cmp.currentTab()).toBe('expire');
  });

  // ================================================================
  // toggleTagFilter()
  // ================================================================

  it('toggleTagFilter() sélectionne et désélectionne un tag', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    httpMock.expectOne(FILES_URL).flush([]);

    expect(cmp.selectedTag()).toBeNull();
    cmp.toggleTagFilter('projet');
    expect(cmp.selectedTag()).toBe('projet');
    cmp.toggleTagFilter('projet'); // désélectionne
    expect(cmp.selectedTag()).toBeNull();
  });

  // ================================================================
  // getUserName()
  // ================================================================

  it('getUserName() retourne la partie locale de l\'email', () => {
    loginSession('claire@example.com');
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    httpMock.expectOne(FILES_URL).flush([]);

    expect(cmp.getUserName()).toBe('claire');
  });

  // ================================================================
  // addTag()
  // ================================================================

  it('addTag() est sans effet si le label est vide', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('1');
    httpMock.expectOne(FILES_URL).flush([item]);

    cmp.tagInputs[item.id] = '   ';
    cmp.addTag(item);
    httpMock.expectNone(`${FILES_URL}/1/tags`);
    expect(cmp.files()[0].tags).toEqual([]);
  });

  it('addTag() est sans effet si le label dépasse 30 caractères', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('1');
    httpMock.expectOne(FILES_URL).flush([item]);

    cmp.tagInputs[item.id] = 'a'.repeat(31);
    cmp.addTag(item);
    httpMock.expectNone(`${FILES_URL}/1/tags`);
    expect(cmp.files()[0].tags).toEqual([]);
  });

  it('addTag() est sans effet si le tag existe déjà (lowercase)', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('1', false, ['urgent']);
    httpMock.expectOne(FILES_URL).flush([item]);

    cmp.tagInputs[item.id] = 'urgent';
    cmp.addTag(item);
    httpMock.expectNone(`${FILES_URL}/1/tags`);
    expect(cmp.files()[0].tags).toEqual(['urgent']); // inchangé
  });

  it('addTag() envoie la requête et met à jour les tags du fichier', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('1');
    httpMock.expectOne(FILES_URL).flush([item]);

    cmp.tagInputs[item.id] = 'nouveau';
    cmp.addTag(item);

    const req = httpMock.expectOne(`${FILES_URL}/1/tags`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ label: 'nouveau' });
    req.flush(['nouveau']);

    expect(cmp.files()[0].tags).toEqual(['nouveau']);
    expect(cmp.tagInputs[item.id]).toBe('');
  });

  // ================================================================
  // removeTag()
  // ================================================================

  it('removeTag() envoie la requête DELETE et met à jour les tags', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('1', false, ['important', 'urgent']);
    httpMock.expectOne(FILES_URL).flush([item]);

    cmp.removeTag(item, 'important');

    const req = httpMock.expectOne(`${FILES_URL}/1/tags/important`);
    expect(req.request.method).toBe('DELETE');
    req.flush(['urgent']);

    expect(cmp.files()[0].tags).toEqual(['urgent']);
  });

  // ================================================================
  // onTagKeydown()
  // ================================================================

  it('onTagKeydown() avec Enter appelle addTag()', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('1');
    httpMock.expectOne(FILES_URL).flush([item]);

    cmp.tagInputs[item.id] = 'newtag';
    const event = { key: 'Enter', preventDefault: jasmine.createSpy('preventDefault') } as unknown as KeyboardEvent;
    cmp.onTagKeydown(event, item);

    expect(event.preventDefault).toHaveBeenCalled();
    const req = httpMock.expectOne(`${FILES_URL}/1/tags`);
    req.flush(['newtag']);
  });

  it('onTagKeydown() avec autre touche n\'appelle pas addTag()', () => {
    loginSession();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const item = makeFileItem('1');
    httpMock.expectOne(FILES_URL).flush([item]);

    cmp.tagInputs[item.id] = 'text';
    const event = { key: 'a', preventDefault: jasmine.createSpy('preventDefault') } as unknown as KeyboardEvent;
    cmp.onTagKeydown(event, item);

    expect(event.preventDefault).not.toHaveBeenCalled();
    httpMock.expectNone(`${FILES_URL}/1/tags`);
  });
});
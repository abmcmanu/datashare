describe('DataShare MVP Scenarios', () => {
  
  beforeEach(() => {
    // Intercepter toutes les requêtes pour ne pas dépendre du backend réel
    cy.intercept('POST', '/api/v1/auth/login', {
      statusCode: 200,
      body: {
        accessToken: 'fake-jwt-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: { id: '123', email: 'claire@example.com', createdAt: new Date().toISOString() }
      }
    }).as('login');

    cy.intercept('POST', '/api/v1/files', {
      statusCode: 200,
      body: {
        id: 'file-123',
        token: 'token-abc',
        downloadUrl: 'http://localhost:4200/d/token-abc',
        originalFilename: 'test-anonyme.txt',
        sizeBytes: 1024,
        mimeType: 'text/plain',
        passwordRequired: false,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      }
    }).as('upload');

    cy.intercept('GET', '/api/v1/files/token-abc/metadata', {
      statusCode: 200,
      body: {
        originalFilename: 'test-anonyme.txt',
        mimeType: 'text/plain',
        sizeBytes: 1024,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isPasswordProtected: false
      }
    }).as('metadata');

    cy.intercept('GET', '/api/v1/files', {
      statusCode: 200,
      body: [
        {
          id: 'file-123',
          token: 'token-abc',
          originalFilename: 'mon-fichier-secret.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          passwordRequired: false,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          expired: false,
          tags: ['important']
        }
      ]
    }).as('listFiles');

    cy.intercept('DELETE', '/api/v1/files/file-123', {
      statusCode: 204
    }).as('deleteFile');
    
    // Clear session storage avant chaque test
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });
  });

  it('Scenario 1: Upload Anonyme (US07)', () => {
    cy.visit('/');
    cy.contains('DataShare');
    
    // Ouvrir la modale d'upload
    cy.get('.ds-upload').click();

    // Simuler le choix d'un fichier
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('Fichier de test Cypress'),
      fileName: 'test-anonyme.txt',
      mimeType: 'text/plain',
      lastModified: Date.now(),
    }, { force: true });

    // Remplir et valider l'upload
    cy.get('.ds-submit').click();

    // Attendre la requête d'upload
    cy.wait('@upload');

    // Le dialog affiche le lien — cliquer dessus pour aller sur la page de téléchargement
    cy.get('.ds-link-box').invoke('removeAttr', 'target').click();

    // Vérifier la navigation vers la page de téléchargement
    cy.url().should('include', '/d/token-abc');

    // Attendre le chargement des métadonnées et vérifier l'affichage
    cy.wait('@metadata');
    cy.contains('test-anonyme.txt');
  });

  it('Scenario 2: Authentification (US03/US04)', () => {
    cy.visit('/login');
    
    // Remplir le formulaire
    cy.get('input[type="email"]').type('claire@example.com');
    cy.get('input[type="password"]').type('password');
    cy.get('button[type="submit"]').click();
    
    // Attendre la requête de login
    cy.wait('@login');

    // Vérifier la redirection vers le dashboard et le nom affiché
    cy.url().should('include', '/dashboard');
    cy.contains('claire'); 
  });

  it('Scenario 3: Suppression de Fichier (US06)', () => {
    // Injecter un faux token pour simuler un utilisateur connecté
    cy.window().then((win) => {
      win.sessionStorage.setItem('datashare.jwt', 'fake-jwt-token');
      win.sessionStorage.setItem('datashare.user', JSON.stringify({ email: 'claire@example.com' }));
    });

    cy.visit('/dashboard');
    cy.wait('@listFiles');
    
    // Trouver le bouton supprimer sur le fichier (icône poubelle)
    // Selon le DOM, le bouton a la classe .ds-delete-btn
    cy.get('.ds-file-card').first().find('.ds-delete-btn').click();
    
    // Confirmer la suppression dans la modale
    cy.get('.ds-modal-footer .ds-btn-danger').click();
    
    // Attendre l'appel réseau
    cy.wait('@deleteFile');
    
    // Vérifier que le fichier a disparu (la liste des fichiers filtrés sera vide car Cypress ne modifie pas le state du signal Mock automatiquement)
    // Dans Angular, après delete, le state local retire le fichier.
    cy.get('.ds-file-card').should('not.exist');
  });
});

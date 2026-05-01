import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { UserAvatarComponent } from '../../shared/user-avatar/user-avatar.component';

interface MockFile {
  id: string;
  name: string;
  expiresIn: string;
  isExpired: boolean;
  isImage: boolean;
}

@Component({
  selector: 'ds-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, UserAvatarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);

  protected mobileMenuOpen = false;
  protected currentTab: 'tous' | 'actifs' | 'expire' = 'tous';

  protected readonly mockFiles: MockFile[] = [
    {
      id: '1',
      name: 'IMG_9210_123123131313231.jpg',
      expiresIn: 'Expire dans 2 jours',
      isExpired: false,
      isImage: true
    },
    {
      id: '2',
      name: 'compo2.mp3',
      expiresIn: 'Expire demain',
      isExpired: false,
      isImage: false
    },
    {
      id: '3',
      name: 'vacances_ardeche.mp4',
      expiresIn: 'Expiré',
      isExpired: true,
      isImage: false
    }
  ];

  ngOnInit() {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
    }
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  protected setTab(tab: 'tous' | 'actifs' | 'expire'): void {
    this.currentTab = tab;
  }

  protected getUserName(): string {
    const user = this.auth.currentUser();
    // Default to 'Claire Marie' to match the design pixel perfect, 
    // since the auth only gives an email, we mock the name for the visual representation.
    if (user?.email === 'claire@example.com') return 'Claire Marie';
    return 'Claire Marie'; 
  }
}

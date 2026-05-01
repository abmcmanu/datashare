import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AvatarService } from '../../core/services/avatar.service';

/**
 * Avatar Gravatar de l'utilisateur courant.
 * Affiche un placeholder gris pendant le calcul du hash.
 */
@Component({
  selector: 'ds-user-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (url()) {
      <img class="ds-avatar"
           [src]="url()"
           [alt]="alt"
           [style.width.px]="size"
           [style.height.px]="size"
           [attr.referrerpolicy]="'no-referrer'">
    } @else {
      <span class="ds-avatar ds-avatar-placeholder"
            [style.width.px]="size"
            [style.height.px]="size"
            aria-hidden="true"></span>
    }
  `,
  styles: [`
    :host { display: inline-flex; }
    .ds-avatar {
      display: block;
      border-radius: 50%;
      object-fit: cover;
      background: #E5E1DC;
    }
    .ds-avatar-placeholder { background: #E5E1DC; }
  `]
})
export class UserAvatarComponent implements OnChanges {
  @Input({ required: true }) email!: string;
  @Input() size = 40;
  @Input() alt = 'Avatar utilisateur';

  protected readonly url = signal<string | null>(null);

  constructor(private readonly avatar: AvatarService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['email'] || changes['size']) {
      this.refresh();
    }
  }

  private async refresh(): Promise<void> {
    if (!this.email) {
      this.url.set(null);
      return;
    }
    const url = await this.avatar.urlFor(this.email, this.size * 2); // x2 pour le retina
    this.url.set(url);
  }
}

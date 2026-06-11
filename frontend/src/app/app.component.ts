import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarComponent],
  template: `
    <ng-container *ngIf="!inMeetingRoom(); else fullscreen">
      <div class="flex h-screen overflow-hidden bg-[#16181a]">
        <app-sidebar></app-sidebar>
        <main class="flex-1 overflow-y-auto">
          <router-outlet></router-outlet>
        </main>
      </div>
    </ng-container>
    <ng-template #fullscreen>
      <router-outlet></router-outlet>
    </ng-template>
  `,
})
export class AppComponent {
  private readonly router = inject(Router);

  readonly inMeetingRoom = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects.startsWith('/meeting/')),
    ),
    { initialValue: false },
  );
}

import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarComponent, RouterLink, RouterLinkActive],
  template: `
    <ng-container *ngIf="!inMeetingRoom(); else fullscreen">
      <div class="flex h-screen overflow-hidden bg-[#16181a]">
        <!-- Sidebar: solo visible en pantallas grandes (lg = 1024px+) -->
        <div class="hidden lg:flex">
          <app-sidebar></app-sidebar>
        </div>
        <!-- Contenido principal: padding inferior en móvil para la barra de nav -->
        <main class="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- Barra de navegación inferior (solo móvil, oculta en lg+) -->
      <nav class="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 flex items-center justify-around px-1 h-16"
           style="background:#16181a;">
        <a routerLink="/" [routerLinkActiveOptions]="{exact:true}" routerLinkActive="text-[#0055ff]"
           class="flex flex-col items-center gap-0.5 px-3 py-2 text-white/40 hover:text-white transition-colors min-w-[52px]">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          <span class="text-[9px] font-semibold">Inicio</span>
        </a>
        <a routerLink="/meetings" routerLinkActive="text-[#0055ff]"
           class="flex flex-col items-center gap-0.5 px-3 py-2 text-white/40 hover:text-white transition-colors min-w-[52px]">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1"/>
          </svg>
          <span class="text-[9px] font-semibold">Reuniones</span>
        </a>
        <a routerLink="/calendar" routerLinkActive="text-[#0055ff]"
           class="flex flex-col items-center gap-0.5 px-3 py-2 text-white/40 hover:text-white transition-colors min-w-[52px]">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span class="text-[9px] font-semibold">Calendario</span>
        </a>
        <a routerLink="/profile" routerLinkActive="text-[#0055ff]"
           class="flex flex-col items-center gap-0.5 px-3 py-2 text-white/40 hover:text-white transition-colors min-w-[52px]">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          <span class="text-[9px] font-semibold">Perfil</span>
        </a>
        <a routerLink="/settings" routerLinkActive="text-[#0055ff]"
           class="flex flex-col items-center gap-0.5 px-3 py-2 text-white/40 hover:text-white transition-colors min-w-[52px]">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <span class="text-[9px] font-semibold">Ajustes</span>
        </a>
      </nav>
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

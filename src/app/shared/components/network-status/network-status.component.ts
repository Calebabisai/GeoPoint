import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonChip, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudOfflineOutline,
  cloudDoneOutline,
  syncOutline,
} from 'ionicons/icons';
import { NetworkService, NetworkStatus } from '../../services/network.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Componente para mostrar el estado de la conexión de red
 * Muestra un chip cuando no hay conexión o cuando se está sincronizando
 */
@Component({
  selector: 'app-network-status',
  standalone: true,
  imports: [CommonModule, IonChip, IonIcon, IonLabel],
  template: `
    <ion-chip
      *ngIf="showStatus$ | async"
      [color]="(networkStatus$ | async)?.isOnline ? 'success' : 'danger'"
      class="network-status-chip"
    >
      <ion-icon
        [name]="
          (networkStatus$ | async)?.isOnline
            ? 'cloud-done-outline'
            : 'cloud-offline-outline'
        "
      ></ion-icon>
      <ion-label>
        {{ (networkStatus$ | async)?.isOnline ? 'Conectado' : 'Sin conexión' }}
        <span
          *ngIf="pendingOperations$ | async as pending"
          class="pending-count"
        >
          ({{ pending }} pendiente{{ pending > 1 ? 's' : '' }})
        </span>
      </ion-label>
    </ion-chip>
  `,
  styles: [
    `
      .network-status-chip {
        position: fixed;
        top: 60px;
        right: 10px;
        z-index: 9999;
        font-size: 0.8rem;
        animation: slideIn 0.3s ease-in-out;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .pending-count {
        margin-left: 4px;
        font-size: 0.75rem;
        opacity: 0.8;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .network-status-chip {
          top: 50px;
          right: 5px;
          font-size: 0.75rem;
        }
      }
    `,
  ],
})
export class NetworkStatusComponent {
  private networkService = inject(NetworkService);

  networkStatus$: Observable<NetworkStatus>;
  showStatus$: Observable<boolean>;
  pendingOperations$: Observable<number>;

  constructor() {
    addIcons({ cloudOfflineOutline, cloudDoneOutline, syncOutline });

    this.networkStatus$ = this.networkService.networkStatus$;

    // Mostrar el chip solo cuando NO hay conexión o hay operaciones pendientes
    this.showStatus$ = this.networkStatus$.pipe(
      map(
        (status) =>
          !status.isOnline ||
          this.networkService.getPendingOperationsCount() > 0
      )
    );

    // Observar cantidad de operaciones pendientes
    this.pendingOperations$ = this.networkStatus$.pipe(
      map(() => this.networkService.getPendingOperationsCount())
    );
  }
}

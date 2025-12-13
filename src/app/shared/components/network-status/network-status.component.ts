import { Component, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonChip, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudOfflineOutline,
  cloudDoneOutline,
  syncOutline,
} from 'ionicons/icons';
import { NetworkService } from '../../services/network.service';

/**
 * Componente para mostrar el estado de la conexión de red
 * Muestra un chip cuando no hay conexión o cuando se está sincronizando
 */
@Component({
  selector: 'app-network-status',
  standalone: true,
  imports: [CommonModule, IonChip, IonIcon, IonLabel],
  template: `
    @if (showStatus()) {
      <ion-chip
        [color]="isOnline() ? 'success' : 'danger'"
        class="network-status-chip"
      >
        <ion-icon
          [name]="isOnline() ? 'cloud-done-outline' : 'cloud-offline-outline'"
        ></ion-icon>
        <ion-label>
          {{ isOnline() ? 'Conectado' : 'Sin conexión' }}
          @if (pendingOperationsCount() > 0) {
            <span class="pending-count">
              ({{ pendingOperationsCount() }} pendiente{{
                pendingOperationsCount() > 1 ? 's' : ''
              }})
            </span>
          }
        </ion-label>
      </ion-chip>
    }
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

  // Computed signals derivados del servicio
  readonly isOnline = computed(() => this.networkService.isOnlineComputed());
  readonly pendingOperationsCount = computed(
    () => this.networkService.pendingOperationsCount()
  );

  // Mostrar chip solo cuando NO hay conexión o hay operaciones pendientes
  readonly showStatus = computed(
    () =>
      !this.networkService.isOnlineComputed() ||
      this.networkService.pendingOperationsCount() > 0
  );

  constructor() {
    addIcons({ cloudOfflineOutline, cloudDoneOutline, syncOutline });
  }
}

import { Component, inject, computed } from '@angular/core';
import { IonChip, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudOfflineOutline,
  cloudDoneOutline,
} from 'ionicons/icons';
import { NetworkService } from 'src/app/core/services/network.service';

@Component({
  selector: 'app-network-status',
  templateUrl: './network-status.component.html',
  styleUrls: ['./network-status.component.scss'],
  standalone: true,
  imports: [IonChip, IonIcon, IonLabel],
})
export class NetworkStatusComponent {
  private networkService = inject(NetworkService);

  readonly isOnline = computed(() => this.networkService.isOnlineComputed());
  readonly pendingOperationsCount = computed(
    () => this.networkService.pendingOperationsCount()
  );

  readonly showStatus = computed(
    () =>
      !this.networkService.isOnlineComputed() ||
      this.networkService.pendingOperationsCount() > 0
  );

  constructor() {
    addIcons({ cloudOfflineOutline, cloudDoneOutline });
  }
}

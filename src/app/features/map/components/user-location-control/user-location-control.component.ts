import { Component, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { locate, locateOutline, navigateCircle } from 'ionicons/icons';
import { GeolocationService } from '../../services/geolocation.service';
import { MapService } from '../../services/map.service';
import { UiService } from 'src/app/shared/utils/ui.service';
import { LocationTrackingMode } from '../../models/geolocation.model';

@Component({
  selector: 'app-user-location-control',
  standalone: true,
  templateUrl: './user-location-control.component.html',
  styleUrls: ['./user-location-control.component.scss'],
  imports: [
    IonButton,
    IonIcon,
    IonSpinner,
  ]
})
export class UserLocationControlComponent{
  //Injected Services
  readonly geolocationService = inject(GeolocationService);
  private readonly mapService = inject(MapService);
  private readonly uiService = inject(UiService);

  //Signals and Computed
  readonly isLoading = signal(false);
  readonly showAccuracy = signal(true);

  readonly isTracking = computed(() => this.geolocationService.isRealTimeTracking());
  
  readonly buttonColor = computed(() => {
    if (this.isTracking()) {
      return 'primary';
    }
    return 'light';
  });

  readonly iconName = computed(() => {
    if (this.isTracking()) {
      return 'navigate-circle';
    }
    return 'locate-outline';
  });

  constructor() {
    addIcons({ locate, locateOutline, navigateCircle });
  }

  async toggleTracking(): Promise<void> {
    if (this.isTracking()) {
      await this.stopTracking();
    } else {
      await this.startTracking();
    }
  }

  private async startTracking(): Promise<void> {
    this.isLoading.set(true);

    try {
      await this.geolocationService.startRealTimeTracking({
        mode: LocationTrackingMode.ACTIVE,
        updateInterval: 3000,
        showAccuracyCircle: true,
        centerMapOnUpdate: false,
        smoothTransition: true,
      });

      await this.uiService.showToast('Ubicación en tiempo real activada', 'success', 2000);
    } catch (error: any) {
      const errorMessage = this.getErrorMessage(error);
      await this.uiService.showError(errorMessage);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async stopTracking(): Promise<void> {
    this.isLoading.set(true);

    try {
      await this.geolocationService.stopRealTimeTracking();
    } catch (error) {
      await this.uiService.showError('Error al detener el seguimiento');
    } finally {
      this.isLoading.set(false);
    }
  }

  private getErrorMessage(error: any): string {
    if (error.message?.includes('permission')) {
      return 'Se requieren permisos de ubicación';
    }
    return 'Error al activar la ubicación en tiempo real';
  }

}

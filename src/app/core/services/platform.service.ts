import { Injectable, computed, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { Geolocation } from '@capacitor/geolocation';
import { Platform } from '@ionic/angular';
import { LoggerService } from './logger.service';

export interface DeviceInfo {
  platform: string;
  isNative: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  deviceId: string;
  model: string;
  operatingSystem: string;
  osVersion: string;
  manufacturer: string;
  isVirtual: boolean;
}

export interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

export interface GeolocationPosition {
  lat: number;
  lng: number;
}

@Injectable({
  providedIn: 'root',
})
export class MobilePlatformService {

  private readonly logger = inject(LoggerService);
  private readonly platform = inject(Platform);

  // Signals para estado reactivo
  private readonly _deviceInfo = signal<DeviceInfo | null>(null);
  private readonly _networkStatus = signal<NetworkStatus>({
    connected: true,
    connectionType: 'wifi',
  });
  private readonly _isInitialized = signal(false);
  private readonly _locationPermissionGranted = signal(false);

  // Computed signals (solo lectura)
  readonly deviceInfo = this._deviceInfo.asReadonly();
  readonly networkStatus = this._networkStatus.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();
  readonly locationPermissionGranted = this._locationPermissionGranted.asReadonly();

  // Computed derivados
  readonly isOnline = computed(() => this._networkStatus().connected);
  readonly isNative = computed(() => Capacitor.isNativePlatform());
  readonly isAndroid = computed(() => this.platform.is('android'));
  readonly isIOS = computed(() => this.platform.is('ios'));
  readonly connectionType = computed(() => this._networkStatus().connectionType);


  constructor() {
    this.initializePlatform();
  }

  /**
   * Inicializa configuraciones específicas de la plataforma
   */
  private async initializePlatform(): Promise<void> {
    try {
      await this.platform.ready();

      if (Capacitor.isNativePlatform()) {
        this.logger.log('Running on native platform');

        // Ejecutar configuraciones en paralelo cuando es posible
        await Promise.all([
          this.setupStatusBar(),
          this.hideSplashScreen(),
          this.loadDeviceInfo(),
        ]);

        // Estas dependen de permisos, se ejecutan secuencialmente
        await this.setupNetworkListeners();
        await this.requestLocationPermissions();
      } else {
        this.logger.log('Running on web platform');
        this.setWebDeviceInfo();
      }

      this._isInitialized.set(true);
    } catch (error) {
      this.logger.error('Error initializing platform:', error);
      this._isInitialized.set(true); // Marcamos como inicializado aunque haya error
    }
  }

  /**
   * Establece información del dispositivo para web
   */
  private setWebDeviceInfo(): void {
    this._deviceInfo.set({
      platform: 'web',
      isNative: false,
      isAndroid: false,
      isIOS: false,
      deviceId: 'web-browser',
      model: 'Browser',
      operatingSystem: 'web',
      osVersion: 'unknown',
      manufacturer: 'Browser',
      isVirtual: true,
    });
  }

  /**
   * Configura la barra de estado para móviles
   */
  private async setupStatusBar(): Promise<void> {
    try {
      const isIOS = this.platform.is('ios');
      const style = isIOS ? Style.Light : Style.Dark;
      
      await Promise.all([
        StatusBar.setStyle({ style }),
        StatusBar.setBackgroundColor({ color: '#1976d2' }),
      ]);
      
      this.logger.log(' Status bar configured');
    } catch (error) {
      this.logger.error('Error configuring status bar:', error);
    }
  }

  /**
   * Oculta la pantalla de splash
   */
  private async hideSplashScreen(): Promise<void> {
    try {
      await SplashScreen.hide();
      this.logger.log('Splash screen hidden');
    } catch (error) {
      this.logger.error('Error hiding splash screen:', error);
    }
  }

  /**
   * Carga información del dispositivo
   */
  private async loadDeviceInfo(): Promise<void> {
    try {
      const [info, deviceId] = await Promise.all([
        Device.getInfo(),
        this.getDeviceId(),
      ]);

      this._deviceInfo.set({
        platform: info.platform,
        isNative: Capacitor.isNativePlatform(),
        isAndroid: this.platform.is('android'),
        isIOS: this.platform.is('ios'),
        deviceId,
        model: info.model,
        operatingSystem: info.operatingSystem,
        osVersion: info.osVersion,
        manufacturer: info.manufacturer,
        isVirtual: info.isVirtual,
      });
      
      this.logger.log('Device info:', this._deviceInfo());
    } catch (error) {
      this.logger.error('Error getting device info:', error);
    }
  }

  /**
   * Obtiene el ID del dispositivo
   */
  private async getDeviceId(): Promise<string> {
    try {
      const { identifier } = await Device.getId();
      return identifier;
    } catch (error) {
      this.logger.error('Error getting device ID:', error);
      return 'unknown';
    }
  }

  /**
   * Configura listeners para el estado de la red
   */
  private async setupNetworkListeners(): Promise<void> {
    try {
      const status = await Network.getStatus();
      this._networkStatus.set({
        connected: status.connected,
        connectionType: status.connectionType,
      });

      Network.addListener('networkStatusChange', (status) => {
        this._networkStatus.set({
          connected: status.connected,
          connectionType: status.connectionType,
        });
        
        this.logger.log('Network status changed:', this._networkStatus());
        this.emitNetworkStatusEvent();
      });

      this.logger.log('Network listeners configured');
    } catch (error) {
      this.logger.error('Error setting up network listeners:', error);
    }
  }

  /**
   * Emite evento de cambio de estado de red
   */
  private emitNetworkStatusEvent(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('networkStatusChange', {
          detail: this._networkStatus(),
        })
      );
    }
  }

  /**
   * Solicita permisos de ubicación
   */
  private async requestLocationPermissions(): Promise<void> {
    try {
      const { location } = await Geolocation.requestPermissions();
      const granted = location === 'granted';
      
      this._locationPermissionGranted.set(granted);
      this.logger.log(`Location permissions ${granted ? 'granted' : 'denied'}`);
    } catch (error) {
      this.logger.error('Error requesting location permissions:', error);
      this._locationPermissionGranted.set(false);
    }
  }

  /**
   * Obtiene la ubicación actual del dispositivo
   */
  async getCurrentPosition(): Promise<GeolocationPosition | null> {
    try {
      const { coords } = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      return {
        lat: coords.latitude,
        lng: coords.longitude,
      };
    } catch (error) {
      this.logger.error('Error getting current position:', error);
      return null;
    }
  }

  /**
   * Configura el tema para modo oscuro/claro
   */
  async setTheme(isDark: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
      this.logger.log(`Theme set to: ${isDark ? 'dark' : 'light'}`);
    } catch (error) {
      this.logger.error('Error setting theme:', error);
    }
  }

  /**
   * Maneja la navegación back en Android
   */
  setupBackButtonHandler(callback: () => void): void {
    if (!this.platform.is('android')) return;

    document.addEventListener('ionBackButton', (event: Event) => {
      (event as CustomEvent).detail.register(10, callback);
    });
  }

  // ============================================
  // Métodos legacy para compatibilidad (deprecated)
  // ============================================
  
  /** @deprecated Usa el signal `isNative` en su lugar */
  isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** @deprecated Usa el signal `deviceInfo` en su lugar */
  getDeviceInfo(): DeviceInfo | null {
    return this._deviceInfo();
  }

  /** @deprecated Usa el signal `networkStatus` en su lugar */
  getNetworkStatus(): NetworkStatus {
    return this._networkStatus();
  }
}

import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { Geolocation } from '@capacitor/geolocation';
import { Platform } from '@ionic/angular';

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

@Injectable({
  providedIn: 'root',
})
export class MobilePlatformService {
  private deviceInfo: DeviceInfo | null = null;
  private networkStatus: NetworkStatus = {
    connected: true,
    connectionType: 'wifi',
  };

  constructor(private platform: Platform) {
    this.initializePlatform();
  }

  /**
   * Inicializa configuraciones específicas de la plataforma
   */
  private async initializePlatform(): Promise<void> {
    // Esperar a que la plataforma esté lista
    await this.platform.ready();

    if (Capacitor.isNativePlatform()) {
      console.log('🏃‍♂️ Running on native platform');

      // Configurar status bar
      await this.setupStatusBar();

      // Ocultar splash screen
      await this.hideSplashScreen();

      // Obtener información del dispositivo
      await this.getDeviceInformation();

      // Configurar listeners de red
      await this.setupNetworkListeners();

      // Solicitar permisos de ubicación
      await this.requestLocationPermissions();
    } else {
      console.log('🌐 Running on web platform');
      this.deviceInfo = {
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
      };
    }
  }

  /**
   * Configura la barra de estado para móviles
   */
  private async setupStatusBar(): Promise<void> {
    try {
      if (this.platform.is('ios')) {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#1976d2' });
      } else if (this.platform.is('android')) {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#1976d2' });
      }
      console.log('📱 Status bar configured');
    } catch (error) {
      console.error('❌ Error configuring status bar:', error);
    }
  }

  /**
   * Oculta la pantalla de splash
   */
  private async hideSplashScreen(): Promise<void> {
    try {
      await SplashScreen.hide();
      console.log('🚀 Splash screen hidden');
    } catch (error) {
      console.error('❌ Error hiding splash screen:', error);
    }
  }

  /**
   * Obtiene información del dispositivo
   */
  private async getDeviceInformation(): Promise<void> {
    try {
      const info = await Device.getInfo();
      this.deviceInfo = {
        platform: info.platform,
        isNative: Capacitor.isNativePlatform(),
        isAndroid: this.platform.is('android'),
        isIOS: this.platform.is('ios'),
        deviceId: await this.getDeviceId(),
        model: info.model,
        operatingSystem: info.operatingSystem,
        osVersion: info.osVersion,
        manufacturer: info.manufacturer,
        isVirtual: info.isVirtual,
      };
      console.log('📱 Device info:', this.deviceInfo);
    } catch (error) {
      console.error('❌ Error getting device info:', error);
    }
  }

  /**
   * Obtiene el ID del dispositivo
   */
  private async getDeviceId(): Promise<string> {
    try {
      const id = await Device.getId();
      return id.identifier;
    } catch (error) {
      console.error('❌ Error getting device ID:', error);
      return 'unknown';
    }
  }

  /**
   * Configura listeners para el estado de la red
   */
  private async setupNetworkListeners(): Promise<void> {
    try {
      // Estado inicial de la red
      const status = await Network.getStatus();
      this.networkStatus = {
        connected: status.connected,
        connectionType: status.connectionType,
      };

      // Listener para cambios en la red
      Network.addListener('networkStatusChange', (status) => {
        this.networkStatus = {
          connected: status.connected,
          connectionType: status.connectionType,
        };
        console.log('🌐 Network status changed:', this.networkStatus);

        // Emitir evento personalizado para que otros servicios puedan reaccionar
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('networkStatusChange', {
              detail: this.networkStatus,
            })
          );
        }
      });

      console.log('🌐 Network listeners configured');
    } catch (error) {
      console.error('❌ Error setting up network listeners:', error);
    }
  }

  /**
   * Solicita permisos de ubicación
   */
  private async requestLocationPermissions(): Promise<void> {
    try {
      const permissions = await Geolocation.requestPermissions();
      console.log('📍 Location permissions:', permissions);

      if (permissions.location === 'granted') {
        console.log('✅ Location permissions granted');
      } else {
        console.warn('⚠️ Location permissions denied');
      }
    } catch (error) {
      console.error('❌ Error requesting location permissions:', error);
    }
  }

  /**
   * Obtiene la ubicación actual del dispositivo
   */
  async getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (error) {
      console.error('❌ Error getting current position:', error);
      return null;
    }
  }

  /**
   * Verifica si la aplicación está ejecutándose en un dispositivo móvil nativo
   */
  isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Verifica si es Android
   */
  isAndroid(): boolean {
    return this.platform.is('android');
  }

  /**
   * Verifica si es iOS
   */
  isIOS(): boolean {
    return this.platform.is('ios');
  }

  /**
   * Obtiene información del dispositivo
   */
  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  /**
   * Obtiene el estado actual de la red
   */
  getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  /**
   * Verifica si hay conexión a internet
   */
  isOnline(): boolean {
    return this.networkStatus.connected;
  }

  /**
   * Configura el tema para modo oscuro/claro
   */
  async setTheme(isDark: boolean): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        const style = isDark ? Style.Dark : Style.Light;
        await StatusBar.setStyle({ style });
        console.log(`🎨 Theme set to: ${isDark ? 'dark' : 'light'}`);
      } catch (error) {
        console.error('❌ Error setting theme:', error);
      }
    }
  }

  /**
   * Maneja la navegación back en Android
   */
  setupBackButtonHandler(callback: () => void): void {
    if (this.isAndroid()) {
      document.addEventListener('ionBackButton', (event: any) => {
        event.detail.register(10, callback);
      });
    }
  }
}

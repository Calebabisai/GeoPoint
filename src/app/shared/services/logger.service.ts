import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Servicio de logging condicional para evitar logs en producción
 * que puedan exponer información sensible
 */
@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private isProduction = environment.production;

  /**
   * Log normal - solo en desarrollo
   */
  log(...args: any[]): void {
    if (!this.isProduction) {
      console.log(...args);
    }
  }

  /**
   * Log de información - solo en desarrollo
   */
  info(...args: any[]): void {
    if (!this.isProduction) {
      console.info(...args);
    }
  }

  /**
   * Log de advertencia - siempre se muestra
   */
  warn(...args: any[]): void {
    console.warn(...args);
  }

  /**
   * Log de error - siempre se muestra
   */
  error(...args: any[]): void {
    console.error(...args);
  }

  /**
   * Log de debug con prefijo - solo en desarrollo
   */
  debug(context: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.log(`[DEBUG - ${context}]`, ...args);
    }
  }

  /**
   * Log de operaciones de Firebase - solo en desarrollo
   */
  firebase(operation: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.log(`🔥 [Firebase - ${operation}]`, ...args);
    }
  }

  /**
   * Log de autenticación - solo en desarrollo
   */
  auth(operation: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.log(`🔐 [Auth - ${operation}]`, ...args);
    }
  }

  /**
   * Log de geolocalización - solo en desarrollo
   */
  geo(operation: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.log(`📍 [Geo - ${operation}]`, ...args);
    }
  }

  /**
   * Log de mapa - solo en desarrollo
   */
  map(operation: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.log(`🗺️ [Map - ${operation}]`, ...args);
    }
  }

  /**
   * Log de organización - solo en desarrollo
   */
  org(operation: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.log(`🏢 [Org - ${operation}]`, ...args);
    }
  }

  /**
   * Agrupa logs - solo en desarrollo
   */
  group(label: string, collapsed: boolean = false): void {
    if (!this.isProduction) {
      if (collapsed) {
        console.groupCollapsed(label);
      } else {
        console.group(label);
      }
    }
  }

  /**
   * Cierra grupo de logs
   */
  groupEnd(): void {
    if (!this.isProduction) {
      console.groupEnd();
    }
  }

  /**
   * Mide tiempo de ejecución - solo en desarrollo
   */
  time(label: string): void {
    if (!this.isProduction) {
      console.time(label);
    }
  }

  /**
   * Finaliza medición de tiempo
   */
  timeEnd(label: string): void {
    if (!this.isProduction) {
      console.timeEnd(label);
    }
  }

  /**
   * Log de tabla - solo en desarrollo
   */
  table(data: any): void {
    if (!this.isProduction) {
      console.table(data);
    }
  }
}

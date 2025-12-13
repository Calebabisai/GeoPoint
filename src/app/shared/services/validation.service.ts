import { Injectable, signal, computed } from '@angular/core';

/**
 * Servicio de validación centralizado para inputs del usuario
 * Previene XSS, SQL injection y datos malformados
 */
@Injectable({
  providedIn: 'root',
})
export class ValidationService {
  // Signals para tracking de validaciones
  private lastValidationErrorSignal = signal<string | null>(null);
  private validationHistorySignal = signal<string[]>([]);

  // Readonly exports
  readonly lastValidationError = this.lastValidationErrorSignal.asReadonly();
  readonly validationHistory = this.validationHistorySignal.asReadonly();

  // Computed signals
  readonly hasValidationErrors = computed(
    () => this.lastValidationErrorSignal() !== null
  );
  readonly validationErrorCount = computed(
    () => this.validationHistorySignal().length
  );

  /**
   * Valida y sanitiza un título
   */
  validateTitle(title: string | undefined | null): {
    valid: boolean;
    error?: string;
    sanitized?: string;
  } {
    if (!title || !title.trim()) {
      const error = 'El título es requerido';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    const trimmed = title.trim();

    if (trimmed.length < 3) {
      const error = 'El título debe tener al menos 3 caracteres';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (trimmed.length > 100) {
      const error = 'El título no puede exceder 100 caracteres';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    const sanitized = this.sanitizeString(trimmed);
    return { valid: true, sanitized };
  }

  /**
   * Valida y sanitiza una descripción
   */
  validateDescription(
    description: string | undefined | null,
    required: boolean = false
  ): { valid: boolean; error?: string; sanitized?: string } {
    if (!description || !description.trim()) {
      if (required) {
        const error = 'La descripción es requerida';
        this.recordValidationError(error);
        return { valid: false, error };
      }
      return { valid: true, sanitized: '' };
    }

    const trimmed = description.trim();

    if (trimmed.length > 500) {
      const error = 'La descripción no puede exceder 500 caracteres';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    const sanitized = this.sanitizeString(trimmed);
    return { valid: true, sanitized };
  }

  /**
   * Valida un email
   */
  validateEmail(email: string | undefined | null): {
    valid: boolean;
    error?: string;
    sanitized?: string;
  } {
    if (!email || !email.trim()) {
      const error = 'El email es requerido';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
      const error = 'Email inválido';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (trimmed.length > 254) {
      const error = 'Email demasiado largo';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    return { valid: true, sanitized: trimmed };
  }

  /**
   * Valida un número (para zonas, marcadores, etc.)
   */
  validateNumber(
    num: number | undefined | null,
    min: number = 1,
    max: number = 9999
  ): { valid: boolean; error?: string; value?: number } {
    if (num === undefined || num === null) {
      const error = 'El número es requerido';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (isNaN(num)) {
      const error = 'Debe ser un número válido';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (num < min) {
      const error = `El número debe ser al menos ${min}`;
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (num > max) {
      const error = `El número no puede exceder ${max}`;
      this.recordValidationError(error);
      return { valid: false, error };
    }

    return { valid: true, value: num };
  }

  /**
   * Valida coordenadas geográficas
   */
  validateCoordinates(
    lat: number,
    lng: number
  ): {
    valid: boolean;
    error?: string;
  } {
    if (lat === undefined || lat === null || isNaN(lat)) {
      const error = 'Latitud inválida';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (lng === undefined || lng === null || isNaN(lng)) {
      const error = 'Longitud inválida';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (lat < -90 || lat > 90) {
      const error = 'Latitud debe estar entre -90 y 90';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (lng < -180 || lng > 180) {
      const error = 'Longitud debe estar entre -180 y 180';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (lat === 0 && lng === 0) {
      const error = 'Las coordenadas no pueden ser ambas cero';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    return { valid: true };
  }

  /**
   * Valida un color hexadecimal
   */
  validateColor(color: string | undefined | null): {
    valid: boolean;
    error?: string;
    sanitized?: string;
  } {
    if (!color || !color.trim()) {
      const error = 'El color es requerido';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    const trimmed = color.trim().toUpperCase();
    const hexRegex = /^#([A-F0-9]{3}|[A-F0-9]{6})$/i;

    if (!hexRegex.test(trimmed)) {
      const error = 'Color inválido (usa formato #RRGGBB)';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    return { valid: true, sanitized: trimmed };
  }

  /**
   * Valida un array de coordenadas (para zonas)
   */
  validateCoordinatesArray(
    coordinates: any[],
    minPoints: number = 3
  ): { valid: boolean; error?: string } {
    if (!Array.isArray(coordinates)) {
      const error = 'Las coordenadas deben ser un array';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (coordinates.length < minPoints) {
      const error = `Se requieren al menos ${minPoints} puntos`;
      this.recordValidationError(error);
      return { valid: false, error };
    }

    for (let i = 0; i < coordinates.length; i++) {
      const point = coordinates[i];
      let lat: number, lng: number;

      if (Array.isArray(point)) {
        [lat, lng] = point;
      } else if (point && typeof point === 'object') {
        lat = point.lat;
        lng = point.lng;
      } else {
        const error = `Punto ${i + 1} tiene formato inválido`;
        this.recordValidationError(error);
        return { valid: false, error };
      }

      const coordValidation = this.validateCoordinates(lat, lng);
      if (!coordValidation.valid) {
        const error = `Punto ${i + 1}: ${coordValidation.error}`;
        this.recordValidationError(error);
        return { valid: false, error };
      }
    }

    return { valid: true };
  }

  /**
   * Valida una contraseña
   */
  validatePassword(password: string | undefined | null): {
    valid: boolean;
    error?: string;
  } {
    if (!password) {
      const error = 'La contraseña es requerida';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (password.length < 6) {
      const error = 'La contraseña debe tener al menos 6 caracteres';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    if (password.length > 128) {
      const error = 'La contraseña es demasiado larga';
      this.recordValidationError(error);
      return { valid: false, error };
    }

    return { valid: true };
  }

  /**
   * Sanitiza un string para prevenir XSS
   */
  private sanitizeString(str: string): string {
    if (!str) return '';

    let sanitized = str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    sanitized = sanitized.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ''
    );

    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

    return sanitized.trim();
  }

  /**
   * Valida múltiples campos de un formulario de marcador
   */
  validateMarkerForm(marker: {
    title?: string;
    description?: string;
    lat?: number;
    lng?: number;
    color?: string;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const titleValidation = this.validateTitle(marker.title);
    if (!titleValidation.valid) {
      errors.push(titleValidation.error!);
    }

    const descValidation = this.validateDescription(marker.description, false);
    if (!descValidation.valid) {
      errors.push(descValidation.error!);
    }

    if (marker.lat !== undefined && marker.lng !== undefined) {
      const coordValidation = this.validateCoordinates(
        marker.lat,
        marker.lng
      );
      if (!coordValidation.valid) {
        errors.push(coordValidation.error!);
      }
    } else {
      errors.push('Selecciona una ubicación en el mapa');
    }

    if (marker.color) {
      const colorValidation = this.validateColor(marker.color);
      if (!colorValidation.valid) {
        errors.push(colorValidation.error!);
      }
    }

    if (errors.length > 0) {
      this.lastValidationErrorSignal.set(errors[0]);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida múltiples campos de un formulario de zona
   */
  validateZoneForm(zone: {
    name?: string;
    description?: string;
    coordinates?: any[];
    color?: string;
    number?: number;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const nameValidation = this.validateTitle(zone.name);
    if (!nameValidation.valid) {
      errors.push(nameValidation.error!);
    }

    const descValidation = this.validateDescription(zone.description, false);
    if (!descValidation.valid) {
      errors.push(descValidation.error!);
    }

    if (zone.coordinates) {
      const coordsValidation = this.validateCoordinatesArray(
        zone.coordinates,
        3
      );
      if (!coordsValidation.valid) {
        errors.push(coordsValidation.error!);
      }
    } else {
      errors.push('Define al menos 3 puntos en el mapa');
    }

    if (zone.color) {
      const colorValidation = this.validateColor(zone.color);
      if (!colorValidation.valid) {
        errors.push(colorValidation.error!);
      }
    }

    if (zone.number !== undefined) {
      const numberValidation = this.validateNumber(zone.number, 1, 9999);
      if (!numberValidation.valid) {
        errors.push(numberValidation.error!);
      }
    }

    if (errors.length > 0) {
      this.lastValidationErrorSignal.set(errors[0]);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Registra un error de validación en el historial
   */
  private recordValidationError(error: string): void {
    this.lastValidationErrorSignal.set(error);
    this.validationHistorySignal.update((history) => [
      ...history.slice(-9),
      error,
    ]);
  }

  /**
   * Limpia los errores de validación
   */
  clearValidationErrors(): void {
    this.lastValidationErrorSignal.set(null);
  }

  /**
   * Limpia el historial de validaciones
   */
  clearValidationHistory(): void {
    this.validationHistorySignal.set([]);
  }
}

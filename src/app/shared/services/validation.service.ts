import { Injectable } from '@angular/core';

/**
 * Servicio de validación centralizado para inputs del usuario
 * Previene XSS, SQL injection y datos malformados
 */
@Injectable({
  providedIn: 'root',
})
export class ValidationService {
  /**
   * Valida y sanitiza un título
   */
  validateTitle(title: string | undefined | null): {
    valid: boolean;
    error?: string;
    sanitized?: string;
  } {
    if (!title || !title.trim()) {
      return { valid: false, error: 'El título es requerido' };
    }

    const trimmed = title.trim();

    if (trimmed.length < 3) {
      return {
        valid: false,
        error: 'El título debe tener al menos 3 caracteres',
      };
    }

    if (trimmed.length > 100) {
      return {
        valid: false,
        error: 'El título no puede exceder 100 caracteres',
      };
    }

    // Sanitizar caracteres especiales peligrosos
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
        return { valid: false, error: 'La descripción es requerida' };
      }
      return { valid: true, sanitized: '' };
    }

    const trimmed = description.trim();

    if (trimmed.length > 500) {
      return {
        valid: false,
        error: 'La descripción no puede exceder 500 caracteres',
      };
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
      return { valid: false, error: 'El email es requerido' };
    }

    const trimmed = email.trim().toLowerCase();

    // Regex simple pero efectiva para emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Email inválido' };
    }

    if (trimmed.length > 254) {
      // Límite estándar de email
      return { valid: false, error: 'Email demasiado largo' };
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
      return { valid: false, error: 'El número es requerido' };
    }

    if (isNaN(num)) {
      return { valid: false, error: 'Debe ser un número válido' };
    }

    if (num < min) {
      return { valid: false, error: `El número debe ser al menos ${min}` };
    }

    if (num > max) {
      return { valid: false, error: `El número no puede exceder ${max}` };
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
      return { valid: false, error: 'Latitud inválida' };
    }

    if (lng === undefined || lng === null || isNaN(lng)) {
      return { valid: false, error: 'Longitud inválida' };
    }

    if (lat < -90 || lat > 90) {
      return { valid: false, error: 'Latitud debe estar entre -90 y 90' };
    }

    if (lng < -180 || lng > 180) {
      return { valid: false, error: 'Longitud debe estar entre -180 y 180' };
    }

    if (lat === 0 && lng === 0) {
      return {
        valid: false,
        error: 'Las coordenadas no pueden ser ambas cero',
      };
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
      return { valid: false, error: 'El color es requerido' };
    }

    const trimmed = color.trim().toUpperCase();

    // Validar formato hexadecimal (#RGB o #RRGGBB)
    const hexRegex = /^#([A-F0-9]{3}|[A-F0-9]{6})$/i;

    if (!hexRegex.test(trimmed)) {
      return {
        valid: false,
        error: 'Color inválido (usa formato #RRGGBB)',
      };
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
      return { valid: false, error: 'Las coordenadas deben ser un array' };
    }

    if (coordinates.length < minPoints) {
      return {
        valid: false,
        error: `Se requieren al menos ${minPoints} puntos`,
      };
    }

    // Validar cada punto
    for (let i = 0; i < coordinates.length; i++) {
      const point = coordinates[i];

      let lat: number, lng: number;

      // Soportar diferentes formatos: [lat, lng] o {lat, lng}
      if (Array.isArray(point)) {
        [lat, lng] = point;
      } else if (point && typeof point === 'object') {
        lat = point.lat;
        lng = point.lng;
      } else {
        return {
          valid: false,
          error: `Punto ${i + 1} tiene formato inválido`,
        };
      }

      const coordValidation = this.validateCoordinates(lat, lng);
      if (!coordValidation.valid) {
        return {
          valid: false,
          error: `Punto ${i + 1}: ${coordValidation.error}`,
        };
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
      return { valid: false, error: 'La contraseña es requerida' };
    }

    if (password.length < 6) {
      return {
        valid: false,
        error: 'La contraseña debe tener al menos 6 caracteres',
      };
    }

    if (password.length > 128) {
      return {
        valid: false,
        error: 'La contraseña es demasiado larga',
      };
    }

    // Opcional: Validar complejidad
    // const hasUpperCase = /[A-Z]/.test(password);
    // const hasLowerCase = /[a-z]/.test(password);
    // const hasNumber = /[0-9]/.test(password);
    //
    // if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    //   return {
    //     valid: false,
    //     error: 'La contraseña debe contener mayúsculas, minúsculas y números'
    //   };
    // }

    return { valid: true };
  }

  /**
   * Sanitiza un string para prevenir XSS
   */
  private sanitizeString(str: string): string {
    if (!str) return '';

    // Remover caracteres peligrosos
    let sanitized = str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // Remover scripts potenciales
    sanitized = sanitized.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ''
    );

    // Remover event handlers
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
      const coordValidation = this.validateCoordinates(marker.lat, marker.lng);
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

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

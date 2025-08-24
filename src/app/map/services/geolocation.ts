import { Injectable } from '@angular/core';
import { Observable, from, interval, Subscription, of } from 'rxjs';
import { map, startWith, catchError } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface Coords {
  lat: number;
  lng: number;
}

@Injectable({
  providedIn: 'root',
})
export class GeolocationService {
  private watchId: string | null = null;
  private watchSubscription: Subscription | null = null;

  constructor() {}

  getCurrentLocation(): Observable<Coords | null> {
    return from(Geolocation.getCurrentPosition()).pipe(
      map((position) => {
        if (position && position.coords) {
          return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        }
        return null;
      }),
      catchError((error) => {
        console.error('Error obteniendo la ubicación actual:', error);
        return of(null);
      })
    );
  }

  startWatching(): Promise<void> {
    return new Promise((resolve, reject) => {
      // watchPosition puede devolver un id que no es string en todas las plataformas;
      // lo guardamos como any para evitar errores de tipos en este stub
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.watchId = (Geolocation as any).watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        },
        (position: any, err: any) => {
          if (err) {
            console.error('Error en el seguimiento de geolocalización:', err);
            reject(err);
          } else {
            const coords = position
              ? {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                }
              : null;
            // Aquí puedes emitir los cambios a un BehaviorSubject o un EventEmitter si quieres
            // Por simplicidad, este método solo inicia la observación.
            if (coords) {
              console.log('Nueva ubicación:', coords);
            }
          }
        }
      );
      resolve();
    });
  }

  stopWatching() {
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }
  }
}

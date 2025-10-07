export interface User {
  uid: string;
  email: string | null;
  displayName?: string; // Nombre completo del usuario
  firstName?: string; // Nombre (opcional para compatibilidad)
  lastName?: string; // Apellido (opcional para compatibilidad)
  role: 'admin' | 'user';
  organizationId?: string; // ID de la organización a la que pertenece
  organizationRole?: 'owner' | 'admin' | 'moderator' | 'user'; // Rol dentro de la organización
  createdAt: Date;
}

// Función utilitaria para obtener el nombre a mostrar
export function getUserDisplayName(user: User | null): string {
  if (!user) return 'Usuario';

  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }

  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario';
  }

  return user.email?.split('@')[0] || 'Usuario';
}

// Función utilitaria para obtener el nombre corto (primera palabra)
export function getUserShortName(user: User | null): string {
  if (!user) return 'U';

  const fullName = getUserDisplayName(user);
  const firstWord = fullName.split(' ')[0];

  return firstWord.charAt(0).toUpperCase() || 'U';
}

// Función utilitaria para obtener las iniciales del usuario
export function getUserInitials(user: User | null): string {
  if (!user) return 'U';

  const fullName = getUserDisplayName(user);
  const words = fullName.split(' ').filter((word) => word.length > 0);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  } else if (words.length === 1) {
    return words[0][0].toUpperCase();
  } else {
    return 'U';
  }
}

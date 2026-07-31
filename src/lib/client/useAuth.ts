'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

export interface MeUser {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'STUDENT';
  academicYear: string | null;
  schoolDisplay: string | null;
  board: { id: string; name: string; code: string } | null;
  class: { id: string; name: string; level: number } | null;
}

/** Load the current user (or null if not signed in). */
export function useMe() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .get<{ user: MeUser }>('/api/auth/me')
      .then((d) => alive && setUser(d.user))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { user, loading };
}

export async function logout() {
  try {
    await api.post('/api/auth/logout');
  } finally {
    window.location.href = '/login';
  }
}

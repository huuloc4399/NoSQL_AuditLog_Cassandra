import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserRole, UserSession } from '../types';
import { authApi } from '../services/api';
import { DEMO_MODE } from '../config/api';

interface AuthContextType { user: UserSession | null; token: string | null; role: UserRole; loading: boolean; isAuthenticated: boolean; isAdmin: boolean; login: (token: string, user: UserSession) => void; logout: () => Promise<void>; refreshUser: () => Promise<void> }
const AuthContext = createContext<AuthContextType | undefined>(undefined);
const MODE = DEMO_MODE ? 'demo' : 'api';
const clearSession = () => ['audit_auth_token', 'audit_username', 'audit_user_role', 'audit_user_data', 'audit_session_mode'].forEach(key => localStorage.removeItem(key));
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('audit_session_mode') === MODE ? localStorage.getItem('audit_auth_token') : null);
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const role: UserRole = user?.role === 'ADMIN' ? 'ADMIN' : 'USER';
  const login = (newToken: string, newUser: UserSession) => { localStorage.setItem('audit_session_mode', MODE); localStorage.setItem('audit_auth_token', newToken); setToken(newToken); setUser(newUser); };
  const logout = async () => { try { if (token) await authApi.logout(); } catch { /* Always end the local session if the API is unavailable. */ } finally { clearSession(); setToken(null); setUser(null); } };
  const refreshUser = async () => { try { const res = await authApi.getMe(); if (!res.data?.user) throw new Error('Invalid session'); setUser(res.data.user); } catch { clearSession(); setToken(null); setUser(null); } };
  useEffect(() => { let active = true; if (!token) { clearSession(); setLoading(false); return; } setLoading(true); authApi.getMe().then(res => { if (active) { if (!res.data?.user) throw new Error('Invalid session'); setUser(res.data.user); } }).catch(() => { if (active) { clearSession(); setToken(null); setUser(null); } }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [token]);
  return <AuthContext.Provider value={{ user, token, role, loading, isAuthenticated: !!token && !!user, isAdmin: role === 'ADMIN', login, logout, refreshUser }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is required'); return value; };

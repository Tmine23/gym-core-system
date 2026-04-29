"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthUser = {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  ci: string;
  rol_id: number;
  sucursal_id: number;
  rol: {
    nombre: string;
    permiso_ver_finanzas: boolean;
    permiso_editar_usuarios: boolean;
    permiso_gestionar_asistencias: boolean;
  };
  sucursal: {
    nombre: string;
    ciudad: string;
  };
};

export type SucursalOption = {
  id: number;
  nombre: string;
  ciudad: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  /** Active sucursal ID for data filtering. null = all sucursales (Admin only). */
  activeSucursalId: number | null;
  setActiveSucursalId: (id: number | null) => void;
  /** List of all active sucursales (loaded for Admin role). */
  sucursales: SucursalOption[];
  /** Whether the current user can see all sucursales. */
  isAdmin: boolean;
};

const SESSION_KEY = "gym_session";
const ACTIVE_SUC_KEY = "gym_active_sucursal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSucursalId, setActiveSucursalIdState] = useState<number | null>(null);
  const [sucursales, setSucursales] = useState<SucursalOption[]>([]);
  const router = useRouter();

  const isAdmin = user?.rol?.nombre === "Admin";

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser;
        setUser(parsed);
        // Restore active sucursal preference
        const savedSuc = localStorage.getItem(ACTIVE_SUC_KEY);
        if (savedSuc === "all") {
          setActiveSucursalIdState(null);
        } else if (savedSuc) {
          setActiveSucursalIdState(Number(savedSuc));
        } else {
          setActiveSucursalIdState(parsed.sucursal_id);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(ACTIVE_SUC_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load sucursales list for Admin
  useEffect(() => {
    if (!user) return;
    if (user.rol?.nombre === "Admin") {
      supabase.from("sucursales").select("id, nombre, ciudad").eq("esta_activa", true).order("nombre").then(({ data }) => {
        setSucursales((data ?? []) as SucursalOption[]);
      });
    }
  }, [user]);

  const setActiveSucursalId = useCallback((id: number | null) => {
    setActiveSucursalIdState(id);
    localStorage.setItem(ACTIVE_SUC_KEY, id === null ? "all" : String(id));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const hashedPassword = await hashPassword(password);

      const { data, error } = await supabase
        .from("empleados")
        .select("id, nombre, apellido, email, ci, rol_id, sucursal_id, roles(nombre, permiso_ver_finanzas, permiso_editar_usuarios, permiso_gestionar_asistencias), sucursales(nombre, ciudad)")
        .eq("email", email)
        .eq("password_hash", hashedPassword)
        .eq("es_activo", true)
        .single();

      if (error || !data) {
        return { success: false, error: "Credenciales incorrectas" };
      }

      // Build the user object
      const authUser: AuthUser = {
        id: data.id,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        ci: data.ci,
        rol_id: data.rol_id,
        sucursal_id: data.sucursal_id,
        rol: data.roles as unknown as AuthUser["rol"],
        sucursal: data.sucursales as unknown as AuthUser["sucursal"],
      };

      // Store session
      localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
      setUser(authUser);
      setActiveSucursalIdState(authUser.sucursal_id);
      localStorage.setItem(ACTIVE_SUC_KEY, String(authUser.sucursal_id));

      // Update ultimo_login
      await supabase
        .from("empleados")
        .update({ ultimo_login: new Date().toISOString() })
        .eq("id", authUser.id);

      return { success: true };
    } catch {
      return { success: false, error: "Error de conexión" };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACTIVE_SUC_KEY);
    setUser(null);
    setActiveSucursalIdState(null);
    setSucursales([]);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, activeSucursalId, setActiveSucursalId, sucursales, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

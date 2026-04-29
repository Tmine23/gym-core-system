"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { SidebarNav } from "./SidebarNav";
import { useAuth } from "@/lib/auth";

function MenuIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
}
function XIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function LogoutIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout, isAdmin, sucursales, activeSucursalId, setActiveSucursalId } = useAuth();

  // Cerrar sidebar al navegar en móvil
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      {/* Botón hamburguesa — solo móvil */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e293b] bg-[#020617] text-slate-400 hover:text-slate-100 md:hidden"
        aria-label="Abrir menú"
      >
        <MenuIcon />
      </button>

      {/* Overlay móvil */}
      {open && (
        <button
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      {/* Sidebar */}
      <aside className={[
        "fixed inset-y-0 left-0 z-50 w-72 shrink-0 border-r border-[#1e293b] bg-[#020617] transition-transform duration-200 md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-5 py-5 border-b border-[#1e293b]">
            <div>
              <div className="section-kicker">Body Xtreme</div>
              <Link href="/" className="mt-1 block text-xl font-bold tracking-tight text-slate-100">
                Gym OS
              </Link>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100 md:hidden"
              aria-label="Cerrar menú"
            >
              <XIcon />
            </button>
          </div>

          {/* Sucursal selector — Admin only */}
          {isAdmin && sucursales.length > 0 && (
            <div className="px-4 py-3 border-b border-[#1e293b]">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5">Sucursal activa</p>
              <select
                value={activeSucursalId === null ? "all" : String(activeSucursalId)}
                onChange={(e) => setActiveSucursalId(e.target.value === "all" ? null : Number(e.target.value))}
                className="w-full appearance-none rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2 text-xs font-medium text-slate-200 outline-none transition-colors focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20"
              >
                <option value="all">🌐 Todas las sucursales</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>📍 {s.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 px-3 py-4 overflow-y-auto">
            <SidebarNav />
          </div>

          {/* User info + logout */}
          {user && (
            <div className="border-t border-[#1e293b] px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-green/15 text-brand-green text-sm font-bold shrink-0">
                  {user.nombre.charAt(0)}{user.apellido.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {user.nombre} {user.apellido}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {user.rol.nombre}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#1e293b] bg-white/5 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400"
              >
                <LogoutIcon />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

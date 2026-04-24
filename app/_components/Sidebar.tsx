"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { SidebarNav } from "./SidebarNav";

function MenuIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
}
function XIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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

          <div className="flex-1 px-3 py-4 overflow-y-auto">
            <SidebarNav />
          </div>
        </div>
      </aside>
    </>
  );
}

"use client";

import { useAuth } from "@/lib/auth";
import { useState, useRef, useEffect } from "react";

type Props = {
  value: number | null;
  onChange: (id: number | null) => void;
  /** If true, shows "Todas las sucursales" option. Default true. */
  allowAll?: boolean;
};

function MapPinIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>;
}
function ChevronIcon({ open }: { open: boolean }) {
  return <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>;
}
function CheckIcon() {
  return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>;
}
function GlobeIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></svg>;
}

export function SucursalSelector({ value, onChange, allowAll = true }: Props) {
  const { isAdmin, sucursales } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Non-admin users don't see the selector
  if (!isAdmin) return null;
  if (sucursales.length === 0) return null;

  const selected = value === null
    ? { label: "Todas las sucursales", icon: "globe" as const }
    : { label: sucursales.find((s) => s.id === value)?.nombre ?? "Sucursal", icon: "pin" as const };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={[
          "flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all",
          value === null
            ? "border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/15"
            : "border-brand-green/30 bg-brand-green/10 text-brand-green hover:bg-brand-green/15",
        ].join(" ")}
      >
        {selected.icon === "globe" ? <GlobeIcon /> : <MapPinIcon />}
        <span className="max-w-[180px] truncate">{selected.label}</span>
        <ChevronIcon open={open} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-[#1e293b] bg-[#0b1220] shadow-2xl overflow-hidden"
          style={{ animation: "fadeIn 0.15s ease-out" }}>
          <div className="px-4 py-3 border-b border-[#1e293b]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Seleccionar sucursal</p>
          </div>
          <div className="py-1.5 max-h-64 overflow-y-auto">
            {allowAll && (
              <button
                onClick={() => { onChange(null); setOpen(false); }}
                className={[
                  "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                  value === null ? "bg-sky-500/10 text-sky-400" : "text-slate-300 hover:bg-white/5",
                ].join(" ")}
              >
                <GlobeIcon />
                <span className="flex-1 text-left font-medium">Todas las sucursales</span>
                {value === null && <CheckIcon />}
              </button>
            )}
            {sucursales.map((s) => (
              <button
                key={s.id}
                onClick={() => { onChange(s.id); setOpen(false); }}
                className={[
                  "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                  value === s.id ? "bg-brand-green/10 text-brand-green" : "text-slate-300 hover:bg-white/5",
                ].join(" ")}
              >
                <MapPinIcon />
                <div className="flex-1 text-left">
                  <span className="font-medium">{s.nombre}</span>
                  <span className="ml-2 text-xs text-slate-500">{s.ciudad}</span>
                </div>
                {value === s.id && <CheckIcon />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";

const SUCURSAL_ID_DEFAULT = 1; // fallback when user is null

type EstadoCasillero = "LIBRE" | "OCUPADO" | "MANTENIMIENTO";

type Casillero = {
  id: number;
  sucursal_id: number;
  identificador_visual: string;
  estado: EstadoCasillero;
};

type Sucursal = {
  id: number;
  nombre: string;
};

function inicial(nombre: string): string {
  // Extrae la parte después del guión si existe: "Body Xtreme Gym - Central" → "Central" → "C"
  const partes = nombre.split("-");
  const parte = partes[partes.length - 1].trim();
  return parte[0]?.toUpperCase() ?? nombre[0]?.toUpperCase() ?? "X";
}

function estadoConfig(estado: EstadoCasillero) {
  switch (estado) {
    case "LIBRE":
      return {
        label: "Libre",
        dot: "bg-brand-green",
        badge: "border-brand-green/30 bg-brand-green/10 text-brand-green",
        card: "border-brand-green/20 bg-brand-green/5",
        text: "text-brand-green",
      };
    case "OCUPADO":
      return {
        label: "Ocupado",
        dot: "bg-amber-400",
        badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
        card: "border-amber-400/20 bg-amber-400/5",
        text: "text-amber-300",
      };
    case "MANTENIMIENTO":
      return {
        label: "Mantenimiento",
        dot: "bg-slate-500",
        badge: "border-slate-500/30 bg-slate-500/10 text-slate-400",
        card: "border-[#1e293b] bg-white/3",
        text: "text-slate-400",
      };
  }
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function Toast({ open, message, onClose }: { open: boolean; message: string; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, [open, onClose]);
  return (
    <div className={["fixed right-4 top-4 z-[60] transition-all duration-200 transform-gpu", open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"].join(" ")}>
      <div className="flex items-center gap-3 rounded-2xl border border-brand-green/25 bg-[#0b1220] px-4 py-3 shadow-[0_10px_35px_rgba(0,0,0,0.55)]">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-green/10 text-brand-green">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <span className="text-sm font-semibold text-slate-100">{message}</span>
        <button onClick={onClose} className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100">
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function CasillerosPage() {
  const { user } = useAuth();
  const [casilleros, setCasilleros] = useState<Casillero[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSucursal, setFilterSucursal] = useState<number | "all">("all");
  const [filterEstado, setFilterEstado] = useState<EstadoCasillero | "all">("all");
  const [toast, setToast] = useState({ open: false, message: "" });

  // Modal agregar en lote
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAnim, setModalAnim] = useState<"enter" | "leave">("enter");
  const [loteCount, setLoteCount] = useState("10");
  const [loteSucursalId, setLoteSucursalId] = useState<number>(user?.sucursal_id ?? SUCURSAL_ID_DEFAULT);
  const [loteLoading, setLoteLoading] = useState(false);

  // Selección múltiple
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Reset modal
  const [resetModal, setResetModal] = useState(false);
  const [resetAnim, setResetAnim] = useState<"enter" | "leave">("enter");
  const [resetSucursalId, setResetSucursalId] = useState<number>(user?.sucursal_id ?? SUCURSAL_ID_DEFAULT);
  const [resetCount, setResetCount] = useState("50");
  const [resetLoading, setResetLoading] = useState(false);

  function openReset() { setResetAnim("enter"); setResetModal(true); }
  function closeReset() { setResetAnim("leave"); setTimeout(() => setResetModal(false), 180); }

  async function handleReset() {
    const n = parseInt(resetCount, 10);
    if (!n || n < 1 || n > 500) return;
    setResetLoading(true);
    const suc = sucursales.find((s) => s.id === resetSucursalId);
    const prefix = suc ? inicial(suc.nombre) : "X";

    // Obtener todos los casilleros de esta sucursal
    const { data: existentes } = await supabase
      .from("casilleros")
      .select("id,estado,identificador_visual")
      .eq("sucursal_id", resetSucursalId);

    const todos = (existentes ?? []) as { id: number; estado: string; identificador_visual: string }[];
    const noOcupados = todos.filter((c) => c.estado !== "OCUPADO");
    const ocupadosVisual = new Set(todos.filter((c) => c.estado === "OCUPADO").map((c) => c.identificador_visual));

    // Calcular qué identificadores necesitamos (1..n), saltando los ocupados
    const necesarios: string[] = [];
    let num = 1;
    while (necesarios.length < n) {
      const id_visual = `${prefix}-${num}`;
      if (!ocupadosVisual.has(id_visual)) necesarios.push(id_visual);
      num++;
    }

    // Casilleros no ocupados que podemos reutilizar (UPDATE a LIBRE con nuevo nombre)
    const reutilizables = noOcupados.slice(0, necesarios.length);
    const extras = noOcupados.slice(necesarios.length); // sobran → eliminar si no tienen FK

    // UPDATE los reutilizables
    for (let i = 0; i < reutilizables.length; i++) {
      await supabase.from("casilleros").update({
        identificador_visual: necesarios[i],
        estado: "LIBRE",
      }).eq("id", reutilizables[i].id);
    }

    // INSERT los que faltan
    const faltantes = necesarios.slice(reutilizables.length);
    if (faltantes.length > 0) {
      await supabase.from("casilleros").insert(
        faltantes.map((id_visual) => ({ sucursal_id: resetSucursalId, identificador_visual: id_visual, estado: "LIBRE" }))
      );
    }

    // Intentar eliminar los sobrantes (puede fallar por FK, se ignora)
    for (const c of extras) {
      await supabase.from("casilleros").delete().eq("id", c.id);
    }

    setResetLoading(false);
    closeReset();
    await refresh();
    showToast(`Casilleros reseteados: ${n} ordenados desde ${prefix}-1`);
  }

  // Modal cambiar estado individual
  const [editModal, setEditModal] = useState<{ open: boolean; casillero: Casillero | null }>({ open: false, casillero: null });
  const [editAnim, setEditAnim] = useState<"enter" | "leave">("enter");
  const [editEstado, setEditEstado] = useState<EstadoCasillero>("LIBRE");

  async function refresh() {
    setLoading(true);
    const [{ data: cas }, { data: suc }] = await Promise.all([
      supabase.from("casilleros").select("id,sucursal_id,identificador_visual,estado").order("sucursal_id"),
      supabase.from("sucursales").select("id,nombre").eq("esta_activa", true).order("id"),
    ]);
    setCasilleros(((cas ?? []) as Casillero[]).sort((a, b) => {
      if (a.sucursal_id !== b.sucursal_id) return a.sucursal_id - b.sucursal_id;
      // Extraer número del identificador: "C-12" → 12
      const numA = parseInt(a.identificador_visual.replace(/^[^-]*-/, ""), 10) || 0;
      const numB = parseInt(b.identificador_visual.replace(/^[^-]*-/, ""), 10) || 0;
      return numA - numB;
    }));
    setSucursales((suc ?? []) as Sucursal[]);
    if (suc && suc.length > 0) setLoteSucursalId((suc[0] as Sucursal).id);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => {
    return casilleros.filter((c) => {
      if (filterSucursal !== "all" && c.sucursal_id !== filterSucursal) return false;
      if (filterEstado !== "all" && c.estado !== filterEstado) return false;
      return true;
    });
  }, [casilleros, filterSucursal, filterEstado]);

  const stats = useMemo(() => ({
    total: casilleros.length,
    libre: casilleros.filter((c) => c.estado === "LIBRE").length,
    ocupado: casilleros.filter((c) => c.estado === "OCUPADO").length,
    mantenimiento: casilleros.filter((c) => c.estado === "MANTENIMIENTO").length,
  }), [casilleros]);

  function showToast(msg: string) { setToast({ open: true, message: msg }); }

  function openModal() { setModalAnim("enter"); setModalOpen(true); }
  function closeModal() { setModalAnim("leave"); setTimeout(() => setModalOpen(false), 180); }

  function openEdit(c: Casillero) { setEditEstado(c.estado); setEditAnim("enter"); setEditModal({ open: true, casillero: c }); }
  function closeEdit() { setEditAnim("leave"); setTimeout(() => setEditModal({ open: false, casillero: null }), 180); }

  async function handleAgregarLote() {
    const n = parseInt(loteCount, 10);
    if (!n || n < 1 || n > 200) return;
    setLoteLoading(true);
    const suc = sucursales.find((s) => s.id === loteSucursalId);
    const prefix = suc ? inicial(suc.nombre) : "X";
    // Calcular el siguiente número disponible para esta sucursal
    const existentes = casilleros
      .filter((c) => c.sucursal_id === loteSucursalId && c.identificador_visual.startsWith(prefix + "-"))
      .map((c) => parseInt(c.identificador_visual.replace(prefix + "-", ""), 10))
      .filter((n) => !isNaN(n));
    const maxExistente = existentes.length > 0 ? Math.max(...existentes) : 0;
    const rows = Array.from({ length: n }, (_, i) => ({
      sucursal_id: loteSucursalId,
      identificador_visual: `${prefix}-${maxExistente + i + 1}`,
      estado: "LIBRE" as EstadoCasillero,
    }));
    const { error } = await supabase.from("casilleros").insert(rows);
    setLoteLoading(false);
    if (error) { showToast("Error al crear casilleros"); return; }
    closeModal();
    await refresh();
    showToast(`${n} casillero(s) creados`);
  }

  async function handleCambiarEstado() {
    if (!editModal.casillero) return;
    const { error } = await supabase.from("casilleros").update({ estado: editEstado }).eq("id", editModal.casillero.id);
    if (error) { showToast("Error al actualizar"); return; }
    setCasilleros((prev) => prev.map((c) => c.id === editModal.casillero!.id ? { ...c, estado: editEstado } : c));
    closeEdit();
    showToast("Estado actualizado");
  }

  async function handleEliminar(c: Casillero) {
    if (c.estado === "OCUPADO") { showToast("No se puede eliminar un casillero ocupado"); return; }
    const { error } = await supabase.from("casilleros").delete().eq("id", c.id);
    if (error) { showToast("Error al eliminar"); return; }
    setCasilleros((prev) => prev.filter((x) => x.id !== c.id));
    showToast(`Casillero ${c.identificador_visual} eliminado`);
  }

  // Selección múltiple
  function toggleSelect(id: number, ocupado: boolean) {
    if (ocupado) return; // no seleccionables los ocupados
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const elegibles = filtered.filter((c) => c.estado !== "OCUPADO").map((c) => c.id);
    const allSelected = elegibles.every((id) => selected.has(id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(elegibles));
    }
  }

  async function handleEliminarLote() {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("casilleros").delete().in("id", ids);
    setBulkDeleting(false);
    if (error) { showToast("Error al eliminar"); return; }
    setCasilleros((prev) => prev.filter((c) => !selected.has(c.id)));
    setSelected(new Set());
    showToast(`${ids.length} casillero(s) eliminado(s)`);
  }

  return (
    <div className="space-y-6">
      <Toast open={toast.open} message={toast.message} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="section-kicker">Recepción</div>
            <h1 className="section-title">Casilleros</h1>
            <p className="section-description">Gestiona el inventario de casilleros por sucursal.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openReset}
              className="inline-flex items-center gap-2 rounded-full border border-[#1e293b] bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
              Resetear
            </button>
            <button
              onClick={openModal}
              className="inline-flex items-center gap-2 rounded-full border border-brand-green bg-brand-green px-5 py-2.5 text-sm font-semibold text-black hover:opacity-95 shadow-[0_0_0_1px_rgba(118,203,62,0.15),0_8px_30px_rgba(118,203,62,0.10)]"
            >
              <span className="text-lg leading-none">+</span> Agregar casilleros
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: stats.total, color: "text-slate-100" },
            { label: "Libres", value: stats.libre, color: "text-brand-green" },
            { label: "Ocupados", value: stats.ocupado, color: "text-amber-300" },
            { label: "Mantenimiento", value: stats.mantenimiento, color: "text-slate-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-slate-500">{s.label}</div>
              <div className={["mt-1 text-2xl font-bold", s.color].join(" ")}>{loading ? "…" : s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <select
            value={filterSucursal}
            onChange={(e) => setFilterSucursal(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="appearance-none rounded-full border border-[#1e293b] bg-[#0b1220] py-2 pl-4 pr-9 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50"
          >
            <option value="all">Todas las sucursales</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="relative">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as EstadoCasillero | "all")}
            className="appearance-none rounded-full border border-[#1e293b] bg-[#0b1220] py-2 pl-4 pr-9 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50"
          >
            <option value="all">Todos los estados</option>
            <option value="LIBRE">Libre</option>
            <option value="OCUPADO">Ocupado</option>
            <option value="MANTENIMIENTO">Mantenimiento</option>
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="ml-auto text-sm text-slate-500 self-center">
          {loading ? "Cargando…" : `${filtered.length} casillero(s)`}
        </div>
      </div>

      {/* Barra de selección múltiple */}
      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-3 animate-[fadeIn_0.15s_ease]">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-xs font-bold text-red-400">
              {selected.size}
            </span>
            <span className="text-sm text-slate-300">
              casillero(s) seleccionado(s) para eliminar
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-full border border-[#1e293b] bg-white/5 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleEliminarLote()}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {bulkDeleting ? "Eliminando…" : `Eliminar ${selected.size}`}
            </button>
          </div>
        </div>
      ) : null}

      {/* Grid de casilleros */}
      {loading ? (
        <div className="text-sm text-slate-500 py-8 text-center">Cargando casilleros…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 py-16 text-center">
          <LockIcon className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-500">No hay casilleros. Agrega uno para comenzar.</p>
        </div>
      ) : (
        <>
          {/* Seleccionar todos los elegibles */}
          {filtered.some((c) => c.estado !== "OCUPADO") ? (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2"
              >
                {filtered.filter((c) => c.estado !== "OCUPADO").every((c) => selected.has(c.id))
                  ? "Deseleccionar todos"
                  : "Seleccionar todos (no ocupados)"}
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {filtered.map((c) => {
              const cfg = estadoConfig(c.estado);
              const isOcupado = c.estado === "OCUPADO";
              const isSelected = selected.has(c.id);
              return (
                <div
                  key={c.id}
                  className={[
                    "group relative rounded-2xl border p-3 transition-all duration-150",
                    isOcupado ? "cursor-pointer hover:scale-[1.03]" : "cursor-pointer hover:scale-[1.03]",
                    isSelected ? "border-red-500/40 bg-red-500/8 ring-1 ring-red-500/30" : cfg.card,
                  ].join(" ")}
                  onClick={() => isOcupado ? openEdit(c) : toggleSelect(c.id, false)}
                  title={`${c.identificador_visual} — ${cfg.label}`}
                >
                  {/* Checkbox — solo no ocupados */}
                  {!isOcupado ? (
                    <span
                      className={[
                        "absolute left-1.5 top-1.5 h-4 w-4 rounded border flex items-center justify-center transition-all",
                        isSelected
                          ? "border-red-500/60 bg-red-500/20 text-red-400"
                          : "border-[#1e293b] bg-[#020617] opacity-0 group-hover:opacity-100",
                      ].join(" ")}
                    >
                      {isSelected ? <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg> : null}
                    </span>
                  ) : null}

                  <div className="flex flex-col items-center gap-2">
                    <LockIcon className={["h-5 w-5", isSelected ? "text-red-400" : cfg.text].join(" ")} />
                    <span className="text-xs font-bold text-slate-100 tracking-wide">{c.identificador_visual}</span>
                    <span className={["inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase", isSelected ? "border-red-500/30 bg-red-500/10 text-red-400" : cfg.badge].join(" ")}>
                      <span className={["h-1.5 w-1.5 rounded-full", isSelected ? "bg-red-400" : cfg.dot].join(" ")} />
                      {isSelected ? "Eliminar" : cfg.label}
                    </span>
                  </div>

                  {/* Botón editar estado — solo ocupados o al hacer hover en no seleccionados */}
                  {isOcupado ? null : (
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                      className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full border border-[#1e293b] bg-[#020617] text-slate-500 hover:text-brand-green group-hover:flex"
                      title="Cambiar estado"
                    >
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal agregar en lote */}
      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className={["absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200", modalAnim === "leave" ? "opacity-0" : "opacity-100"].join(" ")} onClick={closeModal} />
          <div className={["relative w-full max-w-sm overflow-hidden rounded-[28px] border border-[#1e293b] bg-[#020617] shadow-[0_32px_80px_rgba(0,0,0,0.7)] transform-gpu transition-all duration-200", modalAnim === "leave" ? "opacity-0 scale-[0.97]" : "opacity-100 scale-100"].join(" ")}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_circle_at_20%_0%,rgba(118,203,62,0.10),transparent_50%)]" />
            <div className="relative flex items-center justify-between border-b border-[#1e293b] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-green/25 bg-brand-green/10 text-brand-green">
                  <LockIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-slate-500">Inventario</p>
                  <h2 className="text-lg font-semibold text-slate-100">Agregar casilleros</h2>
                </div>
              </div>
              <button onClick={closeModal} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100">
                <XIcon />
              </button>
            </div>
            <div className="relative space-y-4 px-6 py-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Sucursal</label>
                <div className="relative">
                  <select
                    value={loteSucursalId}
                    onChange={(e) => setLoteSucursalId(Number(e.target.value))}
                    className="w-full appearance-none rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 pr-9 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50"
                  >
                    {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Cantidad a agregar</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={loteCount}
                  onChange={(e) => setLoteCount(e.target.value)}
                  className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50"
                  placeholder="Ej. 50"
                />
              </div>
              {/* Preview nomenclatura */}
              {(() => {
                const suc = sucursales.find((s) => s.id === loteSucursalId);
                const prefix = suc ? inicial(suc.nombre) : "X";
                const existentes = casilleros
                  .filter((c) => c.sucursal_id === loteSucursalId && c.identificador_visual.startsWith(prefix + "-"))
                  .map((c) => parseInt(c.identificador_visual.replace(prefix + "-", ""), 10))
                  .filter((n) => !isNaN(n));
                const desde = (existentes.length > 0 ? Math.max(...existentes) : 0) + 1;
                const hasta = desde + (parseInt(loteCount, 10) || 0) - 1;
                return (
                  <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3 text-xs text-slate-400">
                    Se crearán: <span className="font-semibold text-slate-100">{prefix}-{desde}</span> hasta <span className="font-semibold text-slate-100">{prefix}-{hasta}</span>
                  </div>
                );
              })()}
            </div>
            <div className="relative flex justify-between gap-3 border-t border-[#1e293b] px-6 py-4">
              <button onClick={closeModal} className="rounded-full border border-[#1e293b] bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10">
                Cancelar
              </button>
              <button
                onClick={() => void handleAgregarLote()}
                disabled={loteLoading || !loteCount || parseInt(loteCount) < 1}
                className="rounded-full border border-brand-green bg-brand-green px-6 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loteLoading ? "Creando…" : "Crear casilleros"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal resetear tabla */}
      {resetModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className={["absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200", resetAnim === "leave" ? "opacity-0" : "opacity-100"].join(" ")} onClick={closeReset} />
          <div className={["relative w-full max-w-sm overflow-hidden rounded-[28px] border border-[#1e293b] bg-[#020617] shadow-[0_32px_80px_rgba(0,0,0,0.7)] transform-gpu transition-all duration-200", resetAnim === "leave" ? "opacity-0 scale-[0.97]" : "opacity-100 scale-100"].join(" ")}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_circle_at_20%_0%,rgba(239,68,68,0.08),transparent_50%)]" />
            <div className="relative flex items-center justify-between border-b border-[#1e293b] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-400">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-slate-500">Peligroso</p>
                  <h2 className="text-lg font-semibold text-slate-100">Resetear casilleros</h2>
                </div>
              </div>
              <button onClick={closeReset} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100">
                <XIcon />
              </button>
            </div>
            <div className="relative space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-300">
                Esto elimina todos los casilleros <span className="font-semibold">no ocupados</span> de la sucursal y los recrea ordenados desde 1. Los ocupados se conservan.
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Sucursal</label>
                <div className="relative">
                  <select
                    value={resetSucursalId}
                    onChange={(e) => setResetSucursalId(Number(e.target.value))}
                    className="w-full appearance-none rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 pr-9 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50"
                  >
                    {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Cantidad final de casilleros</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={resetCount}
                  onChange={(e) => setResetCount(e.target.value)}
                  className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50"
                  placeholder="Ej. 50"
                />
              </div>
              {(() => {
                const suc = sucursales.find((s) => s.id === resetSucursalId);
                const prefix = suc ? inicial(suc.nombre) : "X";
                const n = parseInt(resetCount, 10) || 0;
                return (
                  <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3 text-xs text-slate-400">
                    Resultado: <span className="font-semibold text-slate-100">{prefix}-1</span> hasta <span className="font-semibold text-slate-100">{prefix}-{n}</span>, todos en estado <span className="font-semibold text-brand-green">Libre</span>
                  </div>
                );
              })()}
            </div>
            <div className="relative flex justify-between gap-3 border-t border-[#1e293b] px-6 py-4">
              <button onClick={closeReset} className="rounded-full border border-[#1e293b] bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10">
                Cancelar
              </button>
              <button
                onClick={() => void handleReset()}
                disabled={resetLoading || !resetCount || parseInt(resetCount) < 1}
                className="rounded-full border border-red-500/40 bg-red-500/10 px-6 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? "Reseteando…" : "Confirmar reset"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal cambiar estado */}      {editModal.open && editModal.casillero ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className={["absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200", editAnim === "leave" ? "opacity-0" : "opacity-100"].join(" ")} onClick={closeEdit} />
          <div className={["relative w-full max-w-xs overflow-hidden rounded-[28px] border border-[#1e293b] bg-[#020617] shadow-[0_32px_80px_rgba(0,0,0,0.7)] transform-gpu transition-all duration-200", editAnim === "leave" ? "opacity-0 scale-[0.97]" : "opacity-100 scale-100"].join(" ")}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_circle_at_20%_0%,rgba(118,203,62,0.08),transparent_50%)]" />
            <div className="relative flex items-center justify-between border-b border-[#1e293b] px-6 py-5">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-slate-500">Casillero</p>
                <h2 className="text-lg font-semibold text-slate-100">{editModal.casillero.identificador_visual}</h2>
              </div>
              <button onClick={closeEdit} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100">
                <XIcon />
              </button>
            </div>
            <div className="relative space-y-2 px-6 py-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">Cambiar estado</p>
              {(["LIBRE", "OCUPADO", "MANTENIMIENTO"] as EstadoCasillero[]).map((est) => {
                const cfg = estadoConfig(est);
                const active = editEstado === est;
                return (
                  <button
                    key={est}
                    onClick={() => setEditEstado(est)}
                    className={["w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all", active ? cfg.card + " " + cfg.text : "border-[#1e293b] bg-white/5 text-slate-400 hover:bg-white/8"].join(" ")}
                  >
                    <span className={["h-2.5 w-2.5 rounded-full", cfg.dot].join(" ")} />
                    {cfg.label}
                    {active ? <span className="ml-auto text-xs opacity-70">✓</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="relative flex justify-between gap-3 border-t border-[#1e293b] px-6 py-4">
              <button onClick={closeEdit} className="rounded-full border border-[#1e293b] bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10">
                Cancelar
              </button>
              <button
                onClick={() => void handleCambiarEstado()}
                className="rounded-full border border-brand-green bg-brand-green px-6 py-2.5 text-sm font-semibold text-black hover:opacity-90"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

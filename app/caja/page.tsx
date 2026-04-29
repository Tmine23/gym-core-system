"use client";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";

const TZ = "America/La_Paz";

// ─── Types ────────────────────────────────────────────────────────────────────

type CierreCaja = {
  id: number;
  fecha: string;
  efectivo_fisico_bob: number;
  efectivo_fisico_usd: number;
  notas: string | null;
  fecha_registro: string;
  empleados: { nombre: string | null; apellido: string | null } | null;
};

type ResumenDia = {
  totalBob: number;
  totalUsd: number;
  efectivoBob: number;
  efectivoUsd: number;
  totalPagos: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); }
function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-BO", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
function fmtMoney(n: number) {
  return Number(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function monthStartStr(offset = 0) {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1 - offset).padStart(2, "0")}-01`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DownloadIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function CheckIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>; }

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CajaPage() {
  const { user, activeSucursalId } = useAuth();
  const [cierreHoy, setCierreHoy] = useState<CierreCaja | null | undefined>(undefined);
  const [historial, setHistorial] = useState<CierreCaja[]>([]);
  const [resumenHoy, setResumenHoy] = useState<ResumenDia>({ totalBob: 0, totalUsd: 0, efectivoBob: 0, efectivoUsd: 0, totalPagos: 0 });
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<"mes" | "3meses" | "todo">("mes");
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "" });

  const showToast = (msg: string) => { setToast({ open: true, message: msg }); setTimeout(() => setToast((t) => ({ ...t, open: false })), 2400); };

  async function load() {
    if (activeSucursalId === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const today = todayStr();

    const [cierreRes, pagosHoyRes, historialRes] = await Promise.all([
      supabase.from("cierres_caja")
        .select("id,fecha,efectivo_fisico_bob,efectivo_fisico_usd,notas,fecha_registro,empleados(nombre,apellido)")
        .eq("sucursal_id", activeSucursalId).eq("fecha", today).maybeSingle(),
      supabase.from("pagos")
        .select("monto_pagado,codigo_moneda,metodo_pago")
        .eq("sucursal_id", activeSucursalId)
        .gte("fecha_pago", `${today}T00:00:00-04:00`)
        .lte("fecha_pago", `${today}T23:59:59-04:00`),
      supabase.from("cierres_caja")
        .select("id,fecha,efectivo_fisico_bob,efectivo_fisico_usd,notas,fecha_registro,empleados(nombre,apellido)")
        .eq("sucursal_id", activeSucursalId)
        .order("fecha", { ascending: false })
        .limit(90),
    ]);

    setCierreHoy(cierreRes.data as CierreCaja | null);

    const pagos = pagosHoyRes.data ?? [];
    setResumenHoy({
      totalBob: pagos.filter((p) => p.codigo_moneda === "BOB").reduce((a, p) => a + Number(p.monto_pagado), 0),
      totalUsd: pagos.filter((p) => p.codigo_moneda === "USD").reduce((a, p) => a + Number(p.monto_pagado), 0),
      efectivoBob: pagos.filter((p) => p.metodo_pago === "EFECTIVO" && p.codigo_moneda === "BOB").reduce((a, p) => a + Number(p.monto_pagado), 0),
      efectivoUsd: pagos.filter((p) => p.metodo_pago === "EFECTIVO" && p.codigo_moneda === "USD").reduce((a, p) => a + Number(p.monto_pagado), 0),
      totalPagos: pagos.length,
    });

    setHistorial((historialRes.data ?? []) as unknown as CierreCaja[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [activeSucursalId]);

  // Filtrar historial
  const filteredHistorial = useMemo(() => {
    const cutoff = filterPeriod === "mes" ? monthStartStr(0)
      : filterPeriod === "3meses" ? monthStartStr(2)
      : "2000-01-01";
    return historial.filter((c) => c.fecha >= cutoff);
  }, [historial, filterPeriod]);

  // Totales del período
  const totalesPeriodo = useMemo(() => ({
    bob: filteredHistorial.reduce((a, c) => a + Number(c.efectivo_fisico_bob), 0),
    usd: filteredHistorial.reduce((a, c) => a + Number(c.efectivo_fisico_usd), 0),
    cierres: filteredHistorial.length,
  }), [filteredHistorial]);

  function exportCSV() {
    const headers = ["Fecha", "Efectivo BOB", "Efectivo USD", "Cerrado por", "Hora cierre", "Notas"];
    const lines = filteredHistorial.map((c) => [
      c.fecha,
      Number(c.efectivo_fisico_bob).toFixed(2),
      Number(c.efectivo_fisico_usd).toFixed(2),
      [c.empleados?.nombre, c.empleados?.apellido].filter(Boolean).join(" ") || "—",
      fmtDateTime(c.fecha_registro),
      c.notas ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `cierres_caja_${todayStr()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const yaHayCierre = !!cierreHoy;
  const diffBob = yaHayCierre ? Number(cierreHoy!.efectivo_fisico_bob) - resumenHoy.efectivoBob : 0;
  const diffUsd = yaHayCierre ? Number(cierreHoy!.efectivo_fisico_usd) - resumenHoy.efectivoUsd : 0;
  const cuadrado = Math.abs(diffBob) < 0.01 && Math.abs(diffUsd) < 0.01;

  if (activeSucursalId === null) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
          <div className="section-kicker">Finanzas</div>
          <h1 className="section-title">Caja</h1>
          <p className="section-description">Cierre diario y control de efectivo</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
          <p className="text-lg font-semibold text-amber-300">Selecciona una sucursal</p>
          <p className="mt-2 text-sm text-slate-400">El módulo de caja opera por sucursal. Selecciona una sucursal específica en el menú lateral para ver su caja.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      <div className={["fixed right-4 top-4 z-50 transition-all duration-200", toast.open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"].join(" ")}>
        <div className="flex items-center gap-3 rounded-2xl border border-brand-green/25 bg-[#0b1220] px-4 py-3 shadow-2xl">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-green/10 text-brand-green"><CheckIcon /></span>
          <span className="text-sm font-semibold text-slate-100">{toast.message}</span>
        </div>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Finanzas</div>
            <h1 className="section-title">Caja</h1>
            <p className="section-description">Cierre diario y historial de caja</p>
          </div>
          {!yaHayCierre && !loading && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-2xl border border-brand-green/40 bg-brand-green/15 px-5 py-2.5 text-sm font-bold text-brand-green hover:bg-brand-green/25 transition-all">
              🏦 Registrar cierre de hoy
            </button>
          )}
        </div>
      </div>

      {/* Estado del día */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Cargando…</div>
      ) : (
        <div className={`rounded-2xl border p-5 ${yaHayCierre ? cuadrado ? "border-brand-green/30 bg-brand-green/5" : "border-amber-400/30 bg-amber-400/5" : "border-[#1e293b] bg-white/5"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-100">
                {yaHayCierre ? (cuadrado ? "✅ Caja cerrada y cuadrada" : "⚠️ Caja cerrada con diferencia") : "🔓 Caja abierta — pendiente de cierre"}
              </p>
              {yaHayCierre && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Cerrada por {[cierreHoy!.empleados?.nombre, cierreHoy!.empleados?.apellido].filter(Boolean).join(" ") || "—"} · {fmtDateTime(cierreHoy!.fecha_registro)}
                </p>
              )}
            </div>
            {yaHayCierre && (
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${cuadrado ? "border-brand-green/30 text-brand-green" : "border-amber-400/30 text-amber-300"}`}>
                {cuadrado ? "Cuadrado ✓" : "Diferencia"}
              </span>
            )}
          </div>

          {/* Resumen del día */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Cobrado BOB</div>
              <div className="text-base font-bold text-brand-green">Bs {fmtMoney(resumenHoy.totalBob)}</div>
            </div>
            <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Cobrado USD</div>
              <div className="text-base font-bold text-sky-400">$ {fmtMoney(resumenHoy.totalUsd)}</div>
            </div>
            <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Efectivo BOB</div>
              <div className="text-base font-bold text-slate-100">Bs {fmtMoney(resumenHoy.efectivoBob)}</div>
            </div>
            <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Pagos hoy</div>
              <div className="text-base font-bold text-violet-400">{resumenHoy.totalPagos}</div>
            </div>
          </div>

          {/* Cierre registrado */}
          {yaHayCierre && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">Físico BOB contado</div>
                <div className="text-base font-bold text-slate-100">Bs {fmtMoney(Number(cierreHoy!.efectivo_fisico_bob))}</div>
                {Math.abs(diffBob) >= 0.01 && (
                  <div className={`text-xs mt-0.5 ${diffBob > 0 ? "text-brand-green" : "text-red-400"}`}>
                    {diffBob > 0 ? "+" : ""}{fmtMoney(diffBob)} vs esperado
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">Físico USD contado</div>
                <div className="text-base font-bold text-slate-100">$ {fmtMoney(Number(cierreHoy!.efectivo_fisico_usd))}</div>
                {Math.abs(diffUsd) >= 0.01 && (
                  <div className={`text-xs mt-0.5 ${diffUsd > 0 ? "text-brand-green" : "text-red-400"}`}>
                    {diffUsd > 0 ? "+" : ""}{fmtMoney(diffUsd)} vs esperado
                  </div>
                )}
              </div>
            </div>
          )}
          {yaHayCierre && cierreHoy!.notas && (
            <p className="mt-3 text-xs text-slate-500 italic">"{cierreHoy!.notas}"</p>
          )}
        </div>
      )}

      {/* Historial */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-100">Historial de cierres</h2>
          <div className="flex items-center gap-2">
            {/* Filtros período */}
            <div className="flex gap-1 rounded-2xl border border-[#1e293b] bg-[#0b1220] p-1">
              {([["mes", "Este mes"], ["3meses", "3 meses"], ["todo", "Todo"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setFilterPeriod(v)}
                  className={["rounded-xl px-3 py-1.5 text-xs font-semibold transition-all", filterPeriod === v ? "bg-brand-green/15 text-brand-green border border-brand-green/30" : "text-slate-400 hover:text-slate-200"].join(" ")}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 rounded-2xl border border-[#1e293b] bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:border-brand-green/40 transition-all">
              <DownloadIcon /> CSV
            </button>
          </div>
        </div>

        {/* Totales período */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total BOB", value: `Bs ${fmtMoney(totalesPeriodo.bob)}`, color: "text-brand-green" },
            { label: "Total USD", value: `$ ${fmtMoney(totalesPeriodo.usd)}`, color: "text-sky-400" },
            { label: "Cierres", value: String(totalesPeriodo.cierres), color: "text-slate-100" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
              <div className={`text-lg font-bold mt-1 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabla historial */}
        <div className="rounded-2xl border border-[#1e293b] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e293b] bg-white/5">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Fecha</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Efectivo BOB</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Efectivo USD</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Cerrado por</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Hora</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Notas</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistorial.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-500">Sin cierres en este período.</td></tr>
              ) : filteredHistorial.map((c) => (
                <tr key={c.id} className="border-b border-[#1e293b]/60 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-100">{fmtDate(c.fecha)}</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-green">Bs {fmtMoney(Number(c.efectivo_fisico_bob))}</td>
                  <td className="px-4 py-3 text-right font-bold text-sky-400">$ {fmtMoney(Number(c.efectivo_fisico_usd))}</td>
                  <td className="px-4 py-3 text-slate-300">{[c.empleados?.nombre, c.empleados?.apellido].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{fmtDateTime(c.fecha_registro)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{c.notas ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal cierre */}
      {showModal && (
        <ModalCierre
          resumenHoy={resumenHoy}
          sucursalId={activeSucursalId ?? user?.sucursal_id ?? 1}
          empleadoId={user?.id ?? 1}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); showToast("Cierre registrado"); void load(); }}
        />
      )}
    </div>
  );
}

// ─── Modal Cierre ─────────────────────────────────────────────────────────────

function ModalCierre({ resumenHoy, sucursalId, empleadoId, onClose, onSaved }: {
  resumenHoy: ResumenDia;
  sucursalId: number;
  empleadoId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [bob, setBob] = useState(resumenHoy.efectivoBob.toFixed(2));
  const [usd, setUsd] = useState(resumenHoy.efectivoUsd.toFixed(2));
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fisicoBob = parseFloat(bob) || 0;
  const fisicoUsd = parseFloat(usd) || 0;
  const diffBob = fisicoBob - resumenHoy.efectivoBob;
  const diffUsd = fisicoUsd - resumenHoy.efectivoUsd;

  async function handleSave() {
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("cierres_caja").upsert({
      sucursal_id: sucursalId,
      empleado_id: empleadoId,
      fecha: todayStr(),
      efectivo_fisico_bob: fisicoBob,
      efectivo_fisico_usd: fisicoUsd,
      notas: notas.trim() || null,
    }, { onConflict: "sucursal_id,fecha" });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#1e293b] bg-[#0b1220] p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Caja del día</p>
            <h2 className="text-base font-bold text-slate-100">Registrar cierre</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xl leading-none">×</button>
        </div>

        {/* Resumen esperado */}
        <div className="rounded-xl border border-[#1e293b] bg-[#020617] px-4 py-3 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Efectivo esperado hoy</p>
          <div className="flex gap-4 text-sm font-semibold">
            <span className="text-brand-green">Bs {fmtMoney(resumenHoy.efectivoBob)}</span>
            <span className="text-sky-400">$ {fmtMoney(resumenHoy.efectivoUsd)}</span>
            <span className="text-slate-500 text-xs self-center">{resumenHoy.totalPagos} pagos hoy</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Efectivo físico contado — BOB</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">Bs</span>
              <input type="number" step="0.01" value={bob} onChange={(e) => setBob(e.target.value)}
                className="w-full rounded-xl border border-[#1e293b] bg-[#020617] pl-9 pr-4 py-2.5 text-sm text-slate-100 focus:border-brand-green/50 focus:outline-none focus:ring-1 focus:ring-brand-green/30" />
            </div>
            {Math.abs(diffBob) >= 0.01 && (
              <p className={`mt-1 text-xs ${diffBob > 0 ? "text-brand-green" : "text-red-400"}`}>
                {diffBob > 0 ? "Sobra" : "Falta"} Bs {fmtMoney(Math.abs(diffBob))}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Efectivo físico contado — USD</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <input type="number" step="0.01" value={usd} onChange={(e) => setUsd(e.target.value)}
                className="w-full rounded-xl border border-[#1e293b] bg-[#020617] pl-9 pr-4 py-2.5 text-sm text-slate-100 focus:border-brand-green/50 focus:outline-none focus:ring-1 focus:ring-brand-green/30" />
            </div>
            {Math.abs(diffUsd) >= 0.01 && (
              <p className={`mt-1 text-xs ${diffUsd > 0 ? "text-brand-green" : "text-red-400"}`}>
                {diffUsd > 0 ? "Sobra" : "Falta"} $ {fmtMoney(Math.abs(diffUsd))}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Notas (opcional)</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
              placeholder="Observaciones del cierre…"
              className="w-full rounded-xl border border-[#1e293b] bg-[#020617] px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-green/50 focus:outline-none focus:ring-1 focus:ring-brand-green/30 resize-none" />
          </div>
        </div>

        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[#1e293b] bg-white/5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition-all">
            Cancelar
          </button>
          <button onClick={() => void handleSave()} disabled={saving}
            className="flex-1 rounded-xl border border-brand-green/40 bg-brand-green/15 py-2.5 text-sm font-semibold text-brand-green hover:bg-brand-green/25 transition-all disabled:opacity-50">
            {saving ? "Guardando…" : "Confirmar cierre"}
          </button>
        </div>
      </div>
    </div>
  );
}

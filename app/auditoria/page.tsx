"use client";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Fragment, useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type LogEntry = {
  id: number;
  empleado_id: number;
  sucursal_id: number | null;
  tabla_afectada: string;
  registro_id: number | null;
  operacion: string;
  valor_anterior: Record<string, unknown> | null;
  valor_nuevo: Record<string, unknown> | null;
  fecha_evento: string;
  empleados: { nombre: string; apellido: string } | null;
  sucursales: { nombre: string } | null;
};

const TABLAS = ["Todas", "sucursales", "empleados", "roles", "socios", "pagos", "suscripciones", "asistencias", "login"];
const OPERACIONES = ["Todas", "INSERT", "UPDATE", "DELETE"];
const PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function OperacionBadge({ op }: { op: string }) {
  const styles: Record<string, string> = {
    INSERT: "border-green-500/30 bg-green-500/10 text-green-400",
    UPDATE: "border-amber-400/30 bg-amber-400/10 text-amber-400",
    DELETE: "border-red-500/30 bg-red-500/10 text-red-400",
  };
  const style = styles[op] ?? "border-slate-500/30 bg-slate-500/10 text-slate-400";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${style}`}>
      {op}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditoriaPage() {
  useAuth();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tablaFilter, setTablaFilter] = useState("Todas");
  const [opFilter, setOpFilter] = useState("Todas");
  const [searchEmpleado, setSearchEmpleado] = useState("");

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Archive state
  const [archiveDownloaded, setArchiveDownloaded] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [showCleanConfirm, setShowCleanConfirm] = useState(false);

  // Archive: download all logs as CSV
  async function handleArchive() {
    setArchiving(true);
    const { data } = await supabase
      .from("logs_sistema")
      .select("id, empleado_id, sucursal_id, tabla_afectada, registro_id, operacion, valor_anterior, valor_nuevo, fecha_evento, empleados(nombre, apellido), sucursales(nombre)")
      .order("fecha_evento", { ascending: true });

    if (!data || data.length === 0) { setArchiving(false); return; }

    const rows = (data as unknown as LogEntry[]).map((l) => ({
      id: l.id,
      fecha: l.fecha_evento,
      empleado: l.empleados ? `${l.empleados.nombre} ${l.empleados.apellido}` : "",
      sucursal: l.sucursales?.nombre ?? "",
      tabla: l.tabla_afectada,
      registro_id: l.registro_id ?? "",
      operacion: l.operacion,
      valor_anterior: l.valor_anterior ? JSON.stringify(l.valor_anterior) : "",
      valor_nuevo: l.valor_nuevo ? JSON.stringify(l.valor_nuevo) : "",
    }));

    const headers = ["ID", "Fecha", "Empleado", "Sucursal", "Tabla", "Registro ID", "Operación", "Valor Anterior", "Valor Nuevo"];
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => [
        r.id, `"${r.fecha}"`, `"${r.empleado}"`, `"${r.sucursal}"`, r.tabla, r.registro_id, r.operacion,
        `"${r.valor_anterior.replace(/"/g, '""')}"`, `"${r.valor_nuevo.replace(/"/g, '""')}"`,
      ].join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setArchiving(false);
    setArchiveDownloaded(true);
  }

  // Clean: delete all logs (only after archive download)
  async function handleClean() {
    setCleaning(true);
    await supabase.from("logs_sistema").delete().neq("id", 0);
    setCleaning(false);
    setShowCleanConfirm(false);
    setArchiveDownloaded(false);
    setPage(0);
    void cargar();
  }

  const cargar = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("logs_sistema")
      .select("*, empleados(nombre, apellido), sucursales(nombre)", { count: "exact" })
      .order("fecha_evento", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (desde) {
      query = query.gte("fecha_evento", `${desde}T00:00:00`);
    }
    if (hasta) {
      query = query.lte("fecha_evento", `${hasta}T23:59:59`);
    }
    if (tablaFilter !== "Todas") {
      query = query.eq("tabla_afectada", tablaFilter);
    }
    if (opFilter !== "Todas") {
      query = query.eq("operacion", opFilter);
    }

    const { data, count } = await query;

    let filtered = (data ?? []) as unknown as LogEntry[];

    // Client-side filter by employee name (since it's a join)
    if (searchEmpleado.trim()) {
      const term = searchEmpleado.toLowerCase();
      filtered = filtered.filter((log) => {
        const nombre = `${log.empleados?.nombre ?? ""} ${log.empleados?.apellido ?? ""}`.toLowerCase();
        return nombre.includes(term);
      });
    }

    setLogs(filtered);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, desde, hasta, tablaFilter, opFilter, searchEmpleado]);

  useEffect(() => { void cargar(); }, [cargar]);

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Sistema</div>
            <h1 className="section-title">Auditoría</h1>
            <p className="section-description">Registro de todas las operaciones del sistema</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{totalCount} registros</span>
            <button
              onClick={() => void handleArchive()}
              disabled={archiving || totalCount === 0}
              className="flex items-center gap-2 rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-slate-100 disabled:opacity-40 transition-all"
            >
              {archiving ? "Descargando…" : "📥 Archivar CSV"}
            </button>
            <button
              onClick={() => setShowCleanConfirm(true)}
              disabled={!archiveDownloaded || cleaning}
              className={[
                "flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all",
                archiveDownloaded
                  ? "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  : "border border-[#1e293b] bg-white/5 text-slate-600 cursor-not-allowed",
              ].join(" ")}
              title={!archiveDownloaded ? "Primero descargá el archivo CSV" : "Limpiar registros archivados"}
            >
              🗑️ Limpiar
            </button>
          </div>
        </div>
        {archiveDownloaded && (
          <div className="mt-3 rounded-xl border border-brand-green/20 bg-brand-green/5 px-4 py-2 text-xs text-brand-green">
            ✓ Archivo descargado. Ahora podés limpiar los registros de la base de datos.
          </div>
        )}
      </div>

      {/* Clean confirmation modal */}
      {showCleanConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCleanConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-[28px] border border-[#1e293b] bg-[#020617] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-400 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-bold text-slate-100">¿Limpiar todos los registros?</p>
                <p className="text-xs text-slate-400">Se eliminarán {totalCount} registros de la base de datos.</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Esta acción no se puede deshacer. Asegurate de que el archivo CSV descargado esté guardado correctamente.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowCleanConfirm(false)}
                className="flex-1 rounded-2xl border border-[#1e293b] bg-white/5 py-2.5 text-sm font-semibold text-slate-300 hover:text-slate-100 transition-all">
                Cancelar
              </button>
              <button onClick={() => void handleClean()} disabled={cleaning}
                className="flex-1 rounded-2xl border border-red-500/30 bg-red-500/15 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/25 disabled:opacity-50 transition-all">
                {cleaning ? "Limpiando…" : "Sí, limpiar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Date range */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => { setDesde(e.target.value); setPage(0); }}
              className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-green/50"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => { setHasta(e.target.value); setPage(0); }}
              className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-green/50"
            />
          </div>

          {/* Table filter */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">Tabla</label>
            <select
              value={tablaFilter}
              onChange={(e) => { setTablaFilter(e.target.value); setPage(0); }}
              className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-green/50"
            >
              {TABLAS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Operation filter */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">Operación</label>
            <select
              value={opFilter}
              onChange={(e) => { setOpFilter(e.target.value); setPage(0); }}
              className="rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-green/50"
            >
              {OPERACIONES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Search by employee */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">Buscar empleado</label>
            <input
              type="text"
              placeholder="Nombre del empleado…"
              value={searchEmpleado}
              onChange={(e) => { setSearchEmpleado(e.target.value); setPage(0); }}
              className="w-full rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-green/50"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#1e293b] overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-500">Cargando registros…</div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-500">No se encontraron registros con los filtros aplicados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e293b] bg-white/5">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Fecha/Hora</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Empleado</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Sucursal</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tabla afectada</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Operación</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr className="border-b border-[#1e293b]/60 hover:bg-white/5 cursor-pointer" onClick={() => toggleRow(log.id)}>
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs whitespace-nowrap">{formatFecha(log.fecha_evento)}</td>
                      <td className="px-4 py-3 text-slate-200">
                        {log.empleados ? `${log.empleados.nombre} ${log.empleados.apellido}` : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{log.sucursales?.nombre ?? <span className="text-slate-600">—</span>}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">{log.tabla_afectada}</td>
                      <td className="px-4 py-3"><OperacionBadge op={log.operacion} /></td>
                      <td className="px-4 py-3">
                        <button className="text-[10px] text-brand-green hover:underline">
                          {expandedRows.has(log.id) ? "▼ Ocultar" : "▶ Ver"}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(log.id) && (
                      <tr key={`${log.id}-detail`} className="border-b border-[#1e293b]/60 bg-[#0b1220]">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {log.valor_anterior && (
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Valor anterior</p>
                                <pre className="rounded-xl border border-[#1e293b] bg-[#020617] p-3 text-xs text-slate-300 overflow-x-auto max-h-48">
                                  {JSON.stringify(log.valor_anterior, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.valor_nuevo && (
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Valor nuevo</p>
                                <pre className="rounded-xl border border-[#1e293b] bg-[#020617] p-3 text-xs text-slate-300 overflow-x-auto max-h-48">
                                  {JSON.stringify(log.valor_nuevo, null, 2)}
                                </pre>
                              </div>
                            )}
                            {!log.valor_anterior && !log.valor_nuevo && (
                              <p className="text-xs text-slate-500">Sin datos de detalle</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#1e293b] px-5 py-3">
            <p className="text-xs text-slate-500">
              Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount} registros
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-xl border border-[#1e293b] bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                className="rounded-xl border border-[#1e293b] bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

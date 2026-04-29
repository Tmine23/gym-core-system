"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SucursalRow = {
  id: number;
  nombre: string;
  direccion: string;
  telefono: string | null;
  ciudad: string;
  nit: string | null;
  esta_activa: boolean;
  fecha_creacion: string;
  capacidad_maxima: number;
  razon_social: string | null;
  cufd: string | null;
};

type EmpleadoRow = {
  id: number;
  rol_id: number;
  sucursal_id: number;
  ci: string;
  nombre: string;
  apellido: string;
  email: string;
  es_activo: boolean;
  fecha_creacion: string;
  roles: { nombre: string } | null;
  sucursales: { nombre: string } | null;
};

type RolRow = {
  id: number;
  nombre: string;
  descripcion: string | null;
  permiso_ver_finanzas: boolean;
  permiso_editar_usuarios: boolean;
  permiso_gestionar_asistencias: boolean;
};

type TabId = "sucursales" | "empleados" | "roles" | "ajustes" | "facturacion";

type TabConfig = {
  id: TabId;
  label: string;
  icon: string;
};

type FormState<T> = {
  data: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPLEADO_ID = 1;
const SUCURSAL_ID = 1;

const TABS: TabConfig[] = [
  { id: "sucursales", label: "Sucursales", icon: "🏢" },
  { id: "empleados", label: "Empleados", icon: "👥" },
  { id: "roles", label: "Roles", icon: "🔑" },
  { id: "facturacion", label: "Facturación", icon: "🧾" },
  { id: "ajustes", label: "Ajustes", icon: "⚙️" },
];

// ─── Sanitize for logs ────────────────────────────────────────────────────────

function sanitizeForLog(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj) return null;
  const copy = { ...obj };
  delete copy.password_hash;
  return copy;
}

async function insertLog(params: {
  tabla_afectada: string;
  registro_id: number;
  operacion: "INSERT" | "UPDATE" | "DELETE";
  valor_anterior: Record<string, unknown> | null;
  valor_nuevo: Record<string, unknown> | null;
}) {
  await supabase.from("logs_sistema").insert({
    empleado_id: EMPLEADO_ID,
    sucursal_id: SUCURSAL_ID,
    tabla_afectada: params.tabla_afectada,
    registro_id: params.registro_id,
    operacion: params.operacion,
    valor_anterior: sanitizeForLog(params.valor_anterior),
    valor_nuevo: sanitizeForLog(params.valor_nuevo),
  });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>;
}
function XIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function PencilIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>;
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>;
}
function TrashIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ open, message, onClose }: { open: boolean; message: string; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [open, onClose]);
  return (
    <div className={["fixed right-4 top-4 z-[70] transition-all duration-200", open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"].join(" ")} role="status">
      <div className="flex items-center gap-3 rounded-2xl border border-brand-green/25 bg-[#0b1220] px-4 py-3 shadow-2xl">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-green/10 text-brand-green"><CheckIcon /></span>
        <span className="text-sm font-semibold text-slate-100">{message}</span>
        <button onClick={onClose} className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"><XIcon /></button>
      </div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, hint, error, success, children }: {
  label: string; hint?: string; error?: string; success?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
      <div className="relative mt-1.5">
        {children}
        {success && !error && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-green"><CheckIcon /></span>
        )}
      </div>
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-400 animate-[shake_0.3s_ease]">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

function inputCls(hasError?: boolean, hasSuccess?: boolean) {
  return [
    "w-full rounded-2xl border bg-[#0b1220] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors",
    hasError ? "border-red-500/60 focus:ring-2 focus:ring-red-500/40"
      : hasSuccess ? "border-brand-green/50 focus:ring-2 focus:ring-brand-green/40"
      : "border-[#1e293b] hover:border-slate-600 focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green/50",
  ].join(" ");
}

// ─── Badge_Estado ─────────────────────────────────────────────────────────────

function Badge_Estado({ activo }: { activo: boolean }) {
  return (
    <span className={[
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
      activo
        ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
        : "border-red-500/30 bg-red-500/10 text-red-400",
    ].join(" ")}>
      <span className={["h-1.5 w-1.5 rounded-full", activo ? "bg-brand-green" : "bg-red-400"].join(" ")} />
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={["relative inline-flex h-7 w-12 items-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-brand-green/40",
        checked ? "border-brand-green/50 bg-brand-green/15" : "border-[#1e293b] bg-[#0b1220]"].join(" ")}>
      <span className={["inline-block h-5 w-5 transform rounded-full shadow transition-transform",
        checked ? "translate-x-6 bg-brand-green" : "translate-x-1 bg-slate-500"].join(" ")} />
    </button>
  );
}


// ─── FormModal ────────────────────────────────────────────────────────────────

function FormModal({ title, kicker, onClose, onSave, saving, error, children }: {
  title: string;
  kicker: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[#1e293b] bg-[#020617] shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_circle_at_15%_0%,rgba(118,203,62,0.10),transparent_50%)]" />

        {/* Header */}
        <div className="relative flex items-center justify-between gap-4 border-b border-[#1e293b] px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-green/25 bg-brand-green/10 text-brand-green font-bold text-lg">
              <PlusIcon />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">{kicker}</p>
              <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"><XIcon /></button>
        </div>

        {/* Body */}
        <div className="relative max-h-[65vh] overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
              {error}
            </div>
          )}
          {children}
        </div>

        {/* Footer */}
        <div className="relative flex items-center justify-between gap-3 border-t border-[#1e293b] px-6 py-4">
          <button onClick={onClose}
            className="rounded-2xl border border-[#1e293b] bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-100 transition-all">
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-2 rounded-2xl bg-brand-green px-6 py-2.5 text-sm font-bold text-[#020617] hover:bg-brand-green/90 disabled:opacity-50 transition-all shadow-lg shadow-brand-green/20">
            {saving ? "Guardando…" : <><CheckIcon /> Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SucursalesTab ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const emptySucursalForm = { nombre: "", direccion: "", telefono: "", ciudad: "", nit: "", capacidad_maxima: "50" };

function SucursalesTab({ showToast }: { showToast: (msg: string) => void }) {
  const [rows, setRows] = useState<SucursalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptySucursalForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const isEditing = editingId !== null;

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("sucursales").select("*").order("id", { ascending: false });
    setRows((data ?? []) as SucursalRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function openCreate() {
    setEditingId(null);
    setForm(emptySucursalForm);
    setErrors({});
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(row: SucursalRow) {
    setEditingId(row.id);
    setForm({
      nombre: row.nombre,
      direccion: row.direccion,
      telefono: row.telefono ?? "",
      ciudad: row.ciudad,
      nit: row.nit ?? "",
      capacidad_maxima: String(row.capacidad_maxima),
    });
    setErrors({});
    setModalError(null);
    setModalOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
    if (!form.direccion.trim()) e.direccion = "La dirección es obligatoria";
    if (!form.ciudad.trim()) e.ciudad = "La ciudad es obligatoria";
    const cap = Number(form.capacidad_maxima);
    if (!form.capacidad_maxima.trim() || isNaN(cap) || cap <= 0 || !Number.isInteger(cap)) {
      e.capacidad_maxima = "Debe ser un entero mayor a 0";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setModalError(null);

    const payload = {
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      telefono: form.telefono.trim() || null,
      ciudad: form.ciudad.trim(),
      nit: form.nit.trim() || null,
      capacidad_maxima: Number(form.capacidad_maxima),
    };

    try {
      if (isEditing) {
        const prev = rows.find((r) => r.id === editingId);
        const { error } = await supabase.from("sucursales").update(payload).eq("id", editingId);
        if (error) throw error;
        await insertLog({
          tabla_afectada: "sucursales",
          registro_id: editingId!,
          operacion: "UPDATE",
          valor_anterior: prev ? (prev as unknown as Record<string, unknown>) : null,
          valor_nuevo: { id: editingId, ...payload } as unknown as Record<string, unknown>,
        });
        showToast("Sucursal actualizada");
      } else {
        const { data, error } = await supabase.from("sucursales").insert({ ...payload, esta_activa: true }).select().single();
        if (error) throw error;
        await insertLog({
          tabla_afectada: "sucursales",
          registro_id: data.id,
          operacion: "INSERT",
          valor_anterior: null,
          valor_nuevo: data as unknown as Record<string, unknown>,
        });
        showToast("Sucursal creada");
      }
      setModalOpen(false);
      await refresh();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEstado(row: SucursalRow) {
    const next = !row.esta_activa;
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, esta_activa: next } : r));
    const { error } = await supabase.from("sucursales").update({ esta_activa: next }).eq("id", row.id);
    if (error) {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, esta_activa: !next } : r));
      return;
    }
    await insertLog({
      tabla_afectada: "sucursales",
      registro_id: row.id,
      operacion: "UPDATE",
      valor_anterior: { ...row, esta_activa: !next } as unknown as Record<string, unknown>,
      valor_nuevo: { ...row, esta_activa: next } as unknown as Record<string, unknown>,
    });
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total sucursales", value: rows.length, color: "text-slate-100" },
          { label: "Activas", value: rows.filter((r) => r.esta_activa).length, color: "text-brand-green" },
          { label: "Inactivas", value: rows.filter((r) => !r.esta_activa).length, color: "text-slate-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? "…" : s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#1e293b] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#1e293b] px-5 py-4">
          <p className="text-sm font-semibold text-slate-100">Listado de sucursales</p>
          <button onClick={openCreate}
            className="flex items-center gap-2 rounded-2xl bg-brand-green px-4 py-2 text-xs font-bold text-[#020617] hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20">
            <PlusIcon /> Nueva Sucursal
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e293b] bg-white/5">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Nombre</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Ciudad</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Teléfono</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">NIT</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Capacidad</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Estado</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-500">Cargando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-500">Sin sucursales registradas.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-[#1e293b]/60 hover:bg-white/5 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-100">{r.nombre}</div>
                    <div className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate">{r.direccion}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-300">{r.ciudad}</td>
                  <td className="px-5 py-4 text-slate-400">{r.telefono ?? "—"}</td>
                  <td className="px-5 py-4 text-slate-400">{r.nit ?? "—"}</td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center rounded-full border border-[#1e293b] bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                      {r.capacidad_maxima}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center"><Badge_Estado activo={r.esta_activa} /></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(r)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#1e293b] bg-white/5 text-slate-400 hover:text-brand-green hover:border-brand-green/40 transition-all opacity-0 group-hover:opacity-100">
                        <PencilIcon />
                      </button>
                      <Toggle checked={r.esta_activa} onChange={() => void toggleEstado(r)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <FormModal
          title={isEditing ? "Editar sucursal" : "Nueva sucursal"}
          kicker={isEditing ? "Editando registro" : "Nuevo registro"}
          onClose={() => setModalOpen(false)}
          onSave={() => void handleSave()}
          saving={saving}
          error={modalError}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nombre" hint="Obligatorio" error={errors.nombre} success={!errors.nombre && !!form.nombre.trim()}>
                <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej. Sede Central" className={inputCls(!!errors.nombre, !errors.nombre && !!form.nombre.trim())} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Dirección" hint="Obligatorio" error={errors.direccion} success={!errors.direccion && !!form.direccion.trim()}>
                <input value={form.direccion} onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                  placeholder="Ej. Av. Banzer #123" className={inputCls(!!errors.direccion, !errors.direccion && !!form.direccion.trim())} />
              </Field>
            </div>
            <Field label="Ciudad" hint="Obligatorio" error={errors.ciudad} success={!errors.ciudad && !!form.ciudad.trim()}>
              <input value={form.ciudad} onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))}
                placeholder="Ej. Santa Cruz" className={inputCls(!!errors.ciudad, !errors.ciudad && !!form.ciudad.trim())} />
            </Field>
            <Field label="Teléfono" hint="Opcional">
              <input value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                placeholder="Ej. 3-3456789" className={inputCls()} />
            </Field>
            <Field label="NIT" hint="Opcional">
              <input value={form.nit} onChange={(e) => setForm((f) => ({ ...f, nit: e.target.value }))}
                placeholder="Ej. 1234567890" className={inputCls()} />
            </Field>
            <Field label="Capacidad máxima" hint="Obligatorio" error={errors.capacidad_maxima} success={!errors.capacidad_maxima && !!form.capacidad_maxima.trim()}>
              <input inputMode="numeric" value={form.capacidad_maxima} onChange={(e) => setForm((f) => ({ ...f, capacidad_maxima: e.target.value }))}
                placeholder="50" className={inputCls(!!errors.capacidad_maxima, !errors.capacidad_maxima && !!form.capacidad_maxima.trim())} />
            </Field>
          </div>
        </FormModal>
      )}
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ─── EmpleadosTab ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const emptyEmpleadoForm = { nombre: "", apellido: "", ci: "", email: "", password: "", rol_id: "", sucursal_id: "" };

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function EmpleadosTab({ showToast }: { showToast: (msg: string) => void }) {
  const [rows, setRows] = useState<EmpleadoRow[]>([]);
  const [roles, setRoles] = useState<RolRow[]>([]);
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyEmpleadoForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const isEditing = editingId !== null;

  const refresh = useCallback(async () => {
    setLoading(true);
    const [empRes, rolRes, sucRes] = await Promise.all([
      supabase.from("empleados").select("*, roles(nombre), sucursales(nombre)").order("id", { ascending: false }),
      supabase.from("roles").select("*").order("nombre"),
      supabase.from("sucursales").select("*").eq("esta_activa", true).order("nombre"),
    ]);
    setRows((empRes.data ?? []) as unknown as EmpleadoRow[]);
    setRoles((rolRes.data ?? []) as RolRow[]);
    setSucursales((sucRes.data ?? []) as SucursalRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyEmpleadoForm);
    setErrors({});
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(row: EmpleadoRow) {
    setEditingId(row.id);
    setForm({
      nombre: row.nombre,
      apellido: row.apellido,
      ci: row.ci,
      email: row.email,
      password: "",
      rol_id: String(row.rol_id),
      sucursal_id: String(row.sucursal_id),
    });
    setErrors({});
    setModalError(null);
    setModalOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
    if (!form.apellido.trim()) e.apellido = "El apellido es obligatorio";
    if (!form.ci.trim()) e.ci = "El CI es obligatorio";
    if (!form.email.trim()) e.email = "El email es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Formato de email inválido";
    if (!isEditing && !form.password.trim()) e.password = "La contraseña es obligatoria";
    if (!form.rol_id) e.rol_id = "Selecciona un rol";
    if (!form.sucursal_id) e.sucursal_id = "Selecciona una sucursal";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setModalError(null);

    try {
      if (isEditing) {
        const prev = rows.find((r) => r.id === editingId);
        const payload = {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          ci: form.ci.trim(),
          email: form.email.trim(),
          rol_id: Number(form.rol_id),
          sucursal_id: Number(form.sucursal_id),
        };
        const { error } = await supabase.from("empleados").update(payload).eq("id", editingId);
        if (error) {
          if (error.code === "23505") {
            if (error.message.includes("ci")) setModalError("El CI ya está registrado");
            else if (error.message.includes("email")) setModalError("El email ya está registrado");
            else setModalError("Registro duplicado");
            setSaving(false);
            return;
          }
          throw error;
        }
        await insertLog({
          tabla_afectada: "empleados",
          registro_id: editingId!,
          operacion: "UPDATE",
          valor_anterior: prev ? (prev as unknown as Record<string, unknown>) : null,
          valor_nuevo: { id: editingId, ...payload } as unknown as Record<string, unknown>,
        });
        showToast("Empleado actualizado");
      } else {
        const password_hash = await hashPassword(form.password.trim());
        const payload = {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          ci: form.ci.trim(),
          email: form.email.trim(),
          password_hash,
          rol_id: Number(form.rol_id),
          sucursal_id: Number(form.sucursal_id),
          es_activo: true,
        };
        const { data, error } = await supabase.from("empleados").insert(payload).select().single();
        if (error) {
          if (error.code === "23505") {
            if (error.message.includes("ci")) setModalError("El CI ya está registrado");
            else if (error.message.includes("email")) setModalError("El email ya está registrado");
            else setModalError("Registro duplicado");
            setSaving(false);
            return;
          }
          throw error;
        }
        await insertLog({
          tabla_afectada: "empleados",
          registro_id: data.id,
          operacion: "INSERT",
          valor_anterior: null,
          valor_nuevo: data as unknown as Record<string, unknown>,
        });
        showToast("Empleado creado");
      }
      setModalOpen(false);
      await refresh();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEstado(row: EmpleadoRow) {
    const next = !row.es_activo;
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, es_activo: next } : r));
    const { error } = await supabase.from("empleados").update({ es_activo: next }).eq("id", row.id);
    if (error) {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, es_activo: !next } : r));
      return;
    }
    await insertLog({
      tabla_afectada: "empleados",
      registro_id: row.id,
      operacion: "UPDATE",
      valor_anterior: { ...row, es_activo: !next } as unknown as Record<string, unknown>,
      valor_nuevo: { ...row, es_activo: next } as unknown as Record<string, unknown>,
    });
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total empleados", value: rows.length, color: "text-slate-100" },
          { label: "Activos", value: rows.filter((r) => r.es_activo).length, color: "text-brand-green" },
          { label: "Inactivos", value: rows.filter((r) => !r.es_activo).length, color: "text-slate-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? "…" : s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#1e293b] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#1e293b] px-5 py-4">
          <p className="text-sm font-semibold text-slate-100">Listado de empleados</p>
          <button onClick={openCreate}
            className="flex items-center gap-2 rounded-2xl bg-brand-green px-4 py-2 text-xs font-bold text-[#020617] hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20">
            <PlusIcon /> Nuevo Empleado
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e293b] bg-white/5">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Nombre completo</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">CI</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Email</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Rol</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Sucursal</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Estado</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-500">Cargando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-500">Sin empleados registrados.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-[#1e293b]/60 hover:bg-white/5 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-100">{r.nombre} {r.apellido}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-300">{r.ci}</td>
                  <td className="px-5 py-4 text-slate-400 max-w-[180px] truncate">{r.email}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-400">
                      {r.roles?.nombre ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-300">{r.sucursales?.nombre ?? "—"}</td>
                  <td className="px-5 py-4 text-center"><Badge_Estado activo={r.es_activo} /></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(r)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#1e293b] bg-white/5 text-slate-400 hover:text-brand-green hover:border-brand-green/40 transition-all opacity-0 group-hover:opacity-100">
                        <PencilIcon />
                      </button>
                      <Toggle checked={r.es_activo} onChange={() => void toggleEstado(r)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <FormModal
          title={isEditing ? "Editar empleado" : "Nuevo empleado"}
          kicker={isEditing ? "Editando registro" : "Nuevo registro"}
          onClose={() => setModalOpen(false)}
          onSave={() => void handleSave()}
          saving={saving}
          error={modalError}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre" hint="Obligatorio" error={errors.nombre} success={!errors.nombre && !!form.nombre.trim()}>
              <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Carlos" className={inputCls(!!errors.nombre, !errors.nombre && !!form.nombre.trim())} />
            </Field>
            <Field label="Apellido" hint="Obligatorio" error={errors.apellido} success={!errors.apellido && !!form.apellido.trim()}>
              <input value={form.apellido} onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
                placeholder="Ej. Mendoza" className={inputCls(!!errors.apellido, !errors.apellido && !!form.apellido.trim())} />
            </Field>
            <Field label="CI" hint="Obligatorio" error={errors.ci} success={!errors.ci && !!form.ci.trim()}>
              <input value={form.ci} onChange={(e) => setForm((f) => ({ ...f, ci: e.target.value }))}
                placeholder="Ej. 7654321" className={inputCls(!!errors.ci, !errors.ci && !!form.ci.trim())} />
            </Field>
            <Field label="Email" hint="Obligatorio" error={errors.email} success={!errors.email && !!form.email.trim()}>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Ej. carlos@gym.com" className={inputCls(!!errors.email, !errors.email && !!form.email.trim())} />
            </Field>
            {!isEditing && (
              <div className="sm:col-span-2">
                <Field label="Contraseña" hint="Obligatorio" error={errors.password} success={!errors.password && !!form.password.trim()}>
                  <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres" className={inputCls(!!errors.password, !errors.password && !!form.password.trim())} />
                </Field>
              </div>
            )}
            <Field label="Rol" hint="Obligatorio" error={errors.rol_id}>
              <select value={form.rol_id} onChange={(e) => setForm((f) => ({ ...f, rol_id: e.target.value }))}
                className={["w-full appearance-none rounded-2xl border bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none transition-colors",
                  errors.rol_id ? "border-red-500/60" : "border-[#1e293b] focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green/50"].join(" ")}>
                <option value="">Seleccionar rol…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </Field>
            <Field label="Sucursal" hint="Obligatorio" error={errors.sucursal_id}>
              <select value={form.sucursal_id} onChange={(e) => setForm((f) => ({ ...f, sucursal_id: e.target.value }))}
                className={["w-full appearance-none rounded-2xl border bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none transition-colors",
                  errors.sucursal_id ? "border-red-500/60" : "border-[#1e293b] focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green/50"].join(" ")}>
                <option value="">Seleccionar sucursal…</option>
                {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Field>
          </div>
        </FormModal>
      )}
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ─── RolesTab ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const emptyRolForm = {
  nombre: "",
  descripcion: "",
  permiso_ver_finanzas: false,
  permiso_editar_usuarios: false,
  permiso_gestionar_asistencias: true,
};

function RolesTab({ showToast }: { showToast: (msg: string) => void }) {
  const [rows, setRows] = useState<RolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyRolForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<{ rolId: number; rolName: string; count: number } | null>(null);

  const isEditing = editingId !== null;

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("roles").select("*").order("id", { ascending: false });
    setRows((data ?? []) as RolRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyRolForm);
    setErrors({});
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(row: RolRow) {
    setEditingId(row.id);
    setForm({
      nombre: row.nombre,
      descripcion: row.descripcion ?? "",
      permiso_ver_finanzas: row.permiso_ver_finanzas,
      permiso_editar_usuarios: row.permiso_editar_usuarios,
      permiso_gestionar_asistencias: row.permiso_gestionar_asistencias,
    });
    setErrors({});
    setModalError(null);
    setModalOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setModalError(null);

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      permiso_ver_finanzas: form.permiso_ver_finanzas,
      permiso_editar_usuarios: form.permiso_editar_usuarios,
      permiso_gestionar_asistencias: form.permiso_gestionar_asistencias,
    };

    try {
      if (isEditing) {
        const prev = rows.find((r) => r.id === editingId);
        const { error } = await supabase.from("roles").update(payload).eq("id", editingId);
        if (error) {
          if (error.code === "23505") {
            setModalError("El nombre de rol ya existe");
            setSaving(false);
            return;
          }
          throw error;
        }
        await insertLog({
          tabla_afectada: "roles",
          registro_id: editingId!,
          operacion: "UPDATE",
          valor_anterior: prev ? (prev as unknown as Record<string, unknown>) : null,
          valor_nuevo: { id: editingId, ...payload } as unknown as Record<string, unknown>,
        });
        showToast("Rol actualizado");
      } else {
        const { data, error } = await supabase.from("roles").insert(payload).select().single();
        if (error) {
          if (error.code === "23505") {
            setModalError("El nombre de rol ya existe");
            setSaving(false);
            return;
          }
          throw error;
        }
        await insertLog({
          tabla_afectada: "roles",
          registro_id: data.id,
          operacion: "INSERT",
          valor_anterior: null,
          valor_nuevo: data as unknown as Record<string, unknown>,
        });
        showToast("Rol creado");
      }
      setModalOpen(false);
      await refresh();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function tryDelete(row: RolRow) {
    // Check if role has employees
    const { count } = await supabase.from("empleados").select("id", { count: "exact", head: true }).eq("rol_id", row.id);
    if (count && count > 0) {
      setDeleteWarning({ rolId: row.id, rolName: row.nombre, count });
      return;
    }
    // Safe to delete
    const { error } = await supabase.from("roles").delete().eq("id", row.id);
    if (error) {
      showToast("Error al eliminar rol");
      return;
    }
    await insertLog({
      tabla_afectada: "roles",
      registro_id: row.id,
      operacion: "DELETE",
      valor_anterior: row as unknown as Record<string, unknown>,
      valor_nuevo: null,
    });
    showToast("Rol eliminado");
    await refresh();
  }

  const PERMISOS: { key: keyof typeof emptyRolForm; label: string }[] = [
    { key: "permiso_ver_finanzas", label: "Ver Finanzas" },
    { key: "permiso_editar_usuarios", label: "Editar Usuarios" },
    { key: "permiso_gestionar_asistencias", label: "Gestionar Asistencias" },
  ];

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total roles", value: rows.length, color: "text-slate-100" },
          { label: "Con permisos completos", value: rows.filter((r) => r.permiso_ver_finanzas && r.permiso_editar_usuarios && r.permiso_gestionar_asistencias).length, color: "text-brand-green" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? "…" : s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#1e293b] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#1e293b] px-5 py-4">
          <p className="text-sm font-semibold text-slate-100">Listado de roles</p>
          <button onClick={openCreate}
            className="flex items-center gap-2 rounded-2xl bg-brand-green px-4 py-2 text-xs font-bold text-[#020617] hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20">
            <PlusIcon /> Nuevo Rol
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e293b] bg-white/5">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Nombre</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Descripción</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Permisos</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-16 text-center text-sm text-slate-500">Cargando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="py-16 text-center text-sm text-slate-500">Sin roles registrados.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-[#1e293b]/60 hover:bg-white/5 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-100">{r.nombre}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-400 max-w-[200px] truncate">{r.descripcion ?? "—"}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { active: r.permiso_ver_finanzas, label: "Finanzas" },
                        { active: r.permiso_editar_usuarios, label: "Usuarios" },
                        { active: r.permiso_gestionar_asistencias, label: "Asistencias" },
                      ].map((p) => (
                        <span key={p.label} className={[
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          p.active
                            ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
                            : "border-[#1e293b] bg-white/5 text-slate-500",
                        ].join(" ")}>
                          {p.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(r)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#1e293b] bg-white/5 text-slate-400 hover:text-brand-green hover:border-brand-green/40 transition-all opacity-0 group-hover:opacity-100">
                        <PencilIcon />
                      </button>
                      <button onClick={() => void tryDelete(r)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#1e293b] bg-white/5 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all opacity-0 group-hover:opacity-100">
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete warning modal */}
      {deleteWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteWarning(null)} aria-label="Cerrar" />
          <div className="relative w-full max-w-sm rounded-[28px] border border-[#1e293b] bg-[#020617] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-400 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-bold text-slate-100">No se puede eliminar</p>
                <p className="text-xs text-slate-400">El rol &quot;{deleteWarning.rolName}&quot; tiene {deleteWarning.count} empleado{deleteWarning.count !== 1 ? "s" : ""} asignado{deleteWarning.count !== 1 ? "s" : ""}.</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Reasigna los empleados a otro rol antes de eliminar este.</p>
            <button onClick={() => setDeleteWarning(null)}
              className="w-full rounded-2xl border border-[#1e293b] bg-white/5 py-2.5 text-sm font-semibold text-slate-300 hover:text-slate-100 transition-all">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <FormModal
          title={isEditing ? "Editar rol" : "Nuevo rol"}
          kicker={isEditing ? "Editando registro" : "Nuevo registro"}
          onClose={() => setModalOpen(false)}
          onSave={() => void handleSave()}
          saving={saving}
          error={modalError}
        >
          <div className="space-y-4">
            <Field label="Nombre del rol" hint="Obligatorio, único" error={errors.nombre} success={!errors.nombre && !!form.nombre.trim()}>
              <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Administrador" className={inputCls(!!errors.nombre, !errors.nombre && !!form.nombre.trim())} />
            </Field>
            <Field label="Descripción" hint="Opcional">
              <input value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Descripción del rol…" className={inputCls()} />
            </Field>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Permisos</label>
              <div className="mt-2 space-y-3">
                {PERMISOS.map((p) => (
                  <div key={p.key} className="flex items-center justify-between rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
                    <span className="text-sm text-slate-300">{p.label}</span>
                    <Toggle
                      checked={form[p.key] as boolean}
                      onChange={(v) => setForm((f) => ({ ...f, [p.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FormModal>
      )}
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ─── AjustesTab ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function AjustesTab({ showToast }: { showToast: (msg: string) => void }) {
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [capacidad, setCapacidad] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    supabase.from("sucursales").select("*").eq("esta_activa", true).order("nombre").then(({ data }) => {
      const list = (data ?? []) as SucursalRow[];
      setSucursales(list);
      if (list.length > 0) {
        setSelectedId(list[0].id);
        setCapacidad(String(list[0].capacidad_maxima));
      }
      setLoading(false);
    });
  }, []);

  function handleSelect(id: number) {
    setSelectedId(id);
    const suc = sucursales.find((s) => s.id === id);
    if (suc) setCapacidad(String(suc.capacidad_maxima));
    setError(null);
  }

  async function handleSave() {
    const cap = Number(capacidad);
    if (!capacidad.trim() || isNaN(cap) || cap <= 0 || !Number.isInteger(cap)) {
      setError("La capacidad debe ser un entero mayor a 0");
      return;
    }
    if (!selectedId) return;
    setSaving(true);
    setError(null);

    const prev = sucursales.find((s) => s.id === selectedId);
    const { error: dbError } = await supabase.from("sucursales").update({ capacidad_maxima: cap }).eq("id", selectedId);
    setSaving(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    // Update local state
    setSucursales((prev) => prev.map((s) => s.id === selectedId ? { ...s, capacidad_maxima: cap } : s));

    await insertLog({
      tabla_afectada: "sucursales",
      registro_id: selectedId,
      operacion: "UPDATE",
      valor_anterior: prev ? { capacidad_maxima: prev.capacidad_maxima } as unknown as Record<string, unknown> : null,
      valor_nuevo: { capacidad_maxima: cap } as unknown as Record<string, unknown>,
    });

    showToast("Ajustes guardados correctamente");
  }

  if (loading) {
    return <div className="text-center py-16 text-sm text-slate-500">Cargando ajustes…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Sucursal selector */}
      <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-6 space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Configuración por sucursal</p>
          <p className="text-sm text-slate-400 mt-1">Selecciona una sucursal para ver y editar sus ajustes.</p>
        </div>

        <Field label="Sucursal">
          <select
            value={selectedId ?? ""}
            onChange={(e) => handleSelect(Number(e.target.value))}
            className="w-full appearance-none rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green/50"
          >
            {sucursales.length === 0 && <option value="">Sin sucursales activas</option>}
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre} — {s.ciudad}</option>
            ))}
          </select>
        </Field>
      </div>

      {selectedId && (
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-6 space-y-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Ajustes de la sucursal</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Capacidad máxima" hint="Editable" error={error ?? undefined} success={!error && !!capacidad.trim()}>
              <input
                inputMode="numeric"
                value={capacidad}
                onChange={(e) => { setCapacidad(e.target.value); setError(null); }}
                placeholder="50"
                className={inputCls(!!error, !error && !!capacidad.trim())}
              />
            </Field>

            <Field label="Zona horaria" hint="Solo lectura">
              <input
                value="America/La_Paz"
                readOnly
                className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220]/60 px-4 py-3 text-sm text-slate-400 outline-none cursor-default"
              />
            </Field>

            <Field label="Moneda" hint="Solo lectura">
              <input
                value="BOB (Boliviano)"
                readOnly
                className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220]/60 px-4 py-3 text-sm text-slate-400 outline-none cursor-default"
              />
            </Field>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => void handleSave()} disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-brand-green px-5 py-2.5 text-sm font-bold text-[#020617] hover:bg-brand-green/90 disabled:opacity-50 transition-all shadow-lg shadow-brand-green/20">
              {saving ? "Guardando…" : <><CheckIcon /> Guardar ajustes</>}
            </button>
          </div>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">🕐 Zona horaria</p>
          <p className="text-sm font-bold text-slate-100">America/La_Paz (GMT-4)</p>
          <p className="text-xs text-slate-500">Todas las fechas y horas del sistema usan esta zona horaria.</p>
        </div>
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">💰 Moneda predeterminada</p>
          <p className="text-sm font-bold text-slate-100">BOB — Boliviano</p>
          <p className="text-xs text-slate-500">Los montos se muestran en bolivianos por defecto. También se soporta USD.</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FacturacionTab ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function FacturacionTab({ showToast }: { showToast: (msg: string) => void }) {
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ nit: "", razon_social: "", cufd: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    supabase.from("sucursales").select("*").eq("esta_activa", true).order("nombre").then(({ data }) => {
      const list = (data ?? []) as SucursalRow[];
      setSucursales(list);
      if (list.length > 0) {
        setSelectedId(list[0].id);
        loadForm(list[0]);
      }
      setLoading(false);
    });
  }, []);

  function loadForm(suc: SucursalRow) {
    setForm({
      nit: suc.nit ?? "",
      razon_social: suc.razon_social ?? "",
      cufd: suc.cufd ?? "",
    });
    setError(null);
  }

  function handleSelect(id: number) {
    setSelectedId(id);
    const suc = sucursales.find((s) => s.id === id);
    if (suc) loadForm(suc);
  }

  async function handleSave() {
    if (!selectedId) return;
    if (!form.nit.trim()) { setError("El NIT es obligatorio para facturación"); return; }
    if (!form.razon_social.trim()) { setError("La razón social es obligatoria"); return; }

    setSaving(true);
    setError(null);

    const payload = {
      nit: form.nit.trim(),
      razon_social: form.razon_social.trim(),
      cufd: form.cufd.trim() || null,
    };

    const prev = sucursales.find((s) => s.id === selectedId);
    const { error: dbError } = await supabase.from("sucursales").update(payload).eq("id", selectedId);
    setSaving(false);

    if (dbError) { setError(dbError.message); return; }

    setSucursales((prev) => prev.map((s) => s.id === selectedId ? { ...s, ...payload } : s));

    await insertLog({
      tabla_afectada: "sucursales",
      registro_id: selectedId,
      operacion: "UPDATE",
      valor_anterior: prev ? { nit: prev.nit, razon_social: prev.razon_social, cufd: prev.cufd } as unknown as Record<string, unknown> : null,
      valor_nuevo: payload as unknown as Record<string, unknown>,
    });

    showToast("Datos de facturación guardados");
  }

  if (loading) return <div className="text-center py-16 text-sm text-slate-500">Cargando…</div>;

  return (
    <div className="space-y-6">
      {/* Sucursal selector */}
      <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-6 space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Datos de facturación por sucursal</p>
          <p className="text-sm text-slate-400 mt-1">Configura los datos fiscales que aparecen en las facturas emitidas.</p>
        </div>
        <Field label="Sucursal">
          <select value={selectedId ?? ""} onChange={(e) => handleSelect(Number(e.target.value))}
            className="w-full appearance-none rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green/50">
            {sucursales.length === 0 && <option value="">Sin sucursales activas</option>}
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre} — {s.ciudad}</option>)}
          </select>
        </Field>
      </div>

      {selectedId && (
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-6 space-y-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Datos fiscales del emisor</p>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">{error}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="NIT del emisor" hint="Obligatorio" success={!!form.nit.trim()}>
              <input value={form.nit} onChange={(e) => setForm((f) => ({ ...f, nit: e.target.value }))}
                placeholder="Ej. 1234567890" className={inputCls(false, !!form.nit.trim())} />
            </Field>
            <Field label="Razón social" hint="Obligatorio" success={!!form.razon_social.trim()}>
              <input value={form.razon_social} onChange={(e) => setForm((f) => ({ ...f, razon_social: e.target.value }))}
                placeholder="Ej. BODY XTREME GYM S.R.L." className={inputCls(false, !!form.razon_social.trim())} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="CUF" hint="Código Único de Facturación">
                <input value={form.cufd} onChange={(e) => setForm((f) => ({ ...f, cufd: e.target.value }))}
                  placeholder="Ej. BQUFBQUFBQUxCT0..." className={inputCls()} />
              </Field>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => void handleSave()} disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-brand-green px-5 py-2.5 text-sm font-bold text-[#020617] hover:bg-brand-green/90 disabled:opacity-50 transition-all shadow-lg shadow-brand-green/20">
              {saving ? "Guardando…" : <><CheckIcon /> Guardar datos fiscales</>}
            </button>
          </div>
        </div>
      )}

      {/* Leyenda normativa */}
      <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">📜 Leyenda normativa (no editable)</p>
        <p className="text-xs text-slate-400 italic">&quot;Esta factura contribuye al desarrollo del país, el uso ilícito será sancionado penalmente de acuerdo a Ley.&quot;</p>
        <p className="text-xs text-slate-400 italic">&quot;Ley N° 453: El proveedor debe emitir factura, nota fiscal o documento equivalente.&quot;</p>
        <p className="text-[10px] text-slate-600 mt-1">Esta leyenda es obligatoria por normativa del SIN y se incluye automáticamente en todas las facturas.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Main Page ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<TabId>("sucursales");
  const [toast, setToast] = useState({ open: false, message: "" });

  const showToast = useCallback((message: string) => {
    setToast({ open: true, message });
  }, []);

  return (
    <div className="space-y-6">
      <Toast open={toast.open} message={toast.message} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div>
          <div className="section-kicker">Sistema</div>
          <h1 className="section-title">Configuración</h1>
          <p className="section-description">Administra sucursales, empleados, roles y ajustes del sistema.</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="rounded-2xl border border-[#1e293b] bg-[#0b1220] p-1 w-fit">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "rounded-xl px-6 py-2 text-sm font-semibold transition-all",
                activeTab === tab.id
                  ? "bg-brand-green/15 text-brand-green border border-brand-green/30"
                  : "text-slate-400 hover:text-slate-200 border border-transparent",
              ].join(" ")}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "sucursales" && <SucursalesTab showToast={showToast} />}
      {activeTab === "empleados" && <EmpleadosTab showToast={showToast} />}
      {activeTab === "roles" && <RolesTab showToast={showToast} />}
      {activeTab === "facturacion" && <FacturacionTab showToast={showToast} />}
      {activeTab === "ajustes" && <AjustesTab showToast={showToast} />}
    </div>
  );
}

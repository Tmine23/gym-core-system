"use client";

import { Button, Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Text, Title } from "@tremor/react";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

type PlanRow = {
  id: string | number;
  nombre: string | null;
  descripcion: string | null;
  monto: number | null;
  codigo_moneda: "BOB" | "USD" | null;
  duracion_dias: number | null;
  permite_todas_sucursales: boolean | null;
  activo: boolean | null;
};

type PlanForm = {
  nombre: string;
  descripcion: string;
  monto: string;
  codigo_moneda: "BOB" | "USD";
  duracion_dias: string;
  permite_todas_sucursales: boolean;
};

const initialForm: PlanForm = {
  nombre: "",
  descripcion: "",
  monto: "",
  codigo_moneda: "BOB",
  duracion_dias: "",
  permite_todas_sucursales: false,
};

function normalizeDecimal(value: string) {
  return value.replace(",", ".").trim();
}

function validatePlanForm(form: PlanForm) {
  const errors: Partial<Record<keyof PlanForm, string>> = {};

  if (!form.nombre.trim()) errors.nombre = "El nombre es obligatorio.";

  const price = Number(normalizeDecimal(form.monto));
  if (!form.monto.trim()) errors.monto = "El monto es obligatorio.";
  else if (!Number.isFinite(price) || price <= 0) errors.monto = "El monto debe ser un número mayor a 0.";

  const days = Number(form.duracion_dias.trim());
  if (!form.duracion_dias.trim()) errors.duracion_dias = "La duración en días es obligatoria.";
  else if (!Number.isInteger(days) || days <= 0) errors.duracion_dias = "La duración debe ser un entero mayor a 0.";

  return errors;
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m12 3 9 4.5-9 4.5L3 7.5 12 3Z" />
      <path d="m3 12.5 9 4.5 9-4.5" />
      <path d="m3 17 9 4.5 9-4.5" />
    </svg>
  );
}

function StatusToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? "Desactivar plan" : "Activar plan"}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-7 w-12 items-center rounded-full border transition-all",
        "focus:outline-none focus:ring-2 focus:ring-brand-green/50",
        checked ? "border-brand-green/50 bg-brand-green/15" : "border-[#1e293b] bg-[#0b1220]",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-5 w-5 transform rounded-full transition-transform",
          "shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
          checked ? "translate-x-6 bg-brand-green" : "translate-x-1 bg-slate-400",
        ].join(" ")}
      />
    </button>
  );
}

export default function PlanesPage() {
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [form, setForm] = useState<PlanForm>(initialForm);
  const [touched, setTouched] = useState<Partial<Record<keyof PlanForm, boolean>>>({});

  const formErrors = useMemo(() => validatePlanForm(form), [form]);

  const isEditing = editingId != null;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("planes")
        .select("id,nombre,descripcion,monto,codigo_moneda,duracion_dias,permite_todas_sucursales,activo")
        .order("id", { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      setRows((data ?? []) as PlanRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function clearForm() {
    setForm(initialForm);
    setTouched({});
    setEditingId(null);
  }

  function markAllTouched() {
    setTouched({
      nombre: true,
      descripcion: true,
      monto: true,
      codigo_moneda: true,
      duracion_dias: true,
      permite_todas_sucursales: true,
    });
  }

  function openEdit(row: PlanRow) {
    setEditingId(row.id);
    setForm({
      nombre: row.nombre ?? "",
      descripcion: row.descripcion ?? "",
      monto: row.monto != null ? String(row.monto) : "",
      codigo_moneda: row.codigo_moneda === "USD" ? "USD" : "BOB",
      duracion_dias: row.duracion_dias != null ? String(row.duracion_dias) : "",
      permite_todas_sucursales: row.permite_todas_sucursales ?? false,
    });
    setTouched({});
  }

  async function handleCreateOrUpdate() {
    setError(null);
    markAllTouched();

    if (Object.keys(formErrors).length > 0) return;

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      monto: Number(normalizeDecimal(form.monto)),
      codigo_moneda: form.codigo_moneda,
      duracion_dias: Number(form.duracion_dias.trim()),
      permite_todas_sucursales: form.permite_todas_sucursales,
      activo: true,
    };

    setSaving(true);
    try {
      if (isEditing) {
        const { error: updateError } = await supabase.from("planes").update(payload).eq("id", editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("planes").insert(payload);
        if (insertError) throw insertError;
      }
      clearForm();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCobertura(id: string | number, next: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, permite_todas_sucursales: next } : r)));
    const { error: updateError } = await supabase
      .from("planes")
      .update({ permite_todas_sucursales: next })
      .eq("id", id);
    if (updateError) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, permite_todas_sucursales: !next } : r)));
      setError(updateError.message);
    }
  }

  async function toggleActivo(id: string | number, next: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, activo: next } : r)));
    const { error: updateError } = await supabase.from("planes").update({ activo: next }).eq("id", id);
    if (updateError) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, activo: !next } : r)));
      setError(updateError.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="section-kicker">Planes</div>
        <h1 className="section-title">Gestión de planes</h1>
        <p className="section-description">Administra nombre, monto, moneda, duración y estado de cada plan.</p>
      </div>

      <Card className="rounded-2xl border border-[#1e293b] bg-white/5 text-slate-100">
        <Title className="text-slate-100">{isEditing ? "Editar plan" : "Nuevo plan"}</Title>
        <Text className="text-slate-400">Define monto, moneda, duración y cobertura por sucursal.</Text>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-6">
          {/* Nombre */}
          <div className="md:col-span-3">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Nombre del plan</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
              onBlur={() => setTouched((prev) => ({ ...prev, nombre: true }))}
              placeholder="Ej. Mensual, Trimestral, VIP..."
              className={[
                "mt-2 w-full rounded-2xl border bg-[#0b1220] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all duration-200",
                "focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green/60",
                touched.nombre && formErrors.nombre
                  ? "border-red-500/60"
                  : touched.nombre && !formErrors.nombre
                  ? "border-brand-green/50"
                  : "border-[#1e293b] hover:border-slate-600",
              ].join(" ")}
            />
            {touched.nombre && formErrors.nombre ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400 animate-[shake_0.3s_ease]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />{formErrors.nombre}
              </p>
            ) : null}
          </div>

          {/* Duración */}
          <div className="md:col-span-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Días</label>
            <input
              inputMode="numeric"
              value={form.duracion_dias}
              onChange={(e) => setForm((prev) => ({ ...prev, duracion_dias: e.target.value }))}
              onBlur={() => setTouched((prev) => ({ ...prev, duracion_dias: true }))}
              placeholder="30"
              className={[
                "mt-2 w-full rounded-2xl border bg-[#0b1220] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all duration-200",
                "focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green/60",
                touched.duracion_dias && formErrors.duracion_dias
                  ? "border-red-500/60"
                  : touched.duracion_dias && !formErrors.duracion_dias
                  ? "border-brand-green/50"
                  : "border-[#1e293b] hover:border-slate-600",
              ].join(" ")}
            />
            {touched.duracion_dias && formErrors.duracion_dias ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400 animate-[shake_0.3s_ease]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />{formErrors.duracion_dias}
              </p>
            ) : null}
          </div>

          {/* Monto */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Monto</label>
            <input
              inputMode="decimal"
              value={form.monto}
              onChange={(e) => setForm((prev) => ({ ...prev, monto: e.target.value }))}
              onBlur={() => setTouched((prev) => ({ ...prev, monto: true }))}
              placeholder="120.00"
              className={[
                "mt-2 w-full rounded-2xl border bg-[#0b1220] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all duration-200",
                "focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green/60",
                touched.monto && formErrors.monto
                  ? "border-red-500/60"
                  : touched.monto && !formErrors.monto
                  ? "border-brand-green/50"
                  : "border-[#1e293b] hover:border-slate-600",
              ].join(" ")}
            />
            {touched.monto && formErrors.monto ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400 animate-[shake_0.3s_ease]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />{formErrors.monto}
              </p>
            ) : null}
          </div>

          {/* Moneda — cards visuales */}
          <div className="md:col-span-3">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Moneda</label>
            <div className="mt-2 flex gap-2">
              {(["BOB", "USD"] as const).map((cur) => {
                const active = form.codigo_moneda === cur;
                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, codigo_moneda: cur }))}
                    className={[
                      "flex flex-1 flex-col items-center gap-0.5 rounded-2xl border py-3 text-xs font-semibold transition-all duration-200",
                      active
                        ? "border-brand-green/40 bg-brand-green/10 text-brand-green shadow-[0_0_0_1px_rgba(118,203,62,0.2)]"
                        : "border-[#1e293b] bg-[#0b1220] text-slate-400 hover:border-slate-600 hover:text-slate-200",
                    ].join(" ")}
                  >
                    <span className="text-base font-bold">{cur === "BOB" ? "Bs" : "$"}</span>
                    <span className="text-[10px] opacity-70">{cur}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cobertura — toggle visual */}
          <div className="md:col-span-3">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Cobertura</label>
            <div className="mt-2 flex gap-2">
              {([
                { val: false, label: "Una sucursal", icon: "🏠" },
                { val: true, label: "Todas", icon: "🌐" },
              ] as const).map(({ val, label, icon }) => {
                const active = form.permite_todas_sucursales === val;
                return (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, permite_todas_sucursales: val }))}
                    className={[
                      "flex flex-1 flex-col items-center gap-0.5 rounded-2xl border py-3 text-xs font-semibold transition-all duration-200",
                      active
                        ? "border-brand-green/40 bg-brand-green/10 text-brand-green shadow-[0_0_0_1px_rgba(118,203,62,0.2)]"
                        : "border-[#1e293b] bg-[#0b1220] text-slate-400 hover:border-slate-600 hover:text-slate-200",
                    ].join(" ")}
                  >
                    <span className="text-base">{icon}</span>
                    <span className="text-[10px] opacity-80">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descripción */}
          <div className="md:col-span-6">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Descripción <span className="normal-case text-slate-600">(opcional)</span></label>
            <input
              value={form.descripcion}
              onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              placeholder="Beneficios, restricciones, notas del plan..."
              className="mt-2 w-full rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all duration-200 hover:border-slate-600 focus:border-brand-green/60 focus:ring-2 focus:ring-brand-green/50"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            loading={saving}
            onClick={() => void handleCreateOrUpdate()}
            className="rounded-full border border-brand-green bg-brand-green px-6 text-black hover:opacity-90 shadow-[0_4px_20px_rgba(118,203,62,0.2)] transition-all"
          >
            {isEditing ? "Guardar cambios" : "Crear plan"}
          </Button>
          {isEditing ? (
            <Button
              variant="secondary"
              onClick={clearForm}
              className="rounded-full border border-[#1e293b] bg-white/5 px-5 text-slate-300 hover:bg-white/10 hover:text-slate-100"
            >
              Cancelar edición
            </Button>
          ) : null}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-[#1e293b] bg-[#0b1220] p-4 text-sm text-slate-300">
            <span className="font-semibold text-slate-100">Error:</span> {error}
          </div>
        ) : null}
      </Card>

      <Card className="rounded-2xl border border-[#1e293b] bg-white/5 text-slate-100">
        <Title className="text-slate-100">Listado</Title>
        <Text className="text-slate-400">Hasta 100 planes, ordenados por registro reciente.</Text>

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow className="bg-white/5">
                <TableHeaderCell className="text-slate-300">Plan</TableHeaderCell>
                <TableHeaderCell className="text-slate-300">Monto</TableHeaderCell>
                <TableHeaderCell className="text-slate-300">Duración</TableHeaderCell>
                <TableHeaderCell className="text-slate-300">Estado</TableHeaderCell>
                <TableHeaderCell className="text-slate-300">Cobertura</TableHeaderCell>
                <TableHeaderCell className="text-slate-300">Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-white/0">
                  <TableCell className="text-slate-400 px-6 py-6">Cargando…</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                </TableRow>
              ) : rows.length ? (
                rows.map((r) => (
                  <TableRow key={String(r.id)} className="transition-colors hover:bg-white/5">
                    <TableCell className="px-6 py-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{r.nombre ?? "-"}</div>
                        {r.descripcion ? <div className="mt-0.5 text-xs text-slate-500 truncate">{r.descripcion}</div> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300 px-6 py-4">
                      {r.monto != null ? `${r.monto} ${r.codigo_moneda ?? "BOB"}` : "-"}
                    </TableCell>
                    <TableCell className="text-slate-300 px-6 py-4">
                      {r.duracion_dias != null ? `${r.duracion_dias} días` : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 px-6 py-4">
                        <StatusToggle checked={Boolean(r.activo)} onChange={(next) => void toggleActivo(r.id, next)} />
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                            r.activo
                              ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
                              : "border-[#1e293b] bg-white/5 text-slate-300",
                          ].join(" ")}
                        >
                          {r.activo ? "ACTIVO" : "INACTIVO"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => void toggleCobertura(r.id, !(r.permite_todas_sucursales ?? false))}
                          className={[
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                            r.permite_todas_sucursales
                              ? "border-brand-green/30 bg-brand-green/10 text-brand-green hover:bg-brand-green/15"
                              : "border-[#1e293b] bg-white/5 text-slate-300 hover:bg-white/10",
                          ].join(" ")}
                          title="Clic para cambiar cobertura"
                        >
                          <LayersIcon className="h-3.5 w-3.5" />
                          {r.permite_todas_sucursales ? "Todas las sucursales" : "Solo una sucursal"}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 px-6 py-4">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-100 hover:bg-white/10"
                          title="Editar"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-slate-400 px-6 py-10">Sin planes registrados</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}


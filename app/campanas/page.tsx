"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabCampana = "crear" | "historial";
type Genero = "todos" | "M" | "F" | "O";
type Antiguedad = "todos" | "nuevos" | "veteranos";
type EstadoSub = "todos" | "suscrito" | "no_suscrito";

type SocioCampana = {
  id: number; nombre: string | null; apellido: string | null;
  whatsapp: string | null; codigo_telefono: string | null;
  genero: string | null; nacionalidad: string | null; fecha_registro: string | null;
  suscrito: boolean | null;
};

type HistorialItem = {
  id: number; socio_nombre: string; segmento: string;
  mensaje: string; estado: string; fecha_envio: string;
  media_tipo: string | null;
};

type EnvioResult = { id: number; nombre: string; estado: "ok" | "error" | "pending" };

// ─── Constants ────────────────────────────────────────────────────────────────

const TZ = "America/La_Paz";
const PAISES: Record<string, { name: string; flag: string }> = {
  BO: { name: "Bolivia", flag: "🇧🇴" }, PE: { name: "Perú", flag: "🇵🇪" },
  CO: { name: "Colombia", flag: "🇨🇴" }, AR: { name: "Argentina", flag: "🇦🇷" },
  CL: { name: "Chile", flag: "🇨🇱" }, BR: { name: "Brasil", flag: "🇧🇷" },
  EC: { name: "Ecuador", flag: "🇪🇨" }, PY: { name: "Paraguay", flag: "🇵🇾" },
  VE: { name: "Venezuela", flag: "🇻🇪" }, MX: { name: "México", flag: "🇲🇽" },
};

const TEMPLATES = [
  { id: "custom", label: "✏️ Personalizado", text: "" },
  { id: "promo", label: "🎉 Promoción general", text: "Hola {nombre}, tenemos una promoción especial para ti. ¡Visítanos y aprovecha! 💪🏋️" },
  { id: "mujer", label: "👩 Día de la mujer", text: "Hola {nombre}, ¡feliz día! 🌸 Como mujer fuerte que eres, te regalamos un descuento especial. ¡Te esperamos!" },
  { id: "aniversario", label: "🎂 Aniversario del gym", text: "Hola {nombre}, estamos de aniversario y queremos celebrar contigo. ¡Descuentos especiales esta semana! 🎉" },
  { id: "veterano", label: "🏆 Socios veteranos", text: "Hola {nombre}, gracias por ser parte de nuestra familia desde hace tanto tiempo. ¡Tienes un beneficio exclusivo esperándote! 🏆" },
  { id: "bienvenida", label: "👋 Bienvenida nuevos", text: "Hola {nombre}, ¡bienvenido/a al gym! Estamos felices de tenerte. Si necesitas algo no dudes en preguntar. 💪" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SendIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></svg>; }
function CheckIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>; }
function XIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function RefreshIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>; }
function ImageIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>; }
function FileIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>; }
function WhatsAppIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>; }

// ─── Modal de Envío ───────────────────────────────────────────────────────────

function ModalEnvioCampana({ socios, mensaje, archivo, onClose, onSent }: {
  socios: SocioCampana[]; mensaje: string; archivo: File | null;
  onClose: () => void; onSent: () => void;
}) {
  const conWA = socios.filter((s) => s.whatsapp);
  const [waStatus, setWaStatus] = useState("connecting");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<EnvioResult[]>(
    conWA.map((s) => ({ id: s.id, nombre: [s.nombre, s.apellido].filter(Boolean).join(" "), estado: "pending" }))
  );
  const [iniciado, setIniciado] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    async function poll() {
      try {
        const res = await fetch("/api/whatsapp/status");
        const data = await res.json() as { status: string; qr: string | null };
        setWaStatus(data.status); setQrDataUrl(data.qr);
        if (data.status === "connected") clearInterval(interval);
      } catch { /* ignore */ }
    }
    void poll();
    interval = setInterval(() => void poll(), 3000);
    return () => clearInterval(interval);
  }, []);

  async function enviar() {
    setEnviando(true); setIniciado(true);
    for (const socio of conWA) {
      const texto = mensaje.replace(/\{nombre\}/g, socio.nombre ?? "socio");
      const numero = `${socio.codigo_telefono ?? "591"}${(socio.whatsapp ?? "").replace(/\D/g, "")}`;
      try {
        let res: Response;
        if (archivo) {
          const fd = new FormData();
          fd.append("phone", numero);
          fd.append("caption", texto);
          fd.append("file", archivo);
          res = await fetch("/api/whatsapp/send-media", { method: "POST", body: fd });
        } else {
          res = await fetch("/api/whatsapp/send", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: numero, text: texto }),
          });
        }
        const estado = res.ok ? "ok" : "error";
        setResultados((prev) => prev.map((r) => r.id === socio.id ? { ...r, estado } : r));
        if (res.ok) {
          await supabase.from("campanas_envios").insert({
            socio_id: socio.id, segmento: "campana_marketing", mensaje: texto, estado: "enviado",
            media_tipo: archivo ? (archivo.type.startsWith("image/") ? "imagen" : "documento") : null,
          });
        }
      } catch {
        setResultados((prev) => prev.map((r) => r.id === socio.id ? { ...r, estado: "error" } : r));
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    setEnviando(false); onSent();
  }

  const okCount = resultados.filter((r) => r.estado === "ok").length;
  const errCount = resultados.filter((r) => r.estado === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl border border-[#1e293b] bg-[#020617] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e293b] px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-green-500/25 bg-green-500/10 text-green-400"><WhatsAppIcon /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Enviar campaña</p>
              <p className="text-sm font-bold text-slate-100">📨 Marketing · {conWA.length} socios</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={["inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              waStatus === "connected" ? "border-brand-green/30 bg-brand-green/10 text-brand-green" : "border-amber-400/30 bg-amber-400/10 text-amber-400"].join(" ")}>
              <span className={["h-1.5 w-1.5 rounded-full", waStatus === "connected" ? "bg-brand-green" : "bg-amber-400 animate-pulse"].join(" ")} />
              {waStatus === "connected" ? "Conectado" : "Conectando…"}
            </span>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"><XIcon /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {waStatus !== "connected" && !iniciado && qrDataUrl && (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-center space-y-3">
              <p className="text-sm font-semibold text-amber-300">Escanea el QR con WhatsApp</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR" className="w-48 h-48 mx-auto rounded-xl border border-[#1e293b]" />
            </div>
          )}
          {!iniciado ? (
            <>
              <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Mensaje</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{mensaje || "(sin mensaje)"}</p>
                {archivo && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    {archivo.type.startsWith("image/") ? <ImageIcon /> : <FileIcon />}
                    <span>{archivo.name}</span>
                    <span className="text-slate-600">({(archivo.size / 1024).toFixed(0)} KB)</span>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3 max-h-40 overflow-y-auto space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Destinatarios ({conWA.length})</p>
                {conWA.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{[s.nombre, s.apellido].filter(Boolean).join(" ")}</span>
                    <span className="text-slate-500">📱 +{s.codigo_telefono}{s.whatsapp}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-300">Progreso</p>
                <span className="text-xs text-slate-500">{okCount + errCount}/{conWA.length}</span>
              </div>
              {resultados.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-[#1e293b] bg-white/5 px-3 py-2">
                  <span className="text-sm text-slate-300">{r.nombre}</span>
                  {r.estado === "pending" ? <span className="text-xs text-slate-500">Enviando…</span>
                    : r.estado === "ok" ? <span className="flex items-center gap-1 text-xs text-brand-green"><CheckIcon /> Enviado</span>
                    : <span className="flex items-center gap-1 text-xs text-red-400"><XIcon /> Error</span>}
                </div>
              ))}
              {!enviando && <div className="rounded-xl border border-[#1e293b] bg-white/5 px-4 py-3 text-sm text-center">
                <span className="text-brand-green font-semibold">{okCount} enviados</span>
                {errCount > 0 && <span className="text-red-400 font-semibold ml-3">{errCount} fallidos</span>}
              </div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#1e293b] px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-slate-100">
            {iniciado && !enviando ? "Cerrar" : "Cancelar"}
          </button>
          {!iniciado && (
            <button onClick={() => void enviar()} disabled={enviando || conWA.length === 0 || waStatus !== "connected"}
              className="flex items-center gap-2 rounded-2xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-50">
              <SendIcon /> Enviar a {conWA.length}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampanasPage() {
  const [tab, setTab] = useState<TabCampana>("crear");
  const [loading, setLoading] = useState(true);

  // ── Filtros ──
  const [socios, setSocios] = useState<SocioCampana[]>([]);
  const [filtroGenero, setFiltroGenero] = useState<Genero>("todos");
  const [filtroAntiguedad, setFiltroAntiguedad] = useState<Antiguedad>("todos");
  const [filtroEstado, setFiltroEstado] = useState<EstadoSub>("todos");
  const [filtroPais, setFiltroPais] = useState<string>("todos");
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());

  // ── Template & mensaje ──
  const [templateId, setTemplateId] = useState("custom");
  const [mensaje, setMensaje] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Historial ──
  const [historial, setHistorial] = useState<HistorialItem[]>([]);

  // ── Modal ──
  const [modalEnvio, setModalEnvio] = useState(false);

  // Países disponibles
  const paisesDisponibles = useMemo(() => {
    const set = new Set<string>();
    socios.forEach((s) => { if (s.nacionalidad) set.add(s.nacionalidad); });
    return Array.from(set).sort();
  }, [socios]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data: sociosRaw } = await supabase
      .from("socios")
      .select("id, nombre, apellido, whatsapp, codigo_telefono, genero, nacionalidad, fecha_registro, suscrito, es_activo")
      .eq("es_activo", true);
    setSocios((sociosRaw ?? []) as SocioCampana[]);

    const { data: hist } = await supabase
      .from("campanas_envios")
      .select("id, socio_id, segmento, mensaje, estado, fecha_envio, media_tipo, socios(nombre, apellido)")
      .eq("segmento", "campana_marketing")
      .order("fecha_envio", { ascending: false })
      .limit(100);
    setHistorial((hist ?? []).map((h) => {
      const socioData = h.socios as unknown as { nombre: string | null; apellido: string | null } | null;
      return {
        id: h.id, segmento: h.segmento, mensaje: h.mensaje, estado: h.estado, fecha_envio: h.fecha_envio,
        socio_nombre: [socioData?.nombre, socioData?.apellido].filter(Boolean).join(" "),
        media_tipo: h.media_tipo ?? null,
      };
    }));
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  // Aplicar template
  useEffect(() => {
    const t = TEMPLATES.find((t) => t.id === templateId);
    if (t && t.id !== "custom") setMensaje(t.text);
  }, [templateId]);

  // Filtrar socios
  const filtrados = useMemo(() => {
    return socios.filter((s) => {
      if (!s.whatsapp) return false;
      if (filtroGenero !== "todos" && s.genero !== filtroGenero) return false;
      if (filtroPais !== "todos" && s.nacionalidad !== filtroPais) return false;
      if (filtroEstado === "suscrito" && !s.suscrito) return false;
      if (filtroEstado === "no_suscrito" && s.suscrito) return false;
      if (filtroAntiguedad !== "todos" && s.fecha_registro) {
        const dias = Math.floor((Date.now() - new Date(s.fecha_registro).getTime()) / 86400000);
        if (filtroAntiguedad === "nuevos" && dias > 30) return false;
        if (filtroAntiguedad === "veteranos" && dias <= 90) return false;
      }
      return true;
    });
  }, [socios, filtroGenero, filtroAntiguedad, filtroEstado, filtroPais]);

  function toggleSel(id: number) {
    setSeleccionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selAll() {
    setSeleccionados(seleccionados.size === filtrados.length ? new Set() : new Set(filtrados.map((s) => s.id)));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 10 * 1024 * 1024) { alert("Archivo muy grande (máx 10MB)"); return; }
    setArchivo(f);
  }

  const sociosParaEnviar = socios.filter((s) => seleccionados.has(s.id));

  return (
    <div className="space-y-5">
      {modalEnvio && (
        <ModalEnvioCampana socios={sociosParaEnviar} mensaje={mensaje} archivo={archivo}
          onClose={() => setModalEnvio(false)} onSent={() => { void cargar(); setSeleccionados(new Set()); }} />
      )}

      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Marketing</div>
            <h1 className="section-title">Campañas</h1>
            <p className="section-description">Crea y envía campañas de WhatsApp a tus socios</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void cargar()} className="flex items-center gap-2 rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-slate-100"><RefreshIcon /> Actualizar</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { id: "crear" as const, label: "Crear campaña" },
          { id: "historial" as const, label: "Historial de campañas", count: historial.length },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={["rounded-2xl border px-5 py-2.5 text-sm font-bold transition-all",
              tab === t.id ? "border-brand-green/40 bg-brand-green/10 text-brand-green" : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"].join(" ")}>
            {t.label} {"count" in t && t.count !== undefined && <span className="ml-1 text-xs opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-500">Cargando socios…</div> : (<>

      {/* ── TAB: Crear campaña ── */}
      {tab === "crear" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Columna izquierda: Filtros + Socios */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filtros */}
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Filtrar audiencia</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Género */}
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Género</label>
                  <select value={filtroGenero} onChange={(e) => { setFiltroGenero(e.target.value as Genero); setSeleccionados(new Set()); }}
                    className="w-full rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2 text-sm text-slate-100 outline-none">
                    <option value="todos">Todos</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </select>
                </div>
                {/* Antigüedad */}
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Antigüedad</label>
                  <select value={filtroAntiguedad} onChange={(e) => { setFiltroAntiguedad(e.target.value as Antiguedad); setSeleccionados(new Set()); }}
                    className="w-full rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2 text-sm text-slate-100 outline-none">
                    <option value="todos">Todos</option>
                    <option value="nuevos">Nuevos (≤30 días)</option>
                    <option value="veteranos">Veteranos (≥90 días)</option>
                  </select>
                </div>
                {/* Estado suscripción */}
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Suscripción</label>
                  <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value as EstadoSub); setSeleccionados(new Set()); }}
                    className="w-full rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2 text-sm text-slate-100 outline-none">
                    <option value="todos">Todos</option>
                    <option value="suscrito">Suscritos</option>
                    <option value="no_suscrito">No suscritos</option>
                  </select>
                </div>
                {/* País */}
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">País</label>
                  <select value={filtroPais} onChange={(e) => { setFiltroPais(e.target.value); setSeleccionados(new Set()); }}
                    className="w-full rounded-xl border border-[#1e293b] bg-[#0b1220] px-3 py-2 text-sm text-slate-100 outline-none">
                    <option value="todos">Todos</option>
                    {paisesDisponibles.map((p) => (
                      <option key={p} value={p}>{PAISES[p]?.flag ?? "🌍"} {PAISES[p]?.name ?? p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Lista de socios */}
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Socios con WhatsApp ({filtrados.length})
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={selAll} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2">
                    {seleccionados.size === filtrados.length && filtrados.length > 0 ? "Deseleccionar" : "Seleccionar todos"}
                  </button>
                  {seleccionados.size > 0 && (
                    <button onClick={() => setModalEnvio(true)}
                      className="flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-500">
                      <WhatsAppIcon /> Enviar a {seleccionados.size}
                    </button>
                  )}
                </div>
              </div>

              {filtrados.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">No hay socios que coincidan con los filtros.</div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto space-y-1.5">
                  {filtrados.map((s) => {
                    const sel = seleccionados.has(s.id);
                    return (
                      <div key={s.id} onClick={() => toggleSel(s.id)}
                        className={["rounded-xl border px-4 py-2.5 cursor-pointer transition-all flex items-center gap-3",
                          sel ? "border-brand-green/40 bg-brand-green/5" : "border-[#1e293b] bg-white/3 hover:bg-white/5"].join(" ")}>
                        <span className={["flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all",
                          sel ? "border-brand-green bg-brand-green/20 text-brand-green" : "border-[#1e293b] bg-[#020617]"].join(" ")}>
                          {sel && <CheckIcon />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-slate-100">{[s.nombre, s.apellido].filter(Boolean).join(" ")}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {s.genero && <span className="text-[10px] text-slate-500">{s.genero === "M" ? "♂" : s.genero === "F" ? "♀" : "⚧"}</span>}
                            {s.nacionalidad && <span className="text-[10px] text-slate-500">{PAISES[s.nacionalidad]?.flag ?? "🌍"}</span>}
                            <span className={`text-[10px] ${s.suscrito ? "text-brand-green" : "text-red-400"}`}>{s.suscrito ? "Suscrito" : "No suscrito"}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-green-400 flex items-center gap-0.5 shrink-0"><WhatsAppIcon /> +{s.codigo_telefono}{s.whatsapp}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Columna derecha: Template + Mensaje + Adjunto */}
          <div className="space-y-4">
            {/* Template */}
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Template</p>
              <div className="space-y-1.5">
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => setTemplateId(t.id)}
                    className={["w-full text-left rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                      templateId === t.id ? "border-brand-green/40 bg-brand-green/10 text-brand-green" : "border-[#1e293b] bg-white/3 text-slate-400 hover:text-slate-100"].join(" ")}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mensaje */}
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Mensaje — usa {"{nombre}"} para personalizar</p>
              <textarea value={mensaje} onChange={(e) => { setMensaje(e.target.value); setTemplateId("custom"); }} rows={5}
                placeholder="Escribe tu mensaje aquí..."
                className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50 resize-none" />
            </div>

            {/* Adjuntar archivo */}
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Adjuntar (opcional)</p>
              <p className="text-[10px] text-slate-600">1 imagen o 1 PDF, máx 10MB</p>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
              {archivo ? (
                <div className="flex items-center gap-3 rounded-xl border border-[#1e293b] bg-[#0b1220] px-4 py-3">
                  {archivo.type.startsWith("image/") ? <ImageIcon /> : <FileIcon />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-100 truncate">{archivo.name}</p>
                    <p className="text-[10px] text-slate-500">{(archivo.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={() => setArchivo(null)} className="text-slate-400 hover:text-red-400"><XIcon /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "image/*"; fileInputRef.current.click(); } }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#1e293b] bg-[#0b1220] px-3 py-3 text-xs text-slate-400 hover:text-slate-100 hover:border-slate-500 transition-all">
                    <ImageIcon /> Imagen
                  </button>
                  <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = ".pdf"; fileInputRef.current.click(); } }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#1e293b] bg-[#0b1220] px-3 py-3 text-xs text-slate-400 hover:text-slate-100 hover:border-slate-500 transition-all">
                    <FileIcon /> PDF
                  </button>
                </div>
              )}
            </div>

            {/* Resumen */}
            <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Resumen</p>
              <div className="text-sm text-slate-300 space-y-1">
                <p>📱 Destinatarios: <span className="font-bold text-slate-100">{seleccionados.size}</span></p>
                <p>💬 Mensaje: <span className="font-bold text-slate-100">{mensaje.length > 0 ? `${mensaje.length} caracteres` : "vacío"}</span></p>
                <p>📎 Adjunto: <span className="font-bold text-slate-100">{archivo ? archivo.name : "ninguno"}</span></p>
              </div>
              <button onClick={() => setModalEnvio(true)}
                disabled={seleccionados.size === 0 || mensaje.length === 0}
                className="w-full mt-3 flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed">
                <SendIcon /> Enviar campaña
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Historial ── */}
      {tab === "historial" && (
        <div className="space-y-3">
          {historial.length === 0 ? (
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 py-12 text-center">
              <p className="text-sm text-slate-500">No hay campañas enviadas aún.</p>
            </div>
          ) : (
            <>
              {/* Stats rápidos */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Total enviados</div>
                  <div className="text-2xl font-bold mt-1 text-brand-green">{historial.filter((h) => h.estado === "enviado").length}</div>
                </div>
                <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Con media</div>
                  <div className="text-2xl font-bold mt-1 text-sky-400">{historial.filter((h) => h.media_tipo).length}</div>
                </div>
                <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Último envío</div>
                  <div className="text-sm font-bold mt-1 text-slate-100">{historial[0] ? formatDateTime(historial[0].fecha_envio) : "—"}</div>
                </div>
              </div>

              {/* Lista */}
              <div className="space-y-2">
                {historial.map((h) => (
                  <div key={h.id} className="rounded-2xl border border-[#1e293b] bg-white/5 px-5 py-3 flex items-center gap-4">
                    <span className="text-lg">{h.media_tipo === "imagen" ? "🖼️" : h.media_tipo === "documento" ? "📄" : "📨"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">{h.socio_nombre}</span>
                        <span className="text-[10px] text-slate-500">{h.segmento === "campana_marketing" ? "Marketing" : h.segmento}</span>
                        {h.media_tipo && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-400">
                            {h.media_tipo === "imagen" ? <><ImageIcon /> IMG</> : <><FileIcon /> PDF</>}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate max-w-md">{h.mensaje}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs text-brand-green"><CheckIcon /> {h.estado}</span>
                      <p className="text-[10px] text-slate-500">{formatDateTime(h.fecha_envio)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      </>)}
    </div>
  );
}

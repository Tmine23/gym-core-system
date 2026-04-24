"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RiesgoNivel = "ALTO" | "MEDIO" | "BAJO";

type SocioChurn = {
  id: number;
  nombre: string | null;
  apellido: string | null;
  whatsapp: string | null;
  fecha_fin: string | null;
  fecha_inicio: string | null;
  dias_para_vencer: number | null;
  asistencias_30d: number;
  ultima_asistencia: string | null;
  score: number; // 0-100, mayor = más riesgo
  nivel: RiesgoNivel;
  razones: string[];
};

type EnvioEstado = "idle" | "sending" | "ok" | "error";

type TabPrincipal = "prediccion" | "campanas";

type Segmento = {
  id: "sin_asistencia" | "no_renovaron" | "racha_perdida" | "proximos_vencer";
  label: string;
  emoji: string;
  color: string;
  border: string;
  bg: string;
  templateDefault: string;
};

type SocioSegmento = {
  id: number;
  nombre: string | null;
  apellido: string | null;
  whatsapp: string | null;
  detalle: string; // info contextual del segmento
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TZ = "America/La_Paz";

const SEGMENTOS: Segmento[] = [
  {
    id: "sin_asistencia",
    label: "Sin asistencias recientes",
    emoji: "👻",
    color: "text-slate-400",
    border: "border-slate-500/30",
    bg: "bg-slate-500/5",
    templateDefault: "Hola {nombre}, notamos que llevas un tiempo sin visitarnos. ¡Te esperamos en el gym! 💪 Recuerda que tu bienestar es nuestra prioridad.",
  },
  {
    id: "no_renovaron",
    label: "No renovaron suscripción",
    emoji: "⏰",
    color: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    templateDefault: "Hola {nombre}, tu membresía ha vencido. ¡Renueva hoy y retoma tu rutina sin interrupciones! Contáctanos para más info. 🏋️",
  },
  {
    id: "racha_perdida",
    label: "Perdieron su racha",
    emoji: "🔥",
    color: "text-amber-400",
    border: "border-amber-400/30",
    bg: "bg-amber-400/5",
    templateDefault: "Hola {nombre}, ¡tenías una racha increíble! Llevabas semanas entrenando constante y de repente paraste. ¿Todo bien? Te esperamos de vuelta. 💪",
  },
  {
    id: "proximos_vencer",
    label: "Próximos a vencer",
    emoji: "📅",
    color: "text-violet-400",
    border: "border-violet-500/30",
    bg: "bg-violet-500/5",
    templateDefault: "Hola {nombre}, tu membresía vence pronto. ¡Renueva con anticipación y no pierdas ni un día de entrenamiento! 🏆",
  },
];

// ─── Churn Score Model ────────────────────────────────────────────────────────
// Factores:
// 1. Días para vencer (peso 40): <7 días = 40pts, <15 = 30pts, <30 = 20pts
// 2. Asistencias últimos 30 días (peso 35): 0 = 35pts, 1-2 = 25pts, 3-5 = 10pts, >5 = 0pts
// 3. Días desde última asistencia (peso 25): >20 días = 25pts, >10 = 15pts, >5 = 5pts

function calcularScore(socio: Omit<SocioChurn, "score" | "nivel" | "razones">): { score: number; nivel: RiesgoNivel; razones: string[] } {
  let score = 0;
  const razones: string[] = [];
  const dias = socio.dias_para_vencer ?? 999;

  // Factor 1: proximidad de vencimiento
  if (dias < 0) {
    score += 40;
    razones.push(`Suscripción vencida hace ${Math.abs(dias)} día(s)`);
  } else if (dias <= 7) {
    score += 40;
    razones.push(`Vence en ${dias} día(s)`);
  } else if (dias <= 15) {
    score += 30;
    razones.push(`Vence en ${dias} días`);
  } else if (dias <= 30) {
    score += 20;
    razones.push(`Vence en ${dias} días`);
  }

  // Factor 2: asistencias últimos 30 días
  if (socio.asistencias_30d === 0) {
    score += 35;
    razones.push("Sin asistencias en 30 días");
  } else if (socio.asistencias_30d <= 2) {
    score += 25;
    razones.push(`Solo ${socio.asistencias_30d} asistencia(s) en 30 días`);
  } else if (socio.asistencias_30d <= 5) {
    score += 10;
    razones.push(`${socio.asistencias_30d} asistencias en 30 días`);
  }

  // Factor 3: días desde última asistencia
  if (socio.ultima_asistencia) {
    const diasDesde = Math.floor((Date.now() - new Date(socio.ultima_asistencia).getTime()) / 86400000);
    if (diasDesde > 20) {
      score += 25;
      razones.push(`Última visita hace ${diasDesde} días`);
    } else if (diasDesde > 10) {
      score += 15;
      razones.push(`Última visita hace ${diasDesde} días`);
    } else if (diasDesde > 5) {
      score += 5;
    }
  } else {
    score += 25;
    razones.push("Sin historial de asistencias");
  }

  const nivel: RiesgoNivel = score >= 65 ? "ALTO" : score >= 35 ? "MEDIO" : "BAJO";
  return { score: Math.min(score, 100), nivel, razones };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); }
function formatDate(iso: string) {
  if (!iso) return "—";
  const d = iso.includes("T") ? new Date(iso) : new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ });
}

function nivelConfig(nivel: RiesgoNivel) {
  return {
    ALTO: { label: "Alto riesgo", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-400", bar: "bg-red-500" },
    MEDIO: { label: "Riesgo medio", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30", dot: "bg-amber-400", bar: "bg-amber-400" },
    BAJO: { label: "Bajo riesgo", color: "text-brand-green", bg: "bg-brand-green/10", border: "border-brand-green/30", dot: "bg-brand-green", bar: "bg-brand-green" },
  }[nivel];
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function AlertIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" /></svg>; }
function WhatsAppIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>; }
function BrainIcon() { return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z" /></svg>; }
function SendIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></svg>; }
function CheckIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>; }
function XIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function RefreshIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>; }

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ open, message, type, onClose }: { open: boolean; message: string; type: "ok" | "error"; onClose: () => void }) {
  useEffect(() => { if (!open) return; const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [open, onClose]);
  return (
    <div className={["fixed right-4 top-4 z-[70] transition-all duration-200", open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"].join(" ")}>
      <div className={["flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl", type === "ok" ? "border-brand-green/25 bg-[#0b1220]" : "border-red-500/25 bg-[#0b1220]"].join(" ")}>
        <span className={["flex h-8 w-8 items-center justify-center rounded-xl border", type === "ok" ? "border-brand-green/25 bg-brand-green/10 text-brand-green" : "border-red-500/25 bg-red-500/10 text-red-400"].join(" ")}>
          {type === "ok" ? <CheckIcon /> : <XIcon />}
        </span>
        <span className="text-sm font-semibold text-slate-100">{message}</span>
      </div>
    </div>
  );
}

// ─── Modal WhatsApp ───────────────────────────────────────────────────────────

// ─── Modal WhatsApp (Baileys) ─────────────────────────────────────────────────

function ModalWhatsApp({ socios, templateInicial, onClose }: { socios: SocioChurn[]; templateInicial?: string; onClose: () => void }) {
  const conWhatsapp = socios.filter((s) => s.whatsapp);
  const [mensaje, setMensaje] = useState(
    templateInicial ?? `Hola {nombre}, te recordamos que tu membresía en el gimnasio está próxima a vencer. ¡Renueva ahora y sigue entrenando sin interrupciones! 💪`
  );
  const [waStatus, setWaStatus] = useState<"disconnected" | "connecting" | "qr" | "connected">("connecting");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<{ id: number; nombre: string; estado: "ok" | "error" | "pending" }[]>(
    conWhatsapp.map((s) => ({ id: s.id, nombre: [s.nombre, s.apellido].filter(Boolean).join(" "), estado: "pending" }))
  );
  const [iniciado, setIniciado] = useState(false);

  // Polling de estado WhatsApp
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    async function poll() {
      try {
        const res = await fetch("/api/whatsapp/status");
        const data = await res.json() as { status: typeof waStatus; qr: string | null };
        setWaStatus(data.status);
        setQrDataUrl(data.qr);
        if (data.status === "connected") clearInterval(interval);
      } catch { /* ignore */ }
    }
    void poll();
    interval = setInterval(() => void poll(), 3000);
    return () => clearInterval(interval);
  }, []);

  async function enviarMensajes() {
    setEnviando(true);
    setIniciado(true);
    for (const socio of conWhatsapp) {
      const texto = mensaje.replace("{nombre}", socio.nombre ?? "socio");
      const numero = (socio.whatsapp ?? "").replace(/\D/g, "");
      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: numero, text: texto }),
        });
        setResultados((prev) => prev.map((r) => r.id === socio.id ? { ...r, estado: res.ok ? "ok" : "error" } : r));
      } catch {
        setResultados((prev) => prev.map((r) => r.id === socio.id ? { ...r, estado: "error" } : r));
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    setEnviando(false);
  }

  const okCount = resultados.filter((r) => r.estado === "ok").length;
  const errCount = resultados.filter((r) => r.estado === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl border border-[#1e293b] bg-[#020617] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[#1e293b] px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-green-500/25 bg-green-500/10 text-green-400">
              <WhatsAppIcon />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Campaña WhatsApp</p>
              <p className="text-sm font-bold text-slate-100">{conWhatsapp.length} socios con número</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={["inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              waStatus === "connected" ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
              : waStatus === "qr" ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
              : "border-[#1e293b] bg-white/5 text-slate-400"].join(" ")}>
              <span className={["h-1.5 w-1.5 rounded-full",
                waStatus === "connected" ? "bg-brand-green" : waStatus === "qr" ? "bg-amber-400 animate-pulse" : "bg-slate-500"].join(" ")} />
              {waStatus === "connected" ? "Conectado" : waStatus === "qr" ? "Escanear QR" : "Conectando…"}
            </span>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"><XIcon /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Panel QR si no está conectado */}
          {waStatus !== "connected" && !iniciado && (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-center space-y-3">
              <p className="text-sm font-semibold text-amber-300">
                {waStatus === "qr" ? "Escanea el QR con WhatsApp para conectar" : "Iniciando conexión WhatsApp…"}
              </p>
              {qrDataUrl ? (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR WhatsApp" className="w-48 h-48 rounded-xl border border-[#1e293b]" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="h-8 w-8 rounded-full border-2 border-amber-400/40 border-t-amber-400 animate-spin" />
                  <p className="text-xs text-slate-500">Conectando con WhatsApp Web, espera unos segundos…</p>
                </div>
              )}
              <p className="text-xs text-slate-500">Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
            </div>
          )}

          {!iniciado ? (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 block">
                  Mensaje — usa {"{nombre}"} para personalizar
                </label>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50 resize-none"
                />
              </div>
              <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3 space-y-1.5 max-h-40 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Destinatarios</p>
                {conWhatsapp.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{[s.nombre, s.apellido].filter(Boolean).join(" ")}</span>
                    <span className="text-xs text-slate-500">📱 {s.whatsapp}</span>
                  </div>
                ))}
                {socios.filter((s) => !s.whatsapp).length > 0 && (
                  <p className="text-xs text-slate-600 mt-1">{socios.filter((s) => !s.whatsapp).length} sin número serán omitidos.</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-300">Progreso</p>
                <span className="text-xs text-slate-500">{okCount + errCount}/{conWhatsapp.length}</span>
              </div>
              {resultados.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-[#1e293b] bg-white/5 px-3 py-2">
                  <span className="text-sm text-slate-300">{r.nombre}</span>
                  {r.estado === "pending" ? (
                    <span className="text-xs text-slate-500">{enviando ? "Enviando…" : "Pendiente"}</span>
                  ) : r.estado === "ok" ? (
                    <span className="flex items-center gap-1 text-xs text-brand-green"><CheckIcon /> Enviado</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-400"><XIcon /> Error</span>
                  )}
                </div>
              ))}
              {!enviando && (
                <div className="rounded-xl border border-[#1e293b] bg-white/5 px-4 py-3 text-sm text-center">
                  <span className="text-brand-green font-semibold">{okCount} enviados</span>
                  {errCount > 0 && <span className="text-red-400 font-semibold ml-3">{errCount} fallidos</span>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#1e293b] px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-slate-100 transition-all">
            {iniciado && !enviando ? "Cerrar" : "Cancelar"}
          </button>
          {!iniciado && (
            <button
              onClick={() => void enviarMensajes()}
              disabled={enviando || conWhatsapp.length === 0 || waStatus !== "connected"}
              className="flex items-center gap-2 rounded-2xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-50 transition-all">
              <SendIcon /> Enviar a {conWhatsapp.length} socios
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RetencionPage() {
  const [socios, setSocios] = useState<SocioChurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroNivel, setFiltroNivel] = useState<RiesgoNivel | "todos">("todos");
  const [filtroDias, setFiltroDias] = useState<7 | 15 | 30 | 60 | 999>(999);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [modalWA, setModalWA] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", type: "ok" as "ok" | "error" });

  // Tabs
  const [tabPrincipal, setTabPrincipal] = useState<TabPrincipal>("prediccion");
  const [segmentoActivo, setSegmentoActivo] = useState<Segmento["id"]>("sin_asistencia");
  const [segmentosData, setSegmentosData] = useState<Record<Segmento["id"], SocioSegmento[]>>({
    sin_asistencia: [], no_renovaron: [], racha_perdida: [], proximos_vencer: [],
  });
  const [loadingSegmentos, setLoadingSegmentos] = useState(false);
  const [selSegmento, setSelSegmento] = useState<Set<number>>(new Set());
  const [modalWASegmento, setModalWASegmento] = useState(false);
  const [diasSinAsistencia, setDiasSinAsistencia] = useState(14);

  function showToast(message: string, type: "ok" | "error" = "ok") {
    setToast({ open: true, message, type });
  }

  async function cargar() {
    setLoading(true);
    const hoy = todayStr();

    const { data } = await supabase.rpc("churn_score_socios", { p_hoy: hoy }).select("*");

    // Si no existe la RPC, hacemos la query directamente
    const { data: raw } = await supabase
      .from("socios")
      .select(`
        id, nombre, apellido, whatsapp, es_activo,
        suscripciones!inner(fecha_inicio, fecha_fin, estado)
      `)
      .eq("es_activo", true)
      .eq("suscripciones.estado", "ACTIVA");

    if (!raw) { setLoading(false); return; }

    // Para cada socio, obtener asistencias últimos 30 días
    const treintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: asistencias } = await supabase
      .from("asistencias")
      .select("socio_id, fecha_entrada")
      .gte("fecha_entrada", treintaDiasAtras);

    const asisMap = new Map<number, { count: number; ultima: string | null }>();
    for (const a of asistencias ?? []) {
      const prev = asisMap.get(a.socio_id) ?? { count: 0, ultima: null };
      const esUltima = !prev.ultima || a.fecha_entrada > prev.ultima;
      asisMap.set(a.socio_id, {
        count: prev.count + 1,
        ultima: esUltima ? a.fecha_entrada : prev.ultima,
      });
    }

    const resultado: SocioChurn[] = (raw as unknown as {
      id: number; nombre: string | null; apellido: string | null; whatsapp: string | null;
      suscripciones: { fecha_inicio: string; fecha_fin: string }[];
    }[]).map((s) => {
      const sub = s.suscripciones?.[0];
      const fechaFin = sub?.fecha_fin ?? null;
      const diasParaVencer = fechaFin
        ? Math.floor((new Date(fechaFin + "T12:00:00").getTime() - new Date(hoy + "T12:00:00").getTime()) / 86400000)
        : null;
      const asis = asisMap.get(s.id) ?? { count: 0, ultima: null };
      const base = {
        id: s.id, nombre: s.nombre, apellido: s.apellido, whatsapp: s.whatsapp,
        fecha_fin: fechaFin, fecha_inicio: sub?.fecha_inicio ?? null,
        dias_para_vencer: diasParaVencer,
        asistencias_30d: asis.count,
        ultima_asistencia: asis.ultima,
      };
      const { score, nivel, razones } = calcularScore(base);
      return { ...base, score, nivel, razones };
    });

    // Ordenar por score descendente
    resultado.sort((a, b) => b.score - a.score);
    setSocios(resultado);
    setLoading(false);
    void data; // ignorar RPC si no existe
  }

  useEffect(() => { void cargar(); }, []);

  // Cargar segmentos cuando se cambia al tab de campañas
  useEffect(() => {
    if (tabPrincipal === "campanas") void cargarSegmentos();
  }, [tabPrincipal, diasSinAsistencia]);

  async function cargarSegmentos() {
    setLoadingSegmentos(true);
    const hoy = todayStr();
    const hoyDate = new Date(hoy + "T12:00:00");
    const corteAsistencia = new Date(hoyDate.getTime() - diasSinAsistencia * 86400000).toISOString();
    const corteRacha = new Date(hoyDate.getTime() - 10 * 86400000).toISOString(); // 10 días sin venir
    const corteRachaActiva = new Date(hoyDate.getTime() - 30 * 86400000).toISOString(); // venían en los últimos 30d

    // 1. Sin asistencias recientes (activos con susc activa pero sin venir X días)
    const { data: sinAsist } = await supabase
      .from("socios")
      .select("id, nombre, apellido, whatsapp, suscripciones!inner(fecha_fin, estado)")
      .eq("es_activo", true)
      .eq("suscripciones.estado", "ACTIVA")
      .gte("suscripciones.fecha_fin", hoy);

    const { data: asistRecientes } = await supabase
      .from("asistencias")
      .select("socio_id")
      .gte("fecha_entrada", corteAsistencia);
    const conAsistReciente = new Set((asistRecientes ?? []).map((a) => a.socio_id));

    const sinAsistData: SocioSegmento[] = ((sinAsist ?? []) as unknown as {
      id: number; nombre: string | null; apellido: string | null; whatsapp: string | null;
      suscripciones: { fecha_fin: string }[];
    }[])
      .filter((s) => !conAsistReciente.has(s.id))
      .map((s) => ({
        id: s.id, nombre: s.nombre, apellido: s.apellido, whatsapp: s.whatsapp,
        detalle: `Sin visitas hace +${diasSinAsistencia} días`,
      }));

    // 2. No renovaron (suscripción vencida, sin nueva suscripción activa)
    const { data: vencidos } = await supabase
      .from("socios")
      .select("id, nombre, apellido, whatsapp")
      .eq("es_activo", true)
      .eq("suscrito", false);

    const noRenovaronData: SocioSegmento[] = ((vencidos ?? []) as {
      id: number; nombre: string | null; apellido: string | null; whatsapp: string | null;
    }[]).map((s) => ({
      id: s.id, nombre: s.nombre, apellido: s.apellido, whatsapp: s.whatsapp,
      detalle: "Suscripción vencida sin renovar",
    }));

    // 3. Racha perdida: tenían asistencias en los últimos 30d pero llevan +10 días sin venir
    const { data: asist30d } = await supabase
      .from("asistencias")
      .select("socio_id, fecha_entrada")
      .gte("fecha_entrada", corteRachaActiva);

    const rachaMap = new Map<number, { ultima: string; count: number }>();
    for (const a of asist30d ?? []) {
      const prev = rachaMap.get(a.socio_id);
      if (!prev || a.fecha_entrada > prev.ultima) {
        rachaMap.set(a.socio_id, { ultima: a.fecha_entrada, count: (prev?.count ?? 0) + 1 });
      } else {
        rachaMap.set(a.socio_id, { ...prev, count: prev.count + 1 });
      }
    }

    const rachaPerdidaIds: number[] = [];
    rachaMap.forEach((v, socioId) => {
      const diasDesde = Math.floor((Date.now() - new Date(v.ultima).getTime()) / 86400000);
      if (v.count >= 3 && diasDesde > 10) rachaPerdidaIds.push(socioId);
    });

    let rachaPerdidaData: SocioSegmento[] = [];
    if (rachaPerdidaIds.length > 0) {
      const { data: rachaSocios } = await supabase
        .from("socios")
        .select("id, nombre, apellido, whatsapp")
        .in("id", rachaPerdidaIds)
        .eq("es_activo", true);
      rachaPerdidaData = ((rachaSocios ?? []) as {
        id: number; nombre: string | null; apellido: string | null; whatsapp: string | null;
      }[]).map((s) => {
        const info = rachaMap.get(s.id)!;
        const dias = Math.floor((Date.now() - new Date(info.ultima).getTime()) / 86400000);
        return {
          id: s.id, nombre: s.nombre, apellido: s.apellido, whatsapp: s.whatsapp,
          detalle: `${info.count} visitas en 30d · paró hace ${dias} días`,
        };
      });
    }

    // 4. Próximos a vencer (7 días)
    const en7dias = new Date(hoyDate.getTime() + 7 * 86400000).toISOString().split("T")[0];
    const { data: proxVencer } = await supabase
      .from("socios")
      .select("id, nombre, apellido, whatsapp, suscripciones!inner(fecha_fin, estado)")
      .eq("es_activo", true)
      .eq("suscripciones.estado", "ACTIVA")
      .gte("suscripciones.fecha_fin", hoy)
      .lte("suscripciones.fecha_fin", en7dias);

    const proxVencerData: SocioSegmento[] = ((proxVencer ?? []) as unknown as {
      id: number; nombre: string | null; apellido: string | null; whatsapp: string | null;
      suscripciones: { fecha_fin: string }[];
    }[]).map((s) => ({
      id: s.id, nombre: s.nombre, apellido: s.apellido, whatsapp: s.whatsapp,
      detalle: `Vence el ${formatDate(s.suscripciones[0]?.fecha_fin ?? "")}`,
    }));

    setSegmentosData({
      sin_asistencia: sinAsistData,
      no_renovaron: noRenovaronData,
      racha_perdida: rachaPerdidaData,
      proximos_vencer: proxVencerData,
    });
    setLoadingSegmentos(false);
  }

  const filtrados = useMemo(() => {
    return socios.filter((s) => {
      if (filtroNivel !== "todos" && s.nivel !== filtroNivel) return false;
      if (filtroDias !== 999 && (s.dias_para_vencer === null || s.dias_para_vencer > filtroDias)) return false;
      return true;
    });
  }, [socios, filtroNivel, filtroDias]);

  const stats = useMemo(() => ({
    alto: socios.filter((s) => s.nivel === "ALTO").length,
    medio: socios.filter((s) => s.nivel === "MEDIO").length,
    bajo: socios.filter((s) => s.nivel === "BAJO").length,
    sinAsistencias: socios.filter((s) => s.asistencias_30d === 0).length,
  }), [socios]);

  function toggleSel(id: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selAll() {
    if (seleccionados.size === filtrados.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(filtrados.map((s) => s.id)));
    }
  }

  const sociosParaEnviar = socios.filter((s) => seleccionados.has(s.id));

  return (
    <div className="space-y-5">
      <Toast open={toast.open} message={toast.message} type={toast.type} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      {modalWA && (
        <ModalWhatsApp
          socios={sociosParaEnviar}
          onClose={() => {
            setModalWA(false);
            showToast("Campaña finalizada");
          }}
        />
      )}

      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Operaciones</div>
            <h1 className="section-title">Retención</h1>
            <p className="section-description">Predicción de churn y campañas de reactivación</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void cargar()}
              className="flex items-center gap-2 rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-slate-100 transition-all">
              <RefreshIcon /> Actualizar
            </button>
            {seleccionados.size > 0 && (
              <button onClick={() => setModalWA(true)}
                className="flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-500 transition-all shadow-lg shadow-green-900/30">
                <WhatsAppIcon /> Enviar WhatsApp ({seleccionados.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {([
          { id: "prediccion", label: "🧠 Predicción de Churn" },
          { id: "campanas", label: "📣 Campañas por Segmento" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => { setTabPrincipal(t.id); setSeleccionados(new Set()); setSelSegmento(new Set()); }}
            className={["rounded-2xl border px-5 py-2.5 text-sm font-bold transition-all",
              tabPrincipal === t.id
                ? "border-brand-green/40 bg-brand-green/10 text-brand-green"
                : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"].join(" ")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Predicción de Churn ── */}
      {tabPrincipal === "prediccion" && (<>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Alto riesgo", value: stats.alto, color: "text-red-400", icon: "🔴" },
          { label: "Riesgo medio", value: stats.medio, color: "text-amber-400", icon: "🟡" },
          { label: "Bajo riesgo", value: stats.bajo, color: "text-brand-green", icon: "🟢" },
          { label: "Sin asistencias 30d", value: stats.sinAsistencias, color: "text-slate-400", icon: "👻" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? "…" : s.value}</div>
          </div>
        ))}
      </div>

      {/* Modelo IA info */}
      <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 px-5 py-4 flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-brand-green/25 bg-brand-green/10 text-brand-green mt-0.5">
          <BrainIcon />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-100">Modelo de predicción de churn</p>
          <p className="text-xs text-slate-400 mt-1">
            Score calculado en base a 3 factores: <span className="text-slate-300">proximidad de vencimiento (40%)</span>,{" "}
            <span className="text-slate-300">frecuencia de asistencias últimos 30 días (35%)</span> y{" "}
            <span className="text-slate-300">días desde última visita (25%)</span>.
            Score ≥65 = Alto riesgo · 35-64 = Medio · &lt;35 = Bajo.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {(["todos", "ALTO", "MEDIO", "BAJO"] as const).map((v) => (
            <button key={v} onClick={() => setFiltroNivel(v)}
              className={["rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                filtroNivel === v
                  ? v === "ALTO" ? "border-red-500/50 bg-red-500/15 text-red-400"
                    : v === "MEDIO" ? "border-amber-400/50 bg-amber-400/15 text-amber-400"
                    : v === "BAJO" ? "border-brand-green/50 bg-brand-green/15 text-brand-green"
                    : "border-brand-green/50 bg-brand-green/15 text-brand-green"
                  : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"].join(" ")}>
              {v === "todos" ? "Todos" : v === "ALTO" ? "🔴 Alto" : v === "MEDIO" ? "🟡 Medio" : "🟢 Bajo"}
            </button>
          ))}
        </div>
        <span className="w-px bg-[#1e293b] h-5" />
        <div className="flex gap-1.5">
          {([{ v: 7, l: "≤7 días" }, { v: 15, l: "≤15 días" }, { v: 30, l: "≤30 días" }, { v: 999, l: "Todos" }] as const).map(({ v, l }) => (
            <button key={v} onClick={() => setFiltroDias(v)}
              className={["rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                filtroDias === v ? "border-violet-500/50 bg-violet-500/15 text-violet-400" : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"].join(" ")}>
              {l}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500">{filtrados.length} socios</span>
      </div>

      {/* Seleccionar todos */}
      {filtrados.length > 0 && (
        <div className="flex items-center gap-3">
          <button onClick={selAll} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2">
            {seleccionados.size === filtrados.length ? "Deseleccionar todos" : "Seleccionar todos"}
          </button>
          {seleccionados.size > 0 && (
            <span className="text-xs text-slate-400">{seleccionados.size} seleccionado(s)</span>
          )}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Analizando socios…</div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-[#1e293b] bg-white/5 py-16 text-center">
          <p className="text-sm text-slate-500">No hay socios en este rango de riesgo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((s) => {
            const cfg = nivelConfig(s.nivel);
            const sel = seleccionados.has(s.id);
            return (
              <div key={s.id}
                onClick={() => toggleSel(s.id)}
                className={["rounded-2xl border px-5 py-4 cursor-pointer transition-all",
                  sel ? "border-brand-green/40 bg-brand-green/5" : `${cfg.border} bg-white/5 hover:bg-white/8`].join(" ")}>
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <span className={["mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all",
                    sel ? "border-brand-green bg-brand-green/20 text-brand-green" : "border-[#1e293b] bg-[#020617]"].join(" ")}>
                    {sel && <CheckIcon />}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-100">
                        {[s.nombre, s.apellido].filter(Boolean).join(" ")}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      {s.whatsapp && (
                        <span className="text-[10px] text-green-400 flex items-center gap-0.5">
                          <WhatsAppIcon /> {s.whatsapp}
                        </span>
                      )}
                    </div>

                    {/* Razones */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {s.razones.map((r, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full border border-[#1e293b] bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                          <AlertIcon /> {r}
                        </span>
                      ))}
                    </div>

                    {/* Fechas */}
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                      {s.fecha_fin && <span>Vence: <span className="text-slate-300">{formatDate(s.fecha_fin)}</span></span>}
                      {s.ultima_asistencia && <span>Última visita: <span className="text-slate-300">{formatDate(s.ultima_asistencia)}</span></span>}
                      <span>Asistencias 30d: <span className="text-slate-300">{s.asistencias_30d}</span></span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 text-right">
                    <div className={`text-2xl font-bold ${cfg.color}`}>{s.score}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">score</div>
                    <div className="mt-1.5 w-16 h-1.5 rounded-full bg-[#1e293b] overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${s.score}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)} {/* end tab prediccion */}

      {/* ── TAB: Campañas por Segmento ── */}
      {tabPrincipal === "campanas" && (
        <div className="space-y-4">
          {/* Segmento tabs */}
          <div className="flex flex-wrap gap-2">
            {SEGMENTOS.map((seg) => {
              const count = segmentosData[seg.id].length;
              return (
                <button key={seg.id} onClick={() => { setSegmentoActivo(seg.id); setSelSegmento(new Set()); }}
                  className={["flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all",
                    segmentoActivo === seg.id
                      ? `${seg.border} ${seg.bg} ${seg.color}`
                      : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"].join(" ")}>
                  <span>{seg.emoji}</span>
                  <span>{seg.label}</span>
                  <span className={["rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    segmentoActivo === seg.id ? "bg-white/20" : "bg-white/10 text-slate-500"].join(" ")}>
                    {loadingSegmentos ? "…" : count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Config especial para sin_asistencia */}
          {segmentoActivo === "sin_asistencia" && (
            <div className="flex items-center gap-3 rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
              <span className="text-xs text-slate-400">Mostrar socios sin asistir hace más de</span>
              <div className="flex gap-1.5">
                {[7, 14, 21, 30].map((d) => (
                  <button key={d} onClick={() => setDiasSinAsistencia(d)}
                    className={["rounded-full border px-3 py-1 text-xs font-bold transition-all",
                      diasSinAsistencia === d ? "border-slate-400/50 bg-slate-400/15 text-slate-200" : "border-[#1e293b] bg-white/5 text-slate-500 hover:text-slate-300"].join(" ")}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Acciones del segmento */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => {
                const lista = segmentosData[segmentoActivo];
                if (selSegmento.size === lista.length) setSelSegmento(new Set());
                else setSelSegmento(new Set(lista.map((s) => s.id)));
              }} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2">
                {selSegmento.size === segmentosData[segmentoActivo].length && segmentosData[segmentoActivo].length > 0
                  ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
              {selSegmento.size > 0 && <span className="text-xs text-slate-400">{selSegmento.size} seleccionado(s)</span>}
            </div>
            {selSegmento.size > 0 && (
              <button onClick={() => setModalWASegmento(true)}
                className="flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-500 transition-all shadow-lg shadow-green-900/30">
                <WhatsAppIcon /> Enviar WhatsApp ({selSegmento.size})
              </button>
            )}
          </div>

          {/* Lista del segmento */}
          {loadingSegmentos ? (
            <div className="py-12 text-center text-sm text-slate-500">Cargando segmento…</div>
          ) : segmentosData[segmentoActivo].length === 0 ? (
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 py-12 text-center">
              <p className="text-2xl mb-2">{SEGMENTOS.find((s) => s.id === segmentoActivo)?.emoji}</p>
              <p className="text-sm text-slate-500">No hay socios en este segmento.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {segmentosData[segmentoActivo].map((s) => {
                const seg = SEGMENTOS.find((sg) => sg.id === segmentoActivo)!;
                const sel = selSegmento.has(s.id);
                return (
                  <div key={s.id} onClick={() => setSelSegmento((prev) => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                    className={["rounded-2xl border px-5 py-4 cursor-pointer transition-all flex items-center gap-4",
                      sel ? "border-brand-green/40 bg-brand-green/5" : `${seg.border} bg-white/5 hover:bg-white/8`].join(" ")}>
                    <span className={["flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all",
                      sel ? "border-brand-green bg-brand-green/20 text-brand-green" : "border-[#1e293b] bg-[#020617]"].join(" ")}>
                      {sel && <CheckIcon />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-100">{[s.nombre, s.apellido].filter(Boolean).join(" ")}</span>
                        {s.whatsapp && <span className="text-[10px] text-green-400 flex items-center gap-0.5"><WhatsAppIcon /> {s.whatsapp}</span>}
                      </div>
                      <p className={`text-xs mt-0.5 ${seg.color}`}>{s.detalle}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal WhatsApp para segmentos */}
      {modalWASegmento && (
        <ModalWhatsApp
          socios={segmentosData[segmentoActivo]
            .filter((s) => selSegmento.has(s.id))
            .map((s) => ({ ...s, fecha_fin: null, fecha_inicio: null, dias_para_vencer: null, asistencias_30d: 0, ultima_asistencia: null, score: 0, nivel: "MEDIO" as RiesgoNivel, razones: [] }))}
          templateInicial={SEGMENTOS.find((s) => s.id === segmentoActivo)?.templateDefault}
          onClose={() => { setModalWASegmento(false); showToast("Campaña finalizada"); }}
        />
      )}
    </div>
  );
}

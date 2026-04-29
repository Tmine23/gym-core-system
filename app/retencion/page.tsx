"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabRetencion = "riesgo" | "historial" | "metricas";
type Segmento = "sin_asistencia" | "no_renovaron" | "racha_perdida" | "proximos_vencer" | "todos";
type RiesgoNivel = "ALTO" | "MEDIO" | "BAJO";

type SocioRiesgo = {
  id: number;
  nombre: string | null;
  apellido: string | null;
  whatsapp: string | null;
  codigo_telefono: string | null;
  score: number;
  nivel: RiesgoNivel;
  segmento: Exclude<Segmento, "todos">;
  segmentoLabel: string;
  detalle: string;
  ultimoContacto: string | null;
};

type EnvioHistorial = {
  id: number;
  socio_nombre: string;
  segmento: string;
  mensaje: string;
  estado: string;
  fecha_envio: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TZ = "America/La_Paz";

const SEGMENTOS_CONFIG: Record<Exclude<Segmento, "todos">, { label: string; emoji: string; color: string; border: string; bg: string; template: string }> = {
  sin_asistencia: {
    label: "Baja asistencia", emoji: "👻", color: "text-slate-400", border: "border-slate-500/30", bg: "bg-slate-500/5",
    template: "Hola {nombre}, notamos que llevas un tiempo sin visitarnos. ¡Te esperamos en el gym! 💪",
  },
  no_renovaron: {
    label: "No renovaron", emoji: "⏰", color: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/5",
    template: "Hola {nombre}, tu membresía ha vencido. ¡Renueva hoy y retoma tu rutina! 🏋️",
  },
  racha_perdida: {
    label: "Racha perdida", emoji: "🔥", color: "text-amber-400", border: "border-amber-400/30", bg: "bg-amber-400/5",
    template: "Hola {nombre}, ¡tenías una racha increíble y paraste! ¿Todo bien? Te esperamos de vuelta 💪",
  },
  proximos_vencer: {
    label: "Próximos a vencer", emoji: "📅", color: "text-violet-400", border: "border-violet-500/30", bg: "bg-violet-500/5",
    template: "Hola {nombre}, tu membresía vence pronto. ¡Renueva con anticipación! 🏆",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); }
function formatDate(iso: string) {
  if (!iso) return "—";
  const d = iso.includes("T") ? new Date(iso) : new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-BO", { day: "2-digit", month: "short", timeZone: TZ });
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

function calcularScore(diasVencer: number | null, asist30d: number, diasSinVisita: number | null): { score: number; nivel: RiesgoNivel } {
  let score = 0;
  const d = diasVencer ?? 999;
  if (d < 0) score += 40; else if (d <= 7) score += 40; else if (d <= 15) score += 30; else if (d <= 30) score += 20;
  if (asist30d === 0) score += 35; else if (asist30d <= 2) score += 25; else if (asist30d <= 5) score += 10;
  const ds = diasSinVisita ?? 999;
  if (ds > 20) score += 25; else if (ds > 10) score += 15; else if (ds > 5) score += 5;
  const nivel: RiesgoNivel = score >= 65 ? "ALTO" : score >= 35 ? "MEDIO" : "BAJO";
  return { score: Math.min(score, 100), nivel };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function WhatsAppIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>; }
function CheckIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>; }
function XIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function SendIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></svg>; }
function RefreshIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>; }

function nivelBadge(nivel: RiesgoNivel) {
  const cfg = { ALTO: "border-red-500/30 bg-red-500/10 text-red-400", MEDIO: "border-amber-400/30 bg-amber-400/10 text-amber-400", BAJO: "border-brand-green/30 bg-brand-green/10 text-brand-green" };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${cfg[nivel]}`}>{nivel}</span>;
}

// ─── Modal WhatsApp (Baileys) ─────────────────────────────────────────────────

function ModalEnvio({ socios, segmento, onClose, onSent }: {
  socios: SocioRiesgo[]; segmento: Segmento; onClose: () => void; onSent: () => void;
}) {
  const conWA = socios.filter((s) => s.whatsapp);
  const cfg = segmento !== "todos" ? SEGMENTOS_CONFIG[segmento] : null;
  const [mensaje, setMensaje] = useState(cfg?.template ?? "Hola {nombre}, te esperamos en el gym! 💪");
  const [waStatus, setWaStatus] = useState<string>("connecting");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<{ id: number; nombre: string; estado: "ok" | "error" | "pending" }[]>(
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
      const texto = mensaje.replace("{nombre}", socio.nombre ?? "socio");
      const numero = `${socio.codigo_telefono ?? "591"}${(socio.whatsapp ?? "").replace(/\D/g, "")}`;
      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: numero, text: texto }),
        });
        const estado = res.ok ? "ok" : "error";
        setResultados((prev) => prev.map((r) => r.id === socio.id ? { ...r, estado } : r));
        // Registrar en historial
        if (res.ok) {
          await supabase.from("campanas_envios").insert({
            socio_id: socio.id, segmento: socio.segmento, mensaje: texto, estado: "enviado",
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
        <div className="flex items-center justify-between border-b border-[#1e293b] px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-green-500/25 bg-green-500/10 text-green-400"><WhatsAppIcon /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Enviar campaña</p>
              <p className="text-sm font-bold text-slate-100">{cfg ? `${cfg.emoji} ${cfg.label}` : "Seleccionados"} · {conWA.length} socios</p>
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
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 block">Mensaje — usa {"{nombre}"} para personalizar</label>
                <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4}
                  className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-green/50 resize-none" />
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

export default function RetencionPage() {
  const searchParams = useSearchParams();
  const paramSegmento = searchParams.get("segmento") as Segmento | null;

  const [tab, setTab] = useState<TabRetencion>("riesgo");
  const [loading, setLoading] = useState(true);
  const [socios, setSocios] = useState<SocioRiesgo[]>([]);
  const [historial, setHistorial] = useState<EnvioHistorial[]>([]);
  const [filtroSegmento, setFiltroSegmento] = useState<Segmento>(paramSegmento ?? "todos");
  const [filtroNivel, setFiltroNivel] = useState<RiesgoNivel | "todos">("todos");
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [modalEnvio, setModalEnvio] = useState(false);

  // Métricas
  const [tasaRetencion, setTasaRetencion] = useState(0);
  const [churnRate, setChurnRate] = useState(0);
  const [totalContactados, setTotalContactados] = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    const hoy = todayStr();
    const treintaDias = new Date(Date.now() - 30 * 86400000).toISOString();
    const en7d = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    // Todos los socios activos con su suscripción
    const { data: sociosRaw } = await supabase
      .from("socios")
      .select("id, nombre, apellido, whatsapp, codigo_telefono, es_activo, suscrito")
      .eq("es_activo", true);

    // Suscripciones activas
    const { data: subsActivas } = await supabase
      .from("suscripciones")
      .select("socio_id, fecha_fin, fecha_inicio")
      .eq("estado", "ACTIVA");

    // Asistencias últimos 30 días
    const { data: asist30 } = await supabase
      .from("asistencias")
      .select("socio_id, fecha_entrada")
      .gte("fecha_entrada", treintaDias);

    // Último contacto por socio
    const { data: ultimosEnvios } = await supabase
      .from("campanas_envios")
      .select("socio_id, fecha_envio")
      .order("fecha_envio", { ascending: false });

    const ultimoContactoMap = new Map<number, string>();
    for (const e of ultimosEnvios ?? []) {
      if (!ultimoContactoMap.has(e.socio_id)) ultimoContactoMap.set(e.socio_id, e.fecha_envio);
    }

    // Mapas de asistencias
    const asisMap = new Map<number, { count: number; ultima: string | null }>();
    for (const a of asist30 ?? []) {
      const prev = asisMap.get(a.socio_id) ?? { count: 0, ultima: null };
      asisMap.set(a.socio_id, {
        count: prev.count + 1,
        ultima: !prev.ultima || a.fecha_entrada > prev.ultima ? a.fecha_entrada : prev.ultima,
      });
    }

    // Mapa de suscripciones
    const subMap = new Map<number, { fecha_fin: string; fecha_inicio: string }>();
    for (const s of subsActivas ?? []) {
      const prev = subMap.get(s.socio_id);
      if (!prev || s.fecha_fin > prev.fecha_fin) subMap.set(s.socio_id, { fecha_fin: s.fecha_fin, fecha_inicio: s.fecha_inicio });
    }

    // Construir lista unificada
    const resultado: SocioRiesgo[] = [];
    for (const s of (sociosRaw ?? []) as { id: number; nombre: string | null; apellido: string | null; whatsapp: string | null; codigo_telefono: string | null; suscrito: boolean | null }[]) {
      const sub = subMap.get(s.id);
      const asis = asisMap.get(s.id) ?? { count: 0, ultima: null };
      const diasVencer = sub ? Math.floor((new Date(sub.fecha_fin + "T12:00:00").getTime() - new Date(hoy + "T12:00:00").getTime()) / 86400000) : null;
      const diasSinVisita = asis.ultima ? Math.floor((Date.now() - new Date(asis.ultima).getTime()) / 86400000) : null;

      // Determinar segmento — prioridad: no renovó > próximo a vencer > racha perdida > baja asistencia
      // Excluir socios nuevos (suscripción empezó hace menos de 7 días)
      const diasDesdeInicio = sub ? Math.floor((new Date(hoy + "T12:00:00").getTime() - new Date(sub.fecha_inicio + "T12:00:00").getTime()) / 86400000) : null;
      let segmento: Exclude<Segmento, "todos">;
      let detalle: string;

      if (!s.suscrito && !sub) {
        segmento = "no_renovaron";
        detalle = "Suscripción vencida sin renovar";
      } else if (sub && diasVencer !== null && diasVencer <= 7 && diasVencer >= 0) {
        segmento = "proximos_vencer";
        detalle = `Vence en ${diasVencer} día(s)`;
      } else if (diasDesdeInicio !== null && diasDesdeInicio < 7) {
        continue; // socio nuevo, no evaluar aún
      } else if (asis.count >= 3 && diasSinVisita !== null && diasSinVisita > 10) {
        segmento = "racha_perdida";
        detalle = `${asis.count} visitas en 30d · paró hace ${diasSinVisita} días`;
      } else if (sub && asis.count <= 2) {
        segmento = "sin_asistencia";
        detalle = asis.count === 0
          ? "Sin visitas en los últimos 30 días"
          : `Solo ${asis.count} visita(s) en 30 días${diasSinVisita ? ` · última hace ${diasSinVisita}d` : ""}`;
      } else {
        continue;
      }

      const { score, nivel } = calcularScore(diasVencer, asis.count, diasSinVisita);
      resultado.push({
        id: s.id, nombre: s.nombre, apellido: s.apellido,
        whatsapp: s.whatsapp, codigo_telefono: s.codigo_telefono,
        score, nivel, segmento,
        segmentoLabel: SEGMENTOS_CONFIG[segmento].label,
        detalle,
        ultimoContacto: ultimoContactoMap.get(s.id) ?? null,
      });
    }

    resultado.sort((a, b) => b.score - a.score);
    setSocios(resultado);

    // Historial (solo mensajes de retención, excluir campañas de marketing)
    const { data: hist } = await supabase
      .from("campanas_envios")
      .select("id, socio_id, segmento, mensaje, estado, fecha_envio, socios(nombre, apellido)")
      .neq("segmento", "campana_marketing")
      .order("fecha_envio", { ascending: false })
      .limit(50);
    setHistorial((hist ?? []).map((h) => {
      const socioData = h.socios as unknown as { nombre: string | null; apellido: string | null } | null;
      return {
        id: h.id, segmento: h.segmento, mensaje: h.mensaje, estado: h.estado, fecha_envio: h.fecha_envio,
        socio_nombre: [socioData?.nombre, socioData?.apellido].filter(Boolean).join(" "),
      };
    }));

    // Métricas de retención
    const { data: subsMesAnterior } = await supabase.from("suscripciones").select("socio_id, fecha_fin, fecha_inicio")
      .gte("fecha_fin", new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0])
      .lte("fecha_fin", hoy);
    const { data: todasSubsRet } = await supabase.from("suscripciones").select("socio_id, fecha_inicio");
    let vencieron = 0, renovaron = 0;
    for (const s of subsMesAnterior ?? []) {
      vencieron++;
      if ((todasSubsRet ?? []).some((o) => o.socio_id === s.socio_id && o.fecha_inicio > s.fecha_fin)) renovaron++;
    }
    const tasa = vencieron > 0 ? Math.round((renovaron / vencieron) * 100) : 100;
    setTasaRetencion(tasa); setChurnRate(100 - tasa);

    const { count: contactados } = await supabase.from("campanas_envios").select("*", { count: "exact", head: true })
      .gte("fecha_envio", new Date(Date.now() - 30 * 86400000).toISOString());
    setTotalContactados(contactados ?? 0);

    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => { if (paramSegmento) setFiltroSegmento(paramSegmento); }, [paramSegmento]);

  const filtrados = useMemo(() => {
    return socios.filter((s) => {
      if (filtroSegmento !== "todos" && s.segmento !== filtroSegmento) return false;
      if (filtroNivel !== "todos" && s.nivel !== filtroNivel) return false;
      return true;
    });
  }, [socios, filtroSegmento, filtroNivel]);

  const segmentoCounts = useMemo(() => ({
    todos: socios.length,
    sin_asistencia: socios.filter((s) => s.segmento === "sin_asistencia").length,
    no_renovaron: socios.filter((s) => s.segmento === "no_renovaron").length,
    racha_perdida: socios.filter((s) => s.segmento === "racha_perdida").length,
    proximos_vencer: socios.filter((s) => s.segmento === "proximos_vencer").length,
  }), [socios]);

  function toggleSel(id: number) {
    setSeleccionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selAll() {
    setSeleccionados(seleccionados.size === filtrados.length ? new Set() : new Set(filtrados.map((s) => s.id)));
  }

  const sociosParaEnviar = socios.filter((s) => seleccionados.has(s.id));
  const segmentoEnvio = filtroSegmento !== "todos" ? filtroSegmento : (sociosParaEnviar[0]?.segmento ?? "todos");

  return (
    <div className="space-y-5">
      {modalEnvio && (
        <ModalEnvio socios={sociosParaEnviar} segmento={segmentoEnvio}
          onClose={() => setModalEnvio(false)} onSent={() => void cargar()} />
      )}

      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] bg-gradient-to-b from-white/5 to-transparent p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Operaciones</div>
            <h1 className="section-title">Retención</h1>
            <p className="section-description">Identifica socios en riesgo y actúa para retenerlos</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void cargar()} className="flex items-center gap-2 rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-slate-100"><RefreshIcon /> Actualizar</button>
            {seleccionados.size > 0 && (
              <button onClick={() => setModalEnvio(true)}
                className="flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-500 shadow-lg shadow-green-900/30">
                <WhatsAppIcon /> Enviar ({seleccionados.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto flex-nowrap">
        {([
          { id: "riesgo", label: "Panel de riesgo", count: socios.length },
          { id: "historial", label: "Acciones realizadas", count: historial.length },
          { id: "metricas", label: "Métricas", count: null },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={["rounded-2xl border px-5 py-2.5 text-sm font-bold transition-all",
              tab === t.id ? "border-brand-green/40 bg-brand-green/10 text-brand-green" : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"].join(" ")}>
            {t.label} {t.count !== null && <span className="ml-1 text-xs opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-500">Analizando socios…</div> : (<>

      {/* ── TAB: Panel de riesgo ── */}
      {tab === "riesgo" && (
        <div className="space-y-4">
          {/* Filtros por segmento */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setFiltroSegmento("todos"); setSeleccionados(new Set()); }}
              className={["rounded-2xl border px-4 py-2 text-xs font-bold transition-all",
                filtroSegmento === "todos" ? "border-brand-green/40 bg-brand-green/10 text-brand-green" : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"].join(" ")}>
              Todos ({segmentoCounts.todos})
            </button>
            {(Object.entries(SEGMENTOS_CONFIG) as [Exclude<Segmento, "todos">, typeof SEGMENTOS_CONFIG["sin_asistencia"]][]).map(([key, cfg]) => (
              <button key={key} onClick={() => { setFiltroSegmento(key); setSeleccionados(new Set()); }}
                className={["rounded-2xl border px-4 py-2 text-xs font-bold transition-all",
                  filtroSegmento === key ? `${cfg.border} ${cfg.bg} ${cfg.color}` : "border-[#1e293b] bg-white/5 text-slate-400 hover:text-slate-100"].join(" ")}>
                {cfg.emoji} {cfg.label} ({segmentoCounts[key]})
              </button>
            ))}
          </div>

          {/* Filtro nivel + seleccionar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {(["todos", "ALTO", "MEDIO", "BAJO"] as const).map((v) => (
                <button key={v} onClick={() => setFiltroNivel(v)}
                  className={["rounded-full border px-3 py-1 text-[10px] font-bold transition-all",
                    filtroNivel === v ? "border-brand-green/40 bg-brand-green/10 text-brand-green" : "border-[#1e293b] bg-white/5 text-slate-500"].join(" ")}>
                  {v === "todos" ? "Todos" : v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={selAll} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2">
                {seleccionados.size === filtrados.length && filtrados.length > 0 ? "Deseleccionar" : "Seleccionar todos"}
              </button>
              <span className="text-xs text-slate-500">{filtrados.length} socios</span>
            </div>
          </div>

          {/* Lista */}
          {filtrados.length === 0 ? (
            <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 px-5 py-12 text-center">
              <p className="text-brand-green text-lg mb-1">✓ Sin socios en riesgo</p>
              <p className="text-xs text-slate-400">No hay socios que requieran atención en este segmento.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map((s) => {
                const cfg = SEGMENTOS_CONFIG[s.segmento];
                const sel = seleccionados.has(s.id);
                return (
                  <div key={s.id} onClick={() => toggleSel(s.id)}
                    className={["rounded-2xl border px-5 py-4 cursor-pointer transition-all",
                      sel ? "border-brand-green/40 bg-brand-green/5" : "border-[#1e293b] bg-white/5 hover:bg-white/8"].join(" ")}>
                    <div className="flex items-start gap-4">
                      <span className={["mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all",
                        sel ? "border-brand-green bg-brand-green/20 text-brand-green" : "border-[#1e293b] bg-[#020617]"].join(" ")}>
                        {sel && <CheckIcon />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-100">{[s.nombre, s.apellido].filter(Boolean).join(" ")}</span>
                          {nivelBadge(s.nivel)}
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.border} ${cfg.bg} ${cfg.color}`}>
                            {cfg.emoji} {cfg.label}
                          </span>
                          {s.whatsapp && <span className="text-[10px] text-green-400 flex items-center gap-0.5"><WhatsAppIcon /> +{s.codigo_telefono}{s.whatsapp}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{s.detalle}</p>
                        {s.ultimoContacto && <p className="text-[10px] text-slate-600 mt-0.5">Último contacto: {formatDateTime(s.ultimoContacto)}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-xl font-bold ${s.nivel === "ALTO" ? "text-red-400" : s.nivel === "MEDIO" ? "text-amber-400" : "text-brand-green"}`}>{s.score}</div>
                        <div className="text-[10px] text-slate-500">score</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Historial ── */}
      {tab === "historial" && (
        <div className="space-y-3">
          {historial.length === 0 ? (
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 py-12 text-center">
              <p className="text-sm text-slate-500">No hay campañas enviadas aún.</p>
            </div>
          ) : historial.map((h) => (
            <div key={h.id} className="rounded-2xl border border-[#1e293b] bg-white/5 px-5 py-3 flex items-center gap-4">
              <span className="text-lg">{SEGMENTOS_CONFIG[h.segmento as keyof typeof SEGMENTOS_CONFIG]?.emoji ?? "📨"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">{h.socio_nombre}</span>
                  <span className="text-[10px] text-slate-500">{SEGMENTOS_CONFIG[h.segmento as keyof typeof SEGMENTOS_CONFIG]?.label ?? h.segmento}</span>
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
      )}

      {/* ── TAB: Métricas ── */}
      {tab === "metricas" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Tasa retención</div>
              <div className={`text-2xl font-bold mt-1 ${tasaRetencion >= 70 ? "text-brand-green" : "text-red-400"}`}>{tasaRetencion}%</div>
              <div className="text-xs text-slate-500">últimos 60 días</div>
            </div>
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Churn rate</div>
              <div className={`text-2xl font-bold mt-1 ${churnRate <= 30 ? "text-brand-green" : "text-red-400"}`}>{churnRate}%</div>
              <div className="text-xs text-slate-500">no renovaron</div>
            </div>
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">En riesgo</div>
              <div className="text-2xl font-bold mt-1 text-amber-400">{socios.filter((s) => s.nivel === "ALTO").length}</div>
              <div className="text-xs text-slate-500">score ≥65</div>
            </div>
            <div className="rounded-2xl border border-[#1e293b] bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Contactados 30d</div>
              <div className="text-2xl font-bold mt-1 text-sky-400">{totalContactados}</div>
              <div className="text-xs text-slate-500">mensajes enviados</div>
            </div>
          </div>

          {/* Distribución por segmento */}
          <div className="rounded-2xl border border-[#1e293b] bg-white/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Distribución por segmento</p>
            <div className="space-y-3">
              {(Object.entries(SEGMENTOS_CONFIG) as [Exclude<Segmento, "todos">, typeof SEGMENTOS_CONFIG["sin_asistencia"]][]).map(([key, cfg]) => {
                const count = segmentoCounts[key];
                const pct = socios.length > 0 ? Math.round((count / socios.length) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-lg w-6">{cfg.emoji}</span>
                    <span className="text-xs text-slate-300 w-32">{cfg.label}</span>
                    <div className="flex-1 h-6 rounded-full bg-[#1e293b] overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${key === "no_renovaron" ? "bg-red-500/50" : key === "racha_perdida" ? "bg-amber-400/50" : key === "proximos_vencer" ? "bg-violet-500/50" : "bg-slate-400/50"}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-100 w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ MODELO DE PREDICCIÓN DE CHURN ═══ */}
          <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-5 space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-green/25 bg-brand-green/10 text-brand-green">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z" /></svg>
              </span>
              <div>
                <p className="text-sm font-bold text-slate-100">Modelo de predicción de churn</p>
                <p className="text-xs text-slate-400">Scoring ponderado con 3 variables para predecir probabilidad de abandono</p>
              </div>
            </div>

            {/* Factores del modelo */}
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Factores y pesos del modelo</p>
              {[
                { factor: "Proximidad de vencimiento", peso: 40, desc: "Cuántos días faltan para que venza la suscripción. Vencida = máx. puntos.", color: "bg-red-500" },
                { factor: "Frecuencia de asistencia (30d)", peso: 35, desc: "Cantidad de visitas en los últimos 30 días. 0 visitas = máx. puntos.", color: "bg-amber-400" },
                { factor: "Días desde última visita", peso: 25, desc: "Cuánto tiempo pasó desde la última vez que vino. +20 días = máx. puntos.", color: "bg-violet-500" },
              ].map((f) => (
                <div key={f.factor} className="rounded-xl border border-[#1e293b] bg-[#020617]/50 px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-200">{f.factor}</span>
                    <span className="text-xs font-bold text-brand-green">{f.peso} pts máx.</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#1e293b] overflow-hidden mb-1.5">
                    <div className={`h-full rounded-full ${f.color}`} style={{ width: `${f.peso}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-500">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Clasificación */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Clasificación de riesgo</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-red-400">≥65</div>
                  <div className="text-[10px] text-red-400 font-semibold">ALTO RIESGO</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{socios.filter((s) => s.nivel === "ALTO").length} socios</div>
                </div>
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-amber-400">35-64</div>
                  <div className="text-[10px] text-amber-400 font-semibold">RIESGO MEDIO</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{socios.filter((s) => s.nivel === "MEDIO").length} socios</div>
                </div>
                <div className="rounded-xl border border-brand-green/30 bg-brand-green/10 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-brand-green">&lt;35</div>
                  <div className="text-[10px] text-brand-green font-semibold">BAJO RIESGO</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{socios.filter((s) => s.nivel === "BAJO").length} socios</div>
                </div>
              </div>
            </div>

            {/* Ejemplo en vivo */}
            {socios.length > 0 && (() => {
              const ejemplo = socios[0]; // socio con mayor score
              const cfg = SEGMENTOS_CONFIG[ejemplo.segmento];
              return (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Ejemplo en vivo — socio con mayor riesgo</p>
                  <div className="rounded-xl border border-[#1e293b] bg-[#020617]/50 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-100">{[ejemplo.nombre, ejemplo.apellido].filter(Boolean).join(" ")}</span>
                        {nivelBadge(ejemplo.nivel)}
                        <span className={`text-[10px] ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                      </div>
                      <span className="text-2xl font-bold text-red-400">{ejemplo.score}</span>
                    </div>
                    <p className="text-xs text-slate-400">{ejemplo.detalle}</p>
                    <div className="h-3 w-full rounded-full bg-[#1e293b] overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${ejemplo.nivel === "ALTO" ? "bg-red-500" : ejemplo.nivel === "MEDIO" ? "bg-amber-400" : "bg-brand-green"}`}
                        style={{ width: `${ejemplo.score}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-600">Score {ejemplo.score}/100 → El modelo recomienda contactar a este socio de forma urgente.</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      </>)}
    </div>
  );
}

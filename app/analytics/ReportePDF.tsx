"use client";

import {
  Document, Page, Text, View, StyleSheet, pdf,
} from "@react-pdf/renderer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReporteData = {
  periodo: string;
  fechaGeneracion: string;
  gymNombre: string;
  // KPIs
  ingresosMes: number;
  ingresosAnterior: number;
  trendPct: number;
  pagosCount: number;
  tasaRetencion: number;
  churnRate: number;
  totalSocios: number;
  totalSuscritos: number;
  // Ingresos por mes
  ingresosMensuales: { mes: string; bob: number; count: number }[];
  // Retención por mes
  retencionMensual: { mes: string; tasa: number; vencieron: number; renovaron: number }[];
  // Distribución planes
  planes: { nombre: string; cantidad: number }[];
  // Insights
  insights: { titulo: string; descripcion: string; prioridad: string }[];
  // Pronóstico
  pronostico: { mes: string; regresion: number; wma: number | null; holt: number | null }[];
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 40, backgroundColor: "#ffffff" },
  header: { marginBottom: 20 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 18, color: "#0f172a" },
  subtitle: { fontSize: 10, color: "#64748b", marginTop: 2 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, color: "#0f172a", marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  kpiGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  kpiBox: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10 },
  kpiLabel: { fontSize: 7, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  kpiValue: { fontFamily: "Helvetica-Bold", fontSize: 16, color: "#0f172a", marginTop: 2 },
  kpiSub: { fontSize: 7, color: "#94a3b8", marginTop: 1 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 4, paddingHorizontal: 6 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#f1f5f9", paddingVertical: 3, paddingHorizontal: 6 },
  thCell: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#64748b", textTransform: "uppercase" },
  tdCell: { fontSize: 8, color: "#334155" },
  tdBold: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#0f172a" },
  insightBox: { borderWidth: 1, borderRadius: 6, padding: 8, marginBottom: 6 },
  insightTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#0f172a" },
  insightDesc: { fontSize: 8, color: "#64748b", marginTop: 2 },
  badge: { fontSize: 7, fontFamily: "Helvetica-Bold", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  footer: { position: "absolute", bottom: 25, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#e2e8f0", paddingTop: 6 },
  footerText: { fontSize: 7, color: "#94a3b8" },
  green: { color: "#16a34a" },
  red: { color: "#dc2626" },
});

function fmtMoney(n: number) { return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 0 })}`; }

// ─── PDF Document ─────────────────────────────────────────────────────────────

function ReporteDocument({ data }: { data: ReporteData }) {
  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.title}>{data.gymNombre} — Reporte BI</Text>
          <Text style={S.subtitle}>Período: {data.periodo} · Generado: {data.fechaGeneracion}</Text>
        </View>

        {/* KPIs */}
        <Text style={S.sectionTitle}>Indicadores Clave</Text>
        <View style={S.kpiGrid}>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>Ingresos del mes</Text>
            <Text style={S.kpiValue}>{fmtMoney(data.ingresosMes)}</Text>
            <Text style={[S.kpiSub, data.trendPct >= 0 ? S.green : S.red]}>
              {data.trendPct >= 0 ? "↑" : "↓"} {Math.abs(data.trendPct)}% vs anterior
            </Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>Tasa retención</Text>
            <Text style={[S.kpiValue, data.tasaRetencion >= 70 ? S.green : S.red]}>{data.tasaRetencion}%</Text>
            <Text style={S.kpiSub}>Churn: {data.churnRate}%</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>Socios suscritos</Text>
            <Text style={S.kpiValue}>{data.totalSuscritos}/{data.totalSocios}</Text>
            <Text style={S.kpiSub}>{data.totalSocios > 0 ? Math.round((data.totalSuscritos / data.totalSocios) * 100) : 0}% del total</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>Pagos del mes</Text>
            <Text style={S.kpiValue}>{data.pagosCount}</Text>
          </View>
        </View>

        {/* Insights */}
        {data.insights.length > 0 && (
          <>
            <Text style={S.sectionTitle}>Insights y Recomendaciones</Text>
            {data.insights.slice(0, 5).map((ins, i) => {
              const borderColor = ins.prioridad === "alta" ? "#fca5a5" : ins.prioridad === "media" ? "#fcd34d" : "#86efac";
              return (
                <View key={i} style={[S.insightBox, { borderColor }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={S.insightTitle}>{ins.titulo}</Text>
                    <Text style={[S.badge, {
                      backgroundColor: ins.prioridad === "alta" ? "#fef2f2" : ins.prioridad === "media" ? "#fffbeb" : "#f0fdf4",
                      color: ins.prioridad === "alta" ? "#dc2626" : ins.prioridad === "media" ? "#d97706" : "#16a34a",
                    }]}>{ins.prioridad.toUpperCase()}</Text>
                  </View>
                  <Text style={S.insightDesc}>{ins.descripcion}</Text>
                </View>
              );
            })}
          </>
        )}

        {/* Ingresos mensuales */}
        <Text style={S.sectionTitle}>Ingresos Mensuales</Text>
        <View style={S.tableHeader}>
          <Text style={[S.thCell, { width: "30%" }]}>Mes</Text>
          <Text style={[S.thCell, { width: "35%", textAlign: "right" }]}>Ingresos BOB</Text>
          <Text style={[S.thCell, { width: "35%", textAlign: "right" }]}>Pagos</Text>
        </View>
        {data.ingresosMensuales.slice(-6).map((m, i) => (
          <View key={i} style={S.tableRow}>
            <Text style={[S.tdCell, { width: "30%" }]}>{m.mes}</Text>
            <Text style={[S.tdBold, { width: "35%", textAlign: "right" }]}>{fmtMoney(m.bob)}</Text>
            <Text style={[S.tdCell, { width: "35%", textAlign: "right" }]}>{m.count}</Text>
          </View>
        ))}

        {/* Retención */}
        <Text style={S.sectionTitle}>Retención Mensual</Text>
        <View style={S.tableHeader}>
          <Text style={[S.thCell, { width: "25%" }]}>Mes</Text>
          <Text style={[S.thCell, { width: "25%", textAlign: "right" }]}>Vencieron</Text>
          <Text style={[S.thCell, { width: "25%", textAlign: "right" }]}>Renovaron</Text>
          <Text style={[S.thCell, { width: "25%", textAlign: "right" }]}>Tasa</Text>
        </View>
        {data.retencionMensual.slice(-6).map((m, i) => (
          <View key={i} style={S.tableRow}>
            <Text style={[S.tdCell, { width: "25%" }]}>{m.mes}</Text>
            <Text style={[S.tdCell, { width: "25%", textAlign: "right" }]}>{m.vencieron}</Text>
            <Text style={[S.tdCell, { width: "25%", textAlign: "right" }]}>{m.renovaron}</Text>
            <Text style={[S.tdBold, { width: "25%", textAlign: "right" }, m.tasa >= 70 ? S.green : S.red]}>{m.tasa}%</Text>
          </View>
        ))}

        {/* Pronóstico */}
        {data.pronostico.length > 0 && (
          <>
            <Text style={S.sectionTitle}>Pronóstico de Ingresos (3 meses)</Text>
            <View style={S.tableHeader}>
              <Text style={[S.thCell, { width: "25%" }]}>Mes</Text>
              <Text style={[S.thCell, { width: "25%", textAlign: "right" }]}>Reg. Lineal</Text>
              <Text style={[S.thCell, { width: "25%", textAlign: "right" }]}>Media Móvil</Text>
              <Text style={[S.thCell, { width: "25%", textAlign: "right" }]}>Holt</Text>
            </View>
            {data.pronostico.filter((p) => p.regresion > 0).slice(-3).map((p, i) => (
              <View key={i} style={S.tableRow}>
                <Text style={[S.tdCell, { width: "25%" }]}>{p.mes}</Text>
                <Text style={[S.tdCell, { width: "25%", textAlign: "right" }]}>{fmtMoney(p.regresion)}</Text>
                <Text style={[S.tdCell, { width: "25%", textAlign: "right" }]}>{p.wma ? fmtMoney(p.wma) : "—"}</Text>
                <Text style={[S.tdBold, { width: "25%", textAlign: "right" }]}>{p.holt ? fmtMoney(p.holt) : "—"}</Text>
              </View>
            ))}
          </>
        )}

        {/* Distribución planes */}
        {data.planes.length > 0 && (
          <>
            <Text style={S.sectionTitle}>Distribución por Plan</Text>
            {data.planes.map((p, i) => (
              <View key={i} style={S.row}>
                <Text style={S.tdCell}>{p.nombre}</Text>
                <Text style={S.tdBold}>{p.cantidad} socios</Text>
              </View>
            ))}
          </>
        )}

        {/* Footer */}
        <View style={S.footer}>
          <Text style={S.footerText}>Generado por Gym OS — Sistema de Inteligencia de Negocios</Text>
          <Text style={S.footerText}>{data.fechaGeneracion}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Export function ──────────────────────────────────────────────────────────

export async function generarReporteBI(data: ReporteData) {
  const blob = await pdf(<ReporteDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

"use client";

import {
  Document, Page, Text, View, StyleSheet, pdf,
} from "@react-pdf/renderer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReporteComparativoData = {
  fechaGeneracion: string;
  gymNombre: string;
  periodo: string;
  sucursales: {
    nombre: string;
    ciudad: string;
    ingresosMes: number;
    asistenciasMes: number;
    suscActivas: number;
    tasaRetencion: number;
    arpu: number;
    topPlan: string;
  }[];
  totales: {
    ingresos: number;
    asistencias: number;
    suscritos: number;
  };
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 40, backgroundColor: "#ffffff" },
  header: { marginBottom: 20 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 18, color: "#0f172a" },
  subtitle: { fontSize: 10, color: "#64748b", marginTop: 2 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, color: "#0f172a", marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 4 },
  kpiGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  kpiBox: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10 },
  kpiLabel: { fontSize: 7, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  kpiValue: { fontFamily: "Helvetica-Bold", fontSize: 16, color: "#0f172a", marginTop: 2 },
  kpiSub: { fontSize: 7, color: "#94a3b8", marginTop: 1 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 4, paddingHorizontal: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#f1f5f9", paddingVertical: 3, paddingHorizontal: 4 },
  thCell: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#64748b", textTransform: "uppercase" },
  tdCell: { fontSize: 8, color: "#334155" },
  tdBold: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#0f172a" },
  tdGreen: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#16a34a" },
  footer: { position: "absolute", bottom: 25, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#e2e8f0", paddingTop: 6 },
  footerText: { fontSize: 7, color: "#94a3b8" },
});

function fmtMoney(n: number) { return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 0 })}`; }

// ─── Helpers to find best performer ──────────────────────────────────────────

function findBestIndex(sucursales: ReporteComparativoData["sucursales"], key: keyof ReporteComparativoData["sucursales"][0]) {
  let bestIdx = 0;
  let bestVal = -Infinity;
  for (let i = 0; i < sucursales.length; i++) {
    const val = Number(sucursales[i][key]) || 0;
    if (val > bestVal) { bestVal = val; bestIdx = i; }
  }
  return bestIdx;
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

function ReporteComparativoDocument({ data }: { data: ReporteComparativoData }) {
  const bestIngresos = findBestIndex(data.sucursales, "ingresosMes");
  const bestAsistencias = findBestIndex(data.sucursales, "asistenciasMes");
  const bestSuscritos = findBestIndex(data.sucursales, "suscActivas");
  const bestRetencion = findBestIndex(data.sucursales, "tasaRetencion");
  const bestArpu = findBestIndex(data.sucursales, "arpu");

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.title}>{data.gymNombre} — Reporte Comparativo Multisucursal</Text>
          <Text style={S.subtitle}>Período: {data.periodo} · Generado: {data.fechaGeneracion}</Text>
        </View>

        {/* KPI Totals */}
        <Text style={S.sectionTitle}>Totales Consolidados</Text>
        <View style={S.kpiGrid}>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>Ingresos totales</Text>
            <Text style={S.kpiValue}>{fmtMoney(data.totales.ingresos)}</Text>
            <Text style={S.kpiSub}>{data.sucursales.length} sucursales</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>Asistencias totales</Text>
            <Text style={S.kpiValue}>{data.totales.asistencias.toLocaleString("es-BO")}</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>Suscritos totales</Text>
            <Text style={S.kpiValue}>{data.totales.suscritos.toLocaleString("es-BO")}</Text>
          </View>
        </View>

        {/* Comparison Table */}
        <Text style={S.sectionTitle}>Comparativa por Sucursal</Text>
        <View style={S.tableHeader}>
          <Text style={[S.thCell, { width: "14%" }]}>Sucursal</Text>
          <Text style={[S.thCell, { width: "10%" }]}>Ciudad</Text>
          <Text style={[S.thCell, { width: "14%", textAlign: "right" }]}>Ingresos</Text>
          <Text style={[S.thCell, { width: "12%", textAlign: "right" }]}>Asistencias</Text>
          <Text style={[S.thCell, { width: "12%", textAlign: "right" }]}>Suscritos</Text>
          <Text style={[S.thCell, { width: "12%", textAlign: "right" }]}>Retención</Text>
          <Text style={[S.thCell, { width: "12%", textAlign: "right" }]}>ARPU</Text>
          <Text style={[S.thCell, { width: "14%" }]}>Plan Top</Text>
        </View>
        {data.sucursales.map((suc, i) => (
          <View key={i} style={S.tableRow}>
            <Text style={[S.tdBold, { width: "14%" }]}>{suc.nombre}</Text>
            <Text style={[S.tdCell, { width: "10%" }]}>{suc.ciudad}</Text>
            <Text style={[i === bestIngresos ? S.tdGreen : S.tdCell, { width: "14%", textAlign: "right" }]}>{fmtMoney(suc.ingresosMes)}</Text>
            <Text style={[i === bestAsistencias ? S.tdGreen : S.tdCell, { width: "12%", textAlign: "right" }]}>{suc.asistenciasMes}</Text>
            <Text style={[i === bestSuscritos ? S.tdGreen : S.tdCell, { width: "12%", textAlign: "right" }]}>{suc.suscActivas}</Text>
            <Text style={[i === bestRetencion ? S.tdGreen : S.tdCell, { width: "12%", textAlign: "right" }]}>{suc.tasaRetencion}%</Text>
            <Text style={[i === bestArpu ? S.tdGreen : S.tdCell, { width: "12%", textAlign: "right" }]}>{fmtMoney(suc.arpu)}</Text>
            <Text style={[S.tdCell, { width: "14%" }]}>{suc.topPlan}</Text>
          </View>
        ))}

        {/* Footer */}
        <View style={S.footer}>
          <Text style={S.footerText}>Generado por Gym OS — Reporte Comparativo Multisucursal</Text>
          <Text style={S.footerText}>{data.fechaGeneracion}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Export function ──────────────────────────────────────────────────────────

export async function generarReporteComparativo(data: ReporteComparativoData) {
  const blob = await pdf(<ReporteComparativoDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

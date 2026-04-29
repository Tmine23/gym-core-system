"use client";

import {
  Document, Page, Text, View, StyleSheet, pdf,
} from "@react-pdf/renderer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReporteMensualData = {
  fechaGeneracion: string;
  gymNombre: string;
  sucursalNombre: string;
  mes: string;
  // Financial
  ingresosBob: number;
  ingresosUsd: number;
  totalPagos: number;
  porMetodo: { metodo: string; monto: number; count: number }[];
  // Members
  sociosNuevos: number;
  renovaciones: number;
  bajas: number;
  totalActivos: number;
  // Retention
  tasaRetencion: number;
  churnRate: number;
  // Top 5 pagos
  topPagos: { socio: string; monto: number; plan: string; fecha: string }[];
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
  memberGrid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  memberBox: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10, alignItems: "center" },
  memberValue: { fontFamily: "Helvetica-Bold", fontSize: 20, color: "#0f172a" },
  memberLabel: { fontSize: 7, color: "#64748b", marginTop: 2, textTransform: "uppercase" },
  retentionRow: { flexDirection: "row", gap: 20, marginBottom: 12 },
  retentionBox: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  retentionValue: { fontFamily: "Helvetica-Bold", fontSize: 22 },
  retentionLabel: { fontSize: 8, color: "#64748b" },
  green: { color: "#16a34a" },
  red: { color: "#dc2626" },
  footer: { position: "absolute", bottom: 25, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#e2e8f0", paddingTop: 6 },
  footerText: { fontSize: 7, color: "#94a3b8" },
});

function fmtMoney(n: number) { return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 0 })}`; }

// ─── PDF Document ─────────────────────────────────────────────────────────────

function ReporteMensualDocument({ data }: { data: ReporteMensualData }) {
  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.title}>Reporte de Cierre Mensual — {data.mes}</Text>
          <Text style={S.subtitle}>{data.gymNombre} · {data.sucursalNombre} · Generado: {data.fechaGeneracion}</Text>
        </View>

        {/* Financial Summary */}
        <Text style={S.sectionTitle}>Resumen Financiero</Text>
        <View style={S.kpiGrid}>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>Ingresos BOB</Text>
            <Text style={S.kpiValue}>{fmtMoney(data.ingresosBob)}</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>Ingresos USD</Text>
            <Text style={[S.kpiValue, { fontSize: 14 }]}>$ {data.ingresosUsd.toLocaleString("es-BO", { minimumFractionDigits: 0 })}</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>Total pagos</Text>
            <Text style={S.kpiValue}>{data.totalPagos}</Text>
          </View>
        </View>

        {/* Breakdown by payment method */}
        <Text style={S.sectionTitle}>Desglose por Método de Pago</Text>
        <View style={S.tableHeader}>
          <Text style={[S.thCell, { width: "40%" }]}>Método</Text>
          <Text style={[S.thCell, { width: "30%", textAlign: "right" }]}>Monto</Text>
          <Text style={[S.thCell, { width: "30%", textAlign: "right" }]}>Transacciones</Text>
        </View>
        {data.porMetodo.map((m, i) => (
          <View key={i} style={S.tableRow}>
            <Text style={[S.tdCell, { width: "40%" }]}>{m.metodo}</Text>
            <Text style={[S.tdBold, { width: "30%", textAlign: "right" }]}>{fmtMoney(m.monto)}</Text>
            <Text style={[S.tdCell, { width: "30%", textAlign: "right" }]}>{m.count}</Text>
          </View>
        ))}

        {/* Member Movement */}
        <Text style={S.sectionTitle}>Movimiento de Socios</Text>
        <View style={S.memberGrid}>
          <View style={S.memberBox}>
            <Text style={[S.memberValue, S.green]}>+{data.sociosNuevos}</Text>
            <Text style={S.memberLabel}>Nuevos</Text>
          </View>
          <View style={S.memberBox}>
            <Text style={[S.memberValue, { color: "#2563eb" }]}>{data.renovaciones}</Text>
            <Text style={S.memberLabel}>Renovaciones</Text>
          </View>
          <View style={S.memberBox}>
            <Text style={[S.memberValue, S.red]}>-{data.bajas}</Text>
            <Text style={S.memberLabel}>Bajas</Text>
          </View>
          <View style={S.memberBox}>
            <Text style={S.memberValue}>{data.totalActivos}</Text>
            <Text style={S.memberLabel}>Total activos</Text>
          </View>
        </View>

        {/* Retention Metrics */}
        <Text style={S.sectionTitle}>Métricas de Retención</Text>
        <View style={S.retentionRow}>
          <View style={S.retentionBox}>
            <Text style={[S.retentionValue, data.tasaRetencion >= 70 ? S.green : S.red]}>{data.tasaRetencion}%</Text>
            <Text style={S.retentionLabel}>Tasa de retención</Text>
          </View>
          <View style={S.retentionBox}>
            <Text style={[S.retentionValue, data.churnRate <= 30 ? S.green : S.red]}>{data.churnRate}%</Text>
            <Text style={S.retentionLabel}>Churn rate</Text>
          </View>
        </View>

        {/* Top 5 Pagos */}
        {data.topPagos.length > 0 && (
          <>
            <Text style={S.sectionTitle}>Top 5 Pagos del Mes</Text>
            <View style={S.tableHeader}>
              <Text style={[S.thCell, { width: "30%" }]}>Socio</Text>
              <Text style={[S.thCell, { width: "20%", textAlign: "right" }]}>Monto</Text>
              <Text style={[S.thCell, { width: "30%" }]}>Plan</Text>
              <Text style={[S.thCell, { width: "20%" }]}>Fecha</Text>
            </View>
            {data.topPagos.map((p, i) => (
              <View key={i} style={S.tableRow}>
                <Text style={[S.tdBold, { width: "30%" }]}>{p.socio}</Text>
                <Text style={[S.tdBold, { width: "20%", textAlign: "right" }]}>{fmtMoney(p.monto)}</Text>
                <Text style={[S.tdCell, { width: "30%" }]}>{p.plan}</Text>
                <Text style={[S.tdCell, { width: "20%" }]}>{p.fecha}</Text>
              </View>
            ))}
          </>
        )}

        {/* Footer */}
        <View style={S.footer}>
          <Text style={S.footerText}>Generado por Gym OS — Cierre Mensual</Text>
          <Text style={S.footerText}>{data.fechaGeneracion}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Export function ──────────────────────────────────────────────────────────

export async function generarReporteMensual(data: ReporteMensualData) {
  const blob = await pdf(<ReporteMensualDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

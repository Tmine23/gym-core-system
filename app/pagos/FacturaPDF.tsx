"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";

// ─── Types (duplicated here so this file is self-contained for dynamic import) ─

type MetodoPago = "EFECTIVO" | "QR_LIBELULA" | "TRANSFERENCIA" | "CRIPTOMONEDA";
type Moneda = "BOB" | "USD";

export type FacturaPDFData = {
  pago: {
    id: number;
    monto_pagado: number;
    codigo_moneda: Moneda;
    metodo_pago: MetodoPago;
    referencia_transaccion: string | null;
    fecha_pago: string;
    facturas: {
      numero: number;
      nit_ci_comprador: string;
      razon_social_comprador: string;
      cufd: string | null;
      codigo_autorizacion: string | null;
    } | null;
    socios: { nombre: string | null; apellido: string | null; ci: string | null } | null;
    suscripciones: {
      planes: { nombre: string | null } | null;
    } | null;
  };
  sucursal: {
    nombre: string;
    direccion: string;
    telefono: string | null;
    ciudad: string;
    nit: string | null;
  };
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Courier",
    fontSize: 8,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
    width: 226, // 80mm at 72dpi
  },
  center: { textAlign: "center" },
  bold: { fontFamily: "Courier-Bold" },
  divider: { borderBottomWidth: 0.5, borderBottomColor: "#aaaaaa", marginVertical: 5 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  gap2: { marginBottom: 2 },
  gap4: { marginBottom: 4 },
  gap6: { marginBottom: 6 },
  title: { fontFamily: "Courier-Bold", fontSize: 10, textAlign: "center" },
  subtitle: { fontSize: 7, textAlign: "center", color: "#444444" },
  label: { fontSize: 7, color: "#555555" },
  value: { fontSize: 8 },
  valueBold: { fontFamily: "Courier-Bold", fontSize: 8 },
  tableHeader: { fontFamily: "Courier-Bold", fontSize: 7 },
  total: { fontFamily: "Courier-Bold", fontSize: 9 },
  footer: { fontFamily: "Courier-Bold", fontSize: 7, textAlign: "center", marginTop: 8 },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const metodoLabel: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  QR_LIBELULA: "QR Libélula",
  TRANSFERENCIA: "Transferencia",
  CRIPTOMONEDA: "Criptomoneda",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-BO", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-BO", {
    hour: "2-digit", minute: "2-digit",
  });
}
function numToWords(n: number): string {
  const entero = Math.floor(n);
  const centavos = Math.round((n - entero) * 100);
  return `${entero} con ${String(centavos).padStart(2, "0")}/100 Bolivianos`;
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

export function FacturaDocument({ pago, sucursal }: FacturaPDFData) {
  const factura = pago.facturas;
  const monto = Number(pago.monto_pagado);
  const montoStr = monto.toFixed(2);
  const planNombre = pago.suscripciones?.planes?.nombre ?? "Membresía";
  const compradorNombre = (
    factura?.razon_social_comprador ||
    [pago.socios?.nombre, pago.socios?.apellido].filter(Boolean).join(" ") ||
    "CLIENTE PARTICULAR"
  ).toUpperCase();
  const nitCi = factura?.nit_ci_comprador || pago.socios?.ci || "100";

  return (
    <Document>
      <Page size={[226, 600]} style={S.page}>
        {/* Emisor */}
        <Text style={S.title}>{sucursal.nombre.toUpperCase()}</Text>
        <View style={S.gap2} />
        <Text style={S.subtitle}>{sucursal.direccion}</Text>
        <Text style={S.subtitle}>{sucursal.ciudad}</Text>
        {sucursal.telefono ? <Text style={S.subtitle}>Tel: {sucursal.telefono}</Text> : null}

        <View style={S.divider} />

        {/* Datos fiscales emisor */}
        <Text style={S.label}>NIT: {sucursal.nit ?? "—"}</Text>
        <Text style={S.label}>Nro. Factura: {factura?.numero ?? "—"}</Text>
        {factura?.cufd ? <Text style={S.label}>CUFD: {factura.cufd}</Text> : null}
        {factura?.codigo_autorizacion ? (
          <Text style={S.label}>Cód. Aut.: {factura.codigo_autorizacion}</Text>
        ) : null}

        <View style={S.divider} />

        {/* Comprador */}
        <Text style={S.label}>Señor(es):</Text>
        <Text style={[S.valueBold, S.gap2]}>{compradorNombre}</Text>
        <Text style={S.label}>NIT/CI: {nitCi}</Text>
        <Text style={S.label}>
          Fecha: {fmtDate(pago.fecha_pago)}   Hora: {fmtTime(pago.fecha_pago)}
        </Text>

        <View style={S.divider} />

        {/* Detalle */}
        <Text style={S.tableHeader}>Cant  Detalle                 P/U      SubTotal</Text>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#aaaaaa", marginBottom: 3 }} />
        <Text style={S.value}>1     {planNombre}</Text>
        <View style={S.row}>
          <Text style={S.label}>      P/U: {montoStr}</Text>
          <Text style={S.label}>SubTotal: {montoStr}</Text>
        </View>

        <View style={S.divider} />

        {/* Totales */}
        <View style={[S.row, S.gap2]}>
          <Text style={S.value}>TOTAL Bs:</Text>
          <Text style={S.value}>{montoStr}</Text>
        </View>
        <View style={[S.row, S.gap2]}>
          <Text style={S.value}>Descuento:</Text>
          <Text style={S.value}>0.00</Text>
        </View>
        <View style={[S.row, S.gap4]}>
          <Text style={S.total}>Total Neto:</Text>
          <Text style={S.total}>{montoStr}</Text>
        </View>

        <Text style={S.label}>Son: {numToWords(monto)}</Text>
        <Text style={[S.label, S.gap4]}>Importe Crédito Fiscal: {montoStr}</Text>

        <View style={S.divider} />

        {/* Método */}
        <Text style={S.label}>Método: {metodoLabel[pago.metodo_pago]}</Text>
        {pago.referencia_transaccion ? (
          <Text style={S.label}>Ref: {pago.referencia_transaccion}</Text>
        ) : null}

        <Text style={S.footer}>GRACIAS POR SU PREFERENCIA</Text>
      </Page>
    </Document>
  );
}

// ─── Trigger download ─────────────────────────────────────────────────────────

export async function abrirFacturaPDF(data: FacturaPDFData) {
  const blob = await pdf(<FacturaDocument {...data} />).toBlob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

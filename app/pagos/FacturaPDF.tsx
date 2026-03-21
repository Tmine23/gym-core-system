"use client";

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import QRCode from "qrcode";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  qrDataUrl?: string; // pre-generado antes de pasar al componente
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Courier",
    fontSize: 8,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
    width: 226,
  },
  divider: { borderBottomWidth: 0.5, borderBottomColor: "#aaaaaa", marginVertical: 5 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  gap2: { marginBottom: 2 },
  gap4: { marginBottom: 4 },
  title: { fontFamily: "Courier-Bold", fontSize: 10, textAlign: "center" },
  subtitle: { fontSize: 7, textAlign: "center", color: "#444444" },
  label: { fontSize: 7, color: "#555555" },
  labelBold: { fontFamily: "Courier-Bold", fontSize: 7, color: "#333333" },
  value: { fontSize: 8 },
  valueBold: { fontFamily: "Courier-Bold", fontSize: 8 },
  tableHeader: { fontFamily: "Courier-Bold", fontSize: 7 },
  total: { fontFamily: "Courier-Bold", fontSize: 9 },
  cuf: { fontSize: 6, color: "#444444", wordBreak: "break-all" },
  qrContainer: { alignItems: "center", marginVertical: 6 },
  qrImage: { width: 80, height: 80 },
  leyenda: { fontSize: 6, color: "#555555", textAlign: "center", marginTop: 4 },
  footer: { fontFamily: "Courier-Bold", fontSize: 7, textAlign: "center", marginTop: 6 },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const metodoLabel: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  QR_LIBELULA: "QR Libélula",
  TRANSFERENCIA: "Transferencia",
  CRIPTOMONEDA: "Criptomoneda",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}
function fmtNumero(n: number) {
  return String(n).padStart(6, "0");
}

// Conversión de número a literal en bolivianos (simplificado)
function numToWords(n: number): string {
  const entero = Math.floor(n);
  const centavos = Math.round((n - entero) * 100);
  const unidades = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
    "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const decenas = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const centenas = ["", "CIEN", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
    "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

  function convertir(num: number): string {
    if (num === 0) return "";
    if (num < 20) return unidades[num];
    if (num < 100) {
      const d = Math.floor(num / 10), u = num % 10;
      return u === 0 ? decenas[d] : `${decenas[d]} Y ${unidades[u]}`;
    }
    if (num === 100) return "CIEN";
    if (num < 1000) {
      const c = Math.floor(num / 100), r = num % 100;
      return r === 0 ? centenas[c] : `${centenas[c]} ${convertir(r)}`;
    }
    if (num < 2000) return `MIL ${convertir(num % 1000)}`.trim();
    if (num < 1000000) {
      const m = Math.floor(num / 1000), r = num % 1000;
      return r === 0 ? `${convertir(m)} MIL` : `${convertir(m)} MIL ${convertir(r)}`;
    }
    return String(num);
  }

  const literal = convertir(entero).trim() || "CERO";
  return `${literal} CON ${String(centavos).padStart(2, "0")}/100 BOLIVIANOS`;
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

export function FacturaDocument({ pago, sucursal, qrDataUrl }: FacturaPDFData) {
  const factura = pago.facturas;
  const monto = Number(pago.monto_pagado);
  const montoStr = monto.toFixed(2);
  const planNombre = pago.suscripciones?.planes?.nombre ?? "Membresía";
  const compradorNombre = (factura?.razon_social_comprador || pago.socios?.apellido || "CLIENTE PARTICULAR").toUpperCase();
  const nitCi = factura?.nit_ci_comprador || pago.socios?.ci || "0";
  const nroFactura = factura?.numero ? fmtNumero(factura.numero) : "000000";

  return (
    <Document>
      <Page size={[226, 720]} style={S.page}>
        {/* Emisor */}
        <Text style={S.title}>{sucursal.nombre.toUpperCase()}</Text>
        <View style={S.gap2} />
        <Text style={S.subtitle}>{sucursal.direccion}</Text>
        <Text style={S.subtitle}>{sucursal.ciudad}</Text>
        {sucursal.telefono ? <Text style={S.subtitle}>Tel: {sucursal.telefono}</Text> : null}

        <View style={S.divider} />

        {/* Datos fiscales emisor */}
        <View style={[S.row, S.gap2]}>
          <Text style={S.label}>NIT Emisor: {sucursal.nit ?? "—"}</Text>
          <Text style={S.label}>Factura N°: {nroFactura}</Text>
        </View>
        {factura?.codigo_autorizacion
          ? <Text style={[S.label, S.gap2]}>Cód. Autorización: {factura.codigo_autorizacion}</Text>
          : null}

        <View style={S.divider} />

        {/* Comprador */}
        <Text style={S.label}>RAZÓN SOCIAL:</Text>
        <Text style={[S.valueBold, S.gap2]}>{compradorNombre}</Text>
        <Text style={[S.label, S.gap2]}>NIT/CI: {nitCi}</Text>
        <Text style={S.label}>Fecha: {fmtDate(pago.fecha_pago)}   Hora: {fmtTime(pago.fecha_pago)}</Text>

        <View style={S.divider} />

        {/* Detalle */}
        <Text style={[S.tableHeader, S.gap2]}>DETALLE</Text>
        <View style={S.row}>
          <Text style={S.label}>Cant.</Text>
          <Text style={S.label}>Descripción</Text>
          <Text style={S.label}>P/U</Text>
          <Text style={S.label}>SubTotal</Text>
        </View>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#cccccc", marginBottom: 3 }} />
        <View style={[S.row, S.gap4]}>
          <Text style={S.value}>1</Text>
          <Text style={S.value}>{planNombre}</Text>
          <Text style={S.value}>{montoStr}</Text>
          <Text style={S.value}>{montoStr}</Text>
        </View>

        <View style={S.divider} />

        {/* Totales */}
        <View style={[S.row, S.gap2]}>
          <Text style={S.value}>Subtotal:</Text>
          <Text style={S.value}>{montoStr}</Text>
        </View>
        <View style={[S.row, S.gap2]}>
          <Text style={S.value}>Descuento:</Text>
          <Text style={S.value}>0.00</Text>
        </View>
        <View style={[S.row, S.gap2]}>
          <Text style={S.total}>TOTAL Bs:</Text>
          <Text style={S.total}>{montoStr}</Text>
        </View>

        {/* Monto en literal */}
        <View style={S.gap2} />
        <Text style={S.labelBold}>Son: {numToWords(monto)}</Text>
        <Text style={[S.label, S.gap2]}>Importe Crédito Fiscal: {montoStr}</Text>

        {/* Método */}
        <Text style={S.label}>Método de pago: {metodoLabel[pago.metodo_pago]}</Text>
        {pago.referencia_transaccion
          ? <Text style={[S.label, S.gap2]}>Ref: {pago.referencia_transaccion}</Text>
          : <View style={S.gap2} />}

        <View style={S.divider} />

        {/* CUF */}
        {factura?.cufd ? (
          <>
            <Text style={S.labelBold}>Código CUF:</Text>
            <Text style={[S.cuf, S.gap4]}>{factura.cufd}</Text>
          </>
        ) : null}

        {/* QR */}
        {qrDataUrl ? (
          <View style={S.qrContainer}>
            <Image src={qrDataUrl} style={S.qrImage} />
          </View>
        ) : null}

        {/* Leyenda normativa Bolivia */}
        <View style={S.divider} />
        <Text style={S.leyenda}>
          "Esta factura contribuye al desarrollo del país, el uso ilícito será sancionado penalmente de acuerdo a Ley."
        </Text>
        <Text style={[S.leyenda, S.gap2]}>
          Ley N° 453: El proveedor debe emitir factura, nota fiscal o documento equivalente.
        </Text>

        <Text style={S.footer}>GRACIAS POR SU PREFERENCIA</Text>
      </Page>
    </Document>
  );
}

// ─── Trigger download ─────────────────────────────────────────────────────────

export async function abrirFacturaPDF(data: FacturaPDFData) {
  // Generar QR con URL SIAT
  const factura = data.pago.facturas;
  const nit = data.sucursal.nit ?? "";
  const cuf = factura?.cufd ?? "";
  const nro = factura?.numero ?? 0;
  const fecha = data.pago.fecha_pago.split("T")[0].replace(/-/g, "");
  const qrUrl = `https://siat.impuestos.gob.bo/consulta/QR?nit=${nit}&cuf=${cuf}&numero=${nro}&fecha=${fecha}`;

  let qrDataUrl: string | undefined;
  try {
    qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 160, margin: 1 });
  } catch {
    qrDataUrl = undefined;
  }

  const blob = await pdf(<FacturaDocument {...data} qrDataUrl={qrDataUrl} />).toBlob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

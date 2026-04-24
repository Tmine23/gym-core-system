import { NextResponse } from "next/server";
import { getWAState, startWA } from "@/lib/whatsapp";
import QRCode from "qrcode";

export async function GET() {
  const state = getWAState();

  // Iniciar si está desconectado
  if (state.status === "disconnected") {
    void startWA();
  }

  let qrDataUrl: string | null = null;
  if (state.qr) {
    try {
      qrDataUrl = await QRCode.toDataURL(state.qr, { width: 256, margin: 2 });
    } catch {
      qrDataUrl = null;
    }
  }

  return NextResponse.json({ status: state.status, qr: qrDataUrl });
}

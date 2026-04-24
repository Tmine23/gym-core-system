import { NextResponse } from "next/server";
import { getWAState, startWA } from "@/lib/whatsapp";
import fs from "fs";
import path from "path";

const AUTH_DIR = path.join(process.cwd(), ".baileys-auth");

export async function POST() {
  // Desconectar si hay sesión activa
  const state = getWAState();
  if (state.sock) {
    try { state.sock.end(undefined); } catch { /* ignore */ }
  }
  state.status = "disconnected";
  state.sock = null;
  state.qr = null;

  // Limpiar auth
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch { /* ignore */ }

  // Reiniciar
  void startWA();

  return NextResponse.json({ ok: true, message: "Reconectando — escanea el nuevo QR" });
}

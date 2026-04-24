// lib/whatsapp.ts
// Singleton de Baileys para Next.js (App Router)

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";

const AUTH_DIR = path.join(process.cwd(), ".baileys-auth");

function clearAuth() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      console.log("[WhatsApp] Auth limpiada — se generará nuevo QR");
    }
  } catch (e) {
    console.error("[WhatsApp] Error limpiando auth:", e);
  }
}

export type WAStatus = "disconnected" | "connecting" | "qr" | "connected";

interface WAState {
  status: WAStatus;
  qr: string | null;
  sock: ReturnType<typeof makeWASocket> | null;
}

const g = global as typeof global & { __wa?: WAState };

if (!g.__wa) {
  g.__wa = { status: "disconnected", qr: null, sock: null };
}

export function getWAState(): WAState {
  return g.__wa!;
}

export async function startWA(): Promise<void> {
  if (g.__wa!.status === "connected" || g.__wa!.status === "connecting") return;

  g.__wa!.status = "connecting";
  g.__wa!.qr = null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, undefined),
      },
      generateHighQualityLinkPreview: false,
      printQRInTerminal: true,
    });

    g.__wa!.sock = sock;

    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        g.__wa!.qr = qr;
        g.__wa!.status = "qr";
      }
      if (connection === "close") {
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        g.__wa!.status = "disconnected";
        g.__wa!.sock = null;
        if (code === DisconnectReason.loggedOut) {
          // Sesión cerrada desde el celular — limpiar auth para generar nuevo QR
          clearAuth();
          // Reconectar después de limpiar para generar QR nuevo
          setTimeout(() => void startWA(), 2000);
        } else {
          setTimeout(() => void startWA(), 3000);
        }
      }
      if (connection === "open") {
        g.__wa!.status = "connected";
        g.__wa!.qr = null;
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error("[WhatsApp] Error al iniciar:", err);
    g.__wa!.status = "disconnected";
  }
}

export async function sendWAMessage(phone: string, text: string): Promise<void> {
  const { sock, status } = g.__wa!;
  if (status !== "connected" || !sock) {
    throw new Error("WhatsApp no está conectado");
  }
  const jid = `591${phone.replace(/\D/g, "")}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

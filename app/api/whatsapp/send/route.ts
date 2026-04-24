import { NextRequest, NextResponse } from "next/server";
import { sendWAMessage, getWAState } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  const { phone, text } = (await req.json()) as { phone: string; text: string };

  if (!phone || !text) {
    return NextResponse.json({ error: "phone y text son requeridos" }, { status: 400 });
  }

  const { status } = getWAState();
  if (status !== "connected") {
    return NextResponse.json({ error: "WhatsApp no conectado" }, { status: 503 });
  }

  try {
    await sendWAMessage(phone, text);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al enviar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

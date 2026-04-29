import { NextRequest, NextResponse } from "next/server";
import { getWAState } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const phone = formData.get("phone") as string;
  const caption = formData.get("caption") as string | null;
  const file = formData.get("file") as File | null;

  if (!phone || !file) {
    return NextResponse.json({ error: "phone y file son requeridos" }, { status: 400 });
  }

  const { sock, status } = getWAState();
  if (status !== "connected" || !sock) {
    return NextResponse.json({ error: "WhatsApp no conectado" }, { status: 503 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const jid = `${phone.replace(/[\s\-\+]/g, "")}@s.whatsapp.net`;
    const mime = file.type;

    if (mime.startsWith("image/")) {
      await sock.sendMessage(jid, { image: buffer, caption: caption ?? undefined });
    } else {
      await sock.sendMessage(jid, {
        document: buffer,
        mimetype: mime,
        fileName: file.name,
        caption: caption ?? undefined,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al enviar media";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

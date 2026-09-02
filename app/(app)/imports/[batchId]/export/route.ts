import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/session";
import { exportImportBatch } from "@/lib/server/imports/export";

export async function GET(_request: Request, { params }: RouteContext<"/imports/[batchId]/export">) {
  const { batchId } = await params;
  const userId = await requireUserId();

  let result;
  try {
    result = await exportImportBatch(userId, batchId);
  } catch {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }

  const filename = `${result.label.replace(/[^a-zA-Z0-9-_]+/g, "_")}.csv`;
  return new NextResponse(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("global_search", { p_query: q });
  if (error) {
    return NextResponse.json({ results: [] }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  const results = (data ?? []).map((row) => ({
    entityType: row.entity_type,
    entityId: row.entity_id,
    primaryLabel: row.primary_label,
    secondaryLabel: row.secondary_label,
    tertiaryLabel: row.tertiary_label,
  }));

  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}

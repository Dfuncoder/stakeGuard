import { NextRequest, NextResponse } from "next/server";
import { runSimulation } from "@/app/lib/simulation";
import type { SimulateRequest } from "@/app/types";

export async function POST(req: NextRequest) {
  try {
    const body: SimulateRequest = await req.json();

    if (!body.byzantineAvsId) {
      return NextResponse.json(
        { error: "byzantineAvsId is required" },
        { status: 400 }
      );
    }

    if (!body.validators?.length || !body.avsServices?.length) {
      return NextResponse.json(
        { error: "validators and avsServices arrays are required" },
        { status: 400 }
      );
    }

    const result = runSimulation({
      ...body,
      slashPercentage: body.slashPercentage ?? 0.3,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/simulate]", err);
    return NextResponse.json({ error: "Internal simulation error" }, { status: 500 });
  }
}

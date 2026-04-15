import { NextResponse } from "next/server";

import { getDashboardData } from "@/server/queries/dashboard";

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json({ data: data.orders });
}

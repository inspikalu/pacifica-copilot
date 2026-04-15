"use client";

import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { EquityPoint } from "@/types/domain";

export function EquityChart({ data }: { data: EquityPoint[] }) {
  const router = useRouter();

  return (
    <div className="hl-card p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-[var(--foreground-muted)] font-medium">
            Equity Trend
          </h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)] opacity-60">
            Click a point to replay that snapshot
          </p>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart
            data={data}
            onClick={(e) => {
              if (e && e.activePayload && e.activePayload[0]) {
                const snapshotId = e.activePayload[0].payload.snapshotId;
                if (snapshotId) {
                  router.push(`/replay/${snapshotId}` as any);
                }
              }
            }}
            style={{ cursor: "pointer" }}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#63e2c3" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#63e2c3" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "#64748b" }}
            />
            <YAxis
              yAxisId="left"
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "#64748b" }}
              domain={["auto", "auto"]}
              width={55}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "#64748b" }}
              domain={[0, 100]}
              width={30}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0a0c0e",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "4px",
                fontSize: "12px",
                color: "#e2e8f0",
              }}
              itemStyle={{ color: "#63e2c3" }}
              cursor={{ stroke: "rgba(99,226,195,0.2)", strokeWidth: 1 }}
            />
            <Area
              yAxisId="left"
              dataKey="equity"
              name="Equity"
              stroke="#63e2c3"
              fill="url(#equityFill)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "#63e2c3", strokeWidth: 0 }}
            />
            <Area
              yAxisId="right"
              dataKey="riskScore"
              name="Risk Score"
              stroke="rgba(245,158,11,0.5)"
              fill="none"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

import { env } from "@/lib/env";
import { signOperation } from "./signing";

interface PacificaResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  code: string | null;
}

export async function pacificaGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${env.PACIFICA_API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const responseText = await response.text();
  let json: PacificaResponse<T>;

  try {
    json = JSON.parse(responseText);
  } catch (err) {
    throw new Error(`Pacifica GET Error (${response.status}): ${responseText}`);
  }

  if (!response.ok || !json.success) {
    throw new Error(json.error ?? `Pacifica GET failed: ${response.status}`);
  }

  return json.data;
}

const BUILDER_CODE_SUPPORTED_TYPES = new Set([
  "create_order",
  "create_market_order",
  "create_stop_order",
  "set_position_tpsl",
]);

export async function pacificaPost<T>(
  path: string,
  type: string,
  data: any,
  auth: {
    account: string;
    privateKeyBase58: string;
    agentWallet?: string;
  }
): Promise<T> {
  const dataWithBuilder =
    env.PACIFICA_BUILDER_ENABLED &&
      env.PACIFICA_BUILDER_CODE &&
      BUILDER_CODE_SUPPORTED_TYPES.has(type)
      ? { ...data, builder_code: env.PACIFICA_BUILDER_CODE }
      : data;

  const { signature, timestamp, expiryWindow } = signOperation(type, dataWithBuilder, auth.privateKeyBase58);

  const payload: any = {
    account: auth.account,
    agent_wallet: auth.agentWallet ?? null,
    signature,
    timestamp,
    expiry_window: expiryWindow,
    ...dataWithBuilder,
  };

  const response = await fetch(`${env.PACIFICA_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const responseText = await response.text();
  let json: PacificaResponse<T>;

  try {
    json = JSON.parse(responseText);
  } catch (err) {
    throw new Error(`Pacifica POST Error (${response.status}): ${responseText}`);
  }

  if (!response.ok || !json.success) {
    throw new Error(json.error ?? `Pacifica POST failed: ${response.status}`);
  }

  return json.data;
}

export const pacifica = {
  getAccountInfo: (account: string) => pacificaGet<any>("/account", { account }),
  getPositions: (account: string) => pacificaGet<any[]>("/positions", { account }),
  getOpenOrders: (account: string) => pacificaGet<any[]>("/orders", { account }),

  createOrder: (data: any, auth: any) => pacificaPost("/orders/create", "create_order", data, auth),
  cancelOrder: (data: any, auth: any) => pacificaPost("/orders/cancel", "cancel_order", data, auth),
  cancelAllOrders: (data: any, auth: any) => pacificaPost("/orders/cancel_all", "cancel_all_orders", data, auth),
  setPositionTpsl: (data: any, auth: any) => pacificaPost("/positions/tpsl", "set_position_tpsl", data, auth),

  getTradeHistory: (account: string, params?: { symbol?: string; limit?: number }) =>
    pacificaGet<any[]>("/trades/history", { account, ...params } as any),
};

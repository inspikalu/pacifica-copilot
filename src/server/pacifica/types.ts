export interface PacificaRequestContext {
  account?: string;
  agentWallet?: string;
}

export type PacificaOperationType =
  | "create_order"
  | "create_stop_order"
  | "create_market_order"
  | "cancel_order"
  | "cancel_all_orders"
  | "cancel_stop_order"
  | "update_leverage"
  | "update_margin_mode"
  | "set_position_tpsl"
  | "withdraw"
  | "bind_agent_wallet"
  | "create_api_key"
  | "revoke_api_key"
  | "list_api_keys";

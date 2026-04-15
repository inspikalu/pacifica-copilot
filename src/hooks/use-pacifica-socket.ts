"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface SocketUpdate {
  symbol: string;
  price: number;
  equity?: number;
  balance?: number;
}

export function usePacificaSocket(accountAddress: string) {
  const [updates, setUpdates] = useState<Record<string, number>>({});
  const [liveAccount, setLiveAccount] = useState<{ equity?: number; balance?: number }>({});
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const updateBuffer = useRef<Record<string, number>>({});
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (!accountAddress) return;
    if (wsRef.current) wsRef.current.close();

    const wsUrl = process.env.NEXT_PUBLIC_PACIFICA_WS_URL || "wss://test-ws.pacifica.fi/ws";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Socket] Connected to Pacifica WS");
      setIsConnected(true);
      toast.success("Live Feed Connected");
      
      ws.send(JSON.stringify({
        method: "subscribe",
        params: { source: "account_info", account: accountAddress }
      }));

      ws.send(JSON.stringify({
        method: "subscribe",
        params: { source: "all_mids" }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { channel, data } = message;

        if (channel === "all_mids") {
          Object.assign(updateBuffer.current, data);
        }

        if (channel === "account_info" && data.ae) {
          setLiveAccount({
            equity: Number(data.ae),
            balance: Number(data.b)
          });
        }
      } catch (err) { }
    };

    ws.onerror = () => setIsConnected(false);
    ws.onclose = () => setIsConnected(false);
  };

  useEffect(() => {
    connect();

    const flushInterval = setInterval(() => {
      if (Object.keys(updateBuffer.current).length > 0) {
        setUpdates(prev => ({ ...prev, ...updateBuffer.current }));
        updateBuffer.current = {};
      }
    }, 500);

    return () => {
      clearInterval(flushInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [accountAddress]);

  return { updates, liveAccount, isConnected, reconnect: connect };
}

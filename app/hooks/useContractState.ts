"use client";

import { useCallback, useEffect, useState } from "react";

export interface ChainNetworkState {
  totalNetworkStake: string;
  totalSlashedStake: string;
  networkRiskScore: number;
  validatorCount: number;
  avsCount: number;
  isLive: true;
  contractAddress: string;
  lastFetched: Date;
}

export interface ContractHookResult {
  chainState: ChainNetworkState | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isConfigured: boolean;
}

export function useContractState(): ContractHookResult {
  const [chainState, setChainState] = useState<ChainNetworkState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  const fetchState = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call our own Next.js API route — avoids CORS, raw selectors, and client-side RPC
      const res = await fetch("/api/chain-state");
      const json = await res.json();

      if (!json.configured) {
        setIsConfigured(false);
        return;
      }

      setIsConfigured(true);

      if (json.error) {
        setError(json.error);
        return;
      }

      setChainState({
        totalNetworkStake: json.totalNetworkStake,
        totalSlashedStake: json.totalSlashedStake,
        networkRiskScore:  json.networkRiskScore,
        validatorCount:    json.validatorCount,
        avsCount:          json.avsCount,
        isLive:            true,
        contractAddress:   json.contractAddress,
        lastFetched:       new Date(json.fetchedAt),
      });

    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    // Poll every 30 seconds
    const interval = setInterval(fetchState, 30_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  return { chainState, isLoading, error, refresh: fetchState, isConfigured };
}

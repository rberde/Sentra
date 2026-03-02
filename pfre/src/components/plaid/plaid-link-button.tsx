"use client";

import { useState, useCallback, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useApp } from "@/contexts/app-context";
import { Button } from "@/components/ui/button";
import { Loader2, Link as LinkIcon, CheckCircle } from "lucide-react";
import type { Expense, PlaidAccount } from "@/lib/types";

export type PlaidExchangePayload = {
  access_token: string;
  accounts: PlaidAccount[];
  autofill?: {
    cashBuffer?: number;
    investmentsTotalValue?: number;
    investmentHoldings?: Array<{
      tickerSymbol: string | null;
      name: string;
      quantity: number;
      price: number;
      value: number;
      costBasis: number | null;
    }>;
    liabilities?: Array<{
      type: string;
      name: string;
      balance: number;
      apr: number | null;
      minimumPayment: number | null;
    }>;
    fixedExpenses?: Expense[];
    variableExpenses?: Expense[];
  };
  autofillMeta?: {
    expensesAutofilled?: boolean;
    investmentsAutofilled?: boolean;
    liabilitiesAutofilled?: boolean;
    expensesReason?: string;
  };
};

export function PlaidLinkButton({ onSuccess: onSuccessCallback }: { onSuccess?: (payload: PlaidExchangePayload) => void }) {
  const { state, dispatch } = useApp();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(state.plaidAccounts.length > 0);

  useEffect(() => {
    if (connected) return;
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then(r => r.json())
      .then(data => setLinkToken(data.link_token))
      .catch(console.error);
  }, [connected]);

  const onSuccess = useCallback(async (publicToken: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });
      const data = await res.json() as PlaidExchangePayload;
      if (!res.ok) {
        throw new Error("Failed to exchange Plaid token");
      }
      dispatch({
        type: "SET_PLAID_ACCOUNTS",
        accounts: data.accounts,
        accessToken: data.access_token,
      });
      setConnected(true);
      onSuccessCallback?.(data);
    } catch (err) {
      console.error("Failed to exchange Plaid token:", err);
    } finally {
      setLoading(false);
    }
  }, [dispatch, onSuccessCallback]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  if (connected) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <CheckCircle className="w-4 h-4 text-green-500" />
        {state.plaidAccounts.length} account(s) connected
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => open()}
      disabled={!ready || loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <LinkIcon className="w-4 h-4" />
      )}
      Connect with Plaid
    </Button>
  );
}

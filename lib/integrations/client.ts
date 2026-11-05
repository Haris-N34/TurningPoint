"use client";

import { z } from "zod";
import type { Card } from "@/lib/card/types";
import { store } from "@/lib/store/store";
import { summarize } from "./summary";

// Browser side of the integration layer: which demo company this browser acts as, the invite token a
// candidate arrived with, and the one-time report when an attempt finishes (C.3).

export const companyId = () => store().getJSON("integration_company", z.string()) ?? "demo";
export const setCompanyId = (id: string) => store().setJSON("integration_company", id);

export async function integrationsApi<T = unknown>(path: string, body?: unknown): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`/api/integrations/${path}${sep}company=${encodeURIComponent(companyId())}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json;
}

const inviteKey = (challengeId: string) => `invite:${challengeId}`;
export const saveInvite = (challengeId: string, token: string) => store().setJSON(inviteKey(challengeId), token);
export const inviteFor = (challengeId: string) => store().getJSON(inviteKey(challengeId), z.string());

/** Send the evidence summary once per attempt. No name, email, transcript or media leaves the browser. */
export async function reportFinished(card: Card) {
  const s = store();
  const key = `reported:${card.attemptId}`;
  if (s.getJSON(key, z.boolean())) return undefined;
  const r = await integrationsApi<{ delivery?: { status: string; provider: string } }>("attempts", { summary: summarize(card, inviteFor(card.challenge.id)) });
  s.setJSON(key, true);
  return r;
}

import type { Metadata } from "next";
import { IntegrationConsole } from "@/components/integrations/IntegrationConsole";

export const metadata: Metadata = { title: "Integrations · Turning Point" };

export default function IntegrationsPage() {
  return <IntegrationConsole />;
}

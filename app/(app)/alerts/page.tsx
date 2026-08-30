import Link from "next/link";
import { getAllAlerts } from "@/lib/server/alerts";
import { Card } from "@/components/ui/Card";
import { DismissAlertButton } from "@/components/finance/DismissAlertButton";

const ROUTE_BY_ACTION: Record<string, string> = {
  "Ver categoria": "/analysis",
  "Ver fatura": "/cards",
  "Ver mês": "/month",
  "Ver porquinho": "/goals",
  "Ver análise": "/analysis",
  "Ver compra": "/transactions",
  "Ver patrimônio": "/net-worth",
};

export default async function AlertsPage() {
  const alerts = await getAllAlerts();
  const attention = alerts.filter((a) => a.severity !== "positive");
  const positive = alerts.filter((a) => a.severity === "positive");

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="text-title text-text">Alertas</h1>

      <div className="flex flex-col gap-sm">
        <span className="text-navhead uppercase text-neutral-700">Pedem atenção</span>
        {attention.length === 0 ? (
          <p className="text-micro text-dim">Nada pedindo atenção agora.</p>
        ) : (
          attention.map((alert) => (
            <Card key={alert.alertKey} className="gap-sm">
              <div className="flex items-center justify-between gap-md">
                <div className="flex flex-col gap-xs">
                  <span className="text-row text-text">{alert.title}</span>
                  <div className="flex gap-md">
                    {alert.actions.map((action) => (
                      <Link key={action} href={ROUTE_BY_ACTION[action] ?? "/"} className="text-micro text-accent-300 hover:underline">
                        {action}
                      </Link>
                    ))}
                  </div>
                </div>
                <DismissAlertButton alertKey={alert.alertKey} />
              </div>
            </Card>
          ))
        )}
      </div>

      {positive.length > 0 ? (
        <div className="flex flex-col gap-sm">
          <span className="text-navhead uppercase text-neutral-700">Boas notícias</span>
          {positive.map((alert) => (
            <Card key={alert.alertKey} className="gap-xs">
              <span className="text-row text-pos">{alert.title}</span>
            </Card>
          ))}
        </div>
      ) : null}

      <p className="text-micro text-dim">
        <Link href="/settings" className="text-accent-300 hover:underline">
          Ajustes
        </Link>{" "}
        — limites, metas e categorias que alimentam estes alertas.
      </p>
    </div>
  );
}

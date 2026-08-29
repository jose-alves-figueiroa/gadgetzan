import Link from "next/link";
import { getCalendarMonth } from "@/lib/server/calendar";
import { todayDateString } from "@/lib/server/clock";
import { addDays } from "@/lib/finance/period";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const search = await searchParams;
  const monthOffset = Number(search?.month ?? 0);
  const mode = search?.mode === "month" ? "month" : "agenda";

  const data = await getCalendarMonth(monthOffset);
  const today = todayDateString();

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-md text-row">
          <Link href={`/calendar?month=${monthOffset - 1}&mode=${mode}`} className="text-dim hover:text-text">
            ‹
          </Link>
          <span className="capitalize text-text">{data.month.label}</span>
          <Link href={`/calendar?month=${monthOffset + 1}&mode=${mode}`} className="text-dim hover:text-text">
            ›
          </Link>
        </div>
        <div className="inline-flex rounded-md border border-line bg-surface p-xs text-micro">
          <Link
            href={`/calendar?month=${monthOffset}&mode=agenda`}
            className={cn("rounded-sm px-lg py-sm", mode === "agenda" ? "text-accent shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-muted")}
          >
            Agenda
          </Link>
          <Link
            href={`/calendar?month=${monthOffset}&mode=month`}
            className={cn("rounded-sm px-lg py-sm", mode === "month" ? "text-accent shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-muted")}
          >
            Mês
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-md">
        <Card className="gap-xs">
          {mode === "agenda" ? (
            data.agenda.length > 0 ? (
              data.agenda.map((row, index) => (
                <div key={index} className="flex items-center justify-between border-b border-line/60 py-sm text-row last:border-0">
                  <div className="flex items-center gap-md">
                    <span className="w-10 shrink-0 text-micro text-dim">{row.date.slice(8, 10)}</span>
                    <div className="flex flex-col">
                      <span className="text-text">{row.label}</span>
                      {row.subLabel ? <span className="text-micro text-dim">{row.subLabel}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-lg">
                    {row.amountCents !== undefined ? (
                      <span className={cn("tabular-money text-micro", row.amountCents >= 0 ? "text-pos" : "text-text")}>
                        {formatBRL(row.amountCents)}
                      </span>
                    ) : null}
                    <span className="tabular-money text-micro text-dim">{formatBRL(row.runningBalanceCents, { compact: true })}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-micro text-dim">Nenhum evento neste mês.</p>
            )
          ) : (
            <MonthGrid start={data.month.start} end={data.month.end} today={today} events={new Set(data.agenda.map((r) => r.date))} />
          )}
        </Card>

        <div className="flex flex-col gap-md">
          <Card className="gap-sm">
            <span className="text-navhead uppercase text-neutral-700">Resumo do mês</span>
            <MetaRow label="Entradas" value={formatBRL(data.totalIn)} />
            <MetaRow label="Saídas" value={formatBRL(data.totalOut)} />
            <MetaRow label="Saldo final" value={formatBRL(data.closingBalanceCents)} />
          </Card>
          <Card className="gap-sm">
            <span className="text-navhead uppercase text-neutral-700">Menor saldo do mês</span>
            <span className="tabular-money text-kpi-md text-text">{formatBRL(data.lowestBalance.balanceCents, { compact: true })}</span>
            <span className="text-micro text-dim">
              em {data.lowestBalance.date.slice(8, 10)}/{data.lowestBalance.date.slice(5, 7)}
            </span>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-row">
      <span className="text-dim">{label}</span>
      <span className="tabular-money text-text">{value}</span>
    </div>
  );
}

function MonthGrid({ start, end, today, events }: { start: string; end: string; today: string; events: Set<string> }) {
  const firstWeekday = new Date(`${start}T00:00:00Z`).getUTCDay();
  const days: string[] = [];
  let cursor = start;
  while (cursor < end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return (
    <div className="grid grid-cols-7 gap-xs">
      {WEEKDAY_LABELS.map((w, i) => (
        <span key={i} className="text-center text-micro text-dim">
          {w}
        </span>
      ))}
      {Array.from({ length: firstWeekday }).map((_, i) => (
        <span key={`pad-${i}`} />
      ))}
      {days.map((day) => (
        <div
          key={day}
          className={cn(
            "flex h-12 flex-col items-center justify-center gap-xs rounded-md",
            day === today && "shadow-[inset_0_0_0_1px_var(--color-accent)]"
          )}
        >
          <span className="text-micro text-text">{Number(day.slice(8, 10))}</span>
          {events.has(day) ? <span className="h-[4px] w-[4px] rounded-full bg-accent" /> : null}
        </div>
      ))}
    </div>
  );
}

import { redirect } from "next/navigation";
import { listAccounts } from "@/lib/server/accounts";

export default async function DashboardPage() {
  const accounts = await listAccounts();
  if (accounts.length === 0) redirect("/onboarding");

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-label uppercase text-dim">Dashboard — em construção</p>
    </div>
  );
}

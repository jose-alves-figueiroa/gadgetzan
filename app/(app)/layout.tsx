import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppGroupLayout({ children }: LayoutProps<"/">) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <AppShell>{children}</AppShell>;
}

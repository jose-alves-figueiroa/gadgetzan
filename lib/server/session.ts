import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

/** Every write must be scoped by this — never trust an id coming from the client. */
export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Não autenticado.");
  }
  return session.user.id;
}

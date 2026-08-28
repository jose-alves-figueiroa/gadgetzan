"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email ou senha incorretos.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-xl">
      <Card className="w-[360px]">
        <div className="flex items-center gap-sm">
          <span className="h-[18px] w-[18px] rounded-sm bg-accent" />
          <span className="text-title text-text">Gadgetzan</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <Field name="email" type="email" label="Email" required autoComplete="email" />
          <Field
            name="password"
            type="password"
            label="Senha"
            required
            autoComplete="current-password"
          />
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

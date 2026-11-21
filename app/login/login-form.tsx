"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { requestLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestLink, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required error={state.error} defaultValue={state.email} />
      <Button type="submit" size="lg" loading={pending}>Email me a sign-in link</Button>
    </form>
  );
}

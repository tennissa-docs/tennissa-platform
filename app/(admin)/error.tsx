"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/display";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <Card>
      <EmptyState icon={AlertTriangle} title="This page didn't load"
        action={<Button variant="secondary" onClick={reset}>Try again</Button>}>
        Nothing was changed. If it keeps happening, tell the technical lead{error.digest ? ` and mention reference ${error.digest}` : ""}.
      </EmptyState>
    </Card>
  );
}

import { Hammer } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/display";

/** Placeholder for screens not built yet (routing exists so the shell is complete). */
export function ComingSoon({ title, screen, what }: { title: string; screen: string; what: string }) {
  return (
    <>
      <PageHeader title={title} description={what} />
      <Card>
        <EmptyState icon={Hammer} title="Not built yet">
          This screen ({screen}) comes after the first gift works end to end. See the build order in replica/architecture.md.
        </EmptyState>
      </Card>
    </>
  );
}

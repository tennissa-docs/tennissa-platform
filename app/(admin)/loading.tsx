import { Card, Skeleton } from "@/components/ui/display";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => <Card as="div" key={i}><Skeleton className="h-4 w-24" /><Skeleton className="mt-3 h-9 w-40" /><Skeleton className="mt-2 h-4 w-28" /></Card>)}
      </div>
      <Card as="div" className="mt-8">
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="my-4 h-6 w-full" />)}
      </Card>
    </div>
  );
}

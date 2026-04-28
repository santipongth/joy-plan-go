import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function ItinerarySkeleton() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-h-screen">
        <div className="overflow-hidden px-4 sm:px-8 py-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
            <Skeleton className="h-9 w-20" />
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-9 rounded-md" />
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </div>

          {/* Trip card skeleton */}
          <Card className="mb-4 p-4 sm:p-5 w-full max-w-full overflow-hidden">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-7 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-4" />
            <div className="flex gap-2 mb-4 overflow-hidden">
              <Skeleton className="h-16 w-20 rounded-lg flex-shrink-0" />
              <Skeleton className="h-16 w-20 rounded-lg flex-shrink-0" />
              <Skeleton className="h-16 w-20 rounded-lg flex-shrink-0" />
            </div>
            <div className="space-y-3 pt-3 border-t">
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </Card>

          {/* Day chips */}
          <div className="flex gap-2 mb-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-16 rounded-md flex-shrink-0" />
            ))}
          </div>

          {/* Day sections */}
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="mb-4 p-4">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            </Card>
          ))}
        </div>

        {/* Map skeleton (desktop only) */}
        <div className="hidden lg:block sticky top-0 h-screen p-4">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

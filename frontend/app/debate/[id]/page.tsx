import { Suspense } from "react";
import { DebateWorkspace } from "@/components/debate/DebateWorkspace";

export function generateStaticParams() {
  return [{ id: "4day-week" }, { id: "fasting" }];
}

export default async function DebatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 text-center text-sm text-muted-foreground">
          Loading debate workspace...
        </div>
      }
    >
      <DebateWorkspace id={id} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { DebateWorkspace } from "@/components/debate/DebateWorkspace";

export function generateStaticParams() {
  return [{ id: "4day-week" }, { id: "fasting" }, { id: "nuclear" }];
}

type Params = Promise<{ id: string }>;

// Params are awaited inside the Suspense boundary so the shell can stream instantly.
async function Workspace({ params }: { params: Params }) {
  const { id } = await params;
  return <DebateWorkspace id={id} />;
}

export default function DebatePage({ params }: { params: Params }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1440px] px-8 py-16 text-[15px] text-muted-foreground">
          Loading debate…
        </div>
      }
    >
      <Workspace params={params} />
    </Suspense>
  );
}

import { Suspense } from "react";
import ScenarioChatClient from "./ScenarioChatClient";

export function generateStaticParams() {
  return [
    { id: "auto" },
    { id: "restaurant" },
    { id: "market" },
  ];
}

async function ScenarioContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ScenarioChatClient id={id} />;
}

export default function ScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center p-6 text-stone-500">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span className="text-sm font-medium">Loading scenario...</span>
          </div>
        </div>
      }
    >
      <ScenarioContent params={params} />
    </Suspense>
  );
}

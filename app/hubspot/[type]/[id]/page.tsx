import { notFound } from "next/navigation";
import { Suspense } from "react";
import HubspotRecord from "@/components/HubspotRecord";
import LoadingState from "@/components/LoadingState";

async function Record({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if ((type !== "contacts" && type !== "companies") || !/^\d{1,20}$/.test(id)) notFound();
  return <HubspotRecord type={type === "contacts" ? "contact" : "company"} id={id} />;
}

export default function Page({ params }: { params: Promise<{ type: string; id: string }> }) {
  return (
    <Suspense fallback={<LoadingState label="Loading from HubSpot…" cards={3} />}>
      <Record params={params} />
    </Suspense>
  );
}

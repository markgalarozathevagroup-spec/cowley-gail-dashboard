import { notFound } from "next/navigation";
import HubspotRecord from "@/components/HubspotRecord";

export default async function Page({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if ((type !== "contacts" && type !== "companies") || !/^\d{1,20}$/.test(id)) notFound();
  return <HubspotRecord type={type === "contacts" ? "contact" : "company"} id={id} />;
}

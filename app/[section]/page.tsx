import { notFound } from "next/navigation";
import ComingSoon from "@/components/ComingSoon";

const TITLES: Record<string, string> = {
  hubspot: "Hubspot",
};

export function generateStaticParams() {
  return Object.keys(TITLES).map((section) => ({ section }));
}

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!TITLES[section]) notFound();
  return <ComingSoon title={TITLES[section]} />;
}

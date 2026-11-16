import Header from "./Header";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <Header title={title} />
      <div className="rounded-xl border border-line bg-white p-8 text-lg text-muted">
        This section is not built yet. It will be added in a later phase.
      </div>
    </>
  );
}

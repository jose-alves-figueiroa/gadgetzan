export function UnderConstruction({ title }: { title: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-label uppercase text-dim">{title} — em construção</p>
    </div>
  );
}

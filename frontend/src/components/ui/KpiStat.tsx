interface Props {
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
  accent?: boolean;
}

export default function KpiStat({ label, value, delta, deltaUp, accent }: Props) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight ${accent ? "text-accent" : "text-ink"}`}>
        {value}
      </div>
      {delta && (
        <div className={`text-xs ${deltaUp ? "text-danger" : "text-accent"}`}>
          {deltaUp ? "▲" : "▼"} {delta}
        </div>
      )}
    </div>
  );
}

interface MentionSparklineProps {
  data: Array<{ date: string; count: number }>;
}

const WIDTH = 64;
const HEIGHT = 20;
const STROKE_WIDTH = 1.5;

export function MentionSparkline({ data }: MentionSparklineProps) {
  if (data.length < 2) {
    return null;
  }

  const counts = data.map((d) => d.count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const range = max - min || 1;

  // Build polyline points
  const points = counts
    .map((count, i) => {
      const x = (i / (counts.length - 1)) * WIDTH;
      const y = HEIGHT - ((count - min) / range) * HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Determine trend
  const first = counts[0];
  const last = counts[counts.length - 1];
  const pctChange = first === 0 ? (last > 0 ? 100 : 0) : ((last - first) / first) * 100;
  const absPct = Math.abs(Math.round(pctChange));
  const isFlat = absPct < 10;

  let strokeColor: string;
  if (isFlat) {
    strokeColor = "#a8a29e"; // stone-400
  } else if (pctChange > 0) {
    strokeColor = "#10b981"; // emerald-500
  } else {
    strokeColor = "#ef4444"; // red-500
  }

  return (
    <span className="inline-flex items-center gap-1">
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="inline-block"
        aria-hidden="true"
      >
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!isFlat && (
        <span
          className="text-xs font-medium"
          style={{ color: strokeColor }}
        >
          {pctChange > 0 ? "\u2191" : "\u2193"} {absPct}%
        </span>
      )}
    </span>
  );
}

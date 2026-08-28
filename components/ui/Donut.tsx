interface DonutSlice {
  value: number;
  color: string;
}

interface DonutProps {
  slices: DonutSlice[];
  centerLabel?: string;
  size?: number;
}

const HOLE_RATIO = 100 / 168;

export function Donut({ slices, centerLabel, size = 168 }: DonutProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = size / 2;
  const strokeWidth = radius * (1 - HOLE_RATIO);
  const circumference = 2 * Math.PI * (radius - strokeWidth / 2);

  let offset = 0;
  const segments = slices.map((slice) => {
    const fraction = total > 0 ? slice.value / total : 0;
    const dash = fraction * circumference;
    const segment = { ...slice, dash, offset };
    offset += dash;
    return segment;
  });

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${radius} ${radius})`}>
          {segments.map((segment, index) => (
            <circle
              key={index}
              cx={radius}
              cy={radius}
              r={radius - strokeWidth / 2}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
              strokeDashoffset={-segment.offset}
            />
          ))}
        </g>
      </svg>
      {centerLabel ? (
        <div className="absolute inset-0 flex items-center justify-center text-kpi-md tabular-money text-text">
          {centerLabel}
        </div>
      ) : null}
    </div>
  );
}

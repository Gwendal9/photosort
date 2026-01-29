interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ current, total, label, showPercentage = true }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-sm text-white/80">{label}</span>
          {showPercentage && total > 0 && (
            <span className="text-sm text-white/50">
              {current} / {total} ({percentage}%)
            </span>
          )}
        </div>
      )}
      <div className="w-full bg-white/10 rounded-full h-2.5">
        <div
          className="bg-white/60 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

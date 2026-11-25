import type { Verdict } from "@/lib/types";
import { voteSplit } from "@/lib/debate-display";

/** Pro vs Con share of the weighted vote, cobalt left and orange right. */
export function VoteSplitBar({
  verdict,
  showLegend = false,
}: {
  verdict: Verdict;
  showLegend?: boolean;
}) {
  const { pro, con } = voteSplit(verdict);
  const total = pro + con;
  const proShare = total > 0 ? pro / total : 0.5;

  return (
    <div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Weighted vote: Pro ${pro.toFixed(2)}, Con ${con.toFixed(2)}`}
      >
        {total > 0 && (
          <>
            <span
              className="h-full bg-pro"
              style={{ width: `${proShare * 100}%` }}
            />
            <span
              className="h-full bg-con"
              style={{ width: `${(1 - proShare) * 100}%` }}
            />
          </>
        )}
      </div>
      {showLegend && (
        <div className="tabular mt-2 flex justify-between text-sm">
          <span className="font-medium text-pro-ink">Pro {pro.toFixed(2)}</span>
          <span className="font-medium text-con-ink">Con {con.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

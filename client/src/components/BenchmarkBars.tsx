import { money } from "./chart-utils";
import type { BenchmarkCategory } from "../types";

export function BenchmarkBars({
  categories,
  userValues,
}: {
  categories: BenchmarkCategory[];
  userValues: Record<string, number>;
}) {
  return (
    <div className="benchmark-list">
      {categories.map((category) => {
        const user = userValues[category.key] ?? 0;
        const max = Math.max(user, category.monthlyPeer, 1);
        const tone =
          category.key === "savings"
            ? user >= category.monthlyPeer
              ? "positive"
              : "negative"
            : user <= category.monthlyPeer * 1.1
              ? "positive"
              : "warning";
        return (
          <div className="benchmark-row" key={category.key}>
            <header>
              <span>{category.label}</span>
              <strong className={tone}>
                {money.format(user - category.monthlyPeer)} vs peer
              </strong>
            </header>
            <div className="benchmark-bars">
              <span
                className="peer-bar"
                style={{
                  width: `${(category.monthlyPeer / max) * 100}%`,
                }}
              />
              <span
                className={`user-bar ${tone}`}
                style={{ width: `${(user / max) * 100}%` }}
              />
            </div>
            <footer>
              <span>User {money.format(user)}</span>
              <span>Peer {money.format(category.monthlyPeer)}</span>
            </footer>
          </div>
        );
      })}
    </div>
  );
}

export function SkeletonLine({
  w = "100%",
  h = 16,
}: {
  w?: string | number;
  h?: number;
}) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, marginBottom: 4 }}
    />
  );
}

export function SkeletonCard({ h = 120 }: { h?: number }) {
  return (
    <div className="skeleton" style={{ borderRadius: 16, height: h }} />
  );
}

export function MetricSkeleton() {
  return (
    <div
      className="glass-card"
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <SkeletonLine w="40%" h={12} />
      <SkeletonLine w="65%" h={28} />
      <SkeletonLine w="50%" h={12} />
    </div>
  );
}

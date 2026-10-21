export function MezoMark({ className = "size-4" }: { className?: string }) {
  return (
    <img
      src="/brand/mezo.webp"
      alt=""
      width={20}
      height={20}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}

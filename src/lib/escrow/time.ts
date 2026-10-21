export function timeZoneName() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
}

export function formatTimestamp(seconds?: number) {
  if (!seconds) return "—";
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "—";
  const zone = timeZoneName();
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zone,
  }).format(date);
  return `${formatted} (${zone})`;
}

export function formatRelative(seconds: number, nowSeconds: number) {
  const delta = seconds - nowSeconds;
  const abs = Math.abs(delta);
  const minutes = Math.round(abs / 60);
  const hours = Math.round(abs / 3600);
  const days = Math.round(abs / 86400);
  const span = minutes < 90 ? `${minutes} min` : hours < 48 ? `${hours} hr` : `${days} days`;
  if (Math.abs(delta) < 30) return "now";
  return delta >= 0 ? `in ${span}` : `${span} ago`;
}

export function unixToLocalInput(seconds: number) {
  const date = new Date(seconds * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localInputToUnix(value: string) {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return undefined;
  return Math.floor(ms / 1000);
}

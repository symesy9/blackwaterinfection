export function randomSubjectId(): string {
  const n = Math.floor(Math.random() * 9999) + 1;
  return `RT-${String(n).padStart(4, "0")}`;
}

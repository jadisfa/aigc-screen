import { format, isValid, parse, parseISO } from "date-fns";

export type DateTimeInput = string | number | Date | null | undefined;

const OUTPUT_FORMAT = "yyyy-MM-dd HH:mm:ss";
const EMPTY = "-";

function toDate(input: DateTimeInput): Date | null {
  if (input === null || input === undefined) return null;

  if (typeof input === "number") {
    const d = new Date(input);
    return isValid(d) ? d : null;
  }

  if (input instanceof Date) {
    return isValid(input) ? input : null;
  }

  const raw = input.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    const d = parse(raw, OUTPUT_FORMAT, new Date());
    return isValid(d) ? d : null;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(raw) || /([zZ]|[+-]\d{2}:\d{2})$/.test(raw)) {
    const d = parseISO(raw);
    return isValid(d) ? d : null;
  }

  const d = new Date(raw);
  return isValid(d) ? d : null;
}

export function formatDateTime(input: DateTimeInput, type?: string): string {
  const d = toDate(input);
  if (!d) return EMPTY;
  return format(d, type || OUTPUT_FORMAT);
}

export const MAX_DRIVER_OFFERS = 5;

export const OFFER_EXPIRY_MINUTES = 30;

export function normalizeTime(time: string): string {
  if (!time) return "";

  const parts = time.split(":");

  if (parts.length < 2) return time;

  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
}

export function timeslotKey(
  date: string,
  time: string
): string {
  return `${date}_${normalizeTime(time)}`;
}

export function isSameTimeslot(
  date1: string,
  time1: string,
  date2: string,
  time2: string
): boolean {
  return (
    date1 === date2 &&
    normalizeTime(time1) === normalizeTime(time2)
  );
}

export function getOfferExpiry(): string {
  return new Date(
    Date.now() + OFFER_EXPIRY_MINUTES * 60 * 1000
  ).toISOString();
}

export function seatsRemaining(
  totalSeats: number,
  bookedSeats: number
): number {
  return Math.max(
    0,
    Number(totalSeats || 0) - Number(bookedSeats || 0)
  );
}

export function canAcceptSeats(
  availableSeats: number,
  requestedSeats: number
): boolean {
  return (
    Number(requestedSeats) > 0 &&
    Number(availableSeats) >= Number(requestedSeats)
  );
}
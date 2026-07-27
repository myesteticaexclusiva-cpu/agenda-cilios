export const SLOT_INTERVAL_MINUTES = 15;
export const SALON_TIMEZONE = "America/Sao_Paulo";

type WorkHours = {
  startTime: string;
  endTime: string;
  isWorking: boolean;
};

type BreakWindow = {
  startTime: string;
  endTime: string;
};

type OccupiedRange = {
  startAt: Date;
  endAt: Date;
};

export type AvailabilitySlot = {
  time: string;
  startAt: Date;
  endAt: Date;
};

function dateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Data inválida. Use o formato AAAA-MM-DD.");

  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

export function timeToMinutes(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error("Horário inválido. Use o formato HH:MM.");

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error("Horário inválido.");
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

/**
 * O salão opera em America/Sao_Paulo. O Brasil não possui horário de verão
 * desde 2019, portanto o deslocamento operacional atual é UTC-03:00.
 */
export function brazilLocalDateTimeToUtc(date: string, time: string) {
  const { year, month, day } = dateParts(date);
  const localMinutes = timeToMinutes(time);
  const hours = Math.floor(localMinutes / 60);
  const minutes = localMinutes % 60;
  return new Date(Date.UTC(year, month - 1, day, hours + 3, minutes, 0, 0));
}

export function weekdayForBrazilDate(date: string) {
  const { year, month, day } = dateParts(date);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function formatBrazilDate(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: SALON_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatBrazilTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SALON_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function rangesOverlap(
  startA: Date | number,
  endA: Date | number,
  startB: Date | number,
  endB: Date | number,
) {
  return new Date(startA).getTime() < new Date(endB).getTime()
    && new Date(endA).getTime() > new Date(startB).getTime();
}

export function generateAvailableSlots({
  date,
  workHours,
  breaks,
  occupied,
  durationMinutes,
  now = new Date(),
}: {
  date: string;
  workHours?: WorkHours | null;
  breaks: BreakWindow[];
  occupied: OccupiedRange[];
  durationMinutes: number;
  now?: Date;
}): AvailabilitySlot[] {
  if (!workHours?.isWorking || durationMinutes <= 0) return [];

  const workStart = timeToMinutes(workHours.startTime);
  const workEnd = timeToMinutes(workHours.endTime);
  if (workEnd <= workStart || durationMinutes > workEnd - workStart) return [];

  const breakRanges = breaks.map(item => ({
    start: timeToMinutes(item.startTime),
    end: timeToMinutes(item.endTime),
  }));

  const slots: AvailabilitySlot[] = [];
  for (
    let start = workStart;
    start + durationMinutes <= workEnd;
    start += SLOT_INTERVAL_MINUTES
  ) {
    const end = start + durationMinutes;
    const time = minutesToTime(start);
    const startAt = brazilLocalDateTimeToUtc(date, time);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

    const conflictsWithBreak = breakRanges.some(item => start < item.end && end > item.start);
    const conflictsWithAppointment = occupied.some(item =>
      rangesOverlap(startAt, endAt, item.startAt, item.endAt),
    );

    if (!conflictsWithBreak && !conflictsWithAppointment && startAt.getTime() > now.getTime()) {
      slots.push({ time, startAt, endAt });
    }
  }

  return slots;
}

export function buildSlotStarts(startAt: Date, durationMinutes: number) {
  if (durationMinutes <= 0 || durationMinutes % SLOT_INTERVAL_MINUTES !== 0) {
    throw new Error("A duração do procedimento deve ser múltipla de 15 minutos.");
  }

  return Array.from({ length: durationMinutes / SLOT_INTERVAL_MINUTES }, (_, index) =>
    new Date(startAt.getTime() + index * SLOT_INTERVAL_MINUTES * 60_000),
  );
}

export function normalizeBrazilPhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return digits;
  throw new Error("Informe um número de WhatsApp válido, com DDD.");
}

export function messageVariables({
  clientName,
  professionalName,
  serviceName,
  startAt,
}: {
  clientName: string;
  professionalName: string;
  serviceName: string;
  startAt: Date;
}) {
  return {
    "{{nome_cliente}}": clientName,
    "{{profissional}}": professionalName,
    "{{procedimento}}": serviceName,
    "{{data}}": new Intl.DateTimeFormat("pt-BR", {
      timeZone: SALON_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(startAt),
    "{{horario}}": formatBrazilTime(startAt),
  };
}

export function interpolateMessage(
  content: string,
  variables: Record<string, string>,
) {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replaceAll(key, value),
    content,
  );
}

export function calculateReminderSchedule({
  appointmentStart,
  sameDayReminderTime,
}: {
  appointmentStart: Date;
  sameDayReminderTime: string;
}) {
  const dayBefore = new Date(appointmentStart.getTime() - 24 * 60 * 60 * 1000);
  const appointmentDate = formatBrazilDate(appointmentStart);
  const sameDay = brazilLocalDateTimeToUtc(appointmentDate, sameDayReminderTime);

  return {
    confirmation: new Date(),
    reminder24h: dayBefore,
    reminderSameDay: sameDay,
  };
}

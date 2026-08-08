import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { nanoid } from "nanoid";
import {
  appointmentSlots,
  appointments,
  clients,
  messageDeliveries,
  messageTemplates,
  payments,
  professionalBreaks,
  professionalWorkHours,
  professionals,
  salonSettings,
  services,
  type InsertUser,
  users,
} from "../drizzle/schema";
import {
  brazilLocalDateTimeToUtc,
  buildSlotStarts,
  calculateReminderSchedule,
  formatBrazilDate,
  generateAvailableSlots,
  normalizeBrazilPhone,
  timeToMinutes,
  weekdayForBrazilDate,
} from "./agendaLogic";
import { ENV } from "./_core/env";
import pg from "pg";

const { Pool } = pg;

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      const pool = new Pool({
        connectionString: ENV.databaseUrl,
        ssl: { rejectUnauthorized: false }
      });
      _db = drizzle(pool, { schema });
    } catch (error) {
      console.warn("[Database] Não foi possível conectar ao banco:", error);
      _db = null;
    }
  }
  return _db;
}

function databaseUnavailable() {
  throw new Error("O serviço de agenda está indisponível no momento.");
}

function validateTimeRange(startTime: string, endTime: string) {
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new Error("O horário final deve ser posterior ao horário inicial.");
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) return;

  const values: any = { openId: user.openId };
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
    }
  }

  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  values.lastSignedIn = user.lastSignedIn ?? new Date();

  await db.insert(users).values(values).onConflictDoUpdate({
    target: users.openId,
    set: values,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export type WorkdayInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
  breaks: Array<{ startTime: string; endTime: string; label?: string }>;
};

export type ProfessionalInput = {
  position: 1 | 2;
  name: string;
  roleLabel: string;
  color: string;
  bio?: string | null;
  isActive: boolean;
  workdays: WorkdayInput[];
};

export async function getPublicCatalog() {
  const db = await getDb();
  if (!db) databaseUnavailable();

  const [professionalRows, serviceRows] = await Promise.all([
    db!
      .select({
        id: professionals.id,
        position: professionals.position,
        name: professionals.name,
        roleLabel: professionals.roleLabel,
        color: professionals.color,
        bio: professionals.bio,
      })
      .from(professionals)
      .where(eq(professionals.isActive, true))
      .orderBy(asc(professionals.position)),
    db!
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        durationMinutes: services.durationMinutes,
        priceCents: services.priceCents,
      })
      .from(services)
      .where(eq(services.isActive, true))
      .orderBy(asc(services.sortOrder), asc(services.name)),
  ]);

  return { professionals: professionalRows, services: serviceRows };
}

export async function saveProfessional(input: ProfessionalInput) {
  if (input.position !== 1 && input.position !== 2) {
    throw new Error("A agenda aceita apenas as posições 1 e 2.");
  }
  if (!input.name.trim()) throw new Error("Informe o nome da profissional.");
  if (input.workdays.length !== 7) {
    throw new Error("Configure os sete dias da semana para esta profissional.");
  }

  const normalizedWorkdays = input.workdays.map(workday => {
    if (workday.dayOfWeek < 0 || workday.dayOfWeek > 6) {
      throw new Error("Dia da semana inválido.");
    }
    if (workday.isWorking) validateTimeRange(workday.startTime, workday.endTime);
    for (const breakWindow of workday.breaks) {
      validateTimeRange(breakWindow.startTime, breakWindow.endTime);
      if (
        timeToMinutes(breakWindow.startTime) < timeToMinutes(workday.startTime)
        || timeToMinutes(breakWindow.endTime) > timeToMinutes(workday.endTime)
      ) {
        throw new Error("Os intervalos devem estar dentro do horário de trabalho.");
      }
    }
    return workday;
  });

  const db = await getDb();
  if (!db) databaseUnavailable();

  return db!.transaction(async tx => {
    const existing = await tx
      .select()
      .from(professionals)
      .where(eq(professionals.position, input.position))
      .limit(1);

    let professionalId = existing[0]?.id;
    const professionalValues = {
      name: input.name.trim(),
      roleLabel: input.roleLabel.trim() || "Lash designer",
      color: input.color,
      bio: input.bio?.trim() || null,
      isActive: input.isActive,
    };

    if (professionalId) {
      await tx
        .update(professionals)
        .set(professionalValues)
        .where(eq(professionals.id, professionalId));
    } else {
      const count = await tx.select({ id: professionals.id }).from(professionals);
      if (count.length >= 2) {
        throw new Error("O sistema permite exatamente duas profissionais.");
      }
      await tx.insert(professionals).values({ position: input.position, ...professionalValues });
      const created = await tx
        .select({ id: professionals.id })
        .from(professionals)
        .where(eq(professionals.position, input.position))
        .limit(1);
      professionalId = created[0]?.id;
    }

    if (!professionalId) throw new Error("Não foi possível configurar a profissional.");

    await tx.delete(professionalBreaks).where(eq(professionalBreaks.professionalId, professionalId));
    await tx.delete(professionalWorkHours).where(eq(professionalWorkHours.professionalId, professionalId));

    await tx.insert(professionalWorkHours).values(
      normalizedWorkdays.map(workday => ({
        professionalId,
        dayOfWeek: workday.dayOfWeek,
        startTime: workday.startTime,
        endTime: workday.endTime,
        isWorking: workday.isWorking,
      })),
    );

    const breakValues = normalizedWorkdays.flatMap(workday =>
      workday.breaks.map(breakWindow => ({
        professionalId,
        dayOfWeek: workday.dayOfWeek,
        startTime: breakWindow.startTime,
        endTime: breakWindow.endTime,
        label: breakWindow.label?.trim() || "Intervalo",
      })),
    );
    if (breakValues.length) await tx.insert(professionalBreaks).values(breakValues);

    return { id: professionalId };
  });
}

export async function saveService(input: any) {
  if (!input.name.trim()) throw new Error("Informe o nome do procedimento.");
  if (input.durationMinutes <= 0 || input.durationMinutes % 15 !== 0) {
    throw new Error("A duração deve ser positiva e múltipla de 15 minutos.");
  }
  if (input.priceCents < 0) throw new Error("O preço não pode ser negativo.");

  const db = await getDb();
  if (!db) databaseUnavailable();

  const values = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    durationMinutes: input.durationMinutes,
    priceCents: input.priceCents,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };

  if (input.id) {
    await db!.update(services).set(values).where(eq(services.id, input.id));
  } else {
    await db!.insert(services).values(values);
  }
}

export async function listAdminServices() {
  const db = await getDb();
  if (!db) databaseUnavailable();
  return db!.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));
}

export async function listAdminProfessionals() {
  const db = await getDb();
  if (!db) databaseUnavailable();

  const professionalRows = await db!
    .select()
    .from(professionals)
    .orderBy(asc(professionals.position));
  const workHourRows = await db!.select().from(professionalWorkHours);
  const breakRows = await db!.select().from(professionalBreaks);

  return professionalRows.map(professional => ({
    ...professional,
    workdays: Array.from({ length: 7 }, (_, dayOfWeek) => {
      const workday = workHourRows.find(
        item => item.professionalId === professional.id && item.dayOfWeek === dayOfWeek,
      );
      return {
        dayOfWeek,
        startTime: workday?.startTime ?? "09:00",
        endTime: workday?.endTime ?? "18:00",
        isWorking: workday?.isWorking ?? false,
        breaks: breakRows
          .filter(item => item.professionalId === professional.id && item.dayOfWeek === dayOfWeek)
          .map(item => ({
            id: item.id,
            startTime: item.startTime,
            endTime: item.endTime,
            label: item.label,
          })),
      };
    }),
  }));
}

export async function getAvailability({
  professionalId,
  serviceId,
  date,
}: {
  professionalId: number;
  serviceId: number;
  date: string;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();

  const professional = await db!
    .select()
    .from(professionals)
    .where(and(eq(professionals.id, professionalId), eq(professionals.isActive, true)))
    .limit(1);
  const service = await db!
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.isActive, true)))
    .limit(1);

  if (!professional[0] || !service[0]) return [];

  const dayOfWeek = weekdayForBrazilDate(date);
  const [workHours] = await db!
    .select()
    .from(professionalWorkHours)
    .where(
      and(
        eq(professionalWorkHours.professionalId, professionalId),
        eq(professionalWorkHours.dayOfWeek, dayOfWeek),
      ),
    )
    .limit(1);
  const breakRows = await db!
    .select()
    .from(professionalBreaks)
    .where(
      and(
        eq(professionalBreaks.professionalId, professionalId),
        eq(professionalBreaks.dayOfWeek, dayOfWeek),
      ),
    );

  const startOfDate = brazilLocalDateTimeToUtc(date, "00:00");
  const endOfDate = new Date(startOfDate.getTime() + 24 * 60 * 60 * 1000);
  const occupied = await db!
    .select({ startAt: appointments.startAt, endAt: appointments.endAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.professionalId, professionalId),
        inArray(appointments.status, ["pending", "confirmed"]),
        lte(appointments.startAt, endOfDate),
        gte(appointments.endAt, startOfDate),
      ),
    );

  return generateAvailableSlots({
    date,
    workHours: workHours ?? null,
    breaks: breakRows,
    occupied,
    durationMinutes: service[0].durationMinutes,
  });
}

export async function createPublicBooking(input: any) {
  if (!input.clientName.trim()) throw new Error("Informe o seu nome.");
  if (!input.whatsappOptIn) {
    throw new Error("É necessário autorizar o envio de mensagens sobre este agendamento.");
  }

  const phone = normalizeBrazilPhone(input.phone);
  const db = await getDb();
  if (!db) databaseUnavailable();

  const [settingsRows, activeTemplateRows] = await Promise.all([
    db!.select().from(salonSettings).limit(1),
    db!
      .select({ id: messageTemplates.id, kind: messageTemplates.kind })
      .from(messageTemplates)
      .where(eq(messageTemplates.isActive, true)),
  ]);
  const settings = settingsRows[0] ?? null;

  const availableSlots = await getAvailability({
    professionalId: input.professionalId,
    serviceId: input.serviceId,
    date: input.date,
  });
  const selected = availableSlots.find(slot => slot.time === input.time);
  if (!selected) throw new Error("Este horário acabou de ficar indisponível. Escolha outro horário.");

  try {
    return await db!.transaction(async tx => {
      const professional = await tx
        .select()
        .from(professionals)
        .where(and(eq(professionals.id, input.professionalId), eq(professionals.isActive, true)))
        .limit(1);
      const service = await tx
        .select()
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.isActive, true)))
        .limit(1);
      if (!professional[0] || !service[0]) {
        throw new Error("A profissional ou o procedimento não está mais disponível.");
      }

      await tx
        .insert(clients)
        .values({
          name: input.clientName.trim(),
          phone,
          email: input.email?.trim() || null,
          whatsappOptIn: true,
          optInAt: new Date(),
        })
        .onConflictDoUpdate({
          target: clients.phone,
          set: {
            name: input.clientName.trim(),
            email: input.email?.trim() || null,
            whatsappOptIn: true,
            optInAt: new Date(),
          },
        });

      const client = await tx.select().from(clients).where(eq(clients.phone, phone)).limit(1);
      if (!client[0]) throw new Error("Não foi possível registrar a cliente.");

      const code = `AG-${nanoid(8).toUpperCase()}`;
      await tx.insert(appointments).values({
        code,
        clientId: client[0].id,
        professionalId: professional[0].id,
        serviceId: service[0].id,
        startAt: selected.startAt,
        endAt: selected.endAt,
        status: "pending",
        source: "public",
      });

      const appointment = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.code, code))
        .limit(1);
      if (!appointment[0]) throw new Error("Não foi possível criar o agendamento.");

      await tx.insert(appointmentSlots).values(
        buildSlotStarts(selected.startAt, service[0].durationMinutes).map(slotStart => ({
          appointmentId: appointment[0].id,
          professionalId: professional[0].id,
          slotStart,
        })),
      );

      return { code, appointmentId: appointment[0].id };
    });
  } catch (error: any) {
    if (error.code === "23505") { // Postgres unique constraint error
      throw new Error("Este horário acabou de ser reservado por outra pessoa.");
    }
    throw error;
  }
}

export async function getAppointmentByCode(code: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();

  const result = await db!
    .select({
      appointment: appointments,
      client: clients,
      professional: professionals,
      service: services,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .innerJoin(professionals, eq(appointments.professionalId, professionals.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .where(eq(appointments.code, code))
    .limit(1);

  return result[0];
}

export async function updatePaymentStatus(appointmentId: number, status: any, stripeIntentId?: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();

  await db!.transaction(async tx => {
    await tx
      .update(appointments)
      .set({ status: status === "succeeded" ? "confirmed" : "pending" })
      .where(eq(appointments.id, appointmentId));

    if (stripeIntentId) {
      await tx.insert(payments).values({
        appointmentId,
        stripePaymentIntentId: stripeIntentId,
        amountCents: 0, // Should be passed
        paymentMethod: "card",
        status: status,
      }).onConflictDoUpdate({
        target: payments.stripePaymentIntentId,
        set: { status },
      });
    }
  });
}

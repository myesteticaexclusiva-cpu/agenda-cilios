import {
  boolean,
  index,
  integer,
  json,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Usuários autenticados que acessam o painel administrativo.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openid", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginmethod", { length: 64 }),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  createdAt: timestamp("createdat").defaultNow().notNull(),
  updatedAt: timestamp("updatedat").defaultNow().notNull(),
  lastSignedIn: timestamp("lastsignedin").defaultNow().notNull(),
});

/**
 * O produto suporta somente duas profissionais. O campo `position` restringe
 * a configuração a duas posições fixas, cada uma com agenda independente.
 */
export const professionals = pgTable(
  "professionals",
  {
    id: serial("id").primaryKey(),
    position: integer("position").notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    roleLabel: varchar("rolelabel", { length: 120 }).notNull().default("Lash designer"),
    color: varchar("color", { length: 16 }).notNull().default("#9D6E60"),
    bio: text("bio"),
    isActive: boolean("isactive").notNull().default(true),
    createdAt: timestamp("createdat").defaultNow().notNull(),
    updatedAt: timestamp("updatedat").defaultNow().notNull(),
  }
);

/** Horário de trabalho recorrente de cada profissional (0 = domingo). */
export const professionalWorkHours = pgTable(
  "professional_work_hours",
  {
    id: serial("id").primaryKey(),
    professionalId: integer("professionalid")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    dayOfWeek: integer("dayofweek").notNull(),
    startTime: varchar("starttime", { length: 5 }).notNull(),
    endTime: varchar("endtime", { length: 5 }).notNull(),
    isWorking: boolean("isworking").notNull().default(true),
    createdAt: timestamp("createdat").defaultNow().notNull(),
    updatedAt: timestamp("updatedat").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("work_hours_professional_day_unique").on(table.professionalId, table.dayOfWeek),
  ],
);

/** Intervalos recorrentes de cada profissional. */
export const professionalBreaks = pgTable(
  "professional_breaks",
  {
    id: serial("id").primaryKey(),
    professionalId: integer("professionalid")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    dayOfWeek: integer("dayofweek").notNull(),
    startTime: varchar("starttime", { length: 5 }).notNull(),
    endTime: varchar("endtime", { length: 5 }).notNull(),
    label: varchar("label", { length: 80 }).notNull().default("Intervalo"),
    createdAt: timestamp("createdat").defaultNow().notNull(),
    updatedAt: timestamp("updatedat").defaultNow().notNull(),
  },
  table => [index("breaks_professional_day_idx").on(table.professionalId, table.dayOfWeek)],
);

/** Catálogo de procedimentos disponíveis no autoagendamento. */
export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    durationMinutes: integer("durationminutes").notNull(),
    priceCents: integer("pricecents").notNull().default(0),
    isActive: boolean("isactive").notNull().default(true),
    sortOrder: integer("sortorder").notNull().default(0),
    createdAt: timestamp("createdat").defaultNow().notNull(),
    updatedAt: timestamp("updatedat").defaultNow().notNull(),
  },
  table => [index("services_active_sort_idx").on(table.isActive, table.sortOrder)],
);

/** Cadastro consolidado de clientes por telefone de WhatsApp. */
export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull().unique(),
    email: varchar("email", { length: 320 }),
    whatsappOptIn: boolean("whatsappoptin").notNull().default(false),
    optInAt: timestamp("optinat"),
    createdAt: timestamp("createdat").defaultNow().notNull(),
    updatedAt: timestamp("updatedat").defaultNow().notNull(),
  },
  table => [
    index("clients_name_idx").on(table.name),
  ],
);

/** Reserva principal. Datas e horários são persistidos em UTC. */
export const appointments = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    clientId: integer("clientid")
      .notNull()
      .references(() => clients.id),
    professionalId: integer("professionalid")
      .notNull()
      .references(() => professionals.id),
    serviceId: integer("serviceid")
      .notNull()
      .references(() => services.id),
    startAt: timestamp("startat").notNull(),
    endAt: timestamp("endat").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    source: varchar("source", { length: 20 }).notNull().default("public"),
    notes: text("notes"),
    cancellationReason: text("cancellationreason"),
    confirmedAt: timestamp("confirmedat"),
    cancelledAt: timestamp("cancelledat"),
    createdAt: timestamp("createdat").defaultNow().notNull(),
    updatedAt: timestamp("updatedat").defaultNow().notNull(),
  },
  table => [
    index("appointments_professional_start_idx").on(table.professionalId, table.startAt),
    index("appointments_client_start_idx").on(table.clientId, table.startAt),
    index("appointments_status_idx").on(table.status),
  ],
);

/** Blocos de 15 minutos reservados. */
export const appointmentSlots = pgTable(
  "appointment_slots",
  {
    id: serial("id").primaryKey(),
    appointmentId: integer("appointmentid")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    professionalId: integer("professionalid")
      .notNull()
      .references(() => professionals.id),
    slotStart: timestamp("slotstart").notNull(),
    createdAt: timestamp("createdat").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("appointment_slots_professional_start_unique").on(
      table.professionalId,
      table.slotStart,
    ),
    index("appointment_slots_appointment_idx").on(table.appointmentId),
  ],
);

/** Conteúdo administrável, posteriormente associado aos templates aprovados na Meta. */
export const messageTemplates = pgTable(
  "message_templates",
  {
    id: serial("id").primaryKey(),
    kind: varchar("kind", { length: 40 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    content: text("content").notNull(),
    metaTemplateName: varchar("metatemplatename", { length: 512 }),
    languageCode: varchar("languagecode", { length: 16 }).notNull().default("pt_BR"),
    isActive: boolean("isactive").notNull().default(true),
    createdAt: timestamp("createdat").defaultNow().notNull(),
    updatedAt: timestamp("updatedat").defaultNow().notNull(),
  }
);

/** Fila e histórico de tentativas de entrega pelo WhatsApp. */
export const messageDeliveries = pgTable(
  "message_deliveries",
  {
    id: serial("id").primaryKey(),
    appointmentId: integer("appointmentid")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    templateId: integer("templateid").references(() => messageTemplates.id, {
      onDelete: "set null",
    }),
    kind: varchar("kind", { length: 40 }).notNull(),
    idempotencyKey: varchar("idempotencykey", { length: 100 }).notNull().unique(),
    scheduledFor: timestamp("scheduledfor").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    providerMessageId: varchar("providermessageid", { length: 160 }),
    lastError: text("lasterror"),
    payload: json("payload"),
    sentAt: timestamp("sentat"),
    createdAt: timestamp("createdat").defaultNow().notNull(),
    updatedAt: timestamp("updatedat").defaultNow().notNull(),
  },
  table => [
    index("message_deliveries_status_schedule_idx").on(table.status, table.scheduledFor),
    index("message_deliveries_appointment_idx").on(table.appointmentId),
  ],
);

/** Configurações não sensíveis da conexão com o WhatsApp e da operação do salão. */
export const salonSettings = pgTable(
  "salon_settings",
  {
    id: serial("id").primaryKey(),
    salonName: varchar("salonname", { length: 160 }).notNull().default("Ateliê de Cílios"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("America/Sao_Paulo"),
    sameDayReminderTime: varchar("samedayremindertime", { length: 5 }).notNull().default("09:00"),
    whatsappPhoneNumberId: varchar("whatsappphonenumberid", { length: 80 }),
    whatsappBusinessAccountId: varchar("whatsappbusinessaccountid", { length: 80 }),
    whatsappEnabled: boolean("whatsappenabled").notNull().default(false),
    whatsappDispatchTaskUid: varchar("whatsappdispatchtaskuid", { length: 65 }).unique(),
    createdAt: timestamp("createdat").defaultNow().notNull(),
    updatedAt: timestamp("updatedat").defaultNow().notNull(),
  }
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    appointmentId: integer("appointmentid")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    stripePaymentIntentId: varchar("stripepaymentintentid", { length: 100 }).notNull().unique(),
    amountCents: integer("amountcents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("BRL"),
    paymentMethod: varchar("paymentmethod", { length: 10 }).notNull(),
    stripeFeesCents: integer("stripefeescents").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    stripeChargeId: varchar("stripechargeid", { length: 100 }),
    lastError: text("lasterror"),
    succeededAt: timestamp("succeededat"),
    createdAt: timestamp("createdat").defaultNow().notNull(),
    updatedAt: timestamp("updatedat").defaultNow().notNull(),
  },
  table => [
    index("payments_appointment_idx").on(table.appointmentId),
    index("payments_status_idx").on(table.status),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Professional = typeof professionals.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type Payment = typeof payments.$inferSelect;

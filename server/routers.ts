import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { formatBrazilDate } from "./agendaLogic";
import {
  createPayment,
  createPublicBooking,
  getAppointmentByCode,
  getAvailability,
  getPublicCatalog,
  getSalonSettings,
  listAdminProfessionals,
  listAdminServices,
  listAppointments,
  listMessageDeliveries,
  listMessageTemplates,
  rescheduleAppointment,
  saveMessageTemplate,
  saveProfessional,
  saveSalonSettings,
  saveService,
  searchClients,
  updateAppointmentStatus,
} from "./db";
import { buildLineItemDescription, calculatePaymentAmount, formatCurrency } from "./stripe";

function asBadRequest(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: error instanceof Error ? error.message : "Não foi possível concluir a operação.",
  });
}

const appointmentStatusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

const workdaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isWorking: z.boolean(),
  breaks: z.array(
    z.object({
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      label: z.string().max(80).optional(),
    }),
  ),
});

const professionalInputSchema = z.object({
  position: z.union([z.literal(1), z.literal(2)]),
  name: z.string().trim().min(1).max(120),
  roleLabel: z.string().trim().max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bio: z.string().max(1000).nullable().optional(),
  isActive: z.boolean(),
  workdays: z.array(workdaySchema).length(7),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  booking: router({
    catalog: publicProcedure.query(async () => {
      try {
        return await getPublicCatalog();
      } catch (error) {
        return asBadRequest(error);
      }
    }),
    availability: publicProcedure
      .input(
        z.object({
          professionalId: z.number().int().positive(),
          serviceId: z.number().int().positive(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      )
      .query(async ({ input }) => {
        try {
          return await getAvailability(input);
        } catch (error) {
          return asBadRequest(error);
        }
      }),
    create: publicProcedure
      .input(
        z.object({
          professionalId: z.number().int().positive(),
          serviceId: z.number().int().positive(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          time: z.string().regex(/^\d{2}:\d{2}$/),
          clientName: z.string().trim().min(2).max(160),
          phone: z.string().trim().min(10).max(32),
          email: z.string().email().max(320).nullable().optional(),
          whatsappOptIn: z.literal(true),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await createPublicBooking(input);
        } catch (error) {
          return asBadRequest(error);
        }
      }),
    confirmation: publicProcedure
      .input(z.object({ code: z.string().trim().min(5).max(20) }))
      .query(async ({ input }) => {
        try {
          const appointment = await getAppointmentByCode(input.code);
          if (!appointment) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado." });
          }
          return appointment;
        } catch (error) {
          return asBadRequest(error);
        }
      }),
    confirmPayment: publicProcedure
      .input(z.object({ sessionId: z.string().trim().min(5).max(200) }))
      .query(async ({ input }) => {
        try {
          const { retrieveCheckoutSession } = await import("./stripeIntegration");
          const session = await retrieveCheckoutSession(input.sessionId);
          
          if (!session.metadata?.appointmentCode) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado." });
          }

          const appointment = await getAppointmentByCode(session.metadata.appointmentCode);
          if (!appointment) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado." });
          }

          return {
            appointment,
            paymentStatus: session.payment_status,
            amountTotal: session.amount_total,
            currency: session.currency,
          };
        } catch (error) {
          return asBadRequest(error);
        }
      }),
    createPaymentIntent: publicProcedure
      .input(
        z.object({
          appointmentCode: z.string().trim().min(5).max(20),
          paymentMethod: z.enum(["card", "pix"]),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const appointment = await getAppointmentByCode(input.appointmentCode);
          if (!appointment) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado." });
          }
          if (appointment.status !== "pending") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Este agendamento já foi processado." });
          }

          const { amountCents, stripeFeesCents } = calculatePaymentAmount(
            appointment.service.priceCents,
            input.paymentMethod,
          );

          const { createCheckoutSession } = await import("./stripeIntegration");
          const baseUrl = process.env.NODE_ENV === "production" 
            ? "https://myesteticaexclusiva.netlify.app" 
            : `${ctx.req.protocol || "https"}://${ctx.req.headers.host || "localhost:3000"}`;

          const session = await createCheckoutSession({
            appointmentCode: input.appointmentCode,
            appointmentId: appointment.id,
            paymentMethod: input.paymentMethod,
            amountCents,
            stripeFeesCents,
            description: buildLineItemDescription(
              appointment.professional.name,
              appointment.service.name,
              formatBrazilDate(appointment.startAt),
            ),
            clientEmail: appointment.clientEmail,
            clientName: appointment.clientName,
            successUrl: `${baseUrl}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${baseUrl}/pagamento?code=${input.appointmentCode}`,
          });

          await createPayment({
            appointmentId: appointment.id,
            stripePaymentIntentId: session.sessionId,
            amountCents,
            paymentMethod: input.paymentMethod,
            stripeFeesCents,
          });

          return { stripeUrl: session.url };
        } catch (error) {
          return asBadRequest(error);
        }
      }),
  }),

  admin: router({
    bootstrap: adminProcedure.query(async () => {
      try {
        const [professionals, services, appointments, settings, templates, deliveries] = await Promise.all([
          listAdminProfessionals(),
          listAdminServices(),
          listAppointments(),
          getSalonSettings(),
          listMessageTemplates(),
          listMessageDeliveries(30),
        ]);
        return { professionals, services, appointments, settings, templates, deliveries };
      } catch (error) {
        return asBadRequest(error);
      }
    }),

    professionals: router({
      list: adminProcedure.query(async () => {
        try {
          return await listAdminProfessionals();
        } catch (error) {
          return asBadRequest(error);
        }
      }),
      save: adminProcedure.input(professionalInputSchema).mutation(async ({ input }) => {
        try {
          return await saveProfessional(input);
        } catch (error) {
          return asBadRequest(error);
        }
      }),
    }),

    services: router({
      list: adminProcedure.query(async () => {
        try {
          return await listAdminServices();
        } catch (error) {
          return asBadRequest(error);
        }
      }),
      save: adminProcedure
        .input(
          z.object({
            id: z.number().int().positive().optional(),
            name: z.string().trim().min(1).max(120),
            description: z.string().max(1200).nullable().optional(),
            durationMinutes: z.number().int().positive().max(480),
            priceCents: z.number().int().min(0).max(10_000_000),
            isActive: z.boolean(),
            sortOrder: z.number().int().min(0).max(999),
          }),
        )
        .mutation(async ({ input }) => {
          try {
            return await saveService(input);
          } catch (error) {
            return asBadRequest(error);
          }
        }),
    }),

    appointments: router({
      list: adminProcedure
        .input(z.object({ status: appointmentStatusSchema.optional() }).optional())
        .query(async ({ input }) => {
          try {
            return await listAppointments({ status: input?.status });
          } catch (error) {
            return asBadRequest(error);
          }
        }),
      updateStatus: adminProcedure
        .input(
          z.object({
            appointmentId: z.number().int().positive(),
            status: z.enum(["confirmed", "cancelled", "completed", "no_show"]),
            cancellationReason: z.string().max(800).nullable().optional(),
          }),
        )
        .mutation(async ({ input }) => {
          try {
            return await updateAppointmentStatus(input);
          } catch (error) {
            return asBadRequest(error);
          }
        }),
      reschedule: adminProcedure
        .input(
          z.object({
            appointmentId: z.number().int().positive(),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            time: z.string().regex(/^\d{2}:\d{2}$/),
          }),
        )
        .mutation(async ({ input }) => {
          try {
            return await rescheduleAppointment(input);
          } catch (error) {
            return asBadRequest(error);
          }
        }),
    }),

    clients: router({
      search: adminProcedure
        .input(z.object({ query: z.string().trim().min(1).max(160) }))
        .query(async ({ input }) => {
          try {
            return await searchClients(input.query);
          } catch (error) {
            return asBadRequest(error);
          }
        }),
    }),

    messages: router({
      templates: adminProcedure.query(async () => {
        try {
          return await listMessageTemplates();
        } catch (error) {
          return asBadRequest(error);
        }
      }),
      saveTemplate: adminProcedure
        .input(
          z.object({
            kind: z.enum(["confirmation", "reminder_24h", "reminder_same_day"]),
            name: z.string().trim().min(1).max(120),
            content: z.string().trim().min(1).max(4096),
            metaTemplateName: z.string().trim().max(512).nullable().optional(),
            languageCode: z.string().trim().min(2).max(16),
            isActive: z.boolean(),
          }),
        )
        .mutation(async ({ input }) => {
          try {
            return await saveMessageTemplate(input);
          } catch (error) {
            return asBadRequest(error);
          }
        }),
      deliveries: adminProcedure.query(async () => {
        try {
          return await listMessageDeliveries();
        } catch (error) {
          return asBadRequest(error);
        }
      }),
    }),

    settings: router({
      get: adminProcedure.query(async () => {
        try {
          return await getSalonSettings();
        } catch (error) {
          return asBadRequest(error);
        }
      }),
      save: adminProcedure
        .input(
          z.object({
            salonName: z.string().trim().min(1).max(160),
            sameDayReminderTime: z.string().regex(/^\d{2}:\d{2}$/),
            whatsappPhoneNumberId: z.string().trim().max(80).nullable().optional(),
            whatsappBusinessAccountId: z.string().trim().max(80).nullable().optional(),
            whatsappEnabled: z.boolean(),
          }),
        )
        .mutation(async ({ input }) => {
          try {
            return await saveSalonSettings(input);
          } catch (error) {
            return asBadRequest(error);
          }
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;

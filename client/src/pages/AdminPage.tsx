import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Eye,
  Loader2,
  MessageCircleMore,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TEMPLATE_PRESETS = {
  confirmation: {
    title: "Confirmação de agendamento",
    content: "Olá, {{nome_cliente}}! Seu atendimento de {{procedimento}} com {{profissional}} está reservado para {{data}}, às {{horario}}. Até breve!",
  },
  reminder_24h: {
    title: "Lembrete de 24 horas",
    content: "Olá, {{nome_cliente}}! Passando para lembrar do seu atendimento de {{procedimento}} com {{profissional}}, amanhã, {{data}}, às {{horario}}.",
  },
  reminder_same_day: {
    title: "Lembrete no dia",
    content: "Olá, {{nome_cliente}}! Hoje é o seu atendimento de {{procedimento}} com {{profissional}}, às {{horario}}. Estamos esperando por você!",
  },
} as const;

type WorkdayForm = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
  breaks: Array<{ startTime: string; endTime: string; label?: string }>;
};

type ProfessionalForm = {
  position: 1 | 2;
  name: string;
  roleLabel: string;
  color: string;
  bio: string;
  isActive: boolean;
  workdays: WorkdayForm[];
};

type AppointmentView = {
  id: number;
  code: string;
  startAt: Date;
  endAt: Date;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  clientName: string;
  clientPhone: string;
  professionalId: number;
  professionalName: string;
  professionalColor: string;
  serviceId: number;
  serviceName: string;
};

function buildWorkdays(): WorkdayForm[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "18:00",
    isWorking: dayOfWeek >= 1 && dayOfWeek <= 6,
    breaks: dayOfWeek >= 1 && dayOfWeek <= 6 ? [{ startTime: "12:00", endTime: "13:00", label: "Almoço" }] : [],
  }));
}

function professionalDefaults(position: 1 | 2): ProfessionalForm {
  return {
    position,
    name: "",
    roleLabel: "Lash designer",
    color: position === 1 ? "#AE7563" : "#6B8077",
    bio: "",
    isActive: true,
    workdays: buildWorkdays(),
  };
}

function normalizeProfessional(initial: (Omit<ProfessionalForm, "position" | "bio"> & { position: number; bio: string | null; id?: number }) | undefined, position: 1 | 2): ProfessionalForm {
  if (!initial) return professionalDefaults(position);
  return {
    position,
    name: initial.name,
    roleLabel: initial.roleLabel,
    color: initial.color,
    bio: initial.bio || "",
    isActive: initial.isActive,
    workdays: Array.from({ length: 7 }, (_, dayOfWeek) => {
      const incoming = initial.workdays.find(item => item.dayOfWeek === dayOfWeek);
      return incoming
        ? {
            dayOfWeek,
            startTime: incoming.startTime,
            endTime: incoming.endTime,
            isWorking: incoming.isWorking,
            breaks: incoming.breaks.map(item => ({ startTime: item.startTime, endTime: item.endTime, label: item.label || "Intervalo" })),
          }
        : buildWorkdays()[dayOfWeek];
    }),
  };
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function todayInBrazil() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function statusLabel(status: AppointmentView["status"]) {
  return {
    pending: "A confirmar",
    confirmed: "Confirmado",
    cancelled: "Cancelado",
    completed: "Concluído",
    no_show: "Não compareceu",
  }[status];
}

function statusClass(status: AppointmentView["status"]) {
  return {
    pending: "bg-[#fff0cf] text-[#89621a] border-[#eed79d]",
    confirmed: "bg-[#e1f0e8] text-[#2d6b49] border-[#bbddc9]",
    cancelled: "bg-[#f5e8e6] text-[#994b42] border-[#eccbc6]",
    completed: "bg-[#e8edf4] text-[#49607a] border-[#ced9e8]",
    no_show: "bg-[#eee9e6] text-[#6e5b53] border-[#ddd2cb]",
  }[status];
}

export default function AdminPage() {
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const bootstrap = trpc.admin.bootstrap.useQuery();
  const [rescheduling, setRescheduling] = useState<AppointmentView | null>(null);
  const [cancelling, setCancelling] = useState<AppointmentView | null>(null);

  const refresh = async () => {
    await Promise.all([
      utils.admin.bootstrap.invalidate(),
      utils.admin.appointments.invalidate(),
      utils.admin.professionals.invalidate(),
      utils.admin.services.invalidate(),
      utils.admin.messages.invalidate(),
      utils.admin.settings.invalidate(),
    ]);
  };

  const updateStatus = trpc.admin.appointments.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success("Agendamento atualizado.");
      setCancelling(null);
      await refresh();
    },
    onError: error => toast.error(error.message),
  });

  let content: React.ReactNode;
  if (bootstrap.isLoading) {
    content = <div className="grid min-h-[70vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#a56d5d]" /></div>;
  } else if (bootstrap.isError || !bootstrap.data) {
    content = (
      <section className="paper-card mx-auto max-w-lg p-8 text-center">
        <CircleAlert className="mx-auto h-7 w-7 text-[#b06f5b]" />
        <h1 className="mt-4 font-serif text-3xl">Não foi possível abrir o painel.</h1>
        <p className="mt-3 text-sm leading-6 text-[#745f56]">Verifique se você está conectada como administradora do projeto.</p>
      </section>
    );
  } else if (location === "/admin/clientes") {
    content = <ClientsPanel />;
  } else if (location === "/admin/mensagens") {
    content = <MessagesPanel templates={bootstrap.data.templates} deliveries={bootstrap.data.deliveries} onSaved={refresh} />;
  } else if (location === "/admin/configuracoes") {
    content = <SettingsPanel professionals={bootstrap.data.professionals} services={bootstrap.data.services} settings={bootstrap.data.settings} onSaved={refresh} />;
  } else {
    content = <AgendaPanel appointments={bootstrap.data.appointments as AppointmentView[]} onConfirm={id => updateStatus.mutate({ appointmentId: id, status: "confirmed" })} onComplete={id => updateStatus.mutate({ appointmentId: id, status: "completed" })} onNoShow={id => updateStatus.mutate({ appointmentId: id, status: "no_show" })} onCancel={appointment => setCancelling(appointment)} onReschedule={appointment => setRescheduling(appointment)} />;
  }

  return (
    <DashboardLayout>
      {content}
      <RescheduleDialog appointment={rescheduling} onOpenChange={open => !open && setRescheduling(null)} onSaved={async () => { setRescheduling(null); await refresh(); }} />
      <Dialog open={Boolean(cancelling)} onOpenChange={open => !open && setCancelling(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-[#fffdfa]">
          <DialogHeader><DialogTitle className="font-serif text-3xl">Cancelar agendamento?</DialogTitle><DialogDescription>O horário será liberado para novas reservas.</DialogDescription></DialogHeader>
          {cancelling && <div className="rounded-xl bg-[#f8f0ec] p-4 text-sm text-[#674e44]"><p className="font-semibold">{cancelling.clientName}</p><p className="mt-1">{cancelling.serviceName} · {formatDateTime(cancelling.startAt)}</p></div>}
          <div className="mt-2 flex justify-end gap-3"><Button variant="outline" className="rounded-full" onClick={() => setCancelling(null)}>Voltar</Button><Button className="rounded-full bg-[#a44f45] text-white hover:bg-[#8f4139]" disabled={updateStatus.isPending} onClick={() => cancelling && updateStatus.mutate({ appointmentId: cancelling.id, status: "cancelled" })}>{updateStatus.isPending ? "Cancelando..." : "Cancelar horário"}</Button></div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow">{eyebrow}</p><h1 className="mt-2 font-serif text-4xl leading-none text-[#2e211d] md:text-5xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#765f56]">{description}</p></div>{action}</div>;
}

function AgendaPanel({ appointments, onConfirm, onComplete, onNoShow, onCancel, onReschedule }: { appointments: AppointmentView[]; onConfirm: (id: number) => void; onComplete: (id: number) => void; onNoShow: (id: number) => void; onCancel: (appointment: AppointmentView) => void; onReschedule: (appointment: AppointmentView) => void }) {
  const [filter, setFilter] = useState<"all" | AppointmentView["status"]>("all");
  const filtered = useMemo(() => (filter === "all" ? appointments : appointments.filter(item => item.status === filter)), [appointments, filter]);
  const today = todayInBrazil();
  const upcoming = appointments.filter(item => item.status !== "cancelled" && formatDate(item.startAt) >= today).length;
  const pending = appointments.filter(item => item.status === "pending").length;

  return <>
    <PageIntro eyebrow="Visão da equipe" title="Agenda do estúdio" description="Acompanhe as duas profissionais em uma visão única e mantenha cada atendimento sob controle." action={<Button onClick={() => window.location.assign("/agendar")} className="h-11 rounded-full bg-[#2c201d] text-[#fffaf6] hover:bg-[#44312a]"><ExternalLink className="mr-2 h-4 w-4" /> Ver página pública</Button>} />
    <section className="grid gap-4 sm:grid-cols-3">
      <MetricCard label="Próximos atendimentos" value={upcoming.toString()} icon={<CalendarClock className="h-5 w-5" />} tone="rose" />
      <MetricCard label="Aguardando confirmação" value={pending.toString()} icon={<Clock3 className="h-5 w-5" />} tone="gold" />
      <MetricCard label="Duas agendas" value="02" icon={<UsersRound className="h-5 w-5" />} tone="sage" />
    </section>
    <section className="paper-card mt-6 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-[#eee3dc] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="font-serif text-3xl">Atendimentos</h2><p className="mt-1 text-xs text-[#806a60]">Confirme, reagende ou atualize o status de cada reserva.</p></div><div className="flex gap-2 overflow-x-auto pb-1">{(["all", "pending", "confirmed", "completed", "cancelled"] as const).map(item => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === item ? "bg-[#2c201d] text-white" : "bg-[#f6eee9] text-[#6a5148] hover:bg-[#ecded6]"}`}>{item === "all" ? "Todos" : statusLabel(item)}</button>)}</div></div>
      {!filtered.length ? <div className="grid min-h-60 place-items-center p-8 text-center"><CalendarDays className="h-7 w-7 text-[#c99a8b]" /><p className="mt-3 font-serif text-2xl">Nenhum agendamento aqui.</p><p className="mt-1 text-sm text-[#826b61]">As próximas reservas aparecerão nesta lista.</p></div> : <div className="divide-y divide-[#eee3dc]">{filtered.map(appointment => <article key={appointment.id} className="p-5 transition hover:bg-[#fffcf9] sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-center"><div className="flex min-w-0 flex-1 items-center gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: appointment.professionalColor }}>{appointment.professionalName.charAt(0)}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-[#382722]">{appointment.clientName}</p><Badge className={`border px-2 py-0.5 text-[10px] font-semibold ${statusClass(appointment.status)}`}>{statusLabel(appointment.status)}</Badge></div><p className="mt-1 text-xs text-[#755f56]">{appointment.serviceName} · {appointment.professionalName} · {formatDateTime(appointment.startAt)}</p><p className="mt-1 text-[11px] text-[#9a7d71]">{appointment.clientPhone} · {appointment.code}</p></div></div><div className="flex flex-wrap gap-2 xl:justify-end">{appointment.status === "pending" && <Button size="sm" onClick={() => onConfirm(appointment.id)} className="h-8 rounded-full bg-[#41745a] text-xs text-white hover:bg-[#346248]"><Check className="mr-1 h-3.5 w-3.5" /> Confirmar</Button>}{!["cancelled", "completed", "no_show"].includes(appointment.status) && <><Button size="sm" variant="outline" onClick={() => onReschedule(appointment)} className="h-8 rounded-full border-[#dbc9bf] text-xs text-[#644a40] hover:bg-[#f8f0ec]"><Pencil className="mr-1 h-3.5 w-3.5" /> Reagendar</Button><Button size="sm" variant="outline" onClick={() => onCancel(appointment)} className="h-8 rounded-full border-[#e5c7c1] text-xs text-[#9a5147] hover:bg-[#fbefec]"><X className="mr-1 h-3.5 w-3.5" /> Cancelar</Button></>}{appointment.status === "confirmed" && <Button size="sm" variant="outline" onClick={() => onComplete(appointment.id)} className="h-8 rounded-full border-[#cbdad0] text-xs text-[#35664d] hover:bg-[#edf7f0]">Concluir</Button>}{appointment.status === "confirmed" && <Button size="sm" variant="ghost" onClick={() => onNoShow(appointment.id)} className="h-8 rounded-full text-xs text-[#79645b]">Não compareceu</Button>}</div></div></article>)}</div>}
    </section>
  </>;
}

function MetricCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "rose" | "gold" | "sage" }) {
  const tones = { rose: "bg-[#f5e3dc] text-[#9f6555]", gold: "bg-[#f6eed8] text-[#98752a]", sage: "bg-[#e3eee8] text-[#4e7761]" };
  return <article className="paper-card p-5"><div className="flex items-center justify-between"><span className={`grid h-10 w-10 place-items-center rounded-full ${tones[tone]}`}>{icon}</span><span className="font-serif text-4xl text-[#372620]">{value}</span></div><p className="mt-5 text-xs font-semibold text-[#755f56]">{label}</p></article>;
}

function ClientsPanel() {
  const [query, setQuery] = useState("");
  const enabled = query.trim().length > 0;
  const result = trpc.admin.clients.search.useQuery({ query: query.trim() || "-" }, { enabled });

  return <>
    <PageIntro eyebrow="Relacionamento" title="Clientes" description="Localize rapidamente uma cliente pelo nome ou pelo número de WhatsApp." />
    <section className="paper-card max-w-4xl p-5 sm:p-7"><div className="relative"><Search className="pointer-events-none absolute left-4 top-3 h-5 w-5 text-[#a56d5d]" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome ou telefone" className="h-11 border-[#e5d7cf] bg-[#fffdfa] pl-11" /></div>{!enabled ? <div className="py-16 text-center"><UsersRound className="mx-auto h-7 w-7 text-[#c99a8b]" /><p className="mt-4 font-serif text-2xl">Comece uma busca.</p><p className="mt-1 text-sm text-[#806a60]">Digite o nome ou o telefone da cliente.</p></div> : result.isLoading ? <div className="grid min-h-44 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#a56d5d]" /></div> : !result.data?.length ? <div className="py-16 text-center"><p className="font-serif text-2xl">Nenhuma cliente encontrada.</p><p className="mt-1 text-sm text-[#806a60]">Tente outro nome ou número.</p></div> : <div className="mt-6 divide-y divide-[#eee3dc]">{result.data.map(client => <div className="flex items-center gap-4 py-4" key={client.id}><span className="grid h-10 w-10 place-items-center rounded-full bg-[#f1e2db] text-sm font-semibold text-[#a56d5d]">{client.name.charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#3d2b25]">{client.name}</p><p className="mt-1 truncate text-xs text-[#7d665c]">{client.phone}{client.email ? ` · ${client.email}` : ""}</p></div>{client.whatsappOptIn && <Badge className="border-[#c7dfcf] bg-[#e8f3eb] text-[10px] text-[#396c50]">WhatsApp autorizado</Badge>}</div>)}</div>}</section>
  </>;
}

function SettingsPanel({ professionals, services, settings, onSaved }: { professionals: Array<Omit<ProfessionalForm, "position" | "bio"> & { id: number; position: number; bio: string | null }>; services: Array<{ id: number; name: string; description: string | null; durationMinutes: number; priceCents: number; isActive: boolean; sortOrder: number }>; settings: { salonName: string; sameDayReminderTime: string; whatsappPhoneNumberId: string | null; whatsappBusinessAccountId: string | null; whatsappEnabled: boolean } | null; onSaved: () => Promise<void> }) {
  return <>
    <PageIntro eyebrow="Estrutura do estúdio" title="Configurações" description="Personalize as duas agendas, seu catálogo e os dados operacionais do WhatsApp Business." />
    <div className="space-y-6">
      <section><div className="mb-3 flex items-center gap-2"><UserRoundPlus className="h-4 w-4 text-[#a56d5d]" /><h2 className="font-serif text-3xl">As duas profissionais</h2></div><p className="mb-5 text-sm text-[#765f56]">Cada profissional possui agenda, intervalo e disponibilidade próprios.</p><div className="grid gap-5 xl:grid-cols-2"><ProfessionalSettingsCard position={1} initial={professionals.find(item => item.position === 1)} onSaved={onSaved} /><ProfessionalSettingsCard position={2} initial={professionals.find(item => item.position === 2)} onSaved={onSaved} /></div></section>
      <ServiceManager services={services} onSaved={onSaved} />
      <WhatsappSettings settings={settings} onSaved={onSaved} />
    </div>
  </>;
}

function ProfessionalSettingsCard({ position, initial, onSaved }: { position: 1 | 2; initial?: Omit<ProfessionalForm, "position" | "bio"> & { id: number; position: number; bio: string | null }; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<ProfessionalForm>(() => normalizeProfessional(initial, position));
  const [expanded, setExpanded] = useState(Boolean(!initial));
  useEffect(() => setForm(normalizeProfessional(initial, position)), [initial, position]);
  const save = trpc.admin.professionals.save.useMutation({ onSuccess: async () => { toast.success(`Agenda ${position} salva.`); setExpanded(false); await onSaved(); }, onError: error => toast.error(error.message) });
  const setWorkday = (dayIndex: number, patch: Partial<WorkdayForm>) => setForm(current => ({ ...current, workdays: current.workdays.map(day => day.dayOfWeek === dayIndex ? { ...day, ...patch } : day) }));
  const addBreak = (dayIndex: number) => setWorkday(dayIndex, { breaks: [...form.workdays.find(day => day.dayOfWeek === dayIndex)!.breaks, { startTime: "12:00", endTime: "13:00", label: "Intervalo" }] });
  const patchBreak = (dayIndex: number, breakIndex: number, patch: Partial<WorkdayForm["breaks"][number]>) => setWorkday(dayIndex, { breaks: form.workdays.find(day => day.dayOfWeek === dayIndex)!.breaks.map((item, index) => index === breakIndex ? { ...item, ...patch } : item) });
  const removeBreak = (dayIndex: number, breakIndex: number) => setWorkday(dayIndex, { breaks: form.workdays.find(day => day.dayOfWeek === dayIndex)!.breaks.filter((_, index) => index !== breakIndex) });

  return <section className="paper-card overflow-hidden"><div className="flex items-center justify-between gap-4 p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: form.color }}>{form.name ? form.name.charAt(0).toUpperCase() : position}</span><div><p className="text-xs font-semibold tracking-[0.14em] text-[#a56d5d]">PROFISSIONAL {position}</p><h3 className="mt-0.5 font-serif text-2xl">{form.name || "A configurar"}</h3></div></div><Button type="button" variant="outline" onClick={() => setExpanded(value => !value)} className="h-9 rounded-full border-[#dcc9bf] text-xs text-[#60483e]">{expanded ? "Fechar" : initial ? "Editar" : "Configurar"}</Button></div>{expanded && <div className="border-t border-[#eee3dc] p-5"><div className="grid gap-3 sm:grid-cols-2"><div><Label className="mb-1.5 block text-xs">Nome</Label><Input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Nome da profissional" className="h-10 border-[#e5d7cf]" /></div><div><Label className="mb-1.5 block text-xs">Função</Label><Input value={form.roleLabel} onChange={event => setForm(current => ({ ...current, roleLabel: event.target.value }))} className="h-10 border-[#e5d7cf]" /></div><div className="sm:col-span-2"><Label className="mb-1.5 block text-xs">Apresentação breve</Label><Input value={form.bio} onChange={event => setForm(current => ({ ...current, bio: event.target.value }))} placeholder="Ex.: Especialista em volume brasileiro" className="h-10 border-[#e5d7cf]" /></div><div className="flex items-center gap-3"><input type="color" aria-label="Cor de identificação" value={form.color} onChange={event => setForm(current => ({ ...current, color: event.target.value }))} className="h-10 w-12 rounded border border-[#e5d7cf] bg-transparent p-1" /><span className="text-xs text-[#7b655c]">Cor de identificação</span></div><label className="flex items-center gap-2 text-xs text-[#644b42]"><Switch checked={form.isActive} onCheckedChange={checked => setForm(current => ({ ...current, isActive: checked }))} /> Agenda ativa ao público</label></div><div className="mt-6"><div className="flex items-center justify-between"><p className="text-xs font-semibold tracking-[0.14em] text-[#9b6758]">HORÁRIOS E INTERVALOS</p><span className="text-[10px] text-[#8c7469]">Domingo a sábado</span></div><div className="mt-3 divide-y divide-[#f0e6e0] rounded-xl border border-[#eee3dc]">{form.workdays.map(day => <div key={day.dayOfWeek} className="p-3"><div className="flex flex-wrap items-center gap-3"><span className="w-9 text-xs font-semibold text-[#5f4740]">{WEEKDAYS[day.dayOfWeek]}</span><Switch checked={day.isWorking} onCheckedChange={checked => setWorkday(day.dayOfWeek, { isWorking: checked })} />{day.isWorking && <><Input type="time" value={day.startTime} onChange={event => setWorkday(day.dayOfWeek, { startTime: event.target.value })} className="h-8 w-[104px] border-[#e5d7cf] text-xs" /><span className="text-xs text-[#8b7065]">até</span><Input type="time" value={day.endTime} onChange={event => setWorkday(day.dayOfWeek, { endTime: event.target.value })} className="h-8 w-[104px] border-[#e5d7cf] text-xs" /><Button type="button" variant="ghost" size="sm" onClick={() => addBreak(day.dayOfWeek)} className="ml-auto h-7 rounded-full text-[11px] text-[#9a6253]"><Plus className="mr-1 h-3 w-3" /> Intervalo</Button></>}</div>{day.isWorking && day.breaks.map((item, index) => <div key={`${day.dayOfWeek}-${index}`} className="ml-12 mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#faf4f0] p-2"><span className="text-[10px] font-semibold text-[#98705f]">{item.label || "Intervalo"}</span><Input type="time" value={item.startTime} onChange={event => patchBreak(day.dayOfWeek, index, { startTime: event.target.value })} className="h-7 w-[92px] border-[#e5d7cf] bg-white text-[11px]" /><span className="text-xs text-[#8b7065]">–</span><Input type="time" value={item.endTime} onChange={event => patchBreak(day.dayOfWeek, index, { endTime: event.target.value })} className="h-7 w-[92px] border-[#e5d7cf] bg-white text-[11px]" /><button type="button" onClick={() => removeBreak(day.dayOfWeek, index)} className="ml-auto text-[#a65349]" aria-label="Remover intervalo"><X className="h-3.5 w-3.5" /></button></div>)}</div>)}</div></div><Button type="button" disabled={save.isPending} onClick={() => save.mutate({ ...form, bio: form.bio || null })} className="mt-5 h-10 w-full rounded-full bg-[#2c201d] text-[#fffaf6] hover:bg-[#44312a]">{save.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar profissional"}</Button></div>}</section>;
}

function ServiceManager({ services, onSaved }: { services: Array<{ id: number; name: string; description: string | null; durationMinutes: number; priceCents: number; isActive: boolean; sortOrder: number }>; onSaved: () => Promise<void> }) {
  const empty = { name: "", description: "", durationMinutes: "60", price: "", isActive: true, sortOrder: "0" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const save = trpc.admin.services.save.useMutation({ onSuccess: async () => { toast.success("Procedimento salvo."); setOpen(false); setEditingId(null); setForm(empty); await onSaved(); }, onError: error => toast.error(error.message) });
  const edit = (service: typeof services[number]) => { setEditingId(service.id); setForm({ name: service.name, description: service.description || "", durationMinutes: String(service.durationMinutes), price: String(service.priceCents / 100), isActive: service.isActive, sortOrder: String(service.sortOrder) }); setOpen(true); };
  const submit = () => save.mutate({ id: editingId ?? undefined, name: form.name, description: form.description || null, durationMinutes: Number(form.durationMinutes), priceCents: Math.round(Number(form.price || 0) * 100), isActive: form.isActive, sortOrder: Number(form.sortOrder) });
  return <section className="paper-card p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow">Catálogo público</p><h2 className="mt-2 font-serif text-3xl">Procedimentos</h2><p className="mt-1 text-sm text-[#775f55]">A duração define os horários disponíveis para a cliente.</p></div><Button type="button" onClick={() => { setEditingId(null); setForm(empty); setOpen(true); }} className="h-10 rounded-full bg-[#2c201d] text-[#fffaf6] hover:bg-[#44312a]"><Plus className="mr-2 h-4 w-4" /> Novo procedimento</Button></div><div className="mt-6 divide-y divide-[#eee3dc]">{!services.length ? <p className="py-8 text-center text-sm text-[#806a60]">Nenhum procedimento cadastrado ainda.</p> : services.map(service => <div key={service.id} className="flex items-center gap-4 py-4"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#f3e3db] text-[#a56d5d]"><Sparkles className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#3c2b25]">{service.name}</p><p className="mt-1 text-xs text-[#7e675d]">{service.durationMinutes} min · {service.priceCents ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.priceCents / 100) : "Valor sob consulta"}</p></div><Badge className={`border text-[10px] ${service.isActive ? "border-[#c5ddcd] bg-[#e8f3eb] text-[#35664d]" : "border-[#e6d9d3] bg-[#f5efeb] text-[#806c62]"}`}>{service.isActive ? "Ativo" : "Oculto"}</Badge><Button variant="outline" size="sm" onClick={() => edit(service)} className="h-8 rounded-full border-[#decac0] text-xs text-[#694e44]"><Pencil className="mr-1 h-3.5 w-3.5" /> Editar</Button></div>)}</div><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg rounded-2xl bg-[#fffdfa]"><DialogHeader><DialogTitle className="font-serif text-3xl">{editingId ? "Editar procedimento" : "Novo procedimento"}</DialogTitle><DialogDescription>Preencha os detalhes exibidos no agendamento público.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div><Label className="mb-1.5 block text-xs">Nome</Label><Input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Ex.: Volume brasileiro" /></div><div><Label className="mb-1.5 block text-xs">Descrição</Label><Textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Breve descrição do procedimento" /></div><div className="grid gap-3 sm:grid-cols-3"><div><Label className="mb-1.5 block text-xs">Duração (min)</Label><Input type="number" step="15" min="15" value={form.durationMinutes} onChange={event => setForm(current => ({ ...current, durationMinutes: event.target.value }))} /></div><div><Label className="mb-1.5 block text-xs">Valor (R$)</Label><Input type="number" step="0.01" min="0" value={form.price} onChange={event => setForm(current => ({ ...current, price: event.target.value }))} /></div><div><Label className="mb-1.5 block text-xs">Ordem</Label><Input type="number" min="0" value={form.sortOrder} onChange={event => setForm(current => ({ ...current, sortOrder: event.target.value }))} /></div></div><label className="flex items-center gap-2 text-xs text-[#624a42]"><Switch checked={form.isActive} onCheckedChange={checked => setForm(current => ({ ...current, isActive: checked }))} /> Exibir no agendamento público</label></div><div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setOpen(false)} className="rounded-full">Cancelar</Button><Button disabled={save.isPending} onClick={submit} className="rounded-full bg-[#2c201d] text-[#fffaf6] hover:bg-[#44312a]">{save.isPending ? "Salvando..." : "Salvar"}</Button></div></DialogContent></Dialog></section>;
}

function WhatsappSettings({ settings, onSaved }: { settings: { salonName: string; sameDayReminderTime: string; whatsappPhoneNumberId: string | null; whatsappBusinessAccountId: string | null; whatsappEnabled: boolean } | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ salonName: settings?.salonName || "", sameDayReminderTime: settings?.sameDayReminderTime || "09:00", whatsappPhoneNumberId: settings?.whatsappPhoneNumberId || "", whatsappBusinessAccountId: settings?.whatsappBusinessAccountId || "", whatsappEnabled: settings?.whatsappEnabled || false });
  useEffect(() => setForm({ salonName: settings?.salonName || "", sameDayReminderTime: settings?.sameDayReminderTime || "09:00", whatsappPhoneNumberId: settings?.whatsappPhoneNumberId || "", whatsappBusinessAccountId: settings?.whatsappBusinessAccountId || "", whatsappEnabled: settings?.whatsappEnabled || false }), [settings]);
  const save = trpc.admin.settings.save.useMutation({ onSuccess: async () => { toast.success("Configurações do WhatsApp salvas."); await onSaved(); }, onError: error => toast.error(error.message) });
  return <section className="paper-card overflow-hidden"><div className="bg-[#2c201d] px-5 py-6 text-[#fffaf6] sm:px-7"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#ffffff18] text-[#edb5a0]"><MessageCircleMore className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold tracking-[0.2em] text-[#e4ab97]">WHATSAPP BUSINESS</p><h2 className="mt-1 font-serif text-3xl">Canal oficial de mensagens</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#ead6cd]">A conexão é preparada exclusivamente para a Meta Cloud API. O token de acesso é mantido fora do painel, em ambiente seguro do servidor.</p></div></div></div><div className="p-5 sm:p-7"><div className="grid gap-4 md:grid-cols-2"><div><Label className="mb-1.5 block text-xs">Nome do estúdio</Label><Input value={form.salonName} onChange={event => setForm(current => ({ ...current, salonName: event.target.value }))} placeholder="Nome exibido nas mensagens" /></div><div><Label className="mb-1.5 block text-xs">Hora do lembrete no dia</Label><Input type="time" value={form.sameDayReminderTime} onChange={event => setForm(current => ({ ...current, sameDayReminderTime: event.target.value }))} /></div><div><Label className="mb-1.5 block text-xs">ID do número na Meta</Label><Input value={form.whatsappPhoneNumberId} onChange={event => setForm(current => ({ ...current, whatsappPhoneNumberId: event.target.value }))} placeholder="Phone Number ID" /></div><div><Label className="mb-1.5 block text-xs">ID da conta comercial (WABA)</Label><Input value={form.whatsappBusinessAccountId} onChange={event => setForm(current => ({ ...current, whatsappBusinessAccountId: event.target.value }))} placeholder="WhatsApp Business Account ID" /></div></div><label className="mt-5 flex items-start gap-3 rounded-xl bg-[#f8f1ed] p-4 text-xs leading-5 text-[#725e55]"><Switch checked={form.whatsappEnabled} onCheckedChange={checked => setForm(current => ({ ...current, whatsappEnabled: checked }))} /><span><strong className="text-[#573d34]">Ativar quando a Meta Cloud API estiver conectada.</strong><br />A ativação efetiva também requer o token de acesso configurado em segredo no servidor e modelos aprovados na Meta.</span></label><div className="mt-5 flex items-center justify-between gap-4"><div className="flex gap-2 text-xs leading-5 text-[#7c655c]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#a56d5d]" /> Nenhum token ou credencial é exibido neste painel.</div><Button disabled={save.isPending} onClick={() => save.mutate({ salonName: form.salonName, sameDayReminderTime: form.sameDayReminderTime, whatsappPhoneNumberId: form.whatsappPhoneNumberId || null, whatsappBusinessAccountId: form.whatsappBusinessAccountId || null, whatsappEnabled: form.whatsappEnabled })} className="shrink-0 rounded-full bg-[#2c201d] text-[#fffaf6] hover:bg-[#44312a]">{save.isPending ? "Salvando..." : "Salvar conexão"}</Button></div></div></section>;
}

function MessagesPanel({ templates, deliveries, onSaved }: { templates: Array<{ id: number; kind: "confirmation" | "reminder_24h" | "reminder_same_day"; name: string; content: string; metaTemplateName: string | null; languageCode: string; isActive: boolean }>; deliveries: Array<{ id: number; kind: "confirmation" | "reminder_24h" | "reminder_same_day"; status: string; scheduledFor: Date; sentAt: Date | null; attempts: number; lastError: string | null; clientName: string; clientPhone: string; appointmentCode: string }>; onSaved: () => Promise<void> }) {
  return <><PageIntro eyebrow="Comunicação automatizada" title="Mensagens" description="Edite o texto de cada momento da jornada e acompanhe o histórico de entregas." /><div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]"><div className="space-y-5">{(Object.keys(TEMPLATE_PRESETS) as Array<keyof typeof TEMPLATE_PRESETS>).map(kind => <MessageTemplateCard key={kind} kind={kind} initial={templates.find(item => item.kind === kind)} onSaved={onSaved} />)}</div><section className="paper-card h-fit overflow-hidden"><div className="border-b border-[#eee3dc] p-5"><p className="eyebrow">Rastreabilidade</p><h2 className="mt-2 font-serif text-3xl">Entregas recentes</h2></div>{!deliveries.length ? <div className="p-8 text-center"><MessageCircleMore className="mx-auto h-6 w-6 text-[#c99a8b]" /><p className="mt-3 text-sm text-[#806a60]">Nenhuma mensagem programada ainda.</p></div> : <div className="max-h-[650px] divide-y divide-[#eee3dc] overflow-auto">{deliveries.map(item => <article key={item.id} className="p-4"><div className="flex gap-3"><span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${item.status === "sent" ? "bg-[#4d8b65]" : item.status === "failed" ? "bg-[#bb6156]" : "bg-[#d49d43]"}`} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-semibold text-[#45312a]">{item.clientName}</p><span className="text-[10px] text-[#8d756a]">{formatDateTime(item.scheduledFor)}</span></div><p className="mt-1 text-[11px] text-[#826b61]">{item.kind === "confirmation" ? "Confirmação" : item.kind === "reminder_24h" ? "Lembrete 24h" : "Lembrete do dia"} · {item.status}</p>{item.lastError && <p className="mt-1 text-[10px] text-[#a44f45]">{item.lastError}</p>}</div></div></article>)}</div>}</section></div></>;
}

function MessageTemplateCard({ kind, initial, onSaved }: { kind: keyof typeof TEMPLATE_PRESETS; initial?: { id: number; kind: "confirmation" | "reminder_24h" | "reminder_same_day"; name: string; content: string; metaTemplateName: string | null; languageCode: string; isActive: boolean }; onSaved: () => Promise<void> }) {
  const preset = TEMPLATE_PRESETS[kind];
  const [form, setForm] = useState({ name: initial?.name || preset.title, content: initial?.content || preset.content, metaTemplateName: initial?.metaTemplateName || "", languageCode: initial?.languageCode || "pt_BR", isActive: initial?.isActive ?? true });
  useEffect(() => setForm({ name: initial?.name || preset.title, content: initial?.content || preset.content, metaTemplateName: initial?.metaTemplateName || "", languageCode: initial?.languageCode || "pt_BR", isActive: initial?.isActive ?? true }), [initial, preset.content, preset.title]);
  const save = trpc.admin.messages.saveTemplate.useMutation({ onSuccess: async () => { toast.success("Modelo de mensagem salvo."); await onSaved(); }, onError: error => toast.error(error.message) });
  return <section className="paper-card p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{kind === "confirmation" ? "Logo após a reserva" : kind === "reminder_24h" ? "24 horas antes" : "No dia do atendimento"}</p><h2 className="mt-2 font-serif text-3xl">{preset.title}</h2></div><Switch checked={form.isActive} onCheckedChange={checked => setForm(current => ({ ...current, isActive: checked }))} /></div><div className="mt-5 grid gap-4"><div><Label className="mb-1.5 block text-xs">Nome interno</Label><Input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></div><div><Label className="mb-1.5 block text-xs">Texto da mensagem</Label><Textarea value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} className="min-h-28 border-[#e5d7cf] bg-[#fffdfa] text-sm leading-6" /></div><div className="grid gap-3 sm:grid-cols-[1fr_120px]"><div><Label className="mb-1.5 block text-xs">Nome do modelo aprovado na Meta</Label><Input value={form.metaTemplateName} onChange={event => setForm(current => ({ ...current, metaTemplateName: event.target.value }))} placeholder="Ex.: booking_confirmation" /></div><div><Label className="mb-1.5 block text-xs">Idioma</Label><Input value={form.languageCode} onChange={event => setForm(current => ({ ...current, languageCode: event.target.value }))} /></div></div></div><div className="mt-4 rounded-xl bg-[#f8f1ed] p-3 text-[11px] leading-5 text-[#735d54]">Variáveis disponíveis: <strong>{"{{nome_cliente}}"}</strong>, <strong>{"{{profissional}}"}</strong>, <strong>{"{{procedimento}}"}</strong>, <strong>{"{{data}}"}</strong> e <strong>{"{{horario}}"}</strong>.</div><div className="mt-4 flex justify-end"><Button disabled={save.isPending} onClick={() => save.mutate({ kind, ...form, metaTemplateName: form.metaTemplateName || null })} className="rounded-full bg-[#2c201d] text-[#fffaf6] hover:bg-[#44312a]">{save.isPending ? "Salvando..." : "Salvar modelo"}</Button></div></section>;
}

function RescheduleDialog({ appointment, onOpenChange, onSaved }: { appointment: AppointmentView | null; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
  const [date, setDate] = useState(todayInBrazil());
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => { if (appointment) { setDate(formatDate(appointment.startAt)); setTime(null); } }, [appointment]);
  const availabilityInput = useMemo(() => ({ professionalId: appointment?.professionalId ?? 0, serviceId: appointment?.serviceId ?? 0, date }), [appointment?.professionalId, appointment?.serviceId, date]);
  const slots = trpc.booking.availability.useQuery(availabilityInput, { enabled: Boolean(appointment) });
  const reschedule = trpc.admin.appointments.reschedule.useMutation({ onSuccess: async () => { toast.success("Agendamento reagendado."); await onSaved(); }, onError: error => toast.error(error.message) });
  return <Dialog open={Boolean(appointment)} onOpenChange={onOpenChange}><DialogContent className="max-w-lg rounded-2xl bg-[#fffdfa]"><DialogHeader><DialogTitle className="font-serif text-3xl">Reagendar atendimento</DialogTitle><DialogDescription>{appointment ? `${appointment.clientName} · ${appointment.serviceName}` : ""}</DialogDescription></DialogHeader><div className="py-2"><Label className="mb-2 block text-xs">Nova data</Label><Input type="date" min={todayInBrazil()} value={date} onChange={event => { setDate(event.target.value); setTime(null); }} className="h-10 max-w-xs border-[#e5d7cf]" /><div className="mt-5"><p className="mb-2 text-xs font-semibold text-[#634b42]">Horários disponíveis</p>{slots.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#a56d5d]" /> : !slots.data?.length ? <p className="rounded-xl bg-[#f8f0ec] p-4 text-sm text-[#7c655c]">Não há horários livres nesta data.</p> : <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">{slots.data.map(slot => <button type="button" key={slot.time} onClick={() => setTime(slot.time)} className={`rounded-lg border px-2 py-2 text-xs font-semibold ${time === slot.time ? "border-[#a86b59] bg-[#a86b59] text-white" : "border-[#e5d7cf] bg-white text-[#644a42] hover:border-[#c99887]"}`}>{slot.time}</button>)}</div>}</div></div><div className="flex justify-end gap-3"><Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Cancelar</Button><Button disabled={!time || reschedule.isPending || !appointment} onClick={() => appointment && time && reschedule.mutate({ appointmentId: appointment.id, date, time })} className="rounded-full bg-[#2c201d] text-[#fffaf6] hover:bg-[#44312a]">{reschedule.isPending ? "Salvando..." : "Confirmar novo horário"}</Button></div></DialogContent></Dialog>;
}

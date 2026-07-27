import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, CalendarDays, Check, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

function todayInBrazil() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function priceFromCents(value: number) {
  if (!value) return "Valor sob consulta";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

export default function BookingPage() {
  const [, setLocation] = useLocation();
  const catalogQuery = trpc.booking.catalog.useQuery();
  const [professionalId, setProfessionalId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [date, setDate] = useState(todayInBrazil);
  const [time, setTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);

  const availabilityInput = useMemo(
    () => ({ professionalId: professionalId ?? 0, serviceId: serviceId ?? 0, date }),
    [professionalId, serviceId, date],
  );
  const availabilityQuery = trpc.booking.availability.useQuery(availabilityInput, {
    enabled: Boolean(professionalId && serviceId && date),
  });

  const createBooking = trpc.booking.create.useMutation({
    onSuccess: appointment => {
      toast.success("Seu horário foi reservado.");
      setLocation(`/agendamento/${appointment.code}`);
    },
    onError: error => toast.error(error.message),
  });

  const selectedProfessional = catalogQuery.data?.professionals.find(item => item.id === professionalId);
  const selectedService = catalogQuery.data?.services.find(item => item.id === serviceId);
  const canSubmit = Boolean(professionalId && serviceId && date && time && clientName.trim() && phone.trim() && email.trim() && whatsappOptIn);

  const chooseProfessional = (id: number) => {
    setProfessionalId(id);
    setTime(null);
  };
  const chooseService = (id: number) => {
    setServiceId(id);
    setTime(null);
  };
  const chooseDate = (value: string) => {
    setDate(value);
    setTime(null);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!professionalId || !serviceId || !time) {
      toast.error("Escolha uma profissional, um procedimento, a data e o horário.");
      return;
    }
    createBooking.mutate({
      professionalId,
      serviceId,
      date,
      time,
      clientName,
      phone,
      email,
      whatsappOptIn: true,
    });
  };

  return (
    <div className="min-h-screen bg-[#fbf8f5] text-[#281d1a]">
      <header className="container flex items-center justify-between py-6">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-sm font-semibold text-[#684b42] transition hover:text-[#291d19]"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="text-right">
          <p className="font-serif text-2xl leading-none">MY</p>
          <p className="mt-1 text-[8px] font-semibold tracking-[0.25em] text-[#a56d5d]">ESTÉTICA EXCLUSIVA</p>
        </div>
      </header>

      <main className="container pb-16 pt-4 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-2xl">
            <p className="eyebrow flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Seu momento começa aqui</p>
            <h1 className="mt-3 font-serif text-4xl leading-none sm:text-5xl">Reserve seu atendimento.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#735f56]">Leva apenas alguns instantes. Os horários exibidos já consideram a agenda individual de cada profissional.</p>
          </div>

          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Escolhas", Boolean(professionalId && serviceId)],
              ["2", "Horário", Boolean(date && time)],
              ["3", "Seus dados", Boolean(clientName && phone && email)],
            ].map(([number, label, complete]) => (
              <div key={label as string} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${complete ? "border-[#d7ab9b] bg-[#fff8f4]" : "border-[#e9ded7] bg-[#fffdfa]"}`}>
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${complete ? "bg-[#a86b59] text-white" : "bg-[#efe5df] text-[#8a675b]"}`}>
                  {complete ? <Check className="h-3.5 w-3.5" /> : number}
                </span>
                <span className="text-xs font-semibold text-[#5f4840]">{label}</span>
              </div>
            ))}
          </div>

          {catalogQuery.isLoading ? (
            <div className="paper-card grid min-h-72 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#a56d5d]" /></div>
          ) : catalogQuery.isError ? (
            <div className="paper-card p-8 text-center"><p className="font-serif text-2xl">Não foi possível carregar a agenda.</p><p className="mt-2 text-sm text-[#765f57]">Tente novamente em alguns instantes.</p></div>
          ) : !catalogQuery.data?.professionals.length || !catalogQuery.data?.services.length ? (
            <div className="paper-card max-w-2xl p-8 md:p-10">
              <p className="eyebrow">Em preparação</p>
              <h2 className="mt-3 font-serif text-3xl">A agenda está sendo configurada.</h2>
              <p className="mt-3 text-sm leading-6 text-[#735f56]">Assim que a equipe cadastrar as duas profissionais e os procedimentos, os horários serão liberados aqui.</p>
              <Button onClick={() => setLocation("/")} variant="outline" className="mt-6 rounded-full">Voltar ao início</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <section className="paper-card p-5 sm:p-7">
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f4e5de] font-serif text-lg text-[#9b6655]">1</span>
                    <div>
                      <p className="text-sm font-semibold">Escolha sua profissional</p>
                      <p className="mt-1 text-xs leading-5 text-[#806b62]">Cada uma possui a própria agenda e disponibilidade.</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {catalogQuery.data.professionals.map(professional => {
                      const selected = professional.id === professionalId;
                      return (
                        <button
                          type="button"
                          key={professional.id}
                          onClick={() => chooseProfessional(professional.id)}
                          className={`group rounded-2xl border p-4 text-left transition ${selected ? "border-[#b66f5d] bg-[#fff7f2] shadow-[0_8px_22px_rgba(123,73,57,0.08)]" : "border-[#eadfd8] bg-[#fffdfa] hover:border-[#d3aa9a]"}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: professional.color }}>{professional.name.charAt(0).toUpperCase()}</span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#3c2b25]">{professional.name}</p>
                              <p className="mt-0.5 truncate text-xs text-[#8b7167]">{professional.roleLabel}</p>
                            </div>
                            {selected && <Check className="ml-auto h-4 w-4 text-[#a56d5d]" />}
                          </div>
                          {professional.bio && <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#795f56]">{professional.bio}</p>}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="paper-card p-5 sm:p-7">
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f4e5de] font-serif text-lg text-[#9b6655]">2</span>
                    <div>
                      <p className="text-sm font-semibold">Selecione o procedimento</p>
                      <p className="mt-1 text-xs leading-5 text-[#806b62]">A duração define os horários livres que você verá a seguir.</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {catalogQuery.data.services.map(service => {
                      const selected = service.id === serviceId;
                      return (
                        <button
                          type="button"
                          key={service.id}
                          onClick={() => chooseService(service.id)}
                          className={`rounded-2xl border p-4 text-left transition ${selected ? "border-[#b66f5d] bg-[#fff7f2]" : "border-[#eadfd8] bg-[#fffdfa] hover:border-[#d3aa9a]"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[#3c2b25]">{service.name}</p>
                              {service.description && <p className="mt-1 text-xs leading-5 text-[#806b62]">{service.description}</p>}
                            </div>
                            {selected && <Check className="h-4 w-4 shrink-0 text-[#a56d5d]" />}
                          </div>
                          <div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-[#83645a]">
                            <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {service.durationMinutes} min</span>
                            <span>{priceFromCents(service.priceCents)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="paper-card p-5 sm:p-7">
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f4e5de] font-serif text-lg text-[#9b6655]">3</span>
                    <div>
                      <p className="text-sm font-semibold">Encontre seu horário</p>
                      <p className="mt-1 text-xs leading-5 text-[#806b62]">Os horários são atualizados no instante da sua reserva.</p>
                    </div>
                  </div>
                  <div className="mt-5 max-w-sm">
                    <Label htmlFor="booking-date" className="mb-2 block text-xs font-semibold text-[#655047]">Data desejada</Label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#a56d5d]" />
                      <Input id="booking-date" type="date" min={todayInBrazil()} value={date} onChange={event => chooseDate(event.target.value)} className="h-11 border-[#e5d7cf] bg-[#fffdfa] pl-10 text-sm" />
                    </div>
                  </div>
                  {!professionalId || !serviceId ? (
                    <div className="mt-6 rounded-xl bg-[#f7f0ec] p-4 text-sm text-[#7d655b]">Escolha uma profissional e um procedimento para ver os horários disponíveis.</div>
                  ) : availabilityQuery.isLoading ? (
                    <div className="mt-6 flex items-center gap-2 text-sm text-[#7d655b]"><Loader2 className="h-4 w-4 animate-spin" /> Buscando horários livres...</div>
                  ) : availabilityQuery.data?.length ? (
                    <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {availabilityQuery.data.map(slot => {
                        const selected = time === slot.time;
                        return <button key={slot.time} type="button" onClick={() => setTime(slot.time)} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${selected ? "border-[#a86b59] bg-[#a86b59] text-white" : "border-[#eadfd8] bg-[#fffdfa] text-[#624a42] hover:border-[#c99887]"}`}>{slot.time}</button>;
                      })}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-xl bg-[#f7f0ec] p-4 text-sm text-[#7d655b]">Não há horários livres nesta data. Escolha outro dia.</div>
                  )}
                </section>

                <section className="paper-card p-5 sm:p-7">
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f4e5de] font-serif text-lg text-[#9b6655]">4</span>
                    <div>
                      <p className="text-sm font-semibold">Conte um pouco sobre você</p>
                      <p className="mt-1 text-xs leading-5 text-[#806b62]">Usaremos estes dados apenas para organizar seu atendimento e enviar os lembretes.</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Label htmlFor="client-name" className="mb-2 block text-xs font-semibold text-[#655047]">Seu nome</Label><Input id="client-name" required value={clientName} onChange={event => setClientName(event.target.value)} placeholder="Como prefere ser chamada?" className="h-11 border-[#e5d7cf] bg-[#fffdfa]" /></div>
                    <div><Label htmlFor="client-phone" className="mb-2 block text-xs font-semibold text-[#655047]">WhatsApp</Label><Input id="client-phone" required inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="(00) 00000-0000" className="h-11 border-[#e5d7cf] bg-[#fffdfa]" /></div>
                    <div><Label htmlFor="client-email" className="mb-2 block text-xs font-semibold text-[#655047]">E-mail</Label><Input id="client-email" required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@email.com" className="h-11 border-[#e5d7cf] bg-[#fffdfa]" /></div>
                  </div>
                  <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-[#f8f1ed] p-4 text-xs leading-5 text-[#725e55]">
                    <input type="checkbox" checked={whatsappOptIn} onChange={event => setWhatsappOptIn(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[#cfa695] accent-[#a86b59]" />
                    <span>Autorizo o envio de confirmação e lembretes deste atendimento pelo WhatsApp. Posso solicitar a interrupção dessas mensagens a qualquer momento.</span>
                  </label>
                </section>
              </div>

              <aside className="paper-card sticky top-5 p-5 sm:p-6">
                <p className="eyebrow">Resumo</p>
                <h2 className="mt-2 font-serif text-3xl">Seu atendimento</h2>
                <div className="mt-6 space-y-4 border-y border-[#eee3dc] py-5 text-sm">
                  <div><p className="text-[10px] font-semibold tracking-[0.14em] text-[#a56d5d]">PROFISSIONAL</p><p className="mt-1 font-medium text-[#3d2c26]">{selectedProfessional?.name || "A escolher"}</p></div>
                  <div><p className="text-[10px] font-semibold tracking-[0.14em] text-[#a56d5d]">PROCEDIMENTO</p><p className="mt-1 font-medium text-[#3d2c26]">{selectedService?.name || "A escolher"}</p></div>
                  <div className="grid grid-cols-2 gap-3"><div><p className="text-[10px] font-semibold tracking-[0.14em] text-[#a56d5d]">DATA</p><p className="mt-1 font-medium text-[#3d2c26]">{date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00-03:00`)) : "—"}</p></div><div><p className="text-[10px] font-semibold tracking-[0.14em] text-[#a56d5d]">HORÁRIO</p><p className="mt-1 font-medium text-[#3d2c26]">{time || "—"}</p></div></div>
                </div>
                <Button disabled={!canSubmit || createBooking.isPending} type="submit" className="mt-6 h-12 w-full rounded-full bg-[#291d19] text-[#fffaf6] hover:bg-[#422e28] active:scale-[0.98]">
                  {createBooking.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reservando...</> : "Confirmar agendamento"}
                </Button>
                <div className="mt-4 flex gap-2 text-[11px] leading-5 text-[#826b61]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#a56d5d]" /> Seus dados são protegidos e usados somente para o seu atendimento.</div>
              </aside>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

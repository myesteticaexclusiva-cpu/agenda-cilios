import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock3, Loader2, MessageCircleMore, Sparkles } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

export default function BookingConfirmationPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/agendamento/:code");
  const code = params?.code ?? "";
  const query = trpc.booking.confirmation.useQuery({ code }, { enabled: Boolean(code) });

  if (query.isLoading) {
    return <main className="grid min-h-screen place-items-center bg-[#fbf8f5]"><Loader2 className="h-7 w-7 animate-spin text-[#a56d5d]" /></main>;
  }

  if (query.isError || !query.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbf8f5] px-5">
        <section className="paper-card max-w-md p-8 text-center">
          <p className="eyebrow">Não encontrado</p>
          <h1 className="mt-3 font-serif text-4xl">Não localizamos este agendamento.</h1>
          <p className="mt-4 text-sm leading-6 text-[#755f56]">Verifique o código ou faça uma nova reserva.</p>
          <Button onClick={() => setLocation("/agendar")} className="mt-7 rounded-full bg-[#291d19] text-[#fffaf6] hover:bg-[#422e28]">Agendar um horário</Button>
        </section>
      </main>
    );
  }

  const appointment = query.data;
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(appointment.startAt));
  const timeLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(appointment.startAt));

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#fbf8f5] px-5 py-12 text-[#281d1a]">
      <div className="absolute left-[-10rem] top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-[#efd8cc]/60 blur-3xl" />
      <div className="absolute bottom-[-15rem] right-[-10rem] h-[40rem] w-[40rem] rounded-full border border-[#e5cfc4]" />
      <section className="rise-in relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#e5d6ce] bg-[#fffdfa] shadow-[0_30px_80px_rgba(88,57,45,0.13)]">
        <div className="relative overflow-hidden bg-[#2c201d] px-7 py-9 text-[#fff9f4] sm:px-10">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full border border-white/15" />
          <Sparkles className="relative h-5 w-5 text-[#efc0ad]" />
          <p className="relative mt-8 font-serif text-4xl leading-none">Seu horário está reservado.</p>
          <p className="relative mt-3 max-w-sm text-sm leading-6 text-[#e8d4cc]">Em breve, você receberá os detalhes pelo WhatsApp cadastrado.</p>
        </div>
        <div className="p-7 sm:p-10">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f4e3da] text-[#a56d5d]"><CheckCircle2 className="h-6 w-6" /></span>
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[#a56d5d]">CÓDIGO DA RESERVA</p>
              <p className="mt-1 font-serif text-3xl tracking-wide">{appointment.code}</p>
            </div>
          </div>

          <dl className="mt-7 grid gap-4 border-y border-[#eee3dc] py-6 sm:grid-cols-2">
            <div><dt className="text-[10px] font-semibold tracking-[0.16em] text-[#a56d5d]">PROFISSIONAL</dt><dd className="mt-1 text-sm font-semibold text-[#382722]">{appointment.professional.name}</dd></div>
            <div><dt className="text-[10px] font-semibold tracking-[0.16em] text-[#a56d5d]">PROCEDIMENTO</dt><dd className="mt-1 text-sm font-semibold text-[#382722]">{appointment.service.name}</dd></div>
            <div><dt className="text-[10px] font-semibold tracking-[0.16em] text-[#a56d5d]">VALOR</dt><dd className="mt-1 text-sm font-semibold text-[#382722]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(appointment.service.priceCents / 100)}</dd></div>
            <div><dt className="text-[10px] font-semibold tracking-[0.16em] text-[#a56d5d]">DURAÇÃO</dt><dd className="mt-1 text-sm font-semibold text-[#382722]">{appointment.service.durationMinutes} minutos</dd></div>
            <div className="sm:col-span-2"><dt className="text-[10px] font-semibold tracking-[0.16em] text-[#a56d5d]">DATA E HORÁRIO</dt><dd className="mt-1 flex items-center gap-2 text-sm font-semibold capitalize text-[#382722]"><Clock3 className="h-4 w-4 text-[#a56d5d]" /> {dateLabel}, às {timeLabel}</dd></div>
          </dl>

          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#f8f0ec] p-4 text-xs leading-5 text-[#755e55]">
            <MessageCircleMore className="mt-0.5 h-4 w-4 shrink-0 text-[#a56d5d]" />
            <p>Guarde este código para referência. Caso precise alterar ou cancelar, entre em contato com o estúdio.</p>
          </div>
          <div className="mt-7 flex gap-3"><Button onClick={() => setLocation("/")} variant="outline" className="h-11 flex-1 rounded-full border-[#d9c3b8] text-[#5d433a] hover:bg-[#f8f0ec]">Voltar</Button><Button onClick={() => setLocation(`/pagamento?code=${appointment?.code}`)} className="h-11 flex-1 rounded-full bg-[#2c201d] text-[#fffaf6] hover:bg-[#44312a]">Prosseguir ao pagamento</Button></div>
        </div>
      </section>
    </main>
  );
}

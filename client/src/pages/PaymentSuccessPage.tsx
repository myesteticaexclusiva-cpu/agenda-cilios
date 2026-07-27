import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Download, Loader2, AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function PaymentSuccessPage() {
  const [location, navigate] = useLocation();

  const params = new URLSearchParams(location.split("?")[1] || "");
  const sessionId = params.get("session_id");

  const confirmPaymentQuery = trpc.booking.confirmPayment.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId },
  );

  const { data, isLoading, error } = confirmPaymentQuery;

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf6f2]">
        <div className="text-center max-w-md">
          <AlertCircle className="h-8 w-8 text-[#a65349] mx-auto mb-4" />
          <p className="text-sm text-[#a65349] mb-4">Sessão de pagamento não encontrada.</p>
          <Button onClick={() => navigate("/")} className="rounded-full bg-[#2c201d] text-[#fffaf6] hover:bg-[#44312a]">
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf6f2]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#a56d5d]" />
          <p className="text-sm text-[#7b655c]">Confirmando seu pagamento...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf6f2]">
        <div className="text-center max-w-md">
          <AlertCircle className="h-8 w-8 text-[#a65349] mx-auto mb-4" />
          <p className="text-sm text-[#a65349] mb-4">Erro ao confirmar o pagamento. Tente novamente.</p>
          <Button onClick={() => navigate("/")} className="rounded-full bg-[#2c201d] text-[#fffaf6] hover:bg-[#44312a]">
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  const isPaid = data.paymentStatus === "paid";
  const amountFormatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: data.currency?.toUpperCase() || "BRL",
  }).format((data.amountTotal || 0) / 100);

  const dateLabel = new Date(data.appointment.startAt).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const timeLabel = new Date(data.appointment.startAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#faf6f2] to-[#f3e8e0] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Icon */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[#e8f3eb] mb-4">
            <CheckCircle2 className="h-8 w-8 text-[#35664d]" />
          </div>
          <h1 className="font-serif text-4xl text-[#2c201d] mb-2">Pagamento confirmado!</h1>
          <p className="text-[#7b655c]">Seu agendamento foi confirmado com sucesso</p>
        </div>

        {/* Appointment Summary */}
        <Card className="mb-8 border-[#e5d7cf] bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-[#9b6758] tracking-[0.14em]">CÓDIGO DO AGENDAMENTO</p>
              <p className="mt-1 font-serif text-2xl text-[#2c201d]">{data.appointment.code}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9b6758] tracking-[0.14em]">STATUS DO PAGAMENTO</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#35664d]">
                <CheckCircle2 className="h-4 w-4" />
                {isPaid ? "Pago" : "Pendente"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9b6758] tracking-[0.14em]">PROFISSIONAL</p>
              <p className="mt-1 text-sm text-[#5f4740]">{data.appointment.professional.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9b6758] tracking-[0.14em]">PROCEDIMENTO</p>
              <p className="mt-1 text-sm text-[#5f4740]">{data.appointment.service.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9b6758] tracking-[0.14em]">DATA E HORA</p>
              <p className="mt-1 text-sm text-[#5f4740]">
                {dateLabel} às {timeLabel}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9b6758] tracking-[0.14em]">VALOR PAGO</p>
              <p className="mt-1 text-sm font-semibold text-[#2c201d]">{amountFormatted}</p>
            </div>
          </div>
        </Card>

        {/* Next Steps */}
        <div className="mb-8 space-y-4">
          <h2 className="font-serif text-2xl text-[#2c201d]">Próximos passos</h2>
          <div className="space-y-3">
            <div className="flex gap-3 p-4 rounded-xl bg-white border border-[#e5d7cf]">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#a56d5d] text-white text-xs font-semibold flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-semibold text-[#2c201d]">Confirmação por WhatsApp</p>
                <p className="text-sm text-[#7b655c] mt-1">Você receberá uma mensagem de confirmação no número informado.</p>
              </div>
            </div>
            <div className="flex gap-3 p-4 rounded-xl bg-white border border-[#e5d7cf]">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#a56d5d] text-white text-xs font-semibold flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-semibold text-[#2c201d]">Lembrete 24 horas antes</p>
                <p className="text-sm text-[#7b655c] mt-1">Receberá um lembrete no dia anterior ao seu atendimento.</p>
              </div>
            </div>
            <div className="flex gap-3 p-4 rounded-xl bg-white border border-[#e5d7cf]">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#a56d5d] text-white text-xs font-semibold flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-semibold text-[#2c201d]">Lembrete no dia do atendimento</p>
                <p className="text-sm text-[#7b655c] mt-1">Receberá um último lembrete no dia do seu agendamento.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Comprovante */}
        <Card className="mb-8 border-[#e5d7cf] bg-[#f8f1ed] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2c201d]">Comprovante de pagamento</p>
              <p className="text-xs text-[#7b655c] mt-1">Código: {data.appointment.code}</p>
            </div>
            <Button variant="outline" className="rounded-full border-[#d9c3b8] text-[#5d433a] hover:bg-white">
              <Download className="mr-2 h-4 w-4" />
              Baixar
            </Button>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={() => navigate("/")} variant="outline" className="flex-1 h-12 rounded-full border-[#d9c3b8] text-[#5d433a] hover:bg-[#f8f0ec]">
            Voltar ao início
          </Button>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl bg-[#f8f1ed] border border-[#e5d7cf]">
          <p className="text-xs text-[#7b655c] leading-relaxed">
            <strong className="text-[#573d34]">Dúvidas?</strong> Se tiver qualquer dúvida sobre seu agendamento ou pagamento, entre em contato conosco através do WhatsApp ou visite nosso estúdio.
          </p>
        </div>
      </div>
    </div>
  );
}

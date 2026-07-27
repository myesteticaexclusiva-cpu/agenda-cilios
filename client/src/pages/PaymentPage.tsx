import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { CreditCard, Loader2, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function PaymentPage() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<"card" | "pix">("pix");
  const [isProcessing, setIsProcessing] = useState(false);

  // Extrair código do agendamento da URL
  const params = new URLSearchParams(location.split("?")[1] || "");
  const appointmentCode = params.get("code");

  const appointmentQuery = trpc.booking.confirmation.useQuery(
    { code: appointmentCode || "" },
    { enabled: !!appointmentCode },
  );

  const appointment = appointmentQuery.data;
  const createPaymentIntent = trpc.booking.createPaymentIntent.useMutation();

  if (!appointmentCode || appointmentQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf6f2]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#a56d5d]" />
          <p className="text-sm text-[#7b655c]">Carregando agendamento...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf6f2]">
        <div className="text-center">
          <p className="text-sm text-[#a65349]">Agendamento não encontrado.</p>
          <Button onClick={() => navigate("/")} className="mt-4 rounded-full bg-[#2c201d] text-[#fffaf6] hover:bg-[#44312a]">
            Voltar ao agendamento
          </Button>
        </div>
      </div>
    );
  }

  // Calcular valores
  const basePriceCents = appointment.service.priceCents;
  const pixPriceCents = basePriceCents;
  const cardFeesCents = Math.round(basePriceCents * 0.029) + 30;
  const cardPriceCents = basePriceCents + cardFeesCents;

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      const result = await createPaymentIntent.mutateAsync({
        appointmentCode: appointment.code,
        paymentMethod,
      });

      if (result.stripeUrl) {
        window.location.href = result.stripeUrl;
      }
    } catch (error) {
      console.error("Erro no pagamento:", error);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#faf6f2] to-[#f3e8e0] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl text-[#2c201d] mb-2">Confirmar pagamento</h1>
          <p className="text-[#7b655c]">Escolha a forma de pagamento para seu agendamento</p>
        </div>

        {/* Resumo do agendamento */}
        <Card className="mb-8 border-[#e5d7cf] bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-[#9b6758] tracking-[0.14em]">PROFISSIONAL</p>
              <p className="mt-1 font-serif text-2xl text-[#2c201d]">{appointment.professional.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9b6758] tracking-[0.14em]">PROCEDIMENTO</p>
              <p className="mt-1 font-serif text-2xl text-[#2c201d]">{appointment.service.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9b6758] tracking-[0.14em]">DATA E HORA</p>
              <p className="mt-1 text-sm text-[#5f4740]">
                {new Date(appointment.startAt).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}{" "}
                às{" "}
                {new Date(appointment.startAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9b6758] tracking-[0.14em]">DURAÇÃO</p>
              <p className="mt-1 text-sm text-[#5f4740]">{appointment.service.durationMinutes} minutos</p>
            </div>
          </div>
        </Card>

        {/* Seleção de método de pagamento */}
        <div className="mb-8">
          <h2 className="font-serif text-2xl text-[#2c201d] mb-4">Forma de pagamento</h2>
          <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "card" | "pix")}>
            <div className="space-y-3">
              {/* PIX */}
              <label className="flex items-start gap-4 p-4 rounded-xl border-2 border-[#e5d7cf] bg-white cursor-pointer hover:border-[#d4c3b8] transition-colors" style={{ borderColor: paymentMethod === "pix" ? "#a56d5d" : "#e5d7cf" }}>
                <RadioGroupItem value="pix" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <QrCode className="h-5 w-5 text-[#a56d5d]" />
                    <p className="font-semibold text-[#2c201d]">PIX</p>
                    <span className="ml-auto text-xs font-semibold text-[#35664d] bg-[#e8f3eb] px-2 py-1 rounded-full">Sem taxa</span>
                  </div>
                  <p className="text-sm text-[#7b655c] mb-2">Pagamento instantâneo via PIX</p>
                  <p className="text-2xl font-serif text-[#2c201d]">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(pixPriceCents / 100)}
                  </p>
                </div>
              </label>

              {/* Cartão de crédito */}
              <label className="flex items-start gap-4 p-4 rounded-xl border-2 border-[#e5d7cf] bg-white cursor-pointer hover:border-[#d4c3b8] transition-colors" style={{ borderColor: paymentMethod === "card" ? "#a56d5d" : "#e5d7cf" }}>
                <RadioGroupItem value="card" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-5 w-5 text-[#a56d5d]" />
                    <p className="font-semibold text-[#2c201d]">Cartão de crédito</p>
                  </div>
                  <p className="text-sm text-[#7b655c] mb-2">
                    Parcelado em até 12x • Taxa Stripe: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cardFeesCents / 100)}
                  </p>
                  <p className="text-2xl font-serif text-[#2c201d]">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cardPriceCents / 100)}
                  </p>
                </div>
              </label>
            </div>
          </RadioGroup>
        </div>

        {/* Botão de pagamento */}
        <Button
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full h-12 rounded-full bg-[#2c201d] text-[#fffaf6] font-semibold hover:bg-[#44312a] transition-colors"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            `Pagar ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((paymentMethod === "pix" ? pixPriceCents : cardPriceCents) / 100)}`
          )}
        </Button>

        {/* Informações de segurança */}
        <div className="mt-8 p-4 rounded-xl bg-[#f8f1ed] border border-[#e5d7cf]">
          <p className="text-xs text-[#7b655c] leading-relaxed">
            <strong className="text-[#573d34]">Segurança garantida:</strong> Seus dados de pagamento são processados diretamente pelo Stripe, a plataforma mais segura do Brasil. Nós nunca armazenamos informações do seu cartão.
          </p>
        </div>
      </div>
    </div>
  );
}

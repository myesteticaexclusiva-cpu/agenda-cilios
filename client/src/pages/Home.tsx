import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen overflow-hidden bg-[#fbf8f5] text-[#281d1a]">
      <header className="container relative z-10 flex items-center justify-between py-6 md:py-8">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b87362]"
          aria-label="Ir para a página inicial"
        >
          <span className="block font-serif text-3xl leading-none tracking-wide">MY</span>
          <span className="mt-1 block text-[9px] font-semibold tracking-[0.28em] text-[#a56d5d]">ESTÉTICA EXCLUSIVA</span>
        </button>
        <button
          type="button"
          onClick={() => setLocation("/admin")}
          className="rounded-full border border-[#e2d3cb] px-4 py-2 text-xs font-semibold text-[#634b43] transition hover:border-[#b87362] hover:text-[#7f4f43]"
        >
          Área da equipe
        </button>
      </header>

      <main>
        <section className="container relative grid min-h-[600px] items-center gap-12 pb-16 pt-12 md:grid-cols-[1.08fr_0.92fr] md:pb-24 md:pt-16">
          <div className="absolute -left-28 top-8 -z-0 h-72 w-72 rounded-full bg-[#efd8cc]/55 blur-3xl" />
          <div className="absolute right-[-8%] top-[-8%] -z-0 h-96 w-96 rounded-full border border-[#e7cfc3]" />
          <div className="relative z-10 rise-in">
            <p className="eyebrow flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Tempo reservado para você</p>
            <h1 className="mt-5 max-w-2xl font-serif text-5xl leading-[0.95] tracking-[-0.025em] sm:text-6xl lg:text-7xl">
              Seu olhar merece um <em className="font-serif font-medium text-[#9b6758]">ritual</em> só seu.
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-[#705f58] sm:text-base">
              Escolha sua profissional, o procedimento e o melhor horário. Uma experiência de agendamento simples, acolhedora e pensada nos mínimos detalhes.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => setLocation("/agendar")}
                size="lg"
                className="h-13 rounded-full bg-[#2a1e1b] px-7 text-sm text-[#fffaf6] shadow-[0_16px_30px_rgba(72,42,35,0.18)] transition hover:bg-[#412d27] active:scale-[0.98]"
              >
                Agendar meu horário <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}
                className="h-13 rounded-full px-5 text-sm font-semibold text-[#6c4d43] transition hover:text-[#2a1e1b]"
              >
                Como funciona
              </button>
            </div>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-[440px] rise-in" style={{ animationDelay: "80ms" }}>
            <div className="relative overflow-hidden rounded-[2rem] border border-[#e3d1c7] bg-[#eadbd2] p-3 shadow-[0_28px_70px_rgba(97,57,45,0.16)]">
              <div className="relative min-h-[430px] overflow-hidden rounded-[1.45rem] bg-[#b47c69] p-7 text-[#fffaf7]">
                <div className="absolute -right-16 top-10 h-64 w-64 rounded-full border border-white/30" />
                <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[#dba18c]/50 blur-2xl" />
                <div className="relative flex h-full min-h-[374px] flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full border border-white/30 px-3 py-1 text-[10px] font-semibold tracking-[0.18em]">SEU HORÁRIO</span>
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <p className="mt-11 font-serif text-4xl leading-[0.95]">Beleza que respeita o seu tempo.</p>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-[#f9ded1] text-[#9b6251]"><Clock3 className="h-5 w-5" /></div>
                      <div>
                        <p className="text-xs font-semibold">Confirmação pelo WhatsApp</p>
                        <p className="mt-0.5 text-[11px] text-[#fff1eb]/80">Lembretes antes do seu atendimento</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-7 hidden rounded-2xl border border-[#ebddd5] bg-[#fffdfa] px-4 py-3 shadow-lg sm:flex sm:items-center sm:gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#a86b59]" />
              <span className="text-xs font-semibold text-[#624a42]">Horários atualizados em tempo real</span>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="border-y border-[#eadfd8] bg-[#fffdfa] py-14 md:py-18">
          <div className="container">
            <div className="max-w-xl">
              <p className="eyebrow">Uma escolha por vez</p>
              <h2 className="mt-3 font-serif text-4xl leading-none">Agendar é leve e intuitivo.</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                ["01", "Escolha a profissional", "Conheça as duas agendas disponíveis e selecione quem vai cuidar de você."],
                ["02", "Defina seu horário", "Veja somente horários livres, organizados conforme o procedimento escolhido."],
                ["03", "Receba a confirmação", "Seus dados ficam registrados e você recebe os detalhes no WhatsApp."],
              ].map(([number, title, description]) => (
                <article key={number} className="rounded-2xl border border-[#eee3dc] bg-[#fcf8f5] p-6">
                  <p className="font-serif text-3xl text-[#bf8876]">{number}</p>
                  <h3 className="mt-8 text-base font-semibold text-[#3a2924]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#745f56]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container grid gap-8 py-16 md:grid-cols-[1fr_auto] md:items-center md:py-20">
          <div>
            <p className="eyebrow">Cuidado e privacidade</p>
            <h2 className="mt-3 font-serif text-4xl leading-none">Você escolhe. Nós cuidamos do resto.</h2>
          </div>
          <div className="flex max-w-md items-start gap-3 rounded-2xl border border-[#eadfd8] bg-[#fffdfa] p-5 text-sm leading-6 text-[#715d55]">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#a56d5d]" />
            <p>Seus dados são usados apenas para organizar seu atendimento e enviar informações relacionadas ao seu agendamento.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#eadfd8] py-7">
        <div className="container flex flex-col gap-2 text-xs text-[#89746b] sm:flex-row sm:items-center sm:justify-between">
          <span>MY Estética Exclusiva</span>
          <span>Agendamentos online com cuidado.</span>
        </div>
      </footer>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Orb } from "@/components/Orb";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const STEPS = [
  { title: "Hi. I'm Arelo.", body: "I'm going to look at your last few weeks of email and build a picture of what matters to you.", cta: "Let's begin" },
  { title: "Connect your Gmail", body: "I read your email to find what needs your attention. I never send, delete, or share anything.", cta: "Connect Gmail" },
  { title: "Reading your inbox…", body: "Finding patterns. Building your profile. This takes about 30 seconds.", cta: "Continue" },
  { title: "Here's what I learned", body: "Most of your urgent threads come from work. You tend to reply in the morning. You go quiet after 9pm — I'll respect that.", cta: "Looks right" },
  { title: "Found a few things for you", body: "Six items need your attention. Two are time-sensitive. The rest can wait.", cta: "Show me" },
  { title: "You're all set.", body: "I'll be on the right side of every page. Just say hi any time.", cta: "Go to my dashboard" },
];

function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const s = STEPS[step];

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else navigate({ to: "/dashboard" });
  };

  return (
    <main className="login-bg min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md fade-in" key={step}>
        <div className="flex justify-center mb-8">
          <Orb size="large" />
        </div>
        <h1 className="font-display text-white text-[36px] leading-tight mb-4">
          {s.title}
        </h1>
        <p className="text-white/70 text-[15px] leading-relaxed mb-10">
          {s.body}
        </p>
        <button
          onClick={next}
          className="px-8 py-3 rounded-2xl bg-teal text-white font-ui font-semibold hover:bg-teal-dark transition shadow-md"
        >
          {s.cta}
        </button>
        <div className="mt-10 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step ? "w-8 bg-teal" : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

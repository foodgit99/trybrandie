import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Megaphone,
  BookOpen,
  MessageSquare,
  TrendingUp,
  Zap,
  Video,
  Film,
  Users,
  Mic,
  Layers,
  Play,
  Clock,
  Flame,
  Heart,
  Target,
} from "lucide-react";

export interface VideoIntent {
  content_goal: string;
  format_style: string;
  platform: string;
  length: number;
  energy: string;
  cta_style: string;
  script_input: string;
}

const CONTENT_GOALS = [
  { id: "promote", label: "Promote a product", icon: Megaphone, desc: "Drive sales or signups" },
  { id: "explain", label: "Explain something", icon: BookOpen, desc: "Educate your audience" },
  { id: "update", label: "Share an update", icon: MessageSquare, desc: "News or announcement" },
  { id: "story", label: "Tell a story", icon: Heart, desc: "Build emotional connection" },
  { id: "trend", label: "Jump on a trend", icon: TrendingUp, desc: "Ride cultural momentum" },
];

const FORMAT_STYLES = [
  { id: "ad", label: "Ad (conversion)", icon: Target, desc: "Direct-response creative" },
  { id: "explainer", label: "Explainer", icon: BookOpen, desc: "Educational walkthrough" },
  { id: "testimonial", label: "Testimonial", icon: Mic, desc: "Social proof driven" },
  { id: "talking_head", label: "Talking-head", icon: Users, desc: "Personal, direct format" },
  { id: "ugc", label: "UGC / TikTok-style", icon: Zap, desc: "Raw, authentic energy" },
  { id: "slideshow", label: "Motion Graphics", icon: Layers, desc: "Polished visual sequence" },
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram", color: "bg-gradient-to-br from-purple-500 to-pink-500" },
  { id: "tiktok", label: "TikTok", color: "bg-foreground" },
  { id: "linkedin", label: "LinkedIn", color: "bg-blue-600" },
];

const LENGTHS = [
  { value: 15, label: "15s", desc: "Quick hook" },
  { value: 30, label: "30s", desc: "Sweet spot" },
  { value: 60, label: "60s", desc: "Deep story" },
];

const ENERGIES = [
  { id: "calm", label: "Calm", icon: "🌿" },
  { id: "bold", label: "Bold", icon: "⚡" },
  { id: "premium", label: "Premium", icon: "✨" },
  { id: "playful", label: "Playful", icon: "🎉" },
];

const CTA_STYLES = [
  { id: "soft", label: "Soft", desc: "Subtle nudge" },
  { id: "direct", label: "Direct", desc: "Clear action" },
];

interface Props {
  onComplete: (intent: VideoIntent) => void;
  onCancel: () => void;
  initialPrompt?: string;
}

const VideoGuidedFlow = ({ onComplete, onCancel, initialPrompt }: Props) => {
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<VideoIntent>({
    content_goal: "",
    format_style: "",
    platform: "instagram",
    length: 30,
    energy: "bold",
    cta_style: "direct",
    script_input: initialPrompt || "",
  });

  const steps = [
    { title: "Content Goal", subtitle: "What do you want to achieve?" },
    { title: "Format Style", subtitle: "How should it look?" },
    { title: "Platform", subtitle: "Where will it live?" },
    { title: "Controls", subtitle: "Fine-tune the output" },
    { title: "Your Message", subtitle: "What should this video say?" },
  ];

  const canProceed = () => {
    switch (step) {
      case 0: return !!intent.content_goal;
      case 1: return !!intent.format_style;
      case 2: return !!intent.platform;
      case 3: return true;
      case 4: return intent.script_input.trim().length > 0;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else onComplete(intent);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <Video className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Video Studio</span>
        </div>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="mt-2">
          <h2 className="text-lg font-semibold font-serif">{steps[step].title}</h2>
          <p className="text-xs text-muted-foreground">{steps[step].subtitle}</p>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {step === 0 && (
              <div className="grid gap-2">
                {CONTENT_GOALS.map((goal) => {
                  const Icon = goal.icon;
                  const selected = intent.content_goal === goal.id;
                  return (
                    <button
                      key={goal.id}
                      onClick={() => setIntent({ ...intent, content_goal: goal.id })}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{goal.label}</p>
                        <p className="text-xs text-muted-foreground">{goal.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-2 gap-2">
                {FORMAT_STYLES.map((fmt) => {
                  const Icon = fmt.icon;
                  const selected = intent.format_style === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => setIntent({ ...intent, format_style: fmt.id })}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-xs font-medium text-center">{fmt.label}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-2">
                {PLATFORMS.map((p) => {
                  const selected = intent.platform === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setIntent({ ...intent, platform: p.id })}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${p.color} flex items-center justify-center`}>
                        <Play className="h-3.5 w-3.5 text-white" />
                      </div>
                      <p className="text-sm font-medium">{p.label}</p>
                      {selected && <Badge className="ml-auto text-[10px]">Selected</Badge>}
                    </button>
                  );
                })}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                {/* Length */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Clock className="h-3 w-3" /> Length
                  </label>
                  <div className="flex gap-2">
                    {LENGTHS.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => setIntent({ ...intent, length: l.value })}
                        className={`flex-1 p-3 rounded-xl border text-center transition-all ${
                          intent.length === l.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <p className="text-sm font-semibold">{l.label}</p>
                        <p className="text-[10px] text-muted-foreground">{l.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Energy */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Flame className="h-3 w-3" /> Energy
                  </label>
                  <div className="flex gap-2">
                    {ENERGIES.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setIntent({ ...intent, energy: e.id })}
                        className={`flex-1 p-2.5 rounded-xl border text-center transition-all ${
                          intent.energy === e.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <span className="text-lg">{e.icon}</span>
                        <p className="text-[10px] font-medium mt-0.5">{e.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Target className="h-3 w-3" /> Call-to-Action
                  </label>
                  <div className="flex gap-2">
                    {CTA_STYLES.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setIntent({ ...intent, cta_style: c.id })}
                        className={`flex-1 p-3 rounded-xl border text-center transition-all ${
                          intent.cta_style === c.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-[10px] text-muted-foreground">{c.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <Textarea
                  value={intent.script_input}
                  onChange={(e) => setIntent({ ...intent, script_input: e.target.value })}
                  placeholder="What do you want this video to say? Describe the key message, product, or story..."
                  className="min-h-[120px] text-sm"
                  autoFocus
                />
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Quick assists:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Add a strong hook", "Include social proof", "End with urgency"].map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          setIntent({
                            ...intent,
                            script_input: intent.script_input + (intent.script_input ? "\n" : "") + s,
                          })
                        }
                        className="text-[10px] px-2 py-1 rounded-full border border-border hover:bg-muted transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={step === 0 ? onCancel : () => setStep(step - 1)}
          className="gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        <Button
          size="sm"
          onClick={handleNext}
          disabled={!canProceed()}
          className="gap-1.5"
        >
          {step === steps.length - 1 ? (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Generate Video
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default VideoGuidedFlow;

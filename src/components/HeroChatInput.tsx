import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface HeroChatInputProps {
  disabled?: boolean;
}

const EXAMPLE_PROMPTS = [
  "A bold Instagram promo for a coffee shop launch",
  "Minimalist story post announcing a new product line",
  "Eye-catching sale graphic with modern typography",
];

const HeroChatInput = ({ disabled }: HeroChatInputProps) => {
  const [input, setInput] = useState("");
  const navigate = useNavigate();

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    // Navigate to auth with the prompt stored so they can continue after login
    navigate(`/auth?prompt=${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="rounded-2xl border border-border bg-card shadow-lg p-3 sm:p-4 space-y-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a social media design…"
          className="w-full bg-transparent text-sm sm:text-base placeholder:text-muted-foreground/50 focus:outline-none"
          disabled={disabled}
          maxLength={2000}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Powered by AI</span>
          </div>
          <button
            className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      {/* Example prompts */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="flex flex-wrap justify-center gap-2"
      >
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => setInput(prompt)}
            className="text-[11px] sm:text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/30 transition-all"
          >
            <Sparkles className="h-3 w-3 inline mr-1 opacity-50" />
            {prompt}
          </button>
        ))}
      </motion.div>
    </div>
  );
};

export default HeroChatInput;

import { useMemo } from "react";
import { motion } from "framer-motion";
import { getUpcomingHolidays, getCurrentSeason } from "@/lib/holidayCalendar";

interface ContentIdea {
  id: string;
  title: string;
  prompt: string;
  status: string;
}

interface ChatSuggestionsProps {
  brandName?: string;
  brandVibe?: string | null;
  brandDescription?: string | null;
  onSelect: (text: string) => void;
  hasMessages: boolean;
  hasImage: boolean;
  contentIdeas?: ContentIdea[];
}

const ChatSuggestions = ({
  brandName,
  brandVibe,
  brandDescription,
  onSelect,
  hasMessages,
  hasImage,
  contentIdeas,
}: ChatSuggestionsProps) => {
  const suggestions = useMemo(() => {
    const season = getCurrentSeason();
    const upcoming = getUpcomingHolidays(14);
    const name = brandName || "my brand";

    // Pick a real upcoming event name, or fall back to season
    const eventName = upcoming.length > 0
      ? upcoming[Math.floor(Math.random() * Math.min(upcoming.length, 3))].name
      : `${season.toLowerCase()} season`;

    if (hasImage) {
      return [
        "Make the headline bolder",
        "Try a different colour palette",
        "Add a stronger CTA",
        "Make it more minimal",
      ];
    }

    if (hasMessages) {
      return [
        "Try a completely different layout",
        `Create a ${eventName} version`,
        "Make it more eye-catching",
        "Generate an alternative variation",
      ];
    }

    // Use content ideas if available (filter to suggested/scheduled only)
    const availableIdeas = contentIdeas?.filter(
      (idea) => idea.status === "suggested" || idea.status === "scheduled"
    );
    if (availableIdeas && availableIdeas.length > 0) {
      const shuffled = [...availableIdeas].sort(() => 0.5, Math.random());
      return shuffled.slice(0, 4).map((idea) => idea.prompt);
    }

    // Fallback, brand + real upcoming events aware
    const pool: string[] = [];

    // Add event-specific suggestions
    for (const h of upcoming.slice(0, 2)) {
      pool.push(`Create a ${h.name} promo for ${name}`);
      pool.push(`Design a ${h.name} social media graphic`);
    }

    // Always add some seasonal + brand suggestions
    pool.push(
      `Design a ${season.toLowerCase()} announcement post`,
      `Make an Instagram post showcasing ${name}`,
      `Design a limited-time offer graphic`,
      `Create a brand awareness post for ${name}`,
    );

    if (brandVibe) {
      pool.push(`Create a ${brandVibe} themed post for ${name}`);
    }
    if (brandDescription) {
      pool.push(`Design a post highlighting what ${name} does best`);
    }

    const shuffled = pool.sort(() => 0.5, Math.random());
    return shuffled.slice(0, 4);
  }, [brandName, brandVibe, brandDescription, hasMessages, hasImage, contentIdeas]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="flex flex-col gap-1.5 w-full"
    >
      {suggestions.map((text, i) => (
        <motion.button
          key={text}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.05 * i }}
          onClick={() => onSelect(text)}
          className="w-full px-3 py-2 text-[9.5px] rounded-xl border border-border/60 text-muted-foreground/70 
            hover:text-foreground hover:border-border hover:bg-muted/40 
            transition-all duration-200 cursor-pointer leading-tight line-clamp-3 text-left"
        >
          {text}
        </motion.button>
      ))}
    </motion.div>
  );
};

export default ChatSuggestions;

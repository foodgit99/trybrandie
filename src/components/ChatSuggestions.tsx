import { useMemo } from "react";
import { motion } from "framer-motion";
import { getUpcomingHolidays, getCurrentSeason } from "@/lib/holidayCalendar";

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
    const { season, events } = getSeasonalContext();
    const name = brandName || "my brand";
    const event = events[Math.floor(Math.random() * events.length)];

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
        `Create a ${event} version`,
        "Make it more eye-catching",
        "Generate an alternative variation",
      ];
    }

    // Use content ideas if available (filter to suggested/scheduled only)
    const availableIdeas = contentIdeas?.filter(
      (idea) => idea.status === "suggested" || idea.status === "scheduled"
    );
    if (availableIdeas && availableIdeas.length > 0) {
      const shuffled = [...availableIdeas].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 4).map((idea) => idea.prompt);
    }

    // Fallback — brand + season aware
    const pool = [
      `Create a ${event} promo for ${name}`,
      `Design a ${season.toLowerCase()} announcement post`,
      `Make an Instagram post showcasing ${name}`,
      `Design a limited-time offer graphic`,
      `Create a brand awareness post for ${name}`,
      `Design a ${event} social media graphic`,
    ];

    if (brandVibe) {
      pool.push(`Create a ${brandVibe} themed post for ${name}`);
    }
    if (brandDescription) {
      pool.push(`Design a post highlighting what ${name} does best`);
    }

    const shuffled = pool.sort(() => 0.5 - Math.random());
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

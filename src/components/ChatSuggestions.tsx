import { useMemo } from "react";
import { motion } from "framer-motion";

interface ChatSuggestionsProps {
  brandName?: string;
  brandVibe?: string | null;
  brandDescription?: string | null;
  onSelect: (text: string) => void;
  hasMessages: boolean;
  hasImage: boolean;
}

const getSeasonalContext = () => {
  const month = new Date().getMonth();
  const seasonMap: Record<number, { season: string; events: string[] }> = {
    0: { season: "Winter", events: ["New Year", "January sale"] },
    1: { season: "Winter", events: ["Valentine's Day", "February promo"] },
    2: { season: "Spring", events: ["Spring launch", "Women's Day"] },
    3: { season: "Spring", events: ["Easter", "spring refresh"] },
    4: { season: "Spring", events: ["Mother's Day", "May campaign"] },
    5: { season: "Summer", events: ["summer sale", "mid-year promo"] },
    6: { season: "Summer", events: ["summer vibes", "July offer"] },
    7: { season: "Summer", events: ["back to school", "August sale"] },
    8: { season: "Autumn", events: ["fall launch", "September promo"] },
    9: { season: "Autumn", events: ["Halloween", "October special"] },
    10: { season: "Autumn", events: ["Black Friday", "holiday prep"] },
    11: { season: "Winter", events: ["Christmas", "year-end sale", "holiday"] },
  };
  return seasonMap[month];
};

const ChatSuggestions = ({
  brandName,
  brandVibe,
  brandDescription,
  onSelect,
  hasMessages,
  hasImage,
}: ChatSuggestionsProps) => {
  const suggestions = useMemo(() => {
    const { season, events } = getSeasonalContext();
    const name = brandName || "my brand";
    const event = events[Math.floor(Math.random() * events.length)];

    if (hasImage) {
      // Post-generation edit suggestions
      return [
        "Make the headline bolder",
        "Try a different colour palette",
        "Add a stronger CTA",
        "Make it more minimal",
      ];
    }

    if (hasMessages) {
      // Mid-conversation suggestions
      return [
        "Try a completely different layout",
        `Create a ${event} version`,
        "Make it more eye-catching",
        "Generate an alternative variation",
      ];
    }

    // Empty state — brand + season aware
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

    // Pick 4 unique suggestions
    const shuffled = pool.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 4);
  }, [brandName, brandVibe, brandDescription, hasMessages, hasImage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="flex flex-wrap gap-1.5 justify-center"
    >
      {suggestions.map((text, i) => (
        <motion.button
          key={text}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.05 * i }}
          onClick={() => onSelect(text)}
          className="px-3 py-1.5 text-[11px] rounded-full border border-border/60 text-muted-foreground/70 
            hover:text-foreground hover:border-border hover:bg-muted/40 
            transition-all duration-200 cursor-pointer leading-tight"
        >
          {text}
        </motion.button>
      ))}
    </motion.div>
  );
};

export default ChatSuggestions;

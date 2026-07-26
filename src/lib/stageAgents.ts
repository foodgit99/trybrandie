// Single source of truth for the six pipeline-stage agents shown on /engine.

export type StageAgentId =
  | "research"
  | "ideation"
  | "strategy"
  | "planning"
  | "execution"
  | "reporting";

export type StageAgent = {
  id: StageAgentId;
  /** Short display name used in buttons, e.g. "Chat with the Planner". */
  name: string;
  /** Role title shown in the chat header. */
  role: string;
  blurb: string;
  quickPrompts: string[];
  link?: { label: string; to: string };
};

export const STAGE_AGENTS: Record<StageAgentId, StageAgent> = {
  research: {
    id: "research",
    name: "Analyst",
    role: "Market & Audience Analyst",
    blurb: "Reads trends, competitor signals and audience jobs-to-be-done.",
    quickPrompts: [
      "What's moving in my market right now?",
      "Which audience pain should I lead with this month?",
      "What are my competitors doing that I'm not?",
    ],
    link: { label: "Open Trends", to: "/hub?tab=trends" },
  },
  ideation: {
    id: "ideation",
    name: "Ideator",
    role: "Creative Ideator",
    blurb: "Turns brand truth into hooks and idea cards across the 8 pillars.",
    quickPrompts: [
      "Give me 5 hooks for my best seller.",
      "Which pillar am I under-serving?",
      "Draft three idea cards I can ship this week.",
    ],
    link: { label: "Open Content Hub", to: "/hub" },
  },
  strategy: {
    id: "strategy",
    name: "Strategist",
    role: "Campaign Strategist",
    blurb: "Sequences ideas into a narrative arc that actually converts.",
    quickPrompts: [
      "Build a 5-day arc for a restock.",
      "Where is my funnel leaking?",
      "Sharpen this week's arc.",
    ],
    link: { label: "Open Content Hub", to: "/hub?tab=week" },
  },
  planning: {
    id: "planning",
    name: "Planner",
    role: "Content Planner",
    blurb: "Owns cadence, quotas, delivery slots and seasonal timing.",
    quickPrompts: [
      "Is my week balanced?",
      "Move Thursday's post to Saturday.",
      "What should I plan around the next holiday?",
    ],
    link: { label: "Open Content Hub", to: "/hub?tab=week" },
  },
  execution: {
    id: "execution",
    name: "Creative Director",
    role: "Creative Director",
    blurb: "Art-directs the render and tightens every caption.",
    quickPrompts: [
      "Rewrite today's caption tighter.",
      "How should today's design be art-directed?",
      "Turn today's idea into a carousel outline.",
    ],
    link: { label: "Open Content Hub", to: "/hub?tab=today" },
  },
  reporting: {
    id: "reporting",
    name: "Growth Analyst",
    role: "Growth Analyst",
    blurb: "Reads what worked, kills what didn't, and tunes next week.",
    quickPrompts: [
      "What worked best in the last two weeks?",
      "Which posts are vanity, which drove action?",
      "What should I change next week?",
    ],
    link: { label: "Open Report", to: "/report" },
  },
};

export const STAGE_AGENT_IDS = Object.keys(STAGE_AGENTS) as StageAgentId[];

export function isStageAgentId(v: string): v is StageAgentId {
  return (STAGE_AGENT_IDS as string[]).includes(v);
}

export function agentChannel(id: StageAgentId) {
  return `stage:${id}`;
}

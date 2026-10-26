export const LEADERBOARD_PUBLIC_BOARDS = ["overall", "coding", "reasoning", "knowledge", "professional"] as const;
export type LeaderboardBoardKey = (typeof LEADERBOARD_PUBLIC_BOARDS)[number];

export const LEADERBOARD_BOARD_LABELS: Record<LeaderboardBoardKey, string> = {
  overall: "综合",
  coding: "编程",
  reasoning: "推理",
  knowledge: "知识",
  professional: "专业办公",
};

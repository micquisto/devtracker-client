import { supabase } from "@/lib/supabase";

export type TrelloStoryPointQueueStatus = "pending" | "applied" | "failed";

export type QueuePendingTrelloStoryPointsOptions = {
  sprintId: string;
  taskId: string;
  trelloCardId: string;
  storyPoints: number;
  lastError?: string | null;
};

export async function queuePendingTrelloStoryPoints(
  options: QueuePendingTrelloStoryPointsOptions,
): Promise<void> {
  const { sprintId, taskId, trelloCardId, storyPoints, lastError } = options;

  const { error: clearError } = await supabase
    .from("planning_poker_trello_story_point_queue")
    .delete()
    .eq("task_id", taskId)
    .eq("status", "pending");

  if (clearError) {
    throw clearError;
  }

  const { error: insertError } = await supabase
    .from("planning_poker_trello_story_point_queue")
    .insert({
      sprint_id: sprintId,
      task_id: taskId,
      trello_card_id: trelloCardId,
      story_points: storyPoints,
      status: "pending",
      last_error: lastError ?? null,
    });

  if (insertError) {
    throw insertError;
  }
}

export async function clearPendingTrelloStoryPoints(taskId: string): Promise<void> {
  const { error } = await supabase
    .from("planning_poker_trello_story_point_queue")
    .delete()
    .eq("task_id", taskId)
    .eq("status", "pending");

  if (error) {
    throw error;
  }
}

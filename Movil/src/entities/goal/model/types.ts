export interface GoalMilestoneTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  actionRoute?: string;
}

export interface GoalWeekMilestone {
  weekNumber: number;
  title: string;
  objective: string;
  tasks: GoalMilestoneTask[];
  completed: boolean;
}

export interface AuraGoal {
  id: string;
  title: string;
  targetEvent: string;
  deadlineDate: string; // ej: "2026-11-30"
  weeksRemaining: number;
  progressPercentage: number;
  milestones: GoalWeekMilestone[];
  createdAt: string;
}

export const InteractionMode = {
  AddVelocity: "av",
  ChangeTemp: "ct",
  DrawObstacles: "do",
  VelocityVectors: "vv",
} as const;

export type InteractionMode =
  (typeof InteractionMode)[keyof typeof InteractionMode];

export const INTERACTION_MODE_LIST: ReadonlyArray<{
  id: InteractionMode;
  label: string;
}> = [
  { id: InteractionMode.AddVelocity, label: "Inject Velocity" },
  { id: InteractionMode.ChangeTemp, label: "Inject Temperature" },
  { id: InteractionMode.DrawObstacles, label: "Draw Obstacles" },
  { id: InteractionMode.VelocityVectors, label: "Velocity Vectors" },
];

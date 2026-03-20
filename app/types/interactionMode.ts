export const InteractionMode = {
  AddFluid: "add-fluid",
  AddHeat: "add-heat",
  DrawObstacles: "draw-obstacles",
  VelocityVectors: "velocity-vectors",
  DivergenceField: "divergence-field",
} as const;

export type InteractionMode =
  (typeof InteractionMode)[keyof typeof InteractionMode];

export const INTERACTION_MODE_LIST: ReadonlyArray<{
  id: InteractionMode;
  label: string;
}> = [
  { id: InteractionMode.AddFluid,           label: "Add Fluid" },
  { id: InteractionMode.AddHeat,            label: "Add Heat" },
  { id: InteractionMode.DrawObstacles,      label: "Draw Obstacles" },
  { id: InteractionMode.VelocityVectors,    label: "Velocity Vectors" },
  { id: InteractionMode.DivergenceField,    label: "Divergence Field" },
];

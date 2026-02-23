/**
 * Defines the interaction modes for the fluid simulation canvas.
 * This allows for modular expansion of interaction capabilities.
 */
export type InteractionMode = "simulate" | "draw-obstacles";

/**
 * Configuration for each interaction mode.
 * Useful for rendering mode-specific UI and handling interactions.
 */
export interface InteractionModeConfig {
  id: InteractionMode;
  label: string;
  description: string;
}

/**
 * Available interaction modes with their configurations.
 * Add new modes here to extend functionality.
 */
export const INTERACTION_MODES: Record<InteractionMode, InteractionModeConfig> =
  {
    simulate: {
      id: "simulate",
      label: "Simulate",
      description: "Interact with fluid dynamics",
    },
    "draw-obstacles": {
      id: "draw-obstacles",
      label: "Draw Obstacles",
      description: "Place obstacles on the canvas",
    },
  };

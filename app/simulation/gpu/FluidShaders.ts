import {
  VERTEX_SHADER,
  ADVECT_SHADER,
  RENDER_SHADER,
  SPLAT_SHADER,
  DIVERGENCE_SHADER,
  ITERATE_SHADER,
  GRADIENT_SUBTRACT_SHADER,
  CURL_SHADER,
  VORTICITY_SHADER,
  DRAW_OBSTACLES_SHADER,
} from "./shaders/fluidShaders";
import { GPUResources } from "./GPUResources";

/**
 * Manages compilation and storage of all WebGL shader programs used in fluid simulation.
 * Centralizes shader program creation to keep FluidSolverGPU constructor clean.
 */
export class FluidShaders {
  advectProgram: WebGLProgram;
  renderProgram: WebGLProgram;
  splatProgram: WebGLProgram;
  divergenceProgram: WebGLProgram;
  iterateProgram: WebGLProgram;
  gradientSubtractProgram: WebGLProgram;
  curlProgram: WebGLProgram;
  vorticityProgram: WebGLProgram;
  obstacleProgram: WebGLProgram;

  /**
   * Compiles all shader programs using the provided GPUResources instance.
   * @param resources - GPU resource manager for shader/program compilation
   */
  constructor(resources: GPUResources) {
    this.advectProgram = resources.createProgram(VERTEX_SHADER, ADVECT_SHADER);
    this.renderProgram = resources.createProgram(VERTEX_SHADER, RENDER_SHADER);
    this.splatProgram = resources.createProgram(VERTEX_SHADER, SPLAT_SHADER);
    this.divergenceProgram = resources.createProgram(
      VERTEX_SHADER,
      DIVERGENCE_SHADER,
    );
    this.iterateProgram = resources.createProgram(
      VERTEX_SHADER,
      ITERATE_SHADER,
    );
    this.gradientSubtractProgram = resources.createProgram(
      VERTEX_SHADER,
      GRADIENT_SUBTRACT_SHADER,
    );
    this.curlProgram = resources.createProgram(VERTEX_SHADER, CURL_SHADER);
    this.vorticityProgram = resources.createProgram(
      VERTEX_SHADER,
      VORTICITY_SHADER,
    );
    this.obstacleProgram = resources.createProgram(
      VERTEX_SHADER,
      DRAW_OBSTACLES_SHADER,
    );
  }
}

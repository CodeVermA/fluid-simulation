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
  BUOYANCY_SHADER,
} from "./shaders/SimulationShaders";
import {
  DRAW_OBSTACLES_SHADER,
} from "./shaders/UtilityShaders";
import { GPUResources } from "./GPUResources";

/**
 * Looks up a fixed set of uniforms from a program in one call.
 * Keys are the names without the "u_" prefix.
 */
function getUniforms<T extends string>(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: readonly T[],
): Record<T, WebGLUniformLocation | null> {
  return Object.fromEntries(
    names.map((name) => [name, gl.getUniformLocation(program, `u_${name}`)]),
  ) as Record<T, WebGLUniformLocation | null>;
}

function buildUniforms(gl: WebGL2RenderingContext, p: FluidShaders) {
  return {
    advect: getUniforms(gl, p.advectProgram, [
      "dt",
      "texelSize",
      "velocity",
      "source",
      "obstacles",
      "dissipation",
    ] as const),
    render: getUniforms(gl, p.renderProgram, [
      "texture",
      "obstacles",
      "hideObstacles",
    ] as const),
    splat: getUniforms(gl, p.splatProgram, [
      "target",
      "aspectRatio",
      "point",
      "color",
      "radius",
    ] as const),
    divergence: getUniforms(gl, p.divergenceProgram, [
      "velocity",
      "obstacles",
      "texelSize",
      "freeSlip",
    ] as const),
    iterate: getUniforms(gl, p.iterateProgram, [
      "x",
      "b",
      "obstacles",
      "texelSize",
      "alpha",
      "beta",
      "isPressure",
      "freeSlip",
    ] as const),
    gradientSubtract: getUniforms(gl, p.gradientSubtractProgram, [
      "velocity",
      "pressure",
      "obstacles",
      "texelSize",
    ] as const),
    curl: getUniforms(gl, p.curlProgram, ["velocity", "texelSize"] as const),
    vorticity: getUniforms(gl, p.vorticityProgram, [
      "velocity",
      "curl",
      "texelSize",
      "dt",
      "epsilon",
    ] as const),
    obstacle: getUniforms(gl, p.obstacleProgram, [
      "obstacles",
      "point",
      "radius",
      "aspectRatio",
    ] as const),

    buoyancy: getUniforms(gl, p.buoyancyProgram, [
      "velocity",
      "temperature",
      "density",
      "ambientTemperature",
      "dt",
      "alpha",
      "beta",
    ] as const),
  };
}

export type FluidUniforms = ReturnType<typeof buildUniforms>;

/**
 * Manages compilation and storage of all WebGL shader programs used in fluid simulation.
 * Centralizes shader program creation to keep FluidSolverGPU constructor clean.
 */
export class FluidShaders {
  // Simulation step shaders
  advectProgram!: WebGLProgram;
  renderProgram!: WebGLProgram;
  splatProgram!: WebGLProgram;
  divergenceProgram!: WebGLProgram;
  iterateProgram!: WebGLProgram;
  gradientSubtractProgram!: WebGLProgram;
  curlProgram!: WebGLProgram;
  vorticityProgram!: WebGLProgram;
  buoyancyProgram!: WebGLProgram;

  // Utility shaders
  obstacleProgram!: WebGLProgram;
  showDivergenceProgram!: WebGLProgram;
  velocityLinesProgram!: WebGLProgram;

  // Uniform locations
  u!: FluidUniforms;

  /**
   * Compiles all shader programs using the provided GPUResources instance.
   * @param resources - GPU resource manager for shader/program compilation
   */
  constructor(resources: GPUResources, gl: WebGL2RenderingContext) {
    this.initializeShaders(resources);
    this.initializeUniforms(gl);
  }

  private initializeShaders(resources: GPUResources) {
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
    this.buoyancyProgram = resources.createProgram(
      VERTEX_SHADER,
      BUOYANCY_SHADER,
    );
  }

  private initializeUniforms(gl: WebGL2RenderingContext) {
    this.u = buildUniforms(gl, this);
  }
}

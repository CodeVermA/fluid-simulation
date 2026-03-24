import { FluidSolverGPU } from "./FluidSolver";
import { GPUResources } from "./GPUResources";
import {
  SHOW_DIVERGENCE_SHADER,
  VELOCITY_LINES_VERTEX_SHADER,
  VELOCITY_LINES_FRAGMENT_SHADER,
} from "./shaders/UtilityShaders";
import { VERTEX_SHADER } from "./shaders/SimulationShaders";

export class FluidUtils {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private velocityLinesProgram: WebGLProgram;
  private quadVAO: WebGLVertexArrayObject;
  private arrowVAO: WebGLVertexArrayObject;
  private arrowVertexCount: number;

  constructor(resources: GPUResources, gridSpacing: number = 15) {
    this.gl = resources.gl;
    this.program = resources.createProgram(
      VERTEX_SHADER,
      SHOW_DIVERGENCE_SHADER,
    );
    this.velocityLinesProgram = resources.createProgram(
      VELOCITY_LINES_VERTEX_SHADER,
      VELOCITY_LINES_FRAGMENT_SHADER,
    );
    this.quadVAO = resources.createFullScreenQuad();
    const arrowGrid = resources.createArrowGrid(gridSpacing);
    this.arrowVAO = arrowGrid.vao;
    this.arrowVertexCount = arrowGrid.vertexCount;
  }

  /**
   * Visualizes Divergence to the screen.
   */
  renderDivergence(solver: FluidSolverGPU) {
    const gl = this.gl;

    // Bind default screen buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, solver.width, solver.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.quadVAO);

    const uTexture = gl.getUniformLocation(this.program, "u_texture");
    const texture = solver.divergence.texture;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uTexture, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Cleanup
    gl.bindVertexArray(null);
  }

  /**
   * Renders velocity field as a grid of arrows.
   * Each arrow's length and color represent velocity magnitude and direction.
   */
  public renderVelocityArrows(solver: FluidSolverGPU) {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, solver.width, solver.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.velocityLinesProgram);
    gl.bindVertexArray(this.arrowVAO);

    // Get uniform locations
    const uVelocity = gl.getUniformLocation(
      this.velocityLinesProgram,
      "u_velocity",
    );
    const uTexelSize = gl.getUniformLocation(
      this.velocityLinesProgram,
      "u_texelSize",
    );
    const uMinLength = gl.getUniformLocation(
      this.velocityLinesProgram,
      "u_minLength",
    );
    const uMaxLength = gl.getUniformLocation(
      this.velocityLinesProgram,
      "u_maxLength",
    );
    const uVelocityScale = gl.getUniformLocation(
      this.velocityLinesProgram,
      "u_velocityScale",
    );
    const uKernelSize = gl.getUniformLocation(
      this.velocityLinesProgram,
      "u_kernelSize",
    );

    // Bind velocity texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, solver.velocity.read.texture);
    gl.uniform1i(uVelocity, 0);

    // Set shader parameters
    gl.uniform2f(uTexelSize, 1.0 / solver.width, 1.0 / solver.height);
    gl.uniform1f(uMinLength, 0.01); // 1% of screen
    gl.uniform1f(uMaxLength, 0.07); // 7% of screen
    gl.uniform1f(uVelocityScale, 0.1);
    gl.uniform1i(uKernelSize, 5); // 5×5 averaging kernel

    // Enable line smoothing for better visual quality
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Draw arrows as lines
    gl.drawArrays(gl.LINES, 0, this.arrowVertexCount);

    // Cleanup
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }
}

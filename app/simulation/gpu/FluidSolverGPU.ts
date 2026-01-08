import {
  VERTEX_SHADER,
  ADVECT_SHADER,
  RENDER_SHADER,
  SPLAT_SHADER,
  DIVERGENCE_SHADER,
  JACOBI_SHADER,
  GRADIENT_SUBTRACT_SHADER,
  CURL_SHADER,
  VORTICITY_SHADER,
} from "./shaders/fluidShaders";
import { GPUResources, DoubleFramebuffer } from "./GPUResources";

export class FluidSolverGPU {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private resources: GPUResources;
  private quadVAO: WebGLVertexArrayObject;

  // Simulation grid dimensions
  width: number;
  height: number;

  // Fluid state buffers
  velocity: DoubleFramebuffer;
  density: DoubleFramebuffer;
  divergence: { framebuffer: WebGLFramebuffer; texture: WebGLTexture };
  pressure: DoubleFramebuffer;
  curl: { framebuffer: WebGLFramebuffer; texture: WebGLTexture };

  // Shader programs
  advectProgram: WebGLProgram;
  renderProgram: WebGLProgram;
  splatProgram: WebGLProgram;
  divergenceProgram: WebGLProgram;
  jacobiProgram: WebGLProgram;
  gradientSubtractProgram: WebGLProgram;
  curlProgram: WebGLProgram;
  vorticityProgram: WebGLProgram;

  /**
   * Initializes the GPU-accelerated fluid solver with WebGL2 context.
   * Validates required extensions for floating-point textures and rendering.
   *
   * @param canvas - The HTMLCanvasElement to use for WebGL2 rendering
   * @param width - Simulation grid width (default: 64)
   * @param height - Simulation grid height (default: 64)
   * @throws Error if WebGL2, EXT_color_buffer_float, or OES_texture_float_linear are not supported
   */
  constructor(
    canvas: HTMLCanvasElement,
    width: number = 64,
    height: number = 64
  ) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;

    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("WebGL2 not supported");
    }
    this.gl = gl;

    const colorBuffer = gl.getExtension("EXT_color_buffer_float");
    if (!colorBuffer) {
      throw new Error("EXT_color_buffer_float not supported");
    }

    const floatLinear = gl.getExtension("OES_texture_float_linear");
    if (!floatLinear) {
      throw new Error("OES_texture_float_linear not supported");
    }

    this.resources = new GPUResources(gl);

    this.velocity = this.resources.createDoubleFramebuffer(width, height);
    this.density = this.resources.createDoubleFramebuffer(width, height);
    this.divergence = this.resources.createFramebuffer(width, height);
    this.pressure = this.resources.createDoubleFramebuffer(width, height);
    this.curl = this.resources.createFramebuffer(width, height);

    this.quadVAO = this.resources.createFullScreenQuad();

    this.advectProgram = this.resources.createProgram(
      VERTEX_SHADER,
      ADVECT_SHADER
    );
    this.renderProgram = this.resources.createProgram(
      VERTEX_SHADER,
      RENDER_SHADER
    );
    this.splatProgram = this.resources.createProgram(
      VERTEX_SHADER,
      SPLAT_SHADER
    );
    this.divergenceProgram = this.resources.createProgram(
      VERTEX_SHADER,
      DIVERGENCE_SHADER
    );
    this.jacobiProgram = this.resources.createProgram(
      VERTEX_SHADER,
      JACOBI_SHADER
    );
    this.gradientSubtractProgram = this.resources.createProgram(
      VERTEX_SHADER,
      GRADIENT_SUBTRACT_SHADER
    );
    this.curlProgram = this.resources.createProgram(VERTEX_SHADER, CURL_SHADER);
    this.vorticityProgram = this.resources.createProgram(
      VERTEX_SHADER,
      VORTICITY_SHADER
    );
  }

  /**
   * Performs semi-Lagrangian advection on a scalar or vector field.
   * Implements the "stable fluids" advection step by tracing particles backwards in time
   * and sampling their previous values using hardware bilinear interpolation.
   *
   * @param output - The field to advect (density or velocity)
   * @param velocity - The velocity field used for backtracing
   * @param dt - Time step size
   */
  advect(output: DoubleFramebuffer, velocity: DoubleFramebuffer, dt: number) {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.advectProgram);
    gl.bindVertexArray(this.quadVAO);

    const uDt = gl.getUniformLocation(this.advectProgram, "u_dt");
    const uTexelSize = gl.getUniformLocation(this.advectProgram, "u_texelSize");
    const uVelocity = gl.getUniformLocation(this.advectProgram, "u_velocity");
    const uSource = gl.getUniformLocation(this.advectProgram, "u_source");

    gl.uniform1f(uDt, dt);
    gl.uniform2f(uTexelSize, 1.0 / this.width, 1.0 / this.height);
    gl.uniform1i(uVelocity, 0);
    gl.uniform1i(uSource, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocity.read.texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, output.read.texture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, output.write.framebuffer);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    output.swap();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Renders the current density field to the screen.
   * Binds the default framebuffer (screen) and uses the render shader to visualize
   * the fluid's density texture as color output.
   */
  render() {
    const gl = this.gl;

    // 1. Bind default framebuffer (null = the screen)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // 2. Clear the screen (optional but good practice)
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 3. Use Render Program
    gl.useProgram(this.renderProgram);

    // 4. Bind Quad
    gl.bindVertexArray(this.quadVAO);

    // 5. Bind Density Texture (Read Buffer)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.density.read.texture);

    const uTexture = gl.getUniformLocation(this.renderProgram, "u_texture");
    gl.uniform1i(uTexture, 0);

    // 6. Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Adds a localized "splat" of color or velocity to a target field.
   * Used for mouse interaction to inject dye (density) or force (velocity) into the simulation.
   * Creates a smooth Gaussian-like distribution centered at the specified coordinates.
   *
   * @param target - The field to splat into (density or velocity)
   * @param x - X coordinate in canvas pixel space
   * @param y - Y coordinate in canvas pixel space
   * @param dx - Red component for density, or X-velocity for velocity field
   * @param dy - Green component for density, or Y-velocity for velocity field
   * @param dz - Blue component for density, or unused (0) for velocity field
   */
  splat(
    target: DoubleFramebuffer,
    x: number,
    y: number,
    dx: number,
    dy: number,
    dz: number
  ) {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.splatProgram);
    gl.bindVertexArray(this.quadVAO);

    const uTarget = gl.getUniformLocation(this.splatProgram, "u_target");
    const uAspectRatio = gl.getUniformLocation(
      this.splatProgram,
      "u_aspectRatio"
    );
    const uPoint = gl.getUniformLocation(this.splatProgram, "u_point");
    const uColor = gl.getUniformLocation(this.splatProgram, "u_color");
    const uRadius = gl.getUniformLocation(this.splatProgram, "u_radius");

    gl.uniform1i(uTarget, 0);
    gl.uniform1f(uAspectRatio, this.width / this.height);

    // Normalize coordinates to 0..1 (UV space)
    // Note: We flip Y because WebGL texture coordinates (0,0) are bottom-left,
    // but mouse coordinates (0,0) are top-left.
    gl.uniform2f(uPoint, x / this.canvas.width, 1.0 - y / this.canvas.height);

    gl.uniform3f(uColor, dx, dy, dz);
    gl.uniform1f(uRadius, 0.001); // Adjust this for splat size

    // Bind Read Buffer (the current state)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, target.read.texture);

    // Bind Write Buffer (the destination)
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.write.framebuffer);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Swap so the write buffer becomes the new current state
    target.swap();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Computes the divergence of the velocity field.
   * Divergence measures how much the velocity field is "expanding" or "compressing" at each point.
   * A divergence-free field is incompressible (key property of fluids).
   */
  private computeDivergence() {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.divergenceProgram);
    gl.bindVertexArray(this.quadVAO);

    const uVelocity = gl.getUniformLocation(
      this.divergenceProgram,
      "u_velocity"
    );
    const uTexelSize = gl.getUniformLocation(
      this.divergenceProgram,
      "u_texelSize"
    );

    gl.uniform1i(uVelocity, 0);
    gl.uniform2f(uTexelSize, 1.0 / this.width, 1.0 / this.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.texture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergence.framebuffer);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Performs one Jacobi iteration to solve the Poisson equation for pressure.
   * This is equivalent to the linSolve function in the CPU version.
   * Multiple iterations are needed for convergence.
   */
  private jacobiIteration() {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.jacobiProgram);
    gl.bindVertexArray(this.quadVAO);

    const uPressure = gl.getUniformLocation(this.jacobiProgram, "u_pressure");
    const uDivergence = gl.getUniformLocation(
      this.jacobiProgram,
      "u_divergence"
    );
    const uTexelSize = gl.getUniformLocation(this.jacobiProgram, "u_texelSize");

    gl.uniform1i(uPressure, 0);
    gl.uniform1i(uDivergence, 1);
    gl.uniform2f(uTexelSize, 1.0 / this.width, 1.0 / this.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.pressure.read.texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.divergence.texture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.write.framebuffer);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.pressure.swap();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Subtracts the pressure gradient from the velocity field.
   * This enforces incompressibility by removing the divergent component of the velocity.
   * After this step, the velocity field should be divergence-free.
   */
  private subtractPressureGradient() {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.gradientSubtractProgram);
    gl.bindVertexArray(this.quadVAO);

    const uVelocity = gl.getUniformLocation(
      this.gradientSubtractProgram,
      "u_velocity"
    );
    const uPressure = gl.getUniformLocation(
      this.gradientSubtractProgram,
      "u_pressure"
    );
    const uTexelSize = gl.getUniformLocation(
      this.gradientSubtractProgram,
      "u_texelSize"
    );

    gl.uniform1i(uVelocity, 0);
    gl.uniform1i(uPressure, 1);
    gl.uniform2f(uTexelSize, 1.0 / this.width, 1.0 / this.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.pressure.read.texture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.write.framebuffer);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.velocity.swap();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Performs the projection step to make the velocity field divergence-free (incompressible).
   * This is the GPU equivalent of the project() method in the CPU FluidSolver.
   *
   * Steps:
   * 1. Compute divergence of velocity field
   * 2. Solve Poisson equation for pressure using Jacobi iterations
   * 3. Subtract pressure gradient from velocity
   *
   * @param iterations - Number of Jacobi iterations (default: 20, matching CPU version)
   */
  project(iterations: number = 20) {
    // Step 1: Compute divergence
    this.computeDivergence();

    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.read.framebuffer);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    for (let i = 0; i < iterations; i++) {
      this.jacobiIteration();
    }

    // Step 3: Subtract pressure gradient
    this.subtractPressureGradient();
  }

  computeCurl(
    velocity: DoubleFramebuffer,
    curl: { framebuffer: WebGLFramebuffer; texture: WebGLTexture }
  ) {
    const gl = this.gl!;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.curlProgram);
    gl.bindVertexArray(this.quadVAO);

    const uVelocity = gl.getUniformLocation(this.curlProgram, "u_velocity");
    const uTexelSize = gl.getUniformLocation(this.curlProgram, "u_texelSize");

    gl.uniform2f(uTexelSize, 1.0 / this.width, 1.0 / this.height);
    gl.uniform1i(uVelocity, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocity.read.texture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, curl.framebuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  applyVorticity(
    velocity: DoubleFramebuffer,
    curl: { framebuffer: WebGLFramebuffer; texture: WebGLTexture },
    dt: number
  ) {
    const gl = this.gl!;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.vorticityProgram);
    gl.bindVertexArray(this.quadVAO);

    const uVelocity = gl.getUniformLocation(
      this.vorticityProgram,
      "u_velocity"
    );
    const uCurl = gl.getUniformLocation(this.vorticityProgram, "u_curl");
    const uTexelSize = gl.getUniformLocation(
      this.vorticityProgram,
      "u_texelSize"
    );
    const uDt = gl.getUniformLocation(this.vorticityProgram, "u_dt");
    const uCurlStrength = gl.getUniformLocation(
      this.vorticityProgram,
      "u_curlStrength"
    );

    gl.uniform2f(uTexelSize, 1.0 / this.width, 1.0 / this.height);
    gl.uniform1f(uDt, dt);
    gl.uniform1f(uCurlStrength, 3.0); // Try values between 20 and 50

    gl.uniform1i(uVelocity, 0);
    gl.uniform1i(uCurl, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocity.read.texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, curl.texture);

    // Write back into velocity
    gl.bindFramebuffer(gl.FRAMEBUFFER, velocity.write.framebuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    velocity.swap();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}

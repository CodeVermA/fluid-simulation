import { GPUResources, DoubleFramebuffer } from "./GPUResources";
import { FluidShaders } from "./Shaders";

export class FluidSolverGPU {
  // Boussinesq buoyancy parameters: f_y = -alpha * rho + beta * (T - T_amb)
  private readonly buoyancyAlpha = 0.05;
  private readonly buoyancyBeta = 1.25;
  private readonly ambientTemperature = 0.0;

  // Thermal transport parameters
  private readonly temperatureDissipation = 0.995;
  private readonly temperatureDiffusion = 0.0001;

  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  readonly resources: GPUResources;
  private shaders: FluidShaders;
  private quadVAO: WebGLVertexArrayObject;

  // Simulation grid praameters
  width: number;
  height: number;
  texelSize: { x: number; y: number };

  // Fluid state buffers
  velocity: DoubleFramebuffer;
  density: DoubleFramebuffer;
  divergence: { framebuffer: WebGLFramebuffer; texture: WebGLTexture };
  pressure: DoubleFramebuffer;
  curl: { framebuffer: WebGLFramebuffer; texture: WebGLTexture };
  temperature: DoubleFramebuffer;
  obstacles: DoubleFramebuffer;

  // Boundary configuration
  boundaryThickness: number = 5; // Object boundary thickness in pixels

  constructor(
    canvas: HTMLCanvasElement,
    width: number = 64,
    height: number = 64,
  ) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;

    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("WebGL2 not supported");
    }
    this.gl = gl;

    if (!gl.getExtension("EXT_color_buffer_float")) {
      throw new Error("EXT_color_buffer_float not supported");
    }

    if (!gl.getExtension("OES_texture_float_linear")) {
      throw new Error("OES_texture_float_linear not supported");
    }

    this.resources = new GPUResources(gl);

    this.velocity = this.resources.createDoubleFramebuffer(width, height);
    this.density = this.resources.createDoubleFramebuffer(width, height);
    this.divergence = this.resources.createFramebuffer(width, height);
    this.pressure = this.resources.createDoubleFramebuffer(width, height);
    this.curl = this.resources.createFramebuffer(width, height);
    this.obstacles = this.resources.createDoubleFramebuffer(
      width,
      height,
      "nearest",
    );
    this.temperature = this.resources.createDoubleFramebuffer(width, height);

    this.quadVAO = this.resources.createFullScreenQuad();
    this.shaders = new FluidShaders(this.resources, gl);

    this.texelSize = { x: 1.0 / width, y: 1.0 / height };
  }

  private advect(
    source: DoubleFramebuffer,
    velocity: DoubleFramebuffer,
    dt: number,
    dissipation: number = 1.0,
  ) {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.shaders.advectProgram);
    gl.bindVertexArray(this.quadVAO);

    gl.uniform1f(this.shaders.u.advect.dt, dt);
    gl.uniform1f(this.shaders.u.advect.dissipation, dissipation);
    gl.uniform2f(
      this.shaders.u.advect.texelSize,
      this.texelSize.x,
      this.texelSize.y,
    );
    gl.uniform1i(this.shaders.u.advect.velocity, 0);
    gl.uniform1i(this.shaders.u.advect.source, 1);
    gl.uniform1i(this.shaders.u.advect.obstacles, 2);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocity.read.texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, source.read.texture);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.obstacles.read.texture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, source.write.framebuffer);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    source.swap();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  render(hideObstacles: boolean = true) {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // 2. Clear the screen
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.shaders.renderProgram);
    gl.bindVertexArray(this.quadVAO);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.density.read.texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.obstacles.read.texture);

    gl.uniform1i(this.shaders.u.render.texture, 0);
    gl.uniform1i(this.shaders.u.render.obstacles, 1);
    gl.uniform1i(this.shaders.u.render.hideObstacles, hideObstacles ? 1 : 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  splat(
    target: DoubleFramebuffer,
    x: number,
    y: number,
    dx: number,
    dy: number,
    dz: number,
    radius: number = 0.001,
  ) {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.shaders.splatProgram);
    gl.bindVertexArray(this.quadVAO);

    gl.uniform1i(this.shaders.u.splat.target, 0);
    gl.uniform1f(this.shaders.u.splat.aspectRatio, this.width / this.height);

    // Normalize coordinates to [0,1] range
    // 1-(y) to flip Y axis (canvas vs texture coords)
    gl.uniform2f(
      this.shaders.u.splat.point,
      x / this.canvas.width,
      1.0 - y / this.canvas.height,
    );

    gl.uniform3f(this.shaders.u.splat.color, dx, dy, dz);
    gl.uniform1f(this.shaders.u.splat.radius, radius); // Adjust this for splat size

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
  private computeDivergence(freeSlip: boolean) {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.shaders.divergenceProgram);
    gl.bindVertexArray(this.quadVAO);

    gl.uniform1i(this.shaders.u.divergence.velocity, 0);
    gl.uniform1i(this.shaders.u.divergence.obstacles, 1);
    gl.uniform2f(
      this.shaders.u.divergence.texelSize,
      this.texelSize.x,
      this.texelSize.y,
    );
    gl.uniform1i(this.shaders.u.divergence.freeSlip, freeSlip ? 1 : 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.obstacles.read.texture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergence.framebuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Solves a linear system Ax = b using Jacobi iteration.
   * Optimised to bind static WebGL state (programs, VAOs, uniforms) ONLY ONCE,
   * significantly reducing CPU overhead during the ping-pong loop.
   *
   * @param x - The current solution estimate (DoubleFramebuffer to ping-pong)
   * @param b - The right-hand side source texture (divergence or previous state)
   * @param alpha - Stencil coefficient
   * @param beta - Diagonal coefficient
   * @param isPressure - TRUE for pressure projection, FALSE for diffusion
   * @param freeSlip - TRUE for free-slip boundary conditions
   * @param iterations - Number of Jacobi iterations to perform
   */
  private solveLinearSystem(
    x: DoubleFramebuffer,
    b: WebGLTexture | null,
    alpha: number,
    beta: number,
    isPressure: boolean,
    freeSlip: boolean,
    iterations: number,
  ) {
    const gl = this.gl;

    // 1. Setup static state ONCE
    gl.useProgram(this.shaders.iterateProgram);
    gl.viewport(0, 0, this.width, this.height);
    gl.bindVertexArray(this.quadVAO);

    // 2. Upload static uniforms ONCE
    gl.uniform1f(this.shaders.u.iterate.alpha, alpha);
    gl.uniform1f(this.shaders.u.iterate.beta, beta);
    gl.uniform2f(
      this.shaders.u.iterate.texelSize,
      this.texelSize.x,
      this.texelSize.y,
    );
    gl.uniform1i(this.shaders.u.iterate.isPressure, isPressure ? 1 : 0);
    gl.uniform1i(this.shaders.u.iterate.freeSlip, freeSlip ? 1 : 0);

    // 3. Map texture units
    gl.uniform1i(this.shaders.u.iterate.x, 0);
    gl.uniform1i(this.shaders.u.iterate.b, 1);
    gl.uniform1i(this.shaders.u.iterate.obstacles, 2);

    // 4. Bind the obstacle texture ONCE (it never changes during iterations)
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.obstacles.read.texture);

    // 5. The ping-pong loop
    for (let i = 0; i < iterations; i++) {
      // Bind current guess
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, x.read.texture);

      // FIX: WebGL Feedback Loop Prevention
      // If a separate source texture 'b' is provided (like divergence), use it.
      // If null, we bind x.read.texture safely for each iteration to restore explicit blurring.
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, b ? b : x.read.texture);

      // Render to write buffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, x.write.framebuffer);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Swap pointers
      x.swap();
    }

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
    gl.useProgram(this.shaders.gradientSubtractProgram);
    gl.bindVertexArray(this.quadVAO);

    gl.uniform1i(this.shaders.u.gradientSubtract.velocity, 0);
    gl.uniform1i(this.shaders.u.gradientSubtract.pressure, 1);
    gl.uniform1i(this.shaders.u.gradientSubtract.obstacles, 2);
    gl.uniform2f(
      this.shaders.u.gradientSubtract.texelSize,
      this.texelSize.x,
      this.texelSize.y,
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.pressure.read.texture);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.obstacles.read.texture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.write.framebuffer);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.velocity.swap();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private applyBuoyancy(
    dt: number,
    alpha: number,
    beta: number,
    ambientTemperature: number = 0.0,
  ) {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.shaders.buoyancyProgram);
    gl.bindVertexArray(this.quadVAO);

    gl.uniform1i(this.shaders.u.buoyancy.velocity, 0);
    gl.uniform1i(this.shaders.u.buoyancy.temperature, 1);
    gl.uniform1i(this.shaders.u.buoyancy.density, 2);

    gl.uniform1f(
      this.shaders.u.buoyancy.ambientTemperature,
      ambientTemperature,
    );
    gl.uniform1f(this.shaders.u.buoyancy.dt, dt);
    gl.uniform1f(this.shaders.u.buoyancy.alpha, alpha);
    gl.uniform1f(this.shaders.u.buoyancy.beta, beta);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.temperature.read.texture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.density.read.texture);

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
  project(iterations: number = 20, freeSlip: boolean) {
    // Step 1: Compute divergence
    this.computeDivergence(freeSlip);

    // 2. Solve Pressure (Poisson)
    // Clear initial pressure guess to 0
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.read.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const alpha = 1.0;
    const beta = 4.0;

    this.solveLinearSystem(
      this.pressure,
      this.divergence.texture,
      alpha,
      beta,
      true,
      freeSlip,
      iterations,
    );

    // 3. Subtract Gradient
    this.subtractPressureGradient();
  }

  /**
   * Computes the curl (vorticity) field from the velocity field.
   * Curl measures rotation: positive = counterclockwise, negative = clockwise.
   * Stores result in this.curl for use by applyVorticity().
   */
  private computeCurl() {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.shaders.curlProgram);
    gl.bindVertexArray(this.quadVAO);

    gl.uniform1i(this.shaders.u.curl.velocity, 0);
    gl.uniform2f(
      this.shaders.u.curl.texelSize,
      this.texelSize.x,
      this.texelSize.y,
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.texture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.curl.framebuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Applies vorticity confinement to amplify rotational motion.
   * Adds force perpendicular to curl gradient to restore turbulence lost to numerical dissipation.
   *
   * @param dt - Timestep
   * @param epsilon - Confinement strength (default: 20.0, higher = more swirls)
   */
  private applyVorticity(dt: number, epsilon: number = 20.0) {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.shaders.vorticityProgram);
    gl.bindVertexArray(this.quadVAO);

    gl.uniform1i(this.shaders.u.vorticity.velocity, 0);
    gl.uniform1i(this.shaders.u.vorticity.curl, 1);
    gl.uniform2f(
      this.shaders.u.vorticity.texelSize,
      this.texelSize.x,
      this.texelSize.y,
    );

    gl.uniform1f(this.shaders.u.vorticity.dt, dt);
    gl.uniform1f(this.shaders.u.vorticity.epsilon, epsilon);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curl.texture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.write.framebuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.velocity.swap();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Updates the obstacle texture to create solid walls on the specified boundaries.
   * Uses gl.scissor to efficiently clear rectangular regions to 1.0 (solid) or 0.0 (empty).
   * @param top - Block the top edge
   * @param bottom - Block the bottom edge
   * @param left - Block the left edge
   * @param right - Block the right edge
   */
  updateWalls(top: boolean, bottom: boolean, left: boolean, right: boolean) {
    const gl = this.gl;

    // 1. Bind Obstacle Write FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.obstacles.write.framebuffer);
    gl.viewport(0, 0, this.width, this.height);

    // 2. Clear everything to "Empty" (0.0) first
    gl.disable(gl.SCISSOR_TEST); // Important! Disable before full clear
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 3. Enable Scissor Test (Allows us to draw to just a small rectangle)
    gl.enable(gl.SCISSOR_TEST);
    gl.clearColor(1, 0, 0, 1); // Set clear color to "Solid" (1.0)

    const thickness = this.boundaryThickness; // Wall thickness in pixels

    // Draw Top Wall
    if (top) {
      // x, y, width, height (y starts from bottom in WebGL)
      gl.scissor(0, this.height - thickness, this.width, thickness);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Draw Bottom Wall
    if (bottom) {
      gl.scissor(0, 0, this.width, thickness);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Draw Left Wall
    if (left) {
      gl.scissor(0, 0, thickness, this.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Draw Right Wall
    if (right) {
      gl.scissor(this.width - thickness, 0, thickness, this.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // 4. Cleanup and swap buffers
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.obstacles.swap();
  }

  /**
   * Draws a circular obstacle at the specified position.
   * Renders fullscreen; shader preserves existing obstacles outside the circle.
   * No scissor test for maximum performance.
   *
   * @param x - X coordinate in canvas pixels
   * @param y - Y coordinate in canvas pixels
   * @param radius - Circle radius in UV space [0,1] (default: 0.02)
   */
  drawObstacles(x: number, y: number, radius: number = 0.02) {
    const gl = this.gl;

    // Convert canvas coordinates to UV space [0,1]
    // Flip Y-axis because canvas Y (top-left origin) ≠ texture Y (bottom-left origin)
    const uvX = x / this.canvas.width;
    const uvY = 1.0 - y / this.canvas.height;

    // Setup WebGL state
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.shaders.obstacleProgram);
    gl.bindVertexArray(this.quadVAO);

    // Set uniforms
    gl.uniform1i(this.shaders.u.obstacle.obstacles, 0);
    gl.uniform2f(this.shaders.u.obstacle.point, uvX, uvY);
    gl.uniform1f(this.shaders.u.obstacle.radius, radius);
    gl.uniform1f(this.shaders.u.obstacle.aspectRatio, this.width / this.height);

    // Bind obstacle READ texture (current state)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.obstacles.read.texture);

    // Bind obstacle WRITE framebuffer as render target
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.obstacles.write.framebuffer);

    // Draw fullscreen: shader writes obstacles inside radius, preserves existing outside
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Cleanup and swap buffers
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.obstacles.swap();
  }

  /**
   * Resets the simulation to its initial state.
   * Clears all velocity, density, pressure, curl, and divergence fields.
   */
  reset() {
    this.resources.clearDoubleFramebuffer(this.velocity);
    this.resources.clearDoubleFramebuffer(this.density);
    this.resources.clearDoubleFramebuffer(this.pressure);
    this.resources.clearDoubleFramebuffer(this.obstacles);
    this.resources.clearFramebuffer(this.divergence);
    this.resources.clearFramebuffer(this.curl);
    this.resources.clearDoubleFramebuffer(this.temperature);
  }

  /**
   * Generic diffusion solver for both velocity and density.
   * Applies viscous damping using Jacobi iteration.
   *
   * @param target - Target buffer (velocity or density)
   * @param dt - Timestep
   * @param iters - Number of Jacobi iterations
   * @param diffusionRate - Diffusion coefficient (viscosity or density diffusion)
   * @param freeSlip - Use free-slip boundary conditions (density always uses free-slip)
   */
  private diffuse(
    target: DoubleFramebuffer,
    dt: number,
    iters: number,
    diffusionRate: number,
    freeSlip: boolean,
  ) {
    if (diffusionRate <= 0.0 || iters <= 0 || dt < 0.0) return;

    const alpha = (diffusionRate * dt) / (this.texelSize.x * this.texelSize.x);
    const beta = 1.0 + 4.0 * alpha;

    this.solveLinearSystem(target, null, alpha, beta, false, freeSlip, iters);
  }

  /**
   * Advances the fluid simulation by one timestep.
   * Implements complete Stable Fluids algorithm with vorticity confinement.
   *
   * @param dt - Timestep (typically 1/60 for 60 FPS)
   * @param freeSlip - Use free-slip boundary conditions
   * @param viscosity - Fluid viscosity [0, 1]
   * @param vorticityStrength - Vorticity confinement [0, 50]
   * @param iterations - Jacobi iterations for diffusion & pressure [10, 40]
   */
  step(
    dt: number,
    freeSlip: boolean,
    viscosity: number = 0.0001,
    vorticityStrength: number = 0,
    iterations: number = 50,
  ) {
    const densityDiffusion = 0.00001;

    // STEP 0: BUOYANCY (External Force)
    this.applyBuoyancy(
      dt,
      this.buoyancyAlpha,
      this.buoyancyBeta,
      this.ambientTemperature,
    );

    //STEP 1: VORTICITY CONFINEMENT
    this.computeCurl();
    this.applyVorticity(dt, vorticityStrength);

    // STEP 2: ADVECT VELOCITY
    this.advect(this.velocity, this.velocity, dt);

    // STEP 3: DIFFUSE VELOCITY
    this.diffuse(this.velocity, dt, iterations, viscosity, freeSlip);

    // STEP 4: PROJECT (ENFORCE INCOMPRESSIBILITY)
    this.project(iterations, freeSlip);

    // STEP 5: ADVECT DENSITY AND HEAT
    this.advect(this.density, this.velocity, dt);
    this.advect(
      this.temperature,
      this.velocity,
      dt,
      this.temperatureDissipation,
    );

    // STEP 6: DIFFUSE DENSITY AND HEAT
    this.diffuse(this.density, dt, iterations, densityDiffusion, true);
    this.diffuse(
      this.temperature,
      dt,
      iterations / 2,
      this.temperatureDiffusion,
      true,
    );
  }
}

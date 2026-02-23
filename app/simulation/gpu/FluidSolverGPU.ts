import { GPUResources, DoubleFramebuffer } from "./GPUResources";
import { FluidShaders } from "./FluidShaders";

export class FluidSolverGPU {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private resources: GPUResources;
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
  obstacles: DoubleFramebuffer;

  // Boundary configuration
  boundaryThickness: number = 10; // Object boundary thickness in pixels

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
    this.obstacles = this.resources.createDoubleFramebuffer(
      width,
      height,
      "nearest",
    );

    this.quadVAO = this.resources.createFullScreenQuad();
    this.shaders = new FluidShaders(this.resources);

    this.texelSize = { x: 1.0 / width, y: 1.0 / height };
  }

  private advect(
    source: DoubleFramebuffer,
    velocity: DoubleFramebuffer,
    dt: number,
  ) {
    const gl = this.gl;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.shaders.advectProgram);
    gl.bindVertexArray(this.quadVAO);

    const uDt = gl.getUniformLocation(this.shaders.advectProgram, "u_dt");
    const uTexelSize = gl.getUniformLocation(
      this.shaders.advectProgram,
      "u_texelSize",
    );
    const uVelocity = gl.getUniformLocation(
      this.shaders.advectProgram,
      "u_velocity",
    );
    const uSource = gl.getUniformLocation(
      this.shaders.advectProgram,
      "u_source",
    );
    const uObstacles = gl.getUniformLocation(
      this.shaders.advectProgram,
      "u_obstacles",
    );

    gl.uniform1f(uDt, dt);
    gl.uniform2f(uTexelSize, this.texelSize.x, this.texelSize.y);
    gl.uniform1i(uVelocity, 0);
    gl.uniform1i(uSource, 1);
    gl.uniform1i(uObstacles, 2);

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

  render() {
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

    const uTexture = gl.getUniformLocation(
      this.shaders.renderProgram,
      "u_texture",
    );
    gl.uniform1i(uTexture, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  splat(
    target: DoubleFramebuffer,
    x: number,
    y: number,
    dx: number,
    dy: number,
    dz: number,
  ) {
    const gl = this.gl;
    const radius = 0.001;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.shaders.splatProgram);
    gl.bindVertexArray(this.quadVAO);

    const uTarget = gl.getUniformLocation(
      this.shaders.splatProgram,
      "u_target",
    );
    const uAspectRatio = gl.getUniformLocation(
      this.shaders.splatProgram,
      "u_aspectRatio",
    );
    const uPoint = gl.getUniformLocation(this.shaders.splatProgram, "u_point");
    const uColor = gl.getUniformLocation(this.shaders.splatProgram, "u_color");
    const uRadius = gl.getUniformLocation(
      this.shaders.splatProgram,
      "u_radius",
    );

    gl.uniform1i(uTarget, 0);
    gl.uniform1f(uAspectRatio, this.width / this.height);

    // Normalize coordinates to [0,1] range
    // 1-(y) to flip Y axis (canvas vs texture coords)
    gl.uniform2f(uPoint, x / this.canvas.width, 1.0 - y / this.canvas.height);

    gl.uniform3f(uColor, dx, dy, dz);
    gl.uniform1f(uRadius, radius); // Adjust this for splat size

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

    const uVelocity = gl.getUniformLocation(
      this.shaders.divergenceProgram,
      "u_velocity",
    );
    const uObstacles = gl.getUniformLocation(
      this.shaders.divergenceProgram,
      "u_obstacles",
    );
    const uTexelSize = gl.getUniformLocation(
      this.shaders.divergenceProgram,
      "u_texelSize",
    );
    const uFreeSlip = gl.getUniformLocation(
      this.shaders.divergenceProgram,
      "u_freeSlip",
    );

    gl.uniform1i(uVelocity, 0);
    gl.uniform1i(uObstacles, 1);
    gl.uniform2f(uTexelSize, this.texelSize.x, this.texelSize.y);
    gl.uniform1i(uFreeSlip, freeSlip ? 1 : 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.obstacles.read.texture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergence.framebuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private iterate(
    x: DoubleFramebuffer,
    b: WebGLTexture,
    alpha: number,
    beta: number,
    isPressure: boolean,
    freeSlip: boolean,
  ) {
    const gl = this.gl;
    gl.useProgram(this.shaders.iterateProgram);
    gl.viewport(0, 0, this.width, this.height);
    gl.bindVertexArray(this.quadVAO);

    const uX = gl.getUniformLocation(this.shaders.iterateProgram, "u_x");
    const uB = gl.getUniformLocation(this.shaders.iterateProgram, "u_b");
    const uObstacles = gl.getUniformLocation(
      this.shaders.iterateProgram,
      "u_obstacles",
    );

    const uTexelSize = gl.getUniformLocation(
      this.shaders.iterateProgram,
      "u_texelSize",
    );
    const uAlpha = gl.getUniformLocation(
      this.shaders.iterateProgram,
      "u_alpha",
    );
    const uBeta = gl.getUniformLocation(this.shaders.iterateProgram, "u_beta");
    const uIsPressure = gl.getUniformLocation(
      this.shaders.iterateProgram,
      "u_isPressure",
    );
    const uFreeSlip = gl.getUniformLocation(
      this.shaders.iterateProgram,
      "u_freeSlip",
    );

    // Uniforms
    gl.uniform1f(uAlpha, alpha);
    gl.uniform1f(uBeta, beta);
    gl.uniform2f(uTexelSize, this.texelSize.x, this.texelSize.y);
    gl.uniform1i(uIsPressure, isPressure ? 1 : 0);
    gl.uniform1i(uFreeSlip, freeSlip ? 1 : 0);

    gl.uniform1i(uX, 0);
    gl.uniform1i(uB, 1);
    gl.uniform1i(uObstacles, 2);

    // Textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, x.read.texture); // x (Guess)

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, b); // b (Source)

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.obstacles.read.texture); // Obstacles

    // Draw
    gl.bindFramebuffer(gl.FRAMEBUFFER, x.write.framebuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    x.swap();
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

    const uVelocity = gl.getUniformLocation(
      this.shaders.gradientSubtractProgram,
      "u_velocity",
    );
    const uPressure = gl.getUniformLocation(
      this.shaders.gradientSubtractProgram,
      "u_pressure",
    );
    const uObstacles = gl.getUniformLocation(
      this.shaders.gradientSubtractProgram,
      "u_obstacles",
    );
    const uTexelSize = gl.getUniformLocation(
      this.shaders.gradientSubtractProgram,
      "u_texelSize",
    );

    gl.uniform1i(uVelocity, 0);
    gl.uniform1i(uPressure, 1);
    gl.uniform1i(uObstacles, 2);
    gl.uniform2f(uTexelSize, this.texelSize.x, this.texelSize.y);

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

    for (let i = 0; i < iterations; i++) {
      this.iterate(
        this.pressure,
        this.divergence.texture,
        alpha,
        beta,
        true,
        freeSlip,
      );
    }

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

    const uVelocity = gl.getUniformLocation(
      this.shaders.curlProgram,
      "u_velocity",
    );
    const uTexelSize = gl.getUniformLocation(
      this.shaders.curlProgram,
      "u_texelSize",
    );

    gl.uniform1i(uVelocity, 0);
    gl.uniform2f(uTexelSize, this.texelSize.x, this.texelSize.y);

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

    const uVelocity = gl.getUniformLocation(
      this.shaders.vorticityProgram,
      "u_velocity",
    );
    const uCurl = gl.getUniformLocation(
      this.shaders.vorticityProgram,
      "u_curl",
    );
    const uTexelSize = gl.getUniformLocation(
      this.shaders.vorticityProgram,
      "u_texelSize",
    );
    const uDt = gl.getUniformLocation(this.shaders.vorticityProgram, "u_dt");
    const uEpsilon = gl.getUniformLocation(
      this.shaders.vorticityProgram,
      "u_epsilon",
    );

    gl.uniform1i(uVelocity, 0);
    gl.uniform1i(uCurl, 1);
    gl.uniform2f(uTexelSize, this.texelSize.x, this.texelSize.y);
    gl.uniform1f(uDt, dt);
    gl.uniform1f(uEpsilon, epsilon);

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
  updateBoundaries(
    top: boolean,
    bottom: boolean,
    left: boolean,
    right: boolean,
  ) {
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
   * Draws a circular obstacle at the specified position using scissor test optimization.
   * Only renders pixels within the circle's bounding box for maximum efficiency.
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

    // Calculate bounding box in pixel coordinates for scissor test
    const radiusPixels = radius * this.width;
    const centerX = uvX * this.width;
    const centerY = uvY * this.height;

    const minX = Math.floor(Math.max(0, centerX - radiusPixels));
    const minY = Math.floor(Math.max(0, centerY - radiusPixels));
    const boxWidth = Math.ceil(Math.min(this.width - minX, radiusPixels * 2));
    const boxHeight = Math.ceil(Math.min(this.height - minY, radiusPixels * 2));

    // Setup WebGL state
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.shaders.obstacleProgram);
    gl.bindVertexArray(this.quadVAO);

    // Set uniforms
    const uObstacles = gl.getUniformLocation(
      this.shaders.obstacleProgram,
      "u_obstacles",
    );
    const uPoint = gl.getUniformLocation(
      this.shaders.obstacleProgram,
      "u_point",
    );
    const uRadius = gl.getUniformLocation(
      this.shaders.obstacleProgram,
      "u_radius",
    );
    const uAspectRatio = gl.getUniformLocation(
      this.shaders.obstacleProgram,
      "u_aspectRatio",
    );

    gl.uniform1i(uObstacles, 0);
    gl.uniform2f(uPoint, uvX, uvY);
    gl.uniform1f(uRadius, radius);
    gl.uniform1f(uAspectRatio, this.width / this.height);
    
    // Bind obstacle READ texture (current state)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.obstacles.read.texture);

    // Bind obstacle WRITE framebuffer as render target
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.obstacles.write.framebuffer);

    // Enable scissor test to only render the bounding box
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(minX, minY, boxWidth, boxHeight);

    // Draw (shader only runs for pixels in the scissor region)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Cleanup and swap buffers
    gl.disable(gl.SCISSOR_TEST);
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
  }

  private diffuseVelocity(
    dt: number,
    iters: number,
    viscosity: number,
    freeSlip: boolean,
  ) {
    if (viscosity <= 0.0 || iters <= 0 || dt < 0.0) return;

    const alpha = (viscosity * dt) / (this.texelSize.x * this.texelSize.x);
    const beta = 1.0 + 4.0 * alpha;

    // Solve for diffusion 50 times
    for (let i = 0; i < iters; i++) {
      this.iterate(
        this.velocity,
        this.velocity.read.texture,
        alpha,
        beta,
        false,
        freeSlip,
      );
    }
  }

  private diffuseDensity(dt: number, iters: number, diffusionRate: number) {
    if (diffusionRate <= 0.0 || iters <= 0 || dt < 0.0) return;

    const alpha = (diffusionRate * dt) / (this.texelSize.x * this.texelSize.x);
    const beta = 1.0 + 4.0 * alpha;

    // Solve for diffusion 50 times
    for (let i = 0; i < iters; i++) {
      this.iterate(
        this.density,
        this.density.read.texture,
        alpha,
        beta,
        false,
        true,
      );
    }
  }

  /**
   * Advances the fluid simulation by one timestep.
   * Implements complete Stable Fluids algorithm with vorticity confinement.
   *
   * @param dt - Timestep (typically 1/60 for 60 FPS)
   * @param freeSlip - Use free-slip boundary conditions
   */
  step(dt: number, freeSlip: boolean) {
    // User-configurable parameters (recommended ranges):
    const viscosity = 0.01; // Range: [0.0, 1.0] - Higher = thicker fluid (honey vs water)
    const diffusionRate = 1e-6; // Range: [0.0, 0.02] - Higher = faster fade/decay
    const iterations = 50; // Range: [10, 100] - Higher = more accurate (less dissipation)
    const vorticityStrength = 0; // Range: [0.0, 50.0] - Higher = more swirls/turbulence

    // === STEP 1: VORTICITY CONFINEMENT (CREATE SWIRLS) ===
    // Compute curl and amplify rotational motion for turbulence
    this.computeCurl();
    this.applyVorticity(dt, vorticityStrength);

    // === STEP 2: ADVECT VELOCITY ===
    // Transport velocity through itself (momentum conservation)
    this.advect(this.velocity, this.velocity, dt);

    // === STEP 3: DIFFUSE VELOCITY ===
    // Apply viscosity (usually very low for realistic fluids)
    this.diffuseVelocity(dt, iterations, viscosity, freeSlip);

    // === STEP 4: PROJECT (ENFORCE INCOMPRESSIBILITY) ===
    this.project(iterations, freeSlip);

    // === STEP 5: ADVECT DENSITY ===
    // Transport dye through velocity field
    this.advect(this.density, this.velocity, dt);

    // === STEP 6: DENSITY DECAY ===
    // Gradually fade density to prevent over-accumulation
    // this.diffuseDensity(dt, iterations, diffusionRate);
  }
}

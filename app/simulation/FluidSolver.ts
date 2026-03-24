import { GPUResources, DoubleFramebuffer } from "./GPUResources";
import { FluidShaders } from "./FluidPrograms";

export class FluidSolverGPU {
  // Boussinesq buoyancy parameters: f_y = -alpha * rho + beta * (T - T_amb)
  private readonly BUOYANCY_ALPHA = 0.05;
  private readonly BUOYANCY_BETA = 1.25;
  private readonly AMBIENT_TEMP = 0.0;

  // Thermal transport parameters
  private readonly TEMP_DISSIPATION = 0.995;
  private readonly TEMP_DIFFUSION = 0.0001;

  // Vorticity confinement parameters
  private readonly BASE_VORTICITY = 20.0;

  // Density Diffusion parameters
  private readonly MAX_DENSITY_DIFFUSION = 0.5;
  private readonly SCALE = 100000.0; // 10^5

  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  readonly resources: GPUResources;
  private shaders: FluidShaders;
  private quadVAO: WebGLVertexArrayObject;

  // Simulation grid parameters
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

  project(iterations: number = 50, freeSlip: boolean) {
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

  drawObstacles(
    x: number,
    y: number,
    radius: number = 0.02,
    erase: boolean = false,
  ) {
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
    gl.uniform1i(this.shaders.u.obstacle.erase, erase ? 1 : 0);

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

  reset() {
    this.resources.clearDoubleFramebuffer(this.velocity);
    this.resources.clearDoubleFramebuffer(this.density);
    this.resources.clearDoubleFramebuffer(this.pressure);
    this.resources.clearDoubleFramebuffer(this.obstacles);
    this.resources.clearFramebuffer(this.divergence);
    this.resources.clearFramebuffer(this.curl);
    this.resources.clearDoubleFramebuffer(this.temperature);
  }

  private diffuse(
    target: DoubleFramebuffer,
    dt: number,
    iters: number,
    diffusionRate: number,
    freeSlip: boolean,
  ) {
    // 1. Safety check to prevent division by zero
    if (diffusionRate <= 0.00001 || iters <= 0 || dt <= 0.0) return;

    // 2. THE FIX: The Standard Implicit Diffusion Formula
    // Notice how diffusionRate is now in the denominator!
    const alpha = (diffusionRate * dt) / (this.texelSize.x * this.texelSize.x);

    // 3. THE FIX: beta is 4 + alpha (not 1 + 4*alpha)
    const beta = 1 + 4.0 * alpha;

    this.solveLinearSystem(target, null, alpha, beta, false, freeSlip, iters);
  }

  step(
    dt: number,
    freeSlip: boolean,
    viscosity: number = 0.0001,
    vorticityMultiplier: number = 0,
    iterations: number = 50,
  ) {
    // Phenomenological Stokes-Einstein approximation
    const densityDiffusionRate =
      this.MAX_DENSITY_DIFFUSION / (1.0 + viscosity * this.SCALE);

    console.log(`Diffusion Rate: ${densityDiffusionRate.toFixed(5)}`);

    // STEP 0: BUOYANCY (External Force)
    this.applyBuoyancy(
      dt,
      this.BUOYANCY_ALPHA,
      this.BUOYANCY_BETA,
      this.AMBIENT_TEMP,
    );

    //STEP 1: VORTICITY CONFINEMENT
    this.computeCurl();
    this.applyVorticity(dt, this.BASE_VORTICITY * vorticityMultiplier);

    // STEP 2: ADVECT VELOCITY
    this.advect(this.velocity, this.velocity, dt);

    // STEP 3: DIFFUSE VELOCITY
    this.diffuse(this.velocity, dt, iterations, viscosity, freeSlip);

    // STEP 4: PROJECT (ENFORCE INCOMPRESSIBILITY)
    this.project(iterations, freeSlip);

    // STEP 5: ADVECT DENSITY AND HEAT
    this.advect(this.density, this.velocity, dt);
    this.advect(this.temperature, this.velocity, dt, this.TEMP_DISSIPATION);

    // STEP 6: DIFFUSE DENSITY AND HEAT
    this.diffuse(this.density, dt, iterations, densityDiffusionRate, true);
    this.diffuse(this.temperature, dt, iterations, this.TEMP_DIFFUSION, true);

    console.log(`Density Diffusion Rate: ${densityDiffusionRate.toFixed(4)}`);
    console.log(`Vorticity Strength: ${vorticityMultiplier.toFixed(4)}`);
  }
}

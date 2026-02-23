import { FluidSolverGPU } from "./FluidSolverGPU";
import {
  DEBUG_SHADER,
  VELOCITY_LINES_VERTEX_SHADER,
  VELOCITY_LINES_FRAGMENT_SHADER,
} from "./shaders/debuggerShaders";
import { VERTEX_SHADER } from "./shaders/fluidShaders";

export class FluidDebugger {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private velocityLinesProgram: WebGLProgram;
  private quadVAO: WebGLVertexArrayObject;
  private arrowVAO: WebGLVertexArrayObject;
  private arrowVertexCount: number = 0;

  constructor(gl: WebGL2RenderingContext, gridSpacing: number = 20) {
    this.gl = gl;
    this.program = this.createProgram(gl, VERTEX_SHADER, DEBUG_SHADER);
    this.velocityLinesProgram = this.createProgram(
      gl,
      VELOCITY_LINES_VERTEX_SHADER,
      VELOCITY_LINES_FRAGMENT_SHADER,
    );
    this.quadVAO = this.createQuad(gl);
    this.arrowVAO = this.createArrowGrid(gl, gridSpacing);
  }

  /**
   * Visualizes internal fields (Velocity, Divergence, etc.) to the screen.
   */
  render(
    solver: FluidSolverGPU,
    mode: "divergence" | "pressure" | "velocity" | "obstacles",
  ) {
    const gl = this.gl;

    // Bind default screen buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, solver.width, solver.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Special rendering for velocity arrows
    if (mode === "velocity") {
      this.renderVelocityArrows(solver);
      return;
    }

    // Standard texture visualization for other modes
    gl.useProgram(this.program);
    gl.bindVertexArray(this.quadVAO);

    const uTexture = gl.getUniformLocation(this.program, "u_texture");
    const uScale = gl.getUniformLocation(this.program, "u_scale");
    const uMode = gl.getUniformLocation(this.program, "u_mode");

    let texture: WebGLTexture;
    let scale = 1.0;
    let shaderMode = 0; // 0 = Scalar, 1 = Vector

    switch (mode) {
      case "divergence":
        texture = solver.divergence.texture;
        // Scale factor explanation:
        // - Good simulation: divergence ≈ 0.0001 - 0.01 (needs 10-100x amplification)
        // - Bad simulation: divergence > 0.1 (shows as bright clouds even with low scale)
        // After pressure projection, divergence should be near-zero everywhere
        scale = 1.0; // Amplify tiny errors for visibility
        shaderMode = 0;
        break;
      case "pressure":
        texture = solver.pressure.read.texture;
        scale = 0.5; // Pressure gradients drive flow, usually small values
        shaderMode = 0;
        break;
      case "obstacles":
        texture = solver.obstacles.read.texture;
        scale = 1.0; // Binary: 1.0 = solid, 0.0 = fluid
        shaderMode = 0;
        break;
      default:
        return;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uTexture, 0);
    gl.uniform1f(uScale, scale);
    gl.uniform1i(uMode, shaderMode);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Cleanup
    gl.bindVertexArray(null);
  }

  /**
   * Renders velocity field as a grid of arrows.
   * Each arrow's length and color represent velocity magnitude and direction.
   */
  private renderVelocityArrows(solver: FluidSolverGPU) {
    const gl = this.gl;

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
    gl.uniform1f(uMinLength, 0.01); // 1.0% of screen
    gl.uniform1f(uMaxLength, 0.10); // 10% of screen
    gl.uniform1f(uVelocityScale, 0.8); // Adjust for visual appeal
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

  /**
   * Calculates total mass (sum of density) to check for leaks.
   * WARNING: Slow (GPU->CPU read). Call sparingly.
   */
  measureMass(solver: FluidSolverGPU): number {
    const gl = this.gl;
    const w = solver.width;
    const h = solver.height;

    // Read from the current Density Read buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, solver.density.read.framebuffer);

    // Allocate array (Float32 because textures are RGBA32F)
    const pixels = new Float32Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    let total = 0;
    // Sum all RGB channels (density can be colored)
    for (let i = 0; i < pixels.length; i += 4) {
      total += pixels[i] + pixels[i + 1] + pixels[i + 2]; // R + G + B
    }
    return total;
  }

  // --- Internal Helpers (Duplicated to avoid tight coupling) ---

  private createProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
    const createShader = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        throw new Error("Shader compile failed");
      }
      return shader;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, createShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, createShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    return p;
  }

  private createQuad(gl: WebGL2RenderingContext) {
    const vao = gl.createVertexArray()!;
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }
  /**
   * Creates a grid mesh for velocity arrow visualization.
   * Generates line pairs (base + tip) at regular grid intervals.
   *
   * @param gl WebGL2 context
   * @param gridSpacing Spacing between arrows in pixels (e.g., 25)
   * @returns VAO containing arrow geometry
   */
  private createArrowGrid(
    gl: WebGL2RenderingContext,
    gridSpacing: number,
  ): WebGLVertexArrayObject {
    const canvas = gl.canvas as HTMLCanvasElement;
    const width = canvas.width;
    const height = canvas.height;

    // Calculate grid dimensions
    const cols = Math.floor(width / gridSpacing);
    const rows = Math.floor(height / gridSpacing);

    // Each arrow = 2 vertices (base + tip), each vertex = 2 position coords + 1 isTip flag
    const verticesPerArrow = 2;
    const floatsPerVertex = 3; // x, y, isTip
    const vertices: number[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Calculate position in pixel space
        const x = (col + 0.5) * gridSpacing;
        const y = (row + 0.5) * gridSpacing;

        // Convert to NDC space [-1, 1]
        const ndcX = (x / width) * 2.0 - 1.0;
        const ndcY = (y / height) * 2.0 - 1.0;

        // Base vertex (isTip = 0.0)
        vertices.push(ndcX, ndcY, 0.0);

        // Tip vertex (isTip = 1.0) - starts at same position, shader will displace it
        vertices.push(ndcX, ndcY, 1.0);
      }
    }

    this.arrowVertexCount = vertices.length / floatsPerVertex;

    // Create VAO and VBO
    const vao = gl.createVertexArray()!;
    const vbo = gl.createBuffer();

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    // Setup vertex attributes
    const stride = floatsPerVertex * Float32Array.BYTES_PER_ELEMENT;

    // Attribute 0: a_position (vec2)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);

    // Attribute 1: a_isTip (float)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(
      1,
      1,
      gl.FLOAT,
      false,
      stride,
      2 * Float32Array.BYTES_PER_ELEMENT,
    );

    gl.bindVertexArray(null);

    console.log(
      `Created arrow grid: ${cols}×${rows} = ${this.arrowVertexCount / 2} arrows`,
    );

    return vao;
  }
}

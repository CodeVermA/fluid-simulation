import { FluidSolverGPU } from "./FluidSolverGPU";
import { DEBUG_SHADER } from "./shaders/debuggerShaders";
import { VERTEX_SHADER } from "./shaders/fluidShaders";

export class FluidDebugger {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private quadVAO: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = this.createProgram(gl, VERTEX_SHADER, DEBUG_SHADER);
    this.quadVAO = this.createQuad(gl);
  }

  /**
   * Visualizes internal fields (Velocity, Divergence, etc.) to the screen.
   */
  render(
    solver: FluidSolverGPU,
    mode: "divergence" | "pressure" | "velocity" | "obstacles"
  ) {
    const gl = this.gl;

    // Bind default screen buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, solver.width, solver.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

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
        scale = 100.0; // Amplify tiny errors for visibility
        shaderMode = 0;
        break;
      case "pressure":
        texture = solver.pressure.read.texture;
        scale = 0.5; // Pressure gradients drive flow, usually small values
        shaderMode = 0;
        break;
      case "velocity":
        texture = solver.velocity.read.texture;
        scale = 0.5; // Velocity typically [-1, 1] range
        shaderMode = 1; // Vector mode
        break;
      case "obstacles":
        texture = solver.obstacles.texture;
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
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }
}

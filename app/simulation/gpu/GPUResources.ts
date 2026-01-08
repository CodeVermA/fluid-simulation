/**
 * Manages WebGL2 resource creation and lifecycle.
 * Handles framebuffers, textures, shaders, programs, and geometry buffers.
 */

/**
 * Represents a pair of framebuffers for ping-pong rendering.
 * Used in iterative algorithms where output becomes input in the next iteration.
 */
export interface DoubleFramebuffer {
  read: { framebuffer: WebGLFramebuffer; texture: WebGLTexture };
  write: { framebuffer: WebGLFramebuffer; texture: WebGLTexture };
  swap(): void;
}

export class GPUResources {
  private gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Creates and compiles a WebGL shader from GLSL source code.
   *
   * @param type - Shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
   * @param source - GLSL shader source code string
   * @returns Compiled WebGLShader object
   * @throws Error if shader creation, compilation, or validation fails
   */
  createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error("Unable to create shader");
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error("Could not compile shader:\n" + info);
    }

    return shader;
  }

  /**
   * Creates and links a WebGL program from vertex and fragment shader sources.
   *
   * @param vertexShaderSource - GLSL vertex shader source code
   * @param fragmentShaderSource - GLSL fragment shader source code
   * @returns Linked WebGLProgram ready for use
   * @throws Error if program creation, linking, or validation fails
   */
  createProgram(
    vertexShaderSource: string,
    fragmentShaderSource: string
  ): WebGLProgram {
    const vertexShader = this.createShader(
      this.gl.VERTEX_SHADER,
      vertexShaderSource
    );
    const fragmentShader = this.createShader(
      this.gl.FRAGMENT_SHADER,
      fragmentShaderSource
    );

    const program = this.gl.createProgram();
    if (!program) {
      throw new Error("Unable to create program");
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error("Could not link program:\n" + info);
    }

    return program;
  }

  /**
   * Creates a framebuffer with an attached RGBA32F floating-point texture.
   * Configures LINEAR filtering for hardware-accelerated bilinear interpolation
   * and CLAMP_TO_EDGE wrapping for proper boundary handling.
   *
   * @param width - Texture width in pixels
   * @param height - Texture height in pixels
   * @returns Object containing the framebuffer and its attached texture
   * @throws Error if framebuffer is incomplete or texture allocation fails
   */
  createFramebuffer(
    width: number,
    height: number
  ): { framebuffer: WebGLFramebuffer; texture: WebGLTexture } {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error("Unable to create texture");
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA32F,
      width,
      height,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      null
    );

    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error("Unable to create framebuffer");
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture,
      0
    );

    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("Framebuffer incomplete: " + status);
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    return { framebuffer, texture };
  }

  /**
   * Creates a pair of framebuffers for ping-pong rendering.
   * Each framebuffer has an attached RGBA32F texture.
   * Used in iterative algorithms where the output of one pass becomes the input of the next.
   *
   * @param width - Texture width in pixels
   * @param height - Texture height in pixels
   * @returns DoubleFramebuffer object with 'read' and 'write' framebuffers
   */
  createDoubleFramebuffer(width: number, height: number): DoubleFramebuffer {
    return {
      read: this.createFramebuffer(width, height),
      write: this.createFramebuffer(width, height),
      swap() {
        const temp = this.read;
        this.read = this.write;
        this.write = temp;
      },
    };
  }

  /**
   * Creates a full-screen quad Vertex Array Object (VAO) for rendering.
   * Quad covers normalized device coordinates [-1, 1] in both axes.
   *
   * @returns WebGLVertexArrayObject configured for full-screen rendering
   */
  createFullScreenQuad(): WebGLVertexArrayObject {
    //
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

    const quadVAO = this.gl.createVertexArray();
    if (!quadVAO) {
      throw new Error("Unable to create VAO");
    }

    const vbo = this.gl.createBuffer();
    this.gl.bindVertexArray(quadVAO);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    const positionLocation = 0;
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(
      positionLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    this.gl.bindVertexArray(null);

    return quadVAO;
  }
}

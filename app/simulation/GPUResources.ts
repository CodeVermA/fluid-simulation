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
  readonly gl: WebGL2RenderingContext;
  private _fullScreenQuad: WebGLVertexArrayObject | null = null;

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
    fragmentShaderSource: string,
  ): WebGLProgram {
    const vertexShader = this.createShader(
      this.gl.VERTEX_SHADER,
      vertexShaderSource,
    );
    const fragmentShader = this.createShader(
      this.gl.FRAGMENT_SHADER,
      fragmentShaderSource,
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
   * Configures texture filtering (LINEAR for smooth interpolation or NEAREST for sharp edges)
   * and CLAMP_TO_EDGE wrapping for proper boundary handling.
   *
   * @param width - Texture width in pixels
   * @param height - Texture height in pixels
   * @param filtering - Texture filtering mode: 'linear' for smooth interpolation (default), 'nearest' for sharp edges
   * @returns Object containing the framebuffer and its attached texture
   * @throws Error if framebuffer is incomplete or texture allocation fails
   */
  createFramebuffer(
    width: number,
    height: number,
    filtering: "linear" | "nearest" = "linear",
  ): { framebuffer: WebGLFramebuffer; texture: WebGLTexture } {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error("Unable to create texture");
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    const filterMode =
      filtering === "nearest" ? this.gl.NEAREST : this.gl.LINEAR;
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      filterMode,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      filterMode,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE,
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
      null,
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
      0,
    );

    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("Framebuffer incomplete: " + status);
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    return { framebuffer, texture };
  }

  /**
   * Clears a framebuffer to its initial state (all zeros).
   * Resets the framebuffer as if it was just created.
   *
   * @param framebuffer - The framebuffer object to clear
   */
  clearFramebuffer(framebuffer: {
    framebuffer: WebGLFramebuffer;
    texture: WebGLTexture;
  }): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer.framebuffer);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * Creates a pair of framebuffers for ping-pong rendering.
   * Each framebuffer has an attached RGBA32F texture.
   * Used in iterative algorithms where the output of one pass becomes the input of the next.
   *
   * @param width - Texture width in pixels
   * @param height - Texture height in pixels
   * @param filtering - Texture filtering mode: 'linear' for smooth interpolation (default), 'nearest' for sharp edges
   * @returns DoubleFramebuffer object with 'read' and 'write' framebuffers
   */
  createDoubleFramebuffer(
    width: number,
    height: number,
    filtering: "linear" | "nearest" = "linear",
  ): DoubleFramebuffer {
    return {
      read: this.createFramebuffer(width, height, filtering),
      write: this.createFramebuffer(width, height, filtering),
      swap() {
        const temp = this.read;
        this.read = this.write;
        this.write = temp;
      },
    };
  }

  clearDoubleFramebuffer(doubleFBO: DoubleFramebuffer): void {
    this.clearFramebuffer(doubleFBO.read);
    this.clearFramebuffer(doubleFBO.write);
  }

  /**
   * Creates a full-screen quad Vertex Array Object (VAO) for rendering.
   * Quad covers normalized device coordinates [-1, 1] in both axes.
   *
   * @returns WebGLVertexArrayObject configured for full-screen rendering
   */
  createFullScreenQuad(): WebGLVertexArrayObject {
    if (this._fullScreenQuad) return this._fullScreenQuad;

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
      0,
    );

    this.gl.bindVertexArray(null);

    this._fullScreenQuad = quadVAO;
    return quadVAO;
  }

  /**
   * Creates a grid mesh for velocity arrow visualization.
   * Generates line segments for shaft + arrowhead at regular grid intervals.
   *
   * @param gridSpacing Spacing between arrows in pixels (e.g., 25)
   * @returns Object containing VAO and vertex count
   */
  public createArrowGrid(
    width: number,
    height: number,
    gridSpacing: number,
  ): {
    vao: WebGLVertexArrayObject;
    vertexCount: number;
  } {
    // Calculate grid dimensions
    const cols = Math.floor(width / gridSpacing);
    const rows = Math.floor(height / gridSpacing);

    // Each arrow uses 3 line segments (shaft + 2 head wings) = 6 vertices.
    // Attribute a_isTip encodes role:
    // 0.0 = base, 1.0 = tip, 2.0 = head-left endpoint, 3.0 = head-right endpoint.
    const verticesPerArrow = 6;
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

        // Shaft segment: base -> tip
        vertices.push(ndcX, ndcY, 0.0);
        vertices.push(ndcX, ndcY, 1.0);

        // Head left wing: tip -> left endpoint
        vertices.push(ndcX, ndcY, 1.0);
        vertices.push(ndcX, ndcY, 2.0);

        // Head right wing: tip -> right endpoint
        vertices.push(ndcX, ndcY, 1.0);
        vertices.push(ndcX, ndcY, 3.0);
      }
    }

    const arrowVertexCount = vertices.length / floatsPerVertex;

    // Create VAO and VBO
    const vao = this.gl.createVertexArray()!;
    const vbo = this.gl.createBuffer();

    this.gl.bindVertexArray(vao);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(vertices),
      this.gl.STATIC_DRAW,
    );

    // Setup vertex attributes
    const stride = floatsPerVertex * Float32Array.BYTES_PER_ELEMENT;

    // Attribute 0: a_position (vec2)
    this.gl.enableVertexAttribArray(0);
    this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, stride, 0);

    // Attribute 1: a_isTip (float)
    this.gl.enableVertexAttribArray(1);
    this.gl.vertexAttribPointer(
      1,
      1,
      this.gl.FLOAT,
      false,
      stride,
      2 * Float32Array.BYTES_PER_ELEMENT,
    );

    this.gl.bindVertexArray(null);

    console.log(
      `Created arrow grid: ${cols}×${rows} = ${arrowVertexCount / verticesPerArrow} arrows`,
    );

    return { vao, vertexCount: arrowVertexCount };
  }
}

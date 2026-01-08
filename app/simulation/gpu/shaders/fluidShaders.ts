/**
 * GLSL shader sources for GPU-accelerated fluid simulation.
 * All shaders use WebGL2 (GLSL ES 3.00) with floating-point precision.
 */

/**
 * Vertex shader for full-screen quad rendering.
 * Converts clip-space positions [-1,1] to UV coordinates [0,1].
 */
export const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;
out vec2 v_texCoord;

void main() {
    v_texCoord = a_position * 0.5 + 0.5;  // Convert from [-1,-1] to [0,0]
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Advection shader implementing semi-Lagrangian method.
 * Traces particles backward in time and samples using hardware bilinear interpolation.
 */
export const ADVECT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform vec2 u_texelSize;
uniform float u_dt;

out vec4 outColor;

void main() {
    vec2 velocity = texture(u_velocity, v_texCoord).xy;
    vec2 previousCoord = v_texCoord - (velocity * u_dt * u_texelSize);
    vec4 result = texture(u_source, previousCoord);
    outColor = result;
}
`;

/**
 * Render shader for visualizing density field on screen.
 * Converts density texture to RGB output.
 */
export const RENDER_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
out vec4 outColor;

void main() {
    vec4 color = texture(u_texture, v_texCoord);
    outColor = vec4(color.rgb, 1.0);
}
`;

/**
 * Splat shader for adding density or velocity at a point.
 * Uses Gaussian falloff for smooth, circular splats.
 */
export const SPLAT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_target;
uniform float u_aspectRatio;
uniform vec2 u_point;
uniform vec3 u_color;
uniform float u_radius;

out vec4 outColor;

void main() {
    vec2 p = v_texCoord - u_point;
    p.x *= u_aspectRatio;
    
    vec3 splat = u_color * exp(-dot(p, p) / u_radius);
    vec3 base = texture(u_target, v_texCoord).rgb;
    outColor = vec4(base + splat, 1.0);
}
`;

/**
 * Divergence shader for computing velocity field divergence.
 * Uses central differences to measure expansion/compression.
 */
export const DIVERGENCE_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_velocity;
uniform vec2 u_texelSize;

out vec4 outColor;

void main() {
    vec2 vLeft = texture(u_velocity, v_texCoord - vec2(u_texelSize.x, 0.0)).xy;
    vec2 vRight = texture(u_velocity, v_texCoord + vec2(u_texelSize.x, 0.0)).xy;
    vec2 vBottom = texture(u_velocity, v_texCoord - vec2(0.0, u_texelSize.y)).xy;
    vec2 vTop = texture(u_velocity, v_texCoord + vec2(0.0, u_texelSize.y)).xy;
    
    float divergence = 0.5 * ((vRight.x - vLeft.x) + (vTop.y - vBottom.y));
    
    outColor = vec4(divergence, 0.0, 0.0, 1.0);
}
`;

/**
 * Jacobi iteration shader for solving Poisson equation.
 * Iteratively refines pressure field to enforce incompressibility.
 */
export const JACOBI_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
uniform vec2 u_texelSize;

out vec4 outColor;

void main() {
    float pLeft = texture(u_pressure, v_texCoord - vec2(u_texelSize.x, 0.0)).r;
    float pRight = texture(u_pressure, v_texCoord + vec2(u_texelSize.x, 0.0)).r;
    float pBottom = texture(u_pressure, v_texCoord - vec2(0.0, u_texelSize.y)).r;
    float pTop = texture(u_pressure, v_texCoord + vec2(0.0, u_texelSize.y)).r;
    
    float div = texture(u_divergence, v_texCoord).r;
    
    float newPressure = (pLeft + pRight + pBottom + pTop - div) * 0.25;
    
    outColor = vec4(newPressure, 0.0, 0.0, 1.0);
}
`;

/**
 * Gradient subtraction shader for projection step.
 * Removes pressure gradient from velocity to make field divergence-free.
 */
export const GRADIENT_SUBTRACT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_velocity;
uniform sampler2D u_pressure;
uniform vec2 u_texelSize;

out vec4 outColor;

void main() {
    float pLeft = texture(u_pressure, v_texCoord - vec2(u_texelSize.x, 0.0)).r;
    float pRight = texture(u_pressure, v_texCoord + vec2(u_texelSize.x, 0.0)).r;
    float pBottom = texture(u_pressure, v_texCoord - vec2(0.0, u_texelSize.y)).r;
    float pTop = texture(u_pressure, v_texCoord + vec2(0.0, u_texelSize.y)).r;
    
    vec2 velocity = texture(u_velocity, v_texCoord).xy;
    
    velocity.x -= 0.5 * (pRight - pLeft);
    velocity.y -= 0.5 * (pTop - pBottom);
    
    outColor = vec4(velocity, 0.0, 1.0);
}
`;

export const CURL_SHADER = `#version 300 es
    precision highp float;

    in vec2 v_texCoord;

    uniform sampler2D u_velocity;
    uniform vec2 u_texelSize;

    out vec4 outColor;

    void main() {
        // Get neighbors
        float L = texture(u_velocity, v_texCoord - vec2(u_texelSize.x, 0.0)).y;
        float R = texture(u_velocity, v_texCoord + vec2(u_texelSize.x, 0.0)).y;
        float T = texture(u_velocity, v_texCoord + vec2(0.0, u_texelSize.y)).x;
        float B = texture(u_velocity, v_texCoord - vec2(0.0, u_texelSize.y)).x;

        // Calculate Curl (Vorticity)
        // Ideally: (dy/dx - dx/dy)
        float vorticity = 0.5 * ((R - L) - (T - B));

        outColor = vec4(vorticity, 0.0, 0.0, 1.0);
    }
`;

export const VORTICITY_SHADER = `#version 300 es
    precision highp float;

    in vec2 v_texCoord;

    uniform sampler2D u_velocity;
    uniform sampler2D u_curl;
    uniform vec2 u_texelSize;
    uniform float u_dt;
    uniform float u_curlStrength;

    out vec4 outColor;

    void main() {
        // 1. Calculate Gradient of Curl Magnitude (The "slope" of the spin)
        // x-derivative = (Right - Left) / 2
        // y-derivative = (Top - Bottom) / 2
        
        float L = abs(texture(u_curl, v_texCoord - vec2(u_texelSize.x, 0.0)).x);
        float R = abs(texture(u_curl, v_texCoord + vec2(u_texelSize.x, 0.0)).x);
        float B = abs(texture(u_curl, v_texCoord - vec2(0.0, u_texelSize.y)).x);
        float T = abs(texture(u_curl, v_texCoord + vec2(0.0, u_texelSize.y)).x);
        float C = texture(u_curl, v_texCoord).x; // The sign tells us spin direction

        vec2 gradient = vec2(R - L, T - B) * 0.5;

        // 2. Normalize to get safe direction
        float len = length(gradient);
        if (len > 0.0001) {
            gradient /= len;
        }

        // 3. Apply force Perpendicular to the gradient
        // To rotate 90 degrees in 2D: (x, y) -> (y, -x)
        vec2 forceDir = vec2(gradient.y, -gradient.x); 
        
        // 4. Integrate
        vec2 velocity = texture(u_velocity, v_texCoord).xy;
        vec2 newVelocity = velocity + forceDir * C * u_curlStrength * u_dt;

        outColor = vec4(newVelocity, 0.0, 1.0);
    }
`;

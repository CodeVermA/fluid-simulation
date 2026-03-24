export const OBSTACLES_SHADER = `#version 300 es
precision highp float;

#define OBSTACLE_VALUE vec4(1.0, 0.0, 0.0, 1.0)

in vec2 v_texCoord;

uniform sampler2D u_obstacles;
uniform vec2 u_point; // Center of the obstacle in UV coordinates
uniform float u_radius; // Radius of the circular obstacle
uniform float u_aspectRatio;
uniform bool u_erase; // If true, remove obstacle instead of adding
out vec4 outColor;

void main() {
    vec2 p = v_texCoord - u_point;
    p.x *= u_aspectRatio;
    float dist2 = dot(p, p);

    // If within radius, set as obstacle
    if (dist2 < u_radius) {
        if (u_erase) {
            outColor = vec4(0.0); // Remove obstacle
        } else {
            outColor = OBSTACLE_VALUE; // Mark as solid
        }
    } else {
        outColor = texture(u_obstacles, v_texCoord); // Keep existing value
    }
}
`;

export const SHOW_DIVERGENCE_SHADER = `#version 300 es
    precision highp float;

    in vec2 v_texCoord;
    uniform sampler2D u_texture;

    out vec4 outColor;

    void main() {        
        vec3 color = vec3(0.0);
        float val = texture(u_texture, v_texCoord).r; // Divergence stored in R channel
        
        // Clamp to [0, 1] range to prevent oversaturation
        val = clamp(val, -1.0, 1.0);
        
        if (val > 0.0) {
            color.g = val;  // Positive divergence = Green
        } else {
            color.r = -val; // Negative divergence = Red
        }

        outColor = vec4(color, 1.0);
    }
`;

export const VELOCITY_LINES_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;   // Vertex position in NDC [-1, 1]
layout(location = 1) in float a_isTip;     // 0.0 = base, 1.0 = tip, 2.0 = head-left, 3.0 = head-right

uniform sampler2D u_velocity;
uniform vec2 u_texelSize;
uniform float u_minLength;
uniform float u_maxLength;
uniform float u_velocityScale;
uniform int u_kernelSize;

out vec3 v_color;

void main() {
    // Convert NDC position to UV space [0, 1] for texture sampling
    vec2 uv = a_position * 0.5 + 0.5;
    
    // Average velocity over a kernel to reduce noise
    vec2 avgVelocity = vec2(0.0);
    int halfKernel = u_kernelSize / 2;
    float sampleCount = 0.0;
    
    for (int dy = -halfKernel; dy <= halfKernel; dy++) {
        for (int dx = -halfKernel; dx <= halfKernel; dx++) {
            vec2 offset = vec2(float(dx), float(dy)) * u_texelSize;
            vec2 sampleUV = clamp(uv + offset, vec2(0.0), vec2(1.0));
            vec2 vel = texture(u_velocity, sampleUV).xy;
            avgVelocity += vel;
            sampleCount += 1.0;
        }
    }
    
    avgVelocity /= sampleCount;
    
    // Calculate arrow direction and magnitude
    float velocityMag = length(avgVelocity);
    vec2 velocityDir = velocityMag > 0.0001 ? normalize(avgVelocity) : vec2(0.0);
    
    // Map velocity magnitude to arrow length with clamping
    float arrowLength = clamp(0.1 * (velocityMag * u_velocityScale), u_minLength, u_maxLength);
    vec2 displacement = velocityDir * arrowLength;
    
    // Build arrow geometry by role:
    // 0.0 = base, 1.0 = tip, 2.0/3.0 = arrow head wings
    vec2 finalPos = a_position;
    if (a_isTip > 0.5 && a_isTip < 1.5) {
        finalPos += displacement;
    } else if (a_isTip > 1.5) {
        vec2 perp = vec2(-velocityDir.y, velocityDir.x);
        float headLength = arrowLength * 0.35;
        float headWidth = arrowLength * 0.20;
        vec2 tipPos = a_position + displacement;

        if (a_isTip < 2.5) {
            finalPos = tipPos - velocityDir * headLength + perp * headWidth;
        } else {
            finalPos = tipPos - velocityDir * headLength - perp * headWidth;
        }
    }
    
    gl_Position = vec4(finalPos, 0.0, 1.0);
    
    // Color arrows by velocity magnitude for visual feedback
    float intensity = clamp(velocityMag * 3.0, 0.4, 1.0);
    v_color = vec3(0.2, intensity, intensity); // Cyan gradient
}
`;

/**
 * Fragment shader for velocity arrows.
 *
 * Simple pass-through that renders arrows with color based on velocity magnitude.
 * Color is interpolated from vertex shader (cyan gradient based on speed).
 */
export const VELOCITY_LINES_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_color;
out vec4 outColor;

void main() {
    outColor = vec4(v_color, 1.0);
}
`;

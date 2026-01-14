export const DEBUG_SHADER = `#version 300 es
    precision highp float;

    in vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_scale; // Amplification factor for tiny values (like Divergence)
    uniform int u_mode;    // 0 = Scalar (Green/Red for +/-), 1 = Vector (RGB)

    out vec4 outColor;

    void main() {
        vec4 data = texture(u_texture, v_texCoord);
        
        vec3 color = vec3(0.0);

        if (u_mode == 0) {
            // SCALAR MODE (e.g., Divergence, Pressure)
            // Divergence color mapping:
            // Green = Positive (fluid expanding / sources)
            // Red = Negative (fluid compressing / sinks)
            // Black = Zero (ideal incompressible state)
            float val = data.x * u_scale;
            
            // Clamp to [0, 1] range to prevent oversaturation
            val = clamp(val, -1.0, 1.0);
            
            if (val > 0.0) {
                color.g = val;  // Positive divergence = Green
            } else {
                color.r = -val; // Negative divergence = Red
            }
        } else {
            // VECTOR MODE (e.g., Velocity)
            // X component = Red channel
            // Y component = Green channel
            // Remap from [-1, 1] to [0, 1] for visualization
            vec2 vel = data.xy * u_scale;
            color.r = vel.x * 0.5 + 0.5;
            color.g = vel.y * 0.5 + 0.5;
            color.b = 0.3; // Dim blue background for contrast
        }

        outColor = vec4(color, 1.0);
    }
`;

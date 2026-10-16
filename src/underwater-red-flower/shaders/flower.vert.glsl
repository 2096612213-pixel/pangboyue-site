#version 300 es
    in vec2 a_pos;
    out vec2 v_uv;
    void main() {
      // Map clip-space [-1, 1] to texture UV [0, 1] with y=0 at top
      v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }

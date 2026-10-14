"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/*
 * React Bits — Prism, as a page background: the edges of a large pyramid of
 * light, spread into their colours (blue at the base, cyan, green and gold
 * towards the apex) and heavily blurred, turning slowly. Plain WebGL (no
 * library): the shader only measures the distance to the eight edges, drawn
 * at a low resolution (the light is soft) and 30 frames per second at most,
 * only while visible. With « reduce motion » a single still frame is drawn.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform vec2 uBase;
uniform float uScale;
uniform float uSoft;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Light spread into its colours, from the base (0) to the apex (1)
vec3 spectrum(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.20, 0.36, 0.86);
  vec3 c1 = vec3(0.32, 0.78, 0.90);
  vec3 c2 = vec3(0.62, 0.90, 0.62);
  vec3 c3 = vec3(0.97, 0.90, 0.55);
  vec3 c4 = vec3(0.99, 0.80, 0.68);
  float s = t * 4.0;
  if (s < 1.0) return mix(c0, c1, s);
  if (s < 2.0) return mix(c1, c2, s - 1.0);
  if (s < 3.0) return mix(c2, c3, s - 2.0);
  return mix(c3, c4, s - 3.0);
}

// Closest distance between a ray and the segment [a, b]; w = position on it.
float raySeg(vec3 ro, vec3 rd, vec3 a, vec3 b, out float w) {
  vec3 v = b - a;
  vec3 w0 = ro - a;
  float bb = dot(rd, v), c = dot(v, v), d = dot(rd, w0), e = dot(v, w0);
  float den = c - bb * bb;
  w = den > 1e-5 ? clamp((e - bb * d) / den, 0.0, 1.0) : 0.0;
  float s = max(bb * w - d, 0.0);
  return length(w0 + s * rd - w * v);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  // Lens shift: the base stays at eye level (a single line) but sits low on screen
  uv -= uBase;
  vec3 ro = vec3(0.0, 0.0, -10.0);
  vec3 rd = normalize(vec3(uv, 4.5));

  float ang = uTime * 0.12 + uPointer.x * 0.25;
  float tilt = uPointer.y * 0.04;
  mat2 rt = rot(tilt), ra = rot(ang);

  // Ray in the prism's own space (base centred on uBase, scaled)
  vec3 lo = ro;
  lo.yz = rt * lo.yz; lo.xz = ra * lo.xz; lo /= uScale;
  vec3 ld = rd; ld.yz = rt * ld.yz; ld.xz = ra * ld.xz;

  const float H = 1.2;
  vec3 A = vec3(0.0, H, 0.0);
  vec3 C0 = vec3(0.5, 0.0, 0.5), C1 = vec3(-0.5, 0.0, 0.5), C2 = vec3(-0.5, 0.0, -0.5), C3 = vec3(0.5, 0.0, -0.5);
  float s2 = uSoft * uSoft;
  float h2 = s2 * 9.0;
  float w, e, g;
  vec3 col = vec3(0.0);
  float amount = 0.0;
  float keep = 1.0;

  // Slanted edges: blue at the base, warm towards the apex
  e = raySeg(lo, ld, C0, A, w); g = (exp(-e * e / s2) * 0.8 + exp(-e * e / h2) * 0.1); col += spectrum(w * 1.7) * g; amount += g; keep *= 1.0 - g;
  e = raySeg(lo, ld, C1, A, w); g = (exp(-e * e / s2) * 0.8 + exp(-e * e / h2) * 0.1); col += spectrum(w * 1.7) * g; amount += g; keep *= 1.0 - g;
  e = raySeg(lo, ld, C2, A, w); g = (exp(-e * e / s2) * 0.8 + exp(-e * e / h2) * 0.1); col += spectrum(w * 1.7) * g; amount += g; keep *= 1.0 - g;
  e = raySeg(lo, ld, C3, A, w); g = (exp(-e * e / s2) * 0.8 + exp(-e * e / h2) * 0.1); col += spectrum(w * 1.7) * g; amount += g; keep *= 1.0 - g;
  // Base: deep blue, a touch of violet
  vec3 baseCol = vec3(0.24, 0.36, 0.86);
  e = raySeg(lo, ld, C0, C1, w); g = (exp(-e * e / s2) * 0.8 + exp(-e * e / h2) * 0.1) * 0.6; col += mix(baseCol, vec3(0.55, 0.45, 0.92), w * 0.4) * g; amount += g; keep *= 1.0 - g;
  e = raySeg(lo, ld, C1, C2, w); g = (exp(-e * e / s2) * 0.8 + exp(-e * e / h2) * 0.1) * 0.6; col += baseCol * g; amount += g; keep *= 1.0 - g;
  e = raySeg(lo, ld, C2, C3, w); g = (exp(-e * e / s2) * 0.8 + exp(-e * e / h2) * 0.1) * 0.6; col += baseCol * g; amount += g; keep *= 1.0 - g;
  e = raySeg(lo, ld, C3, C0, w); g = (exp(-e * e / s2) * 0.8 + exp(-e * e / h2) * 0.1) * 0.6; col += mix(baseCol, vec3(0.55, 0.45, 0.92), w * 0.4) * g; amount += g; keep *= 1.0 - g;

  vec3 c = col / max(amount, 1e-4);
  float a = (1.0 - keep) * 0.9;
  a += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  a = clamp(a, 0.0, 1.0);
  gl_FragColor = vec4(c * a, a);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function Prism({
  className,
  base = [0, -0.3],
  scale = 3.4,
  softness = 0.075,
  speed = 1,
}: {
  className?: string;
  /** Where the base line sits, in fractions of the height from the middle */
  base?: [number, number];
  /** Size of the pyramid */
  scale?: number;
  /** Width of the blurred light along the edges */
  softness?: number;
  speed?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [bx, by] = base;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u("uRes");
    const uTime = u("uTime");
    const uPointer = u("uPointer");
    gl.uniform2f(u("uBase"), bx, by);
    gl.uniform1f(u("uScale"), scale);
    gl.uniform1f(u("uSoft"), softness);
    gl.clearColor(0, 0, 0, 0);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The light is blurred anyway: a low resolution looks the same and costs little
    let quality = 0.4;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const start = performance.now();
    let raf = 0;
    let last = 0;
    let visible = true;
    let frames = 0;
    let slow = 0;

    const draw = (time: number) => {
      gl.uniform1f(uTime, time);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * quality));
      canvas.height = Math.max(1, Math.round(r.height * quality));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      if (reduce) draw(0);
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      raf = requestAnimationFrame(loop);
      const elapsed = now - last;
      if (elapsed < 1000 / 30) return;
      // Slow machine: draw fewer pixels
      if (frames++ > 10 && elapsed > 55 && quality > 0.2) {
        if (++slow > 20) {
          quality *= 0.75;
          slow = 0;
          resize();
        }
      }
      last = now;
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      draw(((now - start) / 1000) * speed);
    };
    const play = () => {
      if (!reduce && !raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      pointer.ty = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
    };
    const onVisibility = () => play();
    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      raf = 0;
      visible = false;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      play();
    });
    io.observe(canvas);
    resize();
    if (reduce) draw(0);
    else play();
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, [bx, by, scale, softness, speed]);

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none block h-full w-full", className)} />;
}

"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/*
 * React Bits — Prism. A glass pyramid with glowing, spectrum-coloured edges
 * turns slowly and leans towards the pointer. Plain WebGL (no library): the
 * shape is ray-marched in the fragment shader at a reduced resolution, at
 * 30 frames per second at most, only while visible. With « reduce motion »
 * (system setting) a single still frame is drawn.
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
uniform float uGlow;
uniform vec2 uCenter;
uniform float uScale;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Square pyramid, base [-0.5, 0.5]² at y = 0, apex at y = h (Inigo Quilez).
float sdPyramid(vec3 p, float h) {
  float m2 = h * h + 0.25;
  p.xz = abs(p.xz);
  p.xz = (p.z > p.x) ? p.zx : p.xz;
  p.xz -= 0.5;
  vec3 q = vec3(p.z, h * p.y - 0.5 * p.x, h * p.x + 0.5 * p.y);
  float s = max(-q.x, 0.0);
  float t = clamp((q.y - 0.5 * p.z) / (m2 + 0.25), 0.0, 1.0);
  float a = m2 * (q.x + s) * (q.x + s) + q.y * q.y;
  float b = m2 * (q.x + 0.5 * t) * (q.x + 0.5 * t) + (q.y - m2 * t) * (q.y - m2 * t);
  float d2 = min(q.y, -q.x * m2 - q.y * 0.5) > 0.0 ? 0.0 : min(a, b);
  return sqrt((d2 + q.z * q.z) / m2) * sign(max(q.z, -p.y));
}

// Brand-tinted spectrum: indigo, violet, ice blue, saffron.
vec3 spectrum(float t) {
  t = fract(t);
  vec3 c0 = vec3(0.36, 0.31, 0.95);
  vec3 c1 = vec3(0.70, 0.55, 1.00);
  vec3 c2 = vec3(0.55, 0.80, 1.00);
  vec3 c3 = vec3(1.00, 0.72, 0.30);
  float s = t * 4.0;
  if (s < 1.0) return mix(c0, c1, smoothstep(0.0, 1.0, s));
  if (s < 2.0) return mix(c1, c2, smoothstep(0.0, 1.0, s - 1.0));
  if (s < 3.0) return mix(c2, c3, smoothstep(0.0, 1.0, s - 2.0));
  return mix(c3, c0, smoothstep(0.0, 1.0, s - 3.0));
}

// Closest distance between a ray and a segment [a, b]; w = position on the segment.
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
  uv -= uCenter;
  vec3 ro = vec3(0.0, 0.0, -3.4);
  vec3 rd = normalize(vec3(uv, 1.55));

  float ang = uTime * 0.22 + uPointer.x * 0.5;
  float tilt = -0.28 + uPointer.y * 0.12;
  const float H = 1.15;
  mat2 rt = rot(tilt), ra = rot(ang);

  // Ray in the prism's own space
  vec3 lo = ro; lo.y += 0.5 * uScale;
  lo.yz = rt * lo.yz; lo.xz = ra * lo.xz; lo /= uScale;
  vec3 ld = rd; ld.yz = rt * ld.yz; ld.xz = ra * ld.xz;

  vec3 col = vec3(0.0);

  // Glass: faint faces and inner light, sampled along the ray
  const int STEPS = 56;
  float tNear = 1.4, tFar = 5.4;
  float dt = (tFar - tNear) / float(STEPS);
  float t = tNear + dt * hash(gl_FragCoord.xy + fract(uTime));
  for (int i = 0; i < STEPS; i++) {
    vec3 p = lo + ld * (t / uScale);
    float d = sdPyramid(p, H) * uScale;
    float ad = abs(d);
    float shell = exp(-ad * 60.0);
    float inner = d < 0.0 ? 0.22 : 0.0;
    vec3 c = spectrum(p.y * 0.55 + atan(p.z, p.x) * 0.16 + uTime * 0.04);
    col += c * (shell * 2.0 + inner) * dt;
    t += dt;
  }

  // Edges: eight glowing lines, coloured along their length
  vec3 A = vec3(0.0, H, 0.0);
  vec3 C0 = vec3(0.5, 0.0, 0.5), C1 = vec3(-0.5, 0.0, 0.5), C2 = vec3(-0.5, 0.0, -0.5), C3 = vec3(0.5, 0.0, -0.5);
  float w, e;
  vec3 edge = vec3(0.0);
  e = raySeg(lo, ld, A, C0, w); edge += spectrum(w * 0.5 + uTime * 0.05) * 0.00042 / (e * e + 0.00022);
  e = raySeg(lo, ld, A, C1, w); edge += spectrum(w * 0.5 + 0.25 + uTime * 0.05) * 0.00042 / (e * e + 0.00022);
  e = raySeg(lo, ld, A, C2, w); edge += spectrum(w * 0.5 + 0.5 + uTime * 0.05) * 0.00042 / (e * e + 0.00022);
  e = raySeg(lo, ld, A, C3, w); edge += spectrum(w * 0.5 + 0.75 + uTime * 0.05) * 0.00042 / (e * e + 0.00022);
  e = raySeg(lo, ld, C0, C1, w); edge += spectrum(w * 0.25 + 0.6 + uTime * 0.05) * 0.0003 / (e * e + 0.00022);
  e = raySeg(lo, ld, C1, C2, w); edge += spectrum(w * 0.25 + 0.85 + uTime * 0.05) * 0.0003 / (e * e + 0.00022);
  e = raySeg(lo, ld, C2, C3, w); edge += spectrum(w * 0.25 + 0.1 + uTime * 0.05) * 0.0003 / (e * e + 0.00022);
  e = raySeg(lo, ld, C3, C0, w); edge += spectrum(w * 0.25 + 0.35 + uTime * 0.05) * 0.0003 / (e * e + 0.00022);
  col += edge;

  // Rays of light around the prism
  vec2 q = uv;
  float r = length(q);
  float th = atan(q.y, q.x);
  float rays = pow(0.5 + 0.5 * sin(th * 9.0 + uTime * 0.25 + sin(th * 3.0 + uTime * 0.2) * 1.5), 6.0);
  col += spectrum(th / 6.2831 + uTime * 0.03) * rays * exp(-r * 2.4) * smoothstep(0.12, 0.42, r) * 0.13;
  // Soft bloom
  col += vec3(0.42, 0.36, 0.95) * exp(-r * 3.2) * 0.18;

  col *= uGlow;
  col = 1.0 - exp(-col * 1.4);
  col += (hash(gl_FragCoord.xy * 0.5 + uTime) - 0.5) * 0.02;
  float a = clamp(max(col.r, max(col.g, col.b)) * 1.1, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
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
  center = [0.04, 0.16],
  scale = 0.72,
  glow = 1,
  speed = 1,
}: {
  className?: string;
  /** Position of the prism, in fractions of the height from the middle */
  center?: [number, number];
  /** Size of the prism */
  scale?: number;
  glow?: number;
  speed?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [cx, cy] = center;

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
    gl.uniform1f(u("uGlow"), glow);
    gl.uniform2f(u("uCenter"), cx, cy);
    gl.uniform1f(u("uScale"), scale);
    gl.clearColor(0, 0, 0, 0);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Rendered below the screen resolution (the glow is soft), lowered again on slow machines
    let quality = Math.min(window.devicePixelRatio || 1, 2) * 0.62;
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
      if (reduce) draw(6);
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      raf = requestAnimationFrame(loop);
      const elapsed = now - last;
      if (elapsed < 1000 / 30) return;
      // Slow machine: draw fewer pixels
      if (frames++ > 10 && elapsed > 55 && quality > 0.35) {
        if (++slow > 20) {
          quality *= 0.75;
          slow = 0;
          resize();
        }
      }
      last = now;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
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
    if (reduce) draw(6);
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
  }, [cx, cy, scale, glow, speed]);

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none block h-full w-full", className)} />;
}

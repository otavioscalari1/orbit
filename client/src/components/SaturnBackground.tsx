import { useEffect, useRef } from 'react'

// Saturno realista de fundo, grande e cortado pela borda da tela, nas cores do Orbit.
// Quem desenha é a placa de vídeo (WebGL): o "fragment shader" abaixo roda uma vez para cada
// pixel e calcula se ele cai no planeta, no anel ou no fundo. Assim o desenho fica nítido em
// qualquer tamanho de tela, sem depender de imagem. O planeta é parado: só é desenhado de novo
// quando o tamanho da área muda, então não gasta nada enquanto a Home está aberta.

const MAX_PIXEL_RATIO = 1.5 // telas muito densas não precisam de mais que isso, e fica mais leve

// Enquadramento, em relação à área do fundo
const PLANET_TOP = 0.5 // altura do topo do planeta (0 = topo da tela, 1 = base)
const RADIUS_BY_WIDTH = 0.52
const RADIUS_BY_HEIGHT = 0.72

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 uCenter;   // centro do planeta, em pixels
uniform float uRadius;  // raio do planeta, em pixels

// Medidas em relação ao raio do planeta (= 1)
const float RING_INNER = 1.28;
const float RING_OUTER = 2.35;

// Inclinação do planeta: o anel sobe da esquerda para a direita, visto quase de lado
const float TILT = -0.13;
const float ROLL = 0.55;

const vec3 INK = vec3(0.043, 0.051, 0.063);    // cor ink do tema
const vec3 BRAND = vec3(0.353, 0.82, 0.925);   // cor brand do tema
const vec3 DEEP = vec3(0.02, 0.09, 0.14);
const vec3 MID = vec3(0.09, 0.36, 0.47);
const vec3 LIGHT_BAND = vec3(0.45, 0.82, 0.92);
const vec3 PALE = vec3(0.86, 0.97, 1.0);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Ruído suave: dá a aparência natural às faixas de nuvens e ao anel
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    amplitude *= 0.5;
  }
  return value;
}

// Quanto o anel é "cheio" a cada distância do planeta, com os vãos entre as faixas
float ringDensity(float r) {
  if (r < RING_INNER || r > RING_OUTER) return 0.0;
  float edges = smoothstep(RING_INNER, RING_INNER + 0.02, r) * (1.0 - smoothstep(RING_OUTER - 0.015, RING_OUTER, r));
  // Sem detalhes mais finos que isso: o anel é visto quase de lado e eles virariam pontilhado na tela
  float density = 0.3 + 0.45 * noise(vec2(r * 14.0, 1.0)) + 0.25 * noise(vec2(r * 42.0, 2.0));
  density *= mix(0.3, 1.0, smoothstep(1.5, 1.58, r));                                    // faixa interna, mais fraca
  density *= 1.0 - 0.92 * smoothstep(1.92, 1.95, r) * (1.0 - smoothstep(2.0, 2.03, r));  // divisão de Cassini
  return clamp(density, 0.0, 1.0) * edges;
}

void main() {
  vec3 axis = vec3(-sin(ROLL) * cos(TILT), cos(ROLL) * cos(TILT), sin(TILT));
  vec3 east = normalize(cross(axis, vec3(0.0, 0.0, 1.0)));
  vec3 north = cross(axis, east);
  vec3 lightDir = normalize(vec3(0.62, 0.5, 0.6)); // sol no alto, à direita: o lado do texto fica escuro

  float pixel = 1.0 / uRadius;
  vec2 p = (gl_FragCoord.xy - uCenter) * pixel;
  float dist = length(p);

  // Fundo: a cor do tema, com um brilho leve da atmosfera em volta do lado iluminado
  vec3 color = INK;
  float litSide = smoothstep(-0.4, 0.8, dot(p / max(dist, 0.001), normalize(lightDir.xy)));
  color += BRAND * 0.16 * exp(-max(dist - 1.0, 0.0) * 5.0) * litSide;

  // Altura do planeta neste pixel: é ela que diz se o anel passa na frente ou atrás
  float planetZ = sqrt(max(0.0, 1.0 - dist * dist));
  float centerRingZ = -(axis.x * p.x + axis.y * p.y) / axis.z;
  bool ringInFront = centerRingZ > planetZ;

  // Anel: 4 amostras por pixel, para as linhas finas não ficarem serrilhadas
  vec3 ringColor = vec3(0.0);
  float ringAlpha = 0.0;
  for (int i = 0; i < 4; i++) {
    float index = float(i);
    vec2 offset = (vec2(mod(index, 2.0), floor(index / 2.0)) - 0.5) * 0.5 * pixel;
    vec2 q = p + offset;
    vec3 point = vec3(q, -(axis.x * q.x + axis.y * q.y) / axis.z);
    float density = ringDensity(length(point));
    if (density <= 0.0) continue;

    // Sombra do planeta sobre o anel
    float along = dot(point, lightDir);
    float shadow = 1.0;
    if (along < 0.0) shadow = mix(0.05, 1.0, smoothstep(0.97, 1.03, length(point - lightDir * along)));

    // Tom de gelo, mais claro que o planeta, para o anel se destacar quando passa na frente dele
    vec3 tint = mix(LIGHT_BAND * 0.6, PALE, smoothstep(0.25, 0.75, density)) * 0.95;
    float alpha = density * 0.92;
    ringColor += tint * shadow * alpha;
    ringAlpha += alpha;
  }
  ringColor *= 0.25;
  ringAlpha *= 0.25;

  // Primeiro a parte do anel que fica atrás do planeta
  if (!ringInFront) color = color * (1.0 - ringAlpha) + ringColor;

  // Planeta
  float coverage = 1.0 - smoothstep(1.0 - pixel * 1.5, 1.0, dist);
  if (coverage > 0.0) {
    vec3 normal = vec3(p, planetZ);
    float latitude = asin(clamp(dot(normal, axis), -1.0, 1.0));
    float longitude = atan(dot(normal, north), dot(normal, east));
    vec2 around = vec2(cos(longitude), sin(longitude)) * 2.5;

    float wavy = latitude + 0.018 * (fbm(around * 1.5 + latitude * 10.0) - 0.5);
    float bands = 0.55 * noise(vec2(wavy * 9.0, 3.0)) + 0.3 * noise(vec2(wavy * 23.0, 7.0)) + 0.15 * noise(vec2(wavy * 61.0, 11.0));
    vec3 albedo = mix(MID * 0.55, LIGHT_BAND * 0.62, smoothstep(0.25, 0.75, bands));

    float facing = dot(normal, lightDir);
    float diffuse = pow(smoothstep(-0.05, 1.0, facing), 1.2);
    vec3 surface = albedo * diffuse * 1.1 + PALE * pow(max(facing, 0.0), 8.0) * 0.18;
    surface *= mix(0.55, 1.0, pow(planetZ, 0.4));   // a borda escurece, como em uma esfera de verdade
    surface += DEEP * 0.25;                         // o lado da noite não fica preto puro

    // Sombra do anel sobre o planeta
    float lightOnAxis = dot(lightDir, axis);
    float travel = -dot(normal, axis) / lightOnAxis;
    if (travel > 0.0) surface *= 1.0 - 0.75 * ringDensity(length(normal + lightDir * travel));

    // Contorno fino de atmosfera
    surface += BRAND * pow(1.0 - planetZ, 4.0) * (0.12 + 0.5 * max(facing + 0.2, 0.0));

    color = mix(color, surface, coverage);
  }

  // Depois a parte do anel que passa na frente
  if (ringInFront) color = color * (1.0 - ringAlpha) + ringColor;

  // Um ruído mínimo evita "degraus" visíveis nos degradês escuros
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Erro no desenho de Saturno:', gl.getShaderInfoLog(shader))
    return null
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Erro no desenho de Saturno:', gl.getProgramInfoLog(program))
    return null
  }
  return program
}

export function SaturnBackground({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    // Sem WebGL o fundo só fica na cor do tema: o planeta é enfeite, nada da Home depende dele
    const gl = canvas?.getContext('webgl', { alpha: false, antialias: false })
    if (!canvas || !gl) return
    const program = createProgram(gl)
    if (!program) return

    gl.useProgram(program)
    // Um triângulo que cobre a tela inteira: o shader pinta cada pixel dentro dele
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const centerUniform = gl.getUniformLocation(program, 'uCenter')
    const radiusUniform = gl.getUniformLocation(program, 'uRadius')

    // Ajusta o canvas e o enquadramento do planeta ao tamanho da área e desenha
    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
      const width = Math.round(canvas!.clientWidth * ratio)
      const height = Math.round(canvas!.clientHeight * ratio)
      canvas!.width = width
      canvas!.height = height
      gl!.viewport(0, 0, width, height)

      const radius = Math.max(width * RADIUS_BY_WIDTH, height * RADIUS_BY_HEIGHT)
      // No WebGL o y cresce para cima, ao contrário da tela
      gl!.uniform2f(centerUniform, width / 2, height - (height * PLANET_TOP + radius))
      gl!.uniform1f(radiusUniform, radius)
      gl!.drawArrays(gl!.TRIANGLES, 0, 3)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    return () => observer.disconnect()
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className={'h-full w-full ' + className} />
}

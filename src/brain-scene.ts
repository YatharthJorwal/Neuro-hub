// Ported from Neuro-hub/index.html's inline <script type="module">.
// Same generation logic and render loop, unchanged, just:
//   - scoped to a `root` element instead of `document.body` / `document.getElementById`
//   - wrapped in a function that returns a cleanup callback, so React's
//     useEffect (and StrictMode's mount->unmount->remount in dev) doesn't
//     leak renderers, RAF loops, or window listeners.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

type Region = [string, number, number, number, number, number, number, number, number, number];
type Node = { id: number; region: string; x: number; y: number; z: number; radius: number; hue: number; sat: number; lit: number };
type Edge = { a: number; b: number; length: number };
type Pulse = { a: number; b: number; t: number; speed: number };

export function mountBrainScene(root: HTMLElement): () => void {
  let disposed = false;
  let rafId = 0;

  const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  if (isTouch) {
    root.classList.add("touch");
    const hintEl = root.querySelector<HTMLElement>("#hint");
    if (hintEl) hintEl.textContent = "Left stick to fly · Drag to look · Tap a neuron";
  }

  function mulberry32(a: number) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randn(rng: () => number) {
    const u = Math.max(rng(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }
  const rng = mulberry32(0xc0a1);
  const rand = (a: number, b: number) => a + (b - a) * rng();

  const REGIONS: Region[] = [
    ["Prefrontal Cortex", 6.6, 3.2, 4.0, 2.4, 1.5, 2.2, 36, 0.53, 1],
    ["Motor Cortex", 5.0, 4.4, 0.5, 2.1, 1.3, 1.9, 32, 0.5, 1],
    ["Somatosensory Cortex", 4.8, 4.0, -2.8, 2.0, 1.3, 1.8, 30, 0.48, 1],
    ["Parietal Cortex", 4.4, 3.2, -5.2, 1.9, 1.3, 1.8, 28, 0.51, 1],
    ["Visual Cortex", 6.0, 1.1, -7.0, 2.3, 1.6, 2.0, 38, 0.56, 1],
    ["Auditory Cortex", 8.4, 0.5, -1.1, 1.7, 1.2, 1.6, 24, 0.58, 1],
    ["Temporal Lobe", 7.6, -1.3, 2.0, 2.1, 1.5, 2.0, 30, 0.54, 1],
    ["Hippocampus", 3.1, -2.5, 0.3, 1.5, 1.0, 1.4, 18, 0.46, 1],
    ["Thalamus", 0, 0.25, -0.3, 1.4, 1.1, 1.3, 28, 0.49, 0],
    ["Cerebellum", 0, -4.6, -6.0, 2.8, 1.6, 2.2, 44, 0.44, 0],
    ["Brainstem", 0, -6.6, -2.1, 1.1, 1.5, 1.2, 22, 0.41, 0],
    ["Corpus Callosum", 0, 1.4, 0.4, 2.2, 0.7, 1.4, 24, 0.52, 0],
  ];

  const nodes: Node[] = [];
  function pushCluster(r: Region, sign: number, label: string) {
    const count = r[7];
    for (let n = 0; n < count; n++) {
      const hub = n < 2;
      nodes.push({
        id: nodes.length, region: label,
        x: r[1] * sign + r[4] * randn(rng),
        y: r[2] + r[5] * randn(rng),
        z: r[3] + r[6] * randn(rng),
        radius: hub ? rand(0.32, 0.52) : 0.09 + (0.24 * rng()) ** 1.25,
        hue: r[8] + rand(-0.03, 0.03), sat: rand(0.48, 0.78), lit: rand(0.58, 0.78),
      });
    }
  }
  for (const r of REGIONS) {
    if (r[9]) { pushCluster(r, 1, "Right " + r[0]); pushCluster(r, -1, "Left " + r[0]); }
    else pushCluster(r, 1, r[0]);
  }

  function dist2(i: number, j: number) {
    const a = nodes[i], b = nodes[j];
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }
  const adjacency: number[][] = nodes.map(() => []);
  const edges: Edge[] = [];
  const seen = new Set<string>();
  function addEdge(a: number, b: number) {
    if (a === b) return;
    const lo = Math.min(a, b), hi = Math.max(a, b), key = lo + "-" + hi;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a: lo, b: hi, length: Math.sqrt(dist2(lo, hi)) });
    adjacency[lo].push(hi); adjacency[hi].push(lo);
  }
  for (let i = 0; i < nodes.length; i++) {
    const scored: [number, number][] = [];
    for (let j = 0; j < nodes.length; j++) if (j !== i) scored.push([j, dist2(i, j)]);
    scored.sort((a, b) => a[1] - b[1]);
    for (let k = 0; k < 5 && k < scored.length; k++) addEdge(i, scored[k][0]);
    if (rng() < 0.16) addEdge(i, Math.floor(rng() * nodes.length));
  }

  const nCountEl = root.querySelector<HTMLElement>("#nCount");
  const eCountEl = root.querySelector<HTMLElement>("#eCount");
  const fCountEl = root.querySelector<HTMLElement>("#fCount");
  if (nCountEl) nCountEl.textContent = String(nodes.length);
  if (eCountEl) eCountEl.textContent = String(edges.length);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x07070a, 1);
  renderer.toneMapping = THREE.NoToneMapping;
  root.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07070a);
  scene.fog = new THREE.FogExp2(0x07070a, 0.016);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.12, 90);
  camera.position.set(0.4, 1.35, 7.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 0.7;
  controls.maxDistance = 34;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.32;

  scene.add(new THREE.HemisphereLight(0x9fd7dc, 0x14141c, 0.55));
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const p1 = new THREE.PointLight(0x9ee8e4, 18, 36); p1.position.set(0, 3.5, 0); scene.add(p1);

  const shell = new THREE.Mesh(new THREE.SphereGeometry(44, 32, 24), new THREE.MeshBasicMaterial({ color: 0x0b0b12, side: THREE.BackSide }));
  scene.add(shell);

  const pos = new Float32Array(edges.length * 6);
  const col = new Float32Array(edges.length * 6);
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i], na = nodes[e.a], nb = nodes[e.b], o = i * 6;
    pos[o] = na.x; pos[o + 1] = na.y; pos[o + 2] = na.z;
    pos[o + 3] = nb.x; pos[o + 4] = nb.y; pos[o + 5] = nb.z;
    const fade = 0.22 + 0.5 * (1 - Math.min(e.length / 14, 1));
    col[o] = col[o + 3] = fade * 0.45; col[o + 1] = col[o + 4] = fade * 0.92; col[o + 2] = col[o + 5] = fade;
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  lineGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  })));

  const dummy = new THREE.Object3D();
  const nodeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ toneMapped: false }), nodes.length);
  const color = new THREE.Color();
  const fire = new THREE.Color(0xeafcff);
  const hoverCol = new THREE.Color(0xffe566);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    dummy.position.set(n.x, n.y, n.z);
    dummy.scale.setScalar(n.radius);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(i, dummy.matrix);
    nodeMesh.setColorAt(i, color.setHSL(n.hue, n.sat, n.lit));
  }
  nodeMesh.instanceMatrix.needsUpdate = true;
  if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
  scene.add(nodeMesh);

  const MAXP = 80;
  const pulseMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({
    color: 0xf4ffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }), MAXP);
  pulseMesh.raycast = () => {};
  scene.add(pulseMesh);
  const trailPos = new Float32Array(MAXP * 6);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  scene.add(new THREE.LineSegments(trailGeo, new THREE.LineBasicMaterial({
    color: 0xd9ffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  })));

  const pulses: Pulse[] = [];
  for (let i = 0; i < MAXP; i++) {
    const e = edges[Math.floor((i / MAXP) * edges.length)];
    pulses.push({ a: e.a, b: e.b, t: Math.random(), speed: 2.2 + Math.random() * 3.4 });
  }
  const glow = new Float32Array(nodes.length);

  const keys = new Set<string>();
  const stick = { x: 0, y: 0 };
  let entered = false, hoverId: number | null = null, selectedId: number | null = null, statsAcc = 0;
  const GAME = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight"]);

  const onKeydown = (e: KeyboardEvent) => { if (GAME.has(e.code)) e.preventDefault(); keys.add(e.code); };
  const onKeyup = (e: KeyboardEvent) => keys.delete(e.code);
  const onBlur = () => keys.clear();
  addEventListener("keydown", onKeydown);
  addEventListener("keyup", onKeyup);
  addEventListener("blur", onBlur);

  function axes() {
    let x = stick.x, y = stick.y;
    if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) y -= 1;
    const m = Math.hypot(x, y);
    return m > 1 ? { x: x / m, y: y / m } : { x, y };
  }

  const stickEl = root.querySelector<HTMLElement>("#stick")!;
  const knob = root.querySelector<HTMLElement>("#knob")!;
  const MAXK = 36;
  let pid: number | null = null;
  function setKnob(dx: number, dy: number) {
    const mag = Math.hypot(dx, dy);
    if (mag > MAXK) { dx = (dx / mag) * MAXK; dy = (dy / mag) * MAXK; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    stick.x = dx / MAXK;
    stick.y = -dy / MAXK;
  }
  function releaseStick() { pid = null; setKnob(0, 0); stick.x = stick.y = 0; knob.style.opacity = ".7"; }
  const onStickDown = (e: PointerEvent) => {
    e.preventDefault(); pid = e.pointerId; stickEl.setPointerCapture(e.pointerId); knob.style.opacity = "1";
    const r = stickEl.getBoundingClientRect();
    setKnob(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  };
  const onStickMove = (e: PointerEvent) => {
    if (pid !== e.pointerId) return;
    const r = stickEl.getBoundingClientRect();
    setKnob(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  };
  stickEl.addEventListener("pointerdown", onStickDown);
  stickEl.addEventListener("pointermove", onStickMove);
  stickEl.addEventListener("pointerup", releaseStick);
  stickEl.addEventListener("pointercancel", releaseStick);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tooltip = root.querySelector<HTMLElement>("#tooltip")!;
  const onPointerMove = (e: PointerEvent) => {
    if (!entered) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(nodeMesh);
    if (hits.length && hits[0].instanceId != null) {
      const id = hits[0].instanceId as number;
      hoverId = id;
      const n = nodes[id];
      tooltip.style.display = "block";
      tooltip.style.left = Math.min(e.clientX + 16, innerWidth - 180) + "px";
      tooltip.style.top = Math.min(e.clientY + 16, innerHeight - 72) + "px";
      tooltip.querySelector(".id")!.textContent = "Neuron #" + n.id + " (Active)";
      tooltip.querySelector(".reg")!.textContent = n.region;
    } else {
      hoverId = null;
      tooltip.style.display = "none";
    }
  };
  const onClick = () => { if (entered && hoverId != null) selectedId = hoverId; };
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("click", onClick);

  const enterBtn = root.querySelector<HTMLElement>("#enter")!;
  const gateEl = root.querySelector<HTMLElement>("#gate")!;
  const onEnterClick = (e: Event) => { e.stopPropagation(); entered = true; root.classList.add("entered"); };
  const onGateClick = () => { entered = true; root.classList.add("entered"); };
  enterBtn.addEventListener("click", onEnterClick);
  gateEl.addEventListener("click", onGateClick);
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  const clock = new THREE.Clock();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const pulsePos = new THREE.Vector3();
  const trailStart = new THREE.Vector3();

  function tick() {
    if (disposed) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    controls.update();

    if (entered) {
      const a = axes();
      let lift = 0;
      if (keys.has("Space")) lift += 1;
      if (keys.has("ShiftLeft") || keys.has("ShiftRight")) lift -= 1;
      if (Math.abs(a.x) + Math.abs(a.y) + Math.abs(lift) > 0.02) {
        controls.autoRotate = false;
        camera.getWorldDirection(fwd);
        right.crossVectors(fwd, up);
        if (right.lengthSq() < 1e-8) right.set(1, 0, 0); else right.normalize();
        const sp = 7.4 * dt;
        const dx = fwd.x * a.y * sp + right.x * a.x * sp;
        const dy = fwd.y * a.y * sp + right.y * a.x * sp + lift * sp;
        const dz = fwd.z * a.y * sp + right.z * a.x * sp;
        const nx = camera.position.x + dx, ny = camera.position.y + dy, nz = camera.position.z + dz;
        if (nx * nx + ny * ny + nz * nz < 28 * 28) {
          camera.position.set(nx, ny, nz);
          controls.target.x += dx; controls.target.y += dy; controls.target.z += dz;
        }
      }
    }

    const decay = Math.exp(-dt * 1.85);
    for (let i = 0; i < glow.length; i++) glow[i] *= decay;
    for (let p = 0; p < pulses.length; p++) {
      const pulse = pulses[p];
      const na = nodes[pulse.a], nb = nodes[pulse.b];
      from.set(na.x, na.y, na.z); to.set(nb.x, nb.y, nb.z);
      pulse.t += (pulse.speed / Math.max(0.35, from.distanceTo(to))) * dt;
      if (pulse.t >= 1) {
        glow[pulse.b] = 1;
        const neigh = adjacency[pulse.b];
        let next: number | null = neigh[Math.floor(Math.random() * neigh.length)];
        pulse.a = pulse.b; pulse.b = next == null ? edges[Math.floor(Math.random() * edges.length)].b : next;
        pulse.t = 0; pulse.speed = 2.2 + Math.random() * 3.4;
        from.set(nodes[pulse.a].x, nodes[pulse.a].y, nodes[pulse.a].z);
        to.set(nodes[pulse.b].x, nodes[pulse.b].y, nodes[pulse.b].z);
      }
      pulsePos.lerpVectors(from, to, pulse.t);
      dummy.position.copy(pulsePos);
      dummy.scale.setScalar(0.11 + 0.08 * Math.sin(pulse.t * Math.PI));
      dummy.updateMatrix();
      pulseMesh.setMatrixAt(p, dummy.matrix);
      trailStart.lerpVectors(from, to, Math.max(0, pulse.t - 0.12));
      const o = p * 6;
      trailPos[o] = trailStart.x; trailPos[o + 1] = trailStart.y; trailPos[o + 2] = trailStart.z;
      trailPos[o + 3] = pulsePos.x; trailPos[o + 4] = pulsePos.y; trailPos[o + 5] = pulsePos.z;
    }
    pulseMesh.instanceMatrix.needsUpdate = true;
    trailGeo.attributes.position.needsUpdate = true;

    let active = 0;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i], g = glow[i];
      if (g > 0.18) active++;
      const hi = i === hoverId || i === selectedId ? 0.45 : 0;
      dummy.position.set(n.x, n.y, n.z);
      dummy.scale.setScalar(n.radius * (1 + 0.7 * g + hi));
      dummy.updateMatrix();
      nodeMesh.setMatrixAt(i, dummy.matrix);
      color.setHSL(n.hue, n.sat, n.lit).lerp(fire, g);
      if (i === selectedId || i === hoverId) color.copy(hoverCol);
      nodeMesh.setColorAt(i, color);
    }
    nodeMesh.instanceMatrix.needsUpdate = true;
    if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;

    statsAcc += dt;
    if (statsAcc > 0.2) { statsAcc = 0; if (fCountEl) fCountEl.textContent = String(active); }

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener("resize", onResize);

  // Cleanup: called from React's useEffect teardown.
  return function unmount() {
    disposed = true;
    cancelAnimationFrame(rafId);
    removeEventListener("keydown", onKeydown);
    removeEventListener("keyup", onKeyup);
    removeEventListener("blur", onBlur);
    removeEventListener("resize", onResize);
    stickEl.removeEventListener("pointerdown", onStickDown);
    stickEl.removeEventListener("pointermove", onStickMove);
    stickEl.removeEventListener("pointerup", releaseStick);
    stickEl.removeEventListener("pointercancel", releaseStick);
    renderer.domElement.removeEventListener("pointermove", onPointerMove);
    renderer.domElement.removeEventListener("click", onClick);
    enterBtn.removeEventListener("click", onEnterClick);
    gateEl.removeEventListener("click", onGateClick);
    controls.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

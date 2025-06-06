import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

const BRICK_COUNT = 888; // total bricks
const BRICK_SIZE: [number, number, number] = [0.22, 0.11, 0.11]; // metres (w, h, d)
const COLUMNS = 32; // bricks per row before we start arching
const RADIUS = 2.7; // inner radius of the arch (metres)
const BRICK_COLOR = "#8a2be2"; // neon‑friendly base tint

/** Utility — lay bricks in an arch‑shaped wall.
 * we approximate an arch by placing rows; rows above the spring‑line
 * bend inwards along the circle equation x² + y² = R². */
function layoutBrickPosition(i: number): THREE.Vector3 {
  const col = i % COLUMNS;
  const row = Math.floor(i / COLUMNS);

  // base grid coords
  const xGrid = (col - COLUMNS / 2 + 0.5) * BRICK_SIZE[0] * 1.05;
  const yGrid = row * BRICK_SIZE[1] * 1.05;

  // If we’re higher than the spring‑line, bend towards centre
  const springLine = 4; // rows before the curve begins — tweak as needed
  let x = xGrid;
  let y = yGrid;

  if (row >= springLine) {
    // map the grid y to arch curve: y = R - sqrt(R² - x²)
    const effectiveY = (row - springLine + 0.5) * BRICK_SIZE[1] * 1.05;
    const arcY = RADIUS - Math.sqrt(Math.max(RADIUS * RADIUS - x * x, 0));
    y = springLine * BRICK_SIZE[1] * 1.05 + effectiveY + arcY;
  }

  return new THREE.Vector3(x, y, 0);
}

function Bricks() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Build transformation matrices once on mount
  useMemo(() => {
    if (!meshRef.current) return;

    for (let i = 0; i < BRICK_COUNT; i++) {
      const pos = layoutBrickPosition(i);
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, BRICK_COUNT]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={BRICK_SIZE} />
      <meshStandardMaterial
        color={BRICK_COLOR}
        emissive={BRICK_COLOR}
        emissiveIntensity={0.6}
      />
    </instancedMesh>
  );
}

export default function FricksArch() {
  return (
    <Canvas
      shadows
      dpr={Math.min(window.devicePixelRatio, 2)}
      camera={{ position: [0, 1.8, 5], fov: 55 }}
      style={{ width: "100vw", height: "100vh", touchAction: "none" }}
    >
      {/* Lights */}
      <color attach="background" args={["#0b0630"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 6, 4]} intensity={1.2} castShadow />

      {/* The 888 FRICKS */}
      <Bricks />

      {/* Neon label floating above */}
      <Html
        position={[0, 4.2, 0]}
        transform
        scale={0.5}
        style={{ pointerEvents: "none" }}
      >
        <h1
          style={{
            color: "#ff3bff",
            fontFamily: "monospace",
            fontSize: "64px",
            textShadow: "0 0 20px #ff3bff",
            margin: 0,
          }}
        >
          /FRICKS
        </h1>
      </Html>

      {/* Orbit controls for exploration, limited for mobile ergonomics */}
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        maxPolarAngle={Math.PI / 2}
        minDistance={2.5}
        maxDistance={8}
      />
    </Canvas>
  );
}

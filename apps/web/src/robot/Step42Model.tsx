import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CatmullRomCurve3, ExtrudeGeometry, MathUtils, Shape, Vector3 } from 'three';
import type { Group } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Step42Mood } from './Step42Scene.js';

interface ModelProps { mood: Step42Mood; reducedMotion: boolean; active: boolean;greeting?:boolean;reaction?:number }
const WHITE = '#f9f8f4';
const INK = '#202233';
const PURPLE = '#925de7';
const MINT = '#92efce';

function RoundedShell({ size, radius, position = [0, 0, 0], color = WHITE, metalness = 0.1 }: { size: [number, number, number]; radius: number; position?: [number, number, number]; color?: string; metalness?: number }) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => new RoundedBoxGeometry(width, height, depth, 5, radius), [width, height, depth, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={position} castShadow receiveShadow><meshPhysicalMaterial color={color} roughness={0.29} metalness={metalness} clearcoat={0.8} clearcoatRoughness={0.2} /></mesh>;
}
function FaceStroke({ points, radius = 0.035, color = '#ddadff' }: { points: readonly [number, number, number][]; radius?: number; color?: string }) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map((point) => new Vector3(...point))), [points]);
  return <mesh><tubeGeometry args={[curve, 28, radius, 8, false]} /><meshStandardMaterial color="#38204f" emissive={color} emissiveIntensity={1.1} toneMapped={false} roughness={0.3} /></mesh>;
}
const LEFT_EYE: [number, number, number][] = [[-0.65,0.05,1.06],[-0.58,0.18,1.085],[-0.46,0.22,1.1],[-0.34,0.18,1.11],[-0.28,0.05,1.12]];
const RIGHT_EYE: [number, number, number][] = LEFT_EYE.map(([x,y,z]) => [-x,y,z]);
const SMILE: [number, number, number][] = [[-0.22,-0.22,1.11],[-0.12,-0.29,1.135],[0,-0.31,1.14],[0.12,-0.29,1.135],[0.22,-0.22,1.11]];
const SUCCESS_SMILE: [number, number, number][] = [[-0.29,-0.19,1.11],[-0.17,-0.31,1.135],[0,-0.36,1.14],[0.17,-0.31,1.135],[0.29,-0.19,1.11]];

function Hand() {
  return <group position={[0,-0.36,0.03]}>
    <RoundedShell size={[0.29,0.32,0.24]} radius={0.1} />
  </group>;
}
function Arm({ side, armRef, elbowRef }: { side: number; armRef: RefObject<Group | null>; elbowRef: RefObject<Group | null> }) {
  return <group ref={armRef} position={[side * 0.77,1.69,0]} rotation={[0,0,side * 0.25]}>
    <mesh castShadow><sphereGeometry args={[0.19,20,16]} /><meshStandardMaterial color={INK} metalness={0.7} roughness={0.25} /></mesh>
    <RoundedShell size={[0.29,0.46,0.31]} radius={0.13} position={[0,-0.27,0]} />
    <mesh position={[0,-0.5,0]} castShadow><sphereGeometry args={[0.135,20,16]} /><meshStandardMaterial color={PURPLE} metalness={0.45} roughness={0.25} /></mesh>
    <group ref={elbowRef} position={[0,-0.5,0]}>
      <RoundedShell size={[0.27,0.36,0.29]} radius={0.12} position={[0,-0.16,0.02]} />
      <mesh position={[0,-0.32,0.025]}><torusGeometry args={[0.12,0.025,8,24]} /><meshStandardMaterial color={INK} metalness={0.6} /></mesh>
      <Hand />
    </group>
  </group>;
}

export default function Step42Model({ mood, reducedMotion, active,greeting=false,reaction=0 }: ModelProps) {
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftElbow = useRef<Group>(null);
  const rightElbow = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const elapsed = useRef(0);
  const celebrationTime = useRef(0);
  const previousMood = useRef(mood);
  const greetingTime=useRef(0);
  // Взгляд за курсором (декор): только поворот головы, без влияния на игру; при reduced-motion не работает.
  const look = useRef({ x: 0, y: 0, at: -1e9 });
  const { gl } = useThree();
  useEffect(() => {
    if (!active || reducedMotion) return;
    const move = (event: PointerEvent) => {
      const box = gl.domElement.getBoundingClientRect();
      if (!box.width) return;
      look.current.x = Math.max(-1, Math.min(1, (event.clientX - (box.left + box.width / 2)) / (innerWidth * .45)));
      look.current.y = Math.max(-1, Math.min(1, (event.clientY - (box.top + box.height * .3)) / (innerHeight * .6)));
      look.current.at = performance.now();
    };
    addEventListener('pointermove', move, { passive: true });
    return () => removeEventListener('pointermove', move);
  }, [gl, active, reducedMotion]);
  const invalidate = useThree((state) => state.invalidate);
  const faceGeometry = useMemo(() => {
    const outline = new Shape();
    outline.moveTo(-0.72,-0.53);
    outline.lineTo(0.72,-0.53);
    outline.quadraticCurveTo(1.04,-0.53,1.04,-0.21);
    outline.lineTo(1.04,0.21);
    outline.quadraticCurveTo(1.04,0.53,0.72,0.53);
    outline.lineTo(-0.72,0.53);
    outline.quadraticCurveTo(-1.04,0.53,-1.04,0.21);
    outline.lineTo(-1.04,-0.21);
    outline.quadraticCurveTo(-1.04,-0.53,-0.72,-0.53);
    const geometry = new ExtrudeGeometry(outline, { depth: 0.08, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 4, curveSegments: 12, steps: 6 });
    const positions = geometry.attributes.position!;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      positions.setZ(i, positions.getZ(i) + 0.10 * Math.max(0, 1 - (x / 1.08) ** 2));
    }
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => faceGeometry.dispose(), [faceGeometry]);
  useLayoutEffect(()=>{greetingTime.current=0;invalidate();},[reaction,invalidate]);
  useLayoutEffect(() => {
    if (previousMood.current !== mood) { celebrationTime.current = 0; previousMood.current = mood; }
    if (reducedMotion) {
      if (leftArm.current) leftArm.current.rotation.z = mood === 'success' ? -1.9 : mood === 'attention' ? -0.75 : -0.25;
      if (rightArm.current) rightArm.current.rotation.z = greeting?1.25:mood === 'success' ? 1.9 : 0.25;
      leftElbow.current?.rotation.set(mood === 'attention' ? -0.65 : 0,0,0);
      rightElbow.current?.rotation.set(0,0,0);
      head.current?.rotation.set(greeting ? 0.12 : 0,mood === 'attention' ? -0.18 : 0,-0.06);
      body.current?.rotation.set(0,0,0);
      if (eyes.current) eyes.current.scale.y = 1;
    }
    invalidate();
  }, [mood, reducedMotion, greeting, invalidate]);
  useFrame((_, delta) => {
    if (!active || reducedMotion) return;
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;
    if(greeting)greetingTime.current+=dt;
    if (mood === 'success') celebrationTime.current += dt;
    const time = elapsed.current;
    const attention = mood === 'attention';
    const cheer = celebrationTime.current;
    const lift = mood === 'success'
      ? MathUtils.smoothstep(cheer,0,0.32) * (1 - MathUtils.smoothstep(cheer,1.1,1.85))
      : 0;
    const sway = Math.sin(time * 1.55);
    const wave = Math.sin(cheer * 13) * lift;
    const blinkPhase = (time + 1.5) % 5.4;
    const blink = MathUtils.smoothstep(blinkPhase,0,0.065) * (1 - MathUtils.smoothstep(blinkPhase,0.065,0.19));
    if (eyes.current) eyes.current.scale.y = 1 - 0.88 * blink;
    if (body.current) body.current.rotation.z = sway * 0.014 + wave * 0.018;
    if (head.current) {
      head.current.rotation.x = MathUtils.damp(head.current.rotation.x, (attention ? 0.1 + sway * 0.035 : -lift * 0.14)+(greeting?Math.sin(greetingTime.current*8)*.12:0), 7, dt);
      const following = !attention && performance.now() - look.current.at < 4000;
      head.current.rotation.y = MathUtils.damp(head.current.rotation.y, attention ? -0.24 : following ? look.current.x * 0.45 : Math.sin(time * 0.65) * 0.07, 5, dt);
      if (following) head.current.rotation.x = MathUtils.damp(head.current.rotation.x, look.current.y * 0.2, 6, dt);
      head.current.rotation.z = MathUtils.damp(head.current.rotation.z, -0.055 + sway * 0.025 + wave * 0.04, 8, dt);
    }
    if (leftArm.current) leftArm.current.rotation.z = MathUtils.damp(leftArm.current.rotation.z, -0.25 - (attention ? 0.46 : 0) - lift * 1.72, 10, dt);
    if (rightArm.current) rightArm.current.rotation.z = MathUtils.damp(rightArm.current.rotation.z, 0.25 + lift * 1.72+(greeting?1.15+Math.sin(greetingTime.current*16)*.22:0), 10, dt);
    if (leftElbow.current) leftElbow.current.rotation.x = MathUtils.damp(leftElbow.current.rotation.x, attention ? -0.82 : -lift * 0.52, 9, dt);
    if (rightElbow.current) rightElbow.current.rotation.z = MathUtils.damp(rightElbow.current.rotation.z, wave * 0.27, 16, dt);
  });
  return <group rotation={[0,-0.12,0]}>
    {[-1,1].map((side) => <group key={side} position={[side * 0.35,0.3,0]}>
      <mesh position={[0,0.2,0]} castShadow><sphereGeometry args={[0.19,20,16]} /><meshStandardMaterial color={INK} metalness={0.65} roughness={0.25} /></mesh>
      <RoundedShell size={[0.34,0.43,0.38]} radius={0.14} position={[0,0.31,0]} />
      <RoundedShell size={[0.52,0.25,0.68]} radius={0.12} position={[0,-0.05,0.14]} />
      <mesh position={[0,-0.145,0.16]}><boxGeometry args={[0.37,0.035,0.4]} /><meshStandardMaterial color={PURPLE} emissive={PURPLE} emissiveIntensity={0.35} /></mesh>
    </group>)}
    <group ref={body}>
      <RoundedShell size={[1.38,1.34,0.97]} radius={0.45} position={[0,1.38,0]} />
      <mesh position={[0,0.78,0]} castShadow><sphereGeometry args={[0.36,24,16]} /><meshStandardMaterial color={INK} metalness={0.65} roughness={0.26} /></mesh>
      <mesh position={[0,1.54,0.5]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.19,0.19,0.035,32]} /><meshPhysicalMaterial color="#5d2b91" roughness={0.25} metalness={0.25} /></mesh>
      <mesh position={[0,1.54,0.525]}><torusGeometry args={[0.115,0.018,8,32]} /><meshStandardMaterial color={MINT} emissive={MINT} emissiveIntensity={0.5} toneMapped={false} /></mesh>
      <mesh position={[0,1.54,0.535]}><sphereGeometry args={[0.042,16,12]} /><meshStandardMaterial color={MINT} emissive={MINT} emissiveIntensity={0.65} /></mesh>
      {[-0.14,0,0.14].map((x) => <mesh key={x} position={[x,1.1,0.48]}><capsuleGeometry args={[0.018,0.1,3,8]} /><meshStandardMaterial color="#9381ad" roughness={0.5} /></mesh>)}
      <Arm side={-1} armRef={leftArm} elbowRef={leftElbow} /><Arm side={1} armRef={rightArm} elbowRef={rightElbow} />
      <mesh position={[0,2.04,0]} castShadow><cylinderGeometry args={[0.22,0.25,0.3,24]} /><meshStandardMaterial color={INK} metalness={0.6} roughness={0.25} /></mesh>
      <group ref={head} position={[0,2.95,0]} rotation={[0,0,-0.055]}>
        <RoundedShell size={[2.55,2.05,1.7]} radius={0.8} />
        <mesh geometry={faceGeometry} position={[0,-0.02,0.84]}><meshPhysicalMaterial color="#090812" roughness={0.24} metalness={0.25} clearcoat={1} clearcoatRoughness={0.12} /></mesh>
        <group ref={eyes} position={[0,0.13,0]}>
          <group position={[0,-0.13,0]}><FaceStroke points={LEFT_EYE} /><FaceStroke points={RIGHT_EYE} /></group>
        </group>
        <FaceStroke points={mood === 'success' ? SUCCESS_SMILE : SMILE} radius={0.025} />
        <mesh position={[-0.68,0.36,1.004]} rotation={[0,0,-0.2]}><capsuleGeometry args={[0.018,0.27,4,8]} /><meshBasicMaterial color="#50425e" transparent opacity={0.55} /></mesh>
        {[-1,1].map((side) => <group key={side} position={[side * 1.3,0.05,0]}>
          <mesh rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[0.43,0.43,0.23,40]} /><meshPhysicalMaterial color={INK} metalness={0.45} roughness={0.25} /></mesh>
          <mesh position={[side * 0.12,0,0]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[0.34,0.038,10,40]} /><meshStandardMaterial color={PURPLE} emissive={PURPLE} emissiveIntensity={1.5} toneMapped={false} /></mesh>
          <mesh position={[side * 0.16,0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.26,0.26,0.05,32]} /><meshPhysicalMaterial color="#e8ddf5" metalness={0.18} roughness={0.3} /></mesh>
        </group>)}
      </group>
    </group>
  </group>;
}

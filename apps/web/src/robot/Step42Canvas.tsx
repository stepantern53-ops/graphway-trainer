import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three';
import Step42Model from './Step42Model.js';
import type { Step42Mood } from './Step42Scene.js';

export interface Step42CanvasProps { mood: Step42Mood; reducedMotion: boolean; active: boolean; greeting?:boolean;reaction?:number;onUnavailable: () => void }
function SceneContents({ mood, reducedMotion, active, greeting=false,reaction=0,onUnavailable }: Step42CanvasProps) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onUnavailable(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onUnavailable]);
  return <>
    <ambientLight intensity={0.7} />
    <hemisphereLight args={['#f1f5ff','#33364b',1.4]} />
    <directionalLight position={[-3,6,5]} intensity={4} color="#fff5ef" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={5} shadow-camera-bottom={-3} shadow-bias={-0.001} shadow-radius={5} />
    <directionalLight position={[4,3,-3]} intensity={2.7} color="#c5b8fa" />
    <pointLight position={[-3,2,-1]} intensity={5} color="#b1eadf" distance={9} />
    <Step42Model mood={mood} reducedMotion={reducedMotion} active={active} greeting={greeting} reaction={reaction}/>
    <mesh position={[0,0.04,0]} receiveShadow castShadow><cylinderGeometry args={[1.65,1.75,0.17,64]} /><meshPhysicalMaterial color="#34374d" metalness={0.55} roughness={0.3} clearcoat={0.6} /></mesh>
    <mesh position={[0,0.132,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.39,1.43,64]} /><meshStandardMaterial color="#c582ff" emissive="#ae54ff" emissiveIntensity={1.4} toneMapped={false} /></mesh>
    <mesh position={[0,0.138,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><circleGeometry args={[1.36,64]} /><meshPhysicalMaterial color="#484d61" metalness={0.35} roughness={0.45} /></mesh>
  </>;
}
export default function Step42Canvas(props: Step42CanvasProps) {
  const { active, reducedMotion } = props;
  return <Canvas
    aria-hidden="true"
    dpr={[1,1.5]}
    frameloop={!active || reducedMotion ? 'demand' : 'always'}
    shadows={{ type: PCFSoftShadowMap }}
    camera={{ position: [4.8,3.3,8.5], fov: 33, near: 0.1, far: 40 }}
    gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
    onCreated={({ camera, gl }) => { camera.lookAt(0,1.95,0); gl.setClearColor(0x000000,0); gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.15; }}
    fallback={null}
  ><SceneContents {...props} /></Canvas>;
}

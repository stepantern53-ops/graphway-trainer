import { Component, lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Step42Scene.module.css';

export type Step42Mood = 'idle' | 'attention' | 'success';
export interface Step42SceneProps { mood: Step42Mood; reducedMotion?: boolean; active?: boolean }
const LazyCanvas = lazy(() => import('./Step42Canvas.js'));
const fallbackImage = new URL('./step42-fallback.png', import.meta.url).href;

function StaticRobot({ loading = false }: { loading?: boolean }) {
  return <div className={styles.static}>
    <img src={fallbackImage} alt="step42 - белый округлый робот с фиолетовыми глазами на платформе" draggable={false} width={640} height={720} />
    <span className={styles.fallbackNote}>{loading ? 'Загружаем 3D-компаньона' : 'Статичный 3D-рендер · игра доступна'}</span>
  </div>;
}
class SceneBoundary extends Component<{ children: ReactNode; onUnavailable: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? <StaticRobot /> : this.props.children; }
}
/** Decorative only: success must be provided by the confirmed-completion UI state. */
export function Step42Scene({ mood, reducedMotion, active = true }: Step42SceneProps) {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [unavailable, setUnavailable] = useState(() => typeof window === 'undefined' || (typeof window.WebGLRenderingContext === 'undefined' && typeof window.WebGL2RenderingContext === 'undefined'));
  const [greeting,setGreeting]=useState(false);const [reaction,setReaction]=useState(0);
  const onUnavailable = useCallback(() => setUnavailable(true), []);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const moving = active && visible;
  const reduced=reducedMotion??systemReducedMotion;
  useEffect(()=>{
    if(!moving||!greeting)return;
    const timer=setTimeout(()=>setGreeting(false),reduced?500:1200);
    return()=>clearTimeout(timer);
  },[moving,greeting,reaction,reduced]);
  return <figure className={styles.scene} aria-label="step42 - 3D-компаньон GraphWay" data-mood={mood}>
    <div className={styles.aura} aria-hidden="true" />
    {unavailable ? <StaticRobot /> : <SceneBoundary onUnavailable={onUnavailable}>
      <Suspense fallback={<StaticRobot loading />}><LazyCanvas mood={mood} reducedMotion={reduced} active={moving} greeting={greeting} reaction={reaction} onUnavailable={onUnavailable} /></Suspense>
    </SceneBoundary>}
    <button type="button" className={styles.reactionButton} aria-label="Поздороваться с роботом step42" disabled={!moving||unavailable} onClick={()=>{setGreeting(true);setReaction(value=>value+1);}}/>
    <figcaption className={styles.name}><span aria-hidden="true" />step42</figcaption>
  </figure>;
}
export default Step42Scene;

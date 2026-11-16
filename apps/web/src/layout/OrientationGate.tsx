import type { ReactNode } from 'react';
import styles from './Layout.module.css';
export function OrientationGate({portrait,children}:{portrait:boolean;children:ReactNode}){
 return <><div inert={portrait} hidden={portrait}>{children}</div>{portrait&&<main className={styles.gate}><div aria-hidden="true" className={styles.phone}>↻</div><p className={styles.eyebrow}>GRAPHWAY · ЛАБОРАТОРИЯ ФУНКЦИЙ</p><h1>Поверни устройство</h1><p>Для графика и управления нужен горизонтальный экран.</p><p>Твоя открытая трасса и введённые числа остаются на месте.</p></main>}</>;
}

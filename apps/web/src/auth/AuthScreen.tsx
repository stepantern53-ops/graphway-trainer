import { useState,type FormEvent } from 'react';
import { credentialsSchema,type SafeUser,type ProgressDTO } from '@graphway/contracts';
import { api } from '../app/api';
import { Icon } from '../app/Icon';
import styles from './Auth.module.css';
export function AuthScreen({onSuccess,expired=false}:{onSuccess:(user:SafeUser,progress:ProgressDTO,registered:boolean)=>void;expired?:boolean}){
 const [mode,setMode]=useState<'login'|'register'>(expired?'login':'register');const [nickname,setNickname]=useState('');const [password,setPassword]=useState('');const [pending,setPending]=useState(false);const [error,setError]=useState<string|null>(null);const [reveal,setReveal]=useState(false);
 const submit=async(e:FormEvent)=>{e.preventDefault();if(pending)return;const parsed=credentialsSchema.safeParse({nickname,password});if(!parsed.success){setError('Никнейм: 3–24 буквы, цифры или _. Пароль: 10–128 символов, не больше 512 байт.');return;}setPending(true);setError(null);try{const result=await api.auth(mode,nickname,password);setPassword('');setReveal(false);onSuccess(result.user,result.progress,mode==='register');}catch(error){setError(error instanceof Error?error.message:'Вход не выполнен. Повтори попытку.');}finally{setPending(false);}};
 return <main className={styles.auth}>
  <section className={styles.intro}>
   <p className={styles.eyebrow}>ЛАБОРАТОРИЯ ФУНКЦИЙ</p>
   <h1>Твоя формула.<br/><span>Твой путь.</span></h1>
   <p className={styles.lead}>Тренажёр для 7–9 класса. Исследуй прямые и параболы, меняй коэффициенты и доведи метку до батареи.</p>
   <div className={styles.miniGraph} aria-hidden="true"><svg viewBox="0 0 400 170"><path className={styles.artGrid} d="M0 42H400M0 85H400M0 128H400M80 0V170M160 0V170M240 0V170M320 0V170"/><path className={styles.artAxis} d="M0 140H400M80 0V170"/><path className={styles.artCurve} d="M24 150Q200 -60 376 150"/><circle className={styles.artStart} cx="24" cy="150" r="11"/><circle className={styles.artGoal} cx="376" cy="150" r="11"/></svg></div>
   <p className={styles.facts}><span>2 эпизода</span><span>24 трассы</span><span>без штрафов за поиск</span></p>
  </section>
  <section className={styles.card} aria-labelledby="auth-title">
   <div className={styles.tabs}><button type="button" aria-pressed={mode==='register'} onClick={()=>{setMode('register');setError(null);}}>Регистрация</button><button type="button" aria-pressed={mode==='login'} onClick={()=>{setMode('login');setError(null);}}>Вход</button></div>
   <h2 id="auth-title">{expired?'Сессия завершилась':mode==='register'?'Начнём исследование':'С возвращением'}</h2>
   {expired?<p className={styles.sub}>Войди тем же пользователем, чтобы сохранить числа и повторить подтверждение. Другой аккаунт начнёт с начальных значений.</p>:<p className={styles.sub}>{mode==='register'?'Создай аккаунт — сразу откроется первая трасса L01.':'Войди, чтобы продолжить с того места, где остановился.'}</p>}
   <form onSubmit={e=>void submit(e)}>
    <label htmlFor="nickname">Никнейм</label>
    <input id="nickname" name="nickname" autoComplete="username" value={nickname} maxLength={24} onChange={e=>setNickname(e.target.value)} required aria-describedby="nickname-help"/>
    <small id="nickname-help">3–24 буквы, цифры или нижнее подчёркивание</small>
    <label htmlFor="password">Пароль</label>
    <span className={styles.passwordField}><input id="password" name="password" type={reveal?'text':'password'} autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} required aria-describedby="password-help"/><button type="button" className={styles.reveal} aria-pressed={reveal} aria-label={reveal?'Скрыть пароль':'Показать пароль'} onClick={()=>setReveal(v=>!v)}><Icon name="eye"/></button></span>
    <small id="password-help">От 10 до 128 символов</small>
    <p className={styles.warning}><Icon name="hint" size={18}/><span>Восстановления пароля нет. Если забудешь пароль, доступ к этому аккаунту будет потерян.</span></p>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    <button className="primary" disabled={pending} type="submit">{pending?'Подключаемся…':mode==='register'?'Создать аккаунт и открыть L01 →':'Войти и продолжить →'}</button>
   </form>
  </section>
 </main>;
}

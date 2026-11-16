import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import '@fontsource-variable/manrope';
import 'katex/dist/katex.min.css';
import './app/tokens.css';
createRoot(document.getElementById('root')!).render(<App/>);

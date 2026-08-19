import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../web/src/security-client';
import { App } from './App';
import { DesignStudioAccessGate } from './module-access';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><DesignStudioAccessGate><App /></DesignStudioAccessGate></React.StrictMode>,
);

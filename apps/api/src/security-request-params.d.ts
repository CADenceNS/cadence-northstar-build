import './security.js';

declare module './security.js' {
  interface SecurityRequest {
    params: Record<string,string>;
  }
}

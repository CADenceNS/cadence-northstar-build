const csrfKey='northstar.csrf';
const nativeFetch=window.fetch.bind(window);

export function setCsrfToken(value:string|null){if(value)sessionStorage.setItem(csrfKey,value);else sessionStorage.removeItem(csrfKey)}
export function getCsrfToken(){return sessionStorage.getItem(csrfKey)??''}

window.fetch=async(input:RequestInfo|URL,init:RequestInit={})=>{
 const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
 const method=(init.method??(input instanceof Request?input.method:'GET')).toUpperCase();
 const headers=new Headers(input instanceof Request?input.headers:undefined);
 new Headers(init.headers).forEach((value,key)=>headers.set(key,value));
 if(url.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(method)&&url!=='/api/auth/login'){
  const csrf=getCsrfToken();if(csrf)headers.set('X-CSRF-Token',csrf);
 }
 const response=await nativeFetch(input,{...init,headers,credentials:'same-origin'});
 const renewed=response.headers.get('X-CSRF-Token');if(renewed)setCsrfToken(renewed);
 if(response.status===401&&url!=='/api/auth/login'){setCsrfToken(null);window.dispatchEvent(new CustomEvent('northstar:session-expired'))}
 return response;
};

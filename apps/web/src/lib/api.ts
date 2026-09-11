export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
export const DEMO_COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID ?? '11111111-1111-1111-1111-111111111111';

export async function apiGet<T>(path:string):Promise<T>{
  const response=await fetch(`${API_URL}${path}`,{cache:'no-store'});
  if(!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path:string,body:unknown):Promise<T>{
  const response=await fetch(`${API_URL}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

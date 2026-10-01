export function resolveMotion(preference:string|null,reduced:boolean):boolean{
  return preference==='on'||(preference!=='off'&&!reduced);
}

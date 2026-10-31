export type SalonModule='overview'|'appointments'|'customers'|'services'|'team'|'billing'|'inventory'|'reports'|'settings'|'marketing';
const modules:Record<string,readonly SalonModule[]>={
 owner:['overview','appointments','customers','services','team','billing','inventory','reports','settings','marketing'],
 admin:['overview','appointments','customers','services','team','billing','inventory','reports','settings','marketing'],
 manager:['overview','appointments','customers','services','team','billing','inventory','reports','settings'],
 receptionist:['overview','appointments','customers','services','billing','settings'],
 staff:['overview','appointments','services','team','settings','reports'],
 inventory:['overview','inventory','reports','settings'],
 accountant:['overview','billing','reports','settings'],
 cashier:['overview','billing','settings'],
};
export function canModule(role:string,module:string) {return Object.hasOwn(modules,role)&&modules[role].includes(module as SalonModule);}

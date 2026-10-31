import { z } from 'zod';
export const customerInput=z.object({displayName:z.string().trim().min(2).max(120),phone:z.string().trim().max(30),notes:z.string().trim().max(2000)});
export const serviceInput=z.object({name:z.string().trim().min(2).max(120),category:z.string().trim().min(2).max(80),durationMinutes:z.coerce.number().int().min(5).max(480),pricePaise:z.coerce.number().int().min(0).max(100000000)});
export const bookingInput=z.object({branchId:z.uuid(),salonCustomerId:z.uuid(),serviceId:z.uuid(),assignedUserId:z.uuid(),startsAt:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)});
export const transitions:Record<string,readonly string[]>={confirmed:['checked_in','cancelled','no_show'],checked_in:['in_service','cancelled'],in_service:['completed'],completed:[],cancelled:[],no_show:[]};
export const productInput=z.object({name:z.string().trim().min(2).max(120),sku:z.string().trim().min(1).max(60),stock:z.coerce.number().int().min(0).max(1000000),reorderAt:z.coerce.number().int().min(0).max(1000000),pricePaise:z.coerce.number().int().min(0).max(100000000)});

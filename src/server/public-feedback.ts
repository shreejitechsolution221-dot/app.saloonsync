'use server';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/db';
import {requireSameOrigin,rateLimit} from '@/lib/security';
import type {FormState} from './auth-actions';
export async function submitVisitFeedback(_:FormState,f:FormData){try{await requireSameOrigin();const token=z.string().regex(/^[a-f0-9]{64}$/).parse(f.get('token')),hash=createHash('sha256').update(token).digest('hex'),rating=z.coerce.number().int().min(1).max(5).parse(f.get('rating')),comment=z.string().trim().max(1000).parse(f.get('comment')??'');await rateLimit('public-feedback',hash,10);await db.$transaction(async tx=>{const appointment=await tx.appointment.findFirst({where:{feedbackTokenHash:hash,feedbackTokenExpiresAt:{gt:new Date()},status:'completed'},select:{id:true,salonId:true,customerUserId:true}});if(!appointment)throw new Error('Invalid request');await tx.feedback.create({data:{salonId:appointment.salonId,appointmentId:appointment.id,customerUserId:appointment.customerUserId,rating,comment}});await tx.auditEvent.create({data:{salonId:appointment.salonId,action:'feedback.token_submitted',targetType:'Appointment',targetId:appointment.id,outcome:'allowed'}});});return {message:'Thank you. Your feedback has been recorded.'};}catch{return {error:'This feedback link is invalid, expired or has already been used.'};}}

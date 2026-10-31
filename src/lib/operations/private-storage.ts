import 'server-only';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {DomainError} from './shared';
export function privateStorage(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,bucket=process.env.SUPABASE_PORTFOLIO_BUCKET;
 if(!url||!key||!bucket)throw new DomainError('Private storage needs configuration before files can be uploaded.');
 return {client:createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),bucket};
}
export async function preparePrivateImage(file:File){
 if(!file.size||file.size>5*1024*1024)throw new DomainError('Choose an image under 5 MB.');
 const bytes=Buffer.from(await file.arrayBuffer());
 const jpeg=bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff,png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';if(!jpeg&&!png&&!webp)throw new DomainError('Choose a JPEG, PNG or WebP photo.');
 const decoder=sharp(bytes,{limitInputPixels:20_000_000,failOn:'warning'});
 const metadata=await decoder.metadata();
 if(!['jpeg','png','webp'].includes(metadata.format??''))throw new DomainError('Choose a JPEG, PNG or WebP photo.');
 return decoder.rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
}

export async function verifyPrivateBucket(storage:ReturnType<typeof privateStorage>){const {data,error}=await storage.client.storage.getBucket(storage.bucket);if(error||!data||data.public)throw new DomainError('Configure an existing private storage bucket; public buckets are not accepted.');}

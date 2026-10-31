'use client';
export default function GlobalError({retry}:{retry:()=>void}){
 return <html lang="en"><body style={{margin:0,background:'#fcf9f5',color:'#453140',fontFamily:'Arial, sans-serif'}}><main style={{maxWidth:520,margin:'15vh auto',padding:30}}><h1>We couldn’t open this space.</h1><p>The service may be unavailable. Please try again shortly.</p><button onClick={retry} style={{padding:'12px 20px',border:0,borderRadius:8,background:'#633c50',color:'white'}}>Try again</button></main></body></html>;
}

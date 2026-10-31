import {expect,it} from 'vitest';
import sharp from 'sharp';
import {preparePrivateImage} from '@/lib/operations/private-storage';
it('validates image bytes and strips identifying metadata before private storage',async()=>{const original=await sharp({create:{width:10,height:10,channels:3,background:'#dddddd'}}).jpeg().withExif({IFD0:{Artist:'Fixture author',ImageDescription:'Private fixture metadata'}}).toBuffer();expect((await sharp(original).metadata()).exif).toBeDefined();const result=await preparePrivateImage(new File([new Uint8Array(original)],'image.jpg',{type:'image/jpeg'}));const metadata=await sharp(result).metadata();expect(metadata.format).toBe('jpeg');expect(metadata.exif).toBeUndefined();expect(metadata.width).toBe(10);});
it('rejects disguised SVG/XML before decoding as an accepted photo',async()=>{await expect(preparePrivateImage(new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'],'photo.jpg',{type:'image/jpeg'}))).rejects.toThrow('JPEG');});
it('rejects oversized files before image processing',async()=>{await expect(preparePrivateImage(new File([new Uint8Array(5*1024*1024+1)],'big.jpg',{type:'image/jpeg'}))).rejects.toThrow('5 MB');});

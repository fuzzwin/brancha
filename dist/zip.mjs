// ZIP STORE writer. UTF-8 names, CRC-32, no dependency or network request.
import {validateExportPath} from './core.mjs';
export function zip(files){
 const enc=new TextEncoder(),table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c;}
 const chunks=[],central=[];let offset=0;
 const header=(size,signature)=>{const a=new Uint8Array(size);new DataView(a.buffer).setUint32(0,signature,true);return [a,new DataView(a.buffer)];};
 for(const [path,text]of Object.entries(files)){
  validateExportPath(path);
  const name=enc.encode(path),data=enc.encode(text);let crc=0xffffffff;for(const b of data)crc=table[(crc^b)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
  const [h,v]=header(30,0x04034b50);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);
  chunks.push(h,name,data);
  const [c,cv]=header(46,0x02014b50);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.push(c,name);offset+=h.length+name.length+data.length;
 }
 const size=central.reduce((s,c)=>s+c.length,0),[end,ev]=header(22,0x06054b50),count=Object.keys(files).length;ev.setUint16(8,count,true);ev.setUint16(10,count,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);
 return new Blob([...chunks,...central,end],{type:'application/zip'});
}

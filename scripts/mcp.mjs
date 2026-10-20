import {loadConfig} from './config.mjs';
import {localTools, TOOLS} from '../adapters/local-tools.mjs';

const {config}=loadConfig(process.argv[2]),call=localTools(config);
const versions=['2025-06-18','2025-03-26'];let initialized=false,ready=false,buffer='';
const send=message=>process.stdout.write(JSON.stringify(message)+'\n');
async function handle(message){
 if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string')return send({jsonrpc:'2.0',id:message?.id??null,error:{code:-32600,message:'Invalid request'}});
 const {id,method,params={}}=message;
 if(id===undefined){if(method==='notifications/initialized'&&initialized)ready=true;return;}
 const result=value=>send({jsonrpc:'2.0',id,result:value});
 if(method==='initialize'){
  initialized=true;
  return result({protocolVersion:versions.includes(params.protocolVersion)?params.protocolVersion:versions[0],capabilities:{tools:{}},serverInfo:{name:'brancha-local',version:'0.7.0'},instructions:'Resume the explicitly chosen project. Save meaningful milestones and unsaved work before project switches without repeated reminders. Reread revisions before writes; reuse requestId only for retries of identical content. Checkpoints are reports, not verified completion. This connection reads the configured local workspace only; it does not monitor other chats or upload data.'});
 }
 if(method==='ping')return result({});
 if(!ready)return send({jsonrpc:'2.0',id,error:{code:-32002,message:'Initialize the connection first.'}});
 if(method==='tools/list')return result({tools:TOOLS});
 if(method==='tools/call'){
  try{const data=await call(params.name,params.arguments||{});return result({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data});}
  catch(e){return result({isError:true,content:[{type:'text',text:e.message}]});}
 }
 send({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
}
let chain=Promise.resolve();
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{
 buffer+=chunk;if(Buffer.byteLength(buffer)>1024*1024){console.error('MCP input buffer exceeded 1 MB.');process.exit(1);}
 let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(!line.trim())continue;
  chain=chain.then(async()=>{let message;try{message=JSON.parse(line);}catch{return send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}await handle(message);}).catch(()=>console.error('MCP request failed.'));
 }
});

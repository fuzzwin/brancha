import {loadConfig} from './config.mjs';
import {chatPermissions,setChatPermission} from '../adapters/chat-privacy.mjs';
const [action,id,...extra]=process.argv.slice(2);
const {config}=loadConfig();
if(action==='status'&&!id){const p=chatPermissions(config);console.log(JSON.stringify({mode:'exact-chat-only',invalid:!!p.invalid,chats:p.chats,configuredApprovals:config.capturePolicy.approvedSessionIds||[]},null,2));}
else{
 const project=extra.length===1&&extra[0].startsWith('--project=')?extra[0].slice(10):undefined;
 if(!['include','exclude'].includes(action)||(extra.length&&!project)||(action==='exclude'&&project)||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id||''))throw Error('Usage: node scripts/chat-privacy.mjs status | include EXACT_CHAT_UUID [--project=PROJECT_ID] | exclude EXACT_CHAT_UUID. No bulk or wildcard approvals.');
 const result=setChatPermission(config,id,action,{projectId:project});
 console.log(JSON.stringify({chatId:id,...result,note:action==='include'?'Only this chat is included. New completed turns capture automatically; skipped turns are not replayed.':'Only this chat is excluded. Derived views hide its captured records; canonical private history and backups are retained.'}));
}

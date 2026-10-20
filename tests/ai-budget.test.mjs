import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {aiBudget,budgetDay,budgetReset} from '../companion/ai-budget.mjs';
test('daily usage comes from reserved-call ledgers, preserves counts after raising caps and resets at the local day boundary',()=>{
 const vault=fs.mkdtempSync(path.join(os.tmpdir(),'branchi-budget-')),config={vault,mapper:{enabled:true,maxCallsPerDay:100,reasoningEffort:'medium'},reviewer:{enabled:true,maxCallsPerDay:24,reasoningEffort:'medium'}},at='2026-10-20T16:00:00Z';
 for(const [kind,calls]of [['mapper',20],['reviewer',8]]){fs.mkdirSync(path.join(vault,'.brancha',kind),{recursive:true});fs.writeFileSync(path.join(vault,'.brancha',kind,'budget.json'),JSON.stringify({date:budgetDay(at),calls}));}
 const before=fs.readFileSync(path.join(vault,'.brancha/mapper/budget.json'),'utf8'),b=aiBudget(config,{at});assert.equal(b.mapper.used,20);assert.equal(b.mapper.remaining,80);assert.equal(b.reviewer.remaining,16);assert.equal(b.mapper.effort,'medium');assert.equal(b.mapper.limited,false);assert.equal(b.resetsAt,'2026-10-21T13:00:00.000Z');assert.equal(aiBudget(config,{at:b.resetsAt}).mapper.used,0);assert.equal(fs.readFileSync(path.join(vault,'.brancha/mapper/budget.json'),'utf8'),before);
 fs.writeFileSync(path.join(vault,'.brancha/mapper/budget.json'),'broken');assert.equal(aiBudget(config,{at}).mapper.used,null);
});
test('Melbourne reset follows 23-hour and 25-hour daylight-saving days',()=>{assert.equal(budgetReset('2026-10-03T14:00:00Z'),'2026-10-04T13:00:00.000Z');assert.equal(budgetReset('2026-04-04T13:00:00Z'),'2026-04-05T14:00:00.000Z');});

import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.resolve(process.argv[2]||path.join(root,'cloud-built'));
const core=fs.readFileSync(path.join(root,'dist/core.mjs'),'utf8'),worker=fs.readFileSync(path.join(root,'cloud/worker.mjs'),'utf8').replace(/^import[^\n]+\n/,''),skill=fs.readFileSync(path.join(root,'plugins/brancha-chatgpt/skills/brancha-chatgpt/SKILL.md'),'utf8'),description=skill.match(/^description: (.*)$/m)[1];
const bundle=core+'\nconst PELE_SOURCE='+JSON.stringify(fs.readFileSync(path.join(root,'dist/vendor/pele-1.7.0.mjs'),'utf8'))+';\nconst CHATGPT_SKILL='+JSON.stringify(skill)+';\nconst CHATGPT_SKILL_DESCRIPTION='+JSON.stringify(description)+';\n'+worker;
fs.mkdirSync(path.join(out,'worker'),{recursive:true});fs.writeFileSync(path.join(out,'worker/index.js'),bundle);console.log('Built cloud worker source in '+out);

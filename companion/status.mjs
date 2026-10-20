import {statusLabel} from '../dist/core.mjs';
// One key for interactive dashboards, portable diagrams and the generated guide.
export const statusKey=[
 ['planned','○','An idea or suggested next step; not started.','#fff4da','#9a701f','#44391f','#d8b260'],
 ['active','▶','Work is underway.','#e6f0fa','#4b79a5','#263b50','#8ab4dc'],
 ['blocked','!','Cannot continue until the recorded blocker is resolved.','#fdece8','#ad554b','#492d2c','#e19b91'],
 ['reported_done','?','Completion was reported; evidence still needs review.','#fff0df','#ad7138','#483523','#dfb37d'],
 ['done','✓','Complete with recorded evidence; open the record to inspect it.','#e6f3e9','#548465','#273f30','#9dc5a5'],
 ['parked','Ⅱ','Deliberately set aside; kept for later.','#edf0ef','#788580','#303634','#a6b1ac'],
 ['unknown','–','No reliable status has been recorded yet.','#f2eff5','#897b96','#38313f','#b6a8c5'],
].map(([id,mark,description,fill,stroke,darkFill,darkStroke])=>({id,label:statusLabel(id),mark,description,fill,stroke,darkFill,darkStroke}));
export function statusSvg(svg,nodes,{overview=false}={}){
 const byId=new Map(nodes.map(n=>[(overview?'item_':'')+n.id,n]));
 return svg.replace(/data-id="([a-zA-Z0-9_-]+)"/g,(original,id)=>{const n=byId.get(id);return n?`${original} data-status="${n.status}"`:original;});
}
export function statusSvgStyle(){
 const colours=dark=>statusKey.map(s=>`.pele-node[data-status="${s.id}"]{--_s:${dark?s.darkFill:s.fill};--_b:${dark?s.darkStroke:s.stroke}}`).join('');
 return `<style>${colours(false)}.pele-node[data-status]>rect,.pele-node[data-status]>circle,.pele-node[data-status]>ellipse,.pele-node[data-status]>polygon{fill:var(--_s);fill-opacity:1;stroke:var(--_b)}.pele-node[data-status="planned"]>rect,.pele-node[data-status="reported_done"]>rect{stroke-dasharray:6 4}@media(prefers-color-scheme:dark){${colours(true)}}</style>`;
}
export function statusGuide(){return `---\ncssclasses: brancha-record\n---\n# Colours, status and offshoots\n\nThese defaults work immediately. Words and symbols accompany colour, so you can read the map without relying on colour alone.\n\n| Status | Meaning |\n|---|---|\n${statusKey.map(s=>`| ${s.mark} **${s.label}** | ${s.description} |`).join('\n')}\n\n## Offshoots and decisions\n\n**Offshoot** is a kind of record, not a completion status. It has a purple badge and can be proposed, active, blocked, complete or parked. A **decision** records a choice; a **task** records work; a **result** records an output; a **source** preserves a report. Coloured category boxes group records; item boxes use the status key above.\n\n## A simple daily routine\n\n1. Open [[Navigation/Home|Home]] and choose a project or recent chat.\n2. Check At a glance. Click a map box to explore; Previous map retraces your view.\n3. Follow Your next step. Use Continue with AI for a project handover.\n4. Review AI suggestions against their linked source before accepting them. A saved completion report stays separate from verified completion.\n\nOpening a box never changes its status. Local capture and review update generated pages while the companion runs.\n\n## Automatic Obsidian tags\n\nGenerated item notes include tags such as \`#brancha/status/active\`, \`#brancha/type/branch\` and \`#brancha/origin/ai-suggestion\`. Use Obsidian’s Tags or Search to find them across projects. These tags describe the canonical record; editing a generated tag does not update it and will be overwritten. Keep personal tags and notes in Notes.\n\nCanvas card colours follow the same status families. Canvas arrow colours describe relationships, separately from card status.\n`}

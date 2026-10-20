const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function dashboardSvg(a){
 const cards=[['Goals with evidence',a.originalGoals.total?`${a.originalGoals.done} / ${a.originalGoals.total}`:'Not set'],['Work ready',a.ready.length],['Waiting on work',a.waiting.length],['Source reports',a.reportsToReview.length]];
 const sparse=a.activeDays<2,height=sparse?395:550,max=Math.max(1,...a.activity.map(d=>d.count));
 const colours={unknown:'#8d9ba2',planned:'#baa76a',active:'#6dafa3',blocked:'#d18d7e',reported_done:'#a698c7',done:'#88ad78',parked:'#9a8b9f'};
 const statuses=a.status.filter(s=>s.count);let offset=0;
 const distribution=statuses.map(s=>{const width=1094*s.count/Math.max(1,a.workTotal),x=offset;offset+=width;return `<rect x="${3+x}" y="165" width="${width}" height="16" fill="${colours[s.id]}"><title>${escape(s.label)}: ${s.count}</title></rect>`;}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${height}" viewBox="0 0 1100 ${height}" role="img" aria-labelledby="title desc"><title id="title">Project activity, work status and evidence</title><desc id="desc">${escape(`${a.originalGoals.done} of ${a.originalGoals.total} original goals have evidence. ${a.workTotal} work records, including mapped proposals. ${a.updates14d} saved updates over 14 days. Reports do not imply verified completion.`)}</desc><style>svg{--ink:#30303a;--muted:#676773;--surface:#f3f3f6;--chart:#8b78c8;font-family:system-ui,sans-serif}text{fill:var(--ink)}.muted{fill:var(--muted)}.surface{fill:var(--surface)}.bar{fill:var(--chart)}@media(prefers-color-scheme:dark){svg{--ink:#ececf1;--muted:#b8b8c2;--surface:#29292e;--chart:#b6a2ed}}</style>
 ${cards.map(([label,value],i)=>`<rect x="${i*278}" y="0" width="264" height="103" rx="12" class="surface"/><text x="${i*278+20}" y="30" font-size="16" class="muted">${label}</text><text x="${i*278+20}" y="81" font-size="40">${escape(value)}</text>`).join('')}
 <text x="3" y="139" font-size="19">Work status · ${a.workTotal} records</text>
 ${distribution||'<text x="3" y="180" font-size="16" class="muted">No work records yet</text>'}
 ${statuses.map((s,i)=>`<circle cx="${i%4*278+9}" cy="${205+Math.floor(i/4)*25}" r="5" fill="${colours[s.id]}"/><text x="${i%4*278+22}" y="${211+Math.floor(i/4)*25}" font-size="15">${escape(s.label)} · ${s.count}</text>`).join('')}
 <text x="3" y="269" font-size="17">${escape(`Decisions ${a.decisions.length}   ·   Offshoots ${a.branches.length}   ·   Luna proposals ${a.mappedProposals??0}   ·   Active days ${a.activeDays}/14`)}</text>
 <text x="3" y="293" font-size="13" class="muted">Decisions and offshoots include historical records. Luna proposals require review.</text>
 <text x="3" y="329" font-size="18">Last 14 days · ${a.updates14d} saved update${a.updates14d===1?'':'s'}</text>
 <text x="1090" y="329" text-anchor="end" font-size="13" class="muted">${escape(a.timeZone)}</text>
 ${sparse?`<text x="3" y="361" font-size="15" class="muted">${a.updates14d?'One recorded active day; recent updates appear below.':'No saved updates yet; your first checkpoint will appear below.'}</text>`:`<path d="M3 470H1090 M3 415H1090 M3 360H1090" fill="none" stroke="var(--muted)" stroke-opacity=".2"/>
 ${a.activity.map((d,i)=>{const x=i*78+7,h=110*d.count/max;return `<g><title>${d.date}: ${d.count} updates</title><rect x="${x}" y="${470-h}" width="59" height="${h}" rx="5" class="bar"/>${d.count?`<text x="${x+29}" y="${460-h}" text-anchor="middle" font-size="13">${d.count}</text>`:''}<text x="${x+29}" y="495" text-anchor="middle" font-size="13" class="muted">${d.date.slice(8)}</text></g>`;}).join('')}`}
 <text x="3" y="${height-9}" font-size="13" class="muted">Saved updates are not hours or productivity. Source reports are not verified results.</text></svg>`;
}

// Every generated Markdown page receives the same scoped visual foundation.
export function withPageStyle(text){
 const source=String(text);if(!source.startsWith('---\n'))return '---\ncssclasses: [brancha-page]\n---\n\n'+source;
 const end=source.indexOf('\n---\n',4);if(end<0)throw Error('Generated page has an unterminated frontmatter block.');
 let header=source.slice(4,end),match=header.match(/^cssclasses:\s*(.*)$/m),classes=[];
 if(match){const value=match[1].trim();classes=value.startsWith('[')?value.slice(1,-1).split(',').map(s=>s.trim().replace(/^['"]|['"]$/g,'')):value.split(/\s+/);}
 classes=[...new Set(['brancha-page',...classes.filter(Boolean)])];const line='cssclasses: ['+classes.join(', ')+']';header=match?header.replace(/^cssclasses:.*$/m,line):line+'\n'+header;
 return '---\n'+header+source.slice(end);
}
export const styleGeneratedFiles=files=>Object.fromEntries(Object.entries(files).map(([name,text])=>[name,name.endsWith('.md')?withPageStyle(text):text]));

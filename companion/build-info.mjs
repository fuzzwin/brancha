import fs from 'node:fs';
// Package metadata describes the generating source. No inferred Git/channel or
// currently running process identity is presented as verified build metadata.
export const software=Object.freeze({appVersion:JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version});

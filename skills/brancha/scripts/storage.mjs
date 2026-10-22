import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {validateExportPath} from './core.mjs';

// Validate both the portable name and existing filesystem components. Generated
// output must not follow a pre-existing symlink/junction out of its root.
export function containedPath(root,name) {
  validateExportPath(name);const base=path.resolve(root),dest=path.resolve(base,...name.split('/'));
  if(!dest.startsWith(base+path.sep))throw Error('Invalid export destination');
  let current=base;
  for(const part of ['',...name.split('/')]) {
    if(part)current=path.join(current,part);
    try{if(fs.lstatSync(current).isSymbolicLink())throw Error('Export destination contains a symbolic link');}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  return dest;
}

// Antivirus, editors and sync clients can briefly hold a Windows file open.
// Never remove the destination as a fallback: an unsuccessful save keeps it intact.
export function atomicText(file, text, options = {}) {
  const io = options.fs || fs;
  const sleep = options.sleep || (ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms));
  io.mkdirSync(path.dirname(file), {recursive: true});
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    io.writeFileSync(temp, text, {flag: 'wx', mode: 0o600});
    for (let attempt = 0; ; attempt++) {
      try { io.renameSync(temp, file); break; }
      catch (error) {
        if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 4) throw error;
        sleep(25 * (attempt + 1));
      }
    }
  } finally {
    try { if (io.existsSync(temp)) io.unlinkSync(temp); } catch {}
  }
}
export const atomic = (file, value, options) => atomicText(file, JSON.stringify(value, null, 2) + '\n', options);

import fs from 'node:fs';
import {loadConfig} from './config.mjs';
import {ingestCheckpoint} from '../adapters/checkpoint.mjs';
try {
  const [file, revision, configFile, ...extra] = process.argv.slice(2);
  if (!file || !/^\d+$/.test(revision || '') || extra.length) throw Error('Usage: npm run checkpoint -- FILE_OR_- EXPECTED_REVISION [CONFIG]');
  const raw = fs.readFileSync(file === '-' ? 0 : file,'utf8');
  if (Buffer.byteLength(raw) > 64000) throw Error('Checkpoint exceeds 64 KB.');
  const {config} = loadConfig(configFile), result = ingestCheckpoint(config,JSON.parse(raw),Number(revision));
  console.log(JSON.stringify(result));
  if (result.retry) process.exitCode = 2;
} catch (error) {console.error(error.message);process.exitCode = 1;}

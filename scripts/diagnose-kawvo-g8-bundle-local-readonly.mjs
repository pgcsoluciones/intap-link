#!/usr/bin/env node
// KAW-G8 forensic bundle comparison. No network, Cloudflare credentials, deployment or file changes in checkout.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SOURCE = '71dd92b870482427d8576e68d89c3167bcfe8f12';
const MAC_EXPECTED = 'f465c714f3a5b4b3627d58797be32621c674e7056e27ff4c36fbf8e09e96fbd6';
const CI_OBSERVED = 'fc12124907df520686b6ccaf64c62f743afa261c0d044b3ed8d8ad2ba247a752';
const ROOT = join(process.env.HOME || '', 'Desktop/kawvo-g8-production-main');
const hash = b => createHash('sha256').update(b).digest('hex');
const cmd = (binary, args, cwd=ROOT) => execFileSync(binary,args,{cwd,encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']}).trim();
const out = (key,value) => console.log(key+'='+value);

let temp;
try {
  if (cmd('git',['rev-parse','HEAD']) !== SOURCE) throw Error('source SHA changed');
  if (cmd('git',['status','--porcelain','--untracked-files=no'])) throw Error('tracked checkout is not clean');
  const compiler=join(ROOT,'node_modules/.bin/esbuild');
  const source=join(ROOT,'api/src/preview-free-entry.ts');
  const lock=join(ROOT,'package-lock.json');
  const compilerVersion=cmd(compiler,['--version']);
  temp=mkdtempSync(join(tmpdir(),'kawvo-g8-bundle-inspect-'));
  const bundle=join(temp,'worker.mjs');
  cmd(compiler,[source,'--bundle','--platform=node','--format=esm','--target=node20','--external:cloudflare:*','--outfile='+bundle]);
  const bundleHash=hash(readFileSync(bundle));
  out('CHECKOUT',SOURCE);
  out('NODE',process.version);
  out('OS',process.platform+'/'+process.arch);
  out('ESBUILD',compilerVersion);
  out('SOURCE_SHA256',hash(readFileSync(source)));
  out('LOCKFILE_SHA256',hash(readFileSync(lock)));
  out('BUNDLE_BYTES',statSync(bundle).size);
  out('BUNDLE_SHA256',bundleHash);
  out('MATCH_PREVIOUS_MAC_BUNDLE',bundleHash===MAC_EXPECTED);
  out('MATCH_PREVIOUS_CI_BUNDLE',bundleHash===CI_OBSERVED);
  out('NO_NETWORK_NO_CLOUDFLARE_NO_UPLOAD',true);
  console.log('PASS_READONLY_BUNDLE_DIAGNOSTIC');
} catch (e) {
  console.error('BLOCKED_READONLY_DIAGNOSTIC: '+(/source SHA changed|tracked checkout is not clean/.test(e.message)?e.message:'missing local prerequisite or build failed'));
  process.exitCode=1;
} finally {
  if (temp) rmSync(temp,{recursive:true,force:true});
}

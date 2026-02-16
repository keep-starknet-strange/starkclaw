#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(`dependency-coherence: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getVersion(pkg, name) {
  return (
    (pkg.dependencies && pkg.dependencies[name]) ||
    (pkg.devDependencies && pkg.devDependencies[name]) ||
    (pkg.peerDependencies && pkg.peerDependencies[name]) ||
    null
  );
}

function stripRange(v) {
  if (!v) return null;
  // keep digits/dots only from the beginning like "^1.2.3", "~0.7.3", ">=0.7.0"
  const m = String(v).match(/(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

function cmpSemver(a, b) {
  const pa = a.split(".").map((x) => Number(x));
  const pb = b.split(".").map((x) => Number(x));
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function walk(dir, exts) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      if (ent.name === "node_modules" || ent.name === ".expo") continue;
      const p = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (exts.has(path.extname(ent.name))) out.push(p);
    }
  }
  return out;
}

const repoRoot = process.cwd();
const mobilePkgPath = path.join(repoRoot, "apps/mobile/package.json");
if (!fs.existsSync(mobilePkgPath)) {
  fail(`missing ${mobilePkgPath}`);
}

const mobilePkg = readJson(mobilePkgPath);

// 1) React trio must match exactly (prevents npm ci ERESOLVE + runtime weirdness).
const react = getVersion(mobilePkg, "react");
const reactDom = getVersion(mobilePkg, "react-dom");
const reactTestRenderer = getVersion(mobilePkg, "react-test-renderer");

if (!react || !reactDom || !reactTestRenderer) {
  fail(
    `apps/mobile must declare react/react-dom/react-test-renderer (got react=${react}, react-dom=${reactDom}, react-test-renderer=${reactTestRenderer})`
  );
}
if (!(react === reactDom && react === reactTestRenderer)) {
  fail(
    `React version drift in apps/mobile: react=${react}, react-dom=${reactDom}, react-test-renderer=${reactTestRenderer} (must match exactly)`
  );
}

// 2) Reanimated/worklets basic compatibility check.
const reanimated = getVersion(mobilePkg, "react-native-reanimated");
const worklets = getVersion(mobilePkg, "react-native-worklets");
if (reanimated && worklets) {
  const reanimatedSem = stripRange(reanimated);
  const workletsSem = stripRange(worklets);
  // For reanimated 4.x, require worklets >= 0.7.0 (the peer requirement that broke main).
  if (reanimatedSem && reanimatedSem.startsWith("4.")) {
    if (!workletsSem) {
      fail(`react-native-worklets version '${worklets}' is not parseable`);
    }
    if (cmpSemver(workletsSem, "0.7.0") < 0) {
      fail(
        `react-native-reanimated=${reanimated} requires react-native-worklets>=0.7.0, but apps/mobile has ${worklets}`
      );
    }
  }
}

// 3) Guard against known-breaking noble subpath imports (noble v2 moved sha256 into sha2).
const importGuards = [
  {
    re: /from\s+["']@noble\/hashes\/sha256(?:\.js)?["']/,
    msg: "noble v2 moved sha256 into @noble/hashes/sha2.js (do not import sha256 directly)",
  },
  {
    re: /from\s+["']@noble\/hashes\/hmac["']/,
    msg: "use @noble/hashes/hmac.js (explicit .js export required by noble v2)",
  },
  {
    re: /from\s+["']@noble\/hashes\/utils["']/,
    msg: "use @noble/hashes/utils.js (explicit .js export required by noble v2)",
  },
  {
    re: /from\s+["']@noble\/hashes\/sha2["']/,
    msg: "use @noble/hashes/sha2.js (explicit .js export required by noble v2)",
  },
];
const files = walk(path.join(repoRoot, "apps/mobile"), new Set([".ts", ".tsx"]));
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  for (const g of importGuards) {
    if (g.re.test(src)) {
      fail(
        `bad noble import in ${path.relative(repoRoot, file)}: ${g.msg}`
      );
    }
  }
}

console.log("dependency-coherence: ok");

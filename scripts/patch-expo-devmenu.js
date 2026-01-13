const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const expoIosRoot = path.join(projectRoot, "node_modules", "expo", "ios");
const targetFile = "EXReactRootViewFactory.h";
const forwardDecl = "#if RCT_DEV\n@class RCTDevMenuConfiguration;\n#endif\n";
const forwardDeclRegex =
  /(^|\n)[ \t]*#if\s+RCT_DEV[\s\S]*?@class\s+RCTDevMenuConfiguration;[\s\S]*?#endif[ \t]*\n?/g;

function findFile(root, name) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile() && entry.name === name) {
        return entryPath;
      }
    }
  }
  return null;
}

function patchFile(filePath) {
  const contents = fs.readFileSync(filePath, "utf8");
  if (!contents.includes("RCTDevMenuConfiguration")) {
    return false;
  }

  const cleaned = contents.replace(forwardDeclRegex, "");
  if (cleaned !== contents) {
    // Normalize any previous insertion so we can place it correctly.
  }

  let insertIndex = -1;
  const swiftNameIndex = cleaned.indexOf("NS_SWIFT_NAME(");
  if (swiftNameIndex >= 0) {
    insertIndex = swiftNameIndex;
  } else {
    const importRegex = /#import .*\n/g;
    let lastImportMatch;
    for (const match of cleaned.matchAll(importRegex)) {
      lastImportMatch = match;
    }
    if (lastImportMatch) {
      insertIndex = lastImportMatch.index + lastImportMatch[0].length;
    } else {
      const interfaceIndex = cleaned.indexOf("@interface EXReactRootViewFactory");
      if (interfaceIndex >= 0) {
        insertIndex = interfaceIndex;
      }
    }
  }

  if (insertIndex === -1) {
    return false;
  }

  const needsLeadingNewline =
    insertIndex > 0 && cleaned[insertIndex - 1] !== "\n";
  const updated =
    cleaned.slice(0, insertIndex) +
    (needsLeadingNewline ? "\n" : "") +
    forwardDecl +
    "\n" +
    cleaned.slice(insertIndex);

  if (updated === contents) {
    return false;
  }

  fs.writeFileSync(filePath, updated);
  return true;
}

const candidatePaths = [
  findFile(expoIosRoot, targetFile),
  path.join(
    projectRoot,
    "ios",
    "Pods",
    "Headers",
    "Public",
    "Expo",
    "Expo",
    targetFile
  ),
  path.join(
    projectRoot,
    "ios",
    "Pods",
    "Headers",
    "Public",
    "Expo",
    targetFile
  ),
].filter(Boolean);

const uniquePaths = Array.from(new Set(candidatePaths)).filter((filePath) =>
  fs.existsSync(filePath)
);

if (uniquePaths.length === 0) {
  console.warn(
    "[patch-expo-devmenu] EXReactRootViewFactory.h not found; skipping."
  );
  process.exit(0);
}

let didPatch = false;
for (const filePath of uniquePaths) {
  const patched = patchFile(filePath);
  if (patched) {
    didPatch = true;
    console.log(`[patch-expo-devmenu] Patched ${filePath}.`);
  } else {
    console.log(`[patch-expo-devmenu] No changes needed in ${filePath}.`);
  }
}

if (!didPatch) {
  process.exit(0);
}

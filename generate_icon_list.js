import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

// ES module __dirname workaround
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Function to recursively find all files in a directory
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function createKey(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  const base = path
    .basename(relativePath, ext)
    .replace(/[-.]/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_");

  if (ext === ".gz") {
    return `${base}_gz`;
  }

  if (ext.length > 0) {
    const extSanitized = ext.slice(1).replace(/[^A-Za-z0-9]/g, "_");
    if (extSanitized.length > 0) {
      return `${base}_${extSanitized}`;
    }
  }

  return base;
}

// Function to generate the file list
function generateFileList(files, baseDir) {
  return files
    .map((file, index) => {
      const relativePath = path.relative(baseDir, file).replace(/\\/g, "/");
      const key = createKey(relativePath);
      const line = `\tXX(${key}, "${relativePath}")`;
      return index === files.length - 1 ? line : `${line} \\`;
    })
    .join("\n");
}

function collectIconFiles(sourceDir) {
  if (!fs.existsSync(sourceDir)) {
    return [];
  }

  return findFiles(sourceDir)
    .filter(
      (file) =>
        file.toLowerCase().endsWith(".svg") ||
        file.toLowerCase().endsWith(".svg.gz"),
    )
    .sort();
}

function sanitizeFillAttributes(svgContent) {
  const fillAttrRegex = /\s+fill=(['"])([^'"]*)\1/gi;
  svgContent = svgContent.replace(fillAttrRegex, (match, quote, rawValue) => {
    const value = rawValue.trim();
    const normalized = value.toLowerCase();

    if (
      normalized === "none" ||
      normalized === "currentcolor" ||
      normalized.startsWith("url(") ||
      normalized.startsWith("var(")
    ) {
      return match;
    }

    if (normalized === "") {
      return "";
    }

    if (normalized === "#") {
      return "";
    }

    const isColorLiteral =
      normalized.startsWith("#") ||
      normalized.startsWith("rgb") ||
      normalized.startsWith("hsl") ||
      normalized === "black" ||
      normalized === "white";

    if (isColorLiteral) {
      return ` fill=${quote}currentColor${quote}`;
    }

    return ` fill=${quote}currentColor${quote}`;
  });

  const styleFillRegex =
    /((?:^|\s)style\s*=\s*['"][^'"]*?)fill\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|black|white)([^'"]*?['"])/gi;
  svgContent = svgContent.replace(
    styleFillRegex,
    (match, prefix, _color, suffix) => {
      return `${prefix}fill:currentColor${suffix}`;
    },
  );

  return svgContent;
}

function buildSpriteContent(sourceDir) {
  const iconFiles = collectIconFiles(sourceDir);
  if (iconFiles.length === 0) {
    return null;
  }

  const symbols = iconFiles.map((file) => {
    const id = path
      .basename(file)
      .replace(/\.svg(\.gz)?$/i, "")
      .replace(/[^a-z0-9_-]/gi, "_");

    let svgContent = fs.readFileSync(file);
    if (file.toLowerCase().endsWith(".gz")) {
      svgContent = zlib.gunzipSync(svgContent);
    }
    svgContent = svgContent.toString("utf8");
    svgContent = sanitizeFillAttributes(svgContent);

    const svgTagMatch = svgContent.match(/<svg[^>]*>/i);
    let viewBox = "0 0 24 24";
    if (svgTagMatch) {
      const viewBoxMatch = svgTagMatch[0].match(/viewBox="([^"]+)"/i);
      if (viewBoxMatch) {
        viewBox = viewBoxMatch[1];
      }
    }

    const innerContent = svgContent
      .replace(/^[\s\S]*?<svg[^>]*>/i, "")
      .replace(/<\/svg>\s*$/i, "");

    return `<symbol id="${id}" viewBox="${viewBox}">${innerContent}</symbol>`;
  });

  if (symbols.length === 0) {
    return null;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n${symbols.join(
    "\n",
  )}\n</svg>\n`;
}

function writeSpriteTargets(spriteContent, targets) {
  if (!spriteContent) {
    return;
  }

  targets.forEach(({ outputPath, compress }) => {
    const data = compress
      ? zlib.gzipSync(Buffer.from(spriteContent, "utf8"))
      : Buffer.from(spriteContent, "utf8");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, data);
  });
}

function ensureVersionFile(baseDir) {
  const versionPath = path.join(baseDir, "VERSION");
  if (!fs.existsSync(versionPath)) {
    fs.mkdirSync(path.dirname(versionPath), { recursive: true });
    fs.writeFileSync(versionPath, "");
  }
}

function filterFiles(files, baseDir, spriteRelativePath) {
  return files
    .map((file) => ({
      file,
      relative: path.relative(baseDir, file).replace(/\\/g, "/"),
    }))
    .filter(({ relative }) => {
      if (relative.startsWith("icons/")) {
        return (
          relative === spriteRelativePath || relative === "icons/favicon.ico"
        );
      }
      return true;
    })
    .map(({ file }) => file);
}

// Main function
function main() {
  const baseDir = path.resolve(__dirname, "dist/spa");
  const iconsSourceDir = path.resolve(__dirname, "icons-src");
  const spriteRelativePath = "icons/iconsSprite.svg.gz";
  const spriteAbsolutePath = path.join(baseDir, spriteRelativePath);

  const spriteContent = buildSpriteContent(iconsSourceDir);
  writeSpriteTargets(spriteContent, [
    {
      outputPath: path.resolve(__dirname, "public/icons/iconsSprite.svg"),
      compress: false,
    },
    {
      outputPath: spriteAbsolutePath,
      compress: true,
    },
  ]);

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  ensureVersionFile(baseDir);

  const files = filterFiles(
    findFiles(baseDir).sort(),
    baseDir,
    spriteRelativePath,
  );
  const fileListBody = generateFileList(files, baseDir);
  const header = "#define FILE_LIST(XX) \\";
  const output = fileListBody ? `${header}\n${fileListBody}\n` : `${header}\n`;

  const headerPath = path.resolve(__dirname, "fileList.h");
  fs.writeFileSync(headerPath, `${output}`);

  console.log(output.trimEnd());
}

// Run the main function
main();

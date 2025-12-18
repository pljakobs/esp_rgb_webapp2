#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Configuration
const SRC_DIR = "./src";
const ICONS_DIR = "./public/icons";
const ICON_EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp"];

/**
 * Recursively find all files with given extensions in a directory
 */
function findFiles(dir, extensions, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findFiles(filePath, extensions, fileList);
    } else if (extensions.some((ext) => file.endsWith(ext))) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Extract icon names from svgIcon component usages
 */
function extractIconNames(content) {
  const iconNames = new Set();

  // Match various svgIcon patterns:
  // <svgIcon name="icon-name" />
  // <svgIcon name='icon-name' />
  // <svgIcon :name="variable" />
  // <svgIcon v-bind:name="variable" />
  const patterns = [
    /<svgIcon[^>]+name\s*=\s*["']([^"']+)["'][^>]*\/?>/gi,
    /<svgIcon[^>]+name\s*=\s*["']([^"']+)["'][^>]*>[^<]*<\/svgIcon>/gi,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const iconName = match[1];
      // Skip dynamic bindings (starting with : or containing variables)
      if (
        !iconName.includes("{{") &&
        !iconName.includes("${") &&
        !iconName.startsWith(":") &&
        !iconName.includes(".") &&
        !iconName.includes("[") &&
        !iconName.includes("(")
      ) {
        iconNames.add(iconName);
      }
    }
  });

  return Array.from(iconNames);
}

/**
 * Get all available icon files in the icons directory
 */
function getAvailableIcons(iconsDir) {
  if (!fs.existsSync(iconsDir)) {
    console.error(`Icons directory not found: ${iconsDir}`);
    return [];
  }

  const iconFiles = fs.readdirSync(iconsDir);
  const icons = new Set();

  iconFiles.forEach((file) => {
    const ext = path.extname(file);
    if (ICON_EXTENSIONS.includes(ext.toLowerCase())) {
      const name = path.basename(file, ext);
      icons.add(name);
    }
  });

  return Array.from(icons);
}

/**
 * Main function
 */
function main() {
  console.log("🔍 Checking for missing icons in svgIcon components...\n");

  // Find all Vue, JS, and TS files
  const sourceFiles = findFiles(SRC_DIR, [
    ".vue",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
  ]);
  console.log(`📁 Found ${sourceFiles.length} source files to analyze`);

  // Extract all icon names used in the project
  const usedIcons = new Set();
  let totalIconUsages = 0;

  sourceFiles.forEach((filePath) => {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const icons = extractIconNames(content);

      if (icons.length > 0) {
        console.log(`📄 ${filePath}: ${icons.join(", ")}`);
        icons.forEach((icon) => usedIcons.add(icon));
        totalIconUsages += icons.length;
      }
    } catch (error) {
      console.error(`❌ Error reading ${filePath}:`, error.message);
    }
  });

  console.log(
    `\n📊 Found ${totalIconUsages} icon usages referencing ${usedIcons.size} unique icons`,
  );

  // Get available icons
  const availableIcons = getAvailableIcons(ICONS_DIR);
  console.log(`📂 Found ${availableIcons.length} icon files in ${ICONS_DIR}`);

  // Find missing icons
  const missingIcons = Array.from(usedIcons).filter(
    (icon) => !availableIcons.includes(icon),
  );
  const unusedIcons = availableIcons.filter((icon) => !usedIcons.has(icon));

  // Output results
  console.log("\n" + "=".repeat(60));

  if (missingIcons.length > 0) {
    console.log(`\n❌ MISSING ICONS (${missingIcons.length}):`);
    console.log(
      "The following icons are used in svgIcon components but not found in the icons directory:",
    );
    missingIcons.sort().forEach((icon) => {
      console.log(`  • ${icon}`);
    });

    console.log("\n💡 To fix these missing icons:");
    console.log(`1. Add the icon files to ${ICONS_DIR}/`);
    console.log(
      "2. Make sure the filename matches the name attribute (without extension)",
    );
    console.log("3. Supported formats: " + ICON_EXTENSIONS.join(", "));
  } else {
    console.log("\n✅ All icons are available! No missing icons found.");
  }

  if (unusedIcons.length > 0) {
    console.log(`\n📋 UNUSED ICONS (${unusedIcons.length}):`);
    console.log(
      "The following icon files are not referenced by any svgIcon component:",
    );
    const maxDisplay = 20;
    unusedIcons
      .sort()
      .slice(0, maxDisplay)
      .forEach((icon) => {
        console.log(`  • ${icon}`);
      });
    if (unusedIcons.length > maxDisplay) {
      console.log(`  ... and ${unusedIcons.length - maxDisplay} more`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\n📈 SUMMARY:`);
  console.log(`  Used icons: ${usedIcons.size}`);
  console.log(`  Available icons: ${availableIcons.length}`);
  console.log(`  Missing icons: ${missingIcons.length}`);
  console.log(`  Unused icons: ${unusedIcons.length}`);

  // Exit with error code if there are missing icons
  if (missingIcons.length > 0) {
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { extractIconNames, getAvailableIcons };

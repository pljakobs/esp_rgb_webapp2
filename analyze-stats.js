const fs = require("fs");
const path = require("path");

// Path to the stats.json file
const statsFilePath = path.resolve(__dirname, "dist", "stats.json");

// Read and parse the stats.json file
const stats = JSON.parse(fs.readFileSync(statsFilePath, "utf-8"));

// Function to analyze the stats and find TypeScript references
function analyzeStats(stats) {
  const typeScriptModules = [];
  const nodeMetas = stats.nodeMetas;

  // Iterate through nodeMetas to find TypeScript references
  for (const [key, value] of Object.entries(nodeMetas)) {
    if (value.id && value.id.includes("typescript")) {
      typeScriptModules.push({
        id: value.id,
        importedBy: value.importedBy,
      });
    }
  }

  return typeScriptModules;
}

// Function to get module details by key
function getModuleDetails(key, nodeMetas) {
  const module = nodeMetas[key];
  if (module) {
    return {
      id: module.id,
      importedBy: module.importedBy,
    };
  }
  return null;
}

// Analyze the stats
const typeScriptModules = analyzeStats(stats);

// Output the results
console.log("TypeScript Modules Found:");
typeScriptModules.forEach((module, index) => {
  console.log(`\nModule ${index + 1}:`);
  console.log(`ID: ${module.id}`);
  console.log("Imported By:");
  module.importedBy.forEach((importer) => {
    const importerDetails = getModuleDetails(importer.uid, stats.nodeMetas);
    if (importerDetails) {
      console.log(`  - ${importerDetails.id}`);
    } else {
      console.log(`  - ${JSON.stringify(importer)}`);
    }
  });
});

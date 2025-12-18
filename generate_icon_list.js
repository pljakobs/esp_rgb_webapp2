import fs from "fs";
import path from "path";
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

// Function to generate the file list
function generateFileList(files, baseDir) {
  return files
    .map((file, index) => {
      const relativePath = path.relative(baseDir, file).replace(/\\/g, "/");
      const key = path.basename(file, path.extname(file)).replace(/[-.]/g, "_");
      const line = `\tXX(${key}, "${relativePath}")`;
      return index === files.length - 1 ? line : `${line} \\`;
    })
    .join("\n");
}

// Main function
function main() {
  const baseDir = path.resolve(__dirname, "dist/spa");
  const files = findFiles(baseDir);
  const fileList = generateFileList(files, baseDir);
  console.log("#define FILE_LIST(XX) \\");
  console.log(fileList);
}

// Run the main function
main();

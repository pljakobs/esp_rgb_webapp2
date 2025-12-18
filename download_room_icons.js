#!/usr/bin/env node

/**
 * Script to download room and location SVG icons from Material Design Icons
 * and save them to public/icons/lights directory
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Room and location icons to download
const roomIcons = [
  // Bedrooms
  "bed",
  "bedroom_baby",
  "bedroom_child",
  "bedroom_parent",
  "single_bed",
  "king_bed",
  "crib",

  // Living Areas
  "living",
  "chair",
  "chair_alt",
  "deck",
  "balcony",

  // Kitchen & Dining
  "kitchen",
  "dining",
  "breakfast_dining",
  "dinner_dining",
  "brunch_dining",
  "local_dining",
  "restaurant",
  "coffee_maker",
  "microwave",

  // Bathrooms
  "bathroom",
  "bathtub",
  "shower",
  "hot_tub",

  // Utility & Storage
  "garage",
  "door_front",
  "door_back",
  "door_sliding",
  "stairs",
  "elevator",
  "escalator",

  // Outdoor Areas
  "outdoor_grill",
  "pool",
  "spa",
  "cabin",
  "cottage",
  "bungalow",
  "chalet",
  "castle",

  // Office & Study
  "desk",
  "library_books",
  "computer",

  // Special Areas
  "meeting_room",
  "family_restroom",
  "checkroom",
  "camera_indoor",
  "camera_outdoor",

  // Religious/Ceremonial
  "church",
  "mosque",
  "synagogue",

  // Additional useful room icons
  "apartment",
  "house",
  "house_siding",
  "home",
  "home_work",
  "room",
  "room_preferences",
  "room_service",
  "other_houses",
  "fireplace",
  "countertops",
  "curtains",
  "blinds",
  "window",
  "sensor_door",
  "sensor_window",
  "doorbell",
];

// Create lights directory if it doesn't exist
const lightsDir = path.join(__dirname, "public", "icons", "lights");
if (!fs.existsSync(lightsDir)) {
  fs.mkdirSync(lightsDir, { recursive: true });
  console.log(`Created directory: ${lightsDir}`);
}

// Base URL for Material Design Icons (outlined variant)
const baseUrl =
  "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined";

// Function to download an icon
function downloadIcon(iconName) {
  return new Promise((resolve, reject) => {
    // Material Design Icons URL format for outlined variant
    const url = `${baseUrl}/${iconName}/default/24px.svg`;
    const filePath = path.join(lightsDir, `${iconName}.svg`);

    console.log(`Downloading ${iconName}...`);

    const request = https.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(filePath);
        response.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close();
          console.log(`✅ Downloaded: ${iconName}.svg`);
          resolve();
        });

        fileStream.on("error", (err) => {
          fs.unlink(filePath, () => {}); // Delete incomplete file
          console.error(`❌ Error saving ${iconName}: ${err.message}`);
          reject(err);
        });
      } else if (response.statusCode === 404) {
        console.log(`⚠️  Icon not found: ${iconName} (404)`);
        resolve(); // Don't reject, just continue
      } else {
        console.error(`❌ HTTP error for ${iconName}: ${response.statusCode}`);
        resolve(); // Don't reject, just continue
      }
    });

    request.on("error", (err) => {
      console.error(`❌ Network error for ${iconName}: ${err.message}`);
      resolve(); // Don't reject, just continue
    });

    request.setTimeout(10000, () => {
      request.destroy();
      console.error(`❌ Timeout for ${iconName}`);
      resolve(); // Don't reject, just continue
    });
  });
}

// Function to download all icons with delay to avoid rate limiting
async function downloadAllIcons() {
  console.log(`🚀 Starting download of ${roomIcons.length} room icons...\n`);

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < roomIcons.length; i++) {
    const iconName = roomIcons[i];

    try {
      await downloadIcon(iconName);
      successful++;
    } catch (error) {
      failed++;
    }

    // Add small delay to be respectful to the server
    if (i < roomIcons.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`\n📊 Download Summary:`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📁 Icons saved to: ${lightsDir}`);

  // List downloaded files
  console.log(`\n📋 Downloaded files:`);
  const files = fs
    .readdirSync(lightsDir)
    .filter((file) => file.endsWith(".svg"));
  files.forEach((file) => console.log(`   - ${file}`));
}

// Alternative function to try different Material Design endpoints
async function tryAlternativeDownload(iconName) {
  const alternatives = [
    `https://raw.githubusercontent.com/google/material-design-icons/master/src/social/${iconName}/materialicons/24px.svg`,
    `https://raw.githubusercontent.com/google/material-design-icons/master/src/maps/${iconName}/materialicons/24px.svg`,
    `https://raw.githubusercontent.com/google/material-design-icons/master/src/places/${iconName}/materialicons/24px.svg`,
    `https://raw.githubusercontent.com/google/material-design-icons/master/src/home/${iconName}/materialicons/24px.svg`,
    `https://fonts.gstatic.com/s/i/materialicons/${iconName}/v1/24px.svg`,
    `https://fonts.gstatic.com/s/i/materialiconsoutlined/${iconName}/v1/24px.svg`,
  ];

  for (const url of alternatives) {
    try {
      console.log(`Trying alternative URL for ${iconName}: ${url}`);
      await downloadFromUrl(url, iconName);
      return true;
    } catch (error) {
      continue;
    }
  }
  return false;
}

function downloadFromUrl(url, iconName) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(lightsDir, `${iconName}.svg`);

    const request = https.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(filePath);
        response.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close();
          console.log(`✅ Downloaded via alternative: ${iconName}.svg`);
          resolve();
        });

        fileStream.on("error", reject);
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    });

    request.on("error", reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error("Timeout"));
    });
  });
}

// Run the download
if (require.main === module) {
  downloadAllIcons().catch(console.error);
}

module.exports = { downloadAllIcons, roomIcons };

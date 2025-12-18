#!/bin/bash

# Enhanced script to download extended icon collection for lighting controllers
# Downloads from Material Design Icons and saves to public/icons/lights
# Includes office, kitchen, street, garden, and specific lighting context icons

# Create the lights directory if it doesn't exist
LIGHTS_DIR="public/icons/lights"
mkdir -p "$LIGHTS_DIR"

echo "🚀 Downloading extended icon collection to $LIGHTS_DIR"
echo ""

# Extended icon collection organized by category
EXTENDED_ICONS=(
    # Office & Workspace Specific
    "workstation"
    "meeting_room"
    "conference_room"
    "office_building"
    "business_center"
    "work"
    "corporate_fare"
    "domain"
    "apartment"
    "business"
    "store"
    "storefront"
    "local_convenience_store"
    "shopping_cart"
    "cash_register"
    "point_of_sale"
    "inventory"
    "warehouse"
    
    # Kitchen & Appliance Specific
    "kitchen_island"
    "counter"
    "cabinet"
    "cupboard"
    "pantry"
    "refrigerator"
    "freezer"
    "dishwasher"
    "oven"
    "stove"
    "range_hood"
    "blender"
    "toaster"
    "kettle"
    "rice_cooker"
    "slow_cooker"
    "grill"
    "cutting_board"
    "utensils"
    "flatware"
    "wine_glass"
    "local_bar"
    "local_cafe"
    "bakery_dining"
    
    # Street & Outdoor Lighting
    "streetview"
    "road"
    "route"
    "highway"
    "traffic"
    "traffic_light"
    "streetlight"
    "light_mode"
    "wb_sunny"
    "nights_stay"
    "lamppost"
    "security"
    "shield"
    "visibility"
    "visibility_off"
    "floodlight"
    "flashlight_on"
    "flashlight_off"
    "highlight"
    "lens"
    "brightness_high"
    "brightness_medium"
    "brightness_low"
    "auto_awesome"
    
    # Garden & Outdoor Spaces
    "yard"
    "grass"
    "nature"
    "park"
    "forest"
    "tree"
    "flower"
    "local_florist"
    "agriculture"
    "eco"
    "energy_savings_leaf"
    "outdoor_garden"
    "potted_plant"
    "spa"
    "hot_tub"
    "pool"
    "water_drop"
    "sprinkler"
    "fence"
    "gate"
    "landscape"
    "terrain"
    "hiking"
    "campfire"
    "fire_extinguisher"
    "local_fire_department"
    
    # Entertainment & Recreation
    "tv"
    "speaker"
    "theaters"
    "movie"
    "music_note"
    "piano"
    "guitar"
    "games"
    "sports_esports"
    "casino"
    "celebration"
    "party_mode"
    "nightlight"
    "mood"
    
    # Utility & Technical Areas
    "electrical_services"
    "power"
    "cable"
    "router"
    "wifi"
    "signal_wifi_4_bar"
    "network_node"
    "hub"
    "switch"
    "outlet"
    "plug"
    "extension"
    "settings_input_component"
    "memory"
    "developer_board"
    "precision_manufacturing"
    "build"
    "construction"
    "handyman"
    "plumbing"
    "hvac"
    "ac_unit"
    "heat_pump"
    "thermostat"
    "water_heater"
    "propane_tank"
    
    # Security & Monitoring
    "security_camera"
    "camera_indoor"
    "camera_outdoor"
    "doorbell_camera"
    "motion_sensor_active"
    "motion_sensor_idle"
    "sensor_occupied"
    "detector"
    "alarm"
    "warning"
    "emergency"
    "medical_services"
    "local_hospital"
    "lock"
    "lock_open"
    "key"
    "vpn_key"
    "badge"
    "fingerprint"
    
    # Specialized Lighting Context
    "highlight_alt"
    "auto_mode"
    "hdr_auto"
    "hdr_on"
    "hdr_off"
    "exposure"
    "iso"
    "wb_auto"
    "wb_incandescent"
    "wb_fluorescent"
    "wb_cloudy"
    "wb_shade"
    "palette"
    "color_lens"
    "invert_colors"
    "gradient"
    "blur_on"
    "blur_off"
    "lens_blur"
    "filter"
    "tune"
    "format_color_fill"
    "brightness_1"
    "brightness_2"
    "brightness_3"
    "brightness_4"
    "brightness_5"
    "brightness_6"
    "brightness_7"
    
    # Weather & Environment
    "wb_sunny"
    "wb_cloudy"
    "cloud"
    "thunderstorm"
    "ac_unit"
    "severe_cold"
    "whatshot"
    "local_fire_department"
    "air"
    "wind_power"
    "solar_power"
    "wind_turbine"
    "water_damage"
    "flood"
    "umbrella"
    "beach_umbrella"
    
    # Transportation & Access
    "garage_door"
    "car_repair"
    "local_parking"
    "ev_station"
    "gas_station"
    "charging_station"
    "bike_scooter"
    "motorcycle"
    "directions_car"
    "directions_bike"
    "directions_walk"
    "accessible"
    "elevator"
    "escalator_warning"
    "ramp_left"
    "ramp_right"
    
    # Special Purpose Areas
    "local_laundry_service"
    "dry_cleaning"
    "iron"
    "checkroom"
    "luggage"
    "inventory_2"
    "shelves"
    "archive"
    "folder"
    "storage"
    "sd_storage"
    "cloud_sync"
    "backup"
    "restore"
    "cleaning_services"
    "vacuum"
    "mop"
    "sanitizer"
    "wash"
    "local_shipping"
    "mail"
    "markunread_mailbox"
    
    # Health & Wellness
    "fitness_center"
    "pool"
    "sauna"
    "self_improvement"
    "psychology"
    "healing"
    "medication"
    "vitamins"
    "monitor_heart"
    "ecg_heart"
    "favorite"
    "volunteer_activism"
    "pets"
    "cruelty_free"
)

# Counters
SUCCESSFUL=0
FAILED=0
TOTAL=${#EXTENDED_ICONS[@]}

# Function to download an icon with multiple URL attempts
download_icon() {
    local icon_name="$1"
    local output_file="$LIGHTS_DIR/${icon_name}.svg"
    
    # Skip if file already exists
    if [ -f "$output_file" ]; then
        echo "⏭️  ${icon_name} (already exists)"
        ((SUCCESSFUL++))
        return 0
    fi

    # Try multiple Material Design Icon URLs
    local urls=(
        "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${icon_name}/default/24px.svg"
        "https://fonts.gstatic.com/s/i/materialiconsoutlined/${icon_name}/v1/24px.svg"
        "https://fonts.gstatic.com/s/i/materialicons/${icon_name}/v1/24px.svg"
        "https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/${icon_name}/materialsymbolsoutlined/24px.svg"
        "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/${icon_name}/default/24px.svg"
        "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolssharp/${icon_name}/default/24px.svg"
    )

    echo -n "Downloading ${icon_name}... "

    for url in "${urls[@]}"; do
        if curl -s -f -L --max-time 15 "$url" -o "$output_file" 2>/dev/null; then
            # Check if file is actually an SVG (not an error page)
            if grep -q "<svg" "$output_file" 2>/dev/null; then
                echo "✅"
                ((SUCCESSFUL++))
                return 0
            else
                rm -f "$output_file"
            fi
        fi
    done

    echo "❌ (not found)"
    ((FAILED++))
    return 1
}

# Display categories being downloaded
echo "📂 Icon Categories:"
echo "   • Office & Workspace (workstation, meeting rooms, business areas)"
echo "   • Kitchen & Appliances (islands, counters, appliances)"
echo "   • Street & Outdoor Lighting (streetlights, security, visibility)"
echo "   • Garden & Outdoor Spaces (yard, plants, landscape features)"
echo "   • Entertainment & Recreation (TV areas, music, gaming)"
echo "   • Utility & Technical (electrical, HVAC, networking)"
echo "   • Security & Monitoring (cameras, sensors, access control)"
echo "   • Specialized Lighting (brightness, color, effects)"
echo "   • Weather & Environment (conditions, energy, climate)"
echo "   • Transportation & Access (garage, parking, mobility)"
echo "   • Special Purpose Areas (laundry, storage, cleaning)"
echo "   • Health & Wellness (fitness, spa, medical)"
echo ""

# Download all icons
echo "Downloading ${TOTAL} extended icons..."
echo ""

for icon in "${EXTENDED_ICONS[@]}"; do
    download_icon "$icon"
    # Small delay to be respectful to the server
    sleep 0.1
done

echo ""
echo "📊 Download Summary:"
echo "✅ Successful: $SUCCESSFUL"
echo "❌ Failed: $FAILED"
echo "📁 Total icons in lights folder: $(ls -1 "$LIGHTS_DIR"/*.svg 2>/dev/null | wc -l)"
echo ""

# Show some statistics
if [ $SUCCESSFUL -gt 0 ]; then
    echo "📈 Icon Collection Stats:"
    echo "   • Hardware lighting icons: ~34"
    echo "   • Room & location icons: ~67"
    echo "   • Extended context icons: $SUCCESSFUL (new)"
    echo "   • Total collection size: $(ls -1 "$LIGHTS_DIR"/*.svg 2>/dev/null | wc -l) icons"
fi

echo ""
echo "🎉 Extended icon download complete!"
echo ""
echo "💡 Usage Examples:"
echo "   • 'workstation' - Office desk lighting"
echo "   • 'kitchen_island' - Kitchen island pendant lights"
echo "   • 'streetlight' - Outdoor pathway lighting"
echo "   • 'garden' - Garden accent lighting"
echo "   • 'security_camera' - Security lighting"
echo "   • 'garage_door' - Garage entrance lighting"
echo "   • 'pool' - Pool area lighting"
echo "   • 'fireplace' - Fireplace ambient lighting"
echo ""
echo "🔧 Next Steps:"
echo "   1. Update HostnameCard.vue icon arrays with new categories"
echo "   2. Organize icons by functional groups"
echo "   3. Test icon availability and rendering"
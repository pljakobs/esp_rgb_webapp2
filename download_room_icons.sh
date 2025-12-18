#!/bin/bash

# Script to download room and location SVG icons for lighting controllers
# Downloads from Material Design Icons and saves to public/icons/lights

# Create the lights directory if it doesn't exist
LIGHTS_DIR="public/icons/lights"
mkdir -p "$LIGHTS_DIR"

echo "🚀 Downloading room and location icons to $LIGHTS_DIR"
echo ""

# Room and location icons to download
ROOM_ICONS=(
    # Bedrooms
    "bed"
    "bedroom_baby"
    "bedroom_child"
    "bedroom_parent"
    "single_bed"
    "king_bed"
    "crib"

    # Living Areas
    "living"
    "chair"
    "chair_alt"
    "deck"
    "balcony"

    # Kitchen & Dining
    "kitchen"
    "dining"
    "breakfast_dining"
    "dinner_dining"
    "brunch_dining"
    "local_dining"
    "restaurant"
    "coffee_maker"
    "microwave"

    # Bathrooms
    "bathroom"
    "bathtub"
    "shower"
    "hot_tub"

    # Utility & Storage
    "garage"
    "door_front"
    "door_back"
    "door_sliding"
    "stairs"
    "elevator"
    "escalator"

    # Outdoor Areas
    "outdoor_grill"
    "pool"
    "spa"
    "cabin"
    "cottage"
    "bungalow"
    "chalet"
    "castle"

    # Office & Study
    "desk"
    "library_books"
    "computer"

    # Special Areas
    "meeting_room"
    "family_restroom"
    "checkroom"
    "camera_indoor"
    "camera_outdoor"

    # Religious/Ceremonial
    "church"
    "mosque"
    "synagogue"

    # Additional useful room icons
    "apartment"
    "house"
    "house_siding"
    "home"
    "home_work"
    "room"
    "room_preferences"
    "room_service"
    "other_houses"
    "fireplace"
    "countertops"
    "curtains"
    "blinds"
    "sensor_door"
    "sensor_window"
    "doorbell"
)

# Counters
SUCCESSFUL=0
FAILED=0
TOTAL=${#ROOM_ICONS[@]}

# Function to download an icon with multiple URL attempts
download_icon() {
    local icon_name="$1"
    local output_file="$LIGHTS_DIR/${icon_name}.svg"

    # Try multiple Material Design Icon URLs
    local urls=(
        "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${icon_name}/default/24px.svg"
        "https://fonts.gstatic.com/s/i/materialiconsoutlined/${icon_name}/v1/24px.svg"
        "https://fonts.gstatic.com/s/i/materialicons/${icon_name}/v1/24px.svg"
        "https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/${icon_name}/materialsymbolsoutlined/24px.svg"
    )

    echo -n "Downloading ${icon_name}... "

    for url in "${urls[@]}"; do
        if curl -s -f -L --max-time 10 "$url" -o "$output_file" 2>/dev/null; then
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

# Download all icons
echo "Downloading ${TOTAL} room icons..."
echo ""

for icon in "${ROOM_ICONS[@]}"; do
    download_icon "$icon"
    # Small delay to be respectful to the server
    sleep 0.1
done

echo ""
echo "📊 Download Summary:"
echo "✅ Successful: $SUCCESSFUL"
echo "❌ Failed: $FAILED"
echo "📁 Icons saved to: $LIGHTS_DIR"
echo ""

# List downloaded files
if [ $SUCCESSFUL -gt 0 ]; then
    echo "📋 Downloaded files:"
    ls -1 "$LIGHTS_DIR"/*.svg 2>/dev/null | while read file; do
        basename "$file"
    done | sed 's/^/   - /'
fi

echo ""
echo "🎉 Room icon download complete!"
echo ""
echo "💡 Usage: These icons can now be used in your lighting controller interface"
echo "   to represent different rooms and locations around the house."

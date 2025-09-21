# Room & Location Icons Reference

This file contains a reference for all the room and location icons downloaded for the lighting controller interface.

## 🛏️ **Bedroom Icons**

- `bed.svg` - General bedroom
- `bedroom_baby.svg` - Baby's room/nursery
- `bedroom_child.svg` - Child's bedroom
- `bedroom_parent.svg` - Master bedroom/parent's room
- `single_bed.svg` - Guest room/single bed
- `king_bed.svg` - Master bedroom with king bed
- `crib.svg` - Nursery with crib

## 🛋️ **Living Areas**

- `living.svg` - Living room
- `chair.svg` - Seating area/living room
- `chair_alt.svg` - Alternative living room
- `deck.svg` - Deck/patio area
- `balcony.svg` - Balcony

## 🍳 **Kitchen & Dining**

- `kitchen.svg` - Kitchen
- `dining.svg` - Dining room
- `breakfast_dining.svg` - Breakfast nook
- `dinner_dining.svg` - Formal dining
- `brunch_dining.svg` - Brunch area
- `local_dining.svg` - Casual dining
- `restaurant.svg` - Formal dining room
- `coffee_maker.svg` - Coffee station
- `microwave.svg` - Kitchen appliance area

## 🚿 **Bathrooms**

- `bathroom.svg` - General bathroom
- `bathtub.svg` - Bathroom with tub
- `shower.svg` - Shower room
- `hot_tub.svg` - Spa bathroom/hot tub area

## 🏠 **Utility & Storage**

- `garage.svg` - Garage
- `door_front.svg` - Front entrance
- `door_back.svg` - Back entrance
- `door_sliding.svg` - Patio door
- `stairs.svg` - Stairway
- `elevator.svg` - Elevator area
- `escalator.svg` - Escalator area

## 🌳 **Outdoor Areas**

- `outdoor_grill.svg` - BBQ/grill area
- `pool.svg` - Pool area
- `spa.svg` - Spa/hot tub area
- `cabin.svg` - Cabin/shed
- `cottage.svg` - Guest cottage
- `bungalow.svg` - Bungalow style
- `chalet.svg` - Chalet style
- `castle.svg` - Fancy/formal areas

## 💼 **Office & Study**

- `desk.svg` - Home office
- `library_books.svg` - Study/library
- `computer.svg` - Computer room

## 🏢 **Special Areas**

- `meeting_room.svg` - Conference room
- `family_restroom.svg` - Family room
- `checkroom.svg` - Coat closet
- `camera_indoor.svg` - Indoor security area
- `camera_outdoor.svg` - Outdoor security area

## ⛪ **Religious/Ceremonial**

- `church.svg` - Chapel/prayer room
- `mosque.svg` - Prayer room (Islamic)
- `synagogue.svg` - Prayer room (Jewish)

## 🏘️ **Building Types**

- `apartment.svg` - Apartment unit
- `house.svg` - House/home
- `house_siding.svg` - House with siding
- `home.svg` - General home icon
- `home_work.svg` - Home office
- `other_houses.svg` - Other residential buildings

## 🪟 **Interior Features**

- `room.svg` - General room
- `room_preferences.svg` - Room settings
- `room_service.svg` - Service areas
- `fireplace.svg` - Fireplace area
- `countertops.svg` - Kitchen counters
- `curtains.svg` - Window treatments
- `blinds.svg` - Window blinds

## 🔐 **Security & Access**

- `sensor_door.svg` - Door sensor areas
- `sensor_window.svg` - Window sensor areas
- `doorbell.svg` - Front door/entrance

## 💡 **Usage in HostnameCard**

To add these room icons to your controller icon selector, you can extend the `lightIcons` array in `src/components/cards/HostnameCard.vue`:

```javascript
const roomIcons = [
  // Bedrooms
  { value: "bed", label: "Bedroom" },
  { value: "bedroom_baby", label: "Baby's Room" },
  { value: "bedroom_child", label: "Child's Room" },
  { value: "bedroom_parent", label: "Master Bedroom" },

  // Living Areas
  { value: "living", label: "Living Room" },
  { value: "chair", label: "Seating Area" },
  { value: "deck", label: "Deck/Patio" },
  { value: "balcony", label: "Balcony" },

  // Kitchen & Dining
  { value: "kitchen", label: "Kitchen" },
  { value: "dining", label: "Dining Room" },
  { value: "breakfast_dining", label: "Breakfast Nook" },

  // Bathrooms
  { value: "bathroom", label: "Bathroom" },
  { value: "shower", label: "Shower" },

  // Utility
  { value: "garage", label: "Garage" },
  { value: "stairs", label: "Stairway" },

  // Outdoor
  { value: "pool", label: "Pool Area" },
  { value: "outdoor_grill", label: "BBQ Area" },

  // Office
  { value: "desk", label: "Home Office" },
  { value: "library_books", label: "Study/Library" },

  // Add more as needed...
];

// Then combine with existing lightIcons:
const allIcons = [...lightIcons, ...roomIcons];
```

This gives users the flexibility to identify their lighting controllers by both:

1. **Hardware type** (ceiling light, LED strip, etc.)
2. **Room location** (kitchen, bedroom, garage, etc.)

Perfect for organizing smart home lighting! 🏡✨

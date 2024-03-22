## for alpha

- complete / verify OTA for ESP8266
- create setup webapp (configuring for initial wlan)
  might be doable through routes:

  ```
  const routes = [
  {
    path: '/init',
    component: InitComponent, // replace with your actual component
  },
  {
    path: '/webapp',
    component: WebAppComponent, // replace with your actual component
  },
  // other routes...
  ];
  ```

- finish basic front end functions

## for beta

- implement scenes
- successfully build on ESP32
  - v2 partitioning scheme
    - Application in F-Strings
    - move to tinyfs
    - create flexible build system to easily build
      - esp8266 v1 (two roms, two spiffs)
        - will need ways to move objects between two spiffs upon ota
      - esp8266 v2 (two roms, tinyfs)
      - esp32 v2 only
- complete front end functionality
- potentially add first card to color carousel to have large, square buttons for fav scenes / presets
- store objects gotten from the object api locally and allow to re-store them to the controller if there are none (after a flash of the spiffs partitoin)
- backup / restore controller data
  - what to do with presets bound to the old controller id?

```

```

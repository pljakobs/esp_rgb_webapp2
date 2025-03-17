## esp rgb web frontent rewrite

### Reason
The old web frontent has originally been written using AngularJS in 2015 or 2016 and while it continues to work just fine, asking around in my community has made me think that porting it to a newer, 
leaner framework is probably no more troublesome than porting it to a new version of Agular. Also, the impression I got was that Angular has gone the route of providing the tools for very large projects
rather than those very small ones that we need for the microcontroller world. 
After some more research and talking to people, it seems that *vue* is now the framework most would flock to for such a project, and, at first glance from somebody who really only ever does developent of 
components that don't ever see daylight (in that they don't have any form of UI besides from APIs and maybe a Terminal), it seems to have all the components and capabilites needed.

In addition Quasar is an environment built on top of vue that allows to build fully featured applications, not just for the web but also as native Android and iOS apps, something I have long wanted for 
the lightinator hardware.
This way, we will finally be able to break out of the lock in to fhem that the hardware has long had due to the fact that that is the only environment where there was a good driver integration and documentation.

So my current plan of action is to re-implement and re-build the UI using Quasar / vue and extend from there.

### Project phases
#### Phase 1: reimplement the currently existing
*The biggest driver to reimplement the UI is the fact that I have changed the underlying structure such that an OTA now only uses a single image rather than a separate app and spiffs image (the webapp is 
embedded in the firmware as flash strings, making the update a monolith and the resulting system less dependent on SPIFFS health). On the controller side, I will have to change the OTA API such that it only pulls
that one image rather than two. I could probably get away with the current frontend, but ... there is more I want to change, so why not start here. So in future, the frontend will call the API with just a single
image url. That has to be coded.*
For phase one, all I really intend to achieve is a feature complete re-implementation of the current UI with the change to the OTA call noted above. That's all. 

[x] single image firmware
[x] backend ported to Sming 6 and ConfigDB
[x] freed up about 15kB of Heap on the ESP 8266
[x] HSV color picker
[x] RAW color picker
[x] color settings
[x] network settings
  [x] hostname
  [x] static / dchp ip config
  [x] mqtt settings ([ ] needs testing)
[x] network initialization 
[ ] reliable captive page for 8266
[x] firmware OTA
[ ] pin config
[x] presets for HSV and RAW and favorites 

#### Phase 2: go beyond one controller
As I said above, one of the appeals of Quasar is that it allows to build native apps that live locally. To fully enable that, I want the app to be able to talk to multiple controllers. Here is what I have in mind:

[x] be able to maintain (add, remove, name, rename, group) a list of controllers known to the app locally
[x] naming the controller in the app should write the name back to the controller, so that it is able to be identified by that name by others, too
[ ] grouping controllers will allow to create scenes that apply to multiple controllers right from the device, without support from any home automation system.
[ ] the grouping and scenes information should probably by saved to the controllers and provided to new apps that talk to them so they are not bound to individual devices.
[ ] a ui element to manage scenes will have to be added

[x] mDNS controller detection
[x] single instance UI allows access to all controllers
[ ] mDNS for UI Access (accessing lightinator.local or so)


#### Phase 3: make better use of the existing hardware
It has always bugged me that, with all it's flexibility, the controllers are limited to a few very basic modes:
- RGB (only uses three outputs combined)
- RGBW (uses four outputs combined)
- RGBWWCW (uses all five outputs combined)
- RAW (can use all five outputs independently, but does not get many of the features that the firmware provides)

In the last major rewrite, [VeryBadSoldier](https://github.com/verybadsoldier/) has changed the internals such that every color channel has it's own "pipeline" that runs fades etc. This way, the firmware, as far as I uderstand, has more capabilities that is exposed through the API. 

Add to that the fact that the larger ESP32 SoCs support up to 16 PWM channels and hardware for that can easily be built, I believe there's a few cool things to be done with this.

My idea is this:

**provide a way to define "virtual" lights**

What I'm imagining is a way to tell the controller 
- Pins 4,7 and 9 make up an RGB light
- Pins 11,13,14,15 and 17 make up an RGBWWCW light
- Pins 21 and 22 are a Coldwhite/Warmwhite Light"

and from then on, you could use those defined lights as if they were separate controllers (albeit they will need to be handled differently on the API as they will live on the same IP address).
All that I have described so far as Phase 3 is, of course, something that has to be implemented on the firmware first, but once that has been done, it will need the corresponding UI extensions as well, hence why I'm describing it here.


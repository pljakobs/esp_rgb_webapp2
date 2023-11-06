## esp rgb web frontent rewrite

# Reason
The old web frontent has originally been written using AngularJS in 2015 or 2016 and while it continues to work just fine, asking around in my community has made me think that porting it to a newer, 
leaner framework is probably no more troublesome than porting it to a new version of Agular. Also, the impression I got was that Angular has gone the route of providing the tools for very large projects
rather than those very small ones that we need for the microcontroller world. 
After some more research and talking to people, it seems that *vue* is now the framework most would flock to for such a project, and, at first glance from somebody who really only ever does developent of 
components that don't ever see daylight (in that they don't have any form of UI besides from APIs and maybe a Terminal), it seems to have all the components and capabilites needed.

In addition Quasar is an environment built on top of vue that allows to build fully featured applications, not just for the web but also as native Android and iOS apps, something I have long wanted for 
the lightinator hardware.
This way, we will finally be able to break out of the lock in to fhem that the hardware has long had due to the fact that that is the only environment where there was a good driver integration and documentation.

So my current plan of action is to re-implement and re-build the UI using Quasar / vue and extend from there.

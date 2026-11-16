# Public Lightinator WebUI demo plan

## Goal

Link an interactive demo from lightinator.de using the newest published
`5.1/develop` WebUI on that same site. The visitor can explore the six
standard pages with a simulated controller. Changes belong to the current
page only and reset on reload; no real controller is discovered or changed.

## Components

1. **WebUI demo mode:** `?demo=1` installs a browser-local simulated controller
   before store initialization. It supplies controller, configuration, virtual
   light, preset, group, scene and sensor responses, handles settings writes and
   simulates update checks. A persistent banner identifies the demo and offers
   a reset. Demo mode is explicit, never a fallback for connection errors.
2. **Isolation:** The demo transport rejects non-demo fetches except the
   same-origin icon sprite, and demo mode does not connect WebSockets. The
   server supplies a restrictive CSP as a separate browser-enforced barrier.
   Neither simulator state nor credentials should be sent to a shared server.
3. **Published-build resolver:** The distribution service resolves the latest
   exact `5.1/develop` version for each page load and serves its packaged
   assets from a version-specific URL. It rewrites entry-point asset paths and
   decompresses the published gzip files. A missing or demo-incompatible latest
   build must produce an explicit error, not fall back to an older version.
4. **Landing page and deployment:** Link to `/api/demo/` from the site. Publish
   a demo-enabled WebUI first, then deploy the updated distribution service
   and add the landing-page link through the site's actual deployment process.
   The current server update script does not copy the landing page.
5. **Home-controller parameter:** `?home=<IPv4-or-hostname>` selects the
   initial controller when the UI is loaded from another controller. Demo mode
   takes precedence. Cross-origin and mixed-content restrictions still apply;
   the firmware redirect itself is outside this change.

## Validation and release

- Exercise navigation and representative writes/readback on all six pages,
  including virtual-light configuration, setup, sensors, sync and simulated
  updates. Verify reload and independent tabs start with fresh state.
- Observe browser traffic and verify that real-controller requests fail;
  test the packaged build through the server resolver and its CSP.
- Run WebUI tests and production build and the server resolver tests. Check
  latest-version selection, missing packages and assets, path validation and
  existing distribution endpoints.
- Deploy only after confirming the published build, server configuration and
  landing-page deployment; these worktree changes are not a deployment.

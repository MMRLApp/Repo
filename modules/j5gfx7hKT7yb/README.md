A Magisk / KernelSU / APatch module in two halves: **Display**, which gives
Android's display pipeline the range it already has the hardware for, and
**Quiet Field**, which stops apps taking your attention when you didn't offer
it.

Both work the same way. They drive mechanisms Android already has instead of
inventing new ones. **Neither needs Xposed, and that includes LSPosed.** Nothing here
hooks a process or patches a framework method, which is why it survives ROM
updates and behaves the same on a Pixel and on a heavily skinned OEM build.

```
su -c lunectl warm 1850            # candlelight. Stock Android stops at 2596K.
su -c lunectl level 8              # readable at 3am, below the panel's minimum.
su -c lunectl flicker on           # stop the PWM strobe low brightness causes.

su -c quietctl add com.some.app    # no wake locks, no screen-on, no takeover.
su -c quietctl window 2100-0800    # quiet hours. Alarms still work.
```

---

## Display

Android can already tint your screen to candlelight and dim it far below the
brightness slider's floor. It does both in the compositor, with no overlay
window and no accessibility service. It just refuses to go that far. The limits
are constants in `framework-res`, and they are set conservatively.

This module moves those limits, correctly.

---

## Why this is not another screen-dimmer

Every no-root dimming app works the same way: draw a translucent black window
over everything. That approach has permanent costs. It can't cover the status
bar reliably, it blacks out in screenshots and screen recordings, it's
excluded from secure surfaces, it crushes contrast because it's adding black
rather than emitting less light, and it needs an accessibility service or an
always-on overlay permission that users are right to be suspicious of.

Android's own mechanisms have none of those problems, because they run in the
compositor before anything reaches the panel:

| | Overlay apps | Lune |
|---|---|---|
| Lock screen, status bar | partial | covered |
| Screenshots / recording | blacked out | clean |
| Secure surfaces (banking, DRM) | excluded | covered |
| Contrast at low light | crushed | preserved |
| Permissions needed | accessibility or overlay | none, it is a root module |
| Cost | an extra composited layer | none, it is a colour matrix |

Lune doesn't add a mechanism. It unlocks the ones that are already there.

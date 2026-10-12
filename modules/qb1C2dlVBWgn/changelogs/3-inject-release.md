## Diff with official inject v3

### v3-inject-vending
- based on official inject v3, no auto update
- added spoofVendingSdk
- added monet theme support in WebUI X

### v3-inject-manual
- based on `v3-inject-vending`
- removed auto config (tricky store and rom signature check)
- added manual conifg

---

## Known Issues

### Devices will experience degraded functionality in Play Store when spoofVendingSdk is enabled:

- Back gesture/nav button from within the Play Store exits directly to homescreen for all
- Blank account sign-in status and broken app updates for ROMs A14+
- Incorrect app variants may be served for all
- Full Play Store crashes for some setups

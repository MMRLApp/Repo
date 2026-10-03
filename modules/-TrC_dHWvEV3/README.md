What's New

    Initial full stable release
    Rebuilt module logic to dynamically promote user-installed microG apps to system priv-app
    Introduced a built-in KernelSU WebUI for managing module state (promote/demote)
    Built-in APK downloader to directly fetch and update microG and Companion from GitHub releases

Requirements

    Magisk or KernelSU
    *For KSU* - A valid metamodule installed for partition mounting (e.g. magic mount, mountify, overlayfs)
    Signature spoofing support

Install

    Flash this module and Reboot.
    Open the KernelSU / WebUI X manager and open this module's WebUI.
    Download and install your preferred versions of microG GmsCore and microG Companion via the Installer tab.
    Return to the Home tab and long-press "Promote" to push the apps to the system level.
    Reboot to apply.

See [README ](https://github.com/spacealtctrl/microg_installer_revived_again)for full details

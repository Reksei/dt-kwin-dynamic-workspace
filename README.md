# KWin Dynamic Desktops

A KWin script that:
 - Toggles "Above others" status off when a window is maximized/fullscreened and then toggles it back on when a window is restored.
 - Creates a separate desktop when a window is maximized/fullscreened and sends this window to the new desktop. When the window is restored/closed, the dedicated desktop is removed.
 - Keeps one spare desktop on the right (GNOME-like).


 This script is multi-screen aware but it prioritizes active screen.

 I am no programmer by any means and I created this script for personal use, but I hope someone else will find it useful for their workflow. I like using it paired with the "Truely Maximized" script.

## Installation
1. Download this repository as a ZIP or clone it
2. Unzip the archive if the script was downloaded as a ZIP
3. Copy the script to the ~/.local/share/kwin/scripts/
4. Enable it in the system settings

## Issues
Probably, a lot. Feel free to open an issue, I will try to fix it, but please don't expect much, I'm no programmer.
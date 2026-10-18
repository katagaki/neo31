# Windows 31

A modern Windows desktop drawn entirely in Windows 3.1's pixels, running in the browser. It simulates a whole PC: BIOS checks and BIOS setup, Windows Setup and the out-of-box experience, sign-in, the desktop and its programs, Windows Update, and reset and recovery. It's plain HTML/CSS/JavaScript with no dependencies and no build step.

The desktop has lock and sign-in screens, a taskbar, a Start menu with live tiles, search, Action Center with notifications, Task View with virtual desktops, window snapping, File Explorer with a Recycle Bin, Settings, Task Manager, Weather, Photos, Alarms & Clock and Microsoft Edge. The Windows 3.1 programs (Program Manager, File Manager, Write, Paintbrush, Terminal and the rest) still run as apps.

Edge has tabs, favourites, history, downloads, find on page and whole-step zoom. Pages on `windows31.net`, the Kronos Network (Kronos Press news, weather, the Game Development Department, Angel 24 Downloads, help and Arona Search), are built in and work offline. `C:\` paths show your files. Any other address loads the live web inside the window. Sites that refuse to be framed (Bing, DuckDuckGo and many others) stay blank; use *Open in new window* for those.

The **Office** apps are simulated Microsoft Word, Excel, and PowerPoint. Word edits and formats documents, Excel provides cell formulas (`+ - * / ^`, cell references, ranges, and `SUM`/`AVERAGE`/`MIN`/`MAX`/`COUNT`) plus CSV import/export, and PowerPoint builds, reorders, themes, and presents slides. Their `.DOC`, `.XLS`, and `.PPT` files use Windows 31's own JSON-backed formats rather than native Microsoft Office binary formats.

**Photos** shows every picture in Pictures and the Windows wallpapers, with whole-step pixel-sharp zoom, rotate, slideshow, Set as desktop background and Edit in Paint. **Alarms & Clock** has alarms (they ring with the app closed), a timer and a stopwatch.

All graphics are pixel art. Icons, cursors, cards, wallpapers, the Windows flag and control glyphs are bitmaps in the 16-colour VGA palette, plotted pixel by pixel and scaled with nearest-neighbour. Nothing is drawn as vector art.

The PC's made-up hardware and services borrow names from Kivotos (Blue Archive): a Kaiser PC with a Veritas BIOS and a SHITTIM hard disk, the Schale Network, a Hyakkiyako FM Synthesizer and an Engineering Club modem.

Text uses the original bitmap fonts: System for title bars, menus and dialogs; MS Sans Serif 8 for icon labels, File Manager and status bars; Fixedsys for Notepad; and the IBM VGA 8×16 ROM font for the BIOS, MS-DOS and Terminal. Large headings (Settings page titles, the lock-screen clock, tiles, Weather) use W31 Sans, a 1-bit rasterization of Liberation Sans at fixed pixel sizes. They come from Wine's pixel clones of the Windows fonts, the Linux kernel's VGA font and Liberation Sans; see `fonts/LICENSE.md`. The screen is scaled by whole device pixels, so every font and icon pixel lands on a physical pixel. The default *Best Sharp Fit* display mode picks 640×480, 800×600 or 1024×768, whichever fills your window best; change it in Windows Setup (`SETUP.EXE`).

## Running

Serve the folder with any static web server and open `index.html`:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

URL options: `#fast` shortens the BIOS checks, `#win` goes straight to Windows, and `#reset` restores the factory state.

## A simulated PC

- **First start.** A new PC runs Windows Setup (language, product key, license, install type and drive, installing, restart). Then comes the out-of-box experience: region, keyboard, network, an update check, your name, an optional password and privacy settings. Each PC gets its own random device name, device ID, product ID, MAC and IP address.
- **BIOS setup.** Press **DEL** (Delete or Backspace on a Mac) or **F2** during the BIOS checks to open the CMOS Setup Utility. Quick self test, cache, floppy drives, boot order, the IDE controller and a supervisor password take effect at the next start. You can also change the date and time there.
- **Windows Update.** Settings > Update & Security > Windows Update downloads and installs this month's simulated updates. Some finish over a restart with "Working on updates" screens; the Power menu then offers *Update and restart*.
- **Reset and recovery.** *Reset this PC* (Keep my files or Remove everything) restarts, really resets the PC and runs Setup again. *Advanced startup* restarts into the recovery environment, which has Startup Repair, System Restore, Uninstall Updates and Reset this PC.
- **Shut down** leaves the PC at "It's now safe to turn off your computer" until you click or press a key.

## What's inside

| Area | Details |
|---|---|
| Boot | BIOS POST with memory count and BIOS setup → Windows boot screen → Setup or the lock screen |
| Desktop | Start, taskbar, search, Action Center, Task View, snapping, File Explorer, Settings, Task Manager, Weather, Photos, Edge, Alarms & Clock |
| Command Prompt | `COMMAND.COM` interpreter: `DIR` (`/W /P /B`), `CD`, `MD`, `RD`, `DEL`, `COPY` (incl. `COPY CON`), `MOVE`, `REN`, `TYPE`, `MORE`, `MEM`, `TREE`, `CHKDSK`, `SET`, `PATH`, `PROMPT`, `ECHO`, batch files with `GOTO`/`IF`, `>` redirection, history |
| Office | Microsoft Word, Excel and PowerPoint |
| Classic programs | Program Manager, File Manager, Control Panel, Print Manager, Clipboard Viewer, Windows Setup (screen resolution), Write, Paintbrush, Terminal (with the MomoTalk dial-up BBS at 555-0131), Notepad, Cardfile, Calendar, Calculator, Character Map, Media Player, Sound Recorder, WinHelp |
| Games | Solitaire (with the bouncing-card finale) and Minesweeper |

Files live on a virtual drive C: that is persisted to `localStorage`. Associations come from the `[Extensions]` section of `C:\WINDOWS\WIN.INI`. PCs saved by an older release get any programs and file types added since then installed at start-up.

## Files and storage

In File Explorer, use **File > Import files from computer** or **Export selected file**. The classic File Manager has the same commands. Imports keep existing files and choose a new name on collisions. Individual imports are limited to 16 MB, and browser storage may fill sooner.

Text files export as text, imported binary files retain their bytes, Paintbrush pictures export as PNG, and generated/recorded sounds export as WAV. Write, Calendar, Cardfile and other virtual document formats use Windows 31's own representations; they are not native Windows binary formats. Simulated executable placeholders have no real executable contents to export.

Files and settings persist together in one atomic browser-storage snapshot, with automatic migration from earlier formats, including PCs saved under the old Neo31 name.

If browser storage rejects a save, an alert stays visible with **Retry saving**. Your latest documents remain in memory while the page is open.

Write now supports page width/margins, tab spacing, picture insertion, alignment and sizing. Its layout is saved with the document; the simulated text printer still outputs plain text. Imported rich documents have active HTML removed. Paintbrush can edit, save and load 28-color palettes (`.PAL`). Calculator's scientific view supports datasets, mean, sum and sample standard deviation; Inv selects RMS, sum of squares and population deviation. Terminal supports text uploads, transcript capture and binary transfers to its local BBS; the BBS file area lasts for that Terminal session.

## Verification

Run the storage, migration and file-operation checks with Node:

```sh
node --test tests/storage.test.cjs
```

For browser workflow checks, serve the project and open `tests/runner.html#win` in a disposable browser profile. It loads fresh scripts. In the browser console, run:

```js
await runWindows31Regression()
```

The browser checks exercise import/export, save failure recovery, Write layout/pictures, Calculator statistics, Paintbrush palettes, Terminal transfers, unsaved-document cancellation, keyboard menus/dialogs and Edge guidance and Recovery settings. They restore the starting files/settings afterward. File-picker and destination selections are supplied by the test harness; native OS picker interaction remains a manual check. Shared controls now expose accessible names, menu/list/slider states, window buttons and modal focus containment; a full assistive-technology audit remains outstanding.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| Windows key / Ctrl+Esc | Start |
| Win+E / Win+R / Win+I | File Explorer / Run / Settings |
| Win+D / Win+L / Win+X | Show desktop / Lock / Power user menu |
| Win+A / Win+S / Win+Tab | Action Center / Search / Task View |
| Win+Arrow keys | Snap, maximise, restore, minimise |
| Ctrl+Win+Left/Right, Ctrl+Win+D | Switch / create virtual desktops |
| Ctrl+Shift+Esc | Task Manager |

Browsers reserve some Windows/Command-key combinations, so every action is also reachable with the mouse.

## Layout

```
index.html
css/win31.css            Windows 3.1 look & feel, colour-scheme variables, @font-face
css/windows31.css        desktop styles
css/setup31.css          Setup, update and recovery screens
fonts/                   generated pixel webfonts (+ LICENSE.md)
tools/build_fonts.py     converts the bitmap font sources into those webfonts
js/util.js               helpers, settings store
js/sound.js              synthesised system sounds (TADA, CHIMES, DING, CHORD)
js/icons.js              pixel-art icons, bitmap font, cursors, raster helpers
js/fs.js                 virtual FAT filesystem with the default C: drive
js/wm.js                 window manager, MDI, menus
js/ui.js                 dialog controls, message boxes, file dialogs
js/shell.js              system services, schemes, wallpapers, screen savers
js/dos.js                text console, COMMAND.COM, BIOS checks, power-off screen, Command Prompt
js/bios.js               CMOS settings and the BIOS setup utility
js/settings.js           system-wide settings: mouse, keyboard repeat, Alt+Tab, INI sync
js/apps/*.js             one file per application
js/windows31/*.js        desktop, File Explorer, Settings, Task Manager, Weather, Run, Edge, Photos
js/windows31/setup31.js  Windows Setup, out-of-box experience, Windows Update, reset and recovery
```

Windows 31 is a fan-made simulation. Microsoft and Windows are trademarks of Microsoft Corporation.

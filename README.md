# Neo31

A re-creation of Microsoft Windows 3.1 that runs in the browser: power-on, BIOS POST, MS-DOS boot, Windows, and the full set of bundled programs. It's plain HTML/CSS/JavaScript with no dependencies and no build step.

It ships with two shells that share the same programs, files and settings:

- **Neo10** (default): the Windows 10 experience drawn entirely in Windows 3.1's pixels. That means lock and sign-in screens, a taskbar, a Start menu with live tiles, search, Action Center with notifications, Task View with virtual desktops, window snapping, File Explorer with a Recycle Bin, Settings, Task Manager, Weather and Microsoft Edge.

  Edge has tabs, favourites, history, downloads, find on page and whole-step zoom. Pages on `neo31.net` (news, weather, games, downloads, help, Neo Search) are built in and work offline. `C:\` paths show your files. Any other address loads the live web inside the window. Sites that refuse to be framed (Bing, DuckDuckGo and many others) stay blank; use *Open in new window* for those.
- **Windows 3.1**: the classic MS-DOS boot and Program Manager.

Switch between them in Settings › System › Shell (Neo10) or Windows Setup › Change System Settings (3.1).

All graphics are pixel art. Icons, cursors, cards, wallpapers, the Windows flag and control glyphs are bitmaps in the 16-colour VGA palette, plotted pixel by pixel and scaled with nearest-neighbour. Nothing is drawn as vector art.

Text uses the original bitmap fonts: System for title bars, menus and dialogs; MS Sans Serif 8 for icon labels, File Manager and status bars; Fixedsys for Notepad; and the IBM VGA 8×16 ROM font for the BIOS, MS-DOS and Terminal. Large headings (Settings page titles, the lock-screen clock, tiles, Weather) use W31 Sans, a 1-bit rasterization of Liberation Sans at fixed pixel sizes. They come from Wine's pixel clones of the Windows fonts, the Linux kernel's VGA font and Liberation Sans; see `fonts/LICENSE.md`. The screen is scaled by whole device pixels, so every font and icon pixel lands on a physical pixel. The default *Best Sharp Fit* display mode picks 640×480, 800×600 or 1024×768, whichever fills your window best; change it in Windows Setup.

## Running

Serve the folder with any static web server and open `index.html`:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

URL options: `#fast` skips the power button, `#win` goes straight to Windows, and `#reset` restores the factory state. Hold **Shift** when powering on to skip the BIOS checks.

## What's inside

| Area | Details |
|---|---|
| Boot | Power switch → BIOS POST with memory count → `CONFIG.SYS` (HIMEM/EMM386) → real execution of `C:\AUTOEXEC.BAT` → `WIN` → splash screen → Program Manager with the TADA sound |
| MS-DOS | `COMMAND.COM` interpreter: `DIR` (`/W /P /B`), `CD`, `MD`, `RD`, `DEL`, `COPY` (incl. `COPY CON`), `MOVE`, `REN`, `TYPE`, `MORE`, `MEM`, `TREE`, `CHKDSK`, `SET`, `PATH`, `PROMPT`, `ECHO`, batch files with `GOTO`/`IF`, `>` redirection, history, `A:` “Abort, Retry, Fail?”, `FDISK` (factory reset) |
| Shell | MDI window manager with XOR drag/size outlines, minimize/maximize, desktop icons, control menus, Task List (Ctrl+Esc or double-click the desktop), keyboard menus (Alt, mnemonics, accelerators), modal dialogs, common Open/Save dialogs, screen savers, mouse trails |
| Main | Program Manager, File Manager, Control Panel (Color, Desktop, Mouse, Sound, Date/Time, Fonts, …), Print Manager, Clipboard Viewer, MS-DOS Prompt, Windows Setup (changes the screen resolution), Read Me |
| Accessories | Write, Paintbrush, Terminal (with a dial-up BBS at 555-0131), Notepad, Cardfile, Calendar, Calculator, Clock, Character Map, Media Player, Sound Recorder |
| Games | Solitaire (with the bouncing-card finale) and Minesweeper |
| Help | WinHelp viewer with hyperlinked topics, glossary pop-ups, search and history |

Files live on a virtual drive C: that is persisted to `localStorage`. Edit `C:\AUTOEXEC.BAT` and remove `WIN` to boot to the DOS prompt. Associations come from the `[Extensions]` section of `C:\WINDOWS\WIN.INI`.

## Neo10 shortcuts

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
css/win31.css        look & feel, colour-scheme variables, @font-face
fonts/               generated pixel webfonts (+ LICENSE.md)
tools/build_fonts.py converts the bitmap font sources into those webfonts
js/util.js           helpers, settings store
js/sound.js          synthesised system sounds (TADA, CHIMES, DING, CHORD)
js/icons.js          pixel-art icons, bitmap font, cursors, raster helpers
js/fs.js             virtual FAT filesystem with the default C: drive
js/wm.js             window manager, MDI, menus
js/ui.js             dialog controls, message boxes, file dialogs
js/shell.js          system services, schemes, wallpapers, screen savers
js/dos.js            text console, COMMAND.COM, boot sequence, MS-DOS Prompt
js/settings.js       system-wide settings: mouse, keyboard repeat, Alt+Tab, INI sync
js/apps/*.js         one file per application
js/neo10/*.js        Neo10 shell, File Explorer, Settings, Task Manager, Weather, Run, Edge
css/neo10.css        Neo10 styles
```

Neo31 is a fan-made simulation. Microsoft and Windows are trademarks of Microsoft Corporation.

'use strict';
/* Boot entry point. URL options: #fast (skip power-on & BIOS), #win (straight to Windows), #reset (factory reset). */
(async () => {
  if (location.hash === '#reset') { Store.wipe(); location.hash = ''; location.reload(); return; }
  // Bitmap fonts must be ready before any canvas text (DOS console) is drawn
  await Promise.all(['16px "W31 System"', '13px "W31 MS Sans Serif"', 'bold 13px "W31 MS Sans Serif"', '16px "W31 MS Sans Serif 10"', 'bold 16px "W31 MS Sans Serif 10"', '15px "W31 Fixedsys"', '16px "W31 VGA"', '24px "W31 Sans 24"', 'bold 24px "W31 Sans 24"', '32px "W31 Sans 32"', '48px "W31 Sans 48"', 'bold 64px "W31 Sans 64"', '64px "W31 Sans 64"', '96px "W31 Sans 96"']
    .map(f => document.fonts.load(f).catch(() => null)));
  Sys.init();
  const hash = location.hash;
  if (hash === '#win') { Store.set('fastBoot', true); await Sys.startWindows(); return; }
  if (hash !== '#fast') await DOS.powerScreen();
  else Store.set('fastBoot', true);
  await DOS.boot();
})();

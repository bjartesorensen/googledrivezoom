# Drive Document Zoom (Chrome extension)

Zoom Google Docs, Sheets, Slides and Drive file previews (PDFs and so on) with
**Ctrl + Alt + mouse wheel**. Only the document zooms. The browser page, including
the toolbars and menus, stays the same size.

## How it works

Chrome turns Ctrl + wheel into a whole-page zoom. The extension catches the
wheel event first and cancels it, which stops the browser zoom. It then zooms
the document with the app's own zoom control:

| Page | What the extension does |
| --- | --- |
| Google Docs, Sheets | Types the new value (e.g. `120%`) into the toolbar's zoom box |
| Drive file preview (PDF viewer, etc.) | Clicks the viewer's *Zoom in* / *Zoom out* buttons |
| Google Slides | Sends Slides' own zoom shortcut (Ctrl + Alt + `=` / `-`) |

Using the app's own zoom means text stays sharp, and clicking or selecting in
the document keeps working.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` folder of this repo.
4. Open or reload a Google Docs or Drive tab.

## Options

Right-click the extension icon and choose **Options**, or use **Details → Extension options**
on `chrome://extensions`. You can set:

- **Modifier keys**: Ctrl + Alt (default), Alt, Ctrl + Shift or Alt + Shift
- **Zoom step** per wheel notch (default 10%)
- **Invert direction**

## Notes

- Docs and Sheets limit zoom to their own range (about 50 to 200%).
- On some Linux desktops the window manager takes Ctrl + Alt + wheel for itself.
  If nothing happens, choose another modifier in Options.
- The script runs in the page's own JavaScript context (`"world": "MAIN"`), so
  it needs Chrome 111 or newer.

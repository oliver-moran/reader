# Reader

A Firefox add-on that speaks selected text and web pages. Highlight text on a webpage and that text will be read aloud.

## Essential usage

1. Highlight a word to hear it read aloud.
2. Press `Ctrl+Shift+Space` to select and read a whole paragraph.
3. Press `Ctrl+Shift+Space` again to select and read the next paragraph (or block of text).
4. Right click on selected text to open a context menu with the option to read the selected text.

## Preferences

1. Set a preferred voice and rate of speech. The actual spoken voice will depend on the language of the webpage being read.
2. Choose to enable or disable automatic reading of selected text. This can be over-ridden using the page action icon.
3. Reset all preferences using the Reset button.

## Page action icon

1. The page action icon will highlight blue on pages where automatic reading of highlighted text is enabled.
2. Click the page action icon to enable or disable the automatic reading of selected text for a web page's domain.
3. The page action icon will not show on pages where the add-on's functionality is unavailable.

The add-on is deliberately inaccessible on the domains where content scripts are blocked (as well as on `about:` pages, etc.): https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts

Icon [message](https://thenounproject.com/term/message/223770/) by Gregor Cresnar from the Noun Project.

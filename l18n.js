/*
Copyright 2021 Oliver Moran

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// Localize by replacing __MSG_***__ meta tags
// https://stackoverflow.com/questions/25467009/internationalization-of-html-pages-for-my-google-chrome-extension/25612056

const forms = document.getElementsByTagName("FORM");

for (let i=0; i < forms.length; i++) {
  const walker = document.createTreeWalker(forms[i]);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType == Node.TEXT_NODE) {
      const txt = node.nodeValue;
      const l18n = txt.replace(/__MSG_(\w+)__/g, (match, msg) => {
          return msg ? browser.i18n.getMessage(msg) : "";
      });

      if (l18n != txt) node.nodeValue = l18n;
    }
  }
}

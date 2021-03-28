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

// NB: Content scripts are excluded on the domains listed here:
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts

const T = 250; // timeout ms
const L = 255; // loop limit (to stop infinte loops)

// add the selection event
function addSelectionEvent(){
  document.addEventListener("selectionchange", onSelectionChange, true);
}

// remove the selection event
function removeSelectionEvent(){
  document.removeEventListener("selectionchange", onSelectionChange, true);
}

// event handler for the above
let t1 = null;
function onSelectionChange (e) {
  try { // wrap in try ... catch since as an entry point to a complex procedure
    clearTimeout(t1);
    t1 = setTimeout(speakSelection, T);
  } catch (err) {
    console.error(err);
  }
}

addSelectionEvent(); // start listening

// event handler for selection events
// f forces the item to be spoken (i.e. bypasses settings)
function speakSelection(f) {
  let text = window.getSelection().toString();
  browser.runtime.sendMessage({
    // actual speaking is handled in background.js
    method: "speak-selection",
    text: text,
    f: f || false
  });
}

// an alternative method to speak a given text
function speakText(text) {
  browser.runtime.sendMessage({
    // actual speaking is handled in background.js
    method: "speak-text",
    text: text
  });
}

// checks if node is an Element (otherwise probably a Text node)
function isElementNode(el){
  return (el instanceof Element);
}

// get the Element for the node (probably the parent in the case of a Text node)
function getElementNode(el){
  return isElementNode(el) ? el : el.parentNode;
}

// this is the fund that performs keyboard navigation by paragraph
function selectNode() {
  const selection = window.getSelection();
  const walker = document.createTreeWalker(document.body);
  const str1 = selection.toString().trim();

  let anchor = selection.anchorNode;
  let focus = selection.focusNode;

  // we want to make sure the anchor and the focus are in the right order
  // e.g. this means ordered right to left in European languages
  // https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition
  if ((selection.anchorNode == selection.focusNode && selection.anchorOffset > selection.focusOffset) ||
      Boolean(anchor.compareDocumentPosition(focus) & anchor.DOCUMENT_POSITION_PRECEDING)) {
    anchor = selection.focusNode;
    focus = selection.anchorNode;
  }

  const a = anchor; // used to remember original anchor always

  // clear the selection and re-initiate it with a fresh one to be certain
  selection.removeAllRanges();
  const range = document.createRange();
  range.setStart(anchor, 0);
  setRangeEnd(range, focus);
  selection.addRange(range);

  // Step 1: Selecting the current paragraph

  // first we walk backwards until we reach a new line or the start of the document
  walker.currentNode = anchor;
  let isStart = false;
  while (walker.currentNode != null && selection.toString().indexOf("\n") == -1 && !isStart) {
    anchor = walker.currentNode;
    isStart =(walker.previousNode() == null);
    range.setStart(walker.currentNode, 0);
  }
  range.setStart(anchor, 0);

  // now we walk forwards until we reach a new line or the end of the document
  walker.currentNode = focus;
  let isEnd = false;
  while (walker.currentNode != null && selection.toString().indexOf("\n") == -1 && !isEnd) {
    focus = walker.currentNode;
    isEnd = (walker.nextNode() == null);
    setRangeEnd(range, walker.currentNode);
  }
  setRangeEnd(range, focus);

  // Step 2: If the above caused no change then select the next paragraph

  const str2 = selection.toString().trim();

  if ((a == anchor && str1 == str2) || str2 == "") {
    // Step 1: Find the new anchor nodes

    // first we search for next sibling then ancestor next siblings...
    walker.currentNode = focus;
    if (walker.nextSibling() == null) {
      do {
        if (walker.parentNode() == null) {
          // nothing left to select
          // console.info("End of thread.")
          selection.removeAllRanges();
          return;
        }
      } while (walker.nextSibling() == null);

      // ... then we dive down to the last first child
      while (walker.firstChild() != null) {
        // do it
      }
    }
    range.setStart(walker.currentNode, 0);
    setRangeEnd(range, walker.currentNode);

    // Step 2: Walk through the next nodes until we find the next non-empty string

    do {
      range.setStart(walker.currentNode, 0);
      setRangeEnd(range, walker.currentNode);
      if (walker.nextNode() == null) {
        // nothing left to select
        // console.info("End of thread.")
        selection.removeAllRanges();
        return;
      }
    } while (selection.toString() == "");

    // ... now, select that paragraph!
    selectNode();

  } else if (!isInViewport(getElementNode(focus))){
    // moves the newly selected paragraph into view
    getElementNode(focus).scrollIntoView({
      behavior: "smooth",
      block: "end",
      inline: "nearest"
    });
  }
}

// sets the end of a range, which needs to specify the length of the range
function setRangeEnd(range, node) {
  try { // this function uses try ... catch intentionally
    range.setEnd(node, node.length);
  } catch (err) {
    console.warn(err); // because some nodes need to refer to childNodes.length
    range.setEnd(node, node.childNodes.length);
  }
}

/*!
 * Determine if an element is in the viewport
 * (c) 2017 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param  {Node}    elem The element
 * @return {Boolean}      Returns true if element is in the viewport
 */
var isInViewport = function (elem) {
	var distance = elem.getBoundingClientRect();
	return (
		distance.top >= 0 &&
		distance.left >= 0 &&
		distance.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		distance.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
};

// listen to messages from background.js
let t2 = null;
browser.runtime.onMessage.addListener(req => {
  clearTimeout(t2);
  removeSelectionEvent();

  switch (req.method) {
    case "command-speak-selection":
      // the keyboard command to read a paragraph
      try { // wrap in try ... catch since as an entry point to a complex procedure
        selectNode();
        speakSelection(true);
      } catch (err) {
        console.error(err);
      }
      break;
  }

  t2 = setTimeout(addSelectionEvent, T);
});

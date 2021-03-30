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

const T = 250;
const COMPLETE = "complete";

// NB: Content scripts are excluded on the domains listed here:
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts
const EXCLUDE = [
  "accounts-static.cdn.mozilla.net",
  "accounts.firefox.com",
  "addons.cdn.mozilla.net",
  "addons.mozilla.org",
  "api.accounts.firefox.com",
  "content.cdn.mozilla.net",
  "content.cdn.mozilla.net",
  "discovery.addons.mozilla.org",
  "input.mozilla.org",
  "install.mozilla.org",
  "oauth.accounts.firefox.com",
  "profile.accounts.firefox.com",
  "support.mozilla.org",
  "sync.services.mozilla.com",
  "testpilot.firefox.com"
]

// the sysnthesis voices and preferred voice
let voices = null;
let voice = null; // the voice we prefer to use to speak

// initiatie the settings from storage
let settings = {};
browser.storage.sync.get().then((res) => {
  settings.voice = res.voice || null; // null = use default voice
  settings.rate = res.rate || 100; // speaking rate
  settings.auto = (res.auto === false) ? false : true; // speak on selection
  settings.list = res.list || { white: [], black: [] }; // exceptions to speak on selection setting
  initVoices(); // initiate voice here after settings are initiated
});

// save the settings to storage
function saveSettings(){
  browser.storage.sync.set(settings);
  voice = getVoice(settings.voice); // update the voice
}

// loops through the available voices and returns the preferred one
function getVoice(str) {
  for (let i = 0; i < voices.length ; i++) {
    var n = voices[i].name + ' (' + voices[i].lang + ')';
    if (str == n) return voices[i]; // found the voice
    if (str == null && voices[i].default) return voices[i]; // no voices but found the default
  }

  return (voices.length > 0) ? voices[0] : null; // attemt to set default to first, if no default
}

// Chrome has an delay in initiating the array of voices, so we have to init like this
function initVoices(){
  voices = speechSynthesis.getVoices();
  if (voices.length == 0) {
    setTimeout(initVoices, T);
  } else { // if we still have to set the voice
    saveSettings(); // initiate storage, if necessary
  }
}

// set up a context menu that will speak highlighted text
(chrome.contextMenus || browser.menus).create({
  id: "speak-selection",
  title: browser.i18n.getMessage("menuSpeakSelection"),
  contexts: ["selection"],
  documentUrlPatterns: ["*://*/*"],
  visible: false
});

// set up a context menu that will speak highlighted text
(chrome.contextMenus || browser.menus).create({
  id: "page-action-item",
  title: browser.i18n.getMessage("pageActionItemEnabled", "this website"),
  contexts: ["page_action"],
  documentUrlPatterns: ["*://*/*"]
});

// update visibility of the context menus per domain
function updateContextMenu(domain) {
  (chrome.contextMenus || browser.menus).update("speak-selection", {
    visible: (EXCLUDE.indexOf(domain) == -1),
    enabled: true
  });
}

// event listener for the context menu
(chrome.contextMenus || browser.menus).onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "speak-selection":
      // if (tab.MutedInfo.muted) return;
      browser.tabs.detectLanguage().then(lang => {
        // we need to detect the language of the page in the active tab
        speakText(info.selectionText, lang);
      });
      break;
    case "page-action-item":
      onPageAction();
      break;
  }
});

// listen for messages coming in from content.js and options.js
browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.method) {
    case "speak-selection":
      // main method used to speak text
      browser.tabs.detectLanguage().then(lang => {
        // if (tabs.MutedInfo.muted) return;
        let url = sender.url;
        let domain = getDomainFromURL(url);
        if (message.text.trim() == "")  { speakText("", lang) } // always allow to stop speaking by unselecting
        else if ((settings.auto && settings.list.black.indexOf(domain) == -1) || // auto and not blacklisted
                 (!settings.auto && settings.list.white.indexOf(domain) > -1) || // not auto but white listed
                  message.f) { speakText(message.text, lang) }; // .. or force flag used
      });
      break;
    case "speak-text":
      // alternative method to speak text
      // if (tabs.MutedInfo.muted) return;
      browser.tabs.detectLanguage().then(lang => {
        // detect langage and speak the text
        speakText(message.text, lang);
      });
      break;
    case "update-settings":
      // settings have been updated in options.js
      settings.voice = message.settings.voice;
      settings.rate = message.settings.rate;
      settings.auto = message.settings.auto;
      settings.list = message.settings.list;
      saveSettings();
      break;
    case "set-page-action":
      setPageAction(sender.tab);
      break;
  }
});

// keyboard command was initiated, these are routed unfiltered to content.js
browser.commands.onCommand.addListener(function (command) {
  browser.tabs.query({
    active: true,
    currentWindow: true
  }).then(tabs => browser.tabs.get(tabs[0].id)).then(tabInfo => {
    browser.tabs.sendMessage(
      tabInfo.id,
      { method: command } // route to content.js
    )
  });
});

// event listeners for when a tab loads a new page
browser.tabs.onUpdated.addListener(onTabUpdated);
// event listener for changes in focused tab (also works implicity when a tab is closed)
browser.tabs.onActivated.addListener(onTabUpdated);

// function onUpdate(e){
//   browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
//     let tab = tabs[0];
//     let url = tab.url;
//     let domain = getDomainFromURL(url);
//     if (domain != "") {
//       // only process once we know the domain
//       setPageActionIcon(domain, tab.id);
//       updateContextMenu(domain);
//     }
//   });
// }

// event listener for loading of page and on tab focus
function onTabUpdated(e){
  speechSynthesis.cancel(); // stop talking if already was

  browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
    let tab = tabs[0];
    updatePageAction(tab);
  });
}

// starts the process of updateing a tab action for a particular tab
function updatePageAction(tab){
  let url = tab.url;
  let domain = getDomainFromURL(url);

  // disable all the messaging and icons
  const PAGE_ACTION_TITLE = browser.i18n.getMessage("pageActionTitleNotAllowed", domain);
  const PAGE_ACTION_ITEM_DISABLED = browser.i18n.getMessage("pageActionItemDisabled", domain);

  // browser.pageAction.setIcon({ tabId: tab.id, path: "icons/reader-icon-light.svg" });
  browser.pageAction.setTitle({ tabId: tab.id, title: PAGE_ACTION_TITLE });
  (chrome.contextMenus || browser.menus).update("page-action-item", {
    title: PAGE_ACTION_ITEM_DISABLED,
    enabled: false
  });
  (chrome.contextMenus || browser.menus).update("speak-selection", { enabled: false });

  // test that content.js is responsive
  browser.tabs.executeScript(tab.id, { // tab.status == COMPLETE ?
    code: "browser.runtime.sendMessage({ method: \"set-page-action\" });",
    runAt: "document_start"
  });
}

// completes the process of updating the page action details
function setPageAction(tab){
  let url = tab.url;
  let domain = getDomainFromURL(url);
  if (domain != "") {
    updateContextMenu(domain);
    setPageActionIcon(domain, tab.id);
  }
}

// initiate all open tabs with the correct page actions - this is largely a fix
// for Chrome where the content.js is not loaded until refresh.
browser.tabs.query({}).then((tabs) => {
  for (let tab of tabs) {
    // tab.url requires the `tabs` permission or a matching host permission.
    updatePageAction(tab);
  }
});

// event listener for when the page action button is clicked
browser.pageAction.onClicked.addListener(onPageAction);

function onPageAction(e){
  speechSynthesis.cancel(); // stop talking if already was

  browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
    let tab = tabs[0];
    let url = tab.url;
    let domain = getDomainFromURL(url);
    if (domain != "") {
      // only process once we know the domain
      updateWhiteAndBlackLists(domain);
      setPageActionIcon(domain, tab.id);
    }
  });
}

// method to whitelist or blacklist a domain when the page action is clicked
function updateWhiteAndBlackLists(domain) {
  // remember if the domain had been in one of the two lists
  let wasWhiteListed = (settings.list.white.indexOf(domain) > -1);
  let wasBlackListed = (settings.list.black.indexOf(domain) > -1);

  // rinse the domain from the two lists (i.e. whitelist and blacklist)

  while (settings.list.white.indexOf(domain) > -1) {
    let w = settings.list.white.indexOf(domain);
    settings.list.white.splice(w, 1);
  }

  while (settings.list.black.indexOf(domain) > -1) {
    let b = settings.list.black.indexOf(domain);
    settings.list.black.splice(b, 1);
  }

  if (settings.auto && !wasBlackListed) { // speak on select and no previously blacklisted
    // console.info("Blacklisting: " + domain);
    settings.list.black.push(domain);
  } else if (!settings.auto && !wasWhiteListed) { // not speak on select and not previously whitelisted
    // console.info("Whitelisting: " + domain);
    settings.list.white.push(domain);
  } else { // already rinsed from the two lists above
    // console.info("Unlisting: " + domain);
  }

  saveSettings();
}

// method to set the page action icon depending whether speak on selection is enabled for that page
function setPageActionIcon(domain, id){
  // determine if the domain is black or white listed
  let isWhiteListed = (settings.list.white.indexOf(domain) > -1);
  let isBlackListed = (settings.list.black.indexOf(domain) > -1);

  const PAGE_ACTION_TITLE_ENABLED = browser.i18n.getMessage("pageActionTitleEnabled", domain);
  const PAGE_ACTION_TITLE_DISABLED = browser.i18n.getMessage("pageActionTitleDisabled", domain);

  const PAGE_ACTION_ITEM_ENABLED = browser.i18n.getMessage("pageActionItemEnabled", domain);
  const PAGE_ACTION_ITEM_DISABLED = browser.i18n.getMessage("pageActionItemDisabled", domain);

  if (settings.auto && isBlackListed) {
    // speak on selection but domain blacklisted, so icon is disabled
    browser.pageAction.setIcon({ tabId: id, path: "icons/reader-icon-light.svg" });
    browser.pageAction.setTitle({ tabId: id, title: PAGE_ACTION_TITLE_DISABLED });
    (chrome.contextMenus || browser.menus).update("page-action-item", {
      title: PAGE_ACTION_ITEM_DISABLED,
      enabled: true
    });
  } else if (!settings.auto && isWhiteListed) {
    // not speak on selection but domain is whitelisted, so icon is enabled
    browser.pageAction.setIcon({ tabId: id, path: "icons/reader-icon-enabled.svg" });
    browser.pageAction.setTitle({ tabId: id, title: PAGE_ACTION_TITLE_ENABLED });
    (chrome.contextMenus || browser.menus).update("page-action-item", {
      title: PAGE_ACTION_ITEM_ENABLED,
      enabled: true
    });
  } else if (settings.auto) {
    // speak on selection (domain not listed), so icon is enabled
    browser.pageAction.setIcon({ tabId: id, path: "icons/reader-icon-enabled.svg" });
    browser.pageAction.setTitle({ tabId: id, title: PAGE_ACTION_TITLE_ENABLED });
    (chrome.contextMenus || browser.menus).update("page-action-item", {
      title: PAGE_ACTION_ITEM_ENABLED,
      enabled: true
    });
  } else {
    // not speak on selection, so icon is disabled
    browser.pageAction.setIcon({ tabId: id, path: "icons/reader-icon-light.svg" });
    browser.pageAction.setTitle({ tabId: id, title: PAGE_ACTION_TITLE_DISABLED });
    (chrome.contextMenus || browser.menus).update("page-action-item", {
      title: PAGE_ACTION_ITEM_ENABLED,
      enabled: true
    });
  }
}

// parse the domain from a URL using HTML anchor element and Location object
function getDomainFromURL(url){
  let a = document.createElement('a');
  a.href = url;
  let domain = (a.hostname) ? a.hostname : "";
  return domain.toLowerCase();
}

// speaks the given text in the given language
function speakText(text, lang){
  // stop talking if already was, but avoid running straight from cancel to talking
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    setTimeout(speakText, T, text, lang);
    return;
  }

  if (text && text != "") { // only do the following if there was text given
    // console.info("Reading: %s", text.trim());
    let utterance = new SpeechSynthesisUtterance(text);

    if (voice && voice.lang.indexOf(lang) == 0) {
      // use preferred voice if correct language
      utterance.voice = voice;
    } else {
      // otherwise use language-appropriate voice
      utterance.lang = lang;
    }

    utterance.rate = (settings.rate / 100);
    speechSynthesis.speak(utterance);
  }
}

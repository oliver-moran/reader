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

// remove Firefox or Chrome specific stylesheets
if (window.navigator.userAgent.indexOf("Chrome") > -1) removeStylesheets("firefox");
else removeStylesheets("chrome");

// remove link tags of a specified class
function removeStylesheets(app){
  const styles = document.querySelectorAll("link." + app);
  for (let i=0; i < styles.length; i++) {
    const style = styles[i];
    style.parentNode.removeChild(style);
  }
}

const T = 250;

let voice = document.getElementById("voice");
let rate = document.getElementById("rate");
let auto = document.getElementById("auto");
let shortcut = document.getElementById("shortcut");
let reset = document.getElementById("reset");
let nounproject = document.getElementById("nounproject");
let rateValue = document.getElementById("rate-value");

let list = null;

populateVoiceList();
insertShortcutCode();
insertNounProjectLink();

// inserts the shortcut code in the UI
function insertShortcutCode() {
  const str = shortcut.innerText;
  const arr = str.split("%SHORTCUT%");

  while (shortcut.firstChild) {
    shortcut.removeChild(shortcut.lastChild);
  }

  const txt1 = document.createTextNode(arr[0]);
  const txt2 = document.createTextNode(arr[1]);

  const code = document.createElement("code");
  code.setAttribute("id", "shortcut-value");

  shortcut.appendChild(txt1);
  shortcut.appendChild(code);
  shortcut.appendChild(txt2);

  browser.commands.getAll().then((commands) => {
    if (commands[0].shortcut) code.innerText = commands[0].shortcut;
    else shortcut.style.display = "none";
  });
}

// inserts the Noun Project link in the UI
function insertNounProjectLink() {
  const str = nounproject.innerText;
  const arr = str.split("%LINK%");

  while (nounproject.firstChild) {
    nounproject.removeChild(nounproject.lastChild);
  }

  const txt1 = document.createTextNode(arr[0]);
  const txt2 = document.createTextNode(arr[1]);

  const link = document.createElement("a");
  link.setAttribute("href", "https://thenounproject.com/term/message/223770/");
  link.setAttribute("target", "_blank");

  nounproject.appendChild(txt1);
  nounproject.appendChild(link);
  nounproject.appendChild(txt2);

  const text3 = document.createTextNode("message");
  link.appendChild(text3);
}

function populateVoiceList() {
  const voices = speechSynthesis.getVoices();

  // Chrome has an delay in initiating the array of voices, try again until it's ready
  if (voices.length == 0) {
    setTimeout(populateVoiceList, T);
    return;
  }

  let f = false;

  for(let i = 0; i < voices.length ; i++) {
    var option = document.createElement("option");
    option.textContent = voices[i].name + ' (' + voices[i].lang + ')';

    if(voices[i].default) {
      option.setAttribute("selected", "selected");
      f = true;
    }

    option.setAttribute("value", option.textContent);
    option.setAttribute("data-lang", voices[i].lang);
    option.setAttribute("data-name", voices[i].name);
    voice.appendChild(option);
  }

  if (!f) voice.selectedIndex = 0; // didn't find a default

  loadSettings();
}

function loadSettings(){
  browser.storage.sync.get().then((res) => {
    // settings initiated in background.js
    voice.value = res.voice || voice.value; // if null, set to what's selected (which is the default voice)
    rate.value = res.rate;
    auto.checked = res.auto;
    list = res.list;
    setRateValue();
    setIndeterminateValue();
  });

  // relatively cheap procedure to poll for changes to the whitelist/blacklist
  setInterval(() => {
    browser.storage.sync.get().then((res) => {
      // check for settings updated in background.js
      if (list.white.length == res.list.white.length &&
          list.black.length == res.list.black.length) return;
      list = res.list;
      setIndeterminateValue();
    });
  }, 1e3);

  addEventListeners();
}

function addEventListeners(){
  voice.addEventListener("change", saveSettings);
  rate.addEventListener("change", saveSettings);
  auto.addEventListener("change", () => {
    list = { white: [], black: [] };
    saveSettings();
  });

  rate.addEventListener("input", setRateValue);
  reset.addEventListener("click", () => { setTimeout((e) => {
    list = { white: [], black: [] };
    setRateValue();
    setIndeterminateValue();
    saveSettings();
  }, T); });
}

function setRateValue(){
  rateValue.innerText = rate.value;
}

function setIndeterminateValue(){
  try {
    auto.indeterminate = (list.white.length > 0 || list.black.length > 0);
  } catch (err) {
    console.warn(err);
  }
}

function saveSettings(){
  var obj = {
    voice: voice.value,
    rate: rate.value,
    auto: (auto.checked) ? true : false,
    list: list
  }

  browser.runtime.sendMessage({
    method: "update-settings",
    settings: obj
  });
}

// TODO: refresh on active tab change
// TODO: support conditional selectors (look into using the browser itself to parse CSS)

const __debugMode = 0;

/// PRODUCTION GLOBALS AND CONSTANTS ///

let cssText = "";
let ruleObject = {};

let textBox = document.getElementById("popup-textarea");
let applyButton = document.getElementById("apply-button");
let resetButton = document.getElementById("reset-button");
let hostnameContainer = document.getElementById("hostname-container");

let hostnameFound = 0;
let hostname;

let tab;
let tabUrl;

let cssWasInserted = 0;
let insertedCss = "";

let author = "";
//TODO: get FF username or ask for author name at startup/in settings.

function log(...props) {
  if (__debugMode) {
    console.log(...props);
  }
}

log("ALIVE");

////////////////////////////////////////


function setRules(activeTab, hostname, cssText) {
  hostname = hostname.toString();

  let cssObject = cssTextToRules(cssText);

  log(`setRules`, {cssObject});

  let tempStorageObject;
  let currentDate = printDate();

  let getHostnamePromise = browser.storage.sync.get(hostname);

  getHostnamePromise.then((res) => {
    log('getHostnamePromise', {res});

    if (!res[hostname]) {
      log(`${hostname} NOT found in browser.storage.local in setRules`);

      tempStorageObject = {
        "content": cssObject,
        "information": {
          "author": author,
          "creationDate": currentDate,
          "updateDate": currentDate,
          "votes": "0"
        }
      }

      let ruleString = JSON.stringify(tempStorageObject);

      browser.tabs.sendMessage(activeTab.id, {
        command: "saveRules",
        hostname: hostname,
        ruleString: ruleString
      });
    } else {

      log(`${hostname} was found in browser.storage.local in setRules`);

      tempStorageObject = JSON.parse(res[hostname]);

      tempStorageObject.content = cssObject;
      tempStorageObject.information.author = author;
      tempStorageObject.information.updateDate = currentDate;

      let ruleString = JSON.stringify(tempStorageObject);

      browser.tabs.sendMessage(activeTab.id, {
        command: "saveRules",
        hostname: hostname,
        ruleString: ruleString
      });
    }
  });
}


///////////////////////////



/// DATE FUNCTION ///

function printDate() {
  let today = new Date();
  let dd = String(today.getDate()).padStart(2, '0');
  let mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  let yyyy = today.getFullYear();

  return mm + '/' + dd + '/' + yyyy;
}

/////////////////////



/// TEXTBOX INTERACTION ///


let setText = (newText = "") => {
  log(`---setText: ${newText} ---`);

  textBox.value = newText;
}

let getText = () => {
  return textBox.value;
}

setText("Initializing...");

//////////////////////////



/// JSON OBJECT TO CSS STRING CONVERTER ///

function ruleContentToCssString (ruleContent) {
  log({ruleContent})

  if (hostnameFound == 0) {
    return "";
  }

  let tempCssString = "";

  log({ruleContent});

  for (key in ruleContent) {
    //The nested if makes sure that you don't enumerate over properties in the prototype chain of the object (which is the behaviour you almost certainly want). You must use
    if (Object.prototype.hasOwnProperty.call(ruleContent, key)) {
      let ruleText = ruleContent[key];
      log({key, ruleText});

      tempCssString += `${key}{${ruleText}}`;
      }
  }

  return tempCssString;
};


/// CSS PARSING (INTO VALID OBJECTS) ///

function isAlphaNumeric(code) {
  return  ((code > 47 && code < 58) || // numeric (0-9)
          (code > 64 && code < 91) || // upper alpha (A-Z)
          (code > 96 && code < 123)); // lower alpha (a-z)
}

function isSpace(code) {
  return (code == 32);
}

function isComplexSelectorChar(code) {
  // [=91 ]=93 >=62 _=44 -=45 ~=126 ^=94 $=36 *=42 ==61 :=58 (=40 )=41
  //
}

function isValidSelectorChar(code) {
  // return  (isAlphaNumeric(code) ||
  //         (code == 46) || (code == 35) || // . 46, # 35
  //         (code == 95) || (code == 45) || //_ and -
  //         (code == 44) || (code == 32) || // ","" and " "
  //         (code == 62) // "> for prog. selectors"
  //         );
  // newline used for more complex selectors (e.g. conditionals)?
  return (!isOpeningBrace(code) && !isClosingBrace(code));
}

function isOpeningBrace(charcode) {
  // { 123
  return (charcode == 123);
}

function isClosingBrace(charcode) {
  // } 125
  return (charcode == 125);
}

function isNewline(charcode) {
  return (String.fromCharCode(charcode) == "\n" || charcode == 10 || charcode == 13);
}

function cssTextToRules(styleContent) {
  log(`cssTextToRules(${styleContent})`);

  let result = {};

  let inPara = 0; //just accept everything in "paragraph"
  let inSelector = 0;

  let tempKey = "";
  let tempValue = "";
  let ch;

  let newlineAdded = 0;

  for (let i = 0 ; i < styleContent.length; i ++) {
    ch = styleContent.charCodeAt(i);
    if ((ch == 10 || ch == 13) && inPara == 1) {
      if (newlineAdded == 0) {
        tempValue += '\n';
        newlineAdded = 1;
        continue;
      } else {
        continue;
      }
    } else {
      newlineAdded = 0;
    }

    if(inPara == 0 && inSelector == 0) {
      if (isValidSelectorChar(ch)) {
        if (isSpace(ch)) {
          continue;
        }
        inPara = 0;
        inSelector = 1;
        tempKey += String.fromCharCode(ch);
        continue;
      }
    } else if (inPara == 0 && inSelector == 1) {
      if (isValidSelectorChar(ch)) {
        tempKey += String.fromCharCode(ch);
      } else if (isOpeningBrace(ch)) {
        inPara = 1;
        inSelector = 0;
        continue;
      } else {
        inPara = 1;
        inSelector = 0;
        //TODO: What would this scenario look like?
      }
      continue;
    } else if (inPara == 1 && inSelector == 0) {
      if (isOpeningBrace(ch) || isClosingBrace(ch)) {
        if (isClosingBrace(ch)) {
          inPara = 0;
          inSelector = 0;
          result[tempKey] = tempValue;

          tempKey = "";
          tempValue = "";
          continue;
        } else {
          continue;
        }
      }
      tempValue += String.fromCharCode(ch);
      continue;
    }
  }

  log(`cssTextToRules result:`, result);

  return result;
};


////////////////////////////////////////

////////////////////////////////////////



/// POPUP-TAB (ACTIVE) CSS INSERTION AND DELETION ///

let insertCss = (cssString) => {
  log(`insertCss`, {cssString});

  browser.tabs.sendMessage(activeTab.id, {
    command: "insertCss",
    cssString: cssString
  });

  insertedCs = cssString;
}

let removeCss = (cssString) => {
  if (insertedCss != "") {
    browser.tabs.removeCss({code: cssString}).then(() => {
      insertedCss = "";
    });
  }
}

//////////////////////////////////////////////////////



////// ASYNC FUNCTION SERIES BEGIN ///////

let listenForClicks = () => {
  document.addEventListener("click", (e) => {
    log(`Clicked ${e.target.id}`, {e});

    let targetId = e.target.id;

    switch (e.target.id) {
      case "apply-button":
        applyRules();
        break;
      case "reset-button":
        // TODO: timer-based color fade reset button for "undo functionality"
        setText(cssText);
        break;
      case "clear-button":
        setText();
        break;
      default:
        break;
    }
  })
};

function applyRules() {
  browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
    activeTab = tabs[0]; // Safe to assume there will only be one result

    log(`activeTab.url: ${activeTab.url}`);

    return activeTab;
  }, console.error)
  .then((activeTab) => {
    tab = activeTab;
    tabUrl = new URL(activeTab.url);
    hostname = tabUrl.hostname;

    if (cssWasInserted) {
      removeCss(insertedCss);
      //TODO I changed removeCss to use global insertedCss!
    }

    let newText = getText();

    insertCss(newText);
    setRules(activeTab, hostname, newText);
  });
}

function getTabUrl() {
  browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
    activeTab = tabs[0]; // Safe to assume there will only be one result

    log(`activeTab.url: ${activeTab.url}`);

    return activeTab;
  }, console.error)
  .then((activeTab) => {
    tab = activeTab;
    tabUrl = new URL(activeTab.url);
    hostname = tabUrl.hostname;

    hostnameContainer.innerHTML = hostname

    log('got host name from tab', {activeTab, hostname});

    let getHostnamePromise = browser.storage.sync.get(hostname);

    getHostnamePromise.then((res) => {
      log('fetching data', { res })

      if (res && res[hostname]) {
        hostnameFound = 1;
      }

      let rules = res[hostname];

      if(!rules) {
        log(`couldn't find stored domain data`);
      } else {
        log('found stored rules', {hostname, rules});
        ruleObject = JSON.parse(rules);
      }

      cssText = ruleContentToCssString(ruleObject['content']);

      if (cssText == "") {
        log(`no rules for ${hostname}`, {ruleObject});

        setText("");
      } else {
        log('found css', {cssText});

        setText(cssText);
      }

      listenForClicks();
    })
  })

}

//////////////////////////////////

window.onload = getTabUrl;
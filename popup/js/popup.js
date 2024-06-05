// TODO: refresh on active tab change
// TODO: support conditional selectors (look into using the browser itself to parse CSS)

const __debugMode = false;

/// PRODUCTION GLOBALS AND CONSTANTS ///

let cssText = "";
let ruleObject = {};

let textBox = document.getElementById("popup-textarea");
let applyButton = document.getElementById("apply-button");
let resetButton = document.getElementById("reset-button");
let hostnameContainer = document.getElementById("hostname-container");

let hostname;

let tab;
let tabUrl;

let insertedCss = "";

function log(...props) {
  if (__debugMode) {
    console.log(...props);
  }
}

log("ALIVE");

////////////////////////////////////////


/// DATE FUNCTION ///

function printDate() {
  let today = new Date();
  let dd = String(today.getDate()).padStart(2, '0');
  let mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  let yyyy = today.getFullYear();

  return mm + '/' + dd + '/' + yyyy;
}


/////////////////////


function ruleToString(rules) {
  let result = {};

  let currentDate = printDate();

  if (rules) {
    result = rules;
    result.information.updateDate = currentDate;
  } else {
    result.information = {
      creationDate: currentDate,
      updateDate: currentDate,
    }
  }

  let ruleString = JSON.stringify(result);

  return result;
}

function setRules(activeTab, cssText) {
  tabUrl = new URL(activeTab.url);
  hostname = tabUrl.hostname.toString();

  let cssObject = cssTextToRules(cssText);

  log(`setRules`, {cssObject});

  let getHostnamePromise = browser.storage.sync.get(hostname);

  getHostnamePromise.then((res) => {
    log('reading rules from store', {res});

    const rules = res[hostname];

    let ruleString = ruleToString(rules);

    ruleString.content = cssObject;

    browser.tabs.sendMessage(activeTab.id, {
      command: "saveRules",
      hostname: hostname,
      ruleString: ruleString
    });
  });
}

///////////////////////////


/// TEXTBOX INTERACTION ///


let setText = (newText = "") => {
  log(`---setText: ${newText} ---`);

  textBox.value = newText;
}

setText("Initializing...");

//////////////////////////



/// JSON OBJECT TO CSS STRING CONVERTER ///

function ruleContentToCssString (ruleContent) {
  log('transforming rule content', ruleContent)

  let result = "";

  for (key in ruleContent) {
    // The nested if makes sure that you don't enumerate over properties in the
    // prototype chain of the object (which is the behaviour you almost
    // certainly want).
    if (Object.prototype.hasOwnProperty.call(ruleContent, key)) {
      let ruleText = ruleContent[key];

      log({key, ruleText});

      result += `${key}{${ruleText}}`;
    }
  }

  return result;
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
  log(`cssTextToRules`, {styleContent});

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

  insertedCss = cssString;
}

let removeCss = (cssString) => {
  if (insertedCss != "") {
    log(`removeCss`, {cssString});

    browser.tabs.removeCss({code: cssString}).then(() => {
      insertedCss = "";
    });
  }
}

//////////////////////////////////////////////////////



////// ASYNC FUNCTION SERIES BEGIN ///////

function bindGlobalClickHandler() {
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
}

function applyRules() {
  if (!hostname) return

  browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
    activeTab = tabs[0]; // Safe to assume there will only be one result

    log(`activeTab.url: ${activeTab.url}`);

    return activeTab;
  }, console.error)
  .then((activeTab) => {
    insertCss(textBox.value);
    setRules(activeTab, textBox.value);
  });
}

function getTabUrl() {
  browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
    activeTab = tabs[0]; // Safe to assume there will only be one result

    log('active tab', {activeTab});

    hostname = new URL(activeTab.url).hostname;
  }, console.error)
  .then(() => {
    hostnameContainer.textContent = hostname || "\u00A0"

    if (!hostname) throw new Error("We're just not gonna run on this page.");

    log('got host name from tab', {hostname});

    return browser.storage.sync.get(hostname);
  }, console.error)
  .then((res) => {
    log('fetching data', { res })

    let rules = res[hostname];

    if(!rules) {
      log(`couldn't find stored domain data`);
    } else {
      log('found stored rules', {hostname, rules});
      ruleObject = rules;
    }

    cssText = ruleContentToCssString(ruleObject['content']);

    if (cssText == "") {
      log(`no rules for ${hostname}`, {ruleObject});
    } else {
      log('found css', {cssText});
    }

    setText(cssText);
  }, console.error)
  .then(() => {
    log('binding event listeners')
    bindGlobalClickHandler();
  })
}

//////////////////////////////////

window.onload = () => getTabUrl();
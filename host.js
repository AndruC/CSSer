const __debugMode = false;
const styleSheetId = "userStyleSheet-CSM";
const __version = "1.0.3";

const hostname = window.location.hostname || window.location.href;

if (__debugMode) {
  console.log(`hostname:: ${hostname}`);
}

///////////////////////////////////

function getHostnameRules(hostname, callback) {
  browser.storage.sync.get(hostname)
  .then((result) => callback(result));
}


function applyCssString (cssString) {
  let previousSheet = document.getElementById(styleSheetId);
  if (previousSheet) {
    previousSheet.disabled = true;
    previousSheet.parentNode.removeChild(previousSheet);
  }

  let newStyleSheet = document.createElement("style");
  newStyleSheet.type = "text/css";
  newStyleSheet.id = styleSheetId;
  newStyleSheet.appendChild(document.createTextNode(cssString));
  document.head.appendChild(newStyleSheet);

  if (__debugMode) {
    console.log(`---applyCssString`, {newStyleSheet});
  }
};


function ruleContentToCssStringOne (ruleContent) {
  if (__debugMode) {
    console.log(`ruleContentToCssStringOne`);
  }

  let result = "";

  for (key in ruleContent) {
    // The nested if makes sure that you don't enumerate over properties in the 
		// prototype chain of the object (which is the behaviour you almost
		// certainly want).
    if (Object.prototype.hasOwnProperty.call(ruleContent, key)) {
      let ruleText = ruleContent[key];

      if (__debugMode) {
        console.log('found css rule', {key, ruleText});
      }

      result += `${key} {\n${ruleText}\n}\n`;
    }
  }

  return result;
};

///////////////

let checkAndApplyStyles = () => {
  browser.storage.sync.get(hostname).then((hostRules) => {
    if(!hostRules || !hostRules[hostname]) {
      if (__debugMode) {
        console.log(`${hostname} not found in storage`);
      }
    } else {
      if (__debugMode) {
        console.log(`${hostname} rules were found in storage`, {hostRules});
      }
      let tempRuleObject = hostRules[hostname];
      let cssString = ruleContentToCssStringOne(tempRuleObject['content']);
      let cssApplyResult = applyCssString(cssString);
    }
  });

}


///////// RULE SYNC //////////////////

function saveRulesAsync(newHostname, ruleString) {
  let tempHostname = newHostname.toString().valueOf();

  if (__debugMode) {
    console.log(`saveRulesAsync() BEGIN ---`);
  }

  let setRulePromise = browser.storage.sync.set({
    [tempHostname]: ruleString
  });

  setRulePromise.then((err) => {
    if (err) {
      console.error(err);
    } else {
      if (__debugMode) {
          console.log(`saveRulesAsync > setRulePromise success.`);
      }
    }
  })
}


//////////////////////////////////////



//// MESSAGE LISTENER ////////////////

browser.runtime.onMessage.addListener((message) => {
  if (message.command === "saveRules") {
    saveRulesAsync(message.hostname, message.ruleString);
  }
  if (message.command === "insertCss") {
    applyCssString(message.cssString);
  }
});

///////////////////////////////////////

if (__debugMode) {
  console.log(`current version:`);
  console.log(__version);
}
checkAndApplyStyles();

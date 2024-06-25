const __debugMode = false;
const styleSheetId = "userStyleSheet-CSM";
const __version = browser.runtime.getManifest().version;

function log(...props) {
  if (__debugMode) {
    console.log(...props);
  }
}

const hostname = window.location.hostname || window.location.href;

log(`hostname:: ${hostname}`);

///////////////////////////////////

function ruleContentToCssStringOne (ruleContent) {
  let result = "";

  for (key in ruleContent) {
    // The nested if makes sure that you don't enumerate over properties in the 
		// prototype chain of the object (which is the behaviour you almost
		// certainly want).
    if (Object.prototype.hasOwnProperty.call(ruleContent, key)) {
      let ruleText = ruleContent[key];

      log('found css rule', {key, ruleText});

      result += `${key} {\n${ruleText}\n}\n`;
    }
  }

  return result;
};

function applyCssString (cssString) {
  let previousSheet = document.getElementById(styleSheetId);
  if (previousSheet) {
    previousSheet.disabled = true;
    previousSheet.parentNode.removeChild(previousSheet);
  }

	// CSS string-to-DOM
  let newStyleSheet = document.createElement("style");
  newStyleSheet.type = "text/css";
  newStyleSheet.id = styleSheetId;
  newStyleSheet.appendChild(document.createTextNode(cssString));
  document.head.appendChild(newStyleSheet);
};


///////////////

let checkAndApplyStyles = () => {
  log(`checkAndApplyStyles() BEGIN —>`);

  browser.storage.sync.get(hostname).then((storage) => {
    if(!storage || !storage[hostname]) {
      log(`${hostname} not found in storage`);
    } else {
      let rules = storage[hostname];
      log(`${hostname} rules were found in storage`, {rules});
			
      const cssString = ruleContentToCssStringOne(rules['content']);
      const cssApplyResult = applyCssString(cssString);

			log(`styles APPLIED`);
    }
  });
}


///////// RULE SYNC //////////////////

function saveRulesAsync(newHostname, ruleString) {
  let symbol = newHostname.toString().valueOf();

  log(`saveRulesAsync() BEGIN —>`, {ruleString});

  browser.storage.sync.set({ [symbol]: ruleString }).then((err) => {
    if (err) {
      console.error(err);
    } else {
      log(`saveRulesAsync storage SUCCESS`);
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

log({__version});
checkAndApplyStyles();

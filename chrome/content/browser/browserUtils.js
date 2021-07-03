window.addEventListener("load", initPTBrowser, false);

function initPTBrowser() {
  window.removeEventListener("load", initPTBrowser, false);
  // FIXED in 3.5b2+: Show tooltip also over "other Bookmarks" on bookmarks toolbar on Firefox 3.0 branch (BUG 237592)
  if (PTUtils.versionChecker.compare(PTUtils.appInfo.version, "3.1b2") < 0) {
    var bookmarksToolbar = document.getElementById("bookmarksBarContent");
    var chevron = document.getAnonymousElementByAttribute(bookmarksToolbar, "anonid", "chevronPopup"); 
    chevron.setAttribute("tooltip", "bhTooltip");
  }
  // FIXED in 4.0a1+: Missing tooltip and statusbar text on "Open <siteURI>" in live bookmarks on Firefox 3.0->3.6 branch (BUG 476838)
  if (PTUtils.versionChecker.compare(PTUtils.appInfo.version, "3.7a1") < 0) {
    var elem, elements = ["bookmarksMenuPopup","bookmarksToolbarFolderPopup","bookmarksBarContent"];
    for (var i = 0; i < elements.length; i++) {
      elem = document.getElementById(elements[i]);
      var onpopshowing = elem.getAttribute("onpopupshowing") + "PTUtils.fixOpenURI(event);";
      elem.setAttribute("onpopupshowing", onpopshowing);
    }
  }
  // FIXED in 4.0a1+: Show tooltip and URL in status bar when hovering "Recently Closed Tabs/Windows" on Firefox 3.0->3.6 branch (BUG 436758)
  if (PTUtils.versionChecker.compare(PTUtils.appInfo.version, "3.7a1") < 0) {
    var historyUndoPopup = document.getElementById("historyUndoPopup");
    historyUndoPopup.setAttribute("onpopupshowing", "PTUtils.fixRecentlyClosedTab();");
    // Only for Firefox versions with "Undo Closed Windows" feature (ADDED in 3.5b4) (BUG 394759)
    if (PTUtils.versionChecker.compare(PTUtils.appInfo.version, "3.5b4") >= 0) {
      var historyUndoWindowPopup = document.getElementById("historyUndoWindowPopup");
      historyUndoWindowPopup.setAttribute("onpopupshowing", "PTUtils.fixRecentlyClosedWindow();");
    }
  }
}
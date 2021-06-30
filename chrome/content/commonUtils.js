//let Cc = Components.classes;
//let Ci = Components.interfaces;
//let Cu = Components.utils;

var PTUtils = {
  debug: false,

  get nativeJSON() {
    delete this.nativeJSON;
    return this.nativeJSON = Cc["@mozilla.org/dom/json;1"]
                             .createInstance(Ci.nsIJSON);
  },

  get prefs() {
    delete this.prefs;
    return this.prefs = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefService);
  },

  get PrefsPT() {
    delete this.PrefsPT;
    return this.PrefsPT = this.prefs.getBranch("placestooltips.userprefs.");
  },

  get versionChecker() {
    delete this.versionChecker;
    return this.versionChecker = Cc["@mozilla.org/xpcom/version-comparator;1"]
                                 .getService(Ci.nsIVersionComparator);
  },

  get appInfo() {
    delete this.appInfo;
    return this.appInfo = Cc["@mozilla.org/xre/app-info;1"]
                          .getService(Ci.nsIXULAppInfo);
  },

  get _ss() {
    delete this._ss;
    return this._ss = Cc["@mozilla.org/browser/sessionstore;1"]
                      .getService(Ci.nsISessionStore);
  },

  fillInBHTooltip: function(aDocument, aEvent){
    try {
      var tooltipNode = aDocument.tooltipNode;
      var node, cropped, targetURI;

      if (tooltipNode.localName == "treechildren") {
        var tree = tooltipNode.parentNode;
        var row = {}, column = {};
        var tbo = tree.treeBoxObject;
        tbo.getCellAt(aEvent.clientX, aEvent.clientY, row, column, {});
        if (row.value == -1)
          return false;
        node = tree.view.nodeForTreeIndex(row.value);
        cropped = tbo.isCellCropped(row.value, column.value);
      }
      else {
        var width = parseFloat(getComputedStyle(tooltipNode, null).width);
        var max_width = parseFloat(getComputedStyle(tooltipNode, null).getPropertyValue("max-width"));
        var padleft = parseFloat(getComputedStyle(tooltipNode, null).getPropertyValue("padding-left"));
        var padright = parseFloat(getComputedStyle(tooltipNode, null).getPropertyValue("padding-right"));

        width = width + padleft + padright;

        var name = tooltipNode.localName;
        if(name == "menu" || name == "menuitem")
          width += 4;

        // Check whether the tooltipNode is a Places node.
        // In such a case use it, otherwise check for targetURI attribute.
        if (tooltipNode._placesNode) // Firefox 4.0+
          node = tooltipNode._placesNode;
        else if (tooltipNode.node) // For Firefox 3.0 -> 3.6 compatibility
          node = tooltipNode.node;        	
        else
          // This is a static non-Places node.
          targetURI = tooltipNode.getAttribute("targetURI");
        cropped = tooltipNode.getAttribute("cropped") || (width == max_width);
      }

      if (!node && !targetURI)
        return false;

      // Show node.label as tooltip's title for non-Places nodes.
      var title = node ? node.title : tooltipNode.label;

      // Show URL only for Places URI-nodes or nodes with a targetURI attribute.
      var url;
      if (targetURI || PlacesUtils.nodeIsURI(node))
        url = targetURI || node.uri;

      var itemId;
      if (node)
        itemId = node.itemId;

      var annotation = this.itemHasAnnotation(node) && this.ptGetBoolPref("showDescription", true);
      var showFullTitle = (cropped || annotation);

      // Show a tooltip over non-url node if there is a cropped title
      if ((!title || !showFullTitle) && !url/* && !this.ptGetBoolPref("alwaysFoldersTooltip", false)*/)
        return false;

      var tooltipTitle = document.getElementById("bhTitleText");
      tooltipTitle.hidden = (!title || (title == url));
      if(!tooltipTitle.hidden)
        tooltipTitle.textContent = title;

      var tooltipUrl = document.getElementById("bhUrlText");
      tooltipUrl.hidden = !url;
      if(!tooltipUrl.hidden) {
        var decoded;
        try {
          if(/^javascript:/i.test(url))
            decoded = decodeURI(url);
          else
            decoded = parent.losslessDecodeURI(this.uri(url));
        } catch(e) {}
        tooltipUrl.value = decoded || url;
      }

      /************************************************************************/
      //Description
      var tooltipDescImg = document.getElementById("bhDescImg");
      var tooltipDesc = document.getElementById("bhDesc");
      var descr = "";

      if(annotation) {
        try {
		      descr = PlacesUIUtils.getItemDescription(itemId);
          tooltipDesc.textContent = descr;
        } catch(e) { cdmUtils.parseError(e); }
      }

      tooltipDesc.hidden = tooltipDescImg.hidden = !descr;

      /************************************************************************/
      //Visit Date
      var tooltipVisitedImg = document.getElementById("bhVisitedImg");
      var tooltipVisited = document.getElementById("bhVisited");
      var lastVisitString = "";

      showDate:
      if(url && this.ptGetBoolPref("showLastVisitDate", false)) {
        try {
          var options = PlacesUtils.history.getNewQueryOptions();
          options.resultType = options.RESULTS_AS_URI ;
          options.sortingMode = options.SORT_BY_DATE_DESCENDING;

          var query = PlacesUtils.history.getNewQuery();
          query.uri = this.uri(url);

          // execute the query
          var result = PlacesUtils.history.executeQuery(query, options);
          var root = result.root;
          root.containerOpen = true;

          if (root.childCount < 1) break showDate;
          var siteNode = root.getChild(0);

          var lastVisitDate = new Date (siteNode.time/1000);
          lastVisitString = lastVisitDate.toLocaleString();
          tooltipVisited.textContent = lastVisitString;
        } catch(e) { PTUtils.parseError(e); }
      }

      tooltipVisited.hidden = tooltipVisitedImg.hidden = !lastVisitString;

      /************************************************************************/
      //Keyword
      var tooltipKeyImg = document.getElementById("bhKeyImg");
      var tooltipKey = document.getElementById("bhKey");
      var key = "";

      if(url && this.ptGetBoolPref("showKeyword", true)) {
        try {
          key = PlacesUtils.bookmarks.getKeywordForURI(this.uri(url));
        } catch(e) {}
        if(!key) try {
          key = PlacesUtils.bookmarks.getKeywordForBookmark(itemId);
        } catch(e) { PTUtils.parseError(e); }
        tooltipKey.textContent = key;
      }

      tooltipKey.hidden = tooltipKeyImg.hidden = !key;

      /************************************************************************/
      //Tags
      var tooltipTagsImg = document.getElementById("bhTagsImg");
      var tooltipTags = document.getElementById("bhTags");
      var tags = new Array();

      if(url && this.ptGetBoolPref("showTags", false)) {
        tags = PlacesUtils.tagging.getTagsForURI(this.uri(url), {});
        var tTags = "";
        for(var i = 0; i < tags.length; i++)
          tTags += tags[i] + ", ";
        tTags = tTags.substring(0, tTags.length - 2);

        tooltipTags.textContent = tTags; 
      }

      tooltipTags.hidden = tooltipTagsImg.hidden = !tags[0];

      /************************************************************************/
      //Hide Boxes if necessary
      var btBox1 = document.getElementById("bhBox1");
      var btBox2 = document.getElementById("bhBox2");

      btBox1.hidden = tooltipDesc.hidden;
      btBox2.hidden = tooltipVisited.hidden && tooltipKey.hidden && tooltipTags.hidden;

      // Show tooltip
      return true;
    } catch(e) { PTUtils.parseError(e); }
	},//fillInBHTooltip

  fixOpenURI: function(aEvent) {
    try {
      var target = aEvent.originalTarget;
      if (!target._endOptOpenSiteURI)
        return;
      var oldSiteURI = target._endOptOpenSiteURI.getAttribute("siteURI");
      if (oldSiteURI) {
        target._endOptOpenSiteURI.removeAttribute("siteURI");
        target._endOptOpenSiteURI.setAttribute("targetURI", oldSiteURI);
        target._endOptOpenSiteURI.setAttribute("oncommand",
            "openUILink(this.getAttribute('targetURI'), event);");
        // Display information for the link on the status bar
        target._endOptOpenSiteURI.addEventListener("DOMMenuItemActive", function() {
          window.XULBrowserWindow.setOverLink(this.getAttribute("targetURI"), null);
        }, false);
        target._endOptOpenSiteURI.addEventListener("DOMMenuItemInactive", function() {
          window.XULBrowserWindow.setOverLink("", null);
        }, false);
      }
    } catch (e) { PTUtils.parseError(e); }
  },//fixOpenURI

  fixRecentlyClosedTab: function() {
    try {
      var undoPopup = document.getElementById("historyUndoPopup");

      // remove existing menu items
      while (undoPopup.hasChildNodes())
        undoPopup.removeChild(undoPopup.firstChild);

      // no restorable tabs, so make sure menu is disabled, and return
      if (this._ss.getClosedTabCount(window) == 0) {
        undoPopup.parentNode.setAttribute("disabled", true);
        return;
      }

      // enable menu
      undoPopup.parentNode.removeAttribute("disabled");

      // populate menu  
      let undoItems = PTUtils.nativeJSON.decode(this._ss.getClosedTabData(window));
      for (var i = 0; i < undoItems.length; i++) {
        var m = document.createElement("menuitem");
        m.setAttribute("label", undoItems[i].title);
        if (undoItems[i].image) {
          let iconURL = undoItems[i].image;
          // don't initiate a connection just to fetch a favicon (see bug 467828)
          if (/^https?:/.test(iconURL))
            iconURL = "moz-anno:favicon:" + iconURL;
          m.setAttribute("image", iconURL);
        }
        m.setAttribute("class", "menuitem-iconic bookmark-item");
        m.setAttribute("value", i);
        m.setAttribute("oncommand", "undoCloseTab(" + i + ");");

        // Set the targetURI attribute so it will be shown in tooltip and statusbar.
        // SessionStore uses one-based indexes, so we need to normalize them.
        let tabData = undoItems[i].state;
        let activeIndex = (tabData.index || tabData.entries.length) - 1;
        if (activeIndex >= 0 && tabData.entries[activeIndex])
          m.setAttribute("targetURI", tabData.entries[activeIndex].url);

        // Display information for the link on the status bar
        m.addEventListener("DOMMenuItemActive", function() {
          window.XULBrowserWindow.setOverLink(this.getAttribute("targetURI"), null);
        }, false);
        m.addEventListener("DOMMenuItemInactive", function() {
          window.XULBrowserWindow.setOverLink("", null);
        }, false);
        try { // For Firefox 3.6
          m.addEventListener("click", HistoryMenu._undoCloseMiddleClick, false);
        } catch (e) { // For Firefox 3.0/3.5
          m.addEventListener("click", undoCloseMiddleClick, false);
        }
        if (i == 0)
          m.setAttribute("key", "key_undoCloseTab");
        undoPopup.appendChild(m);
      }

      // "Restore All Tabs"
      var strings = gNavigatorBundle;
      undoPopup.appendChild(document.createElement("menuseparator"));
      m = undoPopup.appendChild(document.createElement("menuitem"));
      m.id = "menu_restoreAllTabs";
      try { // For Firefox 3.6
        m.setAttribute("label", strings.getString("menuRestoreAllTabs.label"));
        m.setAttribute("accesskey", strings.getString("menuRestoreAllTabs.accesskey"));
      } catch (e) { // For Firefox 3.0/3.5
        m.setAttribute("label", strings.getString("menuOpenAllInTabs.label"));
        m.setAttribute("accesskey", strings.getString("menuOpenAllInTabs.accesskey"));
      }
      m.addEventListener("command", function() {
        for (var i = 0; i < undoItems.length; i++)
          undoCloseTab();
      }, false);
    } catch (e) { PTUtils.parseError(e); }
  },//fixRecentlyClosedTab

  fixRecentlyClosedWindow: function() {
    try {
      let undoPopup = document.getElementById("historyUndoWindowPopup");
      let menuLabelString = gNavigatorBundle.getString("menuUndoCloseWindowLabel");
      let menuLabelStringSingleTab =
        gNavigatorBundle.getString("menuUndoCloseWindowSingleTabLabel");

      // remove existing menu items
      while (undoPopup.hasChildNodes())
        undoPopup.removeChild(undoPopup.firstChild);

      // no restorable windows, so make sure menu is disabled, and return
      if (this._ss.getClosedWindowCount() == 0) {
        undoPopup.parentNode.setAttribute("disabled", true);
        return;
      }

      // enable menu
      undoPopup.parentNode.removeAttribute("disabled");

      // populate menu  
      let undoItems = PTUtils.nativeJSON.decode(this._ss.getClosedWindowData());
      for (let i = 0; i < undoItems.length; i++) {
        let undoItem = undoItems[i];
        let otherTabsCount = undoItem.tabs.length - 1;
        let label = (otherTabsCount == 0) ? menuLabelStringSingleTab
                                          : PluralForm.get(otherTabsCount, menuLabelString);
        let menuLabel = label.replace("#1", undoItem.title)
                             .replace("#2", otherTabsCount);
        let m = document.createElement("menuitem");
        m.setAttribute("label", menuLabel);
        let selectedTab = undoItem.tabs[undoItem.selected - 1];
        if (selectedTab.attributes.image) {
          let iconURL = selectedTab.attributes.image;
          // don't initiate a connection just to fetch a favicon (see bug 467828)
          if (/^https?:/.test(iconURL))
            iconURL = "moz-anno:favicon:" + iconURL;
          m.setAttribute("image", iconURL);
        }
        m.setAttribute("class", "menuitem-iconic bookmark-item");
        m.setAttribute("oncommand", "undoCloseWindow(" + i + ");");

        // Set the targetURI attribute so it will be shown in tooltip and statusbar.
        // SessionStore uses one-based indexes, so we need to normalize them.
        let activeIndex = (selectedTab.index || selectedTab.entries.length) - 1;
        if (activeIndex >= 0 && selectedTab.entries[activeIndex])
          m.setAttribute("targetURI", selectedTab.entries[activeIndex].url);

        // Display information for the link on the status bar
        m.addEventListener("DOMMenuItemActive", function() {
          window.XULBrowserWindow.setOverLink(this.getAttribute("targetURI"), null);
        }, false);
        m.addEventListener("DOMMenuItemInactive", function() {
          window.XULBrowserWindow.setOverLink("", null);
        }, false);

        if (i == 0)
          m.setAttribute("key", "key_undoCloseWindow");
        undoPopup.appendChild(m);
      }

      // "Open All in Windows"
      undoPopup.appendChild(document.createElement("menuseparator"));
      let m = undoPopup.appendChild(document.createElement("menuitem"));
      m.id = "menu_restoreAllWindows";
      m.setAttribute("label", gNavigatorBundle.getString("menuRestoreAllWindows.label"));
      m.setAttribute("accesskey", gNavigatorBundle.getString("menuRestoreAllWindows.accesskey"));
      m.setAttribute("oncommand",
        "for (var i = 0; i < " + undoItems.length + "; i++) undoCloseWindow();");
    } catch (e) { PTUtils.parseError(e); }
  },//fixRecentlyClosedWindow

  ptGetBoolPref: function(key, defval) {
    try {
      var val = this.PrefsPT.getBoolPref(key);
      return val;
    } catch (e) { return defval; }
  },

  itemHasAnnotation: function(aNode) {
    try {
      if (!aNode)
        return false;
      return PlacesUtils.annotations.itemHasAnnotation(aNode.itemId, "bookmarkProperties/description");
    } catch(e) { return false; }
  },

  parseError: function(anError) {
    if (this.debug)
      alert(anError);
    else
      Components.utils.reportError(anError);
  },

  uri: function(spec) {
    var iosvc = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    return iosvc.newURI(spec, null, null);
  }
};//PTUtils  
window.addEventListener("load", initPTSidebar, false);

function initPTSidebar() {
  window.removeEventListener("load", initPTSidebar, false);
  var treechildren = document.getElementsByTagName("treechildren");
  treechildren["0"].setAttribute("tooltip", "bhTooltip");
}

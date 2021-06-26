window.addEventListener("load", initPTSidebar, false);

function initPTSidebar() {
  var treechildren = document.getElementsByTagName("treechildren");
  treechildren["0"].setAttribute("tooltip", "bhTooltip");
}

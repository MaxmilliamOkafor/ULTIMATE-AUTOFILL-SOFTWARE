var popupTemplate_entry_point = document.createElement("div");
var reactJS_script = document.createElement("script");
popupTemplate_entry_point.id = "debugTemplate";
reactJS_script.src = "debugTemplate.bundle.js";
popupTemplate_entry_point.appendChild(reactJS_script);
document.querySelector("body").appendChild(popupTemplate_entry_point);

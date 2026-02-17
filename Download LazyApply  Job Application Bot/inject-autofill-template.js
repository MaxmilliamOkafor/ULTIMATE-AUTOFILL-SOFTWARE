var popupTemplate_entry_point = document.createElement("div");
var reactJS_script = document.createElement("script");
popupTemplate_entry_point.id = "autoFillTemplate";
reactJS_script.src = "autoFillTemplate.bundle.js";
// reactJS_script.id = 'linkedinSendEmailScript'
popupTemplate_entry_point.appendChild(reactJS_script);
document.querySelector("body").appendChild(popupTemplate_entry_point);

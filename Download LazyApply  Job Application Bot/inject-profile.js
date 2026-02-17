var profileData_entry_point = document.createElement("div");
var reactJS_script = document.createElement("script");

profileData_entry_point.id = "profileData";
reactJS_script.src = "profileData.bundle.js";

profileData_entry_point.appendChild(reactJS_script);
document.querySelector("body").appendChild(profileData_entry_point);


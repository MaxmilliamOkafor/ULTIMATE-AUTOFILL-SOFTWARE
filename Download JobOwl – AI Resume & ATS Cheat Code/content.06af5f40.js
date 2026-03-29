var e,t;"function"==typeof(e=globalThis.define)&&(t=e,e=null),function(t,n,r,o,i){var l="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},a="function"==typeof l[o]&&l[o],d=a.cache||{},s="undefined"!=typeof module&&"function"==typeof module.require&&module.require.bind(module);function c(e,n){if(!d[e]){if(!t[e]){var r="function"==typeof l[o]&&l[o];if(!n&&r)return r(e,!0);if(a)return a(e,!0);if(s&&"string"==typeof e)return s(e);var i=Error("Cannot find module '"+e+"'");throw i.code="MODULE_NOT_FOUND",i}u.resolve=function(n){var r=t[e][1][n];return null!=r?r:n},u.cache={};var p=d[e]=new c.Module(e);t[e][0].call(p.exports,u,p,p.exports,this)}return d[e].exports;function u(e){var t=u.resolve(e);return!1===t?{}:c(t)}}c.isParcelRequire=!0,c.Module=function(e){this.id=e,this.bundle=c,this.exports={}},c.modules=t,c.cache=d,c.parent=a,c.register=function(e,n){t[e]=[function(e,t){t.exports=n},{}]},Object.defineProperty(c,"root",{get:function(){return l[o]}}),l[o]=c;for(var p=0;p<n.length;p++)c(n[p]);if(r){var u=c(r);"object"==typeof exports&&"undefined"!=typeof module?module.exports=u:"function"==typeof e&&e.amd?e(function(){return u}):i&&(this[i]=u)}}({"4gaGD":[function(e,t,n){var r=e("@parcel/transformer-js/src/esmodule-helpers.js");r.defineInteropFlag(n),r.export(n,"config",()=>o);let o={all_frames:!0,run_at:"document_end"};function i(){return{url:window.location.href,origin:window.location.origin,isTopFrame:window.self===window.top,frameId:window.location.href}}chrome.runtime.onMessage.addListener((e,t,n)=>{if("GET_INNER_TEXT"===e.type){try{let e=function(){let e;let t=new Set(["script","style","noscript","template","svg","canvas","meta","link","head","iframe"]),n=e=>{let t=e;for(;t;){let e=window.getComputedStyle(t);if(t.hidden||"none"===e.display||"hidden"===e.visibility||"0"===e.opacity)return!1;t=t.parentElement}return!0},r=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:e=>{let r=e.parentElement;if(!r||t.has(r.tagName.toLowerCase()))return NodeFilter.FILTER_REJECT;let o=e.nodeValue;return o&&o.trim()&&n(r)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}}),o=[];for(;e=r.nextNode();)o.push((e.nodeValue??"").trim());return o.join("\n").replace(/\n{3,}/g,"\n\n").trim()}(),t=i();n({innerText:e,frameInfo:t})}catch(e){n({innerText:"",frameInfo:i(),error:e instanceof Error?e.message:String(e)})}return!0}return"SHOW_TOAST"===e.type&&(function(e){let t=function(){let e="jobowl-toast-container",t=document.getElementById(e);t&&t.remove();let n=document.createElement("div");return n.id=e,n.style.cssText=`
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  `,document.body.appendChild(n),n}(),n=function(e){let t=document.createElement("div");t.id="jobowl-toast",t.style.cssText=`
    background: #4ade80;
    position: relative;
    color: black;
    padding: 16px 24px;
    border-radius: 8px;
    border: 2px solid black;
    box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 1);
    font-size: 14px;
    font-weight: 500;
    max-width: 350px;
    word-wrap: break-word;
    transform: translateX(100%);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  `;let n=document.createElement("div");return n.innerHTML=e,t.appendChild(n),t}(e),r=function(){let e=document.createElement("div");return e.style.cssText=`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 8px;
    border: 2px solid #000;
    background: white;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  `,e.innerHTML=`
        <svg width="24" height="24" viewBox="0 0 147 148" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="7.5" y="8.5" width="138" height="138" fill="black" stroke="black" stroke-width="3" />
                <rect x="4" y="4" width="133" height="133" fill="#75FA92" stroke="black" stroke-width="8" />
                <path d="M92.6055 22H79.5L55.5 44H68.6055H90.5H103.605L127.605 22L114.5 22H92.6055Z" fill="black" />
                <path d="M92.6055 22H79.5L55.5 44H68.6055H90.5H103.605L127.605 22L114.5 22H92.6055Z" stroke="black" />
                <path
                  d="M20 84.5L20 71.0001L42 51.5L42 64.6055L42 86.5L42 99.6055L20 119.5L20 106L20 84.5Z"
                  fill="black"
                />
                <path
                  d="M20 84.5L20 71.0001L42 51.5L42 64.6055L42 86.5L42 99.6055L20 119.5L20 106L20 84.5Z"
                  stroke="black"
                />
                <circle cx="33" cy="64" r="19" fill="#75FA92" />
                <circle cx="55.5" cy="79.5" r="31.5" fill="#75FA92" stroke="black" stroke-width="8" />
              </svg>
<p style="font-weight: 600; font-size: 12px; padding: 0; margin: 0;">JobOwl</p>
  `,e}(),o=function(){let e=document.createElement("button");return e.setAttribute("aria-label","Close JobOwl toast"),e.innerHTML=`
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 6L6 18"></path>
      <path d="M6 6l12 12"></path>
    </svg>
  `,e.style.cssText=`
    position: absolute;
    top: -12px;
    right: -12px;
    cursor: pointer;
    padding: 4px;
    background: #fff;
    border-radius: 50%;
    border: 2px solid #000;
    display: inline-flex;
  `,e}();t.appendChild(r),n.appendChild(o),o.addEventListener("click",()=>{t.style.transform="translateX(100%)",t.style.opacity="0",setTimeout(()=>t.remove(),300)}),t.appendChild(n),requestAnimationFrame(()=>{n.style.transform="translateX(0)"})}(e.message),n({success:!0}),!0)})},{"@parcel/transformer-js/src/esmodule-helpers.js":"fRZO2"}],fRZO2:[function(e,t,n){n.interopDefault=function(e){return e&&e.__esModule?e:{default:e}},n.defineInteropFlag=function(e){Object.defineProperty(e,"__esModule",{value:!0})},n.exportAll=function(e,t){return Object.keys(e).forEach(function(n){"default"===n||"__esModule"===n||t.hasOwnProperty(n)||Object.defineProperty(t,n,{enumerable:!0,get:function(){return e[n]}})}),t},n.export=function(e,t,n){Object.defineProperty(e,t,{enumerable:!0,get:n})}},{}]},["4gaGD"],"4gaGD","parcelRequiree5c6"),globalThis.define=t;
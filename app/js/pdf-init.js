// pdf.js loader (externalised from the inline module in index.html as the final
// step of the CSP hardening, so script-src can drop 'unsafe-inline'). The vendored
// pdf.js 6.x ships as an ES module: we import it and expose it as the global
// window.pdfjsLib that the classic-script code in app.js (window.processPDF) expects.
// This module lives in app/js/, so the vendor paths are ../vendor/ and import.meta.url
// resolves from app/js/. Module scripts are deferred, so this runs before any user
// PDF action.
import * as pdfjsLib from '../vendor/pdfjs/pdf.min.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
window.pdfjsLib = pdfjsLib;

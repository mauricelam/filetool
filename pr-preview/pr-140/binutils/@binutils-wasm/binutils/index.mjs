import {
  __glob
} from "./chunk-4UEJOM6W.mjs";

// import("../build/dist/esm/**/*.js") in src/index.mts
var globImport_build_dist_esm_js = __glob({
  "../build/dist/esm/addr2line.js": () => import("./addr2line-WCBDHAGS.mjs"),
  "../build/dist/esm/ar.js": () => import("./ar-ULRTJDPS.mjs"),
  "../build/dist/esm/cxxfilt.js": () => import("./cxxfilt-C2DYGH4R.mjs"),
  "../build/dist/esm/elfedit.js": () => import("./elfedit-G4XHKBYI.mjs"),
  "../build/dist/esm/nm.js": () => import("./nm-GIDRFKI3.mjs"),
  "../build/dist/esm/objcopy.js": () => import("./objcopy-GWRG3MEK.mjs"),
  "../build/dist/esm/objdump.js": () => import("./objdump-LCCDRKNJ.mjs"),
  "../build/dist/esm/ranlib.js": () => import("./ranlib-KUV6VUTB.mjs"),
  "../build/dist/esm/readelf.js": () => import("./readelf-YNZM6FWV.mjs"),
  "../build/dist/esm/size.js": () => import("./size-76A3SIE3.mjs"),
  "../build/dist/esm/strings.js": () => import("./strings-TYGA7RJ6.mjs"),
  "../build/dist/esm/strip.js": () => import("./strip-Z27DN4WW.mjs")
});

// src/index.mts
async function loader(executable) {
  return (await globImport_build_dist_esm_js(`../build/dist/esm/${executable}.js`)).default;
}
export {
  loader as default
};

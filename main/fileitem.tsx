import React, { CSSProperties, ReactElement, useEffect, useState } from "react";
import CustomTypes from "./mime-db/custom-types.json";
import IanaTypes from "./mime-db/iana-types.json";
import { setDefaultHandler, getDefaultHandler } from './defaultHandlers';

function getIcon(name: string) {
    for (const ext in ICON_LOOKUP) {
        if (name.toLowerCase().endsWith("." + ext) || name.toLowerCase() == ext) {
            return `icons/file_type_${ICON_LOOKUP[ext][0]}.svg`
        }
    }
    return `icons/default_file.svg`
}

interface HandlerConfig {
    name: string;
    handler: string;
    mimetypes?: any[]; // Optional, as it's not used directly here but good for type consistency
}

interface FileItemProps {
    name: string;
    mimetype: string;
    description: string;
    matchedHandlers: HandlerConfig[];
    onOpenHandler: (handlerId: string, filename: string, mimetype: string) => void;
    initialActiveHandler?: string;
}

export function FileItem(props: FileItemProps) {
    const { name, mimetype, description, matchedHandlers, onOpenHandler, initialActiveHandler } = props;
    const currentDefaultHandlerId = getDefaultHandler(mimetype, name);
    const [activeHandlerId, setActiveHandlerId] = useState<string | null>(null);
    const [localDefaultHandlerId, setLocalDefaultHandlerId] = useState<string | null>(currentDefaultHandlerId);

    // Set initial active handler if provided
    useEffect(() => {
        if (activeHandlerId === null && initialActiveHandler) {
            setActiveHandlerId(initialActiveHandler);
        }
    }, [activeHandlerId, initialActiveHandler]);

    const labelStyle: CSSProperties = {
        color: '#fff',
        padding: '1px 4px',
        fontSize: '12px',
        borderRadius: '6px',
        backgroundColor: '#666',
        marginRight: '2px',
        userSelect: 'none',
    }

    const buttonStyle: CSSProperties = {
        marginRight: '5px',
        padding: '6px 12px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        backgroundColor: '#fff',
        cursor: 'pointer',
        fontSize: '14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s ease',
    }

    const activeButtonStyle: CSSProperties = {
        ...buttonStyle,
        backgroundColor: '#e6f3ff',
        border: '1px solid #0066cc',
        color: '#0066cc',
    }

    const defaultIndicatorStyle: CSSProperties = {
        fontSize: '11px',
        color: '#666',
        textAlign: 'center',
        marginTop: '2px',
        fontStyle: 'italic',
    }

    const icon = getIcon(name)
    const [mimeDetails, setMimeDetails] = useState<ReactElement>()
    async function showMimeDetails() {
        const sources = (IanaTypes[mimetype] || CustomTypes[mimetype])?.sources
        setMimeDetails(current => {
            if (current) {
                return undefined
            } else {
                if (!sources) {
                    return <div>Cannot find further information about this mimetype</div>
                }
                return (
                    <div style={{ backgroundColor: '#ddd', padding: 4, borderRadius: 4 }}>
                        {sources.map(source => (
                            <a key={source} style={{ display: 'block', fontSize: 16 }} href={source} target="_blank">{source}</a>
                        ))}
                    </div>
                )
            }
        })
    }
    return (
        <div style={{ display: 'flex' }}>
            <img src={icon} style={{ width: 32, height: 32, marginRight: 4 }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="filename">{name}</div>
                <div>
                    <label style={labelStyle}>mimetype</label>
                    <span className="mime" style={{ color: '#555', fontSize: '14px' }}>{mimetype}</span>
                    <a href="#" onClick={() => { showMimeDetails(); return false }}>
                        <svg style={{ margin: '0 4px' }} xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#434343"><path d="M200-800v241-1 400-640 200-200Zm80 400h140q9-23 22-43t30-37H280v80Zm0 160h127q-5-20-6.5-40t.5-40H280v80ZM200-80q-33 0-56.5-23.5T120-160v-640q0-33 23.5-56.5T200-880h320l240 240v100q-19-8-39-12.5t-41-6.5v-41H480v-200H200v640h241q16 24 36 44.5T521-80H200Zm460-120q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29ZM864-40 756-148q-21 14-45.5 21t-50.5 7q-75 0-127.5-52.5T480-300q0-75 52.5-127.5T660-480q75 0 127.5 52.5T840-300q0 26-7 50.5T812-204L920-96l-56 56Z" /></svg>
                    </a>
                    {mimeDetails}
                    <div></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'start' }}>
                    <label style={labelStyle}>description</label>
                    <span className="filedescription" style={{ fontSize: '14px' }}>{description}</span>
                </div>
                <div className="buttonBar" style={{ display: 'flex', alignItems: 'center' }}>
                    {matchedHandlers.length === 0 && <span style={{ fontSize: '12px', color: '#777' }}>No specific handlers available. File might have been opened by a default.</span>}
                    {matchedHandlers.length > 0 && (
                        <>
                            <label style={labelStyle}>Open with</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                                {matchedHandlers
                                    .sort((a, b) => {
                                        // Sort active handler to the front
                                        if (a.handler === activeHandlerId) return -1;
                                        if (b.handler === activeHandlerId) return 1;
                                        return 0;
                                    })
                                    .map(handlerConfig => {
                                        const isCurrentDefault = handlerConfig.handler === currentDefaultHandlerId;
                                        const isActive = handlerConfig.handler === activeHandlerId;
                                        return (
                                            <div key={handlerConfig.handler} style={{ marginRight: '10px', display: 'inline-block', marginBottom: '5px' }}>
                                                <button
                                                    onClick={() => {
                                                        setActiveHandlerId(handlerConfig.handler);
                                                        onOpenHandler(handlerConfig.handler, name, mimetype);
                                                    }}
                                                    style={isActive ? activeButtonStyle : buttonStyle}
                                                >
                                                    {handlerConfig.name}
                                                </button>
                                                {isCurrentDefault && (
                                                    <div style={defaultIndicatorStyle}>Default</div>
                                                )}
                                                {isActive && !isCurrentDefault && localDefaultHandlerId !== handlerConfig.handler && (
                                                    <div
                                                        onClick={() => {
                                                            setDefaultHandler(mimetype, name, handlerConfig.handler);
                                                            setLocalDefaultHandlerId(handlerConfig.handler);
                                                            console.log(`Set ${handlerConfig.name} (id: ${handlerConfig.handler}) as default for mimetype: ${mimetype}`);
                                                        }}
                                                        title="Set as default"
                                                        className="circle-container"
                                                        style={defaultIndicatorStyle}
                                                    >Default</div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <style>
                {`
                    .circle-container {
                        opacity: 0.2;
                        cursor: pointer;
                    }
                    .circle-container:hover {
                        opacity: 1;
                    }
                `}
            </style>
        </div>
    )
}


const ICON_LOOKUP = {
    "accdb": [
        "access",
        "access2"
    ],
    "accdt": [
        "access",
        "access2"
    ],
    "mdb": [
        "access",
        "access2"
    ],
    "accda": [
        "access",
        "access2"
    ],
    "accdc": [
        "access",
        "access2"
    ],
    "accde": [
        "access",
        "access2"
    ],
    "accdp": [
        "access",
        "access2"
    ],
    "accdr": [
        "access",
        "access2"
    ],
    "accdu": [
        "access",
        "access2"
    ],
    "ade": [
        "access",
        "access2"
    ],
    "adp": [
        "access",
        "access2"
    ],
    "laccdb": [
        "access",
        "access2"
    ],
    "ldb": [
        "access",
        "access2"
    ],
    "mam": [
        "access",
        "access2"
    ],
    "maq": [
        "access",
        "access2"
    ],
    "mdw": [
        "access",
        "access2"
    ],
    "ai": [
        "ai",
        "ai2"
    ],
    "dal": ["al_dal"],
    ".all-contributorsrc": ["allcontributors"],
    "afdesign": ["affinitydesigner"],
    "affinitydesigner": ["affinitydesigner"],
    "afphoto": ["affinityphoto"],
    "affinityphoto": ["affinityphoto"],
    "afpub": ["affinitypublisher"],
    "affinitypublisher": ["affinitypublisher"],
    "gs": ["appscript"],
    "fba": ["fitbit"],
    ".angular-cli.json": ["angular"],
    "angular-cli.json": ["angular"],
    "angular.json": ["angular"],
    ".angular.json": ["angular"],
    "component.dart": ["ng_component_dart"],
    "component.ts": [
        "ng_component_ts",
        "ng_component_ts2"
    ],
    "component.js": [
        "ng_component_js",
        "ng_component_js2"
    ],
    "controller.ts": [
        "ng_controller_ts",
        "nest_controller_ts"
    ],
    "controller.js": [
        "ng_controller_js",
        "nest_controller_js"
    ],
    "directive.dart": ["ng_directive_dart"],
    "directive.ts": [
        "ng_directive_ts",
        "ng_directive_ts2"
    ],
    "directive.js": [
        "ng_directive_js",
        "ng_directive_js2"
    ],
    "guard.dart": ["ng_guard_dart"],
    "guard.ts": [
        "ng_guard_ts",
        "nest_guard_ts"
    ],
    "guard.js": [
        "ng_guard_js",
        "nest_guard_js"
    ],
    "module.dart": ["ng_module_dart"],
    "module.ts": [
        "ng_module_ts",
        "ng_module_ts2",
        "nest_module_ts"
    ],
    "module.js": [
        "ng_module_js",
        "ng_module_js2",
        "nest_module_js"
    ],
    "pipe.dart": ["ng_pipe_dart"],
    "pipe.ts": [
        "ng_pipe_ts",
        "ng_pipe_ts2",
        "nest_pipe_ts"
    ],
    "pipe.js": [
        "ng_pipe_js",
        "ng_pipe_js2",
        "nest_pipe_js"
    ],
    "routing.dart": ["ng_routing_dart"],
    "routes.dart": ["ng_routing_dart"],
    "routing.ts": [
        "ng_routing_ts",
        "ng_routing_ts2"
    ],
    "routes.ts": [
        "ng_routing_ts",
        "ng_routing_ts2"
    ],
    "routing.js": [
        "ng_routing_js",
        "ng_routing_js2"
    ],
    "routes.js": [
        "ng_routing_js",
        "ng_routing_js2"
    ],
    "app-routing.module.dart": ["ng_routing_dart"],
    "app-routing.module.ts": [
        "ng_routing_ts",
        "ng_routing_ts2"
    ],
    "app-routing.module.js": [
        "ng_routing_js",
        "ng_routing_js2"
    ],
    "page.dart": ["ng_smart_component_dart"],
    "container.dart": ["ng_smart_component_dart"],
    "page.ts": [
        "ng_smart_component_ts",
        "ng_smart_component_ts2"
    ],
    "container.ts": [
        "ng_smart_component_ts",
        "ng_smart_component_ts2"
    ],
    "page.js": [
        "ng_smart_component_js",
        "ng_smart_component_js2"
    ],
    "container.js": [
        "ng_smart_component_js",
        "ng_smart_component_js2"
    ],
    "service.dart": ["ng_service_dart"],
    "service.ts": [
        "ng_service_ts",
        "ng_service_ts2",
        "nest_service_ts"
    ],
    "service.js": [
        "ng_service_js",
        "ng_service_js2",
        "nest_service_js"
    ],
    "interceptor.dart": ["ng_interceptor_dart"],
    "interceptor.ts": [
        "ng_interceptor_ts",
        "nest_interceptor_ts"
    ],
    "interceptor.js": [
        "ng_interceptor_js",
        "nest_interceptor_js"
    ],
    "ng-tailwind.js": ["ng_tailwind"],
    "api-extractor.json": ["api_extractor"],
    "api-extractor-base.json": ["api_extractor"],
    ".appsemblerc.yaml": ["appsemble"],
    "app-definition.yaml": ["appsemble"],
    "appveyor.yml": ["appveyor"],
    ".appveyor.yml": ["appveyor"],
    "ino": ["arduino"],
    "pde": ["arduino"],
    "aspx": ["aspx"],
    "ascx": ["aspx"],
    "asm": ["assembly"],
    "s": ["assembly"],
    "astro": ["astro"],
    "aac": ["audio"],
    "act": ["audio"],
    "aiff": ["audio"],
    "amr": ["audio"],
    "ape": ["audio"],
    "au": ["audio"],
    "dct": ["audio"],
    "dss": ["audio"],
    "dvf": ["audio"],
    "flac": ["audio"],
    "gsm": ["audio"],
    "iklax": ["audio"],
    "ivs": ["audio"],
    "m4a": ["audio"],
    "m4b": ["audio"],
    "m4p": ["audio"],
    "mmf": ["audio"],
    "mogg": ["audio"],
    "mp3": ["audio"],
    "mpc": ["audio"],
    "msv": ["audio"],
    "oga": ["audio"],
    "ogg": ["audio"],
    "opus": ["audio"],
    "ra": ["audio"],
    "raw": ["audio"],
    "tta": ["audio"],
    "vox": ["audio"],
    "wav": ["audio"],
    "wma": ["audio"],
    "aurelia.json": ["aurelia"],
    "avif": ["avif"],
    "awk": ["awk"],
    "azure-pipelines.yml": ["azurepipelines"],
    ".vsts-ci.yml": ["azurepipelines"],
    ".babelrc": [
        "babel",
        "babel2"
    ],
    ".babelignore": [
        "babel",
        "babel2"
    ],
    ".bzrignore": ["bazaar"],
    "BUILD.bazel": ["bazel"],
    ".bazelrc": ["bazel"],
    "bazel.rc": ["bazel"],
    "bazel.bazelrc": ["bazel"],
    ".bazelignore": ["bazel_ignore"],
    ".bazelversion": ["bazel_version"],
    "a": ["binary"],
    "app": ["binary"],
    "bin": ["binary"],
    "cmo": ["binary"],
    "cmx": ["binary"],
    "cma": ["binary"],
    "cmxa": ["binary"],
    "cmi": ["binary"],
    "dll": ["binary"],
    "exe": ["binary"],
    "hl": ["binary"],
    "ilk": ["binary"],
    "lib": ["binary"],
    "n": ["binary"],
    "ndll": ["binary"],
    "o": ["binary"],
    "obj": ["binary"],
    "pyc": ["binary"],
    "pyd": ["binary"],
    "pyo": ["binary"],
    "pdb": ["binary"],
    "scpt": ["binary"],
    "scptd": ["binary"],
    "so": ["binary"],
    ".bithoundrc": ["bithound"],
    "bitbucket-pipelines.yml": ["bitbucketpipeline"],
    "bb": ["blitzbasic"],
    ".bowerrc": ["bower"],
    "bower.json": ["bower"],
    ".browserslistrc": ["browserslist"],
    "browserslist": ["browserslist"],
    ".buckconfig": ["buckbuild"],
    "buf.yaml": ["buf"],
    "buf.yml": ["buf"],
    "buf.gen.yml": ["buf"],
    "buf.gen.yaml": ["buf"],
    "buf.work.yaml": ["buf"],
    "buf.work.yml": ["buf"],
    "bun": ["bun"],
    "lockb": ["bun"],
    "gemfile": [
        "bundler",
        "bundler"
    ],
    "gemfile.lock": [
        "bundler",
        "bundler"
    ],
    "bunfig.toml": ["bunfig"],
    "cake": ["cake"],
    "cargo.toml": ["cargo"],
    "cargo.lock": ["cargo"],
    "csr": ["cert"],
    "crt": ["cert"],
    "cer": ["cert"],
    "der": ["cert"],
    "pfx": ["cert"],
    "p12": ["cert"],
    "p7b": ["cert"],
    "p7r": ["cert"],
    "src": ["cert"],
    "crl": ["cert"],
    "sst": ["cert"],
    "stl": ["cert"],
    "lucee": [
        "cf",
        "cf2"
    ],
    "h": ["cheader"],
    "chefignore": ["chef"],
    "berksfile": ["chef"],
    "berksfile.lock": ["chef"],
    "policyfile.rb": ["chef"],
    "policyfile.lock.json": ["chef"],
    "class": ["class"],
    "circle.yml": ["circleci"],
    "cjm": ["clojure"],
    "cljc": ["clojure"],
    "cljs": ["clojurescript"],
    ".cfignore": ["cloudfoundry"],
    "codeowners": ["codeowners"],
    ".codacy.yml": ["codacy"],
    ".codacy.yaml": ["codacy"],
    ".codeclimate.yml": ["codeclimate"],
    "codecov.yml": ["codecov"],
    ".codecov.yml": ["codecov"],
    "kit": ["codekit"],
    "config.codekit": ["codekit"],
    "config.codekit2": ["codekit"],
    "config.codekit3": ["codekit"],
    ".config.codekit": ["codekit"],
    ".config.codekit2": ["codekit"],
    ".config.codekit3": ["codekit"],
    "coffeelint.json": ["coffeelint"],
    ".coffeelintignore": ["coffeelint"],
    "conanfile.txt": ["conan"],
    "conanfile.py": ["conan"],
    ".condarc": ["conda"],
    "plist": ["config"],
    ".tool-versions": ["config"],
    ".czrc": ["commitizen"],
    ".cz.json": ["commitizen"],
    ".commitlintrc": ["commitlint"],
    "commitlint.config.js": ["commitlint"],
    "commitlint.config.cjs": ["commitlint"],
    "commitlint.config.mjs": ["commitlint"],
    "commitlint.config.ts": ["commitlint"],
    "commitlint.config.cts": ["commitlint"],
    "composer.json": ["composer"],
    "composer.lock": ["composer"],
    ".coverage": ["coverage"],
    "lcov.info": ["coverage"],
    "lcov": ["coverage"],
    ".coveralls.yml": ["coveralls"],
    "hpp": ["cppheader"],
    "hh": ["cppheader"],
    "hxx": ["cppheader"],
    "h++": ["cppheader"],
    "crowdin.yml": ["crowdin"],
    "csx": [
        "csharp",
        "csharp2"
    ],
    "csproj": ["csproj"],
    ".csscomb.json": ["csscomb"],
    ".csslintrc": ["csslint"],
    "css.map": ["cssmap"],
    "cypress.json": ["cypress"],
    "cypress.env.json": ["cypress"],
    "cypress.config.js": ["cypress"],
    "cypress.config.ts": ["cypress"],
    "cypress.config.cjs": ["cypress"],
    "cypress.config.mjs": ["cypress"],
    "cy.js": ["cypress_spec"],
    "cy.mjs": ["cypress_spec"],
    "cy.cjs": ["cypress_spec"],
    "cy.coffee": ["cypress_spec"],
    "cy.ts": ["cypress_spec"],
    "cy.tsx": ["cypress_spec"],
    "cy.jsx": ["cypress_spec"],
    ".cvsignore": ["cvs"],
    ".boringignore": ["darcs"],
    "g.dart": ["dartlang_generated"],
    "freezed.dart": ["dartlang_generated"],
    ".pubignore": ["dartlang_ignore"],
    "service.datadog.yaml": ["datadog"],
    "datadog-ci.json": ["datadog"],
    "static-analysis.datadog.yml": ["datadog"],
    "static-analysis.datadog.yaml": ["datadog"],
    "db": ["db"],
    "deb": ["debian"],
    ".denoifyrc": ["denoify"],
    "dependabot.yml": ["dependabot"],
    "dependabot.yaml": ["dependabot"],
    "dependencies.yml": ["dependencies"],
    "devcontainer.json": ["devcontainer"],
    ".devcontainer.json": ["devcontainer"],
    "djt": ["django"],
    ".dockerignore": [
        "docker",
        "docker2"
    ],
    "docker-compose.test.yml": [
        "dockertest",
        "dockertest2"
    ],
    "eco": ["docpad"],
    ".doczrc": ["docz"],
    ".dojorc": ["dojo"],
    "drawio": ["drawio"],
    "dio": ["drawio"],
    ".drone.yml": ["drone"],
    ".drone.yml.sig": ["drone"],
    "dtd": ["dtd"],
    ".dvc": ["dvc"],
    ".editorconfig": ["editorconfig"],
    ".earthlyignore": ["earthly"],
    "Earthfile": ["earthly"],
    "store.config.json": ["eas-metadata"],
    "eex": ["eex"],
    "heex": ["eex"],
    "phoenix-heex": ["eex"],
    "html-heex": ["eex"],
    "ejs": ["ejs"],
    ".eleventy.js": [
        "eleventy",
        "eleventy2"
    ],
    "eleventy.config.js": [
        "eleventy",
        "eleventy2"
    ],
    "eleventy.config.cjs": [
        "eleventy",
        "eleventy2"
    ],
    "elm-package.json": [
        "elm",
        "elm2"
    ],
    "el": ["emacs"],
    "elc": ["emacs"],
    ".ember-cli": ["ember"],
    "ensime": ["ensime"],
    "eps": ["eps"],
    "emakefile": [
        "erlang",
        "erlang2"
    ],
    ".emakerfile": [
        "erlang",
        "erlang2"
    ],
    ".eslintrc": [
        "eslint",
        "eslint2"
    ],
    ".eslintignore": [
        "eslint",
        "eslint2"
    ],
    ".eslintcache": [
        "eslint",
        "eslint2"
    ],
    "eslint.config.js": [
        "eslint",
        "eslint2"
    ],
    "eslint.config.mjs": [
        "eslint",
        "eslint2"
    ],
    "eslint.config.cjs": [
        "eslint",
        "eslint2"
    ],
    "excalidraw": ["excalidraw"],
    "excalidraw.json": ["excalidraw"],
    "excalidraw.svg": ["excalidraw"],
    "excalidraw.png": ["excalidraw"],
    "xls": [
        "excel",
        "excel2"
    ],
    "xlsx": [
        "excel",
        "excel2"
    ],
    "xlsm": [
        "excel",
        "excel2"
    ],
    "ods": [
        "excel",
        "excel2",
        "libreoffice_calc"
    ],
    "fods": [
        "excel",
        "excel2",
        "libreoffice_calc"
    ],
    "xlsb": [
        "excel",
        "excel2"
    ],
    "app.json": ["expo"],
    "app.config.js": ["expo"],
    "app.config.json": ["expo"],
    "app.config.json5": ["expo"],
    ".fantasticonrc": ["fantasticon"],
    "fantasticonrc": ["fantasticon"],
    ".fantasticonrc.json": ["fantasticon"],
    "fantasticonrc.json": ["fantasticon"],
    ".fantasticonrc.js": ["fantasticon"],
    "fantasticonrc.js": ["fantasticon"],
    ".faunarc": ["fauna"],
    "favicon.ico": ["favicon"],
    "fbx": ["fbx"],
    ".firebaserc": ["firebase"],
    "firebase.json": ["firebasehosting"],
    "firestore.rules": ["firestore"],
    "firestore.indexes.json": ["firestore"],
    "fla": ["fla"],
    "swf": ["flash"],
    "swc": ["flash"],
    ".flooignore": ["floobits"],
    "js.flow": ["flow"],
    ".flowconfig": ["flow"],
    ".flutter-plugins": ["flutter"],
    ".metadata": ["flutter"],
    "pubspec.lock": ["flutter_package"],
    "pubspec.yaml": ["flutter_package"],
    ".packages": ["flutter_package"],
    "woff": ["font"],
    "woff2": ["font"],
    "ttf": ["font"],
    "otf": [
        "font",
        "libreoffice_math"
    ],
    "eot": ["font"],
    "pfa": ["font"],
    "pfb": ["font"],
    "sfd": ["font"],
    ".fossaignore": ["fossa"],
    "ignore-glob": ["fossil"],
    "fsproj": ["fsproj"],
    ".front-commerce.js": ["frontcommerce"],
    "front-commerce.config.ts": ["frontcommerce"],
    "funding.yml": ["funding"],
    "fuse.js": ["fusebox"],
    ".gitattributes": ["git"],
    ".gitconfig": ["git"],
    ".gitignore": ["git"],
    ".gitmodules": ["git"],
    ".gitkeep": ["git"],
    ".git-blame-ignore-revs": ["git"],
    ".mailmap": ["git"],
    ".issuetracker": ["git"],
    "gmx": ["gamemaker"],
    "yy": ["gamemaker2"],
    "yyp": ["gamemaker2"],
    ".gcloudignore": ["gcloud"],
    ".gitlab-ci.yml": ["gitlab"],
    "gleam": ["gleam"],
    "gleam.toml": ["gleamconfig"],
    "glide.yml": ["glide"],
    ".glitterrc": ["glitter"],
    "am": ["gnu"],
    "ld": ["gnu"],
    "m4": ["gnu"],
    "makefile": ["gnu"],
    "go.sum": ["go_package"],
    "go.mod": ["go_package"],
    "go.work": ["go_work"],
    "go.work.sum": ["go_work"],
    "godot": ["godot"],
    "gradle": [
        "gradle",
        "gradle2"
    ],
    "gr": ["grain"],
    ".gqlconfig": ["graphql"],
    ".graphqlconfig": ["graphql_config"],
    "greenkeeper.json": ["greenkeeper"],
    "hcl2": ["hashicorp"],
    "sentinel": ["hashicorp"],
    "haxelib.json": ["haxe"],
    "checkstyle.json": ["haxecheckstyle"],
    "hxproj": ["haxedevelop"],
    ".p4ignore": ["helix"],
    "chart.lock": ["helm"],
    "chart.yaml": ["helm"],
    "horusec-config.json": ["horusec"],
    ".htmlhintrc": ["htmlhint"],
    ".huskyrc": ["husky"],
    "husky.config.js": ["husky"],
    "ejs.t": ["hygen"],
    "idr": ["idris"],
    "lidr": ["idris"],
    "ibc": ["idrisbin"],
    "ipkg": ["idrispkg"],
    "jpeg": ["image"],
    "jpg": ["image"],
    "gif": ["image"],
    "png": ["image"],
    "bmp": ["image"],
    "tiff": ["image"],
    "ico": ["image"],
    "icns": ["image"],
    "webp": ["image"],
    "imba": ["imba"],
    "imba2": ["imba"],
    "inc": ["inc"],
    "include": ["inc"],
    "infopathxml": ["infopath"],
    "xsn": ["infopath"],
    "xsf": ["infopath"],
    "xtp2": ["infopath"],
    "ionic.project": ["ionic"],
    "ionic.config.json": ["ionic"],
    "jakefile": ["jake"],
    "jakefile.js": ["jake"],
    "jar": ["jar"],
    "jasmine.json": ["jasmine"],
    "jbuilder": ["jbuilder"],
    "jest.json": ["jest"],
    "jest.config.babel.js": ["jest"],
    ".jestrc": ["jest"],
    ".jestrc.js": ["jest"],
    ".jestrc.json": ["jest"],
    ".jpmignore": ["jpm"],
    ".jsbeautifyrc": ["jsbeautify"],
    "jsbeautifyrc": ["jsbeautify"],
    ".jsbeautify": ["jsbeautify"],
    "jsbeautify": ["jsbeautify"],
    "jsconfig.json": ["jsconfig"],
    ".jscpd.json": ["jscpd"],
    ".jshintrc": ["jshint"],
    ".jshintignore": ["jshint"],
    "js.map": ["jsmap"],
    "cjs.map": ["jsmap"],
    "mjs.map": ["jsmap"],
    "jsonl": [
        "json",
        "json_official",
        "json2"
    ],
    "ndjson": [
        "json",
        "json_official",
        "json2"
    ],
    "schema.json": ["json_schema"],
    "json5": ["json5"],
    "jsonld": ["jsonld"],
    "json-ld": ["jsonld"],
    "jsp": ["jsp"],
    "jss": ["jss"],
    "juice": ["juice"],
    "ipynb": ["jupyter"],
    "key": ["key"],
    "pem": ["key"],
    ".kiteignore": ["kite"],
    ".kitchen.yml": ["kitchenci"],
    "kitchen.yml": ["kitchenci"],
    "ktm": ["kotlin"],
    "master": ["layout"],
    "layout.html": [
        "layout",
        "layout"
    ],
    "layout.htm": [
        "layout",
        "layout"
    ],
    "lerna.json": ["lerna"],
    "odb": ["libreoffice_base"],
    "otb": ["libreoffice_base"],
    "ots": ["libreoffice_calc"],
    "odg": ["libreoffice_draw"],
    "otg": ["libreoffice_draw"],
    "odp": ["libreoffice_impress"],
    "otp": ["libreoffice_impress"],
    "odf": ["libreoffice_math"],
    "odt": ["libreoffice_writer"],
    "ott": ["libreoffice_writer"],
    "enc": ["license"],
    "license": [
        "license",
        "license"
    ],
    "lic": ["license"],
    "licence": ["license"],
    "copying": ["license"],
    "copying.lesser": ["license"],
    "license-mit": ["license"],
    "license-apache": ["license"],
    ".licrc": ["licensebat"],
    "hxp": ["lime"],
    "include.xml": ["lime"],
    ".lintstagedrc": ["lintstagedrc"],
    ".lintstagedrc.json": ["lintstagedrc"],
    ".lintstagedrc.yaml": ["lintstagedrc"],
    ".lintstagedrc.yml": ["lintstagedrc"],
    ".lintstagedrc.mjs": ["lintstagedrc"],
    ".lintstagedrc.js": ["lintstagedrc"],
    ".lintstagedrc.cjs": ["lintstagedrc"],
    "lint-staged.config.mjs": ["lintstagedrc"],
    "lint-staged.config.js": ["lintstagedrc"],
    "lint-staged.config.cjs": ["lintstagedrc"],
    "liquid": ["liquid"],
    "ls": ["livescript"],
    "lnk": ["lnk"],
    "log": [
        "log",
        "log"
    ],
    "tlg": [
        "log",
        "log"
    ],
    "luau": ["luau"],
    "crec": ["lync"],
    "ocrec": ["lync"],
    "mailing.config.json": ["mailing"],
    "manifest": ["manifest"],
    "manifest.skip": ["manifest_skip"],
    "manifest.bak": ["manifest_bak"],
    "map": ["map"],
    "mdown": ["markdown"],
    "markdown": ["markdown"],
    ".markdownlintrc": ["markdownlint"],
    ".markdownlintignore": ["markdownlint_ignore"],
    "marko.js": ["markojs"],
    "fig": ["matlab"],
    "mex": ["matlab"],
    "mexn": ["matlab"],
    "mexrs6": ["matlab"],
    "mn": ["matlab"],
    "mum": ["matlab"],
    "mx": ["matlab"],
    "mx3": ["matlab"],
    "rwd": ["matlab"],
    "slx": ["matlab"],
    "slddc": ["matlab"],
    "smv": ["matlab"],
    "xvc": ["matlab"],
    "maven.config": ["maven"],
    ".hgignore": ["mercurial"],
    "mocha.opts": ["mocha"],
    "modernizr": ["modernizr"],
    "mojo": ["mojo"],
    "🔥": ["mojo"],
    "mql.yaml": ["mondoo"],
    "mql.yml": ["mondoo"],
    ".mtn-ignore": ["monotone"],
    "motif.json": ["motif"],
    "mustache": ["mustache"],
    "mst": ["mustache"],
    "ndst.yaml": ["ndst"],
    "ndst.yml": ["ndst"],
    "ndst.json": ["ndst"],
    ".nest-cli.json": ["nestjs"],
    "nest-cli.json": ["nestjs"],
    "nestconfig.json": ["nestjs"],
    ".nestconfig.json": ["nestjs"],
    "adapter.js": ["nest_adapter_js"],
    "adapter.ts": ["nest_adapter_ts"],
    "decorator.js": ["nest_decorator_js"],
    "decorator.ts": ["nest_decorator_ts"],
    "filter.js": ["nest_filter_js"],
    "filter.ts": ["nest_filter_ts"],
    "gateway.js": ["nest_gateway_js"],
    "gateway.ts": ["nest_gateway_ts"],
    "middleware.js": ["nest_middleware_js"],
    "middleware.ts": ["nest_middleware_ts"],
    "netlify.toml": ["netlify"],
    "next.config.js": ["next"],
    "next.config.cjs": ["next"],
    "next.config.mjs": ["next"],
    ".nf": ["nextflow"],
    "nginx.conf": ["nginx"],
    "build.ninja": ["ninja"],
    "noc": ["noc"],
    "flake.lock": ["nix"],
    "njsproj": ["njsproj"],
    ".node-version": [
        "node",
        "node2"
    ],
    ".nvmrc": [
        "node",
        "node2"
    ],
    "nodemon.json": ["nodemon"],
    ".npmignore": ["npm"],
    ".npmrc": ["npm"],
    ".package-lock.json": ["npm"],
    "package.json": ["npm"],
    "package-lock.json": ["npm"],
    "npm-shrinkwrap.json": ["npm"],
    ".nsrirc": ["nsri"],
    ".nsriignore": ["nsri"],
    "nsri.config.js": ["nsri"],
    ".integrity.json": ["nsri-integrity"],
    "nupkg": ["nuget"],
    "snupkg": ["nuget"],
    "nuspec": ["nuget"],
    "psmdcp": ["nuget"],
    "npy": ["numpy"],
    "npz": ["numpy"],
    "nunj": ["nunjucks"],
    "njs": ["nunjucks"],
    ".nuxtignore": ["nuxt"],
    ".nuxtrc": ["nuxt"],
    ".nycrc": ["nyc"],
    ".nycrc.json": ["nyc"],
    ".objidconfig": ["objidconfig"],
    ".merlin": ["ocaml"],
    "mli": ["ocaml_intf"],
    "one": ["onenote"],
    "onepkg": ["onenote"],
    "onetoc": ["onenote"],
    "onetoc2": ["onenote"],
    "sig": ["onenote"],
    "cl": ["opencl"],
    "opencl": ["opencl"],
    "org": ["org"],
    "pst": ["outlook"],
    "bcmx": ["outlook"],
    "otm": ["outlook"],
    "msg": ["outlook"],
    "oft": ["outlook"],
    "ovpn": ["ovpn"],
    "pkg": ["package"],
    "patch": ["patch"],
    "pcd": ["pcl"],
    "pdf": [
        "pdf",
        "pdf2"
    ],
    ".pdm-python": ["pdm"],
    "peeky.config.ts": ["peeky"],
    "peeky.config.js": ["peeky"],
    "peeky.config.mjs": ["peeky"],
    "psd": [
        "photoshop",
        "photoshop2"
    ],
    "php1": [
        "php",
        "php2",
        "php3"
    ],
    "php2": [
        "php",
        "php2",
        "php3"
    ],
    "php3": [
        "php",
        "php2",
        "php3"
    ],
    "php4": [
        "php",
        "php2",
        "php3"
    ],
    "php5": [
        "php",
        "php2",
        "php3"
    ],
    "php6": [
        "php",
        "php2",
        "php3"
    ],
    "phps": [
        "php",
        "php2",
        "php3"
    ],
    "phpsa": [
        "php",
        "php2",
        "php3"
    ],
    "phpt": [
        "php",
        "php2",
        "php3"
    ],
    "phtml": [
        "php",
        "php2",
        "php3"
    ],
    "phar": [
        "php",
        "php2",
        "php3"
    ],
    ".php_cs": ["phpcsfixer"],
    ".php_cs.dist": ["phpcsfixer"],
    "phpunit": ["phpunit"],
    "phpunit.xml": ["phpunit"],
    "phpunit.xml.dist": ["phpunit"],
    ".phraseapp.yml": ["phraseapp"],
    "pipfile": ["pip"],
    "pipfile.lock": ["pip"],
    "pipeline": ["pipeline"],
    "platformio.ini": ["platformio"],
    "pu": ["plantuml"],
    "plantuml": ["plantuml"],
    "iuml": ["plantuml"],
    "puml": ["plantuml"],
    "pck": ["plsql_package"],
    "pkb": ["plsql_package_body"],
    "pkh": ["plsql_package_header"],
    "pks": ["plsql_package_spec"],
    "pnpmfile.js": ["pnpm"],
    "pnpm-lock.yaml": ["pnpm"],
    "pnpm-workspace.yaml": ["pnpm"],
    "po": ["poedit"],
    "mo": ["poedit"],
    ".postcssrc": ["postcssconfig"],
    ".postcssrc.json": ["postcssconfig"],
    ".postcssrc.yaml": ["postcssconfig"],
    ".postcssrc.yml": ["postcssconfig"],
    ".postcssrc.ts": ["postcssconfig"],
    ".postcssrc.js": ["postcssconfig"],
    ".postcssrc.cjs": ["postcssconfig"],
    "postcss.config.ts": ["postcssconfig"],
    "postcss.config.js": ["postcssconfig"],
    "postcss.config.cjs": ["postcssconfig"],
    "postman_collection.json": ["postman"],
    "postman_environment.json": ["postman"],
    "postman_globals.json": ["postman"],
    "pot": [
        "powerpoint",
        "powerpoint2"
    ],
    "potx": [
        "powerpoint",
        "powerpoint2"
    ],
    "potm": [
        "powerpoint",
        "powerpoint2"
    ],
    "pps": [
        "powerpoint",
        "powerpoint2"
    ],
    "ppsx": [
        "powerpoint",
        "powerpoint2"
    ],
    "ppsm": [
        "powerpoint",
        "powerpoint2"
    ],
    "ppt": [
        "powerpoint",
        "powerpoint2"
    ],
    "pptx": [
        "powerpoint",
        "powerpoint2"
    ],
    "pptm": [
        "powerpoint",
        "powerpoint2"
    ],
    "pa": [
        "powerpoint",
        "powerpoint2"
    ],
    "ppa": [
        "powerpoint",
        "powerpoint2"
    ],
    "ppam": [
        "powerpoint",
        "powerpoint2"
    ],
    "sldm": [
        "powerpoint",
        "powerpoint2"
    ],
    "sldx": [
        "powerpoint",
        "powerpoint2"
    ],
    "psm1": [
        "powershell_psm",
        "powershell_psm2"
    ],
    "psd1": [
        "powershell_psd",
        "powershell_psd2"
    ],
    "format.ps1xml": ["powershell_format"],
    "types.ps1xml": ["powershell_types"],
    ".pre-commit-config.yaml": ["precommit"],
    ".prettierrc": ["prettier"],
    ".prettierignore": ["prettier"],
    "procfile": ["procfile"],
    "pro": ["prolog"],
    "publiccode.yml": ["publiccode"],
    "pub": ["publisher"],
    "puz": ["publisher"],
    ".jade-lintrc": ["pug"],
    ".pug-lintrc": ["pug"],
    ".jade-lint.json": ["pug"],
    ".pug-lintrc.js": ["pug"],
    ".pug-lintrc.json": ["pug"],
    "biome.json": ["biome"],
    "biome.jsonc": ["biome"],
    ".python-version": ["pyenv"],
    "pyowo": ["pythowo"],
    "py.typed": ["pytyped"],
    ".pyup": ["pyup"],
    ".pyup.yml": ["pyup"],
    "q": ["q"],
    "qbs": ["qbs"],
    "qvd": ["qlikview"],
    "qvw": ["qlikview"],
    "qmldir": ["qmldir"],
    "quasar.config.js": ["quasar"],
    "quasar.conf.js": ["quasar"],
    "rake": ["rake"],
    "rakefile": ["rake"],
    "rast": ["ra_syntax_tree"],
    "rt": ["reacttemplate"],
    "reg": ["registry"],
    "rego": ["rego"],
    ".rehyperc": ["rehype"],
    ".rehypeignore": ["rehype"],
    ".remarkrc": ["remark"],
    ".remarkignore": ["remark"],
    ".renovaterc": ["renovate"],
    ".renovaterc.json": ["renovate"],
    ".replit": ["replit"],
    "replit.nix": ["replit"],
    ".retextrc": ["retext"],
    ".retextignore": ["retext"],
    "rnc": ["rnc"],
    "robots.txt": ["robots"],
    "ron": ["ron"],
    "rome.json": ["rome"],
    "rproj": ["rproj"],
    ".rspec": ["rspec"],
    ".rubocop.yml": ["rubocop"],
    ".rubocop_todo.yml": ["rubocop"],
    "rbs": ["ruby"],
    ".ruby-version": ["ruby"],
    "rust-toolchain": ["rust_toolchain"],
    "rust-toolchain.toml": ["rust_toolchain"],
    ".slshrc": ["s-lang"],
    ".isisrc": ["s-lang"],
    ".jedrc": ["s-lang"],
    ".sailsrc": ["sails"],
    "sls": ["saltstack"],
    ".sapphirerc.json": ["sapphire_framework_cli"],
    ".sapphirerc.yml": ["sapphire_framework_cli"],
    ".sapphirerc": ["sapphire_framework_cli"],
    "sass": ["sass"],
    "scssm": ["scss"],
    ".sentryclirc": ["sentry"],
    ".sequelizerc": ["sequelize"],
    "unity": ["shaderlab"],
    "fish": ["shell"],
    ".shellcheckrc": ["shellcheck"],
    "Shuttle.toml": ["shuttle"],
    "sy": ["siyuan"],
    "sketch": ["sketch"],
    "sln": [
        "sln",
        "sln2"
    ],
    "slnx": [
        "sln",
        "sln2"
    ],
    "eskip": ["skipper"],
    "snapcraft.yaml": ["snapcraft"],
    "snaplet.config.js": ["snaplet"],
    "snaplet.config.ts": ["snaplet"],
    ".snyk": ["snyk"],
    ".solidarity": ["solidarity"],
    ".solidarity.json": ["solidarity"],
    ".solidarity.yml": ["solidarity"],
    "spe": ["spacengine"],
    "spin.toml": ["spin"],
    "sqlite": ["sqlite"],
    "sqlite3": ["sqlite"],
    "db3": ["sqlite"],
    "sss": ["sss"],
    "dta": ["stata"],
    ".stylelintrc": ["stylelint"],
    ".stylelintignore": ["stylelint"],
    ".stylelintcache": ["stylelint"],
    ".stylish-haskell.yaml": ["stylish_haskell"],
    "storyboard": ["storyboard"],
    "sublime-project": ["sublime"],
    ".svnignore": ["subversion"],
    "svelte.config.js": ["svelteconfig"],
    "svg": ["svg"],
    ".swcrc": ["swc"],
    "package.pins": ["swift"],
    "symfony.lock": ["symfony"],
    "tauri.conf.json": ["tauri"],
    ".taurignore": ["tauri"],
    "templ": ["templ"],
    "tt2": ["tt"],
    "tcl": ["tcl"],
    "exp": ["tcl"],
    "tfstate": ["terraform"],
    "tfvars": ["terraform"],
    "tf": ["terraform"],
    "tf.json": ["terraform"],
    "tm": ["tm"],
    "tm.hcl": ["tm"],
    "tst": ["test"],
    ".testcaferc.json": ["testcafe"],
    "texi": ["tex"],
    "tikz": ["tex"],
    "csv": ["text"],
    "tsv": ["text"],
    ".tiltignore": ["tiltfile"],
    ".tfignore": ["tfs"],
    ".tmux.conf": ["tmux"],
    "todo": ["todo"],
    "tox.ini": ["tox"],
    ".travis.yml": ["travis"],
    "tree": ["tree"],
    "tres": ["tres"],
    "trunk.yaml": ["trunk"],
    "tsbuildinfo": ["tsbuildinfo"],
    "tscn": ["tscn"],
    "tslint.json": ["tslint"],
    "tslint.yaml": ["tslint"],
    "tslint.yml": ["tslint"],
    ".ts": ["typescript"],
    "d.ts": [
        "typescriptdef",
        "typescriptdef_official"
    ],
    "d.cts": [
        "typescriptdef",
        "typescriptdef_official"
    ],
    "d.mts": [
        "typescriptdef",
        "typescriptdef_official"
    ],
    "ua": ["uiua"],
    ".unibeautifyrc": ["unibeautify"],
    "unibeautify.config.js": ["unibeautify"],
    "u": ["unison"],
    "unlicense": ["unlicense"],
    "unlicence": ["unlicense"],
    "vagrantfile": ["vagrant"],
    "vala": ["vala"],
    "css.ts": ["vanilla_extract"],
    "vapi": ["vapi"],
    "vash": ["vash"],
    "vapor.yml": ["vapor"],
    "vbhtml": ["vbhtml"],
    "vbproj": ["vbproj"],
    "vcxproj": ["vcxproj"],
    "vto": ["vento"],
    "vento": ["vento"],
    "3g2": ["video"],
    "3gp": ["video"],
    "asf": ["video"],
    "amv": ["video"],
    "avi": ["video"],
    "divx": ["video"],
    "qt": ["video"],
    "f4a": ["video"],
    "f4b": ["video"],
    "f4p": ["video"],
    "f4v": ["video"],
    "flv": ["video"],
    "m2v": ["video"],
    "m4v": ["video"],
    "mkv": ["video"],
    "mk3d": ["video"],
    "mov": ["video"],
    "mp2": ["video"],
    "mp4": ["video"],
    "mpe": ["video"],
    "mpeg": ["video"],
    "mpeg2": ["video"],
    "mpg": ["video"],
    "mpv": ["video"],
    "nsv": ["video"],
    "ogv": ["video"],
    "rm": ["video"],
    "rmvb": ["video"],
    "svi": ["video"],
    "vob": ["video"],
    "webm": ["video"],
    "wmv": ["video"],
    ".vimrc": ["vim"],
    ".gvimrc": ["vim"],
    ".vscodeignore": [
        "vscode",
        "vscode2",
        "vscode3",
        "vscode-insiders"
    ],
    "code-snippets": [
        "vscode",
        "vscode2",
        "vscode3",
        "vscode-insiders"
    ],
    "code-workspace": [
        "vscode",
        "vscode2",
        "vscode3",
        "vscode-insiders"
    ],
    "vsix": ["vsix"],
    "vsixmanifest": ["vsixmanifest"],
    ".vuerc": ["vueconfig"],
    "vue.config.js": ["vueconfig"],
    "vue.config.cjs": ["vueconfig"],
    "vue.config.mjs": ["vueconfig"],
    "wally.toml": ["wally"],
    "wally.lock": ["wally"],
    ".watchmanconfig": ["watchmanconfig"],
    "wasm": ["wasm"],
    "wercker.yml": ["wercker"],
    "wikitext": ["wikitext"],
    "windi.config.ts": ["windi"],
    "windi.config.js": ["windi"],
    "wit": ["wit"],
    "doc": [
        "word",
        "word2"
    ],
    "docx": [
        "word",
        "word2"
    ],
    "docm": [
        "word",
        "word2"
    ],
    "dot": [
        "word",
        "word2"
    ],
    "dotx": [
        "word",
        "word2"
    ],
    "dotm": [
        "word",
        "word2"
    ],
    "wll": [
        "word",
        "word2"
    ],
    "wpml-config.xml": ["wpml"],
    "wxml": ["wxml"],
    "wxss": ["wxss"],
    "wxt.config.ts": ["wxt"],
    "xcodeproj": ["xcode"],
    "xml": ["xml"],
    "xfl": ["xfl"],
    "xib": ["xib"],
    "xliff": ["xliff"],
    "xlf": ["xliff"],
    "pex": ["xml"],
    "tmlanguage": ["xml"],
    ".xo-config": ["xo"],
    ".xcompose": ["xorg"],
    "yaml": ["yaml"],
    "yml": ["yaml"],
    ".yamllint": ["yamllint"],
    ".yaspellerrc": ["yandex"],
    ".yaspeller.json": ["yandex"],
    "yarn.lock": ["yarn"],
    ".yarnrc": ["yarn"],
    ".yarnrc.yml": ["yarn"],
    ".yarnclean": ["yarn"],
    ".yarn-integrity": ["yarn"],
    ".yarn-metadata.json": ["yarn"],
    ".yarnignore": ["yarn"],
    ".yo-rc.json": ["yeoman"],
    "now.json": ["vercel"],
    ".nowignore": ["vercel"],
    "vercel.json": ["vercel"],
    ".vercelignore": ["vercel"],
    "turbo.json": ["turbo"],
    "doppler.yaml": ["doppler"],
    "doppler-template.yaml": ["doppler"],
    "zip": [
        "zip",
        "zip2"
    ],
    "rar": [
        "zip",
        "zip2"
    ],
    "7z": [
        "zip",
        "zip2"
    ],
    "tar": [
        "zip",
        "zip2"
    ],
    "tgz": [
        "zip",
        "zip2"
    ],
    "bz": [
        "zip",
        "zip2"
    ],
    "gz": [
        "zip",
        "zip2"
    ],
    "bzip2": [
        "zip",
        "zip2"
    ],
    "xz": [
        "zip",
        "zip2"
    ],
    "bz2": [
        "zip",
        "zip2"
    ],
    "whl": [
        "zip",
        "zip2"
    ],
    "zipx": [
        "zip",
        "zip2"
    ],
    "br": [
        "zip",
        "zip2"
    ],
    "knip.json": ["knip"],
    "knip.jsonc": ["knip"],
    ".knip.json": ["knip"],
    ".knip.jsonc": ["knip"],
    "knip.ts": ["knip"],
    "knip.js": ["knip"],
    "knip.config.ts": ["knip"],
    "knip.config.js": ["knip"]
}

// Kuhni Labs - zen.js v2.1 (alpha) July 2020
// Main Developer: Alan Badillo Salas @dragonnomada

async function get(url, params = {}) {
    const query = Object.entries(params || {}).map(([key, value]) => `${key}=${value}`).join("&");

    const response = await fetch(`${url}${query ? `?${query}` : ""}`);

    if (!response.ok) {
        const error = await response.text();
        console.log("get error", error);
        throw new Error(error);
    }

    return await response.text();
}

async function getLocal(url, params = {}) {
    return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open('GET', `file:///android_asset/www${url}`);

        xhr.onload = async () => {
            if (xhr.status == 200) {
                resolve(xhr.response);
            }
            const html = await get(url).catch(error => reject(error));

            resolve(html);
        };

        xhr.send();
    });
    // const query = Object.entries(params || {}).map(([key, value]) => `${key}=${value}`).join("&");

    // console.log(cordovaFetch, url);

    // const response = await fetch(`file:///android_asset/www${url}`);

    // console.log(response);

    // // if (!response.ok) {
    // //     const error = await response.text();
    // //     throw new Error(error);
    // // }

    // return await response.text();
}

async function post(url, body = {}) {
    const response = await fetch(url, {
        method: "post",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {})
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
    }

    return await response.json();
}

function getFormData(form) {
    const formData = new FormData(form);
    const keys = [...formData.keys()];
    const values = [...formData.values()];
    const data = keys.reduce((data, key, index) => ({ ...data, [key]: values[index] }), {});
    return data;
}

async function postForm(url, form) {
    return await post(url, getFormData(form));

    // const response = await fetch(url, {
    //     method: "post",
    //     headers: { "content-type": "application/x-www-form-urlencoded" },
    //     body: 
    // });

    // if (!response.ok) {
    //     const error = await response.text();
    //     throw new Error(error);
    // }

    // return await response.json();
}

async function api(url, protocol = {}, baseUrl = "api") {
    if (!(/^http/.test(url))) url = `/${baseUrl}/${url.replace(/^\//, "")}`;

    const { error, result } = await post(url, protocol).catch(error => ({ error }));

    if (error) throw new Error(error);

    return result;
}

const cache = {};

function inlineHTML(html, protocol = {}) {
    const temporal = document.createElement("div");

    html = (
        html.replace(/<script>/g, w => {
            return `${w}\n(async params => {\n`;
        }).replace(/<\/script>/g, w => {
            return `\n})(parent.protocol)\n${w}`;
        })
    );

    temporal.innerHTML = `
        <template>
            ${html}
            <script>
                (() => {})()
            </script>
        </template>
    `;
    const template = temporal.querySelector("template");
    // document.body.append(temporal);
    document.body.append(template);
    const container = document.importNode(template.content, true);
    const parent = container.firstElementChild;

    const scripts = [];

    for (let script of [...container.querySelectorAll("script")]) {
        scripts.push(script);
    }

    parent.protocol = protocol;

    (async () => {
        for (let script of scripts) {
            if (script.src) {
                window._scripts = window._scripts || {};
                if (window._scripts[script.src]) continue;
                const _script = document.createElement("script");
                window._scripts[script.src].push(_script);
                await new Promise(resolve => {
                    _script.onload = () => {
                        resolve();
                    }
                    _script.src = script.src;
                });
                continue;
            }
        }
        for (let script of scripts) {
            if (script.src) continue;

            await new Function(
                "document",
                "parent",
                `return (async (
                    select, 
                    selectAll,
                    selectRef,
                    selectId,
                ) => {
                    try {
                        await ${(script.textContent || "(() => null)()").replace(/document\.currentScript\.parentElement/g, "parent")};
                    } catch (error) {
                        console.warn("Error on script", \`\${error}\`);
                        console.warn(":>", \`${script.textContent.replace(/\`/g, "~")}\`);
                    }
                })(
                    query => selector(parent, query),
                    query => selectorAll(parent, query),
                    name => selector(parent, \`[data-ref=\${name}]\`),
                    id => selector(parent, \`#\${id}\`),
                );`
            )(
                document,
                parent
            );
        }
        parent.dispatchEvent(new CustomEvent("ready"));
    })();


    return parent;
}

async function loadComponentLocal(url, protocol = {}) {
    let html = cache[url];

    if (!cache[url]) {
        html = await get(url);
        cache[url] = html;
    }

    html = await getLocal(url);

    console.log("html", html);

    const parent = inlineHTML(html, protocol);

    await new Promise(resolve => {
        parent.addEventListener("ready", () => {
            resolve();
        });
    });

    return parent;
}

async function loadComponent(url, protocol = {}) {
    // let html = cache[url];

    // if (!cache[url]) {
    //     html = await get(url);
    //     cache[url] = html;
    // }

    const html = await get(url);

    console.log("html", html);

    const parent = inlineHTML(html, protocol);

    await new Promise(resolve => {
        parent.addEventListener("ready", () => {
            resolve();
        });
    });

    return parent;
}

async function loadHTML(url, protocol = {}) {
    return await loadComponent(`${url.replace(/\.html$/, "")}.html`, protocol);
}

function mount(container, node) {
    container.append(node);
    node.dispatchEvent(new CustomEvent("mounted"));
}

function unmount(container, node) {
    container.append(node);
    // node.dispatchEvent(new CustomEvent("unmounted"));
}

function refs(node) {
    return [...node.querySelectorAll("*")].reduce((refs, tag) => ({
        ...refs,
        ...(tag.dataset.ref ? {
            [tag.dataset.ref.replace(
                /-\w+/g,
                w => `${w[1].toUpperCase()}${w.slice(2)}`
            )]: tag
        } : {})
    }), {});
}

function ids(node) {
    return [...node.querySelectorAll("*")].reduce((ids, tag) => ({
        ...ids,
        ...(tag.id ? {
            [tag.id.replace(
                /-\w+/g,
                w => `${w[1].toUpperCase()}${w.slice(2)}`
            )]: tag
        } : {})
    }), {});
}

function selector(node, query) {
    return node.querySelector(query);
}

function selectorAll(node, query) {
    return [...node.querySelectorAll(query)];
}

function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
}

function select(query) {
    return selector(document, query);
}

function selectAll(query) {
    return selectorAll(document, query);
}

function selectRef(name) {
    return selector(document, `[data-ref=${name}]`);
}

function selectId(id) {
    return selector(document, `#${id}`);
}

async function execNode(node, type, name, attribute, context, inc, dec) {
    inc();
    if (name === "text") name = "textContent";
    if (name === "html") name = "innerHTML";
    if (name === "class") name = "className";
    context = {
        ...context,
        self: node,
        // root,
        node,
        parent: node.parent,
        parentElement: node.parentElement,
        attribute,
        attributeName: name,
    };
    try {
        const result = await new Function(
            "context",
            ...Object.keys(context),
            `return (${attribute.value});`
        )(
            context,
            ...Object.values(context)
        );
        console.log(`zen.js :result ${type}${name}`, result);
        if (type === "$") node[name] = result;
        if (type === "^") node.parentElement[name] = result;
    } catch (error) {
        console.warn(`zen.js :error ${type}${name}`, `${error}`);
    }
    // node.removeAttribute(":value");

    dec();
}

function procNode(node, context, inc, dec) {
    for (let attribute of [...node.attributes]) {
        if (attribute.name.match(/^@.+/)) {
            const name = attribute.name.match(/^@(.+)/)[1].replace(/-[a-z]/g, w => `${w.slice(1).toUpperCase()}${w.slice(2)}`);
            let eventName = name;
            if (name === "form") {
                eventName = "submit";
                node[`_@${eventName}/handler`] = async context => {
                    context.event.preventDefault();
                    context.formData = getFormData(node);
                }
            }
            if (!eventName) continue;
            console.log(`zen.js :evt @${eventName}`, attribute.value, context);
            if (node[`_@${eventName}`]) {
                console.warn("!!! remove", eventName);
                node.removeEventListener(name, node[`_@${eventName}`]);
                console.log("remove", eventName);
            }
            console.warn("!!! add", eventName);
            node.removeAttribute(attribute.name);
            node[`_@${eventName}`] = async event => {
                context = {
                    ...context,
                    self: node,
                    // root,
                    node,
                    parent: node.parent,
                    parentElement: node.parentElement,
                    event,
                    name,
                    eventName,
                    attribute,
                    isCancel: false,
                    cancel() {
                        this.isCancel = true;
                    },
                    formData: {},
                    async formReset() {
                        let target = node;
                        if (target.tagName !== "FORM") {
                            target = selector(target, "form");
                            if (!target) {
                                target = node;
                                while (target !== document.body && target.tagName !== "FORM") target = target.parentElement;
                            }
                        }
                        if (target.tagName !== "FORM") return;
                        target.reset();
                        const formData = getFormData(target);
                        await setContext({
                            formData
                        });
                    }
                };

                if (node[`_@${eventName}/handler`]) await node[`_@${eventName}/handler`](context);

                if (context.isCancel) return;

                try {
                    new Function(
                        "context",
                        ...Object.keys(context),
                        `return (${attribute.value});`
                    )(
                        context,
                        ...Object.values(context)
                    );
                } catch (error) {
                    console.warn(`zen.js :error @${eventName}`, `${error}`);
                }
            };

            node.addEventListener(eventName, node[`_@${eventName}`]);
        }
    }
    for (let attribute of [...node.attributes]) {
        if (attribute.name.match(/^[\$\^].+/)) {
            const [type, key] = attribute.name.match(/^([\$\^])(.+)/).slice(1);
            const name = key.replace(/-[a-z]/g, w => `${w.slice(1).toUpperCase()}${w.slice(2)}`);
            console.log(`zen.js :proc ${type}${name}`, attribute.value, context);
            execNode(node, type, name, attribute, context, inc, dec);
        }
    }
    // for (let attribute of [...node.attributes]) {
    //     if (attribute.name.match(/^\$.+/)) {
    //         const name = attribute.name.match(/^\$(.+)/)[1].replace(/-[a-z]/g, w => `${w.slice(1).toUpperCase()}${w.slice(2)}`);
    //         console.log(`zen.js :proc $${name}`, attribute.value, context);
    //         execNode(node, name, attribute, context, inc, dec);
    //     }
    // }
    // for (let attribute of [...node.attributes]) {
    //     if (attribute.name.match(/^\^.+/)) {
    //         const name = attribute.name.match(/^\^(.+)/)[1].replace(/-[a-z]/g, w => `${w.slice(1).toUpperCase()}${w.slice(2)}`);
    //         console.log(`zen.js :proc ^${name}`, attribute.value, context);
    //         execNode(node, name, attribute, context, inc, dec);
    //     }
    // }
}

function renderContext(root, context, inc, dec) {
    if (root._processed) return;

    context = {
        ...window._context,
        ...context
    };

    for (let element of selectorAll(root, `[data-for]`)) {
        if (element.dataset.for) {
            element.remove();
        }
    }

    console.log(":root", root);

    for (let node of selectorAll(root, "*")) {
        node._processed = false;
    }

    procNode(root, context, inc, dec);

    for (let node of selectorAll(root, "*")) {
        if (node._processed) continue;
        node._processed = true;
        if (node.attributes[":if"]) {
            console.log(":if", node.attributes[":if"].value);
            for (let child of selectorAll(node, "*")) {
                child._processed = true;
            }
            node.hidden = true;
            (async () => {
                inc();
                let result = null;

                try {
                    result = await new Function(
                        "context",
                        ...Object.keys(context),
                        `return (${node.attributes[":if"].value}); `
                    )(
                        context,
                        ...Object.values(context)
                    );
                } catch (error) {
                    console.warn(":error", `${error}`);
                }

                console.log(":if result", result);

                if (result) {
                    node.hidden = false;
                    node._processed = false;
                    for (let child of selectorAll(node, "*")) {
                        child._processed = false;
                    }
                    renderContext(
                        node,
                        {
                            ...context,
                        },
                        inc,
                        dec
                    )
                }

                dec();
            })();
            continue;
        }
        if (node.attributes[":for"]) {
            console.log(":for", node.attributes[":for"].value);
            node.hidden = true;
            for (let child of selectorAll(node, "*")) {
                child._processed = true;
            }
            (async () => {
                inc();

                let items = null;

                try {
                    items = await new Function(
                        "context",
                        ...Object.keys(context),
                        `return (${node.attributes[":for"].value}); `
                    )(
                        context,
                        ...Object.values(context)
                    );
                } catch (error) {
                    console.warn(":error", `${error}`);
                }

                console.log(":for items", items);

                let lastElement = node;

                let index = 0;
                for (let item of (items || [])) {
                    const clone = node.cloneNode(true);

                    clone.removeAttribute(":for");

                    clone.dataset.for = "true";

                    clone.hidden = false;

                    lastElement.insertAdjacentElement("afterend", clone);

                    lastElement = clone;

                    renderContext(
                        clone,
                        {
                            ...context,
                            [(node.attributes[":each"] || {}).value || "item"]: item,
                            item,
                            index,
                        },
                        inc,
                        dec
                    )

                    ++index;
                }
                dec();
            })();
            continue;
        }
        procNode(node, context, inc, dec);
    }
}

async function getContext() {
    window._context = {
        ...window._context,
        ...JSON.parse(localStorage.getItem("context") || "{}"),
    };
    return window._context;
}

async function setContext(context = {}) {
    window._context = window._context || {};

    window._context = {
        ...JSON.parse(localStorage.getItem("context") || "{}"),
        ...window._context,
        ...context
    };

    localStorage.setItem("context", JSON.stringify(window._context));

    let pic = 0;

    document.body._processed = false;

    renderContext(
        document.body,
        window._context,
        () => ++pic,
        () => --pic,
    );

    let iter = 0;

    while (iter <= 1000 && pic > 0) {
        console.warn("pic", pic);
        await new Promise(resolve => setTimeout(resolve, 20));
        ++iter;
    }

    if (iter >= 1000) {
        throw new Error("Set context error");
    }

    console.warn("pic", pic);
}

function handle(key, callback) {
    window._context = window._context || {};
    window._context[key] = callback;
}

function dispatcher(node, name, payload = {}) {
    console.log("zen.js dispatcher", node, name, payload);
    node.dispatchEvent(new CustomEvent(name, { detail: payload }));
}

function listener(node, name, callback) {
    const handler = event => {
        callback(event.detail || event, event);
    };
    node.addEventListener(name, handler);
    return () => {
        node.removeEventListener(name, handler);
    };
}

function dispatch(name, payload = {}) {
    dispatcher(document, name, payload);
}

function listen(name, callback) {
    return listener(document, name, callback);
}

async function startRouter(container) {
    const style = document.createElement("style");

    style.textContent = `
        @keyframes fade-in {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }
        
        @keyframes fade-out {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }
        
        .fade-in {
            animation: fade-in 600ms;
        }

        .fade-out {
            animation: fade-out 600ms;
        }

        [hidden] {
            display: none !important;
        }
    `;

    document.head.append(style);

    const mainContainer = document.createElement("div");

    (container || document.body).append(mainContainer);

    let view = null;

    async function loadPage() {
        // alert("hi");
        const hash = window.location.hash || "#page=home";

        console.log(hash);

        if (!/page=([\w-]+)/.test(hash)) return;

        // screenLock();

        const page = hash.slice(1).match(/page=([\w-]+)/)[1];

        console.log("page", page);

        if (view) {
            const cancelCode = Math.random().toString(32).slice(2);

            const cancel = () => cancelCode;

            let resultCode = null;

            if (view.unmount) resultCode = await view.unmount({ cancel });

            if (resultCode === cancelCode) {
                dispatch("page-cancel");
                return;
            }

            view.classList.add("fade-out");

            await new Promise(resolve => setTimeout(resolve, 300));

            view.hidden = true;

            view.remove();
        }

        clear(mainContainer);

        view = await loadHTML(page);

        view.hidden = true;

        mainContainer.append(view);

        const context = await getContext();

        await setContext({
            pageBack: `#page=${context.page || "home"}`,
            page
        });

        const cancelCode = Math.random().toString(32).slice(2);

        const cancel = () => cancelCode;

        let resultCode = null;

        if (view.mount) resultCode = await view.mount({ cancel });

        if (resultCode !== cancelCode) {
            view.classList.add("fade-in");

            await new Promise(resolve => setTimeout(resolve, 300));

            view.hidden = false;
        }

        // listener(view, "ready", async () => {
        //     // initialize
        // });
    }

    window.addEventListener("hashchange", async () => {
        await loadPage();
    });

    // await new Promise(resolve => setTimeout(resolve, 500));

    await loadPage();
}
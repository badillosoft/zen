// Kuhni Labs - zen.js v2.0 (alpha) July 2020
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

function procNode(node, context, inc, dec) {
    for (let attribute of [...node.attributes]) {
        if (attribute.name.match(/^@.+/)) {
            const name = attribute.name.match(/^@(.+)/)[1].replace(/-[a-z]/g, w => `${w.slice(1).toUpperCase()}${w.slice(2)}`);
            console.log(`zen.js :evt @${name}`, attribute.value, context);
            if (node[`_@${name}`]) node.removeEventListener(name, node[`_@${name}`]);
            node[`_@${name}`] = event => {
                context = {
                    ...context,
                    context,
                    self: node,
                    // root,
                    node,
                    parent: node.parent,
                    parentElement: node.parentElement,
                    event,
                    eventName: name,
                    attribute
                };
                try {
                    new Function(
                        ...Object.keys(context),
                        `return (${attribute.value});`
                    )(
                        ...Object.values(context)
                    );
                } catch (error) {
                    console.warn(`zen.js :error @${name}`, `${error}`);
                }
            };
            node.addEventListener(name, node[`_@${name}`]);
        }
    }
    for (let attribute of [...node.attributes]) {
        if (attribute.name.match(/^\$.+/)) {
            let name = attribute.name.match(/^\$(.+)/)[1].replace(/-[a-z]/g, w => `${w.slice(1).toUpperCase()}${w.slice(2)}`);
            if (name === "text") name = "textContent";
            if (name === "html") name = "innerHTML";
            console.log(`zen.js :cap $${name}`, attribute.value, context);
            (async () => {
                inc();
                context = {
                    ...context,
                    context,
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
                        ...Object.keys(context),
                        `return (${attribute.value});`
                    )(
                        ...Object.values(context)
                    );
                    console.log(`zen.js :result $${name}`, result);
                    node[name] = result;
                } catch (error) {
                    console.warn(`zen.js :error $${name}`, `${error}`);
                }
                // node.removeAttribute(":value");

                dec();
            })();
        }
    }
    for (let attribute of [...node.attributes]) {
        if (attribute.name.match(/^\^.+/)) {
            let name = attribute.name.match(/^\^(.+)/)[1].replace(/-[a-z]/g, w => `${w.slice(1).toUpperCase()}${w.slice(2)}`);
            if (name === "text") name = "textContent";
            if (name === "html") name = "innerHTML";
            console.log(`zen.js :cap ^${name}`, attribute.value, context);
            (async () => {
                inc();
                context = {
                    ...context,
                    context,
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
                        ...Object.keys(context),
                        `return (${attribute.value});`
                    )(
                        ...Object.values(context)
                    );
                    console.log(`zen.js :result ^${name}`, result);
                    node.parentElement[name] = result;
                } catch (error) {
                    console.warn(`zen.js :error ^${name}`, `${error}`);
                }
                // node.removeAttribute(":value");

                dec();
            })();
        }
    }
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
            // node._flex = node._flex || node.classList.contains("d-flex");
            // node.classList.remove("d-block");
            // node.classList.remove("d-flex");
            // node.classList.add("d-none");
            (async () => {
                inc();
                let result = null;

                try {
                    result = await new Function(
                        ...Object.keys(context),
                        `return (${node.attributes[":if"].value}); `
                    )(
                        ...Object.values(context)
                    );
                } catch (error) {
                    console.warn(":error", `${error}`);
                }

                console.log(":if result", result);

                if (result) {
                    // node.classList.remove("d-none");
                    // if (node._flex) node.classList.add("d-flex");
                    // else node.classList.add("d-block")
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
                        ...Object.keys(context),
                        `return (${node.attributes[":for"].value}); `
                    )(
                        ...Object.values(context)
                    );
                } catch (error) {
                    console.warn(":error", `${error}`);
                }

                console.log(":for items", items);

                // for (let element of selectorAll(node.parentElement, `[data -for]`)) {
                //     if (element.dataset.for) {
                //         element.remove();
                //     }
                // }

                let lastElement = node;

                let index = 0;
                for (let item of (items || [])) {
                    const clone = node.cloneNode(true);

                    clone.removeAttribute(":for");

                    clone.dataset.for = "true";

                    clone.hidden = false;

                    lastElement.insertAdjacentElement("afterend", clone);

                    lastElement = clone;

                    // node.parentElement.append(clone);

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

                // $(".background").each(function () {
                //     const imgpath = $(this).find('img');
                //     $(this).css('background-image', 'url(' + imgpath.attr('src') + ')');
                //     imgpath.hide();
                // });

                dec();
            })();
            continue;
        }
        procNode(node, context, inc, dec);
        // if (node.attributes[":uncheck"]) {
        //     console.log(":uncheck", node.attributes[":uncheck"].value, context);
        //     if (node._bindUncheck) node.removeEventListener("change", node._bindUncheck);
        //     node._bindUncheck = event => {
        //         console.log("UNCHECK", event.target);
        //         if (event.target.checked) return;
        //         context.event = event;
        //         context.self = node;
        //         context.root = root;
        //         context.context = context;
        //         try {
        //             new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":uncheck"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //     };
        //     node.addEventListener("change", node._bindUncheck);
        // }
        // if (node.attributes[":check"]) {
        //     console.log(":check", node.attributes[":check"].value, context);
        //     if (node._bindCheck) node.removeEventListener("change", node._bindCheck);
        //     node._bindCheck = event => {
        //         console.log("CHECK", event.target);
        //         if (!event.target.checked) return;
        //         context.event = event;
        //         context.self = node;
        //         context.root = root;
        //         context.context = context;
        //         try {
        //             new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":check"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //     };
        //     node.addEventListener("change", node._bindCheck);
        // }
        // if (node.attributes[":submit"]) {
        //     console.log(":submit", node.attributes[":submit"].value, context);
        //     if (node._bindSubmit) node.removeEventListener("submit", node._bindSubmit);
        //     node._bindSubmit = event => {
        //         event.preventDefault();
        //         context.event = event;
        //         context.self = node;
        //         context.root = root;
        //         context.context = context;
        //         context.formData = getFormData(node);
        //         try {
        //             new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":submit"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //     };
        //     node.addEventListener("submit", node._bindSubmit);
        // }
        // if (node.attributes[":change"]) {
        //     console.log(":change", node.attributes[":change"].value, context);
        //     if (node._bindChange) node.removeEventListener("change", node._bindChange);
        //     node._bindChange = event => {
        //         context.event = event;
        //         context.self = node;
        //         context.root = root;
        //         context.context = context;
        //         try {
        //             new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":change"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //     };
        //     node.addEventListener("change", node._bindChange);
        // }
        // if (node.attributes[":keydown"]) {
        //     console.log(":keydown", node.attributes[":keydown"].value, context);
        //     if (node._bindKeydown) node.removeEventListener("keydown", node._bindKeydown);
        //     node._bindKeydown = event => {
        //         context.event = event;
        //         context.self = node;
        //         context.root = root;
        //         context.context = context;
        //         try {
        //             new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":keydown"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //     };
        //     node.addEventListener("keydown", node._bindKeydown);
        // }
        // if (node.attributes[":click"]) {
        //     console.log(":click", node.attributes[":click"].value, context);
        //     if (node._bindClick) node.removeEventListener("click", node._bindClick);
        //     node._bindClick = event => {
        //         context.event = event;
        //         context.self = node;
        //         context.root = root;
        //         context.context = context;
        //         try {
        //             new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":click"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //     };
        //     node.addEventListener("click", node._bindClick);
        // }
        // if (node.attributes[":checked"]) {
        //     console.log(":checked", node.attributes[":checked"].value, context);
        //     (async () => {
        //         inc();
        //         context = { ...context, context };
        //         try {
        //             const result = await new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":checked"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //             console.log(":checked result", result);
        //             node.checked = !!result;
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //         // node.removeAttribute(":value");

        //         dec();
        //     })();
        // }
        // if (node.attributes[":href"]) {
        //     console.log(":href", node.attributes[":href"].value, context);
        //     (async () => {
        //         inc();
        //         context = { ...context, context };
        //         try {
        //             const result = await new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":href"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //             console.log(":href result", result);
        //             node.href = result;
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //         // node.removeAttribute(":value");

        //         dec();
        //     })();
        // }
        // if (node.attributes[":id"]) {
        //     console.log(":id", node.attributes[":id"].value, context);
        //     (async () => {
        //         inc();
        //         context = { ...context, context };
        //         try {
        //             const result = await new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":id"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //             console.log(":id result", result);
        //             node.id = result;
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //         // node.removeAttribute(":value");

        //         dec();
        //     })();
        // }
        // if (node.attributes[":disabled"]) {
        //     console.log(":disabled", node.attributes[":disabled"].value, context);
        //     (async () => {
        //         inc();
        //         context = { ...context, context };
        //         try {
        //             const result = await new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":disabled"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //             console.log(":disabled result", result);
        //             node.disabled = !!result;
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //         // node.removeAttribute(":value");

        //         dec();
        //     })();
        // }
        // if (node.attributes[":target"]) {
        //     console.log(":target", node.attributes[":target"].value, context);
        //     (async () => {
        //         inc();
        //         context = { ...context, context };
        //         try {
        //             const result = await new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":target"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //             console.log(":target result", result);
        //             node.htmlFor = result;
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //         // node.removeAttribute(":value");

        //         dec();
        //     })();
        // }
        // if (node.attributes[":name"]) {
        //     console.log(":name", node.attributes[":name"].value, context);
        //     (async () => {
        //         inc();
        //         context = { ...context, context };
        //         try {
        //             const result = await new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":name"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //             console.log(":name result", result);
        //             node.name = result;
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //         // node.removeAttribute(":value");

        //         dec();
        //     })();
        // }
        // if (node.attributes[":value"]) {
        //     console.log(":value", node.attributes[":value"].value, context);
        //     (async () => {
        //         inc();
        //         context = { ...context, context };
        //         try {
        //             const result = await new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":value"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //             console.log(":value result", result);
        //             node.value = result;
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }
        //         // node.removeAttribute(":value");

        //         dec();
        //     })();
        // }
        // if (node.attributes[":src"]) {
        //     console.log(":src", node.attributes[":src"].value, context);
        //     (async () => {
        //         inc();

        //         try {
        //             const result = await new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":src"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //             console.log(":src result", result);
        //             node.src = result;
        //             // if (node.parentElement.classList.contains("background")) {
        //             //     $(node.parentElement).each(function () {
        //             //         const imgpath = $(node.parentElement).find('img');
        //             //         $(this).css('background-image', 'url(' + imgpath.attr('src') + ')');
        //             //         imgpath.hide();
        //             //     });
        //             // }
        //             $(".background").each(function () {
        //                 const imgpath = $(this).find('img');
        //                 $(this).css('background-image', 'url(' + imgpath.attr('src') + ')');
        //                 imgpath.hide();
        //             });
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }

        //         // if (root.dataset.for) {
        //         //     node.removeAttribute(":src");
        //         // }

        //         dec();
        //     })();
        // }
        // if (node.attributes[":class"]) {
        //     console.log(":class", node.attributes[":class"].value);
        //     node._defaultClassName = node._defaultClassName || node.className;
        //     (async () => {
        //         inc();

        //         try {
        //             const result = await new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":class"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //             node.className = `${node._defaultClassName} ${result || ""}`;
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }

        //         // node.removeAttribute(":class");

        //         dec();
        //     })();
        // }
        // if (node.attributes[":text"]) {
        //     console.log(":text", node.attributes[":text"].value);
        //     (async () => {
        //         inc();

        //         try {
        //             const result = await new Function(
        //                 ...Object.keys(context),
        //                 `return (${node.attributes[":text"].value});`
        //             )(
        //                 ...Object.values(context)
        //             );
        //             node.textContent = result;
        //         } catch (error) {
        //             console.warn(":error", `${error}`);
        //         }

        //         // node.removeAttribute(":text");

        //         dec();
        //     })();
        // }
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

async function startRouter() {
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
            animation: fade-in 800ms;
        }

        .fade-out {
            animation: fade-out 800ms;
        }

        [hidden] {
            display: none !important;
        }
    `;

    document.head.append(style);

    const mainContainer = document.createElement("div");

    document.body.append(mainContainer);

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

            await new Promise(resolve => setTimeout(resolve, 600));

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

            await new Promise(resolve => setTimeout(resolve, 600));

            view.hidden = false;
        }

        // listener(view, "ready", async () => {
        // initialize
        // });
    }

    window.addEventListener("hashchange", async () => {
        await loadPage();
    });

    // await new Promise(resolve => setTimeout(resolve, 500));

    await loadPage();
}
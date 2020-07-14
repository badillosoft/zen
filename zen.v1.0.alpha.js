// Kuhni Labs - zen.js v1.0 (alpha) July 2020
// Main Developer: Alan Badillo Salas @dragonnomada

async function get(url, params = {}) {
    const query = Object.entries(params || {}).map(([key, value]) => `${key}=${value}`).join("&");

    const response = await fetch(`${url}${query ? `?${query}` : ""}`);

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
    }

    return await response.text();
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

async function api(url, protocol = {}, baseUrl = "api") {
    if (!(/^http/.test(url))) url = `/${baseUrl}/${url.replace(/^\//, "")}`;

    const { error, result } = await post(url, protocol).catch(error => ({ error }));

    if (error) throw new Error(error);

    return result;
}

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
                        await ${(script.textContent).replace(/document\.currentScript\.parentElement/g, "parent")};
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

async function loadComponent(url, protocol = {}) {
    window._cache = window._cache || {};

    let html = window._cache[url];

    if (!window._cache[url]) {
        html = await get(url);
        window._cache[url] = html;
    }

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
    while (node.firstElementChild) node.removeChild(firstElementChild);
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

function renderContext(root, context, inc, dec) {
    if (root._processed) return;

    for (let element of selectorAll(root, `[data-for]`)) {
        if (element.dataset.for) {
            element.remove();
        }
    }

    console.log(":root", root);

    for (let node of selectorAll(root, "*")) {
        node._processed = false;
    }

    for (let node of selectorAll(root, "*")) {
        if (node._processed) continue;
        node._processed = true;
        if (node.attributes[":click"]) {
            console.log(":click", node.attributes[":click"].value, context);
            node.addEventListener("click", event => {
                context.event = event;
                try {
                    new Function(
                        ...Object.keys(context),
                        `return (${node.attributes[":click"].value});`
                    )(
                        ...Object.values(context)
                    );
                } catch (error) {
                    console.warn(":error", `${error}`);
                }
            });
        }
        if (node.attributes[":value"]) {
            console.log(":value", node.attributes[":value"].value, context);
            (async () => {
                inc();
                try {
                    const result = await new Function(
                        ...Object.keys(context),
                        `return (${node.attributes[":value"].value});`
                    )(
                        ...Object.values(context)
                    );
                    console.log(":value result", result);
                    node.value = result;
                } catch (error) {
                    console.warn(":error", `${error}`);
                }
                // node.removeAttribute(":value");

                dec();
            })();
        }
        if (node.attributes[":src"]) {
            console.log(":src", node.attributes[":src"].value, context);
            (async () => {
                inc();

                try {
                    const result = await new Function(
                        ...Object.keys(context),
                        `return (${node.attributes[":src"].value});`
                    )(
                        ...Object.values(context)
                    );
                    console.log(":src result", result);
                    node.src = result;
                    // if (node.parentElement.classList.contains("background")) {
                    //     $(node.parentElement).each(function () {
                    //         const imgpath = $(node.parentElement).find('img');
                    //         $(this).css('background-image', 'url(' + imgpath.attr('src') + ')');
                    //         imgpath.hide();
                    //     });
                    // }
                    $(".background").each(function () {
                        const imgpath = $(this).find('img');
                        $(this).css('background-image', 'url(' + imgpath.attr('src') + ')');
                        imgpath.hide();
                    });
                } catch (error) {
                    console.warn(":error", `${error}`);
                }

                // if (root.dataset.for) {
                //     node.removeAttribute(":src");
                // }

                dec();
            })();
        }
        if (node.attributes[":class"]) {
            console.log(":class", node.attributes[":class"].value);
            node._defaultClassName = node._defaultClassName || node.className;
            (async () => {
                inc();

                const result = await new Function(
                    ...Object.keys(context),
                    `return (${node.attributes[":class"].value});`
                )(
                    ...Object.values(context)
                );
                node.className = `${node._defaultClassName} ${result || ""}`;

                // node.removeAttribute(":class");

                dec();
            })();
        }
        if (node.attributes[":text"]) {
            console.log(":text", node.attributes[":text"].value);
            (async () => {
                inc();

                try {
                    const result = await new Function(
                        ...Object.keys(context),
                        `return (${node.attributes[":text"].value});`
                    )(
                        ...Object.values(context)
                    );
                    node.textContent = result;
                } catch (error) {
                    console.warn(":error", `${error}`);
                }

                // node.removeAttribute(":text");

                dec();
            })();
        }
        if (node.attributes[":if"]) {
            console.log(":if", node.attributes[":if"].value);
            for (let child of selectorAll(node, "*")) {
                child._processed = true;
            }
            node.hidden = true;
            node._flex = node._flex || node.classList.contains("d-flex");
            node.classList.remove("d-flex");
            node.classList.add("d-none");
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
                    node.classList.remove("d-none");
                    if (node._flex) node.classList.add("d-flex");
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
        }
    }
}

async function getContext() {
    return window._context;
}

async function setContext(context) {
    window._context = window._context || {};

    window._context = {
        ...window._context,
        ...context
    };

    let pic = 0;

    document.body._processed = false;

    renderContext(
        document.body,
        window._context,
        () => ++pic,
        () => --pic,
    );

    while (pic > 0) {
        console.warn("pic", pic);
        await new Promise(resolve => setTimeout(resolve, 20));
    }

    console.warn("pic", pic);
}

function handle(key, callback) {
    window._context = window._context || {};
    window._context[key] = callback;
}

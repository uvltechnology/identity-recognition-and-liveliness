import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
import * as React from "react";
import React__default, { useState, useRef, useEffect, useCallback } from "react";
import { stripBasename, UNSAFE_warning, UNSAFE_invariant, matchPath, joinPaths, Action } from "@remix-run/router";
import { UNSAFE_NavigationContext, useHref, useLocation, useNavigate, useResolvedPath, createPath, UNSAFE_DataRouterStateContext, UNSAFE_useRouteId, UNSAFE_RouteContext, UNSAFE_DataRouterContext, parsePath, Router, useParams, Routes, Route } from "react-router";
import "react-dom";
import * as faceapi from "face-api.js";
/**
 * React Router DOM v6.30.3
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
function _extends$1() {
  _extends$1 = Object.assign ? Object.assign.bind() : function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  return _extends$1.apply(this, arguments);
}
function _objectWithoutPropertiesLoose$1(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;
  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }
  return target;
}
const defaultMethod = "get";
const defaultEncType = "application/x-www-form-urlencoded";
function isHtmlElement(object) {
  return object != null && typeof object.tagName === "string";
}
function isButtonElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "button";
}
function isFormElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "form";
}
function isInputElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "input";
}
function isModifiedEvent(event) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}
function shouldProcessLinkClick(event, target) {
  return event.button === 0 && // Ignore everything but left clicks
  (!target || target === "_self") && // Let browser handle "target=_blank" etc.
  !isModifiedEvent(event);
}
function createSearchParams(init) {
  if (init === void 0) {
    init = "";
  }
  return new URLSearchParams(typeof init === "string" || Array.isArray(init) || init instanceof URLSearchParams ? init : Object.keys(init).reduce((memo, key) => {
    let value = init[key];
    return memo.concat(Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]]);
  }, []));
}
function getSearchParamsForLocation(locationSearch, defaultSearchParams) {
  let searchParams = createSearchParams(locationSearch);
  if (defaultSearchParams) {
    defaultSearchParams.forEach((_, key) => {
      if (!searchParams.has(key)) {
        defaultSearchParams.getAll(key).forEach((value) => {
          searchParams.append(key, value);
        });
      }
    });
  }
  return searchParams;
}
let _formDataSupportsSubmitter = null;
function isFormDataSubmitterSupported() {
  if (_formDataSupportsSubmitter === null) {
    try {
      new FormData(
        document.createElement("form"),
        // @ts-expect-error if FormData supports the submitter parameter, this will throw
        0
      );
      _formDataSupportsSubmitter = false;
    } catch (e) {
      _formDataSupportsSubmitter = true;
    }
  }
  return _formDataSupportsSubmitter;
}
const supportedFormEncTypes = /* @__PURE__ */ new Set(["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"]);
function getFormEncType(encType) {
  if (encType != null && !supportedFormEncTypes.has(encType)) {
    process.env.NODE_ENV !== "production" ? UNSAFE_warning(false, '"' + encType + '" is not a valid `encType` for `<Form>`/`<fetcher.Form>` ' + ('and will default to "' + defaultEncType + '"')) : void 0;
    return null;
  }
  return encType;
}
function getFormSubmissionInfo(target, basename) {
  let method;
  let action;
  let encType;
  let formData;
  let body;
  if (isFormElement(target)) {
    let attr = target.getAttribute("action");
    action = attr ? stripBasename(attr, basename) : null;
    method = target.getAttribute("method") || defaultMethod;
    encType = getFormEncType(target.getAttribute("enctype")) || defaultEncType;
    formData = new FormData(target);
  } else if (isButtonElement(target) || isInputElement(target) && (target.type === "submit" || target.type === "image")) {
    let form = target.form;
    if (form == null) {
      throw new Error('Cannot submit a <button> or <input type="submit"> without a <form>');
    }
    let attr = target.getAttribute("formaction") || form.getAttribute("action");
    action = attr ? stripBasename(attr, basename) : null;
    method = target.getAttribute("formmethod") || form.getAttribute("method") || defaultMethod;
    encType = getFormEncType(target.getAttribute("formenctype")) || getFormEncType(form.getAttribute("enctype")) || defaultEncType;
    formData = new FormData(form, target);
    if (!isFormDataSubmitterSupported()) {
      let {
        name,
        type,
        value
      } = target;
      if (type === "image") {
        let prefix = name ? name + "." : "";
        formData.append(prefix + "x", "0");
        formData.append(prefix + "y", "0");
      } else if (name) {
        formData.append(name, value);
      }
    }
  } else if (isHtmlElement(target)) {
    throw new Error('Cannot submit element that is not <form>, <button>, or <input type="submit|image">');
  } else {
    method = defaultMethod;
    action = null;
    encType = defaultEncType;
    body = target;
  }
  if (formData && encType === "text/plain") {
    body = formData;
    formData = void 0;
  }
  return {
    action,
    method: method.toLowerCase(),
    encType,
    formData,
    body
  };
}
const _excluded$1 = ["onClick", "relative", "reloadDocument", "replace", "state", "target", "to", "preventScrollReset", "viewTransition"], _excluded2 = ["aria-current", "caseSensitive", "className", "end", "style", "to", "viewTransition", "children"], _excluded3 = ["fetcherKey", "navigate", "reloadDocument", "replace", "state", "method", "action", "onSubmit", "relative", "preventScrollReset", "viewTransition"];
const REACT_ROUTER_VERSION = "6";
try {
  window.__reactRouterVersion = REACT_ROUTER_VERSION;
} catch (e) {
}
const ViewTransitionContext = /* @__PURE__ */ React.createContext({
  isTransitioning: false
});
if (process.env.NODE_ENV !== "production") {
  ViewTransitionContext.displayName = "ViewTransition";
}
const FetchersContext = /* @__PURE__ */ React.createContext(/* @__PURE__ */ new Map());
if (process.env.NODE_ENV !== "production") {
  FetchersContext.displayName = "Fetchers";
}
if (process.env.NODE_ENV !== "production") ;
const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined";
const ABSOLUTE_URL_REGEX$1 = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const Link = /* @__PURE__ */ React.forwardRef(function LinkWithRef(_ref7, ref) {
  let {
    onClick,
    relative,
    reloadDocument,
    replace,
    state,
    target,
    to,
    preventScrollReset,
    viewTransition
  } = _ref7, rest = _objectWithoutPropertiesLoose$1(_ref7, _excluded$1);
  let {
    basename
  } = React.useContext(UNSAFE_NavigationContext);
  let absoluteHref;
  let isExternal = false;
  if (typeof to === "string" && ABSOLUTE_URL_REGEX$1.test(to)) {
    absoluteHref = to;
    if (isBrowser) {
      try {
        let currentUrl = new URL(window.location.href);
        let targetUrl = to.startsWith("//") ? new URL(currentUrl.protocol + to) : new URL(to);
        let path = stripBasename(targetUrl.pathname, basename);
        if (targetUrl.origin === currentUrl.origin && path != null) {
          to = path + targetUrl.search + targetUrl.hash;
        } else {
          isExternal = true;
        }
      } catch (e) {
        process.env.NODE_ENV !== "production" ? UNSAFE_warning(false, '<Link to="' + to + '"> contains an invalid URL which will probably break when clicked - please update to a valid URL path.') : void 0;
      }
    }
  }
  let href = useHref(to, {
    relative
  });
  let internalOnClick = useLinkClickHandler(to, {
    replace,
    state,
    target,
    preventScrollReset,
    relative,
    viewTransition
  });
  function handleClick(event) {
    if (onClick) onClick(event);
    if (!event.defaultPrevented) {
      internalOnClick(event);
    }
  }
  return (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    /* @__PURE__ */ React.createElement("a", _extends$1({}, rest, {
      href: absoluteHref || href,
      onClick: isExternal || reloadDocument ? onClick : handleClick,
      ref,
      target
    }))
  );
});
if (process.env.NODE_ENV !== "production") {
  Link.displayName = "Link";
}
const NavLink = /* @__PURE__ */ React.forwardRef(function NavLinkWithRef(_ref8, ref) {
  let {
    "aria-current": ariaCurrentProp = "page",
    caseSensitive = false,
    className: classNameProp = "",
    end = false,
    style: styleProp,
    to,
    viewTransition,
    children
  } = _ref8, rest = _objectWithoutPropertiesLoose$1(_ref8, _excluded2);
  let path = useResolvedPath(to, {
    relative: rest.relative
  });
  let location = useLocation();
  let routerState = React.useContext(UNSAFE_DataRouterStateContext);
  let {
    navigator: navigator2,
    basename
  } = React.useContext(UNSAFE_NavigationContext);
  let isTransitioning = routerState != null && // Conditional usage is OK here because the usage of a data router is static
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useViewTransitionState(path) && viewTransition === true;
  let toPathname = navigator2.encodeLocation ? navigator2.encodeLocation(path).pathname : path.pathname;
  let locationPathname = location.pathname;
  let nextLocationPathname = routerState && routerState.navigation && routerState.navigation.location ? routerState.navigation.location.pathname : null;
  if (!caseSensitive) {
    locationPathname = locationPathname.toLowerCase();
    nextLocationPathname = nextLocationPathname ? nextLocationPathname.toLowerCase() : null;
    toPathname = toPathname.toLowerCase();
  }
  if (nextLocationPathname && basename) {
    nextLocationPathname = stripBasename(nextLocationPathname, basename) || nextLocationPathname;
  }
  const endSlashPosition = toPathname !== "/" && toPathname.endsWith("/") ? toPathname.length - 1 : toPathname.length;
  let isActive = locationPathname === toPathname || !end && locationPathname.startsWith(toPathname) && locationPathname.charAt(endSlashPosition) === "/";
  let isPending = nextLocationPathname != null && (nextLocationPathname === toPathname || !end && nextLocationPathname.startsWith(toPathname) && nextLocationPathname.charAt(toPathname.length) === "/");
  let renderProps = {
    isActive,
    isPending,
    isTransitioning
  };
  let ariaCurrent = isActive ? ariaCurrentProp : void 0;
  let className;
  if (typeof classNameProp === "function") {
    className = classNameProp(renderProps);
  } else {
    className = [classNameProp, isActive ? "active" : null, isPending ? "pending" : null, isTransitioning ? "transitioning" : null].filter(Boolean).join(" ");
  }
  let style = typeof styleProp === "function" ? styleProp(renderProps) : styleProp;
  return /* @__PURE__ */ React.createElement(Link, _extends$1({}, rest, {
    "aria-current": ariaCurrent,
    className,
    ref,
    style,
    to,
    viewTransition
  }), typeof children === "function" ? children(renderProps) : children);
});
if (process.env.NODE_ENV !== "production") {
  NavLink.displayName = "NavLink";
}
const Form = /* @__PURE__ */ React.forwardRef((_ref9, forwardedRef) => {
  let {
    fetcherKey,
    navigate,
    reloadDocument,
    replace,
    state,
    method = defaultMethod,
    action,
    onSubmit,
    relative,
    preventScrollReset,
    viewTransition
  } = _ref9, props = _objectWithoutPropertiesLoose$1(_ref9, _excluded3);
  let submit = useSubmit();
  let formAction = useFormAction(action, {
    relative
  });
  let formMethod = method.toLowerCase() === "get" ? "get" : "post";
  let submitHandler = (event) => {
    onSubmit && onSubmit(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    let submitter = event.nativeEvent.submitter;
    let submitMethod = (submitter == null ? void 0 : submitter.getAttribute("formmethod")) || method;
    submit(submitter || event.currentTarget, {
      fetcherKey,
      method: submitMethod,
      navigate,
      replace,
      state,
      relative,
      preventScrollReset,
      viewTransition
    });
  };
  return /* @__PURE__ */ React.createElement("form", _extends$1({
    ref: forwardedRef,
    method: formMethod,
    action: formAction,
    onSubmit: reloadDocument ? onSubmit : submitHandler
  }, props));
});
if (process.env.NODE_ENV !== "production") {
  Form.displayName = "Form";
}
if (process.env.NODE_ENV !== "production") ;
var DataRouterHook;
(function(DataRouterHook2) {
  DataRouterHook2["UseScrollRestoration"] = "useScrollRestoration";
  DataRouterHook2["UseSubmit"] = "useSubmit";
  DataRouterHook2["UseSubmitFetcher"] = "useSubmitFetcher";
  DataRouterHook2["UseFetcher"] = "useFetcher";
  DataRouterHook2["useViewTransitionState"] = "useViewTransitionState";
})(DataRouterHook || (DataRouterHook = {}));
var DataRouterStateHook;
(function(DataRouterStateHook2) {
  DataRouterStateHook2["UseFetcher"] = "useFetcher";
  DataRouterStateHook2["UseFetchers"] = "useFetchers";
  DataRouterStateHook2["UseScrollRestoration"] = "useScrollRestoration";
})(DataRouterStateHook || (DataRouterStateHook = {}));
function getDataRouterConsoleError(hookName) {
  return hookName + " must be used within a data router.  See https://reactrouter.com/v6/routers/picking-a-router.";
}
function useDataRouterContext(hookName) {
  let ctx = React.useContext(UNSAFE_DataRouterContext);
  !ctx ? process.env.NODE_ENV !== "production" ? UNSAFE_invariant(false, getDataRouterConsoleError(hookName)) : UNSAFE_invariant(false) : void 0;
  return ctx;
}
function useLinkClickHandler(to, _temp) {
  let {
    target,
    replace: replaceProp,
    state,
    preventScrollReset,
    relative,
    viewTransition
  } = _temp === void 0 ? {} : _temp;
  let navigate = useNavigate();
  let location = useLocation();
  let path = useResolvedPath(to, {
    relative
  });
  return React.useCallback((event) => {
    if (shouldProcessLinkClick(event, target)) {
      event.preventDefault();
      let replace = replaceProp !== void 0 ? replaceProp : createPath(location) === createPath(path);
      navigate(to, {
        replace,
        state,
        preventScrollReset,
        relative,
        viewTransition
      });
    }
  }, [location, navigate, path, replaceProp, state, target, to, preventScrollReset, relative, viewTransition]);
}
function useSearchParams(defaultInit) {
  process.env.NODE_ENV !== "production" ? UNSAFE_warning(typeof URLSearchParams !== "undefined", "You cannot use the `useSearchParams` hook in a browser that does not support the URLSearchParams API. If you need to support Internet Explorer 11, we recommend you load a polyfill such as https://github.com/ungap/url-search-params.") : void 0;
  let defaultSearchParamsRef = React.useRef(createSearchParams(defaultInit));
  let hasSetSearchParamsRef = React.useRef(false);
  let location = useLocation();
  let searchParams = React.useMemo(() => (
    // Only merge in the defaults if we haven't yet called setSearchParams.
    // Once we call that we want those to take precedence, otherwise you can't
    // remove a param with setSearchParams({}) if it has an initial value
    getSearchParamsForLocation(location.search, hasSetSearchParamsRef.current ? null : defaultSearchParamsRef.current)
  ), [location.search]);
  let navigate = useNavigate();
  let setSearchParams = React.useCallback((nextInit, navigateOptions) => {
    const newSearchParams = createSearchParams(typeof nextInit === "function" ? nextInit(searchParams) : nextInit);
    hasSetSearchParamsRef.current = true;
    navigate("?" + newSearchParams, navigateOptions);
  }, [navigate, searchParams]);
  return [searchParams, setSearchParams];
}
function validateClientSideSubmission() {
  if (typeof document === "undefined") {
    throw new Error("You are calling submit during the server render. Try calling submit within a `useEffect` or callback instead.");
  }
}
let fetcherId = 0;
let getUniqueFetcherId = () => "__" + String(++fetcherId) + "__";
function useSubmit() {
  let {
    router
  } = useDataRouterContext(DataRouterHook.UseSubmit);
  let {
    basename
  } = React.useContext(UNSAFE_NavigationContext);
  let currentRouteId = UNSAFE_useRouteId();
  return React.useCallback(function(target, options) {
    if (options === void 0) {
      options = {};
    }
    validateClientSideSubmission();
    let {
      action,
      method,
      encType,
      formData,
      body
    } = getFormSubmissionInfo(target, basename);
    if (options.navigate === false) {
      let key = options.fetcherKey || getUniqueFetcherId();
      router.fetch(key, currentRouteId, options.action || action, {
        preventScrollReset: options.preventScrollReset,
        formData,
        body,
        formMethod: options.method || method,
        formEncType: options.encType || encType,
        flushSync: options.flushSync
      });
    } else {
      router.navigate(options.action || action, {
        preventScrollReset: options.preventScrollReset,
        formData,
        body,
        formMethod: options.method || method,
        formEncType: options.encType || encType,
        replace: options.replace,
        state: options.state,
        fromRouteId: currentRouteId,
        flushSync: options.flushSync,
        viewTransition: options.viewTransition
      });
    }
  }, [router, basename, currentRouteId]);
}
function useFormAction(action, _temp2) {
  let {
    relative
  } = _temp2 === void 0 ? {} : _temp2;
  let {
    basename
  } = React.useContext(UNSAFE_NavigationContext);
  let routeContext = React.useContext(UNSAFE_RouteContext);
  !routeContext ? process.env.NODE_ENV !== "production" ? UNSAFE_invariant(false, "useFormAction must be used inside a RouteContext") : UNSAFE_invariant(false) : void 0;
  let [match] = routeContext.matches.slice(-1);
  let path = _extends$1({}, useResolvedPath(action ? action : ".", {
    relative
  }));
  let location = useLocation();
  if (action == null) {
    path.search = location.search;
    let params = new URLSearchParams(path.search);
    let indexValues = params.getAll("index");
    let hasNakedIndexParam = indexValues.some((v) => v === "");
    if (hasNakedIndexParam) {
      params.delete("index");
      indexValues.filter((v) => v).forEach((v) => params.append("index", v));
      let qs = params.toString();
      path.search = qs ? "?" + qs : "";
    }
  }
  if ((!action || action === ".") && match.route.index) {
    path.search = path.search ? path.search.replace(/^\?/, "?index&") : "?index";
  }
  if (basename !== "/") {
    path.pathname = path.pathname === "/" ? basename : joinPaths([basename, path.pathname]);
  }
  return createPath(path);
}
function useViewTransitionState(to, opts) {
  if (opts === void 0) {
    opts = {};
  }
  let vtContext = React.useContext(ViewTransitionContext);
  !(vtContext != null) ? process.env.NODE_ENV !== "production" ? UNSAFE_invariant(false, "`useViewTransitionState` must be used within `react-router-dom`'s `RouterProvider`.  Did you accidentally import `RouterProvider` from `react-router`?") : UNSAFE_invariant(false) : void 0;
  let {
    basename
  } = useDataRouterContext(DataRouterHook.useViewTransitionState);
  let path = useResolvedPath(to, {
    relative: opts.relative
  });
  if (!vtContext.isTransitioning) {
    return false;
  }
  let currentPath = stripBasename(vtContext.currentLocation.pathname, basename) || vtContext.currentLocation.pathname;
  let nextPath = stripBasename(vtContext.nextLocation.pathname, basename) || vtContext.nextLocation.pathname;
  return matchPath(path.pathname, nextPath) != null || matchPath(path.pathname, currentPath) != null;
}
function StaticRouter({
  basename,
  children,
  location: locationProp = "/",
  future
}) {
  if (typeof locationProp === "string") {
    locationProp = parsePath(locationProp);
  }
  let action = Action.Pop;
  let location = {
    pathname: locationProp.pathname || "/",
    search: locationProp.search || "",
    hash: locationProp.hash || "",
    state: locationProp.state != null ? locationProp.state : null,
    key: locationProp.key || "default"
  };
  let staticNavigator = getStatelessNavigator();
  return /* @__PURE__ */ React.createElement(Router, {
    basename,
    children,
    location,
    navigationType: action,
    navigator: staticNavigator,
    future,
    static: true
  });
}
function getStatelessNavigator() {
  return {
    createHref,
    encodeLocation,
    push(to) {
      throw new Error(`You cannot use navigator.push() on the server because it is a stateless environment. This error was probably triggered when you did a \`navigate(${JSON.stringify(to)})\` somewhere in your app.`);
    },
    replace(to) {
      throw new Error(`You cannot use navigator.replace() on the server because it is a stateless environment. This error was probably triggered when you did a \`navigate(${JSON.stringify(to)}, { replace: true })\` somewhere in your app.`);
    },
    go(delta) {
      throw new Error(`You cannot use navigator.go() on the server because it is a stateless environment. This error was probably triggered when you did a \`navigate(${delta})\` somewhere in your app.`);
    },
    back() {
      throw new Error(`You cannot use navigator.back() on the server because it is a stateless environment.`);
    },
    forward() {
      throw new Error(`You cannot use navigator.forward() on the server because it is a stateless environment.`);
    }
  };
}
function createHref(to) {
  return typeof to === "string" ? to : createPath(to);
}
function encodeLocation(to) {
  let href = typeof to === "string" ? to : createPath(to);
  href = href.replace(/ $/, "%20");
  let encoded = ABSOLUTE_URL_REGEX.test(href) ? new URL(href) : new URL(href, "http://localhost");
  return {
    pathname: encoded.pathname,
    search: encoded.search,
    hash: encoded.hash
  };
}
const ABSOLUTE_URL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [docsDropdownOpen, setDocsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const docsSections = [
    { id: "quick-start", label: "Quick Start" },
    { id: "sessions", label: "Create Sessions" },
    { id: "id-types", label: "Supported ID Types" },
    { id: "embed", label: "Embed Integration" },
    { id: "iframe-events", label: "Iframe Events" },
    { id: "webhooks", label: "Webhooks" },
    { id: "status", label: "Session Status" }
  ];
  const isActive = (path) => location.pathname === path;
  const isDocsActive = location.pathname === "/docs";
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDocsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleDocSection = (sectionId) => {
    setDocsDropdownOpen(false);
    setMobileMenuOpen(false);
    if (location.pathname !== "/docs") {
      navigate(`/docs#${sectionId}`);
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };
  return /* @__PURE__ */ jsx("header", { className: "bg-white shadow-sm sticky top-0 z-50", children: /* @__PURE__ */ jsxs("div", { className: "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between h-14 sm:h-16", children: [
      /* @__PURE__ */ jsxs(Link, { to: "/", className: "flex items-center gap-2 sm:gap-3", children: [
        /* @__PURE__ */ jsx("div", { className: "w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center", children: /* @__PURE__ */ jsx("svg", { className: "w-5 h-5 sm:w-6 sm:h-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" }) }) }),
        /* @__PURE__ */ jsx("span", { className: "font-bold text-gray-900 text-base sm:text-lg", children: "Identity API" })
      ] }),
      /* @__PURE__ */ jsxs("nav", { className: "hidden md:flex items-center gap-1", children: [
        /* @__PURE__ */ jsx(
          Link,
          {
            to: "/",
            className: `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive("/") ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`,
            children: "Home"
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "relative", ref: dropdownRef, children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setDocsDropdownOpen(!docsDropdownOpen),
              className: `px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isDocsActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`,
              children: [
                "Documentation",
                /* @__PURE__ */ jsx("svg", { className: `w-4 h-4 transition-transform ${docsDropdownOpen ? "rotate-180" : ""}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })
              ]
            }
          ),
          docsDropdownOpen && /* @__PURE__ */ jsxs("div", { className: "absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50", children: [
            /* @__PURE__ */ jsx(
              Link,
              {
                to: "/docs",
                onClick: () => setDocsDropdownOpen(false),
                className: "block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium border-b border-gray-100",
                children: "Overview"
              }
            ),
            docsSections.map((section) => /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => handleDocSection(section.id),
                className: "w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                children: section.label
              },
              section.id
            ))
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          Link,
          {
            to: "/api-demo",
            className: `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive("/api-demo") ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`,
            children: "API Demo"
          }
        )
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setMobileMenuOpen(!mobileMenuOpen),
          className: "md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100",
          children: mobileMenuOpen ? /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) : /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 12h16M4 18h16" }) })
        }
      )
    ] }),
    mobileMenuOpen && /* @__PURE__ */ jsxs("nav", { className: "md:hidden border-t border-gray-100 py-2", children: [
      /* @__PURE__ */ jsx(
        Link,
        {
          to: "/",
          onClick: () => setMobileMenuOpen(false),
          className: `block px-3 py-2.5 rounded-md text-base font-medium transition-colors ${isActive("/") ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`,
          children: "Home"
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "px-3 py-2.5", children: [
        /* @__PURE__ */ jsx(
          Link,
          {
            to: "/docs",
            onClick: () => setMobileMenuOpen(false),
            className: `block font-medium ${isDocsActive ? "text-blue-700" : "text-gray-900"}`,
            children: "Documentation"
          }
        ),
        /* @__PURE__ */ jsx("div", { className: "mt-2 ml-3 space-y-1 border-l-2 border-gray-200 pl-3", children: docsSections.map((section) => /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => handleDocSection(section.id),
            className: "block w-full text-left text-sm text-gray-600 hover:text-blue-600 py-1",
            children: section.label
          },
          section.id
        )) })
      ] }),
      /* @__PURE__ */ jsx(
        Link,
        {
          to: "/api-demo",
          onClick: () => setMobileMenuOpen(false),
          className: `block px-3 py-2.5 rounded-md text-base font-medium transition-colors ${isActive("/api-demo") ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`,
          children: "API Demo"
        }
      )
    ] })
  ] }) });
}
var DefaultContext = {
  color: void 0,
  size: void 0,
  className: void 0,
  style: void 0,
  attr: void 0
};
var IconContext = React__default.createContext && /* @__PURE__ */ React__default.createContext(DefaultContext);
var _excluded = ["attr", "size", "title"];
function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};
  var target = _objectWithoutPropertiesLoose(source, excluded);
  var key, i;
  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }
  return target;
}
function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  for (var key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (excluded.indexOf(key) >= 0) continue;
      target[key] = source[key];
    }
  }
  return target;
}
function _extends() {
  _extends = Object.assign ? Object.assign.bind() : function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  return _extends.apply(this, arguments);
}
function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r2) {
      return Object.getOwnPropertyDescriptor(e, r2).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), true).forEach(function(r2) {
      _defineProperty(e, r2, t[r2]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r2) {
      Object.defineProperty(e, r2, Object.getOwnPropertyDescriptor(t, r2));
    });
  }
  return e;
}
function _defineProperty(obj, key, value) {
  key = _toPropertyKey(key);
  if (key in obj) {
    Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
  } else {
    obj[key] = value;
  }
  return obj;
}
function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}
function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r);
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function Tree2Element(tree) {
  return tree && tree.map((node, i) => /* @__PURE__ */ React__default.createElement(node.tag, _objectSpread({
    key: i
  }, node.attr), Tree2Element(node.child)));
}
function GenIcon(data) {
  return (props) => /* @__PURE__ */ React__default.createElement(IconBase, _extends({
    attr: _objectSpread({}, data.attr)
  }, props), Tree2Element(data.child));
}
function IconBase(props) {
  var elem = (conf) => {
    var {
      attr,
      size,
      title
    } = props, svgProps = _objectWithoutProperties(props, _excluded);
    var computedSize = size || conf.size || "1em";
    var className;
    if (conf.className) className = conf.className;
    if (props.className) className = (className ? className + " " : "") + props.className;
    return /* @__PURE__ */ React__default.createElement("svg", _extends({
      stroke: "currentColor",
      fill: "currentColor",
      strokeWidth: "0"
    }, conf.attr, attr, svgProps, {
      className,
      style: _objectSpread(_objectSpread({
        color: props.color || conf.color
      }, conf.style), props.style),
      height: computedSize,
      width: computedSize,
      xmlns: "http://www.w3.org/2000/svg"
    }), title && /* @__PURE__ */ React__default.createElement("title", null, title), props.children);
  };
  return IconContext !== void 0 ? /* @__PURE__ */ React__default.createElement(IconContext.Consumer, null, (conf) => elem(conf)) : elem(DefaultContext);
}
function FaBell(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 448 512" }, "child": [{ "tag": "path", "attr": { "d": "M224 512c35.32 0 63.97-28.65 63.97-64H160.03c0 35.35 28.65 64 63.97 64zm215.39-149.71c-19.32-20.76-55.47-51.99-55.47-154.29 0-77.7-54.48-139.9-127.94-155.16V32c0-17.67-14.32-32-31.98-32s-31.98 14.33-31.98 32v20.84C118.56 68.1 64.08 130.3 64.08 208c0 102.3-36.15 133.53-55.47 154.29-6 6.45-8.66 14.16-8.61 21.71.11 16.4 12.98 32 32.1 32h383.8c19.12 0 32-15.6 32.1-32 .05-7.55-2.61-15.27-8.61-21.71z" }, "child": [] }] })(props);
}
function FaBolt(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 320 512" }, "child": [{ "tag": "path", "attr": { "d": "M296 160H180.6l42.6-129.8C227.2 15 215.7 0 200 0H56C44 0 33.8 8.9 32.2 20.8l-32 240C-1.7 275.2 9.5 288 24 288h118.7L96.6 482.5c-3.6 15.2 8 29.5 23.3 29.5 8.4 0 16.4-4.4 20.8-12l176-304c9.3-15.9-2.2-36-20.7-36z" }, "child": [] }] })(props);
}
function FaBook(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 448 512" }, "child": [{ "tag": "path", "attr": { "d": "M448 360V24c0-13.3-10.7-24-24-24H96C43 0 0 43 0 96v320c0 53 43 96 96 96h328c13.3 0 24-10.7 24-24v-16c0-7.5-3.5-14.3-8.9-18.7-4.2-15.4-4.2-59.3 0-74.7 5.4-4.3 8.9-11.1 8.9-18.6zM128 134c0-3.3 2.7-6 6-6h212c3.3 0 6 2.7 6 6v20c0 3.3-2.7 6-6 6H134c-3.3 0-6-2.7-6-6v-20zm0 64c0-3.3 2.7-6 6-6h212c3.3 0 6 2.7 6 6v20c0 3.3-2.7 6-6 6H134c-3.3 0-6-2.7-6-6v-20zm253.4 250H96c-17.7 0-32-14.3-32-32 0-17.6 14.4-32 32-32h285.4c-1.9 17.1-1.9 46.9 0 64z" }, "child": [] }] })(props);
}
function FaChartBar(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 512 512" }, "child": [{ "tag": "path", "attr": { "d": "M332.8 320h38.4c6.4 0 12.8-6.4 12.8-12.8V172.8c0-6.4-6.4-12.8-12.8-12.8h-38.4c-6.4 0-12.8 6.4-12.8 12.8v134.4c0 6.4 6.4 12.8 12.8 12.8zm96 0h38.4c6.4 0 12.8-6.4 12.8-12.8V76.8c0-6.4-6.4-12.8-12.8-12.8h-38.4c-6.4 0-12.8 6.4-12.8 12.8v230.4c0 6.4 6.4 12.8 12.8 12.8zm-288 0h38.4c6.4 0 12.8-6.4 12.8-12.8v-70.4c0-6.4-6.4-12.8-12.8-12.8h-38.4c-6.4 0-12.8 6.4-12.8 12.8v70.4c0 6.4 6.4 12.8 12.8 12.8zm96 0h38.4c6.4 0 12.8-6.4 12.8-12.8V108.8c0-6.4-6.4-12.8-12.8-12.8h-38.4c-6.4 0-12.8 6.4-12.8 12.8v198.4c0 6.4 6.4 12.8 12.8 12.8zM496 384H64V80c0-8.84-7.16-16-16-16H16C7.16 64 0 71.16 0 80v336c0 17.67 14.33 32 32 32h464c8.84 0 16-7.16 16-16v-32c0-8.84-7.16-16-16-16z" }, "child": [] }] })(props);
}
function FaCommentDots(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 512 512" }, "child": [{ "tag": "path", "attr": { "d": "M256 32C114.6 32 0 125.1 0 240c0 49.6 21.4 95 57 130.7C44.5 421.1 2.7 466 2.2 466.5c-2.2 2.3-2.8 5.7-1.5 8.7S4.8 480 8 480c66.3 0 116-31.8 140.6-51.4 32.7 12.3 69 19.4 107.4 19.4 141.4 0 256-93.1 256-208S397.4 32 256 32zM128 272c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128 0c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128 0c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z" }, "child": [] }] })(props);
}
function FaCube(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 512 512" }, "child": [{ "tag": "path", "attr": { "d": "M239.1 6.3l-208 78c-18.7 7-31.1 25-31.1 45v225.1c0 18.2 10.3 34.8 26.5 42.9l208 104c13.5 6.8 29.4 6.8 42.9 0l208-104c16.3-8.1 26.5-24.8 26.5-42.9V129.3c0-20-12.4-37.9-31.1-44.9l-208-78C262 2.2 250 2.2 239.1 6.3zM256 68.4l192 72v1.1l-192 78-192-78v-1.1l192-72zm32 356V275.5l160-65v133.9l-160 80z" }, "child": [] }] })(props);
}
function FaEye(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 576 512" }, "child": [{ "tag": "path", "attr": { "d": "M572.52 241.4C518.29 135.59 410.93 64 288 64S57.68 135.64 3.48 241.41a32.35 32.35 0 0 0 0 29.19C57.71 376.41 165.07 448 288 448s230.32-71.64 284.52-177.41a32.35 32.35 0 0 0 0-29.19zM288 400a144 144 0 1 1 144-144 143.93 143.93 0 0 1-144 144zm0-240a95.31 95.31 0 0 0-25.31 3.79 47.85 47.85 0 0 1-66.9 66.9A95.78 95.78 0 1 0 288 160z" }, "child": [] }] })(props);
}
function FaFlag(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 512 512" }, "child": [{ "tag": "path", "attr": { "d": "M349.565 98.783C295.978 98.783 251.721 64 184.348 64c-24.955 0-47.309 4.384-68.045 12.013a55.947 55.947 0 0 0 3.586-23.562C118.117 24.015 94.806 1.206 66.338.048 34.345-1.254 8 24.296 8 56c0 19.026 9.497 35.825 24 45.945V488c0 13.255 10.745 24 24 24h16c13.255 0 24-10.745 24-24v-94.4c28.311-12.064 63.582-22.122 114.435-22.122 53.588 0 97.844 34.783 165.217 34.783 48.169 0 86.667-16.294 122.505-40.858C506.84 359.452 512 349.571 512 339.045v-243.1c0-23.393-24.269-38.87-45.485-29.016-34.338 15.948-76.454 31.854-116.95 31.854z" }, "child": [] }] })(props);
}
function FaFlask(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 448 512" }, "child": [{ "tag": "path", "attr": { "d": "M437.2 403.5L320 215V64h8c13.3 0 24-10.7 24-24V24c0-13.3-10.7-24-24-24H120c-13.3 0-24 10.7-24 24v16c0 13.3 10.7 24 24 24h8v151L10.8 403.5C-18.5 450.6 15.3 512 70.9 512h306.2c55.7 0 89.4-61.5 60.1-108.5zM137.9 320l48.2-77.6c3.7-5.2 5.8-11.6 5.8-18.4V64h64v160c0 6.9 2.2 13.2 5.8 18.4l48.2 77.6h-172z" }, "child": [] }] })(props);
}
function FaIdBadge(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 384 512" }, "child": [{ "tag": "path", "attr": { "d": "M336 0H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48zM144 32h96c8.8 0 16 7.2 16 16s-7.2 16-16 16h-96c-8.8 0-16-7.2-16-16s7.2-16 16-16zm48 128c35.3 0 64 28.7 64 64s-28.7 64-64 64-64-28.7-64-64 28.7-64 64-64zm112 236.8c0 10.6-10 19.2-22.4 19.2H102.4C90 416 80 407.4 80 396.8v-19.2c0-31.8 30.1-57.6 67.2-57.6h5c12.3 5.1 25.7 8 39.8 8s27.6-2.9 39.8-8h5c37.1 0 67.2 25.8 67.2 57.6v19.2z" }, "child": [] }] })(props);
}
function FaRobot(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 640 512" }, "child": [{ "tag": "path", "attr": { "d": "M32,224H64V416H32A31.96166,31.96166,0,0,1,0,384V256A31.96166,31.96166,0,0,1,32,224Zm512-48V448a64.06328,64.06328,0,0,1-64,64H160a64.06328,64.06328,0,0,1-64-64V176a79.974,79.974,0,0,1,80-80H288V32a32,32,0,0,1,64,0V96H464A79.974,79.974,0,0,1,544,176ZM264,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,264,256Zm-8,128H192v32h64Zm96,0H288v32h64ZM456,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,456,256Zm-8,128H384v32h64ZM640,256V384a31.96166,31.96166,0,0,1-32,32H576V224h32A31.96166,31.96166,0,0,1,640,256Z" }, "child": [] }] })(props);
}
function FaRocket(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 512 512" }, "child": [{ "tag": "path", "attr": { "d": "M505.12019,19.09375c-1.18945-5.53125-6.65819-11-12.207-12.1875C460.716,0,435.507,0,410.40747,0,307.17523,0,245.26909,55.20312,199.05238,128H94.83772c-16.34763.01562-35.55658,11.875-42.88664,26.48438L2.51562,253.29688A28.4,28.4,0,0,0,0,264a24.00867,24.00867,0,0,0,24.00582,24H127.81618l-22.47457,22.46875c-11.36521,11.36133-12.99607,32.25781,0,45.25L156.24582,406.625c11.15623,11.1875,32.15619,13.15625,45.27726,0l22.47457-22.46875V488a24.00867,24.00867,0,0,0,24.00581,24,28.55934,28.55934,0,0,0,10.707-2.51562l98.72834-49.39063c14.62888-7.29687,26.50776-26.5,26.50776-42.85937V312.79688c72.59753-46.3125,128.03493-108.40626,128.03493-211.09376C512.07526,76.5,512.07526,51.29688,505.12019,19.09375ZM384.04033,168A40,40,0,1,1,424.05,128,40.02322,40.02322,0,0,1,384.04033,168Z" }, "child": [] }] })(props);
}
function FaServer(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 512 512" }, "child": [{ "tag": "path", "attr": { "d": "M480 160H32c-17.673 0-32-14.327-32-32V64c0-17.673 14.327-32 32-32h448c17.673 0 32 14.327 32 32v64c0 17.673-14.327 32-32 32zm-48-88c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24zm-64 0c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24zm112 248H32c-17.673 0-32-14.327-32-32v-64c0-17.673 14.327-32 32-32h448c17.673 0 32 14.327 32 32v64c0 17.673-14.327 32-32 32zm-48-88c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24zm-64 0c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24zm112 248H32c-17.673 0-32-14.327-32-32v-64c0-17.673 14.327-32 32-32h448c17.673 0 32 14.327 32 32v64c0 17.673-14.327 32-32 32zm-48-88c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24zm-64 0c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24z" }, "child": [] }] })(props);
}
function FaUserCheck(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 640 512" }, "child": [{ "tag": "path", "attr": { "d": "M224 256c70.7 0 128-57.3 128-128S294.7 0 224 0 96 57.3 96 128s57.3 128 128 128zm89.6 32h-16.7c-22.2 10.2-46.9 16-72.9 16s-50.6-5.8-72.9-16h-16.7C60.2 288 0 348.2 0 422.4V464c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48v-41.6c0-74.2-60.2-134.4-134.4-134.4zm323-128.4l-27.8-28.1c-4.6-4.7-12.1-4.7-16.8-.1l-104.8 104-45.5-45.8c-4.6-4.7-12.1-4.7-16.8-.1l-28.1 27.9c-4.7 4.6-4.7 12.1-.1 16.8l81.7 82.3c4.6 4.7 12.1 4.7 16.8.1l141.3-140.2c4.6-4.7 4.7-12.2.1-16.8z" }, "child": [] }] })(props);
}
function HomePage() {
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-gray-50 to-blue-50", children: [
    /* @__PURE__ */ jsx(Header, {}),
    /* @__PURE__ */ jsxs("div", { className: "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16", children: [
      /* @__PURE__ */ jsxs("div", { className: "text-center mb-8 sm:mb-12", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4", children: "Identity Verification Service" }),
        /* @__PURE__ */ jsx("p", { className: "text-gray-600 text-sm sm:text-base max-w-xl mx-auto px-4", children: "Secure ID verification with AI-powered OCR extraction and real-time liveness detection for Philippine government IDs." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-12 max-w-2xl mx-auto", children: [
        /* @__PURE__ */ jsxs(
          Link,
          {
            to: "/id-verification-test",
            className: "flex flex-col items-center justify-center rounded-xl bg-white border-2 border-blue-100 hover:border-blue-300 px-4 py-5 sm:py-6 text-center shadow-sm hover:shadow-md transition-all",
            children: [
              /* @__PURE__ */ jsx(FaIdBadge, { className: "text-3xl sm:text-4xl mb-2 text-blue-500" }),
              /* @__PURE__ */ jsx("span", { className: "font-semibold text-gray-900 text-sm sm:text-base", children: "ID Verification" }),
              /* @__PURE__ */ jsx("span", { className: "text-xs text-gray-500 mt-1", children: "Scan & extract ID data" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          Link,
          {
            to: "/selfie-liveness-test",
            className: "flex flex-col items-center justify-center rounded-xl bg-white border-2 border-purple-100 hover:border-purple-300 px-4 py-5 sm:py-6 text-center shadow-sm hover:shadow-md transition-all",
            children: [
              /* @__PURE__ */ jsx(FaUserCheck, { className: "text-3xl sm:text-4xl mb-2 text-purple-500" }),
              /* @__PURE__ */ jsx("span", { className: "font-semibold text-gray-900 text-sm sm:text-base", children: "Selfie Liveness" }),
              /* @__PURE__ */ jsx("span", { className: "text-xs text-gray-500 mt-1", children: "Real-time face detection" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          Link,
          {
            to: "/docs",
            className: "flex flex-col items-center justify-center rounded-xl bg-white border-2 border-gray-100 hover:border-gray-300 px-4 py-5 sm:py-6 text-center shadow-sm hover:shadow-md transition-all",
            children: [
              /* @__PURE__ */ jsx(FaBook, { className: "text-3xl sm:text-4xl mb-2 text-gray-600" }),
              /* @__PURE__ */ jsx("span", { className: "font-semibold text-gray-900 text-sm sm:text-base", children: "API Docs" }),
              /* @__PURE__ */ jsx("span", { className: "text-xs text-gray-500 mt-1", children: "Integration guide" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden", children: [
          /* @__PURE__ */ jsx("div", { className: "px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-b border-gray-100", children: /* @__PURE__ */ jsx("h2", { className: "font-semibold text-gray-900 text-sm sm:text-base", children: "API Endpoints" }) }),
          /* @__PURE__ */ jsx("ul", { className: "divide-y divide-gray-100", children: [
            { path: "/api/health", desc: "Health check" },
            { path: "/api/ids", desc: "List supported ID types" },
            { path: "/api/session/:id", desc: "Get session info" }
          ].map((item) => /* @__PURE__ */ jsxs("li", { className: "px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3", children: [
            /* @__PURE__ */ jsx("code", { className: "text-xs sm:text-sm bg-gray-100 px-2 py-0.5 rounded text-blue-600 font-mono whitespace-nowrap", children: item.path }),
            /* @__PURE__ */ jsx("span", { className: "text-xs sm:text-sm text-gray-500", children: item.desc })
          ] }, item.path)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden", children: [
          /* @__PURE__ */ jsx("div", { className: "px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-b border-gray-100", children: /* @__PURE__ */ jsx("h2", { className: "font-semibold text-gray-900 text-sm sm:text-base", children: "Available Pages" }) }),
          /* @__PURE__ */ jsx("ul", { className: "divide-y divide-gray-100", children: [
            { path: "/", to: "/", label: "Home", desc: "This page" },
            { path: "/id-verification-test", to: "/id-verification-test", label: "ID Test", desc: "Scan & extract ID" },
            { path: "/selfie-liveness-test", to: "/selfie-liveness-test", label: "Liveness", desc: "Face detection" },
            { path: "/docs", to: "/docs", label: "Docs", desc: "API documentation" },
            { path: "/embed/session/:id", to: "/embed/session/demo-123", label: "Embed", desc: "For iframe integration" }
          ].map((item) => /* @__PURE__ */ jsx("li", { className: "px-4 sm:px-6 py-2.5 sm:py-3", children: /* @__PURE__ */ jsxs(Link, { to: item.to, className: "flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 group", children: [
            /* @__PURE__ */ jsx("code", { className: "text-xs sm:text-sm bg-blue-50 px-2 py-0.5 rounded text-blue-600 font-mono group-hover:bg-blue-100 transition whitespace-nowrap", children: item.path }),
            /* @__PURE__ */ jsx("span", { className: "text-xs sm:text-sm text-gray-500", children: item.desc })
          ] }) }, item.path)) })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-8 sm:mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4", children: [
        { icon: FaFlag, label: "8 ID Types", desc: "Philippine IDs", color: "text-red-500" },
        { icon: FaRobot, label: "AI Powered", desc: "Gemini extraction", color: "text-blue-500" },
        { icon: FaEye, label: "Liveness", desc: "Anti-spoofing", color: "text-green-500" },
        { icon: FaBolt, label: "Real-time", desc: "Fast processing", color: "text-yellow-500" }
      ].map((feature) => /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg p-3 sm:p-4 text-center border border-gray-100", children: [
        /* @__PURE__ */ jsx(feature.icon, { className: `text-xl sm:text-2xl mx-auto ${feature.color}` }),
        /* @__PURE__ */ jsx("p", { className: "font-medium text-gray-900 text-xs sm:text-sm mt-1", children: feature.label }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500", children: feature.desc })
      ] }, feature.label)) })
    ] }),
    /* @__PURE__ */ jsx("footer", { className: "border-t border-gray-200 mt-8 sm:mt-12", children: /* @__PURE__ */ jsx("div", { className: "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 text-center text-xs sm:text-sm text-gray-500", children: "Identity Verification API v2.0 • Logica Technology" }) })
  ] });
}
function ConsentOverlay({ onAccept, onDecline }) {
  return /* @__PURE__ */ jsx("div", { className: "consent-overlay", children: /* @__PURE__ */ jsxs("div", { className: "consent-box", children: [
    /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold mb-2", children: "Privacy & Camera Consent" }),
    /* @__PURE__ */ jsx("p", { className: "mb-3 text-sm text-gray-700", children: "This verification will capture images to extract identity data (name, DOB, ID number). By continuing you consent to allow the camera to capture images and to send them to the verification service. Do not proceed if you do not consent." }),
    /* @__PURE__ */ jsx("p", { className: "mb-4 text-sm text-gray-700 font-semibold", children: "Image quality guidance:" }),
    /* @__PURE__ */ jsxs("ul", { className: "list-disc pl-5 mb-4 text-sm text-gray-700", children: [
      /* @__PURE__ */ jsx("li", { children: "Use good, even lighting — avoid strong backlight or heavy shadows." }),
      /* @__PURE__ */ jsx("li", { children: "Ensure the image is sharp and not blurred." }),
      /* @__PURE__ */ jsx("li", { children: "Make sure the entire document or face is visible and not cropped." }),
      /* @__PURE__ */ jsx("li", { children: "The document or photo must belong to you — do not submit someone else's ID or photo." })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end mt-3", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onDecline,
          className: "px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium",
          children: "Decline"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onAccept,
          className: "px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium",
          children: "I Consent & Start Camera"
        }
      )
    ] })
  ] }) });
}
function CameraSection({ cameraStarted, idType, onProblem }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState("Center your document");
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  useEffect(() => {
    if (cameraStarted && !stream) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStarted]);
  const startCamera = async () => {
    var _a, _b;
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      const facingMode = (_b = (_a = mediaStream.getVideoTracks()[0]) == null ? void 0 : _a.getSettings()) == null ? void 0 : _b.facingMode;
      setIsFrontCamera(facingMode === "user");
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setFeedbackMessage("Camera ready - position your document");
    } catch (err) {
      console.error("Camera error:", err);
      onProblem == null ? void 0 : onProblem("Failed to access camera: " + err.message, "error");
    }
  };
  const switchCamera = async () => {
    var _a, _b;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    try {
      const currentFacingMode = (_b = (_a = stream == null ? void 0 : stream.getVideoTracks()[0]) == null ? void 0 : _a.getSettings()) == null ? void 0 : _b.facingMode;
      const newFacingMode = currentFacingMode === "environment" ? "user" : "environment";
      const constraints = {
        video: {
          facingMode: { exact: newFacingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsFrontCamera(newFacingMode === "user");
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Switch camera error:", err);
      onProblem == null ? void 0 : onProblem("Failed to switch camera: " + err.message, "warn");
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "camera-section space-y-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "camera-container relative overflow-hidden bg-black shadow-sm", children: [
      /* @__PURE__ */ jsx(
        "video",
        {
          ref: videoRef,
          autoPlay: true,
          muted: true,
          playsInline: true,
          className: "h-64 w-full object-cover sm:h-72 md:h-80 lg:h-[26rem]",
          style: { transform: isFrontCamera ? "scaleX(-1)" : "none" }
        }
      ),
      /* @__PURE__ */ jsx("canvas", { ref: canvasRef, style: { display: "none" } }),
      /* @__PURE__ */ jsxs("div", { className: "overlay-container pointer-events-none absolute inset-0 flex items-center justify-center", children: [
        /* @__PURE__ */ jsx("div", { className: "guide-rectangle" }),
        /* @__PURE__ */ jsx("div", { className: "alignment-feedback absolute left-1/2 bottom-1/4 w-[94%] -translate-x-1/2 rounded-lg", children: /* @__PURE__ */ jsx("div", { className: "feedback-message", children: feedbackMessage }) })
      ] }),
      cameraStarted && /* @__PURE__ */ jsx("div", { className: "camera-controls flex flex-wrap items-center gap-3", children: /* @__PURE__ */ jsx(
        "button",
        {
          onClick: switchCamera,
          className: "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700",
          children: "Switch Camera"
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxs("div", { id: "hidden-data", "aria-hidden": "true", style: { display: "none" }, children: [
      /* @__PURE__ */ jsx("img", { id: "preview-image", alt: "preview", style: { display: "none" } }),
      /* @__PURE__ */ jsxs("select", { id: "id-type", defaultValue: idType, style: { display: "none" }, children: [
        /* @__PURE__ */ jsx("option", { value: "national-id", children: "National ID" }),
        /* @__PURE__ */ jsx("option", { value: "passport", children: "Passport" }),
        /* @__PURE__ */ jsx("option", { value: "umid", children: "UMID" })
      ] }),
      /* @__PURE__ */ jsx("select", { id: "ocr-type", style: { display: "none" }, children: /* @__PURE__ */ jsx("option", { value: "identity", children: "Identity Document" }) }),
      /* @__PURE__ */ jsx("img", { id: "captured-image", alt: "captured", style: { display: "none" } }),
      /* @__PURE__ */ jsx("div", { id: "results-container", style: { display: "none" } }),
      /* @__PURE__ */ jsx("div", { id: "loading", style: { display: "none" }, children: "Loading..." }),
      /* @__PURE__ */ jsx("pre", { id: "ocr-result", style: { display: "none" }, children: "{}" })
    ] })
  ] });
}
function ProblemAlert({ message, level = "warn", onClose }) {
  const isError = level === "error";
  return /* @__PURE__ */ jsx("div", { className: "problem-alert", children: /* @__PURE__ */ jsxs("div", { className: `problem-alert-box ${isError ? "error" : "warn"}`, children: [
    /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-start", children: [
      /* @__PURE__ */ jsx("strong", { className: "block mb-1", children: isError ? "Error" : "Notice" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onClose,
          className: "text-current opacity-60 hover:opacity-100",
          children: "×"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "text-sm leading-snug", children: message })
  ] }) });
}
function EmbedVerification({ initialState = {} }) {
  var _a, _b;
  const { id } = useParams();
  const [consentGiven, setConsentGiven] = useState(false);
  const [session, setSession] = useState(initialState.session || null);
  const [problem, setProblem] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const sessionId = id || session && session.id;
  const expectedOrigin = ((_a = initialState.config) == null ? void 0 : _a.expectedOrigin) || "*";
  useEffect(() => {
    if (!session && sessionId) {
      fetch(`/api/session/${sessionId}`).then((res) => res.json()).then((data) => setSession(data)).catch((err) => console.error("Failed to fetch session:", err));
    }
  }, [sessionId, session]);
  const handleConsentAccept = () => {
    setConsentGiven(true);
    setCameraStarted(true);
    if (typeof window !== "undefined") {
      window.__IDENTITY_CONSENT_GIVEN__ = true;
      window.__IDENTITY_EMBED__ = true;
    }
  };
  const handleConsentDecline = async () => {
    var _a2;
    setConsentGiven(false);
    setProblem({
      message: "You declined the camera consent. The verification has been cancelled.",
      level: "error"
    });
    if (typeof window !== "undefined" && window.parent !== window) {
      const payload = {
        identityOCR: {
          action: "verification_cancelled",
          status: "cancelled",
          reason: "consent_declined",
          session: sessionId,
          verificationType: ((_a2 = session == null ? void 0 : session.payload) == null ? void 0 : _a2.verificationType) || "combined"
        }
      };
      try {
        window.parent.postMessage(payload, expectedOrigin);
      } catch (e) {
        console.warn("[identity] consent decline notify failed", e);
      }
    }
    if (sessionId) {
      try {
        await fetch(`/api/verify/session/${sessionId}/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "cancelled",
            finishedAt: (/* @__PURE__ */ new Date()).toISOString()
          })
        });
      } catch (e) {
        console.warn("[identity] session cancel notify failed", e);
      }
    }
  };
  const reportProblem = (message, level = "warn") => {
    var _a2;
    setProblem({ message, level });
    setTimeout(() => setProblem(null), 6e3);
    if (typeof window !== "undefined" && window.parent !== window) {
      const payload = {
        identityOCR: {
          action: level === "error" ? "verification_failed" : "verification_problem",
          status: level === "error" ? "failed" : "warning",
          message,
          level,
          session: sessionId,
          verificationType: ((_a2 = session == null ? void 0 : session.payload) == null ? void 0 : _a2.verificationType) || "combined"
        }
      };
      try {
        window.parent.postMessage(payload, expectedOrigin);
      } catch (e) {
        console.warn("[identity] problem notify failed", e);
      }
    }
  };
  useEffect(() => {
    var _a2, _b2, _c, _d;
    if (typeof window !== "undefined") {
      window.__IDENTITY_SESSION__ = sessionId;
      window.__IDENTITY_EXPECTED_ORIGIN__ = expectedOrigin;
      window.__IDENTITY_SUCCESS_URL__ = ((_a2 = session == null ? void 0 : session.payload) == null ? void 0 : _a2.successUrl) || null;
      window.__IDENTITY_REQUESTED_ID_TYPE__ = ((_b2 = session == null ? void 0 : session.payload) == null ? void 0 : _b2.idType) || null;
      window.__IDENTITY_TEST_MODE__ = ((_c = session == null ? void 0 : session.payload) == null ? void 0 : _c.testMode) || false;
      window.__IDENTITY_AUTH_REQUIRED__ = ((_d = session == null ? void 0 : session.payload) == null ? void 0 : _d.authRequired) || false;
      window.reportCaptureProblem = reportProblem;
      window.clearCaptureProblem = () => setProblem(null);
    }
  }, [sessionId, expectedOrigin, session]);
  return /* @__PURE__ */ jsxs("div", { className: "app-container min-h-screen embed-mode", children: [
    /* @__PURE__ */ jsx("main", { className: "mx-auto max-w-7xl", children: /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-6 lg:grid-cols-2", children: /* @__PURE__ */ jsx(
      CameraSection,
      {
        cameraStarted,
        idType: ((_b = session == null ? void 0 : session.payload) == null ? void 0 : _b.idType) || "national-id",
        onProblem: reportProblem
      }
    ) }) }),
    !consentGiven && /* @__PURE__ */ jsx(
      ConsentOverlay,
      {
        onAccept: handleConsentAccept,
        onDecline: handleConsentDecline
      }
    ),
    problem && /* @__PURE__ */ jsx(
      ProblemAlert,
      {
        message: problem.message,
        level: problem.level,
        onClose: () => setProblem(null)
      }
    )
  ] });
}
const API_URL$2 = "/api/ocr/base64";
const ID_TYPES$2 = [
  { value: "national-id", label: "Philippine National ID", icon: "🇵🇭" },
  { value: "driver-license", label: "Driver's License", icon: "🚗" },
  { value: "passport", label: "Passport", icon: "✈️" },
  { value: "umid", label: "UMID", icon: "🆔" },
  { value: "philhealth", label: "PhilHealth ID", icon: "🏥" },
  { value: "tin-id", label: "TIN ID", icon: "📋" },
  { value: "postal-id", label: "Postal ID", icon: "📮" },
  { value: "pagibig", label: "Pag-IBIG ID", icon: "🏠" }
];
function IDVerificationTest() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [selectedIdType, setSelectedIdType] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState("Press Start to scan your ID");
  const [feedbackType, setFeedbackType] = useState("info");
  const [ocrResult, setOcrResult] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [openaiResult, setOpenaiResult] = useState(null);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [idTypeMismatch, setIdTypeMismatch] = useState(false);
  const [detectedIdType, setDetectedIdType] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [fieldValidationFailed, setFieldValidationFailed] = useState(false);
  const [imageQualityIssues, setImageQualityIssues] = useState([]);
  const [imageQualityFailed, setImageQualityFailed] = useState(false);
  useEffect(() => {
    return () => stopCamera();
  }, []);
  const startCamera = async () => {
    try {
      setFeedback("Starting camera...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            resolve();
          };
        });
        if (canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }
      }
      setCameraStarted(true);
      setFeedback("Position your ID within the frame");
      setFeedbackType("info");
    } catch (err) {
      console.error("Camera error:", err);
      setFeedback("Camera access failed: " + err.message);
      setFeedbackType("error");
    }
  };
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStarted(false);
  }, []);
  const fetchWithTimeout = (url, options, timeout = 15e3) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout))
    ]);
  };
  const captureID = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    setIsProcessing(true);
    setFeedback("Capturing...");
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.7);
    setCapturedImage(imageDataUrl);
    setFeedback("🤖 AI checking image quality...");
    setFeedbackType("info");
    try {
      const qualityRes = await fetchWithTimeout("/api/ai/id/quality-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl })
      }, 2e4);
      const qualityData = await qualityRes.json();
      console.log("[AI Quality Check] Full response:", JSON.stringify(qualityData, null, 2));
      if (!qualityData.success) {
        console.log("[AI Quality Check] API error:", qualityData.error);
        setImageQualityIssues(["Quality check failed: " + (qualityData.error || "Unknown error")]);
        setImageQualityFailed(true);
        setFeedback("Unable to verify image quality. Please try again.");
        setFeedbackType("error");
        setIsProcessing(false);
        return;
      }
      if (qualityData.result) {
        const { isAcceptable, issues, suggestion, details, confidence } = qualityData.result;
        console.log("[AI Quality Check] Decision:", { isAcceptable, confidence, issues, suggestion, details });
        if (!isAcceptable) {
          const issueList = [];
          if (issues && issues.length > 0) {
            issueList.push(...issues);
          }
          if (suggestion) {
            issueList.push("AI says: " + suggestion);
          }
          if (issueList.length === 0) {
            issueList.push("Image quality not acceptable");
          }
          setImageQualityIssues(issueList);
          setImageQualityFailed(true);
          setFeedback(suggestion || "Please retake the photo");
          setFeedbackType("error");
          setIsProcessing(false);
          return;
        }
      }
    } catch (qualityErr) {
      console.error("AI quality check error:", qualityErr);
      setImageQualityIssues(["quality_check_error: " + qualityErr.message]);
      setImageQualityFailed(true);
      setFeedback("Quality check failed. Please try again.");
      setFeedbackType("error");
      setIsProcessing(false);
      return;
    }
    stopCamera();
    await processImage(imageDataUrl);
  };
  const processImage = async (imageDataUrl) => {
    var _a, _b, _c, _d;
    const base64Data = imageDataUrl.split(",")[1];
    try {
      setFeedback("Processing ID...");
      setFeedbackType("info");
      const res = await fetchWithTimeout(API_URL$2, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Data,
          type: "identity",
          idType: selectedIdType || "unknown"
        })
      }, 3e4);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Processing failed");
      const extractedIdType = (((_a = data.fields) == null ? void 0 : _a.idType) || "").toLowerCase().replace(/[\s-_]/g, "");
      const selectedType = (selectedIdType || "").toLowerCase().replace(/[\s-_]/g, "");
      const normalizeIdType = (type) => {
        const typeMap = {
          // Philippine National ID aliases
          "philippinenationalid": "nationalid",
          "philippineidentificationcard": "nationalid",
          "philippineid": "nationalid",
          "nationalid": "nationalid",
          "philsys": "nationalid",
          "philsysid": "nationalid",
          "philsyscard": "nationalid",
          "psa": "nationalid",
          "psaid": "nationalid",
          // Driver's License aliases
          "driverslicense": "driverlicense",
          "driverlicense": "driverlicense",
          "driverslic": "driverlicense",
          "drivinglic": "driverlicense",
          "drivinglicense": "driverlicense",
          "ltolicense": "driverlicense",
          "lto": "driverlicense",
          // Passport aliases
          "passport": "passport",
          "philippinepassport": "passport",
          "phpassport": "passport",
          // UMID aliases
          "umid": "umid",
          "umidcard": "umid",
          "unifiedmultipurposeid": "umid",
          // PhilHealth aliases
          "philhealth": "philhealth",
          "philhealthid": "philhealth",
          "philhealthcard": "philhealth",
          "philippinehealthinsurance": "philhealth",
          // TIN ID aliases
          "tinid": "tinid",
          "tin": "tinid",
          "tincard": "tinid",
          "taxpayeridentificationnumber": "tinid",
          "taxid": "tinid",
          "bir": "tinid",
          "birid": "tinid",
          // Postal ID aliases
          "postalid": "postalid",
          "postal": "postalid",
          "postalcard": "postalid",
          "phlpostid": "postalid",
          "philpostid": "postalid",
          // Pag-IBIG aliases
          "pagibig": "pagibig",
          "pagibigid": "pagibig",
          "pagibigcard": "pagibig",
          "hdmf": "pagibig",
          "hdmfid": "pagibig"
        };
        return typeMap[type] || type;
      };
      const normalizedExtracted = normalizeIdType(extractedIdType);
      const normalizedSelected = normalizeIdType(selectedType);
      if (normalizedExtracted && normalizedSelected && normalizedExtracted !== normalizedSelected) {
        setDetectedIdType(((_b = data.fields) == null ? void 0 : _b.idType) || "Unknown");
        setIdTypeMismatch(true);
        setFeedback("ID type mismatch detected");
        setFeedbackType("error");
        setIsProcessing(false);
        return;
      }
      const requiredFieldsByIdType = {
        "national-id": ["fullName", "idNumber", "dateOfBirth"],
        "driver-license": ["fullName", "idNumber", "dateOfBirth"],
        "passport": ["fullName", "idNumber", "dateOfBirth", "nationality"],
        "umid": ["fullName", "idNumber", "dateOfBirth"],
        "philhealth": ["fullName", "idNumber"],
        "tin-id": ["fullName", "idNumber"],
        "postal-id": ["fullName", "idNumber"],
        "pagibig": ["fullName", "idNumber"]
      };
      const requiredFields = requiredFieldsByIdType[selectedIdType] || ["fullName", "idNumber"];
      const fields = data.fields || {};
      const missing = requiredFields.filter((field) => {
        const value = fields[field] || fields[field.toLowerCase()];
        if (field === "fullName" && !value) {
          return !(fields.name || fields.firstName || fields.lastName);
        }
        if (field === "dateOfBirth" && !value) {
          return !fields.birthDate;
        }
        return !value || value.trim() === "";
      });
      if (missing.length > 0) {
        setMissingFields(missing);
        setFieldValidationFailed(true);
        setFeedback("Required fields not detected");
        setFeedbackType("error");
        setIsProcessing(false);
        return;
      }
      setOcrResult({ text: data.rawText || ((_c = data.basicText) == null ? void 0 : _c.text) || "" });
      setAiResult({ data: data.fields || {} });
      if ((_d = data.openai) == null ? void 0 : _d.parsed) {
        setOpenaiResult(data.openai.parsed);
      }
      setFeedback("Done!");
      setFeedbackType("success");
      setVerificationComplete(true);
    } catch (err) {
      console.error("Processing error:", err);
      setFeedback("Failed: " + err.message);
      setFeedbackType("error");
      setIsProcessing(false);
    }
  };
  const downloadImage = () => {
    if (!capturedImage) return;
    const link = document.createElement("a");
    link.href = capturedImage;
    link.download = `id-scan-${Date.now()}.jpg`;
    link.click();
  };
  const handleRecapture = () => {
    setCapturedImage(null);
    setOcrResult(null);
    setAiResult(null);
    setOpenaiResult(null);
    setIdTypeMismatch(false);
    setDetectedIdType(null);
    setFieldValidationFailed(false);
    setMissingFields([]);
    setImageQualityFailed(false);
    setImageQualityIssues([]);
    setFeedback("Position your ID within the frame");
    setFeedbackType("info");
    setIsProcessing(false);
    startCamera();
  };
  const renderField = (label, value) => {
    if (!value) return null;
    return /* @__PURE__ */ jsxs("div", { className: "flex justify-between py-2 border-b border-gray-100 last:border-0", children: [
      /* @__PURE__ */ jsx("span", { className: "text-gray-500 text-sm", children: label }),
      /* @__PURE__ */ jsx("span", { className: "text-gray-900 font-medium text-sm text-right max-w-[60%]", children: value })
    ] });
  };
  const getIdTypeLabel2 = (value) => {
    const found = ID_TYPES$2.find((t) => t.value === value);
    return found ? found.label : value;
  };
  if (!selectedIdType) {
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsxs("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-between", children: [
        /* @__PURE__ */ jsx("a", { href: "/", className: "p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }),
        /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "ID Verification" }),
        /* @__PURE__ */ jsx("div", { className: "w-10" })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "max-w-lg mx-auto p-4 space-y-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center pt-4 pb-2", children: [
          /* @__PURE__ */ jsx("div", { className: "w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-blue-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" }) }) }),
          /* @__PURE__ */ jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-2", children: "Select ID Type" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600", children: "Choose the type of ID you want to scan for accurate extraction" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3", children: ID_TYPES$2.map((idType) => /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setSelectedIdType(idType.value),
            className: "bg-white rounded-2xl p-4 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 text-left border-2 border-transparent hover:border-blue-500 group",
            children: [
              /* @__PURE__ */ jsx("div", { className: "text-3xl mb-2", children: idType.icon }),
              /* @__PURE__ */ jsx("div", { className: "font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-600 transition-colors", children: idType.label })
            ]
          },
          idType.value
        )) }),
        /* @__PURE__ */ jsxs("div", { className: "bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "text-amber-500 flex-shrink-0", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold text-amber-800 text-sm", children: "Why select ID type?" }),
            /* @__PURE__ */ jsx("div", { className: "text-amber-700 text-xs mt-1", children: "Each ID has different formats and fields. Selecting the correct type helps our AI extract information more accurately." })
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "a",
          {
            href: "/",
            className: "block w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition text-center",
            children: "Back to Home"
          }
        )
      ] })
    ] });
  }
  if (imageQualityFailed && capturedImage) {
    const issueLabels = {
      "no_id_detected": "No ID card detected in image",
      "partial_visible": "ID is partially cut off or cropped",
      "not_centered": "ID is not centered in frame",
      "has_obstacles": "Fingers or objects blocking the ID",
      "text_partially_blocked": "Some text or letters are covered",
      "name_partially_visible": "Name field is partially blocked",
      "id_number_partially_visible": "ID number is partially blocked",
      "is_blurry": "Image is blurry or out of focus",
      "has_glare": "Light reflection or glare detected",
      "too_dark": "Image is too dark",
      "too_bright": "Image is overexposed",
      "text_not_readable": "Text on ID is not readable",
      "face_not_visible": "Face photo on ID is not clear",
      "quality_check_error": "Quality check failed - please try again",
      "Quality check failed": "Unable to verify image quality",
      "Image quality not acceptable": "Image quality not acceptable"
    };
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 flex flex-col", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsxs("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-between", children: [
        /* @__PURE__ */ jsx("a", { href: "/", className: "p-2 -ml-2 text-gray-600", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }),
        /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "Image Quality Issue" }),
        /* @__PURE__ */ jsx("div", { className: "w-10" })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center mb-4", children: [
          /* @__PURE__ */ jsx("div", { className: "w-16 h-16 mx-auto bg-orange-500 rounded-full flex items-center justify-center mb-3 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-8 h-8 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }) }),
          /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold text-gray-900", children: "Image Quality Issue" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-1 text-sm", children: "The captured image has problems" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-3 mb-4", children: [
          /* @__PURE__ */ jsx("div", { className: "text-xs font-medium text-gray-500 mb-2", children: "Captured Image:" }),
          /* @__PURE__ */ jsxs("div", { className: "relative rounded-lg overflow-hidden border-2 border-orange-300", children: [
            /* @__PURE__ */ jsx(
              "img",
              {
                src: capturedImage,
                alt: "Captured ID",
                className: "w-full h-auto"
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "absolute inset-0 border-4 border-orange-500/50 rounded-lg pointer-events-none" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-4 mb-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "text-sm font-semibold text-red-600 mb-3 flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
            "Issues Detected:"
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-2", children: imageQualityIssues.map((issue, index) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 text-orange-700 bg-orange-50 p-2 rounded-lg", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-5 h-5 flex-shrink-0 mt-0.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: issueLabels[issue] || issue })
          ] }, index)) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "text-blue-500 flex-shrink-0", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold text-blue-800 text-sm", children: "Tips for better capture" }),
            /* @__PURE__ */ jsxs("div", { className: "text-blue-700 text-xs mt-1", children: [
              "• Make sure the entire ID is visible - don't crop any edges",
              /* @__PURE__ */ jsx("br", {}),
              "• Avoid light reflection or glare on the ID surface",
              /* @__PURE__ */ jsx("br", {}),
              "• Keep fingers and objects away from the ID",
              /* @__PURE__ */ jsx("br", {}),
              "• Hold the camera steady for a sharp, focused image",
              /* @__PURE__ */ jsx("br", {}),
              "• Use good, even lighting without shadows"
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: handleRecapture,
            className: "w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2",
            children: [
              /* @__PURE__ */ jsxs("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }),
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })
              ] }),
              "Recapture ID"
            ]
          }
        )
      ] }) })
    ] });
  }
  if (idTypeMismatch && capturedImage) {
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex flex-col", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsxs("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-between", children: [
        /* @__PURE__ */ jsx("a", { href: "/", className: "p-2 -ml-2 text-gray-600", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }),
        /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "Verification Failed" }),
        /* @__PURE__ */ jsx("div", { className: "w-10" })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center mb-6", children: [
          /* @__PURE__ */ jsx("div", { className: "w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center mb-4 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M6 18L18 6M6 6l12 12" }) }) }),
          /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "ID Type Mismatch" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-2", children: "The scanned ID does not match your selection" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bg-white rounded-2xl shadow-xl p-4 mb-6", children: /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center py-2 border-b border-gray-100", children: [
            /* @__PURE__ */ jsx("span", { className: "text-gray-500 text-sm", children: "Selected ID Type" }),
            /* @__PURE__ */ jsx("span", { className: "text-blue-600 font-semibold text-sm", children: getIdTypeLabel2(selectedIdType) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center py-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-gray-500 text-sm", children: "Detected ID Type" }),
            /* @__PURE__ */ jsx("span", { className: "text-red-600 font-semibold text-sm", children: detectedIdType })
          ] })
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "text-amber-500 flex-shrink-0", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold text-amber-800 text-sm", children: "What to do?" }),
            /* @__PURE__ */ jsx("div", { className: "text-amber-700 text-xs mt-1", children: "Please make sure you selected the correct ID type or scan the ID that matches your selection." })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: handleRecapture,
              className: "w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2",
              children: [
                /* @__PURE__ */ jsxs("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                  /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }),
                  /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })
                ] }),
                "Recapture ID"
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setIdTypeMismatch(false);
                setSelectedIdType(null);
                setCapturedImage(null);
              },
              className: "w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition",
              children: "Change ID Type"
            }
          )
        ] })
      ] }) })
    ] });
  }
  if (fieldValidationFailed && capturedImage) {
    const fieldLabels = {
      fullName: "Full Name",
      idNumber: "ID Number",
      dateOfBirth: "Date of Birth",
      nationality: "Nationality",
      address: "Address",
      sex: "Sex",
      expiryDate: "Expiry Date",
      issueDate: "Issue Date"
    };
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex flex-col", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsxs("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-between", children: [
        /* @__PURE__ */ jsx("a", { href: "/", className: "p-2 -ml-2 text-gray-600", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }),
        /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "Verification Failed" }),
        /* @__PURE__ */ jsx("div", { className: "w-10" })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center mb-6", children: [
          /* @__PURE__ */ jsx("div", { className: "w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center mb-4 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }) }),
          /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Missing Required Fields" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-2", children: "Could not extract all required information from the ID" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-4 mb-6", children: [
          /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold text-gray-700 mb-3", children: "Missing Fields:" }),
          /* @__PURE__ */ jsx("div", { className: "space-y-2", children: missingFields.map((field, index) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-red-600", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-sm", children: fieldLabels[field] || field })
          ] }, index)) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "text-amber-500 flex-shrink-0", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold text-amber-800 text-sm", children: "Tips for better results" }),
            /* @__PURE__ */ jsxs("div", { className: "text-amber-700 text-xs mt-1", children: [
              "• Ensure good lighting without glare",
              /* @__PURE__ */ jsx("br", {}),
              "• Keep the ID flat and fully visible",
              /* @__PURE__ */ jsx("br", {}),
              "• Make sure text is clear and readable"
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: handleRecapture,
              className: "w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2",
              children: [
                /* @__PURE__ */ jsxs("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                  /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }),
                  /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })
                ] }),
                "Recapture ID"
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setFieldValidationFailed(false);
                setSelectedIdType(null);
                setCapturedImage(null);
                setMissingFields([]);
              },
              className: "w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition",
              children: "Change ID Type"
            }
          )
        ] })
      ] }) })
    ] });
  }
  if (verificationComplete && capturedImage) {
    const data = (aiResult == null ? void 0 : aiResult.data) || aiResult || {};
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-green-50", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsxs("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-between", children: [
        /* @__PURE__ */ jsx("a", { href: "/", className: "p-2 -ml-2 text-gray-600", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }),
        /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "ID Verification Result" }),
        /* @__PURE__ */ jsx("div", { className: "w-10" })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "max-w-lg mx-auto p-4 space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-green-500 text-white rounded-2xl p-4 flex items-center gap-4", children: [
          /* @__PURE__ */ jsx("div", { className: "w-12 h-12 bg-white/20 rounded-full flex items-center justify-center", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M5 13l4 4L19 7" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-bold text-lg", children: "Verification Complete" }),
            /* @__PURE__ */ jsx("div", { className: "text-white/80 text-sm", children: "ID document processed successfully" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bg-white rounded-2xl shadow-lg overflow-hidden", children: /* @__PURE__ */ jsx("img", { src: capturedImage, alt: "Scanned ID", className: "w-full aspect-video object-contain bg-gray-100" }) }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-lg p-4", children: [
          /* @__PURE__ */ jsxs("h2", { className: "font-bold text-gray-900 mb-3 flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-5 h-5 text-blue-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }),
            "Extracted Information"
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "divide-y divide-gray-100", children: [
            renderField("Full Name", data.fullName || data.name),
            renderField("First Name", data.firstName),
            renderField("Middle Name", data.middleName),
            renderField("Last Name", data.lastName),
            renderField("ID Number", data.idNumber),
            renderField("Date of Birth", data.dateOfBirth || data.birthDate),
            renderField("Sex", data.sex),
            renderField("Address", data.address),
            renderField("Nationality", data.nationality),
            renderField("Expiry Date", data.expiryDate),
            renderField("Issue Date", data.issueDate)
          ] })
        ] }),
        (ocrResult == null ? void 0 : ocrResult.text) && /* @__PURE__ */ jsxs("details", { className: "bg-white rounded-2xl shadow-lg", children: [
          /* @__PURE__ */ jsxs("summary", { className: "p-4 cursor-pointer font-bold text-gray-900 flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-5 h-5 text-purple-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }),
            "Raw OCR Text"
          ] }),
          /* @__PURE__ */ jsx("div", { className: "px-4 pb-4", children: /* @__PURE__ */ jsx("pre", { className: "bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-40", children: ocrResult.text }) })
        ] }),
        openaiResult && /* @__PURE__ */ jsxs("details", { className: "bg-white rounded-2xl shadow-lg", children: [
          /* @__PURE__ */ jsxs("summary", { className: "p-4 cursor-pointer font-bold text-gray-900 flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-5 h-5 text-green-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }) }),
            "OpenAI Extraction"
          ] }),
          /* @__PURE__ */ jsx("div", { className: "px-4 pb-4", children: /* @__PURE__ */ jsx("pre", { className: "bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-40", children: JSON.stringify(openaiResult, null, 2) }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-3 pt-2", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: downloadImage,
              className: "w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2",
              children: [
                /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }),
                "Download ID Image"
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "a",
            {
              href: "/",
              className: "block w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition text-center",
              children: "Done"
            }
          )
        ] })
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 bg-black flex flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex-1 relative", children: [
      /* @__PURE__ */ jsx(
        "video",
        {
          ref: videoRef,
          autoPlay: true,
          muted: true,
          playsInline: true,
          className: "absolute inset-0 w-full h-full object-cover"
        }
      ),
      /* @__PURE__ */ jsx("canvas", { ref: canvasRef, className: "hidden" }),
      /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 pointer-events-none", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent" }),
        /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: `w-80 h-52 sm:w-96 sm:h-60 border-4 rounded-2xl transition-all duration-300 ${capturedImage ? "border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.5)]" : "border-white/70 border-dashed"}`
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" }),
          /* @__PURE__ */ jsx("div", { className: "absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" }),
          /* @__PURE__ */ jsx("div", { className: "absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" }),
          /* @__PURE__ */ jsx("div", { className: "absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" })
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "absolute top-4 left-4 right-4 pointer-events-auto", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsx("a", { href: "/", className: "p-2 bg-white/20 backdrop-blur rounded-full", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }),
          /* @__PURE__ */ jsxs("div", { className: "px-3 py-1 bg-blue-500/80 backdrop-blur rounded-full text-white text-xs font-medium flex items-center gap-1", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" }) }),
            getIdTypeLabel2(selectedIdType)
          ] })
        ] }) }),
        cameraStarted && !capturedImage && /* @__PURE__ */ jsx("div", { className: "absolute top-20 left-6 right-6 text-center", children: /* @__PURE__ */ jsx("div", { className: "text-white/80 text-sm", children: "Align your ID card within the frame" }) })
      ] }),
      isProcessing && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/70 flex items-center justify-center z-20", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" }),
        /* @__PURE__ */ jsx("div", { className: "text-white font-medium", children: feedback })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "relative z-10 px-6 pb-8 pt-4", children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          className: `mb-4 py-3 px-4 rounded-xl text-center font-medium ${feedbackType === "success" ? "bg-green-500 text-white" : feedbackType === "error" ? "bg-red-500 text-white" : feedbackType === "warning" ? "bg-yellow-500 text-black" : "bg-white/20 backdrop-blur text-white"}`,
          children: feedback
        }
      ),
      !cameraStarted ? /* @__PURE__ */ jsx(
        "button",
        {
          onClick: startCamera,
          className: "w-full py-4 bg-white text-black font-bold text-lg rounded-2xl hover:bg-gray-100 transition",
          children: "Start Camera"
        }
      ) : /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: stopCamera,
            className: "flex-1 py-4 bg-red-500/80 text-white font-bold rounded-2xl hover:bg-red-600 transition",
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: captureID,
            disabled: isProcessing,
            className: "flex-[2] py-4 bg-white text-black font-bold text-lg rounded-2xl hover:bg-gray-100 transition disabled:opacity-50 flex items-center justify-center gap-2",
            children: [
              /* @__PURE__ */ jsxs("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }),
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })
              ] }),
              "Capture"
            ]
          }
        )
      ] }),
      cameraStarted && /* @__PURE__ */ jsxs("div", { className: "flex justify-center gap-4 mt-4 text-white/60 text-xs", children: [
        /* @__PURE__ */ jsx("span", { children: "• Good lighting" }),
        /* @__PURE__ */ jsx("span", { children: "• Keep steady" }),
        /* @__PURE__ */ jsx("span", { children: "• Fill frame" })
      ] }),
      !cameraStarted && /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setSelectedIdType(null),
          className: "w-full mt-3 py-3 bg-white/10 backdrop-blur text-white/80 font-medium rounded-xl hover:bg-white/20 transition text-sm",
          children: "← Change ID Type"
        }
      )
    ] })
  ] });
}
const MOVEMENT_THRESHOLD$1 = 8;
const LIVENESS_REQUIRED_SCORE$1 = 70;
const CENTER_TOLERANCE$2 = 0.2;
const REQUIRED_CENTERED_FRAMES$2 = 10;
const MAX_FRAME_HISTORY$1 = 30;
const MIN_FACE_CONFIDENCE$2 = 0.5;
const MIN_FACE_SIZE_RATIO$2 = 0.25;
const MAX_FACE_SIZE_RATIO$2 = 0.55;
const MIN_MICRO_MOVEMENT$1 = 0.3;
const MAX_STATIC_FRAMES$1 = 15;
const HEAD_POSE_VARIANCE_MIN$1 = 0.5;
const REQUIRED_EXPRESSIONS = ["happy", "angry"];
const EXPRESSION_CONFIDENCE_THRESHOLD = 0.5;
function SelfieLivenessTest() {
  const faceVideoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const faceStreamRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const frameHistoryRef = useRef([]);
  const lastFacePositionRef = useRef(null);
  const centeredFrameCountRef = useRef(0);
  const expressionChangeRef = useRef(false);
  const livenessScoreRef = useRef(0);
  const isRunningRef = useRef(false);
  const modelsLoadedRef = useRef(false);
  const staticFrameCountRef = useRef(0);
  const lastLandmarksRef = useRef(null);
  const headPoseHistoryRef = useRef([]);
  const spoofDetectedRef = useRef(false);
  const detectedExpressionsRef = useRef(/* @__PURE__ */ new Set());
  const currentExpressionRef = useRef(null);
  const expressionHoldCountRef = useRef(0);
  const EXPRESSION_HOLD_REQUIRED = 3;
  const [faceDetectionStarted, setFaceDetectionStarted] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [faceFeedback, setFaceFeedback] = useState("Press Start to begin");
  const [faceFeedbackType, setFaceFeedbackType] = useState("info");
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [steadySeconds, setSteadySeconds] = useState(0);
  const [isCentered, setIsCentered] = useState(false);
  const [currentExpression, setCurrentExpression] = useState("");
  const [detectedExpressions, setDetectedExpressions] = useState([]);
  const [requiredExpression, setRequiredExpression] = useState(null);
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [faceBox, setFaceBox] = useState(null);
  const overlayCanvasRef = useRef(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    return () => stopFaceDetection();
  }, []);
  useEffect(() => {
    const loadModels = async () => {
      try {
        setFaceFeedback("Loading AI models...");
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        modelsLoadedRef.current = true;
        setModelsLoaded(true);
        setFaceFeedback("Press Start to begin");
        console.log("Face-api.js models loaded");
      } catch (err) {
        console.error("Error loading models:", err);
        setFaceFeedback("Failed to load AI models");
        setFaceFeedbackType("error");
      }
    };
    loadModels();
  }, []);
  const startFaceDetection = async () => {
    var _a, _b;
    if (!modelsLoadedRef.current) {
      setFaceFeedback("AI models loading...");
      setFaceFeedbackType("warning");
      return;
    }
    try {
      setFaceFeedback("Starting camera...");
      if (!((_a = navigator.mediaDevices) == null ? void 0 : _a.getUserMedia)) {
        throw new Error("Camera not available. Use HTTPS.");
      }
      const cameraConfigs = [
        { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } } },
        { video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } } },
        { video: { facingMode: "user" } },
        { video: true }
      ];
      let mediaStream = null;
      let lastError = null;
      for (const config of cameraConfigs) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(config);
          console.log("Camera started with config:", config);
          break;
        } catch (err) {
          lastError = err;
          console.warn("Camera config failed:", config, err.message);
        }
      }
      if (!mediaStream) {
        throw lastError || new Error("Could not access camera");
      }
      faceStreamRef.current = mediaStream;
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = mediaStream;
        await new Promise((resolve) => {
          faceVideoRef.current.onloadedmetadata = () => {
            faceVideoRef.current.play();
            resolve();
          };
        });
        if (faceCanvasRef.current) {
          faceCanvasRef.current.width = faceVideoRef.current.videoWidth;
          faceCanvasRef.current.height = faceVideoRef.current.videoHeight;
        }
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = faceVideoRef.current.videoWidth;
          overlayCanvasRef.current.height = faceVideoRef.current.videoHeight;
        }
      }
      frameHistoryRef.current = [];
      lastFacePositionRef.current = null;
      centeredFrameCountRef.current = 0;
      expressionChangeRef.current = false;
      livenessScoreRef.current = 0;
      isRunningRef.current = true;
      staticFrameCountRef.current = 0;
      lastLandmarksRef.current = null;
      headPoseHistoryRef.current = [];
      spoofDetectedRef.current = false;
      detectedExpressionsRef.current = /* @__PURE__ */ new Set();
      currentExpressionRef.current = null;
      expressionHoldCountRef.current = 0;
      setFaceDetectionStarted(true);
      setLivenessScore(0);
      setCapturedFace(null);
      setFaceVerified(false);
      setIsCentered(false);
      setCurrentExpression("");
      setDetectedExpressions([]);
      setRequiredExpression(REQUIRED_EXPRESSIONS[0]);
      setFaceFeedback("😊 Please SMILE at the camera");
      startLivenessDetection();
    } catch (err) {
      console.error("Camera error:", err);
      let errorMsg = err.message || "Camera access failed";
      if (err.name === "NotAllowedError") {
        errorMsg = "Camera permission denied. Please allow camera access.";
      } else if (err.name === "NotFoundError") {
        errorMsg = "No camera found. Please connect a camera.";
      } else if (err.name === "NotReadableError" || ((_b = err.message) == null ? void 0 : _b.includes("Could not start"))) {
        errorMsg = "Camera is in use by another app. Please close other apps using the camera.";
      } else if (err.name === "OverconstrainedError") {
        errorMsg = "Camera does not support requested settings.";
      } else if (!window.isSecureContext) {
        errorMsg = "Camera requires HTTPS. Use localhost or enable HTTPS.";
      }
      setFaceFeedback(errorMsg);
      setFaceFeedbackType("error");
    }
  };
  const stopFaceDetection = useCallback(() => {
    isRunningRef.current = false;
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach((t) => t.stop());
      faceStreamRef.current = null;
    }
    if (faceVideoRef.current) faceVideoRef.current.srcObject = null;
    frameHistoryRef.current = [];
    livenessScoreRef.current = 0;
    centeredFrameCountRef.current = 0;
    setFaceDetectionStarted(false);
  }, []);
  const handleStartClick = () => {
    if (!consentGiven) {
      setShowConsentModal(true);
      setFaceFeedback("Please provide consent to begin");
      setFaceFeedbackType("warning");
      return;
    }
    if (!showGuide) {
      setShowGuide(true);
      return;
    }
    startFaceDetection();
  };
  const acceptConsent = () => {
    setConsentGiven(true);
    setShowConsentModal(false);
    setShowGuide(true);
    setFaceFeedback("Consent accepted — showing quick guide");
    setFaceFeedbackType("info");
  };
  const declineConsent = () => {
    setConsentGiven(false);
    setShowConsentModal(false);
    setFaceFeedback("Consent is required to perform face verification");
    setFaceFeedbackType("error");
  };
  const proceedFromGuide = () => {
    setShowGuide(false);
    startFaceDetection();
  };
  const isProcessingRef = useRef(false);
  const startLivenessDetection = () => {
    if (faceDetectionIntervalRef.current) clearInterval(faceDetectionIntervalRef.current);
    faceDetectionIntervalRef.current = setInterval(async () => {
      if (!isRunningRef.current || isProcessingRef.current) return;
      isProcessingRef.current = true;
      try {
        await analyzeLiveness();
      } finally {
        isProcessingRef.current = false;
      }
    }, 250);
  };
  const analyzeLiveness = async () => {
    const video = faceVideoRef.current;
    if (!video || video.readyState < 2) return;
    try {
      const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
        scoreThreshold: MIN_FACE_CONFIDENCE$2,
        inputSize: 224
        // Smaller input size for faster processing
      })).withFaceLandmarks().withFaceExpressions();
      if (!detections) {
        setFaceFeedback("👤 Position your face in the oval");
        setFaceFeedbackType("warning");
        livenessScoreRef.current = Math.max(0, livenessScoreRef.current - 5);
        setLivenessScore(Math.round(livenessScoreRef.current));
        setIsCentered(false);
        centeredFrameCountRef.current = 0;
        setFaceLandmarks(null);
        setFaceBox(null);
        clearOverlayCanvas();
        return;
      }
      const { detection, landmarks, expressions } = detections;
      const box = detection.box;
      const dominantExpression = Object.entries(expressions).reduce((a, b) => a[1] > b[1] ? a : b);
      setCurrentExpression(dominantExpression[0]);
      setFaceBox(box);
      setFaceLandmarks(landmarks);
      if (livenessScoreRef.current > 0) {
        drawFaceLandmarks(landmarks, box);
      } else {
        clearOverlayCanvas();
      }
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const videoCenterX = videoWidth / 2;
      const videoCenterY = videoHeight / 2;
      const offsetX = Math.abs(faceCenterX - videoCenterX) / videoWidth;
      const offsetY = Math.abs(faceCenterY - videoCenterY) / videoHeight;
      const faceIsCentered = offsetX < CENTER_TOLERANCE$2 && offsetY < CENTER_TOLERANCE$2;
      setIsCentered(faceIsCentered);
      const faceSizeRatio = box.height / videoHeight;
      const isTooClose = faceSizeRatio > MAX_FACE_SIZE_RATIO$2;
      const isTooFar = faceSizeRatio < MIN_FACE_SIZE_RATIO$2;
      const faceIsProperSize = !isTooClose && !isTooFar;
      let movement = 0;
      if (lastFacePositionRef.current) {
        movement = Math.abs(faceCenterX - lastFacePositionRef.current.x) + Math.abs(faceCenterY - lastFacePositionRef.current.y) + Math.abs(box.width - lastFacePositionRef.current.width);
      }
      lastFacePositionRef.current = { x: faceCenterX, y: faceCenterY, width: box.width };
      const leftEAR = getEyeAspectRatio(landmarks.getLeftEye());
      const rightEAR = getEyeAspectRatio(landmarks.getRightEye());
      const avgEyeRatio = (leftEAR + rightEAR) / 2;
      let microMovement = 0;
      const currentLandmarks = landmarks.positions;
      if (lastLandmarksRef.current && currentLandmarks.length === lastLandmarksRef.current.length) {
        for (let i = 0; i < currentLandmarks.length; i++) {
          microMovement += Math.abs(currentLandmarks[i].x - lastLandmarksRef.current[i].x);
          microMovement += Math.abs(currentLandmarks[i].y - lastLandmarksRef.current[i].y);
        }
        microMovement /= currentLandmarks.length;
      }
      lastLandmarksRef.current = currentLandmarks.map((p) => ({ x: p.x, y: p.y }));
      if (microMovement < MIN_MICRO_MOVEMENT$1 && microMovement > 0) {
        staticFrameCountRef.current++;
      } else {
        staticFrameCountRef.current = Math.max(0, staticFrameCountRef.current - 1);
      }
      const noseTip = landmarks.getNose()[3];
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const eyeCenterX = (leftEye[0].x + rightEye[3].x) / 2;
      const eyeCenterY = (leftEye[0].y + rightEye[3].y) / 2;
      const headPoseX = noseTip.x - eyeCenterX;
      const headPoseY = noseTip.y - eyeCenterY;
      headPoseHistoryRef.current.push({ x: headPoseX, y: headPoseY });
      if (headPoseHistoryRef.current.length > 15) headPoseHistoryRef.current.shift();
      let headPoseVariance = 0;
      if (headPoseHistoryRef.current.length >= 10) {
        const poses = headPoseHistoryRef.current;
        const meanX = poses.reduce((s, p) => s + p.x, 0) / poses.length;
        const meanY = poses.reduce((s, p) => s + p.y, 0) / poses.length;
        headPoseVariance = poses.reduce((s, p) => s + Math.pow(p.x - meanX, 2) + Math.pow(p.y - meanY, 2), 0) / poses.length;
      }
      frameHistoryRef.current.push({
        timestamp: Date.now(),
        faceCenterX,
        faceCenterY,
        faceWidth: box.width,
        eyeRatio: avgEyeRatio,
        expression: dominantExpression[0],
        confidence: detection.score
      });
      if (frameHistoryRef.current.length > MAX_FRAME_HISTORY$1) frameHistoryRef.current.shift();
      let indicators = 0;
      if (detection.score > MIN_FACE_CONFIDENCE$2) indicators++;
      if (movement > MOVEMENT_THRESHOLD$1) indicators++;
      const currentExpr = dominantExpression[0];
      const currentExprConfidence = dominantExpression[1];
      setCurrentExpression(currentExpr);
      const nextRequiredExpr = REQUIRED_EXPRESSIONS.find((expr) => !detectedExpressionsRef.current.has(expr));
      if (nextRequiredExpr && currentExprConfidence >= EXPRESSION_CONFIDENCE_THRESHOLD) {
        if (currentExpr === nextRequiredExpr) {
          if (currentExpressionRef.current === currentExpr) {
            expressionHoldCountRef.current++;
          } else {
            currentExpressionRef.current = currentExpr;
            expressionHoldCountRef.current = 1;
          }
          if (expressionHoldCountRef.current >= EXPRESSION_HOLD_REQUIRED) {
            detectedExpressionsRef.current.add(currentExpr);
            setDetectedExpressions([...detectedExpressionsRef.current]);
            console.log(`Expression '${currentExpr}' detected! Completed: ${detectedExpressionsRef.current.size}/${REQUIRED_EXPRESSIONS.length}`);
            const nextExpr = REQUIRED_EXPRESSIONS.find((expr) => !detectedExpressionsRef.current.has(expr));
            setRequiredExpression(nextExpr || null);
            expressionHoldCountRef.current = 0;
            currentExpressionRef.current = null;
          }
        } else {
          currentExpressionRef.current = null;
          expressionHoldCountRef.current = 0;
        }
      }
      const allExpressionsCompleted = REQUIRED_EXPRESSIONS.every((expr) => detectedExpressionsRef.current.has(expr));
      if (allExpressionsCompleted) expressionChangeRef.current = true;
      if (frameHistoryRef.current.length >= 5) {
        const xPos = frameHistoryRef.current.slice(-10).map((f) => f.faceCenterX);
        const mean = xPos.reduce((a, b) => a + b, 0) / xPos.length;
        const variance = xPos.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / xPos.length;
        if (variance > 5) indicators++;
      }
      if (allExpressionsCompleted) indicators += 2;
      if (expressionChangeRef.current) indicators++;
      const isTooStatic = staticFrameCountRef.current > MAX_STATIC_FRAMES$1;
      const hasNoHeadMovement = headPoseHistoryRef.current.length >= 10 && headPoseVariance < HEAD_POSE_VARIANCE_MIN$1;
      const potentialSpoof = isTooStatic && hasNoHeadMovement && !allExpressionsCompleted;
      if (potentialSpoof && !allExpressionsCompleted) {
        indicators = Math.max(0, indicators - 1);
        spoofDetectedRef.current = true;
      } else if (allExpressionsCompleted || microMovement > MIN_MICRO_MOVEMENT$1) {
        spoofDetectedRef.current = false;
      }
      if (faceIsCentered) centeredFrameCountRef.current++;
      else centeredFrameCountRef.current = 0;
      const frameScore = indicators / 6 * 100;
      livenessScoreRef.current = livenessScoreRef.current * 0.7 + frameScore * 0.3;
      const score = Math.round(livenessScoreRef.current);
      setLivenessScore(score);
      const remaining = Math.max(0, Math.ceil((REQUIRED_CENTERED_FRAMES$2 - centeredFrameCountRef.current) * 0.2));
      setSteadySeconds(remaining);
      const getExpressionEmoji = (expr) => {
        switch (expr) {
          case "happy":
            return "😊";
          case "angry":
            return "😠";
          default:
            return "😐";
        }
      };
      const getExpressionName = (expr) => {
        switch (expr) {
          case "happy":
            return "SMILE";
          case "angry":
            return "ANGRY FACE";
          default:
            return expr.toUpperCase();
        }
      };
      if (!faceIsCentered) {
        const moveHorizontal = offsetX >= CENTER_TOLERANCE$2;
        const moveVertical = offsetY >= CENTER_TOLERANCE$2;
        if (moveHorizontal && moveVertical) {
          const hDir = faceCenterX < videoCenterX ? "← Move left" : "→ Move right";
          const vDir = faceCenterY < videoCenterY ? "↓ Move down" : "↑ Move up";
          setFaceFeedback(`${hDir} and ${vDir}`);
        } else if (moveHorizontal) {
          setFaceFeedback(faceCenterX < videoCenterX ? "← Move left" : "→ Move right");
        } else if (moveVertical) {
          setFaceFeedback(faceCenterY < videoCenterY ? "↓ Move face down" : "↑ Move face up");
        }
        setFaceFeedbackType("warning");
      } else if (isTooClose) {
        setFaceFeedback("📏 Move back, too close");
        setFaceFeedbackType("warning");
      } else if (isTooFar) {
        setFaceFeedback("📏 Move closer to camera");
        setFaceFeedbackType("warning");
      } else if (spoofDetectedRef.current) {
        if (staticFrameCountRef.current > MAX_STATIC_FRAMES$1) {
          setFaceFeedback("🚫 Move your head slightly");
        } else {
          setFaceFeedback("🚫 Please use a real face, not a photo");
        }
        setFaceFeedbackType("error");
      } else if (!allExpressionsCompleted) {
        const nextExpr = REQUIRED_EXPRESSIONS.find((expr) => !detectedExpressionsRef.current.has(expr));
        const completed = detectedExpressionsRef.current.size;
        const total = REQUIRED_EXPRESSIONS.length;
        const emoji = getExpressionEmoji(nextExpr);
        const name = getExpressionName(nextExpr);
        setFaceFeedback(`${emoji} Please show ${name} (${completed}/${total} done)`);
        setFaceFeedbackType("info");
      } else if (score < LIVENESS_REQUIRED_SCORE$1) {
        setFaceFeedback("🔄 Keep looking at the camera...");
        setFaceFeedbackType("info");
      } else if (centeredFrameCountRef.current >= REQUIRED_CENTERED_FRAMES$2 && allExpressionsCompleted && !spoofDetectedRef.current && faceIsProperSize) {
        setFaceFeedback("📸 Perfect! Capturing...");
        setFaceFeedbackType("success");
        performCapture();
      } else {
        setFaceFeedback(`✓ Hold still for ${remaining}s`);
        setFaceFeedbackType("success");
      }
    } catch (err) {
      console.error("Detection error:", err);
    }
  };
  const getEyeAspectRatio = (eye) => {
    const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
    const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
    const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
    return (v1 + v2) / (2 * h);
  };
  const clearOverlayCanvas = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  const drawFaceLandmarks = (landmarks, box) => {
    const canvas = overlayCanvasRef.current;
    const video = faceVideoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;
    const points = landmarks.positions;
    const scaledPoints = points.map((p) => ({
      x: p.x * scaleX,
      y: p.y * scaleY
    }));
    const meshConnections = [
      // Forehead/eyebrow connections
      [17, 18],
      [18, 19],
      [19, 20],
      [20, 21],
      [22, 23],
      [23, 24],
      [24, 25],
      [25, 26],
      // Eyebrow to eye connections
      [17, 36],
      [18, 36],
      [18, 37],
      [19, 37],
      [19, 38],
      [20, 38],
      [20, 39],
      [21, 39],
      [22, 42],
      [23, 42],
      [23, 43],
      [24, 43],
      [24, 44],
      [25, 44],
      [25, 45],
      [26, 45],
      // Cross eyebrow connections
      [17, 21],
      [22, 26],
      [19, 21],
      [22, 24],
      // Left eye
      [36, 37],
      [37, 38],
      [38, 39],
      [39, 40],
      [40, 41],
      [41, 36],
      [36, 39],
      [37, 40],
      [38, 41],
      // Right eye
      [42, 43],
      [43, 44],
      [44, 45],
      [45, 46],
      [46, 47],
      [47, 42],
      [42, 45],
      [43, 46],
      [44, 47],
      // Nose bridge
      [27, 28],
      [28, 29],
      [29, 30],
      // Nose bottom
      [30, 31],
      [30, 35],
      [31, 32],
      [32, 33],
      [33, 34],
      [34, 35],
      [31, 33],
      [33, 35],
      // Nose to eye connections
      [27, 21],
      [27, 22],
      [27, 39],
      [27, 42],
      [28, 39],
      [28, 42],
      [29, 31],
      [29, 35],
      // Eye to nose connections
      [39, 27],
      [42, 27],
      [40, 29],
      [47, 29],
      [41, 31],
      [46, 35],
      // Jaw outline
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [12, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      // Jaw to face connections
      [0, 17],
      [1, 36],
      [2, 41],
      [3, 31],
      [16, 26],
      [15, 45],
      [14, 46],
      [13, 35],
      [4, 48],
      [5, 48],
      [6, 59],
      [12, 54],
      [11, 54],
      [10, 55],
      [7, 58],
      [8, 57],
      [9, 56],
      // Outer mouth
      [48, 49],
      [49, 50],
      [50, 51],
      [51, 52],
      [52, 53],
      [53, 54],
      [54, 55],
      [55, 56],
      [56, 57],
      [57, 58],
      [58, 59],
      [59, 48],
      // Inner mouth
      [60, 61],
      [61, 62],
      [62, 63],
      [63, 64],
      [64, 65],
      [65, 66],
      [66, 67],
      [67, 60],
      // Mouth connections
      [48, 60],
      [51, 62],
      [54, 64],
      [57, 66],
      [49, 61],
      [50, 62],
      [52, 63],
      [53, 64],
      [55, 65],
      [56, 66],
      [58, 67],
      [59, 60],
      // Nose to mouth
      [31, 48],
      [32, 49],
      [33, 51],
      [34, 53],
      [35, 54],
      // Cross face connections for mesh effect
      [36, 41],
      [42, 47],
      [31, 41],
      [35, 46],
      [30, 33],
      [27, 30],
      // Forehead mesh
      [17, 19],
      [19, 21],
      [22, 24],
      [24, 26],
      [18, 20],
      [23, 25],
      // Upper face cross connections
      [21, 27],
      [22, 27],
      [17, 0],
      [26, 16]
    ];
    const lineColor = "rgba(255, 255, 255, 0.5)";
    const dotColor = "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    meshConnections.forEach(([i, j]) => {
      if (scaledPoints[i] && scaledPoints[j]) {
        ctx.moveTo(scaledPoints[i].x, scaledPoints[i].y);
        ctx.lineTo(scaledPoints[j].x, scaledPoints[j].y);
      }
    });
    ctx.stroke();
    ctx.fillStyle = dotColor;
    scaledPoints.forEach((point) => {
      if (!point) return;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  };
  const performCapture = async () => {
    if (!isRunningRef.current) return;
    const video = faceVideoRef.current;
    const canvas = faceCanvasRef.current;
    if (!canvas || !video) return;
    setFaceFeedback("🔍 Final checking, hold on...");
    setFaceFeedbackType("info");
    try {
      const finalDetection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: MIN_FACE_CONFIDENCE$2 })).withFaceLandmarks();
      if (!finalDetection) {
        setFaceFeedback("⚠️ Face lost! Look at the camera");
        setFaceFeedbackType("warning");
        centeredFrameCountRef.current = 0;
        return;
      }
      const box = finalDetection.detection.box;
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const videoCenterX = video.videoWidth / 2;
      const videoCenterY = video.videoHeight / 2;
      const offsetX = Math.abs(faceCenterX - videoCenterX) / video.videoWidth;
      const offsetY = Math.abs(faceCenterY - videoCenterY) / video.videoHeight;
      if (offsetX >= CENTER_TOLERANCE$2 || offsetY >= CENTER_TOLERANCE$2) {
        setFaceFeedback("⚠️ Center your face again");
        setFaceFeedbackType("warning");
        centeredFrameCountRef.current = 0;
        return;
      }
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setFaceFeedback("🤖 AI verifying real human...");
      setFaceFeedbackType("info");
      try {
        const allExpressionsCompleted = REQUIRED_EXPRESSIONS.every((expr) => detectedExpressionsRef.current.has(expr));
        const aiResponse = await fetch("/api/ai/face/liveness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: imageDataUrl,
            livenessScore: livenessScoreRef.current,
            movementDetected: allExpressionsCompleted || expressionChangeRef.current
          })
        });
        const aiResult = await aiResponse.json();
        if (aiResult.success && aiResult.result) {
          const { isLive, confidence, reason } = aiResult.result;
          if (!isLive || confidence < 70) {
            setFaceFeedback(`❌ Spoofing detected: ${reason || "Please use a real face"}`);
            setFaceFeedbackType("error");
            centeredFrameCountRef.current = 0;
            spoofDetectedRef.current = true;
            return;
          }
        }
      } catch (aiErr) {
        console.warn("AI liveness check failed, proceeding with local checks:", aiErr);
      }
      isRunningRef.current = false;
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
      }
      setCapturedFace(imageDataUrl);
      setFaceVerified(true);
      setFaceFeedback("✅ Verified! Real human confirmed");
      setFaceFeedbackType("success");
      setLivenessScore(100);
      setSteadySeconds(0);
      stopFaceDetection();
    } catch (err) {
      console.error("Final capture check error:", err);
      setFaceFeedback("⚠️ Verification failed, try again");
      setFaceFeedbackType("error");
      centeredFrameCountRef.current = 0;
    }
  };
  const downloadFace = () => {
    if (!capturedFace) return;
    const link = document.createElement("a");
    link.href = capturedFace;
    link.download = `selfie-${Date.now()}.jpg`;
    link.click();
  };
  if (faceVerified && capturedFace) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex flex-col", children: /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
      /* @__PURE__ */ jsxs("div", { className: "text-center mb-6", children: [
        /* @__PURE__ */ jsx("div", { className: "w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M5 13l4 4L19 7" }) }) }),
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Verification Complete" }),
        /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-1", children: "Live person verified successfully" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl overflow-hidden mb-6", children: [
        /* @__PURE__ */ jsx("img", { src: capturedFace, alt: "Verified selfie", className: "w-full aspect-[4/3] object-cover" }),
        /* @__PURE__ */ jsxs("div", { className: "p-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-green-600 mb-3", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }),
            /* @__PURE__ */ jsx("span", { className: "font-semibold", children: "100% Confidence" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [
            /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ Blink Detected" }) }),
            /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ Movement" }) }),
            /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ Expression" }) }),
            /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ Face Centered" }) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: downloadFace,
            className: "w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2",
            children: [
              /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }),
              "Download Selfie"
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "a",
          {
            href: "/id-verification-test",
            className: "block w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition text-center",
            children: "Continue to ID Verification →"
          }
        )
      ] })
    ] }) }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 bg-black flex flex-col", children: [
    !faceDetectionStarted && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900" }),
    /* @__PURE__ */ jsx("div", { className: "relative z-20 px-4 pt-4 pb-2", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("a", { href: "/", className: "p-2 bg-white/20 backdrop-blur rounded-full", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }),
      modelsLoaded && /* @__PURE__ */ jsx("div", { className: "px-3 py-1 bg-green-500/80 backdrop-blur rounded-full text-white text-xs font-medium", children: "AI Ready" })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 relative flex flex-col", children: [
      /* @__PURE__ */ jsx(
        "video",
        {
          ref: faceVideoRef,
          autoPlay: true,
          muted: true,
          playsInline: true,
          className: `absolute inset-0 w-full h-full object-cover ${!faceDetectionStarted ? "hidden" : ""}`,
          style: { transform: "scaleX(-1)" }
        }
      ),
      /* @__PURE__ */ jsx("canvas", { ref: faceCanvasRef, className: "hidden" }),
      /* @__PURE__ */ jsx(
        "canvas",
        {
          ref: overlayCanvasRef,
          className: `absolute inset-0 w-full h-full object-cover pointer-events-none ${!faceDetectionStarted ? "hidden" : ""}`,
          style: { transform: "scaleX(-1)" }
        }
      ),
      faceDetectionStarted && livenessScore > 0 && /* @__PURE__ */ jsx(
        "div",
        {
          className: "absolute inset-0 backdrop-blur-md bg-black/40 pointer-events-none",
          style: {
            WebkitMaskImage: "radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)",
            maskImage: "radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)"
          }
        }
      ),
      faceDetectionStarted && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" }),
        /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" })
      ] }),
      !faceDetectionStarted && /* @__PURE__ */ jsxs("div", { className: "relative z-10 text-center pt-2 pb-4", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl sm:text-3xl font-bold text-white mb-1", children: "Face Verification" }),
        /* @__PURE__ */ jsx("p", { className: "text-white/60 text-sm sm:text-base px-8", children: "Position your face in the oval and follow the instructions" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex items-center justify-center relative", children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            className: `w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] border-4 transition-all duration-300 ${faceVerified ? "border-transparent" : faceDetectionStarted ? "border-dashed border-white/30" : "border-solid border-white/20"}`
          }
        ),
        !faceDetectionStarted && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: /* @__PURE__ */ jsxs(
          "svg",
          {
            viewBox: "0 0 200 280",
            className: "w-44 h-60 sm:w-52 sm:h-72",
            children: [
              /* @__PURE__ */ jsxs("g", { stroke: "rgba(255, 255, 255, 0.5)", strokeWidth: "1", fill: "none", children: [
                /* @__PURE__ */ jsx("path", { d: "M30 120 Q25 160 35 195 Q50 220 100 235 Q150 220 165 195 Q175 160 170 120" }),
                /* @__PURE__ */ jsx("path", { d: "M42 100 L55 95 L70 97 L82 102" }),
                /* @__PURE__ */ jsx("path", { d: "M118 102 L130 97 L145 95 L158 100" }),
                /* @__PURE__ */ jsx("path", { d: "M48 118 L58 115 L72 115 L82 118 L72 125 L58 125 Z" }),
                /* @__PURE__ */ jsx("path", { d: "M118 118 L128 115 L142 115 L152 118 L142 125 L128 125 Z" }),
                /* @__PURE__ */ jsx("path", { d: "M100 105 L100 150" }),
                /* @__PURE__ */ jsx("path", { d: "M85 155 L95 162 L100 165 L105 162 L115 155" }),
                /* @__PURE__ */ jsx("path", { d: "M70 185 Q85 178 100 178 Q115 178 130 185" }),
                /* @__PURE__ */ jsx("path", { d: "M70 185 Q85 198 100 200 Q115 198 130 185" }),
                /* @__PURE__ */ jsx("line", { x1: "65", y1: "120", x2: "100", y2: "140" }),
                /* @__PURE__ */ jsx("line", { x1: "135", y1: "120", x2: "100", y2: "140" }),
                /* @__PURE__ */ jsx("line", { x1: "100", y1: "150", x2: "65", y2: "120" }),
                /* @__PURE__ */ jsx("line", { x1: "100", y1: "150", x2: "135", y2: "120" }),
                /* @__PURE__ */ jsx("line", { x1: "70", y1: "185", x2: "90", y2: "160" }),
                /* @__PURE__ */ jsx("line", { x1: "130", y1: "185", x2: "110", y2: "160" }),
                /* @__PURE__ */ jsx("line", { x1: "48", y1: "118", x2: "42", y2: "100" }),
                /* @__PURE__ */ jsx("line", { x1: "82", y1: "118", x2: "82", y2: "102" }),
                /* @__PURE__ */ jsx("line", { x1: "118", y1: "118", x2: "118", y2: "102" }),
                /* @__PURE__ */ jsx("line", { x1: "152", y1: "118", x2: "158", y2: "100" }),
                /* @__PURE__ */ jsx("line", { x1: "30", y1: "120", x2: "48", y2: "118" }),
                /* @__PURE__ */ jsx("line", { x1: "170", y1: "120", x2: "152", y2: "118" })
              ] }),
              /* @__PURE__ */ jsx("g", { children: [
                // Jaw
                [30, 120],
                [28, 140],
                [32, 165],
                [40, 190],
                [55, 210],
                [75, 225],
                [100, 235],
                [125, 225],
                [145, 210],
                [160, 190],
                [168, 165],
                [172, 140],
                [170, 120],
                // Left eyebrow
                [42, 100],
                [55, 95],
                [70, 97],
                [82, 102],
                // Right eyebrow  
                [118, 102],
                [130, 97],
                [145, 95],
                [158, 100],
                // Left eye
                [48, 118],
                [58, 115],
                [72, 115],
                [82, 118],
                [72, 125],
                [58, 125],
                [65, 120],
                // Right eye
                [118, 118],
                [128, 115],
                [142, 115],
                [152, 118],
                [142, 125],
                [128, 125],
                [135, 120],
                // Nose
                [100, 105],
                [100, 120],
                [100, 135],
                [100, 150],
                [85, 155],
                [95, 162],
                [100, 165],
                [105, 162],
                [115, 155],
                // Mouth
                [70, 185],
                [80, 180],
                [90, 178],
                [100, 178],
                [110, 178],
                [120, 180],
                [130, 185],
                [80, 192],
                [90, 196],
                [100, 200],
                [110, 196],
                [120, 192]
              ].map(([x, y], i) => /* @__PURE__ */ jsx("circle", { cx: x, cy: y, r: "3", fill: "rgba(255, 255, 255, 0.9)" }, i)) })
            ]
          }
        ) }),
        !faceDetectionStarted && /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] animate-pulse",
            style: {
              boxShadow: "0 0 40px rgba(59, 130, 246, 0.3), inset 0 0 40px rgba(59, 130, 246, 0.1)"
            }
          }
        ),
        faceDetectionStarted && /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] transition-all duration-300",
            style: {
              background: faceVerified ? "transparent" : `conic-gradient(${livenessScore >= 60 ? "#22c55e" : livenessScore >= 30 ? "#eab308" : "#ef4444"} ${livenessScore * 3.6}deg, transparent ${livenessScore * 3.6}deg)`,
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 4px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 4px))"
            }
          }
        ),
        faceVerified && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] border-4 border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.5)]" }),
        faceDetectionStarted && currentExpression && /* @__PURE__ */ jsx("div", { className: "absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap", children: /* @__PURE__ */ jsx("span", { className: "px-4 py-1.5 bg-black/50 backdrop-blur rounded-full text-white text-sm font-medium capitalize", children: currentExpression }) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "relative z-10 px-6 pb-6 pt-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent", children: [
      !faceDetectionStarted && /* @__PURE__ */ jsxs("div", { className: "mb-5 space-y-2.5", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-white/80", children: [
          /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx("span", { className: "text-blue-400 text-sm", children: "👁️" }) }),
          /* @__PURE__ */ jsx("span", { className: "text-sm", children: "Look directly at the camera" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-white/80", children: [
          /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx("span", { className: "text-blue-400 text-sm", children: "😌" }) }),
          /* @__PURE__ */ jsx("span", { className: "text-sm", children: "Blink naturally when prompted" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-white/80", children: [
          /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx("span", { className: "text-blue-400 text-sm", children: "💡" }) }),
          /* @__PURE__ */ jsx("span", { className: "text-sm", children: "Ensure good lighting on your face" })
        ] })
      ] }),
      faceDetectionStarted && /* @__PURE__ */ jsx(
        "div",
        {
          className: `mb-4 py-3 px-4 rounded-xl text-center font-medium ${faceFeedbackType === "success" ? "bg-green-500 text-white" : faceFeedbackType === "error" ? "bg-red-500 text-white" : faceFeedbackType === "warning" ? "bg-yellow-500 text-black" : "bg-white/20 backdrop-blur text-white"}`,
          children: faceFeedback
        }
      ),
      !faceDetectionStarted && /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleStartClick,
          disabled: !modelsLoaded,
          className: "w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/30",
          children: !modelsLoaded ? /* @__PURE__ */ jsxs("span", { className: "flex items-center justify-center gap-2", children: [
            /* @__PURE__ */ jsxs("svg", { className: "animate-spin h-5 w-5", viewBox: "0 0 24 24", children: [
              /* @__PURE__ */ jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4", fill: "none" }),
              /* @__PURE__ */ jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })
            ] }),
            "Loading AI Models..."
          ] }) : /* @__PURE__ */ jsxs("span", { className: "flex items-center justify-center gap-2", children: [
            /* @__PURE__ */ jsxs("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
              /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" }),
              /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" })
            ] }),
            "Start Face Scan"
          ] })
        }
      ),
      faceDetectionStarted && /* @__PURE__ */ jsxs("div", { className: "flex justify-center gap-3 mt-4", children: [
        /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${isCentered ? "bg-green-500" : "bg-white/30"}`, title: "Centered" }),
        /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${detectedExpressions.includes("happy") ? "bg-green-500" : "bg-white/30"}`, title: "Smile 😊" }),
        /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${detectedExpressions.includes("angry") ? "bg-green-500" : "bg-white/30"}`, title: "Angry 😠" }),
        /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${livenessScore >= 60 ? "bg-green-500" : "bg-white/30"}`, title: "Liveness" })
      ] })
    ] }),
    showConsentModal && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4", children: /* @__PURE__ */ jsxs("div", { className: "max-w-md w-full bg-white rounded-2xl p-6", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold mb-2", children: "Consent to Face Scan" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-700 mb-4", children: "We will use your camera to capture a short live selfie to verify liveness. By accepting, you consent to temporary capture of an image for verification." }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-3 mt-4", children: [
        /* @__PURE__ */ jsx("button", { onClick: acceptConsent, className: "flex-1 py-3 bg-blue-600 text-white rounded-xl", children: "I Consent" }),
        /* @__PURE__ */ jsx("button", { onClick: declineConsent, className: "flex-1 py-3 bg-gray-200 rounded-xl", children: "Decline" })
      ] })
    ] }) }),
    showGuide && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6", children: /* @__PURE__ */ jsxs("div", { role: "dialog", "aria-modal": "true", className: "max-w-lg w-full bg-white rounded-2xl p-6 shadow-2xl pointer-events-auto", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-xl font-semibold mb-2", children: "Quick Guide" }),
      /* @__PURE__ */ jsxs("ul", { className: "text-sm text-gray-700 space-y-2 mb-4", children: [
        /* @__PURE__ */ jsx("li", { children: "• Position your face in the center oval." }),
        /* @__PURE__ */ jsx("li", { children: "• Ensure good lighting and remove glasses if possible." }),
        /* @__PURE__ */ jsx("li", { children: "• Blink naturally when prompted; avoid sudden movements." }),
        /* @__PURE__ */ jsx("li", { children: "• Hold steady for a few seconds while we check liveness." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ jsx("button", { onClick: proceedFromGuide, className: "flex-1 py-3 bg-green-600 text-white rounded-xl", children: "Proceed to Scan" }),
        /* @__PURE__ */ jsx("button", { onClick: () => setShowGuide(false), className: "flex-1 py-3 bg-gray-200 rounded-xl", children: "Skip" })
      ] })
    ] }) })
  ] });
}
const API_URL$1 = "/api/ocr/base64";
const ID_TYPES$1 = [
  { value: "national-id", label: "Philippine National ID", icon: "🇵🇭" },
  { value: "driver-license", label: "Driver's License", icon: "🚗" },
  { value: "passport", label: "Passport", icon: "✈️" },
  { value: "umid", label: "UMID", icon: "🆔" },
  { value: "philhealth", label: "PhilHealth ID", icon: "🏥" },
  { value: "tin-id", label: "TIN ID", icon: "📋" },
  { value: "postal-id", label: "Postal ID", icon: "📮" },
  { value: "pagibig", label: "Pag-IBIG ID", icon: "🏠" }
];
function IDVerification() {
  var _a;
  const { id: sessionId } = useParams();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [session, setSession] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [selectedIdType, setSelectedIdType] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState("Loading session...");
  const [feedbackType, setFeedbackType] = useState("info");
  const [ocrResult, setOcrResult] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [openaiResult, setOpenaiResult] = useState(null);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [error, setError] = useState(null);
  const [idTypeMismatch, setIdTypeMismatch] = useState(false);
  const [detectedIdType, setDetectedIdType] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [fieldValidationFailed, setFieldValidationFailed] = useState(false);
  const [imageQualityIssues, setImageQualityIssues] = useState([]);
  const [imageQualityFailed, setImageQualityFailed] = useState(false);
  const expectedOrigin = typeof window !== "undefined" ? window.__IDENTITY_EXPECTED_ORIGIN__ || "*" : "*";
  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided");
      return;
    }
    fetch(`/api/verify/session/${sessionId}`).then((res) => res.json()).then((data) => {
      var _a2, _b, _c, _d, _e;
      if (data.success && data.session) {
        const sessionStatus = (data.session.status || "").toLowerCase();
        if (["done", "completed", "success"].includes(sessionStatus)) {
          setSession(data.session);
          setConsentGiven(true);
          if ((_a2 = data.session.payload) == null ? void 0 : _a2.idType) {
            setSelectedIdType(data.session.payload.idType);
          }
          if ((_b = data.session.result) == null ? void 0 : _b.fields) {
            setAiResult({ data: data.session.result.fields });
          }
          if ((_c = data.session.result) == null ? void 0 : _c.rawText) {
            setOcrResult({ text: data.session.result.rawText });
          }
          if ((_d = data.session.result) == null ? void 0 : _d.capturedImageBase64) {
            setCapturedImage(data.session.result.capturedImageBase64);
          }
          setVerificationComplete(true);
          setFeedback("Verification already completed");
          setFeedbackType("success");
          return;
        }
        if (["failed", "cancelled", "canceled"].includes(sessionStatus)) {
          setError("This verification session has been cancelled or failed. Please create a new session to verify again.");
          return;
        }
        if (sessionStatus === "expired") {
          setError("This verification session has expired. Please create a new session.");
          return;
        }
        setSession(data.session);
        if ((_e = data.session.payload) == null ? void 0 : _e.idType) {
          setSelectedIdType(data.session.payload.idType);
        }
        setFeedback("Select ID type to continue");
      } else {
        setError("Session not found or expired");
      }
    }).catch((err) => {
      console.error("Failed to fetch session:", err);
      setError("Failed to load session");
    });
  }, [sessionId]);
  useEffect(() => {
    return () => stopCamera();
  }, []);
  const notifyParent = useCallback((message) => {
    if (typeof window !== "undefined" && window.parent !== window) {
      try {
        window.parent.postMessage(message, expectedOrigin);
      } catch (e) {
        console.warn("[identity] postMessage failed", e);
      }
    }
  }, [expectedOrigin]);
  const notifyParentFailed = useCallback(async (reason, details = {}) => {
    notifyParent({
      identityOCR: {
        action: "verification_failed",
        status: "failed",
        reason,
        session: sessionId,
        details
      }
    });
    try {
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "failed",
          reason,
          result: details,
          finishedAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
    } catch (e) {
      console.warn("[identity] session fail update failed", e);
    }
  }, [notifyParent, sessionId]);
  const notifyParentCancelled = useCallback(async (reason) => {
    notifyParent({
      identityOCR: {
        action: "verification_cancelled",
        status: "cancelled",
        reason,
        session: sessionId
      }
    });
    try {
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          reason,
          finishedAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
    } catch (e) {
      console.warn("[identity] session cancel update failed", e);
    }
  }, [notifyParent, sessionId]);
  const handleConsentAccept = () => {
    setConsentGiven(true);
    setFeedback("Select ID type to continue");
  };
  const handleConsentDecline = async () => {
    setConsentGiven(false);
    setError("You declined the camera consent. The verification has been cancelled.");
    await notifyParentCancelled("consent_declined");
  };
  const startCamera = async () => {
    try {
      setFeedback("Starting camera...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            resolve();
          };
        });
        if (canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }
      }
      setCameraStarted(true);
      setFeedback("Position your ID within the frame");
      setFeedbackType("info");
    } catch (err) {
      console.error("Camera error:", err);
      setFeedback("Camera access failed: " + err.message);
      setFeedbackType("error");
    }
  };
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStarted(false);
  }, []);
  const fetchWithTimeout = (url, options, timeout = 15e3) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout))
    ]);
  };
  const captureID = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    setIsProcessing(true);
    setFeedback("Capturing...");
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.7);
    setCapturedImage(imageDataUrl);
    setFeedback("🤖 AI checking image quality...");
    setFeedbackType("info");
    try {
      const qualityRes = await fetchWithTimeout("/api/ai/id/quality-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl })
      }, 2e4);
      const qualityData = await qualityRes.json();
      console.log("[AI Quality Check] Full response:", JSON.stringify(qualityData, null, 2));
      if (!qualityData.success) {
        console.log("[AI Quality Check] API error:", qualityData.error);
        setImageQualityIssues(["Quality check failed: " + (qualityData.error || "Unknown error")]);
        setImageQualityFailed(true);
        setFeedback("Unable to verify image quality. Please try again.");
        setFeedbackType("error");
        setIsProcessing(false);
        return;
      }
      if (qualityData.result) {
        const { isAcceptable, issues, suggestion, details, confidence } = qualityData.result;
        console.log("[AI Quality Check] Decision:", { isAcceptable, confidence, issues, suggestion, details });
        if (!isAcceptable) {
          const issueList = [];
          if (issues && issues.length > 0) {
            issueList.push(...issues);
          }
          if (suggestion) {
            issueList.push("AI says: " + suggestion);
          }
          if (issueList.length === 0) {
            issueList.push("Image quality not acceptable");
          }
          setImageQualityIssues(issueList);
          setImageQualityFailed(true);
          setFeedback(suggestion || "Please retake the photo");
          setFeedbackType("error");
          setIsProcessing(false);
          return;
        }
      }
    } catch (qualityErr) {
      console.error("AI quality check error:", qualityErr);
      setImageQualityIssues(["quality_check_error: " + qualityErr.message]);
      setImageQualityFailed(true);
      setFeedback("Quality check failed. Please try again.");
      setFeedbackType("error");
      setIsProcessing(false);
      return;
    }
    stopCamera();
    await processImage(imageDataUrl);
  };
  const processImage = async (imageDataUrl) => {
    var _a2, _b, _c, _d, _e, _f, _g;
    const base64Data = imageDataUrl.split(",")[1];
    try {
      setFeedback("Processing ID...");
      setFeedbackType("info");
      const res = await fetchWithTimeout(API_URL$1, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Data,
          type: "identity",
          idType: selectedIdType || "unknown"
        })
      }, 3e4);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Processing failed");
      const extractedIdType = (((_a2 = data.fields) == null ? void 0 : _a2.idType) || "").toLowerCase().replace(/[\s-_]/g, "");
      const selectedType = (selectedIdType || "").toLowerCase().replace(/[\s-_]/g, "");
      const normalizeIdType = (type) => {
        const typeMap = {
          // Philippine National ID aliases
          "philippinenationalid": "nationalid",
          "philippineidentificationcard": "nationalid",
          "philippineid": "nationalid",
          "nationalid": "nationalid",
          "philsys": "nationalid",
          "philsysid": "nationalid",
          "philsyscard": "nationalid",
          "psa": "nationalid",
          "psaid": "nationalid",
          // Driver's License aliases
          "driverslicense": "driverlicense",
          "driverlicense": "driverlicense",
          "driverslic": "driverlicense",
          "drivinglic": "driverlicense",
          "drivinglicense": "driverlicense",
          "ltolicense": "driverlicense",
          "lto": "driverlicense",
          // Passport aliases
          "passport": "passport",
          "philippinepassport": "passport",
          "phpassport": "passport",
          // UMID aliases
          "umid": "umid",
          "umidcard": "umid",
          "unifiedmultipurposeid": "umid",
          // PhilHealth aliases
          "philhealth": "philhealth",
          "philhealthid": "philhealth",
          "philhealthcard": "philhealth",
          "philippinehealthinsurance": "philhealth",
          // TIN ID aliases
          "tinid": "tinid",
          "tin": "tinid",
          "tincard": "tinid",
          "taxpayeridentificationnumber": "tinid",
          "taxid": "tinid",
          "bir": "tinid",
          "birid": "tinid",
          // Postal ID aliases
          "postalid": "postalid",
          "postal": "postalid",
          "postalcard": "postalid",
          "phlpostid": "postalid",
          "philpostid": "postalid",
          // Pag-IBIG aliases
          "pagibig": "pagibig",
          "pagibigid": "pagibig",
          "pagibigcard": "pagibig",
          "hdmf": "pagibig",
          "hdmfid": "pagibig"
        };
        return typeMap[type] || type;
      };
      const normalizedExtracted = normalizeIdType(extractedIdType);
      const normalizedSelected = normalizeIdType(selectedType);
      if (normalizedExtracted && normalizedSelected && normalizedExtracted !== normalizedSelected) {
        setDetectedIdType(((_b = data.fields) == null ? void 0 : _b.idType) || "Unknown");
        setIdTypeMismatch(true);
        setFeedback("ID type mismatch detected");
        setFeedbackType("error");
        setIsProcessing(false);
        notifyParentFailed("id_type_mismatch", {
          expected: selectedType,
          detected: ((_c = data.fields) == null ? void 0 : _c.idType) || "Unknown"
        });
        return;
      }
      const requiredFieldsByIdType = {
        "national-id": ["fullName", "idNumber", "dateOfBirth"],
        "driver-license": ["fullName", "idNumber", "dateOfBirth"],
        "passport": ["fullName", "idNumber", "dateOfBirth", "nationality"],
        "umid": ["fullName", "idNumber", "dateOfBirth"],
        "philhealth": ["fullName", "idNumber"],
        "tin-id": ["fullName", "idNumber"],
        "postal-id": ["fullName", "idNumber"],
        "pagibig": ["fullName", "idNumber"]
      };
      const requiredFields = requiredFieldsByIdType[selectedIdType] || ["fullName", "idNumber"];
      const fields = data.fields || {};
      const missing = requiredFields.filter((field) => {
        const value = fields[field] || fields[field.toLowerCase()];
        if (field === "fullName" && !value) {
          return !(fields.name || fields.firstName || fields.lastName);
        }
        if (field === "dateOfBirth" && !value) {
          return !fields.birthDate;
        }
        return !value || value.trim() === "";
      });
      if (missing.length > 0) {
        setMissingFields(missing);
        setFieldValidationFailed(true);
        setFeedback("Required fields not detected");
        setFeedbackType("error");
        setIsProcessing(false);
        notifyParentFailed("missing_required_fields", { missingFields: missing });
        return;
      }
      setOcrResult({ text: data.rawText || ((_d = data.basicText) == null ? void 0 : _d.text) || "" });
      setAiResult({ data: data.fields || {} });
      if ((_e = data.openai) == null ? void 0 : _e.parsed) {
        setOpenaiResult(data.openai.parsed);
      }
      setFeedback("Done!");
      setFeedbackType("success");
      setVerificationComplete(true);
      const result = {
        action: "success",
        fields: data.fields || {},
        rawText: data.rawText || "",
        capturedImageBase64: imageDataUrl,
        idType: selectedIdType,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId
      };
      await saveSessionResult(result);
      notifyParent({
        identityOCR: {
          action: "verification_success",
          status: "success",
          result,
          session: sessionId,
          data: result.fields,
          images: {
            idImage: imageDataUrl
          },
          verificationType: ((_f = session == null ? void 0 : session.payload) == null ? void 0 : _f.verificationType) || "id",
          nextStep: ((_g = session == null ? void 0 : session.payload) == null ? void 0 : _g.nextStep) || null
        }
      });
    } catch (err) {
      console.error("Processing error:", err);
      setFeedback("Failed: " + err.message);
      setFeedbackType("error");
      setIsProcessing(false);
      notifyParentFailed("processing_error", { error: err.message });
    }
  };
  const saveSessionResult = async (result) => {
    try {
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "done",
          result,
          finishedAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
    } catch (e) {
      console.warn("[identity] save result failed", e);
    }
  };
  const handleRecapture = () => {
    setCapturedImage(null);
    setOcrResult(null);
    setAiResult(null);
    setOpenaiResult(null);
    setIdTypeMismatch(false);
    setDetectedIdType(null);
    setFieldValidationFailed(false);
    setMissingFields([]);
    setImageQualityFailed(false);
    setImageQualityIssues([]);
    setFeedback("Position your ID within the frame");
    setFeedbackType("info");
    setIsProcessing(false);
    startCamera();
  };
  const handleContinueToSelfie = () => {
    var _a2, _b;
    if (((_a2 = session == null ? void 0 : session.payload) == null ? void 0 : _a2.nextStep) === "selfie" && ((_b = session == null ? void 0 : session.payload) == null ? void 0 : _b.selfieSessionId)) {
      window.location.href = `/session/selfieliveness/${session.payload.selfieSessionId}`;
    } else {
      notifyParent({
        identityOCR: {
          action: "verification_complete",
          session: sessionId
        }
      });
    }
  };
  const renderField = (label, value) => {
    if (!value) return null;
    return /* @__PURE__ */ jsxs("div", { className: "flex justify-between py-2 border-b border-gray-100 last:border-0", children: [
      /* @__PURE__ */ jsx("span", { className: "text-gray-500 text-sm", children: label }),
      /* @__PURE__ */ jsx("span", { className: "text-gray-900 font-medium text-sm text-right max-w-[60%]", children: value })
    ] });
  };
  const getIdTypeLabel2 = (value) => {
    const found = ID_TYPES$1.find((t) => t.value === value);
    return found ? found.label : value;
  };
  if (error) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4", children: /* @__PURE__ */ jsx("svg", { className: "w-8 h-8 text-red-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }),
      /* @__PURE__ */ jsx("h2", { className: "text-xl font-bold text-gray-900 mb-2", children: "Verification Error" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-600", children: error })
    ] }) });
  }
  if (!session) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-600", children: "Loading session..." })
    ] }) });
  }
  if (!consentGiven) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-xl font-bold text-gray-900 mb-4", children: "Privacy & Camera Consent" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-600 mb-4", children: "This verification will capture images to extract identity data (name, DOB, ID number). By continuing you consent to allow the camera to capture images and to send them to the verification service." }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-700 font-medium mb-2", children: "Image quality guidance:" }),
      /* @__PURE__ */ jsxs("ul", { className: "list-disc pl-5 mb-4 text-gray-600 text-sm space-y-1", children: [
        /* @__PURE__ */ jsx("li", { children: "Use good, even lighting — avoid strong backlight or heavy shadows." }),
        /* @__PURE__ */ jsx("li", { children: "Ensure the image is sharp and not blurred." }),
        /* @__PURE__ */ jsx("li", { children: "Make sure the entire document is visible and not cropped." }),
        /* @__PURE__ */ jsx("li", { children: "The document must belong to you — do not submit someone else's ID." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-3 justify-end", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleConsentDecline,
            className: "px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition",
            children: "Decline"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleConsentAccept,
            className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition",
            children: "I Consent & Continue"
          }
        )
      ] })
    ] }) });
  }
  if (!selectedIdType) {
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsx("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-center", children: /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "ID Verification" }) }) }),
      /* @__PURE__ */ jsxs("div", { className: "max-w-lg mx-auto p-4 space-y-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center pt-4 pb-2", children: [
          /* @__PURE__ */ jsx("div", { className: "w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-blue-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" }) }) }),
          /* @__PURE__ */ jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-2", children: "Select ID Type" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600", children: "Choose the type of ID you want to scan for accurate extraction" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3", children: ID_TYPES$1.map((idType) => /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setSelectedIdType(idType.value),
            className: "bg-white rounded-2xl p-4 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 text-left border-2 border-transparent hover:border-blue-500 group",
            children: [
              /* @__PURE__ */ jsx("div", { className: "text-3xl mb-2", children: idType.icon }),
              /* @__PURE__ */ jsx("div", { className: "font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-600 transition-colors", children: idType.label })
            ]
          },
          idType.value
        )) }),
        /* @__PURE__ */ jsxs("div", { className: "bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "text-amber-500 flex-shrink-0", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold text-amber-800 text-sm", children: "Why select ID type?" }),
            /* @__PURE__ */ jsx("div", { className: "text-amber-700 text-xs mt-1", children: "Each ID has different formats and fields. Selecting the correct type helps our AI extract information more accurately." })
          ] })
        ] })
      ] })
    ] });
  }
  if (imageQualityFailed && capturedImage) {
    const issueLabels = {
      "no_id_detected": "No ID card detected in image",
      "partial_visible": "ID is partially cut off or cropped",
      "not_centered": "ID is not centered in frame",
      "has_obstacles": "Fingers or objects blocking the ID",
      "text_partially_blocked": "Some text or letters are covered",
      "name_partially_visible": "Name field is partially blocked",
      "id_number_partially_visible": "ID number is partially blocked",
      "is_blurry": "Image is blurry or out of focus",
      "has_glare": "Light reflection or glare detected",
      "too_dark": "Image is too dark",
      "too_bright": "Image is overexposed",
      "text_not_readable": "Text on ID is not readable",
      "face_not_visible": "Face photo on ID is not clear",
      "quality_check_error": "Quality check failed - please try again",
      "Quality check failed": "Unable to verify image quality",
      "Image quality not acceptable": "Image quality not acceptable"
    };
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 flex flex-col", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsx("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-center", children: /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "Image Quality Issue" }) }) }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center mb-4", children: [
          /* @__PURE__ */ jsx("div", { className: "w-16 h-16 mx-auto bg-orange-500 rounded-full flex items-center justify-center mb-3 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-8 h-8 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }) }),
          /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold text-gray-900", children: "Image Quality Issue" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-1 text-sm", children: "The captured image has problems" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-3 mb-4", children: [
          /* @__PURE__ */ jsx("div", { className: "text-xs font-medium text-gray-500 mb-2", children: "Captured Image:" }),
          /* @__PURE__ */ jsxs("div", { className: "relative rounded-lg overflow-hidden border-2 border-orange-300", children: [
            /* @__PURE__ */ jsx(
              "img",
              {
                src: capturedImage,
                alt: "Captured ID",
                className: "w-full h-auto"
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "absolute inset-0 border-4 border-orange-500/50 rounded-lg pointer-events-none" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-4 mb-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "text-sm font-semibold text-red-600 mb-3 flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
            "Issues Detected:"
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-2", children: imageQualityIssues.map((issue, index) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 text-orange-700 bg-orange-50 p-2 rounded-lg", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-5 h-5 flex-shrink-0 mt-0.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: issueLabels[issue] || issue })
          ] }, index)) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "text-blue-500 flex-shrink-0", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold text-blue-800 text-sm", children: "Tips for better capture" }),
            /* @__PURE__ */ jsxs("div", { className: "text-blue-700 text-xs mt-1", children: [
              "• Make sure the entire ID is visible - don't crop any edges",
              /* @__PURE__ */ jsx("br", {}),
              "• Avoid light reflection or glare on the ID surface",
              /* @__PURE__ */ jsx("br", {}),
              "• Keep fingers and objects away from the ID",
              /* @__PURE__ */ jsx("br", {}),
              "• Hold the camera steady for a sharp, focused image",
              /* @__PURE__ */ jsx("br", {}),
              "• Use good, even lighting without shadows"
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: handleRecapture,
            className: "w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2",
            children: [
              /* @__PURE__ */ jsxs("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }),
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })
              ] }),
              "Recapture ID"
            ]
          }
        )
      ] }) })
    ] });
  }
  if (idTypeMismatch && capturedImage) {
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex flex-col", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsx("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-center", children: /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "Verification Failed" }) }) }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center mb-6", children: [
          /* @__PURE__ */ jsx("div", { className: "w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center mb-4 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M6 18L18 6M6 6l12 12" }) }) }),
          /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "ID Type Mismatch" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-2", children: "The scanned ID does not match your selection" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bg-white rounded-2xl shadow-xl p-4 mb-6", children: /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center py-2 border-b border-gray-100", children: [
            /* @__PURE__ */ jsx("span", { className: "text-gray-500 text-sm", children: "Selected ID Type" }),
            /* @__PURE__ */ jsx("span", { className: "text-blue-600 font-semibold text-sm", children: getIdTypeLabel2(selectedIdType) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center py-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-gray-500 text-sm", children: "Detected ID Type" }),
            /* @__PURE__ */ jsx("span", { className: "text-red-600 font-semibold text-sm", children: detectedIdType })
          ] })
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "text-amber-500 flex-shrink-0", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold text-amber-800 text-sm", children: "What to do?" }),
            /* @__PURE__ */ jsx("div", { className: "text-amber-700 text-xs mt-1", children: "Please make sure you selected the correct ID type or scan the ID that matches your selection." })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: handleRecapture,
              className: "w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2",
              children: [
                /* @__PURE__ */ jsxs("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                  /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }),
                  /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })
                ] }),
                "Recapture ID"
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setIdTypeMismatch(false);
                setSelectedIdType(null);
                setCapturedImage(null);
              },
              className: "w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition",
              children: "Change ID Type"
            }
          )
        ] })
      ] }) })
    ] });
  }
  if (fieldValidationFailed && capturedImage) {
    const fieldLabels = {
      fullName: "Full Name",
      idNumber: "ID Number",
      dateOfBirth: "Date of Birth",
      nationality: "Nationality",
      address: "Address",
      sex: "Sex",
      expiryDate: "Expiry Date",
      issueDate: "Issue Date"
    };
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex flex-col", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsx("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-center", children: /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "Verification Failed" }) }) }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center mb-6", children: [
          /* @__PURE__ */ jsx("div", { className: "w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center mb-4 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }) }),
          /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Missing Required Fields" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-2", children: "Could not extract all required information from the ID" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-4 mb-6", children: [
          /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold text-gray-700 mb-3", children: "Missing Fields:" }),
          /* @__PURE__ */ jsx("div", { className: "space-y-2", children: missingFields.map((field, index) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-red-600", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-sm", children: fieldLabels[field] || field })
          ] }, index)) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "text-amber-500 flex-shrink-0", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold text-amber-800 text-sm", children: "Tips for better results" }),
            /* @__PURE__ */ jsxs("div", { className: "text-amber-700 text-xs mt-1", children: [
              "• Ensure good lighting without glare",
              /* @__PURE__ */ jsx("br", {}),
              "• Keep the ID flat and fully visible",
              /* @__PURE__ */ jsx("br", {}),
              "• Make sure text is clear and readable"
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: handleRecapture,
              className: "w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2",
              children: [
                /* @__PURE__ */ jsxs("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                  /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }),
                  /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })
                ] }),
                "Recapture ID"
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setFieldValidationFailed(false);
                setSelectedIdType(null);
                setCapturedImage(null);
                setMissingFields([]);
              },
              className: "w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition",
              children: "Change ID Type"
            }
          )
        ] })
      ] }) })
    ] });
  }
  if (verificationComplete && capturedImage) {
    const data = (aiResult == null ? void 0 : aiResult.data) || aiResult || {};
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-green-50", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsx("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-center", children: /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "ID Verification Result" }) }) }),
      /* @__PURE__ */ jsxs("div", { className: "max-w-lg mx-auto p-4 space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-green-500 text-white rounded-2xl p-4 flex items-center gap-4", children: [
          /* @__PURE__ */ jsx("div", { className: "w-12 h-12 bg-white/20 rounded-full flex items-center justify-center", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M5 13l4 4L19 7" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-bold text-lg", children: "Verification Complete" }),
            /* @__PURE__ */ jsx("div", { className: "text-white/80 text-sm", children: "ID document processed successfully" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-lg p-4", children: [
          /* @__PURE__ */ jsxs("h2", { className: "font-bold text-gray-900 mb-3 flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-5 h-5 text-blue-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }),
            "Extracted Information"
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "divide-y divide-gray-100", children: [
            renderField("Full Name", data.fullName || data.name),
            renderField("First Name", data.firstName),
            renderField("Middle Name", data.middleName),
            renderField("Last Name", data.lastName),
            renderField("ID Number", data.idNumber),
            renderField("Date of Birth", data.dateOfBirth || data.birthDate),
            renderField("Sex", data.sex),
            renderField("Address", data.address),
            renderField("Nationality", data.nationality),
            renderField("Expiry Date", data.expiryDate),
            renderField("Issue Date", data.issueDate)
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "space-y-3 pt-2", children: ((_a = session == null ? void 0 : session.payload) == null ? void 0 : _a.nextStep) === "selfie" ? /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleContinueToSelfie,
            className: "w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition",
            children: "Continue to Selfie Verification →"
          }
        ) : /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleContinueToSelfie,
            className: "w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition",
            children: "Done"
          }
        ) })
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 bg-black flex flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex-1 relative", children: [
      /* @__PURE__ */ jsx(
        "video",
        {
          ref: videoRef,
          autoPlay: true,
          muted: true,
          playsInline: true,
          className: "absolute inset-0 w-full h-full object-cover"
        }
      ),
      /* @__PURE__ */ jsx("canvas", { ref: canvasRef, className: "hidden" }),
      /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 pointer-events-none", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent" }),
        /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: `w-80 h-52 sm:w-96 sm:h-60 border-4 rounded-2xl transition-all duration-300 ${capturedImage ? "border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.5)]" : "border-white/70 border-dashed"}`
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" }),
          /* @__PURE__ */ jsx("div", { className: "absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" }),
          /* @__PURE__ */ jsx("div", { className: "absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" }),
          /* @__PURE__ */ jsx("div", { className: "absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" })
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "absolute top-4 left-4 right-4 pointer-events-auto", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsx("button", { onClick: () => setSelectedIdType(null), className: "p-2 bg-white/20 backdrop-blur rounded-full", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }),
          /* @__PURE__ */ jsxs("div", { className: "px-3 py-1 bg-blue-500/80 backdrop-blur rounded-full text-white text-xs font-medium flex items-center gap-1", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" }) }),
            getIdTypeLabel2(selectedIdType)
          ] })
        ] }) }),
        cameraStarted && !capturedImage && /* @__PURE__ */ jsx("div", { className: "absolute top-20 left-6 right-6 text-center", children: /* @__PURE__ */ jsx("div", { className: "text-white/80 text-sm", children: "Align your ID card within the frame" }) })
      ] }),
      isProcessing && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/70 flex items-center justify-center z-20", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" }),
        /* @__PURE__ */ jsx("div", { className: "text-white font-medium", children: feedback })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "relative z-10 px-6 pb-8 pt-4", children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          className: `mb-4 py-3 px-4 rounded-xl text-center font-medium ${feedbackType === "success" ? "bg-green-500 text-white" : feedbackType === "error" ? "bg-red-500 text-white" : feedbackType === "warning" ? "bg-yellow-500 text-black" : "bg-white/20 backdrop-blur text-white"}`,
          children: feedback
        }
      ),
      !cameraStarted ? /* @__PURE__ */ jsx(
        "button",
        {
          onClick: startCamera,
          className: "w-full py-4 bg-white text-black font-bold text-lg rounded-2xl hover:bg-gray-100 transition",
          children: "Start Camera"
        }
      ) : /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              stopCamera();
              setSelectedIdType(null);
            },
            className: "flex-1 py-4 bg-red-500/80 text-white font-bold rounded-2xl hover:bg-red-600 transition",
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: captureID,
            disabled: isProcessing,
            className: "flex-[2] py-4 bg-white text-black font-bold text-lg rounded-2xl hover:bg-gray-100 transition disabled:opacity-50 flex items-center justify-center gap-2",
            children: [
              /* @__PURE__ */ jsxs("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }),
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })
              ] }),
              "Capture"
            ]
          }
        )
      ] }),
      cameraStarted && /* @__PURE__ */ jsxs("div", { className: "flex justify-center gap-4 mt-4 text-white/60 text-xs", children: [
        /* @__PURE__ */ jsx("span", { children: "• Good lighting" }),
        /* @__PURE__ */ jsx("span", { children: "• Keep steady" }),
        /* @__PURE__ */ jsx("span", { children: "• Fill frame" })
      ] }),
      !cameraStarted && /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setSelectedIdType(null),
          className: "w-full mt-3 py-3 bg-white/10 backdrop-blur text-white/80 font-medium rounded-xl hover:bg-white/20 transition text-sm",
          children: "← Change ID Type"
        }
      )
    ] })
  ] });
}
const MOVEMENT_THRESHOLD = 8;
const LIVENESS_REQUIRED_SCORE = 70;
const CENTER_TOLERANCE$1 = 0.2;
const REQUIRED_CENTERED_FRAMES$1 = 10;
const MAX_FRAME_HISTORY = 30;
const MIN_FACE_CONFIDENCE$1 = 0.5;
const MIN_FACE_SIZE_RATIO$1 = 0.25;
const MAX_FACE_SIZE_RATIO$1 = 0.55;
const MIN_MICRO_MOVEMENT = 0.3;
const MAX_STATIC_FRAMES = 15;
const HEAD_POSE_VARIANCE_MIN = 0.5;
const EYE_BLINK_THRESHOLD$1 = 0.25;
const REQUIRED_BLINKS$1 = 1;
const BLINK_COOLDOWN_FRAMES$1 = 5;
function SelfieLiveness() {
  var _a;
  const { id: sessionId } = useParams();
  const faceVideoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const faceStreamRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const frameHistoryRef = useRef([]);
  const lastFacePositionRef = useRef(null);
  const centeredFrameCountRef = useRef(0);
  const expressionChangeRef = useRef(false);
  const livenessScoreRef = useRef(0);
  const isRunningRef = useRef(false);
  const modelsLoadedRef = useRef(false);
  const staticFrameCountRef = useRef(0);
  const lastLandmarksRef = useRef(null);
  const headPoseHistoryRef = useRef([]);
  const spoofDetectedRef = useRef(false);
  const blinkCountRef = useRef(0);
  const eyesClosedRef = useRef(false);
  const blinkCooldownRef = useRef(0);
  const [session, setSession] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState(null);
  const [faceDetectionStarted, setFaceDetectionStarted] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [faceFeedback, setFaceFeedback] = useState("Loading...");
  const [faceFeedbackType, setFaceFeedbackType] = useState("info");
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [steadySeconds, setSteadySeconds] = useState(0);
  const [isCentered, setIsCentered] = useState(false);
  const [currentExpression, setCurrentExpression] = useState("");
  const [detectedExpressions, setDetectedExpressions] = useState([]);
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [faceBox, setFaceBox] = useState(null);
  const [linkedIdImage, setLinkedIdImage] = useState(null);
  const [faceMismatch, setFaceMismatch] = useState(false);
  const [faceMismatchDetails, setFaceMismatchDetails] = useState(null);
  const overlayCanvasRef = useRef(null);
  const expectedOrigin = typeof window !== "undefined" ? window.__IDENTITY_EXPECTED_ORIGIN__ || "*" : "*";
  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided");
      return;
    }
    fetch(`/api/verify/session/${sessionId}`).then((res) => res.json()).then(async (data) => {
      var _a2, _b, _c, _d, _e, _f;
      if (data.success && data.session) {
        const sessionStatus = (data.session.status || "").toLowerCase();
        if (["done", "completed", "success"].includes(sessionStatus)) {
          setSession(data.session);
          setConsentGiven(true);
          if ((_a2 = data.session.result) == null ? void 0 : _a2.capturedImageBase64) {
            setCapturedFace(data.session.result.capturedImageBase64);
          }
          if ((_b = data.session.result) == null ? void 0 : _b.livenessScore) {
            setLivenessScore(data.session.result.livenessScore);
            livenessScoreRef.current = data.session.result.livenessScore;
          }
          setFaceVerified(true);
          setFaceFeedback("Verification already completed");
          setFaceFeedbackType("success");
          return;
        }
        if (["failed", "cancelled", "canceled"].includes(sessionStatus)) {
          setError("This verification session has been cancelled or failed. Please create a new session to verify again.");
          return;
        }
        if (sessionStatus === "expired") {
          setError("This verification session has expired. Please create a new session.");
          return;
        }
        setSession(data.session);
        setFaceFeedback("Press Start to begin");
        if (((_c = data.session.payload) == null ? void 0 : _c.verificationType) === "combined-selfie" && ((_d = data.session.payload) == null ? void 0 : _d.linkedIdSession)) {
          try {
            const idSessionRes = await fetch(`/api/verify/session/${data.session.payload.linkedIdSession}`);
            const idSessionData = await idSessionRes.json();
            if (idSessionData.success && ((_f = (_e = idSessionData.session) == null ? void 0 : _e.result) == null ? void 0 : _f.capturedImageBase64)) {
              setLinkedIdImage(idSessionData.session.result.capturedImageBase64);
              console.log("[SelfieLiveness] Linked ID image loaded for face comparison");
            }
          } catch (err) {
            console.warn("[SelfieLiveness] Failed to load linked ID session:", err);
          }
        }
      } else {
        setError("Session not found or expired");
      }
    }).catch((err) => {
      console.error("Failed to fetch session:", err);
      setError("Failed to load session");
    });
  }, [sessionId]);
  useEffect(() => {
    return () => stopFaceDetection();
  }, []);
  useEffect(() => {
    const loadModels = async () => {
      try {
        setFaceFeedback("Loading AI models...");
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        modelsLoadedRef.current = true;
        setModelsLoaded(true);
        setFaceFeedback("Press Start to begin");
        console.log("Face-api.js models loaded");
      } catch (err) {
        console.error("Error loading models:", err);
        setFaceFeedback("Failed to load AI models");
        setFaceFeedbackType("error");
      }
    };
    loadModels();
  }, []);
  const notifyParent = useCallback((message) => {
    if (typeof window !== "undefined" && window.parent !== window) {
      try {
        window.parent.postMessage(message, expectedOrigin);
      } catch (e) {
        console.warn("[identity] postMessage failed", e);
      }
    }
  }, [expectedOrigin]);
  const notifyParentFailed = useCallback(async (reason, details = {}) => {
    notifyParent({
      identityOCR: {
        action: "verification_failed",
        status: "failed",
        reason,
        session: sessionId,
        details
      }
    });
    try {
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "failed",
          reason,
          result: details,
          finishedAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
    } catch (e) {
      console.warn("[identity] session fail update failed", e);
    }
  }, [notifyParent, sessionId]);
  const notifyParentCancelled = useCallback(async (reason) => {
    notifyParent({
      identityOCR: {
        action: "verification_cancelled",
        status: "cancelled",
        reason,
        session: sessionId
      }
    });
    try {
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          reason,
          finishedAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
    } catch (e) {
      console.warn("[identity] session cancel update failed", e);
    }
  }, [notifyParent, sessionId]);
  const handleConsentAccept = () => {
    setConsentGiven(true);
    setFaceFeedback("Press Start to begin");
  };
  const handleConsentDecline = async () => {
    setConsentGiven(false);
    setError("You declined the camera consent. The verification has been cancelled.");
    await notifyParentCancelled("consent_declined");
  };
  const startFaceDetection = async () => {
    var _a2, _b;
    if (!modelsLoadedRef.current) {
      setFaceFeedback("AI models loading...");
      setFaceFeedbackType("warning");
      return;
    }
    try {
      setFaceFeedback("Starting camera...");
      if (!((_a2 = navigator.mediaDevices) == null ? void 0 : _a2.getUserMedia)) {
        throw new Error("Camera not available. Use HTTPS.");
      }
      const cameraConfigs = [
        { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } } },
        { video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } } },
        { video: { facingMode: "user" } },
        { video: true }
      ];
      let mediaStream = null;
      let lastError = null;
      for (const config of cameraConfigs) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(config);
          console.log("Camera started with config:", config);
          break;
        } catch (err) {
          lastError = err;
          console.warn("Camera config failed:", config, err.message);
        }
      }
      if (!mediaStream) {
        throw lastError || new Error("Could not access camera");
      }
      faceStreamRef.current = mediaStream;
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = mediaStream;
        await new Promise((resolve) => {
          faceVideoRef.current.onloadedmetadata = () => {
            faceVideoRef.current.play();
            resolve();
          };
        });
        if (faceCanvasRef.current) {
          faceCanvasRef.current.width = faceVideoRef.current.videoWidth;
          faceCanvasRef.current.height = faceVideoRef.current.videoHeight;
        }
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = faceVideoRef.current.videoWidth;
          overlayCanvasRef.current.height = faceVideoRef.current.videoHeight;
        }
      }
      frameHistoryRef.current = [];
      lastFacePositionRef.current = null;
      centeredFrameCountRef.current = 0;
      expressionChangeRef.current = false;
      livenessScoreRef.current = 0;
      isRunningRef.current = true;
      staticFrameCountRef.current = 0;
      lastLandmarksRef.current = null;
      headPoseHistoryRef.current = [];
      spoofDetectedRef.current = false;
      blinkCountRef.current = 0;
      eyesClosedRef.current = false;
      blinkCooldownRef.current = 0;
      setFaceDetectionStarted(true);
      setLivenessScore(0);
      setCapturedFace(null);
      setFaceVerified(false);
      setIsCentered(false);
      setCurrentExpression("");
      setDetectedExpressions([]);
      setFaceFeedback("👁️ Please blink once");
      startLivenessDetection();
    } catch (err) {
      console.error("Camera error:", err);
      let errorMsg = err.message || "Camera access failed";
      if (err.name === "NotAllowedError") {
        errorMsg = "Camera permission denied. Please allow camera access.";
      } else if (err.name === "NotFoundError") {
        errorMsg = "No camera found. Please connect a camera.";
      } else if (err.name === "NotReadableError" || ((_b = err.message) == null ? void 0 : _b.includes("Could not start"))) {
        errorMsg = "Camera is in use by another app. Please close other apps using the camera.";
      } else if (err.name === "OverconstrainedError") {
        errorMsg = "Camera does not support requested settings.";
      } else if (!window.isSecureContext) {
        errorMsg = "Camera requires HTTPS. Use localhost or enable HTTPS.";
      }
      setFaceFeedback(errorMsg);
      setFaceFeedbackType("error");
    }
  };
  const stopFaceDetection = useCallback(() => {
    isRunningRef.current = false;
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach((t) => t.stop());
      faceStreamRef.current = null;
    }
    if (faceVideoRef.current) faceVideoRef.current.srcObject = null;
    frameHistoryRef.current = [];
    livenessScoreRef.current = 0;
    centeredFrameCountRef.current = 0;
    setFaceDetectionStarted(false);
  }, []);
  const isProcessingRef = useRef(false);
  const startLivenessDetection = () => {
    if (faceDetectionIntervalRef.current) clearInterval(faceDetectionIntervalRef.current);
    faceDetectionIntervalRef.current = setInterval(async () => {
      if (!isRunningRef.current || isProcessingRef.current) return;
      isProcessingRef.current = true;
      try {
        await analyzeLiveness();
      } finally {
        isProcessingRef.current = false;
      }
    }, 250);
  };
  const analyzeLiveness = async () => {
    const video = faceVideoRef.current;
    if (!video || video.readyState < 2) return;
    try {
      const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
        scoreThreshold: MIN_FACE_CONFIDENCE$1,
        inputSize: 224
      })).withFaceLandmarks().withFaceExpressions();
      if (!detections) {
        setFaceFeedback("👤 Position your face in the oval");
        setFaceFeedbackType("warning");
        livenessScoreRef.current = Math.max(0, livenessScoreRef.current - 5);
        setLivenessScore(Math.round(livenessScoreRef.current));
        setIsCentered(false);
        centeredFrameCountRef.current = 0;
        setFaceLandmarks(null);
        setFaceBox(null);
        clearOverlayCanvas();
        return;
      }
      const { detection, landmarks, expressions } = detections;
      const box = detection.box;
      const dominantExpression = Object.entries(expressions).reduce((a, b) => a[1] > b[1] ? a : b);
      setCurrentExpression(dominantExpression[0]);
      setFaceBox(box);
      setFaceLandmarks(landmarks);
      if (livenessScoreRef.current > 0) {
        drawFaceLandmarks(landmarks, box);
      } else {
        clearOverlayCanvas();
      }
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const videoCenterX = videoWidth / 2;
      const videoCenterY = videoHeight / 2;
      const offsetX = Math.abs(faceCenterX - videoCenterX) / videoWidth;
      const offsetY = Math.abs(faceCenterY - videoCenterY) / videoHeight;
      const faceIsCentered = offsetX < CENTER_TOLERANCE$1 && offsetY < CENTER_TOLERANCE$1;
      setIsCentered(faceIsCentered);
      const faceSizeRatio = box.height / videoHeight;
      const isTooClose = faceSizeRatio > MAX_FACE_SIZE_RATIO$1;
      const isTooFar = faceSizeRatio < MIN_FACE_SIZE_RATIO$1;
      const faceIsProperSize = !isTooClose && !isTooFar;
      let movement = 0;
      if (lastFacePositionRef.current) {
        movement = Math.abs(faceCenterX - lastFacePositionRef.current.x) + Math.abs(faceCenterY - lastFacePositionRef.current.y) + Math.abs(box.width - lastFacePositionRef.current.width);
      }
      lastFacePositionRef.current = { x: faceCenterX, y: faceCenterY, width: box.width };
      const leftEAR = getEyeAspectRatio(landmarks.getLeftEye());
      const rightEAR = getEyeAspectRatio(landmarks.getRightEye());
      const avgEyeRatio = (leftEAR + rightEAR) / 2;
      let microMovement = 0;
      const currentLandmarks = landmarks.positions;
      if (lastLandmarksRef.current && currentLandmarks.length === lastLandmarksRef.current.length) {
        for (let i = 0; i < currentLandmarks.length; i++) {
          microMovement += Math.abs(currentLandmarks[i].x - lastLandmarksRef.current[i].x);
          microMovement += Math.abs(currentLandmarks[i].y - lastLandmarksRef.current[i].y);
        }
        microMovement /= currentLandmarks.length;
      }
      lastLandmarksRef.current = currentLandmarks.map((p) => ({ x: p.x, y: p.y }));
      if (microMovement < MIN_MICRO_MOVEMENT && microMovement > 0) {
        staticFrameCountRef.current++;
      } else {
        staticFrameCountRef.current = Math.max(0, staticFrameCountRef.current - 1);
      }
      const noseTip = landmarks.getNose()[3];
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const eyeCenterX = (leftEye[0].x + rightEye[3].x) / 2;
      const eyeCenterY = (leftEye[0].y + rightEye[3].y) / 2;
      const headPoseX = noseTip.x - eyeCenterX;
      const headPoseY = noseTip.y - eyeCenterY;
      headPoseHistoryRef.current.push({ x: headPoseX, y: headPoseY });
      if (headPoseHistoryRef.current.length > 15) headPoseHistoryRef.current.shift();
      let headPoseVariance = 0;
      if (headPoseHistoryRef.current.length >= 10) {
        const poses = headPoseHistoryRef.current;
        const meanX = poses.reduce((s, p) => s + p.x, 0) / poses.length;
        const meanY = poses.reduce((s, p) => s + p.y, 0) / poses.length;
        headPoseVariance = poses.reduce((s, p) => s + Math.pow(p.x - meanX, 2) + Math.pow(p.y - meanY, 2), 0) / poses.length;
      }
      frameHistoryRef.current.push({
        timestamp: Date.now(),
        faceCenterX,
        faceCenterY,
        faceWidth: box.width,
        eyeRatio: avgEyeRatio,
        expression: dominantExpression[0],
        confidence: detection.score
      });
      if (frameHistoryRef.current.length > MAX_FRAME_HISTORY) frameHistoryRef.current.shift();
      let indicators = 0;
      if (detection.score > MIN_FACE_CONFIDENCE$1) indicators++;
      if (movement > MOVEMENT_THRESHOLD) indicators++;
      if (blinkCooldownRef.current > 0) {
        blinkCooldownRef.current--;
      }
      const eyesClosed = avgEyeRatio < EYE_BLINK_THRESHOLD$1;
      if (eyesClosed && !eyesClosedRef.current && blinkCooldownRef.current === 0) {
        eyesClosedRef.current = true;
      } else if (!eyesClosed && eyesClosedRef.current) {
        blinkCountRef.current++;
        eyesClosedRef.current = false;
        blinkCooldownRef.current = BLINK_COOLDOWN_FRAMES$1;
        console.log(`Blink detected! Count: ${blinkCountRef.current}/${REQUIRED_BLINKS$1}`);
      }
      const blinkCompleted = blinkCountRef.current >= REQUIRED_BLINKS$1;
      if (blinkCompleted) expressionChangeRef.current = true;
      if (frameHistoryRef.current.length >= 5) {
        const xPos = frameHistoryRef.current.slice(-10).map((f) => f.faceCenterX);
        const mean = xPos.reduce((a, b) => a + b, 0) / xPos.length;
        const variance = xPos.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / xPos.length;
        if (variance > 5) indicators++;
      }
      if (blinkCompleted) indicators += 2;
      if (expressionChangeRef.current) indicators++;
      const isTooStatic = staticFrameCountRef.current > MAX_STATIC_FRAMES;
      const hasNoHeadMovement = headPoseHistoryRef.current.length >= 10 && headPoseVariance < HEAD_POSE_VARIANCE_MIN;
      const potentialSpoof = isTooStatic && hasNoHeadMovement && !blinkCompleted;
      if (potentialSpoof && !blinkCompleted) {
        indicators = Math.max(0, indicators - 1);
        spoofDetectedRef.current = true;
      } else if (blinkCompleted || microMovement > MIN_MICRO_MOVEMENT) {
        spoofDetectedRef.current = false;
      }
      if (faceIsCentered) centeredFrameCountRef.current++;
      else centeredFrameCountRef.current = 0;
      const frameScore = indicators / 6 * 100;
      livenessScoreRef.current = livenessScoreRef.current * 0.7 + frameScore * 0.3;
      const score = Math.round(livenessScoreRef.current);
      setLivenessScore(score);
      const remaining = Math.max(0, Math.ceil((REQUIRED_CENTERED_FRAMES$1 - centeredFrameCountRef.current) * 0.2));
      setSteadySeconds(remaining);
      const getExpressionEmoji = (expr) => {
        switch (expr) {
          case "happy":
            return "😊";
          case "angry":
            return "😠";
          case "sad":
            return "😢";
          case "surprised":
            return "😲";
          default:
            return "😐";
        }
      };
      if (!faceIsCentered) {
        const moveHorizontal = offsetX >= CENTER_TOLERANCE$1;
        const moveVertical = offsetY >= CENTER_TOLERANCE$1;
        if (moveHorizontal && moveVertical) {
          const hDir = faceCenterX < videoCenterX ? "← Move left" : "→ Move right";
          const vDir = faceCenterY < videoCenterY ? "↓ Move down" : "↑ Move up";
          setFaceFeedback(`${hDir} and ${vDir}`);
        } else if (moveHorizontal) {
          setFaceFeedback(faceCenterX < videoCenterX ? "← Move left" : "→ Move right");
        } else if (moveVertical) {
          setFaceFeedback(faceCenterY < videoCenterY ? "↓ Move face down" : "↑ Move face up");
        }
        setFaceFeedbackType("warning");
      } else if (isTooClose) {
        setFaceFeedback("📏 Move back, too close");
        setFaceFeedbackType("warning");
      } else if (isTooFar) {
        setFaceFeedback("📏 Move closer to camera");
        setFaceFeedbackType("warning");
      } else if (spoofDetectedRef.current) {
        if (staticFrameCountRef.current > MAX_STATIC_FRAMES) {
          setFaceFeedback("🚫 Move your head slightly");
        } else {
          setFaceFeedback("🚫 Please use a real face, not a photo");
        }
        setFaceFeedbackType("error");
      } else if (!blinkCompleted) {
        const blinks = blinkCountRef.current;
        setFaceFeedback(`👁️ Please blink once (${blinks}/${REQUIRED_BLINKS$1})`);
        setFaceFeedbackType("info");
      } else if (score < LIVENESS_REQUIRED_SCORE) {
        setFaceFeedback("🔄 Keep looking at the camera...");
        setFaceFeedbackType("info");
      } else if (centeredFrameCountRef.current >= REQUIRED_CENTERED_FRAMES$1 && blinkCompleted && !spoofDetectedRef.current && faceIsProperSize) {
        setFaceFeedback("📸 Perfect! Capturing...");
        setFaceFeedbackType("success");
        performCapture();
      } else {
        setFaceFeedback(`✓ Hold still for ${remaining}s`);
        setFaceFeedbackType("success");
      }
    } catch (err) {
      console.error("Detection error:", err);
    }
  };
  const getEyeAspectRatio = (eye) => {
    const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
    const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
    const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
    return (v1 + v2) / (2 * h);
  };
  const clearOverlayCanvas = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  const drawFaceLandmarks = (landmarks, box) => {
    const canvas = overlayCanvasRef.current;
    const video = faceVideoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;
    const points = landmarks.positions;
    const scaledPoints = points.map((p) => ({
      x: p.x * scaleX,
      y: p.y * scaleY
    }));
    const meshConnections = [
      [17, 18],
      [18, 19],
      [19, 20],
      [20, 21],
      [22, 23],
      [23, 24],
      [24, 25],
      [25, 26],
      [17, 36],
      [18, 36],
      [18, 37],
      [19, 37],
      [19, 38],
      [20, 38],
      [20, 39],
      [21, 39],
      [22, 42],
      [23, 42],
      [23, 43],
      [24, 43],
      [24, 44],
      [25, 44],
      [25, 45],
      [26, 45],
      [17, 21],
      [22, 26],
      [19, 21],
      [22, 24],
      [36, 37],
      [37, 38],
      [38, 39],
      [39, 40],
      [40, 41],
      [41, 36],
      [36, 39],
      [37, 40],
      [38, 41],
      [42, 43],
      [43, 44],
      [44, 45],
      [45, 46],
      [46, 47],
      [47, 42],
      [42, 45],
      [43, 46],
      [44, 47],
      [27, 28],
      [28, 29],
      [29, 30],
      [30, 31],
      [30, 35],
      [31, 32],
      [32, 33],
      [33, 34],
      [34, 35],
      [31, 33],
      [33, 35],
      [27, 21],
      [27, 22],
      [27, 39],
      [27, 42],
      [28, 39],
      [28, 42],
      [29, 31],
      [29, 35],
      [39, 27],
      [42, 27],
      [40, 29],
      [47, 29],
      [41, 31],
      [46, 35],
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [12, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [0, 17],
      [1, 36],
      [2, 41],
      [3, 31],
      [16, 26],
      [15, 45],
      [14, 46],
      [13, 35],
      [4, 48],
      [5, 48],
      [6, 59],
      [12, 54],
      [11, 54],
      [10, 55],
      [7, 58],
      [8, 57],
      [9, 56],
      [48, 49],
      [49, 50],
      [50, 51],
      [51, 52],
      [52, 53],
      [53, 54],
      [54, 55],
      [55, 56],
      [56, 57],
      [57, 58],
      [58, 59],
      [59, 48],
      [60, 61],
      [61, 62],
      [62, 63],
      [63, 64],
      [64, 65],
      [65, 66],
      [66, 67],
      [67, 60],
      [48, 60],
      [51, 62],
      [54, 64],
      [57, 66],
      [49, 61],
      [50, 62],
      [52, 63],
      [53, 64],
      [55, 65],
      [56, 66],
      [58, 67],
      [59, 60],
      [31, 48],
      [32, 49],
      [33, 51],
      [34, 53],
      [35, 54],
      [36, 41],
      [42, 47],
      [31, 41],
      [35, 46],
      [30, 33],
      [27, 30],
      [17, 19],
      [19, 21],
      [22, 24],
      [24, 26],
      [18, 20],
      [23, 25],
      [21, 27],
      [22, 27],
      [17, 0],
      [26, 16]
    ];
    const lineColor = "rgba(255, 255, 255, 0.5)";
    const dotColor = "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    meshConnections.forEach(([i, j]) => {
      if (scaledPoints[i] && scaledPoints[j]) {
        ctx.moveTo(scaledPoints[i].x, scaledPoints[i].y);
        ctx.lineTo(scaledPoints[j].x, scaledPoints[j].y);
      }
    });
    ctx.stroke();
    ctx.fillStyle = dotColor;
    scaledPoints.forEach((point) => {
      if (!point) return;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  };
  const performCapture = async () => {
    var _a2;
    if (!isRunningRef.current) return;
    const video = faceVideoRef.current;
    const canvas = faceCanvasRef.current;
    if (!canvas || !video) return;
    setFaceFeedback("🔍 Final checking, hold on...");
    setFaceFeedbackType("info");
    try {
      const finalDetection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: MIN_FACE_CONFIDENCE$1 })).withFaceLandmarks();
      if (!finalDetection) {
        setFaceFeedback("⚠️ Face lost! Look at the camera");
        setFaceFeedbackType("warning");
        centeredFrameCountRef.current = 0;
        return;
      }
      const box = finalDetection.detection.box;
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const videoCenterX = video.videoWidth / 2;
      const videoCenterY = video.videoHeight / 2;
      const offsetX = Math.abs(faceCenterX - videoCenterX) / video.videoWidth;
      const offsetY = Math.abs(faceCenterY - videoCenterY) / video.videoHeight;
      if (offsetX >= CENTER_TOLERANCE$1 || offsetY >= CENTER_TOLERANCE$1) {
        setFaceFeedback("⚠️ Center your face again");
        setFaceFeedbackType("warning");
        centeredFrameCountRef.current = 0;
        return;
      }
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setFaceFeedback("🤖 AI verifying real human...");
      setFaceFeedbackType("info");
      try {
        const blinkCompleted = blinkCountRef.current >= REQUIRED_BLINKS$1;
        const aiResponse = await fetch("/api/ai/face/liveness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: imageDataUrl,
            livenessScore: livenessScoreRef.current,
            movementDetected: blinkCompleted || expressionChangeRef.current
          })
        });
        const aiResult = await aiResponse.json();
        if (aiResult.success && aiResult.result) {
          const { isLive, confidence, reason } = aiResult.result;
          if (!isLive || confidence < 70) {
            setFaceFeedback(`❌ Spoofing detected: ${reason || "Please use a real face"}`);
            setFaceFeedbackType("error");
            centeredFrameCountRef.current = 0;
            spoofDetectedRef.current = true;
            return;
          }
        }
      } catch (aiErr) {
        console.warn("AI liveness check failed, proceeding with local checks:", aiErr);
      }
      if (linkedIdImage) {
        setFaceFeedback("🔍 Comparing face with ID photo...");
        setFaceFeedbackType("info");
        let faceApiMatch = null;
        let faceApiDistance = null;
        try {
          const idImg = await faceapi.fetchImage(linkedIdImage);
          const idDetection = await faceapi.detectSingleFace(idImg, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })).withFaceLandmarks().withFaceDescriptor();
          const selfieImg = await faceapi.fetchImage(imageDataUrl);
          const selfieDetection = await faceapi.detectSingleFace(selfieImg, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })).withFaceLandmarks().withFaceDescriptor();
          if (idDetection && selfieDetection) {
            const distance = faceapi.euclideanDistance(idDetection.descriptor, selfieDetection.descriptor);
            faceApiDistance = distance;
            faceApiMatch = distance < 0.7;
            console.log("[FaceComparison] Face-api.js distance:", distance, "Match:", faceApiMatch, "(threshold: 0.70)");
          } else {
            console.warn("[FaceComparison] Could not detect face in one or both images");
            if (!idDetection) {
              console.warn("[FaceComparison] No face detected in ID image");
            }
            if (!selfieDetection) {
              console.warn("[FaceComparison] No face detected in selfie");
            }
          }
        } catch (faceApiErr) {
          console.warn("[FaceComparison] Face-api.js comparison failed:", faceApiErr);
        }
        let aiMatch = null;
        let aiConfidence = null;
        let aiReason = null;
        try {
          const compareResponse = await fetch("/api/ai/face/compare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idImage: linkedIdImage,
              selfieImage: imageDataUrl
            })
          });
          const compareResult = await compareResponse.json();
          if (compareResult.success && compareResult.result) {
            aiMatch = compareResult.result.isMatch;
            aiConfidence = compareResult.result.confidence;
            aiReason = compareResult.result.reason;
            console.log("[FaceComparison] AI result:", aiMatch, "Confidence:", aiConfidence, "Reason:", aiReason);
          }
        } catch (aiCompareErr) {
          console.warn("[FaceComparison] AI comparison failed:", aiCompareErr);
        }
        console.log("[FaceComparison] Final Results - FaceAPI Match:", faceApiMatch, "Distance:", faceApiDistance, "AI Match:", aiMatch, "AI Confidence:", aiConfidence);
        let finalMismatch = false;
        let mismatchReason = "";
        const similarity = faceApiDistance !== null ? Math.round((1 - faceApiDistance) * 100) : null;
        let isMatch = false;
        if (aiMatch === true && aiConfidence >= 60) {
          isMatch = true;
          console.log("[FaceComparison] ✅ AI match with high confidence");
        } else if (aiMatch === true && aiConfidence >= 40 && (faceApiDistance === null || faceApiDistance < 0.75)) {
          isMatch = true;
          console.log("[FaceComparison] ✅ AI match with moderate confidence, faceApi neutral");
        } else if (faceApiDistance !== null && faceApiDistance < 0.6 && (aiMatch === null || aiMatch === true)) {
          isMatch = true;
          console.log("[FaceComparison] ✅ FaceApi strong match");
        } else if (faceApiDistance !== null && faceApiDistance < 0.7 && aiMatch === null) {
          isMatch = true;
          console.log("[FaceComparison] ✅ FaceApi moderate match (age-tolerant), AI unavailable");
        }
        if (!isMatch) {
          if (aiMatch === false && aiConfidence >= 70) {
            finalMismatch = true;
            mismatchReason = aiReason || `Face mismatch detected (${aiConfidence}% confidence)`;
            console.log("[FaceComparison] ❌ AI high confidence mismatch");
          } else if (aiMatch === false && aiConfidence >= 50 && faceApiDistance !== null && faceApiDistance >= 0.75) {
            finalMismatch = true;
            mismatchReason = `Face verification failed: ${similarity}% similarity, AI also detected mismatch`;
            console.log("[FaceComparison] ❌ Both AI and faceApi say mismatch");
          } else if (faceApiDistance !== null && faceApiDistance >= 0.8 && aiMatch !== true) {
            finalMismatch = true;
            mismatchReason = `Face mismatch: ${similarity}% similarity (too different)`;
            console.log("[FaceComparison] ❌ FaceApi very high distance");
          } else if (aiMatch === null && faceApiDistance !== null && faceApiDistance >= 0.75) {
            finalMismatch = true;
            mismatchReason = `Face verification failed: ${similarity}% similarity`;
            console.log("[FaceComparison] ❌ AI unavailable, faceApi mismatch");
          }
        }
        if (finalMismatch) {
          setFaceMismatch(true);
          setFaceMismatchDetails({
            confidence: similarity || 100 - (aiConfidence || 50),
            reason: mismatchReason,
            details: {
              faceApiDistance,
              faceApiMatch,
              aiMatch,
              aiConfidence
            }
          });
          setFaceFeedback(`❌ ${mismatchReason}`);
          setFaceFeedbackType("error");
          centeredFrameCountRef.current = 0;
          setCapturedFace(imageDataUrl);
          notifyParentFailed("face_mismatch", {
            confidence: similarity || 100 - (aiConfidence || 50),
            reason: mismatchReason,
            faceApiDistance,
            aiMatch,
            aiConfidence
          });
          return;
        }
      }
      isRunningRef.current = false;
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
      }
      setCapturedFace(imageDataUrl);
      setFaceVerified(true);
      setFaceFeedback("✅ Verified! Real human confirmed");
      setFaceFeedbackType("success");
      setLivenessScore(100);
      setSteadySeconds(0);
      stopFaceDetection();
      const result = {
        action: "success",
        capturedImageBase64: imageDataUrl,
        livenessScore: 100,
        aiVerified: true,
        faceMatched: linkedIdImage ? true : null,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId
      };
      await saveSessionResult(result);
      notifyParent({
        identityOCR: {
          action: "verification_success",
          status: "success",
          result,
          session: sessionId,
          images: {
            selfieImage: imageDataUrl
          },
          verificationType: ((_a2 = session == null ? void 0 : session.payload) == null ? void 0 : _a2.verificationType) || "selfie"
        }
      });
    } catch (err) {
      console.error("Final capture check error:", err);
      setFaceFeedback("⚠️ Verification failed, try again");
      setFaceFeedbackType("error");
      centeredFrameCountRef.current = 0;
      notifyParentFailed("capture_error", { error: err.message });
    }
  };
  const saveSessionResult = async (result) => {
    try {
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "done",
          result,
          finishedAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
    } catch (e) {
      console.warn("[identity] save result failed", e);
    }
  };
  const handleDone = () => {
    notifyParent({
      identityOCR: {
        action: "verification_complete",
        session: sessionId
      }
    });
  };
  if (error) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4", children: /* @__PURE__ */ jsx("svg", { className: "w-8 h-8 text-red-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }),
      /* @__PURE__ */ jsx("h2", { className: "text-xl font-bold text-gray-900 mb-2", children: "Verification Error" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-600", children: error })
    ] }) });
  }
  if (!session) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-4" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-600", children: "Loading session..." })
    ] }) });
  }
  if (!consentGiven) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-xl font-bold text-gray-900 mb-4", children: "Privacy & Camera Consent" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-600 mb-4", children: "This verification will use your camera to perform a liveness check. By continuing you consent to allow the camera to capture images for verification purposes." }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-700 font-medium mb-2", children: "For best results:" }),
      /* @__PURE__ */ jsxs("ul", { className: "list-disc pl-5 mb-4 text-gray-600 text-sm space-y-1", children: [
        /* @__PURE__ */ jsx("li", { children: "Ensure good, even lighting on your face." }),
        /* @__PURE__ */ jsx("li", { children: "Look directly at the camera." }),
        /* @__PURE__ */ jsx("li", { children: "Blink naturally when prompted." }),
        /* @__PURE__ */ jsx("li", { children: "Keep your face centered in the oval guide." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-3 justify-end", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleConsentDecline,
            className: "px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition",
            children: "Decline"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleConsentAccept,
            className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition",
            children: "I Consent & Continue"
          }
        )
      ] })
    ] }) });
  }
  if (faceMismatch && capturedFace) {
    const handleRetry = () => {
      setFaceMismatch(false);
      setFaceMismatchDetails(null);
      setCapturedFace(null);
      setFaceVerified(false);
      setFaceFeedback("Press Start to try again");
      setFaceFeedbackType("info");
      setLivenessScore(0);
      setDetectedExpressions([]);
      centeredFrameCountRef.current = 0;
      blinkCountRef.current = 0;
      eyesClosedRef.current = false;
      blinkCooldownRef.current = 0;
    };
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex flex-col", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsx("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-center", children: /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "Face Verification Failed" }) }) }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center mb-6", children: [
          /* @__PURE__ */ jsx("div", { className: "w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center mb-4 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M6 18L18 6M6 6l12 12" }) }) }),
          /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Face Mismatch Detected" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-2", children: "The selfie does not match the ID photo" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-4 mb-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4 mb-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
              /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-500 mb-2", children: "ID Photo" }),
              linkedIdImage && /* @__PURE__ */ jsx(
                "img",
                {
                  src: linkedIdImage,
                  alt: "ID Photo",
                  className: "w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
              /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-500 mb-2", children: "Your Selfie" }),
              /* @__PURE__ */ jsx(
                "img",
                {
                  src: capturedFace,
                  alt: "Selfie",
                  className: "w-full h-32 object-cover rounded-lg border-2 border-red-300"
                }
              )
            ] })
          ] }),
          faceMismatchDetails && /* @__PURE__ */ jsxs("div", { className: "border-t border-gray-100 pt-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center text-sm", children: [
              /* @__PURE__ */ jsx("span", { className: "text-gray-500", children: "Face Similarity" }),
              /* @__PURE__ */ jsxs("span", { className: `font-semibold ${faceMismatchDetails.confidence < 50 ? "text-red-600" : "text-orange-500"}`, children: [
                faceMismatchDetails.confidence || 0,
                "%"
              ] })
            ] }),
            ((_a = faceMismatchDetails.details) == null ? void 0 : _a.faceApiDistance) !== void 0 && /* @__PURE__ */ jsxs("div", { className: "mt-1 text-xs text-gray-400", children: [
              "Face-api.js distance: ",
              faceMismatchDetails.details.faceApiDistance.toFixed(3)
            ] }),
            faceMismatchDetails.reason && /* @__PURE__ */ jsx("div", { className: "mt-2 text-xs text-gray-600", children: faceMismatchDetails.reason })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "text-amber-500 flex-shrink-0", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold text-amber-800 text-sm", children: "What to do?" }),
            /* @__PURE__ */ jsxs("div", { className: "text-amber-700 text-xs mt-1", children: [
              "• Ensure you are the person on the ID",
              /* @__PURE__ */ jsx("br", {}),
              "• Use better lighting for the selfie",
              /* @__PURE__ */ jsx("br", {}),
              "• Position your face similar to the ID photo",
              /* @__PURE__ */ jsx("br", {}),
              "• Remove glasses or accessories if different from ID"
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: handleRetry,
            className: "w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2",
            children: [
              /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" }) }),
              "Try Again"
            ]
          }
        )
      ] }) })
    ] });
  }
  if (faceVerified && capturedFace) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex flex-col", children: /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
      /* @__PURE__ */ jsxs("div", { className: "text-center mb-6", children: [
        /* @__PURE__ */ jsx("div", { className: "w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M5 13l4 4L19 7" }) }) }),
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Verification Complete" }),
        /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-1", children: "Live person verified successfully" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "bg-white rounded-2xl shadow-xl overflow-hidden mb-6", children: /* @__PURE__ */ jsxs("div", { className: "p-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-green-600 mb-3", children: [
          /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }),
          /* @__PURE__ */ jsx("span", { className: "font-semibold", children: "100% Confidence" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [
          /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ Blink Detected" }) }),
          /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ Movement" }) }),
          /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ Expression" }) }),
          /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ Face Centered" }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "space-y-3", children: /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleDone,
          className: "w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition",
          children: "Done"
        }
      ) })
    ] }) }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 bg-black flex flex-col", children: [
    !faceDetectionStarted && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900" }),
    /* @__PURE__ */ jsx("div", { className: "relative z-20 px-4 pt-4 pb-2", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("div", { className: "w-10" }),
      modelsLoaded && /* @__PURE__ */ jsx("div", { className: "px-3 py-1 bg-green-500/80 backdrop-blur rounded-full text-white text-xs font-medium", children: "AI Ready" })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 relative flex flex-col", children: [
      /* @__PURE__ */ jsx(
        "video",
        {
          ref: faceVideoRef,
          autoPlay: true,
          muted: true,
          playsInline: true,
          className: `absolute inset-0 w-full h-full object-cover ${!faceDetectionStarted ? "hidden" : ""}`,
          style: { transform: "scaleX(-1)" }
        }
      ),
      /* @__PURE__ */ jsx("canvas", { ref: faceCanvasRef, className: "hidden" }),
      /* @__PURE__ */ jsx(
        "canvas",
        {
          ref: overlayCanvasRef,
          className: `absolute inset-0 w-full h-full object-cover pointer-events-none ${!faceDetectionStarted ? "hidden" : ""}`,
          style: { transform: "scaleX(-1)" }
        }
      ),
      faceDetectionStarted && livenessScore > 0 && /* @__PURE__ */ jsx(
        "div",
        {
          className: "absolute inset-0 backdrop-blur-md bg-black/40 pointer-events-none",
          style: {
            WebkitMaskImage: "radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)",
            maskImage: "radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)"
          }
        }
      ),
      faceDetectionStarted && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" }),
        /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" })
      ] }),
      !faceDetectionStarted && /* @__PURE__ */ jsxs("div", { className: "relative z-10 text-center pt-2 pb-4", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl sm:text-3xl font-bold text-white mb-1", children: "Face Verification" }),
        /* @__PURE__ */ jsx("p", { className: "text-white/60 text-sm sm:text-base px-8", children: "Position your face in the oval and follow the instructions" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex items-center justify-center relative", children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            className: `w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] border-4 transition-all duration-300 ${faceVerified ? "border-transparent" : faceDetectionStarted ? "border-dashed border-white/30" : "border-solid border-white/20"}`
          }
        ),
        !faceDetectionStarted && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: /* @__PURE__ */ jsxs(
          "svg",
          {
            viewBox: "0 0 200 280",
            className: "w-44 h-60 sm:w-52 sm:h-72",
            children: [
              /* @__PURE__ */ jsxs("g", { stroke: "rgba(255, 255, 255, 0.5)", strokeWidth: "1", fill: "none", children: [
                /* @__PURE__ */ jsx("path", { d: "M30 120 Q25 160 35 195 Q50 220 100 235 Q150 220 165 195 Q175 160 170 120" }),
                /* @__PURE__ */ jsx("path", { d: "M42 100 L55 95 L70 97 L82 102" }),
                /* @__PURE__ */ jsx("path", { d: "M118 102 L130 97 L145 95 L158 100" }),
                /* @__PURE__ */ jsx("path", { d: "M48 118 L58 115 L72 115 L82 118 L72 125 L58 125 Z" }),
                /* @__PURE__ */ jsx("path", { d: "M118 118 L128 115 L142 115 L152 118 L142 125 L128 125 Z" }),
                /* @__PURE__ */ jsx("path", { d: "M100 105 L100 150" }),
                /* @__PURE__ */ jsx("path", { d: "M85 155 L95 162 L100 165 L105 162 L115 155" }),
                /* @__PURE__ */ jsx("path", { d: "M70 185 Q85 178 100 178 Q115 178 130 185" }),
                /* @__PURE__ */ jsx("path", { d: "M70 185 Q85 198 100 200 Q115 198 130 185" }),
                /* @__PURE__ */ jsx("line", { x1: "65", y1: "120", x2: "100", y2: "140" }),
                /* @__PURE__ */ jsx("line", { x1: "135", y1: "120", x2: "100", y2: "140" }),
                /* @__PURE__ */ jsx("line", { x1: "100", y1: "150", x2: "65", y2: "120" }),
                /* @__PURE__ */ jsx("line", { x1: "100", y1: "150", x2: "135", y2: "120" }),
                /* @__PURE__ */ jsx("line", { x1: "70", y1: "185", x2: "90", y2: "160" }),
                /* @__PURE__ */ jsx("line", { x1: "130", y1: "185", x2: "110", y2: "160" }),
                /* @__PURE__ */ jsx("line", { x1: "48", y1: "118", x2: "42", y2: "100" }),
                /* @__PURE__ */ jsx("line", { x1: "82", y1: "118", x2: "82", y2: "102" }),
                /* @__PURE__ */ jsx("line", { x1: "118", y1: "118", x2: "118", y2: "102" }),
                /* @__PURE__ */ jsx("line", { x1: "152", y1: "118", x2: "158", y2: "100" }),
                /* @__PURE__ */ jsx("line", { x1: "30", y1: "120", x2: "48", y2: "118" }),
                /* @__PURE__ */ jsx("line", { x1: "170", y1: "120", x2: "152", y2: "118" })
              ] }),
              /* @__PURE__ */ jsx("g", { children: [
                [30, 120],
                [28, 140],
                [32, 165],
                [40, 190],
                [55, 210],
                [75, 225],
                [100, 235],
                [125, 225],
                [145, 210],
                [160, 190],
                [168, 165],
                [172, 140],
                [170, 120],
                [42, 100],
                [55, 95],
                [70, 97],
                [82, 102],
                [118, 102],
                [130, 97],
                [145, 95],
                [158, 100],
                [48, 118],
                [58, 115],
                [72, 115],
                [82, 118],
                [72, 125],
                [58, 125],
                [65, 120],
                [118, 118],
                [128, 115],
                [142, 115],
                [152, 118],
                [142, 125],
                [128, 125],
                [135, 120],
                [100, 105],
                [100, 120],
                [100, 135],
                [100, 150],
                [85, 155],
                [95, 162],
                [100, 165],
                [105, 162],
                [115, 155],
                [70, 185],
                [80, 180],
                [90, 178],
                [100, 178],
                [110, 178],
                [120, 180],
                [130, 185],
                [80, 192],
                [90, 196],
                [100, 200],
                [110, 196],
                [120, 192]
              ].map(([x, y], i) => /* @__PURE__ */ jsx("circle", { cx: x, cy: y, r: "3", fill: "rgba(255, 255, 255, 0.9)" }, i)) })
            ]
          }
        ) }),
        !faceDetectionStarted && /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] animate-pulse",
            style: {
              boxShadow: "0 0 40px rgba(59, 130, 246, 0.3), inset 0 0 40px rgba(59, 130, 246, 0.1)"
            }
          }
        ),
        faceDetectionStarted && /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] transition-all duration-300",
            style: {
              background: faceVerified ? "transparent" : `conic-gradient(${livenessScore >= 60 ? "#22c55e" : livenessScore >= 30 ? "#eab308" : "#ef4444"} ${livenessScore * 3.6}deg, transparent ${livenessScore * 3.6}deg)`,
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 4px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 4px))"
            }
          }
        ),
        faceVerified && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] border-4 border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.5)]" }),
        faceDetectionStarted && currentExpression && /* @__PURE__ */ jsx("div", { className: "absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap", children: /* @__PURE__ */ jsx("span", { className: "px-4 py-1.5 bg-black/50 backdrop-blur rounded-full text-white text-sm font-medium capitalize", children: currentExpression }) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "relative z-10 px-6 pb-6 pt-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent", children: [
      !faceDetectionStarted && /* @__PURE__ */ jsxs("div", { className: "mb-5 space-y-2.5", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-white/80", children: [
          /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx("span", { className: "text-blue-400 text-sm", children: "👁️" }) }),
          /* @__PURE__ */ jsx("span", { className: "text-sm", children: "Look directly at the camera" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-white/80", children: [
          /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx("span", { className: "text-blue-400 text-sm", children: "😌" }) }),
          /* @__PURE__ */ jsx("span", { className: "text-sm", children: "Blink naturally when prompted" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-white/80", children: [
          /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx("span", { className: "text-blue-400 text-sm", children: "💡" }) }),
          /* @__PURE__ */ jsx("span", { className: "text-sm", children: "Ensure good lighting on your face" })
        ] })
      ] }),
      faceDetectionStarted && /* @__PURE__ */ jsx(
        "div",
        {
          className: `mb-4 py-3 px-4 rounded-xl text-center font-medium ${faceFeedbackType === "success" ? "bg-green-500 text-white" : faceFeedbackType === "error" ? "bg-red-500 text-white" : faceFeedbackType === "warning" ? "bg-yellow-500 text-black" : "bg-white/20 backdrop-blur text-white"}`,
          children: faceFeedback
        }
      ),
      !faceDetectionStarted && /* @__PURE__ */ jsx(
        "button",
        {
          onClick: startFaceDetection,
          disabled: !modelsLoaded,
          className: "w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-lg rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-green-700 transition shadow-lg shadow-green-500/30",
          children: !modelsLoaded ? /* @__PURE__ */ jsxs("span", { className: "flex items-center justify-center gap-2", children: [
            /* @__PURE__ */ jsxs("svg", { className: "animate-spin h-5 w-5", viewBox: "0 0 24 24", children: [
              /* @__PURE__ */ jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4", fill: "none" }),
              /* @__PURE__ */ jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })
            ] }),
            "Loading AI Models..."
          ] }) : /* @__PURE__ */ jsxs("span", { className: "flex items-center justify-center gap-2", children: [
            /* @__PURE__ */ jsxs("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
              /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" }),
              /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" })
            ] }),
            "Start Face Scan"
          ] })
        }
      ),
      faceDetectionStarted && /* @__PURE__ */ jsxs("div", { className: "flex justify-center gap-3 mt-4", children: [
        /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${isCentered ? "bg-green-500" : "bg-white/30"}`, title: "Centered" }),
        /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${detectedExpressions.includes("happy") ? "bg-green-500" : "bg-white/30"}`, title: "Smile 😊" }),
        /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${detectedExpressions.includes("angry") ? "bg-green-500" : "bg-white/30"}`, title: "Angry 😠" }),
        /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${livenessScore >= 60 ? "bg-green-500" : "bg-white/30"}`, title: "Liveness" })
      ] })
    ] })
  ] });
}
const API_URL = "/api/ocr/base64";
const ID_TYPES = [
  { value: "national-id", label: "Philippine National ID", icon: "🇵🇭" },
  { value: "driver-license", label: "Driver's License", icon: "🚗" },
  { value: "passport", label: "Passport", icon: "✈️" },
  { value: "umid", label: "UMID", icon: "🆔" },
  { value: "philhealth", label: "PhilHealth ID", icon: "🏥" },
  { value: "tin-id", label: "TIN ID", icon: "📋" },
  { value: "postal-id", label: "Postal ID", icon: "📮" },
  { value: "pagibig", label: "Pag-IBIG ID", icon: "🏠" }
];
const CENTER_TOLERANCE = 0.2;
const REQUIRED_CENTERED_FRAMES = 10;
const MIN_FACE_CONFIDENCE = 0.5;
const MIN_FACE_SIZE_RATIO = 0.25;
const MAX_FACE_SIZE_RATIO = 0.55;
const EYE_BLINK_THRESHOLD = 0.25;
const REQUIRED_BLINKS = 1;
const BLINK_COOLDOWN_FRAMES = 5;
const FACE_MATCH_THRESHOLD = 0.7;
const getIdTypeLabel = (value) => {
  const found = ID_TYPES.find((t) => t.value === value);
  return found ? found.label : value;
};
function CombinedVerification() {
  const { id: sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState("id");
  const expectedOrigin = typeof window !== "undefined" ? window.__IDENTITY_EXPECTED_ORIGIN__ || "*" : "*";
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [selectedIdType, setSelectedIdType] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState("Loading session...");
  const [feedbackType, setFeedbackType] = useState("info");
  const [aiResult, setAiResult] = useState(null);
  const [idVerificationComplete, setIdVerificationComplete] = useState(false);
  const faceVideoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const faceStreamRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const centeredFrameCountRef = useRef(0);
  const modelsLoadedRef = useRef(false);
  const isRunningRef = useRef(false);
  const blinkCountRef = useRef(0);
  const eyesClosedRef = useRef(false);
  const blinkCooldownRef = useRef(0);
  const overlayCanvasRef = useRef(null);
  useRef(null);
  const [faceDetectionStarted, setFaceDetectionStarted] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceFeedback, setFaceFeedback] = useState("Complete ID verification first");
  const [faceFeedbackType, setFaceFeedbackType] = useState("info");
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [isCentered, setIsCentered] = useState(false);
  const [currentExpression, setCurrentExpression] = useState("");
  const [detectedExpressions, setDetectedExpressions] = useState([]);
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [faceBox, setFaceBox] = useState(null);
  const [faceMatchResult, setFaceMatchResult] = useState(null);
  const [selfieSessionId, setSelfieSessionId] = useState(null);
  const [faceMismatch, setFaceMismatch] = useState(false);
  const [faceMismatchDetails, setFaceMismatchDetails] = useState(null);
  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided");
      return;
    }
    fetch(`/api/verify/session/${sessionId}`).then((res) => res.json()).then((data) => {
      var _a, _b;
      if (data.success && data.session) {
        const sessionStatus = (data.session.status || "").toLowerCase();
        if (["done", "completed", "success"].includes(sessionStatus)) {
          setError("This verification session has already been completed.");
          return;
        }
        if (["failed", "cancelled", "canceled"].includes(sessionStatus)) {
          setError("This verification session has been cancelled or failed.");
          return;
        }
        if (sessionStatus === "expired") {
          setError("This verification session has expired.");
          return;
        }
        setSession(data.session);
        if ((_a = data.session.payload) == null ? void 0 : _a.idType) {
          setSelectedIdType(data.session.payload.idType);
        }
        if ((_b = data.session.payload) == null ? void 0 : _b.selfieSessionId) {
          setSelfieSessionId(data.session.payload.selfieSessionId);
        }
        setFeedback("Accept consent to continue");
      } else {
        setError("Session not found or expired");
      }
    }).catch((err) => {
      console.error("Failed to fetch session:", err);
      setError("Failed to load session");
    });
  }, [sessionId]);
  useEffect(() => {
    if (currentStep === "selfie" && !modelsLoadedRef.current) {
      loadFaceModels();
    }
  }, [currentStep]);
  useEffect(() => {
    return () => {
      stopCamera();
      stopFaceDetection();
    };
  }, []);
  const loadFaceModels = async () => {
    try {
      setFaceFeedback("Loading AI models...");
      const MODEL_URL = "/models";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      modelsLoadedRef.current = true;
      setModelsLoaded(true);
      setFaceFeedback("Press Start to begin face verification");
    } catch (err) {
      console.error("Error loading models:", err);
      setFaceFeedback("Failed to load AI models");
      setFaceFeedbackType("error");
    }
  };
  const notifyParent = useCallback((message) => {
    if (typeof window !== "undefined" && window.parent !== window) {
      try {
        window.parent.postMessage(message, expectedOrigin);
      } catch (e) {
        console.warn("[identity] postMessage failed", e);
      }
    }
  }, [expectedOrigin]);
  const notifyParentFailed = useCallback(async (reason, details = {}) => {
    notifyParent({
      identityOCR: {
        action: "verification_failed",
        status: "failed",
        reason,
        session: sessionId,
        details,
        verificationType: "combined",
        step: currentStep
      }
    });
    try {
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "failed",
          reason,
          result: details,
          finishedAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
    } catch (e) {
      console.warn("[identity] session update failed", e);
    }
  }, [sessionId, currentStep, notifyParent]);
  const handleConsentAccept = () => {
    setConsentGiven(true);
    setFeedback(selectedIdType ? "Start camera to capture ID" : "Select ID type to continue");
  };
  const handleConsentDecline = async () => {
    setError("You declined the consent. Verification cannot proceed.");
    notifyParent({
      identityOCR: {
        action: "verification_cancelled",
        status: "cancelled",
        reason: "consent_declined",
        session: sessionId,
        verificationType: "combined"
      }
    });
    try {
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          finishedAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
    } catch (e) {
      console.warn("[identity] session cancel failed", e);
    }
  };
  const startCamera = async () => {
    try {
      setFeedback("Starting camera...");
      const constraints = {
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            resolve();
          };
        });
        if (canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }
      }
      setCameraStarted(true);
      setFeedback("Position your ID within the frame");
      setFeedbackType("info");
    } catch (err) {
      console.error("Camera error:", err);
      setFeedback("Camera access denied: " + err.message);
      setFeedbackType("error");
    }
  };
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStarted(false);
  }, []);
  const captureId = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageDataUrl);
    setFeedback("ID captured. Processing...");
    processIdImage(imageDataUrl);
  };
  const fetchWithTimeout = (url, options, timeout = 15e3) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), timeout))
    ]);
  };
  const processIdImage = async (imageDataUrl) => {
    setIsProcessing(true);
    setFeedback("Processing ID...");
    setFeedbackType("info");
    try {
      const base64Data = imageDataUrl.split(",")[1];
      const res = await fetchWithTimeout(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Data,
          type: "identity",
          idType: selectedIdType || "unknown"
        })
      }, 3e4);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "OCR processing failed");
      const fields = data.fields || {};
      setAiResult({ data: fields });
      setFeedback("ID verification complete!");
      setFeedbackType("success");
      setIsProcessing(false);
      setIdVerificationComplete(true);
      const idResult = {
        action: "id_complete",
        fields,
        rawText: data.text || "",
        capturedImageBase64: imageDataUrl,
        idType: selectedIdType,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId
      };
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "id_complete",
          result: idResult
        })
      });
      stopCamera();
    } catch (err) {
      console.error("Processing error:", err);
      setFeedback("Failed: " + err.message);
      setFeedbackType("error");
      setIsProcessing(false);
      notifyParentFailed("id_processing_error", { error: err.message });
    }
  };
  const handleRecaptureId = () => {
    setCapturedImage(null);
    setAiResult(null);
    setIdVerificationComplete(false);
    setFeedback("Position your ID within the frame");
    setFeedbackType("info");
    startCamera();
  };
  const proceedToSelfie = () => {
    setCurrentStep("selfie");
    setFaceFeedback("Loading AI models...");
  };
  const startFaceCamera = async () => {
    if (!modelsLoadedRef.current) {
      setFaceFeedback("AI models loading...");
      setFaceFeedbackType("warning");
      return;
    }
    try {
      setFaceFeedback("Starting camera...");
      const cameraConfigs = [
        { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } } },
        { video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } } },
        { video: { facingMode: "user" } },
        { video: true }
      ];
      let mediaStream = null;
      let lastError = null;
      for (const config of cameraConfigs) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(config);
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!mediaStream) {
        throw lastError || new Error("Could not access camera");
      }
      faceStreamRef.current = mediaStream;
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = mediaStream;
        await new Promise((resolve) => {
          faceVideoRef.current.onloadedmetadata = () => {
            faceVideoRef.current.play();
            resolve();
          };
        });
        if (faceCanvasRef.current) {
          faceCanvasRef.current.width = faceVideoRef.current.videoWidth;
          faceCanvasRef.current.height = faceVideoRef.current.videoHeight;
        }
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = faceVideoRef.current.videoWidth;
          overlayCanvasRef.current.height = faceVideoRef.current.videoHeight;
        }
      }
      centeredFrameCountRef.current = 0;
      blinkCountRef.current = 0;
      eyesClosedRef.current = false;
      blinkCooldownRef.current = 0;
      setFaceDetectionStarted(true);
      isRunningRef.current = true;
      setLivenessScore(0);
      setDetectedExpressions([]);
      setFaceFeedback("👁️ Please blink once");
      setFaceFeedbackType("info");
      startFaceDetectionLoop();
    } catch (err) {
      console.error("Face camera error:", err);
      setFaceFeedback("Camera access failed: " + err.message);
      setFaceFeedbackType("error");
    }
  };
  const stopFaceDetection = useCallback(() => {
    isRunningRef.current = false;
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach((track) => track.stop());
      faceStreamRef.current = null;
    }
    if (faceVideoRef.current) faceVideoRef.current.srcObject = null;
    setFaceDetectionStarted(false);
  }, []);
  const startFaceDetectionLoop = () => {
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }
    faceDetectionIntervalRef.current = setInterval(detectFace, 200);
  };
  const clearOverlayCanvas = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  const drawFaceLandmarks = (landmarks, box) => {
    const canvas = overlayCanvasRef.current;
    const video = faceVideoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;
    const points = landmarks.positions;
    const scaledPoints = points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
    const meshConnections = [
      [17, 18],
      [18, 19],
      [19, 20],
      [20, 21],
      [22, 23],
      [23, 24],
      [24, 25],
      [25, 26],
      [36, 37],
      [37, 38],
      [38, 39],
      [39, 40],
      [40, 41],
      [41, 36],
      [42, 43],
      [43, 44],
      [44, 45],
      [45, 46],
      [46, 47],
      [47, 42],
      [27, 28],
      [28, 29],
      [29, 30],
      [30, 31],
      [30, 35],
      [31, 32],
      [32, 33],
      [33, 34],
      [34, 35],
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [12, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [48, 49],
      [49, 50],
      [50, 51],
      [51, 52],
      [52, 53],
      [53, 54],
      [54, 55],
      [55, 56],
      [56, 57],
      [57, 58],
      [58, 59],
      [59, 48],
      [60, 61],
      [61, 62],
      [62, 63],
      [63, 64],
      [64, 65],
      [65, 66],
      [66, 67],
      [67, 60]
    ];
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    meshConnections.forEach(([i, j]) => {
      if (scaledPoints[i] && scaledPoints[j]) {
        ctx.moveTo(scaledPoints[i].x, scaledPoints[i].y);
        ctx.lineTo(scaledPoints[j].x, scaledPoints[j].y);
      }
    });
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    scaledPoints.forEach((point) => {
      if (!point) return;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  };
  const detectFace = async () => {
    if (!faceVideoRef.current || !modelsLoadedRef.current || !isRunningRef.current) return;
    const video = faceVideoRef.current;
    if (video.readyState !== 4) return;
    try {
      const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: MIN_FACE_CONFIDENCE })).withFaceLandmarks().withFaceExpressions();
      if (!detection) {
        setFaceFeedback("👤 Position your face in the oval");
        setFaceFeedbackType("warning");
        setIsCentered(false);
        setFaceBox(null);
        setFaceLandmarks(null);
        centeredFrameCountRef.current = 0;
        clearOverlayCanvas();
        return;
      }
      const { box } = detection.detection;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      setFaceBox(box);
      setFaceLandmarks(detection.landmarks);
      drawFaceLandmarks(detection.landmarks, box);
      const faceHeightRatio = box.height / videoHeight;
      if (faceHeightRatio < MIN_FACE_SIZE_RATIO) {
        setFaceFeedback("📏 Move closer to camera");
        setFaceFeedbackType("warning");
        setIsCentered(false);
        return;
      }
      if (faceHeightRatio > MAX_FACE_SIZE_RATIO) {
        setFaceFeedback("📏 Move back, too close");
        setFaceFeedbackType("warning");
        setIsCentered(false);
        return;
      }
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const offsetX = Math.abs(faceCenterX - videoWidth / 2) / videoWidth;
      const offsetY = Math.abs(faceCenterY - videoHeight / 2) / videoHeight;
      const centered = offsetX < CENTER_TOLERANCE && offsetY < CENTER_TOLERANCE;
      setIsCentered(centered);
      if (!centered) {
        const moveHorizontal = offsetX >= CENTER_TOLERANCE;
        const moveVertical = offsetY >= CENTER_TOLERANCE;
        if (moveHorizontal && moveVertical) {
          const hDir = faceCenterX < videoWidth / 2 ? "← Move left" : "→ Move right";
          const vDir = faceCenterY < videoHeight / 2 ? "↓ Move down" : "↑ Move up";
          setFaceFeedback(`${hDir} and ${vDir}`);
        } else if (moveHorizontal) {
          setFaceFeedback(faceCenterX < videoWidth / 2 ? "← Move left" : "→ Move right");
        } else if (moveVertical) {
          setFaceFeedback(faceCenterY < videoHeight / 2 ? "↓ Move face down" : "↑ Move face up");
        }
        setFaceFeedbackType("warning");
        centeredFrameCountRef.current = 0;
        return;
      }
      const landmarks = detection.landmarks;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const getEyeAspectRatio = (eye) => {
        const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
        const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
        const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
        return (v1 + v2) / (2 * h);
      };
      const leftEAR = getEyeAspectRatio(leftEye);
      const rightEAR = getEyeAspectRatio(rightEye);
      const avgEyeRatio = (leftEAR + rightEAR) / 2;
      if (blinkCooldownRef.current > 0) {
        blinkCooldownRef.current--;
      }
      const eyesClosed = avgEyeRatio < EYE_BLINK_THRESHOLD;
      if (eyesClosed && !eyesClosedRef.current && blinkCooldownRef.current === 0) {
        eyesClosedRef.current = true;
      } else if (!eyesClosed && eyesClosedRef.current) {
        blinkCountRef.current++;
        eyesClosedRef.current = false;
        blinkCooldownRef.current = BLINK_COOLDOWN_FRAMES;
        console.log(`Blink detected! Count: ${blinkCountRef.current}/${REQUIRED_BLINKS}`);
      }
      const blinkComplete = blinkCountRef.current >= REQUIRED_BLINKS;
      if (!blinkComplete) {
        const blinks = blinkCountRef.current;
        setFaceFeedback(`👁️ Please blink once (${blinks}/${REQUIRED_BLINKS})`);
        setFaceFeedbackType("info");
        const blinkProgress = blinkCountRef.current / REQUIRED_BLINKS * 50;
        setLivenessScore(Math.round(blinkProgress));
      } else if (centered) {
        centeredFrameCountRef.current++;
        const progress = 50 + Math.min(50, centeredFrameCountRef.current / REQUIRED_CENTERED_FRAMES * 50);
        setLivenessScore(Math.round(progress));
        if (centeredFrameCountRef.current >= REQUIRED_CENTERED_FRAMES) {
          setFaceFeedback("📸 Perfect! Capturing...");
          setFaceFeedbackType("success");
          captureFace();
        } else {
          const remaining = Math.max(0, Math.ceil((REQUIRED_CENTERED_FRAMES - centeredFrameCountRef.current) * 0.2));
          setFaceFeedback(`✓ Hold still for ${remaining}s`);
          setFaceFeedbackType("success");
        }
      }
    } catch (err) {
      console.error("Face detection error:", err);
    }
  };
  const captureFace = async () => {
    var _a;
    if (!faceVideoRef.current || !faceCanvasRef.current) return;
    isRunningRef.current = false;
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    const video = faceVideoRef.current;
    const canvas = faceCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0);
    ctx.restore();
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setFaceFeedback("🔍 Verifying...");
    setFaceFeedbackType("info");
    try {
      const shouldCompareFaces = ((_a = session == null ? void 0 : session.payload) == null ? void 0 : _a.compareFaces) !== false;
      let faceMatched = null;
      if (capturedImage && shouldCompareFaces) {
        setFaceFeedback("🔍 Comparing face with ID photo...");
        faceMatched = await compareFaces(capturedImage, imageDataUrl);
        setFaceMatchResult(faceMatched);
        if (!faceMatched.matched) {
          setFaceMismatch(true);
          setFaceMismatchDetails({
            confidence: faceMatched.similarity,
            reason: `Face verification failed: ${faceMatched.similarity}% similarity`,
            details: { distance: faceMatched.distance }
          });
          setCapturedFace(imageDataUrl);
          setFaceFeedback(`❌ Face does not match ID photo`);
          setFaceFeedbackType("error");
          notifyParentFailed("face_mismatch", {
            similarity: faceMatched.similarity,
            threshold: FACE_MATCH_THRESHOLD
          });
          return;
        }
      } else if (!shouldCompareFaces) {
        console.log("Face comparison skipped (compareFaces=false)");
      }
      setCapturedFace(imageDataUrl);
      setFaceVerified(true);
      setFaceFeedback("✅ Verified! Real human confirmed");
      setFaceFeedbackType("success");
      setLivenessScore(100);
      stopFaceDetection();
      const result = {
        action: "success",
        idData: (aiResult == null ? void 0 : aiResult.data) || {},
        idImage: capturedImage,
        selfieImage: imageDataUrl,
        livenessScore: 100,
        faceComparisonPerformed: shouldCompareFaces,
        faceMatched: (faceMatched == null ? void 0 : faceMatched.matched) ?? null,
        faceSimilarity: (faceMatched == null ? void 0 : faceMatched.similarity) ?? null,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId
      };
      if (selfieSessionId) {
        await fetch(`/api/verify/session/${selfieSessionId}/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "done",
            result: {
              capturedImageBase64: imageDataUrl,
              livenessScore: 100,
              faceComparisonPerformed: shouldCompareFaces,
              faceMatched: (faceMatched == null ? void 0 : faceMatched.matched) ?? null,
              faceSimilarity: (faceMatched == null ? void 0 : faceMatched.similarity) ?? null
            },
            finishedAt: (/* @__PURE__ */ new Date()).toISOString()
          })
        });
      }
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "done",
          result,
          finishedAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
      notifyParent({
        identityOCR: {
          action: "verification_success",
          status: "success",
          result,
          session: sessionId,
          images: {
            idImage: capturedImage,
            selfieImage: imageDataUrl
          },
          verificationType: "combined"
        }
      });
    } catch (err) {
      console.error("Face verification error:", err);
      setFaceFeedback("⚠️ Verification failed, try again");
      setFaceFeedbackType("error");
      notifyParentFailed("selfie_error", { error: err.message });
    }
  };
  const compareFaces = async (idImageDataUrl, selfieImageDataUrl) => {
    try {
      const idImg = await faceapi.fetchImage(idImageDataUrl);
      const selfieImg = await faceapi.fetchImage(selfieImageDataUrl);
      const idDetection = await faceapi.detectSingleFace(idImg, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      const selfieDetection = await faceapi.detectSingleFace(selfieImg, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      if (!idDetection || !selfieDetection) {
        return { matched: false, similarity: 0, error: "Could not detect face in one or both images" };
      }
      const distance = faceapi.euclideanDistance(idDetection.descriptor, selfieDetection.descriptor);
      const similarity = Math.max(0, Math.round((1 - distance) * 100));
      const matched = distance < FACE_MATCH_THRESHOLD;
      return { matched, similarity, distance };
    } catch (err) {
      console.error("Face comparison error:", err);
      return { matched: false, similarity: 0, error: err.message };
    }
  };
  const handleRetryFace = () => {
    setFaceMismatch(false);
    setFaceMismatchDetails(null);
    setCapturedFace(null);
    setFaceVerified(false);
    setFaceFeedback("Press Start to try again");
    setFaceFeedbackType("info");
    setLivenessScore(0);
    setDetectedExpressions([]);
    setFaceMatchResult(null);
    centeredFrameCountRef.current = 0;
    blinkCountRef.current = 0;
    eyesClosedRef.current = false;
    blinkCooldownRef.current = 0;
  };
  const handleDone = () => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    notifyParent({
      identityOCR: {
        action: "verification_complete",
        status: "success",
        session: sessionId,
        result: {
          success: true,
          fields: {
            firstName: ((_a = aiResult == null ? void 0 : aiResult.data) == null ? void 0 : _a.firstName) || ((_b = aiResult == null ? void 0 : aiResult.data) == null ? void 0 : _b.first_name) || "",
            lastName: ((_c = aiResult == null ? void 0 : aiResult.data) == null ? void 0 : _c.lastName) || ((_d = aiResult == null ? void 0 : aiResult.data) == null ? void 0 : _d.last_name) || "",
            birthDate: ((_e = aiResult == null ? void 0 : aiResult.data) == null ? void 0 : _e.birthDate) || ((_f = aiResult == null ? void 0 : aiResult.data) == null ? void 0 : _f.birth_date) || ((_g = aiResult == null ? void 0 : aiResult.data) == null ? void 0 : _g.dateOfBirth) || "",
            idType: selectedIdType || ((_h = aiResult == null ? void 0 : aiResult.data) == null ? void 0 : _h.idType) || "",
            idNumber: ((_i = aiResult == null ? void 0 : aiResult.data) == null ? void 0 : _i.idNumber) || ((_j = aiResult == null ? void 0 : aiResult.data) == null ? void 0 : _j.id_number) || ""
          },
          idData: (aiResult == null ? void 0 : aiResult.data) || {},
          livenessScore,
          faceMatched: (faceMatchResult == null ? void 0 : faceMatchResult.matched) ?? null,
          faceSimilarity: (faceMatchResult == null ? void 0 : faceMatchResult.similarity) ?? null
        },
        images: {
          idImage: capturedImage,
          selfieImage: capturedFace
        },
        verificationType: "combined"
      }
    });
  };
  const renderField = (label, value) => {
    if (!value) return null;
    return /* @__PURE__ */ jsxs("div", { className: "py-2 border-b border-gray-100 last:border-0", children: [
      /* @__PURE__ */ jsx("span", { className: "text-gray-500 text-sm", children: label }),
      /* @__PURE__ */ jsx("div", { className: "text-gray-900 font-medium", children: value })
    ] });
  };
  if (error) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4", children: /* @__PURE__ */ jsx("svg", { className: "w-8 h-8 text-red-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }),
      /* @__PURE__ */ jsx("h2", { className: "text-xl font-bold text-gray-900 mb-2", children: "Verification Error" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-600", children: error })
    ] }) });
  }
  if (!session) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-600", children: "Loading session..." })
    ] }) });
  }
  if (!consentGiven) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-xl font-bold text-gray-900 mb-4", children: "Identity Verification" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-600 mb-4", children: "This verification process requires access to your camera to:" }),
      /* @__PURE__ */ jsxs("ul", { className: "text-gray-600 text-sm mb-6 space-y-2", children: [
        /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "text-blue-500", children: "📷" }),
          " Capture your ID document"
        ] }),
        /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "text-blue-500", children: "🤳" }),
          " Verify your face for liveness"
        ] }),
        /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "text-blue-500", children: "🔒" }),
          " Match your face with ID photo"
        ] })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-700 font-medium mb-2", children: "For best results:" }),
      /* @__PURE__ */ jsxs("ul", { className: "list-disc pl-5 mb-4 text-gray-600 text-sm space-y-1", children: [
        /* @__PURE__ */ jsx("li", { children: "Ensure good, even lighting." }),
        /* @__PURE__ */ jsx("li", { children: "Keep your ID flat and fully visible." }),
        /* @__PURE__ */ jsx("li", { children: "Look directly at the camera during selfie." })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500 mb-6", children: "By proceeding, you consent to the collection and processing of your biometric data for identity verification purposes." }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleConsentDecline,
            className: "flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition",
            children: "Decline"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleConsentAccept,
            className: "flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition",
            children: "I Consent & Continue"
          }
        )
      ] })
    ] }) });
  }
  if (currentStep === "id" && !selectedIdType) {
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex flex-col", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsx("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-center", children: /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "Select ID Type" }) }) }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center mb-6", children: [
          /* @__PURE__ */ jsx("div", { className: "w-16 h-16 mx-auto bg-blue-500 rounded-full flex items-center justify-center mb-3 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-8 h-8 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" }) }) }),
          /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold text-gray-900", children: "Choose Your ID" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-1 text-sm", children: "Select the type of ID you will be scanning" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bg-white rounded-2xl shadow-xl p-4 mb-4", children: /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3", children: ID_TYPES.map((type) => /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => {
              setSelectedIdType(type.value);
              setFeedback("Start camera to capture ID");
            },
            className: "p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition text-center group",
            children: [
              /* @__PURE__ */ jsx("span", { className: "text-3xl block mb-2", children: type.icon }),
              /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-700 group-hover:text-blue-700 font-medium", children: type.label })
            ]
          },
          type.value
        )) }) }),
        /* @__PURE__ */ jsx("div", { className: "bg-amber-50 border border-amber-200 rounded-xl p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "text-amber-500 flex-shrink-0", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold text-amber-800 text-sm", children: "Why select ID type?" }),
            /* @__PURE__ */ jsx("div", { className: "text-amber-700 text-xs mt-1", children: "Each ID has different formats and fields. Selecting the correct type helps our AI extract information more accurately." })
          ] })
        ] }) })
      ] }) })
    ] });
  }
  if (currentStep === "id" && idVerificationComplete && capturedImage) {
    const data = (aiResult == null ? void 0 : aiResult.data) || {};
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-green-50", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsx("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-center", children: /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "ID Verification Result" }) }) }),
      /* @__PURE__ */ jsxs("div", { className: "max-w-lg mx-auto p-4 space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-green-500 text-white rounded-2xl p-4 flex items-center gap-4", children: [
          /* @__PURE__ */ jsx("div", { className: "w-12 h-12 bg-white/20 rounded-full flex items-center justify-center", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M5 13l4 4L19 7" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-bold text-lg", children: "ID Captured Successfully" }),
            /* @__PURE__ */ jsx("div", { className: "text-white/80 text-sm", children: "Step 1 of 2 complete" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-lg p-4", children: [
          /* @__PURE__ */ jsxs("h2", { className: "font-bold text-gray-900 mb-3 flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("svg", { className: "w-5 h-5 text-blue-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }),
            "Extracted Information"
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "divide-y divide-gray-100", children: [
            renderField("Full Name", data.fullName || data.name),
            renderField("First Name", data.firstName),
            renderField("Middle Name", data.middleName),
            renderField("Last Name", data.lastName),
            renderField("ID Number", data.idNumber),
            renderField("Date of Birth", data.dateOfBirth || data.birthDate),
            renderField("Sex", data.sex),
            renderField("Address", data.address),
            renderField("Nationality", data.nationality),
            renderField("Expiry Date", data.expiryDate),
            renderField("Issue Date", data.issueDate)
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-3 pt-2", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: proceedToSelfie,
              className: "w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2",
              children: [
                "Continue to Face Verification",
                /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 7l5 5m0 0l-5 5m5-5H6" }) })
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleRecaptureId,
              className: "w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition",
              children: "Recapture ID"
            }
          )
        ] })
      ] })
    ] });
  }
  if (currentStep === "id" && selectedIdType) {
    return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 bg-black flex flex-col", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex-1 relative", children: [
        /* @__PURE__ */ jsx(
          "video",
          {
            ref: videoRef,
            autoPlay: true,
            muted: true,
            playsInline: true,
            className: "absolute inset-0 w-full h-full object-cover"
          }
        ),
        /* @__PURE__ */ jsx("canvas", { ref: canvasRef, className: "hidden" }),
        /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 pointer-events-none", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent" }),
          /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" }),
          /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                className: `w-80 h-52 sm:w-96 sm:h-60 border-4 rounded-2xl transition-all duration-300 ${capturedImage ? "border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.5)]" : "border-white/70 border-dashed"}`
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" }),
            /* @__PURE__ */ jsx("div", { className: "absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" }),
            /* @__PURE__ */ jsx("div", { className: "absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" }),
            /* @__PURE__ */ jsx("div", { className: "absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" })
          ] }) }),
          /* @__PURE__ */ jsx("div", { className: "absolute top-4 left-4 right-4 pointer-events-auto", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("button", { onClick: () => setSelectedIdType(null), className: "p-2 bg-white/20 backdrop-blur rounded-full", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }),
            /* @__PURE__ */ jsxs("div", { className: "px-3 py-1 bg-blue-500/80 backdrop-blur rounded-full text-white text-xs font-medium flex items-center gap-1", children: [
              /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" }) }),
              getIdTypeLabel(selectedIdType)
            ] })
          ] }) }),
          cameraStarted && !capturedImage && /* @__PURE__ */ jsx("div", { className: "absolute top-20 left-6 right-6 text-center", children: /* @__PURE__ */ jsx("div", { className: "text-white/80 text-sm", children: "Align your ID card within the frame" }) })
        ] }),
        isProcessing && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/70 flex items-center justify-center z-20", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
          /* @__PURE__ */ jsx("div", { className: "w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" }),
          /* @__PURE__ */ jsx("div", { className: "text-white font-medium", children: feedback })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "relative z-10 px-6 pb-8 pt-4", children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            className: `mb-4 py-3 px-4 rounded-xl text-center font-medium ${feedbackType === "success" ? "bg-green-500 text-white" : feedbackType === "error" ? "bg-red-500 text-white" : feedbackType === "warning" ? "bg-yellow-500 text-black" : "bg-white/20 backdrop-blur text-white"}`,
            children: feedback
          }
        ),
        !cameraStarted ? /* @__PURE__ */ jsx(
          "button",
          {
            onClick: startCamera,
            className: "w-full py-4 bg-white text-black font-bold text-lg rounded-2xl hover:bg-gray-100 transition",
            children: "Start Camera"
          }
        ) : /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                stopCamera();
                setSelectedIdType(null);
              },
              className: "flex-1 py-4 bg-red-500/80 text-white font-bold rounded-2xl hover:bg-red-600 transition",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: captureId,
              disabled: isProcessing,
              className: "flex-[2] py-4 bg-white text-black font-bold text-lg rounded-2xl hover:bg-gray-100 transition disabled:opacity-50 flex items-center justify-center gap-2",
              children: [
                /* @__PURE__ */ jsxs("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                  /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }),
                  /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })
                ] }),
                "Capture"
              ]
            }
          )
        ] }),
        cameraStarted && /* @__PURE__ */ jsxs("div", { className: "flex justify-center gap-4 mt-4 text-white/60 text-xs", children: [
          /* @__PURE__ */ jsx("span", { children: "• Good lighting" }),
          /* @__PURE__ */ jsx("span", { children: "• Keep steady" }),
          /* @__PURE__ */ jsx("span", { children: "• Fill frame" })
        ] }),
        !cameraStarted && /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setSelectedIdType(null),
            className: "w-full mt-3 py-3 bg-white/10 backdrop-blur text-white/80 font-medium rounded-xl hover:bg-white/20 transition text-sm",
            children: "← Change ID Type"
          }
        )
      ] })
    ] });
  }
  if (currentStep === "selfie" && faceMismatch && capturedFace) {
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex flex-col", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-white shadow-sm sticky top-0 z-10", children: /* @__PURE__ */ jsx("div", { className: "max-w-lg mx-auto px-4 py-3 flex items-center justify-center", children: /* @__PURE__ */ jsx("h1", { className: "font-semibold text-gray-900", children: "Face Verification Failed" }) }) }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center mb-6", children: [
          /* @__PURE__ */ jsx("div", { className: "w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center mb-4 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M6 18L18 6M6 6l12 12" }) }) }),
          /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Face Mismatch Detected" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-2", children: "The selfie does not match the ID photo" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-4 mb-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4 mb-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
              /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-500 mb-2", children: "ID Photo" }),
              capturedImage && /* @__PURE__ */ jsx(
                "img",
                {
                  src: capturedImage,
                  alt: "ID Photo",
                  className: "w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
              /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-500 mb-2", children: "Your Selfie" }),
              /* @__PURE__ */ jsx(
                "img",
                {
                  src: capturedFace,
                  alt: "Selfie",
                  className: "w-full h-32 object-cover rounded-lg border-2 border-red-300"
                }
              )
            ] })
          ] }),
          faceMismatchDetails && /* @__PURE__ */ jsxs("div", { className: "border-t border-gray-100 pt-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center text-sm", children: [
              /* @__PURE__ */ jsx("span", { className: "text-gray-500", children: "Face Similarity" }),
              /* @__PURE__ */ jsxs("span", { className: `font-semibold ${faceMismatchDetails.confidence < 50 ? "text-red-600" : "text-orange-500"}`, children: [
                faceMismatchDetails.confidence || 0,
                "%"
              ] })
            ] }),
            faceMismatchDetails.reason && /* @__PURE__ */ jsx("div", { className: "mt-2 text-xs text-gray-600", children: faceMismatchDetails.reason })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "text-amber-500 flex-shrink-0", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold text-amber-800 text-sm", children: "What to do?" }),
            /* @__PURE__ */ jsxs("div", { className: "text-amber-700 text-xs mt-1", children: [
              "• Ensure you are the person on the ID",
              /* @__PURE__ */ jsx("br", {}),
              "• Use better lighting for the selfie",
              /* @__PURE__ */ jsx("br", {}),
              "• Position your face similar to the ID photo",
              /* @__PURE__ */ jsx("br", {}),
              "• Remove glasses or accessories if different from ID"
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: handleRetryFace,
            className: "w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2",
            children: [
              /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" }) }),
              "Try Again"
            ]
          }
        )
      ] }) })
    ] });
  }
  if (currentStep === "selfie" && faceVerified && capturedFace) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex flex-col", children: /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
      /* @__PURE__ */ jsxs("div", { className: "text-center mb-6", children: [
        /* @__PURE__ */ jsx("div", { className: "w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M5 13l4 4L19 7" }) }) }),
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Verification Complete" }),
        /* @__PURE__ */ jsx("p", { className: "text-gray-600 mt-1", children: "Identity verified successfully" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "bg-white rounded-2xl shadow-xl overflow-hidden mb-6", children: /* @__PURE__ */ jsxs("div", { className: "p-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-green-600 mb-3", children: [
          /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }),
          /* @__PURE__ */ jsx("span", { className: "font-semibold", children: "100% Confidence" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [
          /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ ID Verified" }) }),
          /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ Face Matched" }) }),
          /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ Liveness Passed" }) }),
          /* @__PURE__ */ jsx("div", { className: "bg-green-50 rounded-lg p-2 text-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700", children: "✓ Real Human" }) })
        ] }),
        faceMatchResult && /* @__PURE__ */ jsx("div", { className: "mt-4 pt-4 border-t border-gray-100", children: /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center text-sm", children: [
          /* @__PURE__ */ jsx("span", { className: "text-gray-500", children: "Face Similarity" }),
          /* @__PURE__ */ jsxs("span", { className: "font-semibold text-green-600", children: [
            faceMatchResult.similarity,
            "%"
          ] })
        ] }) })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "space-y-3", children: /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleDone,
          className: "w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition",
          children: "Done"
        }
      ) })
    ] }) }) });
  }
  if (currentStep === "selfie") {
    return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 bg-black flex flex-col", children: [
      !faceDetectionStarted && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900" }),
      /* @__PURE__ */ jsx("div", { className: "relative z-20 px-4 pt-4 pb-2", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsx("div", { className: "w-10" }),
        modelsLoaded && /* @__PURE__ */ jsx("div", { className: "px-3 py-1 bg-green-500/80 backdrop-blur rounded-full text-white text-xs font-medium", children: "AI Ready" })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 relative flex flex-col", children: [
        /* @__PURE__ */ jsx(
          "video",
          {
            ref: faceVideoRef,
            autoPlay: true,
            muted: true,
            playsInline: true,
            className: `absolute inset-0 w-full h-full object-cover ${!faceDetectionStarted ? "hidden" : ""}`,
            style: { transform: "scaleX(-1)" }
          }
        ),
        /* @__PURE__ */ jsx("canvas", { ref: faceCanvasRef, className: "hidden" }),
        faceDetectionStarted && livenessScore > 0 && /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0 backdrop-blur-md bg-black/40 pointer-events-none z-10",
            style: {
              WebkitMaskImage: "radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)",
              maskImage: "radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)"
            }
          }
        ),
        /* @__PURE__ */ jsx(
          "canvas",
          {
            ref: overlayCanvasRef,
            className: `absolute inset-0 w-full h-full object-cover pointer-events-none z-20 ${!faceDetectionStarted ? "hidden" : ""}`,
            style: { transform: "scaleX(-1)" }
          }
        ),
        faceDetectionStarted && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" }),
          /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" })
        ] }),
        !faceDetectionStarted && /* @__PURE__ */ jsxs("div", { className: "relative z-10 text-center pt-2 pb-4", children: [
          /* @__PURE__ */ jsx("h1", { className: "text-2xl sm:text-3xl font-bold text-white mb-1", children: "Face Verification" }),
          /* @__PURE__ */ jsx("p", { className: "text-white/60 text-sm sm:text-base px-8", children: "Position your face in the oval and follow the instructions" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex-1 flex items-center justify-center relative", children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: `w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] border-4 transition-all duration-300 ${faceVerified ? "border-transparent" : faceDetectionStarted ? "border-dashed border-white/30" : "border-solid border-white/20"}`
            }
          ),
          !faceDetectionStarted && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: /* @__PURE__ */ jsx(
            "svg",
            {
              viewBox: "0 0 200 280",
              className: "w-44 h-60 sm:w-52 sm:h-72",
              children: /* @__PURE__ */ jsxs("g", { stroke: "rgba(255, 255, 255, 0.5)", strokeWidth: "1", fill: "none", children: [
                /* @__PURE__ */ jsx("path", { d: "M30 120 Q25 160 35 195 Q50 220 100 235 Q150 220 165 195 Q175 160 170 120" }),
                /* @__PURE__ */ jsx("path", { d: "M42 100 L55 95 L70 97 L82 102" }),
                /* @__PURE__ */ jsx("path", { d: "M118 102 L130 97 L145 95 L158 100" }),
                /* @__PURE__ */ jsx("path", { d: "M48 118 L58 115 L72 115 L82 118 L72 125 L58 125 Z" }),
                /* @__PURE__ */ jsx("path", { d: "M118 118 L128 115 L142 115 L152 118 L142 125 L128 125 Z" }),
                /* @__PURE__ */ jsx("path", { d: "M100 105 L100 150" }),
                /* @__PURE__ */ jsx("path", { d: "M85 155 L95 162 L100 165 L105 162 L115 155" }),
                /* @__PURE__ */ jsx("path", { d: "M70 185 Q85 178 100 178 Q115 178 130 185" }),
                /* @__PURE__ */ jsx("path", { d: "M70 185 Q85 198 100 200 Q115 198 130 185" })
              ] })
            }
          ) }),
          !faceDetectionStarted && /* @__PURE__ */ jsx(
            "div",
            {
              className: "absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] animate-pulse",
              style: {
                boxShadow: "0 0 40px rgba(59, 130, 246, 0.3), inset 0 0 40px rgba(59, 130, 246, 0.1)"
              }
            }
          ),
          faceDetectionStarted && /* @__PURE__ */ jsx(
            "div",
            {
              className: "absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] transition-all duration-300",
              style: {
                background: faceVerified ? "transparent" : `conic-gradient(${livenessScore >= 60 ? "#22c55e" : livenessScore >= 30 ? "#eab308" : "#ef4444"} ${livenessScore * 3.6}deg, transparent ${livenessScore * 3.6}deg)`,
                WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 4px))",
                mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 4px))"
              }
            }
          ),
          faceVerified && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] border-4 border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.5)]" }),
          faceDetectionStarted && currentExpression && /* @__PURE__ */ jsx("div", { className: "absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap", children: /* @__PURE__ */ jsx("span", { className: "px-4 py-1.5 bg-black/50 backdrop-blur rounded-full text-white text-sm font-medium capitalize", children: currentExpression }) })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "relative z-10 px-6 pb-6 pt-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent", children: [
        !faceDetectionStarted && /* @__PURE__ */ jsxs("div", { className: "mb-5 space-y-2.5", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-white/80", children: [
            /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx("span", { className: "text-blue-400 text-sm", children: "👁️" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-sm", children: "Look directly at the camera" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-white/80", children: [
            /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx("span", { className: "text-blue-400 text-sm", children: "😊" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-sm", children: "Show expressions when prompted" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-white/80", children: [
            /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx("span", { className: "text-blue-400 text-sm", children: "💡" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-sm", children: "Ensure good lighting on your face" })
          ] })
        ] }),
        faceDetectionStarted && /* @__PURE__ */ jsx(
          "div",
          {
            className: `mb-4 py-3 px-4 rounded-xl text-center font-medium ${faceFeedbackType === "success" ? "bg-green-500 text-white" : faceFeedbackType === "error" ? "bg-red-500 text-white" : faceFeedbackType === "warning" ? "bg-yellow-500 text-black" : "bg-white/20 backdrop-blur text-white"}`,
            children: faceFeedback
          }
        ),
        !faceDetectionStarted && /* @__PURE__ */ jsx(
          "button",
          {
            onClick: startFaceCamera,
            disabled: !modelsLoaded,
            className: "w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-lg rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-green-700 transition shadow-lg shadow-green-500/30",
            children: !modelsLoaded ? /* @__PURE__ */ jsxs("span", { className: "flex items-center justify-center gap-2", children: [
              /* @__PURE__ */ jsxs("svg", { className: "animate-spin h-5 w-5", viewBox: "0 0 24 24", children: [
                /* @__PURE__ */ jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4", fill: "none" }),
                /* @__PURE__ */ jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })
              ] }),
              "Loading AI Models..."
            ] }) : /* @__PURE__ */ jsxs("span", { className: "flex items-center justify-center gap-2", children: [
              /* @__PURE__ */ jsxs("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" }),
                /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" })
              ] }),
              "Start Face Scan"
            ] })
          }
        ),
        faceDetectionStarted && /* @__PURE__ */ jsxs("div", { className: "flex justify-center gap-3 mt-4", children: [
          /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${isCentered ? "bg-green-500" : "bg-white/30"}`, title: "Centered" }),
          /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${detectedExpressions.includes("happy") ? "bg-green-500" : "bg-white/30"}`, title: "Smile 😊" }),
          /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${detectedExpressions.includes("angry") ? "bg-green-500" : "bg-white/30"}`, title: "Angry 😠" }),
          /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${livenessScore >= 80 ? "bg-green-500" : "bg-white/30"}`, title: "Liveness" })
        ] })
      ] })
    ] });
  }
  return null;
}
function MdWebhook(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 24 24" }, "child": [{ "tag": "path", "attr": { "fill": "none", "d": "M0 0h24v24H0z" }, "child": [] }, { "tag": "path", "attr": { "d": "M10 15h5.88c.27-.31.67-.5 1.12-.5.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5c-.44 0-.84-.19-1.12-.5H11.9A5 5 0 1 1 6 11.1v2.07c-1.16.41-2 1.53-2 2.83 0 1.65 1.35 3 3 3s3-1.35 3-3v-1zm2.5-11c1.65 0 3 1.35 3 3h2c0-2.76-2.24-5-5-5a5.002 5.002 0 0 0-3.45 8.62l-2.35 3.9c-.68.14-1.2.75-1.2 1.48 0 .83.67 1.5 1.5 1.5a1.498 1.498 0 0 0 1.43-1.95l3.38-5.63A3.003 3.003 0 0 1 9.5 7c0-1.65 1.35-3 3-3zm4.5 9c-.64 0-1.23.2-1.72.54l-3.05-5.07C11.53 8.35 11 7.74 11 7c0-.83.67-1.5 1.5-1.5S14 6.17 14 7c0 .15-.02.29-.06.43l2.19 3.65c.28-.05.57-.08.87-.08 2.76 0 5 2.24 5 5s-2.24 5-5 5a5 5 0 0 1-4.33-2.5h2.67c.48.32 1.05.5 1.66.5 1.65 0 3-1.35 3-3s-1.35-3-3-3z" }, "child": [] }] })(props);
}
const MAX_CODE_HEIGHT = 280;
const CodeBlock$1 = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const codeRef = useRef(null);
  useEffect(() => {
    if (codeRef.current) {
      setNeedsExpand(codeRef.current.scrollHeight > MAX_CODE_HEIGHT);
    }
  }, [code]);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  };
  return /* @__PURE__ */ jsxs("div", { className: "relative group", children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: `relative ${!isExpanded && needsExpand ? "overflow-hidden" : ""}`,
        style: { maxHeight: !isExpanded && needsExpand ? `${MAX_CODE_HEIGHT}px` : "none" },
        children: [
          /* @__PURE__ */ jsx(
            "pre",
            {
              ref: codeRef,
              className: "bg-gray-900 text-gray-100 p-3 sm:p-4 rounded-lg overflow-x-auto text-sm",
              children: /* @__PURE__ */ jsx("code", { children: code })
            }
          ),
          !isExpanded && needsExpand && /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-900 to-transparent rounded-b-lg pointer-events-none" })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: handleCopy,
        className: "absolute top-2 right-2 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity",
        children: copied ? "Copied!" : "Copy"
      }
    ),
    needsExpand && /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => setIsExpanded(!isExpanded),
        className: "w-full mt-1 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1",
        children: isExpanded ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 15l7-7 7 7" }) }),
          "Collapse code"
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) }),
          "View full code"
        ] })
      }
    )
  ] });
};
const TabbedCodeBlock = ({ tabs }) => {
  const [activeTab, setActiveTab] = useState(0);
  return /* @__PURE__ */ jsxs("div", { className: "border border-gray-200 rounded-lg overflow-hidden", children: [
    /* @__PURE__ */ jsx("div", { className: "flex bg-gray-100 border-b border-gray-200", children: tabs.map((tab, index) => /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => setActiveTab(index),
        className: `flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === index ? "bg-white text-gray-900 border-b-2 border-blue-500 -mb-px" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`,
        children: [
          /* @__PURE__ */ jsx("div", { className: `w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${tab.iconBg}`, children: tab.icon }),
          tab.label
        ]
      },
      tab.label
    )) }),
    /* @__PURE__ */ jsx("div", { className: "p-0", children: /* @__PURE__ */ jsx(CodeBlock$1, { code: tabs[activeTab].code }) })
  ] });
};
const ParamTable = ({ title, params }) => {
  if (!params || params.length === 0) return null;
  return /* @__PURE__ */ jsxs("div", { className: "mb-3", children: [
    /* @__PURE__ */ jsx("h4", { className: "text-xs font-semibold text-gray-500 mb-2", children: title }),
    /* @__PURE__ */ jsx("div", { className: "border border-gray-200 rounded-lg overflow-hidden", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-xs", children: [
      /* @__PURE__ */ jsx("thead", { className: "bg-gray-50", children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-600", children: "Parameter" }),
        /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-600", children: "Type" }),
        /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-600", children: "Required" }),
        /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-600", children: "Description" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-gray-100", children: params.map((param, idx) => /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-blue-600", children: param.name }) }),
        /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-500", children: param.type }),
        /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: param.required ? /* @__PURE__ */ jsx("span", { className: "text-red-500", children: "Yes" }) : /* @__PURE__ */ jsx("span", { className: "text-gray-400", children: "No" }) }),
        /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: param.description })
      ] }, idx)) })
    ] }) })
  ] });
};
const EndpointCard = ({ method, path, description, requestBody, responseBody, requestParams, responseParams, isOpen, onToggle }) => {
  const methodColors = {
    GET: "bg-green-100 text-green-700",
    POST: "bg-blue-100 text-blue-700",
    PUT: "bg-yellow-100 text-yellow-700",
    DELETE: "bg-red-100 text-red-700"
  };
  return /* @__PURE__ */ jsxs("div", { className: "border border-gray-200 rounded-lg overflow-hidden mb-3", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: onToggle,
        className: "w-full bg-gray-50 px-3 sm:px-4 py-3 flex items-center justify-between gap-2 hover:bg-gray-100 transition-colors",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: `px-2 py-1 rounded text-sm font-bold ${methodColors[method]}`, children: method }),
            /* @__PURE__ */ jsx("code", { className: "text-sm font-mono text-gray-800 break-all", children: path })
          ] }),
          /* @__PURE__ */ jsx(
            "svg",
            {
              className: `w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`,
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
            }
          )
        ]
      }
    ),
    isOpen && /* @__PURE__ */ jsxs("div", { className: "p-3 sm:p-4 border-t border-gray-200 bg-white", children: [
      /* @__PURE__ */ jsx("p", { className: "text-gray-600 mb-3 text-sm", children: description }),
      (requestParams || requestBody) && /* @__PURE__ */ jsxs("div", { className: "mb-4", children: [
        /* @__PURE__ */ jsxs("h4", { className: "text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "w-2 h-2 bg-blue-500 rounded-full" }),
          "Request"
        ] }),
        /* @__PURE__ */ jsx(ParamTable, { title: "Parameters", params: requestParams }),
        requestBody && /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h4", { className: "text-xs font-semibold text-gray-500 mb-1", children: "Example" }),
          /* @__PURE__ */ jsx(CodeBlock$1, { code: requestBody })
        ] })
      ] }),
      (responseParams || responseBody) && /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("h4", { className: "text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "w-2 h-2 bg-green-500 rounded-full" }),
          "Response"
        ] }),
        /* @__PURE__ */ jsx(ParamTable, { title: "Fields", params: responseParams }),
        responseBody && /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h4", { className: "text-xs font-semibold text-gray-500 mb-1", children: "Example" }),
          /* @__PURE__ */ jsx(CodeBlock$1, { code: responseBody })
        ] })
      ] })
    ] })
  ] });
};
const EndpointGroup = ({ endpoints }) => {
  const [openIndex, setOpenIndex] = useState(null);
  return /* @__PURE__ */ jsx(Fragment, { children: endpoints.map((endpoint, index) => /* @__PURE__ */ jsx(
    EndpointCard,
    {
      ...endpoint,
      isOpen: openIndex === index,
      onToggle: () => setOpenIndex(openIndex === index ? null : index)
    },
    index
  )) });
};
const sidebarSections = [
  { id: "quick-start", label: "Quick Start", icon: FaRocket },
  { id: "sessions", label: "API Endpoints", icon: FaServer },
  { id: "id-types", label: "Supported IDs", icon: FaIdBadge },
  { id: "embed", label: "Embed Integration", icon: FaCube },
  { id: "iframe-events", label: "Iframe Events", icon: FaCommentDots },
  { id: "status", label: "Session Status", icon: FaChartBar },
  { id: "webhooks", label: "Webhooks", icon: FaBell },
  { id: "webhook-api", label: "Webhook API", icon: MdWebhook }
];
const Sidebar = ({ activeSection }) => {
  const handleClick = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };
  return /* @__PURE__ */ jsx("aside", { className: "hidden lg:block w-56 flex-shrink-0", children: /* @__PURE__ */ jsxs("nav", { className: "sticky top-20 space-y-1", children: [
    /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3", children: "Documentation" }),
    sidebarSections.map((section) => {
      const IconComponent = section.icon;
      return /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => handleClick(section.id),
          className: `w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${activeSection === section.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`,
          children: [
            /* @__PURE__ */ jsx(IconComponent, { className: "w-4 h-4" }),
            section.label
          ]
        },
        section.id
      );
    }),
    /* @__PURE__ */ jsx("div", { className: "pt-4 mt-4 border-t border-gray-200", children: /* @__PURE__ */ jsxs(
      "a",
      {
        href: "/api-demo",
        className: "flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors",
        children: [
          /* @__PURE__ */ jsx(FaFlask, { className: "w-4 h-4" }),
          "Try API Demo"
        ]
      }
    ) })
  ] }) });
};
function Documentation() {
  const [activeSection, setActiveSection] = useState("quick-start");
  useEffect(() => {
    const handleScroll = () => {
      const sections = sidebarSections.map((s) => document.getElementById(s.id)).filter(Boolean);
      const scrollPos = window.scrollY + 100;
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.offsetTop <= scrollPos) {
          setActiveSection(section.id);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gray-50", children: [
    /* @__PURE__ */ jsx(Header, {}),
    /* @__PURE__ */ jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10", children: /* @__PURE__ */ jsxs("div", { className: "lg:flex lg:gap-8", children: [
      /* @__PURE__ */ jsx(Sidebar, { activeSection }),
      /* @__PURE__ */ jsxs("main", { className: "flex-1 min-w-0 max-w-4xl", children: [
        /* @__PURE__ */ jsxs("header", { className: "mb-8", children: [
          /* @__PURE__ */ jsx("h1", { className: "text-2xl sm:text-3xl font-bold text-gray-900 mb-2", children: "API Documentation" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 text-sm sm:text-base", children: "Integrate identity verification into your application with our simple API." }),
          /* @__PURE__ */ jsxs("div", { className: "mt-3 inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm", children: [
            "Base URL: ",
            /* @__PURE__ */ jsx("code", { className: "font-mono", children: "https://identity.logicatechnology.com" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("section", { id: "quick-start", className: "mb-10 scroll-mt-20", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg sm:text-xl font-bold text-gray-900 mb-4", children: "Quick Start" }),
          /* @__PURE__ */ jsx("div", { className: "bg-white rounded-lg border border-gray-200 p-4 sm:p-5", children: /* @__PURE__ */ jsxs("ol", { className: "space-y-4 text-sm sm:text-base", children: [
            /* @__PURE__ */ jsxs("li", { className: "flex gap-3", children: [
              /* @__PURE__ */ jsx("span", { className: "w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0", children: "1" }),
              /* @__PURE__ */ jsx("span", { className: "text-gray-700", children: "Create a verification session using one of the create endpoints" })
            ] }),
            /* @__PURE__ */ jsxs("li", { className: "flex gap-3", children: [
              /* @__PURE__ */ jsx("span", { className: "w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0", children: "2" }),
              /* @__PURE__ */ jsx("span", { className: "text-gray-700", children: "Embed the returned URL in an iframe or redirect user to it" })
            ] }),
            /* @__PURE__ */ jsxs("li", { className: "flex gap-3", children: [
              /* @__PURE__ */ jsx("span", { className: "w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0", children: "3" }),
              /* @__PURE__ */ jsx("span", { className: "text-gray-700", children: "Listen for postMessage events or use webhook for results" })
            ] })
          ] }) })
        ] }),
        /* @__PURE__ */ jsxs("section", { id: "sessions", className: "mb-10 scroll-mt-20", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg sm:text-xl font-bold text-gray-900 mb-4", children: "Create Verification Sessions" }),
          /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4 mb-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-3", children: [
              /* @__PURE__ */ jsx("div", { className: "w-8 h-8 bg-green-100 rounded flex items-center justify-center", children: /* @__PURE__ */ jsx("span", { className: "text-green-700 font-bold text-xs", children: "JS" }) }),
              /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900", children: "Node.js Example" })
            ] }),
            /* @__PURE__ */ jsx(CodeBlock$1, { code: `const axios = require('axios');

// Create a combined verification session
async function createVerificationSession() {
  const response = await axios.post(
    'https://identity.logica.dev/api/verify/combined/create',
    {
      idType: 'national-id',
      compareFaces: true, // Set to false to skip face matching
      successUrl: 'https://yourapp.com/success',
      webhookUrl: 'https://yourapp.com/webhook'
    },
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  // Return the embed URL to display in iframe
  return response.data.embedUrl;
}

// Usage
const embedUrl = await createVerificationSession();
// Send embedUrl to your frontend to display in iframe` })
          ] }),
          /* @__PURE__ */ jsx(EndpointGroup, { endpoints: [
            {
              method: "POST",
              path: "/api/verify/id/create",
              description: "Create an ID-only verification session.",
              requestParams: [
                { name: "idType", type: "string", required: true, description: "Type of ID to verify (e.g., national-id, passport)" },
                { name: "successUrl", type: "string", required: false, description: "URL to redirect after successful verification" },
                { name: "failureUrl", type: "string", required: false, description: "URL to redirect after failed verification" },
                { name: "webhookUrl", type: "string", required: false, description: "URL to receive webhook notifications" }
              ],
              responseParams: [
                { name: "success", type: "boolean", required: true, description: "Whether the request was successful" },
                { name: "sessionId", type: "string", required: true, description: "Unique session identifier" },
                { name: "embedUrl", type: "string", required: true, description: "URL to embed in iframe" }
              ],
              requestBody: `{
  "idType": "national-id",
  "successUrl": "https://yourapp.com/callback",
  "webhookUrl": "https://yourapp.com/webhook"
}`,
              responseBody: `{
  "success": true,
  "sessionId": "sess_id_abc123",
  "embedUrl": "https://identity.logica.dev/embed/session/sess_id_abc123"
}`
            },
            {
              method: "POST",
              path: "/api/verify/selfie/create",
              description: "Create a selfie liveness verification session.",
              requestParams: [
                { name: "successUrl", type: "string", required: false, description: "URL to redirect after successful verification" },
                { name: "failureUrl", type: "string", required: false, description: "URL to redirect after failed verification" },
                { name: "webhookUrl", type: "string", required: false, description: "URL to receive webhook notifications" }
              ],
              responseParams: [
                { name: "success", type: "boolean", required: true, description: "Whether the request was successful" },
                { name: "sessionId", type: "string", required: true, description: "Unique session identifier" },
                { name: "sessionUrl", type: "string", required: true, description: "URL for selfie verification page" }
              ],
              requestBody: `{
  "successUrl": "https://yourapp.com/callback",
  "webhookUrl": "https://yourapp.com/webhook"
}`,
              responseBody: `{
  "success": true,
  "sessionId": "sess_selfie_xyz789",
  "sessionUrl": "https://identity.logica.dev/session/selfieliveness/sess_selfie_xyz789"
}`
            },
            {
              method: "POST",
              path: "/api/verify/combined/create",
              description: "Create a combined flow: ID verification → selfie liveness with optional face matching.",
              requestParams: [
                { name: "idType", type: "string", required: true, description: "Type of ID to verify (e.g., national-id, passport)" },
                { name: "compareFaces", type: "boolean", required: false, description: "Whether to compare selfie with ID photo (default: true). Set to false to skip face matching." },
                { name: "successUrl", type: "string", required: false, description: "URL to redirect after successful verification" },
                { name: "failureUrl", type: "string", required: false, description: "URL to redirect after failed verification" },
                { name: "webhookUrl", type: "string", required: false, description: "URL to receive webhook notifications" }
              ],
              responseParams: [
                { name: "success", type: "boolean", required: true, description: "Whether the request was successful" },
                { name: "sessionId", type: "string", required: true, description: "ID verification session identifier" },
                { name: "selfieSessionId", type: "string", required: true, description: "Linked selfie session identifier" },
                { name: "sessionUrl", type: "string", required: true, description: "URL for combined verification page" },
                { name: "embedUrl", type: "string", required: true, description: "URL to embed in iframe" }
              ],
              requestBody: `{
  "idType": "national-id",
  "compareFaces": true,
  "successUrl": "https://yourapp.com/callback",
  "webhookUrl": "https://yourapp.com/webhook"
}`,
              responseBody: `{
  "success": true,
  "sessionId": "sess_combined_abc123",
  "selfieSessionId": "sess_selfie_def456",
  "sessionUrl": "https://identity.logica.dev/session/combined/sess_combined_abc123",
  "embedUrl": "https://identity.logica.dev/embed/session/sess_combined_abc123"
}`
            },
            {
              method: "GET",
              path: "/api/session/:id",
              description: "Get the current state of a verification session including verification results.",
              requestParams: [
                { name: "id", type: "string", required: true, description: "Session ID (URL parameter)" }
              ],
              responseParams: [
                { name: "id", type: "string", required: true, description: "Session identifier" },
                { name: "status", type: "string", required: true, description: "Current status (pending, in_progress, completed, failed, cancelled, expired)" },
                { name: "payload", type: "object", required: true, description: "Session configuration data" },
                { name: "extractedData", type: "object", required: false, description: "Extracted ID fields (null if not completed)" },
                { name: "verificationResult", type: "object", required: false, description: "Verification result with status and data" },
                { name: "verificationResult.status", type: "string", required: false, description: "Result status: success, failed, or null" },
                { name: "verificationResult.faceMatch", type: "object", required: false, description: "Face matching result (selfie/combined only)" },
                { name: "verificationResult.completedAt", type: "string", required: false, description: "ISO timestamp when verification completed" }
              ],
              responseBody: `// Completed session
{
  "id": "sess_abc123",
  "status": "completed",
  "payload": {
    "idType": "national-id",
    "verificationType": "combined"
  },
  "extractedData": {
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "idNumber": "1234-5678-9012",
    "dateOfBirth": "1990-01-15"
  },
  "verificationResult": {
    "status": "success",
    "faceMatch": {
      "match": true,
      "similarity": 0.85
    },
    "completedAt": "2026-01-30T10:30:00.000Z"
  }
}

// Pending/In-progress session
{
  "id": "sess_abc123",
  "status": "pending",
  "payload": {
    "idType": "national-id",
    "verificationType": "id"
  },
  "extractedData": null,
  "verificationResult": null
}`
            },
            {
              method: "GET",
              path: "/api/ids",
              description: "Get the list of all supported ID types for verification.",
              responseParams: [
                { name: "success", type: "boolean", required: true, description: "Whether the request was successful" },
                { name: "idTypes", type: "array", required: true, description: "Array of supported ID type objects" }
              ],
              responseBody: `{
  "success": true,
  "idTypes": [
    { "id": "national-id", "name": "National ID" },
    { "id": "passport", "name": "Passport" },
    { "id": "umid", "name": "UMID" },
    { "id": "driver-license", "name": "Driver's License" },
    { "id": "tin-id", "name": "TIN ID" },
    { "id": "philhealth", "name": "PhilHealth" },
    { "id": "pagibig", "name": "Pag-IBIG" },
    { "id": "postal-id", "name": "Postal ID" }
  ]
}`
            }
          ] })
        ] }),
        /* @__PURE__ */ jsxs("section", { id: "id-types", className: "mb-10 scroll-mt-20", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg sm:text-xl font-bold text-gray-900 mb-4", children: "Supported ID Types" }),
          /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3", children: [
            { id: "national-id", name: "National ID" },
            { id: "passport", name: "Passport" },
            { id: "umid", name: "UMID" },
            { id: "driver-license", name: "Driver's License" },
            { id: "tin-id", name: "TIN ID" },
            { id: "philhealth", name: "PhilHealth" },
            { id: "pagibig", name: "Pag-IBIG" },
            { id: "postal-id", name: "Postal ID" }
          ].map((idType) => /* @__PURE__ */ jsxs("div", { className: "bg-white p-3 rounded-lg border border-gray-200 text-center", children: [
            /* @__PURE__ */ jsx("p", { className: "font-medium text-gray-900 text-sm", children: idType.name }),
            /* @__PURE__ */ jsx("code", { className: "text-xs text-gray-500", children: idType.id })
          ] }, idType.id)) })
        ] }),
        /* @__PURE__ */ jsxs("section", { id: "embed", className: "mb-10 scroll-mt-20", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg sm:text-xl font-bold text-gray-900 mb-4", children: "Embed Integration" }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4", children: [
              /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "Add iframe to your page" }),
              /* @__PURE__ */ jsx(CodeBlock$1, { code: `<iframe
  src="YOUR_EMBED_URL"
  width="100%"
  height="600"
  allow="camera"
  style="border: none;"
></iframe>` })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4", children: [
              /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "Listen for results" }),
              /* @__PURE__ */ jsx(CodeBlock$1, { code: `window.addEventListener('message', (event) => {
  if (event.origin !== 'https://identity.logica.dev') return;
  
  const { identityOCR } = event.data;
  if (!identityOCR) return;
  
  switch (identityOCR.action) {
    case 'verification_success':
      console.log('Success:', identityOCR.result);
      break;
    case 'verification_failed':
      console.log('Failed:', identityOCR.reason);
      break;
    case 'verification_cancelled':
      console.log('Cancelled:', identityOCR.reason);
      break;
  }
});` })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("section", { id: "iframe-events", className: "mb-10 scroll-mt-20", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg sm:text-xl font-bold text-gray-900 mb-4", children: "Iframe Parent Communication" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mb-4 text-sm", children: "When embedded in an iframe, the verification component sends postMessage events to the parent window for success, failure, and cancellation states." }),
          /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4 mb-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "Event Actions" }),
            /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
              /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-gray-200", children: [
                /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Action" }),
                /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Status" }),
                /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Description" })
              ] }) }),
              /* @__PURE__ */ jsxs("tbody", { className: "divide-y divide-gray-100", children: [
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs", children: "verification_success" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "success" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "Verification completed successfully (sent automatically after capture)" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs", children: "verification_complete" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "success" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: 'User clicked "Done" button (includes full result data and images)' })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs", children: "verification_failed" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "failed" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "Verification failed (face mismatch, OCR error, etc.)" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs", children: "verification_cancelled" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "cancelled" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "User cancelled (declined consent, closed window)" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs", children: "verification_problem" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "warning" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "Non-fatal issue (camera problem, lighting, etc.)" })
                ] })
              ] })
            ] }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4 mb-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "Message Payload Structure" }),
            /* @__PURE__ */ jsx(CodeBlock$1, { code: `// Success payload (ID Verification)
{
  identityOCR: {
    action: 'verification_success',
    status: 'success',
    session: 'sess_abc123',
    verificationType: 'id',
    result: {
      fields: { firstName, lastName, idNumber, ... },
      capturedImageBase64: 'data:image/jpeg;base64,...'
    },
    data: { ... },  // Extracted ID fields
    images: {
      idImage: 'data:image/jpeg;base64,...'  // Captured ID image
    }
  }
}

// Success payload (Selfie Liveness)
{
  identityOCR: {
    action: 'verification_success',
    status: 'success',
    session: 'sess_abc123',
    verificationType: 'selfie',
    result: {
      capturedImageBase64: 'data:image/jpeg;base64,...',
      livenessScore: 100,
      faceMatched: true
    },
    images: {
      selfieImage: 'data:image/jpeg;base64,...'  // Captured selfie
    }
  }
}

// Success payload (Combined Verification - sent automatically after capture)
{
  identityOCR: {
    action: 'verification_success',
    status: 'success',
    session: 'sess_abc123',
    verificationType: 'combined',
    result: {
      idData: { firstName, lastName, ... },
      faceComparisonPerformed: true,  // false if compareFaces was set to false
      faceMatched: true,              // null if faceComparisonPerformed is false
      faceSimilarity: 85,             // null if faceComparisonPerformed is false
      livenessScore: 100
    },
    images: {
      idImage: 'data:image/jpeg;base64,...',     // Captured ID
      selfieImage: 'data:image/jpeg;base64,...'  // Captured selfie
    }
  }
}

// Complete payload (Combined Verification - sent when user clicks "Done")
// This is the recommended event to listen for as it indicates user has reviewed results
{
  identityOCR: {
    action: 'verification_complete',
    status: 'success',
    session: 'sess_abc123',
    verificationType: 'combined',
    result: {
      success: true,
      fields: {
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        birthDate: '1990-01-15',
        idType: 'national-id',
        idNumber: '1234-5678-9012'
      },
      idData: { ... },                // Full extracted ID data
      livenessScore: 100,
      faceMatched: true,              // null if face comparison was skipped
      faceSimilarity: 85              // null if face comparison was skipped
    },
    images: {
      idImage: 'data:image/jpeg;base64,...',     // Captured ID image
      selfieImage: 'data:image/jpeg;base64,...'  // Captured selfie image
    }
  }
}

// Failure payload
{
  identityOCR: {
    action: 'verification_failed',
    status: 'failed',
    session: 'sess_abc123',
    verificationType: 'selfie',
    reason: 'face_mismatch',
    details: { similarity: 0.25, threshold: 0.30 }
  }
}

// Cancelled payload
{
  identityOCR: {
    action: 'verification_cancelled',
    status: 'cancelled',
    session: 'sess_abc123',
    verificationType: 'id',
    reason: 'consent_declined'
  }
}` })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4 mb-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "Failure Reasons" }),
            /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
              /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-gray-200", children: [
                /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Reason" }),
                /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Verification Type" }),
                /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Description" })
              ] }) }),
              /* @__PURE__ */ jsxs("tbody", { className: "divide-y divide-gray-100", children: [
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "face_mismatch" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "Selfie" }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "Face doesn't match the ID photo" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "id_type_mismatch" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "ID" }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "Detected ID type doesn't match expected" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "missing_required_fields" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "ID" }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "Required fields not extracted from ID" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "processing_error" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "All" }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "Server-side processing error" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "consent_declined" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "All" }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "User declined camera consent" })
                ] })
              ] })
            ] }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4 mb-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "Complete Event Handler Example" }),
            /* @__PURE__ */ jsx(CodeBlock$1, { code: `// Complete parent window event handler
window.addEventListener('message', (event) => {
  // Security: verify origin
  if (event.origin !== 'https://identity.logica.dev') return;
  
  const { identityOCR } = event.data;
  if (!identityOCR) return;
  
  const { action, status, session, reason, result, details, verificationType, images } = identityOCR;
  
  switch (action) {
    case 'verification_success':
      // Sent automatically after successful capture
      console.log('✅ Verification capture complete!');
      console.log('Session:', session);
      console.log('Type:', verificationType);
      console.log('Data:', result);
      
      // Note: User may still be reviewing results in iframe
      // Wait for 'verification_complete' if you want user confirmation
      break;
      
    case 'verification_complete':
      // Sent when user clicks "Done" button - RECOMMENDED to use this event
      console.log('✅ User confirmed verification!');
      console.log('Session:', session);
      console.log('Type:', verificationType);
      
      // Access extracted fields
      if (result?.fields) {
        console.log('First Name:', result.fields.firstName);
        console.log('Last Name:', result.fields.lastName);
        console.log('Birth Date:', result.fields.birthDate);
        console.log('ID Type:', result.fields.idType);
        console.log('ID Number:', result.fields.idNumber);
      }
      
      // Access liveness and face match results
      console.log('Liveness Score:', result?.livenessScore);
      console.log('Face Matched:', result?.faceMatched);
      console.log('Face Similarity:', result?.faceSimilarity);
      
      // Access captured images
      if (images) {
        if (images.idImage) {
          console.log('ID Image captured');
          // Save or display the ID image
          // images.idImage is a base64 data URL
        }
        if (images.selfieImage) {
          console.log('Selfie Image captured');
          // Save or display the selfie image
          // images.selfieImage is a base64 data URL
        }
      }
      
      // Close the iframe and show success
      document.getElementById('verification-iframe').remove();
      showSuccessMessage('Identity verified!');
      break;
      
    case 'verification_failed':
      console.log('❌ Verification failed');
      console.log('Reason:', reason);
      console.log('Details:', details);
      
      // Show error and allow retry
      showErrorMessage(getErrorMessage(reason));
      break;
      
    case 'verification_cancelled':
      console.log('⚠️ User cancelled verification');
      console.log('Reason:', reason);
      
      // Clean up and show cancellation message
      document.getElementById('verification-iframe').remove();
      showMessage('Verification was cancelled');
      break;
      
    case 'verification_problem':
      console.log('⚠️ Issue detected:', identityOCR.message);
      // Optionally show warning to user
      break;
  }
});

function getErrorMessage(reason) {
  const messages = {
    'face_mismatch': 'Face does not match the ID photo',
    'id_type_mismatch': 'Wrong ID type detected',
    'missing_required_fields': 'Could not read all required ID fields',
    'processing_error': 'An error occurred, please try again',
    'consent_declined': 'Camera access is required for verification'
  };
  return messages[reason] || 'Verification failed';
}` })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-blue-900 mb-2", children: "💡 Best Practices" }),
            /* @__PURE__ */ jsxs("ul", { className: "text-sm text-blue-800 space-y-1 list-disc list-inside", children: [
              /* @__PURE__ */ jsx("li", { children: "Always verify the event origin matches your expected domain" }),
              /* @__PURE__ */ jsx("li", { children: "Handle all action types (success, complete, failed, cancelled)" }),
              /* @__PURE__ */ jsxs("li", { children: [
                "Use ",
                /* @__PURE__ */ jsx("code", { className: "bg-blue-100 px-1 rounded", children: "verification_complete" }),
                " for user-confirmed results (recommended)"
              ] }),
              /* @__PURE__ */ jsxs("li", { children: [
                "Use ",
                /* @__PURE__ */ jsx("code", { className: "bg-blue-100 px-1 rounded", children: "verification_success" }),
                " if you need immediate capture notification"
              ] }),
              /* @__PURE__ */ jsx("li", { children: "Provide clear user feedback for each state" }),
              /* @__PURE__ */ jsx("li", { children: "Use webhooks as backup for critical verification flows" }),
              /* @__PURE__ */ jsx("li", { children: "Store session IDs to correlate iframe events with server data" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("section", { id: "status", className: "mb-10 scroll-mt-20", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg sm:text-xl font-bold text-gray-900 mb-4", children: "Session Status Values" }),
          /* @__PURE__ */ jsx("div", { className: "bg-white rounded-lg border border-gray-200 overflow-hidden", children: /* @__PURE__ */ jsx("table", { className: "w-full text-sm", children: /* @__PURE__ */ jsxs("tbody", { className: "divide-y divide-gray-200", children: [
            /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded", children: "pending" }) }),
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2 text-gray-600", children: "Awaiting user" })
            ] }),
            /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-blue-100 text-blue-700 px-2 py-0.5 rounded", children: "in_progress" }) }),
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2 text-gray-600", children: "In progress" })
            ] }),
            /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-green-100 text-green-700 px-2 py-0.5 rounded", children: "completed" }) }),
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2 text-gray-600", children: "Success" })
            ] }),
            /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-red-100 text-red-700 px-2 py-0.5 rounded", children: "failed" }) }),
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2 text-gray-600", children: "Failed" })
            ] }),
            /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-gray-100 text-gray-700 px-2 py-0.5 rounded", children: "cancelled" }) }),
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2 text-gray-600", children: "Cancelled" })
            ] }),
            /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-orange-100 text-orange-700 px-2 py-0.5 rounded", children: "expired" }) }),
              /* @__PURE__ */ jsx("td", { className: "px-4 py-2 text-gray-600", children: "Timed out" })
            ] })
          ] }) }) })
        ] }),
        /* @__PURE__ */ jsxs("section", { id: "webhooks", className: "mb-10 scroll-mt-20", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg sm:text-xl font-bold text-gray-900 mb-4", children: "Webhooks" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mb-4 text-sm", children: "Webhooks allow you to receive real-time notifications when verification events occur. Set up a webhook handler on your server to receive POST requests with verification results." }),
          /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4 mb-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "1. Include webhook URL when creating session" }),
            /* @__PURE__ */ jsx(CodeBlock$1, { code: `// When creating a verification session, include webhookUrl
{
  "idType": "national-id",
  "successUrl": "https://yourapp.com/verification/success",
  "failureUrl": "https://yourapp.com/verification/failed",
  "webhookUrl": "https://yourapp.com/api/identity-webhook"
}` })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4 mb-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "2. Webhook payload structure" }),
            /* @__PURE__ */ jsx("p", { className: "text-gray-600 text-sm mb-3", children: "Your webhook endpoint will receive a POST request with the following JSON payload:" }),
            /* @__PURE__ */ jsx(CodeBlock$1, { code: `{
  "event": "verification.success",  // or "verification.failed", "verification.expired"
  "sessionId": "sess_abc123xyz",
  "sessionType": "id",              // "id", "selfie", or "combined"
  "status": "success",              // "success", "failed", "expired"
  "data": {
    "fields": {
      "firstName": "Juan",
      "lastName": "Dela Cruz",
      "birthDate": "1990-01-15",
      "idNumber": "1234-5678-9012"
    },
    "status": "done",
    "finishedAt": "2026-01-30T10:30:00.000Z"
  },
  "timestamp": "2026-01-30T10:30:01.000Z"
}` })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4 mb-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "3. Set up your webhook handler" }),
            /* @__PURE__ */ jsx(TabbedCodeBlock, { tabs: [
              {
                label: "Node.js",
                icon: "JS",
                iconBg: "bg-green-100 text-green-700",
                code: `// Express webhook handler
app.post('/api/identity-webhook', express.json(), (req, res) => {
  const { event, sessionId, status, data } = req.body;
  
  // Verify the webhook (optional: add signature verification)
  console.log('Webhook received:', event, sessionId);
  
  switch (event) {
    case 'verification.success':
      // Handle successful verification
      const { firstName, lastName, idNumber } = data.fields;
      // Update your database, send confirmation email, etc.
      await db.users.update({ 
        where: { sessionId },
        data: { verified: true, firstName, lastName, idNumber }
      });
      break;
      
    case 'verification.failed':
      // Handle failed verification
      console.log('Verification failed:', data.reason);
      // Notify user, log for review, etc.
      break;
      
    case 'verification.expired':
      // Handle expired session
      // Clean up, notify user to retry
      break;
  }
  
  // Always respond with 200 to acknowledge receipt
  res.status(200).json({ received: true });
});`
              },
              {
                label: "PHP",
                icon: "PHP",
                iconBg: "bg-blue-100 text-blue-700",
                code: `// Laravel webhook handler
Route::post('/api/identity-webhook', function (Request $request) {
    $payload = $request->all();
    $event = $payload['event'];
    $sessionId = $payload['sessionId'];
    $data = $payload['data'];
    
    switch ($event) {
        case 'verification.success':
            $fields = $data['fields'];
            // Update user record
            User::where('verification_session', $sessionId)
                ->update([
                    'verified' => true,
                    'first_name' => $fields['firstName'],
                    'last_name' => $fields['lastName'],
                ]);
            break;
            
        case 'verification.failed':
            Log::warning('Verification failed', ['sessionId' => $sessionId]);
            break;
    }
    
    return response()->json(['received' => true]);
});`
              },
              {
                label: "Python",
                icon: "PY",
                iconBg: "bg-yellow-100 text-yellow-700",
                code: `# Flask webhook handler
@app.route('/api/identity-webhook', methods=['POST'])
def identity_webhook():
    payload = request.get_json()
    event = payload.get('event')
    session_id = payload.get('sessionId')
    data = payload.get('data', {})
    
    if event == 'verification.success':
        fields = data.get('fields', {})
        # Update database
        user = User.query.filter_by(session_id=session_id).first()
        if user:
            user.verified = True
            user.first_name = fields.get('firstName')
            user.last_name = fields.get('lastName')
            db.session.commit()
            
    elif event == 'verification.failed':
        app.logger.warning(f'Verification failed: {session_id}')
    
    return jsonify({'received': True}), 200`
              }
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4 mb-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "Webhook Events" }),
            /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
              /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-gray-200", children: [
                /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Event" }),
                /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Description" })
              ] }) }),
              /* @__PURE__ */ jsxs("tbody", { className: "divide-y divide-gray-100", children: [
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs", children: "verification.success" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "User successfully completed verification" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs", children: "verification.failed" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "Verification failed (invalid ID, face mismatch, etc.)" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs", children: "verification.expired" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "Session expired before completion" })
                ] })
              ] })
            ] }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-4 mb-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "Request Headers" }),
            /* @__PURE__ */ jsx("p", { className: "text-gray-600 text-sm mb-3", children: "Each webhook request includes these headers:" }),
            /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
              /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-gray-200", children: [
                /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Header" }),
                /* @__PURE__ */ jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Value" })
              ] }) }),
              /* @__PURE__ */ jsxs("tbody", { className: "divide-y divide-gray-100", children: [
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "Content-Type" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "application/json" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "X-Webhook-Event" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "The event type (e.g., verification.success)" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "X-Session-Id" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "The session ID" })
                ] }),
                /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("code", { className: "text-xs", children: "X-Attempt" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-gray-600", children: "Retry attempt number (1, 2, or 3)" })
                ] })
              ] })
            ] }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-semibold text-blue-900 mb-2", children: "💡 Best Practices" }),
            /* @__PURE__ */ jsxs("ul", { className: "text-sm text-blue-800 space-y-1 list-disc list-inside", children: [
              /* @__PURE__ */ jsx("li", { children: "Always respond with HTTP 200 quickly to prevent timeouts" }),
              /* @__PURE__ */ jsx("li", { children: "Process webhook data asynchronously if needed" }),
              /* @__PURE__ */ jsx("li", { children: "Store the sessionId to prevent duplicate processing" }),
              /* @__PURE__ */ jsx("li", { children: "Webhooks are retried up to 3 times with exponential backoff" }),
              /* @__PURE__ */ jsx("li", { children: "Use HTTPS endpoints for production" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("section", { id: "webhook-api", className: "mb-10 scroll-mt-20", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg sm:text-xl font-bold text-gray-900 mb-4", children: "Webhook API Endpoints" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600 mb-4 text-sm", children: "Use these endpoints to manually manage webhooks or check their status." }),
          /* @__PURE__ */ jsx(EndpointGroup, { endpoints: [
            {
              method: "GET",
              path: "/api/webhooks/status/:sessionId",
              description: "Get the webhook status and event history for a session.",
              requestParams: [
                { name: "sessionId", type: "string", required: true, description: "Session ID (URL parameter)" }
              ],
              responseParams: [
                { name: "success", type: "boolean", required: true, description: "Whether the request was successful" },
                { name: "data.session_id", type: "string", required: true, description: "Session identifier" },
                { name: "data.status", type: "string", required: true, description: "Webhook status (success, failed, pending)" },
                { name: "data.webhook_url", type: "string", required: true, description: "Configured webhook URL" },
                { name: "data.attempts", type: "number", required: true, description: "Number of delivery attempts" },
                { name: "data.events", type: "array", required: true, description: "List of webhook events" }
              ],
              responseBody: `{
  "success": true,
  "data": {
    "session_id": "sess_abc123",
    "status": "success",
    "webhook_url": "https://yourapp.com/webhook",
    "attempts": 1,
    "events": [
      { "event_type": "verification.success", "created_at": "..." },
      { "event_type": "webhook.sent", "response_status": 200, "created_at": "..." }
    ]
  }
}`
            },
            {
              method: "GET",
              path: "/api/webhooks/list",
              description: "List all webhooks (paginated).",
              requestParams: [
                { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
                { name: "limit", type: "number", required: false, description: "Items per page (default: 20)" }
              ],
              responseParams: [
                { name: "success", type: "boolean", required: true, description: "Whether the request was successful" },
                { name: "data", type: "array", required: true, description: "Array of webhook records" },
                { name: "total", type: "number", required: true, description: "Total number of webhooks" },
                { name: "page", type: "number", required: true, description: "Current page number" },
                { name: "limit", type: "number", required: true, description: "Items per page" }
              ],
              responseBody: `{
  "success": true,
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}`
            },
            {
              method: "POST",
              path: "/api/webhooks/trigger/success",
              description: "Manually trigger a success webhook (for testing).",
              requestParams: [
                { name: "sessionId", type: "string", required: true, description: "Session ID to trigger webhook for" },
                { name: "data", type: "object", required: false, description: "Custom data to include in webhook" }
              ],
              responseParams: [
                { name: "success", type: "boolean", required: true, description: "Whether the request was successful" },
                { name: "redirectUrl", type: "string", required: false, description: "Configured success redirect URL" },
                { name: "sessionId", type: "string", required: true, description: "Session identifier" }
              ],
              requestBody: `{
  "sessionId": "sess_abc123",
  "data": { "fields": { ... } }
}`,
              responseBody: `{
  "success": true,
  "redirectUrl": "https://yourapp.com/success?sessionId=sess_abc123",
  "sessionId": "sess_abc123"
}`
            },
            {
              method: "POST",
              path: "/api/webhooks/trigger/failed",
              description: "Manually trigger a failed webhook (for testing).",
              requestParams: [
                { name: "sessionId", type: "string", required: true, description: "Session ID to trigger webhook for" },
                { name: "reason", type: "string", required: false, description: "Failure reason message" }
              ],
              responseParams: [
                { name: "success", type: "boolean", required: true, description: "Whether the request was successful" },
                { name: "redirectUrl", type: "string", required: false, description: "Configured failure redirect URL" },
                { name: "sessionId", type: "string", required: true, description: "Session identifier" },
                { name: "reason", type: "string", required: false, description: "Failure reason" }
              ],
              requestBody: `{
  "sessionId": "sess_abc123",
  "reason": "ID document expired"
}`,
              responseBody: `{
  "success": true,
  "redirectUrl": "https://yourapp.com/failed?sessionId=sess_abc123&reason=...",
  "sessionId": "sess_abc123",
  "reason": "ID document expired"
}`
            }
          ] })
        ] }),
        /* @__PURE__ */ jsx("section", { className: "mb-10", children: /* @__PURE__ */ jsxs("div", { className: "bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-5 text-center", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-white mb-2", children: "Ready to test?" }),
          /* @__PURE__ */ jsx("p", { className: "text-white/80 text-sm mb-4", children: "Try our interactive API demo to create sessions and see responses." }),
          /* @__PURE__ */ jsx(
            "a",
            {
              href: "/api-demo",
              className: "inline-block px-5 py-2 bg-white hover:bg-gray-100 text-blue-600 font-medium rounded-lg transition-colors text-sm",
              children: "Open API Demo →"
            }
          )
        ] }) }),
        /* @__PURE__ */ jsx("footer", { className: "border-t border-gray-200 pt-6 text-center text-sm text-gray-500", children: "Identity Verification API v2.0 • Logica" })
      ] })
    ] }) })
  ] });
}
const CodeBlock = ({ code, language = "json" }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  };
  return /* @__PURE__ */ jsxs("div", { className: "relative group w-full max-w-full overflow-hidden", children: [
    /* @__PURE__ */ jsx("pre", { className: "bg-gray-900 text-gray-100 p-3 sm:p-4 rounded-lg overflow-x-auto text-sm max-h-60 sm:max-h-80 overflow-y-auto w-full", children: /* @__PURE__ */ jsx("code", { className: "break-all sm:break-normal whitespace-pre-wrap", children: code }) }),
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: handleCopy,
        className: "absolute top-2 right-2 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity",
        children: copied ? "Copied!" : "Copy"
      }
    )
  ] });
};
const EndpointTester = ({
  title,
  description,
  method,
  endpoint,
  defaultBody,
  onSessionCreated
}) => {
  const [requestBody, setRequestBody] = useState(JSON.stringify(defaultBody, null, 2));
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const body = JSON.parse(requestBody);
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      setResponse(data);
      if (data.success && data.sessionId && onSessionCreated) {
        onSessionCreated(data);
      }
    } catch (err) {
      setError(err.message || "Failed to execute request");
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden", children: [
    /* @__PURE__ */ jsxs("div", { className: "bg-gradient-to-r from-blue-600 to-purple-600 px-4 sm:px-6 py-3 sm:py-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 sm:gap-3", children: [
        /* @__PURE__ */ jsx("span", { className: "px-2 py-1 bg-white/20 text-white text-sm font-bold rounded", children: method }),
        /* @__PURE__ */ jsx("code", { className: "text-white/90 text-sm break-all", children: endpoint })
      ] }),
      /* @__PURE__ */ jsx("h3", { className: "text-white font-semibold mt-2 text-base sm:text-lg", children: title }),
      /* @__PURE__ */ jsx("p", { className: "text-white/80 text-sm mt-1", children: description })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "p-4 sm:p-6 space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Request Body" }),
        /* @__PURE__ */ jsx(
          "textarea",
          {
            value: requestBody,
            onChange: (e) => setRequestBody(e.target.value),
            className: "w-full h-36 sm:h-40 px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            spellCheck: false
          }
        )
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleSubmit,
          disabled: loading,
          className: "w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
          children: loading ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("svg", { className: "animate-spin h-4 w-4", viewBox: "0 0 24 24", children: [
              /* @__PURE__ */ jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4", fill: "none" }),
              /* @__PURE__ */ jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })
            ] }),
            "Sending..."
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }),
            "Send Request"
          ] })
        }
      ),
      error && /* @__PURE__ */ jsxs("div", { className: "p-4 bg-red-50 border border-red-200 rounded-lg", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-red-700", children: [
          /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
          /* @__PURE__ */ jsx("span", { className: "font-medium", children: "Error" })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-red-600 text-sm mt-1", children: error })
      ] }),
      response && /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: [
          "Response",
          /* @__PURE__ */ jsx("span", { className: `ml-2 px-2 py-0.5 text-xs rounded ${response.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`, children: response.success ? "Success" : "Failed" })
        ] }),
        /* @__PURE__ */ jsx(CodeBlock, { code: JSON.stringify(response, null, 2) })
      ] })
    ] })
  ] });
};
const SessionCard = ({ session, type }) => {
  const [showIframe, setShowIframe] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const getSessionUrl = () => {
    if (type === "id") {
      return `/session/idverification/${session.sessionId}`;
    } else if (type === "selfie") {
      return `/session/selfieliveness/${session.sessionId}`;
    } else if (type === "combined") {
      return `/session/combined/${session.sessionId}`;
    }
    return session.sessionUrl || session.embedUrl;
  };
  const checkWebhookStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/webhooks/status/${session.sessionId}`);
      const data = await res.json();
      setWebhookStatus(data.success ? data.data : null);
    } catch (e) {
      console.error("Failed to check webhook status:", e);
    }
    setLoading(false);
  };
  const triggerWebhook = async (type2) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/webhooks/trigger/${type2}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          reason: type2 === "failed" ? "Manual test trigger" : void 0
        })
      });
      const data = await res.json();
      if (data.success && data.redirectUrl) {
        window.open(data.redirectUrl, "_blank");
      }
      await checkWebhookStatus();
    } catch (e) {
      console.error("Failed to trigger webhook:", e);
    }
    setLoading(false);
  };
  return /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-3 sm:p-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: `px-2 py-1 text-sm font-medium rounded ${type === "id" ? "bg-blue-100 text-blue-700" : type === "selfie" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`, children: type === "id" ? "ID Verification" : type === "selfie" ? "Selfie Liveness" : "Combined Flow" }),
        session.webhookRegistered && /* @__PURE__ */ jsx("span", { className: "px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-700", children: "Webhook" }),
        webhookStatus && /* @__PURE__ */ jsx("span", { className: `px-2 py-1 text-xs font-medium rounded ${webhookStatus.status === "success" ? "bg-green-100 text-green-700" : webhookStatus.status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`, children: webhookStatus.status })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-500", children: (/* @__PURE__ */ new Date()).toLocaleTimeString() })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-2 text-sm", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-gray-500", children: "Session ID:" }),
        /* @__PURE__ */ jsx("code", { className: "px-2 py-0.5 bg-gray-100 rounded text-gray-700 text-sm break-all", children: session.sessionId })
      ] }),
      session.selfieSessionId && /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-gray-500", children: "Selfie Session:" }),
        /* @__PURE__ */ jsx("code", { className: "px-2 py-0.5 bg-gray-100 rounded text-gray-700 text-sm break-all", children: session.selfieSessionId })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => triggerWebhook("success"),
          disabled: loading,
          className: "px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium rounded transition-colors disabled:opacity-50",
          children: "✓ Success"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => triggerWebhook("failed"),
          disabled: loading,
          className: "px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded transition-colors disabled:opacity-50",
          children: "✕ Failed"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: checkWebhookStatus,
          disabled: loading,
          className: "px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded transition-colors disabled:opacity-50",
          children: "🔄 Status"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row gap-2 mt-4", children: [
      /* @__PURE__ */ jsx(
        "a",
        {
          href: getSessionUrl(),
          target: "_blank",
          rel: "noopener noreferrer",
          className: "flex-1 px-3 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg text-center transition-colors",
          children: "Open in New Tab"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setShowIframe(!showIframe),
          className: "flex-1 px-3 py-2.5 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors hidden sm:block",
          children: showIframe ? "Hide Preview" : "Show Preview"
        }
      )
    ] }),
    showIframe && /* @__PURE__ */ jsxs("div", { className: "mt-4 border border-gray-300 rounded-lg overflow-hidden hidden sm:block", children: [
      /* @__PURE__ */ jsxs("div", { className: "bg-gray-100 px-3 py-2 text-xs text-gray-600 border-b border-gray-300 truncate", children: [
        "Preview: ",
        getSessionUrl()
      ] }),
      /* @__PURE__ */ jsx(
        "iframe",
        {
          src: getSessionUrl(),
          className: "w-full h-[400px] lg:h-[500px]",
          allow: "camera",
          title: "Verification Preview"
        }
      )
    ] })
  ] });
};
function ApiDemo() {
  const [createdSessions, setCreatedSessions] = useState([]);
  const [baseUrl, setBaseUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);
  const handleSessionCreated = (data, type) => {
    setCreatedSessions((prev) => [{ ...data, type, createdAt: /* @__PURE__ */ new Date() }, ...prev]);
  };
  const getIdVerificationBody = () => ({
    idType: "national-id",
    successUrl: baseUrl ? `${baseUrl}/demo/success` : "/demo/success",
    failureUrl: baseUrl ? `${baseUrl}/demo/failed` : "/demo/failed",
    webhookUrl: baseUrl ? `${baseUrl}/api/webhooks/receive` : "/api/webhooks/receive",
    testMode: false,
    authRequired: false
  });
  const getSelfieBody = () => ({
    successUrl: baseUrl ? `${baseUrl}/demo/success` : "/demo/success",
    failureUrl: baseUrl ? `${baseUrl}/demo/failed` : "/demo/failed",
    webhookUrl: baseUrl ? `${baseUrl}/api/webhooks/receive` : "/api/webhooks/receive",
    testMode: false
  });
  const getCombinedBody = () => ({
    idType: "national-id",
    successUrl: baseUrl ? `${baseUrl}/demo/success` : "/demo/success",
    failureUrl: baseUrl ? `${baseUrl}/demo/failed` : "/demo/failed",
    webhookUrl: baseUrl ? `${baseUrl}/api/webhooks/receive` : "/api/webhooks/receive",
    testMode: false,
    authRequired: false
  });
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gray-50", children: [
    /* @__PURE__ */ jsx(Header, {}),
    /* @__PURE__ */ jsxs("main", { className: "max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "mb-6 sm:mb-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-4 sm:p-6 text-white", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-xl sm:text-2xl font-bold mb-2", children: "Interactive API Tester" }),
        /* @__PURE__ */ jsx("p", { className: "text-white/90 text-sm sm:text-base", children: "Test the three session creation endpoints below. Each endpoint creates a verification session that you can then open and interact with." }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-3 sm:gap-4 mt-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-sm", children: [
            /* @__PURE__ */ jsx("span", { className: "w-2 h-2 bg-blue-300 rounded-full" }),
            "ID Verification"
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-sm", children: [
            /* @__PURE__ */ jsx("span", { className: "w-2 h-2 bg-purple-300 rounded-full" }),
            "Selfie Liveness"
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-sm", children: [
            /* @__PURE__ */ jsx("span", { className: "w-2 h-2 bg-green-300 rounded-full" }),
            "Combined Flow"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid lg:grid-cols-2 gap-4 sm:gap-8", children: [
        /* @__PURE__ */ jsxs("div", { className: "space-y-4 sm:space-y-6", children: [
          /* @__PURE__ */ jsx(
            EndpointTester,
            {
              title: "Create ID Verification Session",
              description: "Creates a session for ID document verification only",
              method: "POST",
              endpoint: "/api/verify/id/create",
              defaultBody: getIdVerificationBody(),
              onSessionCreated: (data) => handleSessionCreated(data, "id")
            }
          ),
          /* @__PURE__ */ jsx(
            EndpointTester,
            {
              title: "Create Selfie Liveness Session",
              description: "Creates a session for selfie liveness verification only",
              method: "POST",
              endpoint: "/api/verify/selfie/create",
              defaultBody: getSelfieBody(),
              onSessionCreated: (data) => handleSessionCreated(data, "selfie")
            }
          ),
          /* @__PURE__ */ jsx(
            EndpointTester,
            {
              title: "Create Combined Verification Session",
              description: "Creates a combined flow: ID verification first, then selfie liveness",
              method: "POST",
              endpoint: "/api/verify/combined/create",
              defaultBody: getCombinedBody(),
              onSessionCreated: (data) => handleSessionCreated(data, "combined")
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsxs("div", { className: "lg:sticky lg:top-24", children: [
          /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden", children: [
            /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 text-base", children: "Created Sessions" }),
                createdSessions.length > 0 && /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => setCreatedSessions([]),
                    className: "text-sm text-red-600 hover:text-red-700",
                    children: "Clear All"
                  }
                )
              ] }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 mt-1", children: "Sessions created during this demo" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "p-3 sm:p-4 max-h-[300px] sm:max-h-[calc(100vh-200px)] overflow-y-auto", children: createdSessions.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "text-center py-8 sm:py-12", children: [
              /* @__PURE__ */ jsx("div", { className: "w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4", children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6 sm:w-8 sm:h-8 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" }) }) }),
              /* @__PURE__ */ jsx("p", { className: "text-gray-500 text-sm", children: "No sessions created yet" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-400 mt-1", children: "Use the endpoints above to create sessions" })
            ] }) : /* @__PURE__ */ jsx("div", { className: "space-y-3 sm:space-y-4", children: createdSessions.map((session, index) => /* @__PURE__ */ jsx(SessionCard, { session, type: session.type }, index)) }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-4 sm:mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4", children: [
            /* @__PURE__ */ jsx("h4", { className: "font-medium text-gray-900 mb-2 sm:mb-3 text-base", children: "Quick Links" }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-1 gap-1 sm:gap-2", children: [
              /* @__PURE__ */ jsxs(
                "a",
                {
                  href: "/id-verification-test",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "flex items-center gap-2 px-3 py-2.5 sm:py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "w-4 h-4 flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" }) }),
                    "ID Verification Test"
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                "a",
                {
                  href: "/selfie-liveness-test",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "flex items-center gap-2 px-3 py-2.5 sm:py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors",
                  children: [
                    /* @__PURE__ */ jsxs("svg", { className: "w-4 h-4 flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
                      /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" }),
                      /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" })
                    ] }),
                    "Selfie Liveness Test"
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                "a",
                {
                  href: "/docs#sessions",
                  className: "flex items-center gap-2 px-3 py-2.5 sm:py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "w-4 h-4 flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }),
                    "Sessions Docs"
                  ]
                }
              )
            ] })
          ] })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-8 sm:mt-12 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6", children: [
        /* @__PURE__ */ jsx("h3", { className: "font-semibold text-gray-900 mb-3 sm:mb-4 text-base", children: "Supported ID Types" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 mb-3 sm:hidden", children: "Tap to copy ID type" }),
        /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3", children: [
          { id: "national-id", name: "National ID" },
          { id: "passport", name: "Passport" },
          { id: "umid", name: "UMID" },
          { id: "driver-license", name: "Driver's License" },
          { id: "tin-id", name: "TIN ID" },
          { id: "philhealth", name: "PhilHealth" },
          { id: "pagibig", name: "Pag-IBIG" },
          { id: "postal-id", name: "Postal ID" }
        ].map((idType) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "px-2 sm:px-3 py-2 bg-gray-50 rounded-lg text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 transition-colors",
            onClick: () => navigator.clipboard.writeText(idType.id),
            title: "Click to copy",
            children: [
              /* @__PURE__ */ jsx("code", { className: "text-xs text-gray-500 break-all", children: idType.id }),
              /* @__PURE__ */ jsx("div", { className: "font-medium mt-0.5 text-sm", children: idType.name })
            ]
          },
          idType.id
        )) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("footer", { className: "border-t border-gray-200 mt-8 sm:mt-12", children: /* @__PURE__ */ jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6", children: /* @__PURE__ */ jsxs("p", { className: "text-sm text-gray-500 text-center", children: [
      "Identity Verification API Demo • ",
      /* @__PURE__ */ jsx("a", { href: "/docs", className: "text-blue-600 hover:underline", children: "View Full Documentation" })
    ] }) }) })
  ] });
}
function VerificationSuccess() {
  var _a, _b;
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [webhookData, setWebhookData] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchData = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }
      try {
        const webhookRes = await fetch(`/api/webhooks/status/${sessionId}`);
        const webhookJson = await webhookRes.json();
        if (webhookJson.success) {
          setWebhookData(webhookJson.data);
        }
        const sessionRes = await fetch(`/api/verify/session/${sessionId}`);
        const sessionJson = await sessionRes.json();
        if (sessionJson.success) {
          setSessionData(sessionJson.session);
        }
      } catch (e) {
        console.error("Failed to fetch data:", e);
      }
      setLoading(false);
    };
    fetchData();
  }, [sessionId]);
  const fields = ((_a = sessionData == null ? void 0 : sessionData.result) == null ? void 0 : _a.fields) || ((_b = webhookData == null ? void 0 : webhookData.verification_data) == null ? void 0 : _b.fields) || {};
  return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-lg w-full", children: [
    /* @__PURE__ */ jsx("div", { className: "w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-green-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }) }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3", children: "Verification Successful!" }),
    /* @__PURE__ */ jsx("p", { className: "text-gray-600 text-center mb-6", children: "Your identity has been verified successfully." }),
    loading ? /* @__PURE__ */ jsx("div", { className: "flex justify-center py-8", children: /* @__PURE__ */ jsx("div", { className: "animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      sessionId && /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 rounded-lg p-4 mb-4", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 mb-1", children: "Session ID" }),
        /* @__PURE__ */ jsx("code", { className: "text-sm text-gray-800 break-all", children: sessionId })
      ] }),
      Object.keys(fields).length > 0 && /* @__PURE__ */ jsxs("div", { className: "bg-green-50 rounded-lg p-4 mb-4", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-green-800 mb-3", children: "Verified Information" }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          fields.firstName && /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
            /* @__PURE__ */ jsx("span", { className: "text-gray-600", children: "First Name:" }),
            /* @__PURE__ */ jsx("span", { className: "font-medium text-gray-900", children: fields.firstName })
          ] }),
          fields.lastName && /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
            /* @__PURE__ */ jsx("span", { className: "text-gray-600", children: "Last Name:" }),
            /* @__PURE__ */ jsx("span", { className: "font-medium text-gray-900", children: fields.lastName })
          ] }),
          fields.birthDate && /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
            /* @__PURE__ */ jsx("span", { className: "text-gray-600", children: "Birth Date:" }),
            /* @__PURE__ */ jsx("span", { className: "font-medium text-gray-900", children: fields.birthDate })
          ] }),
          fields.idNumber && /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
            /* @__PURE__ */ jsx("span", { className: "text-gray-600", children: "ID Number:" }),
            /* @__PURE__ */ jsx("span", { className: "font-medium text-gray-900", children: fields.idNumber })
          ] })
        ] })
      ] }),
      webhookData && /* @__PURE__ */ jsxs("div", { className: "bg-blue-50 rounded-lg p-4 mb-6", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-blue-800 mb-2", children: "Webhook Status" }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: `w-2 h-2 rounded-full ${webhookData.status === "success" ? "bg-green-500" : webhookData.status === "failed" ? "bg-red-500" : "bg-yellow-500"}` }),
          /* @__PURE__ */ jsx("span", { className: "text-sm text-blue-700 capitalize", children: webhookData.status }),
          /* @__PURE__ */ jsxs("span", { className: "text-sm text-blue-600", children: [
            "• ",
            webhookData.session_type
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsx(
        Link,
        {
          to: "/api-demo",
          className: "block w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-center",
          children: "Back to API Demo"
        }
      ),
      /* @__PURE__ */ jsx(
        Link,
        {
          to: "/",
          className: "block w-full px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-center",
          children: "Go Home"
        }
      )
    ] })
  ] }) });
}
function VerificationFailed() {
  var _a, _b, _c;
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const reason = searchParams.get("reason");
  const [webhookData, setWebhookData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchData = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/webhooks/status/${sessionId}`);
        const data = await res.json();
        if (data.success) {
          setWebhookData(data.data);
        }
      } catch (e) {
        console.error("Failed to fetch webhook status:", e);
      }
      setLoading(false);
    };
    fetchData();
  }, [sessionId]);
  const failureReason = reason || ((_a = webhookData == null ? void 0 : webhookData.verification_data) == null ? void 0 : _a.reason) || "Your identity verification was unsuccessful.";
  return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-lg w-full", children: [
    /* @__PURE__ */ jsx("div", { className: "w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6", children: /* @__PURE__ */ jsx("svg", { className: "w-10 h-10 text-red-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3", children: "Verification Failed" }),
    /* @__PURE__ */ jsx("p", { className: "text-gray-600 text-center mb-6", children: failureReason }),
    loading ? /* @__PURE__ */ jsx("div", { className: "flex justify-center py-8", children: /* @__PURE__ */ jsx("div", { className: "animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full" }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      sessionId && /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 rounded-lg p-4 mb-4", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 mb-1", children: "Session ID" }),
        /* @__PURE__ */ jsx("code", { className: "text-sm text-gray-800 break-all", children: sessionId })
      ] }),
      (webhookData == null ? void 0 : webhookData.verification_data) && /* @__PURE__ */ jsxs("div", { className: "bg-red-50 rounded-lg p-4 mb-4", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-red-800 mb-2", children: "Failure Details" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-red-700", children: typeof webhookData.verification_data === "string" ? (_b = JSON.parse(webhookData.verification_data)) == null ? void 0 : _b.reason : ((_c = webhookData.verification_data) == null ? void 0 : _c.reason) || "No additional details available" })
      ] }),
      webhookData && /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 rounded-lg p-4 mb-6", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-gray-700 mb-2", children: "Webhook Status" }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: `w-2 h-2 rounded-full ${webhookData.status === "success" ? "bg-green-500" : webhookData.status === "failed" ? "bg-red-500" : "bg-yellow-500"}` }),
          /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-600 capitalize", children: webhookData.status }),
          /* @__PURE__ */ jsxs("span", { className: "text-sm text-gray-500", children: [
            "• ",
            webhookData.session_type
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-yellow-800 mb-2", children: "Common reasons for failure:" }),
        /* @__PURE__ */ jsxs("ul", { className: "text-sm text-yellow-700 space-y-1 list-disc list-inside", children: [
          /* @__PURE__ */ jsx("li", { children: "Poor image quality or lighting" }),
          /* @__PURE__ */ jsx("li", { children: "ID document not fully visible" }),
          /* @__PURE__ */ jsx("li", { children: "Expired or invalid ID document" }),
          /* @__PURE__ */ jsx("li", { children: "Required fields not detected" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsx(
        Link,
        {
          to: "/api-demo",
          className: "block w-full px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-center",
          children: "Try Again"
        }
      ),
      /* @__PURE__ */ jsx(
        Link,
        {
          to: "/",
          className: "block w-full px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-center",
          children: "Go Home"
        }
      )
    ] })
  ] }) });
}
function App({ initialState = {} }) {
  return /* @__PURE__ */ jsxs(Routes, { children: [
    /* @__PURE__ */ jsx(Route, { path: "/", element: /* @__PURE__ */ jsx(HomePage, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/docs", element: /* @__PURE__ */ jsx(Documentation, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/api-demo", element: /* @__PURE__ */ jsx(ApiDemo, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/id-verification-test", element: /* @__PURE__ */ jsx(IDVerificationTest, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/selfie-liveness-test", element: /* @__PURE__ */ jsx(SelfieLivenessTest, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/embed/session/:id", element: /* @__PURE__ */ jsx(EmbedVerification, { initialState }) }),
    /* @__PURE__ */ jsx(Route, { path: "/session/idverification/:id", element: /* @__PURE__ */ jsx(IDVerification, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/session/selfieliveness/:id", element: /* @__PURE__ */ jsx(SelfieLiveness, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/session/combined/:id", element: /* @__PURE__ */ jsx(CombinedVerification, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/demo/success", element: /* @__PURE__ */ jsx(VerificationSuccess, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/demo/failed", element: /* @__PURE__ */ jsx(VerificationFailed, {}) })
  ] });
}
function render(url, initialState = {}) {
  const html = renderToString(
    /* @__PURE__ */ jsx(StaticRouter, { location: url, children: /* @__PURE__ */ jsx(App, { initialState }) })
  );
  let head = `
    <script>
      window.__INITIAL_STATE__ = ${JSON.stringify(initialState).replace(/</g, "<")};
    <\/script>
  `;
  const expectedOrigin = process.env.VITE_EXPECTED_ORIGIN || process.env.IDENTITY_EXPECTED_ORIGIN || "";
  const originScript = `
    <script>
      window.__IDENTITY_EXPECTED_ORIGIN__ = ${JSON.stringify(expectedOrigin || "*")};
    <\/script>
  `;
  head += originScript;
  return { html, head };
}
export {
  render
};

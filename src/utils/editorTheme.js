// Editor themes in the app's own palette (warm ink on near-black, or slate on paper),
// so the code area matches the rest of the workspace instead of stock Dracula.
import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";

const mono = '"JetBrains Mono", "Cascadia Code", "SF Mono", Menlo, Consolas, monospace';

export const colabsDark = createTheme({
    theme: "dark",
    settings: {
        background: "#0E0E0D",
        foreground: "#E8E6DF",
        caret: "#9CC3FF",
        selection: "rgba(156, 195, 255, .22)",
        selectionMatch: "rgba(156, 195, 255, .12)",
        lineHighlight: "rgba(232, 230, 223, .035)",
        gutterBackground: "#0E0E0D",
        gutterForeground: "#5C5A54",
        gutterActiveForeground: "#C9C6BD",
        gutterBorder: "transparent",
        fontFamily: mono,
    },
    styles: [
        { tag: [t.comment, t.lineComment, t.blockComment], color: "#6E6B64", fontStyle: "italic" },
        { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: "#C792EA" },
        { tag: [t.definitionKeyword, t.modifier], color: "#C792EA" },
        { tag: [t.string, t.special(t.string), t.regexp], color: "#A5D6A7" },
        { tag: [t.number, t.bool, t.null, t.atom], color: "#F5B97A" },
        { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#82AAFF" },
        { tag: [t.definition(t.variableName), t.definition(t.function(t.variableName))], color: "#9CC3FF" },
        { tag: [t.typeName, t.className, t.namespace], color: "#FFCB6B" },
        { tag: [t.propertyName, t.attributeName], color: "#89DDFF" },
        { tag: [t.tagName], color: "#F07178" },
        { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: "#A3A098" },
        { tag: [t.variableName], color: "#E8E6DF" },
        { tag: [t.meta, t.annotation, t.processingInstruction], color: "#F78C6C" },
        { tag: t.invalid, color: "#F87171" },
    ],
});

export const colabsLight = createTheme({
    theme: "light",
    settings: {
        background: "#FFFFFF",
        foreground: "#1B2333",
        caret: "#2F6BFF",
        selection: "rgba(47, 107, 255, .16)",
        selectionMatch: "rgba(47, 107, 255, .09)",
        lineHighlight: "rgba(27, 35, 51, .035)",
        gutterBackground: "#FFFFFF",
        gutterForeground: "#A0A8B8",
        gutterActiveForeground: "#3A4458",
        gutterBorder: "transparent",
        fontFamily: mono,
    },
    styles: [
        { tag: [t.comment, t.lineComment, t.blockComment], color: "#8A93A6", fontStyle: "italic" },
        { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword, t.modifier], color: "#8B3FD1" },
        { tag: [t.string, t.special(t.string), t.regexp], color: "#1F7A45" },
        { tag: [t.number, t.bool, t.null, t.atom], color: "#B5520B" },
        { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#2357D9" },
        { tag: [t.definition(t.variableName), t.definition(t.function(t.variableName))], color: "#1C4FBF" },
        { tag: [t.typeName, t.className, t.namespace], color: "#A15C00" },
        { tag: [t.propertyName, t.attributeName], color: "#0E7C86" },
        { tag: [t.tagName], color: "#C2362B" },
        { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: "#5B6880" },
        { tag: [t.meta, t.annotation, t.processingInstruction], color: "#C2410C" },
        { tag: t.invalid, color: "#C2362B" },
    ],
});

// Layout tweaks shared by both: roomier gutter, softer active line, readable line height.
export const editorChrome = EditorView.theme({
    "&": { height: "100%" },
    ".cm-scroller": { lineHeight: "1.65", fontFamily: mono },
    ".cm-content": { padding: "12px 0 40vh" },
    ".cm-gutters": { paddingLeft: "6px" },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 14px 0 8px", minWidth: "36px" },
    ".cm-activeLineGutter": { background: "transparent" },
    ".cm-foldGutter .cm-gutterElement": { opacity: ".5" },
    ".cm-tooltip": { borderRadius: "8px", overflow: "hidden" },
    ".cm-tooltip-autocomplete > ul > li": { padding: "2px 10px" },
    "&.cm-focused": { outline: "none" },
});

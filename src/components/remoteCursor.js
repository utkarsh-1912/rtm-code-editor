// Other people's cursors in the editor: a thin caret in their colour with their name in a
// small tag. The tag floats above the caret (below it on the first line, so it isn't clipped),
// never takes space in the text, and fades after a moment so it doesn't hide code; it comes
// back whenever that person moves (the widget is re-created on every move).
import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";

class CursorWidget extends WidgetType {
    constructor(name, color, below) {
        super();
        this.name = name || "Guest";
        this.color = color || "#5B8DEF";
        this.below = below;
    }

    eq(other) {
        return other.name === this.name && other.color === this.color && other.below === this.below;
    }

    toDOM() {
        const caret = document.createElement("span");
        caret.className = `rc-caret${this.below ? " rc-below" : ""}`;
        caret.style.setProperty("--rc", this.color);
        caret.setAttribute("aria-hidden", "true");
        const tag = document.createElement("span");
        tag.className = "rc-tag";
        tag.textContent = this.name;
        caret.appendChild(tag);
        return caret;
    }

    ignoreEvent() {
        return true;
    }
}

// remoteCursors: { socketId: { pos, userName, color } }
export const remoteCursorPlugin = (remoteCursors) => ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = this.build(view); }

    update(update) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) this.decorations = this.build(update.view);
    }

    build(view) {
        const widgets = [];
        for (const data of Object.values(remoteCursors)) {
            if (data.pos === undefined || data.pos < 0 || data.pos > view.state.doc.length) continue;
            const below = view.state.doc.lineAt(data.pos).number === 1;
            widgets.push(Decoration.widget({ widget: new CursorWidget(data.userName, data.color, below), side: 1 }).range(data.pos));
        }
        return Decoration.set(widgets.sort((a, b) => a.from - b.from));
    }
}, { decorations: (v) => v.decorations });

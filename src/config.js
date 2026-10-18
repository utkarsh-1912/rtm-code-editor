import { LANGS } from "./utils/languages";

// Room language picker: { id: Judge0 id, name, value } for every runnable language.
export const LANGUAGES = LANGS.map((l) => ({ id: l.judge0Id, name: `${l.label} (${l.runtime})`, value: l.id }));

export const THEMES = ["dracula", "monokai", "material", "nord", "blackboard"];

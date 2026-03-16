import type { DOMOutputSpec } from "@tiptap/pm/model";
import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, string>;
  onWikiLinkClick?: (noteName: string) => void;
}

export interface WikiLinkAttributes {
  noteName: string;
  noteId?: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      insertWikiLink: (noteName: string, noteId?: string) => ReturnType;
    };
  }
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: "wikiLink",

  group: "inline",

  inline: true,

  selectable: true,

  atom: false,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "wiki-link",
      },
    };
  },

  addAttributes() {
    return {
      noteName: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-note-name"),
        renderHTML: (attributes: WikiLinkAttributes) => {
          if (!attributes.noteName) return {};
          return { "data-note-name": attributes.noteName };
        },
      },
      noteId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-note-id"),
        renderHTML: (attributes: WikiLinkAttributes) => {
          if (!attributes.noteId) return {};
          return { "data-note-id": attributes.noteId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "a[data-wiki-link]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    return [
      "a",
      mergeAttributes(
        {
          "data-wiki-link": "true",
          href: `#${HTMLAttributes.noteName}`,
          class: "wiki-link",
          title: `Open "${HTMLAttributes.noteName}"`,
        },
        HTMLAttributes,
        this.options.HTMLAttributes
      ),
      `[[${HTMLAttributes.noteName}]]`,
    ];
  },

  addCommands() {
    return {
      insertWikiLink:
        (noteName: string, noteId?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { noteName, noteId },
          });
        },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\[\[([^\]]+)\]\]$/,
        type: this.type,
        getAttributes: (match: RegExpMatchArray) => ({
          noteName: match[1].trim(),
        }),
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }): boolean => {
        const { state } = editor;
        const { selection } = state;
        const { $from } = selection;

        const node = $from.node($from.depth);
        if (node?.type?.name === this.name) {
          const endPos = $from.after($from.depth);
          editor.commands.focus(endPos);
          return true;
        }

        return false;
      },
    };
  },
});

export default WikiLink;

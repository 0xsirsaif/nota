import type { DOMOutputSpec } from "@tiptap/pm/model";
import { Mark, mergeAttributes, markInputRule } from "@tiptap/core";

export interface TagOptions {
  HTMLAttributes: Record<string, string>;
  onTagClick?: (tag: string) => void;
}

export interface TagAttributes {
  tag: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tag: {
      toggleTag: (tag: string) => ReturnType;
    };
  }
}

export const Tag = Mark.create<TagOptions>({
  name: "tag",

  excludable: false,

  inclusive: false,

  spanning: false,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "tag-mark",
      },
    };
  },

  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-tag"),
        renderHTML: (attributes: TagAttributes) => {
          if (!attributes.tag) return {};
          return { "data-tag": attributes.tag };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-tag]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    return [
      "span",
      mergeAttributes(
        {
          "data-tag": HTMLAttributes.tag,
          class: "tag-mark",
          title: `Filter by #${HTMLAttributes.tag}`,
        },
        HTMLAttributes,
        this.options.HTMLAttributes
      ),
      `#${HTMLAttributes.tag}`,
    ];
  },

  addCommands() {
    return {
      toggleTag:
        (tag: string) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, { tag });
        },
    };
  },

  addInputRules() {
    return [
      markInputRule({
        find: /(?:^|\s)(#[a-zA-Z0-9_-]+)$/,
        type: this.type,
        getAttributes: (match: RegExpMatchArray) => ({
          tag: match[1].slice(1),
        }),
      }),
    ];
  },
});

export default Tag;

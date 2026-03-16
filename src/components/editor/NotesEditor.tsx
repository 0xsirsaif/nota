import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import { Markdown } from "tiptap-markdown";
import { Loader2, Maximize2, Minimize2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readMarkdownFile, writeMarkdownFile } from "@/lib/tauri";
import { useEditorStore } from "@/stores/editorStore";
import { WikiLink } from "./extensions/WikiLink";
import { Tag } from "./extensions/Tag";

interface NotesEditorProps {
  filePath: string;
  autoSaveInterval?: number;
  onWikiLinkClick?: (noteName: string) => void;
  onTagClick?: (tag: string) => void;
}

export function NotesEditor({
  filePath,
  autoSaveInterval = 2000,
  onWikiLinkClick,
  onTagClick,
}: NotesEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { registerEditor, unregisterEditor } = useEditorStore();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Highlight,
      // Markdown extension - stores content as pure markdown
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: true,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      // Wiki links [[Note Name]]
      WikiLink.configure({
        HTMLAttributes: {
          class: "wiki-link",
        },
        onWikiLinkClick,
      }),
      // Tags #tag
      Tag.configure({
        HTMLAttributes: {
          class: "tag-mark",
        },
        onTagClick,
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: cn(
          "prose dark:prose-invert max-w-none focus:outline-none min-h-full",
          "prose-headings:tracking-tight prose-headings:font-semibold",
          "prose-h1:text-xl prose-h1:mb-4 prose-h1:mt-6",
          "prose-h2:text-lg prose-h2:mb-3 prose-h2:mt-5",
          "prose-h3:text-base prose-h3:mb-2 prose-h3:mt-4",
          "prose-p:mb-3 prose-p:leading-relaxed",
          "prose-blockquote:border-l prose-blockquote:border-muted-foreground/30 prose-blockquote:pl-4 prose-blockquote:my-4 prose-blockquote:text-muted-foreground",
          "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-mono",
          "prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-4",
          "prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-3",
          "prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-3",
          "prose-li:mb-1"
        ),
      },
      handleClickOn(_view, _pos, _node, _nodePos, event) {
        // Handle wiki link clicks
        const target = event.target as HTMLElement;
        if (target?.hasAttribute?.("data-wiki-link")) {
          const noteName = target.getAttribute("data-note-name");
          if (noteName && onWikiLinkClick) {
            onWikiLinkClick(noteName);
            return true;
          }
        }
        // Handle tag clicks
        if (target?.hasAttribute?.("data-tag")) {
          const tag = target.getAttribute("data-tag");
          if (tag && onTagClick) {
            onTagClick(tag);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: () => {
      scheduleSave();
    },
  });

  // Load initial content as markdown
  useEffect(() => {
    if (!editor || !filePath) return;

    const loadContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const content = await readMarkdownFile(filePath);
        // Set content as markdown - tiptap-markdown will parse it
        editor.commands.setContent(content);
      } catch (err) {
        console.error("Failed to load notes:", err);
        setError("Failed to load notes. Starting with empty editor.");
        editor.commands.setContent("");
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [editor, filePath]);

  // Register editor for global save on session change
  useEffect(() => {
    if (!editor || !filePath) return;

    const saveFn = async () => {
      if (editor.isDestroyed) return;
      // Get markdown content from storage
      const content = (editor.storage.markdown?.getMarkdown?.() as string) || editor.getText();
      await performSave(content);
    };

    registerEditor(filePath, saveFn);
    return () => unregisterEditor(filePath);
  }, [editor, filePath, registerEditor, unregisterEditor]);

  const performSave = useCallback(
    async (content: string) => {
      if (!filePath || isSaving) return;

      setIsSaving(true);
      try {
        await writeMarkdownFile(filePath, content);
        setLastSaved(new Date());
        setError(null);
      } catch (err) {
        console.error("Failed to save notes:", err);
        setError("Failed to save");
      } finally {
        setIsSaving(false);
      }
    },
    [filePath, isSaving]
  );

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (editor && !editor.isDestroyed) {
        // Save as markdown
        const content = editor.storage.markdown?.getMarkdown?.() || "";
        performSave(content);
      }
    }, autoSaveInterval);
  }, [editor, autoSaveInterval, performSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Update editor classes when fullscreen changes
  useEffect(() => {
    if (!editor) return;

    const proseClasses = isFullscreen
      ? cn(
          "prose dark:prose-invert prose-lg max-w-none focus:outline-none min-h-full",
          "prose-headings:tracking-tight prose-headings:font-semibold",
          "prose-h1:text-2xl prose-h1:mb-6 prose-h1:mt-8",
          "prose-h2:text-xl prose-h2:mb-4 prose-h2:mt-6",
          "prose-h3:text-lg prose-h3:mb-3 prose-h3:mt-5",
          "prose-p:mb-4 prose-p:leading-relaxed",
          "px-8 py-8"
        )
      : cn(
          "prose dark:prose-invert prose-sm max-w-none focus:outline-none min-h-[300px]",
          "prose-headings:tracking-tight prose-headings:font-semibold",
          "prose-h1:text-xl prose-h1:mb-4 prose-h1:mt-6",
          "prose-h2:text-lg prose-h2:mb-3 prose-h2:mt-5",
          "prose-h3:text-base prose-h3:mb-2 prose-h3:mt-4",
          "prose-p:mb-3 prose-p:leading-relaxed",
          "px-4 py-3"
        );

    editor.setOptions({
      editorProps: {
        attributes: {
          class: proseClasses,
        },
      },
    });
  }, [isFullscreen, editor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to exit fullscreen
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
      // Ctrl/Cmd + Shift + F to toggle fullscreen
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Manual save handler - saves as markdown
  const handleManualSave = useCallback(async () => {
    if (!editor || editor.isDestroyed) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const content = editor.storage.markdown?.getMarkdown?.() || "";
    await performSave(content);
  }, [editor, performSave]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px] border rounded-md bg-muted/20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden flex flex-col",
        isFullscreen ? "fixed inset-0 z-50 bg-background" : "bg-background border rounded-md"
      )}
    >
      {/* Header - minimal, no toolbar */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 border-b bg-muted/20 shrink-0",
          isFullscreen && "absolute top-0 left-0 right-0 z-10 px-6 py-4 border-b-0 bg-transparent opacity-0 hover:opacity-100 transition-opacity"
        )}
      >
        <div className="flex items-center gap-2">
          {isFullscreen ? (
            <span className="text-xs text-muted-foreground">Fullscreen</span>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Notes</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md",
              isFullscreen && "bg-muted text-foreground"
            )}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen (Ctrl+Shift+F)"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div
        className={cn(
          "flex-1 overflow-auto",
          isFullscreen && "bg-background h-screen ProseMirror-fullscreen"
        )}
      >
        <EditorContent
          editor={editor}
          className={cn(
            "h-full min-h-full",
            isFullscreen && "max-w-[75ch] mx-auto"
          )}
        />
      </div>

      {/* Status Bar */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-1.5 border-t bg-muted/20 text-xs text-muted-foreground shrink-0",
          isFullscreen && "absolute bottom-0 left-0 right-0 z-10 px-6 py-3 border-t-0 bg-transparent opacity-0 hover:opacity-100 transition-opacity"
        )}
      >
        <div className="flex items-center gap-2">
          {isSaving ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          ) : error ? (
            <span className="text-destructive">{error}</span>
          ) : lastSaved ? (
            <span>Saved {lastSaved.toLocaleTimeString()}</span>
          ) : (
            <span>Unsaved</span>
          )}
          {isFullscreen && (
            <span className="text-muted-foreground/60">· Press Esc to exit</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editor && (
            <span>
              {editor.storage.characterCount?.characters?.() || editor.getText().length} chars
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs px-2"
            onClick={handleManualSave}
            disabled={isSaving}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

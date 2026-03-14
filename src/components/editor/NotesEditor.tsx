import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Highlighter,
  Quote,
  Code,
  Undo,
  Redo,
  Loader2,
  Maximize2,
  Minimize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { readMarkdownFile, writeMarkdownFile } from "@/lib/tauri";
import { useEditorStore } from "@/stores/editorStore";

interface NotesEditorProps {
  filePath: string;
  autoSaveInterval?: number;
}

export function NotesEditor({ filePath, autoSaveInterval = 2000 }: NotesEditorProps) {
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
      Underline,
      Placeholder.configure({
        placeholder: "Start writing your notes...",
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose dark:prose-invert max-w-none focus:outline-none min-h-full",
      },
    },
    onUpdate: () => {
      scheduleSave();
    },
  });

  // Load initial content
  useEffect(() => {
    if (!editor || !filePath) return;

    const loadContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const content = await readMarkdownFile(filePath);
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
      const content = editor.storage.markdown?.getMarkdown?.() || editor.getText();
      await performSave(content);
    };

    registerEditor(filePath, saveFn);
    return () => unregisterEditor(filePath);
  }, [editor, filePath, registerEditor, unregisterEditor]);

  const performSave = async (content: string) => {
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
  };

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (editor && !editor.isDestroyed) {
        const content = editor.getHTML();
        performSave(content);
      }
    }, autoSaveInterval);
  }, [editor, autoSaveInterval]);

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
      ? "prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-full px-8 py-8"
      : "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3";

    editor.setOptions({
      editorProps: {
        attributes: {
          class: proseClasses,
        },
      },
    });
  }, [isFullscreen, editor]);

  // Keyboard shortcut for fullscreen
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

  // Manual save handler
  const handleManualSave = async () => {
    if (!editor || editor.isDestroyed) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const content = editor.getHTML();
    await performSave(content);
  };

  const toolbarButton = (
    command: () => boolean,
    isActive: boolean,
    icon: React.ReactNode,
    title: string
  ) => (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-7 w-7 rounded-md",
        isActive && "bg-muted text-foreground"
      )}
      onClick={() => command()}
      title={title}
    >
      {icon}
    </Button>
  );

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
        "bg-background overflow-hidden flex flex-col",
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none border-0"
          : "border rounded-md"
      )}
    >
      {/* Toolbar */}
      <div
        className={cn(
          "flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 flex-wrap shrink-0",
          isFullscreen && "px-4 py-2"
        )}
      >
        {/* Text Style */}
        {editor && toolbarButton(
          () => editor.chain().focus().toggleBold().run(),
          editor.isActive("bold"),
          <Bold className="h-3.5 w-3.5" />,
          "Bold (Ctrl+B)"
        )}
        {editor && toolbarButton(
          () => editor.chain().focus().toggleItalic().run(),
          editor.isActive("italic"),
          <Italic className="h-3.5 w-3.5" />,
          "Italic (Ctrl+I)"
        )}
        {editor && toolbarButton(
          () => editor.chain().focus().toggleUnderline().run(),
          editor.isActive("underline"),
          <UnderlineIcon className="h-3.5 w-3.5" />,
          "Underline (Ctrl+U)"
        )}
        {editor && toolbarButton(
          () => editor.chain().focus().toggleHighlight().run(),
          editor.isActive("highlight"),
          <Highlighter className="h-3.5 w-3.5" />,
          "Highlight"
        )}

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Headings */}
        {editor && toolbarButton(
          () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          editor.isActive("heading", { level: 1 }),
          <Heading1 className="h-3.5 w-3.5" />,
          "Heading 1"
        )}
        {editor && toolbarButton(
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          editor.isActive("heading", { level: 2 }),
          <Heading2 className="h-3.5 w-3.5" />,
          "Heading 2"
        )}

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Lists */}
        {editor && toolbarButton(
          () => editor.chain().focus().toggleBulletList().run(),
          editor.isActive("bulletList"),
          <List className="h-3.5 w-3.5" />,
          "Bullet List"
        )}
        {editor && toolbarButton(
          () => editor.chain().focus().toggleOrderedList().run(),
          editor.isActive("orderedList"),
          <ListOrdered className="h-3.5 w-3.5" />,
          "Numbered List"
        )}
        {editor && toolbarButton(
          () => editor.chain().focus().toggleTaskList().run(),
          editor.isActive("taskList"),
          <CheckSquare className="h-3.5 w-3.5" />,
          "Task List"
        )}

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Blocks */}
        {editor && toolbarButton(
          () => editor.chain().focus().toggleBlockquote().run(),
          editor.isActive("blockquote"),
          <Quote className="h-3.5 w-3.5" />,
          "Quote"
        )}
        {editor && toolbarButton(
          () => editor.chain().focus().toggleCode().run(),
          editor.isActive("code"),
          <Code className="h-3.5 w-3.5" />,
          "Inline Code"
        )}

        <div className="flex-1" />

        {/* Fullscreen Toggle */}
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

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* History */}
        {editor && toolbarButton(
          () => editor.chain().focus().undo().run(),
          false,
          <Undo className="h-3.5 w-3.5" />,
          "Undo"
        )}
        {editor && toolbarButton(
          () => editor.chain().focus().redo().run(),
          false,
          <Redo className="h-3.5 w-3.5" />,
          "Redo"
        )}
      </div>

      {/* Editor */}
      <div
        className={cn(
          "flex-1 overflow-auto",
          isFullscreen && "bg-background"
        )}
      >
        <EditorContent
          editor={editor}
          className={cn(
            "h-full min-h-full",
            isFullscreen
              ? "max-w-[900px] mx-auto px-8 py-8 prose-lg"
              : "prose-sm"
          )}
        />
      </div>

      {/* Status Bar */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-1.5 border-t bg-muted/20 text-xs text-muted-foreground shrink-0",
          isFullscreen && "px-4"
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
            <span className="text-muted-foreground/60">• Press Esc to exit</span>
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

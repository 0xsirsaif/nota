export type AttachmentType = 'file' | 'link';

export interface Attachment {
  id: string;
  session_id: string;
  type: AttachmentType;
  label?: string;
  file_path?: string;
  url?: string;
  created_at: string;
}

export interface CreateAttachmentInput {
  session_id: string;
  type: AttachmentType;
  label?: string;
  file_path?: string;
  url?: string;
}
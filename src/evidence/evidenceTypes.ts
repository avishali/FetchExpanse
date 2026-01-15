export interface AnalyzedMessage {
  id: string; // Gmail ID
  threadId: string;
  date: Date;
  from: string;
  subject: string;
  snippet: string;
  bodyFromHtml?: string;
  attachments: AttachmentMeta[];
  links: LinkMeta[];
}

export interface LinkMeta {
  url: string;
  anchorText?: string;
  context?: string;
}


export interface AttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId?: string; // Gmail specific
}

export interface CapturedLink {
  kind: 'LINK_PDF' | 'LINK_SCREENSHOT' | 'LINK_HTML_SNAPSHOT';
  localPath: string;
  filename: string;
  mimeType: string;
  sha256: string;
  sourceUrl: string;
}

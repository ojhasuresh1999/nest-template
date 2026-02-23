export interface BulkMailRecipient {
  to: string | string[];
  subject: string;
  templateName: string;
  locals?: Record<string, unknown>;
}

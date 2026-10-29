import { docToMarkdown } from '@tasklore/editor';
import type { Comment, ContentFormat, Issue, RichTextOutput } from '@tasklore/shared';
import { plainText } from './rich-text.js';

/** Markdown of a stored document; content the converter does not know falls back to text. */
function markdownOf(doc: RichTextOutput): string {
  if (typeof doc === 'string') return doc;
  try {
    return docToMarkdown(doc);
  } catch {
    return plainText(doc);
  }
}

/** The issue with its rich text in the requested format (D-API-09, E-51). */
export function issueIn(format: ContentFormat, issue: Issue): Issue {
  if (format === 'json' || issue.description === null) return issue;
  return { ...issue, description: markdownOf(issue.description) };
}

export function commentIn(format: ContentFormat, comment: Comment): Comment {
  return format === 'json' ? comment : { ...comment, body: markdownOf(comment.body) };
}

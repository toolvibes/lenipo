import { mergeAttributes, Node } from '@tiptap/core';

export const IMAGE_ALIGNMENTS = ['left', 'center', 'right'] as const;
export type ImageAlignment = (typeof IMAGE_ALIGNMENTS)[number];

/** Where the web app loads a page attachment (E-61). */
export const attachmentUrl = (id: string) => `/api/v1/page-attachments/${id}/content`;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachmentImage: {
      /** Inserts an image of an uploaded page attachment. */
      insertImage: (attrs: { attachmentId: string; alt?: string | null }) => ReturnType;
    };
  }
}

/**
 * A block image that refers to a page attachment by id (E-61); the address is derived, so
 * documents never load content from elsewhere. Width is a share of the text column in percent.
 */
export const AttachmentImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      attachmentId: { default: null },
      alt: { default: null },
      width: { default: null },
      align: { default: 'center' },
      caption: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-attachment-id]',
        getAttrs: (element) => {
          const width = Number(element.getAttribute('data-width'));
          return {
            attachmentId: element.getAttribute('data-attachment-id'),
            alt: element.querySelector('img')?.getAttribute('alt') ?? null,
            width: Number.isInteger(width) && width >= 10 && width <= 100 ? width : null,
            align: element.getAttribute('data-align') ?? 'center',
            caption: element.querySelector('figcaption')?.textContent ?? '',
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { attachmentId, alt, width, align, caption } = node.attrs as {
      attachmentId: string;
      alt: string | null;
      width: number | null;
      align: ImageAlignment;
      caption: string;
    };
    const figure = mergeAttributes(HTMLAttributes, {
      class: 'tl-image',
      'data-attachment-id': attachmentId,
      'data-align': align,
      'data-width': width ?? undefined,
      style: width ? `width: ${width}%` : undefined,
    });
    const img = ['img', { src: attachmentUrl(attachmentId), alt: alt ?? '', loading: 'lazy' }];
    return caption ? ['figure', figure, img, ['figcaption', {}, caption]] : ['figure', figure, img];
  },

  addCommands() {
    return {
      insertImage:
        ({ attachmentId, alt = null }) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { attachmentId, alt } }),
    };
  },
});

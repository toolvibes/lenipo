import { useRouter } from '@tanstack/react-router';
import type { MouseEvent } from 'react';

/**
 * A click handler for rich text: links within Lenipo (other pages, issues) open in the app
 * instead of a new tab. Clicks with a modifier key keep the browser's behaviour.
 */
export function useInAppLinks(): (event: MouseEvent) => void {
  const router = useRouter();
  return (event) => {
    const href = (event.target as HTMLElement).closest('a')?.getAttribute('href');
    if (!href?.startsWith('/') || href.startsWith('//')) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    router.history.push(href);
  };
}

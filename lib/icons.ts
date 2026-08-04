import type { IconifyIcon } from "@iconify/types";
import vscodeIcons from "@iconify-json/vscode-icons/icons.json";

// Icon *data* is exported directly (not a "prefix:name" string) so this file
// stays a plain module with no client/server boundary concerns — the
// `@iconify/react/offline` Icon component that renders it is client-only,
// but registering icons by name via its addCollection() can't be called
// from a file a Server Component imports. Passing the data object directly
// sidesteps that: no registration step needed at all.
function getIcon(name: string): IconifyIcon {
  const icon = vscodeIcons.icons[name as keyof typeof vscodeIcons.icons] as Partial<IconifyIcon> & {
    body: string;
  };
  return {
    body: icon.body,
    width: icon.width ?? vscodeIcons.width,
    height: icon.height ?? vscodeIcons.height,
  };
}

export const FILE_ICON = {
  docx: getIcon("file-type-word"),
  pdf: getIcon("file-type-pdf2"),
  image: getIcon("file-type-image"),
  markdown: getIcon("file-type-markdown"),
  html: getIcon("file-type-html"),
  zip: getIcon("file-type-zip2"),
};

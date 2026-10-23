/** Saves content as a file through a temporary link. */
export function downloadFile(name: string, content: string | Uint8Array, type: string): void {
  const part: BlobPart = typeof content === 'string' ? content : (content as Uint8Array<ArrayBuffer>);
  const url = URL.createObjectURL(new Blob([part], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

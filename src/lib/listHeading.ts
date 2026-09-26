/** Section labels in ingredients/steps: "Crust:", "Cheesecake:", etc. */
export function isListHeading(item: string): boolean {
  return /^[A-Za-z][A-Za-z0-9 &-]{0,40}:$/.test(item.trim())
}

export function listHeadingLabel(item: string): string {
  return item.trim().replace(/:$/, '')
}

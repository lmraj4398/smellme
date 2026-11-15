// "Jasmine Sambac Nuit" -> "jasmine-sambac-nuit"; "Iris Poudré" -> "iris-poudre"; "Kasturi & Co." -> "kasturi-co"
export function slugify(input: string, max = 120): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

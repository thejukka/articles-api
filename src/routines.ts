export const stripHtml = (html: string): string => 
  html.replace(/<[^>]*>?/gm, '')
      .replace('&nbsp;', ' ')
      .replace('&amp;', ' & ')
      .replace(/\s+/g, ' ')
      .trim();


export const stripUnwantedChars = (text: string): string =>
  text.replace(/[^a-zA-Z0-9\s -_]/g, '')
      .trim();


export const countWords = (content: string): number => {
  const stripped = stripHtml(content);
  const words = stripped.trim().split(/\s+/);
  return words.length;
}

export const fetchArticleContent = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.statusText}`);
  }
  return await response.text();
}

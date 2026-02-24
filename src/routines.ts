import { Response } from 'express';
import { URL } from 'url';
import { parse } from 'node-html-parser';


// Standard HTTP status codes for responses
const HTTP_STATUS = {
  OK: 200,
  NOTFOUND: 404,
  SERROR: 500,
  BADREQUEST: 400,
};


const validateURL = (url: string): boolean => { 
  try {
    const urlObj = new URL(url);
    return !!(urlObj.protocol && urlObj.hostname);
  } catch (err) {
    return false;
  }
};

// Send 200 OK response with optional data
const sendSuccess = (res: Response, data?: any) => {
  res.status(HTTP_STATUS.OK).json(data ?? { message: 'Success' });
};

// Send error response with status code and message (and log the error)
const sendError = (res: Response, message: string, statusCode?: number) => {
  // console.error(message);
  res.status(statusCode || HTTP_STATUS.SERROR).json({
    message,
    timestamp: new Date().toISOString()
  });
};


// ----------- Article processing routines -----------


const stripHtml = (html: string): string => 
  html.replace(/<[^>]*>?/gm, '')
      .replace('&nbsp;', ' ')
      .replace('&amp;', ' & ')
      .replace(/\s+/g, ' ')
      .trim();


const countWords = (content: string): number => {
  const stripped = stripHtml(content);
  const words = stripped.trim().split(/\s+/);
  return words.length;
};


const fetchArticleContent = async (url: string): Promise<string> =>
  await fetch(url)
    .then((resp) => 
      resp.status !== HTTP_STATUS.OK
        ? Promise.resolve('')
        : resp.text()
    )
    .catch(err => { throw new Error(err) });


const parseArticleEntry = (html: string): { title: string; content: string; words: number } => {
  try {
    const dom = parse(html);
    const h1 = dom.querySelector('h1');
    const title = h1 ? stripHtml(h1.innerHTML) || 'Untitled' : 'Untitled';
    const paragraphs = dom.querySelectorAll('p');

    const content = Array.from(paragraphs)
                         .map(p => stripHtml(p.innerHTML))
                         .join(' ');

    const words = countWords(content);

    return { title, content, words };
  } catch (err) {
    throw new Error(`Failed to parse article content: ${err}`);
  }
};


export {
  HTTP_STATUS,
  validateURL,
  sendError,
  sendSuccess,
  fetchArticleContent,
  parseArticleEntry
}
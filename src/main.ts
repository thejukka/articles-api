import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import jsdom from 'jsdom';
import YAML from 'yamljs';
import { Article, Section } from './types';
import { 
  initDb, 
  getArticleById, 
  getArticles, 
  getArticlesBySectionId, 
  getArticlesByWordCount, 
  getSectionById, 
  getSections,
  saveArticle,
  addNewSection,
  setSection,
  deleteSection,
  deleteArticle,
} from './db';
import { 
  countWords, 
  fetchArticleContent,
  stripHtml
} 
from './routines';

dotenv.config();

// Standard HTTP status codes for responses
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NOTFOUND: 404,
  SERROR: 500,
  DELETED: 200,
  BADREQUEST: 400,
};

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


// Add Swagger UI
const swaggerSpec = YAML.load('api.yaml');;
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// Initialize database
initDb();


// Helper functions for sending responses
const sendSuccess = (res: Response, data?: any) => {
  res.status(HTTP_STATUS.OK).json(data ?? { message: 'Success' });
}

const sendError = (res: Response, statusCode: number, message: string, err?: any) => {
  console.error(`Error: ${err ?? 'Unknown error'}`);
  res.status(statusCode).json({
    message,
    timestamp: new Date().toISOString()
  });
}


// Get all articles
app.get('/articles', (req: Request, res: Response) => {
  try {
    const articles = getArticles() as Article[] | undefined;
    sendSuccess(res, articles);
  } catch (err) {
    sendError(res, HTTP_STATUS.SERROR, 'Server error', err);
  }
});


// Get an article by ID
app.get('/articles/:id', async (req: Request, res: Response) => {
  try {
    const article = await getArticleById(Number(req.params.id)) as Article | undefined;
    if (article) {
      sendSuccess(res, article);
    } else {
      sendError(res, HTTP_STATUS.NOTFOUND, 'Article not found');
    }
  } catch (err) {
    sendError(res, HTTP_STATUS.SERROR, 'Server error', err);
  }
});


// Get all sections
app.get('/sections', (req: Request, res: Response) => {
  try {
    const sections = getSections() as Section[] | undefined;
    sendSuccess(res, sections);
  } catch (err) {
    sendError(res, HTTP_STATUS.SERROR, 'Server error', err);
  }
});


// Get section by ID
app.get('/sections/:id', (req: Request, res: Response) => {
  try {
    const section = getSectionById(Number(req.params.id)) as Section | undefined;
    if (section) {
      sendSuccess(res);
    } else {
      sendError(res, HTTP_STATUS.NOTFOUND, 'Section not found');
    }
  } catch (err) {
    sendError(res, HTTP_STATUS.SERROR, 'Server error', err);
  }
});



// Get articles by section ID
app.get('/sections/:id/articles', (req: Request, res: Response) => {
  try {
    const sectionId = Number(req.params.id);    
    const articles = getArticlesBySectionId(sectionId) as Article[] | undefined;
    sendSuccess(res, articles);
  } catch (err) {
    sendError(res, HTTP_STATUS.SERROR, 'Server error', err);
  }
});



// Search by word count
app.post('/articles/search', (req: Request, res: Response) => {
  try {
    const { min, max } = req.body;

    if (min === undefined || max === undefined) {
      sendError(res, HTTP_STATUS.BADREQUEST, 'Min and max word counts are required');
      return;
    }

    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 0) {
      sendError(res, HTTP_STATUS.BADREQUEST, 'Min and max must be positive integers');
      return;
    }

    const articles = getArticlesByWordCount(min, max) as Article[] | undefined;
    sendSuccess(res, articles);
  } catch (err) {
    sendError(res, HTTP_STATUS.SERROR, 'Server error', err);
  }
});


// Add a new article by URL
app.post('/articles', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      sendError(res, HTTP_STATUS.BADREQUEST, 'URL is required');
      return;
    }

    if (!(new URL(url))) {
      sendError(res, HTTP_STATUS.BADREQUEST, 'Not valid URL');
      return;
    }

    // Fetch article by URL
    const fecthed = await fetchArticleContent(url);

    // Parse HTML content and extract title and text
    const dom = new jsdom.JSDOM(fecthed);
    const document = dom.window.document;
    const h1 = document.querySelector('h1');
    const title = h1 ? stripHtml(h1.innerHTML) || 'Untitled' : 'Untitled';
    const paragraphs = document.querySelectorAll('p');

    const content = Array.from(paragraphs)
                         .map(p => stripHtml(p.innerHTML))
                         .join(' '); 

    // Count words in the content
    const words = countWords(content);

    await saveArticle(url, title, words, content);
    
    sendSuccess(res);
  } catch (err) {
    sendError(res, HTTP_STATUS.SERROR, 'Server error', err);
  }
});


// Update article's section
app.put('/articles/:id/section', (req: Request, res: Response) => {
  try {
    const articleId = Number(req.params.id); 
    const { id } = req.body; 
    if (!id) {
      sendError(res, HTTP_STATUS.BADREQUEST, 'Section ID is required');
      return;
    }
    setSection(articleId, id);
    sendSuccess(res);
  } catch (err) {
    sendError(res, HTTP_STATUS.SERROR, 'Server error', err);
  }
});



// Add a new section
app.post('/sections', (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      sendError(res, HTTP_STATUS.BADREQUEST, 'Title is required');
      return;
    }

    addNewSection(title);
    sendSuccess(res);
  } catch (err) {
    sendError(res, HTTP_STATUS.SERROR, 'Server error', err);
  }
});


// Delete section by ID
app.delete('/sections/:id', (req: Request, res: Response) => {    
  try {
    const sectionId = Number(req.params.id);
    deleteSection(sectionId);
    sendSuccess(res);
  } catch (err) {
    sendError(res, HTTP_STATUS.SERROR, 'Server error', err);
  }
});


// Delete article by ID
app.delete('/articles/:id', (req: Request, res: Response) => {    
  try {
    const articleId = Number(req.params.id);    
    deleteArticle(articleId);
    sendSuccess(res, { message: 'Article deleted' });
  } catch (err) {
    sendError(res, HTTP_STATUS.SERROR, 'Server error', err);
  }
});



// Check if alive
app.get('/ping', (req: Request, res: Response) => {
  sendSuccess(res, { message: 'pong' });
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
});
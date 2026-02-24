import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import YAML from 'yamljs';
import crypto from 'crypto';

import { 
  Article, 
  Section, 
  JobStatus 
} from './types';

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
  deleteArticle
} from './db';

import { 
  fetchArticleContent,
  HTTP_STATUS,
  sendError,
  sendSuccess,
  validateURL,
  parseArticleEntry
} from './routines';

// Load environment variables from .env file
dotenv.config();

// Create the app instance
const app: Express = express();
const port = process.env.PORT || 3000;


// Middleware
app.use(cors());
app.use(express.json());


// Add Swagger UI
const swaggerSpec = YAML.load('api.yaml');;
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// Initialize database
initDb();


const jobs: Record<string, JobStatus> = {};


// Set error status
const setJobsError = (id: string, message?: string, code?: number) => {
  const job = jobs[id]
  
  if (!job) return;

  job.status = 'error';
  job.error = message || 'Unknown error';
  job.code = code || HTTP_STATUS.SERROR;
}


// Get the current status of a job
const getJob = (id: string): JobStatus | undefined => {
  const job = jobs[id];
  if (!job) {
    return undefined;
  }
  return job;
}

// Prevent jobs to grow super high!
const deleteProcessed = () => {
  for (let i in jobs) {
    if (jobs[i].status === 'done' || jobs[i].status === 'error')
      delete jobs[i];
  }
}


// Process an article in the background
const processArticle = async (res: Response, url: string, id: string) => {
  const job: JobStatus = jobs[id] = { id, status: 'fetching' };
  await fetchArticleContent(url)
    .then(html => {
      if (!html || html.trim() === '') {
        setJobsError(id, 'Could not load any content, check the URL and accessibility');
        return;
      }         
      return html;
    }).then(article => {
      if (!article) return;
      job.status = 'parsing';
      const { title, content, words } = parseArticleEntry(article);

      if (!title || !content) {
        setJobsError(id, 'Could not parse article content');
        return;
      }

      job.status = 'saving';
      saveArticle(url, title, words, content);

      job.status = 'done';
  }).catch(err => {
    console.error(`Error processing article at ${url}:\n\n ${err}`);
    setJobsError(id, err)
  });
};



// Endpoint to query status of a background job
app.get('/jobs/:id', (req: Request, res: Response) => {
  const jobId: string = String(req.params.id);
  const job: JobStatus | undefined = getJob(jobId);
  const current = job;
  if (current) {
    switch (current.status) {
      case 'error':
        deleteProcessed();
        sendError(res, current.error || 'Uknown error');
        break;
      case 'done':
        deleteProcessed();
        sendSuccess(res, { status: current.status });
        break;
      default:
        sendSuccess(res, { status: current.status });
    }
  } else {
    sendError(res, 'Job not found, it may have already completed or the ID is invalid', HTTP_STATUS.NOTFOUND);
  }
});


// Get all articles
app.get('/articles', (req: Request, res: Response) => {
  try {
    const articles = getArticles() as Article[] | undefined;
    sendSuccess(res, articles);
  } catch (err) {
    sendError(res, String(err));
  }
});


// Get an article by ID
app.get('/articles/:id', (req: Request, res: Response) => {
  try {
    const article = getArticleById(Number(req.params.id)) as Article | undefined;
    if (article) {
      sendSuccess(res, article);
    } else {
      sendError(res, 'Article not found', HTTP_STATUS.NOTFOUND);
    }
  } catch (err) {
    sendError(res, String(err));
  }
});


// Get all sections
app.get('/sections', (req: Request, res: Response) => {
  try {
    const sections = getSections() as Section[] | undefined;
    sendSuccess(res, sections);
  } catch (err) {
    sendError(res, 'Failed to retrieve sections', HTTP_STATUS.SERROR);
  }
});


// Get section by ID
app.get('/sections/:id', (req: Request, res: Response) => {
  try {
    const section = getSectionById(Number(req.params.id)) as Section | undefined;
    if (section) {
      sendSuccess(res, section);
    } else {
      sendError(res, 'Section not found', HTTP_STATUS.NOTFOUND);
    }
  } catch (err) {
    sendError(res, String(err));
  }
});



// Get articles by section ID
app.get('/sections/:id/articles', (req: Request, res: Response) => {
  try {
    const sectionId = Number(req.params.id);    
    const articles = getArticlesBySectionId(sectionId);
    sendSuccess(res, articles);
  } catch (err) {
    sendError(res, String(err));
  }
});



// Search by word count
app.post('/articles/search', (req: Request, res: Response) => {
  try {
    const { min, max } = req.body;

    if (min === undefined || max === undefined) {
      sendError(res, 'Min and max word counts are required', HTTP_STATUS.BADREQUEST);
      return;
    }

    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 0) {
      sendError(res, 'Min and max must be positive integers', HTTP_STATUS.BADREQUEST);
      return;
    }

    const articles = getArticlesByWordCount(min, max) as Article[] | undefined;
    sendSuccess(res, articles);
  } catch (err) {
    sendError(res, String(err));
  }
});



// Add an article by URL, offer process information via background job endpoint
app.post('/articles', async (req: Request, res: Response, next) => {
    const { url } = req.body;

    if (!url) {
      sendError(res, 'URL is required', HTTP_STATUS.BADREQUEST);
      return;
    }

    if (!validateURL(url)) {
      sendError(res, 'Not valid URL', HTTP_STATUS.BADREQUEST);
      return;
    }

    const jobId = crypto.randomUUID();
    jobs[jobId] = { id: jobId, status: 'queued' };

    // Process the article in the background and update job status accordingly
    void processArticle(res, url, jobId);

    sendSuccess(res, {
        jobId,
        processUrl: `/jobs/${jobId}`, 
        status: 'queued' 
    });
});



// Update article's section
app.put('/articles/:id/section', (req: Request, res: Response) => {
  try {
    const articleId = Number(req.params.id); 
    const { id } = req.body; 
    if (!id) {
      sendError(res, 'Section ID is required', HTTP_STATUS.BADREQUEST);
      return;
    }
    setSection(articleId, id);
    sendSuccess(res);
  } catch (err) {
    sendError(res, String(err));
  }
});



// Add a new section
app.post('/sections', (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      sendError(res, 'Title is required', HTTP_STATUS.BADREQUEST);
      return;
    }

    addNewSection(title);
    sendSuccess(res);
  } catch (err) {
    sendError(res, String(err));
  }
});



// Delete section by ID
app.delete('/sections/:id', async (req: Request, res: Response) => {    
  try {
    const sectionId = Number(req.params.id);
    deleteSection(sectionId);
    sendSuccess(res);
  } catch (err) {
    sendError(res, String(err));
  }
});


// Delete article by ID
app.delete('/articles/:id', (req: Request, res: Response) => {    
  try {
    const articleId = Number(req.params.id);    
    deleteArticle(articleId);
    sendSuccess(res, { message: 'Article deleted' });
  } catch (err) {
    sendError(res, String(err));
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


export { app };
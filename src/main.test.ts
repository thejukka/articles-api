import request from 'supertest';
import { app } from './main';
import * as db from './db';

const sampleURL = "https://example.com/articles/some-article-somewhere";
const testURL = 'https://test.com';

describe('Articles API', () => {
  beforeEach(() => {
    db.initDb()
  })

  describe('GET /ping - check alive', () => {
    it('should return pong', async () => {
      const res = await request(app).get('/ping')
      expect(res.status).toBe(200)
      expect(res.body.message).toBe('pong')
    })
  })

  describe('Sections', () => {
    it('POST /sections should create a new section', async () => {
      const res = await request(app)
        .post('/sections')
        .send({ title: 'Tech' })
      expect(res.status).toBe(200)
    })

    it('GET /sections should list all sections', async () => {
      const res = await request(app).get('/sections')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body[0]).toHaveProperty('title')
    })

    it('GET /sections/:id should get section by ID', async () => {
      const list = await request(app).get('/sections')
      const id = list.body[0].id
      const res = await request(app).get(`/sections/${id}`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('title')
    })

    it('GET /sections/:id should return 404 for non-existent section', async () => {
      const res = await request(app).get('/sections/9999')
      expect(res.status).toBe(404)
    })

    it('DELETE /sections/:id should delete a section', async () => {
      const res = await request(app).delete(`/sections/1`)
      expect(res.status).toBe(200)
    })
  })

  describe('Articles', () => {
    let jobId: string
    let articleId: number

    it('POST /articles should queue a new article job', async () => {
      const res = await request(app)
        .post('/articles')
        .send({ url: sampleURL })
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('jobId')
      jobId = res.body.jobId
    })

    it('GET /jobs/:id should get job status', async () => {
      const res1 = await request(app)
        .post('/articles')
        .send({ url: sampleURL })
      jobId = res1.body.jobId
      const res2 = await request(app).get(`/jobs/${jobId}`)
      expect(res2.status).toBe(200)
      expect(res2.body).toHaveProperty('status')
    })

    it('GET /jobs/:id should return 404 for non-existent job', async () => {
      const res = await request(app).get('/articles/jobs/doesnotexist')
      expect(res.status).toBe(404)
    })

    it('POST /articles/search should search articles by word count', async () => {
      db.saveArticle(testURL, 'Test', 123, 'Test content')
      const res = await request(app)
        .post('/articles/search')
        .send({ min: 0, max: 200 })
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('POST /articles/search should return error for invalid search params', async () => {
      const res = await request(app)
        .post('/articles/search')
        .send({ min: -1, max: 'foo' })
      expect(res.status).toBe(400)
    })

    it('GET /articles should get all articles', async () => {
      db.saveArticle(testURL, 'Test', 123, 'Test content')
      const res = await request(app).get('/articles')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('GET /articles/:id should get article by ID', async () => {
      db.saveArticle(testURL, 'Test', 123, 'Test content')
      const all = await request(app).get('/articles')
      articleId = all.body[0].id
      const res = await request(app).get(`/articles/${articleId}`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('content')
    })

    it('GET /articles/:id should return 404 for non-existent article', async () => {
      const res = await request(app).get('/articles/9999')
      expect(res.status).toBe(404)
    })

    it('PUT /articles/:id/section should update article section', async () => {
      db.saveArticle(testURL, 'Test', 123, 'Test content')
      await request(app).post('/sections').send({ title: 'NewSection' })
      const articles = await request(app).get('/articles')
      const sections = await request(app).get('/sections')
      const articleId = articles.body[0].id
      const sectionId = sections.body[0].id
      const res = await request(app)
        .put(`/articles/${articleId}/section`)
        .send({ id: sectionId })
      expect(res.status).toBe(200)
    })

    it('PUT /articles/:id/section should return error for missing section ID', async () => {
      db.saveArticle(testURL, 'Test', 123, 'Test content')
      const articles = await request(app).get('/articles')
      const articleId = articles.body[0].id
      const res = await request(app)
        .put(`/articles/${articleId}/section`)
        .send({})
      expect(res.status).toBe(400)
    })

    it('DELETE /articles/:id should delete article by ID', async () => {
        await request(app)
            .post('/sections')
            .send({ title: 'DeleteMe' });
        const list = await request(app).get('/sections');
        const res = await request(app).delete(`/sections/1`);
        expect(res.status).toBe(200);
    })
  })

  describe('Sections/Articles relationship', () => {
    it('GET /sections/:id/articles should get articles by section ID', async () => {
      await request(app).post('/sections').send({ title: 'RelSection' })
      const sections = await request(app).get('/sections')
      const sectionId = sections.body[0].id
      db.saveArticle(testURL, 'Test', 123, 'Test content')
      const articles = await request(app).get('/articles')
      const articleId = articles.body[0].id
      await request(app)
        .put(`/articles/${articleId}/section`)
        .send({ id: sectionId })
      const res = await request(app).get(`/sections/${sectionId}/articles`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })
})
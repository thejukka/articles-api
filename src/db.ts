import Database from 'better-sqlite3';

const db: Database.Database = new Database(':memory:');

// Enable foreign keys
db.pragma('foreign_keys = ON');

const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      words INTEGER NOT NULL,
      section INTEGER DEFAULT NULL,
      content TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL
    );
  `);
}

const getArticles = () => 
  db.prepare(`
    SELECT id, url, title, section, words 
    FROM articles`
  ).all();

const getSections = () => 
  db.prepare('SELECT id, title FROM sections').all();


const getArticleById = (id: number) => 
  db.prepare('SELECT content FROM articles WHERE id = ?').get(id);


const getSectionById = (id: number) => 
  db.prepare('SELECT id, title FROM sections WHERE id = ?').get(id);


const getArticlesBySectionId = (sectionId: number) => 
  db.prepare(`
    SELECT id, title FROM articles WHERE section = ?`).all(sectionId);   


const getArticlesByWordCount = (minWords: number = 0, maxWords: number = Number.MAX_SAFE_INTEGER) => (
  db.prepare('SELECT id,title,words FROM articles WHERE words BETWEEN ? AND ?')
    .all(minWords, maxWords))


const saveArticle = (
  url: string, 
  title: string, 
  words: number, 
  content: string
) =>
  db.prepare(`
    INSERT INTO articles (url, title, words, content) 
    VALUES (?, ?, ?, ?)`)
    .run(url, title, words, content);




const setSection = (articleId: number, sectionId: number) => {
  try {
    const section = db.prepare('SELECT id FROM sections WHERE id = ?').run(sectionId);
    if (section)
      db.prepare('UPDATE articles SET section = ? WHERE id = ?')
        .run(sectionId, articleId);
    else
      throw new Error('No such section with given ID')    
  } catch(err) {
    throw new Error(String(err));
  }
} 


const addNewSection = (title: string) => {
  db.prepare('INSERT INTO sections (title) VALUES (?)').run(title);
}

const deleteSection = (sectionId: number) => {
  const sectionArticles = db.prepare('SELECT id FROM articles WHERE section = ?').all(sectionId);

  // Check if articles are associated with the section before deleting
  if (sectionArticles.length > 0) 
    db.prepare('UPDATE articles SET section = NULL WHERE section = ?').run(sectionId);

  db.prepare('DELETE FROM sections WHERE id = ?').run(sectionId);
} 

const deleteArticle = (articleId: number) => 
  db.prepare('DELETE FROM articles WHERE id = ?').run(articleId);


// ----------- Exports -----------


export { 
  initDb,
  getArticles, 
  getSections, 
  getArticleById, 
  getSectionById, 
  getArticlesBySectionId, 
  getArticlesByWordCount,
  saveArticle,
  setSection,
  addNewSection,
  deleteSection,
  deleteArticle
};

const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(express.urlencoded({ extended: false }));

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, content, created_at FROM notes ORDER BY created_at DESC'
    );

    const notesHtml = result.rows
      .map(
        (note) => `
          <li>
            <p>${escapeHtml(note.content)}</p>
            <small>${new Date(note.created_at).toLocaleString()}</small>
          </li>`
      )
      .join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="no">
      <head>
        <meta charset="UTF-8">
        <title>Notater</title>
        <style>
          body { font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 0 16px; }
          ul { list-style: none; padding: 0; }
          li { border-bottom: 1px solid #ddd; padding: 12px 0; }
          small { color: #666; }
          form { margin-bottom: 24px; display: flex; gap: 8px; }
          textarea { flex: 1; padding: 8px; }
          button { padding: 8px 16px; }
        </style>
      </head>
      <body>
        <h1>Notater</h1>
        <form method="POST" action="/notes">
          <textarea name="content" rows="2" required placeholder="Skriv et notat..."></textarea>
          <button type="submit">Legg til</button>
        </form>
        <ul>
          ${notesHtml || '<li>Ingen notater ennå.</li>'}
        </ul>
      </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
});

app.post('/notes', async (req, res, next) => {
  try {
    const content = (req.body.content || '').trim();
    if (content) {
      await pool.query('INSERT INTO notes (content) VALUES ($1)', [content]);
    }
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Noe gikk galt.');
});

createTable()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server kjører på port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Kunne ikke opprette tabell:', err);
    process.exit(1);
  });

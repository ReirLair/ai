const express = require('express');
const axios = require('axios');
const app = express();

const PORT = 7860;

// Validate ID: must be digits only
function isValidSessionId(id) {
  return /^\d+$/.test(id);
}

// Main function to talk to Claila
async function talkToClaila(model, message, sessionId) {
  if (!isValidSessionId(sessionId)) {
    throw new Error('Invalid session ID format.');
  }

  // Step 1: Initial "completion" call
  await axios.post(
    'https://app.claila.com/api/v2/unichat1',
    new URLSearchParams({
      message,
      sessionId
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    }
  );

  // Step 2: Fetch CSRF token
  const csrfRes = await axios.get('https://app.claila.com/api/v2/getcsrftoken', {
    headers: {
      'Accept': '*/*',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });

  const csrfToken = csrfRes.data.trim();

  // Step 3: Final call to specific model
  const finalRes = await axios.post(
    `https://app.claila.com/api/v2/unichat1/${model}`,
    new URLSearchParams({
      calltype: 'completion',
      message,
      sessionId
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': '*/*',
        'X-CSRF-Token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest'
      }
    }
  );

  return finalRes.data;
}

// Route handler factory
function createRoute(model) {
  return async (req, res) => {
    const { id, message } = req.query;

    if (!id || !message) {
      return res.status(400).json({ error: 'Missing id or message' });
    }

    if (!isValidSessionId(id)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    try {
      const reply = await talkToClaila(model, message, id);

      try {
        const parsed = JSON.parse(reply);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(parsed));
      } catch {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ response: reply }));
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error talking to Claila' });
    }
  };
}
// Define routes for each model
app.get('/grok', createRoute('grok'));
app.get('/gemini', createRoute('gemini'));
app.get('/claude', createRoute('claude'));
app.get('/chatgpt', createRoute('chatgpt'));
app.get('/mistral', createRoute('mistral'));
app.get('/gpt41', createRoute('chatgpt41mini'));

// Start server
app.listen(PORT, () => {
  console.log(`Claila proxy server running at http://localhost:${PORT}`);
});

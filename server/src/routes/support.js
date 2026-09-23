/**
 * Comprehension + writing support routes. All of them work offline except the
 * dictionary lookup, which degrades to the offline word knowledge instead of
 * failing.
 */

import { Router } from 'express';
import { asyncHandler, badRequest } from '../lib/http.js';
import { defineWord } from '../modules/comprehension/define.js';
import { buildGlossary } from '../modules/comprehension/glossary.js';
import { simplifyText, LEVEL_LABELS, LEVELS } from '../modules/comprehension/simplify.js';
import { summarize } from '../modules/comprehension/summarize.js';
import { checkWriting } from '../modules/writing/checks.js';
import { getDocument } from '../services/reading-data.js';

export const supportRouter = Router();

function scopeFrom(req) {
  return {
    profileId: req.profile?.id ?? (req.body?.profileId || req.query.profileId || null),
    deviceId: req.body?.deviceId || req.query.deviceId || req.get('x-device-id') || null,
  };
}

supportRouter.get(
  '/dictionary/:word',
  asyncHandler(async (req, res) => {
    const result = await defineWord(req.params.word);
    res.json(result);
  })
);

supportRouter.post(
  '/define',
  asyncHandler(async (req, res) => {
    const word = String(req.body?.word || '').trim();
    if (!word) throw badRequest('Which word would you like to look up?');
    res.json(await defineWord(word));
  })
);

supportRouter.get('/levels', (_req, res) => {
  res.json({ levels: LEVELS, labels: LEVEL_LABELS });
});

supportRouter.post(
  '/simplify',
  asyncHandler((req, res) => {
    const { text, level = 8 } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) throw badRequest('Give me some text to explain.');
    const target = LEVELS.includes(level) ? level : Number(level) || 8;
    res.json({ result: simplifyText(text, target), levels: LEVEL_LABELS });
  })
);

supportRouter.post(
  '/summarize',
  asyncHandler(async (req, res) => {
    const { documentId, text, level = 'adult', withGlossary = true, withSummary = true } = req.body || {};
    let source = typeof text === 'string' ? text : '';
    let title = null;
    if (documentId) {
      const doc = getDocument(documentId, scopeFrom(req));
      if (!doc) throw badRequest('That document is not available.');
      source = doc.text;
      title = doc.title;
    }
    if (!source.trim()) throw badRequest('Nothing to summarise yet.');

    const summary = withSummary ? summarize(source) : null;
    const glossary = withGlossary
      ? await buildGlossary(source, { maxTerms: 10, deadlineMs: 4000 })
      : [];
    const simplified =
      level && level !== 'adult'
        ? {
            keyPoints: summary ? simplifyText(summary.keyPoints.map((k) => k.text).join(' '), level) : null,
          }
        : null;

    res.json({
      title,
      summary,
      glossary,
      simplified,
      levels: LEVEL_LABELS,
    });
  })
);

supportRouter.post(
  '/writing/check',
  asyncHandler((req, res) => {
    const { text } = req.body || {};
    if (typeof text !== 'string') throw badRequest('Nothing to check yet.');
    res.json(checkWriting(text));
  })
);

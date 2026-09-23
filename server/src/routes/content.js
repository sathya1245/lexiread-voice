/**
 * Content routes: upload (PDF / image / pasted text) -> extraction -> library.
 */

import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { newId } from '../auth.js';
import { run } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { extractContent } from '../modules/extract/index.js';
import { textStats } from '../modules/extract/text.js';
import { createDocument, getDocument, loadDocuments } from '../services/reading-data.js';

export const contentRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
});

function scopeFrom(req) {
  return {
    profileId: req.profile?.id ?? (req.body?.profileId || req.query.profileId || null),
    deviceId: req.body?.deviceId || req.query.deviceId || req.get('x-device-id') || null,
  };
}

contentRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const scope = scopeFrom(req);
    const pasted = typeof req.body?.text === 'string' ? req.body.text : '';
    if (!req.file && !pasted.trim()) throw badRequest('Add a file or paste some text first.');

    const extracted = await extractContent({
      buffer: req.file?.buffer,
      mimetype: req.file?.mimetype,
      filename: req.file?.originalname,
      text: pasted,
    });

    if (!extracted.text.trim()) {
      return res.status(422).json({
        error: 'No readable text was found in that file.',
        hints: extracted.meta?.warnings || [],
      });
    }

    const title = (req.body?.title || '').trim() || extracted.title || 'Untitled';
    const id = newId('d_');
    const doc = createDocument({
      id,
      profileId: scope.profileId,
      deviceId: scope.deviceId,
      title,
      source: req.file ? (req.file.mimetype === 'application/pdf' ? 'pdf' : 'image') : 'paste',
      kind: extracted.kind,
      text: extracted.text,
      wordCount: extracted.stats?.words ?? textStats(extracted.text).words,
      pages: extracted.pages,
      meta: { ...extracted.meta, stats: extracted.stats },
    });

    res.status(201).json({
      document: {
        id: doc.id,
        title: doc.title,
        kind: doc.kind,
        source: doc.source,
        text: doc.text,
        wordCount: doc.word_count,
        pages: doc.pages,
        meta: JSON.parse(doc.meta || '{}'),
        createdAt: doc.created_at,
      },
    });
  })
);

contentRouter.get(
  '/',
  asyncHandler((req, res) => {
    const docs = loadDocuments(scopeFrom(req));
    res.json({
      documents: docs.map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        source: d.source,
        wordCount: d.word_count,
        pages: d.pages,
        meta: JSON.parse(d.meta || '{}'),
        createdAt: d.created_at,
      })),
    });
  })
);

contentRouter.get(
  '/:id',
  asyncHandler((req, res) => {
    const doc = getDocument(req.params.id, scopeFrom(req));
    if (!doc) throw notFound('That document is not available.');
    res.json({
      document: {
        id: doc.id,
        title: doc.title,
        kind: doc.kind,
        source: doc.source,
        text: doc.text,
        wordCount: doc.word_count,
        pages: doc.pages,
        meta: JSON.parse(doc.meta || '{}'),
        createdAt: doc.created_at,
      },
    });
  })
);

contentRouter.delete(
  '/:id',
  asyncHandler((req, res) => {
    const scope = scopeFrom(req);
    const doc = getDocument(req.params.id, scope);
    if (!doc) throw notFound('That document is not available.');
    run(`DELETE FROM documents WHERE id = ?`, [doc.id]);
    res.json({ ok: true });
  })
);


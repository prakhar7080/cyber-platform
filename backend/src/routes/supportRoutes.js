// routes/supportRoutes.js
import express from 'express';
import { submitContact } from '../controllers/supportController.js';

const router = express.Router();

// Contact form submission
router.post('/contact', submitContact);

export default router;




const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;
const DIST = path.join(__dirname, 'dist/frontend/browser');

app.use(express.static(DIST));
app.get(/.*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
app.listen(PORT, () => console.log(`LeadMeet running on port ${PORT}`));

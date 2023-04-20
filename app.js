const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();


const indexRoutes = require('./routes/index');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/', indexRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
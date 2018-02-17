let Router = require('express').Router;

const router = Router();

router.get('/signup', (req, res) => {
    res.render('pages/signup.ejs', { message: ''});
});

router.get('/login', (req, res) => {
    res.render('pages/login.ejs', { message: ''});
});

router.get('/inicio', (req, res) => {
    res.render('pages/inicio.ejs', { message: ''});
});

router.get('/dispatch/to-be-asigned', (req, res) => {
    res.render('pages/dispatch-to-be-asigned.ejs', { message: ''});
});

exports.router = router;

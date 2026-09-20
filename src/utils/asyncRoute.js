// Enveloppe une route async et transmet toute erreur au error handler global,
// pour éviter de répéter try/catch dans chaque controller.
function asyncRoute(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

module.exports = asyncRoute;
import { Router } from "https://deno.land/x/oak/mod.ts";
import { getShorts , getShort, addShort, updateShort, deleteShort } from "./controllers/shorteners.ts";

const router = new Router();

router.get('/api/shorts', getShorts)
    .get('/api/shorts/:name', getShort)
    .post('/api/shorts', addShort)
    .put('/api/shorts/:name', updateShort)
    .delete('/api/shorts/:name', deleteShort)
    ;

router.get('/',(ctx) => {
    ctx.response.body = "Welcome screen";
})

export default router;